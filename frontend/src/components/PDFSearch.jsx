import { useEffect, useMemo, useState } from 'react'
import { pdfjs } from 'react-pdf'
import { X } from 'lucide-react'

export default function PDFSearch({ file, annotations, actions, onPage, onClose, image }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
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

  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const tools = terms.length ? (actions?.current || []).filter(action=>terms.every(term=>(action.label+' '+action.description).toLowerCase().includes(term))) : []
  return <aside className="pdf-search-panel" aria-label="Search document and tools" onKeyDown={event => {
    event.stopPropagation()
    if (event.key === 'Escape') onClose()
  }}>
    <header><h3>Find in editor</h3><button type="button" aria-label="Close document search" onClick={onClose}><X size={18}/></button></header>
    <input autoFocus type="search" aria-label="Search PDF text, notes and editor tools" placeholder="Search text, notes or tools…" value={query} onChange={event => setQuery(event.target.value)}/>
    <div className="pdf-search-filters" role="group" aria-label="Search scope">
      {[['all','All'],['file','File'],['tools','Tools']].map(([value,label])=><button key={value} type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}
    </div>
    {filter !== 'file' && tools.length > 0 && <section aria-label="Editor tools"><h4>Tools and actions</h4><ul>{tools.map(action=><li key={action.label}><button type="button" disabled={action.disabled} onClick={()=>{onClose();action.run?.()}}><strong>{action.label}</strong>{action.description&&<span>{action.description}</span>}</button></li>)}</ul></section>}
    <p role="status">{filter==='tools' ? query.trim() ? `${tools.length} tools found` : 'Search editor tools and actions.' : status || (query.trim() ? `${results.length}${results.length === 500 ? '+' : ''} file matches` : 'Search all pages, text annotations and sticky notes.')}</p>
    {filter !== 'tools' && <ul>{results.map((result, index) => <li key={index}><button type="button" onClick={() => onPage(result.page)}>
      <strong>Page {result.page} · {result.kind}</strong><span>{result.snippet}</span>
    </button></li>)}</ul>}
    {filter !== 'tools' && <small>Scanned pages, handwriting and image contents need OCR to become searchable.</small>}
  </aside>
}
