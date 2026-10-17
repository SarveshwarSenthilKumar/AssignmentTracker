const zone = 'America/Chicago';
const $ = id => document.getElementById(id);
const dayOf = value => new Intl.DateTimeFormat('en-CA', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const today = () => dayOf(Date.now());
const text = value => value == null ? '' : typeof value === 'string' ? value : Array.isArray(value) ? value.map(text).filter(Boolean).join(', ') : typeof value === 'object' ? text(value.name || value.title || value.label || value.address) : String(value);
const plain = value => { const doc=new DOMParser().parseFromString(String(value||''),'text/html');doc.querySelectorAll('script,style').forEach(node=>node.remove());return (doc.body.textContent||'').replace(/\s+/g,' ').trim(); };
const safeUrl = value => {try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:null;}catch{return null;}};
let events=[], metadata={}, qrSvg='', lastDay=today();
$('date').value=today();
function node(tag,content,className){const element=document.createElement(tag);element.textContent=content;if(className)element.className=className;return element;}
function ingest(data){
  const items=Array.isArray(data)?data:data?.events;
  if(!Array.isArray(items))throw new Error('Choose a JSON event export with an events array.');
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
  const selected=events.filter(event=>dayOf(event.start)<=day&&dayOf(event.end?event.end-1:event.start)>=day&&(!category||event.categories.includes(category))&&(!$('food').checked||/free\s*food|freefood/i.test(event.benefits))&&`${event.name} ${event.location} ${event.organization} ${event.description}`.toLowerCase().includes(query));
  $('count').textContent=selected.length;$('events').replaceChildren();
  const stamp=Date.parse(metadata.scrapedAt||metadata.updatedAt);
  $('freshness').textContent=Number.isFinite(stamp)?`Updated ${new Date(stamp).toLocaleString('en-US',{timeZone:zone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} CT${now-stamp>86400000?' · Data is over a day old':''}${metadata.complete===false?' · Partial collection':''}`:'No published update yet';
  $('message').textContent=selected.length?'':events.length?'No events match this day and these filters. Try another date or clear the filters.':'No event data has been published yet. The page owner can publish a TXST event export as events.json.';
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
    if(event.url){const link=node('a','Details & RSVP ↗');link.href=event.url;link.target='_blank';link.rel='noopener noreferrer';bottom.append(link);}card.append(bottom);$('events').append(card);
  });
}
async function load(){try{const response=await fetch('events.json',{cache:'no-store'});if(!response.ok)throw new Error('Event data could not be loaded.');ingest(await response.json());}catch(error){$('freshness').textContent='Event data unavailable';$('message').textContent=`${error.message} Serve this folder over HTTP, or choose an event export below.`;}}
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
['search','date','category','food'].forEach(id=>$(id).addEventListener('input',render));
$('today').addEventListener('click',()=>{$('date').value=today();render();});
$('make-qr').addEventListener('click',makeQr);$('print').addEventListener('click',()=>window.print());
$('download').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([qrSvg],{type:'image/svg+xml'}));const link=document.createElement('a');link.href=url;link.download='today-bobcats-qr.svg';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('import').addEventListener('change',async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>25*1024*1024)throw new Error('Choose an export smaller than 25 MB.');ingest(JSON.parse(await file.text()));$('freshness').append(' · Local preview only');}catch(error){$('message').textContent=error.message;}});
if(['http:','https:'].includes(location.protocol)){$('share-url').value=new URL('./',location.href).href;makeQr();}
setInterval(()=>{const next=today();if(next!==lastDay){if($('date').value===lastDay)$('date').value=next;lastDay=next;}render();},60000);
load();
