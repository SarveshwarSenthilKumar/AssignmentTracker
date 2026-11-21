export function sharedDocumentRequest(url, options = {}) {
  if (!String(url).startsWith('/api/shared-document/')) return fetch(url,options)
  const headers = new Headers(options.headers)
  if (!headers.get('Authorization') || headers.get('Authorization')==='Bearer undefined') {
    headers.delete('Authorization')
    try { const token=localStorage.getItem('token'); if(token)headers.set('Authorization',`Bearer ${token}`) } catch { /* The signed guest cookie still identifies this browser. */ }
  }
  return fetch(url,{...options,headers,credentials:'same-origin'})
}
