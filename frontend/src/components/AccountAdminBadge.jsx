import { ShieldCheck } from 'lucide-react'
import { SHORTCUTS } from '../lib/shortcuts'

const commandShortcut = SHORTCUTS.find(shortcut => shortcut.id === 'commands')?.keys
const tools = [
  ['#/admin/approvals', 'Account approvals', 'Review pending registrations and approve access.'],
  ['#/admin/stats', 'Advanced statistics', 'View aggregate platform activity and storage statistics.'],
  ['#/admin/bugs', 'Bug reports', 'Review reports, update their status, and respond to users.'],
  ['#/admin/features', 'Feature suggestions', 'Review suggestions, respond, and publish public-safe summaries.'],
  ['#/admin/contacts', 'Developer messages', 'Review messages submitted through policy support.'],
  ['#/roadmap', 'Site roadmap', 'Publish, edit, feature, or remove public roadmap entries.']
]

export default function AccountAdminBadge() {
  return <div className="account-admin-access"><a href="#/admin" className="account-admin-badge" aria-label="Administrator. Open Admin portal">
    <ShieldCheck size={15} aria-hidden="true"/> Administrator
  </a>
    <details className="account-admin-perks">
      <summary>View perks</summary>
      <ul>{tools.map(([route, title, description]) => <li key={route}>
        <a href={route}>{title}</a><p>{description}</p>
      </li>)}</ul>
      <h3>Commands and keybinds</h3>
      <p>Open the Command Menu with <kbd>{commandShortcut}</kbd>, then enter:</p>
      <ul>
        <li><code>open admin</code> opens the Admin portal.</li>
        <li><code>admin stats</code>, <code>admin statistics</code>, or <code>admin-stats</code> opens Advanced statistics.</li>
      </ul>
      <a href="#/shortcuts">View all keyboard shortcuts</a>
    </details>
  </div>
}
