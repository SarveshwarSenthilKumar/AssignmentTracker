import { useEffect, useState } from 'react'
import { readApiJson } from '../lib/apiResponse'

export default function AdminAccountAccess({ token, user }) {
  const [accounts, setAccounts] = useState(null)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setAccounts(null)
    setError('')
    fetch(`/api/admin/accounts?search=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal
    }).then(async response => {
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.message || 'Could not load accounts.')
      if (!controller.signal.aborted) setAccounts(data.accounts)
    }).catch(error => { if (!controller.signal.aborted) setError(error.message) })
    return () => controller.abort()
  }, [token, query, revision])

  async function change(account) {
    if (busy || !window.confirm(`${account.deactivatedAt ? 'Reactivate' : 'Deactivate'} ${account.username} (${account.email})?`)) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/accounts/${account._id}/access`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !!account.deactivatedAt })
      })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.message || 'Could not update account access.')
      setAccounts(previous => previous.map(item => item._id === data._id ? data : item))
    } catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }

  return <section className="mt-6" aria-label="Account access management">
    <h3>Account access</h3>
    <form className="admin-actions" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); setRevision(value => value + 1) }}>
      <input aria-label="Search accounts" placeholder="Username or email" maxLength={120} value={search} onChange={event => setSearch(event.target.value)}/>
      <button type="submit" disabled={busy}>Search / refresh</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {!accounts && !error && <p role="status">Loading accounts…</p>}
    {accounts?.length === 0 && <p>No matching accounts.</p>}
    <ul className="grid gap-2">{accounts?.map(account => <li key={account._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 p-3">
      <div className="min-w-0 break-words"><strong>{account.username}</strong><p>{account.email}</p><small>{account.deactivatedAt ? 'Deactivated' : account.approvalPending ? 'Awaiting approval' : 'Active'}</small></div>
      <div className="admin-actions"><button type="button" disabled={busy || account._id === user?.id} onClick={() => change(account)}>{account.deactivatedAt ? 'Reactivate' : 'Deactivate'}</button></div>
    </li>)}</ul>
    {accounts?.length === 100 && <p>Showing up to 100 accounts. Search to narrow the list.</p>}
  </section>
}
