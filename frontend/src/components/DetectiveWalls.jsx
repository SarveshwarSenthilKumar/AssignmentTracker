import {useEffect,useRef,useState} from 'react'
import {ArrowLeft,Plus,StickyNote,ImagePlus,Pin,Link2,Hand,MousePointer2,Undo2,Redo2,Trash2,ZoomIn,ZoomOut,Maximize,Download,Save,X} from 'lucide-react'
import {readApiJson} from '../lib/apiResponse'
import {downloadBlob} from '../lib/documentFormats'
import './DetectiveWalls.css'

const uid=()=>crypto.randomUUID()
const colors=['#fff1a8','#ffd0c5','#ccebd2','#cce3ff','#e1d2f5','#ffffff']
const W=12000,H=8000
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
  const viewport=useRef(null),fileInput=useRef(null),current=useRef(null),revision=useRef(0),dirty=useRef(false),queue=useRef(Promise.resolve()),gesture=useRef(null),saveRef=useRef(null),timer=useRef(null),historyRef=useRef({undo:[],redo:[]}),mounted=useRef(true)
  const cacheKey=`detective-wall-draft:${userId}:${id}`
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
    apply({...current.current,state:{...current.current.state,nodes:[...current.current.state.nodes,node]}});setSelected({type:'node',id:nodeId});setTool('select')
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
    setSelected(null);setConnecting(null)
  }
  const undo=redo=>{
    const from=redo?'redo':'undo',to=redo?'undo':'redo',entries=historyRef.current[from]
    if(!entries.length)return
    const snapshot=entries[entries.length-1]
    historyRef.current={...historyRef.current,[from]:entries.slice(0,-1),[to]:[...historyRef.current[to],current.current]};setHistory(historyRef.current);apply(snapshot,false);setSelected(null);setConnecting(null)
  }
  useEffect(()=>{
    const key=event=>{
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();saveRef.current?.();return}
      if(event.key==='Escape'){setConnecting(null);setSelected(null);setTool('select');return}
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
  const connect=node=>{
    setSelected({type:'node',id:node.id})
    if(!connecting){setConnecting(node.id);return}
    if(connecting===node.id){setConnecting(null);return}
    const state=current.current.state
    if(state.strings.length>=500){setError('Use up to 500 strings per wall.');return}
    if(!state.strings.some(edge=>(edge.from===connecting&&edge.to===node.id)||(edge.to===connecting&&edge.from===node.id)))apply({...current.current,state:{...state,strings:[...state.strings,{id:uid(),from:connecting,to:node.id,color:stringColor,text:'',width:stringWidth}]}})
    setConnecting(null)
  }
  const startNode=(event,node,resize=false)=>{
    event.stopPropagation();if(event.button!==0)return
    if(tool==='string'){event.preventDefault();connect(node);return}
    if(tool==='pan'){startPan(event);return}
    event.preventDefault();setSelected({type:'node',id:node.id})
    historyRef.current={undo:[...historyRef.current.undo.slice(-19),current.current],redo:[]};setHistory(historyRef.current)
    gesture.current={kind:resize?'resize':'node',node,start:point(event),pointerId:event.pointerId};event.currentTarget.setPointerCapture(event.pointerId)
  }
  const startPan=event=>{
    if(event.button!==0&&event.button!==1)return
    event.preventDefault();gesture.current={kind:'pan',x:event.clientX,y:event.clientY,left:viewport.current.scrollLeft,top:viewport.current.scrollTop,pointerId:event.pointerId};event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move=event=>{
    if(connecting)setPointer(point(event))
    const drag=gesture.current;if(!drag||drag.pointerId!==event.pointerId)return
    if(drag.kind==='pan'){viewport.current.scrollLeft=drag.left+drag.x-event.clientX;viewport.current.scrollTop=drag.top+drag.y-event.clientY;return}
    const p=point(event),dx=p.x-drag.start.x,dy=p.y-drag.start.y
    const angle=drag.node.rotation*Math.PI/180
    changeNode(drag.node.id,drag.kind==='resize'?{width:clamp(drag.node.width+dx*Math.cos(angle)+dy*Math.sin(angle),60,1200),height:clamp(drag.node.height-dx*Math.sin(angle)+dy*Math.cos(angle),60,1400)}:{x:clamp(drag.node.x+dx,0,W-drag.node.width),y:clamp(drag.node.y+dy,0,H-drag.node.height)},false)
  }
  const end=()=>{gesture.current=null}
  const zoomTo=value=>{
    const view=viewport.current,next=clamp(value,.15,2),cx=(view.scrollLeft+view.clientWidth/2)/zoom,cy=(view.scrollTop+view.clientHeight/2)/zoom
    setZoom(next);requestAnimationFrame(()=>{if(viewport.current===view){view.scrollLeft=cx*next-view.clientWidth/2;view.scrollTop=cy*next-view.clientHeight/2}})
  }
  useEffect(()=>{
    const view=viewport.current;if(!view)return
    const wheel=event=>{if(event.ctrlKey||event.metaKey){event.preventDefault();zoomTo(zoom+(event.deltaY<0?.08:-.08))}}
    view.addEventListener('wheel',wheel,{passive:false})
    return()=>view.removeEventListener('wheel',wheel)
  },[zoom,loading])
  const fit=()=>{
    const nodes=current.current.state.nodes,view=viewport.current
    if(!nodes.length){setZoom(.8);view.scrollTo(0,0);return}
    const left=Math.min(...nodes.map(node=>node.x))-60,top=Math.min(...nodes.map(node=>node.y))-60,right=Math.max(...nodes.map(node=>node.x+node.width))+60,bottom=Math.max(...nodes.map(node=>node.y+node.height))+60
    const next=clamp(Math.min(view.clientWidth/(right-left),view.clientHeight/(bottom-top)),.15,1)
    setZoom(next);requestAnimationFrame(()=>view.scrollTo(Math.max(0,left*next),Math.max(0,top*next)))
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
      <button type="button" aria-pressed={tool==='select'} onClick={()=>{setTool('select');setConnecting(null)}}><MousePointer2 size={16}/>Select</button><button type="button" aria-pressed={tool==='pan'} onClick={()=>{setTool('pan');setConnecting(null)}}><Hand size={16}/>Pan</button>
      <button type="button" onClick={()=>add('note')}><StickyNote size={16}/>Sticky note</button><button type="button" disabled={photoBusy} onClick={()=>fileInput.current.click()}><ImagePlus size={16}/>{photoBusy?'Adding…':'Photo'}</button><button type="button" onClick={()=>add('pin')}><Pin size={16}/>Thumbtack</button>
      <button type="button" aria-pressed={tool==='string'} onClick={()=>{setTool('string');setConnecting(null)}}><Link2 size={16}/>String</button><label className="detective-color">String<input aria-label="New string color" type="color" value={stringColor} onChange={event=>setStringColor(event.target.value)}/></label>
      <label className="detective-string-size">Thickness<input aria-label="New string thickness" type="range" min="1" max="24" step="1" value={stringWidth} onChange={event=>setStringWidth(Number(event.target.value))}/><output>{stringWidth} px</output></label>
      <button type="button" disabled={!history.undo.length} onClick={()=>undo(false)} title="Undo (Ctrl+Z)"><Undo2 size={16}/></button><button type="button" disabled={!history.redo.length} onClick={()=>undo(true)} title="Redo (Ctrl+Shift+Z)"><Redo2 size={16}/></button><button type="button" disabled={!selected} onClick={remove} title="Delete selected item or string"><Trash2 size={16}/></button>
      <div className="detective-zoom"><button type="button" onClick={()=>zoomTo(zoom-.1)} aria-label="Zoom out"><ZoomOut size={16}/></button><span>{Math.round(zoom*100)}%</span><button type="button" onClick={()=>zoomTo(zoom+.1)} aria-label="Zoom in"><ZoomIn size={16}/></button><button type="button" onClick={fit} title="Fit all items"><Maximize size={16}/></button></div>
    </div>
    <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event=>{const file=event.target.files?.[0];event.target.value='';addPhoto(file)}}/>
    {error&&<div className="detective-notice" role="alert">{error}<button type="button" onClick={save}>Retry save</button><button type="button" onClick={()=>setError('')} aria-label="Dismiss error"><X size={15}/></button></div>}
    {localBackup&&<div className="detective-notice">An unsaved local draft is available.<button type="button" onClick={()=>{apply(localBackup);setLocalBackup(null)}}>Restore draft</button><button type="button" onClick={()=>{setLocalBackup(null);try{localStorage.removeItem(cacheKey)}catch{}}}>Keep server version</button></div>}
    <div className="detective-hint" role="status">{tool==='string'?(connecting?'Now click another item to connect it. Escape cancels.':'Click two thumbtacks or item headers to connect them with string.'):tool==='pan'?'Drag the wall to pan.':'Drag item headers to move · Drag corners to resize · Click text to edit · Drop or paste a photo · Ctrl/⌘ + wheel to zoom'}</div>
    <div ref={viewport} className={`detective-viewport tool-${tool}`} tabIndex={0} aria-label="Corkboard. Use the toolbar to add items or pan." onPointerDown={event=>{if(event.button===1||tool==='pan')startPan(event);else if(event.target===event.currentTarget||event.target.dataset.wallBackground){setSelected(null);setConnecting(null)}}} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onDragOver={event=>{if(event.dataTransfer.types.includes('Files'))event.preventDefault()}} onDrop={event=>{event.preventDefault();addPhoto([...event.dataTransfer.files].find(file=>file.type.startsWith('image/')))}} onPaste={event=>{if(typing(event.target))return;const file=[...event.clipboardData.files].find(file=>file.type.startsWith('image/'));if(file){event.preventDefault();addPhoto(file)}}}>
      <div className="detective-world-size" data-wall-background="true" style={{width:W*zoom,height:H*zoom}}><div className="detective-world" data-wall-background="true" style={{width:W,height:H,transform:`scale(${zoom})`}}>
        <svg className="detective-strings" width={W} height={H} aria-label="Connections">
          {doc.state.strings.map(edge=>{
            const from=nodes.get(edge.from),to=nodes.get(edge.to)
            if(!from||!to)return null
            const a=anchor(from),b=anchor(to),d=path(a,b)
            return <g key={edge.id} className={selected?.id===edge.id?'is-selected':''} style={{'--string-width':`${edge.width??6}px`}}>
              <path className="detective-string-shadow" d={d}/>
              <path className="detective-string" d={d} stroke={edge.color}/>
              <path
                className="detective-string-hit" d={d} tabIndex={0} role="button"
                aria-label={edge.text||`String between ${from.text.slice(0,30)||from.type} and ${to.text.slice(0,30)||to.type}`}
                onPointerDown={event=>{
                  if(tool==='pan')return
                  event.stopPropagation()
                  setSelected({type:'string',id:edge.id})
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
        {doc.state.nodes.map(node=><article key={node.id} className={`detective-item is-${node.type}${selected?.id===node.id?' is-selected':''}${connecting===node.id?' is-connecting':''}`} style={{left:node.x,top:node.y,width:node.width,height:node.height,background:node.color,'--tack-color':node.type==='pin'?node.color:'#c83431',transform:`rotate(${node.rotation}deg)`}} onPointerDown={event=>{if(tool==='string'){event.preventDefault();event.stopPropagation();connect(node)}else if(tool!=='pan')setSelected({type:'node',id:node.id})}}>
          <button type="button" className="detective-item-grip" aria-label={`Move or connect ${node.type}: ${node.text.slice(0,60)||'Untitled'}`} onPointerDown={event=>startNode(event,node)} onClick={event=>{if(event.detail===0&&tool==='string')connect(node)}}><i className="detective-tack"/><span>{node.type==='photo'?'PHOTO':node.type==='pin'?(node.text||'PIN'):'NOTE'}</span></button>
          {node.type==='photo'&&<img src={node.image} alt={node.text||'Pinned photo'} draggable={false}/>}
          {node.type!=='pin'&&<textarea aria-label={node.type==='photo'?'Photo caption':'Sticky note text'} placeholder={node.type==='photo'?'Add a caption…':'What’s the connection?'} maxLength={3000} value={node.text} onFocus={()=>{setSelected({type:'node',id:node.id});historyRef.current={undo:[...historyRef.current.undo.slice(-19),current.current],redo:[]};setHistory(historyRef.current)}} onChange={event=>changeNode(node.id,{text:event.target.value},false)}/>}
          {node.type!=='pin'&&<button type="button" className="detective-resize" aria-label="Resize item" onPointerDown={event=>startNode(event,node,true)}/>}
        </article>)}
      </div></div>
    </div>
    {(activeNode||activeString)&&<div className="detective-properties"><strong>{activeString?'String':activeNode.type==='photo'?'Photo':activeNode.type==='pin'?'Thumbtack':'Sticky note'}</strong>
      {activeNode&&<><div className="detective-swatches">{colors.map(color=><button key={color} type="button" style={{background:color}} aria-label={`Set item color ${color}`} aria-pressed={activeNode.color===color} onClick={()=>changeNode(activeNode.id,{color})}/>)}</div><label>Color<input type="color" value={activeNode.color} onChange={event=>changeNode(activeNode.id,{color:event.target.value})}/></label><label>Rotate<input type="range" min="-30" max="30" value={activeNode.rotation} onPointerDown={()=>{historyRef.current={undo:[...historyRef.current.undo.slice(-19),current.current],redo:[]};setHistory(historyRef.current)}} onChange={event=>changeNode(activeNode.id,{rotation:Number(event.target.value)},false)}/></label>{activeNode.type==='pin'&&<label>Label<input value={activeNode.text} maxLength={160} onChange={event=>changeNode(activeNode.id,{text:event.target.value})}/></label>}<button type="button" onClick={()=>{setTool('string');setConnecting(activeNode.id)}}><Link2 size={15}/>Connect from here</button></>}
      {activeString&&<><label className="detective-string-size">Thickness<input aria-label="Selected string thickness" type="range" min="1" max="24" step="1" value={activeString.width??6} onFocus={()=>{historyRef.current={undo:[...historyRef.current.undo.slice(-19),current.current],redo:[]};setHistory(historyRef.current)}} onChange={event=>apply({...current.current,state:{...current.current.state,strings:current.current.state.strings.map(edge=>edge.id===activeString.id?{...edge,width:Number(event.target.value)}:edge)}},false)}/><output>{activeString.width??6} px</output></label><label>Label<input value={activeString.text} maxLength={160} onChange={event=>apply({...current.current,state:{...current.current.state,strings:current.current.state.strings.map(edge=>edge.id===activeString.id?{...edge,text:event.target.value}:edge)}})}/></label><label>Color<input type="color" value={activeString.color} onChange={event=>apply({...current.current,state:{...current.current.state,strings:current.current.state.strings.map(edge=>edge.id===activeString.id?{...edge,color:event.target.value}:edge)}})}/></label></>}
      <button type="button" onClick={remove}><Trash2 size={15}/>Remove</button><button type="button" aria-label="Close item settings" onClick={()=>setSelected(null)}><X size={16}/></button>
    </div>}
  </section>
}
