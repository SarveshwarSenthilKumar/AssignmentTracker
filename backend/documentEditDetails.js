const MAX_DETAILS=8;
const short=(value,limit=180)=>{const text=String(value??'');return text.length>limit?`${text.slice(0,limit)}…`:text;};
const number=value=>Number.isFinite(value)?Math.round(value*10)/10:null;
const location=item=>{const x=number(item.x??item.points?.[0]?.x),y=number(item.y??item.points?.[0]?.y);return x===null||y===null?'position not recorded':`x ${x}, y ${y} pt`;};
const size=item=>[item.width??item.textBoxWidth,item.height??item.noteHeight].map(number).map(value=>value===null?'auto':`${value} pt`).join(' × ');
const color=value=>{const names={'#000000':'Black','#000':'Black','#ffffff':'White','#fff':'White','#ff0000':'Red','#ffff00':'Yellow','#fff1a8':'Pale yellow','#00ff00':'Green','#0000ff':'Blue'};const text=String(value??'Default');return names[text.toLowerCase()]?`${names[text.toLowerCase()]} (${text})`:text;};
function pathDescription(item){
  const points=item.points||[];
  if(!points.length)return 'No points';
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const point of points){if(!Number.isFinite(point.x)||!Number.isFinite(point.y))continue;left=Math.min(left,point.x);top=Math.min(top,point.y);right=Math.max(right,point.x);bottom=Math.max(bottom,point.y);}
  return `${points.length} points${Number.isFinite(left)?`, bounds x ${number(left)}–${number(right)}, y ${number(top)}–${number(bottom)} pt`:''}`;
}
const name=item=>item.stickyNote?'Sticky note':item.sourceText?'PDF text':item.tool==='text'?'Text box':item.tool==='image'?`Media insert${item.label?` “${short(item.label,50)}”`:''}`:item.tool==='highlighter'?'Highlight stroke':'Pen stroke';
const label=item=>`${name(item)} on page ${item.page||1}`;
const same=(a,b)=>a===b||JSON.stringify(a)===JSON.stringify(b);

function describeChanges(file,{added,removed,updated,previous,pdfData,action,context}) {
  const details=[];
  const add=detail=>details.push(detail);
  if(context)add({key:'operation',kind:'note',label:action||'Document operation',text:short(context,240)});
  for(const item of added){
    if(item.tool==='text'){
      if(item.sourceText&&item.text===item.sourceText.originalText)add({key:`${item.id}:prepared`,kind:'note',label:label(item),text:`Prepared existing text “${short(item.text)}” for editing.`});
      else add({key:`${item.id}:text`,kind:'text',label:label(item),before:short(item.sourceText?.originalText||''),after:short(item.text)});
      add({key:`${item.id}:position`,kind:'value',label:`${label(item)} position`,before:'Not present',after:location(item)});
      if(item.stickyNote)add({key:`${item.id}:noteColor`,kind:'value',label:`${label(item)} background`,before:'Not present',after:color(item.noteColor)});
    }else add({key:`${item.id}:added`,kind:'note',label:label(item),text:`Added ${name(item).toLowerCase()} at ${location(item)}${item.points?` with ${item.points.length} points and ${number(item.strokeWidth)||2} pt width`:` (${size(item)})`}${item.color?`, color ${item.color}`:''}.`});
  }
  for(const item of removed){
    if(item.tool==='text')add({key:`${item.id}:removed`,kind:'text',label:`${item.sourceText?'Restored original':'Removed'} ${label(item).toLowerCase()}`,before:short(item.text),after:short(item.sourceText?.originalText||'')});
    else add({key:`${item.id}:removed`,kind:'note',label:label(item),text:`Removed ${name(item).toLowerCase()} from ${location(item)}${item.points?` (${item.points.length} points)`:''}.`});
  }
  for(const item of updated){
    const old=previous.get(item.id),title=label(item);
    if(item.text!==old.text)add({key:`${item.id}:text`,kind:'text',label:title,before:short(old.text),after:short(item.text)});
    if(item.page!==old.page)add({key:`${item.id}:page`,kind:'value',label:`${name(item)} page`,before:String(old.page||1),after:String(item.page||1)});
    if(item.x!==old.x||item.y!==old.y)add({key:`${item.id}:position`,kind:'value',label:`${title} position`,before:location(old),after:location(item)});
    if(['width','height','textBoxWidth','noteHeight'].some(key=>!same(item[key],old[key])))add({key:`${item.id}:size`,kind:'value',label:`${title} size`,before:size(old),after:size(item)});
    for(const [key,titleSuffix,unit] of [['fontSize','font size',' pt'],['strokeWidth','stroke width',' pt'],['color','color',''],['noteColor','background color','']]){
      if(!same(item[key],old[key]))add({key:`${item.id}:${key}`,kind:'value',label:`${title} ${titleSuffix}`,before:unit?(old[key]==null?'Default':`${old[key]}${unit}`):color(old[key]),after:unit?(item[key]==null?'Default':`${item[key]}${unit}`):color(item[key])});
    }
    if(!same(item.textStyle,old.textStyle)){
      const styles=['fontName','fontFamily','fontWeight','italic','letterSpacing','horizontalScale'];
      for(const key of styles)if(!same(item.textStyle?.[key],old.textStyle?.[key]))add({key:`${item.id}:style:${key}`,kind:'value',label:`${title} ${key.replace(/([A-Z])/g,' $1').toLowerCase()}`,before:short(old.textStyle?.[key]??'Default'),after:short(item.textStyle?.[key]??'Default')});
    }
    if(!same(item.points,old.points))add({key:`${item.id}:points`,kind:'value',label:`${title} path`,before:pathDescription(old),after:pathDescription(item)});
    if(item.dataUrl!==old.dataUrl)add({key:`${item.id}:asset`,kind:'note',label:title,text:'Replaced the inserted media content.'});
  }
  if(pdfData&&!Buffer.from(pdfData).equals(file.pdfData)){
    const bytes=Buffer.from(pdfData),original=file.pdfData;
    const textFile=/^text\//i.test(file.mimeType||'')||/\.(txt|md|markdown|csv|tsv|json|ya?ml)$/i.test(file.originalName||'');
    if(textFile&&original.length<=1024*1024&&bytes.length<=1024*1024){
      const before=original.toString('utf8'),after=bytes.toString('utf8');
      if(Buffer.from(before).equals(original)&&Buffer.from(after).equals(bytes)){
        let start=0,line=1;
        while(start<before.length&&start<after.length&&before[start]===after[start]){if(before[start]==='\n')line++;start++;}
        const from=Math.max(before.lastIndexOf('\n',Math.max(0,start-1))+1,start-60);
        add({key:`file:text:${line}`,kind:'text',label:`File text near line ${line}`,before:short(before.slice(from)),after:short(after.slice(from))});
        add({key:'file:text:length',kind:'value',label:'Document text length',before:`${before.length} characters`,after:`${after.length} characters`});
      }
    }
    if(original.length!==bytes.length)add({key:'file:size',kind:'value',label:'Saved file size',before:`${original.length.toLocaleString('en-US')} bytes`,after:`${bytes.length.toLocaleString('en-US')} bytes`});
  }
  return details;
}
function mergeDetails(old,incoming){
  const merged=new Map((old||[]).map(detail=>[detail.key,detail]));
  for(const item of incoming){const detail={key:short(item.key,300),kind:item.kind,label:short(item.label,160),...(item.text!==undefined&&{text:short(item.text,240)}),...(item.before!==undefined&&{before:short(item.before,240)}),...(item.after!==undefined&&{after:short(item.after,240)})};const previous=merged.get(detail.key);merged.set(detail.key,{...detail,...(previous&&Object.hasOwn(previous,'before')?{before:previous.before}:{})});}
  return {details:[...merged.values()].slice(0,MAX_DETAILS),detailsTruncated:merged.size>MAX_DETAILS};
}
function description(details,action){
  const first=details.find(detail=>detail.key==='operation')||details.find(detail=>detail.kind==='text')||(action==='Resized annotations'&&details.find(detail=>detail.key.endsWith(':size')||detail.key.endsWith(':fontSize')))||details[0];
  if(!first)return action;
  if(first.kind==='note')return short(`${first.label}: ${first.text}`,280);
  return short(`${first.label}: ${first.before?`“${short(first.before,60)}”`:'(empty)'} → ${first.after?`“${short(first.after,60)}”`:'(empty)'}`,280);
}
module.exports={describeChanges,mergeDetails,description};
