export function bookmarkUrl(input) {
  const value = input.trim()
  if (/^#\/[a-z0-9][^\s]*$/i.test(value)) return value
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error()
  if (url.origin === window.location.origin && url.pathname === window.location.pathname && /^#\/[a-z0-9]/i.test(url.hash)) return url.hash
  return url.href
}


export const emptyBookmarkLibrary = { bookmarks: [], folders: [] }
export const maxBookmarkImportBytes = 8 * 1024 * 1024

export function mergeBookmarkLibraries(base, incoming) {
  const folders = [...base.folders]
  const bookmarks = [...base.bookmarks]
  const names = new Map(folders.map(folder => [folder.name.toLowerCase(), folder.id]))
  const folderIds = new Map()
  const urls = new Set(bookmarks.map(item => item.url))
  let skipped = 0

  for (const folder of incoming.folders) {
    if (typeof folder?.id !== 'string' || typeof folder.name !== 'string') continue
    const name = folder.name.trim().slice(0, 100)
    if (!name) continue
    const key = name.toLowerCase()
    let id = names.get(key)
    if (!id) {
      id = crypto.randomUUID()
      folders.push({ id, name })
      names.set(key, id)
    }
    folderIds.set(folder.id, id)
  }

  for (const item of incoming.bookmarks) {
    try {
      const url = bookmarkUrl(item.url)
      if (url.length > 2048 || urls.has(url)) { skipped++; continue }
      const title = (typeof item.title === 'string' && item.title.trim() || url).slice(0, 100)
      bookmarks.push({ id: crypto.randomUUID(), title, url, folderId: folderIds.get(item.folderId) || '' })
      urls.add(url)
    } catch { skipped++ }
  }

  return { library: { bookmarks, folders }, added: bookmarks.length - base.bookmarks.length, skipped }
}

function parseBookmarkHTML(source) {
  const template = document.createElement('template')
  template.innerHTML = source
  const bookmarks = []
  const folders = []
  function walk(parent, folder = null, depth = 0) {
    if (depth > 60) throw new Error('This bookmark file has too many nested levels.')
    let pending = folder
    for (const item of parent.children) {
      if (item.tagName === 'H3') {
        const name = item.textContent.trim()
        if (name) {
          pending = { id: String(folders.length + 1), name: folder ? folder.name + ' / ' + name : name }
          folders.push(pending)
        }
      } else if (item.tagName === 'DL') {
        walk(item, pending, depth + 1)
        pending = folder
      } else if (item.tagName === 'A') {
        bookmarks.push({ title: item.textContent, url: item.getAttribute('href'), folderId: folder?.id || '' })
        pending = folder
      } else if (item.tagName === 'DT' || item.tagName === 'P') {
        pending = walk(item, item.tagName === 'P' ? pending : folder, depth + 1) || pending
      }
    }
    return pending
  }
  if (!template.content.querySelector('dl')) throw new Error('Choose a browser bookmarks HTML export.')
  walk(template.content)
  return { bookmarks, folders }
}

export function parseBookmarkImport(fileName, source) {
  if (/\.html?$/i.test(fileName)) return parseBookmarkHTML(source)
  let value
  try { value = JSON.parse(source.replace(/^\uFEFF/, '')) }
  catch { throw new Error('Choose an Assignment Tracker JSON export or a browser bookmarks HTML export.') }
  if (Array.isArray(value)) return { bookmarks: value, folders: [] }
  if (!Array.isArray(value?.bookmarks) || !Array.isArray(value.folders) || (value.version !== undefined && value.version !== 1)) {
    throw new Error('This bookmark export format is not supported.')
  }
  return value
}

const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

export function bookmarkHTML(library, baseUrl) {
  const link = item => '<DT><A HREF="' + escapeHtml(new URL(item.url, baseUrl).href) + '">' + escapeHtml(item.title) + '</A>'
  return [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
    ...library.bookmarks.filter(item => !item.folderId).map(link),
    ...library.folders.flatMap(folder => [
      '<DT><H3>' + escapeHtml(folder.name) + '</H3>',
      '<DL><p>',
      ...library.bookmarks.filter(item => item.folderId === folder.id).map(link),
      '</DL><p>',
    ]),
    '</DL><p>',
  ].join('\n')
}
