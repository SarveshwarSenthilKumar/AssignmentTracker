import {
  File, FileArchive, FileAudio, FileCode, FileImage, FileSpreadsheet,
  FileText, FileType, FileVideo, PencilRuler, Presentation
} from 'lucide-react'
import { extensionOf, fileKind } from '../lib/documentFormats'

const icons = {
  pdf: FileType,
  word: FileText,
  workbook: FileSpreadsheet,
  table: FileSpreadsheet,
  image: FileImage,
  audio: FileAudio,
  video: FileVideo,
  text: FileText,
}
const codeExtensions = new Set('json jsonc yaml yml xml html htm css scss js jsx ts tsx py java c cpp h cs go rs rb php sh sql tex r svelte vue ps1 bat ipynb toml'.split(' '))
const presentationExtensions = new Set(['ppt', 'pptx', 'odp', 'key'])
const archiveExtensions = new Set(['zip', 'rar', '7z', 'tar', 'gz'])

export default function DocumentFileIcon({ file, size = 16 }) {
  const name = file?.originalName || file?.name || ''
  const mime = file?.mimeType?.split(';')[0].trim().toLowerCase() || ''
  const extension = extensionOf(name)
  const kind = fileKind(name, mime)
  let Icon = icons[kind] || File
  if (file?.tags?.includes('handwritten-notebook')) Icon = PencilRuler
  else if (presentationExtensions.has(extension) || /presentation|powerpoint/.test(mime)) Icon = Presentation
  else if (archiveExtensions.has(extension) || /\b(zip|gzip|x-rar|x-7z-compressed)\b/.test(mime)) Icon = FileArchive
  else if (codeExtensions.has(extension)) Icon = FileCode
  else if (extension === 'doc' || /wordprocessingml|msword/.test(mime)) Icon = FileText
  else if (extension === 'xls' || /spreadsheetml|ms-excel|text\/csv/.test(mime)) Icon = FileSpreadsheet
  return <Icon size={size} aria-hidden="true"/>
}
