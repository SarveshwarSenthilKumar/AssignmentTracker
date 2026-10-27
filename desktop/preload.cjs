const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('studyPhoneDesktop',Object.freeze({
  engine:'web-contents-view',
  create:payload=>ipcRenderer.invoke('phone:create',payload),
  navigate:payload=>ipcRenderer.invoke('phone:navigate',payload),
  layout:payload=>ipcRenderer.send('phone:layout',payload),
  command:payload=>ipcRenderer.invoke('phone:command',payload),
  destroy:payload=>ipcRenderer.invoke('phone:destroy',payload),
  clearAccount:owner=>ipcRenderer.invoke('phone:clear-account',owner),
  subscribe:callback=>{
    const listener=(_event,value)=>callback(value);
    ipcRenderer.on('phone:state',listener);
    return()=>ipcRenderer.removeListener('phone:state',listener);
  },
}));
