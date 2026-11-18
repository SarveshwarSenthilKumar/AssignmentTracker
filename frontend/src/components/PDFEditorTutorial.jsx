import { useEffect, useRef, useState } from 'react'
import { SHORTCUTS } from '../lib/shortcuts'
import './PDFEditorTutorial.css'

const lessons = [
  ['Getting around', 'The toolbar contains drawing tools, Insert, Pages, View and More tools. Use Expand if it is shrunk. View lets you place the toolbar at the top, bottom or either side.', 'Open View and find Toolbar position.'],
  ['Reading and navigation', 'Select text mode lets you select and copy PDF text. Continuous scrolling displays pages together. Pages provides thumbnails, previous/next navigation and a Side page for reference. View provides zoom, fit width, rotation, fullscreen and dark pages.', 'Open Pages and try the thumbnails. Use View → Fit page width to reset your zoom.'],
  ['Find text', 'Find searches all pages, text annotations and sticky notes. Select a result to jump to its page. Scanned pages, handwriting and images require OCR to become searchable.', 'Open Find and search for a word in your document.'],
  ['Pen and highlighter', 'Choose Pen or Highlighter, then pick the color and size. Pen pressure and stylus controls adapt drawing to supported devices. More tools can detect straight, dotted, dashed and number lines. Undo restores the previous drawing.', 'Choose a pen color and size, then draw on a spare page.'],
  ['Erasing and selecting', 'The eraser has stroke, precision and object options, with size and shape controls. Select lets you move inserts and use their corner handles. Undo and Redo are available in the header.', 'Select an insert and inspect its corner handles.'],
  ['Text editing', 'Choose Text and click blank space to type. Click supported existing PDF text to replace it. The text toolbar changes font size and color. Use corner handles to change wrapping. Replacement quality depends on the source text and available fonts.', 'Add a short text box. Finish with Escape, then select it to move it.'],
  ['Sticky notes', 'Click Sticky note to add a colored editable note. Note color changes its background. Select the note and drag a corner to set its width and height. Notes grow vertically to fit their text and are included in exported PDFs.', 'Add a sticky note, type a reminder, then choose its background color.'],
  ['Files, shapes, tables and stamps', 'Insert supports images and files, shapes, tables and stamps. Media inserts can be moved and resized. As you drag media, pink guides show alignment with page edges, centers and other media. Hold Alt to bypass snapping. Align offers precise page positioning.', 'Open Insert and inspect the available types.'],
  ['Copying regions', 'More tools → Copy region captures a selected area for Paste snippet. Arrow copy lets you select an area, draw an arrow, review a translucent preview and choose Paste copy. Source content remains on the page.', 'Try Copy region on a small area, then Paste snippet.'],
  ['Managing pages', 'Pages can add a blank page or delete the current page while keeping at least one. Insert → Pages imports PDF pages or duplicates a page. Set placement and optional page ranges, then confirm. Drag thumbnails to reorder pages.', 'Open Insert → Pages and review placement and range controls.'],
  ['Ruler, math and graphs', 'More tools includes Ruler, Calculator, Calculate selected region, Scan function, Graph selected region and number-line tools. Ruler draws a straight annotation and displays its length in PDF points. Review recognized expressions before calculating or inserting a result.', 'Open More tools and find Ruler and Calculator.'],
  ['Touch and stylus', 'Finger mode controls touch interaction. Scroll & glide adjusts scrolling and stopping. Stylus setup configures supported pen buttons and eraser behavior. View → Toolbar position can place tools closer to your drawing hand.', 'Open Scroll & glide and inspect the movement controls.'],
  ['Study and AI tools', 'The countdown, stopwatch and Study Phone help with study sessions. The AI assistant and Clean up PDF support available document workflows. AI features require your Gemini key and the relevant Account → AI access permissions. Review proposed changes before applying them.', 'Open More tools to find timers and Document to find Clean up PDF.'],
  ['Saving and exporting', 'Save stores editor changes in your account. Document → Download annotated PDF produces a downloadable copy with ink, text and inserts. Create clean copy produces a separate document without editor annotations. Document settings edits the name, folder and tags. The folder sidebar switches files or creates a new one.', 'Check the save status, then locate Download annotated PDF under Document.'],
  ['Offline editing', 'In the Documents library, make an unlocked PDF available offline before disconnecting. Offline annotations save on the device and sync when you reconnect with the app open. Review conflicts in the offline panel. Sync pending changes before signing out, which clears offline storage.', 'Return to Documents when ready and find Make available offline on the file.']
]

const lessonActions = [
  ['View','Toolbar top','Toolbar bottom'],
  ['Select text','Pages','Page thumbnails','Side page','Continuous scrolling','Fit page width'],
  ['Find'],
  ['Pen','Highlight','Annotation color','Brush size','More tools'],
  ['Erase','Move','Undo (Ctrl+Z)','Redo (Ctrl+Shift+Z)'],
  ['Text','Move'],
  ['Sticky note','Text','Move'],
  ['Insert','Move'],
  ['Copy region','Arrow copy','Paste snippet'],
  ['Pages','Insert','Page thumbnails'],
  ['Ruler','Calculator','Scan function → calculate','Graph selected region','Generate number line'],
  ['Finger drawing','Finger scrolling','Lock page','Unlock page','Scroll & glide','Stylus setup'],
  ['Countdown timer','Stopwatch','AI assistant','Clean up PDF'],
  ['Save','Document','Document settings','Download annotated PDF'],
  ['Document']
]

export default function PDFEditorTutorial({ onClose, actions }) {
  const [step, setStep] = useState(0)
  const [minimized,setMinimized]=useState(false)
  const [notice,setNotice]=useState('')
  const title = useRef(null)
  const root = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    return () => previous?.isConnected && previous.focus({ preventScroll: true })
  }, [])
  useEffect(() => { title.current?.focus({ preventScroll: true }); root.current?.scrollIntoView({ block: 'nearest' }) }, [step])
  const [heading, description, exercise] = lessons[step]
  const available = (actions?.current || []).filter(action => lessonActions[step].includes(action.label))
  return <section ref={root} className={`pdf-tutorial${minimized?' is-minimized':''}`} role="region" aria-label="PDF editor tutorial" onKeyDown={event => {
    event.stopPropagation()
    if (event.key === 'Escape') { event.preventDefault(); onClose() }
  }}>
    <header><strong>{minimized ? heading : 'PDF editor tutorial'}</strong><div className="pdf-tutorial-header-actions"><button type="button" onClick={()=>setMinimized(previous=>!previous)}>{minimized?'Resume lesson':'Minimize'}</button><button type="button" onClick={onClose}>Close tutorial</button></div></header>
    {notice && <p role="status">{notice}</p>}
    {!minimized && <div className="pdf-tutorial-layout">
      <nav aria-label="Tutorial topics">{lessons.map(([label], index) => <button type="button" key={label} aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)}>{label}</button>)}</nav>
      <article>
        <p>Step {step + 1} of {lessons.length}</p>
        <h2 tabIndex={-1} ref={title}>{heading}</h2>
        <p>{description}</p>
        <p className="pdf-tutorial-exercise">{exercise}</p>
        <div className="pdf-tutorial-actions" role="group" aria-label="Try this lesson's tools">
          {available.map(action=><button key={action.label} type="button" disabled={action.disabled} aria-pressed={typeof action.active==='boolean'?action.active:undefined} onClick={()=>{
            action.run?.()
            setNotice(`${action.label} activated. Use the editor, then resume this lesson.`)
            setMinimized(true)
          }}>{action.label}{action.active?' · On':''}</button>)}
        </div>
        <small>These controls use the open document. Undo is available for supported edits.</small>
        <details><summary>Editor keyboard shortcuts</summary><ul>{SHORTCUTS.filter(item => item.scope === 'Visual editor').map(item => <li key={item.id}><kbd>{item.keys}</kbd> {item.label}</li>)}<li><kbd>Ctrl / Cmd + F</kbd> Search this document</li></ul></details>
        <footer><button type="button" disabled={step === 0} onClick={() => setStep(value => value - 1)}>Previous</button>
          {step < lessons.length - 1 ? <button type="button" onClick={() => setStep(value => value + 1)}>Next</button> : <button type="button" onClick={onClose}>Finish tutorial</button>}
        </footer>
      </article>
    </div>}
  </section>
}
