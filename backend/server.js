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
const { calendarEntry } = require('./calendarEntries');
const { calendarLinksOwned: validateCalendarLinks } = require('./calendarLinks');
const { collectCanvasPages } = require('./canvasPagination');
const { parseCalendarICS } = require('./calendarICS');
const { canvasIdentity, canvasTaskFields } = require('./canvasTasks');
const { assistantRequest, workspaceContext, responsePayload, responseText, responseSources } = require('./assistant');

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
  timeZone: { type: String, default: '' },
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
  calendarEndDate: { type: Date, default: null },
  calendarAllDay: { type: Boolean, default: false },
  calendarDate: { type: String, default: null },
  calendarLastDate: { type: String, default: null },
  calendarLocation: { type: String, default: '' },
  calendarContext: { type: String, default: '' },
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

const CalendarEntry = mongoose.model('CalendarEntry', new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, maxlength: 200 },
  kind: { type: String, enum: ['appointment','marker'], required: true },
  notes: { type: String, default: '', maxlength: 4000 },
  location: { type: String, default: '', maxlength: 300 },
  allDay: { type: Boolean, default: true },
  startDate: { type: String, required: true }, endDate: { type: String, required: true },
  startAt: { type: Date, default: null }, endAt: { type: Date, default: null },
  done: { type: Boolean, default: false },
  taskIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Todo' }],
  documentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PDF' }],
}, { timestamps: true }));

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
        timeZone: user.timeZone || '',
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
        timeZone: user.timeZone || '',
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
});

// Routes
const aiRequests = new Map();
const aiModel = () => process.env.OPENAI_MODEL || 'gpt-4.1-mini';
app.get('/api/assistant/status', authenticateToken, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ configured: !!process.env.OPENAI_API_KEY, model: aiModel() });
});
app.post('/api/assistant/chat', authenticateToken, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  let request;
  try { request = assistantRequest(req.body); } catch (error) { return res.status(400).json({ message: error.message }); }
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ message: 'The assistant is not connected yet. Configure OPENAI_API_KEY on the backend to enable answers.' });
  const userId = String(req.user.userId), now = Date.now();
  for (const [id, state] of aiRequests) if (!state.busy && now - state.start >= 600000) aiRequests.delete(id);
  const state = aiRequests.get(userId) || { start: now, count: 0, busy: false };
  if (state.busy) return res.status(409).json({ message: 'An answer is already in progress. Wait or stop that request first.' });
  if (state.count >= 20) return res.status(429).json({ message: 'You have reached the chat request limit. Try again in a few minutes.' });
  state.busy = true; state.count++; aiRequests.set(userId, state);
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 60000);
  const disconnected = () => { if (!res.writableEnded) controller.abort(); };
  res.on('close', disconnected);
  try {
    const user = await User.findById(userId).select('username email timeZone createdAt canvasUrl lastCanvasSync').lean();
    if (!user) return res.status(404).json({ message: 'Account not found.' });
    let tasks=[],entries=[],documents=[],folders=[],documentFolders=[],totals={};
    if (request.includeWorkspace) {
      const owner = { user: userId }, active = { user: userId, deletedAt: null };
      const results = await Promise.all([
        Todo.find(owner).select('text description status dueDate folder dependsOn links calendarDate calendarAllDay calendarEndDate calendarLastDate calendarLocation calendarContext').sort({updatedAt:-1,createdAt:-1}).limit(250).lean(),
        CalendarEntry.find(owner).sort({updatedAt:-1}).limit(250).lean(),
        PDF.find(active).select('name originalName mimeType pdfFolder taskIds todo updatedAt').sort({updatedAt:-1}).limit(200).lean(),
        Folder.find(owner).select('name').limit(100).lean(), PDFFolder.find(owner).select('name').limit(100).lean(),
        Todo.countDocuments(owner), CalendarEntry.countDocuments(owner), PDF.countDocuments(active)
      ]);
      [tasks,entries,documents,folders,documentFolders]=results;
      totals={tasks:results[5],calendarEntries:results[6],documents:results[7],includedTasks:tasks.length,includedCalendarEntries:entries.length,includedDocuments:documents.length};
    }
    let file = null;
    if (request.includeDocument && request.documentId) {
      file = await PDF.findOne({ _id: request.documentId, user: userId, deletedAt: null }).select('name originalName mimeType pdfData');
      if (!file) return res.status(404).json({ message: 'The open document is unavailable or does not belong to your account.' });
    }
    if (controller.signal.aborted) { if (res.destroyed) return; throw new Error('Request timed out.'); }
    const context = workspaceContext({user,tasks,entries,documents,folders,documentFolders,totals},request);
    const response = await fetch('https://api.openai.com/v1/responses', {
      method:'POST', headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify(responsePayload(request,context,file,aiModel())), signal:controller.signal
    });
    if (!response.ok) {
      const message = response.status === 429 ? 'The AI service is busy or its usage limit has been reached. Try again later.' : response.status === 401 || response.status === 403 ? 'The AI connection could not authenticate. Check the backend API key and model access.' : 'The AI service could not answer this request. Try again, or turn off open-file context.';
      return res.status(502).json({ message });
    }
    const data = await response.json(), text = responseText(data);
    res.json({text,sources:responseSources(text,context),context:{...totals,section:request.section,screenIncluded:request.includeScreen,workspaceIncluded:request.includeWorkspace,document:context.openDocument||null},partial:data.status==='incomplete'});
  } catch (error) {
    if (!res.destroyed) res.status(502).json({ message: controller.signal.aborted ? 'The AI request timed out. Try again.' : 'Could not get an answer. Check the AI connection and try again.' });
  } finally { clearTimeout(timeout); res.off('close',disconnected); state.busy=false; if (res.destroyed && !res.writableEnded) res.end(); }
});
app.get('/api/account/preferences', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('timeZone');
    if (!user) return res.status(404).json({ message: 'Account not found.' });
    res.json({ timeZone: user.timeZone || '' });
  } catch { res.status(500).json({ message: 'Could not load account preferences.' }); }
});
app.put('/api/account/preferences', authenticateToken, async (req, res) => {
  const { timeZone } = req.body;
  if (typeof timeZone !== 'string' || timeZone.length > 100) return res.status(400).json({ message: 'Choose a valid time zone.' });
  try { if (timeZone) new Intl.DateTimeFormat('en', { timeZone }).format(); }
  catch { return res.status(400).json({ message: 'Choose a valid time zone.' }); }
  try {
    const user = await User.findByIdAndUpdate(req.user.userId, { $set: { timeZone } }, { new: true }).select('timeZone');
    if (!user) return res.status(404).json({ message: 'Account not found.' });
    res.json({ timeZone: user.timeZone || '' });
  } catch { res.status(500).json({ message: 'Could not save your time zone.' }); }
});
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
    const deleted = await resetAccountWorkspace({ userId, models: { Todo, PDF, Folder, PDFFolder, User, CalendarEntry }, startSession: () => mongoose.startSession() });
    res.json({ message: 'Account workspace reset.', deleted });
  } catch (error) {
    const unsupported = /Transaction numbers|replica set|mongos/i.test(error.message);
    res.status(503).json({ message: unsupported ? 'Reset requires a MongoDB replica set or Atlas connection. No data was reset.' : 'Reset could not be confirmed. Refresh your workspace before retrying.' });
  } finally { if (locked) resettingAccounts.delete(userId); }
});

// Get all todos
async function calendarLinksOwned(entry, userId, previous = {}) {
  return validateCalendarLinks(entry, userId, previous, { Todo, PDF });
}
app.get('/api/calendar-entries', authenticateToken, async (req, res) => {
  try { res.json(await CalendarEntry.find({ user: req.user.userId }).sort({ startDate: 1, startAt: 1 })); }
  catch { res.status(500).json({ message: 'Could not load your calendar entries.' }); }
});
app.post('/api/calendar-entries', authenticateToken, async (req, res) => {
  let entry;
  try { entry = calendarEntry(req.body); } catch (error) { return res.status(400).json({ message: error.message }); }
  try {
    if (!await calendarLinksOwned(entry, req.user.userId)) return res.status(400).json({ message: 'Choose tasks and active documents from your account.' });
    res.status(201).json(await CalendarEntry.create({ ...entry, user: req.user.userId }));
  }
  catch { res.status(500).json({ message: 'Could not create the calendar entry.' }); }
});
app.put('/api/calendar-entries/:id', authenticateToken, async (req, res) => {
  let entry;
  try { entry = calendarEntry(req.body); } catch (error) { return res.status(400).json({ message: error.message }); }
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid calendar entry.' });
  try {
    const current = await CalendarEntry.findOne({ _id: req.params.id, user: req.user.userId });
    if (!current) return res.status(404).json({ message: 'Calendar entry not found.' });
    if (!await calendarLinksOwned(entry, req.user.userId, current)) return res.status(400).json({ message: 'Choose tasks and active documents from your account.' });
    const updated = await CalendarEntry.findOneAndUpdate({ _id: req.params.id, user: req.user.userId }, { $set: entry }, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ message: 'Calendar entry not found.' });
    res.json(updated);
  } catch { res.status(500).json({ message: 'Could not update the calendar entry.' }); }
});
app.delete('/api/calendar-entries/:id', authenticateToken, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid calendar entry.' });
  try {
    const removed = await CalendarEntry.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
    if (!removed) return res.status(404).json({ message: 'Calendar entry not found.' });
    res.json({ id: removed._id });
  } catch { res.status(500).json({ message: 'Could not delete the calendar entry.' }); }
});

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
    if (dueDate !== undefined) {
      updateData.dueDate = dueDate;
      const current = await Todo.findOne({ _id: req.params.id, user: req.user.userId });
      if (current && (current.dueDate?.getTime() ?? null) !== (dueDate ? new Date(dueDate).getTime() : null)) Object.assign(updateData, { calendarEndDate: null, calendarAllDay: false, calendarDate: null, calendarLastDate: null });
    }

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
      const { items: testResponse } = await fetchCanvasPage(canvasUrl, canvasToken, '/api/v1/calendar_events?per_page=1');

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
const fetchCanvasPage = (canvasUrl, canvasToken, endpoint) => {
  return new Promise((resolve, reject) => {
    try {
      // Ensure canvasUrl doesn't have trailing slash
      const cleanUrl = canvasUrl.replace(/\/$/, '');
      const url = new URL(endpoint, cleanUrl);

      const options = {
        headers: {
          'Authorization': `Bearer ${canvasToken}`,
          'Accept': 'application/json+canvas-string-ids'
        }
      };




      const request = https.get(url, options, (res) => {
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

            resolve({ items: parsed, link: res.headers.link });
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
      request.setTimeout(20000, () => request.destroy(new Error('Canvas request timed out.')));
    } catch (e) {

      reject(new Error(`Invalid Canvas URL: ${e.message}`));
    }
  });
};

const fetchFromCanvas = (canvasUrl, canvasToken, endpoint) => collectCanvasPages(canvasUrl, canvasToken, endpoint, fetchCanvasPage);

// Sync Canvas data
app.post('/api/canvas/sync', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !user.canvasUrl || !user.canvasToken) {
      return res.status(400).json({ message: 'Canvas credentials not configured' });
    }


    let syncedCount = 0;
    let errors = [];
    let courseContexts = [];

    // Fetch courses first
    try {

      const courses = await fetchFromCanvas(user.canvasUrl, user.canvasToken, '/api/v1/courses?per_page=100');
      courseContexts = courses.map(course => `course_${course.id}`);


      for (const course of courses) {
        try {

          // Fetch assignments for this course
          const courseAssignments = await fetchFromCanvas(
            user.canvasUrl,
            user.canvasToken,
            `/api/v1/courses/${course.id}/assignments?per_page=100`
          );



          for (const assignment of courseAssignments) {
            const existingTodo = await Todo.findOne(canvasIdentity(req.user.userId, assignment, 'assignment'));

            if (!existingTodo) {
              const todo = new Todo({
                ...canvasTaskFields(assignment, 'assignment', course.name),
                description: assignment.description || '',
                links: assignment.html_url ? [assignment.html_url] : [],
                status: 'todo',
                user: req.user.userId,
                canvasId: String(assignment.id),
                canvasType: 'assignment'
              });
              await todo.save();
              syncedCount++;

            } else {
              Object.assign(existingTodo, canvasTaskFields(assignment, 'assignment', course.name));
              await existingTodo.save(); syncedCount++;
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
        '/api/v1/calendar_events?type=event&all_events=true&per_page=100'
      );
      for (let index = 0; index < courseContexts.length; index += 10) {
        const query = new URLSearchParams({ type: 'event', all_events: 'true', per_page: '100' });
        courseContexts.slice(index, index + 10).forEach(context => query.append('context_codes[]', context));
        try { calendarEvents.push(...await fetchFromCanvas(user.canvasUrl, user.canvasToken, `/api/v1/calendar_events?${query}`)); }
        catch (error) { errors.push(`Course calendar events: ${error.message}`); }
      }
      const seenEvents = new Set();
      for (const event of calendarEvents) {
        if (!event.start_at || event.hidden || event.workflow_state === 'deleted' || seenEvents.has(String(event.id))) continue;
        seenEvents.add(String(event.id));

        const existingTodo = await Todo.findOne(canvasIdentity(req.user.userId, event, 'calendar_event'));

        if (!existingTodo) {
          const todo = new Todo({
            ...canvasTaskFields(event, 'calendar_event'),
            description: event.description || '',
            links: event.html_url ? [event.html_url] : [],
            status: 'todo',
            user: req.user.userId,
            canvasId: String(event.id),
            canvasType: 'calendar_event'
          });
          await todo.save();
          syncedCount++;

        } else {
          Object.assign(existingTodo, canvasTaskFields(event, 'calendar_event'));
          await existingTodo.save(); syncedCount++;
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


    const events = parseCalendarICS(icsContent);


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
      const existingTodo = await Todo.findOne({ user: req.user.userId, ...(event.uid ? { canvasType: 'calendar_event', $or: [{ canvasId: `ics:${event.uid}` }, { canvasId: null, text: event.summary, dueDate: event.startDate }] } : { text: event.summary, dueDate: event.startDate }) });

      if (!existingTodo) {
        const todo = new Todo({
          text: event.summary,
          description: event.description || '',
          links: event.url ? [event.url] : [],
          status: new Date(event.startDate) < new Date() ? 'todo' : 'todo',
          user: req.user.userId,
          dueDate: new Date(event.startDate),
          calendarEndDate: event.endDate || null,
          calendarAllDay: !!event.allDay,
          calendarDate: event.calendarDate,
          calendarLastDate: event.calendarLastDate || null,
          canvasId: event.uid ? `ics:${event.uid}` : null,
          folder: folderId,
          canvasType: 'calendar_event'
        });
        await todo.save();
        importedCount++;
      } else {
        Object.assign(existingTodo, { text: event.summary, dueDate: event.startDate, calendarEndDate: event.endDate || null, calendarAllDay: !!event.allDay, calendarDate: event.calendarDate, calendarLastDate: event.calendarLastDate || null, ...(event.uid ? { canvasId: `ics:${event.uid}` } : {}) });
        await existingTodo.save(); importedCount++;
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
  const colors = ['#64788b', '#78808b', '#7c8980', '#978975', '#8d7c7c', '#6d7d80'];
  let hash = 0;
  for (let i = 0; i < courseName.length; i++) {
    hash = courseName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

app.use((error, req, res, next) => {
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Files must be smaller than 10 MB.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ message: 'This document and its edits are too large to save together.' });
  next(error);
});

app.listen(PORT);
