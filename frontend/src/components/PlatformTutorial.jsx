import { useEffect, useRef, useState } from 'react'
import './PlatformTutorial.css'

const lessons = [
  { id:'home', title:'Start with Home', route:'home', steps:['Home brings together your focus tasks, schedule and recent documents.', 'Choose Customize stats to select the numbers you want to see.', 'Open a task or recent document to return to your work.'], try:'Open Home and review your focus list.' },
  { id:'navigation', title:'Navigation and search', route:'shortcuts', steps:['Use the top navigation for Home, Workspace, Tasks, Calendar and Documents. Career and Tools open the other sections.', 'Ctrl/Cmd+K searches saved workspace records. Ctrl/Cmd+F finds visible text on the current page, or opens Find inside the PDF editor.', 'Ctrl-click or Cmd-click supported navigation and document controls to open another tab. The avatar menu contains Account settings.'], try:'Open Keyboard shortcuts and find an action you use often.' },
  { id:'tasks', title:'Plan tasks', route:'tasks', steps:['Enter a task, add a due date or planned work day, and save it. Use folders and subfolders to organize work.', 'Move tasks between To Do, In Progress and Completed. Expand a task for descriptions, dependencies and attachments.', 'Star important tasks. Use search, Stars and sort controls to focus your list. Dragging tasks can switch to custom order.'], try:'Create a task and give it a deadline.' },
  { id:'progress', title:'Track progress and habits', route:'tasks', steps:['Enable progress tracking on a task and set a target and unit. Log dated amounts and notes, then add milestones as needed.', 'Automatic completion can finish a task when its target is reached.', 'Task Streaks and the contribution graph summarize your recorded activity. Change the graph time range or collapse it. Account → Task display controls its visibility.'], try:'Open a progress task and review its daily history.' },
  { id:'calendar', title:'Use Calendar', route:'calendar', steps:['Switch between Month and Agenda. Select a day to see entries, add a task, or write a day note.', 'Use Appointment or Mark date for personal events. Timed events support reminders, and recurring meetings support series controls.', 'University events starts at None. Choose Texas State University to include campus events. Full day display expands day cells. Open in new tab opens a separate Calendar tab.'], try:'Select a date and inspect the appointment form.' },
  { id:'imports', title:'Import schedules and courses', route:'canvas', steps:['Canvas integration connects your course account and imports supported assignments and events. ICS imports can add calendar records.', 'Calendar → Class schedule supports entering recurring meetings and importing a schedule file with Gemini.', 'Review extracted class dates, meeting days, times and locations before saving. AI imports require your own Gemini key in Account settings.'], try:'Review Canvas settings, or return to Calendar to find Class schedule.' },
  { id:'documents', title:'Organize documents', route:'documents', steps:['Upload files or create notes, a blank PDF, or a notebook. Select a folder to create documents there.', 'Each file has Share and More actions. More includes rename, copy, star, download, move and Trash. Duplicate names in a folder are flagged.', 'Select multiple PDFs to merge them. Arrange their order and create a separate merged PDF.'], try:'Open Documents and inspect a file’s More menu.' },
  { id:'editor', title:'Read and edit PDFs', route:'documents', steps:['Open a PDF to use pens, highlights, text boxes, sticky notes, inserts and page controls.', 'View changes scrolling, Book view, dark pages and zoom. The Toolbar dropdown moves tools to the top, bottom or sides. Lock page enables finger drawing without scrolling.', 'Find searches file contents and editor tools. Open the editor’s Tutorial for hands-on lessons. Save stores changes, and Download annotated PDF exports them.'], try:'Open a PDF, then choose Tutorial in its toolbar.' },
  { id:'notes', title:'Write notes and practice', route:'documents', steps:['New notes opens the writing studio with templates, formatting, math and a preview.', 'Select a folder and choose Create practice packet to draft problems and an answer key from supported files directly inside it.', 'Review the included and skipped sources, edit the draft, then create the PDF. This sends supported source material to Gemini using your key.'], try:'Select a study folder and inspect Create practice packet.' },
  { id:'sharing', title:'Share files and folders', route:'documents', steps:['Select a document folder and choose Share folder. Add an existing account’s email and choose Viewer or Editor.', 'Shared with me lists folders you can access. Editors can use Edit live for Markdown and plain-text files.', 'Share on a file creates a link for anyone who has it. Viewer links download the file; supported text files also offer Editor links. Replace or revoke links when needed.'], try:'Inspect a sharing panel and its permissions before granting access.' },
  { id:'offline', title:'Work offline', route:'documents', steps:['While online, use More → Make available offline on an unlocked PDF or text file.', 'Pinned files, annotation edits, note edits, new tasks and task status changes can work offline. Pending changes sync when you reconnect with the app open.', 'Review conflicts in the offline status panel. Signing out clears local copies and unsynced changes. Gemini, live collaboration and new share-link access require a connection.'], try:'Pin a document while online and check its offline availability indicator.' },
  { id:'assistant', title:'Use AI assistance', route:'assistant', steps:['Add your own Gemini key in Account → AI settings, then choose the allowed categories under AI access.', 'Start a conversation and explicitly select documents or supported workspace context to include.', 'Review generated answers, proposed edits and citations. Saved conversation history lets you return to earlier work.'], try:'Open AI assistant and review its context controls.' },
  { id:'study', title:'Build a question bank', route:'study', steps:['Save questions, answers and topics in Question bank.', 'Use saved material to review and track what you have studied.', 'The Study Phone alongside documents offers study tools and references. Its availability is controlled in Account settings.'], try:'Open Question bank and review your study items.' },
  { id:'career', title:'Prepare for applications', route:'prep', steps:['Prep brings together resumes, cover letters, saved jobs and interview tools.', 'Upload your resume and save job details. Use selected sources when tailoring application documents.', 'Practice interviews, review AI feedback and draft cold emails. Check facts and wording before exporting or sending material yourself.'], try:'Open Prep and explore its tool tabs.' },
  { id:'workspace', title:'Arrange your workspace', route:'workspace', steps:['Workspace combines tools in movable windows and tabs.', 'Choose tools, arrange windows and use layout controls to fit your workflow.', 'Visualization provides another way to inspect tasks, dates and relationships. Analytics summarizes account activity and storage.'], try:'Open Workspace and inspect the tool picker.' },
  { id:'account', title:'Customize and protect your account', route:'account', steps:['Account settings includes appearance, birthday, time zone, task display and confirmation preferences.', 'Security lets you change your password. Section locks let you choose protected pages and an account or custom password. Folder and file locks are available in their controls.', 'Review automatic task cleanup and recovery periods before enabling them. Locks protect the corresponding app views, while sharing and downloaded copies have their own access behavior.'], try:'Open Account settings and review your preferences.' },
  { id:'help', title:'Find help and recover work', route:'report-bug', steps:['Use Recently deleted for recoverable tasks and Trash for documents you want to restore.', 'Report a bug describes an issue and tracks responses. Feature suggestions and Site roadmap show ideas and progress.', 'The product handbook offers more detailed reference material. You can reopen this tutorial under Tools anytime.'], try:'Review Report a bug without submitting a report.' }
]

export default function PlatformTutorial({ userId }) {
  const key = `platform-tutorial:${userId}`
  const [progress,setProgress]=useState(()=>{
    try {
      const saved=JSON.parse(localStorage.getItem(key)||'{}')
      return { current:lessons.some(item=>item.id===saved.current)?saved.current:lessons[0].id, completed:Array.isArray(saved.completed)?saved.completed.filter(id=>lessons.some(item=>item.id===id)):[] }
    } catch { return {current:lessons[0].id,completed:[]} }
  })
  const heading=useRef(null)
  const index=lessons.findIndex(item=>item.id===progress.current)
  const lesson=lessons[index]
  useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(progress))}catch{}},[key,progress])
  useEffect(()=>{heading.current?.focus({preventScroll:true})},[lesson.id])
  const choose=id=>setProgress(previous=>({...previous,current:id}))
  return <section className="platform-tutorial" aria-label="Platform tutorial">
    <header><div><h2>Learn AssignmentTracker</h2><p>Explore a topic, try it in the app, and return here to continue.</p></div>
      <span>{progress.completed.length} of {lessons.length} completed</span></header>
    <progress value={progress.completed.length} max={lessons.length} aria-label="Tutorial progress"/>
    <div className="platform-tutorial-layout">
      <nav aria-label="Tutorial topics">{lessons.map(item=><button type="button" key={item.id} aria-current={item.id===lesson.id?'step':undefined} onClick={()=>choose(item.id)}>
        <span>{item.title}</span>{progress.completed.includes(item.id)&&<span aria-label="Completed">✓</span>}
      </button>)}</nav>
      <article>
        <p className="platform-tutorial-step">Lesson {index+1} of {lessons.length}</p>
        <h3 ref={heading} tabIndex={-1}>{lesson.title}</h3>
        {lesson.steps.map(text=><p key={text}>{text}</p>)}
        <div className="platform-tutorial-practice"><p>{lesson.try}</p><a href={`#/${lesson.route}`}>Try in the app →</a><small>Return through Tools → Platform tutorial. Progress saves on this device.</small></div>
        <label className="platform-tutorial-complete"><input type="checkbox" checked={progress.completed.includes(lesson.id)} onChange={event=>{
          const checked=event.target.checked
          setProgress(previous=>({...previous,completed:checked?[...previous.completed,lesson.id]:previous.completed.filter(id=>id!==lesson.id)}))
        }}/>Mark this lesson complete</label>
        <footer><button type="button" disabled={index===0} onClick={()=>choose(lessons[index-1].id)}>Previous</button>
          {index<lessons.length-1&&<button type="button" onClick={()=>choose(lessons[index+1].id)}>Next lesson</button>}
        </footer>
      </article>
    </div>
  </section>
}
