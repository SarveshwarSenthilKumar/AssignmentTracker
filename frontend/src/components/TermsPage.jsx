import './TermsPage.css'

const sections=[
  ['service','About the platform',[
    'Assignment Tracker provides tools for organizing tasks, documents, calendars, study material, job applications and interview preparation. Features may include AI assistance, third-party integrations and an optional desktop study-phone browser.',
    'These draft terms describe the intended conditions of use. The platform operator and deployment-specific contact details must be finalized before these terms are adopted for a public service. Displaying this page does not by itself record your agreement.'
  ]],
  ['account','Your account',[
    'Provide accurate account information, keep your credentials private, and use only accounts and integrations you are authorized to access. You are responsible for activity you authorize through your account. If you suspect unauthorized access, change your credentials and notify the person or organization operating your deployment.',
    'Do not share API keys, passwords or other secrets in task descriptions, documents, public links or AI conversations. Use the designated account settings for supported credentials.'
  ]],
  ['use','Acceptable use',[
    'Use the platform lawfully and respect other people’s privacy and intellectual property. Do not upload malicious software, attempt to access another account, disrupt the service, bypass access controls, or use integrations without permission.',
    'Follow your school’s or employer’s rules for assignments, confidential information and AI use. You remain responsible for the accuracy and integrity of material you submit elsewhere.'
  ]],
  ['content','Your documents and other content',[
    'You retain your rights in content you provide. You authorize the platform operator to store, process, display and transmit that content as needed to provide features you use, including processing selected material through enabled integrations.',
    'Upload only material you own or have permission to use. Creating, editing or exporting a file does not grant rights to third-party content. Template and software licenses continue to apply; source credits are available where supplied.'
  ]],
  ['data','Storage, account data and device data',[
    'The platform stores account records such as tasks, documents, calendar entries, saved conversations and attendance logs. Some preferences and working sessions are stored on your device. Optional native website browsing may retain website cookies on that device.',
    'Storage analytics describe logical account-record sizes. They are not a measurement of network traffic, provider token consumption or all infrastructure storage. This page is not a substitute for a deployment-specific privacy notice describing the operator, hosting, data uses, retention and applicable choices.'
  ]],
  ['ai','AI features and generated material',[
    'AI features can send selected documents, prompts, answers and enabled workspace context to the configured provider, currently Gemini. Review Account AI access settings and the feature’s explanation before using it with sensitive content. The provider’s own terms and data practices also apply.',
    'AI answers, generated documents, interview feedback and suggestions can be incorrect or incomplete. Check facts, calculations, citations and wording before relying on them. Interview scores do not predict hiring outcomes, and generated resumes must reflect your actual experience.',
    'Your configured provider may impose charges, quotas or usage limits. You are responsible for understanding the terms of credentials and provider accounts you supply.'
  ]],
  ['integrations','Third-party integrations and websites',[
    'Canvas, public event feeds, connected accounts, external job websites and other integrations are operated independently. Their availability, accuracy, permissions and terms may change. Authorize only connections you intend to use.',
    'Embedded and desktop browsing do not guarantee access to any website or sign-in flow. A website can restrict embedding or desktop clients. Opening external links may leave the platform and place your interaction under another operator’s terms.'
  ]],
  ['deadlines','Scheduling and records',[
    'Review task deadlines, time zones, imported calendars and suggested dates. Natural-language detection proposes an interpretation for your confirmation; it does not establish an official deadline. Public events may change or be canceled.',
    'Attendance logs and completion records reflect information entered or recorded in your account. They are not independent verification of attendance, credentials or performance. Keep your own records for important obligations.'
  ]],
  ['files','Editing, exports and backups',[
    'File conversions and exports can change formatting, pagination or fonts. Covering text in a PDF is not secure redaction. Review exported files before sharing them, and retain originals and separate backups of important work.',
    'Recovery features are limited to the actions and retention periods described by each feature. They are not a universal backup service. Clearing browser data, destroying a live browsing tab or leaving a temporary session can remove unsaved work.'
  ]],
  ['deletion','Deletion and account reset',[
    'Removing an item, moving a document to Trash and performing a full account reset are different operations. Read the confirmation shown by each action. A full workspace reset removes the supported account records described in that flow and is not a routine troubleshooting step.',
    'A workspace reset is not necessarily account closure, deletion of third-party copies, or immediate erasure from every infrastructure backup. Retention and account-closure procedures must be specified by the operator for the particular deployment.'
  ]],
  ['availability','Availability and responsibility',[
    'Features may be updated, limited or unavailable because of maintenance, errors, connectivity or external providers. Do not treat the platform as the sole record for critical deadlines or as a guarantee of uninterrupted access or error-free output.',
    'Nothing in these draft terms is intended to exclude rights or obligations that cannot lawfully be excluded. Deployment-specific service commitments, liability provisions and dispute terms require separate review before publication.'
  ]],
  ['changes','Changes and questions',[
    'The version date identifies this draft. Material changes should be clearly communicated before they take effect; any required agreement process must be implemented separately. This page currently provides information only and does not add a signup acceptance requirement.',
    'For questions about this deployment, contact the person or organization that provided access. The operator’s legal identity and published support contact must be added before adopting a final version.'
  ]],
]

export default function TermsPage({signedIn=false}){
  return <main className="platform-viewport terms-page"><div className="terms-wrap"><a className="terms-back" href="#/home">← {signedIn?'Back to workspace':'Back to sign in'}</a><header><p>ASSIGNMENT TRACKER</p><h1>Terms and Conditions</h1><span>Draft · Version 1.0 · Last updated October 29, 2026</span></header><p className="terms-draft">Draft for review. Operator identity, contact details and deployment-specific policies have not yet been finalized.</p><nav aria-label="Terms sections">{sections.map(([id,title])=><button type="button" key={id} onClick={()=>document.getElementById(`terms-${id}`)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})}>{title}</button>)}</nav><article>{sections.map(([id,title,paragraphs],index)=><section key={id} id={`terms-${id}`}><h2>{index+1}. {title}</h2>{paragraphs.map((paragraph,i)=><p key={i}>{paragraph}</p>)}</section>)}</article><footer><a href="#/privacy">Privacy Policy</a><span aria-hidden="true"> · </span><a href="#/home">{signedIn?'Return to workspace':'Return to sign in'}</a></footer></div></main>
}
