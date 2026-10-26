export function referenceMarkdown(page){
  if(typeof page?.markdown==='string')return page.markdown
  return (page?.blocks||[]).map(block=>{
    const text=String(block.text||'')
    if(block.type==='pre'){
      const longest=Math.max(2,...[...text.matchAll(/`+/g)].map(match=>match[0].length)),fence='`'.repeat(longest+1)
      return `${fence}\n${text}\n${fence}`
    }
    if(/^h[1-4]$/.test(block.type))return `${'#'.repeat(Number(block.type[1]))} ${text}`
    if(block.type==='li')return `- ${text.replace(/\n/g,'\n  ')}`
    if(block.type==='blockquote')return text.split('\n').map(line=>`> ${line}`).join('\n')
    return text
  }).join('\n\n')
}
