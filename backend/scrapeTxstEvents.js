const fs = require('node:fs/promises');
const path = require('node:path');

const BASE = 'https://txst.campuslabs.com';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function requestJson(url, { delay = 500, retries = 3 } = {}) {
  for (let attempt = 0; ; attempt++) {
    await wait(delay);
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'AssignmentTracker-EventCollector/1.0' },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status} for ${url}`);
        error.retryable = response.status === 429 || response.status >= 500;
        const retryAfter = response.headers.get('retry-after');
        error.retryAfter = retryAfter && (/^\d+$/.test(retryAfter)
          ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now());
        throw error;
      }
      if (!(response.headers.get('content-type') || '').includes('json')) {
        const error = new Error(`Expected JSON at ${url}; Engage may have changed its endpoint or require sign-in.`);
        error.retryable = false;
        throw error;
      }
      return await response.json();
    } catch (error) {
      if (error.retryable === false || attempt >= retries) throw error;
      await wait(Math.min(60000, Math.max(1000 * 2 ** attempt, error.retryAfter || 0)));
    }
  }
}

function normalizeEvent(listing, detail) {
  const data = { ...listing, ...(detail || {}) };
  const id = data.id ?? data.eventId;
  return {
    id,
    name: data.name ?? data.title ?? '',
    url: `${BASE}/engage/event/${encodeURIComponent(id)}`,
    description: data.description ?? '',
    startsOn: data.startsOn ?? data.startDate ?? null,
    endsOn: data.endsOn ?? data.endDate ?? null,
    location: data.location ?? null,
    address: data.address ?? null,
    onlineLocation: data.onlineLocation ?? null,
    organizations: data.organizations ?? data.organizationNames ?? data.organizationName ?? [],
    categories: data.categories ?? data.categoryNames ?? [],
    themes: data.themes ?? data.theme ?? [],
    benefits: data.benefits ?? data.benefitNames ?? [],
    imagePath: data.imagePath ?? null,
    raw: { listing, detail },
  };
}

async function scrapeTxstEvents({ from, to, delay = 500, pageSize = 100, onProgress = () => {}, onEvent = () => {} } = {}) {
  const listings = new Map();
  const errors = [];
  let listingComplete = false;
  let reportedTotal = null;
  try {
    for (let skip = 0; ; ) {
      const url = new URL('/engage/api/discovery/event/search', BASE);
      url.searchParams.set('skip', skip);
      url.searchParams.set('take', pageSize);
      url.searchParams.set('orderByField', 'startsOn');
      url.searchParams.set('orderByDirection', 'ascending');
      if (from) url.searchParams.set('startsAfter', from);
      if (to) url.searchParams.set('startsBefore', to);
      const page = await requestJson(url, { delay });
      const items = page.value ?? page.items;
      if (!Array.isArray(items)) throw new Error('Unrecognized event search response: expected value[] or items[].');
      const total = page['@odata.count'] ?? page.totalItems ?? page.total;
      if (total != null && Number.isFinite(Number(total))) reportedTotal = Number(total);
      if (items.length === 0) {
        if (reportedTotal !== null && skip < reportedTotal) throw new Error('Pagination ended before the reported event total.');
        listingComplete = true;
        break;
      }
      const previousCount = listings.size;
      for (const item of items) {
        const id = item.id ?? item.eventId;
        if (id == null) throw new Error('An event listing is missing its ID.');
        listings.set(String(id), item);
      }
      skip += items.length;
      onProgress(`Collected ${listings.size} event listings`);
      if (listings.size === previousCount) throw new Error('Pagination repeated a page without any new event IDs.');
      if (reportedTotal !== null && skip >= reportedTotal) {
        listingComplete = true;
        break;
      }
    }
  } catch (error) {
    errors.push({ stage: 'listings', message: error.message });
  }

  const events = [];
  for (const [id, listing] of listings) {
    let detail = null;
    try {
      detail = await requestJson(`${BASE}/engage/api/discovery/event/${encodeURIComponent(id)}`, { delay });
      if (!detail || typeof detail !== 'object' || Array.isArray(detail) || (detail.id ?? detail.eventId) == null) {
        throw new Error('Unrecognized event detail response: expected an event object with an ID.');
      }
    } catch (error) {
      detail = null;
      errors.push({ stage: 'detail', id, message: error.message });
    }
    events.push(normalizeEvent(listing, detail));
    onEvent(events[events.length - 1]);
    onProgress(`Fetched details ${events.length}/${listings.size}`);
  }
  return {
    source: `${BASE}/engage/events`,
    scrapedAt: new Date().toISOString(),
    filters: { from: from || null, to: to || null },
    scope: 'Events returned by the public Engage discovery search; private events are excluded.',
    complete: listingComplete && errors.length === 0,
    reportedTotal,
    count: events.length,
    errors,
    events,
  };
}

function toCsv(events) {
  const fields = ['id', 'name', 'url', 'description', 'startsOn', 'endsOn', 'location', 'address', 'onlineLocation', 'organizations', 'categories', 'themes', 'benefits', 'imagePath'];
  const cell = value => {
    let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    // Prevent spreadsheet applications from interpreting public event text as formulas.
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [fields.join(','), ...events.map(event => fields.map(field => cell(event[field])).join(','))].join('\r\n') + '\r\n';
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: npm run scrape:txst -- [--out exports/txst-events.json] [--csv exports/txst-events.csv] [--from ISO_DATE] [--to ISO_DATE] [--delay 500]');
    return;
  }
  const options = {};
  const allowed = new Set(['out', 'csv', 'from', 'to', 'delay']);
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    if (!args[i].startsWith('--') || !allowed.has(key) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Invalid option: ${args[i]}. Use --help.`);
    options[key] = args[i + 1];
  }
  for (const key of ['from', 'to']) {
    if (options[key]) {
      const date = new Date(options[key]);
      if (!Number.isFinite(date.getTime())) throw new Error(`Invalid --${key} date.`);
      options[key] = date.toISOString();
    }
  }
  if (options.from && options.to && options.from >= options.to) throw new Error('--from must be earlier than --to.');
  if (options.delay !== undefined && (!Number.isFinite(Number(options.delay)) || Number(options.delay) < 250)) throw new Error('--delay must be at least 250 milliseconds.');
  const result = await scrapeTxstEvents({ ...options, delay: Number(options.delay ?? 500), onProgress: message => console.error(message) });
  const output = path.resolve(options.out || 'exports/txst-events.json');
  if (options.csv && path.resolve(options.csv) === output) throw new Error('JSON and CSV output paths must differ.');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(result, null, 2) + '\n');
  if (options.csv) {
    const csvPath = path.resolve(options.csv);
    await fs.mkdir(path.dirname(csvPath), { recursive: true });
    await fs.writeFile(csvPath, toCsv(result.events));
  }
  console.error(`Saved ${result.count} events to ${output}. Complete: ${result.complete}`);
  if (!result.complete) {
    console.error('Collection was incomplete. See errors in the JSON output; existing public listing data was preserved.');
    process.exitCode = 1;
  }
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });

module.exports = { scrapeTxstEvents, normalizeEvent, toCsv };
