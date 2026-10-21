// PDF.js text transforms -> the same scale-1 viewport used by annotations.
export async function existingTextRuns(page, pdfjs) {
  const content = await page.getTextContent(), viewport = page.getViewport({ scale: 1 })
  return content.items.flatMap((item, index) => {
    if (!item.str?.trim() || !item.transform) return []
    const transform = pdfjs.Util.transform(viewport.transform, item.transform)
    const height = Math.hypot(transform[2], transform[3])
    // The current editor's text boxes are horizontal. Don't create misplaced
    // replacements over vertical, skewed or independently rotated text.
    const angle = Math.atan2(transform[1], transform[0])
    if (Math.abs(angle) > .02 || height < 1) return []
    const style = content.styles[item.fontName] || {}
    const ascent = Number.isFinite(style.ascent) ? style.ascent : Number.isFinite(style.descent) ? 1 + style.descent : .8
    const width = Math.max(1, item.width * viewport.scale)
    return [{ key: `${page.pageNumber}:${index}`, text: item.str, x: transform[4], y: transform[5] - height * ascent, width, height, fontSize: height, baseline: transform[5] }]
  })
}
