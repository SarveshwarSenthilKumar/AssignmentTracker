import { useCallback, useEffect, useRef, useState } from 'react'

export default function useInlineConfirm() {
  const [pending, setPending] = useState(null)
  const resolveRef = useRef(null)
  const settle = useCallback(answer => { const resolve = resolveRef.current; resolveRef.current = null; setPending(null); resolve?.(answer) }, [])
  const ask = useCallback((message, action = 'Continue') => {
    resolveRef.current?.(false)
    return new Promise(resolve => { resolveRef.current = resolve; setPending({ message, action }) })
  }, [])
  useEffect(() => {
    if(!pending)return
    const cancel=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();settle(false)}}
    window.addEventListener('keydown',cancel,true)
    return()=>window.removeEventListener('keydown',cancel,true)
  },[pending,settle])
  useEffect(() => () => { resolveRef.current?.(false) }, [])
  return { pending, ask, settle }
}
