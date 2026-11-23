import {useEffect,useRef,useState} from 'react'
import {ArrowLeft,Plus,StickyNote,ImagePlus,Pin,Link2,Hand,MousePointer2,Undo2,Redo2,Trash2,ZoomIn,ZoomOut,Maximize,Download,Save,X} from 'lucide-react'
import {readApiJson} from '../lib/apiResponse'
import {downloadBlob} from '../lib/documentFormats'
import './DetectiveWalls.css'

const uid=()=>crypto.randomUUID()
const colors=['#fff1a8','#ffd0c5','#ccebd2','#cce3ff','#e1d2f5','#ffffff']
const W=12000,H=8000
const MIN_ZOOM=.02,MAX_ZOOM=3
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n))
const typing=target=>target.closest('input,textarea,select,[contenteditable="true"]')
const wallId=()=>/^#\/detective-wall\/([a-f\d]{24})$/i.exec(window.location.hash)?.[1]||null
async function request(token,path,options={}){
  const response=await fetch(path,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...options.headers}})
  const data=await readApiJson(response)
  if(!response.ok)throw new Error(data.message||'The wall could not be saved.')
  return data
}
async function photoData(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Choose a PNG, JPEG or WebP photo.')
  if(file.size>15*1024*1024)throw new Error('Choose a photo smaller than 15 MB.')
  const image=await createImageBitmap(file)
  try{
    const factor=Math.min(1,1400/Math.max(image.width,image.height)),canvas=document.createElement('canvas')
    canvas.width=Math.max(1,Math.round(image.width*factor));canvas.height=Math.max(1,Math.round(image.height*factor))
    const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height)
    const data=canvas.toDataURL('image/jpeg',.82)
    if(data.length>2800000)throw new Error('This photo is too large. Choose a smaller image.')
    return {image:data,ratio:canvas.height/canvas.width}
  }finally{image.close()}
}

export default function DetectiveWalls({token,userId}){
  const [id,setId]=useState(wallId),[walls,setWalls]=useState([]),[name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[version,setVersion]=useState(0)
  const creating=useRef(false)
  const [deleting,setDeleting]=useState(null)
  useEffect(()=>{const change=()=>setId(wallId());window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change)},[])
  useEffect(()=>{
    if(id)return
    const controller=new AbortController();setBusy(true);setError('')
    request(token,'/api/detective-walls',{signal:controller.signal}).then(data=>{if(!controller.signal.aborted)setWalls(data)}).catch(error=>{if(!controller.signal.aborted)setError(error.message)}).finally(()=>{if(!controller.signal.aborted)setBusy(false)})
    return()=>controller.abort()
  },[id,token,version])
  const create=async event=>{
    event.preventDefault();if(creating.current||!name.trim())return
    creating.current=true;setBusy(true);setError('')
    try{const wall=await request(token,'/api/detective-walls',{method:'POST',body:JSON.stringify({name:name.trim()})});setName('');window.location.hash=`/detective-wall/${wall._id}`}catch(error){setError(error.message)}finally{creating.current=false;setBusy(false)}
  }
  const deleteWall=async()=>{
    if(!deleting||creating.current)return
    creating.current=true;setBusy(true);setError('')
    try{await request(token,`/api/detective-walls/${deleting._id}`,{method:'DELETE'});try{localStorage.removeItem(`detective-wall-draft:${userId}:${deleting._id}`)}catch{}setWalls(previous=>previous.filter(wall=>wall._id!==deleting._id));setDeleting(null)}catch(error){setError(error.message)}finally{creating.current=false;setBusy(false)}
  }
  if(id)return <DetectiveWallEditor key={id} id={id} token={token} userId={userId}/>
  return <section className="detective-lobby"><div className="detective-intro"><Pin size={30}/><div><h2>Follow the threads</h2><p>Build a corkboard of ideas, evidence, characters, research, or plans. Pin up sticky notes and photos, connect them with strings, and rearrange the whole story.</p><p>Your walls save to your account. Use a mouse, touch, or a pen.</p></div></div>
    <form onSubmit={create}><label htmlFor="detective-wall-name">New detective wall</label><div><input id="detective-wall-name" placeholder="The case of…" value={name} maxLength={120} onChange={event=>setName(event.target.value)} required disabled={busy}/><button disabled={busy||!name.trim()}><Plus size={16}/>Create wall</button></div></form>
    {error&&<p role="alert">{error} <button onClick={()=>setVersion(value=>value+1)}>Retry</button></p>}{busy&&<p role="status">Loading…</p>}
    {deleting&&<div className="detective-notice" role="region" aria-label="Confirm wall deletion">Delete “{deleting.name}” and all its items and strings? This cannot be undone.<button disabled={busy} onClick={deleteWall}>Delete wall</button><button disabled={busy} onClick={()=>setDeleting(null)}>Cancel</button></div>}
    <div className="detective-wall-list">{walls.map(wall=><div key={wall._id}><a href={`#/detective-wall/${wall._id}`}><Pin size={22}/><strong>{wall.name}</strong><small>Updated {new Date(wall.updatedAt).toLocaleDateString()}</small><span>Open wall →</span></a><button className="detective-wall-delete" type="button" disabled={busy} aria-label={`Delete ${wall.name}`} onClick={()=>setDeleting(wall)}><Trash2 size={15}/></button></div>)}</div>
    {!busy&&!error&&!walls.length&&<p>Create a wall to start connecting your ideas.</p>}
  </section>
}

function DetectiveWallEditor({id,token,userId}){
  const [doc,setDoc]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[status,setStatus]=useState('saved'),[localBackup,setLocalBackup]=useState(null)
  const [selected,setSelected]=useState(null),[tool,setTool]=useState('select'),[connecting,setConnecting]=useState(null),[stringColor,setStringColor]=useState('#b52b35'),[zoom,setZoom]=useState(.8),[pointer,setPointer]=useState(null),[photoBusy,setPhotoBusy]=useState(false),[history,setHistory]=useState({undo:[],redo:[]})
  const [stringWidth,setStringWidth]=useState(6)
  const [panning,setPanning]=useState(false)
  const zoomRef=useRef(.8)
  const [connectionTarget,setConnectionTarget]=useState(null),[stringHint,setStringHint]=useState('')
  const connectionSource=useRef(null)
  const viewport=useRef(null),fileInput=useRef(null),current=useRef(null),revision=useRef(0),dirty=useRef(false),queue=useRef(Promise.resolve()),gesture=useRef(null),saveRef=useRef(null),timer=useRef(null),historyRef=useRef({undo:[],redo:[]}),mounted=useRef(true)
  const cacheKey=`detective-wall-draft:${userId}:${id}`
  const cancelConnection=()=>{
    connectionSource.current=null;setConnecting(null);setConnectionTarget(null);setPointer(null);setStringHint('')
    if(gesture.current?.kind==='connection')gesture.current=null
  }
  const cache=()=>{if(!current.current)return;try{localStorage.setItem(cacheKey,JSON.stringify({revision:revision.current,doc:current.current}))}catch{/* The server copy and export remain available. */}}
  const apply=(next,record=true)=>{
    const previous=current.current;if(!previous)return
    if(record){historyRef.current={undo:[...historyRef.current.undo.slice(-19),previous],redo:[]};setHistory(historyRef.current)}
    current.current=next;dirty.current=true;setDoc(next);setStatus('unsaved')
    clearTimeout(timer.current);timer.current=setTimeout(()=>{cache();saveRef.current?.()},700)
  }
  const save=()=>{
    const operation=queue.current.catch(()=>{}).then(async()=>{
      if(!dirty.current||!current.current)return true
      const snapshot=current.current
      if(mounted.current){setStatus('saving');setError('')}
      try{
        const result=await request(token,`/api/detective-walls/${id}`,{method:'PUT',body:JSON.stringify({...snapshot,revision:revision.current})})
        revision.current=result.revision
        if(current.current===snapshot){dirty.current=false;try{localStorage.removeItem(cacheKey)}catch{}}
        else cache()
        if(mounted.current)setStatus(dirty.current?'unsaved':'saved')
        return true
      }catch(error){cache();if(mounted.current){setError(error.message);setStatus('error')}return false}
    })
    queue.current=operation;return operation
  }
  saveRef.current=save
  useEffect(()=>{
    mounted.current=true;const controller=new AbortController()
    request(token,`/api/detective-walls/${id}`,{signal:controller.signal}).then(wall=>{
      if(controller.signal.aborted)return
      const snapshot={name:wall.name,state:wall.state};current.current=snapshot;revision.current=wall.revision;setDoc(snapshot)
      try{const cached=JSON.parse(localStorage.getItem(cacheKey)||'null');if(cached?.doc?.state)setLocalBackup(cached.doc)}catch{}
    }).catch(error=>{if(!controller.signal.aborted)setError(error.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    const unload=event=>{if(dirty.current){cache();event.preventDefault();event.returnValue=''}}
    window.addEventListener('beforeunload',unload)
    return()=>{mounted.current=false;controller.abort();window.removeEventListener('beforeunload',unload);clearTimeout(timer.current);if(dirty.current){cache();saveRef.current?.()}}
  },[id,token])
  const changeNode=(nodeId,patch,record=true)=>apply({...current.current,state:{...current.current.state,nodes:current.current.state.nodes.map(node=>node.id===nodeId?{...node,...patch}:node)}},record)
  const add=(type,extra={})=>{
    if(current.current.state.nodes.length>=200){setError('This wall has 200 items. Start another wall to keep things responsive.');return}
    const view=viewport.current,nodeId=uid(),width=type==='pin'?70:type==='photo'?270:230,height=type==='pin'?70:type==='photo'?230:190
    const node={id:nodeId,type,x:clamp((view.scrollLeft+view.clientWidth/2)/zoom-width/2,0,W-width),y:clamp((view.scrollTop+view.clientHeight/2)/zoom-height/2,0,H-height),width,height,rotation:0,color:type==='note'?'#fff1a8':type==='pin'?'#bc343a':'#ffffff',text:'',...extra}
    apply({...current.current,state:{...current.current.state,nodes:[...current.current.state.nodes,node]}});setSelected({type:'node',id:nodeId});setTool('select');cancelConnection();setStringHint('')
  }
  const addPhoto=async file=>{
    if(!file||photoBusy)return
    setPhotoBusy(true);setError('')
    try{const data=await photoData(file);add('photo',{image:data.image,height:clamp(270*data.ratio+64,120,700)})}catch(error){setError(error.message)}finally{setPhotoBusy(false)}
  }
  const remove=()=>{
    if(!selected)return
    const state=current.current.state
    apply({...current.current,state:{nodes:state.nodes.filter(node=>selected.type!=='node'||node.id!==selected.id),strings:state.strings.filter(edge=>selected.type==='node'?edge.from!==selected.id&&edge.to!==selected.id:edge.id!==selected.id)}})
    setSelected(null);cancelConnection()
  }
  const undo=redo=>{
    const from=redo?'redo':'undo',to=redo?'undo':'redo',entries=historyRef.current[from]
    if(!entries.length)return
    const snapshot=entries[entries.length-1]
    historyRef.current={...historyRef.current,[from]:entries.slice(0,-1),[to]:[...historyRef.current[to],current.current]};setHistory(historyRef.current);apply(snapshot,false);setSelected(null);cancelConnection()
  }
  useEffect(()=>{
    const key=event=>{
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();saveRef.current?.();return}
      if(event.key==='Escape'){cancelConnection();setSelected(null);setTool('select');setStringHint('');return}
      if(typing(event.target))return
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undo(event.shiftKey)}
      else if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();remove()}
      else if(selected?.type==='node'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
        const node=current.current?.state.nodes.find(item=>item.id===selected.id)
        if(!node)return
        event.preventDefault();const step=event.shiftKey?20:5
        changeNode(node.id,{x:clamp(node.x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0),0,W-node.width),y:clamp(node.y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0),0,H-node.height)})
      }
    }
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)
  })
  const point=event=>{const rect=viewport.current.getBoundingClientRect();return {x:(event.clientX-rect.left+viewport.current.scrollLeft)/zoom,y:(event.clientY-rect.top+viewport.current.scrollTop)/zoom}}
  const beginConnection=node=>{
    connectionSource.current=node.id;setConnecting(node.id);setSelected({type:'node',id:node.id})
    setConnectionTarget(null);setPointer(anchor(node));setStringHint('')
  }
  const completeConnection=(from,to)=>{
    if(from===to)return false
    const state=current.current.state
    if(!state.nodes.some(node=>node.id===from)||!state.nodes.some(node=>node.id===to))return false
    const existing=state.strings.find(edge=>(edge.from===from&&edge.to===to)||(edge.to===from&&edge.from===to))
    if(!existing&&state.strings.length>=500){setError('Use up to 500 strings per wall.');cancelConnection();return false}
    const edge=existing||{id:uid(),from,to,color:stringColor,text:'',width:stringWidth}
    if(!existing)apply({...current.current,state:{...state,strings:[...state.strings,edge]}})
    cancelConnection();setSelected({type:'string',id:edge.id});setTool('select')
    setStringHint(existing?'These items are already connected. Edit their string below.':'Connected! Change the label, color or thickness below.')
    return true
  }
  const connect=node=>{
    const source=connectionSource.current
    if(!source){beginConnection(node);return}
    if(source===node.id){cancelConnection();return}
    completeConnection(source,node.id)
  }
  const targetAt=event=>{
    const source=connectionSource.current
    const elements=document.elementsFromPoint(event.clientX,event.clientY)
    for(const element of elements){
      const card=element.closest('[data-wall-node]')
      if(card&&viewport.current?.contains(card)&&card.dataset.wallNode!==source)return card.dataset.wallNode
    }
    const p=point(event)
    let nearest=null,distance=32/zoom
    for(const node of current.current.state.nodes){
      if(node.id===source)continue
      const a=anchor(node),d=Math.hypot(a.x-p.x,a.y-p.y)
      if(d<distance){nearest=node.id;distance=d}
    }
    return nearest
  }
  const startConnection=(event,node)=>{
    event.stopPropagation();if(event.button===1){startPan(event);return}if(event.button!==0)return
    if(tool==='pan'){startPan(event);return}
    event.preventDefault()
    if(connectionSource.current&&connectionSource.current!==node.id){completeConnection(connectionSource.current,node.id);return}
    const previous=connectionSource.current===node.id
    beginConnection(node)
    gesture.current={kind:'connection',from:node.id,x:event.clientX,y:event.clientY,moved:false,previous,pointerId:event.pointerId,target:null}
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const startNode=(event,node,resize=false)=>{
    event.stopPropagation();if(event.button===1){startPan(event);return}if(event.button!==0)return
    if(tool==='string'||connectionSource.current){event.preventDefault();connect(node);return}
    if(tool==='pan'){startPan(event);return}
    event.preventDefault();setSelected({type:'node',id:node.id});setStringHint('')
    historyRef.current={undo:[...historyRef.current.undo.slice(-19),current.current],redo:[]};setHistory(historyRef.current)
    gesture.current={kind:resize?'resize':'node',node,start:point(event),pointerId:event.pointerId};event.currentTarget.setPointerCapture(event.pointerId)
  }
  const startPan=event=>{
    if(event.button!==0&&event.button!==1)return
    event.preventDefault();setPanning(true)
    gesture.current={kind:'pan',x:event.clientX,y:event.clientY,left:viewport.current.scrollLeft,top:viewport.current.scrollTop,pointerId:event.pointerId}
    viewport.current.setPointerCapture(event.pointerId)
  }
  const move=event=>{
    if(connectionSource.current){
      const target=targetAt(event),node=current.current.state.nodes.find(item=>item.id===target)
      setConnectionTarget(target);setPointer(node?anchor(node):point(event))
      if(gesture.current?.kind==='connection')gesture.current.target=target
    }
    const drag=gesture.current;if(!drag||drag.pointerId!==event.pointerId)return
    if(drag.kind==='connection'){if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>5)drag.moved=true;return}
    if(drag.kind==='pan'){viewport.current.scrollLeft=drag.left+drag.x-event.clientX;viewport.current.scrollTop=drag.top+drag.y-event.clientY;return}
    const p=point(event),dx=p.x-drag.start.x,dy=p.y-drag.start.y
    const angle=drag.node.rotation*Math.PI/180
    changeNode(drag.node.id,drag.kind==='resize'?{width:clamp(drag.node.width+dx*Math.cos(angle)+dy*Math.sin(angle),60,1200),height:clamp(drag.node.height-dx*Math.sin(angle)+dy*Math.cos(angle),60,1400)}:{x:clamp(drag.node.x+dx,0,W-drag.node.width),y:clamp(drag.node.y+dy,0,H-drag.node.height)},false)
  }
  const end=event=>{
    const drag=gesture.current
    if(!drag||drag.pointerId!==event.pointerId)return
    gesture.current=null
    if(drag.kind==='pan')setPanning(false)
    if(drag.kind!=='connection')return
    if(drag.moved){
      const target=targetAt(event)
      if(target)completeConnection(drag.from,target)
      else{cancelConnection();setStringHint('No connection made. Drop onto another item, or click a pin and then another item.')}
    }else if(drag.previous)cancelConnection()
  }
  const cancelGesture=()=>{if(gesture.current?.kind==='connection')cancelConnection();gesture.current=null;setPanning(false)}
  const zoomTo=(value,location=null)=>{
    const view=viewport.current;if(!view)return
    const next=clamp(value,MIN_ZOOM,MAX_ZOOM),rect=view.getBoundingClientRect()
    const x=location?location.x-rect.left:view.clientWidth/2,y=location?location.y-rect.top:view.clientHeight/2
    const cx=(view.scrollLeft+x)/zoomRef.current,cy=(view.scrollTop+y)/zoomRef.current
    zoomRef.current=next;setZoom(next)
    requestAnimationFrame(()=>{if(viewport.current===view){view.scrollLeft=cx*next-x;view.scrollTop=cy*next-y}})
  }
  useEffect(()=>{
    const view=viewport.current;if(!view)return
    const wheel=event=>{
      event.preventDefault()
      const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?view.clientHeight:1)
      if(delta)zoomTo(zoomRef.current*Math.exp(-delta*.002),{x:event.clientX,y:event.clientY})
    }
    let pinch=null
    const touchStart=event=>{
      if(event.touches.length!==2)return
      event.preventDefault();cancelGesture()
      const [a,b]=event.touches
      pinch={distance:Math.max(1,Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)),zoom:zoomRef.current}
    }
    const touchMove=event=>{
      if(!pinch||event.touches.length!==2)return
      event.preventDefault();const [a,b]=event.touches
      zoomTo(pinch.zoom*Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)/pinch.distance,{x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2})
    }
    const touchEnd=event=>{if(event.touches.length<2)pinch=null}
    view.addEventListener('wheel',wheel,{passive:false})
    view.addEventListener('touchstart',touchStart,{passive:false})
    view.addEventListener('touchmove',touchMove,{passive:false})
    view.addEventListener('touchend',touchEnd)
    view.addEventListener('touchcancel',touchEnd)
    return()=>{view.removeEventListener('wheel',wheel);view.removeEventListener('touchstart',touchStart);view.removeEventListener('touchmove',touchMove);view.removeEventListener('touchend',touchEnd);view.removeEventListener('touchcancel',touchEnd)}
  },[loading])
  const fit=(wholeBoard=false)=>{
    const nodes=current.current.state.nodes,view=viewport.current
    if(!view)return
    const bounds=nodes.map(node=>{
      const angle=node.rotation*Math.PI/180,w=Math.abs(node.width*Math.cos(angle))+Math.abs(node.height*Math.sin(angle)),h=Math.abs(node.width*Math.sin(angle))+Math.abs(node.height*Math.cos(angle))
      return {left:node.x+node.width/2-w/2,top:node.y+node.height/2-h/2,right:node.x+node.width/2+w/2,bottom:node.y+node.height/2+h/2}
    })
    const left=wholeBoard||!bounds.length?0:Math.min(...bounds.map(b=>b.left))-60,top=wholeBoard||!bounds.length?0:Math.min(...bounds.map(b=>b.top))-60
    const right=wholeBoard||!bounds.length?W:Math.max(...bounds.map(b=>b.right))+60,bottom=wholeBoard||!bounds.length?H:Math.max(...bounds.map(b=>b.bottom))+60
    const next=clamp(Math.min((view.clientWidth-32)/(right-left),(view.clientHeight-32)/(bottom-top)),MIN_ZOOM,1)
    zoomRef.current=next;setZoom(next)
    requestAnimationFrame(()=>view.scrollTo(Math.max(0,(left+right)*next/2-view.clientWidth/2),Math.max(0,(top+bottom)*next/2-view.clientHeight/2)))
  }
  const leave=async()=>{clearTimeout(timer.current);if(await save())window.location.hash='/detective-wall'}
  const exportWall=()=>downloadBlob(new Blob([JSON.stringify(current.current,null,2)],{type:'application/json'}),`${current.current.name.replace(/[<>:"/\\|?*]/g,'-')||'Detective wall'}.json`)
  if(loading)return <p role="status">Opening detective wall…</p>
  if(!doc)return <div className="detective-lobby"><p role="alert">{error}</p><a href="#/detective-wall">Back to walls</a></div>
  const activeNode=selected?.type==='node'?doc.state.nodes.find(node=>node.id===selected.id):null
  const activeString=selected?.type==='string'?doc.state.strings.find(edge=>edge.id===selected.id):null
  const nodes=new Map(doc.state.nodes.map(node=>[node.id,node]))
  const anchor=node=>{const angle=node.rotation*Math.PI/180,dy=14-node.height/2;return {x:node.x+node.width/2-dy*Math.sin(angle),y:node.y+node.height/2+dy*Math.cos(angle)}}
  const path=(a,b)=>`M ${a.x} ${a.y} Q ${(a.x+b.x)/2} ${(a.y+b.y)/2+Math.min(140,Math.abs(a.x-b.x)*.12+35)} ${b.x} ${b.y}`
  const start=connecting&&nodes.get(connecting)?anchor(nodes.get(connecting)):null
  return <section className="detective-editor" aria-label="Interactive detective wall">
    <header className="detective-header"><button type="button" onClick={leave} title="Back to walls"><ArrowLeft size={18}/></button><input aria-label="Wall name" maxLength={120} value={doc.name} onFocus={()=>{historyRef.current={undo:[...historyRef.current.undo.slice(-19),current.current],redo:[]};setHistory(historyRef.current)}} onChange={event=>apply({...current.current,name:event.target.value},false)}/><span role="status">{status==='saving'?'Saving…':status==='saved'?'Saved':status==='error'?'Save failed':'Unsaved changes'}</span><button type="button" onClick={save}><Save size={16}/><span>Save</span></button><button type="button" onClick={exportWall} title="Export wall backup"><Download size={16}/><span>Backup</span></button></header>
    <div className="detective-toolbar" role="toolbar" aria-label="Wall tools">
      <button type="button" aria-pressed={tool==='select'} onClick={()=>{setTool('select');cancelConnection();setStringHint('')}}><MousePointer2 size={16}/>Select</button><button type="button" aria-pressed={tool==='pan'} onClick={()=>{setTool('pan');cancelConnection();setStringHint('')}}><Hand size={16}/>Pan</button>
      <button type="button" onClick={()=>add('note')}><StickyNote size={16}/>Sticky note</button><button type="button" disabled={photoBusy} onClick={()=>fileInput.current.click()}><ImagePlus size={16}/>{photoBusy?'Adding…':'Photo'}</button><button type="button" onClick={()=>add('pin')}><Pin size={16}/>Thumbtack</button>
      <button type="button" aria-pressed={tool==='string'||!!connecting} onClick={()=>{cancelConnection();setStringHint('');setTool(tool==='string'?'select':'string')}} title="Connect two items, or drag directly from any pin"><Link2 size={16}/>Connect items</button>
      {(tool==='string'||connecting)&&<div className="detective-new-string-settings" role="group" aria-label="New string appearance">
        <label className="detective-color">Color<input aria-label="New string color" type="color" value={stringColor} onChange={event=>setStringColor(event.target.value)}/></label>
        <label className="detective-string-size">Thickness<input aria-label="New string thickness" type="range" min="1" max="24" step="1" value={stringWidth} onChange={event=>setStringWidth(Number(event.target.value))}/><output>{stringWidth} px</output></label>
      </div>}
      <button type="button" disabled={!history.undo.length} onClick={()=>undo(false)} title="Undo (Ctrl+Z)"><Undo2 size={16}/></button><button type="button" disabled={!history.redo.length} onClick={()=>undo(true)} title="Redo (Ctrl+Shift+Z)"><Redo2 size={16}/></button><button type="button" disabled={!selected} onClick={remove} title="Delete selected item or string"><Trash2 size={16}/></button>
    </div>
    <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event=>{const file=event.target.files?.[0];event.target.value='';addPhoto(file)}}/>
    {error&&<div className="detective-notice" role="alert">{error}<button type="button" onClick={save}>Retry save</button><button type="button" onClick={()=>setError('')} aria-label="Dismiss error"><X size={15}/></button></div>}
    {localBackup&&<div className="detective-notice">An unsaved local draft is available.<button type="button" onClick={()=>{apply(localBackup);setLocalBackup(null)}}>Restore draft</button><button type="button" onClick={()=>{setLocalBackup(null);try{localStorage.removeItem(cacheKey)}catch{}}}>Keep server version</button></div>}
    <div className={`detective-hint${connecting?' is-connecting':''}`}>
      <span role="status">{connecting?`Connect “${nodes.get(connecting)?.text.slice(0,35)||nodes.get(connecting)?.type||'item'}” → ${connectionTarget?'Release or click to connect.':'Choose another item, or drag to its pin.'}`:tool==='string'?'Choose the first item, then the second. You can also drag from any pin to another item.':stringHint|| (tool==='pan'?'Drag to pan · Wheel to zoom · Use the scrollbars to move around the board.':'Drag empty board space to pan · Wheel to zoom · Drag a pin to connect items')}</span>
      {(connecting||tool==='string')&&<button type="button" onClick={()=>{cancelConnection();setTool('select');setStringHint('')}}>Cancel connection <span aria-hidden="true">Esc</span></button>}
    </div>
    <div className="detective-board-zoom" role="group" aria-label="Board zoom">
      <button type="button" onClick={()=>zoomTo(zoomRef.current/1.25)} disabled={zoom<=MIN_ZOOM} aria-label="Zoom out" title="Zoom out"><ZoomOut size={17}/></button>
      <label><span>Zoom</span><input aria-label="Board zoom percentage" type="range" min="2" max="300" step="1" value={Math.round(zoom*100)} onChange={event=>zoomTo(Number(event.target.value)/100)}/><output>{Math.round(zoom*100)}%</output></label>
      <button type="button" onClick={()=>zoomTo(zoomRef.current*1.25)} disabled={zoom>=MAX_ZOOM} aria-label="Zoom in" title="Zoom in"><ZoomIn size={17}/></button>
      <button type="button" onClick={()=>fit(false)} title="Fit all notes and photos"><Maximize size={16}/>Fit items</button>
      <button type="button" onClick={()=>fit(true)}>Whole board</button>
      <button type="button" onClick={()=>zoomTo(1)}>100%</button>
    </div>
    <div ref={viewport} className={`detective-viewport tool-${tool}${panning?' is-panning':'}`} tabIndex={0} aria-label="Corkboard. Drag empty space to pan; use the wheel to zoom." onPointerDown={event=>{if(event.button===1||tool==='pan')startPan(event);else if(event.button===0&&(event.target===event.currentTarget||event.target.dataset.wallBackground)){setSelected(null);cancelConnection();setStringHint('');startPan(event)}}} onPointerMove={move} onPointerUp={end} onPointerCancel={cancelGesture} onLostPointerCapture={cancelGesture} onDragOver={event=>{if(event.dataTransfer.types.includes('Files'))event.preventDefault()}} onDrop={event=>{event.preventDefault();addPhoto([...event.dataTransfer.files].find(file=>file.type.startsWith('image/')))}} onPaste={event=>{if(typing(event.target))return;const file=[...event.clipboardData.files].find(file=>file.type.startsWith('image/'));if(file){event.preventDefault();addPhoto(file)}}}>
      <div className="detective-world-size" data-wall-background="true" style={{width:W*zoom,height:H*zoom}}><div className="detective-world" data-wall-background="true" style={{width:W,height:H,transform:`scale(${zoom})`}}>
        <svg className="detective-strings" width={W} height={H} aria-label="Connections">
          {doc.state.strings.map(edge=>{
            const from=nodes.get(edge.from),to=nodes.get(edge.to)
            if(!from||!to)return null
            const a=anchor(from),b=anchor(to),d=path(a,b)
            return <g key={edge.id} className={selected?.id===edge.id?'is-selected':''} onPointerDown={event=>{if(tool==='pan'||connectionSource.current)return;event.stopPropagation();setSelected({type:'string',id:edge.id});setStringHint('Edit this string below.')}} style={{'--string-width':`${edge.width??6}px`}}>
              <path className="detective-string-shadow" d={d}/>
              <path className="detective-string" d={d} stroke={edge.color}/>
              <path
                className="detective-string-hit" d={d} tabIndex={0} role="button"
                aria-label={edge.text||`String between ${from.text.slice(0,30)||from.type} and ${to.text.slice(0,30)||to.type}`}
                onPointerDown={event=>{
                  if(tool==='pan'||connectionSource.current)return
                  event.stopPropagation()
                  setSelected({type:'string',id:edge.id})
                  setStringHint('Edit this string below.')
                }}
                onKeyDown={event=>{
                  if(event.key==='Enter'||event.key===' '){
                    event.preventDefault()
                    setSelected({type:'string',id:edge.id})
                  }
                }}
              />
              {edge.text&&<text x={(a.x+b.x)/2} y={(a.y+b.y)/2+Math.min(140,Math.abs(a.x-b.x)*.12+35)/2-9}>{edge.text}</text>}
            </g>
          })}
          {start&&pointer&&<path className="detective-string-preview" d={path(start,pointer)} stroke={stringColor} style={{'--string-width':`${stringWidth}px`}}/>}
        </svg>
        {doc.state.nodes.map(node=><article
          key={node.id} data-wall-node={node.id}
          className={`detective-item is-${node.type}${selected?.id===node.id?' is-selected':''}${connecting===node.id?' is-connecting':''}${connectionTarget===node.id?' is-connection-target':''}${activeString&&(activeString.from===node.id||activeString.to===node.id)?' is-string-endpoint':''}`}
          style={{left:node.x,top:node.y,width:node.width,height:node.height,background:node.color,'--tack-color':node.type==='pin'?node.color:'#c83431',transform:`rotate(${node.rotation}deg)`}}
          onPointerDown={event=>{
            if(tool==='string'||connectionSource.current){event.preventDefault();event.stopPropagation();connect(node)}
            else if(tool!=='pan')setSelected({type:'node',id:node.id})
          }}
        >
          <button type="button" className="detective-item-grip" aria-label={`Move or connect ${node.type}: ${node.text.slice(0,60)||'Untitled'}`} onPointerDown={event=>startNode(event,node)} onClick={event=>{if(event.detail===0){if(tool==='string'||connectionSource.current)connect(node);else setSelected({type:'node',id:node.id})}}}><span>{node.type==='photo'?'PHOTO':node.type==='pin'?(node.text||'PIN'):'NOTE'}</span></button>
          <button
            type="button" className="detective-connect-pin"
            title={connecting&&connecting!==node.id?'Connect to this item':'Drag to another item, or click to start a connection'}
            aria-label={`Connect string: ${node.text.slice(0,60)||node.type}`}
            aria-pressed={connecting===node.id}
            onPointerDown={event=>startConnection(event,node)}
            onClick={event=>{if(event.detail===0)connect(node)}}
          ><i className="detective-tack" aria-hidden="true"/><span className="detective-pin-plus" aria-hidden="true">+</span></button>
          {node.type==='photo'&&<img src={node.image} alt={node.text||'Pinned photo'} draggable={false}/>}
          {node.type!=='pin'&&<textarea aria-label={node.type==='photo'?'Photo caption':'Sticky note text'} placeholder={node.type==='photo'?'Add a caption…':'What’s the connection?'} maxLength={3000} value={node.text} onFocus={()=>{setSelected({type:'node',id:node.id});historyRef.current={undo:[...historyRef.current.undo.slice(-19),current.current],redo:[]};setHistory(historyRef.current)}} onChange={event=>changeNode(node.id,{text:event.target.value},false)}/>}
          {node.type!=='pin'&&<button type="button" className="detective-resize" aria-label="Resize item" onPointerDown={event=>startNode(event,node,true)}/>}
        </article>)}
      </div></div>
    </div>
    {(activeNode||activeString)&&<div className="detective-properties"><strong>{activeString?'String':activeNode.type==='photo'?'Photo':activeNode.type==='pin'?'Thumbtack':'Sticky note'}</strong>
      {activeString&&<span className="detective-connection-summary" title="Connected items">{nodes.get(activeString.from)?.text.slice(0,30)||nodes.get(activeString.from)?.type} ↔ {nodes.get(activeString.to)?.text.slice(0,30)||nodes.get(activeString.to)?.type}</span>}
      {activeNode&&<><div className="detective-swatches">{colors.map(color=><button key={color} type="button" style={{background:color}} aria-label={`Set item color ${color}`} aria-pressed={activeNode.color===color} onClick={()=>changeNode(activeNode.id,{color})}/>)}</div><label>Color<input type="color" value={activeNode.color} onChange={event=>changeNode(activeNode.id,{color:event.target.value})}/></label><label>Rotate<input type="range" min="-30" max="30" value={activeNode.rotation} onPointerDown={()=>{historyRef.current={undo:[...historyRef.current.undo.slice(-19),current.current],redo:[]};setHistory(historyRef.current)}} onChange={event=>changeNode(activeNode.id,{rotation:Number(event.target.value)},false)}/></label>{activeNode.type==='pin'&&<label>Label<input value={activeNode.text} maxLength={160} onChange={event=>changeNode(activeNode.id,{text:event.target.value})}/></label>}<button type="button" onClick={()=>{setTool('string');beginConnection(activeNode)}}><Link2 size={15}/>Connect from here</button></>}
      {activeString&&<><label className="detective-string-size">Thickness<input aria-label="Selected string thickness" type="range" min="1" max="24" step="1" value={activeString.width??6} onFocus={()=>{historyRef.current={undo:[...historyRef.current.undo.slice(-19),current.current],redo:[]};setHistory(historyRef.current)}} onChange={event=>apply({...current.current,state:{...current.current.state,strings:current.current.state.strings.map(edge=>edge.id===activeString.id?{...edge,width:Number(event.target.value)}:edge)}},false)}/><output>{activeString.width??6} px</output></label><label>Label<input value={activeString.text} maxLength={160} onChange={event=>apply({...current.current,state:{...current.current.state,strings:current.current.state.strings.map(edge=>edge.id===activeString.id?{...edge,text:event.target.value}:edge)}})}/></label><label>Color<input type="color" value={activeString.color} onChange={event=>apply({...current.current,state:{...current.current.state,strings:current.current.state.strings.map(edge=>edge.id===activeString.id?{...edge,color:event.target.value}:edge)}})}/></label></>}
      <button type="button" onClick={remove}><Trash2 size={15}/>Remove</button><button type="button" aria-label="Close item settings" onClick={()=>setSelected(null)}><X size={16}/></button>
    </div>}
  </section>
}
