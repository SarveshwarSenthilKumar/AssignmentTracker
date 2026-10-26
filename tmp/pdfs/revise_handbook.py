from pathlib import Path
import re

root=Path(__file__).resolve().parents[2]
out=root/'output/pdf'
old=out/'AssignmentTracker-Feature-and-Interview-Handbook.md'
source=out/'AssignmentTracker-Product-and-Technical-Handbook.md'
text=old.read_text(encoding='utf-8')

replacements={
'How to use this handbook':'''# How to use this handbook

This is a source-based guide to Sarveshwar Senthil Kumar's AssignmentTracker, prepared on October 26, 2026. It combines a complete product manual, an architecture reference, guided workflows and engineering notes. It describes the implementation without assuming that every feature has passed runtime testing or works with every external service.

## Three ways to read it
- Getting started: read Product overview, Architecture and Setup, then follow the guided end-to-end workflow.
- Using a feature: find its chapter in the linked contents or PDF bookmarks for controls, behavior and limitations.
- Understanding the implementation: use the technical questions, engineering case studies, source map and API inventory.

## Important distinctions
- Saved in the platform is different from downloaded to a local file. PDF annotations can be stored separately until export.
- Account preferences and records live in MongoDB; some display preferences and recovery drafts live only in the browser.
- Local parsing and calculation are different from AI recognition. The app uses both, with explicit boundaries.
- Undo is scoped to a workflow. There is no universal rollback of every application operation.
- Source inspection establishes implemented structure, not runtime reliability. No application tests, builds, live API probes or browser QA were run to prepare this guide, following the repository's workflow preference.

## Reading implementation notes
Each feature chapter separates user-visible behavior from design decisions and external dependencies. Source references identify the relevant modules. Suggested improvements are described as future work, not as deployed capabilities. Performance, extraction quality and integration availability require measurement under representative conditions.

Code takes precedence over older documentation. For example, the assistant can edit supported open documents, notes have a Markdown studio, supported DOCX editing preserves the original package, and Ctrl/Cmd+K opens global search.

Sources: README.md; frontend/src/App.jsx; frontend/src/components/DocumentEditor.jsx; backend/assistantEditor.js.
''',
'Your interview pitch':'''# Product overview

## Purpose
AssignmentTracker is a full-stack student workspace connecting tasks, calendars, documents, study material and career preparation. It brings related work into one account while retaining clear distinctions between source records, linked files and the views that display them.

## Main workflows
- Plan academic work with tasks, deadlines, folders, prerequisites, attached evidence and deletion recovery.
- Combine task deadlines, personal appointments, Canvas imports and public events in a calendar with categories, recurrence and supported undo.
- Store documents, create typed notes or blank notebooks, annotate PDFs, copy text and use local mathematical tools.
- Ask questions with selected workspace/file context, save study questions and prepare bounded edits to supported open documents.
- Save job postings and tailor resumes or letters using existing source material, reviewed replacements and optional employer research.
- Arrange tools in a customizable workspace, inspect task relationships visually and navigate through global search.

## Core technology
The React/Vite frontend provides interactive views and document tools. An Express API handles authentication, validation, persistence, external retrieval and AI requests. MongoDB stores account-owned records, file data and transaction-backed recovery/history. Local utilities handle operations such as Markdown conversion, supported extraction, arithmetic and plotting; Gemini provides optional language generation or recognition.

## Design priorities
Related entities use stable references so a task, event or folder can link the same document. Destructive operations have workflow-specific recovery paths. AI capabilities are restricted by account permissions and supported editor actions. Public-source imports retain their provenance and expose freshness or collection failures.

## Scope
The application is not a real-time collaborative editor, an unrestricted autonomous agent, a complete PDF word processor or a universally accurate job scraper. Its supported workflows and practical limits are documented in the following chapters.
''',
'A practical eight-minute demonstration':'''# Guided end-to-end workflow

## 1. Start with an overview
Open Home to review task counts, upcoming dates and recent documents. Select an item to open its underlying record. Use a disposable workspace or non-sensitive sample material while learning the controls.

## 2. Organize a task
Create a task, assign a folder and deadline, and add a prerequisite. Drag it to another position or status. Delete a disposable task and restore it with Undo deletion. The recovery snapshot preserves task identity and relevant relationships. Account -> Task display controls whether In Progress has its own column.

## 3. Connect it to the calendar
Open the task's deadline from Calendar. Create a personal appointment and link a document. Check the time zone, then distinguish removing a single displayed event from deleting a personal entry or selecting matching-name removals. Use calendar undo for supported saved changes.

## 4. Create notes and supporting material
Create a lecture-note template, add a heading, list and equation, and switch between Write, Split and Read. Use the outline to navigate. Add a description and a small image to its folder; the attachment remains a document-library record.

## 5. Work with a PDF
Open a small PDF, draw and undo a stroke, select/copy text, and open a side page. Try a local calculation or graph. Source-text replacement uses visual overlays; dark-page inversion is a display setting. Test pen and touch behavior on the actual device before relying on it for substantial work.

## 6. Use AI and career tools selectively
Review Account -> AI access before sharing content. Open a saved conversation or request a supported edit with appropriate context enabled. In Career, save a job and review a tailored document against source evidence. Keep provider diagnostics available when requests fail, and review all generated facts and layout warnings.

## 7. Return to related work
Use global search to reopen the task, file, event or conversation. Explore Workspace, Visualization and Study stars as alternate views or collections. The separate daily-events QR site is a public distribution workflow with its own data-publishing step.
''',
'Interview questions: architecture and data':'''# Technical questions: architecture and data

## Why React, Express and MongoDB?
React supports the stateful editor and composed panels. Express provides a straightforward API layer, and Mongoose supplies a shared record model for owner-scoped data. MongoDB accommodates evolving task/document metadata. Relationships and transactions still require explicit coordination; binary storage is a candidate for future separation.

## Which parts extend beyond CRUD?
Record management supports more complex workflows: document geometry, gesture ownership, safe recovery, cross-entity relationships, extraction/indexing, AI context boundaries and template-preserving exports. Each has its own validation, state transitions and failure handling.

## How is account data isolated?
The token establishes identity and protected database queries include the owning user. Relationship writes validate ownership of referenced documents, tasks and folders. An object ID alone does not grant access. Negative authorization cases should be covered by the validation plan.

## Why use transactions?
A deleted task and its recovery record must commit together. The same requirement applies to a calendar mutation and its history, or a folder attachment upload and its link. Transactions avoid partial relationship/history writes and require a transaction-capable MongoDB deployment.

## What happens with concurrent edits?
Some workflows use revisions or per-account transaction locks, including chats, layouts and calendar history. Other paths need additional concurrency review. The application does not provide general-purpose real-time collaboration or identical conflict handling for every record type.

## How could the system scale?
Possible extensions include object storage for binaries, a job queue for slow conversion/indexing, broader pagination, shared public caches/rate limits and operational observability. Memory, response time and queue delay should guide those changes. These are proposed improvements rather than deployed infrastructure.
''',
'Interview questions: PDF, input and performance':'''# Technical questions: PDF, input and performance

## Why are PDFs difficult to edit?
A PDF often describes positioned glyphs and graphics rather than semantic paragraphs. Replacing text can require font coverage, line layout and background reconstruction. Supported source-text replacement uses overlays; it does not securely redact the underlying content.

## How are annotations preserved across pages?
Annotations retain page references and document-space coordinates. Page mutations remap those references. Continuous view separates passive pages from the active overlay and waits for matching geometry. Late callbacks must not apply a different page's dimensions to the active page.

## How is repeated drawing work reduced?
The implementation uses live/completed canvas layers instead of a large React/SVG tree for every pressure segment. It appends where possible, indexes stroke bounds for erasing, caps backing resolution and defers serialization/save work. Quantitative improvements require frame-time and memory measurements.

## Is palm rejection AI-based?
No. Input handling relies on pointer type, pen ownership and explicit touch modes. Two-pointer gestures support navigation. Browser/hardware events limit classification. Small input helpers were adapted from Excalidraw under MIT with attribution; this is not hardware-level palm recognition.

## What is the tradeoff of a custom annotation model?
A narrower model provides direct control over annotation behavior and exports, but text layout and device compatibility require substantial maintenance. A mature full editor library could replace some of that work if its capabilities and integration costs fit the product.

## What should be profiled?
Input-to-paint latency, browser long tasks, stroke-count scaling, memory at high zoom/continuous view, export duration, extraction time and worker overhead. Use defined device/document/stroke workloads for comparisons rather than interpreting a visual impression as a benchmark.
''',
'Interview questions: AI, extraction and trust':'''# Technical questions: AI, extraction and trust

## Which tasks benefit from AI?
Language tailoring, explanations and difficult handwriting recognition can benefit from model assistance. Ordinary search, supported job extraction, arithmetic after parsing, and Markdown-to-PDF conversion use local or deterministic paths. Separating those paths limits latency, token use and unnecessary sharing.

## How are unsupported claims reduced?
Generation uses source evidence, bounded tasks, structured replacements and user review. Employer context does not authorize invented applicant facts. For mathematics, recognition and evaluation are separate. These controls reduce risk but do not guarantee error-free output.

## Can source content contain malicious instructions?
Documents and websites are untrusted input. Prompt instructions state that boundary, while validated capabilities provide stronger restrictions: known target IDs, bounded actions and browser revision checks, without arbitrary execution. Prompt-injection behavior still needs adversarial evaluation.

## Why can job extraction fail?
HTML, OCR and PDF layout provide incomplete signals. A page may require login or dynamic rendering, and a screenshot may omit important fields. Multiple input paths and editable fields support recovery. Missing information should remain an explicit gap rather than be fabricated.

## How can latency be improved?
Use structured extraction first, trim irrelevant references, bound employer research, choose an appropriate configured model and avoid blind retries. Provider latency should be measured separately from parsing, retrieval and export. Prompt changes cannot resolve quota or network failures by themselves.

## How should quality be evaluated?
Use consented/redacted fixtures to measure per-field job accuracy, evidence/phrase compliance, layout overflow, math transcription and action rejection. Compare modes on equivalent inputs and record model versions and conditions. Existing source and test files are not evidence of recorded pass results.
''',
'Preparing your own engineering stories':'''# Engineering case studies

## Recoverable task deletion
Problem: deleting a task group can remove details and dependency relationships. Approach: store task/dependency snapshots in a separate expiring collection and delete the active records in the same transaction. Restoration preserves stable IDs and validates surviving folders. Boundary: recovery expires and account reset clears it.

## Heavy annotation workloads
Problem: accumulated strokes increase rendering, hit-testing and serialization work. Approach: use canvas layers, incremental painting, cached bounds, worker serialization and bounded backing resolution. Tradeoff: high-zoom display resolution is capped to control resources. Performance conclusions require measured workloads.

## Writing and template fidelity
Problem: generated career documents can diverge from source voice, evidence or layout. Approach: reuse supported source phrases, generate structured replacement regions, preserve template-owned formatting and report font/overflow failures. User review remains necessary; the application does not guarantee application outcomes.

## OneNote annotation fidelity
Problem: a compatibility parser can omit ink or rearrange annotated printouts. Approach: prefer native OneNote PDF export, preserve sheets, expose diagnostics and make the compatibility path explicit. Tradeoff: native fidelity introduces a Windows/desktop dependency and cannot recover content missing from the uploaded source.

## Shared lessons
- Preserve identity and provenance when data appears in multiple workflows.
- Commit related state changes together when partial success would be misleading.
- Distinguish interactive previews from portable exported artifacts.
- Isolate slow or uncertain work and show actionable failure states.
- Attribute adapted components and review their licenses.
- Record verification conditions before asserting performance or accuracy improvements.
''',
}

for title,replacement in replacements.items():
    pattern=r'^# '+re.escape(title)+r'\n.*?(?=^# |\Z)'
    text,count=re.subn(pattern,lambda match:replacement.rstrip()+'\n\n',text,flags=re.M|re.S)
    if count!=1:raise ValueError(f'Expected one section: {title}')

notes={
'Interview explanation: "I keep interactive rendering':'Design rationale: Interactive rendering stays close to the browser, while credentials and persistence stay on the server. Structured IDs represent relationships, and transactional snapshots support recoverable mutations. Coordination becomes more complex as the feature set grows.',
'Interview explanation: "Search crosses':'Design rationale: Search results retain entity types and IDs so navigation can resolve the correct destination. Bounded workers isolate extraction from request handling. Saved content must be indexed before its newest text is searchable, and unsupported formats have explicit coverage limits.',
'Interview follow-up:':'Design rationale: A status column is a view rather than a task identity. Hiding it must not delete tasks or make them inaccessible. Transaction-backed deletion snapshots are persistent recovery records, unlike a temporary client-side notification.',
'Interview explanation: "I preserve source':'Design rationale: Source identity and calendar visibility are separate. A calendar-only removal can leave the underlying task or external source untouched.',
'Interview answer: "I separate source':'Design rationale: Imports keep source identity separate from local state so updates do not erase user work. Partial retrieval is reported as partial rather than empty. Scheduled queues, monitored retries and broader conflict policies are potential extensions.',
'Interview answer: "Format dispatch':'Design rationale: Format dispatch gives each file a defined capability set. Preserving an original DOCX package differs from rebuilding a generic document; original backups provide a recovery path when edits are limited.',
'Interview explanation: "I chose Markdown':'Design rationale: Markdown provides durable, portable source text and local previews without arbitrary editable HTML. Toolbar actions insert syntax rather than implementing a complete word processor.',
'Interview distinction:':'Design rationale: AI drafts content while local code creates and paginates the artifact. Markdown conversion is a separate deterministic workflow with no model-token requirement.',
'Interview answer: "I keep a semantic':'Design rationale: The annotation model is separate from the base document, supporting editing and undo without rewriting the PDF for every pointer sample. Export composes the annotations into a portable artifact.',
'Interview answer: "I separate recognition':'Design rationale: Recognition transcribes expressions and a restricted local parser evaluates them. This supports handwriting assistance without running arbitrary JavaScript or delegating every arithmetic result to a language model.',
'Interview answer: "A notebook':'Design rationale: Native OneNote export uses the original application renderer to preserve visual content more faithfully than a compatibility parser. The resulting dependency on Windows/desktop OneNote is explicit; direct PDF upload is an alternative.',
'Interview answer: "AI safety':'Design rationale: AI controls rely on capability scoping, data minimization and validated output. Prompt instructions alone cannot guarantee trustworthy model behavior. Provider policies and availability remain external dependencies.',
'Interview answer: "The model':'Design rationale: The model proposes language changes while deterministic code retains format ownership. Existing source phrasing and supported facts take priority over generic generated wording.',
'Interview answer: "I distinguish':'Design rationale: Employer facts and applicant facts have distinct roles. Research may change relevance but must not change what the applicant actually did.',
'Interview answer: "The workspace':'Design rationale: Workspace tools and the task graph project the same underlying records. They do not require a second task database for display.',
'Interview answer: "I wanted':'Design rationale: Study stars turns saved explanations into reusable review material. The current implementation tracks collection/review status; it is not an adaptive learning or spaced-repetition algorithm.',
'Interview answer: "This spin-off':'Design rationale: The standalone site separates public read-only event distribution from the private student workspace. Static hosting simplifies delivery, but fresh-data publishing remains a separate responsibility.',
'Interview closing:':'Engineering priority: Stabilize and measure the existing workflows before expanding feature breadth. Reliability, observability and maintainability are the next milestones.',
}
lines=[]
for line in text.splitlines():
    for prefix,replacement in notes.items():
        if line.startswith(prefix):line=replacement;break
    lines.append(line)
text='\n'.join(lines)+'\n'
text=text.replace('## Interview caveat','## Coverage boundary').replace('## Interview answer','## Design rationale').replace('## Interview phrasing','## Capability boundary').replace('## Interview explanation','## Implementation rationale')
text=text.replace('Never claim otherwise in an interview.','Use a dedicated redaction workflow when underlying source content must be removed.')
text=text.replace('## Before a live demonstration','## Prepare the workspace')
text=text.replace('Prepare a working account, a small PDF, a typed note, sample tasks and a saved job. Confirm optional integrations yourself. Keep a local-only demonstration path if the network or AI provider is unavailable. Never display .env files, tokens, private documents or a real key on a projector.','Prepare an account, a small PDF, a typed note, sample tasks and a saved job. Verify optional integrations before depending on them. Local notes and PDF tools remain useful when network services are unavailable. Keep environment files, credentials and private documents protected.')
text=text.replace('Suggested demo: preview a season, choose only Grands Prix, assign a Sports category, import, then demonstrate that another import reports existing entries. Only show that flow after verifying the live endpoint yourself.','Example workflow: preview a season, choose only Grands Prix, assign a Sports category and import. A subsequent import should identify already imported sessions. Check the live source and review timing information before relying on the schedule.')
text=text.replace('Do not offer a live reset during a demo with valuable data.','Do not reset an account containing valuable data without retaining any required exports first.')
text=text.replace('# Troubleshooting and demonstration recovery','# Troubleshooting and operational recovery').replace('## Safe demo fallback','## Working without external services')
text=text.replace('Use prepared records and local notes/PDF tools when external integrations fail. Explain the failure boundary and diagnostic rather than repeatedly calling a provider in front of the interviewer. Keep a copy of the source PDF and final reviewed artifact. Never reset the entire account as a troubleshooting shortcut during a demonstration.','Use saved records and local notes/PDF tools when external integrations fail. Inspect the failure stage and diagnostic before retrying a provider. Keep a copy of the source PDF and final reviewed artifact. Account reset is a permanent data operation, not a routine troubleshooting shortcut.')
text=text.replace('Review licenses and attribution when presenting reused components.','Review licenses and attribution for adapted components.')

# Rewrite the remaining standalone rationale paragraphs in neutral product prose.
text=text.replace('"The interesting part is not displaying a list of races. It is normalization and idempotency: identifying the same session on a later import, separating session types, handling missing timing data and preserving user edits. I make uncertainty visible instead of inventing an exact end time."','Schedule import depends on normalization and idempotency: identifying the same session on a later import, separating session types, handling missing timing data and preserving user edits. Uncertainty is visible rather than replaced with an invented exact end time.')
text=text.replace('"The assistant is integrated into the workflow, but it is not an unrestricted autonomous agent. It answers with selected context and can prepare a narrow set of supported edits for the currently open editor when authorized. It cannot arbitrarily mutate tasks or browse the entire internet as a general tool."','The assistant answers using selected context and can prepare a narrow set of supported edits for the currently open editor when authorized. It is not an unrestricted autonomous agent: it cannot arbitrarily mutate tasks or browse the entire internet as a general tool.')
text=text.replace('"I try cheap structured extraction first, retain raw evidence, and let the user correct the result. The difficult part is recovering semantic fields from arbitrary page layout, not just extracting text. A bigger version would use labeled evaluation sets and measure per-field precision/recall before claiming broad accuracy."','Structured extraction is attempted where available, source evidence is retained and fields remain reviewable. Recovering semantic fields from arbitrary layout differs from extracting raw text. Labeled evaluation sets and per-field precision/recall would support a broader quality assessment.')
text=text.replace('"The server checks what the model is allowed to propose, and the browser checks whether the target is still current. That handles both malformed output and the race where I keep editing while a request is in flight. The language model is not given direct database or filesystem access."','The server validates proposed model actions and the browser checks whether the target is still current. Together these checks handle malformed output and the race where editing continues while a request is in flight. The model receives no direct database or filesystem access.')
text=text.replace('"Save changes the app\'s persistent record; Download creates a local artifact. Some formats have a base file plus separately editable annotations. I make the export step explicit and use different recovery models for different data, rather than describing every action as universally undoable."',"Save changes the app's persistent record; Download creates a local artifact. Some formats consist of a base file plus separately editable annotations. Export is explicit, and each workflow has its own recovery model rather than a universal rollback mechanism.")
text=text.replace('## How to explain the design','## Relationship design')
text=text.replace('"I model relationships with IDs so a renamed document still resolves correctly. A relationship update and a document upload are different actions; deleting a relationship should not destroy shared data. For prerequisites, I chose advisory links rather than enforcing a scheduling engine, which makes the workflow flexible while still exposing cycles."','Stable IDs let renamed documents resolve correctly. Updating a relationship differs from uploading a file, and removing a link does not destroy shared data. Prerequisites are advisory rather than enforced scheduling constraints, preserving flexibility while exposing cycles.')

if re.search(r'interview',text,re.I):raise ValueError('Unexpected wording remains in the manuscript')
source.write_text(text,encoding='utf-8')
old.unlink()
old_pdf=out/'AssignmentTracker-Feature-and-Interview-Handbook.pdf'
new_pdf=out/'AssignmentTracker-Product-and-Technical-Handbook.pdf'
if old_pdf.exists():old_pdf.rename(new_pdf)

builder=root/'tmp/pdfs/build_handbook.py'
code=builder.read_text(encoding='utf-8').replace('AssignmentTracker-Feature-and-Interview-Handbook','AssignmentTracker-Product-and-Technical-Handbook')
code=code.replace('How to explain it.','Technical reference.').replace('A FIELD GUIDE FOR USING AND PRESENTING THE PROJECT','A COMPLETE PRODUCT AND TECHNICAL REFERENCE')
code=code.replace('demonstration sequence, interview questions, design tradeoffs,','guided workflows, engineering notes, design tradeoffs,')
code=code.replace('AssignmentTracker - Feature and Interview Handbook','AssignmentTracker - Product and Technical Handbook').replace('Application guide, architecture and interview preparation','Application features, architecture and technical reference').replace('FEATURES / ARCHITECTURE / INTERVIEW PREP','FEATURES / ARCHITECTURE / TECHNICAL REFERENCE')
code=code.replace('Rapid interview cheat sheet','Technical quick reference').replace("['If asked about...','Lead with...','Then disclose...']","['Area','Implementation','Boundary / tradeoff']")
code=code.replace("['Scaling','Storage/queues/shared coordination next','Do not claim those are deployed']","['Scaling','Storage/queues/shared coordination next','Proposed, not deployed infrastructure']").replace("['Testing','Describe a concrete validation plan','Do not invent passed checks or metrics']","['Testing','Representative fixtures and metrics','Source inspection is not test execution']")
code=code.replace("p('Before you walk in','h2')","p('Operational checklist','h2')").replace('Prepare a clean demo account, source documents, a reviewed output and a local-only fallback. Know one failure case, one technical tradeoff and one next improvement. Show evidence of your own contribution and be clear about adapted libraries and assistance.','Keep source documents, reviewed exports and recovery options available. Check integration configuration, protect credentials, review errors before retrying and distinguish implemented behavior from proposed improvements. Track adapted components and their license requirements.')
if re.search('interview',code,re.I):raise ValueError('Unexpected wording remains in PDF builder')
builder.write_text(code,encoding='utf-8')
print('Revised manuscript, cover, running headers, section titles, PDF metadata and quick reference.')
