const pages={
  workspace:['#335775','M12 3 3 8l9 5 9-5-9-5ZM3 12l9 5 9-5M3 16l9 5 9-5'],
  tasks:['#356248','M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6M9 11l4 4 8-10'],
  calendar:['#5b497e','M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM8 3v4m8-4v4M4 10h16m-12 4h1m5 0h1m-7 3h1'],
  documents:['#3d637d','M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1ZM3 10h18'],
  whiteboards:['#23646a','M4 4h16v12H4zM8 20l4-4 4 4M8 12l3-3 3 2 2-3'],
  'detective-wall':['#784b34','M12 14v7m-5-7h10l-2-3V6l2-3H7l2 3v5z'],
  visualization:['#286177','M6 6h.01m12 1h.01m-7 11h.01M8 7l8 1m-9 1 3 7m7-6-5 6M6 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm12 1a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-7 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z'],
  study:['#446245','M4 5h6a2 2 0 0 1 2 2v13a4 4 0 0 0-3-2H4zM20 5h-6a2 2 0 0 0-2 2v13a4 4 0 0 1 3-2h5zM7 9h2m6 0h2'],
  canvas:['#a34440','M12 3 3 8l9 5 9-5-9-5Zm-6 7v6c3 3 9 3 12 0v-6m3-2v7'],
  account:['#525f75','M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m8-18a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z'],
  shortcuts:['#50576d','M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm3 4h1m3 0h1m3 0h1m-9 4h1m3 0h6'],
  assistant:['#5d4684','M11 3l2.4 6.6L20 12l-6.6 2.4L11 21l-2.4-6.6L2 12l6.6-2.4L11 3Zm8 0v6m-3-3h6'],
  prep:['#735b32','M7 4h10v13H7zM10 3h4v3h-4zM10 10h4m-4 3h4M7 20h10'],
  analytics:['#315b71','M4 19h16M7 16v-5m5 5V7m5 9V4'],
  terms:['#655075','M12 3v18m-5 0h10M4 7h16M6 7l-3 7h6L6 7Zm12 0-3 7h6l-3-7Z'],
  privacy:['#3d6657','M12 3 4 6v5c0 5 3 8 8 10 5-2 8-5 8-10V6l-8-3Zm-3 9 2 2 4-4'],
  roadmap:['#426456','M5 4v16m14 0V4M5 7h8l-2 4 2 4H5m8-8h6m-6 8h6'],
  'report-bug':['#804742','M8 8h8v8a4 4 0 0 1-8 0V8Zm1 0-2-3m8 3 2-3M4 10h4m8 0h4M3 15h5m8 0h5M5 20l3-2m8 0 3 2m-7-7v6'],
  'suggest-feature':['#795b28','M8 16a6 6 0 1 1 8 0l-1 2H9l-1-2Zm2 5h4m-2-18v-1m8 4 2-1M4 6 2 5'],
  resumes:['#37616e','M6 3h9l3 3v15H6zM14 3v4h4m-9 5h6m-6 4h6'],
  jobs:['#6f5838','M8 7V4h8v3M3 7h18v13H3zM3 12l9 2 9-2m-9 0v4'],
  'cover-letters':['#754c62','M3 5h18v14H3zM4 6l8 7 8-7'],
  tutorial:['#4c6682','M4 5h16v13H4zM9 21h6m-3-3v3m-2-13 5 3-5 3z'],
  admin:['#694960','M12 3 4 6v5c0 5 3 8 8 10 5-2 8-5 8-10V6l-8-3Zm0 5v6m-3-3h6'],
  'admin/stats':['#694960','M12 3 4 6v5c0 5 3 8 8 10 5-2 8-5 8-10V6l-8-3ZM9 14v-3m3 3V8m3 6v-4'],
  logbook:['#685744','M7 3h12v18H7ZM4 7h5m-5 5h5m-5 5h5m3-10h4m-4 5h4'],
  handbook:['#5b537b','M5 4h14v16H7a2 2 0 0 1-2-2V4Zm0 13h14M9 8h6m-6 4h6'],
  'shared-document':['#386b74','M5 3h9l4 4v4m-4-8v4h4M5 3v18h6m3-3 4-4m-1-3h4v4m-8 0h-1v5h5v-1'],
  'shared-task-folder':['#427152','M3 6h6l2 2h10v12H3zM8 14l3 3 5-5'],
}

export function updatePageFavicon(hash){
  const link=document.getElementById('page-favicon')
  if(!link)return
  const route=hash.replace(/^#\/?/,'').split('?')[0]
  const segments=route.split('/')
  const section=segments[0],subsection=segments.slice(0,2).join('/')
  const icon=Object.hasOwn(pages,subsection)?pages[subsection]:Object.hasOwn(pages,section)?pages[section]:null
  const href=icon?faviconUrl(...icon):import.meta.env.BASE_URL+'favicon.svg'
  if(link.getAttribute('href')!==href)link.setAttribute('href',href)
}

function faviconUrl(color,path){
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'+
    '<rect width="32" height="32" rx="7" fill="'+color+'"/>'+
    '<path transform="translate(4 4)" d="'+path+'" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>'+
    '</svg>'
  return 'data:image/svg+xml,'+encodeURIComponent(svg)
}
