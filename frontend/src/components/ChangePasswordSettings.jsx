import { useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { readApiJson } from '../lib/apiResponse'

export default function ChangePasswordSettings({ token }) {
  const [fields, setFields] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const lock = useRef(false)
  const mismatch = fields.confirmPassword && fields.confirmPassword !== fields.newPassword

  async function save(event) {
    event.preventDefault()
    if (lock.current) return
    setError('')
    setNotice('')
    if (mismatch) { setError('The new passwords do not match.'); return }
    if (new TextEncoder().encode(fields.newPassword).length > 72) {
      setError('Your new password exceeds 72 UTF-8 bytes. Choose a shorter password.')
      return
    }
    lock.current = true
    setBusy(true)
    try {
      const response = await fetch('/api/account/password', {
        method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: fields.currentPassword, newPassword: fields.newPassword })
      })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.message || 'Could not change your password.')
      setFields({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setVisible(false)
      setNotice(data.message)
    } catch (error) { setError(error.message) }
    finally { lock.current = false; setBusy(false) }
  }

  return <section className="confirmation-settings account-password">
    <h3>Change password</h3>
    <p>Enter your current password and choose a new password with at least 8 characters.</p>
    <form onSubmit={save}>
      {[['currentPassword', 'Current password'], ['newPassword', 'New password'], ['confirmPassword', 'Confirm new password']].map(([key, label]) =>
        <label key={key}><span>{label}</span><input type={visible ? 'text' : 'password'} name={key} autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'}
          required minLength={key === 'currentPassword' ? undefined : 8} maxLength={key === 'currentPassword' ? 1024 : 72}
          disabled={busy} value={fields[key]} aria-invalid={key === 'confirmPassword' ? !!mismatch : undefined}
          onChange={event => { setFields(previous => ({ ...previous, [key]: event.target.value })); setError(''); setNotice('') }}/></label>)}
      {mismatch && <p role="status">The new passwords do not match.</p>}
      <div className="calendar-detail-actions">
        <button type="button" aria-pressed={visible} disabled={busy} onClick={() => setVisible(previous => !previous)}>
          {visible ? <EyeOff size={16}/> : <Eye size={16}/>} {visible ? 'Hide passwords' : 'Show passwords'}
        </button>
        <button type="submit" disabled={busy || !!mismatch}>{busy ? 'Changing password…' : 'Change password'}</button>
      </div>
    </form>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
  </section>
}
