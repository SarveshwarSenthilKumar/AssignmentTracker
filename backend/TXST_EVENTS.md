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

Without date filters, the scraper collects approved upcoming and ongoing public events, using the website's `endsAfter`, `status`, and sort parameters. Historical events require `--from` and may no longer be available publicly. Private, restricted, removed, and unpublished events cannot be collected. Details absent from the public response remain empty or null. This does not sign in, RSVP, or download image files.

## Calendar integration

Open the app's Calendar page to automatically load all events returned by the public search, alongside your personal entries and task deadlines. No manual export or CLI command is needed. Restart the backend after installing this change; no new dependencies or environment variables are required.

The Workspace calendar window uses the same TXST loading hook and cache as the full Calendar page. Both views include a `Refresh TXST` button and report loading or upstream failures. The Workspace agenda includes a TXST visibility checkbox and a Show more button for lists exceeding 100 entries. Clicking a campus event in the Workspace agenda opens its TXST page. Listing data appears as soon as each search page arrives, before individual detail requests finish.

TXST events have a separate source filter (enabled by default), a monthly count, and details with descriptions, locations, organizations, categories, themes, benefits, and a link to the source event where available. Times follow your account's time zone. TXST events do not create personal tasks or calendar records. Public events missing a valid start time cannot be placed on the calendar.

Both calendar views support removing individual TXST events and task deadlines from your calendar. These removals save to your account and survive source refreshes. Tasks remain in the task list, and no changes are sent to TXST or Canvas. `Remove all TXST events` also excludes future synced campus events. `Restore removed events` clears all of these calendar exclusions. Personal appointments and date markers use the existing permanent delete endpoint, with confirmation; they cannot be restored through this control. Account reset clears calendar exclusions. No manual database migration is required; the new user preference fields default to an empty exclusion list and campus events enabled.

Reversible removals apply immediately with no confirmation and roll back with an error if saving fails. Polling cannot overwrite a pending visibility change. Permanent-delete confirmations scroll into view and receive keyboard focus. Both calendar surfaces reload preferences after a saved visibility change.

`Remove similar events` in the full calendar inspector (or `Remove similar` on a Workspace agenda row) opens a preview across all loaded calendar dates and sources. Choose exact names or similar names, edit the name, and uncheck any matches to keep. Matching ignores capitalization, accents, and punctuation; similar matching requires at least two shared words and 80% token similarity. The selected IDs are excluded in one account update, including personal entries without permanently deleting them. These exclusions survive refreshes and are cleared by `Restore removed events`. This applies to loaded matches only; newly discovered events with different IDs are not automatically excluded. Restart the backend for the batch visibility endpoint update. No new dependencies are needed.

The authenticated `/api/calendar/txst-events` endpoint starts a background collection and reports progress while the browser polls. Events appear as their details arrive. Public data is cached in memory for the backend process and reused across users. The cache refreshes after an hour when requested by an open calendar; a backend restart clears it. Multiple backend processes maintain independent caches. `Refresh TXST` requests a refresh through `/api/calendar/txst-events/refresh`, with a one-minute cooldown. Incomplete collections retain previous data and retry after five minutes while the calendar is open. A successful full collection replaces the cache, removing events that are no longer returned by the source. Partial refreshes may temporarily retain stale events.

The public endpoints used are `/engage/api/discovery/event/search` (skip/take pagination) and `/engage/api/discovery/event/{id}` on `https://txst.campuslabs.com`. These are website endpoints rather than the authenticated administrator API and may change. **Live compatibility has not been verified**, per the repository's instruction to leave testing and API probes to the user. If requests return 401/403, HTML, or an unrecognized response, inspect the saved errors and verify the website's current public endpoints before adapting the module. Access restrictions are not bypassed.

For use from another backend module:

```js
const { scrapeTxstEvents } = require('./scrapeTxstEvents');
const result = await scrapeTxstEvents({ from: '2026-10-01T00:00:00-05:00' });
// Inspect result.complete and result.errors before consuming result.events.
```
