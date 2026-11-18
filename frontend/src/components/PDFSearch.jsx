import { useEffect, useMemo, useState } from 'react'
import { pdfjs } from 'react-pdf'
import { X } from 'lucide-react'

export default function PDFSearch({ file, annotations, onPage, onClose, image }) {
  const [query, setQuery] = useState('')
  const [pages, setPages] = useState([])
  const [status, setStatus] = useState('')
  useEffect(() => {
    let cancelled = false
    let task
    setPages([])
    if (!file || image) return
    const read = async () => {
      try {
        setStatus('Reading document text…')
        task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false })
        const document = await task.promise
        const text = []
        for (let number = 1; number <= document.numPages; number++) {
          if (cancelled) return
          const page = await document.getPage(number)
          const content = await page.getTextContent()
          text.push({ page: number, text: content.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('') })
          page.cleanup()
          if (!cancelled) setStatus(`Reading page ${number} of ${document.numPages}…`)
        }
        if (!cancelled) { setPages(text); setStatus('') }
      } catch {
        if (!cancelled) setStatus('The PDF text could not be read. Saved notes remain searchable.')
      } finally {
        task?.destroy()
      }
    }
    read()
    return () => { cancelled = true; task?.destroy() }
  }, [file, image])

  const results = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    if (!term) return []
    const sources = [...pages.map(page => ({ ...page, kind: 'Page text' })),
      ...annotations.filter(item => item.tool === 'text' && item.text).map(item => ({
        page: item.page || 1, text: item.text, kind: item.stickyNote ? 'Sticky note' : 'Text annotation'
      }))]
    const matches = []
    for (const source of sources) {
      const lower = source.text.toLocaleLowerCase()
      let index = lower.indexOf(term)
      while (index >= 0 && matches.length < 500) {
        matches.push({ page: source.page, kind: source.kind, snippet: source.text.slice(Math.max(0, index - 45), index + term.length + 75) })
        index = lower.indexOf(term, index + Math.max(1, term.length))
      }
      if (matches.length >= 500) break
    }
    return matches
  }, [query, pages, annotations])

  return <aside className="pdf-search-panel" aria-label="Search document" onKeyDown={event => {
    event.stopPropagation()
    if (event.key === 'Escape') onClose()
  }}>
    <header><h3>Search document</h3><button type="button" aria-label="Close document search" onClick={onClose}><X size={18}/></button></header>
    <input autoFocus type="search" aria-label="Search PDF text and notes" placeholder="Search text and sticky notes…" value={query} onChange={event => setQuery(event.target.value)}/>
    <p role="status">{status || (query.trim() ? `${results.length}${results.length === 500 ? '+' : ''} matches` : 'Search all pages, text annotations and sticky notes.')}</p>
    <ul>{results.map((result, index) => <li key={index}><button type="button" onClick={() => onPage(result.page)}>
      <strong>Page {result.page} · {result.kind}</strong><span>{result.snippet}</span>
    </button></li>)}</ul>
    <small>Scanned pages, handwriting and image contents need OCR to become searchable.</small>
  </aside>
}
