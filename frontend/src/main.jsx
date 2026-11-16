import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import PublicDocumentEditor from './components/PublicDocumentEditor'
import './index.css'
import './responsive.css'
import { AuthProvider } from './contexts/AuthContext'
import './mobile.css'
import './light-mode.css'
import './checkboxes.css'

function Root() {
  const readHash = () => window.location.hash
  const hash = React.useSyncExternalStore(subscribeToHash, readHash)
  const shareToken = /^#\/shared-document\/([A-Za-z0-9_-]{43})$/.exec(hash)?.[1]
  if (shareToken) return <PublicDocumentEditor key={shareToken} shareToken={shareToken}/>
  return <AuthProvider><App/></AuthProvider>
}

function subscribeToHash(callback) {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
