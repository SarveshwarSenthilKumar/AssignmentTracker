# 📝 Todo App

A modern, full-stack todo application with a beautiful UI and cloud database.

Account → Time zone lets you save a time zone or follow your device automatically. Calendar appointments, task deadline inputs and labels, and deadline charts use this preference. Stored event times remain unchanged; date markers and all-day dates keep their original calendar dates.

Search for a city to choose from matching locations, or use **Detect from IP** to suggest your network's time zone, then select **Save time zone**. City lookup uses [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api); IP detection calls [ipapi.co](https://ipapi.co/api/) directly from your browser so it detects your public IP rather than the server's. Detection runs only when selected, sends no account credentials, and does not store the IP or location. VPNs can affect accuracy. If either service is unavailable or rate limited, manual selection and Automatic remain available.

![React](https://img.shields.io/badge/React-18.2.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.3.5-38bdf8)

## ✨ Features

- **Modern UI**: Beautiful gradient design with smooth animations
- **Cloud Database**: MongoDB Atlas for data persistence
- **Full CRUD**: Create, read, update, and delete todos
- **Responsive**: Works perfectly on desktop and mobile
- **Real-time**: Instant updates with loading states
- **Easy Deployment**: Step-by-step guide included

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free)
- Git

### Setup

1. **Clone and install**
   ```bash
   git clone <your-repo-url>
   cd AssignmentTracker
   
   # Backend
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your MongoDB URI
   
   # Frontend
   cd ../frontend
   npm install
   ```

2. **Run locally**
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run dev
   
   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

3. **Open browser**
   Navigate to `http://localhost:3000`

## 📖 Full Setup & Deployment Guide

See [SETUP.md](./SETUP.md) for:
- Detailed local development setup
- MongoDB Atlas configuration
- Deployment to Vercel (frontend) and Render (backend)
- Troubleshooting guide
- Security best practices

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS, Lucide Icons
- **Backend**: Express.js, Node.js
- **Database**: MongoDB Atlas
- **Deployment**: Vercel (frontend), Render (backend)

## 📁 Project Structure

```
AssignmentTracker/
├── backend/          # Express API server
├── frontend/         # React + Vite app
├── SETUP.md         # Complete setup guide
└── README.md        # This file
```

## 🎯 Usage

1. **Add Todo**: Type in the input field and click "Add"
2. **Complete**: Click the circle to mark as done
3. **Delete**:Hover over a todo and click the trash icon
4. **Track**: See progress at the bottom of the list

## 🔐 Security

- Environment variables for sensitive data
- MongoDB IP whitelisting
- CORS configuration
- Never commit `.env` files

## 📄 License

Open source - use freely for personal or commercial projects.

---

**Built with ❤️ using React, Express, and MongoDB**

### Document editor formats

The Documents library accepts files up to 10 MB, using the existing PDF storage routes for backward compatibility.

| Format | Available editing |
| --- | --- |
| PDF | Visual annotations, images, shapes, tables, stamps, page merging and duplication |
| PNG, JPEG, SVG, WebP, GIF, BMP, AVIF and browser-supported images | Visual annotation canvas; edited PNG export (still frame, up to 1800 pixels on longest side) |
| TXT, Markdown, JSON, HTML, XML, source code and other UTF-8 text | Direct text editing and save/download in the original format |
| CSV / TSV | Editable cell grid with quoted-field support; larger files use text editing |
| DOCX | Text editing and DOCX export; original formatting and embedded content are not retained in the edited version |
| XLSX | Worksheet selection, cell values and formulas; formulas recalculate when opened in Excel |
| Browser-supported audio / video | Playback, download and replacement |
| Other formats, including legacy DOC/XLS and presentations | Download and replacement; native content editing is not available |

Direct content saves retain a downloadable copy of the uploaded original. The original and edited data together must fit within 15 MB. Unsupported or unreadable files remain downloadable rather than being forced through the PDF renderer. Native file edits require Save; visual annotations retain the existing autosave behavior.

### Document management

The document library provides folder navigation, filename/tag search, sorting, individual and bulk moves, renaming, downloads, drag-to-folder, and recoverable deletion. Deleted documents move to Trash and can be restored individually, in bulk, or immediately using Undo. Trash retains the original folder membership; removing a folder moves its documents (including trashed documents) to Unfiled. Uploads default to the folder currently being viewed. Document and destination-folder operations are scoped to the signed-in user.

### Interface conventions

The interface uses charcoal surfaces, a single muted blue-gray accent, and restrained semantic status colors. Application operations use inline feedback and confirmation bars. Settings, upload, and management forms remain in the page flow; browser alerts, prompts, confirmations, console logging, celebration overlays, gradients, and decorative scale/pulse animations are not used. Text and workbook drafts are kept in session storage when available, without a browser leave-page dialog.

Shared surface, border, text, and control tokens live in `frontend/src/theme.css` and are used by the document library, editor chrome, navigation, visualization, and task panels. The visual editor keeps Insert visible, labels its annotation tools, groups zoom controls, and uses neutral Save/Download/Settings actions. Page deletion stays in the footer; document-wide destructive actions live in Settings with inline confirmation. Settings focuses the first field and Escape dismisses the settings panel. Narrow layouts wrap controls without hiding Insert. PDF pages and image content retain their original colors; UI selection outlines use the muted accent.

### Navigation and keyboard shortcuts

The primary pages are `/#/tasks`, `/#/calendar`, `/#/documents`, `/#/visualization`, `/#/canvas`, `/#/account`, and `/#/shortcuts`. Hash routes support direct links, reloads, and browser Back/Forward without server routing changes. The navigation is neutral and shows the current page.

The searchable Shortcuts page is generated from the same registry used by the keyboard handlers. Alt+1 through Alt+5 switch pages; Ctrl/Cmd+K opens commands; `?` opens the reference. Context-specific shortcuts cover document management, task editing, calendar import, and document/visual editing. Text-entry controls retain typing behavior, checkboxes do not block document action shortcuts, and Tab/Shift+Tab use normal focus navigation. Destructive task deletion uses inline confirmation; Escape cancels that confirmation. Editor navigation does not discard unsaved work.

### Task visualization

Open Visualization or press Alt+6 to explore all tasks in an interactive network, grouped by folder or status, or laid out in planned sequence. Connections represent actual group membership, associated documents, and saved task prerequisites. Search, folder/status filters, overdue filtering, pan, zoom, a minimap, and a task index help navigate dense maps. Select a task to inspect its details, open linked documents, edit it, or advance its status. Dragged positions are temporary view adjustments.

Completion, folder workload, and a 14-day deadline chart update from the same task records. Deadline days use the account time zone (or the device time zone in Automatic mode). Visualization shortcuts include `/` for search, `0` to fit, `=`/`-` to zoom, `R` to reset layout, and Escape to clear filters; they also appear on the Shortcuts page.

### Task files and media

Task details and expanded task editors include a Files & media panel. Upload multiple files or drop them onto the panel, choose a document folder, or search and link existing library files. Files are stored once in Documents and may be associated with several tasks. Library rows link back to those tasks, and the Visualization map includes their document connections.

While editing a task, use Insert in description to place a document reference at the cursor, then save the task. References display the current document name and open the existing document editor. Images, audio, and video have optional authenticated previews in the attachment panel; other formats open with the library's existing editing/download support. Each uploaded file is limited to 10 MB. Attachment operations save immediately, while description changes require Save. Unlinking preserves the library file and existing inline references; documents in Trash show unavailable references until restored.

### Clean account reset

Account → Clean account reset permanently clears tasks, document files and backups (including Trash), task/document folders, personal calendar entries, and Canvas credentials/sync history. It preserves the login and profile identity. The inline form requires the current password and the exact phrase `RESET`. Local drafts for the account's loaded documents and workspace UI state are cleared after success.

The owner-scoped reset uses a MongoDB transaction and therefore requires Atlas or a replica set. Standalone MongoDB connections reject reset without deleting data. The single-server API blocks concurrent writes during reset and rejects reset while other authenticated write operations are active. Multi-instance deployments must coordinate this write guard across instances before enabling resets.

### Task prerequisites and follow-ups

Task details, expanded task cards, and the visualization inspector include Task connections. Add a task that should come before or after the current task, including tasks in other folders. The connection saves immediately and appears at both ends. Completion counts and statuses update from the linked task records. Circular sequences are flagged for review; no connection prevents starting, completing, or reopening a task.

The visualization draws arrows from prerequisite to follow-up, colored sage when the prerequisite is completed and muted amber otherwise. Sequence mode arranges acyclic chains from left to right and places circular or unresolved sequences in a final column. Filters hide arrows to tasks outside the current selection; the inspector still shows the full relationships. Duplicate and self-links are rejected or deduplicated. Deleting tasks removes their stored prerequisite references, and account reset clears all task connections along with the tasks.

### Workspace calendar

Open Calendar or press Alt+7. Month and agenda views combine task deadlines, Canvas assignments/imported events, and personal appointments/date markers. Task dates and completion are derived from the task records; opening a deadline takes you to the original task. Undated tasks appear in a separate list until given a due date. Search and source/completion filters apply to both views. Times use the account time zone; all-day dates retain their date-only meaning.

Create, edit, mark complete, or delete personal appointments and markers through inline controls. Appointments support start/end times, all-day ranges, notes, and locations. Markers support one date or an inclusive date range. Personal entries are saved in the owner-scoped `CalendarEntry` collection through `/api/calendar-entries`; they are not sent to Canvas. Deletion uses inline confirmation. Clean account reset includes this collection in its transaction.

Canvas sync follows same-origin pagination links, retrieves personal calendar events and course calendar events in batches of ten contexts, and refreshes existing titles/dates while preserving task status, notes, folders, and prerequisites. Event and assignment IDs are distinguished by source type. Calendar queries use `all_events=true`, as documented in the [Canvas Calendar Events API](https://canvas.instructure.com/doc/api/calendar_events.html); list pagination follows the [Canvas pagination guidance](https://canvas.instructure.com/doc/api/file.pagination.html). Partial sync failures remain visible. Sync is manual through the existing Canvas connection.

ICS import handles UTC timestamps, named IANA time zones, folded lines, UID updates, and exclusive all-day end dates. Invalid dates are skipped instead of being replaced with today's date; floating times without a time zone use UTC. Recurrence rules are not expanded locally. Calendar shortcuts include N for an appointment, Shift+N for a marker, T for today, [ / ] for month navigation, / for search, and Escape to dismiss a form or details. They are listed on the Shortcuts page.
