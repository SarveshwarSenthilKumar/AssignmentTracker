import {useEffect,useState} from 'react'
import {readApiJson} from '../lib/apiResponse'

export async function friendRequest(token,path,options={}){
  const response=await fetch(path,{
    ...options,cache:'no-store',
    headers:{Authorization:'Bearer '+token,...(options.body&&{'Content-Type':'application/json'})}
  })
  if(response.status===204)return null
  const data=await readApiJson(response)
  if(!response.ok)throw new Error(data.message||'Could not complete the request.')
  return data
}

const changed='friendships-changed'
export const refreshFriends=()=>window.dispatchEvent(new Event(changed))

export default function useFriends(token){
  const [friends,setFriends]=useState([]),[version,setVersion]=useState(0)
  const [loading,setLoading]=useState(true),[error,setError]=useState('')
  useEffect(()=>{
    if(!token)return
    const controller=new AbortController()
    setLoading(true);setError('')
    friendRequest(token,'/api/friends',{signal:controller.signal})
      .then(data=>{if(!controller.signal.aborted)setFriends(data)})
      .catch(error=>{if(!controller.signal.aborted)setError(error.message)})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return()=>controller.abort()
  },[token,version])
  useEffect(()=>{
    const refresh=()=>setVersion(value=>value+1)
    window.addEventListener(changed,refresh)
    window.addEventListener('focus',refresh)
    return()=>{
      window.removeEventListener(changed,refresh)
      window.removeEventListener('focus',refresh)
    }
  },[])
  return {friends,loading,error}
}
