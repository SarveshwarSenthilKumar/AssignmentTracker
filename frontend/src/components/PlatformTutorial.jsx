import { featureVisible, shortcutVisible } from '../lib/featureVisibility'
import { useEffect, useRef, useState } from 'react'
import { tutorialTopics } from '../lib/platformTutorialContent'
import { pdfTutorialTopic } from '../lib/pdfTutorialContent'
import { SHORTCUTS } from '../lib/shortcuts'
import './PlatformTutorial.css'

const topics = [...tutorialTopics, pdfTutorialTopic]
const lessons = topics.flatMap(group => group.lessons)
const editorShortcuts = SHORTCUTS.filter(item => item.scope === 'Visual editor')

export default function PlatformTutorial({ userId, startWithPDF = false, hiddenFeatures, headerAction }) {
  const key = `platform-tutorial:${userId}`
  const startingLesson = startWithPDF ? pdfTutorialTopic.lessons[0].id : null
  const [progress,setProgress]=useState(()=>{
    try {
      const saved=JSON.parse(localStorage.getItem(key)||'{}')
      const savedLesson = lessons.find(item => item.id === saved.current)
      return {
        current: (startWithPDF && !savedLesson?.editorShortcuts ? startingLesson : savedLesson?.id) ?? lessons[0].id,
        completed: Array.isArray(saved.completed) ? saved.completed.filter(id => lessons.some(item => item.id === id)) : [],
      }
    } catch { return {current:startingLesson ?? lessons[0].id,completed:[]} }
  })
  const [query, setQuery] = useState('')
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const enabledLessons = lessons.filter(item => featureVisible(hiddenFeatures, item.route))
  const completedCount = enabledLessons.filter(item => progress.completed.includes(item.id)).length
  const groups = topics.map(group => ({
    ...group,
    lessons: group.lessons.filter(item => {
      if (!featureVisible(hiddenFeatures, item.route)) return false
      const content = [group.topic, item.title, item.destination, ...item.steps, item.practice].join(' ').toLowerCase()
      return terms.every(term => content.includes(term))
    }),
  })).filter(group => group.lessons.length)
  const heading=useRef(null)
  const index=Math.max(0,enabledLessons.findIndex(item=>item.id===progress.current))
  const lesson=enabledLessons[index]
  useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(progress))}catch{}},[key,progress])
  useEffect(()=>{heading.current?.focus({preventScroll:true})},[lesson?.id])
  const choose=id=>setProgress(previous=>({...previous,current:id}))
  return <section className="platform-tutorial" aria-label="Platform tutorial">
    <header><h1>Platform tutorial</h1>{headerAction}
      <span>{completedCount} of {enabledLessons.length} completed</span></header>
    <progress value={completedCount} max={Math.max(1, enabledLessons.length)} aria-label="Tutorial progress"/>
    <div className="platform-tutorial-layout">
      <aside className="platform-tutorial-topics">
        <label>Find a lesson<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <nav aria-label="Tutorial topics">
          {groups.map(group => <div className="platform-tutorial-topic" key={group.topic}>
            <h2>{group.topic}</h2>
            {group.lessons.map(item => <button type="button" key={item.id} aria-current={item.id === lesson.id ? 'step' : undefined} onClick={() => choose(item.id)}>
              <span>{item.title}</span>{progress.completed.includes(item.id) && <span aria-label="Completed">✓</span>}
            </button>)}
          </div>)}
          {!groups.length && <p role="status">No lessons match your search.</p>}
        </nav>
      </aside>
      {lesson ? <article>
        <p className="platform-tutorial-step">Lesson {index+1} of {enabledLessons.length}</p>
        <h3 ref={heading} tabIndex={-1}>{lesson.title}</h3>
        <ol className="platform-tutorial-instructions">
          {lesson.steps.map(text => <li key={text}>{text}</li>)}
        </ol>
        {lesson.editorShortcuts && <details>
          <summary>PDF editor keyboard shortcuts</summary>
          <ul>{editorShortcuts.filter(item => shortcutVisible(hiddenFeatures, item)).map(item => <li key={item.id}><kbd>{item.keys}</kbd> {item.label}</li>)}
            <li><kbd>Ctrl / Cmd + F</kbd> Search the document</li>
          </ul>
        </details>}
        <div className="platform-tutorial-practice">
          <h4>Try it</h4>
          <p>{lesson.practice}</p>
          <a href={'#/' + lesson.route}>Open {lesson.destination} →</a>
        </div>
        <label className="platform-tutorial-complete"><input type="checkbox" checked={progress.completed.includes(lesson.id)} onChange={event=>{
          const checked=event.target.checked
          setProgress(previous=>({...previous,completed:checked?[...previous.completed,lesson.id]:previous.completed.filter(id=>id!==lesson.id)}))
        }}/>Mark this lesson complete</label>
        <footer><button type="button" disabled={index===0} onClick={()=>choose(enabledLessons[index-1].id)}>Previous</button>
          {index<enabledLessons.length-1&&<button type="button" onClick={()=>choose(enabledLessons[index+1].id)}>Next lesson</button>}
        </footer>
      </article> : <p>Restore a section in Account settings to see its tutorial lessons.</p>}
    </div>
    <small>Progress saves on this device. Reopen this guide from Tools → Tutorial.</small>
  </section>
}
