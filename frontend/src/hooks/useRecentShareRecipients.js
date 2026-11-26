import {useEffect,useState} from 'react'
import {useAuth} from '../contexts/AuthContext'

const limit=8
const changed='recent-share-recipients-changed'

function read(key){
  if(!key)return []
  try{
    const items=JSON.parse(localStorage.getItem(key)||'[]')
    return Array.isArray(items)?items.filter(item=>typeof item==='string').slice(0,limit):[]
  }catch{return []}
}

export default function useRecentShareRecipients(){
  const {user}=useAuth()
  const id=user?.id??user?._id
  const key=id?'recent-share-recipients:'+id:null
  const [state,setState]=useState(()=>({key,emails:read(key)}))

  useEffect(()=>{
    const refresh=event=>{
      if(event.type==='storage'&&event.key!==null&&event.key!==key)return
      if(event.type===changed&&event.detail.key!==key)return
      setState({key,emails:event.type===changed?event.detail.emails:read(key)})
    }
    setState({key,emails:read(key)})
    window.addEventListener(changed,refresh)
    window.addEventListener('storage',refresh)
    return()=>{
      window.removeEventListener(changed,refresh)
      window.removeEventListener('storage',refresh)
    }
  },[key])

  const emails=state.key===key?state.emails:[]
  const update=next=>{
    if(!key)return
    try{
      if(next.length)localStorage.setItem(key,JSON.stringify(next))
      else localStorage.removeItem(key)
    }catch{/* Keep the list available in this session. */}
    window.dispatchEvent(new CustomEvent(changed,{detail:{key,emails:next}}))
  }

  return {
    emails,
    remember:address=>{
      const email=address.trim()
      if(!email||email.length>254)return
      update([email,...emails.filter(previous=>previous.toLowerCase()!==email.toLowerCase())].slice(0,limit))
    },
    clear:()=>update([])
  }
}
