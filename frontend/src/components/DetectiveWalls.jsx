import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import {ArrowLeft,Plus,StickyNote,ImagePlus,Pin,Link2,Hand,Pencil,MousePointer2,Undo2,Redo2,Trash2,ZoomIn,ZoomOut,RotateCw,Maximize,Minimize,EyeOff,Download,Save,X} from 'lucide-react'
import {readApiJson} from '../lib/apiResponse'
import {downloadBlob} from '../lib/documentFormats'
import './DetectiveWalls.css'
import DetectiveWallText from './DetectiveWallText'
import StickyNoteInk from './StickyNoteInk'
import DetectiveCasePicker from './DetectiveCasePicker'
import DetectiveSelectionSize from './DetectiveSelectionSize'
import DetectiveStringWidth from './DetectiveStringWidth'
import {MAX_WALL_SIZE,MIN_TEXT_SIZE} from '../lib/detectiveWallLimits'
import {MAX_NOTE_STROKES} from '../lib/stickyNoteInk'
import {pivotDelta} from '../lib/insertGeometry'
import {spreadGrowingCards} from '../lib/detectiveWallSpacing'
import {isCaseBoardShortcut} from '../lib/detectiveWallDemo'

const EMPTY_NOTE_INK=[]
const uid=()=>crypto.randomUUID()
const colors=['#fff1a8','#ffd0c5','#ccebd2','#cce3ff','#e1d2f5','#ffffff']
const W=12000,H=8000
const wallHeight=state=>Math.min(MAX_WALL_SIZE*2,Math.max(H,...state.nodes.map(node=>node.y+node.height+80)))
const wallWidth=state=>Math.min(MAX_WALL_SIZE*2,Math.max(W,...state.nodes.map(node=>node.x+node.width+80)))
const pinPosition=node=>{const angle=node.rotation*Math.PI/180,dy=(node.type==='pin'?node.height*.35:14)-node.height/2;return {x:node.x+node.width/2-dy*Math.sin(angle),y:node.y+node.height/2+dy*Math.cos(angle)}}
const resizeCorners=['nw','ne','sw','se']
const itemBounds=node=>{
  const angle=node.rotation*Math.PI/180,w=Math.abs(node.width*Math.cos(angle))+Math.abs(node.height*Math.sin(angle)),h=Math.abs(node.width*Math.sin(angle))+Math.abs(node.height*Math.cos(angle))
  return {left:node.x+node.width/2-w/2,top:node.y+node.height/2-h/2,right:node.x+node.width/2+w/2,bottom:node.y+node.height/2+h/2}
}
const BOARD_MARGIN=2000
const MIN_ZOOM=.02,MAX_ZOOM=3,INITIAL_ZOOM=.8
const nodeFontSize=node=>node.fontSize??(node.type==='photo'?14:node.type==='pin'?12:20)
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n))
const typing=target=>target.closest('input,textarea,select,[contenteditable="true"]')
const wallId=()=>/^#\/detective-wall\/([a-f\d]{24})(?:\/overview)?$/i.exec(window.location.hash)?.[1]||null
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
  const [generating,setGenerating]=useState(false)
  const [pickerOpen,setPickerOpen]=useState(false)
  const beforeGeneration=useRef(null)
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
  const openPicker=(before=null)=>{if(creating.current)return;beforeGeneration.current=before;setError('');setPickerOpen(true)}
  const generateDemo=async(caseId)=>{
    if(creating.current)return
    creating.current=true;setGenerating(true);setError('')
    try{
      if(beforeGeneration.current&&!(await beforeGeneration.current())){setError('Save the current wall successfully before creating a new case board.');return}
      const {generateCaseBoard}=await import('../lib/detectiveWallDemo')
      const wall=await request(token,'/api/detective-walls',{method:'POST',body:JSON.stringify(generateCaseBoard(caseId))})
      if(!wall._id)throw new Error('The server did not return a case board. Refresh before trying again.')
      setPickerOpen(false);beforeGeneration.current=null
      window.location.hash=`/detective-wall/${wall._id}/overview`
    }catch(error){setError(error.message)}finally{creating.current=false;setGenerating(false)}
  }
  useEffect(()=>{
    if(id)return
    const key=event=>{if(!isCaseBoardShortcut(event)||typing(event.target))return;event.preventDefault();event.stopImmediatePropagation();openPicker()}
    window.addEventListener('keydown',key,true)
    return()=>window.removeEventListener('keydown',key,true)
  },[id,token])
  const picker=pickerOpen&&<DetectiveCasePicker busy={generating} error={error} onChoose={generateDemo} onClose={()=>{if(!creating.current){setPickerOpen(false);setError('');beforeGeneration.current=null}}}/>
  if(id)return <>
    <DetectiveWallEditor key={id} id={id} token={token} userId={userId} onGenerateDemo={openPicker}/>
    {picker}
    {generating&&<div className="detective-demo-status" role="status">Assembling the case…</div>}
    {error&&!pickerOpen&&<div className="detective-demo-status" role="alert">{error}<button type="button" onClick={()=>setError('')}>Dismiss</button></div>}
  </>
  return <section className="detective-lobby">{picker}<div className="detective-intro"><Pin size={30}/><div><h2>Follow the threads</h2><p>Build a corkboard of ideas, evidence, characters, research, or plans. Pin up sticky notes and photos, connect them with strings, and rearrange the whole story.</p><p>Your walls save to your account. Use a mouse, touch, or a pen.</p></div></div>
    <form onSubmit={create}><label htmlFor="detective-wall-name">New detective wall</label><div><input id="detective-wall-name" placeholder="The case of…" value={name} maxLength={120} onChange={event=>setName(event.target.value)} required disabled={busy}/><button disabled={busy||!name.trim()}><Plus size={16}/>Create wall</button></div></form>
    {error&&<p role="alert">{error} <button onClick={()=>setVersion(value=>value+1)}>Retry</button></p>}{(busy||generating)&&<p role="status">{generating?'Assembling the case…':'Loading…'}</p>}
    {deleting&&<div className="detective-notice" role="region" aria-label="Confirm wall deletion">Delete “{deleting.name}” and all its items and strings? This cannot be undone.<button disabled={busy} onClick={deleteWall}>Delete wall</button><button disabled={busy} onClick={()=>setDeleting(null)}>Cancel</button></div>}
    <div className="detective-wall-list">{walls.map(wall=><div key={wall._id}><a href={`#/detective-wall/${wall._id}`}><Pin size={22}/><strong>{wall.name}</strong><small>Updated {new Date(wall.updatedAt).toLocaleDateString()}</small><span>Open wall →</span></a><button className="detective-wall-delete" type="button" disabled={busy} aria-label={`Delete ${wall.name}`} onClick={()=>setDeleting(wall)}><Trash2 size={15}/></button></div>)}</div>
    {!busy&&!error&&!walls.length&&<p>Create a wall to start connecting your ideas.</p>}
  </section>
}

function DetectiveWallZoom({zoomTo,fit,zoomListener}){
  const [zoom,setZoom]=useState(INITIAL_ZOOM)
  useLayoutEffect(()=>{
    zoomListener.current=setZoom
    return()=>{zoomListener.current=null}
  },[zoomListener])
  return (
    <div className="detective-board-zoom" role="group" aria-label="Board zoom">
      <button type="button" onClick={()=>zoomTo(zoom/1.25)} disabled={zoom<=MIN_ZOOM} aria-label="Zoom out" title="Zoom out"><ZoomOut size={17}/></button>
      <label><span>Zoom</span><input aria-label="Board zoom percentage" type="range" min="2" max="300" step="1" value={Math.round(zoom*100)} onChange={event=>zoomTo(Number(event.target.value)/100)}/><output>{Math.round(zoom*100)}%</output></label>
      <button type="button" onClick={()=>zoomTo(zoom*1.25)} disabled={zoom>=MAX_ZOOM} aria-label="Zoom in" title="Zoom in"><ZoomIn size={17}/></button>
      <button type="button" onClick={()=>fit(false)} title="Fit all notes and photos"><Maximize size={16}/>Fit items</button>
      <button type="button" onClick={()=>fit(true)}>Whole board</button>
      <button type="button" onClick={()=>zoomTo(1)}>100%</button>
    </div>
  )
}

function DetectiveWallEditor({id,token,userId,onGenerateDemo}){
  const [doc,setDoc]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[status,setStatus]=useState('saved'),[localBackup,setLocalBackup]=useState(null)
  const [selected,setSelected]=useState(null),[tool,setTool]=useState('pan'),[connecting,setConnecting]=useState(null),[stringColor,setStringColor]=useState('#b52b35'),[pointer,setPointer]=useState(null),[photoBusy,setPhotoBusy]=useState(false),[history,setHistory]=useState({undo:[],redo:[]})
  const [stringWidth,setStringWidth]=useState(6)
  const [panning,setPanning]=useState(false)
  const [fullscreen,setFullscreen]=useState(false)
  const [zenMode,setZenMode]=useState(false)
  const enterZenMode=()=>{
    setZenMode(true)
    requestAnimationFrame(()=>viewport.current?.focus({preventScroll:true}))
  }
  const editorRoot=useRef(null),fullscreenRoot=useRef(null),ownsFullscreen=useRef(false)
  const exitFullscreen=()=>{
    setFullscreen(false)
    if(document.fullscreenElement===editorRoot.current)document.exitFullscreen?.().catch(()=>{})
  }
  const enterFullscreen=()=>{
    setFullscreen(true)
    const root=editorRoot.current;fullscreenRoot.current=root
    if(root?.requestFullscreen&&!document.fullscreenElement)root.requestFullscreen().then(()=>{ownsFullscreen.current=true}).catch(()=>{})
  }
  useEffect(()=>{
    const changed=()=>{
      if(document.fullscreenElement===editorRoot.current&&editorRoot.current)ownsFullscreen.current=true
      else if(ownsFullscreen.current){ownsFullscreen.current=false;setFullscreen(false);setZenMode(false)}
    }
    document.addEventListener('fullscreenchange',changed)
    return()=>{document.removeEventListener('fullscreenchange',changed);if(fullscreenRoot.current&&document.fullscreenElement===fullscreenRoot.current)document.exitFullscreen?.().catch(()=>{})}
  },[])
  useLayoutEffect(()=>{
    const root=editorRoot.current
    if(!root||!fullscreen)return
    const properties=root.querySelector('.detective-properties')
    const update=()=>root.style.setProperty('--detective-properties-height',`${properties?.getBoundingClientRect().height||0}px`)
    update();if(!properties)return
    const observer=new ResizeObserver(update);observer.observe(properties)
    return()=>observer.disconnect()
  },[fullscreen,!!selected])
  const [inkNoteId,setInkNoteId]=useState(null)
  const [marquee,setMarquee]=useState(null)
  const [spacingOnly,setSpacingOnly]=useState(false)
  const zoomRef=useRef(INITIAL_ZOOM),zoomListener=useRef(null)
  const worldSize=useRef(null),pendingZoom=useRef(null),zoomFrame=useRef(null)
  const requestedZoom=()=>pendingZoom.current?.value??zoomRef.current
  const initialOverview=useRef(window.location.hash.endsWith('/overview'))
  const [connectionTarget,setConnectionTarget]=useState(null),[stringHint,setStringHint]=useState('')
  const connectionSource=useRef(null)
  const viewport=useRef(null),fileInput=useRef(null),current=useRef(null),revision=useRef(0),dirty=useRef(false),queue=useRef(Promise.resolve()),gesture=useRef(null),saveRef=useRef(null),timer=useRef(null),historyRef=useRef({undo:[],redo:[]}),mounted=useRef(true)
  const cacheKey=`detective-wall-draft:${userId}:${id}`
  const cancelConnection=()=>{
    connectionSource.current=null;setConnecting(null);setConnectionTarget(null);setPointer(null);setStringHint('')
    if(gesture.current?.kind==='connection')gesture.current=null
  }
  const cache=()=>{if(!current.current)return;try{localStorage.setItem(cacheKey,JSON.stringify({revision:revision.current,doc:current.current}))}catch{/* The server copy and export remain available. */}}
  const apply=(next,record=true,adjustSpacing=true)=>{
    const previous=current.current;if(!previous)return
    if(adjustSpacing){
      const drag=gesture.current
      const baseline=drag?.layoutBase||previous.state.nodes
      next={...next,state:{...next.state,nodes:spreadGrowingCards(baseline,next.state.nodes,{fromGesture:!!drag?.layoutBase,resizingIds:drag?.layoutIds})}}
    }
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
  const fitNodeText=(nodeId,contentHeight,imageHeight)=>{
    const node=current.current?.state.nodes.find(item=>item.id===nodeId)
    if(!node)return
    const height=Math.min(MAX_WALL_SIZE,Math.ceil(38+contentHeight+(node.type==='photo'?imageHeight+10:0)))
    if(height>node.height||(node.type==='photo'&&node.imageHeight===undefined)){
      changeNode(nodeId,{height:Math.max(node.height,height),...(node.type==='photo'?{imageHeight}:{})},false)
    }
  }
  const add=(type,extra={})=>{
    if(current.current.state.nodes.length>=200){setError('This wall has 200 items. Start another wall to keep things responsive.');return}
    const view=viewport.current,nodeId=uid(),width=type==='pin'?70:type==='photo'?270:230,height=type==='pin'?70:type==='photo'?230:190
    const node={id:nodeId,type,x:clamp((view.scrollLeft-BOARD_MARGIN+view.clientWidth/2)/zoomRef.current-width/2,0,MAX_WALL_SIZE-width),y:clamp((view.scrollTop-BOARD_MARGIN+view.clientHeight/2)/zoomRef.current-height/2,0,MAX_WALL_SIZE-height),width,height,rotation:0,color:type==='note'?'#fff1a8':type==='pin'?'#bc343a':'#ffffff',text:'',...extra}
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
    const nodeIds=new Set(selected.type==='group'?selected.nodes:selected.type==='node'?[selected.id]:[])
    const stringIds=new Set(selected.type==='group'?selected.strings:selected.type==='string'?[selected.id]:[])
    apply({...current.current,state:{nodes:state.nodes.filter(node=>!nodeIds.has(node.id)),strings:state.strings.filter(edge=>!nodeIds.has(edge.from)&&!nodeIds.has(edge.to)&&!stringIds.has(edge.id))}})
    setSelected(null);cancelConnection()
  }
  const undo=redo=>{
    const from=redo?'redo':'undo',to=redo?'undo':'redo',entries=historyRef.current[from]
    if(!entries.length)return
    const snapshot=entries[entries.length-1]
    historyRef.current={...historyRef.current,[from]:entries.slice(0,-1),[to]:[...historyRef.current[to],current.current]};setHistory(historyRef.current);apply(snapshot,false,false);setSelected(null);cancelConnection()
  }
  useEffect(()=>{
    const key=event=>{
      if(event.defaultPrevented||event.target.closest?.('[data-case-picker]'))return
      if(isCaseBoardShortcut(event)&&!typing(event.target)){
        event.preventDefault();event.stopImmediatePropagation()
        onGenerateDemo(()=>{clearTimeout(timer.current);return save()})
        return
      }
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();saveRef.current?.();return}
      if(event.key==='Escape'){if(zenMode){setZenMode(false);return}if(fullscreen){exitFullscreen();return}cancelGesture();cancelConnection();setSelected(null);setTool('select');setStringHint('');return}
      if(typing(event.target))return
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='a'&&current.current){
        event.preventDefault();cancelConnection();setTool('select')
        const state=current.current.state
        setSelected(state.nodes.length||state.strings.length?{type:'group',nodes:state.nodes.map(node=>node.id),strings:state.strings.map(edge=>edge.id)}:null)
        return
      }
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undo(event.shiftKey)}
      else if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();remove()}
      else if(selected?.type==='group'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
        event.preventDefault();const step=event.shiftKey?20:5
        const nodes=current.current.state.nodes.filter(node=>selected.nodes.includes(node.id))
        moveNodes(nodes,event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0,true)
      }else if(selected?.type==='node'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
        const node=current.current?.state.nodes.find(item=>item.id===selected.id)
        if(!node)return
        event.preventDefault();const step=event.shiftKey?20:5
        changeNode(node.id,{x:clamp(node.x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0),0,MAX_WALL_SIZE-node.width),y:clamp(node.y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0),0,MAX_WALL_SIZE-node.height)})
      }
    }
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)
  })
  const point=event=>{const rect=viewport.current.getBoundingClientRect();return {x:(event.clientX-rect.left+viewport.current.scrollLeft-BOARD_MARGIN)/zoomRef.current,y:(event.clientY-rect.top+viewport.current.scrollTop-BOARD_MARGIN)/zoomRef.current}}
  const selectionIds=value=>({nodes:value?.type==='group'?value.nodes:value?.type==='node'?[value.id]:[],strings:value?.type==='group'?value.strings:value?.type==='string'?[value.id]:[]})
  const updateMarquee=(drag,p)=>{
    const rect={left:Math.min(drag.start.x,p.x),top:Math.min(drag.start.y,p.y),right:Math.max(drag.start.x,p.x),bottom:Math.max(drag.start.y,p.y)}
    setMarquee(rect)
    if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)*zoomRef.current<4)return
    drag.moved=true
    const inside=p=>p.x>=rect.left&&p.x<=rect.right&&p.y>=rect.top&&p.y<=rect.bottom
    const state=current.current.state,nodeMap=new Map(state.nodes.map(node=>[node.id,node]))
    const nodeIds=state.nodes.filter(node=>{const b=itemBounds(node);return b.left>=rect.left&&b.right<=rect.right&&b.top>=rect.top&&b.bottom<=rect.bottom}).map(node=>node.id)
    const stringIds=state.strings.filter(edge=>{
      const from=nodeMap.get(edge.from),to=nodeMap.get(edge.to);if(!from||!to)return false
      const a=pinPosition(from),b=pinPosition(to),cx=(a.x+b.x)/2,cy=(a.y+b.y)/2+(edge.slack??Math.min(140,Math.abs(a.x-b.x)*.12+35))
      for(let i=0;i<=20;i++){const t=i/20,s=1-t;if(!inside({x:s*s*a.x+2*s*t*cx+t*t*b.x,y:s*s*a.y+2*s*t*cy+t*t*b.y}))return false}
      return true
    }).map(edge=>edge.id)
    const previous=drag.additive?selectionIds(drag.previous):{nodes:[],strings:[]}
    const result={type:'group',nodes:[...new Set([...previous.nodes,...nodeIds])],strings:[...new Set([...previous.strings,...stringIds])]}
    setSelected(result.nodes.length||result.strings.length?result:null)
  }
  const startMarquee=event=>{
    if(event.button!==0)return
    event.preventDefault();cancelConnection()
    const start=point(event)
    gesture.current={kind:'marquee',start,pointerId:event.pointerId,previous:selected,additive:event.shiftKey,moved:false}
    setMarquee({left:start.x,top:start.y,right:start.x,bottom:start.y})
    if(!event.shiftKey)setSelected(null)
    viewport.current.focus({preventScroll:true});viewport.current.setPointerCapture(event.pointerId)
  }
  const toggleNode=node=>{
    const ids=selectionIds(selected),nodes=ids.nodes.includes(node.id)?ids.nodes.filter(id=>id!==node.id):[...ids.nodes,node.id]
    setSelected(nodes.length||ids.strings.length?{type:'group',nodes,strings:ids.strings}:null)
  }
  const moveNodes=(snapshots,dx,dy,record=false)=>{
    if(!snapshots.length)return
    dx=clamp(dx,-Math.min(...snapshots.map(node=>node.x)),MAX_WALL_SIZE-Math.max(...snapshots.map(node=>node.x+node.width)))
    dy=clamp(dy,-Math.min(...snapshots.map(node=>node.y)),MAX_WALL_SIZE-Math.max(...snapshots.map(node=>node.y+node.height)))
    const positions=new Map(snapshots.map(node=>[node.id,{x:node.x+dx,y:node.y+dy}]))
    apply({...current.current,state:{...current.current.state,nodes:current.current.state.nodes.map(node=>positions.has(node.id)?{...node,...positions.get(node.id)}:node)}},record)
  }
  const changeSpacing=(snapshots,anchor,factor,record=false)=>{
    if(snapshots.length<2||!Number.isFinite(factor)||factor<=0)return
    const positions=new Map(snapshots.map(node=>[node.id,{
      x:clamp(anchor.x+(node.x+node.width/2-anchor.x)*factor-node.width/2,0,MAX_WALL_SIZE-node.width),
      y:clamp(anchor.y+(node.y+node.height/2-anchor.y)*factor-node.height/2,0,MAX_WALL_SIZE-node.height)
    }]))
    // Explicit packing changes positions only; don't run resize spacing afterward.
    apply({...current.current,state:{...current.current.state,nodes:current.current.state.nodes.map(node=>positions.has(node.id)?{...node,...positions.get(node.id)}:node)}},record,false)
  }
  const packSelected=factor=>{
    const ids=selectionIds(selected),nodes=current.current.state.nodes.filter(node=>ids.nodes.includes(node.id))
    if(nodes.length<2)return
    const boxes=nodes.map(itemBounds)
    const anchor={x:(Math.min(...boxes.map(b=>b.left))+Math.max(...boxes.map(b=>b.right)))/2,y:(Math.min(...boxes.map(b=>b.top))+Math.max(...boxes.map(b=>b.bottom)))/2}
    changeSpacing(nodes,anchor,factor,true)
  }
  const resizeSelection=(snapshots,edges,anchor,requested,record=false)=>{
    if(!snapshots.length&&!edges.length)return
    if(!Number.isFinite(requested)||requested<=0)return
    const minimum=Math.max(Number.EPSILON,...snapshots.map(node=>Math.max(1/node.width,1/node.height,node.type==='photo'?1/(node.imageHeight??Math.max(80,node.height-90)):0)))
    const maximum=Math.min(Number.MAX_VALUE,...snapshots.map(node=>Math.min(MAX_WALL_SIZE/node.width,MAX_WALL_SIZE/node.height,node.type==='photo'?MAX_WALL_SIZE/(node.imageHeight??Math.max(80,node.height-90)):Infinity)))
    const factor=clamp(requested,minimum,maximum)
    const resized=new Map(snapshots.map(node=>{
      const width=clamp(node.width*factor,1,MAX_WALL_SIZE),height=clamp(node.height*factor,1,MAX_WALL_SIZE)
      return [node.id,{width,height,fontSize:clamp(nodeFontSize(node)*factor,MIN_TEXT_SIZE,MAX_WALL_SIZE),x:clamp(anchor.x+(node.x-anchor.x)*factor,0,MAX_WALL_SIZE-width),y:clamp(anchor.y+(node.y-anchor.y)*factor,0,MAX_WALL_SIZE-height),...(node.type==='photo'?{imageHeight:clamp((node.imageHeight??Math.max(80,node.height-90))*factor,1,MAX_WALL_SIZE)}:{})}]
    }))
    const scaledStrings=new Map(edges.map(edge=>[edge.id,{fontSize:clamp((edge.fontSize??15)*factor,MIN_TEXT_SIZE,MAX_WALL_SIZE),width:clamp((edge.width??6)*factor,MIN_TEXT_SIZE,MAX_WALL_SIZE),...(edge.slack!==undefined?{slack:clamp(edge.slack*factor,-MAX_WALL_SIZE,MAX_WALL_SIZE)}:{})}]))
    apply({...current.current,state:{...current.current.state,nodes:current.current.state.nodes.map(node=>resized.has(node.id)?{...node,...resized.get(node.id)}:node),strings:current.current.state.strings.map(edge=>scaledStrings.has(edge.id)?{...edge,...scaledStrings.get(edge.id)}:edge)}},record)
  }
  const scaleSelected=factor=>{
    const ids=selectionIds(selected),nodes=current.current.state.nodes.filter(node=>ids.nodes.includes(node.id)),edges=current.current.state.strings.filter(edge=>ids.strings.includes(edge.id))
    const boxes=nodes.map(itemBounds),anchor=boxes.length?{x:Math.min(...boxes.map(b=>b.left)),y:Math.min(...boxes.map(b=>b.top))}:{x:0,y:0}
    resizeSelection(nodes,edges,anchor,factor,true)
  }
  const changeSelectedFonts=(value,relative=false)=>{
    const ids=selectionIds(selected)
    apply({...current.current,state:{...current.current.state,nodes:current.current.state.nodes.map(node=>ids.nodes.includes(node.id)?{...node,fontSize:clamp(relative?nodeFontSize(node)+value:value,MIN_TEXT_SIZE,MAX_WALL_SIZE)}:node),strings:current.current.state.strings.map(edge=>ids.strings.includes(edge.id)?{...edge,fontSize:clamp(relative?(edge.fontSize??15)+value:value,MIN_TEXT_SIZE,MAX_WALL_SIZE)}:edge)}})
  }
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
    let nearest=null,distance=32/zoomRef.current
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
  const startNode=(event,node,resize=null)=>{
    event.stopPropagation();if(event.button===1){startPan(event);return}if(event.button!==0)return
    if(tool==='string'||connectionSource.current){event.preventDefault();connect(node);return}
    if(tool==='pan'){startPan(event);return}
    if(event.shiftKey&&!resize){event.preventDefault();toggleNode(node);return}
    if(!resize&&selected?.type==='group'&&selected.nodes.includes(node.id)){
      event.preventDefault()
      historyRef.current={undo:[...historyRef.current.undo.slice(-19),current.current],redo:[]};setHistory(historyRef.current)
      gesture.current={kind:'group',nodes:current.current.state.nodes.filter(item=>selected.nodes.includes(item.id)),start:point(event),pointerId:event.pointerId}
      event.currentTarget.setPointerCapture(event.pointerId);return
    }
    event.preventDefault();setSelected({type:'node',id:node.id});setStringHint('')
    historyRef.current={undo:[...historyRef.current.undo.slice(-19),current.current],redo:[]};setHistory(historyRef.current)
    gesture.current={kind:resize==='pivot'?'pivot':resize?'resize':'node',corner:resize,node,start:point(event),pointerId:event.pointerId,...(resize&&resize!=='pivot'?{layoutBase:current.current.state.nodes,layoutIds:[node.id]}:{})};event.currentTarget.setPointerCapture(event.pointerId)
  }
  const startGroupResize=(event,corner)=>{
    event.stopPropagation();if(event.button!==0||selected?.type!=='group')return
    event.preventDefault();cancelConnection()
    const nodes=current.current.state.nodes.filter(node=>selected.nodes.includes(node.id));if(!nodes.length)return
    const boxes=nodes.map(itemBounds),left=Math.min(...boxes.map(b=>b.left)),top=Math.min(...boxes.map(b=>b.top)),right=Math.max(...boxes.map(b=>b.right)),bottom=Math.max(...boxes.map(b=>b.bottom))
    historyRef.current={undo:[...historyRef.current.undo.slice(-19),current.current],redo:[]};setHistory(historyRef.current)
    gesture.current={kind:spacingOnly?'group-spacing':'group-resize',nodes,strings:current.current.state.strings.filter(edge=>selected.strings.includes(edge.id)),corner,start:point(event),bounds:{left,top,right,bottom},pointerId:event.pointerId,layoutBase:current.current.state.nodes,layoutIds:nodes.map(node=>node.id)}
    event.currentTarget.setPointerCapture(event.pointerId)
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
    if(drag.kind==='marquee'){updateMarquee(drag,point(event));return}
    if(drag.kind==='connection'){if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>5)drag.moved=true;return}
    if(drag.kind==='pan'){viewport.current.scrollLeft=drag.left+drag.x-event.clientX;viewport.current.scrollTop=drag.top+drag.y-event.clientY;return}
    const p=point(event),dx=p.x-drag.start.x,dy=p.y-drag.start.y
    if(drag.kind==='group'){moveNodes(drag.nodes,dx,dy);return}
    if(drag.kind==='group-resize'||drag.kind==='group-spacing'){
      const west=drag.corner.includes('w'),north=drag.corner.includes('n'),b=drag.bounds,w=b.right-b.left,h=b.bottom-b.top
      const anchor={x:west?b.right:b.left,y:north?b.bottom:b.top}
      const factor=1+((west?-dx:dx)*w+(north?-dy:dy)*h)/(w*w+h*h)
      if(drag.kind==='group-spacing')changeSpacing(drag.nodes,anchor,Math.max(.01,factor))
      else resizeSelection(drag.nodes,drag.strings,anchor,factor)
      return
    }
    if(drag.kind==='pivot'){
      const center={x:drag.node.x+drag.node.width/2,y:drag.node.y+drag.node.height/2}
      const angle=drag.node.rotation+pivotDelta(drag.start,p,center)
      changeNode(drag.node.id,{rotation:clamp(event.shiftKey?Math.round(angle/15)*15:angle,-30,30)},false)
      return
    }
    const angle=drag.node.rotation*Math.PI/180
    if(drag.kind==='resize'){
      const sx=drag.corner.includes('w')?-1:1,sy=drag.corner.includes('n')?-1:1
      const heightDelta=sy*(-dx*Math.sin(angle)+dy*Math.cos(angle))
      const patch={width:clamp(drag.node.width+sx*(dx*Math.cos(angle)+dy*Math.sin(angle)),1,MAX_WALL_SIZE),height:clamp(drag.node.height+heightDelta,1,MAX_WALL_SIZE)}
      if(drag.node.type==='photo'){
        const imageHeight=drag.node.imageHeight??Math.max(80,drag.node.height-90)
        patch.imageHeight=clamp(imageHeight+heightDelta,1,Math.max(1,MAX_WALL_SIZE-(drag.node.height-imageHeight)))
        patch.height=clamp(drag.node.height+patch.imageHeight-imageHeight,1,MAX_WALL_SIZE)
      }
      const localX=sx*(patch.width-drag.node.width)/2,localY=sy*(patch.height-drag.node.height)/2
      const centerX=drag.node.x+drag.node.width/2+localX*Math.cos(angle)-localY*Math.sin(angle)
      const centerY=drag.node.y+drag.node.height/2+localX*Math.sin(angle)+localY*Math.cos(angle)
      patch.x=clamp(centerX-patch.width/2,0,MAX_WALL_SIZE-patch.width)
      patch.y=clamp(centerY-patch.height/2,0,MAX_WALL_SIZE-patch.height)
      changeNode(drag.node.id,patch,false)
    }else changeNode(drag.node.id,{x:clamp(drag.node.x+dx,0,MAX_WALL_SIZE-drag.node.width),y:clamp(drag.node.y+dy,0,MAX_WALL_SIZE-drag.node.height)},false)
  }
  const end=event=>{
    const drag=gesture.current
    if(!drag||drag.pointerId!==event.pointerId)return
    if(drag.kind==='marquee'){
      updateMarquee(drag,point(event));setMarquee(null);gesture.current=null;return
    }
    gesture.current=null
    if(drag.kind==='pan')setPanning(false)
    if(drag.kind!=='connection')return
    if(drag.moved){
      const target=targetAt(event)
      if(target)completeConnection(drag.from,target)
      else{cancelConnection();setStringHint('No connection made. Drop onto another item, or click a pin and then another item.')}
    }else if(drag.previous)cancelConnection()
  }
  const cancelGesture=()=>{if(gesture.current?.kind==='connection')cancelConnection();if(gesture.current?.kind==='marquee')setSelected(gesture.current.previous);gesture.current=null;setPanning(false);setMarquee(null)}
  const zoomTo=(value,location=null,center=null)=>{
    value=clamp(value,MIN_ZOOM,MAX_ZOOM)
    const view=viewport.current,world=worldSize.current
    if(!view||!world||(value===requestedZoom()&&!center))return
    pendingZoom.current={value,location,center}
    if(zoomFrame.current!==null)return
    zoomFrame.current=requestAnimationFrame(()=>{
      zoomFrame.current=null
      const request=pendingZoom.current
      pendingZoom.current=null
      if(viewport.current!==view||worldSize.current!==world)return

      const next=request.value,previous=zoomRef.current
      const rect=request.location&&view.getBoundingClientRect()
      const x=rect?request.location.x-rect.left:view.clientWidth/2
      const y=rect?request.location.y-rect.top:view.clientHeight/2
      const boardX=request.center?.x??(view.scrollLeft-BOARD_MARGIN+x)/previous
      const boardY=request.center?.y??(view.scrollTop-BOARD_MARGIN+y)/previous

      world.style.setProperty('--wall-zoom',next)
      view.scrollTo(BOARD_MARGIN+boardX*next-x,BOARD_MARGIN+boardY*next-y)
      zoomRef.current=next
      zoomListener.current?.(next)
    })
  }
  useLayoutEffect(()=>()=>cancelAnimationFrame(zoomFrame.current),[])
  useLayoutEffect(()=>{
    if(viewport.current)viewport.current.scrollTo(BOARD_MARGIN,BOARD_MARGIN)
  },[loading])
  useEffect(()=>{
    const view=viewport.current;if(!view)return
    const wheel=event=>{
      event.preventDefault()
      const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?view.clientHeight:1)
      if(delta)zoomTo(requestedZoom()*Math.exp(-delta*.002),{x:event.clientX,y:event.clientY})
    }
    let pinch=null
    const touchStart=event=>{
      if(event.touches.length!==2)return
      event.preventDefault();cancelGesture()
      const [a,b]=event.touches
      pinch={distance:Math.max(1,Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)),zoom:requestedZoom()}
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
    const right=wholeBoard||!bounds.length?wallWidth(current.current.state):Math.max(...bounds.map(b=>b.right))+60,bottom=wholeBoard||!bounds.length?wallHeight(current.current.state):Math.max(...bounds.map(b=>b.bottom))+60
    const next=clamp(Math.min((view.clientWidth-32)/(right-left),(view.clientHeight-32)/(bottom-top)),MIN_ZOOM,1)
    zoomTo(next,null,{x:(left+right)/2,y:(top+bottom)/2})
  }
  useEffect(()=>{
    if(loading||!current.current||!initialOverview.current)return
    const frame=requestAnimationFrame(()=>{fit(false);initialOverview.current=false})
    return()=>cancelAnimationFrame(frame)
  },[loading])
  const leave=async()=>{clearTimeout(timer.current);if(await save())window.location.hash='/detective-wall'}
  const exportWall=()=>downloadBlob(new Blob([JSON.stringify(current.current,null,2)],{type:'application/json'}),`${current.current.name.replace(/[<>:"/\\|?*]/g,'-')||'Detective wall'}.json`)
  if(loading)return <p role="status">Opening detective wall…</p>
  if(!doc)return <div className="detective-lobby"><p role="alert">{error}</p><a href="#/detective-wall">Back to walls</a></div>
  const activeNode=selected?.type==='node'?doc.state.nodes.find(node=>node.id===selected.id):null
  const writingNote=tool==='select'&&activeNode?.id===inkNoteId&&!connecting
  const activeString=selected?.type==='string'?doc.state.strings.find(edge=>edge.id===selected.id):null
  const nodes=new Map(doc.state.nodes.map(node=>[node.id,node]))
  const boardHeight=wallHeight(doc.state)
  const boardWidth=wallWidth(doc.state)
  const anchor=pinPosition
  const selectedGroup=selected?.type==='group'?selected:null
  const selectedIds=selectionIds(selected)
  const selectedFonts=[...doc.state.nodes.filter(node=>selectedIds.nodes.includes(node.id)).map(nodeFontSize),...doc.state.strings.filter(edge=>selectedIds.strings.includes(edge.id)).map(edge=>edge.fontSize??15)]
  const commonFontSize=selectedFonts.length&&selectedFonts.every(size=>Math.abs(size-selectedFonts[0])<.01)?Math.round(selectedFonts[0]*10)/10:null
  const groupBoxes=selectedGroup?doc.state.nodes.filter(node=>selectedGroup.nodes.includes(node.id)).map(itemBounds):[]
  const groupBounds=groupBoxes.length?{left:Math.min(...groupBoxes.map(b=>b.left)),top:Math.min(...groupBoxes.map(b=>b.top)),right:Math.max(...groupBoxes.map(b=>b.right)),bottom:Math.max(...groupBoxes.map(b=>b.bottom))}:null
  const isSelected=(type,id)=>selected?.type===type&&selected.id===id||!!selectedGroup?.[type==='node'?'nodes':'strings'].includes(id)
  const path=(a,b,slack)=>`M ${a.x} ${a.y} Q ${(a.x+b.x)/2} ${(a.y+b.y)/2+(slack??Math.min(140,Math.abs(a.x-b.x)*.12+35))} ${b.x} ${b.y}`
  const start=connecting&&nodes.get(connecting)?anchor(nodes.get(connecting)):null
  return <section ref={editorRoot} className={`detective-editor${fullscreen?' is-fullscreen':''}${zenMode?' is-zen':''}`} aria-label="Interactive detective wall">
    {zenMode&&<button type="button" className="detective-zen-exit" aria-label="Exit Zen mode" title="Exit Zen mode (Escape)" onClick={()=>setZenMode(false)}><X size={18}/><span>Exit Zen</span></button>}
    {fullscreen&&<div className="detective-focus-controls" role="group" aria-label="Fullscreen board controls">
      <button type="button" onClick={()=>zoomTo(requestedZoom()/1.25)} aria-label="Zoom out" title="Zoom out"><ZoomOut size={17}/></button>
      <button type="button" onClick={()=>zoomTo(requestedZoom()*1.25)} aria-label="Zoom in" title="Zoom in"><ZoomIn size={17}/></button>
      <button type="button" onClick={()=>fit(false)} aria-label="Fit all items" title="Fit all items"><Maximize size={17}/></button>
      <button type="button" onClick={save} aria-label="Save wall" title="Save wall"><Save size={17}/></button>
      <button type="button" onClick={enterZenMode} aria-label="Enter Zen mode" title="Zen mode — board and current tool only"><EyeOff size={17}/></button>
      <button type="button" onClick={exitFullscreen} aria-label="Exit fullscreen" title="Exit fullscreen (Escape)"><Minimize size={17}/></button>
    </div>}
    <header className="detective-header"><button type="button" onClick={leave} title="Back to walls"><ArrowLeft size={18}/></button><input aria-label="Wall name" maxLength={120} value={doc.name} onFocus={()=>{historyRef.current={undo:[...historyRef.current.undo.slice(-19),current.current],redo:[]};setHistory(historyRef.current)}} onChange={event=>apply({...current.current,name:event.target.value},false)}/><span role="status">{status==='saving'?'Saving…':status==='saved'?'Saved':status==='error'?'Save failed':'Unsaved changes'}</span><button type="button" onClick={save}><Save size={16}/><span>Save</span></button><button type="button" onClick={exportWall} title="Export wall backup"><Download size={16}/><span>Backup</span></button><button type="button" onClick={fullscreen?exitFullscreen:enterFullscreen} aria-label={fullscreen?'Exit fullscreen':'Enter fullscreen'} title={fullscreen?'Exit fullscreen (Escape)':'Enter fullscreen'}>{fullscreen?<Minimize size={16}/>:<Maximize size={16}/>}<span>Fullscreen</span></button><button type="button" onClick={enterZenMode} title="Hide controls and keep the current tool. Escape exits." aria-label="Enter Zen mode"><EyeOff size={16}/><span>Zen mode</span></button></header>
    <div className="detective-toolbar" role="toolbar" aria-label="Wall tools">
      <button type="button" aria-pressed={tool==='select'} title="Select items or drag empty space to draw a selection rectangle" onClick={()=>{setTool('select');cancelConnection();setStringHint('')}}><MousePointer2 size={16}/>Select</button><button type="button" aria-pressed={tool==='pan'} onClick={()=>{setTool('pan');cancelConnection();setStringHint('')}}><Hand size={16}/>Pan</button>
      <button type="button" onClick={()=>add('note')}><StickyNote size={16}/>Sticky note</button><button type="button" disabled={photoBusy} onClick={()=>fileInput.current.click()}><ImagePlus size={16}/>{photoBusy?'Adding…':'Photo'}</button><button type="button" onClick={()=>add('pin')}><Pin size={16}/>Thumbtack</button>
      <button type="button" aria-pressed={tool==='string'||!!connecting} onClick={()=>{cancelConnection();setStringHint('');setTool(tool==='string'?'select':'string')}} title="Connect two items, or drag directly from any pin"><Link2 size={16}/>Connect items</button>
      {(tool==='string'||connecting)&&<div className="detective-new-string-settings" role="group" aria-label="New string appearance">
        <label className="detective-color">Color<input aria-label="New string color" type="color" value={stringColor} onChange={event=>setStringColor(event.target.value)}/></label>
        <DetectiveStringWidth value={stringWidth} onChange={setStringWidth} label="New string thickness"/>
      </div>}
      <button type="button" disabled={!history.undo.length} onClick={()=>undo(false)} title="Undo (Ctrl+Z)"><Undo2 size={16}/></button><button type="button" disabled={!history.redo.length} onClick={()=>undo(true)} title="Redo (Ctrl+Shift+Z)"><Redo2 size={16}/></button><button type="button" disabled={!selected} onClick={remove} title="Delete selected item or string"><Trash2 size={16}/></button>
    </div>
    <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event=>{const file=event.target.files?.[0];event.target.value='';addPhoto(file)}}/>
    {error&&<div className="detective-notice" role="alert">{error}<button type="button" onClick={save}>Retry save</button><button type="button" onClick={()=>setError('')} aria-label="Dismiss error"><X size={15}/></button></div>}
    {localBackup&&<div className="detective-notice">An unsaved local draft is available.<button type="button" onClick={()=>{apply(localBackup,true,false);setLocalBackup(null)}}>Restore draft</button><button type="button" onClick={()=>{setLocalBackup(null);try{localStorage.removeItem(cacheKey)}catch{}}}>Keep server version</button></div>}
    <div className={`detective-hint${connecting?' is-connecting':''}`}>
      <span role="status">{connecting?`Connect “${nodes.get(connecting)?.text.slice(0,35)||nodes.get(connecting)?.type||'item'}” → ${connectionTarget?'Release or click to connect.':'Choose another item, or drag to its pin.'}`:tool==='string'?'Choose the first item, then the second. You can also drag from any pin to another item.':stringHint|| (tool==='pan'?'Drag to pan · Wheel to zoom · Use the scrollbars to move around the board.':'Drag empty space to box-select · Shift adds to your selection · Use Pan to move the board · Wheel to zoom')}</span>
      {(connecting||tool==='string')&&<button type="button" onClick={()=>{cancelConnection();setTool('select');setStringHint('')}}>Cancel connection <span aria-hidden="true">Esc</span></button>}
    </div>
    <DetectiveWallZoom zoomTo={zoomTo} fit={fit} zoomListener={zoomListener}/>
    <div
      ref={viewport}
      className={['detective-viewport',`tool-${tool}`,panning?'is-panning':''].filter(Boolean).join(' ')}
      tabIndex={0}
      aria-label="Corkboard. Drag to pan in Pan mode. In Select mode, drag empty space to select items in a rectangle."
      onPointerDown={event=>{
        if(event.button===1||tool==='pan'){
          startPan(event)
        }else if(event.button===0&&(event.target===event.currentTarget||event.target.dataset.wallBackground)){
          if(tool==='select')startMarquee(event)
          else{cancelConnection();setSelected(null);setStringHint('')}
        }
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={cancelGesture}
      onLostPointerCapture={cancelGesture}
      onDragOver={event=>{if(event.dataTransfer.types.includes('Files'))event.preventDefault()}}
      onDrop={event=>{
        event.preventDefault()
        addPhoto([...event.dataTransfer.files].find(file=>file.type.startsWith('image/')))
      }}
      onPaste={event=>{
        if(typing(event.target))return
        const file=[...event.clipboardData.files].find(file=>file.type.startsWith('image/'))
        if(file){event.preventDefault();addPhoto(file)}
      }}
    >
      <div ref={worldSize} className="detective-world-size" data-wall-background="true" style={{'--wall-width':`${boardWidth}px`,'--wall-height':`${boardHeight}px`,'--wall-margin':`${BOARD_MARGIN}px`,'--wall-zoom':INITIAL_ZOOM}}><div className="detective-world" data-wall-background="true">
        <svg className="detective-strings" width={boardWidth} height={boardHeight} aria-label="Connections">
          {doc.state.strings.map(edge=>{
            const from=nodes.get(edge.from),to=nodes.get(edge.to)
            if(!from||!to)return null
            const a=anchor(from),b=anchor(to),d=path(a,b,edge.slack)
            return <g key={edge.id} className={isSelected('string',edge.id)?'is-selected':''} onPointerDown={event=>{if(tool==='pan'||connectionSource.current)return;event.stopPropagation();setSelected({type:'string',id:edge.id});setStringHint('Edit this string below.')}} style={{'--string-width':`${edge.width??6}px`}}>
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
              {edge.text&&<text style={{fontSize:edge.fontSize??15}} x={(a.x+b.x)/2} y={(a.y+b.y)/2+(edge.slack??Math.min(140,Math.abs(a.x-b.x)*.12+35))/2-9}>{edge.text}</text>}
            </g>
          })}
          {start&&pointer&&<path className="detective-string-preview" d={path(start,pointer)} stroke={stringColor} style={{'--string-width':`${stringWidth}px`}}/>}
        </svg>
        {doc.state.nodes.map(node=><article
          key={node.id} data-wall-node={node.id}
          className={`detective-item is-${node.type}${node.paperStyle?` is-paper-${node.paperStyle}`:''}${isSelected('node',node.id)?' is-selected':''}${connecting===node.id?' is-connecting':''}${connectionTarget===node.id?' is-connection-target':''}${activeString&&(activeString.from===node.id||activeString.to===node.id)?' is-string-endpoint':''}`}
          style={{left:node.x,top:node.y,width:node.width,height:node.height,background:node.color,'--tack-color':node.type==='pin'?node.color:'#c83431','--tack-size':`${Math.max(1,Math.min(node.width,node.height)*.34)}px`,transform:`rotate(${node.rotation}deg)`}}
          onPointerDown={event=>{
            if(tool==='string'||connectionSource.current){event.preventDefault();event.stopPropagation();connect(node)}
            else if(tool!=='pan'){if(event.shiftKey){event.preventDefault();event.stopPropagation();toggleNode(node)}else if(!isSelected('node',node.id))setSelected({type:'node',id:node.id})}
          }}
        >
          <button type="button" className="detective-item-grip" aria-label={`Move or connect ${node.type}: ${node.text.slice(0,60)||'Untitled'}`} onPointerDown={event=>startNode(event,node)} onClick={event=>{if(event.detail===0){if(tool==='string'||connectionSource.current)connect(node);else setSelected({type:'node',id:node.id})}}}><span style={node.type==='pin'?{fontSize:nodeFontSize(node)}:undefined}>{node.type==='photo'?'PHOTO':node.type==='pin'?(node.text||'PIN'):'NOTE'}</span></button>
          <button
            type="button" className="detective-connect-pin"
            title={connecting&&connecting!==node.id?'Connect to this item':'Drag to another item, or click to start a connection'}
            aria-label={`Connect string: ${node.text.slice(0,60)||node.type}`}
            aria-pressed={connecting===node.id}
            onPointerDown={event=>startConnection(event,node)}
            onClick={event=>{if(event.detail===0)connect(node)}}
          ><i className="detective-tack" aria-hidden="true"/><span className="detective-pin-plus" aria-hidden="true">+</span></button>
          {node.type==='photo'&&<img src={node.image} alt={node.text||'Pinned photo'} draggable={false} style={{height:node.imageHeight??Math.max(80,node.height-90),flex:'0 0 auto'}}/>}
          {node.type!=='pin'&&<DetectiveWallText node={node} onFit={(height,imageHeight)=>fitNodeText(node.id,height,imageHeight)} onFocus={()=>{setSelected({type:'node',id:node.id});historyRef.current={undo:[...historyRef.current.undo.slice(-19),current.current],redo:[]};setHistory(historyRef.current)}} onChange={event=>changeNode(node.id,{text:event.target.value},false)}/>}
          {node.type==='note'&&(node.ink?.length||writingNote&&node.id===inkNoteId)?<StickyNoteInk
            strokes={node.ink??EMPTY_NOTE_INK} active={writingNote&&node.id===inkNoteId} onStroke={points=>{
              const ink=current.current.state.nodes.find(item=>item.id===node.id)?.ink??EMPTY_NOTE_INK
              if(ink.length<MAX_NOTE_STROKES)changeNode(node.id,{ink:[...ink,points]})
            }}/>:null}
          {tool==='select'&&activeNode?.id===node.id&&<button type="button" className="detective-pivot"
            aria-label={node.type==='note'?'Rotate sticky note':'Rotate '+node.type} title="Drag to rotate. Hold Shift to snap to 15°."
            onPointerDown={event=>startNode(event,node,'pivot')}
            onClick={event=>{if(event.detail===0)changeNode(node.id,{rotation:clamp(node.rotation+(event.shiftKey?-15:15),-30,30)})}}>
            <RotateCw size={12} aria-hidden="true"/>
          </button>}
          {resizeCorners.map(corner=><button key={corner} type="button" className={`detective-resize is-${corner}`} aria-label={`Resize ${node.type} from ${corner==='nw'?'top left':corner==='ne'?'top right':corner==='sw'?'bottom left':'bottom right'} corner`} onPointerDown={event=>startNode(event,node,corner)}/>)}
        </article>)}
        {groupBounds&&tool==='select'&&<div className="detective-group-bounds" style={{left:groupBounds.left,top:groupBounds.top,width:groupBounds.right-groupBounds.left,height:groupBounds.bottom-groupBounds.top}}>
          {resizeCorners.map(corner=><button key={corner} type="button" className={`detective-resize is-${corner}`} aria-label={`Resize selected group from ${corner==='nw'?'top left':corner==='ne'?'top right':corner==='sw'?'bottom left':'bottom right'} corner`} onPointerDown={event=>startGroupResize(event,corner)}/>)}
        </div>}
        {marquee&&<div className="detective-selection-rectangle" aria-hidden="true" style={{left:marquee.left,top:marquee.top,width:marquee.right-marquee.left,height:marquee.bottom-marquee.top}}/>}
      </div></div>
    </div>
    {(activeNode||activeString||selectedGroup)&&<div className="detective-properties"><strong>{selectedGroup?`${selectedGroup.nodes.length} items · ${selectedGroup.strings.length} strings selected`:activeString?'String':activeNode.type==='photo'?'Photo':activeNode.type==='pin'?'Thumbtack':'Sticky note'}</strong>
      {activeNode?.type==='note'&&<div className="detective-note-ink-controls" role="group" aria-label="Sticky note handwriting">
        <button type="button" aria-pressed={writingNote} onClick={()=>{
          setInkNoteId(writingNote?null:activeNode.id)
          cancelConnection();setTool('select');setStringHint('')
        }}><Pencil size={15}/>{writingNote?'Done handwriting':'Handwrite'}</button>
        {activeNode.ink?.length>0&&<button type="button" onClick={()=>changeNode(activeNode.id,{ink:activeNode.ink.slice(0,-1)})}>Remove last stroke</button>}
        {writingNote&&<span>{activeNode.ink?.length>=MAX_NOTE_STROKES?'Stroke limit reached. Remove a stroke to keep writing.':'Write on the note with a pen, finger, or mouse.'}</span>}
      </div>}
      <DetectiveSelectionSize key={JSON.stringify(selectedIds)} fontSize={commonFontSize} onFontSize={size=>changeSelectedFonts(size)} onFontDelta={delta=>changeSelectedFonts(delta,true)} onScale={scaleSelected}/>
      {selectedGroup&&selectedGroup.nodes.length>1&&<div className="detective-spacing-controls" role="group" aria-label="Selection spacing">
        <span>Spacing</span>
        <button type="button" onClick={()=>packSelected(.85)} title="Move selected cards 15% closer without changing their size">Pack closer</button>
        <button type="button" onClick={()=>packSelected(1/.85)} title="Spread selected cards apart without changing their size">Spread apart</button>
        <label><input type="checkbox" checked={spacingOnly} onChange={event=>setSpacingOnly(event.target.checked)}/>Corners change spacing only</label>
      </div>}
      {selectedGroup&&<span className="detective-group-hint">Drag a header to move the group · {spacingOnly?'Drag a corner to change spacing without resizing cards':'Drag a corner to resize'} · Shift-click to add or remove items</span>}
      {activeString&&<span className="detective-connection-summary" title="Connected items">{nodes.get(activeString.from)?.text.slice(0,30)||nodes.get(activeString.from)?.type} ↔ {nodes.get(activeString.to)?.text.slice(0,30)||nodes.get(activeString.to)?.type}</span>}
      {activeNode&&<><div className="detective-swatches">{colors.map(color=><button key={color} type="button" style={{background:color}} aria-label={`Set item color ${color}`} aria-pressed={activeNode.color===color} onClick={()=>changeNode(activeNode.id,{color})}/>)}</div><label>Color<input type="color" value={activeNode.color} onChange={event=>changeNode(activeNode.id,{color:event.target.value})}/></label><label>Rotate<input type="range" min="-30" max="30" value={activeNode.rotation} onPointerDown={()=>{historyRef.current={undo:[...historyRef.current.undo.slice(-19),current.current],redo:[]};setHistory(historyRef.current)}} onChange={event=>changeNode(activeNode.id,{rotation:Number(event.target.value)},false)}/></label>{activeNode.type==='pin'&&<label>Label<input value={activeNode.text} maxLength={160} onChange={event=>changeNode(activeNode.id,{text:event.target.value})}/></label>}<button type="button" onClick={()=>{setTool('string');beginConnection(activeNode)}}><Link2 size={15}/>Connect from here</button></>}
      {activeString&&<><DetectiveStringWidth value={activeString.width??6} label="Selected string thickness" onStart={()=>{historyRef.current={undo:[...historyRef.current.undo.slice(-19),current.current],redo:[]};setHistory(historyRef.current)}} onChange={width=>apply({...current.current,state:{...current.current.state,strings:current.current.state.strings.map(edge=>edge.id===activeString.id?{...edge,width}:edge)}},false)}/><label>Label<input value={activeString.text} maxLength={160} onChange={event=>apply({...current.current,state:{...current.current.state,strings:current.current.state.strings.map(edge=>edge.id===activeString.id?{...edge,text:event.target.value}:edge)}})}/></label><label>Color<input type="color" value={activeString.color} onChange={event=>apply({...current.current,state:{...current.current.state,strings:current.current.state.strings.map(edge=>edge.id===activeString.id?{...edge,color:event.target.value}:edge)}})}/></label></>}
      <button type="button" onClick={remove}><Trash2 size={15}/>Remove</button><button type="button" aria-label="Close item settings" onClick={()=>setSelected(null)}><X size={16}/></button>
    </div>}
  </section>
}
