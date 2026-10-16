import { useEffect, useRef } from 'react'

export default function InlineConfirmation({ pending, settle, reveal=false }) {
  const element=useRef(null)
  useEffect(()=>{
    if(!pending||!reveal)return
    const previous=document.activeElement
    element.current?.scrollIntoView({block:'nearest'})
    element.current?.querySelector('button')?.focus({preventScroll:true})
    return()=>{if(previous?.isConnected)previous.focus({preventScroll:true})}
  },[pending,reveal])
  if (!pending) return null
  return <section ref={element} className="inline-confirmation" role="region" aria-label="Confirm action" data-keep-text-active>
    <p>{pending.message}</p><div><button type="button" onClick={() => settle(false)}>Cancel</button><button type="button" className="inline-confirmation-action" onClick={() => settle(true)}>{pending.action}</button></div>
  </section>
}
