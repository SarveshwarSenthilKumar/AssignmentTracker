import { readApiJson } from './apiResponse'

export async function createDocument({ token, folderId, name, content, mime, extension, tags }) {
  const stem = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\.(txt|md|pdf)$/i, '').trim() || 'Notes'
  const body = new FormData()
  body.append('pdfFile', new File([content], `${stem}.${extension}`, { type: mime }))
  body.append('name', name)
  body.append('tags', JSON.stringify(tags))
  if (folderId) body.append('pdfFolderId', folderId)

  const response = await fetch('/api/pdfs', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body })
  const file = await readApiJson(response)
  if (!response.ok) throw new Error(file.message || 'Could not create the file.')
  if (!file._id) throw new Error('The server did not return the new document. Refresh the library before retrying.')
  return file
}
