import { useState } from 'react'
import useLiveText from '../hooks/useLiveText'
import DocumentAccessNotice from './DocumentAccessNotice'
import {downloadBlob} from '../lib/documentFormats'

export default function SharedTextEditor({ url, token, name, onClose }) {
  const [draft, setDraft] = useState('')
  const live = useLiveText({ url, token, value: draft, onChange: setDraft })
  if(live.accessDenied)return <DocumentAccessNotice message={live.accessDenied} onClose={onClose} onRetry={()=>window.location.reload()} onSaveDraft={draft?()=>downloadBlob(new Blob([draft],{type:'text/plain'}),name||'document.txt'):undefined}/>
  return <section className="library-live-editor" aria-label={`Live editing ${name}`}>
    <h4>{name}</h4>
    <p role="status">{live.status}</p>
    <textarea aria-label="Document text" rows={12} value={draft} readOnly={!live.ready} onChange={event => setDraft(event.target.value)}/>
    {live.conflict && <details open><summary>Latest shared text</summary>
      <textarea aria-label="Latest shared text" rows={8} readOnly value={live.conflict.text}/>
      <button type="button" onClick={() => live.resolve(false)}>Use shared version</button>
      <button type="button" onClick={() => live.resolve(true)}>Keep my version</button>
    </details>}
    <button type="button" onClick={async () => { if (await live.sync()) onClose() }}>Save and close editor</button>
  </section>
}
