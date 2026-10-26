import {readApiJson} from './apiResponse'
export async function studyRequest(token,path='',options={}){
  const response=await fetch(`/api/study${path}`,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},cache:'no-store'})
  const data=await readApiJson(response);if(!response.ok)throw new Error(data.message||'Could not update your study list.')
  if(options.method)window.dispatchEvent(new Event('study-changed'))
  return data
}
