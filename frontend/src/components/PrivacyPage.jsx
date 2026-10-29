import './TermsPage.css'
import { PRIVACY_VERSION, LEGAL_UPDATED_DATE } from '../lib/legalPolicy'

const sections=[
  ['scope','Who this policy covers',[
    'This draft describes data handling implemented in Assignment Tracker, including its academic tools, career preparation features and optional desktop study phone. It applies to this platform, not to external websites or independent AI and integration providers.',
    'The operator’s legal identity, privacy contact, hosting locations, provider list and retention schedule must be finalized for the actual deployment. This is an informational draft, not a claim that every legal requirement or hosting practice has been verified.'
  ]],
  ['collected','User data we collect',[
    'We collect and store user data when you create an account, enter information, upload files or use the platform’s features. This includes information you provide directly and information retrieved through integrations you authorize. The categories below describe the user data collected by the application.',
    'Account information includes your username, email address, password hash and preferences such as time zone, display options, confirmation settings and AI access choices.',
    'When you sign up, we also store the Terms and Conditions version you accepted, the server-recorded acceptance time and the signup-checkbox acceptance method. The review interface requires reaching the end of the terms and explicitly checking the agreement box; it cannot verify that you read or understood the text. Terms agreement is distinct from optional feature controls described in this policy.',
    'Workspace records may include tasks, descriptions, deadlines, dependencies, folders, uploaded files, original file backups, annotations, notes, calendar entries, document links, saved jobs, resume and cover-letter drafts, study stars, attendance logs and saved AI conversations. Feature suggestions, bug reports and reviewer responses are linked to the reporting account. An optional contact email supplied on either form is retained with the private submission for you and authorized reviewers; it does not change your account email or automatically send email. Optional report diagnostics contain browser information, language and screen dimensions only when included by the user. Private reports and suggestions are accessible to their author and configured reviewers. Authorized reviewers can separately publish public-safe feature summaries to the roadmap; the original submission and reporter identity are not automatically published.',
    'Content you provide can contain personal information about you or other people. Include only information you are authorized to share and avoid unnecessary sensitive data.'
  ]],
  ['purposes','How information is used',[
    'The application processes account data to authenticate access, save and retrieve your work, organize files, calculate deadlines and summaries, provide search and analytics, maintain supported recovery history and run features you request.',
    'Account analytics calculate record counts, storage sizes, task progress and activity from your account’s records. The displayed storage is logical database size, not a record of every network request or AI token used. Shared source caches and local device storage are outside that measurement.'
  ]],
  ['ai','AI processing and your choices',[
    'We use AI for many tasks across the platform, including chat assistance, document-related work, resume and cover-letter preparation, quizzes, project practice and other supported assistance. When these features run, we process and transmit the material needed for the requested AI task to the configured AI provider. This material may include uploaded documents and personal data about you or other people contained in those documents or in permitted workspace context.',
    'AI features currently use Gemini. Depending on the feature and enabled access settings, requests can include your prompts, selected documents, saved text edits, answers, conversation history and permitted workspace context. Resume quizzes and project practice send the selected source and the material needed to generate questions or review an answer.',
    'Personal data supplied for AI processing may include names, contact details, education and employment history in resumes or cover letters, and personal information in notes, task descriptions, calendar entries, files and conversations. Only provide material you are authorized to share for this purpose, and remove unnecessary sensitive information. The feature and its supported controls determine the material supplied; not every stored document or account record is automatically sent to AI.',
    'Review Account → AI access and each feature’s explanation before using it. Restrictions are feature-specific; document selections and context toggles determine what is supplied. Disabling future AI access does not withdraw material already sent to a provider.',
    'Provider retention, model-improvement use and processing locations depend on the provider, account type and configuration. This application does not establish or guarantee those policies. Consult the provider’s current privacy and API terms before sending confidential material.'
  ]],
  ['credentials','Credentials and connected accounts',[
    'Passwords are stored as bcrypt hashes. Saved Gemini keys are encrypted on the backend and decrypted when required for authorized provider requests; encryption depends on the deployment’s server secrets. Other integration credentials, including configured Canvas credentials, have their own storage and access paths. Do not assume every record or credential is end-to-end encrypted.',
    'Supported GitHub and LinkedIn connections retrieve basic profile identity information after authorization. The current connection flow stores supported profile fields and discards the temporary provider access token rather than keeping it for repository access or posting. Disconnecting a local connection is distinct from revoking authorization in the provider’s account settings.'
  ]],
  ['integrations','External services and website requests',[
    'Canvas synchronization, public campus feeds, company research, job imports and reference tools may request data from external services when their features run. Those services may receive request metadata and apply their own terms. Imported information is stored or cached as required by the integration.',
    'Opening a link or loading an embedded website connects your browser or desktop client to that website. It can receive your network address, browser information and interaction data, and may use its own cookies. Its privacy practices are separate from this policy.'
  ]],
  ['device','Browser storage and desktop website sessions',[
    'The browser stores your sign-in token and user summary locally, along with some preferences, workspace drafts and study-phone data. Other sessions, such as current quiz answers, may be temporary page state. Signing out does not necessarily clear every local preference or website cookie. Anyone with access to an unlocked device may be able to access locally retained information.',
    'Optional desktop phone browsing uses persistent website sessions separated by platform account on that device. Website cookies can remain after closing the phone or signing out. The full workspace-reset flow attempts to clear the applicable desktop website storage through its desktop bridge. Browser cleanup and third-party account controls remain separate actions.'
  ]],
  ['sharing','Recipients and infrastructure',[
    'Selected data is transmitted to integrations and AI providers when their features require it. The platform operator and infrastructure providers may also process stored records or operational data needed to host and maintain the deployment. The final policy must identify relevant providers, locations and purposes.',
    'This draft does not make an unverified promise that hosting providers collect no logs, that information is never disclosed, or that all processing stays in one country. Advertising, sale or sharing practices and any additional analytics tools must be assessed and disclosed by the operator before final publication.'
  ]],
  ['retention','Retention, deletion and recovery',[
    'Deleted tasks are removed from active task views and stored as recovery snapshots in Recently deleted for seven days, including information needed to restore supported task connections. You may restore individual deletions or deletion groups before expiry. Expired snapshots are excluded from recovery; automatic database cleanup may run after the expiry time.',
    'Saved records remain available according to the relevant feature and operator’s retention configuration. Some workflows keep temporary drafts, recovery snapshots, search indexes or change history. Moving a document to Trash is different from permanently deleting it.',
    'Full workspace reset deletes the supported account-owned records in that flow and resets specified settings. It is not the same as account closure, erasing all infrastructure backups, deleting downloads on your device, or removing information already held by an external provider. A final retention schedule and account-closure process must be provided by the operator.',
    'Workspace reset includes supported private bug reports and feature suggestions. Public roadmap entries are separate shared records; an already published public-safe summary remains on the roadmap after the originating account’s workspace reset.'
  ]],
  ['controls','Access, correction and other requests',[
    'Use the application’s edit, export, download, disconnect and delete controls for supported data. AI access settings control supported future AI requests. Keep separate copies of important work before a destructive action.',
    'For requests that cannot be completed using these controls, contact the person or organization operating your deployment. Applicable privacy choices and request procedures depend on the operator and jurisdiction; the final policy must provide a working privacy contact and response process. This page does not create a new automated account-deletion or data-access service.'
  ]],
  ['security','Security and operational limitations',[
    'The application uses authenticated requests and account-scoped queries, with password hashing and specific credential protections. These measures do not guarantee that access, transmission or storage is risk-free. Protect your devices and accounts, and do not place secrets in ordinary documents or prompts.',
    'Deployment security, access logging, backups, incident handling and retention must be managed by the operator. This draft is not a certification, audit result or guarantee of compliance.'
  ]],
  ['children','Children and deployment eligibility',[
    'The final operator must define the intended audience, age eligibility and any required consent arrangements before offering the service to children. The current application does not implement a dedicated parental-consent process. Schools and other organizations must review their own obligations before providing student accounts.'
  ]],
  ['changes','Updates and privacy contact',[
    `This draft is version ${PRIVACY_VERSION}, last updated ${LEGAL_UPDATED_DATE}. Material changes to data practices should be communicated clearly before taking effect, with any required choices or agreement handled separately. The current signup agreement applies to new registrations; the platform does not currently require existing users to accept updated terms again.`,
    'Privacy contact: the person or organization that provided access to this deployment. A verified operator name and published contact address must replace this interim description before the policy is finalized.'
  ]],
]

export default function PrivacyPage({signedIn=false}){
  return <main className="platform-viewport terms-page"><div className="terms-wrap"><a className="terms-back" href="#/home">← {signedIn?'Back to workspace':'Back to sign in'}</a><header><p>ASSIGNMENT TRACKER</p><h1>Privacy Policy</h1><span>Draft · Version {PRIVACY_VERSION} · Last updated {LEGAL_UPDATED_DATE}</span></header><p className="terms-draft">Draft for review. Operator identity, privacy contact, providers, hosting locations and retention details still need to be finalized.</p><nav aria-label="Privacy policy sections">{sections.map(([id,title])=><button key={id} type="button" onClick={()=>document.getElementById(`privacy-${id}`)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})}>{title}</button>)}</nav><article>{sections.map(([id,title,paragraphs],index)=><section id={`privacy-${id}`} key={id}><h2>{index+1}. {title}</h2>{paragraphs.map((paragraph,i)=><p key={i}>{paragraph}</p>)}</section>)}</article><footer><a href="#/terms">Terms and Conditions</a><span aria-hidden="true"> · </span><a href="#/home">{signedIn?'Return to workspace':'Return to sign in'}</a></footer></div></main>
}


