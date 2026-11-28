import { useEffect, useState } from 'react'
import PublicDocumentEditor from './PublicDocumentEditor'
import DocumentAccessNotice from './DocumentAccessNotice'
import { readApiJson } from '../lib/apiResponse'

export default function BoardPinWhiteboard({ boardId, focusPin, token, onClose, onTaskCreated, hiddenFeatures, children }) {
  const [access, setAccess] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/board-pins/whiteboards/' + boardId, {
      signal: controller.signal, cache: 'no-store', headers: { Authorization: 'Bearer ' + token },
    }).then(async response => {
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.message || 'This whiteboard is unavailable.')
      if (!controller.signal.aborted) setAccess(data)
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure.message)
    })
    return () => controller.abort()
  }, [boardId, token, attempt])

  const shareToken = /^#\/shared-document\/([A-Za-z0-9_-]{43})$/.exec(access?.path || '')?.[1]
  if (access?.owned) return children
  if (shareToken) return <PublicDocumentEditor shareToken={shareToken} focusPin={focusPin} onClose={onClose}
    onTaskCreated={onTaskCreated} hiddenFeatures={hiddenFeatures}/>
  if (error || access) return <DocumentAccessNotice message={error || 'This whiteboard is unavailable.'} onClose={onClose}
    onRetry={() => { setAccess(null); setError(''); setAttempt(value => value + 1) }}/>
  return <p role="status">Opening source whiteboard…</p>
}
