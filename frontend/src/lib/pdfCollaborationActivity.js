const actions = {
  viewing:'Viewing', selecting:'Selecting text', typing:'Typing', 'editing-text':'Editing text',
  drawing:'Drawing', highlighting:'Highlighting', moving:'Moving', resizing:'Resizing',
  erasing:'Erasing', measuring:'Using ruler', 'selecting-region':'Selecting a region',
  placing:'Placing an insert', working:'Editing', idle:'Viewing'
}
export function collaborationActivity(data) {
  const target = data.targetKind === 'sticky-note' ? 'sticky note' : data.targetKind === 'image' ? 'insert' : data.targetKind === 'text' ? 'text' : ''
  const action = actions[data.action] || ({text:'Editing text',pen:'Drawing',highlighter:'Highlighting',eraser:'Erasing',select:'Moving',read:'Viewing'}[data.tool]) || 'Editing'
  const label = data.action==='editing-text'&&target==='sticky note'?'Editing sticky note':target && ['typing','moving','resizing','erasing'].includes(data.action) ? `${action} ${target}` : action
  const focus = data.rects?.find(rect => rect.kind === 'caret') || data.cursor || data.rects?.[0]
  return { label, page:focus?.page, active:!['viewing','idle',undefined].includes(data.action) }
}
