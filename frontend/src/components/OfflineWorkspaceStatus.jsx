import { useEffect, useState } from 'react'
import { downloadBlob } from '../lib/documentFormats'
import { offlineJobs, resolveOfflineChange, reviewOfflineChange, syncOfflineWorkspace } from '../lib/offlineWorkspace'

export default function OfflineWorkspaceStatus({ token }) {
  const [online, setOnline] = useState(navigator.onLine)
  const [jobs, setJobs] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [review, setReview] = useState(null)

  useEffect(() => {
    let active = true
    const refresh = () => {
      setOnline(navigator.onLine)
      offlineJobs(token).then(value => { if (active) setJobs(value) }).catch(() => {})
    }
    const sync = () => {
      refresh()
      if (navigator.onLine) syncOfflineWorkspace(token).catch(() => {})
    }
    window.addEventListener('online', sync)
    window.addEventListener('offline', refresh)
    window.addEventListener('offline-workspace-change', refresh)
    const timer = setInterval(sync, 5000)
    sync()
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', refresh)
      window.removeEventListener('offline-workspace-change', refresh)
    }
  }, [token])

  const resolve = async (job, useDraft) => {
    if (busy) return
    const message = useDraft ? 'Replace the current server version with your offline draft?' : 'Discard this offline change?'
    if (!window.confirm(message)) return
    setBusy(true)
    setError('')
    try {
      await resolveOfflineChange(token, job, useDraft)
      if (navigator.onLine) await syncOfflineWorkspace(token)
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }

  if (online && !jobs.length && !error) return null
  return <aside className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface-panel)] p-3 text-sm" aria-label="Offline workspace">
    <p role="status">{online ? 'Online' : 'Offline'}{jobs.length > 0 && ` · ${jobs.length} changes awaiting sync`}</p>
    {jobs.filter(job => job.error).map(job => <details key={job.key} className="mt-2">
      <summary>{job.name || (job.base ? 'Document changes' : 'Task change')} needs review</summary>
      <p>{job.error}</p>
      <div className="mt-2 flex flex-wrap gap-3">
        {job.base && <button type="button" className="underline" disabled={!online} onClick={() => {
          setError('')
          reviewOfflineChange(token, job).then(versions => setReview({ key: job.key, ...versions })).catch(reason => setError(reason.message))
        }}>Compare versions</button>}
        <button type="button" className="underline" onClick={() => downloadBlob(
          new Blob([JSON.stringify(job.body, null, 2)], { type: 'application/json' }), 'offline-draft.json'
        ).catch(reason => setError(reason.message))}>Download draft</button>
        {job.base && <button type="button" className="underline" disabled={busy || !online} onClick={() => resolve(job, true)}>Use my draft</button>}
        <button type="button" className="underline" disabled={busy} onClick={() => resolve(job, false)}>Discard draft</button>
      </div>
      {review?.key === job.key && <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1">Server version<textarea className="rounded border border-[var(--border)] bg-[var(--surface-input)] p-2" rows={5} readOnly value={review.server}/></label>
        <label className="grid gap-1">Offline draft<textarea className="rounded border border-[var(--border)] bg-[var(--surface-input)] p-2" rows={5} readOnly value={review.draft}/></label>
      </div>}
    </details>)}
    {error && <p role="alert">{error}</p>}
  </aside>
}
