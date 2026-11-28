import { useState } from 'react'
import { ArrowUpRight, BookOpen, X } from 'lucide-react'
import AssistantMarkdown from './AssistantMarkdown'
import { sameWorkspaceNote, studySourceHref, workspaceNotes } from '../lib/studySources'

export const studyPdfs = documents => documents.filter(file => !file.deletedAt && file.documentKind !== 'whiteboard' &&
  (file.mimeType === 'application/pdf' || /\.pdf$/i.test(file.originalName || '')))

function label(source, documents, notes) {
  if (source.kind === 'pdf') return (documents.find(file => file._id === source.documentId)?.name || 'PDF') + ' · Page ' + source.page
  const note = notes.find(item => sameWorkspaceNote(item, source))
  return (source.section || 'Whole note') + (note ? ' · ' + note.label : '')
}

export function StudySourceLinks({ sources = [], documents, notes }) {
  if (!sources.length) return null
  return <section className="study-source-links" aria-label="Original material">
    <h4><BookOpen size={16}/>Original material</h4>
    <ul>{sources.map(source => {
      const href = studySourceHref(source)
      return <li key={href}><a href={href} target="_blank" rel="noopener noreferrer">{label(source, documents, notes)}<ArrowUpRight size={14}/></a></li>
    })}</ul>
  </section>
}

export function StudySourcePicker({ sources = [], documents, notes, onChange, disabled }) {
  const [kind, setKind] = useState('pdf')
  const [documentId, setDocumentId] = useState('')
  const [page, setPage] = useState('1')
  const [noteKey, setNoteKey] = useState('')
  const [sectionIndex, setSectionIndex] = useState('0')
  const noteKeyFor = note => [note.profileId, note.tabId, note.windowId, note.paneId].join('/')
  const note = notes.find(item => noteKeyFor(item) === noteKey)
  const section = note?.sections[Number(sectionIndex)]
  const pageNumber = Number(page)
  const next = kind === 'pdf'
    ? documents.some(file => file._id === documentId) && Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= 10000
      ? { kind, documentId, page: pageNumber } : null
    : note && section ? { kind, profileId: note.profileId, tabId: note.tabId, windowId: note.windowId, paneId: note.paneId,
      section: section.section, occurrence: section.occurrence } : null
  const duplicate = next && sources.some(source => studySourceHref(source) === studySourceHref(next))

  return <fieldset className="study-answer-fields study-source-picker" disabled={disabled}>
    <legend>Original material</legend>
    {!!sources.length && <ul>{sources.map((source, index) => <li key={studySourceHref(source)}>
      <span>{label(source, documents, notes)}</span><button type="button" onClick={() => onChange(sources.filter((_, i) => i !== index))}
        aria-label={'Remove source ' + (index + 1)}><X size={14}/>Remove</button>
    </li>)}</ul>}
    {sources.length < 5 && <>
      <label>Source type<select value={kind} onChange={event => setKind(event.target.value)}>
        <option value="pdf">PDF page</option><option value="note">Workspace note section</option>
      </select></label>
      {kind === 'pdf' ? <>
        <label>PDF<select value={documentId} onChange={event => setDocumentId(event.target.value)}>
          <option value="">Choose a PDF</option>{documents.map(file => <option key={file._id} value={file._id}>{file.name}</option>)}
        </select></label>
        {documents.length ? <label>Page number<input type="number" min={1} max={10000} value={page} onChange={event => setPage(event.target.value)}/></label>
          : <p>Add a PDF to Documents to link one here.</p>}
      </> : <>
        <label>Workspace note<select value={noteKey} onChange={event => { setNoteKey(event.target.value); setSectionIndex('0') }}>
          <option value="">Choose a note</option>{notes.map(item => <option key={noteKeyFor(item)} value={noteKeyFor(item)}>{item.label}</option>)}
        </select></label>
        {note ? <label>Section<select value={sectionIndex} onChange={event => setSectionIndex(event.target.value)}>
          {note.sections.map((item, index) => item.section.length <= 500 && <option key={index} value={index}>
            {item.section ? item.section + (item.occurrence ? ' (' + (item.occurrence + 1) + ')' : '') : 'Whole note'}
          </option>)}
        </select></label> : !notes.length && <p>Write a note in a Workspace Notes window to link it here.</p>}
      </>}
      <button type="button" disabled={!next || duplicate} onClick={() => onChange([...sources, next])}>Add source</button>
    </>}
    <p>Source links appear after the answer is revealed.</p>
  </fieldset>
}

export function StudyNoteSource({ target, library, ready }) {
  if (!ready) return <p role="status">Opening the workspace note…</p>
  const note = workspaceNotes(library).find(item => sameWorkspaceNote(item, target))
  const section = note?.sections.find(item => item.section === target.section && item.occurrence === target.occurrence)
  return <article className="study-card">
    <p>{note?.label || 'Workspace notes'}</p>
    {section ? <AssistantMarkdown content={section.text}/> : <p role="status">This note or section is no longer available.</p>}
    <a href="#/workspace">Open workspace</a>
  </article>
}
