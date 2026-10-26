import { useEffect, useRef, useState } from 'react'
const empty=()=>({shortcuts:[],checklist:[],cards:[]})
function read(key,supplied){
  try{
    const value=supplied||JSON.parse(localStorage.getItem(key)||'{}')
    return {
      shortcuts:(Array.isArray(value.shortcuts)?value.shortcuts:[]).filter(item=>{try{const url=new URL(item.url);return typeof item.url==='string'&&item.url.length<=2000&&typeof item.title==='string'&&['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&url.origin!==location.origin}catch{return false}}).slice(0,24).map(item=>({id:crypto.randomUUID(),title:item.title.slice(0,40),url:item.url,mode:['embedded','reader','window','browser'].includes(item.mode)?item.mode:'embedded'})),
      checklist:(Array.isArray(value.checklist)?value.checklist:[]).filter(item=>typeof item.text==='string').slice(0,100).map(item=>({id:crypto.randomUUID(),text:item.text.slice(0,1000),done:!!item.done})),
      cards:(Array.isArray(value.cards)?value.cards:[]).filter(item=>typeof item.front==='string'&&typeof item.back==='string').slice(0,50).map(item=>({id:crypto.randomUUID(),front:item.front.slice(0,2000),back:item.back.slice(0,4000),reviews:Math.max(0,Math.min(100000,Number(item.reviews)||0))})),
    }
  }catch{return empty()}
}
export const normalizePhoneApps=value=>read('',value)
export default function usePhoneApps(userId){
  const key=`study-phone-apps:${userId}`,[data,setData]=useState(()=>read(key)),[error,setError]=useState(''),discard=useRef(false)
  useEffect(()=>{if(discard.current)return;try{localStorage.setItem(key,JSON.stringify(data));setError('')}catch{setError('App data could not be saved on this device. Export a backup before reloading.')}},[key,data])
  useEffect(()=>{const reset=event=>{if(event.detail!==userId)return;discard.current=true;setData(empty());try{localStorage.removeItem(key)}catch{}};window.addEventListener('workspace-reset',reset);return()=>window.removeEventListener('workspace-reset',reset)},[userId])
  return {data,setData,error}
}
