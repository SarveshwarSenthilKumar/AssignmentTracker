import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import './PageFind.css'

function findMatches(root, query) {
  if (!root || !query.trim()) return []
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const matches = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement
    if (!parent || parent.closest('header.app-navigation, .page-find, [hidden], [inert], [aria-hidden="true"], script, style, textarea, select')) continue
    if (!parent.getClientRects().length || getComputedStyle(parent).visibility !== 'visible') continue
    for (const match of node.data.matchAll(pattern)) {
      const range = document.createRange()
      range.setStart(node, match.index)
      range.setEnd(node, match.index + match[0].length)
      matches.push(range)
    }
  }
  return matches
}

export default function PageFind({ scope, disabled }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState([])
  const [index, setIndex] = useState(0)
  const input = useRef(null)
  const trigger = useRef(null)

  useEffect(() => {
    if (disabled) return
    const onKey = event => {
      if (event.defaultPrevented || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'f') return
      if (event.target instanceof Element && event.target.closest('[role="dialog"], [aria-modal="true"]')) return
      event.preventDefault()
      setOpen(true)
      input.current?.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [disabled])

  useEffect(() => {
    if (open && !disabled) {
      input.current?.focus()
      input.current?.select()
    }
  }, [open, disabled])

  useEffect(() => {
    const root = scope.current
    if (!open || disabled || !root || !query.trim()) return
    const update = () => setMatches(findMatches(root, query))
    update()
    const observer = new MutationObserver(records => {
      if (records.some(record => !record.target.parentElement?.closest('.page-find') && !record.target.closest?.('.page-find'))) update()
    })
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'aria-hidden', 'inert'] })
    return () => observer.disconnect()
  }, [scope, open, disabled, query])

  const active = matches.length ? Math.min(index, matches.length - 1) : 0
  useEffect(() => {
    if (!open || disabled) return
    const highlights = globalThis.CSS?.highlights
    const match = matches[active]
    if (highlights && typeof Highlight === 'function') {
      highlights.set('page-find-matches', new Highlight(...matches))
      if (match) highlights.set('page-find-active', new Highlight(match))
    }
    match?.startContainer.parentElement?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    return () => {
      highlights?.delete('page-find-matches')
      highlights?.delete('page-find-active')
    }
  }, [open, disabled, matches, active])

  const move = direction => {
    if (matches.length) setIndex((active + direction + matches.length) % matches.length)
  }
  const close = () => {
    setOpen(false)
    setMatches([])
    setIndex(0)
    trigger.current?.focus()
  }

  return <div className="page-find">
    <button ref={trigger} type="button" aria-expanded={open && !disabled} aria-keyshortcuts="Control+F Meta+F" disabled={disabled} onClick={() => open ? close() : setOpen(true)}><Search size={15} aria-hidden="true"/>Find on page</button>
    {open && !disabled && createPortal(<div className="page-find-bar" role="search" aria-label="Find on this page" onKeyDown={event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close()
      }
    }}>
      <input ref={input} type="search" aria-label="Text to find on this page" placeholder="Find on this page" value={query} onChange={event => {
        setQuery(event.target.value)
        setMatches([])
        setIndex(0)
      }} onKeyDown={event => {
        if (event.key !== 'Enter') return
        event.preventDefault()
        move(event.shiftKey ? -1 : 1)
      }}/>
      <span role="status">{query.trim() && (matches.length ? `${active + 1} of ${matches.length}` : 'No matches')}</span>
      <button type="button" aria-label="Previous match" disabled={!matches.length} onClick={() => move(-1)}><ChevronUp size={16}/></button>
      <button type="button" aria-label="Next match" disabled={!matches.length} onClick={() => move(1)}><ChevronDown size={16}/></button>
      <button type="button" aria-label="Close find" onClick={close}><X size={16}/></button>
    </div>, document.fullscreenElement || document.body)}
  </div>
}
