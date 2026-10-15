import { useRef, useState } from 'react'
import { RotateCcw, Loader2 } from 'lucide-react'

export default function AccountReset({ token, onReset, disabled = false }) {
  const [open, setOpen] = useState(false), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState(false)
  const lock = useRef(false)
  const cancel = () => { setOpen(false); setPassword(''); setConfirmation(''); setError('') }
  const submit = async event => {
    event.preventDefault()
    if (lock.current || disabled || confirmation !== 'RESET' || !password) return
    lock.current = true; setBusy(true); setError('')
    try {
      const response = await fetch('/api/user/reset', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ password, confirmation }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Could not reset the account. Please try again.')
      onReset(); cancel(); setDone(true)
    } catch (error) { setError(error.message); setPassword('') }
    finally { lock.current = false; setBusy(false) }
  }
  return <section className="mt-6 rounded-xl border border-slate-600 bg-slate-800/40 p-4" aria-label="Clean account reset">
    <h4 className="text-base font-semibold text-slate-100 flex gap-2 items-center"><RotateCcw size={17}/>Clean account reset</h4>
    <p className="text-sm text-slate-300 mt-2 leading-relaxed">Start with an empty workspace. Permanently removes all tasks, descriptions, links, uploaded files, document edits, original backups, Trash, both sets of folders, personal calendar appointments and date markers, and all saved AI conversations (including archived chats). Also disconnects Canvas and clears its sync history and local document drafts.</p>
    <p className="text-xs text-slate-400 mt-2">Your username, email, password, and login remain. This cannot be undone.</p>
    {done && <p role="status" className="mt-3 text-sm text-slate-200">Reset complete. Your workspace is empty and Canvas is disconnected.</p>}
    {!open ? <button type="button" disabled={disabled} onClick={() => { setDone(false); setOpen(true) }} className="mt-4 px-3 py-2 rounded-lg border border-slate-500 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50">Reset account data…</button> : <form onSubmit={submit} className="mt-4 space-y-3" aria-busy={busy}>
      <p className="text-sm text-amber-200/80">Confirm permanent deletion of all workspace data for this account.</p>
      <label className="block text-sm text-slate-300">Current password<input type="password" autoComplete="current-password" required value={password} disabled={busy} onChange={event => setPassword(event.target.value)} className="block w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-slate-400"/></label>
      <label className="block text-sm text-slate-300">Type RESET to confirm<input value={confirmation} autoComplete="off" spellCheck={false} disabled={busy} onChange={event => setConfirmation(event.target.value)} className="block w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-slate-400"/></label>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={cancel} className="px-3 py-2 rounded-lg border border-slate-600 text-sm text-slate-200">Cancel</button><button type="submit" disabled={busy || disabled || confirmation !== 'RESET' || !password} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-400/30 bg-red-900/20 text-sm text-red-200 disabled:opacity-40">{busy && <Loader2 size={14}/>} {busy ? 'Resetting…' : 'Permanently reset all data'}</button></div>
    </form>}
    {disabled && <p className="text-xs text-slate-400 mt-2">Finish the current import or close the document editor before resetting.</p>}
  </section>
}
