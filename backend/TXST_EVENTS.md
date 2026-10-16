# TXST event scraper

Requires Node.js 18 or newer. No additional packages, database, server, or API key are needed.

From the `backend` directory:

```powershell
npm run scrape:txst
npm run scrape:txst -- --csv exports/txst-events.csv
npm run scrape:txst -- --from 2026-10-01 --to 2026-11-01 --out exports/october.json
```

By default, writes `exports/txst-events.json`, relative to the working directory. The JSON includes event names, links, descriptions (which may contain HTML), dates, locations, organizations, categories, themes, benefits, and image paths when provided by the source. Original listing and detail objects are preserved under each event's `raw` field so additional source fields are retained. CSV contains the normalized fields; use JSON for the complete source data. Date-only CLI filters are interpreted as UTC midnight; pass an explicit time zone offset for local boundaries.

The scraper requests public discovery search pages, deduplicates event IDs, and fetches individual details sequentially. Requests have timeouts, retries for transient failures, and a default 500 ms delay. Use `--delay 1000` to slow requests further. Errors are saved with partial results and the process exits with status 1 if collection is incomplete. `complete` means all pages and details in the returned search were collected; it does not guarantee access to every event in the institution's records. Output files at the selected paths are overwritten.

Without date filters, the site determines the search's date range. Historical events may require `--from` and may no longer be available publicly. Private, restricted, removed, and unpublished events cannot be collected. Details absent from the public response remain empty or null. This does not sign in, RSVP, download image files, or import events into the assignment tracker.

The public endpoints used are `/engage/api/discovery/event/search` (skip/take pagination) and `/engage/api/discovery/event/{id}` on `https://txst.campuslabs.com`. These are website endpoints rather than the authenticated administrator API and may change. **Live compatibility has not been verified**, per the repository's instruction to leave testing and API probes to the user. If requests return 401/403, HTML, or an unrecognized response, inspect the saved errors and verify the website's current public endpoints before adapting the module. Access restrictions are not bypassed.

For use from another backend module:

```js
const { scrapeTxstEvents } = require('./scrapeTxstEvents');
const result = await scrapeTxstEvents({ from: '2026-10-01T00:00:00-05:00' });
// Inspect result.complete and result.errors before consuming result.events.
```
