import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import PublicDocumentEditor from './components/PublicDocumentEditor'
import PublicTaskFolder from './components/PublicTaskFolder'
import FaviconColorDialog from './components/FaviconColorDialog'
import { installOfflineWorkspace } from './lib/offlineWorkspace'
import { SHORTCUTS, matchesShortcut } from './lib/shortcuts'
import { OPEN_PAGE_FAVICON_PICKER, defaultPageFaviconColor, readFaviconMode, readPageFaviconColor, savePageFaviconColor, subscribeToFaviconPreferences, updatePageFavicon } from './lib/pageFavicon'
import { canTogglePlatformFullscreen, togglePlatformFullscreen } from './lib/platformFullscreen'
import './index.css'
import './responsive.css'
import { AuthProvider, GuestAuthProvider } from './contexts/AuthContext'
import './mobile.css'
import './light-mode.css'
import './checkboxes.css'

const fullscreenShortcut=SHORTCUTS.find(shortcut=>shortcut.id==='platform-fullscreen')

// This shortcut is intentionally kept out of navigation and the shortcuts list.
const faviconColorShortcut={key:'f',mod:true,alt:true,shift:true}

function Root() {
  const [faviconPage,setFaviconPage]=React.useState(null)
  const [colorEditor,setColorEditor]=React.useState(null)
  const hash=React.useSyncExternalStore(subscribeToHash,readHash)
  const publicPage=hash.startsWith('#/shared-document/')||hash.startsWith('#/shared-task-folder/')
  const route=publicPage?hash:faviconPage??hash
  const currentRoute=React.useRef(route)
  currentRoute.current=route
  const faviconMode=React.useSyncExternalStore(subscribeToFaviconPreferences,readFaviconMode)
  const faviconColor=React.useSyncExternalStore(subscribeToFaviconPreferences,()=>readPageFaviconColor(route))
  React.useEffect(()=>updatePageFavicon(route,faviconMode,faviconColor),[route,faviconMode,faviconColor])
  React.useEffect(()=>{setColorEditor(previous=>previous===route?previous:null)},[route])
  React.useLayoutEffect(()=>{
    const openColorEditor=()=>setColorEditor(currentRoute.current)
    const handleFullscreen=event=>{
      if(event.isComposing)return
      if(event.key==='Escape'){
        const picker=document.querySelector('[data-favicon-color-dialog][open]')
        if(picker){
          event.preventDefault()
          event.stopImmediatePropagation()
          picker.close()
          return
        }
      }
      if(matchesShortcut(event,faviconColorShortcut)){
        event.preventDefault()
        event.stopImmediatePropagation()
        if(!event.repeat)openColorEditor()
        return
      }
      if(!matchesShortcut(event,fullscreenShortcut))return
      if(!canTogglePlatformFullscreen())return
      event.preventDefault()
      event.stopImmediatePropagation()
      if(event.repeat)return
      togglePlatformFullscreen()
    }
    window.addEventListener('keydown',handleFullscreen,true)
    window.addEventListener(OPEN_PAGE_FAVICON_PICKER,openColorEditor)
    return()=>{
      window.removeEventListener('keydown',handleFullscreen,true)
      window.removeEventListener(OPEN_PAGE_FAVICON_PICKER,openColorEditor)
    }
  },[])

  const shareToken = /^#\/shared-document\/([A-Za-z0-9_-]{43})$/.exec(hash)?.[1]
  let content
  if(shareToken||hash.startsWith('#/shared-document/')){
    content=<GuestAuthProvider><PublicDocumentEditor key={shareToken||hash} shareToken={shareToken||''}/></GuestAuthProvider>
  }else if(hash.startsWith('#/shared-task-folder/')){
    const folderToken=/^#\/shared-task-folder\/([A-Za-z0-9_-]{43})$/.exec(hash)?.[1]
    content=<PublicTaskFolder key={hash} token={folderToken}/>
  }else{
    content=<AuthProvider><App onFaviconPage={setFaviconPage}/></AuthProvider>
  }
  return <>
    {content}
    {colorEditor===route&&<FaviconColorDialog key={route} page={route} color={faviconColor} defaultColor={defaultPageFaviconColor(route)} mode={faviconMode}
      onSave={color=>savePageFaviconColor(route,color)} onClose={()=>setColorEditor(null)}/>}
  </>
}

const readHash=()=>window.location.hash

function subscribeToHash(callback) {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}

installOfflineWorkspace()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
