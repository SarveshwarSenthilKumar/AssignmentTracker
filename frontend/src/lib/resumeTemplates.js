import resumeTemplateCredits from '../assets/resume-template-licenses.txt?raw'
export {resumeTemplateCredits}
export const resumeTemplates=[
  {id:'classic',name:'Classic',description:'Traditional serif typography with centered contact details.',font:'Times New Roman',size:22,margin:900,center:true,order:['summary','experience','education','projects','skills']},
  {id:'modern',name:'Modern',description:'Clean sans serif headings and restrained slate rules.',font:'Calibri',size:22,margin:900,rule:true,order:['summary','experience','projects','education','skills']},
  {id:'compact',name:'Compact',description:'Tighter spacing for a concise, information-dense resume.',font:'Arial',size:20,margin:720,rule:true,order:['summary','skills','experience','projects','education']},
  {id:'academic',name:'Academic',description:'Education and research first, with generous serif headings.',font:'Cambria',size:22,margin:1000,order:['summary','education','projects','experience','skills']},
  {id:'jake',name:"Jake's Resume",description:'Education-first serif layout with centered contact details and fine section rules.',font:'Times New Roman',size:22,margin:720,center:true,rule:true,compact:true,smallCaps:true,headingSize:25,nameSize:40,ink:'222222',ruleColor:'333333',sectionLabels:{projects:'Projects',skills:'Technical skills'},source:{author:'Jake Gutierrez',url:'https://github.com/jakegut/resume',template:'https://github.com/jakegut/resume/blob/master/resume.tex',license:'https://github.com/jakegut/resume/blob/master/LICENSE'},order:['summary','education','experience','projects','skills']},
  {id:'bajaj',name:'Bajaj Developer',description:'Developer-focused serif layout with a left-aligned header and compact, ruled sections.',font:'Times New Roman',size:22,margin:720,rule:true,compact:true,smallCaps:true,headingSize:25,nameSize:34,ink:'222222',ruleColor:'333333',sectionLabels:{projects:'Projects'},source:{author:'Sourabh Bajaj',url:'https://github.com/sb2nov/resume',template:'https://github.com/sb2nov/resume/blob/master/sourabh_bajaj_resume.tex',license:'https://github.com/sb2nov/resume/blob/master/LICENSE'},order:['summary','education','experience','projects','skills']},
]
export const resumeSectionLabels={summary:'Profile',experience:'Experience',education:'Education',projects:'Projects & research',skills:'Skills'}

export async function createResumeTemplate(templateId,content){
  const {Document,Packer,Paragraph,TextRun,AlignmentType,BorderStyle}=await import('docx')
  const template=resumeTemplates.find(item=>item.id===templateId)
  if(!template)throw new Error('Choose an available resume template.')
  const children=[new Paragraph({alignment:template.center?AlignmentType.CENTER:AlignmentType.LEFT,spacing:{after:100},children:[new TextRun({text:content.fullName.trim(),bold:true,size:template.nameSize||36,color:template.ink||'202C38',smallCaps:!!template.smallCaps})]})]
  if(content.contact.trim())children.push(new Paragraph({text:content.contact.trim(),alignment:template.center?AlignmentType.CENTER:AlignmentType.LEFT,spacing:{after:200}}))
  for(const key of template.order){
    if(!content[key]?.trim())continue
    children.push(new Paragraph({keepNext:true,spacing:{before:(template.id==='compact'||template.compact)?150:230,after:90},border:template.rule?{bottom:{color:template.ruleColor||'8B98A5',style:BorderStyle.SINGLE,size:4,space:4}}:undefined,children:[new TextRun({text:template.smallCaps?(template.sectionLabels?.[key]||resumeSectionLabels[key]):(template.sectionLabels?.[key]||resumeSectionLabels[key]).toUpperCase(),smallCaps:!!template.smallCaps,bold:!template.smallCaps,size:template.headingSize||template.size,color:template.ink||'344454'})]}))
    for(const line of content[key].trim().split('\n')){
      const bullet=/^\s*[-•]\s+/.test(line)
      children.push(new Paragraph({text:line.replace(/^\s*[-•]\s+/,''),...(bullet?{bullet:{level:0}}:{}),spacing:{after:(template.id==='compact'||template.compact)?50:90},widowControl:true}))
    }
  }
  return Packer.toBlob(new Document({creator:'Assignment Tracker',description:template.source?`Word adaptation of ${template.name} by ${template.source.author}. Original: ${template.source.url}\n\n${resumeTemplateCredits}`:'Assignment Tracker resume template',title:`${content.fullName.trim()} — ${template.name} resume`,styles:{default:{document:{run:{font:template.font,size:template.size,color:template.ink||'202C38'},paragraph:{spacing:{line:260}}}}},sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:template.margin,bottom:template.margin,left:template.margin,right:template.margin}}},children}]}))
}
