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
