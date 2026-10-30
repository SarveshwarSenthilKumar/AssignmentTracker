import './TermsPage.css'
import { TERMS_VERSION, LEGAL_UPDATED_DATE } from '../lib/legalPolicy'
export { TERMS_VERSION } from '../lib/legalPolicy'

const sections=[
  ['service','About the platform',[
    'Assignment Tracker provides tools for organizing tasks, documents, calendars, study material, job applications and interview preparation. Features may include AI assistance, third-party integrations and an optional desktop study-phone browser.',
    'These draft terms describe the intended conditions of use. The platform operator and deployment-specific contact details must be finalized before these terms are adopted for a public service. Reading this page alone does not record agreement. Creating an account requires the separate review and agreement controls on the signup form.'
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
    'We collect and store user data when you create an account, enter information, upload files or use platform features, including information retrieved through integrations you authorize. This includes account details, preferences, tasks, documents, calendar entries, saved conversations, attendance logs and private feedback submissions. Signup records include the accepted terms version and acceptance time. Some preferences and working sessions are stored on your device. Optional native website browsing may retain website cookies on that device.',
    'The Privacy Policy describes the categories collected, purposes, recipients, storage, recovery and available controls. Agreement to these Terms is not a separate consent to every optional integration, AI request or diagnostic submission; those features have their own controls.',
    'Storage analytics describe logical account-record sizes. They are not a measurement of network traffic, provider token consumption or all infrastructure storage. This page is not a substitute for a deployment-specific privacy notice describing the operator, hosting, data uses, retention and applicable choices.'
  ]],
  ['ai','AI features and generated material',[
    'AI is used extensively throughout the platform. By explicitly agreeing to these Terms when creating an account and proceeding with enabled AI features, you authorize us to process your data and documents using AI for the platform purposes described here and in the Privacy Policy. These purposes include analyzing, extracting, summarizing, transforming and generating content, answering questions, providing document and editing assistance, and supporting study, planning and career-preparation tasks. We may choose the AI methods used to carry out these purposes, subject to the supported access controls and applicable law.',
    'This authorization can cover personal data in uploaded files, document text, notes, tasks, calendar information, resumes, cover letters, prompts and saved conversations when supplied to an enabled feature. Processing may involve transmitting that information to an external AI provider, currently Gemini. It is not an unrestricted permission to use information for unrelated purposes, disregard your supported settings or waive privacy rights. Training models on private workspace content or introducing materially different data uses would require additional disclosure and any legally required permission before that processing begins.',
    'We use AI across many platform tasks, including chat assistance, document-related work, resume and cover-letter preparation, quizzes, project practice and other supported assistance. AI processing can involve your uploaded documents and personal data, including information contained in resumes, notes, task descriptions, calendar entries, conversations and other permitted workspace context. Documents can also contain personal data about other people.',
    'AI features can send selected documents, prompts, answers and enabled workspace context to the configured provider, currently Gemini. Review Account AI access settings and the feature’s explanation before using it with sensitive content. The provider’s own terms and data practices also apply.',
    'Use these features only with material you are authorized to provide for AI processing. Choose source documents and context carefully, and remove unnecessary personal or sensitive information before submitting it. The material supplied depends on the feature and its supported access controls; these disclosures do not mean every stored document or account record is automatically sent to AI.',
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
    'Deleted tasks are removed from active task views and kept in Recently deleted for a seven-day recovery window. You can restore a deletion or a group of deleted tasks during that window. Expired deletions are no longer recoverable through the platform; database cleanup may occur after the expiry time.',
    'Removing an item, moving a document to Trash and performing a full account reset are different operations. Read the confirmation shown by each action. A full workspace reset removes the supported account records described in that flow and is not a routine troubleshooting step.',
    'A workspace reset is not necessarily account closure, deletion of third-party copies, or immediate erasure from every infrastructure backup. Retention and account-closure procedures must be specified by the operator for the particular deployment.'
  ]],
  ['feedback','Private feedback and public roadmap',[
    'Bug reports and feature suggestions are linked to your account and available to you and authorized reviewers. An optional contact email and any diagnostics you choose to include are stored with the submission. Supplying an email does not change your account email or automatically send a message.',
    'Authorized reviewers may separately publish a public-safe feature summary on the public roadmap. Private submissions and reporter identities are not automatically published. A workspace reset removes supported private feedback records, but does not remove an already published public roadmap entry.'
  ]],
  ['availability','Availability and responsibility',[
    'Features may be updated, limited or unavailable because of maintenance, errors, connectivity or external providers. Do not treat the platform as the sole record for critical deadlines or as a guarantee of uninterrupted access or error-free output.',
    'Nothing in these draft terms is intended to exclude rights or obligations that cannot lawfully be excluded. Deployment-specific service commitments, liability provisions and dispute terms require separate review before publication.'
  ]],
  ['changes','Changes and questions',[
    'The version date identifies this draft. Material changes should be clearly communicated before they take effect; any required agreement process must be implemented separately. Existing users must review and explicitly accept the current Terms and Conditions and acknowledge the current Privacy Policy before continuing whenever either accepted version is out of date. Workspace access is blocked until agreement is saved; users may read both documents or sign out instead. New accounts must complete the terms review and explicitly agree before signup. The server records the accepted version and acceptance time; reaching the end of a document does not establish that a person understood it.',
    'For questions about this deployment, contact the person or organization that provided access. The operator’s legal identity and published support contact must be added before adopting a final version.'
  ]],
]

export function TermsContent(){
  return <article>{sections.map(([id,title,paragraphs],index)=><section key={id} id={`terms-${id}`}><h2>{index+1}. {title}</h2>{paragraphs.map((paragraph,i)=><p key={i}>{paragraph}</p>)}</section>)}</article>
}

export default function TermsPage({signedIn=false}){
  return <main className="platform-viewport terms-page"><div className="terms-wrap"><a className="terms-back" href="#/home">← {signedIn?'Back to workspace':'Back to sign in'}</a><header><p>ASSIGNMENT TRACKER</p><h1>Terms and Conditions</h1><span>Draft · Version {TERMS_VERSION} · Last updated {LEGAL_UPDATED_DATE}</span></header><p className="terms-draft">Draft for review. Operator identity, contact details and deployment-specific policies have not yet been finalized.</p><nav aria-label="Terms sections">{sections.map(([id,title])=><button type="button" key={id} onClick={()=>document.getElementById(`terms-${id}`)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})}>{title}</button>)}</nav><TermsContent/><footer><a href="#/privacy">Privacy Policy</a><span aria-hidden="true"> · </span><a href="#/home">{signedIn?'Return to workspace':'Return to sign in'}</a></footer></div></main>
}


