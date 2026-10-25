import {folderTree,folderDescendants} from '../lib/folderHierarchy'
export default function FolderParentSelect({folders,value,onChange,exclude,disabled=false,label='Parent folder'}){
  const excluded=exclude?folderDescendants(folders,exclude):new Set()
  return <label className="folder-parent-select">{label}<select value={value||''} disabled={disabled} onChange={event=>onChange(event.target.value||null)}><option value="">Top level</option>{folderTree(folders).filter(folder=>!excluded.has(folder._id)).map(folder=><option key={folder._id} value={folder._id}>{folder.path}</option>)}</select></label>
}
