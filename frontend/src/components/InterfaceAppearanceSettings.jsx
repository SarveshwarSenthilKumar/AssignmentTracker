import { useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { readApiJson } from '../lib/apiResponse'
import { appearanceAttributes, appearanceOptions, defaultAppearance, normalizeAppearance } from '../lib/appearance'

const fields = [
  ['textSize', 'Interface text size', 'Adjusts interface text without changing document content.'],
  ['density', 'Spacing', 'Change the padding around navigation, lists, and dashboard cards.'],
  ['corners', 'Corner shape', 'Change the shape of panels and controls that use the platform theme.'],
  ['contrast', 'Contrast', 'Make text and borders easier to distinguish.'],
  ['motion', 'Motion', 'Follow your device or reduce interface animations.'],
]
const colors = [['Slate blue', '#526c83'], ['Blue', '#2563eb'], ['Teal', '#0f766e'], ['Violet', '#7c3aed'], ['Rose', '#be185d'], ['Amber', '#b45309']]
const optionLabel = value => value === 'system' ? 'Match device' : value.replaceAll('-', ' ').replace(/^./, letter => letter.toUpperCase())
const sameAppearance = (a, b) => Object.keys(defaultAppearance).every(key => a[key] === b[key])

export default function InterfaceAppearanceSettings() {
  const { user, token, updatePreferences } = useAuth()
  const saved = normalizeAppearance(user?.appearance)
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const lock = useRef(false)
  const value = draft ?? saved
  const changed = !sameAppearance(saved, value)

  const change = (key, next) => {
    setDraft({ ...value, [key]: next })
    setNotice('')
    setError('')
  }

  async function save(appearance) {
    if (lock.current) return
    lock.current = true
    setBusy(true); setNotice(''); setError('')
    try {
      const response = await fetch('/api/account/preferences', {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ appearance }),
      })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.message || 'Could not save appearance.')
      if (data.appearance === undefined || !sameAppearance(normalizeAppearance(data.appearance), appearance ?? defaultAppearance)) {
        throw new Error('Restart the updated backend before saving interface appearance.')
      }
      updatePreferences({ appearance: data.appearance })
      setDraft(null)
      setNotice(appearance ? 'Interface appearance saved.' : 'Interface defaults restored.')
    } catch (failure) { setError(failure.message) }
    finally { lock.current = false; setBusy(false) }
  }

  const previewStyle = value.accent === 'default' ? {
    '--accent': 'var(--app-default-accent)',
    '--accent-solid': 'var(--app-default-accent-solid)',
  } : { '--app-custom-accent': value.accent }

  return <section className="confirmation-settings interface-appearance-settings" aria-label="Interface appearance" aria-busy={busy}>
    <h3>Interface appearance</h3>
    <p>Preview your changes here and save them to your account.</p>
    <div className="appearance-customizer">
      <div className="appearance-options">
        <fieldset disabled={busy}>
          <legend>Accent color</legend>
          <div className="appearance-swatches">
            <button type="button" aria-pressed={value.accent === 'default'} onClick={() => change('accent', 'default')}>Theme default</button>
            {colors.map(([name, color]) => <button key={color} type="button" className="appearance-swatch" aria-label={name}
              title={name} aria-pressed={value.accent === color} style={{ '--swatch': color }} onClick={() => change('accent', color)} />)}
          </div>
          <label><span>Custom color</span><input type="color" value={value.accent === 'default' ? '#526c83' : value.accent}
            onChange={event => change('accent', event.target.value)} /></label>
        </fieldset>
        {fields.map(([key, label, description]) => <label key={key}>
          <span><strong>{label}</strong><small>{description}</small></span>
          <select value={value[key]} disabled={busy} onChange={event => change(key, event.target.value)}>
            {appearanceOptions[key].map(option => <option key={option} value={option}>{optionLabel(option)}</option>)}
          </select>
        </label>)}
      </div>
      <div className="appearance-preview" {...appearanceAttributes(value)} style={previewStyle} aria-label="Appearance preview">
        <span className="appearance-preview-label">Preview</span>
        <h4>Today’s workspace</h4>
        <p>Review your upcoming tasks and events.</p>
        <div className="appearance-preview-row"><span className="appearance-preview-dot" /> Organize lecture notes</div>
        <div className="appearance-preview-row"><span className="appearance-preview-dot" /> Check this week’s schedule</div>
        <span className="appearance-preview-action">Open workspace</span>
      </div>
    </div>
    <div className="appearance-settings-actions">
      <button type="button" disabled={busy || !changed} onClick={() => save(value)}>{busy ? 'Saving…' : 'Save appearance'}</button>
      {changed && <button type="button" disabled={busy} onClick={() => { setDraft(null); setError('') }}>Cancel changes</button>}
      <button type="button" disabled={busy || (!changed && sameAppearance(saved, defaultAppearance))} onClick={() => save(null)}>Restore interface defaults</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
  </section>
}
