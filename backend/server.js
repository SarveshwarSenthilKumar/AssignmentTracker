require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

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

// Auth Middleware
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
    const { text, folder } = req.body;
    if (!text) {
      return res.status(400).json({ message: 'Text is required' });
    }
    const todo = new Todo({ text, folder, user: req.user.userId });
    await todo.save();
    res.status(201).json(todo);
  } catch (error) {
    res.status(500).json({ message: 'Error creating todo', error: error.message });
  }
});

// Update a todo
app.put('/api/todos/:id', authenticateToken, async (req, res) => {
  try {
    const { status, description, links, text } = req.body;
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
app.delete('/api/todos/:id', authenticateToken, async (req, res) => {
  try {
    const todo = await Todo.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
    if (!todo) {
      return res.status(404).json({ message: 'Todo not found' });
    }
    res.json({ message: 'Todo deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting todo', error: error.message });
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
    await Todo.deleteMany({ folder: req.params.id, user: req.user.userId });
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
      console.log('Test failed: Canvas credentials not provided in request');
      return res.status(400).json({ success: false, error: 'Canvas credentials not provided' });
    }

    console.log('Testing Canvas connection with provided credentials');
    console.log('Canvas URL:', canvasUrl);

    try {
      // Test with calendar endpoint instead (may have different permissions)
      const testResponse = await fetchFromCanvas(canvasUrl, canvasToken, '/api/v1/calendar_events?per_page=1');
      console.log('Test response:', testResponse);
      res.json({ 
        success: true, 
        message: 'Canvas connection successful',
        response: Array.isArray(testResponse) ? `Found ${testResponse.length} calendar events` : 'Response received'
      });
    } catch (e) {
      console.log('Test fetch error:', e);
      res.status(400).json({ 
        success: false, 
        message: 'Canvas connection failed',
        error: e.message
      });
    }
  } catch (error) {
    console.log('Test endpoint error:', error);
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
      
      console.log(`Fetching from Canvas: ${url.href}`);
      console.log(`Token length: ${canvasToken.length} characters`);
      
      https.get(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log(`Canvas response status: ${res.statusCode}`);
          console.log(`Canvas response length: ${data.length} bytes`);
          console.log(`Canvas response headers:`, res.headers);
          
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
            console.log(`Successfully parsed JSON, type: ${Array.isArray(parsed) ? 'array' : typeof parsed}`);
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
        console.error('Canvas fetch error:', e);
        reject(new Error(`Canvas API request failed: ${e.message}`));
      });
    } catch (e) {
      console.error('Canvas URL error:', e);
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

    console.log('Starting Canvas sync for user:', req.user.userId);
    let syncedCount = 0;
    let errors = [];

    // Fetch courses first
    try {
      console.log('Fetching courses...');
      const courses = await fetchFromCanvas(user.canvasUrl, user.canvasToken, '/api/v1/courses?per_page=100');
      console.log(`Found ${courses.length} courses`);
      
      for (const course of courses) {
        try {
          console.log(`Fetching assignments for course: ${course.name} (ID: ${course.id})`);
          // Fetch assignments for this course
          const courseAssignments = await fetchFromCanvas(
            user.canvasUrl, 
            user.canvasToken, 
            `/api/v1/courses/${course.id}/assignments?per_page=100`
          );
          
          console.log(`Found ${courseAssignments.length} assignments for ${course.name}`);
          
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
              console.log(`Synced assignment: ${assignment.name}`);
            } else {
              console.log(`Skipping duplicate assignment: ${assignment.name}`);
            }
          }
        } catch (e) {
          console.error(`Error fetching assignments for course ${course.id}:`, e);
          errors.push(`Course ${course.name}: ${e.message}`);
        }
      }
    } catch (e) {
      console.error('Error fetching courses:', e);
      errors.push(`Courses: ${e.message}`);
    }

    // Fetch calendar events
    try {
      console.log('Fetching calendar events...');
      const calendarEvents = await fetchFromCanvas(
        user.canvasUrl,
        user.canvasToken,
        '/api/v1/calendar_events?per_page=100'
      );
      
      console.log(`Found ${calendarEvents.length} calendar events`);
      
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
          console.log(`Synced calendar event: ${event.title}`);
        } else {
          console.log(`Skipping duplicate calendar event: ${event.title}`);
        }
      }
    } catch (e) {
      console.error('Error fetching calendar events:', e);
      errors.push(`Calendar events: ${e.message}`);
    }

    // Update last sync time
    await User.findByIdAndUpdate(req.user.userId, { lastCanvasSync: new Date() });

    console.log(`Canvas sync complete. Synced ${syncedCount} items. Errors: ${errors.length}`);
    
    res.json({ 
      message: `Synced ${syncedCount} items from Canvas`, 
      syncedCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Canvas sync error:', error);
    res.status(500).json({ message: 'Error syncing Canvas data', error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
