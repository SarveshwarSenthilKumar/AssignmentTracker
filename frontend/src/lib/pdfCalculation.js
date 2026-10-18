export function selectionExpression(text){
  const expression=text.trim().replace(/\u2212/g,'-').replace(/[·⋅]/g,'*').replace(/\s*[=＝]\s*$/,'').replace(/(?<=[\d)])\s*[xX]\s*(?=[\d(])/g,'*').replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g,run=>'^'+[...run].map(char=>'⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(char)).join('')).replace(/√\s*\(/g,'sqrt(').replace(/√\s*(\d+(?:\.\d+)?)/g,'sqrt($1)')
  if(!expression)throw new Error('No readable text found. Scanned or handwritten expressions need to be typed into the calculator.')
  if(expression.length>500)throw new Error('Select a smaller expression (up to 500 characters).')
  return expression
}

export async function textInPdfBox(page,box,transform,annotations=[]){
  const content=await page.getTextContent(),viewport=page.getViewport({scale:1})
  const inside=(x,y)=>x>=box.x-1&&x<=box.x+box.width+1&&y>=box.y-1&&y<=box.y+box.height+1
  const chunks=[]
  for(const item of content.items){
    if(!item.str?.trim())continue
    const matrix=transform(viewport.transform,item.transform),height=Math.hypot(matrix[2],matrix[3]),axis=Math.hypot(matrix[0],matrix[1])
    if(!height||!axis)continue
    const width=Math.abs(item.width)*viewport.scale,characters=[...item.str]
    let selected=''
    characters.forEach((char,index)=>{
      const distance=width*(index+.5)/characters.length
      const x=matrix[4]+matrix[0]/axis*distance+matrix[2]*.4,y=matrix[5]+matrix[1]/axis*distance+matrix[3]*.4
      if(inside(x,y))selected+=char
    })
    if(selected.trim())chunks.push({text:selected,x:matrix[4],y:matrix[5],height})
  }
  for(const item of annotations.filter(item=>item.tool==='text'&&item.text?.trim())){
    const height=item.fontSize||16
    if(inside(item.x+height*.5,item.y+height*.5)){
      if(item.text.includes('\n'))throw new Error('Select one expression on a single line. Stacked fractions and multi-line equations need manual entry.')
      chunks.push({text:item.text,x:item.x,y:item.y+height,height})
    }
  }
  if(!chunks.length)return ''
  const baseline=chunks[0].y,tolerance=Math.max(3,...chunks.map(chunk=>chunk.height*.5))
  if(chunks.some(chunk=>Math.abs(chunk.y-baseline)>tolerance))throw new Error('Select one expression on a single line. Multi-line formulas and stacked fractions need manual entry.')
  return chunks.sort((a,b)=>a.x-b.x).map(chunk=>chunk.text).join(' ')
}
