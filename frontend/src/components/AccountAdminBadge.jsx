import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'

export default function AccountAdminBadge({ token }) {
  const [administrator, setAdministrator] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setAdministrator(false)
    fetch('/api/account/admin-status', {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal
    }).then(response => response.ok ? response.json() : null).then(status => {
      if (!controller.signal.aborted) setAdministrator(status?.administrator === true)
    }).catch(() => {})
    return () => controller.abort()
  }, [token])

  if (!administrator) return null
  return <a href="#/admin" className="account-admin-badge" aria-label="Administrator. Open Admin portal">
    <ShieldCheck size={15} aria-hidden="true"/> Administrator
  </a>
}
