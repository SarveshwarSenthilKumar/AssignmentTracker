import { useEffect, useRef, useState } from 'react'
import { defaultWorkspace, importWorkspace } from '../lib/workspace'

export default function useWorkspaceLayout({token,userId}){
  const storageKey=`workflow-layout:${userId}`
  const [layout,setLayout]=useState(null),[status,setStatus]=useState('loading'),[error,setError]=useState(''),[ready,setReady]=useState(false)
  const current=useRef(null),revision=useRef(0),generation=useRef(0),savedGeneration=useRef(0),saving=useRef(false),alive=useRef(true),blocked=useRef(false),timer=useRef(null),resetting=useRef(false),loadVersion=useRef(0)
  const local=(dirty=true)=>{if(resetting.current||!current.current)return;try{localStorage.setItem(storageKey,JSON.stringify({layout:current.current,revision:revision.current,dirty}))}catch{}}
  const request=async(options={})=>{
    const response=await fetch('/api/account/workspace-layout',{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}})
    const data=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(data.message||'Could not access workspace settings.');error.status=response.status;throw error}return data
  }
  const save=async()=>{
    clearTimeout(timer.current)
    if(saving.current||blocked.current||!current.current||generation.current===savedGeneration.current)return
    saving.current=true;const started=generation.current,snapshot=current.current;if(alive.current)setStatus('saving')
    try{
      const data=await request({method:'PUT',body:JSON.stringify({revision:revision.current,layout:snapshot})})
      if(resetting.current)return
      revision.current=data.revision;savedGeneration.current=started;if(alive.current)local(generation.current!==started)
      if(alive.current){setStatus(generation.current===started?'saved':'unsaved');setError('')}
    }catch(error){blocked.current=error.status===409;if(alive.current){setStatus(blocked.current?'conflict':'error');setError(error.message)}local()}
    finally{saving.current=false;if(alive.current&&!blocked.current&&savedGeneration.current!==generation.current&&savedGeneration.current>=started)timer.current=setTimeout(save,800)}
  }
  const load=async({discardLocal=false}={})=>{
    const version=++loadVersion.current
    setStatus('loading');setError('');blocked.current=false
    try{
      const data=await request();if(!alive.current||version!==loadVersion.current)return
      revision.current=data.revision;let draft=null
      if(!discardLocal){try{const value=JSON.parse(localStorage.getItem(storageKey)||'null');if(value?.dirty&&Number.isInteger(value.revision)&&value.revision>=0)draft={...value,layout:importWorkspace(value.layout)}}catch{}}
      const value=draft?.layout||(data.layout?importWorkspace(data.layout):defaultWorkspace())
      current.current=value;setLayout(value);generation.current=1;savedGeneration.current=draft?0:data.layout?1:0;setReady(true)
      if(draft&&draft.revision!==data.revision){revision.current=draft.revision;blocked.current=true;setStatus('conflict');setError('This account has a different saved layout. Your local draft is preserved. Choose which version to keep.')}
      else{setStatus(draft||!data.layout?'unsaved':'saved');if(draft||!data.layout)timer.current=setTimeout(save,800);else local(false)}
    }catch(error){
      if(!alive.current||version!==loadVersion.current)return
      let draft=null;try{draft=importWorkspace(JSON.parse(localStorage.getItem(storageKey)||'null')?.layout)}catch{}
      const value=draft||current.current||defaultWorkspace();current.current=value;setLayout(value);setReady(true);generation.current++;setStatus('error');setError(`${error.message} Changes will stay in a local draft until you reconnect.`);blocked.current=true
    }
  }
  useEffect(()=>{
    alive.current=true
    const reset=event=>{if(event.detail!==userId)return;resetting.current=true;blocked.current=true;loadVersion.current++;clearTimeout(timer.current);try{localStorage.removeItem(storageKey)}catch{}}
    window.addEventListener('workspace-reset',reset);load()
    return()=>{alive.current=false;loadVersion.current++;clearTimeout(timer.current);window.removeEventListener('workspace-reset',reset);if(current.current&&generation.current!==savedGeneration.current)local()}
  },[token,userId])
  const change=updater=>{
    const next=typeof updater==='function'?updater(current.current):updater
    if(!next||next===current.current||resetting.current)return
    current.current=next;generation.current++;setLayout(next);local();if(!blocked.current)setStatus('unsaved');clearTimeout(timer.current);timer.current=setTimeout(save,900)
  }
  const keepLocal=async()=>{
    if(saving.current)return
    try{const data=await request();revision.current=data.revision;blocked.current=false;generation.current++;setError('');await save()}
    catch(error){setStatus('error');setError(error.message)}
  }
  return {layout,change,status,error,ready,save,reload:()=>load({discardLocal:true}),keepLocal}
}
