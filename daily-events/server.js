// Standalone local server: no dependencies or Assignment Tracker database needed.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { scrapeTxstEvents } = require('../backend/scrapeTxstEvents');

const root = __dirname;
const port = Number(process.env.PORT || 8080);
let data = { events: [] }, refreshing = false, progress = '', error = '', lastAttempt = 0;
const snapshot = () => ({ data, refreshing, progress, error });

async function refresh() {
  if (refreshing || Date.now() - lastAttempt < 60000) return;
  refreshing = true;
  lastAttempt = Date.now();
  error = '';
  progress = 'Connecting to TXST…';
  console.log(progress);
  try {
    const result = await scrapeTxstEvents({ onProgress: message => { progress = message; console.log(message); } });
    if (!result.complete) throw new Error(`TXST collection was incomplete. ${result.errors.map(item => item.message).slice(0, 3).join(' ')}`);
    // Only publish complete collections, and never expose a half-written JSON file.
    const temporary = path.join(root, 'events.json.tmp');
    await fs.writeFile(temporary, JSON.stringify(result, null, 2) + '\n');
    await fs.rename(temporary, path.join(root, 'events.json'));
    data = result;
    progress = `Updated ${result.events.length} events from TXST.`;
    console.log(progress);
  } catch (failure) {
    error = `${failure.message} Previous event data has been kept. You can retry after one minute.`;
    console.error(error);
    progress = '';
  } finally {
    refreshing = false;
  }
}

const files = new Map([
  ['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
  ...['styles.css', 'theme.css', 'responsive.css', 'polish.css'].map(file => [`/${file}`, [file, 'text/css']]),
  ...['app.js', 'theme.js', 'progress.js', 'vendor/qrcode.js'].map(file => [`/${file}`, [file, 'text/javascript']]),
  ['/events.json', ['events.json', 'application/json']],
]);

async function main() {
  try { data = JSON.parse(await fs.readFile(path.join(root, 'events.json'), 'utf8')); }
  catch { error = 'No saved export could be loaded. Choose Reload events to collect events.'; }
  http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      response.setHeader('Cache-Control', 'no-store');
      if (url.pathname === '/api/events' || url.pathname === '/api/events/refresh') {
        const isRefresh = url.pathname.endsWith('/refresh');
        if (request.method !== (isRefresh ? 'POST' : 'GET')) {
          response.writeHead(405).end(); return;
        }
        if (isRefresh) {
          // Prevent other websites from triggering collections against the local server.
          const origin = request.headers.origin;
          if (origin && origin !== `http://${request.headers.host}`) { response.writeHead(403).end(); return; }
          void refresh();
        }
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify(snapshot()));
        return;
      }
      const file = files.get(url.pathname);
      if (!file || !['GET', 'HEAD'].includes(request.method)) { response.writeHead(404).end('Not found'); return; }
      const content = await fs.readFile(path.join(root, file[0]));
      response.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8` });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (failure) {
      console.error(failure.message);
      if (!response.headersSent) response.writeHead(500);
      response.end('The local event server could not complete the request.');
    }
  }).listen(port, '127.0.0.1', () => console.log(`Daily events: http://localhost:${port}\nUse Reload events to fetch a fresh TXST collection. Keep this terminal open.`));
}
main().catch(failure => { console.error(failure.message); process.exitCode = 1; });
