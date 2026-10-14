import React,{useEffect} from 'react'
import {createRoot} from 'react-dom/client'
import App from './App'
import {AuthProvider,useAuth} from './contexts/AuthContext'
import {calendarDay,shiftDay} from './lib/calendar'
import './index.css'
const original={token:localStorage.getItem('token'),user:localStorage.getItem('user')}
window.addEventListener('beforeunload',()=>{for(const key of ['token','user'])original[key]===null?localStorage.removeItem(key):localStorage.setItem(key,original[key])})
const today=calendarDay(new Date()),at=(offset,time='17:00')=>new Date(`${shiftDay(today,offset)}T${time}`).toISOString()
let tasks=[...['Research methods assignment','Review presentation draft','Submit lab report','Read chapter notes','Complete practice problems','Project checkpoint','Prepare discussion notes','Final essay outline','Review feedback','Library workshop'].map((text,index)=>({_id:index.toString(16).padStart(24,'0'),text,status:index===3?'completed':index===1?'in-progress':'todo',folder:'coursework',dueDate:at(index-2),canvasType:index%2?'assignment':null,createdAt:new Date().toISOString()})),{_id:'b'.padStart(24,'0'),text:'Plan next semester',status:'todo',dueDate:null}]
let entries=[{_id:'e1'.padStart(24,'0'),title:'Project review meeting',kind:'appointment',allDay:false,startAt:at(0,'14:00'),endAt:at(0,'15:00'),notes:'Discuss the next delivery milestone.',location:'Library · room 204',done:false},{_id:'e2'.padStart(24,'0'),title:'Reading week',kind:'marker',allDay:true,startDate:shiftDay(today,3),endDate:shiftDay(today,5),notes:'Set aside time for coursework.',location:'',done:false}]
let next=3
window.fetch=async(url,options={})=>{
 let data=[],status=200
 if(url==='/api/todos')data=tasks
 if(url==='/api/folders')data=[{_id:'coursework',name:'Coursework'}]
 if(url==='/api/user/canvas')data={hasCredentials:true,canvasUrl:'https://school.example.test',lastCanvasSync:new Date().toISOString()}
 if(url==='/api/calendar-entries'){
  if(options.method==='POST'){data={...JSON.parse(options.body),_id:`e${next++}`.padStart(24,'0')};entries=[...entries,data];status=201}else data=entries
 }
 if(String(url).startsWith('/api/calendar-entries/')){const id=String(url).split('/')[3];if(options.method==='PUT'){data={...entries.find(entry=>entry._id===id),...JSON.parse(options.body)};entries=entries.map(entry=>entry._id===id?data:entry)}else if(options.method==='DELETE'){entries=entries.filter(entry=>entry._id!==id);data={id}}}
 if(url==='/api/canvas/sync'){tasks=tasks.map((task,index)=>index===1?{...task,dueDate:at(3)}:task);data={syncedCount:5}}
 if(String(url).startsWith('/api/todos/')&&options.method==='PUT'){const id=String(url).split('/')[3];tasks=tasks.map(task=>task._id===id?{...task,...JSON.parse(options.body)}:task);data=tasks.find(task=>task._id===id)}
 return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})
}
function Preview(){const {login}=useAuth();useEffect(()=>{login('preview',{username:'Sample account',email:'sample@example.test'})},[]);return <App/>}
createRoot(document.getElementById('root')).render(<AuthProvider><Preview/></AuthProvider>)
