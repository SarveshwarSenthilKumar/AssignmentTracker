self.onmessage=event=>{
  const {id,annotations}=event.data
  try{
    const bytes=new TextEncoder().encode(JSON.stringify({annotations}))
    self.postMessage({id,buffer:bytes.buffer},[bytes.buffer])
  }catch(error){self.postMessage({id,error:error.message||'Could not prepare annotations for saving.'})}
}
