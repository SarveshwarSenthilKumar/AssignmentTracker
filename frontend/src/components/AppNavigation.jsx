import { featureVisible } from '../lib/featureVisibility'
import {useEffect,useId,useRef,useState} from 'react'
import {Home,Layers,CheckSquare,CalendarDays,FolderOpen,Briefcase,FileText,Mail,Sparkles,Network,RefreshCw,Keyboard,Settings,LogOut,ChevronDown,ArrowUpRight,Menu,X,Command,Search,Star,BarChart3,Bug,BookOpen,Users,Pin,Maximize,Minimize,Palette,Bookmark} from 'lucide-react'
import {canTogglePlatformFullscreen,togglePlatformFullscreen} from '../lib/platformFullscreen'
import {openPageFaviconPicker} from '../lib/pageFavicon'
import './AppNavigation.css'

const primary=[['home','Home',Home],['workspace','Workspace',Layers],['tasks','Tasks',CheckSquare],['calendar','Calendar',CalendarDays],['documents','Documents',FolderOpen]]
const career=[['prep','Prep',Briefcase,'Practice interviews and prepare application materials'],['resumes','Resumes',FileText,'Store and tailor your experience'],['cover-letters','Cover letters',Mail,'Write in your own voice'],['jobs','Saved jobs',Briefcase,'Keep opportunities in one place']]
const tools=[['bookmarks','Bookmarks',Bookmark,'Save platform pages and external links'],['detective-wall','Detective wall',Pin,'Pin notes and photos, then connect the threads'],['whiteboards','Team whiteboards',Users,'Brainstorm and draw together in real time'],['tutorial','Tutorial',BookOpen,'Learn every part of AssignmentTracker step by step'],['suggest-feature','Suggest a feature',Sparkles,'Propose improvements and track their progress'],['report-bug','Report a bug',Bug,'Send a section-specific issue report'],['roadmap','Site roadmap',Layers,'Suggestions, planned features and work in progress'],['analytics','Analytics',BarChart3,'Storage, counts, activity and task health'],['study','Question bank',Star,'Save questions, answers and study topics'],['assistant','AI assistant',Sparkles,'Think, write and work with your files'],['visualization','Visualization',Network,'Explore tasks and connections'],['canvas','Canvas',RefreshCw,'Manage your course integration'],['shortcuts','Keyboard shortcuts',Keyboard,'Move around a little faster']]
const pinnable = [...primary, ...career, ...tools]
export const navigationPages = pinnable.map(([id, label]) => [id, label])
export const defaultNavigationPins = primary.map(([id]) => id)
const routes = [...pinnable, ['account','Account',Settings]]

export default function AppNavigation({page,user,onSignOut,lockActions=[],hiddenFeatures}){
  const [open,setOpen]=useState(null),root=useRef(null),trigger=useRef(null),id=useId()
  const active=routes.find(item=>item[0]===page)||routes[0],ActiveIcon=active[2]
  const displayName=user?.name||user?.username||'Your account'
  const initial=displayName.trim().slice(0,1).toUpperCase()
  const tabColorButton=details=><button type="button" className={'an-link an-menu-button'+(details?' an-detail-link':'')}
    onClick={()=>{setOpen(null);trigger.current?.focus();openPageFaviconPicker()}}>
    <Palette size={16} aria-hidden="true"/><span><strong>Tab icon color</strong>{details&&<small>Customize this page’s browser tab</small>}</span>
  </button>
  const tutorialUntil = Date.parse(user?.createdAt) + 3 * 24 * 60 * 60 * 1000
  const [now, setNow] = useState(Date.now)
  const [fullscreen,setFullscreen]=useState(()=>Boolean(document.fullscreenElement))
  useEffect(()=>{
    const changed=()=>setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange',changed)
    return()=>document.removeEventListener('fullscreenchange',changed)
  },[])
  const FullscreenIcon=fullscreen?Minimize:Maximize
  const fullscreenButton=details=><button type="button" className={'an-link an-fullscreen'+(details?' an-detail-link':'')}
    disabled={!canTogglePlatformFullscreen()} title="Alt + Shift + F" onClick={()=>{
      togglePlatformFullscreen();setOpen(null);trigger.current?.focus()
    }}>
    <FullscreenIcon size={16} aria-hidden="true"/>
    <span><strong>{fullscreen?'Exit fullscreen':'Fullscreen'}</strong>{details&&<small>Alt + Shift + F</small>}</span>
  </button>
  const highlightTutorial = Number.isFinite(tutorialUntil) && now < tutorialUntil
  const available = route => featureVisible(hiddenFeatures, route)
  const pinIds = Array.isArray(user?.navigationPins) ? user.navigationPins : defaultNavigationPins
  const visiblePrimary = pinIds.flatMap(id => {
    const item = pinnable.find(([route]) => route === id)
    return item && available(id) ? [item] : []
  })
  const isUnpinned = ([route]) => available(route) && !pinIds.includes(route)
  const visibleCareer = career.filter(isUnpinned)
  const orderedTools = highlightTutorial ? tools : [...tools.filter(item=>item[0]!=='tutorial'), tools.find(item=>item[0]==='tutorial')]
  const visibleTools = [...primary, ...orderedTools].filter(isUnpinned)
  useEffect(()=>{
    if(!Number.isFinite(tutorialUntil)||tutorialUntil<=Date.now())return
    const timer=setTimeout(()=>setNow(Date.now()),Math.min(tutorialUntil-Date.now()+1,2147483647))
    return()=>clearTimeout(timer)
  },[tutorialUntil,now])
  useEffect(()=>{setOpen(null)},[page])
  useEffect(()=>{
    if(!open)return
    const outside=event=>{if(!root.current?.contains(event.target))setOpen(null)}
    const resize=()=>setOpen(null)
    document.addEventListener('pointerdown',outside);window.addEventListener('resize',resize)
    return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',resize)}
  },[open])
  const toggle=(name,event)=>{trigger.current=event.currentTarget;setOpen(previous=>previous===name?null:name)}
  const focusPanel=()=>requestAnimationFrame(()=>root.current?.querySelector('[data-nav-panel] a,[data-nav-panel] button')?.focus())
  const newTabs = new Set(user?.navigationNewTabs || [])
  const link=(item,details=false)=>{
    const [key,label,Icon,description]=item
    const href = '#/' + key + (['report-bug','suggest-feature'].includes(key) ? '/' + encodeURIComponent(page) : '')
    const pageLink = <a className={'an-link' + (details ? ' an-detail-link' : '')} href={href}
      data-new-tutorial={key === 'tutorial' && highlightTutorial ? 'true' : undefined}
      key={key} aria-current={page===key?'page':undefined} onClick={()=>setOpen(null)}>
      <Icon size={16}/><span><strong>{label}</strong>{details&&description&&<small>{description}</small>}</span>
      {details&&!newTabs.has(key)&&<ArrowUpRight size={13} className="an-link-arrow"/>}
    </a>
    if (!newTabs.has(key)) return pageLink
    const newTabLabel = 'Open ' + label + ' in a new tab'
    return <div className="an-page-links" key={key}>
      {pageLink}
      <a className="an-new-tab" href={href} target="_blank" rel="noopener noreferrer"
        title={newTabLabel} aria-label={newTabLabel} onClick={()=>setOpen(null)}>
        <ArrowUpRight size={15} aria-hidden="true"/>
      </a>
    </div>
  }
  const group=(name,label,Icon,items)=>{
    const selected=items.some(item=>item[0]===page)
    return <div className="an-group"><button type="button" className={`an-group-trigger${selected?' is-current':''}${open===name?' is-open':''}`} aria-label={selected?`${label}, current page: ${active[1]}`:label} aria-expanded={open===name} aria-controls={open===name?`${id}-${name}`:undefined} onClick={event=>toggle(name,event)} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();trigger.current=event.currentTarget;setOpen(name);focusPanel()}}}><Icon size={15}/><span>{label}</span>{selected&&<i aria-hidden/>}<ChevronDown size={12}/></button>{open===name&&<div data-nav-panel id={`${id}-${name}`} className="an-panel" aria-label={`${label} navigation`}><p className="an-panel-label">{label}</p>{name==='tools'&&<>{fullscreenButton(true)}{tabColorButton(true)}</>}{items.map(item=>link(item,true))}</div>}</div>
  }
  return <header ref={root} className="platform-header app-navigation" onBlur={event=>{if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget))setOpen(null)}} onKeyDown={event=>{
    if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();setOpen(null);trigger.current?.focus();return}
    const panel=event.target.closest('[data-nav-panel]')
    if(!panel||!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return
    const links=[...panel.querySelectorAll('a,button:not(:disabled)')],index=links.indexOf(document.activeElement)
    if(!links.length)return
    event.preventDefault();links[event.key==='Home'?0:event.key==='End'?links.length-1:event.key==='ArrowDown'?(index+1)%links.length:(index-1+links.length)%links.length]?.focus()
  }}>
    <a className="an-brand" href={available('home') ? '#/home' : '#/account'} aria-label="Assignment Tracker" onClick={()=>setOpen(null)}><span className="an-brand-mark"><Layers size={20}/></span><span className="an-brand-copy"><strong>Assignment<span>Tracker</span></strong><small>YOUR PERSONAL WORKSPACE</small></span></a>
    <span className="an-divider" aria-hidden/>
    <nav className="an-desktop" aria-label="Main navigation">{visiblePrimary.map(item=>link(item))}</nav>
    <div className="an-desktop-groups">{visibleCareer.length > 0 && group('career','Career',Briefcase,visibleCareer)}{group('tools','Tools',Command,visibleTools)}</div>
    <span className="an-mobile-current"><ActiveIcon size={15}/>{active[1]}</span>
    {available('global-search') && <button type="button" className="an-global-search" onClick={()=>{setOpen(null);window.dispatchEvent(new Event('global-search-open'))}} aria-label="Search the entire platform (Ctrl or Cmd K)"><Search size={16}/><span>Search</span><kbd>⌘ / Ctrl K</kbd></button>}
    <div className="an-account"><button className={`an-avatar-trigger${open==='account'?' is-open':''}`} type="button" aria-label={`Account menu for ${displayName}`} aria-expanded={open==='account'} aria-controls={open==='account'?`${id}-account`:undefined} onClick={event=>toggle('account',event)} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();trigger.current=event.currentTarget;setOpen('account');focusPanel()}}}><span className="an-avatar">{initial}</span><span className="an-account-name">{displayName}</span><ChevronDown size={12}/></button>{open==='account'&&<div data-nav-panel id={`${id}-account`} className="an-panel an-account-panel" aria-label="Account actions"><div className="an-user"><strong>{displayName}</strong><span>Manage your workspace</span></div>{link(['account','Account settings',Settings],true)}{lockActions.length > 0 && <><div className="an-panel-divider"/>{lockActions.map(({label,icon:Icon,onClick})=><button key={label} type="button" className="an-account-action" onClick={()=>{setOpen(null);onClick()}}><Icon size={16} aria-hidden="true"/>{label}</button>)}</>}<div className="an-panel-divider"/><button type="button" className="an-signout" onClick={()=>{setOpen(null);onSignOut()}}><LogOut size={16}/>Sign out</button></div>}</div>
    <button type="button" className="an-mobile-toggle" aria-label={open==='mobile'?'Close navigation':'Open navigation'} aria-expanded={open==='mobile'} aria-controls={open==='mobile'?`${id}-mobile`:undefined} onClick={event=>toggle('mobile',event)}>{open==='mobile'?<X size={19}/>:<Menu size={19}/>}</button>
    {open==='mobile'&&<div data-nav-panel id={`${id}-mobile`} className="an-mobile-panel" aria-label="All navigation"><nav className="an-section" aria-label="Pinned pages"><p className="an-panel-label">Pinned pages</p>{visiblePrimary.map(item=>link(item))}</nav><nav className="an-section" aria-label="Career pages"><p className="an-panel-label">Career</p>{visibleCareer.map(item=>link(item))}</nav><nav className="an-section" aria-label="Tools and settings"><p className="an-panel-label">Tools & settings</p>{fullscreenButton(false)}{tabColorButton(false)}{visibleTools.map(item=>link(item))}{link(['account','Account settings',Settings])}</nav></div>}
  </header>
}

