import { useEffect, useRef, useState } from 'react'
import { defaultWorkspace, importWorkspace } from '../lib/workspace'

const initialState = { library: null, status: 'loading', error: '', ready: false }
const fromLayout = layout => ({
  activeProfileId: 'default', profiles: [{ id: 'default', name: 'Default', pins: null, layout }],
})

function readLibrary(value) {
  if (!Array.isArray(value?.profiles)) return value?.layout ? fromLayout(importWorkspace(value.layout)) : null
  if (!value.profiles.some(profile => profile.id === value.activeProfileId)) throw new Error('The active workspace profile is missing.')
  return {
    activeProfileId: value.activeProfileId,
    profiles: value.profiles.map(({ id, name, pins, layout }) => ({
      id, name, pins: Array.isArray(pins) ? pins : null, layout: importWorkspace(layout),
    })),
  }
}

async function request(scope, options = {}) {
  const response = await fetch('/api/account/workspace-layout', {
    ...options, cache: 'no-store', headers: { Authorization: 'Bearer ' + scope.token, 'Content-Type': 'application/json' },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.message || 'Could not access workspace settings.')
    error.status = response.status
    throw error
  }
  return data
}

function local(scope, dirty) {
  if (!scope.active || !scope.library) return
  try { localStorage.setItem(scope.storageKey, JSON.stringify({ ...scope.library, revision: scope.revision, dirty })) } catch {}
}

function readLocal(scope) {
  try {
    const data = JSON.parse(localStorage.getItem(scope.storageKey) || 'null')
    const library = readLibrary(data)
    if (library && Number.isSafeInteger(data.revision) && data.revision >= 0) return { ...data, library }
  } catch {}
  return null
}

export default function useWorkspaceLayout({ token, userId }) {
  const [state, setState] = useState(initialState)
  const connection = useRef(null)
  const publish = (scope, changes) => {
    if (scope.active) setState(previous => ({ ...previous, ...changes, library: scope.library, scope }))
  }

  function save(scope) {
    clearTimeout(scope.timer)
    if (!scope.active || scope.blocked || scope.inFlight || scope.generation === scope.saved) return scope.inFlight
    const generation = scope.generation
    const body = JSON.stringify({ ...scope.library, revision: scope.revision })
    publish(scope, { status: 'saving' })
    scope.inFlight = (async () => {
      try {
        const data = await request(scope, { method: 'PUT', body })
        if (!scope.active) return
        scope.revision = data.revision
        scope.saved = generation
        const dirty = scope.generation !== generation
        local(scope, dirty)
        publish(scope, { status: dirty ? 'unsaved' : 'saved', error: '' })
      } catch (error) {
        if (!scope.active) return
        scope.blocked = error.status === 409
        publish(scope, { status: scope.blocked ? 'conflict' : 'error', error: error.message })
        local(scope, true)
      } finally {
        scope.inFlight = null
        if (scope.active && !scope.blocked && scope.generation !== generation) scope.timer = setTimeout(() => save(scope), 900)
      }
    })()
    return scope.inFlight
  }

  async function load(scope, discardLocal = false) {
    scope.controller?.abort()
    clearTimeout(scope.timer)
    const controller = new AbortController()
    scope.controller = controller
    scope.blocked = true
    publish(scope, { status: 'loading', error: '', ready: false })
    try {
      await scope.inFlight
      if (!scope.active || controller.signal.aborted) return
      const data = await request(scope, { signal: controller.signal })
      if (!scope.active || controller.signal.aborted) return
      const saved = readLibrary(data)
      const draft = !discardLocal ? readLocal(scope) : null
      const localDraft = draft?.dirty && (!saved || JSON.stringify(draft.library) !== JSON.stringify(saved)) ? draft : null
      scope.library = localDraft?.library || saved || fromLayout(defaultWorkspace())
      scope.revision = localDraft?.revision ?? data.revision
      scope.generation = 1
      scope.saved = localDraft || !saved ? 0 : 1
      scope.blocked = !!localDraft && localDraft.revision !== data.revision
      if (scope.blocked) {
        publish(scope, { status: 'conflict', ready: true, error: 'Your saved profiles changed elsewhere. Choose which version to keep.' })
      } else {
        const dirty = scope.generation !== scope.saved
        publish(scope, { status: dirty ? 'unsaved' : 'saved', ready: true, error: '' })
        local(scope, dirty)
        if (dirty) scope.timer = setTimeout(() => save(scope), 800)
      }
    } catch (error) {
      if (!scope.active || controller.signal.aborted) return
      const draft = readLocal(scope)
      scope.library = scope.library || draft?.library || fromLayout(defaultWorkspace())
      scope.revision = draft?.revision ?? scope.revision
      scope.blocked = true
      publish(scope, { status: 'error', ready: true, error: error.message + ' Changes will stay in a local draft until you reconnect.' })
    }
  }

  useEffect(() => {
    if (!token || !userId) return
    const start = () => {
      const scope = {
        userId, token, active: true, storageKey: 'workflow-layout:' + userId,
        generation: 0, saved: 0, revision: 0,
      }
      connection.current = scope
      load(scope)
    }
    const stop = (preserve = true) => {
      const scope = connection.current
      if (!scope) return
      if (preserve && scope.generation !== scope.saved) local(scope, true)
      scope.active = false
      clearTimeout(scope.timer)
      scope.controller?.abort()
      connection.current = null
    }
    const reset = event => {
      if (event.detail !== userId) return
      stop(false)
      try { localStorage.removeItem('workflow-layout:' + userId) } catch {}
      start()
    }
    start()
    window.addEventListener('workspace-reset', reset)
    return () => { window.removeEventListener('workspace-reset', reset); stop() }
  }, [token, userId])

  const scope = connection.current
  const visible = scope && state.scope === scope && scope.userId === userId && scope.token === token ? state : initialState
  const active = visible.library?.profiles.find(profile => profile.id === visible.library.activeProfileId)
  function changeProfiles(updater) {
    if (!scope?.active || !visible.ready) return
    const next = updater(scope.library)
    if (!next || next === scope.library) return
    scope.library = next
    scope.generation++
    local(scope, true)
    publish(scope, scope.blocked ? {} : { status: 'unsaved' })
    clearTimeout(scope.timer)
    scope.timer = setTimeout(() => save(scope), 900)
  }

  function change(updater) {
    changeProfiles(library => {
      const profile = library.profiles.find(item => item.id === library.activeProfileId)
      if (profile.id !== active?.id) return library
      const next = typeof updater === 'function' ? updater(profile.layout) : updater
      if (!next || next === profile.layout) return library
      return { ...library, profiles: library.profiles.map(item => item.id === profile.id ? { ...item, layout: next } : item) }
    })
  }

  async function keepLocal() {
    if (!scope?.active || scope.inFlight || !visible.ready) return
    const loadController = scope.controller
    try {
      const data = await request(scope)
      if (!scope.active || scope.controller !== loadController) return
      scope.revision = data.revision
      scope.blocked = false
      scope.generation++
      await save(scope)
    } catch (error) { publish(scope, { status: 'error', error: error.message }) }
  }

  return { ...visible, active, layout: active?.layout, change, changeProfiles,
    reload: () => scope && load(scope, true), keepLocal }
}
