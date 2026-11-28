import './DocumentShareMessage.css'

export default function DocumentShareMessage({ message, label = 'Message from the sender' }) {
  if (!message) return null
  return <div className="document-share-message">
    <strong>{label}</strong>
    <p>{message}</p>
  </div>
}
