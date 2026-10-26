import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { assistantMath } from '../lib/assistantMath'
import './AssistantMath.css'
import { ArrowUpRight } from 'lucide-react'
import { Children, isValidElement, useState } from 'react'

function CodeBlock({children}) {
  const [copied,setCopied]=useState('')
  const code=Children.toArray(children).find(isValidElement)
  const language=code?.props.className?.replace(/^language-/,'')||'Code'
  const copy=async()=>{
    try{await navigator.clipboard.writeText(String(code?.props.children??''));setCopied('Copied')}
    catch{setCopied('Select code to copy')}
  }
  return <div className="assistant-code-block"><div><span>{language}</span><button type="button" onClick={copy}>{copied||'Copy code'}</button><span className="sr-only" role="status">{copied}</span></div><pre>{children}</pre></div>
}

// Transform citations in prose without breaking Markdown structure or code samples.
function workspaceCitations(sources) {
  const known=new Map(sources.map(source=>[`${source.type}:${source.id}`,source]))
  return () => tree => {
    const walk=parent=>{
      if(!parent.children||['link','linkReference','code','inlineCode','math','inlineMath'].includes(parent.type))return
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

// Markdown normally collapses additional blank lines. The document converter
// keeps deliberate vertical gaps between prose blocks without changing code/math.
function documentSpacing(){
  return tree=>{
    const children=[]
    for(const node of tree.children||[]){
      const previous=children[children.length-1]
      const extra=(node.position?.start.line||0)-(previous?.position?.end.line||0)-2
      if(previous&&extra>0&&node.type!=='math'&&previous.type!=='math'){
        children.push({type:'paragraph',data:{hName:'div',hProperties:{className:['markdown-blank-lines'],style:`height:${extra * 1.6}em`,'aria-hidden':'true'}},children:[]})
      }
      children.push(node)
    }
    tree.children=children
  }
}

export default function AssistantMarkdown({content,sources=[],onOpenSource,preserveSpacing=false,onOpenLink,baseUrl}) {
  return <div className="assistant-markdown"><ReactMarkdown
    remarkPlugins={[remarkGfm,remarkMath,workspaceCitations(sources),...(preserveSpacing?[documentSpacing]:[])]}
    rehypePlugins={[[rehypeKatex,{trust:false,strict:'ignore',throwOnError:false,maxExpand:1000,maxSize:20,errorColor:'#cfb1b1',output:'htmlAndMathml'}]]}
    skipHtml
    components={{
      pre:CodeBlock,
      a:({href,children})=>{
        const key=href?.startsWith('#assistant-source/')?href.slice('#assistant-source/'.length):null
        const source=key&&sources.find(item=>`${item.type}:${item.id}`===key)
        if(source)return <button type="button" className="assistant-source" onClick={()=>onOpenSource(source)}>{children}<ArrowUpRight size={12}/></button>
        let target=href
        if(baseUrl&&href){try{target=new URL(href,baseUrl).href}catch{return <span>{children}</span>}}
        if(!target||!/^https?:\/\//i.test(target))return <span>{children}</span>
        return <a href={target} target="_blank" rel="noopener noreferrer" onClick={onOpenLink?event=>{if(event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();onOpenLink(target)}}:undefined}>{children}</a>
      },
      img:({src,alt})=>src&&/^https?:\/\//i.test(src)?<a href={src} target="_blank" rel="noopener noreferrer">{alt||'View image'} ↗</a>:<span>{alt||'Image'}</span>,
      table:({children})=><div className="assistant-table-scroll" role="region" aria-label="Answer table" tabIndex={0}><table>{children}</table></div>,
    }}
  >{assistantMath(content)}</ReactMarkdown></div>
}
