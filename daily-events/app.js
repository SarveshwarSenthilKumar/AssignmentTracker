const zone = 'America/Chicago';
const $ = id => document.getElementById(id);
const dayFormatter=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});
const dayOf = value => {const parts=dayFormatter.formatToParts(new Date(value));const get=type=>parts.find(part=>part.type===type).value;return `${get('year')}-${get('month')}-${get('day')}`;};
const today = () => dayOf(Date.now());
const text = value => value == null ? '' : typeof value === 'string' ? value : Array.isArray(value) ? value.map(text).filter(Boolean).join(', ') : typeof value === 'object' ? text(value.name || value.title || value.label || value.address) : String(value);
const plain = value => { const doc=new DOMParser().parseFromString(String(value||''),'text/html');doc.querySelectorAll('script,style').forEach(node=>node.remove());return (doc.body.textContent||'').replace(/\s+/g,' ').trim(); };
const safeUrl = value => {try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:null;}catch{return null;}};
let events=[], metadata={}, qrSvg='', lastDay=today(), month=today().slice(0,7), loading=false, localPreview=false, loadError='';
let refreshing=false, refreshProgress='', refreshTimer=null, pendingRefresh=false;
const shiftDay=(day,count)=>{const date=new Date(`${day}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+count);return date.toISOString().slice(0,10);};
const label=day=>new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric',year:'numeric'});
const eventTime=value=>new Date(value).toLocaleTimeString('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit'});
const onDay=(event,day)=>event.startDay<=day&&event.endDay>=day;
const hasFood=event=>/free\s*food|freefood/i.test(event.benefits);
$('date').value=today();
function node(tag,content,className){const element=document.createElement(tag);element.textContent=content;if(className)element.className=className;return element;}
function ingest(data){
  const items=Array.isArray(data)?data:data?.events;
  if(!Array.isArray(items))throw new Error('Expected an event export with an events array.');
  metadata=Array.isArray(data)?{}:data;
  events=items.filter(event=>event&&Number.isFinite(Date.parse(event.startsOn||event.startDate))).map(event=>{
    const start=Date.parse(event.startsOn||event.startDate), rawEnd=Date.parse(event.endsOn||event.endDate);
    const categories=Array.isArray(event.categories)?event.categories.map(text):text(event.categories||event.categoryNames).split(',').map(value=>value.trim()).filter(Boolean);
    const end=Number.isFinite(rawEnd)&&rawEnd>start?rawEnd:null;
    return {name:text(event.name||event.title)||'Campus event',start,end,startDay:dayOf(start),endDay:dayOf(end?end-1:start),description:plain(event.description),location:text(event.location||event.address)||'See event page for location',organization:text(event.organizations||event.organizationNames||event.organizationName),categories,benefits:text(event.benefits||event.benefitNames),url:safeUrl(event.url)||((event.id!=null)?`https://txst.campuslabs.com/engage/event/${encodeURIComponent(event.id)}`:null)};
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
  const filtered=Boolean(query||category||$('food').checked);
  $('clear-filters').hidden=!filtered;
  const matching=events.filter(event=>(!category||event.categories.includes(category))&&(!$('food').checked||hasFood(event))&&`${event.name} ${event.location} ${event.organization} ${event.description}`.toLowerCase().includes(query));
  const selected=matching.filter(event=>onDay(event,day));
  const dayEvents=events.filter(event=>onDay(event,day));
  $('summary-total').textContent=dayEvents.length;
  $('summary-live').textContent=dayEvents.filter(event=>event.end&&now>=event.start&&now<event.end).length;
  $('summary-food').textContent=dayEvents.filter(hasFood).length;
  renderCalendar(matching,day);
  $('agenda-label').textContent=label(day);
  $('agenda-empty').textContent=selected.length?`${selected.length} ${selected.length===1?'event':'events'}${filtered?' matching your filters':''} · All times Central`:loading?'Loading events…':filtered?'No events match these filters. Clear filters to see the full day.':'A little room for spontaneity. No events listed for this day; choose Next event to find another plan.';
  $('count').textContent=selected.length;$('events').replaceChildren();
  const stamp=Date.parse(metadata.scrapedAt||metadata.updatedAt);
  $('freshness').textContent=Number.isFinite(stamp)?`Updated ${new Date(stamp).toLocaleString('en-US',{timeZone:zone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} CT${now-stamp>86400000?' · Data is over a day old':''}${metadata.complete===false?' · Partial collection':''}`:'No published update yet';
  $('message').textContent=loadError||(refreshing?`Refreshing from TXST: ${refreshProgress || 'Collecting public events…'} You can keep browsing while this finishes.`:refreshProgress&&!localPreview?refreshProgress:!events.length&&!loading?'No events are available in the current export. Choose Reload events to collect a fresh lineup.':`Showing ${events.length} loaded events across the calendar. Select a day to see its lineup.${localPreview?' Local file preview; automatic reload is paused.':''}`);
  const time=value=>new Date(value).toLocaleTimeString('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit'});
  selected.forEach(event=>{
    const card=node('article','','event');const heading=node('div','','event-top');
    heading.append(node('span',`${time(event.start)}${event.end?` – ${time(event.end)}`:''}`,'event-time'));
    if(dayOf(event.start)!==day||event.end&&dayOf(event.end-1)!==day)heading.append(node('span','Multi-day','badge'));
    if(hasFood(event))heading.append(node('span','Free food','badge food-badge'));
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
function clearFilters(){$('search').value='';$('category').value='';$('food').checked=false;render();}
function showEvent(event){
  const detail=$('event-detail');
  let timeRange=eventTime(event.start);
  if(event.end){
    timeRange+=` – ${eventTime(event.end)}`;
    if(event.endDay!==event.startDay)timeRange+=` (${label(event.endDay)})`;
  }
  detail.replaceChildren(node('p',label(event.startDay),'eyebrow'),node('h2',event.name),node('p',timeRange,'event-time'),node('p',event.location,'location'));
  if(event.organization)detail.append(node('p',event.organization,'organizer'));
  detail.append(node('p',event.description||'See the original event page for details.','full-description'));
  if(event.categories.length)detail.append(node('p',event.categories.join(' · '),'tags'));
  if(event.benefits)detail.append(node('p',`Benefits: ${event.benefits}`));
  if(event.url){const link=node('a','Open original event & RSVP ↗');link.href=event.url;link.target='_blank';link.rel='noopener noreferrer';detail.append(link);}
  if(!$('event-dialog').open)$('event-dialog').showModal();
}
async function load({refresh=false}={}){
  if(loading){
    if(refresh){pendingRefresh=true;$('reload').textContent='Refresh queued…';$('message').textContent='Finishing the current request, then collecting fresh events from TXST…';}
    return;
  }
  loading=true;loadError='';$('reload').disabled=true;
  $('reload').textContent=refresh?'Connecting to TXST…':refreshing?'Refreshing TXST…':'Loading events…';
  $('reload').setAttribute('aria-busy','true');
  if(refresh)$('message').textContent='Requesting a fresh TXST collection…';
  clearTimeout(refreshTimer);
  let staticOnly=false;
  try{
    const response=await fetch(new URL(refresh?'api/events/refresh':'api/events',location.href),{method:refresh?'POST':'GET',cache:'no-store',signal:AbortSignal.timeout(20000)});
    // Static hosting still supports reading a published export, but cannot scrape TXST.
    const jsonType=(response.headers.get('content-type')||'').includes('application/json');
    if([404,405,501].includes(response.status)||(response.ok&&!jsonType))staticOnly=true;
    else {
      if(!response.ok)throw new Error(`Event server returned HTTP ${response.status}.`);
      const state=await response.json();
      if(!state.data||!Array.isArray(state.data.events))throw new Error('Event server returned an invalid response.');
      refreshing=Boolean(state.refreshing);refreshProgress=state.progress||'';loadError=state.error||'';
      const stamp=state.data.scrapedAt||state.data.updatedAt;
      const unchanged=!localPreview&&stamp&&stamp===(metadata.scrapedAt||metadata.updatedAt);
      localPreview=false;
      if(!unchanged)ingest(state.data);
    }
    if(staticOnly){
      refreshing=false;
      const published=await fetch(new URL('events.json',location.href),{cache:'no-store',signal:AbortSignal.timeout(20000)});
      if(!published.ok)throw new Error(`Event export returned HTTP ${published.status}.`);
      const data=await published.json();localPreview=false;ingest(data);
      if(refresh)loadError='Published export reloaded. To pull new events directly from TXST, run node daily-events/server.js from the repository folder and open http://localhost:8080. A static host cannot run the collector.';
    }
  }
  catch(error){refreshing=false;loadError=`${error.message} ${location.protocol==='file:'?'Run node daily-events/server.js and open http://localhost:8080.':'Make sure the event server is still running, then choose Reload events to reconnect.'} ${events.length?'Previously loaded events are still shown.':'You can also import an export at the bottom of the page.'}`;}
  finally{
    loading=false;$('reload').disabled=refreshing;$('reload').textContent=refreshing?'Refreshing TXST…':'Reload events';$('reload').setAttribute('aria-busy',String(refreshing));render();
    if(pendingRefresh){pendingRefresh=false;refreshTimer=setTimeout(()=>load({refresh:true}),0);}
    else if(refreshing)refreshTimer=setTimeout(()=>load(),2000);
  }
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
$('clear-filters').addEventListener('click',clearFilters);
['previous-month','next-month'].forEach((id,index)=>$(id).addEventListener('click',()=>{const date=new Date(`${month}-01T12:00:00Z`);date.setUTCMonth(date.getUTCMonth()+(index===0?-1:1));selectDay(date.toISOString().slice(0,10));}));
$('next-event').addEventListener('click',()=>{const event=events.find(event=>dayOf(event.end?event.end-1:event.start)>=$('date').value);if(event){$('search').value='';$('category').value='';$('food').checked=false;selectDay(onDay(event,$('date').value)?$('date').value:dayOf(event.start));}else $('message').textContent='No later events in this export. Reload updated event data or choose an earlier date.';});
$('reload').addEventListener('click',()=>load({refresh:true}));$('close-event').addEventListener('click',()=>$('event-dialog').close());
$('make-qr').addEventListener('click',makeQr);$('print').addEventListener('click',()=>window.print());
$('download').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([qrSvg],{type:'image/svg+xml'}));const link=document.createElement('a');link.href=url;link.download='today-bobcats-qr.svg';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('import').addEventListener('change',async event=>{try{const file=event.target.files[0];if(!file)return;if(loading)throw new Error('Wait for the current event request to finish before importing.');if(file.size>25*1024*1024)throw new Error('Choose an export smaller than 25 MB.');const data=JSON.parse(await file.text());ingest(data);localPreview=true;refreshing=false;clearTimeout(refreshTimer);$('reload').disabled=false;$('reload').textContent='Reload events';loadError='';render();}catch(error){$('message').textContent=error.message;}});
if(['http:','https:'].includes(location.protocol)){$('share-url').value=new URL('./',location.href).href;makeQr();}
setInterval(()=>{const next=today();if(next!==lastDay){if($('date').value===lastDay){$('date').value=next;month=next.slice(0,7);}lastDay=next;}if(localPreview||refreshing)render();else load();},60000);
load();
