export function documentTaskIds(file) {
  const id = value => String(value?._id || value || '')
  return [...new Set([file.todo, ...(file.taskIds || [])].map(id).filter(Boolean))]
}

export function descriptionParts(text = '') {
  const pattern = /\[\[document:([a-f\d]{24})\]\]/gi
  const parts = []; let cursor = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) parts.push({ text: text.slice(cursor, match.index) })
    parts.push({ documentId: match[1] }); cursor = match.index + match[0].length
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) })
  return parts
}
