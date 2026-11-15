import { useEffect, useRef, useState } from 'react'

export default function SharedTextEditor({ url, token, name, onClose }) {
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState('Connecting…')
  const [conflict, setConflict] = useState(null)
  const [ready, setReady] = useState(false)
  const current = useRef({ draft: '', saved: '', revision: null, conflict: false })

  useEffect(() => {
    const controller = new AbortController()
    const state = current.current
    let timer

    async function sync() {
      try {
        const draft = state.draft
        const writing = state.revision && draft !== state.saved && !state.conflict
        const response = await fetch(url, {
          method: writing ? 'PUT' : 'GET', cache: 'no-store', signal: controller.signal,
          headers: { Authorization: `Bearer ${token}`, ...(writing && { 'Content-Type': 'application/json' }) },
          ...(writing && { body: JSON.stringify({ text: draft, baseRevision: state.revision }) })
        })
        const data = await response.json()
        if (controller.signal.aborted) return
        if (response.status === 409) {
          state.conflict = true
          setStatus('Changes overlap. Your draft is still here.')
          return
        }
        if (!response.ok) {
          if ([401, 403, 404].includes(response.status)) setReady(false)
          throw new Error(data.message || 'Live editing could not synchronize.')
        }
        setReady(true)
        if (state.conflict || (!writing && state.draft !== state.saved && state.revision !== data.revision)) {
          state.conflict = true
          setConflict(data)
          setStatus('Another editor saved changes. Review the shared version before continuing.')
          return
        }
        if (!writing && state.draft === state.saved && state.draft !== data.text) {
          state.draft = data.text
          setDraft(data.text)
        }
        state.saved = data.text
        state.revision = data.revision
        setStatus(state.draft === state.saved ? 'All changes saved' : 'Waiting to save…')
      } catch (error) {
        if (!controller.signal.aborted) setStatus(error.message)
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(sync, 1000)
      }
    }
    sync()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [url, token])

  return <section className="library-live-editor" aria-label={`Live editing ${name}`}>
    <h4>{name}</h4>
    <p role="status">{status}</p>
    <textarea aria-label="Document text" rows={12} value={draft} readOnly={!ready} onChange={event => {
      current.current.draft = event.target.value
      setDraft(event.target.value)
    }}/>
    {conflict && <details open><summary>Latest shared text</summary>
      <textarea aria-label="Latest shared text" rows={8} readOnly value={conflict.text}/>
      <button type="button" onClick={() => {
        Object.assign(current.current, { draft: conflict.text, saved: conflict.text, revision: conflict.revision, conflict: false })
        setDraft(conflict.text)
        setConflict(null)
      }}>Use shared version</button>
      <button type="button" onClick={() => {
        Object.assign(current.current, { saved: conflict.text, revision: conflict.revision, conflict: false })
        setConflict(null)
      }}>Save my draft over shared version</button>
    </details>}
    <button type="button" disabled={ready && current.current.draft !== current.current.saved} onClick={onClose}>Close editor</button>
  </section>
}
