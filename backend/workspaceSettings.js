const NAVIGATION_PAGES = new Set([
  'home', 'workspace', 'tasks', 'calendar', 'documents', 'prep', 'resumes', 'cover-letters', 'jobs', 'bookmarks',
  'detective-wall', 'whiteboards', 'tutorial', 'suggest-feature', 'report-bug', 'roadmap', 'analytics', 'study',
  'assistant', 'visualization', 'canvas', 'shortcuts',
]);
const TYPES = new Set([
  'tasks', 'calendar', 'documents', 'graph', 'notes', 'focus', 'assistant', 'home', 'canvas', 'bookmarks',
  'detective-wall', 'whiteboards', 'study', 'prep', 'resumes', 'cover-letters', 'jobs', 'analytics',
  'tutorial', 'shortcuts', 'account', 'roadmap', 'report-bug', 'suggest-feature', 'handbook', 'logbook',
]);
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value);
const number=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
function cleanLayout(value){
  if(!value||Buffer.byteLength(JSON.stringify(value),'utf8')>250000||!Array.isArray(value.tabs)||!value.tabs.length||value.tabs.length>8)throw new Error('Use between 1 and 8 workspace tabs and keep saved content under 250 KB.');
  const ids=new Set();
  const unique=value=>{if(!id(value)||ids.has(value))throw new Error('Invalid or duplicate workspace item.');ids.add(value);return value;};
  const tabs=value.tabs.map(tab=>{
    if(typeof tab.title!=='string'||!tab.title.trim()||tab.title.length>60||!Array.isArray(tab.windows)||tab.windows.length>10)throw new Error('Each tab needs a title and supports up to 10 windows.');
    const windows=tab.windows.map(win=>{
      if(!Array.isArray(win.panes)||!win.panes.length||win.panes.length>6||!number(win.x,0,5000)||!number(win.y,0,5000)||!number(win.width,240,5000)||!number(win.height,180,5000))throw new Error('Invalid window dimensions or tool tabs.');
      const panes=win.panes.map(pane=>{
        if(!TYPES.has(pane.type)||typeof (pane.note??'')!=='string'||(pane.note||'').length>12000)throw new Error('Invalid tool or note. Notes support up to 12,000 characters.');
        return {id:unique(pane.id),type:pane.type,note:pane.type==='notes'?pane.note||'':''};
      });
      if(!panes.some(pane=>pane.id===win.activePaneId))throw new Error('Choose an active tool tab.');
      return {id:unique(win.id),panes,activePaneId:win.activePaneId,x:win.x,y:win.y,width:win.width,height:win.height,minimized:!!win.minimized,maximized:!!win.maximized};
    });
    return {id:unique(tab.id),title:tab.title.trim(),windows,activeWindowId:windows.some(win=>win.id===tab.activeWindowId)?tab.activeWindowId:windows.at(-1)?.id||null};
  });
  if(!tabs.some(tab=>tab.id===value.activeTabId))throw new Error('Choose an active workspace tab.');
  return {version:1,tabs,activeTabId:value.activeTabId,preferences:{snap:value.preferences?.snap!==false,grid:value.preferences?.grid!==false,density:value.preferences?.density==='compact'?'compact':'comfortable',canvasHeight:[720,1000,1400].includes(value.preferences?.canvasHeight)?value.preferences.canvasHeight:1000}};
}
function cleanProfiles(value) {
  if (!Array.isArray(value?.profiles) || !value.profiles.length || value.profiles.length > 8 ||
      Buffer.byteLength(JSON.stringify(value), 'utf8') > 2100000) {
    throw new Error('Save between 1 and 8 workspace profiles.');
  }
  const names = new Set(), ids = new Set();
  const profiles = value.profiles.map(profile => {
    const name = typeof profile?.name === 'string' ? profile.name.trim() : '';
    const normalized = name.toLowerCase();
    if (!id(profile?.id) || ids.has(profile.id) || !name || name.length > 60 || names.has(normalized)) {
      throw new Error('Give each workspace profile a distinct name of up to 60 characters.');
    }
    const pins = profile.pins ?? null;
    if (pins !== null && (!Array.isArray(pins) || pins.length > NAVIGATION_PAGES.size ||
        new Set(pins).size !== pins.length || pins.some(page => !NAVIGATION_PAGES.has(page)))) {
      throw new Error('Choose valid pages to pin.');
    }
    ids.add(profile.id);
    names.add(normalized);
    return { id: profile.id, name, pins, layout: cleanLayout(profile.layout) };
  });
  if (!ids.has(value.activeProfileId)) throw new Error('Choose an active workspace profile.');
  return { profiles, activeProfileId: value.activeProfileId };
}

function registerWorkspaceSettings(app,authenticateToken,User){
  app.get('/api/account/workspace-layout',authenticateToken,async(req,res)=>{
    res.set('Cache-Control','no-store');
    try {
      const user = await User.findById(req.user.userId).select('_id +workflowLayout +workflowProfiles +workflowRevision').lean();
      if (!user) return res.status(404).json({ message: 'Account not found.' });
      const layout = user.workflowLayout || null;
      const library = user.workflowProfiles;
      const profiles = library?.profiles.map(profile => profile.id === library.activeProfileId && layout ? { ...profile, layout } : profile);
      res.json({ layout, revision: user.workflowRevision || 0, ...(profiles && { profiles, activeProfileId: library.activeProfileId }) });
    }
    catch{res.status(503).json({message:'Could not load your workspace layout.'});}
  });
  app.put('/api/account/workspace-layout',authenticateToken,async(req,res)=>{
    res.set('Cache-Control','no-store');let layout, library;
    if(!Number.isSafeInteger(req.body?.revision)||req.body.revision<0||req.body.revision>=Number.MAX_SAFE_INTEGER)return res.status(400).json({message:'Refresh the saved workspace before trying again.'});
    try {
      if (req.body.profiles !== undefined) {
        library = cleanProfiles(req.body);
        layout = library.profiles.find(profile => profile.id === library.activeProfileId).layout;
      } else layout = cleanLayout(req.body.layout);
    } catch(error){return res.status(400).json({message:error.message});}
    const filter={_id:req.user.userId,...(req.body.revision===0?{$or:[{workflowRevision:0},{workflowRevision:{$exists:false}}]}:{workflowRevision:req.body.revision})};
    try{const user=await User.findOneAndUpdate(filter,{$set:{workflowLayout:layout,workflowRevision:req.body.revision+1,...(library && { workflowProfiles: library })}},{new:true}).select('_id');if(!user)return res.status(409).json({message:'This workspace changed elsewhere. Reload the saved layout or explicitly save your current version.'});res.json({revision:req.body.revision+1});}
    catch{res.status(503).json({message:'Could not save your workspace layout. Your local draft is preserved.'});}
  });
}
module.exports={registerWorkspaceSettings,NAVIGATION_PAGES};
