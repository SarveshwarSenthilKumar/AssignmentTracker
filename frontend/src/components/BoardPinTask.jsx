import { useEffect, useRef, useState } from 'react'
import { readApiJson } from '../lib/apiResponse'

export default function BoardPinTask({ token, kind, boardId, note, beforeSave, onCreated, onClose }) {
  const [title, setTitle] = useState(() => note.text?.trim().split(/\r?\n/)[0].slice(0, 1000) || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const dialog = useRef(null)
  const input = useRef(null)
  const pending = useRef(false)
  const taskId = useRef(null)

  useEffect(() => {
    const element = dialog.current
    element.showModal()
    input.current?.focus()
    return () => element.close()
  }, [])

  async function create(event) {
    event.preventDefault()
    if (pending.current || !title.trim()) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      if (!await beforeSave()) throw new Error('Save the board before creating this task.')
      if (!taskId.current) taskId.current = Array.from(crypto.getRandomValues(new Uint8Array(12)), byte => byte.toString(16).padStart(2, '0')).join('')
      const response = await fetch('/api/todos/from-board-pin', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, boardId, noteId: note.id, title, taskId: taskId.current }),
      })
      const task = await readApiJson(response)
      if (!response.ok) throw new Error(task.message || 'Could not create the task.')
      onCreated(task)
      onClose()
    } catch (failure) { setError(failure.message) }
    finally { pending.current = false; setBusy(false) }
  }

  return <dialog ref={dialog} aria-label="Create task from sticky note"
    className="m-auto w-[min(420px,calc(100vw-24px))] rounded-xl border border-slate-700 bg-slate-900 p-5 text-white backdrop:bg-black/60"
    onCancel={event => { event.preventDefault(); if (!pending.current) onClose() }}
    onKeyDown={event => event.stopPropagation()}>
    <form onSubmit={create} className="grid gap-4">
      <h2 className="text-lg font-semibold">Create task from sticky note</h2>
      <p className="text-sm text-slate-300">The task will include a link back to this note.</p>
      <label className="grid gap-1 text-sm">Task title
        <input ref={input} required maxLength={1000} disabled={busy} value={title} onChange={event => setTitle(event.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2" placeholder="What needs to be done?"/>
      </label>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" disabled={busy} onClick={onClose} className="rounded-lg px-3 py-2">Cancel</button>
        <button type="submit" disabled={busy || !title.trim()} className="rounded-lg bg-sky-700 px-3 py-2 disabled:opacity-50">{busy ? 'Creating…' : 'Create task'}</button>
      </div>
    </form>
  </dialog>
}
