export const extensionOf = name => (name || '').split('.').pop().toLowerCase()
const TEXT_EXTENSIONS = new Set('txt md markdown json jsonc yaml yml xml html htm css scss js jsx ts tsx py java c cpp h cs go rs rb php sh sql log ini toml env tex r svelte vue ps1 bat ipynb dockerfile gitignore'.split(' '))
const IMAGE_EXTENSIONS = new Set('png jpg jpeg webp gif bmp svg avif ico'.split(' '))
export function fileKind(name, mime = '') {
  const ext = extensionOf(name)
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf'
  if (IMAGE_EXTENSIONS.has(ext) || mime.startsWith('image/')) return 'image'
  if (ext === 'docx') return 'word'
  if (ext === 'xlsx') return 'workbook'
  if (ext === 'csv' || ext === 'tsv') return 'table'
  if (TEXT_EXTENSIONS.has(ext) || mime.startsWith('text/')) return 'text'
  if (mime.startsWith('audio/') || ['mp3','wav','ogg','m4a','flac'].includes(ext)) return 'audio'
  if (mime.startsWith('video/') || ['mp4','webm','mov'].includes(ext)) return 'video'
  return 'file'
}
export function parseDelimited(text, separator = ',') {
  const rows = []; let row = [], value = '', quoted = false
  text = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"' && (quoted || value === '')) {
      if (quoted && text[i + 1] === '"') { value += '"'; i++ } else quoted = !quoted
    } else if (ch === separator && !quoted) { row.push(value); value = '' }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(value); rows.push(row); row = []; value = ''
    } else value += ch
  }
  if (quoted) throw new Error('This file has an unclosed quoted cell.')
  if (value || row.length || !rows.length) { row.push(value); rows.push(row) }
  return rows
}
export function serializeDelimited(rows, separator = ',') {
  return rows.map(row => row.map(value => {
    const text = String(value ?? '')
    return /["\r\n]/.test(text) || text.includes(separator) ? `"${text.replace(/"/g, '""')}"` : text
  }).join(separator)).join('\r\n')
}
export const fileBytes = base64 => Uint8Array.from(atob(base64), ch => ch.charCodeAt(0))
export const blobBase64 = blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = () => reject(new Error('Could not read file content.')); reader.readAsDataURL(blob) })
export {saveDownload as downloadBlob} from './download'
