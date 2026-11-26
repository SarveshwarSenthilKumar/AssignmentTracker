export default function RecentShareRecipients({emails,onChoose,onClear,disabled}){
  if(!emails.length)return null
  return <div className="library-recent-recipients" role="group" aria-label="Recent recipients">
    <span>Recent recipients</span>
    <div className="library-sharing-actions">
      {emails.map(email=><button key={email} type="button" disabled={disabled} onClick={()=>onChoose(email)}>{email}</button>)}
      <button type="button" disabled={disabled} onClick={onClear}>Clear recent</button>
    </div>
  </div>
}
