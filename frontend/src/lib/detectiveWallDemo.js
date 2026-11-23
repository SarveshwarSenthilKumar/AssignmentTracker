// Hidden, entirely fictional case-board prop. No external images or AI requests.
export const isCaseBoardShortcut=event=>!event.repeat&&!event.isComposing&&(event.ctrlKey||event.metaKey)&&event.altKey&&event.shiftKey&&event.code==='KeyD'

function evidenceImage(kind,index,title){
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
  }else{
    c.fillStyle='#403b34';c.font='bold 23px monospace';c.fillText('MERIDIAN ARCHIVE / RECONSTRUCTION',28,85)
    c.font='15px monospace'
    const lines=['ENTRY 047 — ACCESS LOG','03:04  NIGHT TRANSFER AUTHORIZED','03:11  SERVICE GATE: MANUAL OVERRIDE','03:17  RELAY TRANSMISSION DETECTED','03:22  VEHICLE DEPARTS VIA EAST RAMP','03:29  RECORD CORRECTION REQUESTED','SIGNATURE: ____________________']
    lines.forEach((line,i)=>c.fillText(line,30,130+i*31))
    c.fillStyle='#38352f';c.fillRect(292,144,235,18);c.fillRect(195,238,250,18)
    c.strokeStyle='#a04439';c.lineWidth=4;c.beginPath();c.ellipse(240,222,220,22,-.025,0,Math.PI*2);c.stroke()
  }
  c.fillStyle=dark?'#0f1719dd':'#d3c7acdd';c.fillRect(0,0,640,37);c.fillRect(0,386,640,34)
  c.fillStyle=dark?'#d5d8bf':'#4c4034';c.font='bold 16px monospace';c.fillText(title.toUpperCase(),18,25);c.font='12px monospace';c.fillText(`EXHIBIT ${String(index+1).padStart(2,'0')}   •   FICTIONAL CASE PROP / MERIDIAN 47`,18,407)
  return canvas.toDataURL('image/jpeg',.86)
}

export function generateCaseBoard(){
  const nodes=[],strings=[],id=()=>crypto.randomUUID(),edges=new Set()
  const note=(text,x,y,color='#fff1a8',width=285,height=230)=>{
    const node={id:id(),type:'note',x,y,width,height,rotation:((nodes.length*7)%11)-5,color,text};nodes.push(node);return node
  }
  const pin=(text,x,y,color='#b52b35')=>{const node={id:id(),type:'pin',x,y,width:74,height:74,rotation:0,color,text};nodes.push(node);return node}
  const photo=(kind,title,text,x,y,index)=>{
    const node={id:id(),type:'photo',x,y,width:340,height:305,imageHeight:220,rotation:index%2?-4:3,color:'#f6f1e5',text,image:evidenceImage(kind,index,title)};nodes.push(node);return node
  }
  const connect=(from,to,text='',color='#ac2936',width=4)=>{
    if(from.id===to.id)return
    const key=[from.id,to.id].sort().join(':');if(edges.has(key))return
    edges.add(key);strings.push({id:id(),from:from.id,to:to.id,color,width,text})
  }
  const center=note('THE MERIDIAN SIGNAL\nCASE 47\n\nEight locations. One missing interval.\nWho moved the clock?\n\nFollow the red thread.',2350,1640,'#ffd0c5',430,310)
  const cipher=note('WORKING THEORY\n\n47 is a frequency, not a date.\nThe route follows the river.\nThe archive copy was altered AFTER the signal.',2820,1680,'#fff1a8',360,285)
  const question=note('DO NOT CLOSE THE CASE\n\nA duplicate stamp is not a duplicate delivery.\nWhat happened during the missing 17 minutes?',2370,2070,'#cce3ff',350,260)
  connect(center,cipher,'THE MISSING INTERVAL','#af2837',8);connect(center,question,'REOPEN','#af2837',7)
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
  const clusters=cases.map((entry,index)=>{
    const heading=note(`${entry.name}\n\n${entry.code}\nEvidence chain ${index+1} / 8`,entry.x,entry.y,entry.color,330,190)
    const image=photo(entry.kind,entry.name,`Exhibit ${index+1} — compare the time, not the location.`,entry.x+380,entry.y+10,index)
    const detail=photo(index%2?'report':'map',`CROSS-CHECK ${index+1}`,`Reference copy / ${entry.code}`,entry.x+750,entry.y+390,index+8)
    const a=note(entry.notes[0],entry.x+20,entry.y+280,entry.color)
    const b=note(entry.notes[1],entry.x+365,entry.y+365,index%2?'#e1d2f5':'#fff1a8')
    const c=note(entry.notes[2],entry.x+45,entry.y+580,'#cce3ff')
    const junction=pin(entry.code,entry.x+710,entry.y+245,index%2?'#3d668d':'#a52e36')
    connect(heading,image,'EXHIBIT','#ac2936',5);connect(image,a,'','#ad7846',4);connect(a,b,'CHECK TIME','#ac2936',5)
    connect(b,c,'','#436a86',4);connect(c,detail,'','#b03d43',4);connect(heading,junction,'','#ac2936',6)
    connect(junction,image,'','#ac2936',4);connect(junction,detail,'','#ad7846',4);connect(a,c,'','#ad7846',3)
    connect(center,heading,index%2?'':'SAME NIGHT','#a52b37',6);connect(cipher,junction,'','#436a86',4)
    return {heading,image,detail,a,b,c,junction}
  })
  clusters.forEach((cluster,i)=>{
    const next=clusters[(i+1)%8],opposite=clusters[(i+4)%8],diagonal=clusters[(i+3)%8]
    connect(cluster.junction,next.junction,'','#ac2936',5)
    connect(cluster.image,opposite.b,i%3===0?'TIMESTAMP MATCH':'','#a52e36',5)
    connect(cluster.a,diagonal.detail,'','#456b86',4)
    connect(cluster.c,next.image,'','#ad7846',3)
    connect(cluster.b,opposite.junction,'','#a52e36',4)
    connect(cluster.detail,question,'','#ad7846',3)
    connect(cluster.heading,diagonal.c,'','#ac2936',4)
  })
  const timeline=['02:47 · FIRST CALL','03:04 · ACCESS APPROVED','03:11 · VAN ARRIVES','03:17 · SIGNAL BURST','03:22 · EAST RAMP','03:29 · LOG REVISED','03:47 · SECOND CALL']
  const events=timeline.map((text,i)=>note(`${text}\n\n${['No reply recorded.','Whose authorization?','One vehicle, two shadows.','Every clock agrees.','The wrong exit.','Original copy missing.','Line disconnected.'][i]}`,700+i*650,4030,i===3?'#ffd0c5':'#fff1a8',285,180))
  events.forEach((event,i)=>{if(i)connect(events[i-1],event,'','#a52e36',7);connect(event,clusters[(i*3)%8].junction,'','#436a86',3)})
  connect(events[3],center,'17 MINUTES','#a52e36',8)
  note('STRING KEY\n\nRED: confirmed links\nBLUE: signals & timing\nOCHRE: working theories\n\nEverything here is fictional.\nMove the pieces. Follow a thread.',5250,1850,'#ffffff',350,290)
  return {name:`Case 47 — The Meridian Signal (${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})})`,state:{nodes,strings}}
}
