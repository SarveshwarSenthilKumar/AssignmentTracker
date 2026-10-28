import {useRef,useState} from 'react'
import {resumeTemplates,resumeSectionLabels,createResumeTemplate,resumeTemplateCredits} from '../lib/resumeTemplates'
import {readApiJson} from '../lib/apiResponse'

export default function ResumeTemplateGallery({token,onCreated}){
  const [collection,setCollection]=useState('all')
  const [selected,setSelected]=useState('classic'),[content,setContent]=useState({fullName:'',contact:'',summary:'',experience:'',education:'',projects:'',skills:''}),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const lock=useRef(false),template=resumeTemplates.find(item=>item.id===selected)
  const save=async event=>{
    event.preventDefault();if(lock.current)return
    if(!content.fullName.trim()||!template.order.some(key=>content[key].trim())){setError('Enter your name and at least one resume section.');return}
    lock.current=true;setBusy(true);setError('')
    try{
      const blob=await createResumeTemplate(selected,content),body=new FormData()
      body.append('pdfFile',blob,`${template.id}-resume.docx`);body.append('name',`${content.fullName.trim()} — ${template.name}`.slice(0,120));body.append('tags',JSON.stringify(['resume','resume-template']))
      const response=await fetch('/api/pdfs',{method:'POST',headers:{Authorization:`Bearer ${token}`},body}),result=await readApiJson(response)
      if(!response.ok||!result._id)throw new Error(result.message||'Could not save this resume template.')
      onCreated(result)
    }catch(reason){setError(reason.message)}finally{lock.current=false;setBusy(false)}
  }
  return <details className="resume-template-gallery"><summary>Create a resume from a template</summary><p>Choose a layout and add your own details. Your content stays in place when you change layouts. Save an editable Word resume, then use it in the tailoring tool below. No AI key is needed to create a template.</p>
    <div className="resume-template-filters" role="group" aria-label="Template collection">{[['all','All templates'],['local','Built-in'],['web','From the web']].map(([value,label])=><button key={value} type="button" disabled={busy} aria-pressed={collection===value} onClick={()=>setCollection(value)}>{label}</button>)}</div>
    <div className="resume-template-options" role="group" aria-label="Resume templates">{resumeTemplates.filter(item=>collection==='all'||(collection==='web'?!!item.source:!item.source)).map(item=><button key={item.id} type="button" disabled={busy} aria-pressed={selected===item.id} onClick={()=>setSelected(item.id)}><div aria-hidden="true" className={`resume-template-mini ${item.id}`}><b/><i/>{item.order.slice(0,4).map(key=><span key={key}><strong/><em/><em/></span>)}</div><strong>{item.name}</strong><span>{item.source?'From the web · MIT · Word adaptation':'Built-in layout'}</span><span>{item.description}</span></button>)}</div>
    <div className="resume-template-source" aria-live="polite"><strong>Selected: {template.name}</strong>{template.source&&<><p>Word adaptation of the original LaTeX layout by {template.source.author}. Spacing, typography and entry formatting may differ from the original.</p><div><a href={template.source.template} target="_blank" rel="noopener noreferrer">Original template</a><a href={template.source.license} target="_blank" rel="noopener noreferrer">MIT license</a></div><details><summary>Credits & license notices</summary><pre>{resumeTemplateCredits}</pre></details></>}</div>
    <form onSubmit={save}><fieldset disabled={busy}><legend>Your resume content</legend><div className="resume-template-fields"><label>Full name<input required maxLength={120} value={content.fullName} onChange={event=>setContent({...content,fullName:event.target.value})}/></label><label>Contact details<input maxLength={500} value={content.contact} placeholder="Email · Phone · City · Portfolio" onChange={event=>setContent({...content,contact:event.target.value})}/></label>{template.order.map(key=><label key={key}>{resumeSectionLabels[key]}<textarea rows={key==='summary'?3:5} maxLength={6000} value={content[key]} placeholder={key==='experience'?'Role · Employer · Dates\n- Responsibility or achievement':key==='education'?'Degree · Institution · Graduation date':key==='projects'?'Project or research title\n- Your contribution':key==='skills'?'List your relevant skills':'Brief overview of your experience and strengths'} onChange={event=>setContent({...content,[key]:event.target.value})}/></label>)}</div><p>Empty sections are omitted. Start a line with “- ” for a bullet. Layout previews are illustrative; page length depends on your content and installed fonts.</p><button type="submit" disabled={busy}>{busy?'Saving template…':`Create & use ${template.name}`}</button></fieldset></form>{error&&<p className="resume-error" role="alert">{error}</p>}
  </details>
}
