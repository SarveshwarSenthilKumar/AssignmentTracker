import { useEffect, useRef, useState } from 'react'
import { readApiJson } from './apiResponse'
import { sharedDocumentRequest } from './sharedDocumentRequest'

const empty = { stops: [], revision: 0 }
export function useSavedDocumentViews(url, token, content) {
  const [data, setData] = useState(empty)
  const [loading, setLoading] = useState(Boolean(url))
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const generation = useRef(0)
  const headers = token ? { Authorization: 'Bearer ' + token } : {}
  useEffect(() => {
    if (!url || !content) return
    const controller = new AbortController()
    const version = ++generation.current
    setLoading(true)
    setError('')
    sharedDocumentRequest(url, { cache: 'no-store', signal: controller.signal, headers }).then(async response => {
      const result = await readApiJson(response)
      if (!response.ok) throw new Error(result.message || 'Could not load saved views.')
      if (generation.current === version) setData(result)
    }).catch(failure => {
      if (generation.current === version && !controller.signal.aborted) setError(failure.message)
    }).finally(() => {
      if (generation.current === version) setLoading(false)
    })
    return () => { generation.current++; controller.abort() }
  }, [url, token, content, reload])

  async function save(stops) {
    if (!url || loading) throw new Error('Wait for the saved views to load.')
    const version = generation.current
    const response = await sharedDocumentRequest(url, {
      method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stops, revision: data.revision }),
    })
    const result = await readApiJson(response)
    if (!response.ok) throw new Error(result.message || 'Could not save these views.')
    if (version === generation.current) setData(result)
  }

  return { stops: data.stops, loading, error, reload: () => setReload(value => value + 1), save }
}
