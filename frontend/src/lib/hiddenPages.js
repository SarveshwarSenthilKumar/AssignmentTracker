// Unlisted application pages exposed only through direct routes and commands.
export const HIDDEN_PAGES=[
  {route:'admin/stats',label:'Admin statistics',description:'Advanced aggregate statistics for full administrators only. Command: admin stats.',adminOnly:true},
  {route:'admin',label:'Admin portal',description:'Authorized review of bug reports and feature suggestions.',adminOnly:true},
  {route:'logbook',label:'Update logbook',description:'Numbered updates, fixes, commits and changed files.'},
  {route:'handbook',label:'Product handbook',description:'Feature instructions, technical reference and PDF download.'},
]
