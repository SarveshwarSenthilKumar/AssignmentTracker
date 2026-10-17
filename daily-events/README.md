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

Planning only. This folder contains the README and ideas file; the webpage and QR code have not been built. It is separate from the existing Assignment Tracker frontend and backend.
