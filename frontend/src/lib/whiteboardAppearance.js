export const DEFAULT_WHITEBOARD_APPEARANCE={color:'#ffffff',pattern:'blank'}
export const WHITEBOARD_PATTERNS={blank:'Blank',dots:'Dots',grid:'Grid',lined:'Lined'}

export function whiteboardAppearanceStyle(appearance,scale){
  const {color,pattern}=appearance??DEFAULT_WHITEBOARD_APPEARANCE
  const [r,g,b]=color.slice(1).match(/../g).map(value=>parseInt(value,16))
  const guide=(r*.299+g*.587+b*.114)<120?'#ffffff44':'#24354a33'
  const patterns={
    blank:'none',
    dots:'radial-gradient(circle, var(--board-guide) 1px, transparent 1.5px)',
    grid:'linear-gradient(var(--board-guide) 1px, transparent 1px), linear-gradient(90deg, var(--board-guide) 1px, transparent 1px)',
    lined:'linear-gradient(var(--board-guide) 1px, transparent 1px)'
  }
  return {'--board-color':color,'--board-guide':guide,'--board-pattern':patterns[pattern],'--board-spacing':Math.max(8,32*scale)+'px'}
}
