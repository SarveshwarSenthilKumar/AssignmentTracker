function nextCanvasPage(header, currentUrl, origin) {
  if (!header) return null;
  const next = header.split(',').find(part => /rel\s*=\s*"?next"?/.test(part));
  const match = next?.match(/<([^>]+)>/);
  if (!match) return null;
  const url = new URL(match[1], currentUrl);
  if (url.protocol !== 'https:' || url.origin !== origin) throw new Error('Canvas returned an invalid pagination destination.');
  return url.href;
}
async function collectCanvasPages(canvasUrl, token, endpoint, fetchPage) {
  const origin = new URL(canvasUrl).origin, rows = [], visited = new Set();
  let next = new URL(endpoint, canvasUrl).href;
  while (next) {
    if (visited.has(next) || visited.size >= 1000) throw new Error('Canvas pagination could not be completed.');
    visited.add(next);
    const page = await fetchPage(canvasUrl, token, next);
    if (!Array.isArray(page.items)) throw new Error('Canvas returned an unexpected list response.');
    rows.push(...page.items); next = nextCanvasPage(page.link, next, origin);
  }
  return rows;
}
module.exports = { nextCanvasPage, collectCanvasPages };
