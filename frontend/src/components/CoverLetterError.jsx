import {useState} from 'react'

export default function CoverLetterError({error}){
  const [copyStatus,setCopyStatus]=useState('')
  const details=error.diagnostics||{}
  const rows=[['Suggested next step',details.action],['Gemini’s reason',details.providerMessage|| (details.source==='gemini'?'Gemini did not supply a more detailed reason.':null)],['Source',details.source],['Category',details.category],['Stage',details.stage],['Model',details.model],['HTTP status',details.httpStatus],['Gemini HTTP status',details.providerStatus],['Error code',details.code],['Error type',details.type],['Network code',details.networkCode],['Retry after (seconds)',details.retryAfterSeconds],['Elapsed time (ms)',details.elapsedMs],['Request ID',details.providerRequestId],['Trace ID',details.traceId],['Time',details.timestamp]].filter(([,value])=>value!==undefined&&value!==null&&value!=='')
  const copy=async()=>{
    try{await navigator.clipboard.writeText([error.message,...rows.map(([label,value])=>`${label}: ${value}`)].join('\n'));setCopyStatus('Details copied.')}catch{setCopyStatus('Could not copy. Select and copy the details below.')}
  }
  return <div className="cover-letter-error">
    <p role="alert">{error.message}</p>
    <details><summary>Error details</summary>
      <dl>{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{String(value)}</dd></div>)}</dl>
      {!!details.quotaDetails?.length&&<><p>Gemini quota details</p><pre>{JSON.stringify(details.quotaDetails,null,2)}</pre></>}
      <button type="button" onClick={copy}>Copy error details</button><span role="status">{copyStatus}</span>
    </details>
  </div>
}
