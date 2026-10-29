# Todo App - Setup and Deployment Guide

A modern, full-stack todo application built with React, Express, MongoDB, and TailwindCSS.

## 🚀 Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS, Lucide Icons
- **Backend**: Node.js, Express
- **Database**: MongoDB Atlas (cloud-hosted MongoDB)
- **Deployment**: Vercel (frontend), Render (backend)

---

## 📋 Prerequisites

- Node.js (v18 or higher) - [Download here](https://nodejs.org/)
- npm (comes with Node.js)
- MongoDB Atlas account (free tier available) - [Sign up here](https://www.mongodb.com/cloud/atlas)
- Git account (for deployment)

---

## 🛠️ Local Development Setup

### Step 1: Clone the Repository

```bash
git clone <your-repo-url>
cd AssignmentTracker
```

### Step 2: Set Up MongoDB Atlas

1. **Create a MongoDB Atlas Account**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Sign up for a free account

2. **Create a Cluster**
   - Click "Build a Database"
   - Select "Free" tier (M0)
   - Choose a cloud provider and region closest to you
   - Name your cluster (e.g., "todo-cluster")
   - Click "Create"

3. **Create Database User**
   - Go to "Database Access" in the left sidebar
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Enter username and password (save these!)
   - Click "Create User"

4. **Whitelist IP Address**
   - Go to "Network Access" in the left sidebar
   - Click "Add IP Address"
   - Select "Allow Access from Anywhere" (0.0.0.0/0) for development
   - Click "Confirm"

5. **Get Connection String**
   - Go to "Database" → Click "Connect" on your cluster
   - Choose "Connect your application"
   - Select Node.js version
   - Copy the connection string (it looks like: `mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority`)

### Step 3: Backend Setup

```bash
cd backend
npm install
```

2. **Create Environment File**
   ```bash
   cp .env.example .env
   ```

3. **Configure .env**
   Open `.env` and replace with your MongoDB connection string:
   ```
   MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster.mongodb.net/todoapp?retryWrites=true&w=majority
   PORT=5000
   ```

4. **Start Backend Server**
   ```bash
   npm run dev
   ```
   Backend will run on `http://localhost:5000`

### Step 4: Frontend Setup

```bash
cd frontend
npm install
```

2. **Start Frontend Server**
   ```bash
   npm run dev
   ```
   Frontend will run on `http://localhost:3000`

### Step 5: Test the Application

1. Open `http://localhost:3000` in your browser
2. Add a new todo item
3. Toggle completion status
4. Delete a todo item
5. Refresh the page to verify data persistence

---

## 🌐 Deployment Guide

### Deploy Backend to Render

Render offers a free tier for Node.js applications with PostgreSQL, but we'll use it for our Express + MongoDB setup.

1. **Prepare Backend for Deployment**
   
   Create a `Procfile` in the backend directory:
   ```bash
   cd backend
   echo "web: node server.js" > Procfile
   ```

2. **Push Code to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

3. **Deploy to Render**
   - Go to [Render.com](https://render.com)
   - Sign up/login with GitHub
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repository
   - Configure:
     - **Name**: todo-app-backend
     - **Root Directory**: backend
     - **Build Command**: `npm install`
     - **Start Command**: `node server.js`
   - Click "Advanced" → "Add Environment Variable"
     - `MONGODB_URI`: Your MongoDB Atlas connection string
     - `PORT`: 5000
   - Click "Create Web Service"
   - Wait for deployment (2-3 minutes)
   - Copy the deployed URL (e.g., `https://todo-app-backend.onrender.com`)

4. **Update Frontend API URL**
   
   In `frontend/src/App.jsx`, update the fetch URLs:
   ```javascript
   // Replace all '/api' with your backend URL
   const API_URL = 'https://todo-app-backend.onrender.com/api';
   
   // Update fetch calls:
   const response = await fetch(`${API_URL}/todos`);
   const response = await fetch(`${API_URL}/todos`, { ... });
   const response = await fetch(`${API_URL}/todos/${id}`, { ... });
   ```

### Deploy Frontend to Vercel

1. **Prepare Frontend for Deployment**
   
   The frontend is already configured for Vercel deployment.

2. **Deploy to Vercel**
   - Go to [Vercel.com](https://vercel.com)
   - Sign up/login with GitHub
   - Click "Add New Project"
   - Import your GitHub repository
   - Configure:
     - **Framework Preset**: Vite
     - **Root Directory**: frontend
     - **Build Command**: `npm run build`
     - **Output Directory**: dist
   - Click "Deploy"
   - Wait for deployment (1-2 minutes)
   - Your app will be live at `https://your-project.vercel.app`

---

## 🔧 Environment Variables Summary

### Backend (.env)
```
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/todoapp?retryWrites=true&w=majority
PORT=5000
```

### Frontend (Update in App.jsx after deployment)
```javascript
const API_URL = 'https://your-backend-url.onrender.com';
```

---

## 📱 Alternative Deployment Options

### Option 1: Railway (All-in-One)
Railway can host both frontend and backend in one project.

1. Go to [Railway.app](https://railway.app)
2. Create a new project
3. Add MongoDB service (Railway provides managed MongoDB)
4. Add backend service
5. Add frontend service
6. Configure environment variables
7. Railway will provide URLs for both services

### Option 2: Heroku (Backend) + Vercel (Frontend)
Heroku discontinued free tier, but still offers paid options.

### Option 3: DigitalOcean App Platform
DigitalOcean offers a free trial and competitive pricing for production apps.

---

## 🐛 Troubleshooting

### MongoDB Connection Issues
- **Error**: "Authentication failed"
  - Solution: Verify username/password in connection string
  - Check database user permissions in MongoDB Atlas

- **Error**: "IP whitelist"
  - Solution: Add your IP or use 0.0.0.0/0 for development

### CORS Errors
- **Error**: "CORS policy blocked"
  - Solution: Backend CORS is configured, but verify frontend URL is allowed
  - In production, update CORS origin to your Vercel domain

### Build Errors
- **Error**: "Module not found"
  - Solution: Run `npm install` in both frontend and backend directories
  - Delete `node_modules` and `package-lock.json`, then reinstall

### Deployment Issues
- **Error**: "Build failed"
  - Solution: Check Render/Vercel logs
  - Ensure all dependencies are in package.json
  - Verify environment variables are set correctly

---

## 📚 Project Structure

```
AssignmentTracker/
├── backend/
│   ├── server.js          # Express server and API routes
│   ├── package.json       # Backend dependencies
│   ├── .env.example       # Environment variables template
│   ├── .env              # Your actual environment variables (not in git)
│   ├── .gitignore        # Git ignore file
│   └── Procfile          # Render deployment config
├── frontend/
│   ├── src/
│   │   ├── App.jsx       # Main React component
│   │   ├── main.jsx      # React entry point
│   │   ├── index.css     # Global styles with Tailwind
│   │   └── lib/
│   │       └── utils.js  # Utility functions
│   ├── package.json      # Frontend dependencies
│   ├── vite.config.js    # Vite configuration
│   ├── tailwind.config.js # TailwindCSS configuration
│   ├── postcss.config.js # PostCSS configuration
│   ├── index.html        # HTML template
│   └── .gitignore        # Git ignore file
└── SETUP.md             # This file
```

---

## 🎯 Features

- ✅ Add new todos
- ✅ Mark todos as complete/incomplete
- ✅ Delete todos
- ✅ Real-time data persistence with MongoDB
- ✅ Responsive design with TailwindCSS
- ✅ Modern UI with smooth animations
- ✅ Loading states and error handling
- ✅ Progress tracking (completed/total)

---

## 🔐 Security Notes

- Never commit `.env` files to version control
- Use strong passwords for MongoDB Atlas
- In production, restrict MongoDB IP whitelist to specific IPs
- Consider adding authentication for multi-user support
- Use HTTPS in production (automatically provided by Vercel/Render)

---

## 🚀 Next Steps (Enhancements)

- Add user authentication (JWT, OAuth)
- Implement due dates and reminders
- Add categories/tags for todos
- Drag and drop reordering
- Dark/light mode toggle
- Export/import todos
- Share lists with other users
- Add mobile app (React Native)

---

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review deployment logs on Render/Vercel
3. Verify MongoDB Atlas cluster status
4. Check browser console for frontend errors

---

## 📄 License

This project is open source and available for personal and commercial use.


## Public site roadmap

The feature showcase is available at `/#/roadmap` and under **Tools → Site roadmap**. Visitors can read published entries without signing in. The board is global to the deployment; it is separate from private account data and is not erased by an individual workspace reset.

To manage it, set `SITE_ROADMAP_EDITOR_EMAILS` in the backend environment to a comma-separated list of registered account email addresses, then restart the backend and sign in with an allowed account. Leave it empty to disable editing. Edit access is checked on the server for every write; changing client controls does not grant access.

Editors can publish a title, description, category, status and featured flag; revise items; and remove entries after an inline confirmation. Status options are Considering, Planned, In progress and Shipped. All saved text is public immediately. Do not include secrets or private user information. Starter ideas shown to editors are unpublished form suggestions, not claims of work underway. Conflicting edits are rejected so an older copy cannot silently overwrite a newer revision.

The board starts empty. Configure an editor, click **Add feature**, or choose a starter suggestion and review it before publishing. The implementation does not expose `ideas.txt`, collect public submissions or promise feature delivery dates.


## Bug reports

Signed-in users can open **Tools → Report a bug** or use the footer link to preselect the current section. Reports are account-owned, private to the reporter and authorized reviewers, and stored in MongoDB. Each report supports a section (including Miscellaneous), severity, description, reproduction steps, expected/actual behavior and optional browser diagnostics. The form does not send email or capture screenshots/page contents. Retrying an unchanged submission reuses its submission identifier to avoid duplicate records.

Set `BUG_REPORT_EDITOR_EMAILS` to a comma-separated list of existing registered accounts that may review all reports. If unset, the roadmap editor list `SITE_ROADMAP_EDITOR_EMAILS` is used. Restart the backend after configuration. Reviewers can choose **All users’ reports**, filter the inbox, change status and leave a response visible to the reporter. Changing a client-side control cannot grant review access. Reporter identity is taken from the authenticated session, never a submitted user ID. Full workspace reset deletes that user’s reports; public roadmap items remain separate.


## Feature suggestions

Signed-in users can open **Tools → Suggest a feature**, the platform footer, or the link on the site roadmap. Suggestions are private to the submitter and configured reviewers. Sections include Miscellaneous; submissions capture a problem, proposed solution, benefits, workaround and priority. Users can track Submitted, Reviewing, Planned, In progress, Shipped and Not planned statuses and reviewer responses.

`FEATURE_SUGGESTION_EDITOR_EMAILS` optionally grants review access to existing registered accounts. If unset, the bug-report reviewer list is used, then the roadmap editor list. Restart the backend after changing environment settings. All-user access and status updates are enforced on the server.

Reviewers who also have `SITE_ROADMAP_EDITOR_EMAILS` access can prepare a separate public title and description and explicitly publish it. Private submission text and identity are not automatically copied. Publishing links the suggestion to a roadmap item and uses MongoDB transactions (Atlas or a replica set) to prevent partial publication. The public roadmap remains independent if a submitter later resets their private workspace. Private suggestions are included in account analytics and deleted by that user's full workspace reset. No email or external notification is sent by this workflow.


## Admin feedback portal

Open `/#/admin`, or press Ctrl/Cmd + Shift + K and enter `open admin`. It is unlisted in normal navigation. Sign-in and server-side review permissions are required. The portal provides bug and suggestion inboxes, status and section filters, reporter identities, submitted responses, opt-in bug diagnostics, reviewer replies and summary counts for recent and urgent submissions. Switching inboxes preserves unsaved review text; leaving the portal clears those local edits. Inbox refresh resets its local review fields. Responses are saved to the submitter’s history, not emailed.

Existing bug and feature reviewer configuration grants access only to the matching inbox. Alternatively, set `ADMIN_PORTAL_EDITOR_EMAILS` to a comma-separated list of existing registered accounts to grant both review capabilities and roadmap editing/publication. Restart the backend after setting it. Authorization is checked on overview, inbox, review and publication requests; a direct URL or visible client control grants no privileges. No first-user or automatic administrator promotion is performed.

The summary refreshes after a saved review or roadmap publication and can also be refreshed independently. Reviewers with both suggestion and roadmap permissions can prepare a separate public-safe roadmap entry; the private submission is not automatically published. Publishing continues to require MongoDB transactions.
