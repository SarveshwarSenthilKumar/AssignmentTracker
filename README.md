# 📝 Todo App

A modern, full-stack todo application with a beautiful UI and cloud database.

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

### Navigation and keyboard shortcuts

The primary pages are `/#/tasks`, `/#/documents`, `/#/visualization`, `/#/canvas`, `/#/account`, and `/#/shortcuts`. Hash routes support direct links, reloads, and browser Back/Forward without server routing changes. The navigation is neutral and shows the current page.

The searchable Shortcuts page is generated from the same registry used by the keyboard handlers. Alt+1 through Alt+5 switch pages; Ctrl/Cmd+K opens commands; `?` opens the reference. Context-specific shortcuts cover document management, task editing, calendar import, and document/visual editing. Text-entry controls retain typing behavior, checkboxes do not block document action shortcuts, and Tab/Shift+Tab use normal focus navigation. Destructive task deletion uses inline confirmation; Escape cancels that confirmation. Editor navigation does not discard unsaved work.

### Task visualization

Open Visualization or press Alt+6 to explore all tasks in an interactive network, grouped by folder or status. Connections represent actual group membership and associated documents. Search, folder/status filters, overdue filtering, pan, zoom, a minimap, and a task index help navigate dense maps. Select a task to inspect its details, open linked documents, edit it, or advance its status. Dragged positions are temporary view adjustments.

Completion, folder workload, and a 14-day deadline chart update from the same task records. Deadline days use America/Chicago time. Visualization shortcuts include `/` for search, `0` to fit, `=`/`-` to zoom, `R` to reset layout, and Escape to clear filters; they also appear on the Shortcuts page.

### Task files and media

Task details and expanded task editors include a Files & media panel. Upload multiple files or drop them onto the panel, choose a document folder, or search and link existing library files. Files are stored once in Documents and may be associated with several tasks. Library rows link back to those tasks, and the Visualization map includes their document connections.

While editing a task, use Insert in description to place a document reference at the cursor, then save the task. References display the current document name and open the existing document editor. Images, audio, and video have optional authenticated previews in the attachment panel; other formats open with the library's existing editing/download support. Each uploaded file is limited to 10 MB. Attachment operations save immediately, while description changes require Save. Unlinking preserves the library file and existing inline references; documents in Trash show unavailable references until restored.

### Clean account reset

Account → Clean account reset permanently clears tasks, document files and backups (including Trash), task/document folders, and Canvas credentials/sync history. It preserves the login and profile identity. The inline form requires the current password and the exact phrase `RESET`. Local drafts for the account's loaded documents and workspace UI state are cleared after success.

The owner-scoped reset uses a MongoDB transaction and therefore requires Atlas or a replica set. Standalone MongoDB connections reject reset without deleting data. The single-server API blocks concurrent writes during reset and rejects reset while other authenticated write operations are active. Multi-instance deployments must coordinate this write guard across instances before enabling resets.
