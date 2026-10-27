import {useEffect,useRef,useState} from 'react'
import {readApiJson} from '../lib/apiResponse'
import AssistantMarkdown from './AssistantMarkdown'
import './ResumeQuiz.css'

export default function ResumeQuiz({token,documents,selectedDocumentId=''}){
  const [kind,setKind]=useState('resume'),[documentId,setDocumentId]=useState(''),[context,setContext]=useState(''),[difficulty,setDifficulty]=useState('standard'),[count,setCount]=useState(5),[session,setSession]=useState(null),[index,setIndex]=useState(0),[answers,setAnswers]=useState({}),[feedback,setFeedback]=useState({}),[hint,setHint]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState(''),[finished,setFinished]=useState(false)
  const panel=useRef(null),lock=useRef(false),request=useRef(null)
  useEffect(()=>()=>request.current?.abort(),[])
  useEffect(()=>{if(!selectedDocumentId)return;setDocumentId(selectedDocumentId);setKind('resume');if(panel.current){panel.current.open=true;panel.current.scrollIntoView({behavior:'smooth',block:'start'})}},[selectedDocumentId])
  const files=documents.filter(file=>!file.deletedAt&&(kind==='project'||file.tags?.includes('resume')))
  const send=async payload=>{
    const controller=new AbortController();request.current=controller;const timer=setTimeout(()=>controller.abort(),100000)
    try{
      const response=await fetch('/api/resumes/quiz',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal}),data=await readApiJson(response)
      if(!response.ok)throw new Error(data.message||'Could not complete quiz request.')
      return data
    }finally{clearTimeout(timer);if(request.current===controller)request.current=null}
  }
  const run=async(action,task)=>{
    if(lock.current)return;lock.current=true;setBusy(action);setError('')
    try{await task()}catch(reason){setError(reason.name==='AbortError'?'The quiz request timed out or was canceled. Your answers are still here.':reason.message)}finally{lock.current=false;setBusy('')}
  }
  const start=event=>{event.preventDefault();run('generate',async()=>{
    if(documentId&&!files.some(file=>file._id===documentId))throw new Error('Choose an available source document.')
    const source={kind,documentId,context},data=await send({...source,action:'generate',difficulty,count})
    setSession({...data,source});setIndex(0);setAnswers({});setFeedback({});setHint(false);setFinished(false)
  })}
  const review=()=>run('review',async()=>{
    const data=await send({...session.source,action:'review',question:session.questions[index].question,answer:answers[index]||''})
    setFeedback(previous=>({...previous,[index]:data}))
  })
  const move=next=>{setIndex(next);setHint(false);setFinished(false);setError('')}
  const reviewed=Object.values(feedback),average=reviewed.length?(reviewed.reduce((sum,item)=>sum+item.score,0)/reviewed.length).toFixed(1):null
  return <details ref={panel} className="resume-quiz"><summary>Practice interview questions · Resume or project</summary><p>Quiz yourself on your experience or a specific project, one question at a time. Only your selected document, saved text edits, description and answer are sent to Gemini. Unsaved document edits are not included. Practice stays on this page and is cleared when you leave.</p>
    {!session?<form onSubmit={start}><fieldset disabled={!!busy}><legend>Build your practice session</legend><div className="resume-quiz-grid"><label>Practice topic<select value={kind} onChange={event=>{setKind(event.target.value);setDocumentId('')}}><option value="resume">Resume interview</option><option value="project">Project deep dive</option></select></label><label>Source document<select value={documentId} onChange={event=>setDocumentId(event.target.value)}><option value="">Use the description below</option>{files.map(file=><option key={file._id} value={file._id}>{file.name}</option>)}</select></label><label>Difficulty<select value={difficulty} onChange={event=>setDifficulty(event.target.value)}><option value="introductory">Introductory</option><option value="standard">Standard</option><option value="challenging">Challenging</option></select></label><label>Questions<select value={count} onChange={event=>setCount(Number(event.target.value))}>{[3,5,8,10].map(value=><option key={value} value={value}>{value} questions</option>)}</select></label></div><label>{kind==='project'?'Project details and focus':'Additional context or pasted resume'}<textarea rows={5} maxLength={18000} minLength={documentId?undefined:40} required={!documentId} value={context} onChange={event=>setContext(event.target.value)} placeholder={kind==='project'?'Describe the project, your contribution, technologies, challenges and results. If using a resume, name the project to focus on.':'Paste your resume, or choose a saved resume and optionally describe the role you are preparing for.'}/></label><button type="submit" disabled={!!busy}>{busy==='generate'?'Preparing questions…':'Start practice'}</button></fieldset></form>:<section aria-label="Interview practice session">
      <div className="resume-quiz-progress"><strong>{session.title}</strong><span>{reviewed.length}/{session.questions.length} reviewed{average!==null?` · Average ${average}/5`:''}</span></div>
      {session.notices?.map((notice,i)=><p key={i}>{notice}</p>)}
      {!finished?<><p className="resume-quiz-focus">Question {index+1} of {session.questions.length} · {session.questions[index].focus}</p><AssistantMarkdown content={session.questions[index].question}/><label>Your answer<textarea rows={7} maxLength={6000} disabled={!!busy} value={answers[index]||''} onChange={event=>{setAnswers(previous=>({...previous,[index]:event.target.value}));setFeedback(previous=>{const next={...previous};delete next[index];return next})}} placeholder="Explain your reasoning, your contribution and concrete examples…"/></label><div className="resume-quiz-actions"><button type="button" disabled={!!busy} onClick={()=>setHint(value=>!value)} aria-expanded={hint}>{hint?'Hide hint':'Show hint'}</button><button type="button" disabled={!!busy||!answers[index]?.trim()} onClick={review}>{busy==='review'?'Reviewing…':feedback[index]?'Review again':'Get feedback'}</button></div>{hint&&<p className="resume-quiz-hint">{session.questions[index].hint}</p>}
      {feedback[index]&&<div className="resume-quiz-feedback" aria-live="polite"><h3>Feedback · {feedback[index].score}/5</h3><AssistantMarkdown content={feedback[index].feedback}/>{['strengths','improvements'].map(key=><div key={key}><h4>{key==='strengths'?'What worked':'What to improve'}</h4><ul>{feedback[index][key].map((point,i)=><li key={i}>{point}</li>)}</ul></div>)}<details><summary>Example answer structure</summary><AssistantMarkdown content={feedback[index].sampleAnswer}/></details><p>AI feedback can be inaccurate. Confirm facts and adapt examples to your actual experience.</p></div>}
      <div className="resume-quiz-actions"><button type="button" disabled={!!busy||index===0} onClick={()=>move(index-1)}>Previous</button>{index<session.questions.length-1?<button type="button" disabled={!!busy} onClick={()=>move(index+1)}>{feedback[index]?'Next question':'Skip for now'}</button>:<button type="button" disabled={!!busy} onClick={()=>setFinished(true)}>View session summary</button>}</div></>:<div><h3>Practice summary</h3><p>{reviewed.length} of {session.questions.length} answers reviewed.{average!==null?` Average coaching score: ${average}/5.`:''}</p><ol>{session.questions.map((question,i)=><li key={i}><button type="button" onClick={()=>move(i)}>{question.focus} · {feedback[i]?`${feedback[i].score}/5`:'Not reviewed'}</button></li>)}</ol></div>}
      <details className="resume-quiz-restart"><summary>Start another session</summary><p>Starting over clears this session’s answers and feedback.</p><button type="button" disabled={!!busy} onClick={()=>{setSession(null);setAnswers({});setFeedback({});setError('')}}>Clear session & choose topic</button></details>
    </section>}{busy&&<button type="button" onClick={()=>request.current?.abort()}>Cancel request</button>}{error&&<p role="alert" className="resume-error">{error}</p>}
  </details>
}
