const {createHash,randomBytes}=require('node:crypto');
const {describeChanges,mergeDetails,description}=require('./documentEditDetails');
const LIMIT=300;
const normalized=items=>(items||[]).map((item,index)=>item.id?item:{...item,id:`legacy-${index}-${createHash('sha256').update(JSON.stringify(item)).digest('hex').slice(0,16)}`});
const equal=(a,b)=>a===b||JSON.stringify(a)===JSON.stringify(b);

function appendHistory(file,actor,{annotations,pdfData,action,pages=[],context}={}) {
  const history=[...(file.editHistory||[])];
  const before=normalized(file.annotations),after=annotations===undefined?before:normalized(annotations);
  const previous=new Map(before.map(item=>[item.id,item])),current=new Map(after.map(item=>[item.id,item]));
  const added=after.filter(item=>!previous.has(item.id)),removed=before.filter(item=>!current.has(item.id));
  const updated=after.filter(item=>previous.has(item.id)&&!equal(item,previous.get(item.id)));
  const bytesChanged=pdfData&&!Buffer.from(pdfData).equals(file.pdfData);
  if(!action&&!bytesChanged&&!added.length&&!removed.length&&!updated.length)return history;
  const affected=[...added,...removed,...updated];
  if(!action){
    if(bytesChanged)action='Updated file contents';
    else if(removed.length&&!added.length&&!updated.length)action='Erased or deleted annotations';
    else if(added.length&&!removed.length&&!updated.length){
      action=added.every(item=>item.sourceText&&item.text===item.sourceText.originalText)?'Prepared PDF text for editing':added.every(item=>item.stickyNote)?'Added sticky notes':added.every(item=>item.tool==='text')?'Added text':added.every(item=>item.points)?'Drew ink':added.every(item=>item.tool==='image')?'Inserted media':'Added annotations';
    }else if(updated.length&&!added.length&&!removed.length){
      if(updated.some(item=>item.text!==previous.get(item.id).text))action='Edited text';
      else if(updated.some(item=>['width','height','textBoxWidth','noteHeight','fontSize'].some(key=>!equal(item[key],previous.get(item.id)[key]))))action='Resized annotations';
      else if(updated.some(item=>item.x!==previous.get(item.id).x||item.y!==previous.get(item.id).y))action='Moved annotations';
      else if(updated.some(item=>['color','noteColor','strokeWidth','textStyle'].some(key=>!equal(item[key],previous.get(item.id)[key]))))action='Changed formatting';
      else action='Edited annotations';
    }else action='Edited annotations';
  }
  const affectedPages=[...new Set([...pages,...affected.map(item=>item.page||1)])].filter(Number.isInteger).sort((a,b)=>a-b).slice(0,20);
  const actorKey=actor?.person||actor?.userId||'unknown';
  const name=actor?.name||actor?.username||(actor?.person?`Guest ${actor.person.slice(0,4).toUpperCase()}`:'Document owner');
  const key=createHash('sha256').update(JSON.stringify([actorKey,action,affectedPages])).digest('hex');
  const now=new Date(),last=history[history.length-1];
  const incoming=describeChanges(file,{added,removed,updated,previous,pdfData,action,context});
  if(last&&Array.isArray(last.details)&&last.key===key&&now-new Date(last.at)<5000){
    const detail=mergeDetails(last.details,incoming);
    history[history.length-1]={...last,...detail,detailsTruncated:last.detailsTruncated||detail.detailsTruncated,description:description(detail.details,action),at:now,updates:(last.updates||1)+1};
  }else{const detail=mergeDetails([],incoming);history.push({id:randomBytes(12).toString('hex'),key,actor:name,action,...detail,description:description(detail.details,action),pages:affectedPages,startedAt:now,at:now,updates:1});}
  const retained=history.slice(-LIMIT);
  let bytes=Buffer.byteLength(JSON.stringify(retained));
  while(retained.length>1&&bytes>512*1024)bytes-=Buffer.byteLength(JSON.stringify(retained.shift()))+1;
  return retained;
}
function historyPage(file,query) {
  const all=[...(file.editHistory||[])].reverse(),limit=Math.max(1,Math.min(100,parseInt(query.limit,10)||40));
  const start=query.before?all.findIndex(item=>item.id===query.before)+1:0;
  const items=query.before&&start===0?[]:all.slice(start,start+limit);
  return {items:items.map(({key,...item})=>item),nextCursor:start+items.length<all.length&&items.length?items[items.length-1].id:null,retained:all.length,limit:LIMIT};
}
module.exports={appendHistory,historyPage};
