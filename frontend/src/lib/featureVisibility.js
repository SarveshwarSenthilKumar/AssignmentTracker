export const visibilityGroups = [
  ['Planning', [['home', 'Home'], ['workspace', 'Workspace'], ['tasks', 'Tasks'], ['calendar', 'Calendar'], ['visualization', 'Task visualization'], ['canvas', 'Canvas integration']]],
  ['Files and study', [['documents', 'Documents and editors'], ['detective-wall', 'Detective wall'], ['whiteboards', 'Team whiteboards'], ['bookmarks', 'Bookmarks'], ['study', 'Question bank'], ['assistant', 'AI assistant']]],
  ['Career', [['prep', 'Career prep'], ['interview-coach', 'Interview coach'], ['interview-practice', 'Interview practice'], ['cold-emails', 'Cold emails'], ['resumes', 'Resumes'], ['cover-letters', 'Cover letters'], ['jobs', 'Saved jobs']]],
  ['Help and reference', [['tutorial', 'Tutorial'], ['shortcuts', 'Keyboard shortcuts page'], ['analytics', 'Analytics'], ['roadmap', 'Site roadmap'], ['report-bug', 'Bug reports'], ['suggest-feature', 'Feature suggestions'], ['handbook', 'Product handbook'], ['logbook', 'Update logbook'], ['admin', 'Admin portal']]],
  ['Controls and companions', [['global-search', 'Global search'], ['commands', 'Command menu'], ['page-find', 'Find on page'], ['home-metrics', 'Home dashboard metrics'], ['home-quick-actions', 'Home quick actions'], ['bookmark-suggestions', 'Bookmark suggestions'], ['calendar-sharing', 'Calendar event sharing'], ['calendar-reminders', 'Calendar reminders'], ['pdf-quick-actions', 'PDF quick actions'], ['workspace-notes', 'Workspace notes tool'], ['workspace-focus', 'Workspace focus timer']]],
]

const aliases = { 'calendar-tab': 'calendar', 'shared-calendar-event': 'calendar', graph: 'visualization', notes: 'workspace-notes', focus: 'workspace-focus' }

export function featureVisible(hidden, route) {
  const name = route.split('/')[0]
  return !hidden?.includes(aliases[name] || name) && (name !== 'whiteboards' || !hidden?.includes('documents'))
}

export const searchFeatures = {
  study: 'study', shortcuts: 'shortcuts', tasks: 'tasks', taskFolders: 'tasks', documents: 'documents',
  documentFolders: 'documents', events: 'calendar', categories: 'calendar', campus: 'calendar', jobs: 'jobs', chats: 'assistant',
}

export function shortcutVisible(hidden, item) {
  const scopes = { Assistant: 'assistant', Calendar: 'calendar', Workspace: 'workspace', Visualization: 'visualization', Tasks: 'tasks', Documents: 'documents', Canvas: 'canvas' }
  const ids = { 'global-search': 'global-search', commands: 'commands', help: 'shortcuts', 'pdf-quick-actions': 'pdf-quick-actions' }
  const feature = ids[item.id] || (item.id.startsWith('nav-') ? item.id.slice(4) : scopes[item.scope])
  return !feature || featureVisible(hidden, feature)
}
