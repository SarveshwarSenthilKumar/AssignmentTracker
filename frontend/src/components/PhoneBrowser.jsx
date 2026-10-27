import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, RotateCcw, X, Plus, Star, ExternalLink, Settings, Maximize2, Copy } from 'lucide-react'
import AssistantMarkdown from './AssistantMarkdown'
import { referenceMarkdown } from '../lib/referenceMarkdown'
import { embedTarget, embeddedSiteNotice } from '../lib/phoneWeb'
import NativePhonePage, { phoneDesktop } from './NativePhonePage'
import './PhoneBrowser.css'

const blankTab=()=>({id:crypto.randomUUID(),history:[],index:-1,mode:'embedded',zoom:100,viewport:0,fit:true,media:false,storage:false,adapter:true,profile:'standard',referrer:'strict-origin-when-cross-origin',group:'General',label:'',started:false,reload:0,status:'idle'})
function frameSandbox(tab){
  const base=tab.profile==='restricted'?'allow-scripts allow-forms allow-same-origin':'allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals'
  return base+(tab.storage?' allow-storage-access-by-user-activation':'')
}
function webAddress(value,reader=false){
  const text=value.trim(),explicit=/^[a-z][a-z\d+.-]*:/i.test(text),address=/^[^\s/?#]+\.[^\s/?#]+(?:[/?#]|$)/.test(text)
  const url=new URL(explicit?text:address?`https://${text}`:reader?`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(text)}`:`https://www.google.com/search?q=${encodeURIComponent(text)}`)
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.origin===location.origin||url.href.length>2000)throw new Error('Enter an external http/https address or a search phrase.')
  return url.href
}
function savedState(key,supplied){
  try{
    const data=supplied||JSON.parse(localStorage.getItem(key)||'{}')
    const tabs=(Array.isArray(data.tabs)?data.tabs:[]).slice(0,8).map(value=>{
      const history=(Array.isArray(value.history)?value.history:[]).filter(url=>{try{return webAddress(url)===url}catch{return false}}).slice(-30)
      return {...blankTab(),history,index:history.length?Math.max(0,Math.min(history.length-1,Number.isInteger(value.index)?value.index:history.length-1)):-1,mode:['embedded','reader','window','browser'].includes(value.mode)?value.mode:'embedded',zoom:[50,75,90,100,110,125,150,200].includes(value.zoom)?value.zoom:100,viewport:[0,390,768,1280].includes(value.viewport)?value.viewport:0,fit:value.fit!==false,media:value.media===true,storage:value.storage===true,adapter:value.adapter!==false,profile:value.profile==='restricted'?'restricted':'standard',referrer:value.referrer==='no-referrer'?'no-referrer':'strict-origin-when-cross-origin',group:typeof value.group==='string'?value.group.slice(0,32)||'General':'General',label:typeof value.label==='string'?value.label.slice(0,40):''}
    })
    const bookmarks=(Array.isArray(data.bookmarks)?data.bookmarks:[]).filter(item=>{try{return typeof item.title==='string'&&webAddress(item.url)===item.url}catch{return false}}).slice(0,80).map(item=>({url:item.url,title:item.title.slice(0,120)}))
    return {tabs:tabs.length?tabs:[blankTab()],bookmarks}
  }catch{return {tabs:[blankTab()],bookmarks:[]}}
}
function readSessions(key){
  try{return (JSON.parse(localStorage.getItem(key)||'{}').sessions||[]).filter(item=>typeof item.title==='string'&&Array.isArray(item.tabs)).slice(0,5).map(item=>({id:crypto.randomUUID(),title:item.title.slice(0,60),tabs:savedState('',{tabs:item.tabs}).tabs}))}catch{return []}
}
const tabMetadata=({history,index,mode,zoom,viewport,fit,media,storage,adapter,profile,referrer,group,label,nativeUrl})=>({history:nativeUrl&&mode==='embedded'?[nativeUrl]:history,index:nativeUrl&&mode==='embedded'?0:index,mode,zoom,viewport,fit,media,storage,adapter,profile,referrer,group,label})
function EmbeddedPage({tab,onChange,onOpenBrowser}){
  const host=useRef(null),[size,setSize]=useState({width:300,height:400}),change=useRef(onChange),navigation=useRef({start:0,timer:null})
  change.current=onChange
  const url=tab.history[tab.index]
  const target=url?(tab.adapter?embedTarget(url):{url,adapter:null}):null
  const blocked=url&&!tab.forceFrame?(embeddedSiteNotice(url)||(tab.embeddingBlock?.url===url?{title:'This site blocks embedding',message:tab.embeddingBlock.message}:null)):null
  useLayoutEffect(()=>{
    if(!url||!tab.started)return
    if(blocked){change.current({status:'blocked',loadMs:null});return}
    navigation.current.start=performance.now();navigation.current.pending=true;change.current({status:'loading',loadMs:null})
    navigation.current.timer=setTimeout(()=>change.current({status:'slow'}),15000)
    return()=>clearTimeout(navigation.current.timer)
  },[url,tab.started,tab.reload,tab.index,target?.url,!!blocked])
  useLayoutEffect(()=>{
    let frameId=null
    const measure=()=>{
      const width=Math.floor(host.current?.clientWidth||0),height=Math.floor(host.current?.clientHeight||0)
      if(width>0&&height>0)setSize(previous=>Math.abs(previous.width-width)<2&&Math.abs(previous.height-height)<2?previous:{width,height})
    }
    const schedule=()=>{if(frameId!==null)return;frameId=requestAnimationFrame(()=>{frameId=null;measure()})}
    measure();const observer=new ResizeObserver(schedule);if(host.current)observer.observe(host.current);return()=>{observer.disconnect();if(frameId!==null)cancelAnimationFrame(frameId)}
  },[!!blocked])
  const width=Math.max(1,tab.viewport||size.width),scale=Math.max(.1,(tab.zoom/100)*(tab.viewport&&tab.fit?Math.min(1,size.width/width):1)),height=Math.max(1,Math.floor(size.height/scale))
  if(blocked&&tab.started)return <div className="phone-browser-blocked"><strong>{blocked.title}</strong><p>{blocked.message}</p><button type="button" onClick={()=>onOpenBrowser(url)}>Open website in browser window</button><a href={url} target="_blank" rel="noopener noreferrer">Open in a regular tab</a><details><summary>Advanced</summary><p>Retrying cannot override the website policy, but you can display the browser’s response again.</p><button type="button" onClick={()=>onChange({forceFrame:true,reload:tab.reload+1,status:'loading'})}>Try frame once anyway</button></details></div>
  return <div className="phone-browser-frame" ref={host}>
    {url&&tab.started?<div className="phone-browser-frame-size" style={{width:width*scale,height:height*scale}}><iframe key={`${tab.id}:${tab.index}:${tab.reload}`} src={target.url} title={`Embedded website: ${new URL(url).hostname}`} style={{width,height,transform:`scale(${scale})`}} sandbox={frameSandbox(tab)} allow={[tab.profile!=='restricted'?'clipboard-write':'','encrypted-media','picture-in-picture',tab.media?'camera *; microphone *':''].filter(Boolean).join('; ')} referrerPolicy={tab.referrer} onLoad={()=>{clearTimeout(navigation.current.timer);const loadMs=navigation.current.pending?Math.round(performance.now()-navigation.current.start):null;navigation.current.pending=false;onChange({status:'loaded',loadMs})}} onError={()=>{clearTimeout(navigation.current.timer);navigation.current.pending=false;onChange({status:'error',loadMs:null})}}/></div>:<div className="phone-browser-start"><strong>{url?'Resume this page':'Start browsing'}</strong><p>{url?'Saved tabs restore addresses, not unsaved website form data. Pages load only when you resume them.':'Enter an address above. Compatible websites open directly inside the phone.'}</p>{url&&<button type="button" onClick={()=>onChange({started:true,status:'loading',reload:tab.reload+1})}>Resume page</button>}</div>}
  </div>
}
function ReaderPage({url,token,reload,onNavigate}){
  const [page,setPage]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false)
  useEffect(()=>{
    if(!url)return
    const controller=new AbortController();setLoading(true);setError('');setPage(null)
    const query=url.startsWith('https://en.wikipedia.org/w/index.php?search=')?new URL(url).searchParams.get('search'):undefined
    fetch('/api/phone/reference',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({url,query}),signal:controller.signal}).then(async response=>{const data=await response.json().catch(()=>({message:'The reader backend is unavailable.'}));if(!response.ok)throw new Error(data.message||'Could not read this page.');if(!controller.signal.aborted)setPage(data)}).catch(error=>{if(!controller.signal.aborted)setError(error.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return()=>controller.abort()
  },[url,token,reload])
  return <div className="phone-browser-reader">{!url&&<p>Search public references or enter an article address. Reader searches use Wikipedia.</p>}{loading&&<p role="status">Reading webpage…</p>}{error&&<p role="alert">{error}</p>}{page&&<><h2>{page.title}</h2><AssistantMarkdown preserveSpacing content={referenceMarkdown(page)} baseUrl={page.url} onOpenLink={onNavigate}/>{page.links?.length>0&&<details open={page.search||undefined}><summary>{page.search?'Search results':'Page links'} ({page.links.length})</summary>{page.links.map(item=><button key={item.url} type="button" onClick={()=>onNavigate(item.url)}>{item.text}</button>)}</details>}</>}</div>
}

export default forwardRef(function PhoneBrowser({userId,token,onExpand,onCaptureNote,note='',onNoteChange,visible=true},apiRef){
  const storageKey=`study-phone-browser:${userId}`,[initial]=useState(()=>savedState(storageKey))
  const [tabs,setTabs]=useState(initial.tabs),[activeId,setActiveId]=useState(initial.tabs[0].id),[bookmarks,setBookmarks]=useState(initial.bookmarks),[address,setAddress]=useState(initial.tabs[0].history[initial.tabs[0].index]||''),[settings,setSettings]=useState(false),[showBookmarks,setShowBookmarks]=useState(false),[message,setMessage]=useState(''),[focus,setFocus]=useState(false),[closed,setClosed]=useState([])
  const field=useRef(null),discard=useRef(false),tabsRef=useRef(tabs);tabsRef.current=tabs
  const [notesOpen,setNotesOpen]=useState(false),[notesPreview,setNotesPreview]=useState(false),[confirmSuspend,setConfirmSuspend]=useState(false)
  const [sessions,setSessions]=useState(()=>readSessions(storageKey)),[sessionName,setSessionName]=useState(''),[sessionOpen,setSessionOpen]=useState(false),[groupFilter,setGroupFilter]=useState('All'),[diagnostic,setDiagnostic]=useState(null),[checking,setChecking]=useState(false)
  const diagnosticController=useRef(null),importInput=useRef(null)
  const active=tabs.find(tab=>tab.id===activeId)||tabs[0],native=!!phoneDesktop&&active.mode==='embedded',url=(native&&active.nativeUrl)||active.history[active.index]||''
  const update=(id,changes)=>setTabs(previous=>previous.map(tab=>tab.id===id?{...tab,...(typeof changes==='function'?changes(tab):changes)}:tab))
  useEffect(()=>{
    if(discard.current)return
    try{localStorage.setItem(storageKey,JSON.stringify({bookmarks,tabs:tabs.map(tabMetadata),sessions:sessions.map(item=>({...item,tabs:item.tabs.map(tabMetadata)}))}))}catch{setMessage('Browser storage is unavailable. Tabs and bookmarks will only last this session.')}
  },[tabs,bookmarks,sessions,storageKey])
  useEffect(()=>{diagnosticController.current?.abort();setChecking(false);setDiagnostic(null);return()=>diagnosticController.current?.abort()},[active.id,url])
  useEffect(()=>{const reset=event=>{if(event.detail!==userId)return;discard.current=true;phoneDesktop?.clearAccount(userId).catch(()=>{});try{localStorage.removeItem(storageKey)}catch{}};window.addEventListener('workspace-reset',reset);return()=>window.removeEventListener('workspace-reset',reset)},[userId])
  const activate=id=>{const tab=tabsRef.current.find(item=>item.id===id);if(!tab)return;setActiveId(id);setAddress((phoneDesktop&&tab.mode==='embedded'&&tab.nativeUrl)||tab.history[tab.index]||'');setMessage('')}
  const newTab=()=>{if(tabs.length>=8){setMessage('Up to eight browsing tabs can remain open. Close one first.');return}const tab=blankTab();setTabs(previous=>[...previous,tab]);setActiveId(tab.id);setAddress('');setMessage('');setGroupFilter('All');field.current?.focus()}
  const closeTab=id=>{
    const tab=tabs.find(item=>item.id===id);setClosed(previous=>[...previous.slice(-7),{...tab,started:false}])
    const remaining=tabs.filter(item=>item.id!==id),next=remaining.length?remaining:[blankTab()];setTabs(next);if(activeId===id){setActiveId(next[0].id);setAddress(next[0].history[next[0].index]||'')}
    setMessage('Tab closed. Use Reopen closed tab in settings to restore its address. Website form state cannot be recovered after closing.')
  }
  const openExternal=(target,windowMode=false)=>{
    const width=Math.min(900,Math.max(420,window.innerWidth*.65)),height=Math.min(900,window.screen.availHeight)
    window.open(target,'_blank',windowMode?`popup=yes,width=${Math.round(width)},height=${height},resizable=yes,scrollbars=yes,noopener,noreferrer`:'noopener,noreferrer')
    setMessage('Requested a browser window/tab. If blocked, use the Open in browser link below.')
  }
  const navigate=(input,external=true)=>{
    try{
      const target=webAddress(input,active.mode==='reader')
      update(active.id,tab=>({history:[...tab.history.slice(0,tab.index+1),target].slice(-30),index:Math.min(tab.index+1,29),nativeUrl:undefined,forceFrame:false,embeddingBlock:null,started:true,reload:tab.reload+1,status:'loading'}));setAddress(target);setMessage('')
      if(external&&['window','browser'].includes(active.mode))openExternal(target,active.mode==='window')
    }catch(error){setMessage(error.message)}
  }
  const nativeCommand=command=>phoneDesktop.command({owner:userId,id:active.id,command}).catch(error=>setMessage(error.message))
  const reloadPage=()=>{if(native&&active.started)nativeCommand('reload');else update(active.id,{started:true,reload:active.reload+1,status:'loading'})}
  useEffect(()=>{if(native&&active.nativeUrl&&document.activeElement!==field.current)setAddress(active.nativeUrl)},[active.id,active.nativeUrl,native])
  const history=offset=>{if(native&&active.started){nativeCommand(offset<0?'back':'forward');return}const index=active.index+offset;if(index<0||index>=active.history.length)return;update(active.id,{index,forceFrame:false,embeddingBlock:null,started:true,status:'loading'});setAddress(active.history[index])}
  const bookmark=()=>{if(!url)return;const parsed=new URL(url);setBookmarks(previous=>previous.some(item=>item.url===url)?previous.filter(item=>item.url!==url):[{url,title:(parsed.hostname+(parsed.pathname==='/'?'':parsed.pathname)).slice(0,120)},...previous].slice(0,80))}
  const copyUrl=async()=>{try{await navigator.clipboard.writeText(url);setMessage('Requested page address copied.')}catch{setMessage('Copy the address directly from the address field.')}}
  const keydown=event=>{
    if(!(event.ctrlKey||event.metaKey)||event.altKey)return
    if(event.key.toLowerCase()==='l'){event.preventDefault();field.current?.focus();field.current?.select()}
    if(event.key.toLowerCase()==='t'&&!event.shiftKey){event.preventDefault();newTab()}
  }
  const launchUrl=(input,mode='embedded')=>{
    try{
      const target=webAddress(input,mode==='reader'),existing=tabsRef.current.find(tab=>tab.history[tab.index]===target&&tab.mode===mode)
      if(existing){activate(existing.id);update(existing.id,{started:true})}
      else{
        if(tabsRef.current.length>=8){setMessage('Close a browser tab before launching another web app.');return false}
        const tab={...blankTab(),history:[target],index:0,mode,started:true,status:'loading'};setTabs(previous=>[...previous,tab]);setActiveId(tab.id);setAddress(target)
      }
      setGroupFilter('All');if(['window','browser'].includes(mode))openExternal(target,mode==='window');return true
    }catch(error){setMessage(error.message);return false}
  }
  useImperativeHandle(apiRef,()=>({openUrl:launchUrl}))
  const inspect=async()=>{
    if(!url||checking)return
    const controller=new AbortController();diagnosticController.current=controller;setChecking(true);setDiagnostic(null)
    try{const target=active.adapter?embedTarget(url).url:url,response=await fetch('/api/phone/compatibility',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({url:target,appOrigin:location.origin}),signal:controller.signal}),data=await response.json().catch(()=>({message:'Restart the backend to enable compatibility diagnostics.'}));if(!controller.signal.aborted){setDiagnostic({...data,assessment:data.assessment||'unknown'});if(data.assessment==='blocked')update(active.id,{embeddingBlock:{url,message:data.message},forceFrame:false,status:'blocked'})}}
    catch(error){if(!controller.signal.aborted)setDiagnostic({assessment:'unknown',message:'The compatibility request could not reach the backend.'})}
    finally{if(!controller.signal.aborted)setChecking(false)}
  }
  const saveSession=()=>{
    if(!sessionName.trim())return
    if(sessions.length>=5){setMessage('Remove a saved session before creating another (maximum five).');return}
    const snapshot=tabs.map(tab=>{const saved=tabMetadata(tab),address=saved.history[saved.index];return {...saved,history:address?[address]:[],index:address?0:-1}})
    setSessions(previous=>[...previous,{id:crypto.randomUUID(),title:sessionName.trim(),tabs:snapshot}]);setSessionName('');setMessage('Session saved. It contains addresses and settings, not website form data or sign-in cookies.')
  }
  const restoreSession=item=>{
    const current=tabsRef.current.filter(tab=>tab.history.length),available=8-current.length,incoming=savedState('',{tabs:item.tabs}).tabs.slice(0,available)
    if(!incoming.length){setMessage('Close a tab to make room for the saved session.');return}
    setTabs([...current,...incoming]);setActiveId(incoming[0].id);setAddress(incoming[0].history[incoming[0].index]||'');setGroupFilter('All');setMessage(`Restored ${incoming.length} address tabs. Resume each page to load it; existing pages were preserved.`)
  }
  const exportSession=()=>{
    const content={version:1,tabs:tabs.map(tabMetadata),bookmarks,sessions:sessions.map(item=>({...item,tabs:item.tabs.map(tabMetadata)}))},blob=new Blob([JSON.stringify(content,null,2)],{type:'application/json'}),objectUrl=URL.createObjectURL(blob),link=document.createElement('a');link.href=objectUrl;link.download='study-phone-browser.json';link.click();setTimeout(()=>URL.revokeObjectURL(objectUrl),1000)
  }
  const importSession=async file=>{
    if(!file)return
    try{
      if(file.size>2000000)throw new Error('Choose a browser archive smaller than 2 MB.')
      const value=JSON.parse(await file.text());if(value.version!==1||!Array.isArray(value.tabs)||!Array.isArray(value.bookmarks))throw new Error('Choose a valid Study Phone browser archive.')
      const clean=savedState('',value),current=tabsRef.current.filter(tab=>tab.history.length),added=clean.tabs.slice(0,8-current.length)
      if(added.length){setTabs([...current,...added]);setActiveId(added[0].id);setAddress(added[0].history[added[0].index]||'')}
      setBookmarks(previous=>[...previous,...clean.bookmarks.filter(item=>!previous.some(old=>old.url===item.url))].slice(0,80));setGroupFilter('All');setMessage(`Imported ${added.length} suspended address tabs and merged bookmarks. No external pages were automatically loaded.`)
    }catch(error){setMessage(error.message)}
  }
  return <section className={`phone-browser-workspace${focus?' is-focus':''}`} aria-label="Phone browsing workspace" onKeyDown={keydown}><div className="phone-browser-chrome">
    <div className="phone-browser-tabs" role="tablist" aria-label="Phone website tabs">{tabs.filter(tab=>groupFilter==='All'||tab.group===groupFilter).map(tab=><div key={tab.id} className={tab.id===active.id?'is-active':''}><button type="button" role="tab" id={`phone-browser-tab-${tab.id}`} aria-selected={tab.id===active.id} aria-controls={`phone-browser-page-${tab.id}`} onClick={()=>activate(tab.id)} title={tab.history[tab.index]||'New tab'}>{tab.label||(tab.history[tab.index]?new URL(tab.history[tab.index]).hostname:'New tab')}</button><button type="button" onClick={()=>closeTab(tab.id)} aria-label="Close website tab"><X size={11}/></button></div>)}<button type="button" onClick={newTab} disabled={tabs.length>=8} aria-label="New website tab"><Plus size={14}/></button></div>
    <div className="phone-browser-navigation"><button type="button" disabled={native? !active.nativeCanGoBack:active.index<=0} onClick={()=>history(-1)} title="Previous page" aria-label="Previous page"><ArrowLeft size={14}/></button><button type="button" disabled={native? !active.nativeCanGoForward:active.index>=active.history.length-1} onClick={()=>history(1)} title="Next page" aria-label="Next page"><ArrowRight size={14}/></button><button type="button" disabled={!url} onClick={reloadPage} aria-label="Reload requested page"><RotateCcw size={14}/></button><button type="button" disabled={!url} onClick={bookmark} aria-pressed={bookmarks.some(item=>item.url===url)} aria-label="Bookmark requested address"><Star size={14}/></button><button type="button" onClick={()=>setSettings(value=>!value)} aria-expanded={settings} aria-label="Browser controls"><Settings size={14}/></button><button type="button" onClick={()=>{setFocus(value=>!value);onExpand?.()}} aria-pressed={focus} aria-label={focus?'Restore phone size':'Expand phone for browsing'}><Maximize2 size={14}/></button></div>
    <div className="phone-browser-groups"><label>Group<select value={groupFilter} onChange={event=>{const value=event.target.value;setGroupFilter(value);if(value!=='All'){const first=tabs.find(tab=>tab.group===value);if(first)activate(first.id)}}}><option value="All">All tabs</option>{[...new Set(tabs.map(tab=>tab.group))].map(group=><option key={group}>{group}</option>)}</select></label><button type="button" aria-expanded={sessionOpen} onClick={()=>setSessionOpen(value=>!value)}>Sessions ({sessions.length})</button><button type="button" onClick={inspect} disabled={native||!url||checking}>{checking?'Inspecting…':'Check embedding'}</button></div>
    {diagnostic&&<div className="phone-browser-diagnostics" role="status"><strong>{diagnostic.assessment==='blocked'?'Frame policy blocks embedding':diagnostic.assessment==='policy_present'?'Frame policy found':'Compatibility is unconfirmed'}</strong><p>{diagnostic.message}</p><dl>{[['HTTP status',diagnostic.status],['Final URL',diagnostic.url],['X-Frame-Options',diagnostic.xFrameOptions],['Frame ancestors',diagnostic.frameAncestors],['Navigation time',active.loadMs!=null?`${active.loadMs} ms (load event only)`:null],['Embed adapter',url&&active.adapter?embedTarget(url).adapter:null]].filter(([,value])=>value!==undefined&&value!==null&&value!=='').map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div><button type="button" onClick={()=>update(active.id,{mode:'reader'})}>Try Reader</button><button type="button" onClick={()=>openExternal(url,true)}>Use full browser</button><button type="button" onClick={()=>setDiagnostic(null)}>Dismiss</button></div></div>}
    {sessionOpen&&<section className="phone-browser-sessions" aria-label="Saved browser sessions"><form onSubmit={event=>{event.preventDefault();saveSession()}}><input aria-label="Session name" value={sessionName} maxLength={60} onChange={event=>setSessionName(event.target.value)} placeholder="Research / course session"/><button type="submit" disabled={!sessionName.trim()}>Save session</button></form>{sessions.map(item=><div key={item.id}><span>{item.title} · {item.tabs.length} tabs</span><button type="button" onClick={()=>restoreSession(item)}>Restore addresses</button><button type="button" onClick={()=>setSessions(previous=>previous.filter(value=>value.id!==item.id))} aria-label={`Remove saved session ${item.title}`}>×</button></div>)}<div><button type="button" onClick={exportSession}>Export browser archive</button><button type="button" onClick={()=>importInput.current?.click()}>Import addresses & bookmarks</button><input hidden type="file" accept=".json,application/json" ref={importInput} onChange={event=>{importSession(event.target.files[0]);event.target.value=''}}/></div><small>Profiles store addresses/settings only. Restoring adds suspended tabs without replacing your current live pages. Import merges tabs and bookmarks; sessions are not imported.</small></section>}
    <form className="phone-browser-address" onSubmit={event=>{event.preventDefault();navigate(address)}}><input ref={field} aria-label="Website address or search" value={address} onChange={event=>setAddress(event.target.value)} placeholder={active.mode==='reader'?'Search references or enter URL':'Website address or Google search'} maxLength={2000}/><button type="submit" disabled={!address.trim()}>Go</button></form>
    <div className="phone-browser-mode"><select aria-label="Website browsing mode" value={active.mode} onChange={event=>update(active.id,{mode:event.target.value})}><option value="embedded">{phoneDesktop?'Website inside phone':'Embedded website'}</option><option value="reader">Markdown & math reader</option><option value="window">Real browser window</option><option value="browser">Real browser tab</option></select><button type="button" aria-pressed={notesOpen} onClick={()=>setNotesOpen(value=>!value)}>Notes</button><button type="button" onClick={()=>setShowBookmarks(value=>!value)} aria-expanded={showBookmarks}>Bookmarks ({bookmarks.length})</button></div>
    {settings&&<div className="phone-browser-settings">{phoneDesktop&&<p>Desktop websites use the actual phone width and persistent account cookies. Frame compatibility, referrer, media and storage request settings below apply only in the web version. Device permissions, downloads and separate pop-up windows are disabled in desktop browsing.</p>}<label>Tab name<input value={active.label} maxLength={40} onChange={event=>update(active.id,{label:event.target.value})} placeholder="Optional label"/></label><label>Tab group<input value={active.group} maxLength={32} onChange={event=>{setGroupFilter('All');update(active.id,{group:event.target.value||'General'})}}/></label><label>Compatibility profile<select value={active.profile} onChange={event=>{update(active.id,{profile:event.target.value,reload:active.reload+1});setMessage('Compatibility profile changed; active page reloaded. Website form state may reset.')}}><option value="standard">Standard · forms, downloads, pop-ups</option><option value="restricted">Restricted · no pop-ups/downloads</option></select></label><label>Referrer<select value={active.referrer} onChange={event=>update(active.id,{referrer:event.target.value,reload:active.reload+1})}><option value="strict-origin-when-cross-origin">Send app origin for compatibility</option><option value="no-referrer">Send no referrer</option></select></label><label><input type="checkbox" checked={active.adapter} onChange={event=>update(active.id,{adapter:event.target.checked,reload:active.reload+1})}/>Use official embed players for supported video URLs</label><label>Page width<select disabled={native} value={active.viewport} onChange={event=>update(active.id,{viewport:Number(event.target.value)})}><option value={0}>Automatic / phone</option><option value={390}>390 px · Mobile</option><option value={768}>768 px · Tablet</option><option value={1280}>1280 px · Desktop layout</option></select></label><label>Zoom<select value={active.zoom} onChange={event=>update(active.id,{zoom:Number(event.target.value)})}>{[50,75,90,100,110,125,150,200].map(value=><option key={value} value={value}>{value}%</option>)}</select></label><label><input type="checkbox" checked={active.fit} onChange={event=>update(active.id,{fit:event.target.checked})}/>Fit fixed-width layout to phone</label><div><button type="button" disabled={!url} onClick={()=>update(active.id,{started:false,status:'stopped'})}>Suspend page</button><button type="button" onClick={()=>setConfirmSuspend(value=>!value)}>Suspend all pages</button><button type="button" disabled={!url} onClick={copyUrl}><Copy size={12}/>Copy address</button><button type="button" disabled={!url} onClick={()=>{const saved=onCaptureNote?.(`\n\n[Reference](${url})\n`);setMessage(saved===false?'Scratchpad is full. Make space before saving this reference.':'Reference link appended to your scratchpad.')}}>Save link to notes</button><button type="button" disabled={!closed.length||tabs.length>=8} onClick={()=>{const tab={...closed.at(-1),id:crypto.randomUUID()};setClosed(previous=>previous.slice(0,-1));setTabs(previous=>[...previous,tab]);setActiveId(tab.id);setGroupFilter('All');setAddress(tab.history[tab.index]||'')}}>Reopen closed tab</button></div><label><input type="checkbox" checked={active.media} onChange={event=>{update(active.id,{media:event.target.checked});setMessage('Camera/microphone availability updated. Reload the page to apply. Your browser still asks before granting device access.')}}/>Allow camera and microphone permission requests</label><label><input type="checkbox" checked={active.storage} onChange={event=>{update(active.id,{storage:event.target.checked,reload:active.reload+1});setMessage('Page reloaded. Eligible sites may request cookie storage access after you interact with them; browser approval and site support are still required.')}}/>Allow site-initiated storage access requests</label><small>Back/forward and bookmarks track addresses opened with these controls. Cross-origin links clicked inside websites cannot update this address bar. Desktop layout changes the viewport, not browser identity.</small></div>}
    {confirmSuspend&&<div className="phone-browser-confirm" role="alert"><p>Suspend every page? Addresses and bookmarks stay saved, but unsaved website form state will be lost and active page sessions will stop.</p><button type="button" onClick={()=>{setTabs(previous=>previous.map(tab=>({...tab,started:false,status:'stopped'})));setConfirmSuspend(false);setMessage('All pages suspended. Resume individual tabs when needed.')}}>Suspend all pages</button><button type="button" onClick={()=>setConfirmSuspend(false)}>Keep pages open</button></div>}
    {showBookmarks&&<div className="phone-browser-bookmarks">{bookmarks.map(item=><div key={item.url}><button type="button" onClick={()=>navigate(item.url)} title={item.url}>{item.title}</button><button type="button" onClick={()=>setBookmarks(previous=>previous.filter(value=>value.url!==item.url))} aria-label={`Remove bookmark ${item.title}`}><X size={12}/></button></div>)}{!bookmarks.length&&<p>Use the star to save the address shown above.</p>}</div>}
    </div>
    <div className="phone-browser-pages">{tabs.map(tab=><div key={tab.id} id={`phone-browser-page-${tab.id}`} role="tabpanel" aria-labelledby={`phone-browser-tab-${tab.id}`} hidden={tab.id!==active.id} className="phone-browser-page">
      {tab.mode==='embedded'&&phoneDesktop?<NativePhonePage userId={userId} tab={tab} visible={visible&&tab.id===active.id} onChange={changes=>update(tab.id,changes)}/>:tab.mode==='embedded'?<EmbeddedPage tab={tab} onChange={changes=>update(tab.id,changes)} onOpenBrowser={target=>openExternal(target,true)}/>:tab.mode==='reader'?(tab.history[tab.index]&&!tab.started?<div className="phone-browser-start"><strong>Resume saved reference</strong><button type="button" onClick={()=>update(tab.id,{started:true})}>Resume reader</button></div>:<ReaderPage url={tab.history[tab.index]||''} reload={tab.reload} token={token} onNavigate={target=>navigate(target,false)}/>):<div className="phone-browser-start"><strong>Use the full browser for this website</strong><p>Forms, authentication and interactive sites work best in their own browser window. The phone keeps your tabs and reference addresses here.</p>{tab.history[tab.index]&&<button type="button" onClick={()=>openExternal(tab.history[tab.index],tab.mode==='window')}>Open website</button>}</div>}
    </div>)}</div>
    {notesOpen&&<aside className="phone-browser-quick-notes" aria-label="Notes while browsing"><div><strong>Scratchpad alongside this page</strong><button type="button" onClick={()=>setNotesPreview(value=>!value)}>{notesPreview?'Write':'Preview Markdown & math'}</button><button type="button" onClick={()=>setNotesOpen(false)} aria-label="Hide browsing notes"><X size={12}/></button></div>{notesPreview?<AssistantMarkdown preserveSpacing content={note||'*Your notes appear here.*'}/>:<textarea aria-label="Scratchpad while browsing" maxLength={20000} value={note} placeholder="Take notes without leaving the website…" onChange={event=>onNoteChange?.(event.target.value)}/>}</aside>}
    {url&&<div className="phone-browser-status"><span>{native?(active.status==='error'?'Website could not load.':active.status==='loading'?'Loading website…':active.started?'Desktop browser · inside phone':'Saved website · resume to load.'):active.mode==='embedded'?(active.status==='loading'?'Navigation requested…':active.status==='blocked'?'Website refused framing; open it in the browser.':active.status==='error'?'Frame reported a loading error.':active.status==='slow'?'No load event after 15 seconds; compatibility unknown.':active.status==='stopped'?'Page suspended.':active.started?'Frame loaded; blocked content may still be blank.':'Saved address · resume to load.'):'Reference workspace'}</span><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={11}/>Open in browser</a></div>}
    {url&&active.mode==='embedded'&&!native&&<details className="phone-browser-recovery"><summary>Page blank or not responding?</summary><p>Reset the phone viewport to remove saved zoom/layout settings, or inspect the website policy. Browser restrictions and site sign-in cannot be bypassed here.</p><div><button type="button" onClick={()=>{update(active.id,{viewport:0,zoom:100,fit:true,profile:'standard',referrer:'strict-origin-when-cross-origin',adapter:true,forceFrame:false,embeddingBlock:null,started:true,reload:active.reload+1});setSettings(false);setSessionOpen(false);setShowBookmarks(false);setMessage('Reset the page view and reloaded the requested URL.')}}>Reset view & reload</button><button type="button" onClick={inspect} disabled={checking}>{checking?'Checking…':'Inspect website policy'}</button><button type="button" onClick={()=>update(active.id,{mode:'reader',started:true})}>Read page text</button><button type="button" onClick={()=>openExternal(url,true)}>Open full browser</button></div></details>}
    <details className="phone-browser-compatibility"><summary>Website compatibility & privacy</summary>{!phoneDesktop&&<p>To open sites such as Chess.com directly inside the phone, use the optional Assignment Tracker desktop app. Start the usual backend and frontend, then run npm install and npm start in the desktop folder. Its Website inside phone mode uses a native browser engine without opening another window.</p>}{phoneDesktop&&<p>Desktop mode uses a sandboxed browser view inside the phone, so framing restrictions do not apply. Some services can still restrict desktop clients or require unsupported sign-in flows. Website cookies persist separately for each account on this device; an account reset clears them. Remote pages cannot access the app’s desktop bridge. Alt+P hides the phone even while typing inside a website.</p>}<p>Sites control whether they allow embedding, third-party cookies, camera access and sign-in. This phone cannot bypass those restrictions. Embedded pages can use forms, pop-ups, downloads and clipboard writes when the browser permits them. Browser prompts remain under your control. Granted camera/microphone use can continue in a background tab; Suspend page or Suspend all pages unloads those sessions.</p><p>Switch tabs, apps, hide the phone or minimize without closing a live page. Closing a tab, disabling the phone, switching browsing modes, reloading the app or moving into native fullscreen may reload pages and lose unsaved website forms. Tabs, address history and bookmarks are saved on this device; restored pages wait for Resume before loading.</p></details>
    {message&&<p className="phone-browser-message" role="status">{message}</p>}
  </section>
})
