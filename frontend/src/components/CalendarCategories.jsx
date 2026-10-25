import {useState} from 'react'
import {readApiJson} from '../lib/apiResponse'

export default function CalendarCategories({categories,token,disabled,onChange,onCreated,onAdd}){
  const [editing,setEditing]=useState(null),[name,setName]=useState(''),[color,setColor]=useState('#728db3'),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const mutate=async(method,id)=>{
    if(busy||disabled)return
    setBusy(true);setError('')
    try{
      const response=await fetch(`/api/calendar/categories${id?`/${id}`:''}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:method==='DELETE'?undefined:JSON.stringify({name,color})}),data=await readApiJson(response)
      if(!response.ok)throw new Error(data.message||'Could not update categories.')
      onChange(data.categories);if(method==='POST')onCreated?.(data.category)
      setEditing(null);setName('');window.dispatchEvent(new Event('calendar-changed'))
    }catch(error){setError(error.message)}finally{setBusy(false)}
  }
  return <details className="calendar-category-manager"><summary>Your calendar categories</summary><p>Create topics such as Work, Fitness, Family or F1. Assign them when creating or editing events. Individual event colors override category colors.</p>
    <form onSubmit={event=>{event.preventDefault();mutate(editing?'PUT':'POST',editing)}}><label>{editing?'Rename category':'New category'}<input value={name} maxLength={60} required disabled={busy||disabled} onChange={event=>setName(event.target.value)} placeholder="Category name"/></label><label>Color<input type="color" value={color} disabled={busy||disabled} onChange={event=>setColor(event.target.value)}/></label><button disabled={busy||disabled||!name.trim()} type="submit">{editing?'Save category':'Create category'}</button>{editing&&<button type="button" disabled={busy||disabled} onClick={()=>{setEditing(null);setName('')}}>Cancel</button>}</form>
    {error&&<p role="alert" className="calendar-category-error">{error}</p>}
    <div className="calendar-category-list">{categories.map(category=><div key={category.id}><span><i style={{background:category.color}}/>{category.name}</span><button type="button" disabled={busy||disabled} onClick={()=>onAdd(category.id)}>Add event</button><button type="button" disabled={busy||disabled} onClick={()=>{setEditing(category.id);setName(category.name);setColor(category.color);setError('')}}>Edit</button><button type="button" disabled={busy||disabled} onClick={()=>mutate('DELETE',category.id)}>Delete</button></div>)}</div>
  </details>
}
