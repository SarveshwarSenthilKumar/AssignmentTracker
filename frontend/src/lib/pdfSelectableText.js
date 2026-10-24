// customTextRenderer returns HTML, so PDF strings must always be escaped.
export function selectablePdfText(items,page){
  const replaced=new Set(items.filter(item=>item.sourceText).map(item=>item.sourceText.key))
  return ({str,itemIndex})=>replaced.has(`${page}:${itemIndex}`)?'':String(str||'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]))
}
