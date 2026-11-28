import { useEffect, useRef, useState } from 'react'
import { readApiJson } from '../lib/apiResponse'
import { emptyBookmarkLibrary, mergeBookmarkLibraries } from '../lib/bookmarkLibrary'

async function request(token, options = {}) {
  const response = await fetch('/api/account/bookmarks', {
    ...options, cache: 'no-store',
    headers: { Authorization: 'Bearer ' + token, ...(options.body && { 'Content-Type': 'application/json' }) },
  })
  const data = await readApiJson(response)
  if (!response.ok) throw Object.assign(new Error(data.message || 'Could not sync bookmarks.'), { status: response.status })
  if (!Number.isSafeInteger(data.revision) || !Array.isArray(data.library?.bookmarks) || !Array.isArray(data.library?.folders)) {
    throw new Error('Bookmark sync is unavailable. Restart the updated backend and try again.')
  }
  return data
}

async function put(token, library, revision, signal) {
  return request(token, { method: 'PUT', signal, body: JSON.stringify({ library, revision }) })
}

export default function useAccountBookmarks(token, legacyKey, readLegacy) {
  const [library, setLibrary] = useState(() => readLegacy(legacyKey))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [version, setVersion] = useState(0)
  const revision = useRef(null)
  const latestLibrary = useRef(library)
  const lock = useRef(false)

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    const { signal } = controller
    const load = async () => {
      setLoading(true); setSyncError(''); revision.current = null
      try {
        const legacy = readLegacy(legacyKey)
        let data
        for (let attempt = 0; attempt < 3; attempt++) {
          data = await request(token, { signal })
          if (!legacy.bookmarks.length && !legacy.folders.length) break
          const migrated = mergeBookmarkLibraries(data.library, legacy).library
          if (migrated.bookmarks.length === data.library.bookmarks.length && migrated.folders.length === data.library.folders.length) break
          try { data = await put(token, migrated, data.revision, signal); break }
          catch (error) { if (error.status !== 409 || attempt === 2) throw error }
        }
        if (signal.aborted) return
        if (legacy.bookmarks.length || legacy.folders.length) {
          try { localStorage.removeItem(legacyKey) } catch {}
        }
        revision.current = data.revision
        latestLibrary.current = data.library
        setLibrary(data.library)
      } catch (failure) {
        if (!signal.aborted) setSyncError(failure.message)
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [token, legacyKey, readLegacy, version])

  async function saveLibrary(next, expectedLibrary) {
    if (lock.current) return false
    if (revision.current === null) throw new Error('Reload account bookmarks before saving.')
    if (latestLibrary.current !== expectedLibrary) throw new Error('Bookmarks changed while this action was open. Try again with the latest list.')
    lock.current = true
    setSaving(true)
    try {
      const data = await put(token, next, revision.current)
      revision.current = data.revision
      latestLibrary.current = data.library ?? emptyBookmarkLibrary
      setLibrary(latestLibrary.current)
      return true
    } catch (failure) {
      if (failure.status === 409) {
        revision.current = null
        setSyncError(failure.message)
      }
      throw failure
    } finally {
      lock.current = false
      setSaving(false)
    }
  }

  return { library, loading, saving, syncError, saveLibrary, reload: () => {
    if (!lock.current) setVersion(value => value + 1)
  } }
}
