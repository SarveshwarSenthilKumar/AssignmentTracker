const taskSchedule=require('./taskSchedule');
const taskDueDate=require('./taskDueDate');
const {registerAIAccess,category:aiFileCategory,restrictRequest:restrictAIRequest,restrictContext:restrictAIContext}=require('./aiAccess');
const {extractEditorActions}=require('./assistantEditor');
require('dotenv').config({path:require('node:path').join(__dirname,'.env')});
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
const { registerTxstCalendar } = require('./txstCalendar');
const { createCalendarHistory } = require('./calendarHistory');
const { registerMathRecognition } = require('./mathRecognition');
const { registerGeneratedDocuments } = require('./generatedDocuments');
const { calendarLinksOwned: validateCalendarLinks } = require('./calendarLinks');
const { collectCanvasPages } = require('./canvasPagination');
const { parseCalendarICS } = require('./calendarICS');
const { canvasIdentity, canvasTaskFields } = require('./canvasTasks');
const { assistantRequest, workspaceContext, responsePayload, responseText, responseSources } = require('./assistant');
const { diagnostic, callAssistantAPI, AssistantAPIError, safeMessage } = require('./assistantDiagnostics');
const { randomUUID } = require('node:crypto');
const { createAssistantCredentials } = require('./assistantCredentials');
const { registerWorkspaceSettings } = require('./workspaceSettings');
const { AssistantConversation, registerConversationRoutes, prepareConversation, finishConversation } = require('./assistantConversations');

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
const TERMS_VERSION='1.4';
const userSchema = new mongoose.Schema({
  termsAcceptance:{version:String,acceptedAt:Date,method:String},
  socialConnections: { type: mongoose.Schema.Types.Mixed, select: false, default: ()=>({}) },
  socialConnectionVersions: { type: mongoose.Schema.Types.Mixed, select: false, default: ()=>({}) },
  aiAccess: { type: mongoose.Schema.Types.Mixed, default: ()=>({}) },
  calendarColors: { type: Map, of: String, default: {} },
  calendarCategories:{type:[new mongoose.Schema({id:String,name:String,color:String},{_id:false})],default:[]},
  hiddenCalendarIds: { type: [String], default: [] },
  calendarHistoryRevision: { type: Number, default: 0 },
  folderHierarchyRevision:{type:Number,default:0},
  searchIndexRevision:{type:Number,default:0},
  hideTxstEvents: { type: Boolean, default: false },
  workflowLayout: { type: mongoose.Schema.Types.Mixed, select: false },
  workflowRevision: { type: Number, default: 0, select: false },
  geminiApiKeyEncrypted: { type: String, select: false },
  geminiApiKeyLastFour: { type: String, select: false },
  geminiApiKeyUpdatedAt: { type: Date, select: false },
  timeZone: { type: String, default: '' },
  confirmTaskDeletion: { type: Boolean, default: true },
  confirmOtherActions: { type: Boolean, default: true },
  showInProgressColumn: { type: Boolean, default: true },
  taskSortBy:{type:String,enum:['dueDate','manual','createdAt','completedAt','text','status'],default:'dueDate'},
  taskSortOrder:{type:String,enum:['asc','desc'],default:'asc'},
  studyPhoneEnabled: { type: Boolean, default: true },
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
const assistantCredentials = createAssistantCredentials(User);

// Folder Schema
const folderSchema = new mongoose.Schema({
  attachmentIds:[{type:mongoose.Schema.Types.ObjectId,ref:'PDF'}],
  description:{type:String,default:'',maxlength:2000},
  parentId:{type:mongoose.Schema.Types.ObjectId,ref:'Folder',default:null,index:true},
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
  manualOrder: { type: Number, default: null },
  scheduledDate:{type:String,default:null},
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
  seriesId: { type: String, index: true },
  seriesRule: { type: mongoose.Schema.Types.Mixed },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, maxlength: 200 },
  kind: { type: String, enum: ['appointment','marker','sports'], required: true },
  sports:{type:new mongoose.Schema({sport:{type:String,maxlength:120},league:{type:String,maxlength:120},team:{type:String,maxlength:120},opponent:{type:String,maxlength:120}},{_id:false}),default:null},
  externalId:{type:String,maxlength:200,index:true},
  categoryId:{type:String,default:null,maxlength:36},
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
  attachmentIds:[{type:mongoose.Schema.Types.ObjectId,ref:'PDF'}],
  parentId:{type:mongoose.Schema.Types.ObjectId,ref:'PDFFolder',default:null,index:true},
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
// Fail promptly rather than buffering authentication queries while MongoDB is offline.
app.use(['/api/auth/login','/api/auth/register'], (req,res,next)=>{
  res.set('Cache-Control','no-store');
  if(!process.env.JWT_SECRET)return res.status(503).json({message:'Sign-in is unavailable because the backend is missing JWT_SECRET. Configure it and restart the backend.'});
  if(mongoose.connection.readyState!==1)return res.status(503).json({message:'The account database is not connected yet. Check the backend MongoDB configuration and try again shortly.'});
  next();
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if(req.body.termsAccepted!==true||req.body.termsReviewed!==true)return res.status(428).json({message:'Review and agree to the Terms and Conditions before creating an account.'});
    if(req.body.termsVersion!==TERMS_VERSION)return res.status(409).json({message:'The Terms and Conditions version has changed. Refresh the page, review the current version and agree again.'});

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword,termsAcceptance:{version:TERMS_VERSION,acceptedAt:new Date(),method:'signup-checkbox'} });
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
        studyPhoneEnabled: user.studyPhoneEnabled!==false,
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
        studyPhoneEnabled: user.studyPhoneEnabled!==false,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
});

// Routes
const StudyItem=require('./study')(app,authenticateToken,{mongoose,AssistantConversation});
const SavedJob=require('./jobs')(app,authenticateToken,mongoose);
require('./globalSearch')(app,authenticateToken,{mongoose,User,Todo,PDF,Folder,PDFFolder,CalendarEntry,SavedJob,AssistantConversation,StudyItem});
const aiRequests = new Map();
const aiModel = () => process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash';
require('./accountConnections')(app,authenticateToken,{User,mongoose});
const requireAIAccess=registerAIAccess(app,authenticateToken,User);
require('./jobFileImport')(app,authenticateToken,{credentials:assistantCredentials,model:aiModel,requireAIAccess});
require('./coverLetterGeneration')(app,authenticateToken,{PDF,SavedJob,mongoose,credentials:assistantCredentials,model:aiModel,requireAIAccess});
require('./coverLetterGeneration')(app,authenticateToken,{PDF,SavedJob,mongoose,credentials:assistantCredentials,model:aiModel,requireAIAccess,documentType:'resume'});
require('./resumeQuiz')(app,authenticateToken,{PDF,mongoose,credentials:assistantCredentials,model:aiModel,requireAIAccess});
require('./pdfCleanup')(app,authenticateToken,{PDF,mongoose,credentials:assistantCredentials,model:aiModel,requireAIAccess});
app.use('/api/assistant/chat',authenticateToken,requireAIAccess());
app.use('/api/assistant/test',authenticateToken,requireAIAccess());
app.use('/api/documents/generate',authenticateToken,requireAIAccess('generation'));
app.use('/api/calculator/recognize',authenticateToken,requireAIAccess('recognition'));
registerMathRecognition(app,authenticateToken,assistantCredentials,aiModel);
registerGeneratedDocuments(app,authenticateToken,{credentials:assistantCredentials,model:aiModel,PDF,PDFFolder,mongoose});
require('./oneNoteImport').registerOneNoteImport(app, authenticateToken, upload);
function aiState(userId) {
  const now = Date.now();
  for (const [id, state] of aiRequests) if (!state.busy && now - state.start >= 600000) aiRequests.delete(id);
  let state = aiRequests.get(userId);
  if (!state) { state = { start:now, count:0, busy:false, testStart:now, testCount:0, lastResult:null }; aiRequests.set(userId,state); }
  return state;
}
function aiFailure(res,state,status,category,message,action,extra={}) {
  const report=diagnostic(category,message,action,{model:safeMessage(aiModel(),[process.env.GEMINI_API_KEY]),...extra,httpStatus:status});
  if (state) state.lastResult=report;
  res.set('X-Assistant-Trace-Id',report.traceId);
  if (report.retryable && report.retryAfterSeconds) res.set('Retry-After',String(report.retryAfterSeconds));
  res.status(status).json({message:report.message,diagnostics:report});
}
assistantCredentials.registerRoutes(app,authenticateToken,userId=>{const state=aiRequests.get(userId);if(state)state.lastResult=null});
registerWorkspaceSettings(app,authenticateToken,User);
require('./phoneReference')(app,authenticateToken);
async function aiCredential(req,res,state,traceId){
  let credential;
  try{credential=await assistantCredentials.resolve(req.user.userId)}catch{aiFailure(res,state,503,'configuration','Could not load your saved AI settings.','Try again or review AI settings on the Account page.',{traceId,stage:'configuration'});return null}
  if(credential.accountMissing){aiFailure(res,state,404,'account_unavailable','Account not found.','Sign in again.',{traceId,stage:'configuration'});return null}
  if(!credential.apiKey){aiFailure(res,state,503,'configuration',credential.needsReplacement?'Your saved Gemini key needs to be replaced.':'The assistant is not connected yet.',credential.needsReplacement?'Replace your API key in Account → AI settings. The saved credential could not be decrypted.':'Add your Gemini API key in Account → AI settings.',{traceId,stage:'configuration'});return null}
  return credential;
}
app.get('/api/assistant/status', authenticateToken, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try{
    const state=aiState(String(req.user.userId)),credential=await assistantCredentials.resolve(req.user.userId);
    if(credential.accountMissing)return res.status(404).json({message:'Account not found.'});
    res.json({...assistantCredentials.describe(credential),model:safeMessage(aiModel(),[credential.apiKey]),lastResult:state.lastResult,limits:{used:state.count,limit:20,windowSeconds:600,resetAt:new Date(state.start+600000).toISOString(),inProgress:state.busy}});
  }catch{res.status(503).json({message:'Could not load AI connection settings.'})}
});
app.post('/api/assistant/test', authenticateToken, async (req,res) => {
  res.set('Cache-Control','no-store');
  const state=aiState(String(req.user.userId)),traceId=randomUUID();
  const credential=await aiCredential(req,res,state,traceId);if(!credential)return;
  if (state.busy) return aiFailure(res,null,409,'request_in_progress','Another AI request is still running for this account.','Wait for it to finish or stop the request in the tab where it started.',{traceId,retryable:true,retryAfterSeconds:1,stage:'application'});
  if (Date.now()-state.testStart>=60000) { state.testStart=Date.now();state.testCount=0; }
  if (state.testCount>=5) return aiFailure(res,state,429,'test_limit','The API connection test limit was reached.','Wait for the test timer before checking again.',{traceId,retryable:true,retryAfterSeconds:Math.ceil((state.testStart+60000-Date.now())/1000),stage:'application'});
  state.testCount++;state.busy=true;
  let providerReport=null;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
  const disconnected=()=>{if(!res.writableEnded)controller.abort()};res.on('close',disconnected);
  try {
    const result=await callAssistantAPI({model:aiModel(),contents:[{role:'user',parts:[{text:'Reply with OK.'}]}],generationConfig:{maxOutputTokens:1024},store:false},{apiKey:credential.apiKey,signal:controller.signal,traceId,metadata:{kind:'connection_test'}});
    providerReport=result.diagnostics;
    responseText(result.data);
    state.lastResult={...result.diagnostics,httpStatus:200};res.set('X-Assistant-Trace-Id',traceId);res.json({configured:true,model:result.diagnostics.model,diagnostics:state.lastResult});
  } catch(error) {
    if(!res.destroyed){if(error instanceof AssistantAPIError){state.lastResult={...error.diagnostics,httpStatus:error.status};res.set('X-Assistant-Trace-Id',traceId);res.status(error.status).json({message:error.message,diagnostics:state.lastResult});}else aiFailure(res,state,502,'empty_response','The API responded without a usable answer.','Check the configured model and its output token requirements.',{traceId,stage:'parse_answer',source:'gemini',providerStatus:providerReport?.providerStatus,providerRequestId:providerReport?.providerRequestId,inputTokens:providerReport?.inputTokens,outputTokens:providerReport?.outputTokens});}
  } finally {clearTimeout(timeout);res.off('close',disconnected);state.busy=false;if(res.destroyed&&!res.writableEnded)res.end();}
});
registerConversationRoutes(app, authenticateToken);
app.post('/api/assistant/chat', authenticateToken, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const userId=String(req.user.userId),state=aiState(userId),traceId=randomUUID(),started=Date.now();
  let request,stage='validation',providerReport=null,turn=null,turnFinished=false;
  try { request = assistantRequest({...req.body,messages:[{role:'user',content:req.body.regenerate===true?'Regenerate the last answer.':req.body.question}]}); } catch (error) { return aiFailure(res,state,400,'validation',error.message,'Review the question and context options, then try again.',{traceId,stage}); }
  const credential=await aiCredential(req,res,state,traceId);if(!credential)return;
  if (state.busy) return aiFailure(res,null,409,'request_in_progress','Another AI request is still running for this account.','Wait for it to finish or stop the request in the tab where it started.',{traceId,retryable:true,retryAfterSeconds:1,stage:'application'});
  if (state.count >= 20) return aiFailure(res,state,429,'app_limit','This account reached the app’s chat request limit.','Wait until the application limit resets. This is separate from Gemini billing and rate limits.',{traceId,retryable:true,retryAfterSeconds:Math.ceil((state.start+600000-Date.now())/1000),stage:'application'});
  state.busy = true; state.count++;
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 60000);
  const disconnected = () => { if (!res.writableEnded) controller.abort(); };
  res.on('close', disconnected);
  try {
    stage='load_conversation';
    turn=await prepareConversation(userId,req.body);request.messages=turn.history;restrictAIRequest(request,req.aiAccess);
    stage='load_workspace';
    const user = await User.findById(userId).select('username email timeZone createdAt canvasUrl lastCanvasSync').lean();
    if (!user) { await finishConversation(turn,null,'Account not found.');turnFinished=true;return aiFailure(res,state,404,'account_unavailable','Account not found.','Sign in again and retry.',{traceId,stage}); }
    let tasks=[],entries=[],documents=[],folders=[],documentFolders=[],totals={};
    if (request.includeWorkspace) {
      const owner = { user: userId }, active = { user: userId, deletedAt: null };
      const results = await Promise.all([
        Todo.find(owner).select('text description status dueDate scheduledDate folder dependsOn links calendarDate calendarAllDay calendarEndDate calendarLastDate calendarLocation calendarContext').sort({updatedAt:-1,createdAt:-1}).limit(250).lean(),
        CalendarEntry.find(owner).sort({updatedAt:-1}).limit(250).lean(),
        PDF.find(active).select('name originalName mimeType pdfFolder taskIds todo updatedAt tags').sort({updatedAt:-1}).limit(200).lean(),
        Folder.find(owner).select('name').limit(100).lean(), PDFFolder.find(owner).select('name').limit(100).lean(),
        Todo.countDocuments(owner), CalendarEntry.countDocuments(owner), PDF.countDocuments(active)
      ]);
      [tasks,entries,documents,folders,documentFolders]=results;
      totals={tasks:results[5],calendarEntries:results[6],documents:results[7],includedTasks:tasks.length,includedCalendarEntries:entries.length,includedDocuments:documents.length};
    }
    let file=[];
    const fileIds=[...new Set([...request.documentIds,...(request.includeDocument&&request.documentId?[request.documentId]:[])])];
    if(fileIds.length){
      stage='read_document';
      file=await PDF.find({_id:{$in:fileIds},user:userId,deletedAt:null}).select('name originalName mimeType pdfData tags');
      if(file.length!==fileIds.length){await finishConversation(turn,null,'One or more attached documents are unavailable. Remove them and retry.');turnFinished=true;return aiFailure(res,state,404,'document_unavailable','An attached document is unavailable or does not belong to your account.','Remove unavailable attachments or turn off open-file context, then resend.',{traceId,stage});}
      if(file.some(item=>!req.aiAccess[aiFileCategory(item)])){
        await finishConversation(turn,null,'A selected file category is disabled in Account → AI access.');turnFinished=true;
        return res.status(403).json({message:'A selected file category is disabled in Account → AI access. Remove that file or update your access settings.'});
      }
      file.sort((a,b)=>fileIds.indexOf(String(a._id))-fileIds.indexOf(String(b._id)));
      if(file.reduce((total,item)=>total+(item.pdfData?.length||0),0)>20*1024*1024){await finishConversation(turn,null,'Attached files exceed the combined 20 MB limit. Remove a file and retry.');turnFinished=true;return aiFailure(res,state,400,'file_limit','Attached files exceed the combined 20 MB limit.','Remove a file and retry.',{traceId,stage});}
      turn.messages.at(-1).attachments=file.map(item=>({id:String(item._id),name:String(item.name||'Attached file').slice(0,200),mimeType:item.mimeType}));
    }
    if (controller.signal.aborted) { if (res.destroyed) return; throw new Error('Request timed out.'); }
    const context = restrictAIContext(workspaceContext({user,tasks,entries,documents:documents.filter(file=>req.aiAccess[aiFileCategory(file)]),folders,documentFolders,totals},request),req.aiAccess);
    const payload=await responsePayload(request,context,file,aiModel());stage='gemini';
    const result=await callAssistantAPI(payload,{apiKey:credential.apiKey,signal:controller.signal,traceId,metadata:{kind:'chat',requestBytes:Buffer.byteLength(JSON.stringify(payload)),workspaceCharacters:JSON.stringify(context).length,screenCharacters:request.screen.length,historyMessages:request.messages.length,fileBytes:file.reduce((total,item)=>total+(item.pdfData?.length||0),0)}});
    providerReport=result.diagnostics;
    stage='parse_answer';const data=result.data,parsedEditor=extractEditorActions(responseText(data),request.editor),text=parsedEditor.text;state.lastResult={...result.diagnostics,httpStatus:200,totalElapsedMs:Date.now()-started};
    res.set('X-Assistant-Trace-Id',traceId);
    const answer={content:text,sources:responseSources(text,context).slice(0,40),context:{...(context.totals||{}),section:request.section,screenIncluded:request.includeScreen,workspaceIncluded:request.includeWorkspace,document:context.openDocument||null,documents:context.openDocuments||[],historyMessages:request.messages.length},partial:data.candidates?.[0]?.finishReason==='MAX_TOKENS'||text.length===12000};
    stage='save_conversation';const conversation=await finishConversation(turn,answer);turnFinished=true;
    res.json({text,editorActions:parsedEditor.actions,sources:answer.sources,diagnostics:state.lastResult,context:answer.context,partial:answer.partial,conversation});
  } catch (error) {
    if(turn&&!turnFinished){try{await finishConversation(turn,null,controller.signal.aborted?'Request stopped or timed out. Retry your question.':'The reply could not be completed. Retry your question.');turnFinished=true;}catch{}}
    if (!res.destroyed) {
      if(stage==='load_conversation')return aiFailure(res,state,error.status||500,'conversation',error.status?error.message:'Could not load the saved conversation.','Reopen the chat and try again.',{traceId,stage});
      if(stage==='save_conversation')return aiFailure(res,state,503,'conversation_save','The answer could not be saved.','Reopen the chat to check its saved state before retrying.',{traceId,stage});
      if(error instanceof AssistantAPIError){state.lastResult={...error.diagnostics,httpStatus:error.status,totalElapsedMs:Date.now()-started};res.set('X-Assistant-Trace-Id',traceId);if(error.diagnostics.retryable&&error.diagnostics.retryAfterSeconds)res.set('Retry-After',String(error.diagnostics.retryAfterSeconds));res.status(error.status).json({message:error.message,diagnostics:state.lastResult});}
      else aiFailure(res,state,502,controller.signal.aborted?'timeout':stage==='parse_answer'?'empty_response':'workspace_unavailable',controller.signal.aborted?'The AI request timed out.':stage==='parse_answer'?'Gemini returned no usable answer.':'Could not load workspace context for the assistant.',controller.signal.aborted?'Try a smaller request.':stage==='parse_answer'?'Try another question or check the model’s output token requirements.':'Check the backend database connection and try again.',{traceId,stage,totalElapsedMs:Date.now()-started,retryable:true,source:providerReport?'gemini':'application',providerStatus:providerReport?.providerStatus,providerRequestId:providerReport?.providerRequestId,inputTokens:providerReport?.inputTokens,outputTokens:providerReport?.outputTokens});
    }
  } finally { if(turn&&!turnFinished){try{await finishConversation(turn,null,'The reply was interrupted. Retry your question.');}catch{}} clearTimeout(timeout); res.off('close',disconnected); state.busy=false; if (res.destroyed && !res.writableEnded) res.end(); }
});
app.get('/api/account/preferences', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('timeZone confirmTaskDeletion confirmOtherActions showInProgressColumn studyPhoneEnabled taskSortBy taskSortOrder');
    if (!user) return res.status(404).json({ message: 'Account not found.' });
    res.json({ timeZone: user.timeZone || '', confirmTaskDeletion:user.confirmTaskDeletion!==false, confirmOtherActions:user.confirmOtherActions!==false, showInProgressColumn:user.showInProgressColumn!==false,studyPhoneEnabled:user.studyPhoneEnabled!==false,taskSortBy:user.taskSortBy||'dueDate',taskSortOrder:user.taskSortOrder||'asc' });
  } catch { res.status(500).json({ message: 'Could not load account preferences.' }); }
});
app.put('/api/account/preferences', authenticateToken, async (req, res) => {
  const { timeZone,confirmTaskDeletion,confirmOtherActions,showInProgressColumn,studyPhoneEnabled,taskSortBy,taskSortOrder } = req.body;
  const update={};
  if(timeZone!==undefined){
  if (typeof timeZone !== 'string' || timeZone.length > 100) return res.status(400).json({ message: 'Choose a valid time zone.' });
  try { if (timeZone) new Intl.DateTimeFormat('en', { timeZone }).format(); }
  catch { return res.status(400).json({ message: 'Choose a valid time zone.' }); }
  update.timeZone=timeZone;
  }
  for(const [key,value] of Object.entries({confirmTaskDeletion,confirmOtherActions,showInProgressColumn,studyPhoneEnabled})){
    if(value===undefined)continue;
    if(typeof value!=='boolean')return res.status(400).json({message:'Preferences must be enabled or disabled.'});
    update[key]=value;
  }
  if(taskSortBy!==undefined){if(!['dueDate','manual','createdAt','completedAt','text','status'].includes(taskSortBy))return res.status(400).json({message:'Choose a valid task sort mode.'});update.taskSortBy=taskSortBy;}
  if(taskSortOrder!==undefined){if(!['asc','desc'].includes(taskSortOrder))return res.status(400).json({message:'Choose a valid sort direction.'});update.taskSortOrder=taskSortOrder;}
  if(!Object.keys(update).length)return res.status(400).json({message:'Choose a preference to update.'});
  try {
    const user = await User.findByIdAndUpdate(req.user.userId, { $set: update }, { new: true }).select('timeZone confirmTaskDeletion confirmOtherActions showInProgressColumn studyPhoneEnabled taskSortBy taskSortOrder');
    if (!user) return res.status(404).json({ message: 'Account not found.' });
    res.json({ timeZone: user.timeZone || '',confirmTaskDeletion:user.confirmTaskDeletion!==false,confirmOtherActions:user.confirmOtherActions!==false, showInProgressColumn:user.showInProgressColumn!==false,studyPhoneEnabled:user.studyPhoneEnabled!==false,taskSortBy:user.taskSortBy||'dueDate',taskSortOrder:user.taskSortOrder||'asc' });
  } catch { res.status(500).json({ message: 'Could not save your account preferences.' }); }
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
    const deleted = await resetAccountWorkspace({ userId, models: { FeatureSuggestion:mongoose.models.FeatureSuggestion, BugReport:mongoose.models.BugReport, EventAttendance:mongoose.models.EventAttendance, StudyItem, SavedJob, Todo, PDF, Folder, PDFFolder, User, CalendarEntry, AssistantConversation, CalendarChange: calendarHistory.Change, TaskDeletionRecovery: taskRecovery.Recovery, ResumeDraft:mongoose.models.ResumeDraft, CoverLetterDraft:mongoose.models.CoverLetterDraft, DocumentSearchIndex:mongoose.models.DocumentSearchIndex }, startSession: () => mongoose.startSession() });
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
const calendarHistory = createCalendarHistory({mongoose,User,CalendarEntry});
require('./calendarCategories')(app,authenticateToken,{User,CalendarEntry,history:calendarHistory});
require('./calendarColors').registerCalendarColors(app,authenticateToken,{User,Todo,CalendarEntry,history:calendarHistory});
require('./calendarSeries').registerCalendarSeries(app,authenticateToken,{CalendarEntry,history:calendarHistory,linksOwned:calendarLinksOwned});
calendarHistory.register(app,authenticateToken);
require('./f1Calendar')(app,authenticateToken,{CalendarEntry,history:calendarHistory});
registerTxstCalendar(app, authenticateToken, User, calendarHistory);
require('./eventAttendance')(app,authenticateToken,mongoose);
// The hidden update-history page reads the maintained numbered change log.
app.get('/api/logbook',authenticateToken,(req,res)=>{
  res.set({'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Content-Type':'text/markdown; charset=utf-8'});
  res.sendFile(require('node:path').join(__dirname,'..','LOGBOOK.md'),error=>{
    if(error&&!res.headersSent)res.status(error.code==='ENOENT'?404:500).type('application/json').json({message:'The update logbook is unavailable. Include LOGBOOK.md in the server deployment.'});
  });
});

// Unlisted, authenticated documentation. Serve only these fixed repository files.
for(const [route,filename,type]of [
  ['/api/handbook','AssignmentTracker-Product-and-Technical-Handbook.md','text/markdown; charset=utf-8'],
  ['/api/handbook/pdf','AssignmentTracker-Product-and-Technical-Handbook.pdf','application/pdf']
])app.get(route,authenticateToken,(req,res)=>{
  res.set({'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Content-Type':type});
  const file=require('node:path').join(__dirname,'..','output','pdf',filename);
  res.sendFile(file,error=>{if(error&&!res.headersSent)res.status(error.code==='ENOENT'?404:500).type('application/json').json({message:'The handbook file is unavailable on this server. Include the output/pdf handbook files when deploying.'})});
});

app.get('/api/calendar-entries', authenticateToken, async (req, res) => {
  try { res.json(await CalendarEntry.find({ user: req.user.userId }).sort({ startDate: 1, startAt: 1 })); }
  catch { res.status(500).json({ message: 'Could not load your calendar entries.' }); }
});
app.post('/api/calendar-entries', authenticateToken, async (req, res) => {
  let entry;
  try { entry = calendarEntry(req.body); } catch (error) { return res.status(400).json({ message: error.message }); }
  try {
    if (!await calendarLinksOwned(entry, req.user.userId)) return res.status(400).json({ message: 'Choose tasks and active documents from your account.' });
    const created=await calendarHistory.mutate(req.user.userId,'create event',async session=>{
      const [document]=await CalendarEntry.create([{...entry,user:req.user.userId}],{session});
      return {value:document,kind:'entry',entryId:document._id,before:null,after:document.toObject()};
    });
    res.status(201).json(created);
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
    const updated = await calendarHistory.mutate(req.user.userId,'edit event',async session=>{
      const before=await CalendarEntry.findOne({_id:req.params.id,user:req.user.userId}).session(session).lean();
      if(!before)throw new Error('Calendar entry not found.');
      const document=await CalendarEntry.findOneAndUpdate({_id:req.params.id,user:req.user.userId},{$set:entry},{new:true,runValidators:true,session});
      return {value:document,kind:'entry',entryId:document._id,before,after:document.toObject()};
    });
    if (!updated) return res.status(404).json({ message: 'Calendar entry not found.' });
    res.json(updated);
  } catch { res.status(500).json({ message: 'Could not update the calendar entry.' }); }
});
app.delete('/api/calendar-entries/:id', authenticateToken, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid calendar entry.' });
  try {
    const removed = await calendarHistory.mutate(req.user.userId,'delete event',async session=>{
      const document=await CalendarEntry.findOneAndDelete({_id:req.params.id,user:req.user.userId},{session});
      if(!document)throw new Error('Calendar entry not found.');
      return {value:document,kind:'entry',entryId:document._id,before:document.toObject(),after:null};
    });
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
    const { text, folder } = req.body;
    let deadline;try{deadline=taskDueDate(req.body)}catch(error){return res.status(400).json({message:error.message})}
    if (!text) {
      return res.status(400).json({ message: 'Text is required' });
    }
    let scheduledDate=null;try{if(req.body.scheduledDate!==undefined)scheduledDate=taskSchedule(req.body.scheduledDate)}catch(error){return res.status(400).json({message:error.message})}
    const todo = new Todo({ text, folder, user: req.user.userId, ...deadline,scheduledDate });
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

app.post('/api/todos/reorder',authenticateToken,async(req,res)=>{
  const {ids,movedId,status}=req.body||{};
  if(!Array.isArray(ids)||!ids.length||ids.length>10000||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!/^[a-f\d]{24}$/i.test(id))||!ids.includes(movedId)||!['todo','in-progress','completed'].includes(status))return res.status(400).json({message:'Choose valid tasks and a destination column.'});
  const session=await mongoose.startSession();
  const completedAt=status==='completed'?new Date():null;
  try{
    await session.withTransaction(async()=>{
      const count=await Todo.countDocuments({user:req.user.userId,_id:{$in:ids}}).session(session);
      if(count!==ids.length)throw new Error('Some tasks changed or were removed. Refresh and try again.');
      await User.updateOne({_id:req.user.userId},{$set:{taskSortBy:'manual'}},{session});
      await Todo.bulkWrite(ids.map((id,index)=>({updateOne:{filter:{_id:id,user:req.user.userId},update:{$set:{manualOrder:index}}}})),{session});
      const current=await Todo.findOne({_id:movedId,user:req.user.userId}).session(session);
      if(current.status!==status)await Todo.updateOne({_id:movedId,user:req.user.userId},{$set:{status,completedAt}},{session});
    });
    res.json({ids,task:await Todo.findOne({_id:movedId,user:req.user.userId})});
  }catch(error){res.status(409).json({message:error.message||'Could not save task order.'});}finally{await session.endSession();}
});
app.put('/api/todos/:id', authenticateToken, async (req, res) => {
  try {
    const { status, description, links, text, dueDate } = req.body;
    const updateData = {};
    if(req.body.scheduledDate!==undefined){try{updateData.scheduledDate=taskSchedule(req.body.scheduledDate)}catch(error){return res.status(400).json({message:error.message})}}
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

    if(req.body.calendarAllDay!==undefined){try{Object.assign(updateData,taskDueDate(req.body))}catch(error){return res.status(400).json({message:error.message})}}
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

const taskRecovery = require('./taskDeletionRecovery')({ mongoose, Todo, Folder, app, authenticateToken });

// Delete a todo
app.post('/api/todos/bulk-delete', authenticateToken, async (req,res)=>{
  const ids=req.body?.ids;
  if(!Array.isArray(ids)||!ids.length||ids.length>10000||ids.some(id=>typeof id!=='string'||!/^[a-f\d]{24}$/i.test(id)))return res.status(400).json({message:'Select between 1 and 10,000 valid tasks.'});
  try{
    const result=await deleteTasksAndConnections({user:req.user.userId,_id:{$in:[...new Set(ids)]}});
    res.json({message:`Deleted ${result.deletedCount} tasks.`,deletedCount:result.deletedCount,deletedIds:result.deletedIds,undoId:result.undoId});
  }catch{res.status(500).json({message:'Could not complete bulk deletion. Refresh the task list before retrying.'});}
});
app.delete('/api/todos/:id([a-fA-F0-9]{24})', authenticateToken, async (req, res) => {
  try {
    const result = await deleteTasksAndConnections({ _id: req.params.id, user: req.user.userId });
    if (!result.deletedCount) return res.status(404).json({ message: 'Todo not found' });
    res.json({ message: 'Todo deleted successfully', ...result });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting todo', error: error.message });
  }
});

// Delete all todos in a folder
async function deleteTasksAndConnections(filter) {
  return taskRecovery.remove(filter);
}
app.delete('/api/todos/folder/:folderId', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { folder: req.params.folderId, user: req.user.userId };
    if (status) filter.status = status;

    const result = await deleteTasksAndConnections(filter);
    res.json({ message: `Deleted ${result.deletedCount} tasks from folder`, deletedCount: result.deletedCount, undoId: result.undoId });
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
    res.json({ message: `Cleared ${result.deletedCount} tasks from inbox`, deletedCount: result.deletedCount, undoId: result.undoId });
  } catch (error) {
    res.status(500).json({ message: 'Error clearing inbox', error: error.message });
  }
});

// Folder Routes
require('./folderHierarchy')(app,authenticateToken,{mongoose,User,Folder,PDFFolder,Todo,PDF});
require('./folderAttachments')(app,authenticateToken,{mongoose,User,Folder,PDFFolder,PDF,upload});
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

// A clean copy has independent storage and no editor annotation history.
app.post('/api/pdfs/:id/clean-copy', authenticateToken, async (req, res) => {
  try {
    const source = await PDF.findOne({ _id: req.params.id, user: req.user.userId, deletedAt: null });
    if (!source) return res.status(404).json({ message: 'Document not found' });
    const copy = await PDF.create({
      user: req.user.userId,
      name: `${source.name.slice(0, 107)} (clean copy)`,
      originalName: source.originalName,
      mimeType: source.mimeType,
      pdfData: Buffer.from(source.originalBackup || source.pdfData),
      annotations: [],
      tags: source.tags,
      pdfFolder: source.pdfFolder || null
    });
    const metadata = copy.toObject(); delete metadata.pdfData; delete metadata.originalBackup;
    res.status(201).json(metadata);
  } catch (error) {
    res.status(500).json({ message: 'Could not create a clean copy. Please try again.' });
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

require('./accountAnalytics')(app,authenticateToken,mongoose);
require('./siteRoadmap')(app,authenticateToken,mongoose);
require('./bugReports')(app,authenticateToken,mongoose);
require('./featureSuggestions')(app,authenticateToken,mongoose);
require('./adminPortal')(app,authenticateToken,mongoose);

app.use('/api', (req,res)=>res.status(404).json({message:'API endpoint not found. Restart or redeploy the backend after updating the app.'}));
app.use((error,req,res,next)=>{
  if(res.headersSent)return next(error);
  const status=Number(error.status||error.statusCode);
  res.status(status>=400&&status<=599?status:500).json({message:error.type==='entity.parse.failed'?'The request body is not valid JSON.':'The API could not complete this request. Check the backend logs and try again.'});
});

app.listen(PORT,()=>{
  process.stderr.write(`Backend API listening on port ${PORT}.\n`);
  if(process.send)process.send({type:'api-ready'});
}).on('error',error=>{
  process.stderr.write(error.code==='EADDRINUSE'
    ? `Backend port ${PORT} is already in use. Stop the other backend before restarting, or configure another PORT and matching API_PROXY_TARGET.\n`
    : `Backend could not listen (${error.code || 'startup error'}). Check the configured PORT.\n`);
  process.exitCode=1;
  mongoose.disconnect().finally(()=>process.exit(1));
});
