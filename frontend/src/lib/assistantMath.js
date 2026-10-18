// Normalize common model delimiters before Markdown parsing; code stays literal.
export function assistantMath(content='') {
  const normalize=text=>text
    .replace(/\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g,(_,dollars,display,inline)=>inline!==undefined?`$${inline}$`:`\n\n$$\n${dollars??display}\n$$\n\n`)
    .replace(/^(\s*(?:\*\*)?(?:Answer|Result|Final answer)(?:\*\*)?\s*:\s*)([^$\n]+)$/gim,(original,prefix,answer)=>{
      // Older replies sometimes omit delimiters on the final answer only.
      const split=answer.search(/\s+\(or\b|,?\s+approx\./i)
      const formula=(split<0?answer:answer.slice(0,split)).trim()
      if(!/\\(?:pi|frac|sqrt|theta|cdot|times|sin|cos|tan|text|dfrac)\b/.test(formula))return original
      return `${prefix}$${formula}$${split<0?'':answer.slice(split)}`
    })
  const source=String(content),code=/(^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\2[^\n]*(?:\n|$))|(`+)[^`]*?\3/gm
  let result='',offset=0
  for(const match of source.matchAll(code)){result+=normalize(source.slice(offset,match.index))+match[0];offset=match.index+match[0].length}
  return result+normalize(source.slice(offset))
}
