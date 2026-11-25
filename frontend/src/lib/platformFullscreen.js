export function canTogglePlatformFullscreen(){
  return Boolean(document.fullscreenElement
    ? document.exitFullscreen
    : document.fullscreenEnabled!==false && document.documentElement.requestFullscreen)
}

export function togglePlatformFullscreen(){
  if(!canTogglePlatformFullscreen())return
  const operation=document.fullscreenElement
    ? document.exitFullscreen()
    : document.documentElement.requestFullscreen()
  operation.catch(()=>{})
}
