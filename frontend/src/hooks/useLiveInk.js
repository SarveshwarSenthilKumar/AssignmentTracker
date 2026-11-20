import { useEffect, useRef, useState } from 'react'

export default function useLiveInk({ url, token, enabled, contentRevision, committed }) {
  const [previews, setPreviews] = useState(new Map())
  const connection = useRef(null), pending = useRef(new Map()), offsets = useRef(new Map())
  const [connected, setConnected] = useState(false)
  const known = useRef(new Set())
  known.current = new Set(committed.map(item => item.id))
  useEffect(() => {
    setPreviews(previous => [...previous.keys()].some(id => known.current.has(id)) ? new Map([...previous].filter(([id]) => !known.current.has(id))) : previous)
  }, [committed])
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let reconnect, sender, expiry, sending = false, sequence = 0
    const receive = event => {
      if (event.type === 'ready') {
        connection.current = event.session
        offsets.current.clear()
        setPreviews(new Map(event.previews.filter(item => !known.current.has(item.id)).map(item => [item.id, { ...item, livePressure: item.pressure, updated: Date.now() }])))
        setConnected(true)
      } else if (event.type === 'clear') {
        setPreviews(previous => { const next = new Map(previous); next.delete(event.id); return next })
      } else if (event.type === 'ink') {
        if (known.current.has(event.id)) return
        setPreviews(previous => {
          const before = previous.get(event.id)
          if (event.offset !== 0 && event.offset !== (before?.points.length || 0)) return previous
          const next = new Map(previous)
          next.set(event.id, { ...event, livePressure: event.pressure, updated: Date.now(), points: [...(event.offset ? before.points : []), ...event.points] })
          return next
        })
      } else if (event.type === 'unavailable') controller.abort()
    }
    const connect = async () => {
      try {
        const response = await fetch(`${url}/stream`, { cache: 'no-store', signal: controller.signal, headers: token ? { Authorization: `Bearer ${token}` } : {} })
        if (!response.ok || !response.body) throw new Error('Live preview unavailable')
        const reader = response.body.getReader(), decoder = new TextDecoder()
        let buffer = ''
        try {
          while (!controller.signal.aborted) {
            const { value, done } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            let boundary
            while ((boundary = buffer.indexOf('\n\n')) !== -1) {
              const message = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2)
              const data = message.split('\n').filter(line => line.startsWith('data: ')).map(line => line.slice(6)).join('\n')
              if (data) receive(JSON.parse(data))
            }
          }
        } finally { reader.releaseLock() }
      } catch { /* Durable document synchronization continues while previews reconnect. */ }
      finally {
        connection.current = null
        setConnected(false)
        setPreviews(new Map())
        if (!controller.signal.aborted) reconnect = setTimeout(connect, 1200)
      }
    }
    const send = async () => {
      const session = connection.current
      if (sending || !session || controller.signal.aborted) return
      const [id, stroke] = pending.current.entries().next().value || []
      if (!stroke) return
      if (Date.now() - stroke.queuedAt > 3000) { pending.current.delete(id); offsets.current.delete(id); return }
      sending = true
      const offset = stroke.replace ? 0 : offsets.current.get(id) || 0
      const points = stroke.points?.slice(offset, offset + 512) || []
      const ended = !!stroke.ended && offset + points.length >= (stroke.points?.length || 0)
      try {
        const response = await fetch(`/api/document-live-ink/${session}`, { method: 'POST', cache: 'no-store', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...stroke, points, offset, ended, sequence: ++sequence }) })
        if (response.ok) {
          offsets.current.set(id, offset + points.length)
          if (pending.current.get(id) === stroke && (stroke.cancel || offset + points.length >= stroke.points.length)) pending.current.delete(id)
          if (ended || stroke.cancel) offsets.current.delete(id)
        } else if (response.status === 409) offsets.current.delete(id)
        else if (response.status === 404) connection.current = null
        else if (response.status === 400) { pending.current.delete(id); offsets.current.delete(id) }
      } catch { /* Retry the newest packet, not a backlog of pointer events. */ }
      finally { sending = false }
    }
    connect()
    sender = setInterval(send, 50)
    expiry = setInterval(() => setPreviews(previous => [...previous.values()].some(item => Date.now() - item.updated >= 10000) ? new Map([...previous].filter(([, item]) => Date.now() - item.updated < 10000)) : previous), 1000)
    return () => { controller.abort(); clearTimeout(reconnect); clearInterval(sender); clearInterval(expiry); connection.current = null; pending.current.clear(); offsets.current.clear() }
  }, [url, token, enabled])
  const publish = stroke => {
    if (!enabled || !stroke.id || !contentRevision) return
    pending.current.set(stroke.id, { ...stroke, points: stroke.points?.slice(0, 20000) || [], contentRevision, queuedAt: Date.now() })
  }
  return { connected, publish, strokes: [...previews.values()].filter(stroke => stroke.contentRevision === contentRevision) }
}
