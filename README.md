# 📝 Todo App

Use the PDF editor's **Single page / Continuous view** toggle to switch between page-by-page editing and a scrolling stack of all pages. The browser remembers this preference. Continuous view renders nearby pages lazily and previews saved ink, text, and image annotations. Click a page or its Edit page button to activate the full annotation tools there; other pages remain scrollable previews. Previous/Next, the page-number field, and thumbnail navigation scroll to the requested page in continuous view. Dark pages, zoom, rotation, and page insertion remain available. No tests or browser QA were run for this change.

The PDF editor toolbar includes **Blank page after**, which inserts an empty page immediately after the current page, matches its displayed size/orientation, shifts later annotation page numbers, saves the document, and opens the inserted page. The control is unavailable for images and while pages are loading or another page operation is running. This uses the existing page-insertion API; page operations clear the annotation undo stack. No tests or browser QA were run.

The PDF eraser has Whole stroke, Precision (partial vector-stroke removal), and Objects (whole text/image annotations) modes, round/square shapes, 2–160 pt sizes, size presets, and pen/highlighter filters. A cursor outline shows its page-scaled footprint. Eraser settings are remembered in this browser. Erasing affects annotations only, never original PDF content, and each gesture can be undone. Pen widths now support 1–40 pt in 0.5 pt increments with exact numeric input; text supports 6–144 pt with a numeric input. Tests and browser QA were not run, per repository instructions.

The PDF editor defaults to dark pages, inverting the displayed page, annotations, and page thumbnails for comfortable reading. Use Light pages / Dark pages in the editor header to toggle; your preference is remembered in this browser. This is a view-only filter: saved PDFs, downloads, and images sent for math recognition keep original colors. Images/photos on the displayed page also invert. No tests or browser QA were run for this change.

Documents → **Markdown to PDF** accepts pasted Markdown or an imported .md/.markdown/.txt file. It previews headings, emphasis, lists, tables, blockquotes, code, links, and KaTeX mathematics on a light document page. Choose A4 or US Letter, then Download PDF or Save & open PDF editor. Saved PDFs go to the current library folder, with paginated content and page numbers, and can be annotated with existing PDF tools. Conversion happens locally with html2pdf.js; no AI or API key is used. External images are rendered as links and raw HTML is omitted.

The automatic converter exports high-resolution rasterized pages, so the original Markdown text is not a selectable/editable PDF text layer. Keep the Markdown source for revisions; the PDF editor adds annotations rather than editing that underlying text. Browser conversion is limited to 30,000 input characters and a measured content height of 12,000 pixels (roughly a dozen pages); library uploads are limited to 10 MB. Very wide formulas/tables or unusual Markdown may need shorter lines or manual source adjustments. New frontend dependencies and lockfile are installed; restart the frontend after updating, and run npm install in frontend on other machines. No tests, builds, browser QA, or PDF render verification were run, per repository instructions.

Documents → **Create with AI** generates a draft from your description using the configured Gemini key. Review or edit its title and text, then choose **Create PDF & open editor**. The document is saved in your current library folder and opens in the PDF editor with editable text annotations on paginated pages. Use Text to edit the generated blocks, Move to reposition them, and the usual annotation tools and Save control. Use **Download in the PDF editor** to export a finished PDF containing the editable content and annotations; the stored base pages are intentionally blank so text remains editable. Drafts use plain text, with a 20,000-character/30-page limit. Font-incompatible characters are normalized or replaced with ? and reported after creation. This does not typeset LaTeX or generate images.

AI generation sends only your description to Gemini; it does not include library files. Review generated facts before use. Restart the backend and reload the frontend after updating. Uses the existing Account → AI settings key (or server GEMINI_API_KEY) and GEMINI_MODEL, with no new dependencies. No automated tests, live AI calls, builds, or browser QA were run, per repository instructions.

Documents → **New notes** creates a plain-text document directly in your library, in the current folder (or Unfiled from All documents). Give it a name and choose Create & open to start writing. Use Save or the editor's save shortcut to persist edits. Notes support the existing rename, download as .txt, task linking, move, and Trash controls. No new packages or backend configuration are needed; this reuses document upload and editing. Tests and browser QA were not run.

AI assistant replies now render LaTeX with KaTeX: inline `$...$` / `\(...\)` and display `$$...$$` / `\[...\]`, including fractions, derivatives, roots, Greek letters, superscripts, subscripts, units, and aligned equations. Existing saved replies render through the same component, with conservative handling of unwrapped LaTeX on Answer/Result lines. Code samples remain literal; long equations scroll horizontally. Math is rendered locally with bundled CSS/fonts and untrusted commands disabled. New assistant responses are instructed to consistently delimit math. Frontend dependencies (`remark-math`, `rehype-katex`, and `katex`) and the lockfile have been updated. Restart the frontend and backend after updating; run `npm install` in frontend on other machines. No automated tests, builds, or browser QA were run, following repository instructions.

For PDF handwriting calculation, restart the backend and configure a Gemini API key in Account → AI settings (or GEMINI_API_KEY on the server). It uses the existing GEMINI_MODEL setting. Auto recognition crops only the selected page region, including editor pen/text/image annotations, and sends that image to Gemini when local extraction or calculation fails. Handwriting / AI always uses the crop; Text only makes no AI request. AI requests are limited and time out; no selected image is stored by this application. Provider data handling follows your Gemini account's policies. Review the visible AI transcription: recognition is fallible, and unclear handwriting is rejected rather than knowingly guessed. Results are computed locally from supported arithmetic, not taken from an AI answer. See [Gemini image input documentation](https://ai.google.dev/gemini-api/docs/image-understanding). No AI probes or browser QA were run.

The PDF editor includes **Calculate selection**: choose the tool and drag a box around one line of arithmetic. Readable PDF text (or editor-added text) is extracted into the calculator and evaluated, with the recognized expression visible for review. It supports the calculator's arithmetic, parentheses, percentages, powers, square roots, and pi, including common PDF multiplication/minus glyphs. Selections do not modify the document. Auto mode falls back to Gemini image recognition for scanned or handwritten arithmetic and formulas that the local text extractor cannot read. Handwriting / AI forces recognition; Text only stays local. AI transcribes math into the supported arithmetic syntax; the calculator evaluates it locally. Symbolic equations or unclear selections may still require manual entry. Text geometry uses approximate character positions for PDF text chunks, so review extraction before relying on a result. No additional dependencies or API keys are needed. Tests and browser QA were not run, per repository instructions.

Task dragging uses a compact floating preview and a single insertion line, with pointer visuals updated once per animation frame outside React. Wheel/trackpad scrolling stays native; edge scrolling eases in and pauses for manual scrolling. Drops update immediately while saving, with rollback if saving fails. Escape cancels a drag. No browser QA or automated checks were run for this change, following repository instructions.

Tasks default to Custom order. Drag a task onto the upper or lower half of another card to place it before or after that task; the insertion line shows the destination. Dropping into a different status column also updates the moved task's status. A drag from another sort mode switches to Custom order after saving. Ordering saves to your account and survives reloads; other sort modes remain available. Restart the backend after updating. Reordering uses MongoDB transactions (Atlas or a replica set), like calendar undo. This change has not been tested or browser-verified, following repository instructions.

Account → Action confirmations lets you separately disable task-deletion confirmations (including bulk deletion) and other standard action confirmations. Both are enabled by default and save to your account. Disabling them makes the relevant actions immediate; account reset still requires its password and RESET confirmation. Restart the backend after updating to enable these preferences.

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

To export public TXST Bobcat Organization Hub events to JSON or CSV, see [TXST event scraper](backend/TXST_EVENTS.md).

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

Appointments and date markers support linked tasks, existing documents, and uploaded files/media. Create or edit an entry, use Link tasks, Link documents, or Upload files (including drag and drop, up to 10 MB each), then save. Uploads are stored in Documents with an optional destination folder. Images, audio, and video can be previewed from the entry. Unlinking or deleting an entry preserves original tasks and documents; cancelling an edit preserves uploaded documents but discards unsaved links. New links must belong to the account. Unavailable links can be removed without blocking other entry edits.

## Workspace AI assistant

Open **AI assistant** in the main navigation, visit `#/assistant`, or use **Alt + 8** for the dedicated page. **Alt + J** opens the floating assistant elsewhere and focuses the composer on the assistant page. Use Open page in the floating panel to continue the same conversation in the dedicated workspace. Escape closes the floating panel; on the dedicated page it dismisses an active rename or delete confirmation. The assistant answers general questions and questions about your tasks, assignments, calendar, documents and profile, with links back to referenced items. It is read-only and cannot change account data. Conversations are saved to your account in MongoDB and remain available across reloads, devices and sign-ins. Account reset permanently deletes active and archived chats.

Add a [Google AI Studio key](https://aistudio.google.com/apikey) in **Account → AI settings**. The saved personal key is used for all assistant chat, file-context, regeneration and connection-check requests for that account, including on other devices. Saving or replacing the key takes effect for new requests without restarting the server. A backend `GEMINI_API_KEY` remains an optional shared fallback only when the account has no saved personal key. `GEMINI_MODEL` defaults to `gemini-3.8-flash`; choose another compatible model if needed. The browser never receives the key. All AI requests use Google's native [Gemini generateContent API](https://ai.google.dev/api/generate-content). No OpenAI credential or endpoint is used.

Context switches control fresh owner-scoped workspace records, visible page text, and saved content of the open file. Selected context and conversation history are sent to Google Gemini when you send a question. Screen text excludes the assistant and credential fields; it is not a screenshot. Unselected document bodies are not automatically sent. Unsaved edits are represented only by supplied visible text.

PDFs and supported images, audio and video use native Gemini inline inputs, with a 10 MB per-file limit. Upload or choose up to five explicit attachments, plus the current open file, within a combined 20 MB context limit. Uploads are stored in Documents, attachment selections persist per conversation, and sent messages retain links to their files. Removing an attachment does not delete the document. DOCX text is extracted on the backend with Mammoth; XLSX values are extracted with ExcelJS. Text and code files are included as UTF-8 text. Extracted text is limited to 80,000 characters; spreadsheets also cap sheets, rows and cells. Formatting, charts, embedded media and uncached spreadsheet formula results are not included. Unsupported or unreadable files remain metadata only, with an explicit notice beneath the answer. File support also depends on the selected model. See Google's [document processing guidance](https://ai.google.dev/gemini-api/docs/document-processing).

Workspace context is bounded to 250 recent tasks, 250 calendar entries, 200 active document metadata records and 100 folders per kind. Coverage counts disclose truncation. Canvas credentials, passwords and unrelated users' records are excluded. The backend allows one active request per account and 20 chat requests per ten minutes, aborts timed-out requests, and performs no automatic provider retries. Requests disable response storage; Google API data handling and retention policies still apply.


### Saved conversations

The assistant has a full page with a collapsible history sidebar, a wider reading column, prompt starters and an attachment composer, as well as an expandable floating panel. Switching between the panel and page preserves the current conversation. Saved chats have private direct links at `#/assistant/CHAT_ID`; links require sign-in to the owning account. Search matches chat titles and saved message text, with separate Recent and Archived views and paginated older conversations. Chat controls support automatic titles, renaming, pinning, archiving/restoring, permanent deletion with inline confirmation, message copying and Markdown export. The most recent chat reopens when you return. Context switches and Concise/Balanced/Detailed response preferences are saved per conversation; each new question uses fresh selected workspace/screen/file context rather than storing raw screen captures or file bytes in chat history.

Questions and Markdown answers, timestamps, source links, context summaries and partial-response indicators are stored under the signed-in account. Failed or interrupted questions remain available to retry. Regenerate replaces the latest answer after a new response succeeds; a failed regeneration preserves the existing answer. Use a message's branch action to continue separately, or edit an earlier question in a new branch while preserving the original conversation. Draft text is retained while switching chats within the current session.

All conversation read/write/export data is owner-scoped. Server-side saved messages supply conversation history; the browser cannot inject a different transcript. Generation leases and revision checks prevent overlapping replies or another tab silently overwriting a chat. Saved history is limited to 300 messages per conversation; start a new chat or branch when full. Gemini receives up to 20 recent messages and 40,000 history characters, with individual prior messages shortened to 4,000 characters. Older messages remain viewable in saved history. Long or interrupted requests can be reopened and retried; the backend does not automatically resend questions to Gemini.

## AI connection diagnostics

The assistant includes a connection and diagnostics panel. Refresh settings checks backend configuration without calling Gemini. **Test API connection** sends a short request to Gemini without workspace data, only when clicked, and consumes API tokens. Connection tests are limited to five per minute per account.

Errors distinguish invalid keys, permissions, unavailable models, exhausted or zero project/model quota, daily quota, temporary throttling, rejected context/files, blocked answers, service failures, network errors and timeouts. Google RetryInfo and Retry-After provide countdowns when available. Daily and zero quotas are not presented as temporary overload. Review [Google AI Studio usage](https://aistudio.google.com/usage) and [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) when quota errors occur.

Details include provider/backend HTTP status, Google error status/reason, quota metrics, provider response/request ID where available, app trace ID, timing, model, context sizes and token usage including thinking tokens. The API returns X-Assistant-Trace-Id for app correlation. Provider reasons redact API keys and authorization data. Copy diagnostics excludes conversation/file content and provider message bodies. Diagnostics stay account-scoped in backend process memory and expire or clear on restart. Errors appear inline, without console logging or native popups.

Assistant controls also include code-block copying, a Continue answer action for truncated responses, Jump to latest while reading older messages, and private chat-link copying. The page exposes context and response settings in a collapsible panel. Ctrl/Cmd + Shift + O starts a new chat, Ctrl/Cmd + Shift + B toggles history, and Ctrl/Cmd + Shift + F searches conversations; all are listed on the Shortcuts page. The assistant produces answers and drafts using supplied context; it has no web-browsing, code-execution or workspace-mutation tools.

### Resizing the assistant

Drag any floating assistant edge or corner to resize it, or drag its header to move it around the screen. The dedicated page can be resized using its right edge, bottom edge or bottom-right corner. Separate page and floating layouts are remembered in browser storage across navigation and reloads. Floating sizes and positions adapt to the available screen, including touch keyboards; narrow layouts move history into a drawer and keep controls scrollable. The header offers Fill available screen/Restore and Reset size and position. Double-clicking a resize handle also resets the layout. Focus a resize handle and use arrow keys for 10 px steps, Shift + arrow keys for 40 px steps, or Home to reset. Escape cancels an active drag. Only layout dimensions and position are stored in this browser preference.

### Account Gemini API keys

Account AI settings supports saving/replacing a personal key, viewing only its masked suffix, explicitly checking the saved connection and removing the key with inline confirmation. Saving does not contact Google or validate billing/model access. Connection checks send a short request only when clicked. Existing in-flight requests finish using the key they started with. Personal keys take priority; removing one restores a configured shared server key, or disconnects AI if no fallback exists. Chat history remains available without a working key. Account reset removes the personal key along with workspace data.

Keys are stored as versioned AES-256-GCM ciphertext with a random nonce and account ID as authenticated data. Credential fields are excluded from ordinary user queries and never included in workspace context or API responses. No plaintext key is saved in browser storage; Account only retains a newly entered key until it is saved or the page is left. Account settings and assistant status responses use Cache-Control: no-store. Provider diagnostics redact credentials.

Set a stable, private `AI_KEY_ENCRYPTION_KEY` in the backend environment to use a dedicated encryption secret. If omitted, the backend derives a separate encryption key from the existing `JWT_SECRET` using HKDF and a distinct purpose label, so current installations work without another setup step. Keep the relevant secret stable and backed up: rotating or losing the secret requires users to save their personal API keys again. The encrypted record remembers which secret source it used; adding a dedicated secret does not prevent reading older JWT-derived records. A personal key that cannot be decrypted requires replacement and does not silently fall back to shared billing.

## Customizable workflow workspace

Open **Workspace** in the main navigation or use **Alt + 9**. Workspace Studio provides up to eight named workflow tabs, each containing up to ten movable, resizable windows. Windows can hold up to six tool tabs. Tools include searchable task management with quick creation/status changes, an agenda combining tasks and personal calendar records, the document library, task visualization, Markdown notes, a focus timer, and access to the existing AI assistant. Tasks, calendar records and files use the same account data as the standard pages; opening a file uses the existing editor.

Drag a window header to move it, drag an edge or corner to resize, or double-click a header to maximize/restore. Grid snapping and edge previews can be enabled in settings. Tile and Cascade arrange visible windows. Windows can be minimized to the dock, restored, maximized, or closed without deleting tasks or documents. Tool tabs can be reordered, dragged between windows, or detached into separate windows. Workflow tabs can be renamed, reordered by dragging or arrow controls, and closed. Layout undo/redo restores closed windows and notes within the current session. Existing notes are preserved when undoing a position change.

Settings include grid visibility, snapping, density, canvas height, and new-workflow presets for Daily planning, Research desk and Minimal focus. Presets create another workflow rather than replacing existing tabs. Full-screen workspace mode gives the canvas more room. Smaller screens stack windows for touch use while preserving the desktop arrangement. Export/import supports layout JSON including workflow notes, but does not export tasks, file contents, API keys or credentials. Import and reset require inline confirmation. Notes support up to 12,000 characters each; the complete saved layout is limited to 250 KB. The timer continues while changing workflow tabs; reloading or closing its window resets the timer.

Layouts and notes autosave to the signed-in account with revision checks. A browser draft scoped to the account preserves local edits while offline or when saving fails. Conflicting layouts offer explicit Reload saved / Save this version choices instead of silently overwriting another session. Account reset deletes the saved layout and notes, clears the current browser draft, and advances the server revision to reject stale writes. The workspace and AI assistant remain separate tools: the AI can reference visible workspace text but cannot mutate its layout.

Workspace shortcuts are listed on the Shortcuts page: Alt + N opens the tool picker, Alt + T tiles windows, Alt + F toggles full-screen workspace, and Ctrl/Cmd + Z or Ctrl/Cmd + Shift + Z undo/redo layout changes outside text fields. With a window header or resize handle focused, Alt + arrow keys move or resize it; Shift increases the step. Escape cancels an active drag before dismissing workspace controls.
# OneNote notebook import

Use the regular **Upload** button and select a `.one` section or `.onepkg` notebook. The upload picker automatically opens the OneNote importer and starts reading the file. Review and select pages, then choose **Save & open notes**. The selected upload folder and tags are retained. You can also use **Documents → Import OneNote** and click **Read notebook** after choosing either file type. The resulting PDF is saved in the current folder and opens in the PDF editor for annotation. Imported content is rendered into PDF pages; original OneNote text and ink objects are not directly editable. Keep the original notebook. Review conversion warnings, especially for handwriting, unsupported objects, and password-protected sections. Embedded files, recordings, and videos are omitted.

The backend uses the MIT-licensed [onenote-tool](https://github.com/vanarebane/onenote-tool) Python converter. Install Python 3.10 or newer and run from the repository directory:

```powershell
python -m venv backend/.venv-onenote
backend/.venv-onenote/Scripts/python.exe -m pip install -r backend/requirements-onenote.txt
```

Restart the backend after setup. Windows uses its built-in `expand.exe` to extract notebook packages. Linux/macOS servers also need `cabextract`; create the environment with `python3 -m venv backend/.venv-onenote` and install requirements using `backend/.venv-onenote/bin/python -m pip install -r backend/requirements-onenote.txt`. Optionally set `ONENOTE_PYTHON` to an absolute Python executable path. The scoped environment is ignored by Git and must be installed on each server. OneNote uploads are limited to 10 MB and 200 source pages; .onepkg archives are also limited to 100 MB expanded; select fewer pages if the saved PDF exceeds 10 MB. Large notebooks should be exported from OneNote in smaller packages.


### Preserving OneNote ink and annotated printouts

OneNote imports now default to exporting each source page through **desktop OneNote for Windows** on the backend machine. Install and open OneNote normally under the same Windows account that runs the backend, finish its first-run/sign-in prompts, and unlock any protected sections before importing. The importer opens only temporary uploaded sections and asks OneNote to publish each page as PDF. It then merges all PDF sheets for each selected source page directly, preserving the native export rather than rebuilding its text or relocating handwriting. Imported ink is flattened page content, so it cannot be erased as an individual editor stroke. Add new annotations with the platform editor.

If desktop export fails, the import stops with an actionable error; it does not silently switch to the lossy parser. The explicit **Use compatibility import instead** option retains the older cross-platform conversion, which can omit undecodable ink and rearrange page content. Compatibility SVG ink now receives explicit aspect-ratio dimensions and is rasterized before PDF conversion. For reliable rendering without desktop OneNote on the backend, export the document as PDF in OneNote and upload that PDF directly. Existing incomplete imports must be re-imported from the original file; missing strokes cannot be recovered from an already flattened incomplete PDF.

The desktop export helper uses typed COM string output parameters and an explicit OneNote XML schema. It retries temporary COM busy errors and serializes imports so two requests cannot interrupt the shared OneNote application. Failed exports report the actual HRESULT, operation, and affected page instead of the generic installation message. Exports allow up to three minutes for desktop processing; timeouts identify the last operation. Restart the backend after updating these scripts. No application probes, builds, tests, or browser QA were run for this change.

When OneNote opens a section before its page index is ready, import retries page discovery briefly. If OneNote still returns no page nodes, the importer publishes the whole section directly through OneNote instead of failing at page discovery. Such entries are labeled **Entire section**, show their exported PDF sheet count, and keep every PDF sheet when selected. This fallback uses the native OneNote renderer and does not switch to compatibility conversion. No tests or live OneNote probes were run for this change.

Native page imports request binary page content with OneNote GetPageContent before publishing, rather than relying only on the hierarchy listing. The preview reports ink-object counts when OneNote exposes them (section-level exports show the count as unavailable); a zero count is a diagnostic, not proof that the source contains no handwriting. A **Download original OneNote PDF** action lets users compare the native output before saving. Saving a single selected native export now uploads those exact PDF bytes without a pdf-lib rebuild. Native and compatibility imports receive distinct tags. These changes do not recover edits that were never included in the uploaded OneNote snapshot. No tests, builds, or live OneNote probes were run.

### Undo deleted tasks

Task deletions now keep an account-owned recovery snapshot for seven days. The **Undo deletion** banner restores the latest deletion, including single tasks, bulk selections, cleared inbox tasks, and cleared folder tasks. Undo can be used repeatedly for earlier deletion groups and remains available after reloading the app. Restored tasks keep their IDs, details, deadlines, order, and dependency links; tasks whose original folder has been removed return to Inbox. Existing document/task references work again because task IDs are retained. Recovery only covers deletions performed after this update. Account reset also clears recovery snapshots. Restart the frontend/backend after updating. This uses MongoDB transactions (Atlas or a replica set), as calendar undo and task reordering already do. No tests, builds, linters, live probes, or browser QA were run.

### Editing existing PDF text

Select **Text**, then click an underlined text run on the active page. The editor extracts its text and size and opens a replacement text box; click blank space to add new text. Replacements use the existing annotation save/undo/redo workflow and appear in continuous view and PDF downloads. Clearing replacement text keeps the cover; deleting the replacement object reveals the original. This supports horizontal selectable text, including text on pages with normal PDF page rotation; independently rotated/skewed/vertical text and scans without a text layer are not supported. New replacements detect source font family, size, bold/italic styling, fill color, opacity, character spacing, baseline, and horizontal width scale. Where supported embedded font programs are available, they are loaded locally for preview and reused for PDF export. Non-embedded custom fonts show an approximation warning; unsupported replacement characters stop export instead of becoming question marks. Toolbar controls still allow deliberate changes to size/color. The original text is visually covered with white, not removed from the PDF content stream; this feature is not redaction and cannot reproduce arbitrary colored or image backgrounds. No tests, builds, linters, or browser QA were run.

PDF text style matching uses the original PDF font resources and locally bundled @pdf-lib/fontkit. Clicking text and leaving it unchanged now removes the temporary replacement on commit, preserving the original PDF rendering. Restart the frontend after updating; other installations need `npm install` in frontend. Custom font subsets may not include new characters; fonts without reusable programs may require an approximation, which the editor reports. Existing replacements created before style detection retain their saved styling; delete the old replacement to reveal the source and click it again to detect its style. No tests, builds, linters, or browser QA were run.

### AI edits in the document editor

Open a PDF or plain-text notes document, open **AI assistant**, keep **Open file** context and **Allow edits to the open document** enabled, then ask for a specific change. The assistant can replace supplied text runs on the current PDF page, change existing text annotations, add new text annotations, and navigate PDF pages. Source-text replacements use the same detected font/style workflow and visual covers as manual editing. A PDF action batch is one undo step and autosaves as annotations. For plain-text notes, AI can replace the editor text; use **Save** to persist and **Undo AI edit** to revert. Other formats (including DOCX and spreadsheets) retain their existing read-only assistant context; attached files that are not open are not editable through this bridge.

Only the currently mounted editor exposes capabilities. Requests include bounded live text (including unsaved text), actions are validated by the backend against supplied IDs, and the browser rejects stale replies if the document/page changed. Reopening chat history or regenerating an answer does not replay edits. Application status appears in the chat after execution; assistant prose describes prepared changes. Existing scans still require OCR, text replacements remain visual overlays rather than redaction, and PDF font limitations still apply. Restart frontend and backend after updating. No tests, builds, linters, API probes, or browser QA were run.

### Account AI access controls

Open **Account → AI access** to control the global AI switch, profile information, tasks/folders, calendar entries, library metadata, resumes, notes, other files, visible screen text, prior chat messages, live editor reading, document edits, AI document generation, and AI handwriting/math recognition. Changes save to the account and override per-chat sharing switches. Existing accounts keep their previous access until a switch is changed. Files are classified by their resume/notes tags, matching their platform sections.

The backend filters structured context and document categories, blocks disabled AI endpoints, and prevents editor write actions without write permission. Reading the live editor can stay enabled while editing is disabled. Screen capture is suppressed when a protected category or live editor reading is disabled, because visible text can contain multiple sections. Previous chat messages are not resent while data restrictions are active, so old replies cannot bypass the new rules. Recognition has its own explicit permission for the selected image crop. Previously saved chats are not erased, in-flight or already-sent provider data cannot be recalled, and user-entered prompt text is still sent intentionally. Restart frontend and backend. No tests, builds, linters, live API probes, or browser QA were run.

Continuous PDF view now automatically selects the page most visible in the scroll viewport, and selects another page on mouse/pen hover or keyboard focus. The tools and page indicator follow that page without needing the page selection button. Switching uses a visibility threshold to avoid flickering at page boundaries, preserves the current scroll position and zoom, and pauses during drawing, erasing, region selection, dragging, active text editing, and finger gestures. Completed gestures or text-field focus changes trigger another visibility check. Manual page selection and page navigation remain available. No tests, builds, linters, or browser QA were run.

Continuous-page switching now keeps each page canvas mounted while its annotation layer activates. Each page retains its own dimensions instead of inheriting the currently edited page's changing size. Automatic selection waits for scrolling to settle, uses a stronger visibility threshold, and no longer competes with hover-driven selection or a stack resize observer. The shared continuous document reports its page count directly and late page callbacks cannot overwrite the active page's geometry. Input/gesture guards remain in place. No tests, builds, linters, or browser QA were run, following repository instructions.

Continuous-view activation now leaves the passive annotations visible until the selected page's editable overlay has matching page geometry. The active overlay no longer nests another dark-mode page filter inside the already filtered continuous page: the document and its annotations receive one shared inversion. This addresses existing edits disappearing during activation or becoming invisible in dark mode. The change does not modify stored annotations. No tests, builds, linters, or browser QA were run.

### Automatic straight pen lines

Long pen strokes that closely follow a straight path now snap to a straight line when released. A **Keep ✓ / Undo** prompt lets you keep the result or restore the exact original freehand points and pressure. The detector rejects short strokes, noticeable bends, and backtracking, and does not change highlighter strokes. Ctrl+Z immediately after snapping first restores the freehand stroke; another Undo removes it. Snapped lines use the normal annotation saving and PDF export paths. Disable detection in **More tools → Detect long straight pen lines**; this preference is remembered on this browser. No tests, builds, linters, or browser QA were run.

### Annotation rendering performance

PDF ink now renders into bounded-resolution canvas layers instead of creating an SVG element for each pressure segment. Completed strokes append to the page canvas when possible; undo/erasing redraw only that page's ink. Live drawing paints directly to a separate canvas, with incremental pressure-stroke segments, rather than causing a full React editor update per animation frame. Continuous and reference views use the same ink renderer. Stored points, pressure data, undo history, and vector PDF exports remain available; display resolution is capped at high zoom to bound backing-store memory.

Autosave waits for drawing/erasing/dragging to pause, skips outdated queued snapshots, and serializes annotation JSON in a worker where supported. Erasing skips distant strokes using cached bounds, page annotation counts use an index, and text commits compare immutable item references instead of stringifying all strokes. These changes reduce work that grows with accumulated ink; no guarantee of zero latency is possible for every device, document, or annotation count. No tests, builds, linters, profiling, or browser QA were run, following repository instructions.

### Touch PDF navigation

In the PDF editor, use **Scroll** mode to pan with one finger. Two fingers pan and pinch to zoom in either Scroll or Draw mode, including fullscreen and continuous view. Pinch zoom stays anchored to the content between the fingers, is limited to 25–400%, and uses a composited display preview during the gesture before committing the final PDF rendering scale. One remaining finger continues panning after a pinch; normal drawing resumes with a new touch. Pen ownership suppresses touch navigation, a second finger cancels a tentative finger stroke before starting navigation, and a third contact freezes/cancels the pinch rather than adding ink. Touch handling is scoped to the PDF viewport so browser navigation outside it remains unaffected. No tests, builds, linters, device checks, or browser QA were run.

### Touch scrolling momentum

Finger panning now continues after release using recent gesture velocity, with exponential friction integrated by elapsed frame time. Fast swipes coast farther, slow drags stop sooner, and holding still before release suppresses a fling. Speeds and coast duration are bounded, and each axis stops when it reaches a scroll boundary. A new pointer contact, pen input, wheel input, keyboard input, mode/page change, blur, or hidden tab cancels momentum. Two-finger translation can carry momentum through a quick release; significant pinch zoom and canceled gestures do not launch a fling. Native wheel/trackpad scrolling retains its own behavior rather than receiving a second inertia effect. Reduced-motion preferences disable the added glide. No tests, builds, linters, device checks, or browser QA were run, per repository instructions.

### Connected accounts (GitHub and LinkedIn)

**Account → Connected accounts** provides Connect, Reconnect, Disconnect, and saved profile details for GitHub and LinkedIn. Connections belong to the signed-in Assignment Tracker user. This is account linking, not a replacement for Assignment Tracker login. GitHub requests `read:user`; LinkedIn requests `openid profile`. Only the provider ID, name, GitHub username/profile URL, and connection date are stored. LinkedIn's basic sign-in product does not return a public vanity profile URL, so the app does not invent one. Provider access tokens are used to retrieve the profile and then discarded. Disconnect removes the site's link and invalidates pending attempts; revoke the authorization grant in the provider's account settings if desired.

Setup on the backend (see `backend/.env.example`):

1. Register a [GitHub OAuth app](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app). For local development set its callback to `http://localhost:5000/api/account/connections/github/callback`. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `backend/.env`.
2. Create a [LinkedIn developer app](https://www.linkedin.com/developers/apps) and enable **Sign In with LinkedIn using OpenID Connect** in Products. Add `http://localhost:5000/api/account/connections/linkedin/callback` as an authorized redirect URL. Set `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` in `backend/.env`. LinkedIn may require the app/product approval described in its [setup guide](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2).
3. Set `PUBLIC_APP_URL=http://localhost:3000` and `PUBLIC_API_URL=http://localhost:5000` for this repository's Vite development setup. Restart the backend and frontend. Buttons show **Server setup required** until provider credentials are configured.
4. In production use HTTPS and proxy `/api` through the frontend's public hostname. Set both public URLs to that public origin, and register the corresponding `https://your-site.example/api/account/connections/PROVIDER/callback` URLs exactly with each provider. Credentials remain server-only; never place client secrets in Vite environment variables. Node.js 18+ is required for the backend's fetch API.

Authorization attempts use expiring, single-use server state tied to an HTTP-only SameSite browser cookie; GitHub also uses PKCE. Connection versions prevent an old callback from reconnecting an account after disconnect. All provider network requests have timeouts, use fixed HTTPS endpoints, and do not forward bearer tokens through redirects. These connections do not grant the AI assistant additional context automatically. No automated tests, builds, linters, provider API probes, OAuth sign-ins, or browser QA were run, following repository instructions.


### Graph equations in the PDF editor

Open **More tools → Graph selected region**, then drag a box around one complete equation. The graph panel also accepts typed functions such as `y = x^2 - 3x + 2`, `f(x) = sin(x)`, or `sqrt(x)`. Adjust the X/Y limits, insert the plot as a movable image annotation, or download it as PNG. Inserted plots use the editor’s normal undo and save/export flows.

Printed expressions are read locally. Auto recognition can fall back to Gemini for handwritten or complex typeset expressions; this requires the existing Gemini key and AI recognition permission in Account. Text only mode keeps recognition local. Review the recognized equation before using it. Only explicit functions of x are supported; implicit relations, multiple equations, and other variables must be rewritten first. Trigonometry uses radians; log is base 10 and ln is natural logarithm. Plots use finite sampling, so very narrow features may require smaller axis limits. Restart the backend for the new graph recognition purpose.


### PDF font recognition

Existing-text editing recognizes an expanded local catalog of Office, Google Fonts, publishing, LaTeX, serif, sans-serif, monospace, script and display families. It normalizes PDF subset tags and common PostScript aliases, detects weights from thin through black, and preserves italic/oblique styling. Embedded usable font programs remain the first choice; descriptor font names are also used to locate them. Fallback export classifies families consistently as serif, sans-serif or monospace.

Catalog recognition does not install fonts or download them from Google. An unembedded font must be installed on the device for its named browser preview to be available; otherwise the listed fallback is used. PDF export continues to reuse embedded programs where possible and otherwise uses standard PDF substitutes. Recognizing a name does not guarantee an exact font match, and scanned text still requires OCR. Font catalog references: https://github.com/google/fonts and https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/pdfreference1.6.pdf .


PDF text editing also calibrates text width automatically against other runs using the exact same PDF font resource on that page. It pools up to 32 longer samples, uses robust median estimates, and skips inconsistent or insufficient evidence. This helps short edited labels and individual letters inherit consistent proportions without borrowing fonts from nearby headings. Per-run size, spacing, color and stretch remain separate. This calibration is local and does not identify fonts visually in scanned images; unavailable font files still require a substitute.


### Saved jobs and resume tools

Open **Jobs** from navigation or **Saved jobs & link import** on Resumes. Paste a direct public HTTPS job URL and choose **Get job details**. The importer tries documented Greenhouse/Lever public posting APIs for supported direct links, structured JobPosting data, embedded JSON application state, microdata, and readable job descriptions from HTML. Generic extraction uses page titles and explicit labels/headings; missing fields remain blank. Review all details before saving.

For login walls, browser-only pages or bot protection, expand **Import from copied job text**, paste the title and full description, and choose **Extract from pasted text**. This fills the draft automatically without bypassing access controls. No AI key or connected LinkedIn account is needed. Automatic imports cannot guarantee access to every website.

Saved jobs are account-owned and support full-detail viewing, original-link access and deletion. Workspace reset removes saved jobs. Public HTTPS fetching pins DNS to public IPv4 addresses, revalidates redirects, handles gzip/deflate/Brotli, and bounds responses to 6 MB. Each fetch has a 20-second request deadline and up to five URL hops; API fallback can make a second fetch. Eight import attempts per user per minute are allowed. Pasted text is limited to 60,000 characters and saved descriptions to 30,000.

Run `npm install` in backend after pulling the dependency updates, then restart the backend and refresh the site. The HTML parser is pinned to Cheerio 1.0.0 for Node 18.17+ compatibility; no browser automation runtime is required.

References: https://schema.org/JobPosting , https://docs.greenhouse.io/job-board.html , https://github.com/lever/postings-api , https://cheerio.js.org/docs/basics/loading/ .


### Cover letters

Open **Cover letters** in navigation or the career-document tabs on Resumes and Jobs. Upload PDF or DOCX files up to 10 MB, give each version a name, then open or download it. Files are saved to your account using the existing document storage with the `cover-letter` tag. They also appear in Documents for rename, organization and removal. AI access follows the Account setting for **Resumes and cover letters**.


### Tailor a cover letter using existing letters

In Cover letters, expand **Create a tailored cover letter from your existing letters**. Choose a PDF or Word cover letter as the layout/primary voice template, select up to five additional letters or resumes as voice/factual references, and select a saved job or paste role details. Generation uses the existing Gemini key and requires Account AI permissions for generation and Resumes and cover letters. Only explicitly selected documents and job details are supplied; no background workspace context is included.

The generator proposes replacements for existing text regions only, asks for the original voice and evidence-based applicant facts, and returns source notes/missing-information warnings separately from the letter. Review and edit the proposed replacements, keep original regions where needed, confirm your factual review, then save a separate copy and open it in the editor. AI factual fidelity and voice matching require user review; the model cannot certify that it invented nothing. Drafts expire after one hour and are lost on backend restart. Generation is limited to five requests per five minutes per user, with one active request and a 90-second deadline.

Word output modifies existing text runs in document.xml while preserving paragraph/run properties, headers, footers, margins, and other package files. Content changes may still affect line wrapping/page breaks. PDF templates must have an extractable horizontal text layer, up to four pages/600 regions; replacements preserve original positions, font size, and text styling. Over-wide replacement lines must be shortened before save rather than shrinking the font. PDF source text is covered visually, not redacted; review/export through the PDF editor for an annotated final copy. Download from Cover letters also burns saved PDF edits into the downloaded copy. Templates with editor annotations must first be exported and reuploaded so the chosen template reflects visible content. If a changed PDF region needs an unavailable font program, saving is blocked instead of silently substituting it; use a Word template or embedded-font PDF. Scanned templates need a text-based PDF or Word version.

The saved generated document stays in Cover letters and Documents. Restart the backend and refresh the frontend after pulling this feature; run backend npm install for the declared JSZip dependency if needed.

Cover-letter tailoring prioritizes verbatim reuse of the selected letters’ sentences, clauses, transitions, openings and closings before new prose, with minimal role/company and supported factual substitutions. Resumes and job descriptions supply facts rather than phrasing. The review screen shows AI-proposed phrase reuse only after a local substring check against the template/selected Word letter text and the current assembled draft (normalizing case/whitespace). Additional PDF references remain AI-readable but are not covered by these deterministic phrase checks. No verified reuse triggers a review warning; phrase reuse is prioritized rather than guaranteed for every word, and user review remains necessary.


### Handshake job imports

Jobs recognizes app and school-subdomain Handshake links using `/jobs/ID`, `/stu/jobs/ID`, and `/emp/jobs/ID`. It tries the supplied public page and, when different, the standard app job URL; existing structured-data and HTML extraction handle exposed content. Login redirects, sign-in-only descriptions and unavailable-job shells do not become saved job descriptions. The importer does not access your signed-in browser session, credentials or private Handshake endpoints.

If the job is not publicly readable, the Jobs page automatically opens the copied-text panel and provides an Open posting in Handshake link. While signed in to Handshake, copy the job title and full description into that panel and choose Extract from pasted text. Handshake-specific cleanup recognizes navigation lines, explicit employer/location/pay/job-type labels, pay rates and application-deadline headings. Review inferred fields before saving. No Handshake API key is required. Restart the backend and refresh after updating.

Handshake documents that share links can require an eligible signed-in student account and that logged-out users can see a job-unavailable screen for active jobs: https://support.joinhandshake.com/hc/en-us/articles/30881026715415-Share-a-Job-Posting-URL and https://support.joinhandshake.com/hc/en-us/articles/227843887-Searching-for-Jobs-in-Handshake-Career-Services .


### Import jobs from screenshots and PDFs without AI

On Jobs, expand **Import from a screenshot, image or PDF**, choose/drop one PNG, JPEG, WebP or PDF, and click **Extract locally · no AI**. PDF.js reads usable text layers directly. Only pages without sufficient text are rendered for local English Tesseract OCR, with resolution limits, grayscale/contrast adjustment and dark-background inversion. Images always use local OCR. Progress indicates the current page/OCR stage, and Cancel import stops processing. Review the populated job draft before saving.

The image/PDF stays in the browser. Only extracted text (up to 60,000 characters) and the optional entered job URL are sent to the authenticated rule-based parser. No Gemini call, AI key, recognition permission or generative tokens are used. The legacy AI file endpoint returns an update-required response and never calls Gemini. First-time OCR downloads its worker/engine and English language assets; the browser can cache language data. This is local recognition after asset downloads, not a guaranteed fully offline installation. Scanned/OCR-heavy PDFs can still take time depending on the device.

The parser recognizes explicit title/employer/location/job-type/pay/date labels, heading-delimited requirements/responsibilities/benefits, obvious pay-rate lines, and remote/hybrid labels. Handshake copied-text cleanup also applies when a Handshake URL is entered. Missing fields are left blank; unlabeled layouts, OCR errors, multiple-job files and complex columns require review and correction. PDF/image limits remain 10 MB, PDFs 1–12 pages, OCR canvases up to approximately 8 megapixels. Low OCR confidence produces review warnings. English OCR is currently supported.

Dependencies were added to frontend/package.json and the lockfile. Run frontend npm install after pulling updates, restart the Vite dev server and backend, then refresh the page. No native OCR installation is required. References: https://github.com/naptha/tesseract.js/blob/master/docs/api.md and the existing PDF.js/react-pdf integration.


Local job-field extraction uses conservative matching with source evidence. Explicit field labels take priority; contradictory high-confidence values leave the field blank. The first line is no longer assumed to be the job title. Unlabeled titles require a single short role-like header candidate; employer names are not guessed from arbitrary nearby lines. Section extraction stops at other sections, metadata and known navigation/application headings. Salary inference excludes obvious bonus/benefit lines and preserves reported currency/units. Uncertain matches and missing values are shown for review.

PDF text reading separates large gaps and detects repeated column gutters rather than joining distant columns. OCR background detection samples the content instead of relying on browser-frame corners. The recognized source text remains available under **Review recognized text or import copied job text**. Correct OCR errors there and extract again, or highlight an exact value and use **Assign highlighted text to** to fill a field directly. **Why these fields were filled** shows source snippets and matched/suggested/conflicting/manual status. These rules reduce guesses but cannot guarantee every layout; review remains necessary and no AI is used.


Job imports now preserve line geometry and confidence from PDF.js/Tesseract instead of relying exclusively on flattened text. OCR requests block/paragraph/line output, uses automatic small-angle deskew, and retries a weak result once with sparse-text segmentation, choosing the stronger result. The backend validates bounded layout records against the supplied source text. Standalone labels can match nearby same-row/below values in the same page region; title/employer suggestions use heading size and spatial proximity and remain marked as suggestions. Low-confidence numeric fields are withheld. Metadata after Handshake's At a glance/Job details header is included, and job-type/pay-rate/location lines can populate fields without colon labels. Description uses the introductory body rather than always copying the full source; recognized requirements, responsibilities and benefits populate their dedicated fields. Full source remains in the review box. Rules can still be uncertain and do not replace checking the original posting.

Research references for the layout/OCR changes: https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html and https://github.com/naptha/tesseract.js/blob/master/src/index.d.ts .

Header inference now supplies reviewable title/company/location suggestions for unlabeled postings instead of requiring colon labels or a single untied OCR candidate. It handles wrapped role headings, nearby employer text with punctuation/digits, and city locations with full US state names, state codes, selected country names and remote/hybrid qualifiers. These are marked Suggested from document header; explicit contradictory matches remain blank. Recognized header values are excluded from introductory Description text. Source positions and text remain available to inspect.


Image/PDF field parsing and copied-text re-extraction now run inside the browser, using the same rule modules mirrored under frontend/src/lib/jobParsing. This avoids dependence on a stale backend process for file extraction. No file/text is sent to a parser endpoint during these imports; Save job still persists the reviewed fields to the authenticated backend. OCR source text is assembled from detected lines when available instead of potentially collapsed paragraph output. A Local parser v3 status reports character count, positioned-line count and populated-field count so recognition and field-matching failures can be distinguished. Source review opens after file extraction. Header matching also handles joined CamelCase role words and falls back to a prominent text heading when no known role word is available, marking inferred values as suggestions. Refresh/restart the frontend to use this version; URL imports still use backend extraction.


Job file imports now include a remembered Extraction method toggle: Local OCR (default on first use, no AI tokens) or Gemini AI (explicitly sends the selected image/PDF to Gemini using the account key and recognition permission). Both support cancellation and produce an editable review draft; switching the toggle never starts a request or creates an automatic AI fallback. AI mode accepts one validated PNG/JPEG/WebP/PDF up to 10 MB, PDFs up to 12 pages, with a 75-second deadline and five requests per five minutes per user. Local mode continues to parse entirely in the browser. Restart the backend and refresh the frontend to enable AI mode. This supersedes the earlier note about disabling the legacy AI file endpoint.


### Cover-letter generation latency

Cover-letter tailoring also supports the company website research workflow used by resumes, enabled by default. Enter or confirm the employer's official website, review the public source pages supplied to AI, and retain your previous letters' phrasing and voice. Website facts may inform relevance but cannot establish applicant qualifications or personal enthusiasm. Unavailable research is disclosed in draft warnings. The standalone Clean up a letter mode does not fetch company pages or require a website. Restart the backend and refresh the frontend after updating.

Generation now sends the complete template once as text slots (no duplicate template attachment), extracts/caches readable PDF reference text in the browser, and sends Word references as text. Only references without readable text fall back to PDF vision, limited to two scanned references per request. The prompt is consolidated around factual accuracy, phrase reuse and unchanged formatting; output is restricted to changed slots and brief notes. Readable references share a 32,000-character budget, and job fields are bounded; any excerpts are disclosed in draft warnings. Phrase checks also work against readable PDF reference text.

Known Gemini 3/4 models use low thinking effort and Gemini 2.5 Pro/Flash use a 1,024-token thinking budget. Unknown model families retain defaults. Output budget is sized to the template rather than always requesting 12,000 tokens. The request deadline is 120 seconds as a safety ceiling, not an expected duration; there is no automatic repeated generation or silent omission of selected sources. Optional COVER_LETTER_MODEL overrides only this feature; empty uses GEMINI_MODEL. Frontend generation status distinguishes reading the template, preparing references and adapting wording. Actual model latency and outages remain outside the application's control. Restart backend and refresh frontend after updating.

Thinking configuration reference: https://ai.google.dev/gemini-api/docs/generate-content/thinking .

### Global platform search

Use the navigation Search control or Ctrl/Cmd+K on any signed-in page, including inside document editors and fullscreen PDF mode. Tab retains normal focus navigation. The former command box is still available on Ctrl/Cmd+Shift+K. Search includes platform pages/features, shortcut descriptions, tasks and their descriptions/links, nested folder paths, documents/tags/text annotations, saved calendar events and sports/category details, saved job fields, archived and active assistant conversation text, and the public TXST events currently available to the account. Results are grouped and paginated, with direct navigation to the matching record. Trashed documents are opt-in and open selected in Trash. Job matches outside the default saved-job list are loaded individually. Editor navigation uses the existing save/discard safeguards.

Readable PDF, DOCX, XLSX and UTF-8 text/code files are indexed locally on the backend without AI. PDF extraction respects source-text replacements and includes saved text annotations, embedded comments and form text. Initial indexing runs in bounded worker threads (two workers, 256 MB heap and 30 seconds per file); results update while it runs. Up to two million characters per file are indexed. Failures, empty text and unsupported formats are disclosed, and Reindex file contents retries extraction. Search checks current file versions rather than using stale text. Scanned/outlined images, handwriting, audio/video and unsaved editor text require OCR/transcription or saving first; account credential fields are excluded. Search inputs accept 2–160 characters and up to 12 terms. Index records are scoped to the authenticated account and removed on account reset.

Restart the backend after installing updated backend dependencies (`npm install` in backend on another checkout), then refresh the frontend. No search engine service or API key is needed.

### Home dashboard

Navigation uses a compact primary bar for Home, Workspace, Tasks, Calendar and Documents. Career groups Resumes, Cover letters and Saved jobs; Tools groups the assistant, visualization, Canvas and shortcuts. Account settings and Sign out are in the profile menu. Smaller screens use an expandable grouped navigation panel instead of wrapping every link into multiple header rows. Dropdowns support arrow-key focus, Escape, outside-click dismissal and ordinary Tab navigation. Existing hash routes and platform shortcuts are retained. Refresh the frontend to load the navigation update.

The default signed-in landing page is Home (`#/home`); existing deep links still open their requested pages. The brand link and Home navigation item return to the dashboard. Home shows real open-task and deadline counts, a task focus list, overall completion, a seven-day agenda, recent non-trashed documents, career tools and quick actions. Tasks and documents open their existing editors; saved calendar entries open the matching event, and public TXST events link to their event pages. Dates and greetings follow the account time zone. Calendar visibility preferences are respected. Empty states, loading states and schedule errors are displayed without inventing activity. Refresh reloads saved tasks, documents and appointments. Refresh the frontend to load this page; no new dependencies or backend setup are required.

### Nested document and task folders

Task and document folders support up to 12 levels of nesting. Existing folders remain at the top level. Select a folder and use **New subfolder**, or choose a parent in the new-folder dialog. The folder-path controls also let you move an existing folder, including its descendants, to another parent or back to the top level. Document sidebars show indentation; task tabs and destination choices display folder paths. Breadcrumb buttons navigate back through the hierarchy. Folder views contain their directly assigned items; select a child folder to view its items.

Removing a folder preserves its directly assigned tasks/documents and its child folders, moving them to its parent (or Inbox/Unfiled and the top level). Parent changes validate ownership, prevent cycles and enforce depth limits. Hierarchy writes are serialized in MongoDB transactions, using the same transaction-capable deployment required by calendar history. Restart the backend and refresh the frontend after updating.

### Resume tailoring workflow

Company website research is enabled by default in resume tailoring. Confirm or enter the employer’s official public website; a saved posting’s origin is suggested only when it is not a recognized job board/application portal. Handshake and similar postings need an explicit company URL. You can turn research off to use only the role and resumes. The backend reads the supplied page and up to two relevant same-site About, Products, Solutions, Careers or Values pages, with public-address validation, redirect checks, bounded responses and timeouts. It sends no resume data, credentials or session cookies to company sites. Public excerpts (up to 3,500 characters per page) are cached for 30 minutes and sent to Gemini as employer context only. Sources and excerpts appear in draft review, separate from the resume itself. Company technologies and achievements must never become unsupported applicant claims. Blocked or unreadable websites produce an explicit warning and role/resume-only tailoring. Restart the backend and refresh the frontend after updating; no additional dependency or search API key is needed.

Resumes → “Tailor a resume using your previous resumes” uses the same template/review/save workflow as cover letters. Choose a saved PDF or DOCX resume as the layout, a saved job or pasted job description, and optionally up to five previous resumes. The dedicated resume prompt prioritizes relevant, source-supported bullets and vocabulary while preserving identity, dates, official past titles, qualifications and template structure. AI source explanations and unsupported requirements remain visible for human review; phrase-reuse notes are checked against supplied readable text, not independent factual verification.

Review the editable draft and confirm it before saving a separately tagged resume and opening the document editor. Word packages retain their original styles; text changes may alter wrapping. PDFs retain detected typography and fixed positions, with compatible-line reflow that preserves bullet boundaries; text that cannot fit requires shortening or a Word template. Scanned templates require a text-based version. Resume PDF downloads include saved editor annotations. PDF templates with saved annotations can be reused directly: covered original text is excluded, current text annotations supply editable regions, and saving preserves existing ink, highlights, images and text edits. Changes to an existing text annotation update it in place in the separate copy rather than layering duplicate text. Handwriting and images are retained without being interpreted as applicant facts. Template-version checks reject stale input if the saved file changes while generating.

Uses the existing Gemini key and Account → AI access permissions for generation and resumes. Optional RESUME_MODEL overrides the resume model; otherwise GEMINI_MODEL is used. Requests use compact context, a two-minute deadline, and five generations per five minutes. Resume drafts have separate storage, expire after one hour, survive backend restarts, and are removed by account reset. Restart the backend and refresh the frontend after updating; no additional dependencies are required.


### Typed notes writing studio

Choose **Documents → New notes** for a blank page or a lecture, Cornell study, meeting, project or journal template. Existing typed notes and Markdown files open in the writing studio. The toolbar inserts Markdown for headings, emphasis, lists, checklists, quotes, links, tables and math; **Write**, **Split** and **Read** switch between editing and formatted views. The outline jumps to headings, Find supports literal case-sensitive replacement, and the footer shows word counts, reading time and checklist progress.

Use Ctrl/Cmd+B or I for emphasis, Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z to redo, and Ctrl/Cmd+F to find within the note. Enter continues lists; Shift+Enter inserts a plain newline. Tab inserts two spaces and Shift+Tab leaves the writing field. Focus hides the surrounding interface; Escape exits Find or Focus. Writing font, size and preferred view are remembered locally; they are display preferences, not PDF export styling.

Notes remain editable Markdown (new notes use `.md`); existing note files retain their filenames. Save remains available in Focus, optional Autosave saves after a short writing pause, and local session drafts continue to recover edits. Autosave failures leave the note unsaved and display an error; use Save to retry. Export PDF opens the existing local converter with the current text, including unsaved edits, for a separate downloadable PDF with its own export preview. It does not replace the editable note. No new dependencies or backend changes are required; refresh the frontend.


### Choosing where downloads are saved

All platform download/export actions share a save flow: document library files and originals, edited PDFs/images, resumes, cover letters, notes, Markdown PDFs, graph PNGs, OneNote export previews, assistant chats and workspace JSON exports. On a supported browser in a secure context (HTTPS or localhost), Download opens the native Save As picker so you can choose the folder and filename. The browser can remember the last location across these exports. After a long conversion or fetch, a **Save your download → Choose location** dialog renews the user interaction required by the browser.

Cancelling does not download a second copy. Failed file writes keep the prepared file in the save dialog so you can retry another location; browser download is an explicit alternative. The dialog also works inside fullscreen editors. When the browser does not provide the native picker, enable **Ask where to save each file before downloading** in its Downloads settings and use **Browser download**. Websites cannot force an arbitrary save path in those browsers. No new dependencies or backend setup; refresh the frontend.


### Creating folders during upload

In **Upload document**, use **Save in folder → New folder**. Enter a name, choose a parent (or Top level), then select **Create & select folder**. The new folder is added to the library and selected as the upload destination without clearing the chosen file, name or tags. Folder choices display their full nested paths. Finish creating the folder or cancel its inline form before uploading. The same destination controls are available when a OneNote upload opens the importer. Created folders remain in the library if the upload is cancelled or fails, and can be reused on retry. Refresh the frontend; no new dependencies or backend changes are needed.


### Folder descriptions

Task and document folders, including subfolders, support optional descriptions of up to 2,000 characters. Add a description in the folder creation form or select an existing folder and use **Add description / Edit description** below its breadcrumb path. Save an empty description to remove it. The upload dialog’s inline folder creator also includes the description field. Descriptions save to the account-owned folder record and are searchable through global search. Existing folders default to an empty description. Restart the backend and refresh the frontend; no dependency changes are required.


### Images and files in folder descriptions

Open a task or document folder and use **Files & media** beneath its description. Upload multiple files, drag and drop, paste clipboard images while the attachment area is focused, or attach existing Documents. Each folder supports 50 attachments, up to 10 MB per uploaded file. Image, audio and video previews load on demand; other files open in the existing document editor or download through the platform’s save-location chooser.

Uploads create the library document and its folder attachment in one MongoDB transaction, with ownership checks. Document-folder uploads are stored in that folder; task-folder uploads are stored in Unfiled. Removing an attachment only unlinks it from the description; files remain in Documents. Deleting a folder preserves the library files. Files in Trash or permanently removed display as unavailable links that can be unlinked. Existing folder descriptions and folder hierarchy are retained. Restart the backend and refresh the frontend; no new dependencies are required.

## Study phone companion

Use **Phone** in the PDF editor (including its fullscreen toolbar), Document editor, Note Studio or workflow scratchpad, or press **Alt + P**. The simulated phone opens beside your current work with a home screen, reference website viewer, scratchpad, local calculator, focus timer and a read-only active task list. Drag the top handle to move it; drag the bottom-right grip to resize. The grip also accepts arrow keys (Shift for larger steps). Minimize keeps the current app and timer running. Escape closes the phone when focused, and its reset control restores a usable size and position. Native document fullscreen keeps the companion inside the fullscreen surface.

The scratchpad and phone dimensions are saved only in this browser, scoped to the signed-in account; they are cleared by account reset. They are separate from document notes and do not change or save the current PDF. Copy scratchpad transfers text through the clipboard when selected. Timers continue while switching phone apps or minimizing and reset on reload. Website navigation happens only after submitting an address. Embedded sites run in a sandbox; sites that block framing or need cookies may require the provided Open website in a browser tab link. The phone is a simulated study tool, not a connected physical device.

Study Phone can be enabled or disabled in **Account → Study Phone**. The account preference controls all editor Phone buttons and the Alt + P shortcut. Disabling closes the companion and stops its timer while preserving the device scratchpad. Existing accounts keep the feature enabled until they change the toggle.

Reference navigation now defaults to a regular browser tab: enter a URL or a search phrase, then choose Open. Search phrases use Google Search. An explicit Open reference link remains available if the browser does not open the requested tab, and recent references remain accessible for the session. Optional embedded phone mode is provided for compatible sites, with reload and navigation-state feedback. Framing restrictions set by Google and other websites cannot be bypassed by this web app; a frame load event does not prove the remote page rendered successfully. No requests are proxied through the application server.

The Reference app now defaults to **Phone reader**, which renders text and page links inside the simulated phone rather than an iframe. Its authenticated backend fetcher accepts only public HTTP(S) addresses, pins DNS results, checks each redirect, limits response sizes/time/rate, and returns extracted text blocks rather than executable HTML. Reader links continue inside the phone. It does not send user cookies or API keys to reference sites and does not bypass sign-in, website blocking or JavaScript requirements. Interactive sites and Google sign-in still require the full-browser option. Restart the backend after installing the updated backend dependencies to enable this route.
