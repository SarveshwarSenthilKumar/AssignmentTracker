import { useEffect, useState } from 'react'
import { readApiJson } from '../lib/apiResponse'

const endpoint = '/api/admin/account-approvals'

export default function AccountApprovals({ token }) {
  const [accounts, setAccounts] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setError('')
    setAccounts(null)
    fetch(endpoint, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await readApiJson(response)
        if (!response.ok || !Array.isArray(data.accounts)) throw new Error(data.message || 'Could not load pending accounts.')
        if (!controller.signal.aborted) setAccounts(data.accounts)
      })
      .catch(error => { if (!controller.signal.aborted) setError(error.message) })
    return () => controller.abort()
  }, [token, revision])

  async function approve(account) {
    if (busy) return
    setBusy(account._id)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`${endpoint}/${account._id}/approve`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) throw new Error((await readApiJson(response)).message || 'Could not approve this account.')
      setAccounts(previous => previous.filter(item => item._id !== account._id))
      setNotice(`${account.username} can now sign in.`)
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(null)
    }
  }

  return <section id="admin-approvals" aria-labelledby="admin-approvals-title">
    <h3 id="admin-approvals-title">Pending accounts</h3>
    <div className="admin-actions"><button type="button" disabled={!!busy} onClick={() => setRevision(value => value + 1)}>Refresh list</button></div>
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert" className="admin-feedback">{error}</p>}
    {!accounts && !error && <p role="status">Loading pending accounts…</p>}
    {accounts?.length === 0 && <p>No accounts are awaiting approval.</p>}
    {accounts?.length > 0 && <ul className="grid gap-2">{accounts.map(account =>
      <li key={account._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 p-3 break-words">
        <span className="min-w-0">{account.username} · {account.email}</span>
        <div className="admin-actions"><button type="button" disabled={!!busy} onClick={() => approve(account)}>{busy === account._id ? 'Approving…' : 'Approve'}</button></div>
      </li>)}</ul>}
  </section>
}
