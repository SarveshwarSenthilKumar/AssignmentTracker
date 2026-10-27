export function embedTarget(input){
  const url=new URL(input),host=url.hostname.replace(/^www\./,'')
  if(['youtube.com','m.youtube.com','youtu.be'].includes(host)){
    const candidate=host==='youtu.be'?url.pathname.slice(1).split('/')[0]:url.pathname==='/watch'?url.searchParams.get('v'):/^\/(shorts|embed)\//.test(url.pathname)?url.pathname.split('/')[2]:null
    if(candidate&&/^[a-zA-Z0-9_-]{11}$/.test(candidate)){
      const player=new URL(`https://www.youtube-nocookie.com/embed/${candidate}`)
      const start=url.searchParams.get('start')||url.searchParams.get('t');if(start&&/^\d+$/.test(start))player.searchParams.set('start',start)
      return {url:player.href,adapter:'YouTube embed player'}
    }
  }
  if(host==='vimeo.com'&&/^\/\d+\/?$/.test(url.pathname))return {url:`https://player.vimeo.com/video/${url.pathname.split('/')[1]}`,adapter:'Vimeo embed player'}
  return {url:url.href,adapter:null}
}

export function embeddedSiteNotice(input){
  try{
    const host=new URL(input).hostname.toLowerCase().replace(/^www\./,'')
    if(host==='chess.com')return {title:'Chess.com needs a browser window',message:'Chess.com refused the embedded connection in this browser. Changing the phone size or zoom cannot remove a website framing restriction. Your notes can stay open here while you use Chess.com in a separate window.'}
  }catch{}
  return null
}
