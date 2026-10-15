import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Key } from 'lucide-react'
import { readAssistantResponse, retryLabel } from '../lib/assistant'
import './AccountAISettings.css'

export default function AccountAISettings({token}){
  const [settings,setSettings]=useState(null),[key,setKey]=useState(''),[visible,setVisible]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[confirmRemove,setConfirmRemove]=useState(false),[report,setReport]=useState(null),[retryAt,setRetryAt]=useState(0),[clock,setClock]=useState(Date.now())
  const lock=useRef(false),mounted=useRef(true)
  const wait=Math.max(0,Math.ceil((retryAt-clock)/1000))
  const request=async(path='/api/account/ai-settings',options={})=>readAssistantResponse(await fetch(path,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...options.headers}}))
  useEffect(()=>{
    mounted.current=true;const controller=new AbortController();setBusy('loading')
    request('/api/account/ai-settings',{signal:controller.signal}).then(data=>{if(!controller.signal.aborted)setSettings(data)}).catch(error=>{if(!controller.signal.aborted)setError(error.message)}).finally(()=>{if(!controller.signal.aborted)setBusy('')})
    return()=>{mounted.current=false;controller.abort()}
  },[token])
  useEffect(()=>{if(retryAt<=Date.now())return;const timer=setInterval(()=>{setClock(Date.now());if(Date.now()>=retryAt)clearInterval(timer)},1000);return()=>clearInterval(timer)},[retryAt])
  const changed=()=>window.dispatchEvent(new Event('assistant-credentials-changed'))
  const save=async event=>{
    event.preventDefault();if(lock.current||busy||!key.trim())return
    lock.current=true;setBusy('saving');setError('');setNotice('');setReport(null)
    try{
      const data=await request('/api/account/ai-settings',{method:'PUT',body:JSON.stringify({apiKey:key.trim()})})
      if(!mounted.current)return
      setSettings(data);setKey('');setVisible(false);setConfirmRemove(false);setRetryAt(0);setNotice('Gemini API key saved. New AI requests across your account now use this key.');changed()
    }catch(error){if(mounted.current)setError(error.message)}finally{lock.current=false;if(mounted.current)setBusy('')}
  }
  const remove=async()=>{
    if(lock.current||busy)return
    lock.current=true;setBusy('removing');setError('');setNotice('');setReport(null)
    try{
      const data=await request('/api/account/ai-settings',{method:'DELETE'})
      if(!mounted.current)return
      setSettings(data);setKey('');setVisible(false);setConfirmRemove(false);setRetryAt(0);setNotice(data.source==='server'?'Personal API key removed. AI requests now use the shared server key.':'API key removed. Add another key to use the AI assistant.');changed()
    }catch(error){if(mounted.current)setError(error.message)}finally{lock.current=false;if(mounted.current)setBusy('')}
  }
  const test=async()=>{
    if(lock.current||busy||wait||key.trim())return
    lock.current=true;setBusy('testing');setError('');setNotice('');setReport(null)
    try{const data=await request('/api/assistant/test',{method:'POST'});if(mounted.current){setReport(data.diagnostics);setNotice('The saved AI connection is working.')}}
    catch(error){if(mounted.current){setError(error.message);setReport(error.diagnostics||null);if(error.diagnostics?.retryable&&error.diagnostics.retryAfterSeconds>0){setRetryAt(Date.now()+error.diagnostics.retryAfterSeconds*1000);setClock(Date.now())}}}
    finally{lock.current=false;if(mounted.current)setBusy('')}
  }
  return <section className="account-ai-settings" aria-labelledby="account-ai-title" aria-busy={!!busy}>
    <h4 id="account-ai-title"><Key size={17}/>AI settings</h4>
    <p>Add your Google Gemini API key once to use it for AI chats and file questions throughout your account, on any device. Your key takes priority over a shared server key.</p>
    <div className="account-ai-status"><strong>{busy==='loading'?'Loading connection…':settings?.hasPersonalKey?`Personal key saved · ${settings.maskedKey}`:settings?.source==='server'?'Using the shared server key':'No API key saved'}</strong>{settings?.updatedAt&&<small>Updated {new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(settings.updatedAt))}</small>}</div>
    {settings?.needsReplacement&&<p className="account-ai-error">The saved key could not be decrypted. Replace it below to reconnect the assistant.</p>}
    {settings&&!settings.storageAvailable&&<p className="account-ai-error">The server needs credential encryption configured before keys can be saved.</p>}
    <form onSubmit={save}>
      <label htmlFor="account-gemini-api-key">{settings?.hasPersonalKey?'Replace Gemini API key':'Gemini API key'}</label>
      <div className="account-ai-key-input"><input id="account-gemini-api-key" name="geminiApiKey" type={visible?'text':'password'} autoComplete="off" autoCapitalize="none" spellCheck={false} value={key} maxLength={2048} placeholder={settings?.hasPersonalKey?'Paste a replacement key':'Paste your Gemini API key'} disabled={!!busy||!settings?.storageAvailable} onChange={event=>{setKey(event.target.value);setReport(null);setNotice('')}}/><button type="button" disabled={!!busy||!key} onClick={()=>setVisible(value=>!value)} aria-label={visible?'Hide entered API key':'Show entered API key'} aria-pressed={visible}>{visible?<EyeOff size={16}/>:<Eye size={16}/>}</button></div>
      <small>Surrounding quotes, spaces and a Bearer prefix are removed automatically. The saved key is encrypted on the server and is never returned to this page. Saving does not call Gemini or verify provider access.</small>
      <div className="account-ai-actions"><button type="submit" disabled={!!busy||!key.trim()||!settings?.storageAvailable}>{busy==='saving'?'Saving…':settings?.hasPersonalKey?'Replace key':'Save key'}</button><button type="button" disabled={!!busy||!settings?.configured||settings?.needsReplacement||!!key.trim()||wait>0} onClick={test}>{busy==='testing'?'Checking…':wait>0?`Check in ${retryLabel(wait)}`:'Check saved connection'}</button>{settings?.hasPersonalKey&&<button type="button" disabled={!!busy} onClick={()=>setConfirmRemove(value=>!value)}>Remove key</button>}</div>
    </form>
    <p className="account-ai-help">Get a key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio ↗</a>. Connection checks send a short request without workspace data and use API tokens. {key.trim()?'Save your changes before checking the connection.':''}</p>
    {confirmRemove&&<div className="account-ai-remove" role="alert"><p>Remove your saved personal key? {settings?.source==='account'?'If a shared server key is configured, new requests will use it; otherwise AI will be disconnected.':''} Saved conversations remain available.</p><button type="button" disabled={!!busy} onClick={remove}>{busy==='removing'?'Removing…':'Remove personal key'}</button><button type="button" disabled={!!busy} onClick={()=>setConfirmRemove(false)}>Keep key</button></div>}
    {notice&&<p role="status" className="account-ai-notice">{notice}</p>}
    {error&&<p role="alert" className="account-ai-error">{error}</p>}
    {report?.action&&<p>{report.action}</p>}
    {report&&<details className="account-ai-report"><summary>Connection details</summary><dl>{[['Result',report.category],['Provider HTTP',report.providerStatus],['Provider code',report.code],['Model',report.model],['Trace ID',report.traceId]].filter(([,value])=>value!==undefined&&value!==null).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>}
  </section>
}
