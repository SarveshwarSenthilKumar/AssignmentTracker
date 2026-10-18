export default function PDFEraserControls({mode,onMode,size,onSize,shape,onShape,target,onTarget}){
  return <div className="pdf-eraser-controls" role="group" aria-label="Eraser settings">
    <label>Mode<select aria-label="Eraser mode" value={mode} onChange={event=>onMode(event.target.value)}><option value="stroke">Whole stroke</option><option value="precision">Precision · part of a stroke</option><option value="objects">Objects · text and images</option></select></label>
    <label>Shape<select aria-label="Eraser shape" value={shape} onChange={event=>onShape(event.target.value)}><option value="round">Round</option><option value="square">Square</option></select></label>
    <label className="pdf-eraser-size">Size<input type="range" min="2" max="160" value={size} aria-label="Eraser diameter" onChange={event=>onSize(Number(event.target.value))}/></label><label className="pdf-eraser-number"><input type="number" min="2" max="160" value={size} aria-label="Exact eraser size in page points" onChange={event=>{if(event.target.value)onSize(Math.min(160,Math.max(2,Number(event.target.value))))}}/>pt</label>
    <div className="pdf-eraser-presets" aria-label="Eraser size presets">{[6,20,48,96].map(value=><button type="button" key={value} aria-pressed={size===value} onClick={()=>onSize(value)}>{value}</button>)}</div>
    {mode!=='objects'&&<label>Erase<select value={target} aria-label="Ink type to erase" onChange={event=>onTarget(event.target.value)}><option value="all">All ink</option><option value="pen">Pen only</option><option value="highlighter">Highlighter only</option></select></label>}
    <small>{mode==='precision'?'Removes only touched ink segments.':mode==='objects'?'Removes whole text boxes and inserted images.':'Removes each touched stroke completely.'} Original PDF content stays intact. Undo restores each erasing gesture.</small>
  </div>
}
