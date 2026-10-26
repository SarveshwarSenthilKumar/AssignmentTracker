from pathlib import Path
import re
import html
from reportlab.pdfgen import canvas
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak, Table, TableStyle, Flowable, KeepTogether
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/pdf'
SOURCE=OUT/'AssignmentTracker-Product-and-Technical-Handbook.md'
PDF=OUT/'AssignmentTracker-Product-and-Technical-Handbook.pdf'
NAVY=colors.HexColor('#142B45'); ACCENT=colors.HexColor('#247C86'); INK=colors.HexColor('#21364A'); MUTED=colors.HexColor('#647888'); LINE=colors.HexColor('#D9E3E8'); PALE=colors.HexColor('#EFF5F6')
for name,file in [('Body','calibri.ttf'),('Body-Bold','calibrib.ttf'),('Body-Italic','calibrii.ttf'),('Body-BoldItalic','calibriz.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(Path('C:/Windows/Fonts')/file)))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='Body-Bold',italic='Body-Italic',boldItalic='Body-BoldItalic')
styles={
 'chapter':ParagraphStyle('Chapter',fontName='Body-Bold',fontSize=23,leading=27,textColor=NAVY,spaceAfter=18,keepWithNext=True),
 'h2':ParagraphStyle('Subhead',fontName='Body-Bold',fontSize=11.8,leading=15,textColor=ACCENT,spaceBefore=12,spaceAfter=6,keepWithNext=True),
 'body':ParagraphStyle('Text',fontName='Body',fontSize=10.2,leading=14.8,textColor=INK,spaceAfter=8,allowWidows=0,allowOrphans=0),
 'bullet':ParagraphStyle('BulletText',fontName='Body',fontSize=10.1,leading=14.4,textColor=INK,leftIndent=12,firstLineIndent=-10,spaceAfter=5,allowWidows=0,allowOrphans=0),
 'source':ParagraphStyle('Sources',fontName='Body',fontSize=8,leading=11,textColor=MUTED,spaceBefore=13,spaceAfter=5,splitLongWords=True),
 'eyebrow':ParagraphStyle('Eyebrow',fontName='Body-Bold',fontSize=9,leading=12,textColor=ACCENT,spaceAfter=10),
 'table':ParagraphStyle('Cell',fontName='Body',fontSize=8.5,leading=11.8,textColor=INK,spaceAfter=0),
 'tablehead':ParagraphStyle('HeadCell',fontName='Body-Bold',fontSize=8.5,leading=11.5,textColor=colors.white),
}

def clean(text):
    return text.replace('\u2011','-').replace('\u2013','-').replace('\u2014',' - ').replace('\u2212','-').replace('\u00a0',' ')
def rich(text):
    value=html.escape(clean(text))
    value=re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',value)
    return value
def p(text,kind='body'):
    return Paragraph(rich(text),styles[kind])

class SystemMap(Flowable):
    def __init__(self): super().__init__(); self.width=475; self.height=146
    def draw(self):
        c=self.canv
        for x,title,sub in [(0,'REACT CLIENT','Views, tools, gestures'),(165,'EXPRESS API','Auth, validation, jobs'),(330,'MONGODB','Records, files, history')]:
            c.setFillColor(PALE);c.roundRect(x,74,145,53,7,fill=1,stroke=0)
            c.setFillColor(NAVY);c.setFont('Body-Bold',10);c.drawString(x+12,106,title)
            c.setFillColor(MUTED);c.setFont('Body',8.5);c.drawString(x+12,89,sub)
        c.setStrokeColor(ACCENT);c.setLineWidth(1.2)
        for x in [146,311]:
            c.line(x,100,x+17,100);c.line(x+13,103,x+17,100);c.line(x+13,97,x+17,100)
        c.setFillColor(NAVY);c.setFont('Body-Bold',9);c.drawString(8,49,'LOCAL UTILITIES')
        c.setFillColor(MUTED);c.setFont('Body',8.5);c.drawString(8,33,'PDFs, Markdown, OCR, calculation, graphs')
        c.setFillColor(NAVY);c.setFont('Body-Bold',9);c.drawString(258,49,'EXTERNAL BOUNDARIES')
        c.setFillColor(MUTED);c.setFont('Body',8.5);c.drawString(258,33,'Gemini, Canvas, public events, OAuth')
        c.setStrokeColor(LINE);c.line(0,17,475,17)

class Cover(Flowable):
    def __init__(self): super().__init__();self.width=475;self.height=680
    def draw(self):
        c=self.canv;c.setFillColor(NAVY);c.roundRect(0,232,475,423,15,fill=1,stroke=0)
        c.setFillColor(colors.HexColor('#80CFCC'));c.setFont('Body-Bold',10);c.drawString(30,614,'PRODUCT MANUAL + ENGINEERING HANDBOOK')
        c.setFillColor(colors.white);c.setFont('Body-Bold',39);c.drawString(30,541,'AssignmentTracker')
        c.setFont('Body',24);c.drawString(31,491,'Every feature.');c.drawString(31,455,'How it works.');c.drawString(31,419,'Technical reference.')
        c.setStrokeColor(colors.HexColor('#456075'));c.line(31,387,443,387)
        c.setFont('Body',12);c.drawString(31,358,'Prepared for Sarveshwar Senthil Kumar')
        c.setFillColor(colors.HexColor('#BDD0DF'));c.setFont('Body',10);c.drawString(31,330,'Source-based edition | October 26, 2026')
        c.drawString(31,308,'React / Express / MongoDB / PDF tools / Gemini')
        c.setFillColor(ACCENT);c.setFont('Body-Bold',11);c.drawString(0,190,'A COMPLETE PRODUCT AND TECHNICAL REFERENCE')
        for i,line in enumerate(['Feature-by-feature instructions, architecture and data flow,', 'guided workflows, engineering notes, design tradeoffs,', 'limitations, source references and implementation inventories.']):
            c.setFillColor(INK);c.setFont('Body',12);c.drawString(0,157-i*21,line)
        c.setFillColor(MUTED);c.setFont('Body-Italic',9);c.drawString(0,56,'Implementation descriptions are not runtime-verification claims.')

class Handbook(BaseDocTemplate):
    def __init__(self,path):
        super().__init__(str(path),pagesize=(595.28,841.89),leftMargin=60,rightMargin=60,topMargin=65,bottomMargin=57,title='AssignmentTracker - Product and Technical Handbook',author='Prepared for Sarveshwar Senthil Kumar',subject='Application features, architecture and technical reference',pageCompression=1)
        frame=Frame(self.leftMargin,self.bottomMargin,self.width,self.height,id='body',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)
        self.addPageTemplates(PageTemplate(id='main',frames=frame,onPage=self.decorate));self.chapter='';self.chapters=[]
    def beforeDocument(self): self.chapter='';self.chapters=[]
    def decorate(self,c,doc):
        c.saveState()
        if doc.page>1:
            c.setFillColor(MUTED);c.setFont('Body-Bold',8);c.drawString(60,810,'ASSIGNMENTTRACKER');c.setFont('Body',8);c.drawRightString(535,810,'FEATURES / ARCHITECTURE / TECHNICAL REFERENCE')
            c.setStrokeColor(LINE);c.line(60,798,535,798)
        c.setStrokeColor(LINE);c.line(60,43,535,43)
        c.setFillColor(MUTED);c.setFont('Body',8);c.drawString(60,28,'Source-based edition | 26 OCT 2026');c.drawRightString(535,28,f'{doc.page:02d}')
        c.restoreState()
    def afterFlowable(self,flowable):
        if isinstance(flowable,Paragraph) and flowable.style.name=='Chapter':
            title=flowable.getPlainText();key=f'chapter-{len(self.chapters)}';self.canv.bookmarkPage(key);self.canv.addOutlineEntry(title,key,0,False);self.notify('TOCEntry',(0,title,self.page,key));self.chapters.append({'title':title,'page':self.page})

def table(rows,widths):
    data=[[p(cell,'tablehead' if index==0 else 'table') for cell in row] for index,row in enumerate(rows)]
    obj=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
    obj.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),NAVY),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,PALE]),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),('LINEBELOW',(0,0),(-1,0),1,NAVY),('LINEBELOW',(0,1),(-1,-1),.4,LINE)]))
    return obj

manuscript=SOURCE.read_text(encoding='utf-8')
manuscript=manuscript.replace('backend/oneNoteImport.js where present','backend/oneNoteImport.js').replace('backend/workflowLayout.js where present','backend/workspaceSettings.js').replace("daily-events/app.js or the directory's current script entry",'daily-events/app.js')
manuscript=manuscript.replace('Insert controls allow supported content such as text/images and page imports.', 'Insert includes files/images, PDF pages, shapes, image tables and stamps. Tables accept cell entry or pasted spreadsheet cells up to 12 rows by 8 columns, then insert as an image. Stamps have editable text and presets such as APPROVED, DRAFT, REVIEWED and CONFIDENTIAL. Shapes and other inserts can be moved and resized. PDF merge accepts multiple files, import ranges and before/after/start/end placement.')
SOURCE.write_text(manuscript,encoding='utf-8')

story=[Cover(),PageBreak(),p('CONTENTS','eyebrow'),Paragraph('Find your workflow',ParagraphStyle('ContentsTitle',parent=styles['chapter']))]
toc=TableOfContents();toc.levelStyles=[ParagraphStyle('TOC',fontName='Body',fontSize=8.8,leading=12,textColor=INK,spaceBefore=0,leftIndent=0,rightIndent=18)];toc.dotsMinLevel=0
story.extend([p('Linked entries and PDF bookmarks let you jump to a chapter. The final appendices are extracted from the current source registry and route declarations.'),toc,PageBreak()])
chapters=re.split(r'^# ',manuscript,flags=re.M)
number=0
for chapter in chapters:
    if not chapter.strip():continue
    title,_,body=chapter.partition('\n');number+=1
    story.append(p(f'CHAPTER {number:02d}','eyebrow'));story.append(Paragraph(rich(title.strip()),styles['chapter']))
    if title.startswith('Architecture:'):story.append(SystemMap())
    for block in re.split(r'\n\s*\n',body.strip()):
        if block.startswith('## '):
            lines=block.splitlines();story.append(p(lines[0][3:],'h2'));remainder='\n'.join(lines[1:])
            if not remainder:continue
            block=remainder
        if block.startswith('- '):
            for line in block.splitlines():
                if line.startswith('- '):story.append(Paragraph('<font color="#247C86">&#8226;</font> '+rich(line[2:]),styles['bullet']))
                else:story.append(p(line))
        elif block.startswith('Sources:'):story.append(p(block,'source'))
        else:story.append(p(' '.join(block.splitlines())))
    story.append(PageBreak())

shortcuts=[]
source=(ROOT/'frontend/src/lib/shortcuts.js').read_text(encoding='utf-8')
for line in source.splitlines():
    fields=dict(re.findall(r"(scope|label|keys):'([^']*)'",line))
    if all(key in fields for key in ['scope','label','keys']):shortcuts.append(fields)
story.extend([p('APPENDIX A','eyebrow'),Paragraph('Keyboard shortcut reference',styles['chapter']),p('These entries come from frontend/src/lib/shortcuts.js. Scope and focus determine whether a shortcut is active; text-entry exceptions and open dialogs can suppress it. Ctrl means Ctrl on Windows/Linux or Cmd on macOS where supported. Labels are registry descriptions; account confirmation preferences still apply.')])
groups={}
for item in shortcuts:groups.setdefault(item['scope'],[]).append(item)
for group,items in groups.items():
    story.append(p(group,'h2'));story.append(table([['Keys','Action']]+[[item['keys'],item['label']] for item in items],[125,350]));story.append(Spacer(1,10))
story.append(p('Notes studio additionally handles Ctrl/Cmd+B, Ctrl/Cmd+I, Ctrl/Cmd+F, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y in the writing field. Its Tab behavior differs from ordinary page navigation. See the notes chapter.','source'));story.append(PageBreak())

story.extend([p('APPENDIX B','eyebrow'),Paragraph('API implementation inventory',styles['chapter']),p('The following literal and template route declarations were extracted from backend JavaScript source. This is a navigation aid, not a tested OpenAPI contract. Parameterized registration templates retain ${...} notation; their concrete bases are explained below. Auth, body shape and capabilities must be checked in the named module. No endpoints were called.')])
api_groups={}
pattern=re.compile(r'''\b(?:app|router)\.(get|post|put|patch|delete)\(\s*(['"`])(.+?)\2''',re.S)
for file in sorted((ROOT/'backend').glob('*.js')):
    if file.name.endswith('.test.js'):continue
    rows=[]
    for method,quote,path in pattern.findall(file.read_text(encoding='utf-8')):
        if '\n' not in path and len(path)<170:rows.append([method.upper(),path])
    if rows:api_groups[file.name]=rows
for file,rows in api_groups.items():
    story.append(p(file,'h2'));story.append(table([['Method','Path / registration template']]+rows,[60,415]));story.append(Spacer(1,10))
story.append(p('Registration notes','h2'))
story.append(p('Folder hierarchy and folder attachment templates register under /api/folders and /api/pdf-folders. Tailoring registers separate cover-letter and resume generation/save-draft paths. Route templates and helper-generated routes should be read with their registration calls in server.js; the literal inventory may omit routes constructed by helpers.'))
story.append(PageBreak())

story.extend([p('APPENDIX C','eyebrow'),Paragraph('Technical quick reference',styles['chapter'])])
rows=[['Area','Implementation','Boundary / tradeoff'],['The product','Connected academic and career workspace','Feature breadth does not prove reliability'],['Architecture','React -> Express -> MongoDB','Not microservices or real-time collaboration'],['Ownership','Token plus owner-scoped queries','IDs alone are not authorization'],['Undo','Workflow-specific snapshots/history','No universal rollback; reset is permanent'],['PDF editing','Base file plus annotations and overlays','Not secure redaction or full Word layout'],['Performance','Canvas, bounded work, workers','No measured speedup without profiling'],['Palm rejection','Pointer type and gesture arbitration','No hardware/ML palm classifier'],['AI use','Language/recognition with restricted context','Review required; provider dependency'],['Math','AI transcribes; local parser computes','Wrong transcription can yield wrong result'],['Career tailoring','Source evidence plus template fidelity','No invented facts or ATS guarantee'],['Job imports','Structured data, layout/OCR, manual review','No universal accuracy or login bypass'],['Events','Public source fetch, cache and identity','Upstream changes and freshness limits'],['Scaling','Storage/queues/shared coordination next','Proposed, not deployed infrastructure'],['Testing','Representative fixtures and metrics','Source inspection is not test execution']]
story.append(table(rows,[95,190,190]));story.append(Spacer(1,16));story.append(p('Operational checklist','h2'));story.append(p('Keep source documents, reviewed exports and recovery options available. Check integration configuration, protect credentials, review errors before retrying and distinguish implemented behavior from proposed improvements. Track adapted components and their license requirements.'))

doc=Handbook(PDF);doc.multiBuild(story)
import json
(ROOT/'tmp/pdfs/handbook-map.json').write_text(json.dumps({'chapters':doc.chapters,'shortcut_count':len(shortcuts),'route_declaration_count':sum(map(len,api_groups.values()))},indent=2),encoding='utf-8')
print(f'Created {PDF.name}; {len(doc.chapters)} indexed sections, {len(shortcuts)} registry shortcuts, {sum(map(len,api_groups.values()))} route declarations.')
