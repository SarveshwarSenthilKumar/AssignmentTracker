require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const https = require('https');
const { documentAction } = require('./documentActions');
const { deletePDFPage, insertPDFPages } = require('./pdfPages');
const { resetAccountWorkspace } = require('./accountReset');
const { dependencyChange } = require('./taskDependencies');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));

// File upload configuration
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .catch(() => undefined);

// User Schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  canvasUrl: {
    type: String,
    default: null,
  },
  canvasToken: {
    type: String,
    default: null,
  },
  lastCanvasSync: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const User = mongoose.model('User', userSchema);

// Folder Schema
const folderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    default: '#0ea5e9',
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Folder = mongoose.model('Folder', folderSchema);

// Todo Schema
const todoSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  dependsOn: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Todo' }],
  links: {
    type: [String],
    default: [],
  },
  status: {
    type: String,
    enum: ['todo', 'in-progress', 'completed'],
    default: 'todo',
  },
  folder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  dueDate: {
    type: Date,
    default: null,
  },
  canvasId: {
    type: String,
    default: null,
  },
  canvasType: {
    type: String,
    enum: ['assignment', 'calendar_event', null],
    default: null,
  },
});

const Todo = mongoose.model('Todo', todoSchema);

// Document storage (legacy PDF collection remains compatible).
const pdfSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  originalName: {
    type: String,
    required: true,
  },
  deletedAt: { type: Date, default: null },
  mimeType: { type: String, default: 'application/pdf' },
  originalBackup: { type: Buffer, default: null },
  pdfData: {
    type: Buffer,
    required: true,
  },
  annotations: {
    type: Array,
    default: [],
  },
  tags: {
    type: [String],
    default: [],
  },
  pdfFolder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PDFFolder',
    default: null,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  todo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Todo',
    default: null,
  },
  taskIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Todo' }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const PDF = mongoose.model('PDF', pdfSchema);

// PDF Folder Schema
const pdfFolderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    default: '#3b82f6',
  },
  description: {
    type: String,
    default: '',
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const PDFFolder = mongoose.model('PDFFolder', pdfFolderSchema);

// Auth Middleware
const accountWrites = new Map();
const resettingAccounts = new Set();
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const id = String(user.userId);
      if (resettingAccounts.has(id)) return res.status(409).json({ message: 'Account reset is in progress. Try again shortly.' });
      accountWrites.set(id, (accountWrites.get(id) || 0) + 1);
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        const count = (accountWrites.get(id) || 1) - 1;
        count ? accountWrites.set(id, count) : accountWrites.delete(id);
      };
      // Keep a disconnected client's operation counted until its handler responds.
      const end = res.end;
      res.end = function (...args) { try { return end.apply(this, args); } finally { finish(); } };
    }
    next();
  });
};

// Auth Routes
// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
});

// Routes
app.post('/api/user/reset', authenticateToken, async (req, res) => {
  const userId = String(req.user.userId);
  let locked = false;
  try {
    if (req.body.confirmation !== 'RESET' || typeof req.body.password !== 'string' || !req.body.password || req.body.password.length > 1024) return res.status(400).json({ message: 'Enter your password and type RESET to confirm.' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Account not found.' });
    if (!await bcrypt.compare(req.body.password, user.password)) return res.status(401).json({ message: 'The password is incorrect. No data was reset.' });
    if ((accountWrites.get(userId) || 0) !== 1 || resettingAccounts.has(userId)) return res.status(409).json({ message: 'Wait for uploads, saves, and imports to finish, then try the reset again.' });
    resettingAccounts.add(userId); locked = true;
    const deleted = await resetAccountWorkspace({ userId, models: { Todo, PDF, Folder, PDFFolder, User }, startSession: () => mongoose.startSession() });
    res.json({ message: 'Account workspace reset.', deleted });
  } catch (error) {
    const unsupported = /Transaction numbers|replica set|mongos/i.test(error.message);
    res.status(503).json({ message: unsupported ? 'Reset requires a MongoDB replica set or Atlas connection. No data was reset.' : 'Reset could not be confirmed. Refresh your workspace before retrying.' });
  } finally { if (locked) resettingAccounts.delete(userId); }
});

// Get all todos
app.get('/api/todos', authenticateToken, async (req, res) => {
  try {
    const todos = await Todo.find({ user: req.user.userId }).sort({ createdAt: -1 });
    res.json(todos);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching todos', error: error.message });
  }
});

// Create a new todo
app.post('/api/todos', authenticateToken, async (req, res) => {
  try {
    const { text, folder, dueDate } = req.body;
    if (!text) {
      return res.status(400).json({ message: 'Text is required' });
    }
    const todo = new Todo({ text, folder, user: req.user.userId, dueDate });
    await todo.save();
    res.status(201).json(todo);
  } catch (error) {
    res.status(500).json({ message: 'Error creating todo', error: error.message });
  }
});

// Update a todo
app.post('/api/task-dependencies', authenticateToken, async (req, res) => {
  let change;
  try { change = dependencyChange(req.body, req.user.userId); }
  catch (error) { return res.status(400).json({ message: error.message }); }
  try {
    if (await Todo.countDocuments(change.owner) !== 2) return res.status(404).json({ message: 'Both tasks must belong to your account and still exist.' });
    const task = await Todo.findOneAndUpdate(change.target, change.update, { new: true });
    if (!task) return res.status(404).json({ message: 'Task no longer exists.' });
    res.json(task);
  } catch (error) { res.status(500).json({ message: 'Could not update the task connection.' }); }
});

app.put('/api/todos/:id', authenticateToken, async (req, res) => {
  try {
    const { status, description, links, text, dueDate } = req.body;
    const updateData = {};
    if (status !== undefined) {
      updateData.status = status;
      // Set completedAt when status changes to 'completed', clear it otherwise
      if (status === 'completed') {
        updateData.completedAt = new Date();
      } else {
        updateData.completedAt = null;
      }
    }
    if (description !== undefined) updateData.description = description;
    if (links !== undefined) updateData.links = links;
    if (text !== undefined) updateData.text = text;
    if (dueDate !== undefined) updateData.dueDate = dueDate;

    const todo = await Todo.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId },
      updateData,
      { new: true }
    );
    if (!todo) {
      return res.status(404).json({ message: 'Todo not found' });
    }
    res.json(todo);
  } catch (error) {
    res.status(500).json({ message: 'Error updating todo', error: error.message });
  }
});

// Delete a todo
app.delete('/api/todos/:id([a-fA-F0-9]{24})', authenticateToken, async (req, res) => {
  try {
    const todo = await Todo.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
    if (!todo) {
      return res.status(404).json({ message: 'Todo not found' });
    }
    await Todo.updateMany({ user: req.user.userId, dependsOn: todo._id }, { $pull: { dependsOn: todo._id } });
    res.json({ message: 'Todo deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting todo', error: error.message });
  }
});

// Delete all todos in a folder
async function deleteTasksAndConnections(filter) {
  const tasks = await Todo.find(filter).select('_id');
  const ids = tasks.map(task => task._id);
  const result = await Todo.deleteMany({ user: filter.user, _id: { $in: ids } });
  if (ids.length) await Todo.updateMany({ user: filter.user, dependsOn: { $in: ids } }, { $pull: { dependsOn: { $in: ids } } });
  return result;
}
app.delete('/api/todos/folder/:folderId', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { folder: req.params.folderId, user: req.user.userId };
    if (status) filter.status = status;

    const result = await deleteTasksAndConnections(filter);
    res.json({ message: `Deleted ${result.deletedCount} tasks from folder`, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting folder tasks', error: error.message });
  }
});

// Clear inbox (delete all todos without a folder)
app.delete('/api/todos/clear-inbox', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { folder: null, user: req.user.userId };
    if (status) filter.status = status;

    const result = await deleteTasksAndConnections(filter);
    res.json({ message: `Cleared ${result.deletedCount} tasks from inbox`, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: 'Error clearing inbox', error: error.message });
  }
});

// Folder Routes
// Get all folders
app.get('/api/folders', authenticateToken, async (req, res) => {
  try {
    const folders = await Folder.find({ user: req.user.userId }).sort({ createdAt: 1 });
    res.json(folders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching folders', error: error.message });
  }
});

// Create a new folder
app.post('/api/folders', authenticateToken, async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }
    const folder = new Folder({ name, color, user: req.user.userId });
    await folder.save();
    res.status(201).json(folder);
  } catch (error) {
    res.status(500).json({ message: 'Error creating folder', error: error.message });
  }
});

// Update a folder
app.put('/api/folders/:id', authenticateToken, async (req, res) => {
  try {
    const { name, color } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;

    const folder = await Folder.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId },
      updateData,
      { new: true }
    );
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }
    res.json(folder);
  } catch (error) {
    res.status(500).json({ message: 'Error updating folder', error: error.message });
  }
});

// Delete a folder
app.delete('/api/folders/:id', authenticateToken, async (req, res) => {
  try {
    const folder = await Folder.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }
    // Also delete all todos in this folder
    await deleteTasksAndConnections({ folder: req.params.id, user: req.user.userId });
    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting folder', error: error.message });
  }
});

// Canvas Integration Routes
// Update Canvas credentials
app.put('/api/user/canvas', authenticateToken, async (req, res) => {
  try {
    const { canvasUrl, canvasToken } = req.body;
    const user = await User.findOneAndUpdate(
      { _id: req.user.userId },
      { canvasUrl, canvasToken },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ canvasUrl: user.canvasUrl, lastCanvasSync: user.lastCanvasSync });
  } catch (error) {
    res.status(500).json({ message: 'Error updating Canvas credentials', error: error.message });
  }
});

// Get Canvas credentials status
app.get('/api/user/canvas', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      hasCredentials: !!user.canvasToken,
      canvasUrl: user.canvasUrl,
      lastCanvasSync: user.lastCanvasSync
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching Canvas status', error: error.message });
  }
});

// Test Canvas connection
app.post('/api/canvas/test', authenticateToken, async (req, res) => {
  try {
    const { canvasUrl, canvasToken } = req.body;

    if (!canvasUrl || !canvasToken) {

      return res.status(400).json({ success: false, error: 'Canvas credentials not provided' });
    }




    try {
      // Test with calendar endpoint instead (may have different permissions)
      const testResponse = await fetchFromCanvas(canvasUrl, canvasToken, '/api/v1/calendar_events?per_page=1');

      res.json({
        success: true,
        message: 'Canvas connection successful',
        response: Array.isArray(testResponse) ? `Found ${testResponse.length} calendar events` : 'Response received'
      });
    } catch (e) {

      res.status(400).json({
        success: false,
        message: 'Canvas connection failed',
        error: e.message
      });
    }
  } catch (error) {

    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to fetch from Canvas API
const fetchFromCanvas = (canvasUrl, canvasToken, endpoint) => {
  return new Promise((resolve, reject) => {
    try {
      // Ensure canvasUrl doesn't have trailing slash
      const cleanUrl = canvasUrl.replace(/\/$/, '');
      const url = new URL(endpoint, cleanUrl);

      const options = {
        headers: {
          'Authorization': `Bearer ${canvasToken}`,
          'Accept': 'application/json'
        }
      };




      https.get(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {




          if (res.statusCode >= 400) {
            reject(new Error(`Canvas API returned status ${res.statusCode}: ${data.substring(0, 200)}`));
            return;
          }

          if (!data || data.trim().length === 0) {
            reject(new Error('Canvas returned empty response. Your API token may not have permission to access courses. Please regenerate the token with proper scopes.'));
            return;
          }

          try {
            const parsed = JSON.parse(data);

            resolve(parsed);
          } catch (e) {
            // Check if response is HTML (authentication error)
            if (data.toLowerCase().includes('<html') || data.toLowerCase().includes('<!doctype')) {
              reject(new Error('Canvas returned HTML instead of JSON. API token may be invalid or expired.'));
            } else {
              reject(new Error(`Failed to parse Canvas response: ${e.message}. Response: ${data.substring(0, 200)}`));
            }
          }
        });
      }).on('error', (e) => {

        reject(new Error(`Canvas API request failed: ${e.message}`));
      });
    } catch (e) {

      reject(new Error(`Invalid Canvas URL: ${e.message}`));
    }
  });
};

// Sync Canvas data
app.post('/api/canvas/sync', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !user.canvasUrl || !user.canvasToken) {
      return res.status(400).json({ message: 'Canvas credentials not configured' });
    }


    let syncedCount = 0;
    let errors = [];

    // Fetch courses first
    try {

      const courses = await fetchFromCanvas(user.canvasUrl, user.canvasToken, '/api/v1/courses?per_page=100');


      for (const course of courses) {
        try {

          // Fetch assignments for this course
          const courseAssignments = await fetchFromCanvas(
            user.canvasUrl,
            user.canvasToken,
            `/api/v1/courses/${course.id}/assignments?per_page=100`
          );



          for (const assignment of courseAssignments) {
            if (!assignment.due_at) continue;

            const existingTodo = await Todo.findOne({
              canvasId: String(assignment.id),
              user: req.user.userId
            });

            if (!existingTodo) {
              const todo = new Todo({
                text: assignment.name,
                description: assignment.description || '',
                links: assignment.html_url ? [assignment.html_url] : [],
                status: new Date(assignment.due_at) < new Date() ? 'todo' : 'todo',
                user: req.user.userId,
                dueDate: new Date(assignment.due_at),
                canvasId: String(assignment.id),
                canvasType: 'assignment'
              });
              await todo.save();
              syncedCount++;

            } else {

            }
          }
        } catch (e) {

          errors.push(`Course ${course.name}: ${e.message}`);
        }
      }
    } catch (e) {

      errors.push(`Courses: ${e.message}`);
    }

    // Fetch calendar events
    try {

      const calendarEvents = await fetchFromCanvas(
        user.canvasUrl,
        user.canvasToken,
        '/api/v1/calendar_events?per_page=100'
      );



      for (const event of calendarEvents) {
        if (!event.start_at) continue;

        const existingTodo = await Todo.findOne({
          canvasId: String(event.id),
          user: req.user.userId
        });

        if (!existingTodo) {
          const todo = new Todo({
            text: event.title,
            description: event.description || '',
            links: event.html_url ? [event.html_url] : [],
            status: new Date(event.start_at) < new Date() ? 'todo' : 'todo',
            user: req.user.userId,
            dueDate: new Date(event.start_at),
            canvasId: String(event.id),
            canvasType: 'calendar_event'
          });
          await todo.save();
          syncedCount++;

        } else {

        }
      }
    } catch (e) {

      errors.push(`Calendar events: ${e.message}`);
    }

    // Update last sync time
    await User.findByIdAndUpdate(req.user.userId, { lastCanvasSync: new Date() });



    res.json({
      message: `Synced ${syncedCount} items from Canvas`,
      syncedCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {

    res.status(500).json({ message: 'Error syncing Canvas data', error: error.message });
  }
});

// PDF Routes
app.post('/api/documents/actions', authenticateToken, async (req, res) => {
  try {
    let operation;
    try { operation = documentAction(req.body); }
    catch (error) { return res.status(400).json({ message: error.message }); }
    const { action, ids, folderId, update } = operation;
    if (action === 'move' && folderId !== null && !await PDFFolder.exists({ _id: folderId, user: req.user.userId })) return res.status(404).json({ message: 'The destination folder no longer exists.' });
    const query = { _id: { $in: ids }, user: req.user.userId, deletedAt: action === 'restore' ? { $ne: null } : null };
    if (await PDF.countDocuments(query) !== ids.length) return res.status(409).json({ message: 'Some selected documents are unavailable. Refresh the library and try again.' });
    await PDF.updateMany(query, { $set: update });
    res.json({ ids, action, folderId: folderId ?? null, deletedAt: update.deletedAt ?? null });
  } catch (error) { res.status(500).json({ message: 'Could not update the selected documents. Please try again.' }); }
});

// Get all documents for user
app.get('/api/pdfs', authenticateToken, async (req, res) => {
  try {
    const pdfs = await PDF.find({ user: req.user.userId, ...(req.query.includeTrash === '1' ? {} : { deletedAt: null }) }).select('-pdfData -originalBackup').sort({ createdAt: -1 });
    res.json(pdfs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching PDFs', error: error.message });
  }
});

// Get a single PDF
app.get('/api/pdfs/:id', authenticateToken, async (req, res) => {
  try {
    const pdf = await PDF.findOne({ _id: req.params.id, user: req.user.userId });
    if (!pdf) {
      return res.status(404).json({ message: 'PDF not found' });
    }
    // Convert PDF buffer to base64 for JSON transmission
    const pdfResponse = {
      ...pdf.toObject(),
      originalBackup: undefined,
      hasOriginalBackup: Boolean(pdf.originalBackup),
      pdfData: pdf.pdfData.toString('base64')
    };
    res.json(pdfResponse);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching PDF', error: error.message });
  }
});

// Upload a new PDF
app.post('/api/pdfs', authenticateToken, upload.single('pdfFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    if (req.file.size > 10 * 1024 * 1024) return res.status(400).json({ message: 'Files must be smaller than 10 MB.' });
    const { name, todoId, pdfFolderId, tags } = req.body;
    if (todoId && (!mongoose.isValidObjectId(todoId) || !await Todo.exists({ _id: todoId, user: req.user.userId }))) return res.status(400).json({ message: 'Choose one of your tasks.' });
    if (pdfFolderId && (typeof pdfFolderId !== 'string' || !mongoose.isValidObjectId(pdfFolderId) || !await PDFFolder.exists({ _id: pdfFolderId, user: req.user.userId }))) return res.status(400).json({ message: 'Choose one of your document folders.' });
    const pdf = new PDF({
      name: name || req.file.originalname,
      originalName: req.file.originalname,
      pdfData: req.file.buffer,
      mimeType: req.file.mimetype || 'application/octet-stream',
      user: req.user.userId,
      todo: todoId || null,
      taskIds: todoId ? [todoId] : [],
      pdfFolder: pdfFolderId || null,
      tags: tags ? JSON.parse(tags) : [],
    });
    await pdf.save();
    const metadata = pdf.toObject(); delete metadata.pdfData; delete metadata.originalBackup;
    res.status(201).json(metadata);
  } catch (error) {
    res.status(500).json({ message: 'Error uploading PDF', error: error.message });
  }
});

// Reuse library files across tasks without duplicating their stored contents.
app.put('/api/pdfs/:id/task-link', authenticateToken, async (req, res) => {
  try {
    const { taskId, linked } = req.body;
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(taskId) || typeof linked !== 'boolean') return res.status(400).json({ message: 'Invalid document link.' });
    if (!await Todo.exists({ _id: taskId, user: req.user.userId })) return res.status(404).json({ message: 'Task not found.' });
    const file = await PDF.findOne({ _id: req.params.id, user: req.user.userId, deletedAt: null }).select('-pdfData -originalBackup');
    if (!file) return res.status(404).json({ message: 'Document not found.' });
    const update = linked ? { $addToSet: { taskIds: taskId }, $set: { updatedAt: new Date() } } : { $pull: { taskIds: taskId }, $set: { updatedAt: new Date(), ...(String(file.todo) === taskId ? { todo: null } : {}) } };
    const updated = await PDF.findOneAndUpdate({ _id: file._id, user: req.user.userId, deletedAt: null }, update, { new: true }).select('-pdfData -originalBackup');
    if (!updated) return res.status(409).json({ message: 'Document is no longer available.' });
    res.json(updated);
  } catch (error) { res.status(500).json({ message: 'Could not update the document link.' }); }
});

// Save directly editable documents; retain the uploaded original before the first edit.
app.put('/api/pdfs/:id/content', authenticateToken, async (req, res) => {
  try {
    const pdf = await PDF.findOne({ _id: req.params.id, user: req.user.userId });
    if (!pdf) return res.status(404).json({ message: 'Document not found' });
    const { data, mimeType } = req.body;
    if (typeof data !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) return res.status(400).json({ message: 'Invalid document content.' });
    const bytes = Buffer.from(data, 'base64');
    if (bytes.length > 10 * 1024 * 1024) return res.status(400).json({ message: 'Files must be smaller than 10 MB.' });
    if (bytes.length + (pdf.originalBackup || pdf.pdfData).length > 15 * 1024 * 1024) return res.status(400).json({ message: 'The original and edited document together exceed the 15 MB storage limit. Download the edited version instead.' });
    if (!pdf.originalBackup) pdf.originalBackup = pdf.pdfData;
    pdf.pdfData = bytes;
    if (typeof mimeType === 'string' && mimeType.length < 150) pdf.mimeType = mimeType;
    pdf.annotations = [];
    pdf.updatedAt = new Date();
    await pdf.save();
    res.json({ updatedAt: pdf.updatedAt, hasOriginalBackup: true });
  } catch (error) { res.status(500).json({ message: 'Could not save this document.' }); }
});
app.get('/api/pdfs/:id/original', authenticateToken, async (req, res) => {
  try {
    const pdf = await PDF.findOne({ _id: req.params.id, user: req.user.userId });
    if (!pdf) return res.status(404).json({ message: 'Document not found' });
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(pdf.originalName)}`);
    res.send(pdf.originalBackup || pdf.pdfData);
  } catch (error) { res.status(500).json({ message: 'Could not download the original.' }); }
});

// Update PDF annotations
app.put('/api/pdfs/:id/annotations', authenticateToken, async (req, res) => {
  try {
    const { annotations } = req.body;
    const pdf = await PDF.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId },
      { annotations, updatedAt: new Date() },
      { new: true }
    );
    if (!pdf) {
      return res.status(404).json({ message: 'PDF not found' });
    }
    res.json(pdf);
  } catch (error) {
    res.status(500).json({ message: 'Error updating annotations', error: error.message });
  }
});

app.post('/api/pdfs/:id/pages', authenticateToken, async (req, res) => {
  try {
    const pdf = await PDF.findOne({ _id: req.params.id, user: req.user.userId });
    if (!pdf) return res.status(404).json({ message: 'PDF not found' });
    let result;
    try {
      const { sources = [], ...options } = req.body;
      if (!Array.isArray(sources) || sources.some(source => typeof source !== 'string') || sources.reduce((size, source) => size + source.length, 0) > 14 * 1024 * 1024) throw new Error('Choose PDFs totaling no more than 10 MB.');
      result = await insertPDFPages(pdf.pdfData, { ...options, sources: sources.map(source => Buffer.from(source, 'base64')), annotations: options.annotations ?? pdf.annotations });
    } catch (error) { return res.status(400).json({ message: error.message || 'Could not read the PDF. Check that it is valid and not password protected.' }); }
    pdf.pdfData = result.bytes;
    pdf.annotations = result.annotations;
    pdf.updatedAt = new Date();
    await pdf.save();
    res.json({ pdfData: result.bytes.toString('base64'), annotations: result.annotations, numPages: result.numPages, insertedPages: result.insertedPages, firstInsertedPage: result.firstInsertedPage });
  } catch (error) { res.status(500).json({ message: 'Could not add pages. Please try again.' }); }
});

// Persist the modified PDF and renumbered annotations together.
app.delete('/api/pdfs/:id/pages/:pageNumber', authenticateToken, async (req, res) => {
  try {
    const pdf = await PDF.findOne({ _id: req.params.id, user: req.user.userId });
    if (!pdf) return res.status(404).json({ message: 'PDF not found' });
    let result;
    try {
      result = await deletePDFPage(pdf.pdfData, Number(req.params.pageNumber), req.body.annotations ?? pdf.annotations);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
    pdf.pdfData = result.bytes;
    pdf.annotations = result.annotations;
    pdf.updatedAt = new Date();
    await pdf.save();
    res.json({ pdfData: result.bytes.toString('base64'), annotations: result.annotations, numPages: result.numPages });
  } catch (error) {
    res.status(500).json({ message: 'Could not delete the page. Please try again.' });
  }
});

// Update PDF metadata (tags, folder, name)
app.put('/api/pdfs/:id', authenticateToken, async (req, res) => {
  try {
    const { name, tags, pdfFolder } = req.body;
    const updateData = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) return res.status(400).json({ message: 'Enter a name between 1 and 120 characters.' });
      updateData.name = name.trim();
    }
    if (tags !== undefined) updateData.tags = tags;
    if (pdfFolder !== undefined) {
      if (pdfFolder !== null && (typeof pdfFolder !== 'string' || !mongoose.isValidObjectId(pdfFolder))) return res.status(400).json({ message: 'Choose a valid destination folder.' });
      if (pdfFolder !== null && !await PDFFolder.exists({ _id: pdfFolder, user: req.user.userId })) return res.status(400).json({ message: 'Choose one of your document folders.' });
      updateData.pdfFolder = pdfFolder;
    }
    updateData.updatedAt = new Date();

    const pdf = await PDF.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId },
      updateData,
      { new: true }
    );
    if (!pdf) {
      return res.status(404).json({ message: 'PDF not found' });
    }
    res.json(pdf);
  } catch (error) {
    res.status(500).json({ message: 'Error updating PDF', error: error.message });
  }
});

// Download a PDF
app.get('/api/pdfs/:id/download', authenticateToken, async (req, res) => {
  try {
    const pdf = await PDF.findOne({ _id: req.params.id, user: req.user.userId });
    if (!pdf) {
      return res.status(404).json({ message: 'PDF not found' });
    }
    res.setHeader('Content-Type', pdf.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(pdf.originalName)}`);
    res.send(pdf.pdfData);
  } catch (error) {
    res.status(500).json({ message: 'Error downloading PDF', error: error.message });
  }
});

// Delete a PDF
app.delete('/api/pdfs/:id', authenticateToken, async (req, res) => {
  try {
    const pdf = await PDF.findOneAndUpdate({ _id: req.params.id, user: req.user.userId }, { $set: { deletedAt: new Date(), updatedAt: new Date() } }, { new: true });
    if (!pdf) {
      return res.status(404).json({ message: 'PDF not found' });
    }
    res.json({ message: 'Document moved to Trash' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting PDF', error: error.message });
  }
});

// PDF Folder Routes
// Get all PDF folders
app.get('/api/pdf-folders', authenticateToken, async (req, res) => {
  try {
    const folders = await PDFFolder.find({ user: req.user.userId }).sort({ createdAt: 1 });
    res.json(folders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching PDF folders', error: error.message });
  }
});

// Create a new PDF folder
app.post('/api/pdf-folders', authenticateToken, async (req, res) => {
  try {
    const { name, color, description } = req.body;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
      return res.status(400).json({ message: 'Enter a folder name between 1 and 120 characters.' });
    }
    const folder = new PDFFolder({
      name: name.trim(),
      color: color || '#3b82f6',
      description: description || '',
      user: req.user.userId,
    });
    await folder.save();
    res.status(201).json(folder);
  } catch (error) {
    res.status(500).json({ message: 'Error creating PDF folder', error: error.message });
  }
});

// Update a PDF folder
app.put('/api/pdf-folders/:id', authenticateToken, async (req, res) => {
  try {
    const { name, color, description } = req.body;
    const updateData = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) return res.status(400).json({ message: 'Enter a name between 1 and 120 characters.' });
      updateData.name = name.trim();
    }
    if (color !== undefined) updateData.color = color;
    if (description !== undefined) updateData.description = description;

    const folder = await PDFFolder.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId },
      updateData,
      { new: true }
    );
    if (!folder) {
      return res.status(404).json({ message: 'PDF folder not found' });
    }
    res.json(folder);
  } catch (error) {
    res.status(500).json({ message: 'Error updating PDF folder', error: error.message });
  }
});

// Delete a PDF folder
app.delete('/api/pdf-folders/:id', authenticateToken, async (req, res) => {
  try {
    const folder = await PDFFolder.findOne({ _id: req.params.id, user: req.user.userId });
    if (!folder) {
      return res.status(404).json({ message: 'PDF folder not found' });
    }
    // Move all PDFs in this folder to uncategorized
    await PDF.updateMany(
      { pdfFolder: req.params.id, user: req.user.userId },
      { pdfFolder: null }
    );
    await PDFFolder.deleteOne({ _id: req.params.id, user: req.user.userId });
    res.json({ message: 'Document folder removed; documents moved to Unfiled.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting PDF folder', error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'unavailable', message: ready ? 'Service is ready' : 'Database connection is unavailable' });
});

// Import ICS calendar from file
app.post('/api/calendar/import', authenticateToken, upload.single('icsFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }


    const icsContent = req.file.buffer.toString('utf-8');


    const events = parseICS(icsContent);


    let importedCount = 0;
    const courseFolders = new Map(); // Map course name to folder ID

    for (const event of events) {
      if (!event.summary || !event.startDate) {

        continue;
      }

      // Extract course name from summary or description
      const courseName = extractCourseName(event.summary, event.description);

      // Get or create folder for this course
      let folderId = null;
      if (courseName) {
        if (courseFolders.has(courseName)) {
          folderId = courseFolders.get(courseName);
        } else {
          // Create a new folder for this course
          const existingFolder = await Folder.findOne({
            user: req.user.userId,
            name: courseName
          });

          if (existingFolder) {
            folderId = existingFolder._id;
            courseFolders.set(courseName, folderId);
          } else {
            const newFolder = new Folder({
              name: courseName,
              color: generateCourseColor(courseName),
              user: req.user.userId
            });
            await newFolder.save();
            folderId = newFolder._id;
            courseFolders.set(courseName, folderId);

          }
        }
      }

      // Check if event already exists by combining summary and date
      const existingTodo = await Todo.findOne({
        user: req.user.userId,
        text: event.summary,
        dueDate: event.startDate
      });

      if (!existingTodo) {
        const todo = new Todo({
          text: event.summary,
          description: event.description || '',
          links: event.url ? [event.url] : [],
          status: new Date(event.startDate) < new Date() ? 'todo' : 'todo',
          user: req.user.userId,
          dueDate: new Date(event.startDate),
          folder: folderId,
          canvasType: 'calendar_event'
        });
        await todo.save();
        importedCount++;

      }
    }


    res.json({ message: `Imported ${importedCount} events from calendar`, importedCount });
  } catch (error) {

    res.status(500).json({ message: `Error importing calendar: ${error.message}` });
  }
});

// Extract course name from event summary or description
function extractCourseName(summary, description) {
  // Try to extract from summary (common Canvas format: "Assignment: CS101 - Homework")
  const summaryMatch = summary.match(/([A-Z]{2,4}\d{3,4})/);
  if (summaryMatch) return summaryMatch[0];

  // Try to extract from description
  if (description) {
    const descMatch = description.match(/([A-Z]{2,4}\d{3,4})/);
    if (descMatch) return descMatch[0];
  }

  // Try common course patterns
  const patterns = [
    /([A-Z]{2,4}\s?\d{3,4})/,
    /([A-Z]{2,4}-\d{3,4})/,
    /Course:\s*([^\n]+)/,
    /Class:\s*([^\n]+)/
  ];

  for (const pattern of patterns) {
    const match = summary.match(pattern) || (description && description.match(pattern));
    if (match) return match[1].trim();
  }

  return null;
}

// Generate consistent color for course name
function generateCourseColor(courseName) {
  const colors = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#14b8a6'];
  let hash = 0;
  for (let i = 0; i < courseName.length; i++) {
    hash = courseName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Parse ICS file content
function parseICS(icsContent) {
  const events = [];
  const lines = icsContent.split('\n');
  let currentEvent = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT' && currentEvent) {
      events.push(currentEvent);
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('SUMMARY:')) {
        currentEvent.summary = line.substring(8).replace(/\\/g, '');
      } else if (line.startsWith('DESCRIPTION:')) {
        currentEvent.description = line.substring(12).replace(/\\/g, '').replace(/\\n/g, '\n');
      } else if (line.startsWith('DTSTART:')) {
        currentEvent.startDate = parseICSDate(line.substring(8));
      } else if (line.startsWith('DTSTART;')) {
        const dateMatch = line.match(/DTSTART[^:]*:(.+)/);
        if (dateMatch) {
          currentEvent.startDate = parseICSDate(dateMatch[1]);
        }
      } else if (line.startsWith('URL:')) {
        currentEvent.url = line.substring(4);
      }
    }
  }

  return events;
}

// Parse ICS date format
function parseICSDate(icsDate) {
  try {
    // Format: 20240915T143000Z or 20240915T143000
    const cleanDate = icsDate.replace(/Z$/, '');

    if (cleanDate.length < 15) {

      return new Date(); // Return current date if invalid
    }

    const year = parseInt(cleanDate.substring(0, 4));
    const month = parseInt(cleanDate.substring(4, 6)) - 1;
    const day = parseInt(cleanDate.substring(6, 8));
    const hour = parseInt(cleanDate.substring(9, 11));
    const minute = parseInt(cleanDate.substring(11, 13));
    const second = parseInt(cleanDate.substring(13, 15)) || 0;

    return new Date(year, month, day, hour, minute, second);
  } catch (e) {

    return new Date();
  }
}

app.use((error, req, res, next) => {
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Files must be smaller than 10 MB.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ message: 'This document and its edits are too large to save together.' });
  next(error);
});

app.listen(PORT);
