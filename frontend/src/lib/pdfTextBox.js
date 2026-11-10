export const PDF_TEXT_FONT = 'Helvetica, Arial, sans-serif'
let context

export function pdfTextLines(item, measure) {
  const paragraphs = String(item.text || '').replace(/\t/g, '    ').split('\n')
  if (!Number.isFinite(item.textBoxWidth) || item.textBoxWidth <= 0) return paragraphs
  if (!measure) {
    context ||= document.createElement('canvas').getContext('2d')
    context.font = `${item.fontSize || 16}px ${PDF_TEXT_FONT}`
    measure = value => context.measureText(value).width
  }
  const width = Math.max(1, item.textBoxWidth - 8)
  return paragraphs.flatMap(paragraph => {
    const lines = []
    let line = ''
    for (const token of paragraph.match(/\s+|\S+/g) || []) {
      if (line && measure(line + token) > width) {
        lines.push(line.trimEnd())
        line = ''
        if (!token.trim()) continue
      }
      if (measure(token) <= width) { line += token; continue }
      for (const character of token) {
        if (line && measure(line + character) > width) {
          lines.push(line)
          line = ''
        }
        line += character
      }
    }
    lines.push(line)
    return lines
  })
}
