import SharedTextEditor from './SharedTextEditor'
import './DocumentLibrary.css'

export default function PublicDocumentEditor({ shareToken }) {
  const endpoint = `/api/shared-document/${shareToken}`
  return <main className="platform-viewport min-h-screen px-4 py-8">
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-semibold">Shared document</h1>
      <a className="underline" href={endpoint}>Download saved file</a>
      <SharedTextEditor url={`${endpoint}/text`} name="Edit shared text" onClose={() => { window.location.hash = '/home' }}/>
    </div>
  </main>
}
