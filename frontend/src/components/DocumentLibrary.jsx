import {FolderDescriptionInput} from './FolderDescription'
import {NOTE_TEMPLATES} from '../lib/noteTemplates'
import './NoteStudio.css'
import { documentTaskIds } from '../lib/taskAttachments'
import useShortcuts from '../hooks/useShortcuts'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Folder, FolderPlus, Upload, Search, Trash2, Edit2, ArrowRight, RotateCcw, X, Download, Loader2, Files, Check, RefreshCw } from 'lucide-react'
import { downloadBlob } from '../lib/documentFormats'
import { readApiJson } from '../lib/apiResponse'
import AIDocumentCreator from './AIDocumentCreator'
import MarkdownPDFCreator from './MarkdownPDFCreator'
import OneNoteImport from './OneNoteImport'
import { PDFDocument } from 'pdf-lib'
import './DocumentLibrary.css'
import {folderTree} from '../lib/folderHierarchy'
import FolderHierarchyControls from './FolderHierarchyControls'
import FolderParentSelect from './FolderParentSelect'

export default function DocumentLibrary({ tasks = [], onOpenTask, documents, folders, token, onOpen, onUpload, onDocumentsChange, onFoldersChange, selectedFolder, onSelectFolder, keyboardEnabled = true,navigationTarget,onNavigationHandled }) {
  const [search, setSearch] = useState(''), [sort, setSort] = useState('updated')
  const [notebookPages,setNotebookPages]=useState(5),[notebookSize,setNotebookSize]=useState('letter')
  const [aiCreator,setAiCreator]=useState(null)
  const [noteTemplate,setNoteTemplate]=useState('blank')
  const [markdownCreator,setMarkdownCreator]=useState(null)
  const [oneNoteCreator,setOneNoteCreator]=useState(null)
  const [selected, setSelected] = useState(new Set()), [modal, setModal] = useState(null), [value, setValue] = useState(''), [destination, setDestination] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(null), [dropTarget, setDropTarget] = useState(null)
  const busyRef = useRef(false), dialogRef = useRef(null), previousFocus = useRef(null)
  useEffect(()=>{
    if(!navigationTarget)return
    setSearch('');setSelected(new Set(navigationTarget.fileId?[navigationTarget.fileId]:[]))
    const frame=requestAnimationFrame(()=>{if(navigationTarget.fileId){const row=document.querySelector(`[data-library-file-id="${navigationTarget.fileId}"]`);row?.scrollIntoView({block:'center'});row?.focus({preventScroll:true})}onNavigationHandled?.()})
    return()=>cancelAnimationFrame(frame)
  },[navigationTarget])
  const active = documents.filter(file => !file.deletedAt), trashed = documents.filter(file => file.deletedAt)
  const inTrash = selectedFolder === 'trash'
  const folderName = selectedFolder === 'all' ? 'All documents' : inTrash ? 'Trash' : selectedFolder === null ? 'Unfiled' : folderTree(folders).find(folder => folder._id === selectedFolder)?.path || 'Folder'
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return documents.filter(file => {
      const location = selectedFolder === 'trash' ? !!file.deletedAt : !file.deletedAt && (selectedFolder === 'all' || (selectedFolder === null ? !file.pdfFolder : file.pdfFolder === selectedFolder))
      return location && (!query || [file.name, file.originalName, ...(file.tags || [])].some(value => value?.toLowerCase().includes(query)))
    }).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'type' ? (a.originalName?.split('.').pop() || '').localeCompare(b.originalName?.split('.').pop() || '') || a.name.localeCompare(b.name) : new Date(sort === 'created' ? b.createdAt : b.updatedAt || b.createdAt) - new Date(sort === 'created' ? a.createdAt : a.updatedAt || a.createdAt))
  }, [documents, selectedFolder, search, sort])
  useEffect(() => { setSelected(new Set()) }, [selectedFolder, search])
  useEffect(() => {
    if (!modal) return
    setError('')
    previousFocus.current = document.activeElement
    dialogRef.current?.querySelector('input, select, button')?.focus()
    return () => previousFocus.current?.focus?.()
  }, [modal])
  const request = async (url, method, body) => {
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.message || 'The operation could not be completed.')
    return result
  }
  const run = async callback => {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true); setError('')
    try { await callback() } catch (err) { setError(err.message) }
    finally { busyRef.current = false; setBusy(false) }
  }
  const refresh = () => run(async () => {
    const [files, locations] = await Promise.all([request('/api/pdfs?includeTrash=1', 'GET'), request('/api/pdf-folders', 'GET')])
    onDocumentsChange(files); onFoldersChange(locations); setSelected(new Set())
    if (selectedFolder && !['all','trash'].includes(selectedFolder) && !locations.some(folder => folder._id === selectedFolder)) onSelectFolder('all')
    setNotice({ text: 'Library refreshed.' })
  })
  const action = async (type, ids, folderId = null) => {
    const result = await request('/api/documents/actions', 'POST', { action: type, ids, folderId })
    const set = new Set(result.ids)
    onDocumentsChange(prev => prev.map(file => !set.has(file._id) ? file : { ...file, ...(type === 'move' ? { pdfFolder: folderId } : { deletedAt: result.deletedAt }), updatedAt: new Date().toISOString() }))
    setSelected(new Set()); setModal(null)
    setNotice({ text: `${result.ids.length} ${result.ids.length === 1 ? 'document' : 'documents'} ${type === 'trash' ? 'moved to Trash' : type === 'restore' ? 'restored' : `moved to ${folders.find(folder => folder._id === folderId)?.name || 'Unfiled'}`}.`, undo: type === 'trash' ? result.ids : null })
  }
  const openMove = ids => { setDestination(selectedFolder && !['all','trash'].includes(selectedFolder) ? selectedFolder : ''); setModal({ type: 'move', ids }) }
  const toggle = id => setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  const submit = () => run(async () => {
    if (modal.type === 'move') { await action('move', modal.ids, destination || null); return }
    if (modal.type === 'delete-folder') {
      const result=await request(`/api/pdf-folders/${modal.folder._id}`, 'DELETE'),parentId=result.parentId||null
      onFoldersChange(prev => prev.filter(folder => folder._id !== modal.folder._id).map(folder=>folder.parentId===modal.folder._id?{...folder,parentId}:folder))
      onDocumentsChange(prev => prev.map(file => file.pdfFolder === modal.folder._id ? { ...file, pdfFolder: parentId } : file))
      if (selectedFolder === modal.folder._id) onSelectFolder(parentId)
      setNotice({ text: 'Folder removed. Its documents and subfolders were kept and moved up one level.' }); setModal(null); return
    }
    const name = value.trim()
    if (!name) throw new Error('Enter a name.')
    if(modal.type==='new-notes'||modal.type==='new-notebook'){
      const notebook=modal.type==='new-notebook'
      let content=(NOTE_TEMPLATES.find(template=>template.id===noteTemplate)||NOTE_TEMPLATES[0]).content(name),mime='text/plain',extension='md'
      if(notebook){
        const count=Number(notebookPages)
        if(!Number.isInteger(count)||count<1||count>500)throw new Error('Choose a whole number of pages between 1 and 500.')
        const pdf=await PDFDocument.create()
        for(let index=0;index<count;index++)pdf.addPage(notebookSize==='a4'?[595.28,841.89]:[612,792])
        pdf.setTitle(name);pdf.setCreator('Assignment Tracker')
        content=await pdf.save();mime='application/pdf';extension='pdf'
      }
      const filename=(name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').replace(/\.(txt|md|pdf)$/i,'').trim()||'Notes')+'.'+extension
      const body=new FormData()
      body.append('pdfFile',new File([content],filename,{type:mime}))
      body.append('name',name);body.append('tags',JSON.stringify(notebook?['notes','handwritten-notebook']:['notes']))
      if(selectedFolder&&!['all','trash'].includes(selectedFolder))body.append('pdfFolderId',selectedFolder)
      const response=await fetch('/api/pdfs',{method:'POST',headers:{Authorization:`Bearer ${token}`},body})
      const file=await readApiJson(response)
      if(!response.ok)throw new Error(file.message||'Could not create your notes.')
      if(!file._id)throw new Error('The server did not return the new document. Refresh the library before retrying.')
      onDocumentsChange(previous=>[file,...previous]);setSearch('');setSelected(new Set());setModal(null);setNotice({text:notebook?'Blank notebook created.':'Notes created.'});onOpen(file._id);return
    }
    if (modal.type === 'new-folder') {
      const folder = await request('/api/pdf-folders', 'POST', { name, description:modal.description||'', color: '#6d879e',parentId:modal.parentId===undefined?(selectedFolder&&!['all','trash'].includes(selectedFolder)?selectedFolder:null):modal.parentId })
      onFoldersChange(prev => [...prev, folder]); onSelectFolder(folder._id)
    } else if (modal.type === 'rename-folder') {
      await request(`/api/pdf-folders/${modal.folder._id}`, 'PUT', { name })
      onFoldersChange(prev => prev.map(folder => folder._id === modal.folder._id ? { ...folder, name } : folder))
    } else {
      await request(`/api/pdfs/${modal.file._id}`, 'PUT', { name })
      onDocumentsChange(prev => prev.map(file => file._id === modal.file._id ? { ...file, name, updatedAt: new Date().toISOString() } : file))
    }
    setNotice({ text: modal.type === 'new-folder' ? 'Folder created.' : 'Name updated.' }); setModal(null)
  })
  const drop = (e, folderId) => {
    e.preventDefault(); setDropTarget(null)
    try {
      const ids = JSON.parse(e.dataTransfer.getData('application/x-assignment-documents'))
      if (!Array.isArray(ids) || !ids.length || ids.some(id => !active.some(file => file._id === id))) return
      run(() => action('move', ids, folderId))
    } catch { /* Ignore drops that did not originate in this library. */ }
  }
  const folderDrop = id => ({ onDragOver: e => { if (e.dataTransfer.types.includes('application/x-assignment-documents')) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget(id) } }, onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropTarget(null) }, onDrop: e => drop(e, id) })
  const download = file => run(async () => {
    const response = await fetch(`/api/pdfs/${file._id}/download`, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) throw new Error('Could not download the document.')
    await downloadBlob(await response.blob(), file.originalName)
  })
  useShortcuts('Documents', {
    upload: () => { if (!inTrash) onUpload() },
    folder: () => { setValue(''); setModal({type:'new-folder'}) },
    'select-all': () => setSelected(new Set(visible.map(file=>file._id))),
    move: () => { if (selected.size && !inTrash) openMove([...selected]) },
    trash: () => { if (selected.size && !inTrash) run(()=>action('trash',[...selected])) },
    restore: () => { if (selected.size && inTrash) run(()=>action('restore',[...selected])) },
    rename: () => { if (selected.size===1 && !inTrash) { const file=documents.find(file=>selected.has(file._id)); if(file){setValue(file.name);setModal({type:'rename',file})} } },
    'download-file': () => {if(selected.size===1){const file=documents.find(file=>selected.has(file._id));if(file)download(file)}},
    refresh,
  }, keyboardEnabled && !busy && !modal && !aiCreator && !markdownCreator && !oneNoteCreator)
  const modalTitle = modal?.type === 'move' ? `Move ${modal.ids.length === 1 ? 'document' : `${modal.ids.length} documents`}` : modal?.type === 'new-folder' ? 'New folder' : modal?.type === 'delete-folder' ? 'Remove folder' : 'Rename'
  return <section className="document-library" aria-label="Document library" aria-busy={busy}>
    <FolderHierarchyControls folders={folders} selected={selectedFolder} token={token} base="/api/pdf-folders" documents={documents} onDocumentsChange={onDocumentsChange} onOpenDocument={onOpen} onFoldersChange={onFoldersChange} onSelect={onSelectFolder} onCreate={parentId=>{setValue('');setModal({type:'new-folder',parentId})}} disabled={busy}/>
    {oneNoteCreator&&<OneNoteImport token={token} folderId={oneNoteCreator.folderId} onClose={()=>setOneNoteCreator(null)} onCreated={file=>{onDocumentsChange(previous=>[file,...previous]);setOneNoteCreator(null);setSearch('');setNotice({text:'OneNote notebook imported as notes.'});onOpen(file._id)}}/>}
    {markdownCreator&&<MarkdownPDFCreator token={token} folderId={markdownCreator.folderId} onClose={()=>setMarkdownCreator(null)} onCreated={file=>{onDocumentsChange(previous=>[file,...previous]);setMarkdownCreator(null);setSearch('');setNotice({text:'Markdown converted and saved as a PDF.'});onOpen(file._id)}}/>}
    {aiCreator&&<AIDocumentCreator token={token} folderId={aiCreator.folderId} onClose={()=>setAiCreator(null)} onCreated={file=>{onDocumentsChange(previous=>[file,...previous]);setAiCreator(null);setSearch('');setNotice({text:file.generationNotice||'AI document created. Open its editable text blocks to revise the content.'});onOpen(file._id)}}/>}
    <div className="library-header"><div><h2>Documents</h2><p>Organize, edit, and manage your files</p></div><div className="library-header-actions"><button disabled={busy} aria-label="Refresh document library" title="Refresh library" onClick={refresh}><RefreshCw size={16}/></button><button disabled={busy} onClick={()=>{setValue('');setModal({type:'new-folder'})}}><FolderPlus size={16}/>New folder</button><button disabled={busy || inTrash || !!markdownCreator || !!aiCreator || !!oneNoteCreator} onClick={()=>setOneNoteCreator({folderId:selectedFolder&&!['all','trash'].includes(selectedFolder)?selectedFolder:null})}><Upload size={16}/>Import OneNote</button><button disabled={busy || inTrash || !!markdownCreator || !!aiCreator || !!oneNoteCreator} onClick={()=>setMarkdownCreator({folderId:selectedFolder&&!['all','trash'].includes(selectedFolder)?selectedFolder:null})}><FileText size={16}/>Markdown to PDF</button><button disabled={busy || inTrash || !!aiCreator || !!markdownCreator || !!oneNoteCreator} onClick={()=>setAiCreator({folderId:selectedFolder&&!['all','trash'].includes(selectedFolder)?selectedFolder:null})}><FileText size={16}/>Create with AI</button><button disabled={busy||inTrash||!!aiCreator||!!markdownCreator} onClick={()=>{setValue('Untitled notebook');setNotebookPages(5);setNotebookSize('letter');setModal({type:'new-notebook'})}}><Files size={16}/>Blank notebook</button><button className="library-primary" disabled={busy || inTrash} onClick={()=>{setValue('Untitled notes');setNoteTemplate('blank');setModal({type:'new-notes'})}}><FileText size={16}/>New notes</button><button disabled={busy || inTrash} onClick={onUpload}><Upload size={16}/>Upload</button></div></div>
    {modal&&<div className="library-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setModal(null)}}><form ref={dialogRef} role="region" aria-labelledby="library-modal-title" onSubmit={e=>{e.preventDefault();submit()}} onKeyDown={e=>{if(e.key==='Escape'&&!busy){setModal(null);return}}}><div className="library-modal-heading"><h3 id="library-modal-title">{modal.type==='new-notebook'?'Blank notebook':modal.type==='new-notes'?'Create notes':modalTitle}</h3><button type="button" aria-label="Close document dialog" disabled={busy} onClick={()=>setModal(null)}><X size={18}/></button></div>{modal.type==='move'?<><label htmlFor="library-destination">Destination folder</label><select id="library-destination" value={destination} disabled={busy} onChange={e=>setDestination(e.target.value)}><option value="">Unfiled</option>{folderTree(folders).map(folder=><option key={folder._id} value={folder._id}>{folder.path}</option>)}</select><p>Files keep their contents, annotations, and tags.</p></>:modal.type==='delete-folder'?<p>Remove “{modal.folder.name}”? Its documents and subfolders are kept and moved up one level (or to Unfiled / top level).</p>:<><label htmlFor="library-name">{modal.type==='new-folder'?'Folder name':'Name'}</label><input id="library-name" value={value} maxLength={120} required disabled={busy} onChange={e=>setValue(e.target.value)}/></>}{modal.type==='new-folder'&&<FolderParentSelect folders={folders} value={modal.parentId===undefined?(selectedFolder&&!['all','trash'].includes(selectedFolder)?selectedFolder:null):modal.parentId} onChange={parentId=>setModal(previous=>({...previous,parentId}))} disabled={busy}/>}{modal.type==='new-folder'&&<FolderDescriptionInput value={modal.description||''} onChange={description=>setModal(previous=>({...previous,description}))} disabled={busy}/>}{modal.type==='new-notes'&&<><p className="notes-creator-explainer">Your writing studio includes formatting, math, checklists, a live preview, an outline, and PDF export. Start fresh or choose a structure.</p><div className="note-template-grid" role="group" aria-label="Note template">{NOTE_TEMPLATES.map(template=><button type="button" disabled={busy} key={template.id} aria-pressed={noteTemplate===template.id} onClick={()=>setNoteTemplate(template.id)}><strong>{template.name}</strong><small>{template.description}</small></button>)}</div>{noteTemplate!=='blank'&&<pre className="note-template-preview" aria-label="Template preview">{NOTE_TEMPLATES.find(template=>template.id===noteTemplate)?.content(value||'Untitled notes')}</pre>}</>}{modal.type==='new-notebook'&&<><label htmlFor="notebook-pages">Number of blank pages</label><input id="notebook-pages" type="number" min="1" max="500" step="1" required disabled={busy} value={notebookPages} onChange={event=>setNotebookPages(event.target.value)}/><label htmlFor="notebook-size">Page size</label><select id="notebook-size" disabled={busy} value={notebookSize} onChange={event=>setNotebookSize(event.target.value)}><option value="letter">US Letter</option><option value="a4">A4</option></select><p>Create 1–500 empty pages for handwriting. Your notebook opens directly in the PDF editor with the pen selected.</p></>}{error&&<p role="alert" className="library-modal-error">{error}</p>}<div className="library-modal-footer"><button type="button" disabled={busy} onClick={()=>setModal(null)}>Cancel</button><button className="library-primary" type="submit" disabled={busy||(!['move','delete-folder'].includes(modal.type)&&!value.trim())}>{busy?'Working…':modal.type==='move'?'Move documents':modal.type==='delete-folder'?'Remove folder':modal.type==='new-folder'?'Create folder':modal.type==='new-notebook'?'Create & open PDF editor':modal.type==='new-notes'?'Create & open':'Save name'}</button></div></form></div>}
    <div className="library-layout"><aside aria-label="Document folders"><button className={selectedFolder==='all'?'is-active':''} onClick={()=>onSelectFolder('all')}><Files size={17}/><span>All documents</span><small>{active.length}</small></button><button className={`${selectedFolder===null?'is-active':''} ${dropTarget==='unfiled'?'is-drop-target':''}`} {...folderDrop('unfiled')} onDrop={e=>drop(e,null)} onClick={()=>onSelectFolder(null)}><Folder size={17}/><span>Unfiled</span><small>{active.filter(file=>!file.pdfFolder).length}</small></button>
      <p className="library-sidebar-label">Folders</p>
      {folders.length===0 && <p className="library-sidebar-help">Create a folder to organize your files.</p>}
      {folderTree(folders).map(folder=><div key={folder._id} style={{marginLeft:folder.depth*12}} className={`library-folder ${selectedFolder===folder._id?'is-active':''} ${dropTarget===folder._id?'is-drop-target':''}`} {...folderDrop(folder._id)}><button className="library-folder-open" onClick={()=>onSelectFolder(folder._id)}><Folder size={16} style={{color:folder.color}}/><span title={folder.path}>{folder.name}</span><small>{active.filter(file=>file.pdfFolder===folder._id).length}</small></button><button className="library-icon" disabled={busy} aria-label={`Rename folder ${folder.name}`} onClick={()=>{setValue(folder.name);setModal({type:'rename-folder',folder})}}><Edit2 size={13}/></button><button className="library-icon" disabled={busy} aria-label={`Remove folder ${folder.name}`} onClick={()=>setModal({type:'delete-folder',folder})}><X size={14}/></button></div>)}
      <button className={`library-trash ${inTrash?'is-active':''}`} onClick={()=>onSelectFolder('trash')}><Trash2 size={17}/><span>Trash</span><small>{trashed.length}</small></button><p className="library-sidebar-help">Drag documents onto a folder to move them.</p>
    </aside><div className="library-content">
      <div className="library-breadcrumb"><Folder size={16}/><span>Documents</span><span>/</span><strong>{folderName}</strong><small>{visible.length} files</small></div>
      <div className="library-filters"><label className="library-search"><Search size={17}/><input aria-label="Search documents" placeholder={`Search ${folderName.toLowerCase()}…`} value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button aria-label="Clear document search" onClick={()=>setSearch('')}><X size={14}/></button>}</label><select aria-label="Sort documents" value={sort} onChange={e=>setSort(e.target.value)}><option value="updated">Recently updated</option><option value="created">Newest uploaded</option><option value="name">Name A–Z</option><option value="type">File type</option></select></div>
      {error&&<div className="library-feedback library-error" role="alert">{error}<button aria-label="Dismiss document error" onClick={()=>setError('')}><X size={15}/></button></div>}
      {notice&&<div className="library-feedback" role="status"><Check size={16}/><span>{notice.text}</span>{notice.undo&&<button disabled={busy} onClick={()=>run(()=>action('restore',notice.undo))}>Undo</button>}<button aria-label="Dismiss document notification" onClick={()=>setNotice(null)}><X size={15}/></button></div>}
      {inTrash&&<p className="library-trash-info">Documents in Trash can be restored. Removing a folder keeps its documents in Unfiled.</p>}
      <div className="library-selection"><label><input type="checkbox" aria-label="Select all visible documents" ref={input => { if (input) input.indeterminate = selected.size > 0 && !visible.every(file => selected.has(file._id)) }} checked={visible.length>0&&visible.every(file=>selected.has(file._id))} disabled={busy||!visible.length} onChange={e=>setSelected(e.target.checked?new Set(visible.map(file=>file._id)):new Set())}/>{selected.size?`${selected.size} selected`:'Select documents'}</label>{selected.size>0&&<><button disabled={busy} onClick={()=>setSelected(new Set())}>Clear</button>{inTrash?<button disabled={busy} onClick={()=>run(()=>action('restore',[...selected]))}><RotateCcw size={15}/>Restore</button>:<><button disabled={busy} onClick={()=>openMove([...selected])}><ArrowRight size={15}/>Move</button><button className="library-danger" disabled={busy} onClick={()=>run(()=>action('trash',[...selected]))}><Trash2 size={15}/>Move to Trash</button></>}</>}{busy&&<Loader2 className="animate-spin" size={17}/>}</div>
      <div className="library-table-scroll"><table className="library-table"><thead><tr><th className="library-check-column"></th><th>Name</th><th>Folder</th><th>Updated</th><th className="library-actions-heading">Actions</th></tr></thead><tbody>{visible.map(file=><tr key={file._id} data-library-file-id={file._id} tabIndex={-1} className={selected.has(file._id)?'is-selected':''} draggable={!inTrash&&!busy} onDragStart={e=>{const ids=selected.has(file._id)?[...selected]:[file._id];e.dataTransfer.setData('application/x-assignment-documents',JSON.stringify(ids));e.dataTransfer.effectAllowed='move'}} onDragEnd={()=>setDropTarget(null)}><td><input type="checkbox" aria-label={`Select ${file.name}`} checked={selected.has(file._id)} disabled={busy} onChange={()=>toggle(file._id)}/></td><td><button className="library-file-open" disabled={inTrash||busy} onClick={()=>onOpen(file._id)}><FileText size={22}/><span><strong>{file.name}</strong><small>{file.originalName}</small>{file.tags?.length>0&&<small>{file.tags.join(' · ')}</small>}</span><em>{file.originalName?.split('.').pop()||'FILE'}</em></button><div className="flex flex-wrap gap-1 mt-1">{tasks.filter(task=>documentTaskIds(file).includes(task._id)).map(task=><button key={task._id} type="button" className="text-xs text-slate-300 border border-slate-600 rounded px-2 py-1" onClick={()=>onOpenTask?.(task)} title={`Open task: ${task.text}`}>Task: {task.text}</button>)}</div></td><td><span className="library-folder-name">{folders.find(folder=>folder._id===file.pdfFolder)?.name||'Unfiled'}</span></td><td><time dateTime={file.updatedAt||file.createdAt}>{new Date(file.updatedAt||file.createdAt).toLocaleDateString()}</time></td><td><div className="library-row-actions">{inTrash?<button disabled={busy} aria-label={`Restore ${file.name}`} onClick={()=>run(()=>action('restore',[file._id]))}><RotateCcw size={16}/><span>Restore</span></button>:<><button disabled={busy} aria-label={`Move ${file.name}`} title="Move to folder" onClick={()=>openMove([file._id])}><ArrowRight size={16}/></button><button disabled={busy} aria-label={`Rename ${file.name}`} title="Rename" onClick={()=>{setValue(file.name);setModal({type:'rename',file})}}><Edit2 size={16}/></button><button disabled={busy} aria-label={`Download ${file.name}`} title="Download" onClick={()=>download(file)}><Download size={16}/></button><button disabled={busy} aria-label={`Move ${file.name} to Trash`} title="Move to Trash" className="library-danger" onClick={()=>run(()=>action('trash',[file._id]))}><Trash2 size={16}/></button></>}</div></td></tr>)}</tbody></table></div>
      {!visible.length&&<div className="library-empty"><Folder size={36}/><h3>{search?'No matching documents':inTrash?'Trash is empty':'This folder is empty'}</h3><p>{search?'Try a different name, filename, or tag.':inTrash?'Deleted documents will appear here for restoration.':'Create notes, upload documents, or move files from another folder.'}</p>{!inTrash&&!search&&<button className="library-primary" onClick={onUpload}><Upload size={16}/>Upload documents</button>}</div>}
    </div></div>

  </section>
}
