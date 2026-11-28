export const TOOLS={tasks:{label:'Tasks',description:'Search, plan and update your tasks.'},calendar:{label:'Agenda',description:'Check deadlines and appointments. Open an event to edit or share it.'},documents:{label:'Documents',description:'Your files, folders and media.'},graph:{label:'Task map',description:'Explore progress and task connections.'},notes:{label:'Notes',description:'A saved scratchpad for this workflow.'},focus:{label:'Focus timer',description:'A quiet countdown for focused work.'},assistant:{label:'AI assistant',description:'Open your saved AI conversations.'}}

const pageTools = {
  home: ['Home', 'See your dashboard, upcoming schedule and recent files.'],
  canvas: ['Canvas workload', 'Review assignment time estimates and sync your Canvas courses.'],
  bookmarks: ['Bookmarks', 'Open bookmark folders, suggested links and quick links.'],
  'detective-wall': ['Detective wall', 'Open your pinboards or start from a sample mystery.'],
  whiteboards: ['Team whiteboards', 'Open a shared board to draw and collaborate.'],
  study: ['Question bank', 'Review saved questions, answers and study topics.'],
  prep: ['Career prep', 'Open interview coaching, practice and cold email drafting.'],
  resumes: ['Resumes', 'Open saved resumes, templates and tailoring tools.'],
  'cover-letters': ['Cover letters', 'Open saved letters and writing tools.'],
  jobs: ['Saved jobs', 'Open your job list and import job postings.'],
  analytics: ['Analytics', 'Review account activity and storage.'],
  tutorial: ['Tutorial', 'Open platform and PDF editor lessons.'],
  shortcuts: ['Keyboard shortcuts', 'Find shortcuts for the platform and editors.'],
  account: ['Account settings', 'Manage navigation pins, visibility, friends and preferences.'],
  roadmap: ['Site roadmap', 'See planned improvements and work in progress.'],
  'report-bug': ['Report a bug', 'Report an issue or follow an existing report.'],
  'suggest-feature': ['Feature suggestions', 'Suggest an improvement or check its status.'],
  handbook: ['Product handbook', 'Open the platform reference guide.'],
  logbook: ['Update logbook', 'Read the platform change history.'],
}

for (const [route, [label, description]] of Object.entries(pageTools)) {
  TOOLS[route] = { label, description, route }
}

export const workspaceId=()=>crypto.randomUUID()
export const paneFor=type=>({id:workspaceId(),type,note:''})
export function windowFor(type,index=0){const pane=paneFor(type);return {id:workspaceId(),panes:[pane],activePaneId:pane.id,x:24+index*36,y:24+index*36,width:500,height:440,minimized:false,maximized:false}}
export function templateWindows(name,width=1200){
  const gap=14,half=Math.max(300,(width-gap*3)/2),wide=Math.max(300,width-gap*2)
  const types={planning:['tasks','calendar','notes','focus'],research:['documents','notes','graph','assistant'],minimal:['tasks','notes'],class:['tasks','calendar','documents','notes'],exams:['tasks','focus','study','notes'],applications:['jobs','resumes','cover-letters','calendar']}[name]||['tasks','calendar','notes','focus']
  return types.map((type,index)=>({...windowFor(type,index),x:width<700?gap:gap+(index%2)*(half+gap),y:gap+Math.floor(index/2)*430,width:width<700?wide:half,height:416}))
}
export function defaultWorkspace(preset = 'planning', title = 'Daily planning', width) {
  const windows = templateWindows(preset, width)
  const tab = { id: workspaceId(), title, windows, activeWindowId: windows[0].id }
  return { version: 1, tabs: [tab], activeTabId: tab.id, preferences: { snap: true, grid: true, density: 'comfortable', canvasHeight: 1000 } }
}
export function importWorkspace(value){
  const ids=new Set(),validId=value=>{if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(value)||ids.has(value))throw new Error('The layout contains invalid or duplicate IDs.');ids.add(value);return value}
  if(!value||new TextEncoder().encode(JSON.stringify(value)).length>250000||!Array.isArray(value.tabs)||!value.tabs.length||value.tabs.length>8)throw new Error('Choose a valid workspace layout under 250 KB with 1–8 tabs.')
  const tabs=value.tabs.map(tab=>{
    if(typeof tab.title!=='string'||!tab.title.trim()||tab.title.length>60||!Array.isArray(tab.windows)||tab.windows.length>10)throw new Error('Invalid workspace tab.')
    const windows=tab.windows.map(win=>{
      if(!Array.isArray(win.panes)||!win.panes.length||win.panes.length>6||!['x','y','width','height'].every(key=>Number.isFinite(win[key])&&win[key]>=0&&win[key]<=5000)||win.width<240||win.height<180)throw new Error('Invalid workspace window.')
      const panes=win.panes.map(pane=>{if(!Object.hasOwn(TOOLS,pane.type)||typeof (pane.note??'')!=='string'||(pane.note||'').length>12000)throw new Error('Invalid workspace tool or note.');return {id:validId(pane.id),type:pane.type,note:pane.type==='notes'?pane.note||'':''}})
      if(!panes.some(pane=>pane.id===win.activePaneId))throw new Error('A tool tab is missing.')
      return {id:validId(win.id),panes,activePaneId:win.activePaneId,x:win.x,y:win.y,width:win.width,height:win.height,minimized:!!win.minimized,maximized:!!win.maximized}
    })
    return {id:validId(tab.id),title:tab.title.trim(),windows,activeWindowId:windows.some(win=>win.id===tab.activeWindowId)?tab.activeWindowId:windows.at(-1)?.id||null}
  })
  if(!tabs.some(tab=>tab.id===value.activeTabId))throw new Error('The active workspace tab is missing.')
  return {version:1,tabs,activeTabId:value.activeTabId,preferences:{snap:value.preferences?.snap!==false,grid:value.preferences?.grid!==false,density:value.preferences?.density==='compact'?'compact':'comfortable',canvasHeight:[720,1000,1400].includes(value.preferences?.canvasHeight)?value.preferences.canvasHeight:1000}}
}
