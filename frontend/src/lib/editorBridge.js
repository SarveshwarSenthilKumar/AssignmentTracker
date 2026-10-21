// A capability exists only while its editor is mounted in this browser tab.
const editors=new Map()
export function registerEditor(id,api){editors.set(id,api);return()=>{if(editors.get(id)===api)editors.delete(id)}}
export async function editorSnapshot(id){return editors.get(id)?.snapshot()||null}
export async function applyEditorActions(id,snapshot,actions){
  const editor=editors.get(id)
  if(!editor)throw new Error('The document editor was closed. Open it and ask again.')
  if(JSON.stringify(await editor.snapshot())!==JSON.stringify(snapshot))throw new Error('The document changed while the assistant was replying. No AI edits were applied; ask again using the latest version.')
  return editor.apply(actions)
}
