import {StudyPhoneButton} from './StudyPhone'
import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react'
import { FileText, ChevronDown, ChevronLeft, ChevronRight, Pen, Highlighter, Type, Move, Eraser, Undo, Redo, Save, Download, Files, Settings, X, Maximize, Sun, Moon, LineChart, Calculator, Plus, Trash2, RotateCw, ZoomIn, ZoomOut, MessageSquare, SlidersHorizontal, Copy, PanelLeft, Loader2, Minimize2, Maximize2, TextSelect } from 'lucide-react'
import PDFEraserControls from './PDFEraserControls'
import PDFEditorClock from './PDFEditorClock'
import PDFStopwatch from './PDFStopwatch'
import PDFCountdown from './PDFCountdown'
import PDFFingerMode from './PDFFingerMode'
import './PDFEditorChrome.css'

const annotationTools=[['read','Select text',TextSelect],['pen','Pen',Pen],['highlighter','Highlight',Highlighter],['text','Text',Type],['select','Move',Move],['eraser','Erase',Eraser]]

export default function PDFEditorChrome({doc,tools,pages,view,utilities,input,insert}){
  const [open,setOpen]=useState(null),root=useRef(null),trigger=useRef(null),id=useId()
  const [narrowScreen,setNarrowScreen]=useState(()=>window.matchMedia('(max-width:760px), (max-height:500px) and (orientation:landscape)').matches)
  useEffect(()=>{
    const media=window.matchMedia('(max-width:760px), (max-height:500px) and (orientation:landscape)')
    const changed=()=>{setNarrowScreen(media.matches);setOpen(null)}
    media.addEventListener('change',changed)
    return()=>media.removeEventListener('change',changed)
  },[])
  const [compact,setCompact]=useState(()=>{try{return localStorage.getItem('pdf-toolbar-compact')==='true'}catch{return false}})
  useEffect(()=>{try{localStorage.setItem('pdf-toolbar-compact',String(compact))}catch{}},[compact])
  const close=()=>setOpen(null)
  useEffect(()=>{
    if(!open)return
    const outside=event=>{if(!root.current?.contains(event.target))close()}
    document.addEventListener('pointerdown',outside,true)
    return()=>document.removeEventListener('pointerdown',outside,true)
  },[open])
  useEffect(()=>close(),[view.focus])
  useEffect(()=>close(),[view.toolbarPosition])
  const preferredEdge=view.toolbarPosition==='auto'?(view.focus?'bottom':'top'):view.toolbarPosition
  const toolbarEdge=narrowScreen&&['left','right'].includes(preferredEdge)?(view.focus?'bottom':'top'):preferredEdge
  const vertical=toolbarEdge==='left'||toolbarEdge==='right'
  useEffect(()=>{
    const toolbar=root.current?.querySelector('.pc-toolbar')
    if(!toolbar)return
    const measure=()=>{
      const height=`${toolbar.offsetHeight}px`
      root.current?.style.setProperty('--pdf-toolbar-height',height)
      root.current?.parentElement?.style.setProperty('--pdf-top-toolbar-height',height)
      root.current?.parentElement?.style.setProperty('--pdf-header-height',`${root.current?.querySelector('.pc-header')?.offsetHeight||0}px`)
    }
    measure()
    const observer=new ResizeObserver(measure);observer.observe(toolbar)
    const header=root.current?.querySelector('.pc-header');if(header)observer.observe(header)
    return()=>observer.disconnect()
  },[view.focus,toolbarEdge,compact])
  const run=fn=>()=>{close();fn?.()}
  const iconButton=(Icon,label,fn,disabled=false,active=false)=><button type="button" className={`pc-button pc-icon${active?' is-active':''}`} title={label} aria-label={label} disabled={disabled} onClick={fn}><Icon size={17}/></button>
  const action=(Icon,label,fn,{disabled=false,active=false,danger=false,detail}={})=><button type="button" className={`pc-menu-action${danger?' is-danger':''}${active?' is-active':''}`} onClick={run(fn)} disabled={disabled}><Icon size={16}/><span>{label}{detail&&<small>{detail}</small>}</span>{active&&<i aria-label="Enabled"/>}</button>
  const menu=(key,label,Icon,children,{left=false,custom=null}={})=><div className={`pc-menu-anchor${left?' is-left':''}`}>
    <button type="button" className={`pc-button${open===key||key==='tools'&&['calculate','function','graph','snippet'].includes(tools.current)?' is-active':''}`} aria-expanded={open===key} aria-controls={open===key?`${id}-${key}`:undefined} onClick={event=>{trigger.current=event.currentTarget;setOpen(previous=>previous===key?null:key)}} title={label}>{custom||<><Icon size={16}/><span>{label}</span></>}<ChevronDown size={12}/></button>
    {open===key&&<section id={`${id}-${key}`} className={`pc-popover pc-popover-${key}`} aria-label={label}><div className="pc-popover-title">{label}</div>{children}</section>}
  </div>
  const documentMenu=menu('document','Document',FileText,<>
    {action(Download,doc.downloading?'Exporting…':'Download',doc.onDownload,{disabled:doc.downloading,detail:doc.exportImage?'Export edited image':'Export PDF with annotations'})}
    {doc.onCleanCopy&&action(Copy,doc.copying?'Creating copy…':'Create clean copy',doc.onCleanCopy,{disabled:doc.copying||pages.busy,detail:'Separate document without editor annotations'})}
    {doc.onCleanup&&action(Pen,'Clean up PDF',doc.onCleanup,{disabled:pages.busy,detail:'Use your comments to prepare and review text corrections'})}
    <hr/>{action(Settings,'Document settings',utilities.onSettings,{active:utilities.settingsOpen,detail:'Name, folder, tags and document actions'})}
    {action(Pen,'Stylus setup',utilities.onStylus,{detail:'Button assignments and eraser preferences'})}
    <hr/>{action(X,'Close document',doc.onClose)}
  </>,{left:true})
  const viewMenu=menu('view','View',Maximize,<>
    <label className="pc-field">Toolbar position<select value={view.toolbarPosition} onChange={event=>view.onToolbarPosition(event.target.value)}><option value="auto">Automatic</option><option value="top">Top</option><option value="bottom">Bottom</option><option value="left">Left · vertical</option><option value="right">Right · vertical</option></select></label>
    <div className="pc-zoom-controls">{iconButton(ZoomOut,'Zoom out',view.onZoomOut)}<span>{Math.round(view.scale*100)}%</span>{iconButton(ZoomIn,'Zoom in',view.onZoomIn)}</div>
    {action(Maximize,'Fit page width',view.onFit)}{action(RotateCw,'Rotate view',view.onRotate)}<hr/>
    {!doc.exportImage&&action(Files,'Continuous scrolling',view.onContinuous,{active:view.continuous,disabled:pages.busy})}
    {!doc.exportImage&&<label className="pc-checkbox"><input type="checkbox" checked={doc.copyParagraphs} onChange={event=>doc.onCopyParagraphs(event.target.checked)}/>Join wrapped lines when copying</label>}
    {action(view.dark?Sun:Moon,view.dark?'Switch to light pages':'Switch to dark pages',view.onDark,{detail:'Display only; exports keep original colors'})}
    {action(Maximize,view.focus?'Exit fullscreen':'Enter fullscreen',view.focus?view.onExitFocus:view.onFocus)}
  </>)
  const pagesMenu=!doc.exportImage&&menu('pages','Pages',Files,<>
    <div className="pc-page-controls">{iconButton(ChevronLeft,'Previous page',()=>pages.onNavigate(pages.current-1),pages.current<=1||pages.busy)}<span>{pages.current} of {pages.count||'…'}</span>{iconButton(ChevronRight,'Next page',()=>pages.onNavigate(pages.current+1),pages.current>=pages.count||pages.busy)}</div>
    {action(PanelLeft,'Page thumbnails',pages.onToggleThumbnails,{active:pages.showThumbnails})}
    {action(Files,'Side page',view.onReference,{active:view.reference,disabled:!pages.count||pages.busy})}
    <hr/>{action(Plus,'Add blank page after',pages.onAddBlank,{disabled:!pages.canAdd})}
    <p className="pc-menu-note">Import or duplicate pages from Insert → Pages. Drag thumbnails to reorder.</p>
    <hr/>{action(Trash2,`Delete page ${pages.current}`,pages.onDelete,{danger:true,disabled:!pages.count||pages.count<=1||pages.busy})}
  </>)
  const utilityMenu=menu('tools','More tools',SlidersHorizontal,<>
    {action(FileText,'Search the platform',()=>window.dispatchEvent(new Event('global-search-open')),{detail:'Ctrl / Cmd + K · tasks, files, events and more'})}
    {doc.onCleanup&&action(Pen,'Clean up PDF',doc.onCleanup,{disabled:pages.busy,detail:'Describe changes and review before applying'})}
    <label className="pc-checkbox"><input type="checkbox" checked={utilities.timer} onChange={event=>utilities.onTimer(event.target.checked)}/>Show countdown timer</label>
    <label className="pc-checkbox"><input type="checkbox" checked={utilities.stopwatch} onChange={event=>utilities.onStopwatch(event.target.checked)}/>Show stopwatch</label>
    <label className="pc-checkbox"><input type="checkbox" checked={tools.autoStraightLines} onChange={tools.onAutoStraightLines}/>Detect long straight pen lines</label>
    <label className="pc-checkbox"><input type="checkbox" checked={tools.autoDottedLines} onChange={tools.onAutoDottedLines}/>Detect dotted pen lines</label>
    <p className="pc-menu-note">Draw at least four separate, roughly aligned dots with similar spacing. Detection straightens and spaces them evenly.</p>
    <label className="pc-checkbox"><input type="checkbox" checked={tools.lineUndoTimer} onChange={tools.onLineUndoTimer}/>Auto-hide line undo notice after 15 seconds</label>
    <p className="pc-menu-note">Turn off to keep the notice until you choose Keep or Undo, draw another detected line, or leave the page. Saved on this device.</p><hr/>
    {action(Calculator,'Calculator',utilities.onCalculator,{active:utilities.calculator})}
    {action(Calculator,'Calculate selected region',utilities.onCalculate,{active:tools.current==='calculate',detail:'Printed expressions or handwriting with AI'})}
    {action(Calculator,'Scan function → calculate',utilities.onScanFunction,{active:tools.current==='function',detail:'Select f(x), enter x, and calculate its value'})}
    {action(LineChart,'Graph selected region',utilities.onGraph,{active:tools.current==='graph',detail:'Plot a printed or handwritten function of x'})}
    {(tools.current==='calculate'||tools.current==='function'||tools.current==='graph')&&<label className="pc-field">Recognition<select value={utilities.recognition} onChange={event=>utilities.onRecognition(event.target.value)}><option value="auto">Auto · AI fallback</option><option value="vision">Handwriting / AI</option><option value="text">Text only · local</option></select></label>}
    <hr/>{action(Copy,utilities.copying?'Copying region…':'Copy region',utilities.onCopyRegion,{active:tools.current==='snippet',disabled:utilities.copying,detail:'Drag a box around the content to copy'})}
    {action(Files,'Paste snippet',utilities.onPaste,{disabled:!utilities.canPaste,detail:utilities.snippetReady?'Copied content ready to paste':'Copy a region first'})}
    <hr/>{action(Pen,'Stylus setup',utilities.onStylus)}
  </>)
  const colorMenu=menu('color','Annotation color',Pen,<>
    <div className="pc-swatches">{tools.colors.map(color=><button key={color} type="button" style={{backgroundColor:color}} aria-label={tools.colorNames[color]||color} title={tools.colorNames[color]||color} aria-pressed={tools.color===color} onClick={()=>tools.onColor(color)}/>)}</div>
    <label className="pc-field pc-custom-color">Custom color<input type="color" value={tools.color} onChange={event=>tools.onColor(event.target.value)}/></label>
  </>,{custom:<span className="pc-color-chip" style={{backgroundColor:tools.color}}/>,left:true})
  const text=tools.current==='text',erase=tools.current==='eraser'
  const size=text?tools.fontSize:erase?tools.eraser.size:tools.strokeWidth
  const sizeMenu=menu('brush',erase?'Eraser settings':text?'Text settings':'Stroke settings',SlidersHorizontal,<>
    {erase?<PDFEraserControls {...tools.eraser}/>:<>
      <label className="pc-field">{text?'Font size':'Stroke width'}<div className="pc-size-input"><input type="range" min={text?6:1} max={text?144:40} step={text?1:.5} value={size} onChange={event=>(text?tools.onFontSize:tools.onWidth)(Number(event.target.value))}/><input type="number" aria-label={text?'Exact font size':'Exact stroke width'} min={text?6:1} max={text?144:40} step={text?1:.5} value={size} onChange={event=>{const value=Number(event.target.value);if(event.target.value&&Number.isFinite(value))(text?tools.onFontSize:tools.onWidth)(Math.max(text?6:1,Math.min(text?144:40,value)))}}/><span>pt</span></div></label>
      {!text&&<label className="pc-checkbox"><input type="checkbox" checked={tools.usePressure} onChange={tools.onPressure}/>Use pen pressure</label>}
      {!text&&<><label className="pc-checkbox"><input type="checkbox" checked={tools.autoStraightLines} onChange={tools.onAutoStraightLines}/>Straight-line detection</label><p className="pc-menu-note">Automatically straighten long pen strokes. Turn off to keep freehand strokes. Saved on this device.</p></>}
      {!text&&<label className="pc-checkbox"><input type="checkbox" checked={tools.autoDottedLines} onChange={tools.onAutoDottedLines}/>Dotted-line detection</label>}
      {!text&&<><label className="pc-checkbox"><input type="checkbox" checked={tools.lineUndoTimer} onChange={tools.onLineUndoTimer}/>Auto-hide line undo notice after 15 seconds</label><p className="pc-menu-note">Turn off to keep the Keep/Undo notice available. This does not change regular editor undo.</p></>}
    </>}
  </>,{custom:<span className="pc-size-label">{size} <small>pt</small></span>,left:true})
  return <div ref={root} className={`pdf-chrome is-${toolbarEdge}${view.focus?' is-focus':''}${compact?' is-compact':''}`} data-keep-text-active onKeyDown={event=>{if(open&&event.key==='Escape'){event.preventDefault();event.stopPropagation();close();trigger.current?.focus()}}}>
    {!view.focus&&<header className="pc-header">
      {documentMenu}<div className="pc-file-name"><strong title={doc.name}>{doc.name||'Document editor'}</strong><span className={`pc-save-state is-${doc.saveStatus}`} role="status"><i/>{doc.saveStatus==='saving'?'Saving…':doc.saveStatus==='saved'?'Saved':doc.saveStatus==='error'?'Save failed':'Unsaved'}</span></div>
      <div className="pc-history">{iconButton(Undo,'Undo (Ctrl+Z)',doc.onUndo,!doc.history.undo)}{iconButton(Redo,'Redo (Ctrl+Shift+Z)',doc.onRedo,!doc.history.redo)}</div>
      {!doc.exportImage&&<button type="button" className={`pc-button pc-side-button${view.reference?' is-active':''}`} onClick={view.onReference} aria-pressed={view.reference} disabled={!pages.count||pages.busy}><Files size={16}/><span>Side page</span></button>}
      <StudyPhoneButton className="pc-button"/>{utilities.onAssistant&&<button type="button" className={`pc-button${utilities.assistantOpen?' is-active':''}`} onClick={utilities.onAssistant} aria-pressed={utilities.assistantOpen}><MessageSquare size={16}/><span>AI assistant</span></button>}
      {iconButton(Maximize,'Fullscreen',view.onFocus)}
      <button type="button" className="pc-button pc-save" onClick={doc.onSave} disabled={doc.saveStatus==='saving'}>{doc.saveStatus==='saving'?<Loader2 size={16} className="animate-spin"/>:<Save size={16}/>}<span>Save</span></button>
      {iconButton(X,'Close editor',doc.onClose)}
    </header>}
    <div className="pc-toolbar" role="toolbar" aria-label="PDF annotation tools" aria-orientation={vertical?'vertical':'horizontal'} onMouseDown={event=>{if(event.target.closest('button')&&!event.target.closest('.pc-popover,.pdf-insert-popover'))event.preventDefault()}}>
      <button type="button" className="pc-button pc-compact-toggle" aria-label={compact?'Expand tools toolbar':'Shrink tools toolbar'} title={compact?'Expand toolbar to show all tools':'Shrink toolbar'} aria-pressed={compact} onClick={()=>{close();setCompact(previous=>!previous)}}>{compact?<Maximize2 size={16}/>:<Minimize2 size={16}/>}<span>{compact?'Expand':'Shrink'}</span></button>
      {view.focus&&documentMenu}
      <div className="pc-annotation-group" role="group" aria-label="Annotation tools">{annotationTools.map(([key,label,Icon])=><button key={key} type="button" className={`pc-button pc-tool${tools.current===key?' is-active':''}`} aria-pressed={tools.current===key} title={label} aria-label={label} onClick={()=>{close();tools.onTool(key)}}><Icon size={18}/><span>{label}</span></button>)}</div>
      <div className="pc-brush-group">{colorMenu}{sizeMenu}</div>
      <div className="pc-insert-slot">{isValidElement(insert)?cloneElement(insert,{onOpen:close,closeSignal:`${open||''}:${compact}`}):insert}</div>
      <div className="pc-tool-menus">{pagesMenu}{viewMenu}{utilityMenu}</div>
      <PDFFingerMode {...input}/>
      {utilities.clock&&<PDFEditorClock/>}
      <PDFStopwatch visible={utilities.stopwatch} onHide={()=>utilities.onStopwatch(false)}/>
      <PDFCountdown visible={utilities.timer} onHide={()=>utilities.onTimer(false)}/>
      {view.focus&&<>
        {iconButton(Undo,'Undo',doc.onUndo,!doc.history.undo)}{iconButton(Redo,'Redo',doc.onRedo,!doc.history.redo)}
        {!doc.exportImage&&<button type="button" className={`pc-button pc-side-button${view.reference?' is-active':''}`} onClick={view.onReference} aria-pressed={view.reference} disabled={!pages.count||pages.busy}><Files size={16}/>Side page</button>}
        <StudyPhoneButton className="pc-button"/>{utilities.onAssistant&&<button type="button" className={`pc-button${utilities.assistantOpen?' is-active':''}`} onClick={utilities.onAssistant} aria-pressed={utilities.assistantOpen}><MessageSquare size={16}/>AI assistant</button>}
        {iconButton(Save,'Save',doc.onSave,doc.saveStatus==='saving')}{iconButton(X,'Exit fullscreen',view.onExitFocus)}
      </>}
    </div>
  </div>
}
