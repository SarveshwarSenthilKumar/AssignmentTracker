import { useEffect, useRef } from 'react'
import { SHORTCUTS, isTyping, matchesShortcut } from '../lib/shortcuts'
export default function useShortcuts(scope, handlers, enabled = true) {
  const latest = useRef(handlers)
  latest.current = handlers
  useEffect(() => {
    if (!enabled) return
    const listener = event => {
      if (event.defaultPrevented || event.repeat || event.isComposing) return
      const shortcut = SHORTCUTS.find(item => item.scope === scope && (!isTyping(event.target) || item.typing) && matchesShortcut(event, item))
      if (!shortcut || !latest.current[shortcut.id]) return
      if (latest.current[shortcut.id]() === false) return
      event.preventDefault()
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [scope, enabled])
}
