export function noteSections(note = '') {
  const lines = note.split(/\r?\n/)
  const headings = []
  const occurrences = new Map()
  let fence = null
  lines.forEach((text, line) => {
    const marker = /^ {0,3}(\x60{3,}|~{3,})/.exec(text)?.[1]
    if (marker) {
      if (!fence) fence = marker
      else if (marker[0] === fence[0] && marker.length >= fence.length && text.trim() === marker) fence = null
      return
    }
    if (fence) return
    const heading = /^ {0,3}(#{1,6})[ \t]+(.+?)\s*$/.exec(text)
    if (!heading) return
    const section = heading[2].replace(/\s+#+$/, '').trim()
    if (!section) return
    const occurrence = occurrences.get(section) || 0
    occurrences.set(section, occurrence + 1)
    headings.push({ section, occurrence, line, level: heading[1].length })
  })
  return [
    { section: '', occurrence: 0, text: note },
    ...headings.map((heading, index) => {
      const next = headings.slice(index + 1).find(item => item.level <= heading.level)
      return { section: heading.section, occurrence: heading.occurrence, text: lines.slice(heading.line, next?.line).join('\n') }
    }),
  ]
}

export function workspaceNotes(library) {
  return (library?.profiles || []).flatMap(profile =>
    profile.layout.tabs.flatMap(tab =>
      tab.windows.flatMap((win, index) => win.panes.filter(pane => pane.type === 'notes' && pane.note.trim()).map(pane => ({
        profileId: profile.id, tabId: tab.id, windowId: win.id, paneId: pane.id,
        label: [profile.name, tab.title, 'Window ' + (index + 1)].join(' · '), sections: noteSections(pane.note),
      }))
    )
  )
}

export function studyPdfPageRoute(hash) {
  const parts = /^#\/documents\/([a-f\d]{24})\/page\/(\d{1,5})$/i.exec(hash)
  const page = Number(parts?.[2])
  return page >= 1 && page <= 10000 ? { documentId: parts[1].toLowerCase(), page } : null
}

export function studyNoteRoute(hash) {
  const [path, query] = hash.split('?')
  const parts = /^#\/workspace\/source-note\/([\w-]{1,80})\/([\w-]{1,80})\/([\w-]{1,80})\/([\w-]{1,80})$/.exec(path)
  if (!parts) return null
  const params = new URLSearchParams(query)
  const [, profileId, tabId, windowId, paneId] = parts
  return { profileId, tabId, windowId, paneId, section: params.get('section') || '', occurrence: Number(params.get('occurrence') || 0) }
}

export const sameWorkspaceNote = (a, b) => a.profileId === b.profileId && a.tabId === b.tabId && a.windowId === b.windowId && a.paneId === b.paneId

export function studySourceHref(source) {
  if (source.kind === 'pdf') return '#/documents/' + source.documentId + '/page/' + source.page
  const path = '#/workspace/source-note/' + [source.profileId, source.tabId, source.windowId, source.paneId].join('/')
  return source.section ? path + '?' + new URLSearchParams({ section: source.section, occurrence: source.occurrence }) : path
}
