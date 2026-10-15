import { useState } from 'react'
import { retryLabel, diagnosticExport } from '../lib/assistant'

export default function AssistantDiagnostics({status,result,testing,checking,busy,onTest,onRefresh,testWait=0}) {
  const [copyMessage,setCopyMessage]=useState('')
  const rows=result?[
    ['Result',result.category],['Source',result.source],['Model',result.model||status?.model],['Provider HTTP status',result.providerStatus],['Backend HTTP status',result.httpStatus],['Provider code',result.code],['Provider type',result.type],['Parameter',result.parameter],['Stage',result.stage],['Provider request ID',result.providerRequestId],['App trace ID',result.traceId],['Network code',result.networkCode],['Provider duration (ms)',result.elapsedMs],['Total duration (ms)',result.totalElapsedMs],['Input tokens',result.inputTokens],['Output tokens',result.outputTokens],['Thinking tokens',result.thoughtTokens],['Request bytes',result.requestBytes],['Workspace characters',result.workspaceCharacters],['Screen characters',result.screenCharacters],['History messages',result.historyMessages],['Open file bytes',result.fileBytes],['Retry after (seconds)',result.retryAfterSeconds],['When',result.timestamp]
  ].filter(([,value])=>value!==undefined&&value!==null&&value!==''):[]
  const copy=async()=>{
    try {await navigator.clipboard.writeText(JSON.stringify(diagnosticExport(status,result),null,2));setCopyMessage('Diagnostics copied. Keys, chat content, and provider message text are excluded.')}
    catch {setCopyMessage('Could not access the clipboard. You can select and copy the details below.')}
  }
  return <details className="assistant-diagnostics"><summary>AI connection & diagnostics{result?.category&&<span>{result.category.replaceAll('_',' ')}</span>}</summary><div>
    <p>Model: <strong>{status?.model||'Checking…'}</strong> · API key: {status==null?'Checking…':status.configured?'Configured':'Not configured'}</p><small>{status?.source==='account'?'Uses your saved account key. ':status?.source==='server'?'Uses the shared server key. ':''}A configured key has not necessarily passed an API test. Manage your key on the Account page.</small>
    {status?.limits&&<small>App requests: {status.limits.used} / {status.limits.limit} per {status.limits.windowSeconds/60} minutes · {status.limits.inProgress?'Request in progress':'No active request'}</small>}
    <div className="assistant-diagnostic-actions"><button type="button" disabled={busy||testing||!status?.configured||testWait>0} onClick={onTest}>{testing?'Testing…':testWait>0?`Test in ${retryLabel(testWait)}`:'Test API connection'}</button><button type="button" disabled={checking||busy||testing} onClick={onRefresh}>{checking?'Refreshing…':'Refresh settings'}</button>{result&&<button type="button" onClick={copy}>Copy diagnostics</button>}</div>
    <small>The test sends a short “Reply with OK” request. No workspace data is sent; a successful test uses a few API tokens.</small>
    {copyMessage&&<p role="status">{copyMessage}</p>}
    {result&&<><p className={result.category==='success'?'':'assistant-diagnostic-failure'}>{result.message}</p>{result.action&&<p>{result.action}</p>}{result.providerMessage&&<p className="assistant-provider-reason"><strong>Provider reason</strong><br/>{result.providerMessage}</p>}<dl>{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{String(value)}</dd></div>)}</dl>{result.quotaDetails?.length>0&&<details><summary>Gemini quota details</summary><dl>{result.quotaDetails.map((item,index)=><div key={index}><dt>{item.id||item.metric}</dt><dd>{item.metric}{item.value!==""&&` · Limit: ${item.value}`}</dd></div>)}</dl></details>}</>}
  </div></details>
}
