import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, RotateCcw, X, Plus, Star, ExternalLink, Settings, Maximize2, Copy } from 'lucide-react'
import AssistantMarkdown from './AssistantMarkdown'
import { referenceMarkdown } from '../lib/referenceMarkdown'
import './PhoneBrowser.css'

const blankTab=()=>({id:crypto.randomUUID(),history:[],index:-1,mode:'embedded',zoom:100,viewport:0,fit:true,media:false,started:false,reload:0,status:'idle'})
function webAddress(value,reader=false){
  const text=value.trim(),explicit=/^[a-z][a-z\d+.-]*:/i.test(text),address=/^[^\s/?#]+\.[^\s/?#]+(?:[/?#]|$)/.test(text)
  const url=new URL(explicit?text:address?`https://${text}`:reader?`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(text)}`:`https://www.google.com/search?q=${encodeURIComponent(text)}`)
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.origin===location.origin||url.href.length>2000)throw new Error('Enter an external http/https address or a search phrase.')
  return url.href
}
function savedState(key){
  try{
    const data=JSON.parse(localStorage.getItem(key)||'{}')
    const tabs=(Array.isArray(data.tabs)?data.tabs:[]).slice(0,8).map(value=>{
      const history=(Array.isArray(value.history)?value.history:[]).filter(url=>{try{return webAddress(url)===url}catch{return false}}).slice(-30)
      return {...blankTab(),history,index:history.length?Math.max(0,Math.min(history.length-1,Number.isInteger(value.index)?value.index:history.length-1)):-1,mode:['embedded','reader','window','browser'].includes(value.mode)?value.mode:'embedded',zoom:[50,75,90,100,110,125,150,200].includes(value.zoom)?value.zoom:100,viewport:[0,390,768,1280].includes(value.viewport)?value.viewport:0,fit:value.fit!==false,media:value.media===true}
    })
    const bookmarks=(Array.isArray(data.bookmarks)?data.bookmarks:[]).filter(item=>{try{return typeof item.title==='string'&&webAddress(item.url)===item.url}catch{return false}}).slice(0,80).map(item=>({url:item.url,title:item.title.slice(0,120)}))
    return {tabs:tabs.length?tabs:[blankTab()],bookmarks}
  }catch{return {tabs:[blankTab()],bookmarks:[]}}
}
function EmbeddedPage({tab,onChange}){
  const host=useRef(null),[size,setSize]=useState({width:300,height:400})
  const url=tab.history[tab.index]
  useLayoutEffect(()=>{
    const measure=()=>{if(host.current?.clientWidth&&host.current?.clientHeight)setSize({width:host.current.clientWidth,height:host.current.clientHeight})}
    measure();const observer=new ResizeObserver(measure);if(host.current)observer.observe(host.current);return()=>observer.disconnect()
  },[])
  const width=tab.viewport||size.width,scale=(tab.zoom/100)*(tab.viewport&&tab.fit?Math.min(1,size.width/width):1),height=Math.max(180,size.height/scale)
  return <div className="phone-browser-frame" ref={host}>
    {url&&tab.started?<div className="phone-browser-frame-size" style={{width:width*scale,height:height*scale}}><iframe key={`${tab.id}:${tab.index}:${tab.reload}`} src={url} title={`Embedded website: ${new URL(url).hostname}`} style={{width,height,transform:`scale(${scale})`}} sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals" allow={tab.media?'clipboard-write; camera *; microphone *':'clipboard-write'} referrerPolicy="no-referrer" onLoad={()=>onChange({status:'loaded'})} onError={()=>onChange({status:'error'})}/></div>:<div className="phone-browser-start"><strong>{url?'Resume this page':'Start browsing'}</strong><p>{url?'Saved tabs restore addresses, not unsaved website form data. Pages load only when you resume them.':'Enter an address above. Compatible websites open directly inside the phone.'}</p>{url&&<button type="button" onClick={()=>onChange({started:true,status:'loading',reload:tab.reload+1})}>Resume page</button>}</div>}
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

export default function PhoneBrowser({userId,token,onExpand,onCaptureNote,note='',onNoteChange}){
  const storageKey=`study-phone-browser:${userId}`,[initial]=useState(()=>savedState(storageKey))
  const [tabs,setTabs]=useState(initial.tabs),[activeId,setActiveId]=useState(initial.tabs[0].id),[bookmarks,setBookmarks]=useState(initial.bookmarks),[address,setAddress]=useState(initial.tabs[0].history[initial.tabs[0].index]||''),[settings,setSettings]=useState(false),[showBookmarks,setShowBookmarks]=useState(false),[message,setMessage]=useState(''),[focus,setFocus]=useState(false),[closed,setClosed]=useState([])
  const field=useRef(null),discard=useRef(false),tabsRef=useRef(tabs);tabsRef.current=tabs
  const [notesOpen,setNotesOpen]=useState(false),[notesPreview,setNotesPreview]=useState(false),[confirmSuspend,setConfirmSuspend]=useState(false)
  const active=tabs.find(tab=>tab.id===activeId)||tabs[0],url=active.history[active.index]||''
  const update=(id,changes)=>setTabs(previous=>previous.map(tab=>tab.id===id?{...tab,...(typeof changes==='function'?changes(tab):changes)}:tab))
  useEffect(()=>{
    if(discard.current)return
    try{localStorage.setItem(storageKey,JSON.stringify({bookmarks,tabs:tabs.map(({history,index,mode,zoom,viewport,fit,media})=>({history,index,mode,zoom,viewport,fit,media}))}))}catch{setMessage('Browser storage is unavailable. Tabs and bookmarks will only last this session.')}
  },[tabs,bookmarks,storageKey])
  useEffect(()=>{const reset=event=>{if(event.detail!==userId)return;discard.current=true;try{localStorage.removeItem(storageKey)}catch{}};window.addEventListener('workspace-reset',reset);return()=>window.removeEventListener('workspace-reset',reset)},[userId])
  const activate=id=>{const tab=tabsRef.current.find(item=>item.id===id);if(!tab)return;setActiveId(id);setAddress(tab.history[tab.index]||'');setMessage('')}
  const newTab=()=>{if(tabs.length>=8){setMessage('Up to eight browsing tabs can remain open. Close one first.');return}const tab=blankTab();setTabs(previous=>[...previous,tab]);setActiveId(tab.id);setAddress('');setMessage('');field.current?.focus()}
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
      update(active.id,tab=>({history:[...tab.history.slice(0,tab.index+1),target].slice(-30),index:Math.min(tab.index+1,29),started:true,reload:tab.reload+1,status:'loading'}));setAddress(target);setMessage('')
      if(external&&['window','browser'].includes(active.mode))openExternal(target,active.mode==='window')
    }catch(error){setMessage(error.message)}
  }
  const history=offset=>{const index=active.index+offset;if(index<0||index>=active.history.length)return;update(active.id,{index,started:true,status:'loading'});setAddress(active.history[index])}
  const bookmark=()=>{if(!url)return;const parsed=new URL(url);setBookmarks(previous=>previous.some(item=>item.url===url)?previous.filter(item=>item.url!==url):[{url,title:(parsed.hostname+(parsed.pathname==='/'?'':parsed.pathname)).slice(0,120)},...previous].slice(0,80))}
  const copyUrl=async()=>{try{await navigator.clipboard.writeText(url);setMessage('Requested page address copied.')}catch{setMessage('Copy the address directly from the address field.')}}
  const keydown=event=>{
    if(!(event.ctrlKey||event.metaKey)||event.altKey)return
    if(event.key.toLowerCase()==='l'){event.preventDefault();field.current?.focus();field.current?.select()}
    if(event.key.toLowerCase()==='t'&&!event.shiftKey){event.preventDefault();newTab()}
  }
  return <section className={`phone-browser-workspace${focus?' is-focus':''}`} aria-label="Phone browsing workspace" onKeyDown={keydown}>
    <div className="phone-browser-tabs" role="tablist" aria-label="Phone website tabs">{tabs.map(tab=><div key={tab.id} className={tab.id===active.id?'is-active':''}><button type="button" role="tab" id={`phone-browser-tab-${tab.id}`} aria-selected={tab.id===active.id} aria-controls={`phone-browser-page-${tab.id}`} onClick={()=>activate(tab.id)} title={tab.history[tab.index]||'New tab'}>{tab.history[tab.index]?new URL(tab.history[tab.index]).hostname:'New tab'}</button><button type="button" onClick={()=>closeTab(tab.id)} aria-label="Close website tab"><X size={11}/></button></div>)}<button type="button" onClick={newTab} disabled={tabs.length>=8} aria-label="New website tab"><Plus size={14}/></button></div>
    <div className="phone-browser-navigation"><button type="button" disabled={active.index<=0} onClick={()=>history(-1)} title="Previous address opened from this phone" aria-label="Previous entered address"><ArrowLeft size={14}/></button><button type="button" disabled={active.index>=active.history.length-1} onClick={()=>history(1)} title="Next address opened from this phone" aria-label="Next entered address"><ArrowRight size={14}/></button><button type="button" disabled={!url} onClick={()=>update(active.id,{started:true,reload:active.reload+1,status:'loading'})} aria-label="Reload requested page"><RotateCcw size={14}/></button><button type="button" disabled={!url} onClick={bookmark} aria-pressed={bookmarks.some(item=>item.url===url)} aria-label="Bookmark requested address"><Star size={14}/></button><button type="button" onClick={()=>setSettings(value=>!value)} aria-expanded={settings} aria-label="Browser controls"><Settings size={14}/></button><button type="button" onClick={()=>{setFocus(value=>!value);onExpand?.()}} aria-pressed={focus} aria-label={focus?'Restore phone size':'Expand phone for browsing'}><Maximize2 size={14}/></button></div>
    <form className="phone-browser-address" onSubmit={event=>{event.preventDefault();navigate(address)}}><input ref={field} aria-label="Website address or search" value={address} onChange={event=>setAddress(event.target.value)} placeholder={active.mode==='reader'?'Search references or enter URL':'Website address or Google search'} maxLength={2000}/><button type="submit" disabled={!address.trim()}>Go</button></form>
    <div className="phone-browser-mode"><select aria-label="Website browsing mode" value={active.mode} onChange={event=>update(active.id,{mode:event.target.value})}><option value="embedded">Embedded website</option><option value="reader">Markdown & math reader</option><option value="window">Real browser window</option><option value="browser">Real browser tab</option></select><button type="button" aria-pressed={notesOpen} onClick={()=>setNotesOpen(value=>!value)}>Notes</button><button type="button" onClick={()=>setShowBookmarks(value=>!value)} aria-expanded={showBookmarks}>Bookmarks ({bookmarks.length})</button></div>
    {settings&&<div className="phone-browser-settings"><label>Page width<select value={active.viewport} onChange={event=>update(active.id,{viewport:Number(event.target.value)})}><option value={0}>Automatic / phone</option><option value={390}>390 px · Mobile</option><option value={768}>768 px · Tablet</option><option value={1280}>1280 px · Desktop layout</option></select></label><label>Zoom<select value={active.zoom} onChange={event=>update(active.id,{zoom:Number(event.target.value)})}>{[50,75,90,100,110,125,150,200].map(value=><option key={value} value={value}>{value}%</option>)}</select></label><label><input type="checkbox" checked={active.fit} onChange={event=>update(active.id,{fit:event.target.checked})}/>Fit fixed-width layout to phone</label><div><button type="button" disabled={!url} onClick={()=>update(active.id,{started:false,status:'stopped'})}>Suspend page</button><button type="button" onClick={()=>setConfirmSuspend(value=>!value)}>Suspend all pages</button><button type="button" disabled={!url} onClick={copyUrl}><Copy size={12}/>Copy address</button><button type="button" disabled={!url} onClick={()=>{const saved=onCaptureNote?.(`\n\n[Reference](${url})\n`);setMessage(saved===false?'Scratchpad is full. Make space before saving this reference.':'Reference link appended to your scratchpad.')}}>Save link to notes</button><button type="button" disabled={!closed.length||tabs.length>=8} onClick={()=>{const tab={...closed.at(-1),id:crypto.randomUUID()};setClosed(previous=>previous.slice(0,-1));setTabs(previous=>[...previous,tab]);setActiveId(tab.id);setAddress(tab.history[tab.index]||'')}}>Reopen closed tab</button></div><label><input type="checkbox" checked={active.media} onChange={event=>{update(active.id,{media:event.target.checked});setMessage('Camera/microphone availability updated. Reload the page to apply. Your browser still asks before granting device access.')}}/>Allow camera and microphone permission requests</label><small>Back/forward and bookmarks track addresses opened with these controls. Cross-origin links clicked inside websites cannot update this address bar. Desktop layout changes the viewport, not browser identity.</small></div>}
    {confirmSuspend&&<div className="phone-browser-confirm" role="alert"><p>Suspend every page? Addresses and bookmarks stay saved, but unsaved website form state will be lost and active page sessions will stop.</p><button type="button" onClick={()=>{setTabs(previous=>previous.map(tab=>({...tab,started:false,status:'stopped'})));setConfirmSuspend(false);setMessage('All pages suspended. Resume individual tabs when needed.')}}>Suspend all pages</button><button type="button" onClick={()=>setConfirmSuspend(false)}>Keep pages open</button></div>}
    {showBookmarks&&<div className="phone-browser-bookmarks">{bookmarks.map(item=><div key={item.url}><button type="button" onClick={()=>navigate(item.url)} title={item.url}>{item.title}</button><button type="button" onClick={()=>setBookmarks(previous=>previous.filter(value=>value.url!==item.url))} aria-label={`Remove bookmark ${item.title}`}><X size={12}/></button></div>)}{!bookmarks.length&&<p>Use the star to save the address shown above.</p>}</div>}
    <div className="phone-browser-pages">{tabs.map(tab=><div key={tab.id} id={`phone-browser-page-${tab.id}`} role="tabpanel" aria-labelledby={`phone-browser-tab-${tab.id}`} hidden={tab.id!==active.id} className="phone-browser-page">
      {tab.mode==='embedded'?<EmbeddedPage tab={tab} onChange={changes=>update(tab.id,changes)}/>:tab.mode==='reader'?(tab.history[tab.index]&&!tab.started?<div className="phone-browser-start"><strong>Resume saved reference</strong><button type="button" onClick={()=>update(tab.id,{started:true})}>Resume reader</button></div>:<ReaderPage url={tab.history[tab.index]||''} reload={tab.reload} token={token} onNavigate={target=>navigate(target,false)}/>):<div className="phone-browser-start"><strong>Use the full browser for this website</strong><p>Forms, authentication and interactive sites work best in their own browser window. The phone keeps your tabs and reference addresses here.</p>{tab.history[tab.index]&&<button type="button" onClick={()=>openExternal(tab.history[tab.index],tab.mode==='window')}>Open website</button>}</div>}
    </div>)}</div>
    {notesOpen&&<aside className="phone-browser-quick-notes" aria-label="Notes while browsing"><div><strong>Scratchpad alongside this page</strong><button type="button" onClick={()=>setNotesPreview(value=>!value)}>{notesPreview?'Write':'Preview Markdown & math'}</button><button type="button" onClick={()=>setNotesOpen(false)} aria-label="Hide browsing notes"><X size={12}/></button></div>{notesPreview?<AssistantMarkdown preserveSpacing content={note||'*Your notes appear here.*'}/>:<textarea aria-label="Scratchpad while browsing" maxLength={20000} value={note} placeholder="Take notes without leaving the website…" onChange={event=>onNoteChange?.(event.target.value)}/>}</aside>}
    {url&&<div className="phone-browser-status"><span>{active.mode==='embedded'?(active.status==='loading'?'Navigation requested…':active.status==='error'?'Frame reported a loading error.':active.status==='stopped'?'Page suspended.':active.started?'Frame loaded; blocked content may still be blank.':'Saved address · resume to load.'):'Reference workspace'}</span><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={11}/>Open in browser</a></div>}
    <details className="phone-browser-compatibility"><summary>Website compatibility & privacy</summary><p>Sites control whether they allow embedding, third-party cookies, camera access and sign-in. This phone cannot bypass those restrictions. Embedded pages can use forms, pop-ups, downloads and clipboard writes when the browser permits them. Browser prompts remain under your control. Granted camera/microphone use can continue in a background tab; Suspend page or Suspend all pages unloads those sessions.</p><p>Switch tabs, apps, hide the phone or minimize without closing a live page. Closing a tab, disabling the phone, switching browsing modes, reloading the app or moving into native fullscreen may reload pages and lose unsaved website forms. Tabs, address history and bookmarks are saved on this device; restored pages wait for Resume before loading.</p></details>
    {message&&<p className="phone-browser-message" role="status">{message}</p>}
  </section>
}
