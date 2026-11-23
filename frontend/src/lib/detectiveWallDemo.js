// Hidden, entirely fictional case-board prop. No external images or AI requests.
import {DETECTIVE_CASES} from './detectiveCaseTemplates'
export const isCaseBoardShortcut=event=>!event.repeat&&!event.isComposing&&(event.ctrlKey||event.metaKey)&&event.altKey&&event.shiftKey&&event.code==='KeyD'

function themedEvidence(kind,index,title,theme,entry){
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=460
  const c=canvas.getContext('2d');if(!c)throw new Error('Could not create the case illustrations.')
  c.fillStyle=['#d9d0b9','#e6decc','#d5cbb7'][index%3];c.fillRect(0,0,640,460)
  c.fillStyle='#3e3931';c.font='bold 15px monospace';c.fillText(`${theme.code} / EXHIBIT ${index+1} / WORKING COPY`,24,30)
  c.font='bold 27px Georgia';c.fillText(title.slice(0,35),25,77)
  const lines=(entry?.notes||[theme.description]).flatMap(text=>text.split('\n'))
  const wrap=(text,x,y,width,font='17px Georgia')=>{
    c.font=font;let row='',line=0
    for(const word of text.split(/\s+/)){const next=row?`${row} ${word}`:word;if(c.measureText(next).width>width&&row){c.fillText(row,x,y+line*25);line++;row=word}else row=next}
    if(row)c.fillText(row,x,y+line*25)
  }
  if(kind==='portrait'){
    c.fillStyle='#343631';c.fillRect(30,100,235,280);c.fillStyle='#73746a';c.beginPath();c.ellipse(146,190,59,73,0,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(147,346,105,97,0,Math.PI,Math.PI*2);c.fill()
    c.fillStyle='#d6cfbb';c.font='13px monospace';c.fillText('PROFILE RECONSTRUCTION',39,367)
    c.fillStyle='#443b30';lines.slice(0,4).forEach((line,i)=>wrap(line,290,130+i*65,315,'18px Georgia'))
  }else if(kind==='map'||kind==='diagram'){
    const labels=theme.clusters.filter((_,i)=>i%2===0).map(item=>item.name)
    const points=[[140,155],[465,145],[165,320],[470,315]]
    c.strokeStyle='#807361';c.lineWidth=2;for(const [x,y]of points){c.strokeRect(x-95,y-35,190,70)}
    c.strokeStyle='#9e3c34';c.setLineDash([8,6]);c.lineWidth=3;c.beginPath();points.forEach(([x,y],i)=>{if(i)c.lineTo(x,y);else c.moveTo(x,y)});c.stroke();c.setLineDash([])
    c.fillStyle='#403b32';c.font='12px monospace';points.forEach(([x,y],i)=>c.fillText(labels[i].slice(0,23),x-84,y+3));c.font='19px cursive';c.fillText('sequence ≠ chronology?',175,397)
  }else if(kind==='newspaper'){
    c.font='bold 27px Georgia';c.fillText(theme.id==='gone-girl'?'DISAPPEARANCE DRAWS ATTENTION':'INQUIRY FOLLOWS A PATTERN',25,126)
    c.fillRect(25,139,585,2);for(let col=0;col<3;col++)for(let row=0;row<8;row++){c.font='12px Georgia';c.fillText(lines[(col+row)%lines.length].slice(0,29),26+col*200,175+row*25)}
    c.strokeStyle='#993a31';c.lineWidth=3;c.strokeRect(16,96,608,44)
  }else{
    c.strokeStyle='#8c806f';c.lineWidth=1;for(let y=130;y<400;y+=33){c.beginPath();c.moveTo(27,y);c.lineTo(612,y);c.stroke()}
    lines.slice(0,6).forEach((line,i)=>wrap(line,36,119+i*45,560,kind==='letter'?'21px "Segoe Print", cursive':'17px monospace'))
    c.strokeStyle='#a43d31';c.lineWidth=3;c.beginPath();c.ellipse(310,207,260,45,-.035,0,Math.PI*2);c.stroke()
  }
  for(let i=0;i<900;i++){c.fillStyle=i%2?'#fff9de19':'#77563212';c.fillRect(Math.random()*640,Math.random()*460,2,1)}
  c.fillStyle='#6d5e4a';c.font='12px monospace';c.fillText(`${theme.source.toUpperCase()} / FAN-MADE VISUAL RECONSTRUCTION`,23,442)
  return canvas.toDataURL('image/jpeg',.85)
}

function evidenceImage(kind,index,title,theme,entry){
  if(theme&&theme.id!=='meridian')return themedEvidence(kind,index,title,theme,entry)
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=420
  const c=canvas.getContext('2d')
  if(!c)throw new Error('Your browser could not create the evidence illustrations.')
  const dark=kind==='surveillance'||kind==='signal'
  c.fillStyle=dark?'#192225':'#e5ddc8';c.fillRect(0,0,640,420)
  c.strokeStyle=dark?'#7da392':'#93816a';c.fillStyle=dark?'#9cbda6':'#443c33'
  if(kind==='map'){
    c.lineWidth=12
    for(let x=45;x<640;x+=95){c.beginPath();c.moveTo(x,55);c.lineTo(x+40,360);c.stroke()}
    for(let y=95;y<370;y+=65){c.beginPath();c.moveTo(10,y);c.lineTo(630,y-15);c.stroke()}
    c.strokeStyle='#7d979d';c.lineWidth=32;c.beginPath();c.moveTo(0,270);c.bezierCurveTo(170,180,380,400,640,160);c.stroke()
    c.strokeStyle='#a43538';c.lineWidth=4;c.setLineDash([9,7]);c.beginPath();c.moveTo(120,120);c.lineTo(470,170);c.lineTo(350,310);c.closePath();c.stroke();c.setLineDash([])
    for(const [x,y,label]of [[120,120,'RELAY'],[470,170,'PIER 9'],[350,310,'ARCHIVE']]){c.beginPath();c.arc(x,y,20,0,Math.PI*2);c.stroke();c.fillStyle='#492f2b';c.font='bold 16px monospace';c.fillText(label,x+26,y+5)}
  }else if(kind==='surveillance'){
    c.fillStyle='#2e3b3b';c.fillRect(0,160,640,260)
    for(let x=20;x<640;x+=82){c.fillStyle=`hsl(160 8% ${19+(x%13)}%)`;c.fillRect(x,80+(x%67),66,250);c.fillStyle='#91a490';for(let y=125;y<300;y+=42)c.fillRect(x+18,y,8,12)}
    c.fillStyle='#111a1a';c.fillRect(0,330,640,90);c.fillStyle='#7b8980';c.fillRect(285,265,190,56);c.fillStyle='#131d1b';c.fillRect(315,245,85,28)
    c.fillStyle='#0c1212';for(const x of [320,435]){c.beginPath();c.arc(x,326,19,0,Math.PI*2);c.fill()}
    c.strokeStyle='#b27f70';c.lineWidth=3;c.strokeRect(275,235,212,109);c.font='16px monospace';c.fillStyle='#bed0ba';c.fillText(`CAM 0${index+1}  //  03:17:4${index%10}`,28,70)
    c.strokeStyle='#b0c5b317';c.lineWidth=1;for(let y=0;y<420;y+=4){c.beginPath();c.moveTo(0,y);c.lineTo(640,y);c.stroke()}
  }else if(kind==='signal'){
    c.strokeStyle='#6b948339';c.lineWidth=1
    for(let x=20;x<640;x+=25){c.beginPath();c.moveTo(x,65);c.lineTo(x,370);c.stroke()}
    for(let y=70;y<390;y+=25){c.beginPath();c.moveTo(15,y);c.lineTo(625,y);c.stroke()}
    c.strokeStyle='#acd6b1';c.lineWidth=2;c.beginPath()
    for(let x=20;x<620;x++){const y=220+Math.sin(x*.055)*24+Math.sin(x*.16+index)*10+(x%145<14?Math.sin(x)*105:0);if(x===20)c.moveTo(x,y);else c.lineTo(x,y)}c.stroke()
    c.fillStyle='#c6d9bd';c.font='18px monospace';c.fillText('47.3 MHz  /  BURST INTERVAL: 17s',30,90);c.fillText('... -- .-.. / 04 / 17 / 09',30,365)
  }else if(kind==='receipt'){
    c.fillStyle='#b6aa91';c.fillRect(0,0,640,420);c.save();c.translate(310,204);c.rotate(-.04)
    c.fillStyle='#eee8d8';c.fillRect(-165,-178,330,370);c.fillStyle='#504a3f';c.textAlign='center';c.font='bold 20px monospace';c.fillText(['RIVER ROAD SERVICE','NORTH QUAY STORES','VALE REPAIR WORKS'][index%3],0,-137)
    c.font='14px monospace';c.fillText(`RECEIPT 00${471+index} / CASH`,0,-104)
    const rows=['02:58  /  NIGHT COUNTER','--------------------------------','1 x brass housing       47.00','2 x timing relay        34.00','1 x service key          0.00','--------------------------------','TOTAL                   81.00','CUSTOMER COPY','signature not required']
    rows.forEach((row,i)=>c.fillText(row,0,-67+i*25));c.strokeStyle='#9e3836';c.lineWidth=3;c.beginPath();c.ellipse(0,29,154,21,0,0,Math.PI*2);c.stroke();c.restore();c.textAlign='start'
  }else if(kind==='newspaper'){
    c.fillStyle='#302e29';c.font='bold 31px Georgia';c.fillText('THE MERIDIAN EVENING LEDGER',22,78)
    c.font='12px Georgia';c.fillText('LATE CITY EDITION                 FRIDAY                  ARCHIVE COPY',26,101)
    c.fillRect(24,111,592,2);c.font='bold 25px Georgia';c.fillText(index%2?'River gate closed without warning':'Harbor inquiry left unanswered',24,146)
    c.fillStyle='#746e60';c.fillRect(25,166,224,132);c.fillStyle='#484a43';for(let x=32;x<240;x+=39)c.fillRect(x,193+(x%31),28,106)
    c.strokeStyle='#d3c8ae';c.lineWidth=2;for(let y=170;y<298;y+=4){c.beginPath();c.moveTo(25,y);c.lineTo(249,y);c.stroke()}
    c.fillStyle='#504a40';c.font='11px Georgia'
    const copy=['Officials declined to explain','why the overnight inspection','was absent from the harbor log.','A second copy of the schedule','has not yet been located.','Residents reported a short','interruption to the radio signal.']
    for(let col=0;col<3;col++)for(let row=0;row<14;row++){if(col===0&&row<10)continue;c.fillText(copy[(row+col+index)%copy.length],26+col*200,178+row*14)}
    c.strokeStyle='#953c32';c.lineWidth=3;c.strokeRect(18,119,590,38)
  }else if(kind==='letter'){
    c.fillStyle='#433d34';c.font='19px Georgia';c.fillText('N —',58,95)
    c.font='22px "Segoe Print", cursive'
    const lines=['Please stop asking for the ledger.','You have the wrong copy.','There were only six deliveries.','The seventh was a return.','','If the clocks agree, check the bell.','','Burn this after you read it.']
    lines.forEach((line,i)=>c.fillText(line,55,132+i*29));c.strokeStyle='#966c58';c.lineWidth=2;c.beginPath();c.moveTo(60,254);c.lineTo(512,247);c.stroke()
    c.fillStyle='#806d55';c.font='13px monospace';c.fillText('found inside envelope / no postmark',45,377)
  }else if(kind==='diagram'){
    c.strokeStyle='#665d4f';c.lineWidth=3
    c.strokeRect(62,83,490,263);c.strokeRect(74,95,180,108);c.strokeRect(270,95,267,108);c.strokeRect(74,221,284,108);c.strokeRect(375,221,162,108)
    c.font='16px monospace';c.fillStyle='#504638';c.fillText('STORES',105,152);c.fillText('RELAY ROOM',312,152);c.fillText('LOADING BAY',132,281);c.fillText('OFFICE',400,281)
    c.strokeStyle='#ab3d35';c.lineWidth=4;c.setLineDash([9,6]);c.beginPath();c.moveTo(220,370);c.lineTo(220,290);c.lineTo(405,290);c.lineTo(405,145);c.stroke();c.setLineDash([])
    c.font='20px "Segoe Print", cursive';c.fillStyle='#9c3e34';c.fillText('door sealed?',370,365);c.fillText('N ↑',568,95)
  }else{
    c.fillStyle='#403b34';c.font='bold 23px monospace';c.fillText(index%2?'NIGHT WATCH / DUTY LEDGER':'HARBOR AUTHORITY / ACCESS LOG',28,85)
    c.font='15px monospace'
    const lines=['ENTRY 047 — ACCESS LOG','03:04  NIGHT TRANSFER AUTHORIZED','03:11  SERVICE GATE: MANUAL OVERRIDE','03:17  RELAY TRANSMISSION DETECTED','03:22  VEHICLE DEPARTS VIA EAST RAMP','03:29  RECORD CORRECTION REQUESTED','SIGNATURE: ____________________']
    lines.forEach((line,i)=>c.fillText(line,30,130+i*31))
    c.fillStyle='#38352f';c.fillRect(260+index%4*9,144,220,18);c.fillRect(170+index%3*14,238,250,18)
    c.strokeStyle='#a04439';c.lineWidth=4;c.beginPath();c.ellipse(240,222,220,22,-.025,0,Math.PI*2);c.stroke()
  }
  if(!dark){
    c.strokeStyle='#856a3b23';c.lineWidth=2;c.beginPath();c.moveTo(310+index*3,35);c.lineTo(327+index*3,390);c.stroke()
    if(index%3===0){c.lineWidth=5;c.strokeStyle='#875c2e28';c.beginPath();c.ellipse(555,326,49,43,-.3,0,Math.PI*2);c.stroke()}
    for(let i=0;i<1300;i++){c.fillStyle=i%2?'#fff8df18':'#69533213';c.fillRect(Math.random()*640,Math.random()*420,Math.random()*3+1,1)}
    c.save();c.translate(460,335);c.rotate(-.16);c.strokeStyle='#9b473b70';c.lineWidth=2;c.strokeRect(-32,-18,160,36);c.fillStyle='#9b473b90';c.font='bold 18px monospace';c.fillText(index%2?'COPY 2':'RECEIVED',-18,7);c.restore()
  }
  c.fillStyle=dark?'#0f1719dd':'#d3c7acdd';c.fillRect(0,0,640,37);c.fillRect(0,386,640,34)
  c.fillStyle=dark?'#d5d8bf':'#4c4034';c.font='bold 16px monospace';c.fillText(title.toUpperCase(),18,25);c.font='12px monospace';c.fillText(`M-47 / ${String(index+1).padStart(2,'0')}    ${index%2?'SECOND COPY — COMPARE WITH ORIGINAL':'ATTACHED TO STATEMENT / NIGHT INQUIRY'}`,18,407)
  return canvas.toDataURL('image/jpeg',.86)
}

export function generateCaseBoard(caseId='meridian'){
  const theme=DETECTIVE_CASES.find(item=>item.id===caseId)||DETECTIVE_CASES.find(item=>item.id==='meridian')
  const nodes=[],strings=[],id=()=>crypto.randomUUID(),edges=new Set()
  const random=(min,max)=>min+Math.random()*(max-min)
  const pick=items=>items[Math.floor(Math.random()*items.length)]
  const shuffle=items=>{const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result}
  const aged={'#fff1a8':'#e8d594','#ffd0c5':'#d9b59d','#ccebd2':'#c7c9ab','#cce3ff':'#c4cecd','#e1d2f5':'#d2c6b4','#ffffff':'#ece4cf'}
  const note=(text,x,y,color='#fff1a8',width=285,height=230)=>{
    const paperStyle=pick(['sticky','sticky','paper','paper','index','torn'])
    const node={id:id(),type:'note',x:Math.max(70,x+random(-65,65)),y:Math.max(70,y+random(-55,55)),width:Math.round(width*random(.82,1.19)),height:Math.round(height*random(.8,1.12)),rotation:random(-13,12),color:paperStyle==='sticky'?(aged[color]||color):pick(['#e8dfc9','#d9ceb6','#eee7d8','#e4dac1']),text,paperStyle,fontSize:Math.round(random(18,24))};nodes.push(node);return node
  }
  const pin=(text,x,y,color='#b52b35')=>{const size=random(60,82),node={id:id(),type:'pin',x:Math.max(70,x+random(-75,75)),y:Math.max(70,y+random(-65,65)),width:size,height:size,rotation:random(-8,8),color,text};nodes.push(node);return node}
  const photo=(kind,title,text,x,y,index,entry)=>{
    const width=Math.round(random(270,465)),imageHeight=Math.round(width*random(.58,.85))
    const node={id:id(),type:'photo',x:Math.max(70,x+random(-80,80)),y:Math.max(70,y+random(-80,80)),width,height:imageHeight+95,imageHeight,rotation:random(-11,12),color:pick(['#dfd4bb','#ece4cf','#e8ddc7']),text,paperStyle:'photo',fontSize:Math.round(random(13,17)),image:evidenceImage(kind,index,title,theme,entry)};nodes.push(node);return node
  }
  const connect=(from,to,text='',color='#ac2936',width=4)=>{
    if(from.id===to.id)return
    const key=[from.id,to.id].sort().join(':');if(edges.has(key))return
    edges.add(key);strings.push({id:id(),from:from.id,to:to.id,color,width:Math.max(2,Math.min(12,width+random(-1.2,1.7))),text:Math.random()<.55?text:'',slack:Math.random()<.18?random(-190,-30):random(20,330)})
  }
  const center=note('MERIDIAN / 47\n\nWho moved the clock?\n\nNOT a coincidence.\nCheck the original.',2460,1760,'#ffd0c5',430,310)
  const cipher=note('47 = frequency?\nnot a date.\n\nRiver gate → relay?\nLog changed AFTER the burst.\nAsk Vale again.',2940,2040,'#fff1a8',360,285)
  const question=note('WRONG QUESTION?\n\nNot “what went missing”\n— what came BACK?\n\n17 minutes unaccounted for.',2180,2300,'#cce3ff',350,260)
  if(theme.center){center.text=theme.center;cipher.text=theme.theory;question.text=theme.question}
  connect(center,cipher,theme.linkLabel||'THE MISSING INTERVAL','#af2837',8);connect(center,question,'REOPEN','#af2837',7)
  const cases=[
    {name:'NORTH RELAY',x:450,y:400,kind:'signal',color:'#ccebd2',notes:['47.3 MHz\nRepeated every 17 seconds.\nThe last burst contains an extra tone.','03:17 is on every log.\nDifferent clocks. Same minute.\nToo consistent to be an accident.','Compare waveform B with the pier recording.\nSame background hum?'],code:'A / 47.3'},
    {name:'THE NIGHT ROUTE',x:2250,y:300,kind:'map',color:'#fff1a8',notes:['Three stops, zero toll records.\nThe service road avoids every public camera.','Driver uses the EAST ramp.\nThe manifest says WEST.\nWhich document is wrong?','River route matches the constellation drawn on the envelope.'],code:'B / EAST'},
    {name:'PIER NINE',x:4070,y:420,kind:'surveillance',color:'#ffd0c5',notes:['White van. No front plate.\nArrives 03:11; leaves 03:22.\nNo one unloads it.','Why is the loading bay light already on?\nSomeone was waiting.','Photo has TWO shadows.\nCheck the second light source.'],code:'C / 09'},
    {name:'THE SEALED ARCHIVE',x:300,y:1600,kind:'report',color:'#e1d2f5',notes:['Access sheet signed by “N. Vale”.\nThat name is absent from the roster.','Original carbon copy has a different gate number.\nSomeone changed the record.','Find the first version.\nThe redacted line is longer than a name.'],code:'D / COPY 2'},
    {name:'EASTERN WATCH',x:4290,y:1640,kind:'map',color:'#cce3ff',notes:['Observer reports a blue umbrella.\nNo rain that night.\nSignal or coincidence?','A chalk circle marks the meeting point.\nIt was drawn BEFORE the van arrived.','Look at the street signs.\nThis photo is mirrored.'],code:'E / REVERSE'},
    {name:'THE CLOCKMAKER',x:420,y:2910,kind:'report',color:'#fff1a8',notes:['Repair invoice: 17 minutes slow.\nAll four clocks serviced on the same day.','“Nothing was stolen.\nSomething was returned.”\n— unsigned interview note','The maker’s mark appears on the relay housing.'],code:'F / -17'},
    {name:'SIGNAL ECHO',x:2270,y:3060,kind:'signal',color:'#ffd0c5',notes:['Second receiver hears the burst FIRST.\nThe transmitter is not at the tower.','The pattern changes when the river gate opens.\nTest that relationship.','Decoded fragment:\n“BRING THE ORIGINAL”\nOriginal WHAT?'],code:'G / ECHO'},
    {name:'THE LAST WITNESS',x:4130,y:2910,kind:'surveillance',color:'#ccebd2',notes:['Witness describes a red folder.\nCamera shows an empty hand.\nAnother visit?','Two calls to a disconnected number.\nBoth lasted exactly 47 seconds.','The witness never mentions the van.\nOnly the sound of a clock.'],code:'H / 47s'}
  ]
  const centers=[{x:600,y:460},{x:2090,y:240},{x:3860,y:630},{x:440,y:1970},{x:4330,y:1770},{x:1050,y:3320},{x:2900,y:3370},{x:4400,y:2950}]
  const clusters=(theme.clusters||cases).map((source,index)=>{
    const entry={...source,...centers[index]},angle=random(-.22,.22),stretch=random(.8,1.2)
    const slots=shuffle([[-130,-40],[230,-100],[580,95],[-40,270],[340,280],[120,570],[610,420]])
    const position=()=>{const [x,y]=slots.pop();return {x:entry.x+(x*Math.cos(angle)-y*Math.sin(angle))*stretch,y:entry.y+(x*Math.sin(angle)+y*Math.cos(angle))*stretch}}
    const at=(callback)=>{const p=position();return callback(p.x,p.y)}
    const heading=at((x,y)=>note(`${entry.name}\n${entry.code}\n\n${pick(['still no answer','need the original','check this AGAIN','who signed this?','does not add up'])}`,x,y,entry.color,random(220,340),random(160,230)))
    const image=at((x,y)=>photo(entry.kind,entry.name,`ex. ${index+1} / ${entry.code}`,x,y,index,entry))
    const detail=at((x,y)=>photo(pick(['receipt','newspaper','report','letter','diagram']),`FILE ${entry.code}`,'compare the accounts',x,y,index+8,entry))
    const a=at((x,y)=>note(entry.notes[0],x,y,entry.color))
    const b=at((x,y)=>note(entry.notes[1],x,y,index%2?'#e1d2f5':'#fff1a8'))
    const c=at((x,y)=>note(entry.notes[2],x,y,'#cce3ff'))
    const junction=at((x,y)=>pin(entry.code,x,y,index%2?'#3d668d':'#a52e36'))
    connect(heading,image,'EXHIBIT','#ac2936',5);connect(image,a,'','#ad7846',4);connect(a,b,theme.clusters?'CHECK SEQUENCE':'CHECK TIME','#ac2936',5)
    connect(b,c,'','#436a86',4);connect(c,detail,'','#b03d43',4);connect(heading,junction,'','#ac2936',6)
    connect(junction,image,'','#ac2936',4);connect(junction,detail,'','#ad7846',4);connect(a,c,'','#ad7846',3)
    connect(center,heading,index%2?'':theme.clusters?'COMPARE ACCOUNTS':'SAME NIGHT','#a52b37',6);connect(cipher,junction,'','#436a86',4)
    return {heading,image,detail,a,b,c,junction}
  })
  clusters.forEach((cluster,i)=>{
    const next=clusters[(i+1)%8],opposite=clusters[(i+4)%8],diagonal=clusters[(i+3)%8]
    connect(cluster.junction,next.junction,'','#ac2936',5)
    if(i%2===0)connect(cluster.image,opposite.b,i%3===0?(theme.clusters?'pattern match?':'same minute?'):'','#a52e36',5)
    connect(cluster.a,diagonal.detail,'','#456b86',4)
    connect(cluster.c,next.image,'','#ad7846',3)
    connect(cluster.b,opposite.junction,'','#a52e36',4)
    connect(cluster.detail,question,'','#ad7846',3)
    if(i%3!==0)connect(cluster.heading,diagonal.c,'','#ac2936',4)
  })
  const timeline=['02:47 · FIRST CALL','03:04 · ACCESS APPROVED','03:11 · VAN ARRIVES','03:17 · SIGNAL BURST','03:22 · EAST RAMP','03:29 · LOG REVISED','03:47 · SECOND CALL']
  const eventPositions=[[1520,1200],[2940,880],[3860,2100],[2540,2780],[4430,3600],[1520,3710],[3500,4250]]
  const events=(theme.timeline||timeline).map((text,i)=>note(`${text}\n\n${(theme.timelineNotes||['Called twice. Nothing.','Whose authorization?','Two shadows??','All clocks agree. WHY?','WRONG EXIT','original still missing','number disconnected'])[i]}`,eventPositions[i][0],eventPositions[i][1],i===3?'#ffd0c5':'#fff1a8',random(210,310),random(150,210)))
  events.forEach((event,i)=>{if(i)connect(events[i-1],event,'','#a52e36',7);connect(event,clusters[(i*3)%8].junction,'','#436a86',3)})
  connect(events[3],center,theme.linkLabel||'17 MINUTES','#a52e36',8)
  const scribbles=['same handwriting?','NOT the west gate','call back Monday','17 min.\nseventeen.','ask about the umbrella','this was here BEFORE','keep both copies','WHO BENEFITS?','look behind the van','no record of payment','do not trust the stamp','same scratch on both keys','check the reflection','the carbon copy!!','wrong day?']
  ;(theme.scribbles||scribbles).forEach((text,i)=>{
    const cluster=clusters[i%clusters.length],reference=i%2?cluster.image:cluster.b
    const scrap=note(text,reference.x+random(-130,220),reference.y+reference.height+random(-35,100),pick(['#fff1a8','#ffffff','#e1d2f5']),random(165,230),random(100,155))
    scrap.paperStyle=pick(['receipt','torn','index','sticky']);scrap.rotation=random(-19,19);scrap.fontSize=Math.round(random(18,26))
    connect(reference,scrap,'','#8c3d34',random(2,5))
    if(i%3===0)connect(scrap,clusters[(i+3)%8].junction,'','#ad7846',3)
  })
  const legend=note(`red = linked evidence\nblue = interpretation\nrest = theory\n\n${theme.source} / fictional case reconstruction`,5300,2460,'#ffffff',290,220)
  connect(legend,cipher,'','#ad7846',3)
  // Papers went up over several nights: some prints sit behind later notes.
  const layers=shuffle(nodes)
  layers.sort((a,b)=>(a.type==='photo'?0:1)-(b.type==='photo'?0:1))
  return {name:`${theme.title} — ${theme.source} (${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})})`,state:{nodes:layers,strings}}
}
