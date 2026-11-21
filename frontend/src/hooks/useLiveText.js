import { useEffect, useRef, useState } from 'react'
import { mergeText } from '../lib/liveText'
import {sharedDocumentRequest} from '../lib/sharedDocumentRequest'

export default function useLiveText({ url, token, enabled = true, value, onChange, onSaved }) {
  const latest = useRef({ value, onChange, onSaved })
  latest.current = { value, onChange, onSaved }
  const syncRef = useRef(null)
  const [status, setStatus] = useState('Connecting live editor…')
  const [ready, setReady] = useState(false)
  const [conflict, setConflict] = useState(null)
  const [accessDenied,setAccessDenied]=useState(null)
  const state = useRef(null)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const session = { saved: latest.current.value, revision: null, busy: false, conflict: false }
    state.current = session
    setReady(false)
    setAccessDenied(null)
    setConflict(null)
    let timer
    const sync = async () => {
      if (session.busy || controller.signal.aborted) return false
      session.busy = true
      const draft = latest.current.value
      const writing = session.revision && draft !== session.saved && !session.conflict
      try {
        const response = await sharedDocumentRequest(url, { method: writing ? 'PUT' : 'GET', cache: 'no-store', signal: controller.signal,
          headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(writing && { 'Content-Type': 'application/json' }) },
          ...(writing && { body: JSON.stringify({ text: draft, baseText: session.saved, baseRevision: session.revision }) }) })
        const data = await response.json()
        if (!response.ok) {
          if (response.status === 409) { session.conflict = true; setStatus('Checking overlapping edits…'); return false }
          if ([401, 403, 404, 410].includes(response.status)) {setReady(false);setAccessDenied(data.message||'This document is no longer available to your account.');controller.abort();return false}
          throw new Error(data.message || 'Could not synchronize this document.')
        }
        if (controller.signal.aborted) return false
        const merged = mergeText(writing ? draft : session.saved, latest.current.value, data.text)
        if (merged === null) {
          session.conflict = true
          setConflict(data)
          setStatus('Two editors changed the same text. Choose which version to keep.')
          return false
        }
        session.conflict = false
        setConflict(null)
        session.saved = data.text
        session.revision = data.revision
        if (merged !== latest.current.value) {
          latest.current.value = merged
          latest.current.onChange(merged)
        }
        if (merged === data.text) latest.current.onSaved?.()
        setReady(true)
        setStatus(merged === data.text ? 'Live · changes synchronized' : 'Live · saving changes…')
        return merged === data.text
      } catch (error) {
        if (!controller.signal.aborted) setStatus(`${error.message} Reconnecting…`)
        return false
      } finally { session.busy = false }
    }
    syncRef.current = sync
    const tick = async () => { await sync(); if (!controller.signal.aborted) timer = setTimeout(tick, 500) }
    tick()
    return () => { controller.abort(); clearTimeout(timer); syncRef.current = null }
  }, [url, token, enabled])
  const resolve = useLocal => {
    if (!conflict || !state.current) return
    const session = state.current
    session.saved = conflict.text
    session.revision = conflict.revision
    session.conflict = false
    if (!useLocal) { latest.current.value = conflict.text; latest.current.onChange(conflict.text); latest.current.onSaved?.() }
    setConflict(null)
  }
  return { ready, status, conflict, accessDenied, resolve, sync: () => syncRef.current?.() }
}
