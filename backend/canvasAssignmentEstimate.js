const { load } = require('cheerio');

function assignmentDetails(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const $ = load(value.slice(0, 100_000), {}, false);
  $('script, style, iframe, svg, [hidden]').remove();
  $('br, p, li, div, h1, h2, h3, h4, tr').after('\n');
  return $.root().text().split('\n').map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean).join('\n').slice(0, 20_000);
}

function assignmentEstimate(name, instructions) {
  const duration = instructions.match(/\b(?:estimated (?:completion )?time|time estimate|(?:this|the) assignment (?:should |will )?take(?:s)?|allow)\s*(?::|of)?\s*(?:about |approximately )?(\d+(?:\.\d+)?)(?:\s*(?:to|[-–—])\s*(\d+(?:\.\d+)?))?\s*(minutes?|mins?|hours?|hrs?)\b/i);
  if (duration) {
    const scale = /^h/i.test(duration[3]) ? 60 : 1;
    const low = Math.ceil(Number(duration[1]) * scale);
    const high = Math.ceil(Number(duration[2] || duration[1]) * scale);
    if (low > 0 && high >= low && high <= 10_080) {
      return { low, high, reason: 'Time stated in the Canvas instructions.' };
    }
  }
  const content = instructions.trim();
  if (content.length < 25) return null;
  const title = typeof name === 'string' ? name : '';
  const words = content.match(/\b(\d{1,3}(?:,\d{3})+|\d+)\s*(?:[-–]\s*)?words?\b/i);
  const count = words ? Number(words[1].replaceAll(',', '')) : 0;
  if (count >= 50 && count <= 20_000) {
    return { low: 10 + Math.ceil(count / 12 / 5) * 5, high: 20 + Math.ceil(count / 5 / 5) * 5, reason: 'Based on the stated word count, with time for drafting and review.' };
  }
  const pages = content.match(/\bread\b[^.!?\n]{0,70}\b(\d{1,3})\s+pages?\b/i);
  if (pages && Number(pages[1]) > 0) {
    const count = Number(pages[1]);
    return { low: 5 + count * 2, high: 10 + count * 5, reason: 'Based on the assigned reading length, with time for notes.' };
  }
  if (/\b(?:essay|research paper|lab report|case study|presentation|project|implement|debug)\b/i.test(title + ' ' + content)) {
    return { low: 90, high: 240, reason: 'Broad estimate for a project or extended deliverable. Check the rubric and linked material.' };
  }
  if (/\b(?:discussion|reflection|reading response|journal entry)\b/i.test(title + ' ' + content)) {
    return { low: 25, high: 60, reason: 'Allows time to read, draft and review a short response.' };
  }
  const questions = content.match(/\b(\d{1,3})\s+(?:questions|problems|exercises)\b/i);
  if (questions && Number(questions[1]) > 0) {
    const items = Number(questions[1]);
    return { low: 5 + items * 2, high: 10 + items * 6, reason: 'Based on the listed problem count, with time to check answers.' };
  }
  return null;
}

module.exports = { assignmentDetails, assignmentEstimate };
