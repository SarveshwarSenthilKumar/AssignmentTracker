import { useState } from 'react'
import { readApiJson } from '../lib/apiResponse'

export default function TaskStageSettings({ folder, token, labels, onSave }) {
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputStyle = 'rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white'
  const buttonStyle = 'rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20 disabled:opacity-50'
  const previous = folder.stages || []

  function editStage(id, changes) {
    setDraft(value => ({ ...value, stages: value.stages.map(stage => stage.id === id ? { ...stage, ...changes } : stage) }))
  }

  async function save(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/folders/' + folder._id + '/stages', {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stages: draft.stages, previousStages: draft.previous }),
      })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.message || 'Could not save task stages.')
      onSave(data)
      setDraft(null)
    } catch (failure) {
      setError(failure.message)
    } finally { setSaving(false) }
  }

  if (!draft) return <button type="button" className={buttonStyle} onClick={() => {
    setError('')
    setDraft({ stages: previous, previous })
  }}>Manage stages</button>

  return <form onSubmit={save} className="my-4 space-y-3 rounded-xl border border-white/10 bg-slate-900 p-4">
    <div>
      <h2 className="text-base font-semibold text-white">Stages for {folder.name}</h2>
      <p className="text-sm text-slate-400">Extra stages appear between {labels['in-progress']} and {labels.completed}. Removing a stage moves its tasks to {labels['in-progress']} or {labels.completed}, based on their completion.</p>
    </div>
    <fieldset disabled={saving} className="space-y-3">
      {draft.stages.map((stage, index) => <div className="flex flex-wrap items-end gap-3" key={stage.id}>
        <label className="grid gap-1 text-sm text-slate-300">Stage name
          <input className={inputStyle} required maxLength={48} value={stage.name} onChange={event => editStage(stage.id, { name: event.target.value })}/>
        </label>
        <label className="flex items-center gap-2 py-2 text-sm text-slate-300">
          <input type="checkbox" checked={stage.complete} onChange={event => editStage(stage.id, { complete: event.target.checked })}/> Counts as complete
        </label>
        <button type="button" className={buttonStyle} aria-label={'Remove stage ' + (stage.name || index + 1)} onClick={() =>
          setDraft(value => ({ ...value, stages: value.stages.filter(item => item.id !== stage.id) }))}>Remove</button>
      </div>)}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonStyle} disabled={draft.stages.length >= 12} onClick={() => {
          const bytes = crypto.getRandomValues(new Uint8Array(16))
          const id = 'stage-' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
          setDraft(value => ({ ...value, stages: [...value.stages, { id, name: '', complete: false }] }))
        }}>Add stage</button>
        <button type="submit" className={buttonStyle}>{saving ? 'Saving…' : 'Save stages'}</button>
        <button type="button" className={buttonStyle} onClick={() => setDraft(null)}>Cancel</button>
      </div>
    </fieldset>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  </form>
}
