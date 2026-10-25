export function folderTree(folders){
  const known=new Set(folders.map(folder=>folder._id)),children=new Map(),visited=new Set(),result=[];
  for(const folder of folders){const parent=known.has(folder.parentId)?folder.parentId:null;if(!children.has(parent))children.set(parent,[]);children.get(parent).push(folder)}
  const visit=(folder,ancestors=[])=>{if(visited.has(folder._id))return;visited.add(folder._id);const path=[...ancestors,folder.name];result.push({...folder,depth:ancestors.length,path:path.join(' / ')});for(const child of children.get(folder._id)||[])visit(child,path)};
  for(const folder of children.get(null)||[])visit(folder);
  for(const folder of folders)if(!visited.has(folder._id))visit(folder);
  return result;
}
export function folderDescendants(folders,id){
  const ids=new Set([id]);let changed=true;
  while(changed){changed=false;for(const folder of folders)if(ids.has(folder.parentId)&&!ids.has(folder._id)){ids.add(folder._id);changed=true}}
  return ids;
}
