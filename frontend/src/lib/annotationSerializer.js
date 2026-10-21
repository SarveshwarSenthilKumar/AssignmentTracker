let worker=null,sequence=0
const pending=new Map()
function createWorker(){
  if(worker)return worker
  worker=new Worker(new URL('../workers/annotationSerializer.js',import.meta.url),{type:'module'})
  worker.onmessage=event=>{const request=pending.get(event.data.id);if(!request)return;pending.delete(event.data.id);if(event.data.error)request.reject(new Error(event.data.error));else request.resolve(new Uint8Array(event.data.buffer))}
  worker.onerror=()=>{
    // Restricted browsers may block workers. Keep saving functional there.
    for(const request of pending.values()){try{request.resolve(JSON.stringify({annotations:request.annotations}))}catch(error){request.reject(error)}}
    pending.clear();worker?.terminate();worker=null
  }
  return worker
}
export function serializeAnnotations(annotations){
  if(typeof Worker==='undefined')return Promise.resolve(JSON.stringify({annotations}))
  return new Promise((resolve,reject)=>{
    const id=++sequence
    try{const active=createWorker();pending.set(id,{resolve,reject,annotations});active.postMessage({id,annotations})}catch{pending.delete(id);try{resolve(JSON.stringify({annotations}))}catch(error){reject(error)}}
  })
}
