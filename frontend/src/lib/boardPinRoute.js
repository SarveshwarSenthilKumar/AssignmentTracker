export function boardPinRoute(hash) {
  const match = /^#\/(detective-wall|documents)\/([a-f\d]{24})\/pin\/([a-z\d_-]{1,80})$/i.exec(hash)
  return match ? { page: match[1].toLowerCase(), boardId: match[2].toLowerCase(), noteId: match[3] } : null
}
