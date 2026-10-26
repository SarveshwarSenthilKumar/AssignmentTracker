import './download.css'

let downloading=false
const filename=value=>String(value||'download').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').replace(/[. ]+$/g,'').slice(0,200)||'download'
const supportsPicker=()=>window.isSecureContext&&typeof window.showSaveFilePicker==='function'

// Invoke the picker before awaiting anything: a completed conversion/fetch may
// have consumed the original click's transient activation.
async function chooseAndWrite(blob,name){
  let handle
  try{handle=await window.showSaveFilePicker({id:'platform-downloads',suggestedName:filename(name),startIn:'downloads'})}
  catch(error){if(error.name==='AbortError')return false;throw error}
  const writable=await handle.createWritable()
  try{await writable.write(blob);await writable.close()}
  catch(error){try{await writable.abort()}catch{}throw error}
  return true
}

function browserDownload(blob,name){
  const url=URL.createObjectURL(blob),link=document.createElement('a')
  link.href=url;link.download=filename(name);link.hidden=true
  ;(document.fullscreenElement||document.body).appendChild(link)
  try{link.click()}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
}

function readyDialog(blob,name,initialError=''){
  return new Promise(resolve=>{
    const previous=document.activeElement,dialog=document.createElement('dialog'),form=document.createElement('form')
    dialog.className='platform-save-dialog';dialog.setAttribute('aria-labelledby','platform-save-title')
    const heading=document.createElement('h2');heading.id='platform-save-title';heading.textContent='Save your download'
    const description=document.createElement('p');description.textContent=supportsPicker()?'Your file is ready. Choose a folder and filename to save it.':'This browser cannot open a save-location chooser from the site. Enable “Ask where to save each file before downloading” in your browser’s Downloads settings, then use Browser download below.'
    const label=document.createElement('label');label.textContent='Filename'
    const input=document.createElement('input');input.value=filename(name);input.maxLength=200;input.required=true;label.appendChild(input)
    const size=document.createElement('small');size.textContent=blob.size>=1048576?`${(blob.size/1048576).toFixed(1)} MB`:`${Math.max(1,Math.ceil(blob.size/1024))} KB`
    const error=document.createElement('p');error.className='platform-save-error';error.setAttribute('role','alert');error.textContent=initialError
    const actions=document.createElement('div');actions.className='platform-save-actions'
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel'
    const fallback=document.createElement('button');fallback.type='button';fallback.textContent='Browser download'
    const choose=document.createElement('button');choose.type='submit';choose.className='platform-save-primary';choose.textContent=supportsPicker()?'Choose location…':'Download'
    if(!supportsPicker())fallback.hidden=true
    let busy=false,finished=false
    const finish=saved=>{if(finished)return;finished=true;dialog.close();dialog.remove();if(previous?.isConnected)previous.focus({preventScroll:true});resolve(saved)}
    const setBusy=value=>{busy=value;choose.disabled=value;fallback.disabled=value;cancel.disabled=value;input.disabled=value;dialog.setAttribute('aria-busy',String(value))}
    const saveInBrowser=()=>{if(busy)return;try{browserDownload(blob,input.value);finish(true)}catch(err){error.textContent=err.message||'The browser could not start the download.'}}
    cancel.onclick=()=>finish(false);fallback.onclick=saveInBrowser
    dialog.addEventListener('cancel',event=>{event.preventDefault();if(!busy)finish(false)})
    dialog.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();if(!busy)finish(false)}})
    form.onsubmit=async event=>{
      event.preventDefault();if(busy)return
      if(!supportsPicker()){saveInBrowser();return}
      setBusy(true);error.textContent=''
      try{const saved=await chooseAndWrite(blob,input.value);if(saved)finish(true)}
      catch(err){error.textContent=`Could not save the file: ${err.message||'Access was denied.'} Choose another location or use Browser download.`}
      finally{if(!finished){setBusy(false);choose.focus()}}
    }
    actions.append(cancel,fallback,choose);form.append(heading,description,label,size,error,actions);dialog.appendChild(form)
    ;(document.fullscreenElement||document.body).appendChild(dialog)
    try{dialog.showModal();choose.focus()}catch{dialog.remove();resolve(false)}
  })
}

// Every export uses this entry point. Cancellation never triggers an alternate
// download, and failed writes retain the prepared file for a manual retry.
export async function saveDownload(blob,name){
  if(downloading)return false
  downloading=true
  try{
    if(!(blob instanceof Blob))throw new Error('The download did not contain a valid file.')
    if(supportsPicker()&&navigator.userActivation?.isActive){
      try{return await chooseAndWrite(blob,name)}
      catch(error){return await readyDialog(blob,name,`Could not save the file: ${error.message||'Access was denied.'}`)}
    }
    return await readyDialog(blob,name)
  }finally{downloading=false}
}
