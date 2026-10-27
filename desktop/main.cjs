const { app, BrowserWindow, WebContentsView, ipcMain, session }=require('electron');
const path=require('node:path');
const { createHash }=require('node:crypto');

const configured=process.env.ASSIGNMENT_TRACKER_URL||'http://localhost:3000';
const appURL=new URL(configured);
if(appURL.username||appURL.password||!(appURL.protocol==='https:'||appURL.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(appURL.hostname)))throw new Error('Use an HTTPS app URL or a local development server.');
let window;
const views=new Map(),accounts=new Map();
const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);
function guestURL(value){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.origin===appURL.origin||url.href.length>4000)throw new Error('Native phone browsing requires an external HTTPS website.');
  return url.href;
}
function trusted(event){
  if(!window||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame)throw new Error('Untrusted desktop request.');
  if(new URL(event.senderFrame.url).origin!==appURL.origin)throw new Error('Untrusted application origin.');
}
function identity(payload){if(!payload||!validId(payload.id)||!validId(payload.owner))throw new Error('Invalid phone page.');return `${payload.owner}:${payload.id}`;}
function accountSession(owner){
  if(accounts.has(owner))return accounts.get(owner);
  const partition='persist:study-phone-'+createHash('sha256').update(owner).digest('hex').slice(0,32),ses=session.fromPartition(partition);
  ses.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  ses.setPermissionCheckHandler(()=>false);
  ses.on('will-download',(event)=>event.preventDefault());
  accounts.set(owner,ses);return ses;
}
function emit(entry,extra={}){
  if(!window||window.isDestroyed()||entry.view.webContents.isDestroyed())return;
  const contents=entry.view.webContents;
  window.webContents.send('phone:state',{id:entry.id,owner:entry.owner,url:contents.getURL(),title:contents.getTitle(),loading:contents.isLoading(),canGoBack:contents.navigationHistory.canGoBack(),canGoForward:contents.navigationHistory.canGoForward(),...extra});
}
function destroy(key){const entry=views.get(key);if(!entry)return;views.delete(key);if(window&&!window.isDestroyed())window.contentView.removeChildView(entry.view);if(!entry.view.webContents.isDestroyed())entry.view.webContents.close();}
function destroyAll(){for(const key of [...views.keys()])destroy(key);}
function create(payload){
  const key=identity(payload),url=guestURL(payload.url);
  if(views.has(key))return views.get(key);
  if(views.size>=8)throw new Error('Suspend or close a native phone tab before opening another.');
  const view=new WebContentsView({webPreferences:{session:accountSession(payload.owner),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,backgroundThrottling:true}}),entry={id:payload.id,owner:payload.owner,view,lastRequested:url};
  views.set(key,entry);window.contentView.addChildView(view);view.setVisible(false);
  const contents=view.webContents;
  const guard=(event,target)=>{try{guestURL(target)}catch{event.preventDefault();emit(entry,{error:'This navigation was blocked. Only external HTTPS websites are allowed.'})}};
  contents.on('will-navigate',guard);contents.on('will-redirect',guard);
  contents.setWindowOpenHandler(({url:target})=>{try{const safe=guestURL(target);setImmediate(()=>{if(!contents.isDestroyed())contents.loadURL(safe).catch(()=>{})})}catch{}return {action:'deny'};});
  for(const name of ['did-start-loading','did-stop-loading','did-navigate','did-navigate-in-page','page-title-updated'])contents.on(name,()=>emit(entry));
  contents.on('did-fail-load',(_event,code,description,_validatedURL,isMainFrame)=>{if(isMainFrame&&code!==-3)emit(entry,{error:`Website navigation failed (${code}): ${description}`})});
  contents.on('render-process-gone',()=>emit(entry,{error:'The website process stopped. Reload this tab to recover.'}));
  contents.on('before-input-event',(event,input)=>{
    if(input.type==='keyDown'&&input.alt&&!input.control&&!input.meta&&input.key.toLowerCase()==='p'){
      event.preventDefault();view.setVisible(false);window.webContents.send('phone:state',{id:entry.id,owner:entry.owner,togglePhone:true});window.webContents.focus();
    }
  });
  contents.loadURL(url).catch(error=>emit(entry,{error:'The website could not be loaded. '+error.message.slice(0,150)}));
  return entry;
}
ipcMain.handle('phone:create',(event,payload)=>{trusted(event);create(payload);return {ok:true}});
ipcMain.handle('phone:navigate',(event,payload)=>{
  trusted(event);const entry=views.get(identity(payload));if(!entry)throw new Error('Native phone page unavailable.');
  const url=guestURL(payload.url);if(payload.reload||entry.lastRequested!==url){entry.lastRequested=url;entry.view.webContents.loadURL(url).catch(error=>emit(entry,{error:'The website could not be loaded. '+error.message.slice(0,150)}))}return {ok:true};
});
ipcMain.on('phone:layout',(event,payload)=>{
  try{
    trusted(event);const entry=views.get(identity(payload));if(!entry)return;
    const values=['x','y','width','height'].map(key=>payload[key]);if(values.some(value=>typeof value!=='number'||!Number.isFinite(value)))return;
    const zoom=window.webContents.getZoomFactor(),[width,height]=window.getContentSize(),x=Math.max(0,Math.min(width,Math.round(payload.x*zoom))),y=Math.max(0,Math.min(height,Math.round(payload.y*zoom))),w=Math.max(0,Math.min(width-x,Math.round(payload.width*zoom))),h=Math.max(0,Math.min(height-y,Math.round(payload.height*zoom)));
    if(payload.visible&&w>0&&h>0){for(const value of views.values())if(value!==entry)value.view.setVisible(false);entry.view.setBounds({x,y,width:w,height:h});entry.view.webContents.setZoomFactor(Math.max(.5,Math.min(2,Number(payload.zoom)||1)));entry.view.setVisible(true)}else entry.view.setVisible(false);
  }catch{}
});
ipcMain.handle('phone:command',(event,payload)=>{
  trusted(event);const entry=views.get(identity(payload));if(!entry)return {ok:false};const contents=entry.view.webContents;
  if(payload.command==='back'&&contents.navigationHistory.canGoBack())contents.navigationHistory.goBack();
  else if(payload.command==='forward'&&contents.navigationHistory.canGoForward())contents.navigationHistory.goForward();
  else if(payload.command==='reload')contents.reload();
  else if(payload.command==='focus')contents.focus();
  else if(payload.command==='stop')contents.stop();
  return {ok:true};
});
ipcMain.handle('phone:destroy',(event,payload)=>{trusted(event);destroy(identity(payload));return {ok:true}});
ipcMain.handle('phone:clear-account',async(event,owner)=>{trusted(event);if(!validId(owner))throw new Error('Invalid account.');for(const [key,value]of views)if(value.owner===owner)destroy(key);await accountSession(owner).clearStorageData();await accountSession(owner).clearCache();return {ok:true}});
app.whenReady().then(()=>{
  window=new BrowserWindow({width:1440,height:950,minWidth:800,minHeight:600,backgroundColor:'#161c24',title:'Assignment Tracker',webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
  window.setMenuBarVisibility(false);window.webContents.setWindowOpenHandler(({url})=>{try{const target=new URL(url);if(target.protocol==='https:'&&!target.username&&!target.password)require('electron').shell.openExternal(target.href).catch(()=>{})}catch{}return {action:'deny'}});
  const protect=(event,url)=>{try{if(new URL(url).origin!==appURL.origin)event.preventDefault()}catch{event.preventDefault()}};
  window.webContents.on('will-navigate',protect);window.webContents.on('will-redirect',protect);
  window.webContents.on('did-start-navigation',(_event,_url,isInPlace,isMainFrame)=>{if(isMainFrame&&!isInPlace)destroyAll()});
  window.on('closed',()=>{destroyAll();window=null});
  window.loadURL(appURL.href).catch(()=>{if(window&&!window.isDestroyed())window.setTitle('Start the Assignment Tracker frontend, then restart this desktop app.')});
});
app.on('window-all-closed',()=>app.quit());
