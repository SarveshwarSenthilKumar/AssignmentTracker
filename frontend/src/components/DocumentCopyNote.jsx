import './DocumentCopyNote.css'

export default function DocumentCopyNote({name}){
  if(!name)return null
  return <small className="document-copy-note" title={`Copied from: ${name}`}>Copied from: {name}</small>
}
