import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'

export default function DocumentActionsMenu({ name, children }) {
  const [position, setPosition] = useState(null)
  const trigger = useRef(null)
  const panel = useRef(null)
  const id = useId()
  useEffect(() => {
    if (!position) return
    panel.current?.querySelector('button:not(:disabled)')?.focus()
    const close = event => {
      if (!panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) setPosition(null)
    }
    const dismiss = event => {
      if (!panel.current?.contains(event.target)) setPosition(null)
    }
    document.addEventListener('pointerdown', close)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      document.removeEventListener('pointerdown', close)
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
    }
  }, [position])

  return <>
    <button ref={trigger} type="button" aria-label={`More actions for ${name}`} aria-expanded={!!position} aria-controls={position ? id : undefined}
      onClick={() => {
        const bounds = trigger.current.getBoundingClientRect()
        setPosition(previous => previous ? null : {
          right: Math.max(8, Math.min(window.innerWidth - bounds.right, window.innerWidth - 248)),
          top: Math.max(8, Math.min(bounds.bottom + 6, window.innerHeight - 390))
        })
      }}><MoreHorizontal size={17}/><span>More</span></button>
    {position && createPortal(<div ref={panel} id={id} className="document-actions-menu" role="group" aria-label={`Actions for ${name}`}
      style={position} onClick={event => {
        if (event.target.closest('button:not(:disabled)')) setPosition(null)
      }} onKeyDown={event => {
        event.stopPropagation()
        if (event.key === 'Escape') { event.preventDefault(); setPosition(null); trigger.current?.focus() }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault()
          const buttons = [...panel.current.querySelectorAll('button:not(:disabled)')]
          const index = buttons.indexOf(document.activeElement)
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
          buttons[next]?.focus()
        }
      }}>{children}</div>, document.fullscreenElement || document.body)}
  </>
}
