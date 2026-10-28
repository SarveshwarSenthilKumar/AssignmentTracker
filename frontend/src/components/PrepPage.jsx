import {useState} from 'react'
import ResumeQuiz from './ResumeQuiz'
import ResumesPage from './ResumesPage'
import CoverLettersPage from './CoverLettersPage'
import JobsPage from './JobsPage'
import './ResumesPage.css'
import './PrepPage.css'

const tabs=[['practice','Interview practice','Quiz yourself on a resume or project with hints and answer feedback.'],['resumes','Resumes & templates','Choose a layout, build a resume, or tailor an existing version.'],['letters','Cover letters','Prepare and refine letters using your existing documents.'],['jobs','Saved jobs','Keep target roles and job requirements ready for preparation.']]

export default function PrepPage({token,documents,onDocumentsChange,onOpen}){
  const [active,setActive]=useState('practice'),[visited,setVisited]=useState(['practice'])
  const select=id=>{setActive(id);setVisited(previous=>previous.includes(id)?previous:[...previous,id])}
  return <section className="prep-page" aria-label="Career preparation"><div className="prep-intro"><h2>Your preparation workspace</h2><p>Build your application materials and practice explaining your experience. Resume interviews and project deep dives are both available in Interview practice.</p></div>
    <nav className="prep-tabs" aria-label="Preparation tools">{tabs.map(([id,title,description])=><button key={id} type="button" aria-pressed={active===id} aria-controls={`prep-panel-${id}`} onClick={()=>select(id)}><strong>{title}</strong><span>{description}</span></button>)}</nav>
    <p className="prep-session-note">Switching tools here keeps your practice session in place. Leaving Prep clears the current quiz; saved documents and jobs remain in your account.</p>
    {visited.map(id=><section key={id} id={`prep-panel-${id}`} aria-label={tabs.find(tab=>tab[0]===id)[1]} hidden={active!==id}>
      {id==='practice'&&<div className="resumes-page prep-practice"><ResumeQuiz token={token} documents={documents} initiallyOpen/></div>}
      {id==='resumes'&&<ResumesPage token={token} documents={documents} onDocumentsChange={onDocumentsChange} onOpen={onOpen}/>}
      {id==='letters'&&<CoverLettersPage token={token} documents={documents} onDocumentsChange={onDocumentsChange} onOpen={onOpen}/>}
      {id==='jobs'&&<JobsPage token={token}/>}
    </section>)}
  </section>
}
