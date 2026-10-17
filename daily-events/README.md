# Daily Events

A separate project idea for a frontend-only webpage that summarizes campus events happening today.

Residents scan a QR code displayed at the apartment to open the webpage and quickly see what's happening.

## Planned experience

- Show today's events in America/Chicago time, ordered by start time.
- Summarize each event with its name, time, location, organizer, and a short description.
- Link to the original event page for full details and RSVP information.
- Make the page easy to read on a phone after scanning the QR code.

## Data and hosting

Host the frontend at a public URL and generate a QR code pointing to that URL. Print the code and place it in an approved apartment common area or noticeboard.

A frontend-only version can read a published static JSON file containing public event data. Direct browser requests to TXST may be restricted by CORS; the existing scraper could export the JSON separately if needed. Show when the data was last updated.

## Status

The page now opens as a month calendar with a selected-day agenda. Click a date to see its events, or click an event for full details and its source/RSVP link. On small screens, date cells show event counts; selecting a date displays readable cards below the grid. Previous/next month, Today, the date picker, and Next event help navigate beyond today's events. Filters apply to the calendar and agenda together.

Calendar dates use explicit year/month/day parts in America/Chicago rather than assuming a locale formats dates as ISO strings. This avoids an empty date picker and missed date matches on browsers with different locale formatting. The current export contains real event data; the calendar uses that existing file without running a new scrape.

The browser reloads events.json every minute and updates the calendar automatically. It retains previously loaded events and displays errors if a reload fails. A manually imported file pauses automatic reload until Reload events is selected. Automatic browser reload reads the static export; it does not execute the scraper. Updating the source export still requires the separate publishing step below.

Implemented as standalone HTML, CSS, and JavaScript. It remains separate from the Assignment Tracker frontend and backend. No build or package installation is needed.

## Run locally

Serve this folder with any static HTTP server. For example, from the repository root with Python installed:

```powershell
python -m http.server 8080 --directory daily-events
```

Open http://localhost:8080 in your browser. Opening index.html directly may prevent loading events.json; the file-import control can still preview an export.

## Publish real event data

The included events.json is intentionally empty; no events have been invented. From the repository root, populate it using the existing scraper:

```powershell
node backend/scrapeTxstEvents.js --out daily-events/events.json
```

Scraping is a separate publishing step. It has not been run as part of this implementation. Check the export's complete flag and errors before publishing. Re-run the command and redeploy events.json whenever you want to update the public data. Importing a JSON file using the footer control only previews data locally; it does not update the hosted file. The site shows the export update time and warns about stale or partial data.

## Host and print

Upload this entire directory to a static host, including events.json and vendor/. No backend, database, or environment variables are required. Enter the resulting public URL in the QR poster section, choose Update QR code, and print the poster or download the QR as SVG. Use a publicly accessible address rather than localhost. The poster's print view hides the rest of the page. The QR is generated locally using the bundled MIT-licensed qrcode-generator library; the webpage URL is not sent to a QR service. Fonts optionally load from Google Fonts, with system fallbacks.

Today and all event times use America/Chicago. Events overlapping the selected day are included, even if they started the previous day. Search, category filters, and a free-food filter use the exported source fields. Descriptions are summarized by shortening the published text; no AI or external summarization API is called. The page advances to the new day at Central midnight if Today was selected.

Tests, builds, live scraping, and browser QA were not run, per repository instructions.
