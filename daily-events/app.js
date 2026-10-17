const zone = 'America/Chicago';
const $ = id => document.getElementById(id);
function syncThemeToggle(){const dark=document.documentElement.dataset.theme!=='light';$('theme-toggle').textContent=dark?'Light mode':'Dark mode';$('theme-toggle').setAttribute('aria-label',`Switch to ${dark?'light':'dark'} mode`);}
syncThemeToggle();
$('theme-toggle').addEventListener('click',()=>{const theme=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=theme;try{localStorage.setItem('daily-events-theme',theme);}catch{}syncThemeToggle();});
const dayOf = value => {const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));const get=type=>parts.find(part=>part.type===type).value;return `${get('year')}-${get('month')}-${get('day')}`;};
const today = () => dayOf(Date.now());
const text = value => value == null ? '' : typeof value === 'string' ? value : Array.isArray(value) ? value.map(text).filter(Boolean).join(', ') : typeof value === 'object' ? text(value.name || value.title || value.label || value.address) : String(value);
const plain = value => { const doc=new DOMParser().parseFromString(String(value||''),'text/html');doc.querySelectorAll('script,style').forEach(node=>node.remove());return (doc.body.textContent||'').replace(/\s+/g,' ').trim(); };
const safeUrl = value => {try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:null;}catch{return null;}};
let events=[], metadata={}, qrSvg='', lastDay=today(), month=today().slice(0,7), loading=false, localPreview=false, loadError='';
const shiftDay=(day,count)=>{const date=new Date(`${day}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+count);return date.toISOString().slice(0,10);};
const label=day=>new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric',year:'numeric'});
const eventTime=value=>new Date(value).toLocaleTimeString('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit'});
const onDay=(event,day)=>dayOf(event.start)<=day&&dayOf(event.end?event.end-1:event.start)>=day;
$('date').value=today();
function node(tag,content,className){const element=document.createElement(tag);element.textContent=content;if(className)element.className=className;return element;}
function ingest(data){
  const items=Array.isArray(data)?data:data?.events;
  if(!Array.isArray(items))throw new Error('Expected an event export with an events array.');
  metadata=Array.isArray(data)?{}:data;
  events=items.filter(event=>event&&Number.isFinite(Date.parse(event.startsOn||event.startDate))).map(event=>{
    const start=Date.parse(event.startsOn||event.startDate), rawEnd=Date.parse(event.endsOn||event.endDate);
    const categories=Array.isArray(event.categories)?event.categories.map(text):text(event.categories||event.categoryNames).split(',').map(value=>value.trim()).filter(Boolean);
    return {name:text(event.name||event.title)||'Campus event',start,end:Number.isFinite(rawEnd)&&rawEnd>start?rawEnd:null,description:plain(event.description),location:text(event.location||event.address)||'See event page for location',organization:text(event.organizations||event.organizationNames||event.organizationName),categories,benefits:text(event.benefits||event.benefitNames),url:safeUrl(event.url)||((event.id!=null)?`https://txst.campuslabs.com/engage/event/${encodeURIComponent(event.id)}`:null)};
  }).sort((a,b)=>a.start-b.start||a.name.localeCompare(b.name));
  const previous=$('category').value;$('category').replaceChildren(node('option','All categories'));$('category').firstChild.value='';
  [...new Set(events.flatMap(event=>event.categories))].sort().forEach(category=>{const option=node('option',category);option.value=category;$('category').append(option);});
  if([...$('category').options].some(option=>option.value===previous))$('category').value=previous;
  render();
}
function render(){
  const day=$('date').value;if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return;
  const query=$('search').value.trim().toLowerCase(),category=$('category').value,now=Date.now();
  $('day-heading').textContent=new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const matching=events.filter(event=>(!category||event.categories.includes(category))&&(!$('food').checked||/free\s*food|freefood/i.test(event.benefits))&&`${event.name} ${event.location} ${event.organization} ${event.description}`.toLowerCase().includes(query));
  const selected=matching.filter(event=>onDay(event,day));
  renderCalendar(matching,day);
  $('agenda-label').textContent=label(day);
  $('agenda-empty').textContent=selected.length?'':loading?'Loading events…':'No events for this day. Select another date or choose Next event.';
  $('count').textContent=selected.length;$('events').replaceChildren();
  const stamp=Date.parse(metadata.scrapedAt||metadata.updatedAt);
  $('freshness').textContent=Number.isFinite(stamp)?`Updated ${new Date(stamp).toLocaleString('en-US',{timeZone:zone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} CT${now-stamp>86400000?' · Data is over a day old':''}${metadata.complete===false?' · Partial collection':''}`:'No published update yet';
  $('message').textContent=loadError||(!events.length&&!loading?'No events are available in the current export. Publish an updated events.json or import an export below.':`Showing ${events.length} loaded events across the calendar. Select a day to see its lineup.${localPreview?' Local file preview; automatic reload is paused.':''}`);
  const time=value=>new Date(value).toLocaleTimeString('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit'});
  selected.forEach(event=>{
    const card=node('article','','event');const heading=node('div','','event-top');
    heading.append(node('span',`${time(event.start)}${event.end?` – ${time(event.end)}`:''}`,'event-time'));
    if(dayOf(event.start)!==day||event.end&&dayOf(event.end-1)!==day)heading.append(node('span','Multi-day','badge'));
    if(event.end&&now>=event.start&&now<event.end)heading.append(node('span','Happening now','badge live'));
    else if(event.start>now&&event.start-now<=3600000)heading.append(node('span','Starting soon','badge'));
    card.append(heading,node('h3',event.name),node('p',event.location,'location'));
    if(event.organization)card.append(node('p',event.organization,'organizer'));
    card.append(node('p',event.description.length>230?`${event.description.slice(0,227)}…`:event.description||'Open the event page for the full details.','description'));
    const bottom=node('div','','event-bottom');const tags=node('span',event.categories.join(' · '),'tags');bottom.append(tags);
    const details=node('button','Full details');details.addEventListener('click',()=>showEvent(event));bottom.append(details);card.append(bottom);$('events').append(card);
  });
}
function renderCalendar(items,selectedDay){
  $('month-label').textContent=new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US',{timeZone:'UTC',month:'long',year:'numeric'});
  const first=`${month}-01`,start=shiftDay(first,-new Date(`${first}T12:00:00Z`).getUTCDay());
  $('calendar-grid').replaceChildren();
  for(let index=0;index<42;index++){
    const day=shiftDay(start,index),dayEvents=items.filter(event=>onDay(event,day));
    const cell=node('div','',`calendar-cell${day.slice(0,7)!==month?' outside':''}${day===selectedDay?' selected':''}${day===today()?' is-today':''}`);
    const select=node('button',day.slice(-2).replace(/^0/,''),'day-number');select.setAttribute('aria-label',`${label(day)}: ${dayEvents.length} events`);select.setAttribute('aria-pressed',String(day===selectedDay));select.addEventListener('click',()=>selectDay(day));cell.append(select);
    dayEvents.slice(0,3).forEach(event=>{const button=node('button',`${eventTime(event.start)} ${event.name}`,'calendar-event');button.title=`${event.name} · ${event.location}`;button.addEventListener('click',()=>{selectDay(day);showEvent(event);});cell.append(button);});
    if(dayEvents.length>3){const more=node('button',`+${dayEvents.length-3} more`,'more-events');more.addEventListener('click',()=>{selectDay(day);$('agenda-label').scrollIntoView({block:'nearest'});});cell.append(more);}
    if(dayEvents.length)cell.append(node('span',String(dayEvents.length),'mobile-count'));
    $('calendar-grid').append(cell);
  }
}
function selectDay(day){$('date').value=day;month=day.slice(0,7);render();}
function showEvent(event){
  const detail=$('event-detail');detail.replaceChildren(node('p',label(dayOf(event.start)),'eyebrow'),node('h2',event.name),node('p',`${eventTime(event.start)}${event.end?` – ${eventTime(event.end)}${dayOf(event.end-1)!==dayOf(event.start)?` (${label(dayOf(event.end-1))})`:''}`,'event-time'),node('p',event.location,'location'));
  if(event.organization)detail.append(node('p',event.organization,'organizer'));
  detail.append(node('p',event.description||'See the original event page for details.','full-description'));
  if(event.categories.length)detail.append(node('p',event.categories.join(' · '),'tags'));
  if(event.benefits)detail.append(node('p',`Benefits: ${event.benefits}`));
  if(event.url){const link=node('a','Open original event & RSVP ↗');link.href=event.url;link.target='_blank';link.rel='noopener noreferrer';detail.append(link);}
  if(!$('event-dialog').open)$('event-dialog').showModal();
}
async function load(){
  if(loading)return;loading=true;loadError='';$('reload').disabled=true;
  try{const response=await fetch(new URL('events.json',location.href),{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(`Event data could not be loaded (HTTP ${response.status}).`);const data=await response.json();localPreview=false;ingest(data);}
  catch(error){loadError=`${error.message} ${location.protocol==='file:'?'Start the static HTTP server instead of opening index.html directly.':'Check that events.json is in the same hosted folder as this page.'} ${events.length?'Previously loaded events are still shown.':'You can also import an export at the bottom of the page.'}`;}
  finally{loading=false;$('reload').disabled=false;render();}
}
function makeQr(){
  const url=safeUrl($('share-url').value.trim());
  if(!url){$('qr-status').textContent='Enter a complete public https:// or http:// URL.';return;}
  try{
    if(typeof qrcode!=='function')throw new Error('QR generator is unavailable. Check that vendor/qrcode.js was deployed.');
    const code=qrcode(0,'M');code.addData(url);code.make();qrSvg=code.createSvgTag({cellSize:5,margin:4,scalable:true});
    $('qr').innerHTML=qrSvg;$('qr').querySelector('svg').setAttribute('aria-label','QR code linking to the daily events webpage');
    $('poster-url').textContent=url;$('print').disabled=false;$('download').disabled=false;
    $('qr-status').textContent=/localhost|127\.0\.0\.1/.test(new URL(url).hostname)?'This is a local address. Use your public hosted URL before printing for residents.':'Ready to print. Make sure residents can open this public URL.';
  }catch(error){$('qr-status').textContent=error.message;}
}
['search','category','food'].forEach(id=>$(id).addEventListener('input',render));
$('date').addEventListener('input',()=>{if($('date').value)selectDay($('date').value);});
$('today').addEventListener('click',()=>selectDay(today()));
['previous-month','next-month'].forEach((id,index)=>$(id).addEventListener('click',()=>{const date=new Date(`${month}-01T12:00:00Z`);date.setUTCMonth(date.getUTCMonth()+(index===0?-1:1));selectDay(date.toISOString().slice(0,10));}));
$('next-event').addEventListener('click',()=>{const event=events.find(event=>dayOf(event.end?event.end-1:event.start)>=$('date').value);if(event){$('search').value='';$('category').value='';$('food').checked=false;selectDay(onDay(event,$('date').value)?$('date').value:dayOf(event.start));}else $('message').textContent='No later events in this export. Reload updated event data or choose an earlier date.';});
$('reload').addEventListener('click',load);$('close-event').addEventListener('click',()=>$('event-dialog').close());
$('make-qr').addEventListener('click',makeQr);$('print').addEventListener('click',()=>window.print());
$('download').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([qrSvg],{type:'image/svg+xml'}));const link=document.createElement('a');link.href=url;link.download='today-bobcats-qr.svg';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('import').addEventListener('change',async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>25*1024*1024)throw new Error('Choose an export smaller than 25 MB.');const data=JSON.parse(await file.text());localPreview=true;loadError='';ingest(data);}catch(error){$('message').textContent=error.message;}});
if(['http:','https:'].includes(location.protocol)){$('share-url').value=new URL('./',location.href).href;makeQr();}
setInterval(()=>{const next=today();if(next!==lastDay){if($('date').value===lastDay){$('date').value=next;month=next.slice(0,7);}lastDay=next;}if(localPreview)render();else load();},60000);
load();
