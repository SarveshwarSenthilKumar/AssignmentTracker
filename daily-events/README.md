# Daily Events

A standalone webpage that summarizes campus events, with an optional local server for collecting fresh TXST data.

Residents scan a QR code displayed at the apartment to open the webpage and quickly see what's happening.

## Experience

- Show today's events in America/Chicago time, ordered by start time.
- Summarize each event with its name, time, location, organizer, and a short description.
- Link to the original event page for full details and RSVP information.
- Make the page easy to read on a phone after scanning the QR code.

## Data and hosting

Host the frontend at a public URL and generate a QR code pointing to that URL. Print the code and place it in an approved apartment common area or noticeboard.

A frontend-only version can read a published static JSON file containing public event data. Direct browser requests to TXST may be restricted by CORS; the existing scraper could export the JSON separately if needed. Show when the data was last updated.

## Status

The page includes a selected-day overview (total events, events happening now, and events listing free food), a clearer calendar and agenda layout, free-food badges, and a Clear filters action. Overview counts cover the full selected day; search and category filters narrow the calendar and agenda. Keyboard users can skip directly to the lineup, and reduced-motion preferences are respected.

Dark mode is the default. Use the header's Light mode / Dark mode button to switch. Your choice is saved in browser local storage; if storage is unavailable, the toggle still works for the current visit. The “What’s happening today?” poster preview follows the selected theme. The QR code retains a white background for scanning, and the printed poster stays light.

The page now opens as a month calendar with a selected-day agenda. Click a date to see its events, or click an event for full details and its source/RSVP link. On small screens, date cells show event counts; selecting a date displays readable cards below the grid. Previous/next month, Today, the date picker, and Next event help navigate beyond today's events. Filters apply to the calendar and agenda together.

Calendar dates use explicit year/month/day parts in America/Chicago rather than assuming a locale formats dates as ISO strings. This avoids an empty date picker and missed date matches on browsers with different locale formatting. The current export contains real event data; the calendar uses that existing file without running a new scrape.

With the Node server below, **Reload events** starts a fresh TXST collection. The page polls for progress every two seconds while it runs, then updates the calendar and saves the complete result to events.json. A collection can take several minutes because individual event details are fetched sequentially with request delays. Concurrent clicks share one collection, and new collections have a one-minute cooldown. Failed or incomplete collections keep the previous export intact and display an error. A complete empty collection replaces the old data, so removed events do not linger.

The page checks the server's saved data every minute; this does not start another collection. A manually imported file pauses automatic reload until Reload events is selected. On static hosting, the page reads events.json instead; Reload events explains that collecting new TXST data requires the Node server. Static hosting still requires the separate publishing step below.

Implemented as standalone HTML, CSS, and JavaScript. The optional Node server reuses the repository's TXST collector without starting the Assignment Tracker backend. No build, package installation, database, or API key is needed.

## Run locally

Install Node.js 18 or newer, then from the repository root run:

```powershell
node daily-events/server.js
```

Open http://localhost:8080 in your browser and click **Reload events** to collect fresh TXST events. Keep the terminal open; Ctrl+C stops the server. If the old Python server is using port 8080, stop it first. To use another port in PowerShell, set `$env:PORT = '8081'` before running the command and open that port instead. The server binds to your computer only (127.0.0.1).

For static preview only, `python -m http.server 8080 --directory daily-events` still works, but cannot run the collector. Opening index.html directly may prevent loading event data; the file-import control can still preview an export.

## Publish real event data

The included events.json contains a previously exported snapshot, so it may be out of date. From the repository root, refresh it using the existing scraper:

```powershell
node backend/scrapeTxstEvents.js --out daily-events/events.json
```

For static hosting, scraping is a separate publishing step. Alternatively, use Reload events on the local Node server, which saves only complete collections. No live collection was run as part of this implementation. Check the export's complete flag and errors before publishing. Redeploy events.json whenever you update public data. Importing a JSON file using the footer control only previews data locally; it does not update the hosted file. The site shows the export update time and warns about stale or partial data.

## Host and print

Upload this entire directory to a static host, including events.json and vendor/. No backend, database, or environment variables are required. Enter the resulting public URL in the QR poster section, choose Update QR code, and print the poster or download the QR as SVG. Use a publicly accessible address rather than localhost. The poster's print view hides the rest of the page. The QR is generated locally using the bundled MIT-licensed qrcode-generator library; the webpage URL is not sent to a QR service. Fonts optionally load from Google Fonts, with system fallbacks.

Today and all event times use America/Chicago. Events overlapping the selected day are included, even if they started the previous day. Search, category filters, and a free-food filter use the exported source fields. Descriptions are summarized by shortening the published text; no AI or external summarization API is called. The page advances to the new day at Central midnight if Today was selected.

Tests, builds, live scraping, and browser QA were not run, per repository instructions.
