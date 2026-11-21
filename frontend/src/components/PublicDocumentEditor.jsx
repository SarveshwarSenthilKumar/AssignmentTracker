import { Component, useEffect, useRef, useState } from 'react'
import SharedTextEditor from './SharedTextEditor'
import PDFEditor from './PDFEditor'
import './DocumentLibrary.css'
import {sharedDocumentRequest} from '../lib/sharedDocumentRequest'
import DocumentAccessNotice from './DocumentAccessNotice'
import DocumentEditHistory from './DocumentEditHistory'

class SharedEditorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <main className="platform-viewport min-h-screen px-4 py-8">
      <h1 className="text-xl font-semibold">Could not open the shared editor</h1>
      <p role="alert">Reload the page to try again. You can also download the saved file.</p>
      <div className="library-sharing-actions">
        <button type="button" onClick={() => window.location.reload()}>Reload editor</button>
        <a className="underline" href={this.props.downloadUrl}>Download saved file</a>
      </div>
    </main>
  }
}

export default function PublicDocumentEditor({ shareToken }) {
  const endpoint = `/api/shared-document/${shareToken}`
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [denied,setDenied]=useState(null)
  const [history,setHistory]=useState(false)
  const input = useRef(null)
  useEffect(() => {
    const controller = new AbortController()
    setFile(null)
    setDenied(null)
    setError('')
    if(!/^[A-Za-z0-9_-]{43}$/.test(shareToken)){setDenied('This sharing link is invalid or incomplete. Ask the owner for a new link.');return()=>controller.abort()}
    sharedDocumentRequest(`${endpoint}/editor`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const data = await response.json().catch(()=>({}))
        if([401,403,404].includes(response.status)&&!controller.signal.aborted)setDenied(data.message||'This sharing link is unavailable.')
        if (!response.ok) throw new Error(data.message || 'This editor link is unavailable.')
        if (!controller.signal.aborted) setFile(data)
      }).catch(error => { if (!controller.signal.aborted) setError(error.message) })
    return () => controller.abort()
  }, [endpoint])
  const close = () => { window.location.hash = '/home' }
  async function replace(event) {
    const replacement = event.target.files?.[0]
    event.target.value = ''
    if (!replacement || busy) return
    setError('')
    setStatus('')
    if (!replacement.size || replacement.size > 12 * 1024 * 1024) { setError('Choose a non-empty file up to 12 MB.'); return }
    const extension = name => /\.[^.]+$/.exec(name || '')?.[0].toLowerCase() || ''
    if (extension(replacement.name) !== extension(file.originalName)) { setError('Choose the same file format as the shared original.'); return }
    setBusy(true)
    try {
      const content = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1])
        reader.onerror = () => reject(new Error('Could not read this file.'))
        reader.readAsDataURL(replacement)
      })
      const response = await sharedDocumentRequest(`${endpoint}/document/content`, { method: 'PUT', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-Share-Revision': file.revision }, body: JSON.stringify({ content }) })
      const data = await response.json()
      if([401,403,404].includes(response.status))setDenied(data.message||'Your access to this document is no longer available.')
      if (!response.ok) throw new Error(data.message || 'Could not save the replacement.')
      setFile(previous => ({ ...previous, revision: response.headers.get('X-Share-Revision') }))
      setStatus('Updated file saved. The document name and share link stay the same.')
    } catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }
  if (file?.editor === 'pdf') return <SharedEditorBoundary downloadUrl={endpoint}><PDFEditor key={shareToken} pdfId={file._id} shareToken={shareToken} shareRevision={file.revision} onClose={close}/></SharedEditorBoundary>
  if(denied)return <DocumentAccessNotice message={denied} onClose={close} onRetry={()=>window.location.reload()}/>
  return <main className="platform-viewport min-h-screen px-4 py-8">
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-semibold">{file?.name || 'Shared document'}</h1>
      {!file && !error && <p role="status">Opening shared file…</p>}
      {error && <p role="alert">{error}</p>}
      {file && <>
        <a className="underline" href={endpoint}>Download saved file</a>
        {file.editor!=='text'&&<button type="button" onClick={()=>setHistory(true)}>Edit history</button>}
        {history&&<DocumentEditHistory url={`${endpoint}/history`} onClose={()=>setHistory(false)}/>}
        {file.editor === 'text' ? <SharedTextEditor url={`${endpoint}/text`} name={file.name} onClose={close}/> : <section className="library-sharing-panel">
          <p>Download the file, edit it in an app that supports its format, then upload the edited version here. Replacing the file clears existing annotations.</p>
          <input ref={input} type="file" hidden onChange={replace} disabled={busy}/>
          <button type="button" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Saving…' : 'Upload edited version'}</button>
          {status && <p role="status">{status}</p>}
          <button type="button" disabled={busy} onClick={close}>Close</button>
        </section>}
      </>}
    </div>
  </main>
}
