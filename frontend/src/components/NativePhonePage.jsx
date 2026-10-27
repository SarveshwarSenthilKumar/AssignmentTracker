import { useEffect, useRef, useState } from 'react'

export const phoneDesktop=window.studyPhoneDesktop?.engine==='web-contents-view'?window.studyPhoneDesktop:null

export default function NativePhonePage({userId,tab,visible,onChange}){
  const requested=useRef(null),host=useRef(null),change=useRef(onChange),[error,setError]=useState(''),[ready,setReady]=useState(false)
  change.current=onChange
  const url=tab.history[tab.index],identity={owner:userId,id:tab.id}
  useEffect(()=>{
    if(!url||!tab.started)return
    let disposed=false
    setReady(false);setError('');requested.current={url,reload:tab.reload}
    const unsubscribe=phoneDesktop.subscribe(state=>{
      if(state.owner!==userId||state.id!==tab.id)return
      if(state.togglePhone){window.dispatchEvent(new CustomEvent('study-phone-toggle'));return}
      if(state.error)setError(state.error)
      else if(state.loading)setError('')
      change.current({nativeUrl:state.url?.startsWith('https://')?state.url:undefined,nativeCanGoBack:state.canGoBack,nativeCanGoForward:state.canGoForward,status:state.error?'error':state.loading?'loading':'loaded'})
    })
    phoneDesktop.create({...identity,url}).then(()=>{if(!disposed)setReady(true)}).catch(reason=>{if(!disposed){setError(reason.message);change.current({status:'error'})}})
    return()=>{disposed=true;unsubscribe();phoneDesktop.destroy(identity).catch(()=>{})}
  },[userId,tab.id,tab.started])
  useEffect(()=>{
    if(!ready||!url)return
    if(requested.current?.url===url&&requested.current?.reload===tab.reload)return
    requested.current={url,reload:tab.reload}
    setError('')
    phoneDesktop.navigate({...identity,url,reload:true}).catch(reason=>setError(reason.message))
  },[ready,url,tab.reload])
  useEffect(()=>{
    if(!ready)return
    let frame,last=''
    const measure=()=>{
      const element=host.current,rect=element?.getBoundingClientRect()
      if(rect){
        const points=[[rect.left+2,rect.top+2],[rect.right-2,rect.top+2],[rect.left+2,rect.bottom-2],[rect.right-2,rect.bottom-2]]
        const shown=visible&&!error&&!document.hidden&&rect.width>4&&rect.height>4&&rect.left>=0&&rect.top>=0&&rect.right<=innerWidth&&rect.bottom<=innerHeight&&!element.closest('[hidden]')&&points.every(([x,y])=>element.contains(document.elementFromPoint(x,y)))
        const layout={...identity,x:Math.round(rect.x),y:Math.round(rect.y),width:Math.floor(rect.width),height:Math.floor(rect.height),visible:shown,zoom:tab.zoom/100},key=JSON.stringify(layout)
        if(key!==last){last=key;phoneDesktop.layout(layout)}
      }
      frame=requestAnimationFrame(measure)
    }
    measure()
    return()=>{cancelAnimationFrame(frame);phoneDesktop.layout({...identity,x:0,y:0,width:0,height:0,visible:false})}
  },[ready,visible,error,tab.zoom,userId,tab.id])
  return <div ref={host} className="phone-browser-native">{error?<div className="phone-browser-start" role="alert"><strong>Website unavailable</strong><p>{error}</p><button type="button" onClick={()=>{setError('');phoneDesktop.command({...identity,command:'reload'}).catch(reason=>setError(reason.message))}}>Retry website</button></div>:!tab.started||!url?<div className="phone-browser-start"><strong>{url?'Resume this website':'Browse inside your phone'}</strong><p>Websites run in the desktop browser engine, directly inside this panel.</p>{url&&<button type="button" onClick={()=>onChange({started:true,reload:tab.reload+1})}>Resume website</button>}</div>:<div className="phone-browser-start" role="status">{ready?'Website active in phone':'Starting website…'}</div>}</div>
}
