import {useLayoutEffect,useRef} from 'react'

export default function DetectiveWallText({node,onFocus,onChange,onFit}){
  const input=useRef(null),fit=useRef(onFit)
  fit.current=onFit
  const imageHeight=node.type==='photo'?(node.imageHeight??Math.max(80,node.height-90)):0
  useLayoutEffect(()=>{
    const element=input.current
    if(!element)return
    let active=true
    const measure=()=>{
      if(!active)return
      element.style.height='0px'
      const contentHeight=Math.max(node.type==='photo'?42:40,element.scrollHeight+2)
      element.style.height=`${node.type==='photo'?contentHeight:Math.max(contentHeight,node.height-38)}px`
      fit.current(contentHeight,imageHeight)
    }
    measure()
    document.fonts?.ready.then(measure)
    return()=>{active=false}
  },[node.text,node.width,node.height,node.type,node.fontSize,node.paperStyle,imageHeight])
  return <textarea
    ref={input}
    aria-label={node.type==='photo'?'Photo caption':'Sticky note text'}
    placeholder={node.type==='photo'?'Add a caption…':'What’s the connection?'}
    maxLength={3000} value={node.text} rows={1}
    style={{overflow:'hidden',flex:'0 0 auto',boxSizing:'border-box',fontSize:node.fontSize?`${node.fontSize}px`:undefined,lineHeight:node.fontSize?1.45:undefined}}
    onFocus={onFocus} onChange={onChange}
  />
}
