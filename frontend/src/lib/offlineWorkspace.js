const network = window.fetch.bind(window)
const snapshots = new Set(['/api/todos', '/api/folders', '/api/pdfs?includeTrash=1', '/api/pdf-folders', '/api/account/section-locks', '/api/account/policies'])
const filePath = /^\/api\/pdfs\/([a-f\d]{24})$/
const savePath = /^(\/api\/pdfs\/[a-f\d]{24})\/(annotations|content)$/
const taskPath = /^\/api\/todos\/([a-f\d]{24})$/
const tokenScopes = new Map()
const notify = () => window.dispatchEvent(new Event('offline-workspace-change'))
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
let database

function db() {
  database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open('assignmenttracker-offline', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('records')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return database
}

async function transaction(mode, operation) {
  const connection = await db()
  return new Promise((resolve, reject) => {
    const tx = connection.transaction('records', mode)
    const request = operation(tx.objectStore('records'))
    tx.oncomplete = () => resolve(request?.result)
    tx.onabort = tx.onerror = () => reject(tx.error || new Error('Offline storage is unavailable.'))
  })
}

const get = key => transaction('readonly', store => store.get(key))
const put = (key, value) => transaction('readwrite', store => store.put(value, key))
const drop = key => transaction('readwrite', store => store.delete(key))
const keys = prefix => transaction('readonly', store => store.getAllKeys(IDBKeyRange.bound(prefix, prefix + '\uffff')))

async function scopeFor(token) {
  if (!tokenScopes.has(token)) {
    tokenScopes.set(token, crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
      .then(bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')))
  }
  return tokenScopes.get(token)
}

const snapshotKey = (scope, path) => `${scope}:read:${path}`
const jobsKey = scope => `${scope}:job:`
const retryable = response => [502, 503, 504].includes(response.status)
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), byte => byte.toString(16).padStart(2, '0')).join('')
const folderKey = value => String(value?._id || value || '')
const eligible = file => file.mimeType === 'application/pdf' || /\.(pdf|md|markdown|txt)$/i.test(file.originalName || '')

async function isLocked(scope, section, folder, fileId) {
  const settings = await get(snapshotKey(scope, '/api/account/section-locks'))
  if (!Array.isArray(settings?.lockedSections)) return true
  const locks = new Set(settings.lockedSections)
  if (locks.has(section) || (fileId && locks.has(`file:${fileId}`))) return true
  if (!folder) return false
  const folders = await get(snapshotKey(scope, section === 'tasks' ? '/api/folders' : '/api/pdf-folders'))
  const parents = new Map((folders || []).map(item => [item._id, item.parentId]))
  const visited = new Set()
  for (let id = folderKey(folder); id; id = folderKey(parents.get(id))) {
    if (!parents.has(id) || visited.has(id) || locks.has(`${section}:${id}`)) return true
    visited.add(id)
  }
  return false
}

export async function offlineFiles(token) {
  const scope = await scopeFor(token)
  const prefix = `${scope}:pin:`
  return Promise.all((await keys(prefix)).map(async key => ({ id: key.slice(prefix.length), ...(await get(key)) })))
}

export async function toggleOfflineFile(token, file, pinned) {
  const scope = await scopeFor(token)
  const path = `/api/pdfs/${file._id}`
  const pin = `${scope}:pin:${file._id}`
  if (!pinned) {
    const jobs = await offlineJobs(token)
    if (jobs.some(job => job.path.startsWith(path + '/'))) throw new Error('Sync or resolve pending edits before removing this offline copy.')
    await drop(pin)
    await drop(snapshotKey(scope, path))
  } else {
    if (!eligible(file) || file.deletedAt || await isLocked(scope, 'documents', file.pdfFolder, file._id)) {
      throw new Error('Only unlocked PDFs and text files can be made available offline.')
    }
    const response = await network(path, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
    if (!response.ok) throw new Error('Connect to the app before saving an offline copy.')
    const data = await response.json()
    if (!data.pdfData || data.deletedAt || await isLocked(scope, 'documents', data.pdfFolder, data._id)) throw new Error('This file cannot be saved offline.')
    await put(snapshotKey(scope, path), data)
    await put(pin, { savedAt: new Date().toISOString() })
  }
  notify()
}

async function saveLockSettings(scope, token, settings) {
  await put(snapshotKey(scope, '/api/account/section-locks'), settings)
  for (const pin of await offlineFiles(token)) {
    const key = snapshotKey(scope, `/api/pdfs/${pin.id}`)
    const file = await get(key)
    if (file && await isLocked(scope, 'documents', file.pdfFolder, pin.id)) {
      await drop(key)
      await drop(`${scope}:pin:${pin.id}`)
    }
  }
  notify()
}

export async function offlineJobs(token) {
  const scope = await scopeFor(token)
  return (await Promise.all((await keys(jobsKey(scope))).map(async key => ({ key, ...(await get(key)) }))))
    .filter(job => job.path).sort((left, right) => left.createdAt - right.createdAt)
}

function updateTask(tasks, job) {
  const id = job.body.offlineId || taskPath.exec(job.path)?.[1]
  if (job.method === 'POST') return tasks.some(task => task._id === id) ? tasks : [...tasks, {
    ...job.body, _id: id, status: 'todo', createdAt: new Date(job.createdAt).toISOString()
  }]
  return tasks.map(task => task._id === id ? { ...task, status: job.body.status, completedAt: job.body.status === 'completed' ? new Date(job.createdAt).toISOString() : null } : task)
}

function updateFile(file, job) {
  return job.path.endsWith('/annotations') ? { ...file, annotations: job.body.annotations }
    : { ...file, pdfData: job.body.data, mimeType: job.body.mimeType || file.mimeType, annotations: [] }
}

async function fallback(scope, token, path, method, body) {
  if (method === 'GET') {
    let data = await get(snapshotKey(scope, path))
    if (data === undefined) return json({ message: 'This content is not available offline yet.' }, 503)
    const jobs = await offlineJobs(token)
    if (path === '/api/todos') {
      data = jobs.filter(job => job.path.startsWith('/api/todos')).reduce(updateTask, data)
      data = (await Promise.all(data.map(async task => await isLocked(scope, 'tasks', task.folder) ? null : task))).filter(Boolean)
    }
    if (path === '/api/pdfs?includeTrash=1') {
      const pins = new Set((await offlineFiles(token)).map(file => file.id))
      data = (await Promise.all(data.map(async file => pins.has(file._id) && !file.deletedAt && !await isLocked(scope, 'documents', file.pdfFolder, file._id) ? file : null))).filter(Boolean)
    }
    if (filePath.test(path)) {
      if (!await get(`${scope}:pin:${data._id}`) || await isLocked(scope, 'documents', data.pdfFolder, data._id)) return json({ message: 'This document is not available offline.' }, 503)
      data = jobs.filter(job => job.path.startsWith(path + '/')).reduce(updateFile, data)
    }
    return json(data)
  }
  const document = savePath.exec(path)
  const task = taskPath.exec(path)
  const jobs = await offlineJobs(token)
  const createdAt = Date.now()
  let base, saved
  if (document) {
    const file = await get(snapshotKey(scope, document[1]))
    if (!file?.updatedAt || !await get(`${scope}:pin:${file._id}`) || await isLocked(scope, 'documents', file.pdfFolder, file._id)) {
      return json({ message: 'Make this document available offline before editing it offline.' }, 503)
    }
    base = file.updatedAt
    saved = { updatedAt: base, offline: true }
  } else {
    const original = await get(snapshotKey(scope, '/api/todos')) || []
    const tasks = jobs.filter(job => job.path.startsWith('/api/todos')).reduce(updateTask, original)
    const target = task && tasks.find(item => item._id === task[1])
    if ((task && !target) || await isLocked(scope, 'tasks', target?.folder || body.folder)) {
      return json({ message: 'This task is not available for offline editing.' }, 503)
    }
    saved = updateTask(tasks, { path, method, body, createdAt }).find(item => item._id === (task?.[1] || body.offlineId))
  }
  await put(jobsKey(scope) + createdAt + ':' + newId(), { path, method, body, createdAt, base,
    name: document ? (await get(snapshotKey(scope, document[1])))?.name : saved?.text })
  notify()
  const response = json(saved, method === 'POST' ? 201 : 200)
  response.headers.set('X-AssignmentTracker-Offline', 'true')
  return response
}

export function installOfflineWorkspace() {
  if (!window.isSecureContext || !window.indexedDB || !crypto.subtle) return
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/offline-worker.js').catch(() => {}), { once: true })
  }
  window.fetch = async (input, init = {}) => {
    if (typeof input !== 'string' || !input.startsWith('/api/')) return network(input, init)
    const headers = new Headers(init.headers)
    const token = /^Bearer (.+)$/.exec(headers.get('Authorization') || '')?.[1]
    if (!token) return network(input, init)
    const method = init.method?.toUpperCase() || 'GET'
    if (method === 'PUT' && input === '/api/account/section-locks') {
      const response = await network(input, init)
      if (response.ok) {
        const data = await response.clone().json().catch(() => null)
        if (Array.isArray(data?.lockedSections)) {
          const scope = await scopeFor(token)
          await saveLockSettings(scope, token, data).catch(() => {})
        }
      }
      return response
    }
    const cached = method === 'GET' && (snapshots.has(input) || filePath.test(input))
    let body, write = false
    if (typeof init.body === 'string') {
      try { body = JSON.parse(init.body) } catch { return network(input, init) }
      write = (method === 'POST' && input === '/api/todos') || (method === 'PUT' &&
        (savePath.test(input) || (taskPath.test(input) && Object.keys(body || {}).length === 1 && ['todo', 'in-progress', 'completed'].includes(body?.status))))
    }
    if (!cached && !write) return network(input, init)
    const scope = await scopeFor(token)
    if (write && method === 'POST') {
      body = { ...body, offlineId: newId() }
      init = { ...init, body: JSON.stringify(body) }
    }
    try {
      if (write && (await keys(jobsKey(scope)).catch(() => [])).length) {
        const pending = await offlineJobs(token)
        if (pending.some(job => job.path === input || (input.startsWith('/api/todos/') && job.body.offlineId === taskPath.exec(input)?.[1]))) {
          return await fallback(scope, token, input, method, body)
        }
      }
      const response = await network(input, init)
      if (response.ok && write && savePath.test(input)) {
        const [, path] = savePath.exec(input)
        const file = await get(snapshotKey(scope, path)).catch(() => null)
        const saved = file && await response.clone().json().catch(() => null)
        if (saved?.updatedAt) await put(snapshotKey(scope, path), { ...updateFile(file, { path: input, body }), updatedAt: saved.updatedAt }).catch(() => {})
      }
      if (response.ok && cached) {
        const pinned = filePath.exec(input)?.[1]
        const jobs = await offlineJobs(token).catch(() => [])
        if (pinned && jobs.some(job => job.path.startsWith(input + '/'))) return await fallback(scope, token, input, method)
        if (!pinned || await get(`${scope}:pin:${pinned}`).catch(() => null)) {
          const data = await response.clone().json().catch(() => undefined)
          if (data !== undefined) {
            if (input === '/api/account/section-locks' && Array.isArray(data.lockedSections)) {
              await saveLockSettings(scope, token, data).catch(() => {})
            } else if (!pinned || !data.deletedAt && !await isLocked(scope, 'documents', data.pdfFolder, pinned).catch(() => true)) {
              await put(snapshotKey(scope, input), data).catch(() => {})
            }
            if (input === '/api/todos' && jobs.some(job => job.path.startsWith('/api/todos'))) {
              return json(jobs.filter(job => job.path.startsWith('/api/todos')).reduce(updateTask, data))
            }
          }
        }
      }
      if (!retryable(response)) return response
    } catch (error) {
      if (init.signal?.aborted) throw error
    }
    try { return await fallback(scope, token, input, method, body) }
    catch { return json({ message: 'Offline storage is unavailable or full. This change was not saved.' }, 503) }
  }
}

export async function clearOfflineWorkspace(token) {
  if (!token || !window.indexedDB || !crypto.subtle) return
  const scope = await scopeFor(token)
  await Promise.all((await keys(scope + ':')).map(drop))
}

export async function syncOfflineWorkspace(token) {
  if (!navigator.onLine) return
  const scope = await scopeFor(token)
  const sync = async () => {
    const jobs = await offlineJobs(token)
    if (!jobs.some(job => !job.error)) return
    const lockResponse = await network('/api/account/section-locks', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
    if (!lockResponse.ok || localStorage.getItem('token') !== token) return
    const settings = await lockResponse.json()
    if (!Array.isArray(settings.lockedSections)) return
    await saveLockSettings(scope, token, settings)
    const blocked = new Set()
    for (const job of jobs) {
      if (localStorage.getItem('token') !== token) return
      if (blocked.has(job.path)) continue
      if (job.error) { blocked.add(job.path); continue }
      const document = savePath.exec(job.path)
      if (document && !await get(snapshotKey(scope, document[1]))) {
        await put(job.key, { ...job, error: 'This file is locked or its offline copy is unavailable. Your draft is still available to download.' })
        blocked.add(job.path)
        continue
      }
      const response = await network(job.path, {
        method: job.method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(job.base && { 'X-Offline-Base': job.base }) },
        body: JSON.stringify(job.body)
      })
      if (retryable(response) || response.status === 429 || response.status === 401 || response.status === 428) break
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        await put(job.key, { ...job, error: data.message || 'The server could not apply this offline change.' })
        blocked.add(job.path)
        continue
      }
      const data = await response.json()
      if (document) {
        const key = snapshotKey(scope, document[1])
        const file = await get(key)
        if (localStorage.getItem('token') !== token) return
        if (file) await put(key, { ...updateFile(file, job), updatedAt: data.updatedAt || file.updatedAt })
        for (const next of await offlineJobs(token)) {
          if (next.key !== job.key && next.path === job.path && next.base === job.base && !next.error && data.updatedAt) {
            next.base = data.updatedAt
            const alreadyLoaded = jobs.find(item => item.key === next.key)
            if (next.createdAt >= job.createdAt) {
              if (alreadyLoaded) alreadyLoaded.base = next.base
              await put(next.key, next)
            }
          }
        }
      } else {
        if (localStorage.getItem('token') !== token) return
        const key = snapshotKey(scope, '/api/todos')
        const tasks = await get(key) || []
        await put(key, [...tasks.filter(task => task._id !== data._id), data])
      }
      await drop(job.key)
    }
    notify()
  }
  if (navigator.locks) await navigator.locks.request(`assignmenttracker-sync-${scope}`, { ifAvailable: true }, lock => lock && sync())
  else await sync()
}

export async function resolveOfflineChange(token, job, useDraft) {
  const scope = await scopeFor(token)
  if (!job.key.startsWith(jobsKey(scope))) return
  if (useDraft && job.base) {
    const document = savePath.exec(job.path)
    const response = await network(document[1], { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
    if (!response.ok) throw new Error('The current server version could not be loaded.')
    const file = await response.json()
    if (file.deletedAt || await isLocked(scope, 'documents', file.pdfFolder, file._id)) throw new Error('This document is locked or unavailable.')
    const pending = await offlineJobs(token)
    for (const change of pending.filter(item => item.path === job.path)) {
      await put(change.key, { ...change, base: file.updatedAt, error: undefined })
    }
    await put(snapshotKey(scope, document[1]), file)
  } else {
    await drop(job.key)
  }
  notify()
}

export async function reviewOfflineChange(token, job) {
  const document = savePath.exec(job.path)
  if (!document) return null
  const response = await network(document[1], { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!response.ok) throw new Error('Could not load the server version.')
  const file = await response.json()
  const scope = await scopeFor(token)
  if (file.deletedAt || await isLocked(scope, 'documents', file.pdfFolder, file._id)) throw new Error('This document is locked or unavailable.')
  if (document[2] === 'annotations') return {
    server: `${file.annotations?.length || 0} saved annotations`,
    draft: `${job.body.annotations?.length || 0} offline annotations`
  }
  const decode = value => new TextDecoder().decode(Uint8Array.from(atob(value), character => character.charCodeAt(0)))
  return { server: decode(file.pdfData), draft: decode(job.body.data) }
}
