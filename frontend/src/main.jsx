import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import PublicDocumentEditor from './components/PublicDocumentEditor'
import { installOfflineWorkspace } from './lib/offlineWorkspace'
import { SHORTCUTS, matchesShortcut } from './lib/shortcuts'
import { canTogglePlatformFullscreen, togglePlatformFullscreen } from './lib/platformFullscreen'
import './index.css'
import './responsive.css'
import { AuthProvider, GuestAuthProvider } from './contexts/AuthContext'
import './mobile.css'
import './light-mode.css'
import './checkboxes.css'

const fullscreenShortcut=SHORTCUTS.find(shortcut=>shortcut.id==='platform-fullscreen')

function Root() {
  React.useLayoutEffect(()=>{
    const handleFullscreen=event=>{
      if(event.isComposing||!matchesShortcut(event,fullscreenShortcut))return
      if(!canTogglePlatformFullscreen())return
      event.preventDefault()
      event.stopImmediatePropagation()
      if(event.repeat)return
      togglePlatformFullscreen()
    }
    window.addEventListener('keydown',handleFullscreen,true)
    return()=>window.removeEventListener('keydown',handleFullscreen,true)
  },[])
  const readHash = () => window.location.hash
  const hash = React.useSyncExternalStore(subscribeToHash, readHash)
  const shareToken = /^#\/shared-document\/([A-Za-z0-9_-]{43})$/.exec(hash)?.[1]
  if (shareToken||hash.startsWith('#/shared-document/')) return <GuestAuthProvider><PublicDocumentEditor key={shareToken||hash} shareToken={shareToken||''}/></GuestAuthProvider>
  return <AuthProvider><App/></AuthProvider>
}

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
