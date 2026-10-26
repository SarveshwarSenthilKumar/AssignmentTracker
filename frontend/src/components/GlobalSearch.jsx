import {useEffect,useId,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {Search,X,ArrowUpRight,Loader2} from 'lucide-react'
import {readApiJson} from '../lib/apiResponse'
import {SHORTCUTS} from '../lib/shortcuts'
import useTxstEvents from '../hooks/useTxstEvents'
import './GlobalSearch.css'

const PAGES=[['study','Study stars','Starred questions topics answers review learning notes'],['home','Home','Dashboard overview today'],['tasks','Tasks','Assignments deadlines todos folders subfolders drag drop sort priorities undo delete completion progress'],['calendar','Calendar','Appointments events sports F1 categories season import'],['documents','Documents','PDF editor notes handwriting calculator graph markdown OneNote folders subfolders upload annotation pen highlight eraser stylus palm finger scrolling pinch zoom fullscreen continuous pages delete reorder copy paste snippets cleanup stopwatch timer clock fonts text editing'],['workspace','Workspace','Windows tools layout'],['resumes','Resumes','Resume tailoring job application'],['cover-letters','Cover letters','Generate tailor cleanup letters'],['jobs','Jobs','Saved jobs Handshake import OCR'],['assistant','AI assistant','Chats conversations Gemini'],['visualization','Visualization','Task graph dependencies'],['canvas','Canvas','Courses sync ICS import'],['account','Account','Profile time zone AI access API keys settings connections preferences GitHub LinkedIn confirmation permissions'],['shortcuts','Keyboard shortcuts','Hotkeys help']]
const LABELS={study:'Starred questions & topics',pages:'Pages & features',shortcuts:'Keyboard shortcuts',tasks:'Tasks & Canvas items',documents:'Documents, notes, resumes & letters',events:'Calendar events',jobs:'Saved jobs',chats:'Assistant conversations',taskFolders:'Task folders',documentFolders:'Document folders',categories:'Calendar categories',campus:'TXST public events'}
export default function GlobalSearch({token,onChoose}){
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[groups,setGroups]=useState([]),[categories,setCategories]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[indexing,setIndexing]=useState(null),[trash,setTrash]=useState(false),[active,setActive]=useState(0)
  const root=useRef(null),input=useRef(null),previous=useRef(null),serial=useRef(0),id=useId()
  const {campus}=useTxstEvents(token,open)
  const [indexRevision,setIndexRevision]=useState(0)
  const close=()=>setOpen(false)
  useEffect(()=>{
    const show=()=>{previous.current=document.activeElement;setOpen(true);requestAnimationFrame(()=>input.current?.focus())}
    const key=event=>{
      if(event.isComposing)return
      if((event.ctrlKey||event.metaKey)&&!event.shiftKey&&!event.altKey&&event.key.toLowerCase()==='k'){event.preventDefault();event.stopImmediatePropagation();if(open){input.current?.focus();input.current?.select()}else show()}
      else if(open&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close()}
    }
    window.addEventListener('global-search-open',show);window.addEventListener('keydown',key,true)
    return()=>{window.removeEventListener('global-search-open',show);window.removeEventListener('keydown',key,true)}
  },[open])
  useEffect(()=>{if(!open)return;const timer=setTimeout(()=>input.current?.focus(),0);return()=>{clearTimeout(timer);if(previous.current?.isConnected)previous.current.focus({preventScroll:true})}},[open])
  useEffect(()=>{
    if(!open)return
    const generation=++serial.current,controller=new AbortController();let poll,timer
    setActive(0);setError('');setGroups([]);setCategories([])
    if(query.trim().length<2){setBusy(false);setIndexing(null);return()=>controller.abort()}
    const load=async()=>{
      try{
        const response=await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&trash=${trash}`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal,cache:'no-store'}),data=await readApiJson(response)
        if(!response.ok)throw new Error(data.message||'Search failed.')
        if(serial.current!==generation||controller.signal.aborted)return
        setGroups(data.groups||[]);setCategories(data.categories||[]);setIndexing(data.indexing);setBusy(false)
        if(data.indexing?.running)poll=setTimeout(load,1800)
      }catch(error){if(!controller.signal.aborted&&serial.current===generation){setError(error.message);setBusy(false)}}
    }
    setBusy(true);timer=setTimeout(load,250)
    return()=>{controller.abort();clearTimeout(timer);clearTimeout(poll)}
  },[query,open,token,trash,indexRevision])
  const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const pageResults=PAGES.filter(page=>!terms.length||terms.every(term=>page.join(' ').toLowerCase().includes(term))).map(([route,title,detail])=>({id:route,type:'pages',title,detail,route}))
  const shortcutResults=terms.length?SHORTCUTS.filter(item=>terms.every(term=>`${item.label} ${item.scope} ${item.keys}`.toLowerCase().includes(term))).map(item=>({id:item.id,type:'shortcuts',title:item.label,detail:item.keys,route:'shortcuts'})):[]
  const campusResults=query.trim().length>=2&&!campus.hideTxstEvents?(campus.events||[]).filter(item=>!(campus.hiddenCalendarIds||[]).includes(`txst:${item.id}`)&&terms.every(term=>JSON.stringify(item).toLowerCase().includes(term))).map(item=>({type:'campus',id:String(item.id),title:item.name||'TXST event',detail:String(item.description||'Public campus event').replace(/<[^>]*>/g,'').slice(0,200),url:item.url})):[]
  const sections=[{type:'pages',items:pageResults},{type:'shortcuts',items:shortcutResults},...groups,{type:'categories',items:categories},{type:'campus',items:campusResults}]
  const results=sections.flatMap(group=>group.items),activeIndex=Math.min(active,Math.max(0,results.length-1))
  useEffect(()=>{if(open)root.current?.querySelector(`[data-search-index="${activeIndex}"]`)?.scrollIntoView({block:'nearest'})},[activeIndex,open])
  const choose=async result=>{close();try{await onChoose(result)}catch(error){setOpen(true);setError(error.message)}}
  const more=async group=>{
    const generation=serial.current
    setBusy(true);setError('')
    try{const response=await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&trash=${trash}&group=${group.type}&offset=${group.offset+group.items.length}`,{headers:{Authorization:`Bearer ${token}`}}),data=await readApiJson(response);if(generation!==serial.current)return;if(!response.ok)throw new Error(data.message||'Could not load more results.');const next=data.groups?.[0];if(next)setGroups(previous=>previous.map(value=>value.type===group.type?{...next,offset:group.offset,items:[...value.items,...next.items]}:value))}catch(error){if(generation===serial.current)setError(error.message)}finally{if(generation===serial.current)setBusy(false)}
  }
  const reindex=async()=>{
    setBusy(true);setError('')
    try{const response=await fetch('/api/search/reindex',{method:'POST',headers:{Authorization:`Bearer ${token}`}}),data=await readApiJson(response);if(!response.ok)throw new Error(data.message||'Could not rebuild file search.');setIndexRevision(value=>value+1)}catch(error){setError(error.message)}finally{setBusy(false)}
  }
  if(!open)return null
  let resultIndex=0
  return createPortal(<div className="global-search-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section ref={root} role="dialog" aria-modal="true" aria-label="Search the entire platform" className="global-search-dialog" onKeyDown={event=>{
    if(event.key==='Tab'){const controls=[...root.current.querySelectorAll('input,button:not(:disabled)')];if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1)?.focus()}else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0]?.focus()}return}
    if(event.target!==input.current)return
    if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();setActive(previous=>results.length?(previous+(event.key==='ArrowDown'?1:-1)+results.length)%results.length:0)}
    if(event.key==='Enter'&&results[activeIndex]){event.preventDefault();choose(results[activeIndex])}
  }}><div className="global-search-input"><Search size={21}/><input ref={input} role="combobox" aria-label="Search everything" aria-expanded="true" aria-controls={`${id}-results`} aria-activedescendant={results.length?`${id}-${activeIndex}`:undefined} autoComplete="off" placeholder="Search tasks, files, events, jobs, conversations…" maxLength={160} value={query} onChange={event=>setQuery(event.target.value)}/>{busy&&<Loader2 size={17} className="global-search-spinner"/>}<button type="button" onClick={close} aria-label="Close global search"><X size={18}/></button></div>
    <div className="global-search-options"><span>Search your saved workspace · No AI</span><button type="button" disabled={busy||indexing?.running} onClick={reindex}>Reindex file contents</button><label><input type="checkbox" checked={trash} onChange={event=>setTrash(event.target.checked)}/>Include trashed files</label></div>
    {error&&<p role="alert" className="global-search-error">{error}</p>}
    <div id={`${id}-results`} role="listbox" aria-label="Search results" className="global-search-results">{sections.filter(group=>group.items.length).map(group=><div key={group.type} role="group" aria-label={LABELS[group.type]}><h3>{LABELS[group.type]}{group.total!==undefined&&<span>{group.total}</span>}</h3>{group.items.map(result=>{const index=resultIndex++;return <button type="button" role="option" aria-selected={index===activeIndex} id={`${id}-${index}`} data-search-index={index} key={`${result.type}:${result.id}`} onMouseMove={()=>setActive(index)} onClick={()=>choose(result)}><span><strong>{result.title}{result.trashed?' · Trash':result.archived?' · Archived':''}</strong><small>{result.detail}</small></span><ArrowUpRight size={14}/></button>})}{group.hasMore&&<button type="button" className="global-search-more" disabled={busy} onClick={()=>more(group)}>Load more {LABELS[group.type].toLowerCase()}</button>}</div>)}{query.trim().length===1&&<p className="global-search-empty">Type at least two characters to search saved records.</p>}{query.trim().length>=2&&!busy&&!results.length&&<p className="global-search-empty">No matches yet. Try a shorter phrase or include trashed files.</p>}</div>
    <footer><span><kbd>↑</kbd><kbd>↓</kbd> navigate · <kbd>Enter</kbd> open · <kbd>Esc</kbd> close</span><span role="status">{indexing?.running?`Indexing files ${indexing.processed} / ${indexing.total}…`:'Ctrl / Cmd + K'}</span></footer>{indexing&&(indexing.failed||indexing.empty||indexing.unsupported||indexing.error)&&<p className="global-search-coverage">{indexing.failed||0} files could not be indexed; {indexing.empty||0} have no readable text; {indexing.unsupported||0} use unsupported content formats. Their names, tags and saved text annotations remain searchable. Images, scanned handwriting, audio and video need transcription/OCR; unsaved editor text is not indexed.</p>}
  <p className="global-search-coverage">Search covers saved, readable text. Scanned images, handwriting, audio and video require OCR or transcription. Unsaved edits and account credentials are not searched.</p></section></div>,document.fullscreenElement||document.body)
}
