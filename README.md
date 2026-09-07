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
