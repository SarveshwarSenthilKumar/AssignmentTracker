import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowUpRight } from 'lucide-react'

// Transform citations in prose without breaking Markdown structure or code samples.
function workspaceCitations(sources) {
  const known=new Map(sources.map(source=>[`${source.type}:${source.id}`,source]))
  return () => tree => {
    const walk=parent=>{
      if(!parent.children||['link','linkReference','code','inlineCode'].includes(parent.type))return
      parent.children=parent.children.flatMap(child=>{
        if(child.type!=='text'){walk(child);return [child]}
        const nodes=[];let offset=0
        for(const match of child.value.matchAll(/\[\[(task|calendar|document):([a-f\d]{24})\]\]/gi)) {
          const key=`${match[1].toLowerCase()}:${match[2].toLowerCase()}`,source=known.get(key)
          if(!source)continue
          if(match.index>offset)nodes.push({type:'text',value:child.value.slice(offset,match.index)})
          nodes.push({type:'link',url:`#assistant-source/${key}`,children:[{type:'text',value:source.title}]})
          offset=match.index+match[0].length
        }
        if(offset<child.value.length)nodes.push({type:'text',value:child.value.slice(offset)})
        return nodes
      })
    }
    walk(tree)
  }
}

export default function AssistantMarkdown({content,sources=[],onOpenSource}) {
  return <div className="assistant-markdown"><ReactMarkdown
    remarkPlugins={[remarkGfm,workspaceCitations(sources)]}
    skipHtml
    components={{
      a:({href,children})=>{
        const key=href?.startsWith('#assistant-source/')?href.slice('#assistant-source/'.length):null
        const source=key&&sources.find(item=>`${item.type}:${item.id}`===key)
        if(source)return <button type="button" className="assistant-source" onClick={()=>onOpenSource(source)}>{children}<ArrowUpRight size={12}/></button>
        if(!href||!/^https?:\/\//i.test(href))return <span>{children}</span>
        return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
      },
      img:({src,alt})=>src&&/^https?:\/\//i.test(src)?<a href={src} target="_blank" rel="noopener noreferrer">{alt||'View image'} ↗</a>:<span>{alt||'Image'}</span>,
      table:({children})=><div className="assistant-table-scroll" role="region" aria-label="Answer table" tabIndex={0}><table>{children}</table></div>,
    }}
  >{content}</ReactMarkdown></div>
}
