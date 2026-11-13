import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { readApiJson } from '../lib/apiResponse'

const months = new Intl.DateTimeFormat(undefined, { month: 'long', timeZone: 'UTC' })
const padded = value => String(value).padStart(2, '0')

export default function BirthdaySettings() {
  const { user, token, updatePreferences } = useAuth()
  const saved = user?.birthday || ''
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const [savedMonth = '', savedDay = ''] = saved.split('-')
    setMonth(savedMonth)
    setDay(savedDay)
  }, [saved])

  const dayCount = month ? new Date(Date.UTC(2000, Number(month), 0)).getUTCDate() : 31

  async function save(birthday) {
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/account/preferences', {
        method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthday })
      })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.message || 'Could not save your birthday.')
      if (data.birthday !== birthday) throw new Error('Restart the updated backend before saving your birthday.')
      updatePreferences({ birthday })
      if (!birthday) { setMonth(''); setDay('') }
      setNotice(birthday ? 'Birthday added to your calendar.' : 'Birthday removed from your calendar.')
    } catch (failure) {
      setError(failure.message)
    } finally {
      setBusy(false)
    }
  }

  return <section className="confirmation-settings account-birthday" aria-label="Birthday" aria-busy={busy}>
    <h3>Birthday</h3>
    <p>Save your month and day to mark your birthday on your calendar each year.</p>
    <form onSubmit={event => { event.preventDefault(); if (month && day) save(`${month}-${day}`) }}>
      <label><span>Month</span><select required value={month} disabled={busy} onChange={event => {
        const next = event.target.value
        setMonth(next)
        if (Number(day) > new Date(Date.UTC(2000, Number(next), 0)).getUTCDate()) setDay('')
      }}><option value="">Choose month</option>{Array.from({ length: 12 }, (_, index) => <option key={index} value={padded(index + 1)}>{months.format(new Date(Date.UTC(2000, index, 1)))}</option>)}</select></label>
      <label><span>Day</span><select required value={day} disabled={busy} onChange={event => setDay(event.target.value)}><option value="">Choose day</option>{Array.from({ length: dayCount }, (_, index) => <option key={index} value={padded(index + 1)}>{index + 1}</option>)}</select></label>
      <div className="calendar-detail-actions">
        <button type="submit" disabled={busy || !month || !day || saved === `${month}-${day}`}>{busy ? 'Saving…' : 'Save birthday'}</button>
        {saved && <button type="button" disabled={busy} onClick={() => save('')}>Remove birthday</button>}
      </div>
    </form>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
  </section>
}
