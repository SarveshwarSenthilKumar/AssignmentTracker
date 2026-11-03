import {useEffect,useRef,useState} from 'react'
import AssistantMarkdown from './AssistantMarkdown'
import {readApiJson} from '../lib/apiResponse'
import './InterviewCoach.css'

const assessments={supported:'Supported by resume',not_found:'Not found in resume',needs_clarification:'Needs clarification'}

function AnswerFeedback({feedback}){
  return <section className="interview-feedback" aria-label="Answer evaluation">
    <h4>Answer feedback · {feedback.score}/5</h4><AssistantMarkdown content={feedback.feedback}/>
    {['strengths','improvements'].map(key=><div key={key}><h5>{key==='strengths'?'What worked':'What to improve'}</h5><ul>{feedback[key].map((point,index)=><li key={index}>{point}</li>)}</ul></div>)}
    <h5>Resume cross-check</h5>{feedback.resumeChecks.length?feedback.resumeChecks.map((check,index)=><div className="interview-check" key={index}><strong>{assessments[check.assessment]}</strong><p>{check.claim}</p><p className="interview-evidence">{check.evidence}</p></div>):<p>No resume-specific claims to compare in this answer.</p>}
    <details><summary>Stronger answer structure</summary><AssistantMarkdown content={feedback.sampleAnswer}/></details>
  </section>
}

export default function InterviewCoach({token,documents}){
  const [documentId,setDocumentId]=useState(''),[context,setContext]=useState('')
  const [session,setSession]=useState(null),[answer,setAnswer]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[ended,setEnded]=useState(false)
  const lock=useRef(false),request=useRef(null),latest=useRef(null)
  const resumes=documents.filter(file=>!file.deletedAt&&file.tags?.includes('resume'))
  useEffect(()=>()=>request.current?.abort(),[])
  useEffect(()=>{if(session){latest.current?.scrollIntoView({block:'nearest'});latest.current?.focus({preventScroll:true})}},[session?.turns.length,!!session])
  const send=async(source,history)=>{
    const controller=new AbortController();request.current=controller
    const timeout=setTimeout(()=>controller.abort(),100000)
    try{
      const response=await fetch('/api/resumes/quiz',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({action:'chat',kind:'resume',documentId:source.documentId,context:source.context,history})})
      const data=await readApiJson(response)
      if(!response.ok)throw new Error(data.message||'Could not complete the interview request.')
      if(typeof data.question!=='string'||history.length&&!data.feedback)throw new Error('The coach returned an incomplete answer. Try again.')
      return data
    }finally{clearTimeout(timeout);if(request.current===controller)request.current=null}
  }
  const run=async task=>{
    if(lock.current)return
    lock.current=true;setBusy(true);setError('')
    try{await task()}catch(failure){setError(failure.name==='AbortError'?'Request canceled or timed out. Your answer is preserved; you can try again.':failure.message)}
    finally{lock.current=false;setBusy(false)}
  }
  const start=event=>{
    event.preventDefault()
    run(async()=>{
      if(!resumes.some(file=>file._id===documentId))throw new Error('Choose a saved resume from your account.')
      const source={documentId,context:context.trim(),name:resumes.find(file=>file._id===documentId).name}
      if(source.context.length<10)throw new Error('Describe the interview in at least 10 characters.')
      const data=await send(source,[])
      setSession({source,question:data.question,turns:[],notices:data.notices||[]});setAnswer('');setEnded(false)
    })
  }
  const submit=event=>{
    event.preventDefault()
    if(!answer.trim()||!session?.question||ended)return
    run(async()=>{
      const current={question:session.question,answer:answer.trim()}
      const history=[...session.turns.map(({question,answer})=>({question,answer})),current]
      const data=await send(session.source,history)
      setSession(previous=>({...previous,question:data.question,turns:[...previous.turns,{...current,feedback:data.feedback}],notices:[...new Set([...previous.notices,...(data.notices||[])])]}))
      setAnswer('');if(!data.question)setEnded(true)
    })
  }
  const average=session?.turns.length?(session.turns.reduce((sum,turn)=>sum+turn.feedback.score,0)/session.turns.length).toFixed(1):null
  return <section className="interview-coach" aria-label="AI interview coach">
    <header><h2>Talk through your next interview</h2><p>Tell the coach what you’re preparing for. Practice one question at a time, get answer feedback, and compare your examples with your resume.</p></header>
    <p className="interview-privacy">Uses your configured Gemini key. Only the chosen resume, its saved text edits, interview description, and this session’s questions and answers are sent. Unsaved resume edits are not included. The session stays in this page’s memory; leaving Prep or reloading clears it.</p>
    {!session?<form onSubmit={start}><fieldset disabled={busy}><legend>Prepare your interview</legend>
      <label>Resume<select value={documentId} required onChange={event=>setDocumentId(event.target.value)}><option value="">Choose a saved resume…</option>{resumes.map(file=><option key={file._id} value={file._id}>{file.name}</option>)}</select></label>
      {!resumes.length&&<p>Upload or create a resume in <a href="#/resumes">Resumes &amp; templates</a>, then return here.</p>}
      <label>What interview are you preparing for?<textarea rows={5} required minLength={10} maxLength={18000} value={context} onChange={event=>setContext(event.target.value)} placeholder="I’m interviewing for a junior software engineer role at… It’s a 45-minute behavioral and technical interview. I want to practice explaining my projects, teamwork, and debugging experience. Paste relevant job requirements here if you have them."/></label>
      <button type="submit" disabled={busy||!documentId}>{busy?'Preparing your opening question…':'Start interview chat'}</button>
    </fieldset></form>:<>
      <div className="interview-session-heading"><strong>{session.source.name}</strong><span>{session.turns.length}/10 answers reviewed{average!==null?` · Average ${average}/5`:''}</span></div>
      <details><summary>Interview context</summary><p className="interview-context">{session.source.context}</p></details>
      {session.notices.map((notice,index)=><p key={index} className="interview-notice">{notice}</p>)}
      <p className="interview-privacy">Resume checks are AI interpretations. An experience missing from your resume may still be valid; verify quoted evidence. Scores are practice guidance.</p>
      <div className="interview-transcript">{session.turns.map((turn,index)=><article key={index} className="interview-turn"><div className="interview-coach-question"><strong>Coach · Question {index+1}</strong><AssistantMarkdown content={turn.question}/></div><div className="interview-user-answer"><strong>Your answer</strong><p>{turn.answer}</p></div><AnswerFeedback feedback={turn.feedback}/></article>)}</div>
      <div ref={latest} tabIndex={-1} className="interview-current">
        {!ended&&session.question?<><div className="interview-coach-question"><strong>Coach · Question {session.turns.length+1}</strong><AssistantMarkdown content={session.question}/></div><form onSubmit={submit}><label>Your answer<textarea rows={6} maxLength={6000} required disabled={busy} value={answer} onChange={event=>setAnswer(event.target.value)} placeholder="Describe your example, what you did, and the outcome…"/></label><div className="interview-actions"><button type="submit" disabled={busy||!answer.trim()}>{busy?'Evaluating and preparing a follow-up…':'Send answer & get feedback'}</button><button type="button" disabled={busy} onClick={()=>setEnded(true)}>Finish practice</button></div></form></>:<div role="status"><h3>Practice complete</h3><p>{session.turns.length} answers reviewed{average!==null?` · Average coaching score: ${average}/5`:''}. Your answers and feedback remain above.</p>{session.question&&<button type="button" onClick={()=>setEnded(false)}>Continue practice</button>}</div>}
      </div>
      <details className="interview-restart"><summary>Start a different interview</summary><p>This clears the current transcript and feedback.</p><button type="button" disabled={busy} onClick={()=>{setSession(null);setAnswer('');setEnded(false);setError('')}}>Clear session &amp; choose interview</button></details>
    </>}
    {busy&&<button type="button" onClick={()=>request.current?.abort()}>Cancel request</button>}{error&&<p role="alert" className="interview-error">{error}</p>}
  </section>
}
