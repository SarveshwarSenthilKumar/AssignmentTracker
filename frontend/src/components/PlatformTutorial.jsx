import { useEffect, useRef, useState } from 'react'
import { tutorialTopics } from '../lib/platformTutorialContent'
import './PlatformTutorial.css'

const lessons = tutorialTopics.flatMap(group => group.lessons)

export default function PlatformTutorial({ userId }) {
  const key = `platform-tutorial:${userId}`
  const [progress,setProgress]=useState(()=>{
    try {
      const saved=JSON.parse(localStorage.getItem(key)||'{}')
      return { current:lessons.some(item=>item.id===saved.current)?saved.current:lessons[0].id, completed:Array.isArray(saved.completed)?saved.completed.filter(id=>lessons.some(item=>item.id===id)):[] }
    } catch { return {current:lessons[0].id,completed:[]} }
  })
  const [query, setQuery] = useState('')
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const groups = tutorialTopics.map(group => ({
    ...group,
    lessons: group.lessons.filter(item => {
      const content = [group.topic, item.title, item.destination, ...item.steps, item.practice].join(' ').toLowerCase()
      return terms.every(term => content.includes(term))
    }),
  })).filter(group => group.lessons.length)
  const heading=useRef(null)
  const index=lessons.findIndex(item=>item.id===progress.current)
  const lesson=lessons[index]
  useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(progress))}catch{}},[key,progress])
  useEffect(()=>{heading.current?.focus({preventScroll:true})},[lesson.id])
  const choose=id=>setProgress(previous=>({...previous,current:id}))
  return <section className="platform-tutorial" aria-label="Platform tutorial">
    <header><h1>Platform tutorial</h1>
      <span>{progress.completed.length} of {lessons.length} completed</span></header>
    <progress value={progress.completed.length} max={lessons.length} aria-label="Tutorial progress"/>
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
      <article>
        <p className="platform-tutorial-step">Lesson {index+1} of {lessons.length}</p>
        <h3 ref={heading} tabIndex={-1}>{lesson.title}</h3>
        <ol className="platform-tutorial-instructions">
          {lesson.steps.map(text => <li key={text}>{text}</li>)}
        </ol>
        <div className="platform-tutorial-practice">
          <h4>Try it</h4>
          <p>{lesson.practice}</p>
          <a href={'#/' + lesson.route}>Open {lesson.destination} →</a>
        </div>
        <label className="platform-tutorial-complete"><input type="checkbox" checked={progress.completed.includes(lesson.id)} onChange={event=>{
          const checked=event.target.checked
          setProgress(previous=>({...previous,completed:checked?[...previous.completed,lesson.id]:previous.completed.filter(id=>id!==lesson.id)}))
        }}/>Mark this lesson complete</label>
        <footer><button type="button" disabled={index===0} onClick={()=>choose(lessons[index-1].id)}>Previous</button>
          {index<lessons.length-1&&<button type="button" onClick={()=>choose(lessons[index+1].id)}>Next lesson</button>}
        </footer>
      </article>
    </div>
    <small>Progress saves on this device. Reopen this guide from Tools → Tutorial.</small>
  </section>
}
