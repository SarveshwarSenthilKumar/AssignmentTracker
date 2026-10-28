# AssignmentTracker update logbook

Updated: October 28, 2026 (America/Chicago).

## Numbering and coverage

This logbook covers all 282 commits reachable from HEAD `5d82697`, ordered oldest to newest when assigning numbers. Each commit receives one sequential update number starting at 001. These are documentation references, not application release versions. Dates and original subjects come from Git history. Unmerged branches and work outside this checkout are not covered.

Update 283 records this documentation change and has no commit hash yet. Append the next unused number for future work; never renumber existing entries. Multiple changes in one commit share its update number.

## Verification and setup

No tests, builds, linters, live API probes or browser QA were run while preparing this logbook. Recent implementation notes describe source changes, not verified runtime outcomes. Older subjects are preserved as historical records and do not independently establish test results.

Backend routes/models require a backend restart; Vite proxy changes require a frontend restart. Gemini features require a saved API key and enabled AI scopes. Native phone browsing requires the optional desktop host. Website access and exact PDF font matching retain the limitations documented below.

## Recent update index

| Update | Date | Change | Commit |
| --- | --- | --- | --- |
| [Update 282](#update-282) | 2026-10-28 | Updated focusing logic in calendar | `5d82697` |
| [Update 281](#update-281) | 2026-10-28 | Added more ideas for the future of the platform | `cfef494` |
| [Update 280](#update-280) | 2026-10-28 | Added ability to log events for attendance | `9a0c46e` |
| [Update 279](#update-279) | 2026-10-28 | Added suggested events to calendar | `35fb92d` |
| [Update 278](#update-278) | 2026-10-28 | Added an editable original template for resume | `b699987` |
| [Update 277](#update-277) | 2026-10-27 | Added a career prep page | `3774376` |
| [Update 276](#update-276) | 2026-10-27 | Added ability to get quizzed on the resume | `b5aabed` |
| [Update 275](#update-275) | 2026-10-27 | Added multiple types of resume templates | `03a23f4` |
| [Update 274](#update-274) | 2026-10-27 | Updating resumes to work with templates | `e99cfa0` |
| [Update 273](#update-273) | 2026-10-27 | Fixed minor syntax error | `6e74ed5` |
| [Update 272](#update-272) | 2026-10-26 | Improved pdf font matching for pdf editor | `f7aa291` |
| [Update 271](#update-271) | 2026-10-26 | Fixing website inside phones | `20ec236` |
| [Update 270](#update-270) | 2026-10-26 | Fixed phone shaking issue for emulator | `96a1064` |
| [Update 269](#update-269) | 2026-10-26 | Updated phone with improved feature set | `5117adb` |
| [Update 268](#update-268) | 2026-10-26 | Added more complex features to the embedded phone | `8fe7c14` |
| [Update 267](#update-267) | 2026-10-26 | Updated rendering logic for latex and markdown | `6888758` |

## Update 283

**Date:** 2026-10-28. **Commit:** pending (this documentation change).

- Created a numbered logbook for every commit reachable from HEAD, including dates, subjects, hashes and changed-file inventories.
- Expanded recent feature/fix entries with behavior, setup requirements, limitations and verification status.
- Linked the logbook from README.md. No application behavior changed in this update.

## Complete numbered history

Newest entries appear first. Numbers were assigned from oldest to newest. File inventories include additions, changes and deletions as reported by Git name-only output. Entries without expanded notes retain their original commit summary.

## Update 282

**Date:** 2026-10-28. **Commit:** `5d82697fe1035dfbe5c6dda88162802cb3f826f8`.

**Change:** Updated focusing logic in calendar

Calendar event selection now scrolls to and focuses its details, including repeat clicks. Day-list, month and agenda selections use the same helper. Suggested events also use it. Rendering is allowed to finish before scrolling; reduced motion, animation-frame cleanup and sticky-header clearance are included.

**Changed files:**

- `frontend/src/components/CalendarPage.css`
- `frontend/src/components/CalendarPage.jsx`
- `ideas.txt`

## Update 281

**Date:** 2026-10-28. **Commit:** `cfef494c7dee4e8fc85b4bf1c6e0800b92c6fb8e`.

**Change:** Added more ideas for the future of the platform

Ideas-only planning update. Entries in ideas.txt are proposals, not a claim that those features have been implemented.

**Changed files:**

- `ideas.txt`

## Update 280

**Date:** 2026-10-28. **Commit:** `9a0c46e505a55bf179a47139687c206bb1b613d3`.

**Change:** Added ability to log events for attendance

Calendar includes an account-owned attended-events log with manual entries and Log attendance from event details. Records include name, date, location, notes and takeaways, with search, editing and inline-confirmed removal. Removing attendance leaves the calendar event intact. Calendar-linked records have duplicate protection; full account reset clears attendance. GET/POST /api/event-attendance and PUT/DELETE /api/event-attendance/:id require a backend restart.

**Changed files:**

- `backend/accountReset.js`
- `backend/eventAttendance.js`
- `backend/server.js`
- `frontend/src/components/CalendarPage.jsx`
- `frontend/src/components/EventAttendance.css`
- `frontend/src/components/EventAttendance.jsx`

## Update 279

**Date:** 2026-10-28. **Commit:** `35fb92de4ad604773e517558c1027d3a4de304d7`.

**Change:** Added suggested events to calendar

Suggested events appear on Calendar and Home: up to six loaded TXST events within 30 days, ordered by date, with times, locations and detail actions. Calendar suggestions follow the TXST source toggle; both surfaces respect removed events and the account-wide TXST removal setting. Loading, warning and empty states are included. These are chronological discovery suggestions, not AI-personalized recommendations.

**Changed files:**

- `frontend/src/components/CalendarPage.jsx`
- `frontend/src/components/HomePage.jsx`
- `frontend/src/components/SuggestedEvents.css`
- `frontend/src/components/SuggestedEvents.jsx`

## Update 278

**Date:** 2026-10-28. **Commit:** `b699987457c70b026d258fc7b3d9c4179aa0f640`.

**Change:** Added an editable original template for resume

Added editable Word adaptations of Jake Gutierrez’s resume and Sourabh Bajaj’s developer resume. All / Built-in / From the web filters, original-source links and MIT license notices are included. License text is retained in Word description metadata. Adaptations use user-supplied content and are not official or pixel-identical Word editions. Sources: https://github.com/jakegut/resume and https://github.com/sb2nov/resume.

**Changed files:**

- `frontend/src/assets/resume-template-licenses.txt`
- `frontend/src/components/ResumeTemplateGallery.jsx`
- `frontend/src/components/ResumesPage.css`
- `frontend/src/lib/resumeTemplates.js`

## Update 277

**Date:** 2026-10-27. **Commit:** `37743761ffd2f1b2b7eb82e80145ceed5120bf87`.

**Change:** Added a career prep page

Career → Prep (#/prep) collects interview practice, resumes and templates, cover letters and saved jobs. Visited tools remain mounted while switching within Prep to preserve the practice session. Leaving Prep clears the current quiz; saved documents and jobs persist.

**Changed files:**

- `frontend/src/App.jsx`
- `frontend/src/components/AppNavigation.jsx`
- `frontend/src/components/PrepPage.css`
- `frontend/src/components/PrepPage.jsx`
- `frontend/src/components/ResumeQuiz.jsx`
- `frontend/src/components/ResumesPage.jsx`

## Update 276

**Date:** 2026-10-27. **Commit:** `b5aabed84a49adb62024efdea083d5053ab66c1a`.

**Change:** Added ability to get quizzed on the resume

Resume/project interview practice accepts a saved document or pasted description, three difficulty levels and 3/5/8/10 questions. Features include hints, answers, Gemini feedback, strengths, improvements, coaching scores, example answers, navigation, skip/revisit and a session summary. POST /api/resumes/quiz checks ownership, AI scopes and saved Gemini credentials, with bounded requests, rate limiting, concurrency control, timeout and cancellation. Selected source content and saved text edits are sent; unsaved edits are excluded. Sessions are page-local. Feedback may be inaccurate and is not a hiring prediction. Restart the backend and configure a Gemini key.

**Changed files:**

- `backend/resumeQuiz.js`
- `backend/server.js`
- `frontend/src/components/ResumeQuiz.css`
- `frontend/src/components/ResumeQuiz.jsx`
- `frontend/src/components/ResumesPage.jsx`

## Update 275

**Date:** 2026-10-27. **Commit:** `03a23f4fd284a5792ebc1274e31b21dd89c29cb8`.

**Change:** Added multiple types of resume templates

Added Classic, Modern, Compact and Academic layouts with illustrative previews and content-preserving selection. Name, contact information, profile, experience, education, projects and skills generate an editable DOCX using the existing docx dependency. Empty sections are omitted; hyphen-prefixed lines become bullets. Saved templates appear in Resumes/Documents and can be selected for tailoring. Existing uploaded resumes also support Use as template. Template creation needs no AI key.

**Changed files:**

- `frontend/src/components/ResumeTemplateGallery.jsx`
- `frontend/src/components/ResumesPage.css`
- `frontend/src/components/ResumesPage.jsx`

## Update 274

**Date:** 2026-10-27. **Commit:** `e99cfa04a4cc25a39af7af7393cd318fdc363b2e`.

**Change:** Updating resumes to work with templates

Resume template workflow integration. The subsequent numbered template and syntax updates document completion of the picker and related corrections.

**Changed files:**

- `frontend/src/components/CoverLetterGenerator.jsx`
- `frontend/src/components/ResumeTemplateGallery.jsx`
- `frontend/src/components/ResumesPage.css`
- `frontend/src/components/ResumesPage.jsx`
- `frontend/src/lib/resumeTemplates.js`

## Update 273

**Date:** 2026-10-27. **Commit:** `6e74ed54fc0d524bb0071d68ae344aed4312e34f`.

**Change:** Fixed minor syntax error

Syntax/implementation corrections and login-response handling: login/register use the shared API reader, request timeouts, token/user validation and email normalization. Vite returns JSON 503 responses when the backend is unreachable. Authentication checks JWT_SECRET and database readiness; malformed stored sessions are discarded. Restart frontend/backend. Clearer errors still require a working API, configured secret and database.

**Changed files:**

- `backend/server.js`
- `frontend/src/components/Auth.jsx`
- `frontend/src/contexts/AuthContext.jsx`
- `frontend/src/lib/apiResponse.js`
- `frontend/vite.config.js`

## Update 272

**Date:** 2026-10-26. **Commit:** `f7aa291f4d30c12f23abeffa480f717738239e67`.

**Change:** Improved pdf font matching for pdf editor

PDF replacement text recognizes Computer Modern variants including CMMI and uses bundled KaTeX-compatible font bytes for preview/export. Use font file accepts TTF/OTF data, retains it with saved annotations and restores preview fonts. Embedded fonts retain priority. Substitutes do not guarantee original outlines, and unsupported replacement glyphs may still block export. Exact font recovery requires original font data.

**Changed files:**

- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/lib/pdfExistingText.js`
- `frontend/src/lib/pdfFontCatalog.js`
- `frontend/src/lib/pdfReplacementFonts.js`
- `frontend/src/lib/pdfTextStyle.js`

## Update 271

**Date:** 2026-10-26. **Commit:** `20ec236a5dba2a439927173d43ae343aa03a4d0c`.

**Change:** Fixing website inside phones

Optional Electron desktop host places sandboxed WebContentsView pages inside the study phone, with actual navigation, zoom, bounds tracking and tab lifecycle handling. Website sessions are partitioned per account; reset clears website storage. Start the usual backend/frontend, install desktop dependencies and run npm start in desktop; see desktop/README.md. Regular browsers retain framing restrictions. Website/sign-in compatibility, including Chess.com, was not runtime-verified. Device permissions and downloads are disabled.

**Changed files:**

- `desktop/README.md`
- `desktop/main.cjs`
- `desktop/package.json`
- `desktop/preload.cjs`
- `frontend/src/components/NativePhonePage.jsx`
- `frontend/src/components/PhoneBrowser.css`
- `frontend/src/components/PhoneBrowser.jsx`
- `frontend/src/components/StudyPhone.jsx`

## Update 270

**Date:** 2026-10-26. **Commit:** `96a106439106f5fb1e8d7254a81b8309833d57bd`.

**Change:** Fixed phone shaking issue for emulator

**Changed files:**

- `README.md`
- `frontend/src/components/DocumentEditor.css`
- `frontend/src/components/PhoneBrowser.css`
- `frontend/src/components/PhoneBrowser.jsx`
- `frontend/src/components/StudyPhone.jsx`
- `frontend/src/lib/phoneWeb.js`

## Update 269

**Date:** 2026-10-26. **Commit:** `5117adb638dcc80f3455a7f47ce77669c260938a`.

**Change:** Updated phone with improved feature set

**Changed files:**

- `README.md`
- `backend/phoneReference.js`
- `frontend/src/components/PhoneBrowser.css`
- `frontend/src/components/PhoneBrowser.jsx`
- `frontend/src/components/PhoneToolkit.css`
- `frontend/src/components/PhoneToolkit.jsx`
- `frontend/src/components/StudyPhone.css`
- `frontend/src/components/StudyPhone.jsx`
- `frontend/src/hooks/usePhoneApps.js`
- `frontend/src/lib/phoneWeb.js`

## Update 268

**Date:** 2026-10-26. **Commit:** `8fe7c14d52e34144dd0d0ab10d76f5f239ba2aaf`.

**Change:** Added more complex features to the embedded phone

**Changed files:**

- `README.md`
- `frontend/src/components/PhoneBrowser.css`
- `frontend/src/components/PhoneBrowser.jsx`
- `frontend/src/components/StudyPhone.jsx`

## Update 267

**Date:** 2026-10-26. **Commit:** `68887582b05d9b5921f3093d4e55b11e0a0171f2`.

**Change:** Updated rendering logic for latex and markdown

**Changed files:**

- `README.md`
- `backend/phoneReference.js`
- `frontend/src/components/AssistantMarkdown.jsx`
- `frontend/src/components/StudyPhone.css`
- `frontend/src/components/StudyPhone.jsx`
- `frontend/src/lib/referenceMarkdown.js`

## Update 266

**Date:** 2026-10-26. **Commit:** `2a22cdb5213250193e612682462889e3146f47a1`.

**Change:** Updated references to redirect to wikipedia

**Changed files:**

- `README.md`
- `backend/phoneReference.js`
- `frontend/src/components/StudyPhone.jsx`

## Update 265

**Date:** 2026-10-26. **Commit:** `c7989a030ce6183caabe6dbdb75fa42ab404269e`.

**Change:** Attempt to save phone as the main device

**Changed files:**

- `README.md`
- `backend/package-lock.json`
- `backend/package.json`
- `backend/phoneReference.js`
- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/StudyPhone.css`
- `frontend/src/components/StudyPhone.jsx`

## Update 264

**Date:** 2026-10-26. **Commit:** `e184a081c10efc33139089aa62fc22e7911cfadd`.

**Change:** Added option to open in normal tab as a fallback

**Changed files:**

- `README.md`
- `frontend/src/components/StudyPhone.css`
- `frontend/src/components/StudyPhone.jsx`

## Update 263

**Date:** 2026-10-26. **Commit:** `b311133d1430133c196a6e5e314c065ec0b02299`.

**Change:** Added a toggle for the study phone in accounts

**Changed files:**

- `README.md`
- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/DocumentEditor.jsx`
- `frontend/src/components/NoteStudio.jsx`
- `frontend/src/components/PDFEditorChrome.jsx`
- `frontend/src/components/StudyPhone.jsx`
- `frontend/src/components/StudyPhoneSettings.jsx`
- `frontend/src/components/WorkflowTools.jsx`
- `ideas.txt`

## Update 262

**Date:** 2026-10-26. **Commit:** `c0f3d36f040eda2968972d578107067789edabb9`.

**Change:** Added an emulated phone while studying

**Changed files:**

- `README.md`
- `frontend/src/App.jsx`
- `frontend/src/components/DocumentEditor.jsx`
- `frontend/src/components/NoteStudio.jsx`
- `frontend/src/components/PDFEditorChrome.jsx`
- `frontend/src/components/StudyPhone.css`
- `frontend/src/components/StudyPhone.jsx`
- `frontend/src/components/WorkflowTools.jsx`
- `frontend/src/lib/shortcuts.js`

## Update 261

**Date:** 2026-10-26. **Commit:** `1ee2a16e15a7996cfdf3681a6de61149e71b593f`.

**Change:** Fixed syntax error preventing startup

**Changed files:**

- `frontend/src/components/PDFGraph.jsx`

## Update 260

**Date:** 2026-10-26. **Commit:** `7aea42322d7e9e5af5a0802d754688374ef0c14d`.

**Change:** Updated to remove keyword for technical handbook

**Changed files:**

- `output/pdf/AssignmentTracker-Product-and-Technical-Handbook.md`
- `output/pdf/AssignmentTracker-Product-and-Technical-Handbook.pdf`
- `tmp/pdfs/build_handbook.py`
- `tmp/pdfs/handbook-map.json`
- `tmp/pdfs/review-1.png`
- `tmp/pdfs/review-2.png`
- `tmp/pdfs/review-3.png`
- `tmp/pdfs/revise_handbook.py`
- `tmp/pdfs/revised-01.png`
- `tmp/pdfs/revised-02.png`
- `tmp/pdfs/revised-03.png`
- `tmp/pdfs/revised-04.png`
- `tmp/pdfs/revised-05.png`
- `tmp/pdfs/revised-06.png`
- `tmp/pdfs/revised-07.png`
- `tmp/pdfs/revised-08.png`
- `tmp/pdfs/revised-09.png`
- `tmp/pdfs/revised-10.png`
- `tmp/pdfs/revised-11.png`
- `tmp/pdfs/revised-12.png`
- `tmp/pdfs/revised-13.png`
- `tmp/pdfs/revised-14.png`
- `tmp/pdfs/revised-15.png`
- `tmp/pdfs/revised-16.png`
- `tmp/pdfs/revised-17.png`
- `tmp/pdfs/revised-18.png`
- `tmp/pdfs/revised-19.png`
- `tmp/pdfs/revised-20.png`
- `tmp/pdfs/revised-21.png`
- `tmp/pdfs/revised-22.png`
- `tmp/pdfs/revised-23.png`
- `tmp/pdfs/revised-24.png`
- `tmp/pdfs/revised-25.png`
- `tmp/pdfs/revised-26.png`
- `tmp/pdfs/revised-27.png`
- `tmp/pdfs/revised-28.png`
- `tmp/pdfs/revised-29.png`
- `tmp/pdfs/revised-30.png`
- `tmp/pdfs/revised-31.png`
- `tmp/pdfs/revised-32.png`
- `tmp/pdfs/revised-33.png`
- `tmp/pdfs/revised-34.png`
- `tmp/pdfs/revised-35.png`
- `tmp/pdfs/revised-36.png`
- `tmp/pdfs/revised-37.png`
- `tmp/pdfs/revised-38.png`
- `tmp/pdfs/revised-39.png`
- `tmp/pdfs/revised-40.png`
- `tmp/pdfs/revised-41.png`
- `tmp/pdfs/revised-42.png`
- `tmp/pdfs/revised-43.png`
- `tmp/pdfs/revised-44.png`
- `tmp/pdfs/revised-45.png`
- `tmp/pdfs/revised-46.png`
- `tmp/pdfs/revised-47.png`
- `tmp/pdfs/revised-48.png`
- `tmp/pdfs/revised-49.png`
- `tmp/pdfs/revised-50.png`
- `tmp/pdfs/revised-51.png`
- `tmp/pdfs/revised-52.png`
- `tmp/pdfs/revised-53.png`
- `tmp/pdfs/revised-54.png`
- `tmp/pdfs/revised-55.png`
- `tmp/pdfs/revised-56.png`
- `tmp/pdfs/revised-57.png`

## Update 259

**Date:** 2026-10-26. **Commit:** `902a182ad953cde3581a248ebe847543dc11c836`.

**Change:** Created a handbook for platform

**Changed files:**

- `output/pdf/AssignmentTracker-Feature-and-Interview-Handbook.md`
- `output/pdf/AssignmentTracker-Feature-and-Interview-Handbook.pdf`
- `tmp/pdfs/build_handbook.py`
- `tmp/pdfs/contact-1.png`
- `tmp/pdfs/contact-2.png`
- `tmp/pdfs/contact-3.png`
- `tmp/pdfs/detail.png`
- `tmp/pdfs/final-01.png`
- `tmp/pdfs/final-02.png`
- `tmp/pdfs/final-03.png`
- `tmp/pdfs/final-04.png`
- `tmp/pdfs/final-05.png`
- `tmp/pdfs/final-06.png`
- `tmp/pdfs/final-07.png`
- `tmp/pdfs/final-08.png`
- `tmp/pdfs/final-09.png`
- `tmp/pdfs/final-10.png`
- `tmp/pdfs/final-11.png`
- `tmp/pdfs/final-12.png`
- `tmp/pdfs/final-13.png`
- `tmp/pdfs/final-14.png`
- `tmp/pdfs/final-15.png`
- `tmp/pdfs/final-16.png`
- `tmp/pdfs/final-17.png`
- `tmp/pdfs/final-18.png`
- `tmp/pdfs/final-19.png`
- `tmp/pdfs/final-20.png`
- `tmp/pdfs/final-21.png`
- `tmp/pdfs/final-22.png`
- `tmp/pdfs/final-23.png`
- `tmp/pdfs/final-24.png`
- `tmp/pdfs/final-25.png`
- `tmp/pdfs/final-26.png`
- `tmp/pdfs/final-27.png`
- `tmp/pdfs/final-28.png`
- `tmp/pdfs/final-29.png`
- `tmp/pdfs/final-30.png`
- `tmp/pdfs/final-31.png`
- `tmp/pdfs/final-32.png`
- `tmp/pdfs/final-33.png`
- `tmp/pdfs/final-34.png`
- `tmp/pdfs/final-35.png`
- `tmp/pdfs/final-36.png`
- `tmp/pdfs/final-37.png`
- `tmp/pdfs/final-38.png`
- `tmp/pdfs/final-39.png`
- `tmp/pdfs/final-40.png`
- `tmp/pdfs/final-41.png`
- `tmp/pdfs/final-42.png`
- `tmp/pdfs/final-43.png`
- `tmp/pdfs/final-44.png`
- `tmp/pdfs/final-45.png`
- `tmp/pdfs/final-46.png`
- `tmp/pdfs/final-47.png`
- `tmp/pdfs/final-48.png`
- `tmp/pdfs/final-49.png`
- `tmp/pdfs/final-50.png`
- `tmp/pdfs/final-51.png`
- `tmp/pdfs/final-52.png`
- `tmp/pdfs/final-53.png`
- `tmp/pdfs/final-54.png`
- `tmp/pdfs/final-55.png`
- `tmp/pdfs/final-56.png`
- `tmp/pdfs/final-57.png`
- `tmp/pdfs/final-contact-1.png`
- `tmp/pdfs/final-contact-2.png`
- `tmp/pdfs/final-contact-3.png`
- `tmp/pdfs/handbook-01.png`
- `tmp/pdfs/handbook-02.png`
- `tmp/pdfs/handbook-03.png`
- `tmp/pdfs/handbook-04.png`
- `tmp/pdfs/handbook-05.png`
- `tmp/pdfs/handbook-06.png`
- `tmp/pdfs/handbook-07.png`
- `tmp/pdfs/handbook-08.png`
- `tmp/pdfs/handbook-09.png`
- `tmp/pdfs/handbook-10.png`
- `tmp/pdfs/handbook-11.png`
- `tmp/pdfs/handbook-12.png`
- `tmp/pdfs/handbook-13.png`
- `tmp/pdfs/handbook-14.png`
- `tmp/pdfs/handbook-15.png`
- `tmp/pdfs/handbook-16.png`
- `tmp/pdfs/handbook-17.png`
- `tmp/pdfs/handbook-18.png`
- `tmp/pdfs/handbook-19.png`
- `tmp/pdfs/handbook-20.png`
- `tmp/pdfs/handbook-21.png`
- `tmp/pdfs/handbook-22.png`
- `tmp/pdfs/handbook-23.png`
- `tmp/pdfs/handbook-24.png`
- `tmp/pdfs/handbook-25.png`
- `tmp/pdfs/handbook-26.png`
- `tmp/pdfs/handbook-27.png`
- `tmp/pdfs/handbook-28.png`
- `tmp/pdfs/handbook-29.png`
- `tmp/pdfs/handbook-30.png`
- `tmp/pdfs/handbook-31.png`
- `tmp/pdfs/handbook-32.png`
- `tmp/pdfs/handbook-33.png`
- `tmp/pdfs/handbook-34.png`
- `tmp/pdfs/handbook-35.png`
- `tmp/pdfs/handbook-36.png`
- `tmp/pdfs/handbook-37.png`
- `tmp/pdfs/handbook-38.png`
- `tmp/pdfs/handbook-39.png`
- `tmp/pdfs/handbook-40.png`
- `tmp/pdfs/handbook-41.png`
- `tmp/pdfs/handbook-42.png`
- `tmp/pdfs/handbook-43.png`
- `tmp/pdfs/handbook-44.png`
- `tmp/pdfs/handbook-45.png`
- `tmp/pdfs/handbook-46.png`
- `tmp/pdfs/handbook-47.png`
- `tmp/pdfs/handbook-48.png`
- `tmp/pdfs/handbook-49.png`
- `tmp/pdfs/handbook-50.png`
- `tmp/pdfs/handbook-51.png`
- `tmp/pdfs/handbook-52.png`
- `tmp/pdfs/handbook-53.png`
- `tmp/pdfs/handbook-54.png`
- `tmp/pdfs/handbook-55.png`
- `tmp/pdfs/handbook-56.png`
- `tmp/pdfs/handbook-57.png`
- `tmp/pdfs/handbook-58.png`
- `tmp/pdfs/handbook-59.png`
- `tmp/pdfs/handbook-60.png`
- `tmp/pdfs/handbook-61.png`
- `tmp/pdfs/handbook-map.json`

## Update 258

**Date:** 2026-10-25. **Commit:** `da2648780244c6060a5fdbd57a5a6515be9642bb`.

**Change:** Added ability to add media to folder descs

**Changed files:**

- `README.md`
- `backend/folderAttachments.js`
- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/DocumentLibrary.jsx`
- `frontend/src/components/FolderAttachments.css`
- `frontend/src/components/FolderAttachments.jsx`
- `frontend/src/components/FolderDescription.jsx`
- `frontend/src/components/FolderHierarchyControls.jsx`

## Update 257

**Date:** 2026-10-25. **Commit:** `ebbb626b017481b25ac41440a3c8a2bba185437f`.

**Change:** Added ability to give each folder a description

**Changed files:**

- `README.md`
- `backend/folderHierarchy.js`
- `backend/globalSearch.js`
- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/DocumentLibrary.jsx`
- `frontend/src/components/FolderDescription.css`
- `frontend/src/components/FolderDescription.jsx`
- `frontend/src/components/FolderHierarchyControls.jsx`
- `frontend/src/components/UploadFolderPicker.jsx`

## Update 256

**Date:** 2026-10-25. **Commit:** `ab9e086f13145215b96ff66a5e0a2bdf32977e57`.

**Change:** Added ability to toggle in progress bar

**Changed files:**

- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/TaskDisplaySettings.jsx`

## Update 255

**Date:** 2026-10-25. **Commit:** `553704c8f7dfc70c55625deed3d3810745f7f7ad`.

**Change:** Fixed syntax error in Note Studio file

**Changed files:**

- `frontend/src/components/NoteStudio.jsx`

## Update 254

**Date:** 2026-10-25. **Commit:** `761fc74ba6dafa4eaabc7896c42b043cc45bc0b0`.

**Change:** Updating ideas with finished ideas

**Changed files:**

- `ideas.txt`

## Update 253

**Date:** 2026-10-25. **Commit:** `bf6ef832f9ff81c7a6e7852381707d20cb5c9ece`.

**Change:** Implemented new folder when new doc feature

**Changed files:**

- `README.md`
- `frontend/src/App.jsx`
- `frontend/src/components/OneNoteImport.jsx`
- `frontend/src/components/PDFUploadModal.jsx`
- `frontend/src/components/UploadFolderPicker.css`
- `frontend/src/components/UploadFolderPicker.jsx`

## Update 252

**Date:** 2026-10-25. **Commit:** `667372d3a94a2ed65e5b844e8f5bbd61cc815cc2`.

**Change:** Added the ability to save the location when saving

**Changed files:**

- `README.md`
- `frontend/src/components/AssistantChat.jsx`
- `frontend/src/components/CoverLettersPage.jsx`
- `frontend/src/components/DocumentEditor.jsx`
- `frontend/src/components/DocumentLibrary.jsx`
- `frontend/src/components/MarkdownPDFCreator.jsx`
- `frontend/src/components/NoteStudio.jsx`
- `frontend/src/components/OneNoteImport.jsx`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFGraph.jsx`
- `frontend/src/components/ResumesPage.jsx`
- `frontend/src/components/WorkflowWorkspace.jsx`
- `frontend/src/lib/documentFormats.js`
- `frontend/src/lib/download.css`
- `frontend/src/lib/download.js`

## Update 251

**Date:** 2026-10-25. **Commit:** `f32b133219ae30cf543e80f497b78abd9d3d716a`.

**Change:** Updated formatting of existing typed notes

**Changed files:**

- `README.md`
- `frontend/src/components/DocumentEditor.jsx`
- `frontend/src/components/DocumentLibrary.jsx`
- `frontend/src/components/MarkdownPDFCreator.jsx`
- `frontend/src/components/NoteStudio.css`
- `frontend/src/components/NoteStudio.jsx`
- `frontend/src/lib/noteTemplates.js`

## Update 250

**Date:** 2026-10-25. **Commit:** `d38722e18efc4128f8ae56610b74863892a6a442`.

**Change:** Implemented study stars for topics and questions

**Changed files:**

- `backend/accountReset.js`
- `backend/globalSearch.js`
- `backend/server.js`
- `backend/study.js`
- `frontend/src/App.jsx`
- `frontend/src/components/AppNavigation.jsx`
- `frontend/src/components/AssistantChat.jsx`
- `frontend/src/components/GlobalSearch.jsx`
- `frontend/src/components/StudyPage.css`
- `frontend/src/components/StudyPage.jsx`
- `frontend/src/lib/study.js`

## Update 249

**Date:** 2026-10-25. **Commit:** `1308bf12d42ec3688fa2117abb6d8ff17a992faf`.

**Change:** Added company research and tailoring for covers

**Changed files:**

- `README.md`
- `backend/companyResearch.js`
- `backend/coverLetterGeneration.js`
- `backend/coverLetterPrompt.js`
- `frontend/src/components/CoverLetterGenerator.jsx`

## Update 248

**Date:** 2026-10-25. **Commit:** `e2b57278091c3d1c4094e40190bf4f3ed9321e0b`.

**Change:** Implemented company website research for tailoring

**Changed files:**

- `README.md`
- `backend/companyResearch.js`
- `backend/coverLetterGeneration.js`
- `backend/jobs.js`
- `backend/resumePrompt.js`
- `frontend/src/components/CoverLetterGenerator.jsx`

## Update 247

**Date:** 2026-10-25. **Commit:** `ba1877893129e07af6693ea1f32338011693daa4`.

**Change:** Created a search bar for all abilities

**Changed files:**

- `README.md`
- `backend/accountReset.js`
- `backend/globalSearch.js`
- `backend/jobs.js`
- `backend/package-lock.json`
- `backend/package.json`
- `backend/searchTextWorker.js`
- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/AppNavigation.css`
- `frontend/src/components/AppNavigation.jsx`
- `frontend/src/components/CalendarPage.jsx`
- `frontend/src/components/DocumentEditor.jsx`
- `frontend/src/components/DocumentLibrary.jsx`
- `frontend/src/components/GlobalSearch.css`
- `frontend/src/components/GlobalSearch.jsx`
- `frontend/src/components/JobsPage.jsx`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFEditorChrome.jsx`
- `frontend/src/components/ShortcutsPage.jsx`
- `frontend/src/lib/editorBridge.js`
- `frontend/src/lib/shortcuts.js`

## Update 246

**Date:** 2026-10-25. **Commit:** `f2c05d5db9f536a92f309abb4cc8694fd20611ae`.

**Change:** Improved the task bar for better UIs

**Changed files:**

- `README.md`
- `frontend/src/App.jsx`
- `frontend/src/components/AppNavigation.css`
- `frontend/src/components/AppNavigation.jsx`

## Update 245

**Date:** 2026-10-25. **Commit:** `b7ce45fa463311def7b650953757302650ebca68`.

**Change:** Created a proper home dashboard

**Changed files:**

- `README.md`
- `frontend/src/App.jsx`
- `frontend/src/components/HomePage.css`
- `frontend/src/components/HomePage.jsx`

## Update 244

**Date:** 2026-10-25. **Commit:** `9809c0608f4fffd81916f175c9fe9be0bf0543b0`.

**Change:** Implemented subfolders for documents and tasks

**Changed files:**

- `README.md`
- `backend/folderHierarchy.js`
- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/DocumentLibrary.jsx`
- `frontend/src/components/FolderHierarchyControls.css`
- `frontend/src/components/FolderHierarchyControls.jsx`
- `frontend/src/components/FolderParentSelect.jsx`
- `frontend/src/lib/folderHierarchy.js`

## Update 243

**Date:** 2026-10-25. **Commit:** `7bdaf8bb02eed22875d4f02ad2b16ae50d456f3c`.

**Change:** Added support for annotated pdfs

**Changed files:**

- `README.md`
- `backend/coverLetterGeneration.js`
- `frontend/src/components/CoverLetterGenerator.jsx`
- `frontend/src/lib/tailoringTemplateRuns.js`

## Update 242

**Date:** 2026-10-25. **Commit:** `75c8e104b043b13cee01d3f5789caf7b22467825`.

**Change:** Added ability to cater resumes to jobs

**Changed files:**

- `README.md`
- `backend/.env.example`
- `backend/accountReset.js`
- `backend/coverLetterGeneration.js`
- `backend/resumePrompt.js`
- `backend/server.js`
- `frontend/src/components/CoverLetterGenerator.jsx`
- `frontend/src/components/ResumesPage.jsx`
- `frontend/src/lib/coverLetterPdfLayout.js`

## Update 241

**Date:** 2026-10-25. **Commit:** `f73d4d1e98311f0af5d716c85013c6c6debb327d`.

**Change:** Added ability to add separate F1 events

**Changed files:**

- `frontend/src/components/CalendarPage.css`
- `frontend/src/components/F1SeasonImport.jsx`

## Update 240

**Date:** 2026-10-25. **Commit:** `a4adc396a59d245865c707fc9a9fc0e80a528908`.

**Change:** Added ability to create calendar categories

**Changed files:**

- `backend/accountReset.js`
- `backend/calendarCategories.js`
- `backend/calendarEntries.js`
- `backend/calendarHistory.js`
- `backend/calendarSeries.js`
- `backend/f1Calendar.js`
- `backend/server.js`
- `frontend/src/components/CalendarCategories.jsx`
- `frontend/src/components/CalendarPage.css`
- `frontend/src/components/CalendarPage.jsx`
- `frontend/src/components/F1SeasonImport.jsx`
- `frontend/src/lib/calendar.js`

## Update 239

**Date:** 2026-10-25. **Commit:** `187cf5d1d61e058d51b419175e1d2aa6ef2636fb`.

**Change:** Added the ability to add sports events

**Changed files:**

- `backend/calendarEntries.js`
- `backend/calendarSeries.js`
- `backend/server.js`
- `frontend/src/components/CalendarPage.css`
- `frontend/src/components/CalendarPage.jsx`
- `frontend/src/lib/calendar.js`

## Update 238

**Date:** 2026-10-24. **Commit:** `6734007e884d5431dead0ec03b49029c431e25a9`.

**Change:** Fixed copy text feature for pdf editor with format

**Changed files:**

- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFSelectableLayer.jsx`
- `frontend/src/lib/pdfCopyText.js`

## Update 237

**Date:** 2026-10-24. **Commit:** `dfb02cc39dc8c5e41ce37c70c1e2102012c441b7`.

**Change:** Fixed wrapping logic for copying lines

**Changed files:**

- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFEditorChrome.jsx`
- `frontend/src/components/PDFSelectableLayer.jsx`
- `frontend/src/lib/pdfCopyText.js`

## Update 236

**Date:** 2026-10-24. **Commit:** `b875f6bfa06977edb8e5677d9c298746061dc387`.

**Change:** Added more ideas for the future of the platform

**Changed files:**

- `ideas.txt`

## Update 235

**Date:** 2026-10-24. **Commit:** `1a50ff1bc6aaabee80e7004cb4fa6f17bc58a22e`.

**Change:** Improved select text feature to work with all text

**Changed files:**

- `frontend/src/components/PDFContinuousView.jsx`
- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFSelectableLayer.jsx`
- `frontend/src/lib/pdfSelectableText.js`

## Update 234

**Date:** 2026-10-24. **Commit:** `bbae8c87d7321701ebb7b7eadb90e2657fa2173c`.

**Change:** Created a select text tool in pdf editor

**Changed files:**

- `frontend/src/components/PDFContinuousView.jsx`
- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFEditorChrome.jsx`
- `frontend/src/lib/pdfSelectableText.js`

## Update 233

**Date:** 2026-10-24. **Commit:** `7f761a565fc279325a65c5e318c9b863fdb4da5b`.

**Change:** Added pdf cleanup feature

**Changed files:**

- `backend/pdfCleanup.js`
- `backend/server.js`
- `frontend/src/components/PDFCleanup.css`
- `frontend/src/components/PDFCleanup.jsx`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFEditorChrome.jsx`
- `frontend/src/lib/pdfCleanup.js`

## Update 232

**Date:** 2026-10-24. **Commit:** `ffb3a897b2625b858f2423297f063f3f3bf05480`.

**Change:** Added clean up a letter feature

**Changed files:**

- `backend/coverLetterGeneration.js`
- `backend/coverLetterPrompt.js`
- `frontend/src/components/CoverLetterGenerator.css`
- `frontend/src/components/CoverLetterGenerator.jsx`

## Update 231

**Date:** 2026-10-24. **Commit:** `cc218aa9af4b94c623155441cf36195c96681fd1`.

**Change:** Fixed formatting issues for generated cover letter

**Changed files:**

- `backend/coverLetterGeneration.js`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/src/components/CoverLetterGenerator.jsx`
- `frontend/src/components/DocumentEditor.jsx`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/lib/coverLetterPdfLayout.js`
- `frontend/src/lib/coverLetterText.js`
- `frontend/src/lib/wordTemplateEditor.js`

## Update 230

**Date:** 2026-10-24. **Commit:** `42e024885b047645a33828a3a7de7620c0c33f41`.

**Change:** Fixed choppy letter boxes with one text box

**Changed files:**

- `backend/coverLetterGeneration.js`
- `frontend/src/components/CoverLetterGenerator.css`
- `frontend/src/components/CoverLetterGenerator.jsx`
- `frontend/src/lib/coverLetterText.js`

## Update 229

**Date:** 2026-10-24. **Commit:** `6c2cab1be89c0efd913cbd03722a58bbb6959030`.

**Change:** Fixed

**Changed files:**

- `backend/coverLetterGeneration.js`
- `frontend/src/components/CoverLetterGenerator.jsx`

## Update 228

**Date:** 2026-10-24. **Commit:** `412462ea16d0b90498b0006c01c902f4e11d611c`.

**Change:** Added an error detais dropdown for cover letters

**Changed files:**

- `backend/coverLetterGeneration.js`
- `frontend/src/components/CoverLetterError.jsx`
- `frontend/src/components/CoverLetterGenerator.css`
- `frontend/src/components/CoverLetterGenerator.jsx`

## Update 227

**Date:** 2026-10-24. **Commit:** `d4c184792057668c0ad252430d8387af475f3e6d`.

**Change:** Improved response overhead and shortened prompt

**Changed files:**

- `README.md`
- `backend/.env.example`
- `backend/coverLetterGeneration.js`
- `backend/coverLetterPrompt.js`
- `frontend/src/components/CoverLetterGenerator.jsx`

## Update 226

**Date:** 2026-10-24. **Commit:** `3561bd30bf4dd52304c2188f5bed96c0db07e517`.

**Change:** Added an AI toggle for pdf parsing for jobs

**Changed files:**

- `README.md`
- `backend/jobFileImport.js`
- `backend/server.js`
- `frontend/src/components/AccountAIAccess.jsx`
- `frontend/src/components/JobFileImport.jsx`
- `frontend/src/components/JobsPage.css`
- `frontend/src/components/JobsPage.jsx`

## Update 225

**Date:** 2026-10-24. **Commit:** `d6812c80319d1def7a04a13eb069f7fe4e3580f8`.

**Change:** Extended attempt to improve parser for pdf input

**Changed files:**

- `README.md`
- `backend/jobHeaderFields.js`
- `frontend/src/components/JobFileImport.jsx`
- `frontend/src/components/JobsPage.jsx`
- `frontend/src/lib/jobParsing/jobHeaderFields.js`
- `frontend/src/lib/jobParsing/jobLayoutParser.js`
- `frontend/src/lib/jobParsing/jobTextParser.js`
- `frontend/src/lib/localJobFile.js`

## Update 224

**Date:** 2026-10-24. **Commit:** `d0b683696e6694f6dd610e454b1966be5b6d4fb0`.

**Change:** Tried to improve parser logic for pdf for jobs

**Changed files:**

- `README.md`
- `backend/jobHeaderFields.js`
- `backend/jobLayoutParser.js`
- `backend/jobTextParser.js`
- `frontend/src/components/JobsPage.css`
- `frontend/src/components/JobsPage.jsx`

## Update 223

**Date:** 2026-10-24. **Commit:** `aea9a3302ee5333a7b7622b28809c39481bceffa`.

**Change:** Updated parser logic for job imports

**Changed files:**

- `README.md`
- `backend/handshakeJobs.js`
- `backend/jobLayoutParser.js`
- `backend/jobTextParser.js`
- `backend/jobs.js`
- `frontend/src/components/JobsPage.jsx`
- `frontend/src/lib/jobDocumentLayout.js`
- `frontend/src/lib/localJobFile.js`

## Update 222

**Date:** 2026-10-24. **Commit:** `28e3bd3f9f87df4c4a254facb5b0bfdf2bd29617`.

**Change:** Improved PDF parser for job imports

**Changed files:**

- `README.md`
- `backend/handshakeJobs.js`
- `backend/jobExtraction.js`
- `backend/jobTextParser.js`
- `frontend/src/components/JobsPage.css`
- `frontend/src/components/JobsPage.jsx`
- `frontend/src/lib/localJobFile.js`

## Update 221

**Date:** 2026-10-24. **Commit:** `cebf2f3a71b8bd25955a6466680c865bcec378d0`.

**Change:** Attempt to implement local scanning for pdfs

**Changed files:**

- `README.md`
- `backend/jobExtraction.js`
- `backend/jobFileImport.js`
- `backend/jobs.js`
- `backend/server.js`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/src/components/AccountAIAccess.jsx`
- `frontend/src/components/JobFileImport.jsx`
- `frontend/src/components/JobsPage.css`
- `frontend/src/components/JobsPage.jsx`
- `frontend/src/lib/localJobFile.js`

## Update 220

**Date:** 2026-10-24. **Commit:** `bc7f79a8451f5a9ebd55da0d7f6a7b0ef9be0786`.

**Change:** Added ability to export a job from a pdf or image

**Changed files:**

- `README.md`
- `backend/jobFileImport.js`
- `backend/server.js`
- `frontend/src/components/AccountAIAccess.jsx`
- `frontend/src/components/JobFileImport.jsx`
- `frontend/src/components/JobsPage.css`
- `frontend/src/components/JobsPage.jsx`

## Update 219

**Date:** 2026-10-24. **Commit:** `947bee1dab66eb476dcfb002b79b466ab470e222`.

**Change:** Added Handshake specific jon import handling

**Changed files:**

- `README.md`
- `backend/handshakeJobs.js`
- `backend/jobExtraction.js`
- `backend/jobs.js`
- `frontend/src/components/JobsPage.css`
- `frontend/src/components/JobsPage.jsx`

## Update 218

**Date:** 2026-10-24. **Commit:** `0b0acf9627979dc84aa96b8080a701942f1515fd`.

**Change:** Developed cover letter generator

**Changed files:**

- `README.md`
- `backend/coverLetterGeneration.js`
- `frontend/src/components/CoverLetterGenerator.jsx`
- `ideas.txt`

## Update 217

**Date:** 2026-10-24. **Commit:** `e57fce92a5c7ec19c796353216bf650a9ed76bbd`.

**Change:** Created a tailored cover letter generator

**Changed files:**

- `README.md`
- `backend/coverLetterGeneration.js`
- `backend/package-lock.json`
- `backend/package.json`
- `backend/server.js`
- `frontend/src/components/CoverLetterGenerator.css`
- `frontend/src/components/CoverLetterGenerator.jsx`
- `frontend/src/components/CoverLettersPage.jsx`
- `frontend/src/components/PDFEditor.jsx`

## Update 216

**Date:** 2026-10-24. **Commit:** `71b912053151f7ab75603d95a8b75ef117aeffde`.

**Change:** Fixed minor bug with multiple uploads

**Changed files:**

- `frontend/src/components/CoverLettersPage.jsx`
- `frontend/src/components/ResumesPage.css`

## Update 215

**Date:** 2026-10-24. **Commit:** `657b66137f540708d25aefda786cc106bc49348b`.

**Change:** Added multiple cover letter uploads

**Changed files:**

- `frontend/src/components/CoverLettersPage.jsx`
- `frontend/src/components/ResumesPage.css`

## Update 214

**Date:** 2026-10-24. **Commit:** `eea415ab83d5415f3cd8cd7e6427133c144e1496`.

**Change:** Added ability to make cover letters

**Changed files:**

- `README.md`
- `backend/aiAccess.js`
- `frontend/src/App.jsx`
- `frontend/src/components/AccountAIAccess.jsx`
- `frontend/src/components/CoverLettersPage.jsx`
- `frontend/src/components/JobsPage.jsx`
- `frontend/src/components/ResumesPage.jsx`

## Update 213

**Date:** 2026-10-24. **Commit:** `bd918b4685fdee991874998cc7cded3719d649e2`.

**Change:** Updated importer with better analysis function

**Changed files:**

- `README.md`
- `backend/jobExtraction.js`
- `backend/jobs.js`
- `backend/package-lock.json`
- `backend/package.json`
- `frontend/src/components/JobsPage.css`
- `frontend/src/components/JobsPage.jsx`

## Update 212

**Date:** 2026-10-24. **Commit:** `c96275362e72f736d1f2a6bbc5f43fa7ab4a9d77`.

**Change:** Added the ability to get jobs by link

**Changed files:**

- `README.md`
- `backend/accountReset.js`
- `backend/jobs.js`
- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/JobsPage.css`
- `frontend/src/components/JobsPage.jsx`
- `frontend/src/components/ResumesPage.css`
- `frontend/src/components/ResumesPage.jsx`

## Update 211

**Date:** 2026-10-24. **Commit:** `29d67b635076e81d09e73d8ea2ce5aa517abb95f`.

**Change:** Added automatic detection for pdfs

**Changed files:**

- `README.md`
- `frontend/src/lib/pdfExistingText.js`
- `frontend/src/lib/pdfPeerFont.js`

## Update 210

**Date:** 2026-10-24. **Commit:** `511da49c5b534f4c6d14c45c7f13e3a480f6fea3`.

**Change:** Added more fonts for analysis to pdf editor

**Changed files:**

- `README.md`
- `frontend/src/lib/pdfExistingText.js`
- `frontend/src/lib/pdfFontCatalog.js`
- `frontend/src/lib/pdfTextStyle.js`

## Update 209

**Date:** 2026-10-23. **Commit:** `ec11349276bda9fad86d101c200e5e12b132e357`.

**Change:** Fixed tasks to make wrap toggle instead of auto

**Changed files:**

- `frontend/src/App.jsx`
- `frontend/src/Navigation.css`

## Update 208

**Date:** 2026-10-23. **Commit:** `1d0704d3079a79555f2af607f283a1d3982ccf4a`.

**Change:** Updated tasks page to wrap around with title

**Changed files:**

- `frontend/src/App.jsx`
- `frontend/src/Navigation.css`

## Update 207

**Date:** 2026-10-23. **Commit:** `74a8d2c71c0bd2805ec44c776672cb78d78bc90d`.

**Change:** Implemented function calculating

**Changed files:**

- `frontend/src/components/PDFCalculator.css`
- `frontend/src/components/PDFCalculator.jsx`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFEditorChrome.jsx`

## Update 206

**Date:** 2026-10-23. **Commit:** `fd170370a5932a44c895581248cf44b290689784`.

**Change:** Added vertical align for toolbar

**Changed files:**

- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFEditorChrome.css`
- `frontend/src/components/PDFEditorChrome.jsx`

## Update 205

**Date:** 2026-10-23. **Commit:** `5a57d2a1d0032e587d2a7e46998c58b498f0500f`.

**Change:** Added ability to change location of toolbar

**Changed files:**

- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFEditorChrome.css`
- `frontend/src/components/PDFEditorChrome.jsx`

## Update 204

**Date:** 2026-10-23. **Commit:** `3bd081b1ec9ba5c0d4e51ede76fa64c0d411e40f`.

**Change:** Fixed syntax error with timer

**Changed files:**

- `frontend/src/components/PDFCountdown.jsx`

## Update 203

**Date:** 2026-10-23. **Commit:** `dd1622c43c9f68cb56501a166008f4da6e8c7425`.

**Change:** Added a countdown timer

**Changed files:**

- `frontend/src/components/PDFCountdown.jsx`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFEditorChrome.css`
- `frontend/src/components/PDFEditorChrome.jsx`

## Update 202

**Date:** 2026-10-23. **Commit:** `41ffc4831799efa5f59ca1dd6e0794ab8a76129a`.

**Change:** Added a timer and clock feature

**Changed files:**

- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFEditorChrome.css`
- `frontend/src/components/PDFEditorChrome.jsx`
- `frontend/src/components/PDFEditorClock.jsx`
- `frontend/src/components/PDFStopwatch.jsx`

## Update 201

**Date:** 2026-10-22. **Commit:** `d4b8daa4ec4685f024ccea3028f4b1e4e39b826d`.

**Change:** Improved local recognition when possible

**Changed files:**

- `backend/mathRecognition.js`
- `frontend/src/lib/mathSelectionImage.js`

## Update 200

**Date:** 2026-10-22. **Commit:** `e2da93bf55b7c031aa7b7831914e02d7d4e26215`.

**Change:** Added support for computer dragging

**Changed files:**

- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFGraph.jsx`

## Update 199

**Date:** 2026-10-22. **Commit:** `0250778bb20c773dc31d630c905dd660b87dee3b`.

**Change:** Added the ability to auto graph an equation

**Changed files:**

- `README.md`
- `backend/mathRecognition.js`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFEditorChrome.jsx`
- `frontend/src/components/PDFGraph.css`
- `frontend/src/components/PDFGraph.jsx`
- `frontend/src/lib/pdfGraph.js`

## Update 198

**Date:** 2026-10-21. **Commit:** `c467c23a7320318179ec6577097646cc3e83a4e4`.

**Change:** Added a connection to LinkedIn and GitHub

**Changed files:**

- `README.md`
- `backend/.env.example`
- `backend/accountConnections.js`
- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/AccountConnections.css`
- `frontend/src/components/AccountConnections.jsx`

## Update 197

**Date:** 2026-10-21. **Commit:** `0c44677baaab33f1260fbac291a227de9f3beffb`.

**Change:** Added smoother finger scrolling for pages

**Changed files:**

- `README.md`
- `frontend/src/hooks/usePDFTouchInput.js`

## Update 196

**Date:** 2026-10-21. **Commit:** `1b3d89d7e907e8ae343d6a4379f659a4df01cedf`.

**Change:** Added smooth finger scrolling for pdf editor

**Changed files:**

- `README.md`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFFingerMode.jsx`
- `frontend/src/hooks/usePDFTouchInput.js`

## Update 195

**Date:** 2026-10-21. **Commit:** `b7ff9f2e9eeded9cbc100e560bdd66926b708654`.

**Change:** Fixing latency issues with efficiency improvements

**Changed files:**

- `README.md`
- `frontend/src/components/PDFContinuousView.jsx`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFInkLayer.jsx`
- `frontend/src/components/PDFReferencePane.jsx`
- `frontend/src/lib/annotationSerializer.js`
- `frontend/src/lib/pdfEraser.js`
- `frontend/src/workers/annotationSerializer.js`

## Update 194

**Date:** 2026-10-21. **Commit:** `dda572f33b2decc11e2c145a41901091b9f117e4`.

**Change:** Added an automatic straight line detector

**Changed files:**

- `README.md`
- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFEditorChrome.jsx`
- `frontend/src/lib/pdfStraightLine.js`

## Update 193

**Date:** 2026-10-21. **Commit:** `9806ef0ebd697d09f36afa89baac161e12c8fe17`.

**Change:** Fixed bug with disappearing annotations

**Changed files:**

- `README.md`
- `frontend/src/components/PDFContinuousView.jsx`
- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`

## Update 192

**Date:** 2026-10-21. **Commit:** `e74712eba421aa3984dca363bb90ce5b7cef42b5`.

**Change:** Attempt to fix bugs with auto focus

**Changed files:**

- `README.md`
- `frontend/src/components/PDFContinuousView.jsx`
- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`

## Update 191

**Date:** 2026-10-21. **Commit:** `8ca5f00a39860ab5229777ad7ce6046404d629dc`.

**Change:** Implemented auto adjust for pages instead of click

**Changed files:**

- `README.md`
- `frontend/src/components/PDFContinuousView.jsx`
- `frontend/src/components/PDFEditor.jsx`

## Update 190

**Date:** 2026-10-21. **Commit:** `b9d09a061fe924534aab899eb7bbec3cda87bb43`.

**Change:** Added AI enabling section to accounts page

**Changed files:**

- `README.md`
- `backend/aiAccess.js`
- `backend/assistant.js`
- `backend/assistantEditor.js`
- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/AccountAIAccess.css`
- `frontend/src/components/AccountAIAccess.jsx`
- `frontend/src/components/AssistantChat.jsx`

## Update 189

**Date:** 2026-10-21. **Commit:** `791195c67b2299485051a49d8bd26e2c7f63fe01`.

**Change:** Added AI Assistant editing for documents

**Changed files:**

- `README.md`
- `backend/assistant.js`
- `backend/assistantEditor.js`
- `backend/server.js`
- `frontend/src/components/AssistantChat.css`
- `frontend/src/components/AssistantChat.jsx`
- `frontend/src/components/DocumentEditor.jsx`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/lib/editorBridge.js`
- `frontend/src/lib/pdfExistingText.js`

## Update 188

**Date:** 2026-10-21. **Commit:** `e82f0ec75fa75b9ef62630f972d9df973cfa14b1`.

**Change:** Updated PDF editor to support original font

**Changed files:**

- `README.md`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/src/components/PDFContinuousView.jsx`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/lib/pdfExistingText.js`
- `frontend/src/lib/pdfTextStyle.js`

## Update 187

**Date:** 2026-10-21. **Commit:** `c6d72d08abb3f1458c19b978a909cd092cb05589`.

**Change:** Added ability to change existing text in pdf files

**Changed files:**

- `README.md`
- `frontend/src/components/PDFContinuousView.jsx`
- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/lib/pdfExistingText.js`

## Update 186

**Date:** 2026-10-21. **Commit:** `5e2b57901973f4095bb1b767cce4a6fd27fba297`.

**Change:** Added ability to store resumes for the user

**Changed files:**

- `frontend/src/App.jsx`
- `frontend/src/components/ResumesPage.css`
- `frontend/src/components/ResumesPage.jsx`

## Update 185

**Date:** 2026-10-21. **Commit:** `fc1c4cb52532cf0eb7ab8ef09563fd9e60e2873c`.

**Change:** Added resumes section to navigation

**Changed files:**

- `frontend/src/App.jsx`

## Update 184

**Date:** 2026-10-21. **Commit:** `37fa9449b3053819b767713816952e05e1569c1f`.

**Change:** Added undo deletion for tasks

**Changed files:**

- `README.md`
- `backend/accountReset.js`
- `backend/server.js`
- `backend/taskDeletionRecovery.js`
- `frontend/src/App.jsx`
- `frontend/src/Navigation.css`
- `frontend/src/components/TaskDeletionUndo.jsx`
- `ideas.txt`

## Update 183

**Date:** 2026-10-21. **Commit:** `81cb062704246060d3efaa69268e958f45e65fa7`.

**Change:** Fixed OneNote import with proper annotations

**Changed files:**

- `README.md`
- `backend/scripts/export_onenote.ps1`
- `frontend/src/components/OneNoteImport.jsx`
- `ideas.txt`

## Update 182

**Date:** 2026-10-21. **Commit:** `1b9b519702e349e4abe10599f93530495d8f1fde`.

**Change:** Added shrink toolbar to the pdf editor

**Changed files:**

- `frontend/src/components/PDFEditorChrome.css`
- `frontend/src/components/PDFEditorChrome.jsx`

## Update 181

**Date:** 2026-10-21. **Commit:** `b8fc6cea9215ee79451f69324a5c4e46bd3f1fcf`.

**Change:** Updated ideas with new features for the future

**Changed files:**

- `ideas.txt`

## Update 180

**Date:** 2026-10-21. **Commit:** `18da5df32366d6af5c2e7171167fceb6043a3150`.

**Change:** Updated backend to try to fix import OneNote issue

**Changed files:**

- `README.md`
- `backend/oneNoteImport.js`
- `backend/scripts/export_onenote.ps1`
- `backend/scripts/import_onenote.py`
- `frontend/src/components/OneNoteImport.jsx`

## Update 179

**Date:** 2026-10-20. **Commit:** `1176c01e4f2fd63d8c237f5547f78d87031f3822`.

**Change:** Fixed OneNote automation calls

**Changed files:**

- `README.md`
- `backend/oneNoteImport.js`
- `backend/scripts/export_onenote.ps1`
- `backend/scripts/import_onenote.py`

## Update 178

**Date:** 2026-10-20. **Commit:** `70a6b6da7d54d5d12958477d374bcc276e26d986`.

**Change:** Fixed support for OneNote imports

**Changed files:**

- `README.md`
- `backend/oneNoteImport.js`
- `backend/scripts/export_onenote.ps1`
- `backend/scripts/import_onenote.py`
- `frontend/src/components/OneNoteImport.css`
- `frontend/src/components/OneNoteImport.jsx`

## Update 177

**Date:** 2026-10-20. **Commit:** `d22cd3eaef6f22bdfc079818821eea18cb36a6e7`.

**Change:** Added support for one files

**Changed files:**

- `README.md`
- `backend/oneNoteImport.js`
- `backend/scripts/import_onenote.py`
- `frontend/src/components/OneNoteImport.jsx`
- `frontend/src/components/PDFUploadModal.jsx`

## Update 176

**Date:** 2026-10-20. **Commit:** `9d4b0883e59064d8ee868f5e12c6a8d01e748fcd`.

**Change:** Created import ability through OneNote

**Changed files:**

- `.gitignore`
- `README.md`
- `backend/oneNoteImport.js`
- `backend/requirements-onenote.txt`
- `backend/scripts/import_onenote.py`
- `backend/server.js`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/src/components/DocumentLibrary.jsx`
- `frontend/src/components/OneNoteImport.css`
- `frontend/src/components/OneNoteImport.jsx`

## Update 175

**Date:** 2026-10-20. **Commit:** `98e2517b43f18b6beeac36069a22d9feb426e234`.

**Change:** Added ability to add recurring events to calendar

**Changed files:**

- `backend/calendarHistory.js`
- `backend/calendarSeries.js`
- `backend/server.js`
- `frontend/src/components/CalendarPage.css`
- `frontend/src/components/CalendarPage.jsx`
- `frontend/src/components/CalendarRecurrence.jsx`
- `frontend/src/lib/calendarRecurrence.js`

## Update 174

**Date:** 2026-10-20. **Commit:** `6ba638b74cf83b1d03bcec69cb1b9a037c120230`.

**Change:** Added color picker for calendar appointments

**Changed files:**

- `backend/accountReset.js`
- `backend/calendarColors.js`
- `backend/calendarHistory.js`
- `backend/server.js`
- `frontend/src/components/CalendarColorPicker.jsx`
- `frontend/src/components/CalendarPage.css`
- `frontend/src/components/CalendarPage.jsx`
- `frontend/src/components/WorkflowTools.jsx`
- `frontend/src/hooks/useCalendarColors.js`
- `frontend/src/lib/calendar.js`
- `ideas.txt`

## Update 173

**Date:** 2026-10-19. **Commit:** `23bc64e40117a280816a56ce5ef39f775e82c1d0`.

**Change:** Adding ideas for the future

**Changed files:**

- `ideas.txt`

## Update 172

**Date:** 2026-10-19. **Commit:** `04fe764ee67ae29b793875cf65a8c5a74969a227`.

**Change:** Improved UI for the pdf editor

**Changed files:**

- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFEditorChrome.css`
- `frontend/src/components/PDFEditorChrome.jsx`
- `frontend/src/components/PDFInsertPanel.jsx`

## Update 171

**Date:** 2026-10-19. **Commit:** `f7723c94811cc902b389983301016a72b8904a50`.

**Change:** Removed redundant ask AI Assistant button

**Changed files:**

- `frontend/src/App.jsx`

## Update 170

**Date:** 2026-10-19. **Commit:** `c0acd462bd63cac4fa994ccdefb5a7311afd83e4`.

**Change:** Added logic from Excalidraw for draw detection

**Changed files:**

- `frontend/public/licenses/excalidraw.txt`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/hooks/usePDFTouchInput.js`
- `frontend/src/lib/vendor/excalidraw/LICENSE`
- `frontend/src/lib/vendor/excalidraw/SOURCE.md`
- `frontend/src/lib/vendor/excalidraw/pointerInput.js`

## Update 169

**Date:** 2026-10-19. **Commit:** `6834ccb3dfc24d88d4416cdb40b3a05a933e2c33`.

**Change:** Improving logic to check for strokes in pdf editor

**Changed files:**

- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFFingerMode.jsx`
- `frontend/src/hooks/usePDFTouchInput.js`

## Update 168

**Date:** 2026-10-19. **Commit:** `d7cd01f217f6b693c2df2a9d74338156582ca737`.

**Change:** Developed a prominent side view button

**Changed files:**

- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`

## Update 167

**Date:** 2026-10-19. **Commit:** `d22d170d65e066422cab32b76fa82ba1d26b044e`.

**Change:** Implemented a side view feature for pages

**Changed files:**

- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFReferencePane.css`
- `frontend/src/components/PDFReferencePane.jsx`

## Update 166

**Date:** 2026-10-19. **Commit:** `c76e635d7fca4b395b31c384977f4a390f0adcad`.

**Change:** Improved recognition for finger inputs for pdfs

**Changed files:**

- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFFingerMode.jsx`
- `frontend/src/hooks/usePDFTouchInput.js`

## Update 165

**Date:** 2026-10-19. **Commit:** `57bd895aca9ae71c27cbaf3048c8cc3138025ad6`.

**Change:** Improved support and customizability for styluses

**Changed files:**

- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFStylusSettings.css`
- `frontend/src/components/PDFStylusSettings.jsx`

## Update 164

**Date:** 2026-10-19. **Commit:** `78d6d03d6e1be784f540baaa73f9f4f9eaced7da`.

**Change:** Implemented native support for stylus buttons

**Changed files:**

- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`

## Update 163

**Date:** 2026-10-19. **Commit:** `dfacf14bbdc028160af6e6e9f221548523783f6a`.

**Change:** Added small arrows for improved page navigation

**Changed files:**

- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`

## Update 162

**Date:** 2026-10-19. **Commit:** `fbb2f037794362cf7c7a33221a27ce936b349770`.

**Change:** Added an AI assistant button for full screen mode

**Changed files:**

- `frontend/src/App.jsx`
- `frontend/src/components/AssistantChat.jsx`
- `frontend/src/components/DocumentEditor.jsx`
- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`

## Update 161

**Date:** 2026-10-19. **Commit:** `d729c2a724b9e365272048aab5fc71bc807e4a23`.

**Change:** Added ability to create a clean copy version

**Changed files:**

- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/DocumentEditor.jsx`
- `frontend/src/components/PDFEditor.jsx`

## Update 160

**Date:** 2026-10-19. **Commit:** `0cc6bcf165b34d06ff2ebb0ea6cdb2ef6bd610c9`.

**Change:** Improved finger tracking and input handling

**Changed files:**

- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/hooks/usePDFTouchInput.js`

## Update 159

**Date:** 2026-10-18. **Commit:** `dff8fad6de711a0123e3898adef5b820850a6ddc`.

**Change:** Added proper processing for large files

**Changed files:**

- `frontend/src/components/MarkdownPDFCreator.jsx`
- `frontend/src/lib/markdownPdfExport.js`

## Update 158

**Date:** 2026-10-18. **Commit:** `53533042d38ac240a3b9ab89537ce0938de555b9`.

**Change:** Updated markdown to properly interpret spaces

**Changed files:**

- `frontend/src/components/AssistantMarkdown.jsx`
- `frontend/src/components/MarkdownPDFCreator.css`
- `frontend/src/components/MarkdownPDFCreator.jsx`

## Update 157

**Date:** 2026-10-18. **Commit:** `175299e8bf2379b27cede8ed2ff62f8832a42d8e`.

**Change:** Improved markdown rendering to fix bugs

**Changed files:**

- `frontend/src/components/MarkdownPDFCreator.css`
- `frontend/src/components/MarkdownPDFCreator.jsx`
- `frontend/src/lib/markdownPdfExport.js`

## Update 156

**Date:** 2026-10-18. **Commit:** `95d3b3d4dc958b9e53de3df6e8d8d5c4d1197694`.

**Change:** Adding ideas for future implementation

**Changed files:**

- `ideas.txt`

## Update 155

**Date:** 2026-10-18. **Commit:** `ce4ded16f628cb77fb4cd871222494c30dcc5560`.

**Change:** Implemented feature to create a blank notebook

**Changed files:**

- `frontend/src/components/DocumentLibrary.jsx`
- `frontend/src/components/PDFEditor.jsx`

## Update 154

**Date:** 2026-10-18. **Commit:** `33af69801b22b651a0b10a57c218295a92eebd4a`.

**Change:** Adding ideas for future improvements

**Changed files:**

- `ideas.txt`

## Update 153

**Date:** 2026-10-18. **Commit:** `9aec6d6b099876855c04e02644d82541001bb6cc`.

**Change:** Added finger scrolling for the PDF editor

**Changed files:**

- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`
- `ideas.txt`

## Update 152

**Date:** 2026-10-18. **Commit:** `9649a35a6d82ea65de787acd41d7080c22ace2b0`.

**Change:** Implemented a full screen mode for taking notes

**Changed files:**

- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`

## Update 151

**Date:** 2026-10-18. **Commit:** `9dd95957b7bbb66ded50d722a896fa40c9c0bc93`.

**Change:** Added delete page to toolbar

**Changed files:**

- `frontend/src/components/PDFEditor.jsx`

## Update 150

**Date:** 2026-10-18. **Commit:** `65273ee8fe29b93e5bb5ddd34dbcd6f77caaebc1`.

**Change:** Added drag and drop rearrange to pdf editor

**Changed files:**

- `backend/pdfPages.js`
- `frontend/src/components/PDFEditor.jsx`

## Update 149

**Date:** 2026-10-18. **Commit:** `b6d7acaf623d6be3fd43c88621a7d442200bc4d2`.

**Change:** Added PDF snippets to editor

**Changed files:**

- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/lib/mathSelectionImage.js`

## Update 148

**Date:** 2026-10-18. **Commit:** `6ed8f57fe3b04effbb4660835cec422e5facd056`.

**Change:** Fixed PDF Vite error

**Changed files:**

- `frontend/src/components/PDFContinuousView.jsx`

## Update 147

**Date:** 2026-10-18. **Commit:** `5719fb316cf816295e8315f6069b45f370deb390`.

**Change:** First iteration of continuous view for pdf

**Changed files:**

- `README.md`
- `frontend/src/components/PDFContinuousView.jsx`
- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`

## Update 146

**Date:** 2026-10-18. **Commit:** `4fd93b2e721ac0dfca83e4c4443e29c18c6a4075`.

**Change:** Implemented add blank page feature

**Changed files:**

- `README.md`
- `frontend/src/components/PDFEditor.jsx`

## Update 145

**Date:** 2026-10-18. **Commit:** `2424905d5c7d432425833fe7084cdb8c0e162daf`.

**Change:** Added new types of eraser customizability

**Changed files:**

- `README.md`
- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFEraserControls.jsx`
- `frontend/src/lib/pdfEraser.js`

## Update 144

**Date:** 2026-10-18. **Commit:** `2ed6f4ead61b9376b422be84a5af546bb34de3f2`.

**Change:** Added dark mode to pdf editor

**Changed files:**

- `README.md`
- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`

## Update 143

**Date:** 2026-10-18. **Commit:** `5c6a112d145ad2b9a128be489312a08844e9b1a5`.

**Change:** Added a markdown to pdf converter to documents

**Changed files:**

- `README.md`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/src/components/DocumentLibrary.jsx`
- `frontend/src/components/MarkdownPDFCreator.css`
- `frontend/src/components/MarkdownPDFCreator.jsx`

## Update 142

**Date:** 2026-10-18. **Commit:** `1a023f55e1e678ba789b5c1bde822f7e9e8819c5`.

**Change:** Created a AI document generation feature

**Changed files:**

- `README.md`
- `backend/generatedDocuments.js`
- `backend/server.js`
- `frontend/src/components/AIDocumentCreator.css`
- `frontend/src/components/AIDocumentCreator.jsx`
- `frontend/src/components/DocumentEditor.jsx`
- `frontend/src/components/DocumentLibrary.jsx`
- `ideas.txt`

## Update 141

**Date:** 2026-10-18. **Commit:** `16990f017c6acd20b5011d5357326cef94e7dcd5`.

**Change:** Improved math assistant for helper functions

**Changed files:**

- `README.md`
- `backend/assistant.js`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/src/components/AssistantMarkdown.jsx`
- `frontend/src/components/AssistantMath.css`
- `frontend/src/lib/assistantMath.js`
- `ideas.txt`

## Update 140

**Date:** 2026-10-18. **Commit:** `acd3168a703118f17ea9600acc3991d413e8c092`.

**Change:** Added support for handwritten calculator

**Changed files:**

- `README.md`
- `backend/mathRecognition.js`
- `backend/server.js`
- `frontend/src/components/PDFCalculator.css`
- `frontend/src/components/PDFCalculator.jsx`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/lib/mathSelectionImage.js`

## Update 139

**Date:** 2026-10-18. **Commit:** `1c898d1d9eae1bd2931cb795a092e3c7254292ee`.

**Change:** Added a selection calculator for the pdf editor

**Changed files:**

- `README.md`
- `frontend/src/components/PDFCalculator.jsx`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/lib/pdfCalculation.js`

## Update 138

**Date:** 2026-10-18. **Commit:** `b166d1574be511cc882397033aa9093927df86b4`.

**Change:** Implemented a calculator into pdf editor for notes

**Changed files:**

- `frontend/src/components/PDFCalculator.css`
- `frontend/src/components/PDFCalculator.jsx`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/lib/calculator.js`

## Update 137

**Date:** 2026-10-18. **Commit:** `f2849b6c71ba897bf7d63e2a2a1913507a0e01e9`.

**Change:** Adding ideas for future improvements

**Changed files:**

- `ideas.txt`

## Update 136

**Date:** 2026-10-18. **Commit:** `afa9ef87336d93f50080f35e34047eaaae14181d`.

**Change:** Fixed pointer drag for task management

**Changed files:**

- `frontend/src/hooks/useTaskPointerDrag.js`

## Update 135

**Date:** 2026-10-18. **Commit:** `495b6c4fee83b89a5cb40ccfbf2ddadb1a04b294`.

**Change:** Improved drag and drop mechanics

**Changed files:**

- `README.md`
- `frontend/src/App.jsx`
- `frontend/src/Navigation.css`
- `frontend/src/hooks/useTaskPointerDrag.js`

## Update 134

**Date:** 2026-10-18. **Commit:** `0acf177c221fb884322510c107b319128a64b037`.

**Change:** Updated ideas with more notes

**Changed files:**

- `ideas.txt`

## Update 133

**Date:** 2026-10-18. **Commit:** `d061821ac8d8bcec2a480998d3db12ecc729ce04`.

**Change:** Added scroll navigation with task held

**Changed files:**

- `frontend/src/App.jsx`
- `frontend/src/Navigation.css`
- `frontend/src/hooks/useTaskDragScroll.js`
- `frontend/src/hooks/useTaskPointerDrag.js`

## Update 132

**Date:** 2026-10-18. **Commit:** `dc3b46d13ae6e658b57610e1b763442f9a486e1d`.

**Change:** Improved UI with ability to scroll with task

**Changed files:**

- `frontend/src/App.jsx`
- `frontend/src/hooks/useTaskDragScroll.js`

## Update 131

**Date:** 2026-10-18. **Commit:** `d29117e53d32cba62d029858d1ae2b9622b98099`.

**Change:** Updated ideas with ideas for future projects

**Changed files:**

- `ideas.txt`

## Update 130

**Date:** 2026-10-18. **Commit:** `b3ffcdc20ce13562e317d751487aa7e108cd5cd6`.

**Change:** Added ability to change the order of tasks

**Changed files:**

- `README.md`
- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/Navigation.css`

## Update 129

**Date:** 2026-10-18. **Commit:** `2f6c1c497053f7df3cca3dca965fb01a91676a9c`.

**Change:** Updating ideas with more ideas for both platforms

**Changed files:**

- `ideas.txt`

## Update 128

**Date:** 2026-10-18. **Commit:** `15bdf7c95916bae6e6a94e5d336d55acfdc7af8a`.

**Change:** Improved user personalization

**Changed files:**

- `README.md`
- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/Navigation.css`
- `frontend/src/components/ConfirmationSettings.jsx`
- `frontend/src/hooks/useInlineConfirm.js`
- `ideas.txt`

## Update 127

**Date:** 2026-10-17. **Commit:** `98d000104dd5350627356d0edcf2c64c0f200d8b`.

**Change:** Improved styling of select feature to match style

**Changed files:**

- `frontend/src/App.jsx`
- `frontend/src/Navigation.css`

## Update 126

**Date:** 2026-10-17. **Commit:** `0cbd3ecacf5918b26370af55f0cb6acaab49466a`.

**Change:** Fixed JSON error for tasks

**Changed files:**

- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/lib/apiResponse.js`

## Update 125

**Date:** 2026-10-17. **Commit:** `1e0e0519ee1d9d268283d4ed494fe93adc9f4c74`.

**Change:** First iteration of select delete feature for tasks

**Changed files:**

- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/Navigation.css`

## Update 124

**Date:** 2026-10-17. **Commit:** `0e7b66229116dbaa1e7a51330dd38a172c78567f`.

**Change:** Fixed toggle for light mode in daily events

**Changed files:**

- `daily-events/app.js`
- `daily-events/index.html`
- `daily-events/theme.js`

## Update 123

**Date:** 2026-10-17. **Commit:** `5718d45b16245949b7eab822a5c976207e0aa241`.

**Change:** Added a proper dark mode for the daily updates

**Changed files:**

- `daily-events/README.md`
- `daily-events/app.js`
- `daily-events/index.html`
- `daily-events/theme.css`

## Update 122

**Date:** 2026-10-17. **Commit:** `f5db0a47995e405cdd3de5b5f9232033834353ba`.

**Change:** Updated ideas.txt with ideas for the new site

**Changed files:**

- `ideas.txt`

## Update 121

**Date:** 2026-10-17. **Commit:** `5672cd9971f50ed2bd175c5eb1e56d3a6685995d`.

**Change:** Added proper events for calendar site

**Changed files:**

- `daily-events/README.md`
- `daily-events/app.js`
- `daily-events/events.json`
- `daily-events/index.html`
- `daily-events/styles.css`

## Update 120

**Date:** 2026-10-17. **Commit:** `80156d2057ab99a7490b186f50a0050fd4ee6645`.

**Change:** Created the foundations for a BobcatToday platform

**Changed files:**

- `daily-events/README.md`
- `daily-events/app.js`
- `daily-events/events.json`
- `daily-events/index.html`
- `daily-events/styles.css`
- `daily-events/vendor/LICENSE-qrcode.txt`
- `daily-events/vendor/qrcode.js`

## Update 119

**Date:** 2026-10-17. **Commit:** `0d8a31354c0a096d2322be9ea80b48b4c3f05115`.

**Change:** Created an initial directory for daily events site

**Changed files:**

- `daily-events/README.md`
- `daily-events/ideas.txt`

## Update 118

**Date:** 2026-10-16. **Commit:** `6555e32a492045d366f3d8c568333712261a396b`.

**Change:** Fixed delete task bug

**Changed files:**

- `frontend/src/App.jsx`
- `ideas.txt`

## Update 117

**Date:** 2026-10-16. **Commit:** `41bc98ca2e5a848ed71ae90ac18a74828bad1f35`.

**Change:** Added more ideas for the future of the platform

**Changed files:**

- `ideas.txt`

## Update 116

**Date:** 2026-10-15. **Commit:** `e65482e33ea73a3c42803b3101354cf764ca3759`.

**Change:** Added more notes for ideas

**Changed files:**

- `backend/TXST_EVENTS.md`
- `backend/txstCalendar.js`
- `frontend/src/components/CalendarPage.jsx`
- `frontend/src/components/WorkflowTools.jsx`
- `frontend/src/hooks/useTxstEvents.js`
- `ideas.txt`

## Update 115

**Date:** 2026-10-15. **Commit:** `c84316c31de5ef365cd9b75777de7bfa2feeea8a`.

**Change:** Implemented ability to undo for calendar features

**Changed files:**

- `backend/TXST_EVENTS.md`
- `backend/accountReset.js`
- `backend/calendarHistory.js`
- `backend/server.js`
- `backend/txstCalendar.js`
- `frontend/src/components/CalendarPage.jsx`
- `frontend/src/components/CalendarUndo.jsx`
- `frontend/src/components/WorkflowTools.jsx`
- `frontend/src/components/WorkflowWorkspace.jsx`
- `frontend/src/index.css`
- `frontend/src/lib/shortcuts.js`

## Update 114

**Date:** 2026-10-15. **Commit:** `cebb525dd15591e871a5810fd3103d008b550e5b`.

**Change:** Added ability to restore events from the db

**Changed files:**

- `backend/TXST_EVENTS.md`
- `backend/txstCalendar.js`
- `frontend/src/components/CalendarPage.jsx`
- `frontend/src/components/SimilarEvents.css`
- `frontend/src/components/SimilarEvents.jsx`
- `frontend/src/components/WorkflowTools.jsx`
- `frontend/src/hooks/useTxstEvents.js`

## Update 113

**Date:** 2026-10-15. **Commit:** `111042195ec758cab41e78c698f72186075d108d`.

**Change:** Added more ideas for events and the future

**Changed files:**

- `ideas.txt`

## Update 112

**Date:** 2026-10-15. **Commit:** `ed1fa9cf1728ebee9b46b8f6c19211c3797f2f35`.

**Change:** Added a proper delete control for TXST events

**Changed files:**

- `backend/TXST_EVENTS.md`
- `frontend/src/components/CalendarPage.jsx`
- `frontend/src/components/InlineConfirmation.jsx`
- `frontend/src/components/WorkflowTools.jsx`
- `frontend/src/hooks/useTxstEvents.js`

## Update 111

**Date:** 2026-10-15. **Commit:** `ab7a402bae5283cac87ad73f0915f687777f5a77`.

**Change:** Optimized controls with events deletion

**Changed files:**

- `backend/TXST_EVENTS.md`
- `backend/accountReset.js`
- `backend/server.js`
- `backend/txstCalendar.js`
- `frontend/src/components/CalendarPage.jsx`
- `frontend/src/components/WorkflowTools.jsx`
- `frontend/src/components/WorkflowWorkspace.css`
- `frontend/src/components/WorkflowWorkspace.jsx`
- `frontend/src/hooks/useTxstEvents.js`

## Update 110

**Date:** 2026-10-15. **Commit:** `09025f2cdcda561b000b379d9f97b13fc47359e7`.

**Change:** Added a list of ideas relating to TXST events

**Changed files:**

- `ideas.txt`

## Update 109

**Date:** 2026-10-15. **Commit:** `2c41de3f7af40f32d08481fbaa4fe01f5280df8f`.

**Change:** Second iteration of proper TXST events

**Changed files:**

- `backend/TXST_EVENTS.md`
- `backend/scrapeTxstEvents.js`
- `backend/txstCalendar.js`
- `frontend/src/components/CalendarPage.jsx`
- `frontend/src/components/WorkflowTools.jsx`
- `frontend/src/components/WorkflowWorkspace.jsx`
- `frontend/src/hooks/useTxstEvents.js`

## Update 108

**Date:** 2026-10-15. **Commit:** `18db6642bd5deb7a344a5f364789133a35d72531`.

**Change:** Initial version of event with TXST events

**Changed files:**

- `backend/TXST_EVENTS.md`
- `backend/scrapeTxstEvents.js`
- `backend/server.js`
- `backend/txstCalendar.js`
- `frontend/src/components/CalendarPage.css`
- `frontend/src/components/CalendarPage.jsx`
- `frontend/src/lib/calendar.js`

## Update 107

**Date:** 2026-10-15. **Commit:** `3e0f4e70276063d2e65ec1e5e145955b3f77dcf1`.

**Change:** Created a scraper for TXST events

**Changed files:**

- `.gitignore`
- `README.md`
- `backend/TXST_EVENTS.md`
- `backend/package.json`
- `backend/scrapeTxstEvents.js`

## Update 106

**Date:** 2026-10-15. **Commit:** `7cd0f575f00bcdf10a881fedc445d42cb5707905`.

**Change:** Fixed API key input

**Changed files:**

- `backend/assistantCredentials.js`
- `frontend/src/components/AccountAISettings.jsx`

## Update 105

**Date:** 2026-10-14. **Commit:** `3e98bfef7954de3286376ba89da5bc6cad03cd9c`.

**Change:** Fixed minor error of workspace

**Changed files:**

- `frontend/src/components/WorkflowTools.jsx`

## Update 104

**Date:** 2026-10-14. **Commit:** `c01196f7e85e1920fd17dc14d4af5b9ffc0687f2`.

**Change:** Added a workplace adjustment

**Changed files:**

- `README.md`
- `backend/accountReset.js`
- `backend/server.js`
- `backend/workspaceSettings.js`
- `frontend/src/App.jsx`
- `frontend/src/components/AccountReset.jsx`
- `frontend/src/components/WorkflowTools.jsx`
- `frontend/src/components/WorkflowWorkspace.css`
- `frontend/src/components/WorkflowWorkspace.jsx`
- `frontend/src/components/WorkspaceWindow.jsx`
- `frontend/src/hooks/useWorkspaceLayout.js`
- `frontend/src/lib/shortcuts.js`
- `frontend/src/lib/workspace.js`
- `ideas.txt`

## Update 103

**Date:** 2026-10-14. **Commit:** `e77d4a1a0dc5b017dfa4507faada4b3cdc63aee6`.

**Change:** Added ability to add a customized API key for AI

**Changed files:**

- `README.md`
- `backend/.env.example`
- `backend/accountReset.js`
- `backend/assistantCredentials.js`
- `backend/assistantDiagnostics.js`
- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/AccountAISettings.css`
- `frontend/src/components/AccountAISettings.jsx`
- `frontend/src/components/AccountReset.jsx`
- `frontend/src/components/AssistantChat.jsx`
- `frontend/src/components/AssistantDiagnostics.jsx`

## Update 102

**Date:** 2026-10-14. **Commit:** `ed9a15fe3fb0e40d81c2ec71f8514c402b1ca2af`.

**Change:** Improved sizing of AI assistant

**Changed files:**

- `README.md`
- `frontend/src/components/AssistantChat.css`
- `frontend/src/components/AssistantChat.jsx`
- `frontend/src/hooks/useAssistantResize.js`
- `frontend/src/lib/shortcuts.js`

## Update 101

**Date:** 2026-10-14. **Commit:** `e1e0110bd6bfd19324fdc8bcad0a2b4c4a73f502`.

**Change:** Developed a dedicated AI assistant page

**Changed files:**

- `README.md`
- `backend/assistant.js`
- `backend/assistantConversations.js`
- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/AssistantChat.css`
- `frontend/src/components/AssistantChat.jsx`
- `frontend/src/components/AssistantFiles.jsx`
- `frontend/src/components/AssistantMarkdown.jsx`
- `frontend/src/lib/shortcuts.js`

## Update 100

**Date:** 2026-10-14. **Commit:** `fa66186424817e0060c9af28fd1f517fce247ea2`.

**Change:** Added proper storage of chats for AI chat

**Changed files:**

- `README.md`
- `backend/accountReset.js`
- `backend/assistantConversations.js`
- `backend/server.js`
- `frontend/src/components/AccountReset.jsx`
- `frontend/src/components/AssistantChat.css`
- `frontend/src/components/AssistantChat.jsx`

## Update 099

**Date:** 2026-10-14. **Commit:** `23341960257808545325f8fdc67088e131afa22d`.

**Change:** Fixed AI loading of markdown

**Changed files:**

- `backend/assistant.js`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/src/components/AssistantChat.css`
- `frontend/src/components/AssistantChat.jsx`
- `frontend/src/components/AssistantMarkdown.jsx`

## Update 098

**Date:** 2026-10-14. **Commit:** `e4cc980844a586e203ebff14dfde4dd769583988`.

**Change:** Updated ideas.txt with new ideas for the project

**Changed files:**

- `ideas.txt`

## Update 097

**Date:** 2026-10-14. **Commit:** `bf52e007622bc7acaa2329a3ea151eb77fd85f5a`.

**Change:** Switched AI API providers from OpenAI to Gemini

**Changed files:**

- `AGENTS.md`
- `README.md`
- `backend/.env.example`
- `backend/assistant.js`
- `backend/assistantDiagnostics.js`
- `backend/package-lock.json`
- `backend/package.json`
- `backend/server.js`
- `frontend/src/components/AssistantChat.jsx`
- `frontend/src/components/AssistantDiagnostics.jsx`
- `frontend/src/lib/assistant.js`

## Update 096

**Date:** 2026-10-14. **Commit:** `0d1d886fc35b128bf8c44e998b93a85fd5fa15bc`.

**Change:** Improved error logic for AI API responses

**Changed files:**

- `README.md`
- `backend/assistantDiagnostics.js`
- `backend/assistantDiagnostics.test.js`
- `backend/server.js`
- `frontend/src/components/AssistantChat.css`
- `frontend/src/components/AssistantChat.jsx`
- `frontend/src/components/AssistantDiagnostics.jsx`
- `frontend/src/lib/assistant.js`
- `frontend/src/lib/assistant.test.js`

## Update 095

**Date:** 2026-10-14. **Commit:** `61665087dcc03f40a6ecbd571c696663b1f29fe0`.

**Change:** Added more ideas for the future

**Changed files:**

- `ideas.txt`

## Update 094

**Date:** 2026-10-14. **Commit:** `f0c58e58c9f107ad7a58040303744334b05c667b`.

**Change:** Implementing an AI chatbot for help with tasks

**Changed files:**

- `README.md`
- `backend/assistant.js`
- `backend/assistant.test.js`
- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/AssistantChat.css`
- `frontend/src/components/AssistantChat.jsx`
- `frontend/src/components/CalendarPage.jsx`
- `frontend/src/lib/assistant.js`
- `frontend/src/lib/assistant.test.js`
- `frontend/src/lib/shortcuts.js`
- `ideas.txt`

## Update 093

**Date:** 2026-10-14. **Commit:** `39fd4f0db10eb188349b4bc55092d9b3bd96a1ff`.

**Change:** Reminder to add OPENAI API KEY to .env file

**Changed files:**

- `backend/.env.example`

## Update 092

**Date:** 2026-10-14. **Commit:** `4436ec2612f68e2ff01961ca16d9c54da94ae692`.

**Change:** Implemented flexibility with appointments

**Changed files:**

- `README.md`
- `backend/calendarEntries.js`
- `backend/calendarLinks.js`
- `backend/calendarLinks.test.js`
- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/CalendarAttachments.jsx`
- `frontend/src/components/CalendarPage.jsx`
- `frontend/src/components/TaskAttachments.jsx`
- `frontend/src/lib/calendar.js`
- `frontend/src/lib/calendar.test.js`
- `ideas.txt`

## Update 091

**Date:** 2026-10-14. **Commit:** `9686ec76263c632303b2c211cf6b15109cca96d8`.

**Change:** Improved time zone handling and choosing for users

**Changed files:**

- `README.md`
- `frontend/src/components/TimeZoneSettings.jsx`
- `frontend/src/lib/timeZoneLookup.js`
- `frontend/src/lib/timeZoneLookup.test.js`

## Update 090

**Date:** 2026-10-14. **Commit:** `0803352c83cecfaa3d4fd4ea743ed8dfedb1241b`.

**Change:** Added ability to change time zone in account

**Changed files:**

- `README.md`
- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/CalendarPage.jsx`
- `frontend/src/components/TaskVisualization.jsx`
- `frontend/src/components/TimeZoneSettings.jsx`
- `frontend/src/contexts/AuthContext.jsx`
- `frontend/src/lib/calendar.js`
- `frontend/src/lib/taskVisualization.js`
- `frontend/src/lib/timeZone.js`
- `frontend/src/lib/timeZone.test.js`
- `ideas.txt`

## Update 089

**Date:** 2026-10-14. **Commit:** `2fa9a7b128692debdd5b3fc250dc64d8dbcac77f`.

**Change:** Fixed minor bugs of calendar page

**Changed files:**

- `frontend/.calendar-check.html`
- `frontend/src/.calendar-check.jsx`
- `frontend/src/components/CalendarPage.jsx`
- `frontend/src/lib/calendar.js`
- `frontend/src/lib/calendar.test.js`

## Update 088

**Date:** 2026-10-14. **Commit:** `5fb61328459a2c067e57430379d93487f2aae03c`.

**Change:** Added a proper calendar functionality

**Changed files:**

- `README.md`
- `backend/accountReset.js`
- `backend/accountReset.test.js`
- `backend/calendarEntries.js`
- `backend/calendarEntries.test.js`
- `backend/calendarICS.js`
- `backend/calendarICS.test.js`
- `backend/canvasPagination.js`
- `backend/canvasPagination.test.js`
- `backend/canvasTasks.js`
- `backend/canvasTasks.test.js`
- `backend/server.js`
- `frontend/.calendar-check.html`
- `frontend/src/.calendar-check.jsx`
- `frontend/src/App.jsx`
- `frontend/src/components/AccountReset.jsx`
- `frontend/src/components/CalendarPage.css`
- `frontend/src/components/CalendarPage.jsx`
- `frontend/src/components/TaskVisualization.jsx`
- `frontend/src/lib/calendar.js`
- `frontend/src/lib/calendar.test.js`
- `frontend/src/lib/shortcuts.js`
- `frontend/src/lib/taskVisualization.js`
- `frontend/src/lib/taskVisualization.test.js`

## Update 087

**Date:** 2026-10-13. **Commit:** `26591374b14a25845045a59e39ae6bcc130ad93d`.

**Change:** Fixed UI to make it more professional

**Changed files:**

- `README.md`
- `frontend/src/App.jsx`
- `frontend/src/Navigation.css`
- `frontend/src/components/Auth.jsx`
- `frontend/src/components/DocumentEditor.css`
- `frontend/src/components/DocumentEditor.jsx`
- `frontend/src/components/DocumentLibrary.css`
- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFInsertPanel.jsx`
- `frontend/src/components/PDFUploadModal.jsx`
- `frontend/src/components/TaskAttachments.css`
- `frontend/src/components/TaskDependencies.css`
- `frontend/src/components/TaskVisualization.css`
- `frontend/src/index.css`
- `frontend/src/theme.css`
- `ideas.txt`

## Update 086

**Date:** 2026-10-13. **Commit:** `a2d5c68c977beaf947e318a37d2a02d9a5634ac9`.

**Change:** Created continous string task ability

**Changed files:**

- `README.md`
- `backend/server.js`
- `backend/taskDependencies.js`
- `backend/taskDependencies.test.js`
- `frontend/src/App.jsx`
- `frontend/src/components/TaskDependencies.css`
- `frontend/src/components/TaskDependencies.jsx`
- `frontend/src/components/TaskVisualization.jsx`
- `frontend/src/lib/taskDependencies.js`
- `frontend/src/lib/taskDependencies.test.js`
- `frontend/src/lib/taskVisualization.js`
- `ideas.txt`

## Update 085

**Date:** 2026-10-13. **Commit:** `2c27b1acacbfba77de2434608136cc2bb63a79df`.

**Change:** Added ability to do a full clean reset of acc

**Changed files:**

- `README.md`
- `backend/accountReset.js`
- `backend/accountReset.test.js`
- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/AccountReset.jsx`
- `ideas.txt`

## Update 084

**Date:** 2026-10-13. **Commit:** `750341f27aab04f645b0fed4ec08b90a4d3d7e4d`.

**Change:** Added ability to link different media to tasks

**Changed files:**

- `README.md`
- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/DocumentLibrary.jsx`
- `frontend/src/components/TaskAttachments.css`
- `frontend/src/components/TaskAttachments.jsx`
- `frontend/src/components/TaskVisualization.jsx`
- `frontend/src/lib/taskAttachments.js`
- `frontend/src/lib/taskAttachments.test.js`
- `frontend/src/lib/taskVisualization.js`
- `frontend/src/lib/taskVisualization.test.js`
- `ideas.txt`

## Update 083

**Date:** 2026-10-13. **Commit:** `da3efdc9122ea7f2340da56f2136586055009b7a`.

**Change:** Updated and add visualization page

**Changed files:**

- `README.md`
- `frontend/src/App.jsx`
- `frontend/src/components/TaskVisualization.css`
- `frontend/src/components/TaskVisualization.jsx`
- `frontend/src/lib/shortcuts.js`
- `frontend/src/lib/taskVisualization.js`
- `frontend/src/lib/taskVisualization.test.js`
- `ideas.txt`

## Update 082

**Date:** 2026-10-13. **Commit:** `6e6d8ca82d9b6f52353e198dd5395578ac1cfe94`.

**Change:** Added future improvement ideas to ideas.txt

**Changed files:**

- `ideas.txt`

## Update 081

**Date:** 2026-10-13. **Commit:** `b872c20197eac634d3ec27ad3d5d26b971e13d52`.

**Change:** Added ideas to ideas.txt file

**Changed files:**

- `ideas.txt`

## Update 080

**Date:** 2026-10-13. **Commit:** `ab946ae6ff4d0ff45cbf36e04654ac9ecb33c80d`.

**Change:** Updated navigation and added keyboard shortcuts

**Changed files:**

- `README.md`
- `frontend/src/App.jsx`
- `frontend/src/Navigation.css`
- `frontend/src/components/DocumentEditor.jsx`
- `frontend/src/components/DocumentLibrary.jsx`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/ShortcutsPage.jsx`
- `frontend/src/hooks/useInlineConfirm.js`
- `frontend/src/hooks/useShortcuts.js`
- `frontend/src/lib/shortcuts.js`
- `frontend/src/lib/shortcuts.test.js`
- `ideas.txt`

## Update 079

**Date:** 2026-10-13. **Commit:** `c4e1a347bba0e3e97319e355406fde5c0b5e9d52`.

**Change:** Improved UI with professional colors and design

**Changed files:**

- `README.md`
- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/Auth.jsx`
- `frontend/src/components/DocumentEditor.css`
- `frontend/src/components/DocumentEditor.jsx`
- `frontend/src/components/DocumentLibrary.css`
- `frontend/src/components/DocumentLibrary.jsx`
- `frontend/src/components/InlineConfirmation.jsx`
- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFInsertPanel.jsx`
- `frontend/src/components/PDFUploadModal.jsx`
- `frontend/src/hooks/useInlineConfirm.js`
- `frontend/src/index.css`
- `frontend/tailwind.config.js`

## Update 078

**Date:** 2026-10-13. **Commit:** `6663fa0374a4f31dda0b1dff10a893da52111b5e`.

**Change:** Revamped main organization structure for files

**Changed files:**

- `README.md`
- `backend/documentActions.js`
- `backend/documentActions.test.js`
- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/DocumentLibrary.css`
- `frontend/src/components/DocumentLibrary.jsx`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFUploadModal.jsx`
- `ideas.txt`

## Update 077

**Date:** 2026-10-13. **Commit:** `24fca58d4095ef70217407587fcb02f0225667fd`.

**Change:** Improved support for file types beyond pdfs

**Changed files:**

- `README.md`
- `backend/server.js`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/src/App.jsx`
- `frontend/src/components/DocumentEditor.css`
- `frontend/src/components/DocumentEditor.jsx`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFInsertPanel.jsx`
- `frontend/src/components/PDFUploadModal.jsx`
- `frontend/src/lib/documentFormats.js`
- `frontend/src/lib/documentFormats.test.js`
- `ideas.txt`

## Update 076

**Date:** 2026-10-13. **Commit:** `65a8f8d30502589d7ffb5ad37da8762d84e579f2`.

**Change:** Added feature to allow users to merge pdfs

**Changed files:**

- `backend/pdfPages.js`
- `backend/pdfPages.test.js`
- `backend/server.js`
- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFInsertPanel.jsx`
- `ideas.txt`

## Update 075

**Date:** 2026-10-13. **Commit:** `2aed12e1607ae3b2ab48a91aed8ffdde09808390`.

**Change:** Fixed drag and sizing functionality for PDF editor

**Changed files:**

- `frontend/src/components/InsertHandles.jsx`
- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFInsertPanel.jsx`
- `frontend/src/lib/insertGeometry.js`
- `frontend/src/lib/insertGeometry.test.js`

## Update 074

**Date:** 2026-10-12. **Commit:** `2edd84d59897bdd634b67c2e6e6e1e7e41fae836`.

**Change:** Updated ideas page to keep current

**Changed files:**

- `ideas.txt`

## Update 073

**Date:** 2026-10-12. **Commit:** `1d3eb6e87fe921672e6eaa89169ded8d506af217`.

**Change:** Improved insert capabilities to improve UI

**Changed files:**

- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFInsertPanel.jsx`

## Update 072

**Date:** 2026-10-12. **Commit:** `a5c5e109a41c7aad8c9077992a3db628a8e4db44`.

**Change:** Added insert capabilities for many pages

**Changed files:**

- `backend/server.js`
- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFInsertPanel.jsx`
- `ideas.txt`

## Update 071

**Date:** 2026-10-12. **Commit:** `6d9402ac5d9c497f627c7339131946e9b4c66c67`.

**Change:** Added delete page feature

**Changed files:**

- `backend/package-lock.json`
- `backend/package.json`
- `backend/pdfPages.js`
- `backend/pdfPages.test.js`
- `backend/server.js`
- `frontend/src/components/PDFEditor.jsx`

## Update 070

**Date:** 2026-10-11. **Commit:** `68bc939a75e4cfa2193ea4ca3dcbc9e360727840`.

**Change:** Added pages view to pdf editor and other features

**Changed files:**

- `frontend/src/components/PDFEditor.css`
- `frontend/src/components/PDFEditor.jsx`
- `ideas.txt`

## Update 069

**Date:** 2026-10-11. **Commit:** `06fd31aafe5414b4a95eb11f6aeac14f44ebfa81`.

**Change:** Fixed pdf editor font for insert text feature

**Changed files:**

- `frontend/src/components/PDFEditor.jsx`
- `ideas.txt`

## Update 068

**Date:** 2026-10-09. **Commit:** `59d0be9662a936587d0f9a28294a23d96c8643dc`.

**Change:** Updated ideas for future reference

**Changed files:**

- `ideas.txt`

## Update 067

**Date:** 2026-10-09. **Commit:** `bc6e49a025ef6dd6cec25106a9876163a55e1f13`.

**Change:** Fixed pdf editor logic for insert text feature

**Changed files:**

- `frontend/src/components/PDFEditor.jsx`

## Update 066

**Date:** 2026-10-04. **Commit:** `127fc6657441154d6fb8bcd6d63580892f052799`.

**Change:** Updated logic for pdf editor text insert

**Changed files:**

- `frontend/src/components/PDFEditor.jsx`

## Update 065

**Date:** 2026-10-03. **Commit:** `5fc22b127908de32708c4a7b3bceab90367c4d21`.

**Change:** Added cline rules to .gitignore

**Changed files:**

- `.gitignore`

## Update 064

**Date:** 2026-10-03. **Commit:** `dbd5fa8928dbd359ef14932d888a3de617be7474`.

**Change:** Improving insert text functionality

**Changed files:**

- `frontend/src/components/PDFEditor.jsx`

## Update 063

**Date:** 2026-10-02. **Commit:** `9c199832d4dda70006a8b087bc18765ba64878e2`.

**Change:** Implemented first iteration of insert text

**Changed files:**

- `frontend/src/components/PDFEditor.jsx`

## Update 062

**Date:** 2026-10-01. **Commit:** `7ca1d99438444dbf0270c57dd2b417157437471d`.

**Change:** Created a codebase summary

**Changed files:**

- `codebase_summary.md`

## Update 061

**Date:** 2026-10-01. **Commit:** `cf088735443aefb29be21dda668bbbd21bf53877`.

**Change:** Improved UI for pdf file menu

**Changed files:**

- `frontend/src/App.jsx`

## Update 060

**Date:** 2026-10-01. **Commit:** `5d849ecacdbfd2459525f0e315b52d91401f7082`.

**Change:** Improved UI for pdf folder menu

**Changed files:**

- `frontend/src/App.jsx`

## Update 059

**Date:** 2026-10-01. **Commit:** `ca46f1a3ecb4ed9dc48c239ea1f22534d50b0b9a`.

**Change:** Added support for pen and styluses

**Changed files:**

- `frontend/src/components/PDFEditor.jsx`

## Update 058

**Date:** 2026-10-01. **Commit:** `e0a978aab5a04ca7a318b60801ece894e51045e0`.

**Change:** Improved autosaving logic

**Changed files:**

- `frontend/src/components/PDFEditor.jsx`

## Update 057

**Date:** 2026-10-01. **Commit:** `8291f8fd4ccbe703d7d52f149cb913037ec6795a`.

**Change:** Added autosaving feature

**Changed files:**

- `frontend/src/components/PDFEditor.jsx`
- `ideas.txt`

## Update 056

**Date:** 2026-10-01. **Commit:** `68338e566b6a0512d4d377fed6ddb12dd278897b`.

**Change:** Added burned annotations

**Changed files:**

- `frontend/src/components/PDFEditor.jsx`

## Update 055

**Date:** 2026-10-01. **Commit:** `8a9acec2ec42f6de77648fb975f58b43a127502f`.

**Change:** Improved error logging for pdfs

**Changed files:**

- `frontend/src/components/PDFEditor.jsx`

## Update 054

**Date:** 2026-09-30. **Commit:** `604d22a33a72855136733f92710b807effeaa25b`.

**Change:** Fixed annotations feature for pdf editor

**Changed files:**

- `frontend/src/components/PDFEditor.jsx`

## Update 053

**Date:** 2026-09-30. **Commit:** `6d36e29e84fe28c3763cabe2bde984ba66704f1e`.

**Change:** Fixed features in editor

**Changed files:**

- `frontend/src/components/PDFEditor.jsx`

## Update 052

**Date:** 2026-09-30. **Commit:** `30df1e592f231ed965a992bc74780468dbead42d`.

**Change:** Fixed dependency errors

**Changed files:**

- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/src/components/PDFEditor.jsx`

## Update 051

**Date:** 2026-09-30. **Commit:** `d4cdfac9427e35aba16be3d29aa1df29f4edeb54`.

**Change:** Added ideas

**Changed files:**

- `ideas.txt`

## Update 050

**Date:** 2026-09-30. **Commit:** `350c30022decc7321e40e8ae64c4714041a21796`.

**Change:** Updated show pdf file debugging

**Changed files:**

- `backend/server.js`
- `frontend/src/components/PDFEditor.jsx`

## Update 049

**Date:** 2026-09-30. **Commit:** `40c1b845531946e44be3524c0ae66ff732ac7319`.

**Change:** Initial version of pdf organizing system

**Changed files:**

- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFUploadModal.jsx`

## Update 048

**Date:** 2026-09-29. **Commit:** `a48c1858a3f60c3d8fa1cd68fba9e07d2f6006dc`.

**Change:** Created a PDF Editor

**Changed files:**

- `backend/server.js`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/src/App.jsx`
- `frontend/src/components/PDFEditor.jsx`
- `frontend/src/components/PDFUploadModal.jsx`

## Update 047

**Date:** 2026-09-28. **Commit:** `ab378c2b1e2726b9a58c56cd7d831ac271158968`.

**Change:** Updated delete all feature

**Changed files:**

- `backend/server.js`
- `frontend/src/App.jsx`

## Update 046

**Date:** 2026-09-28. **Commit:** `cad2e3aed8f309b60e0451d1fd4571367b095475`.

**Change:** Added a delete all tasks in folder feature

**Changed files:**

- `backend/server.js`
- `frontend/src/App.jsx`

## Update 045

**Date:** 2026-09-28. **Commit:** `51e50ddd1e0a9a0d2157c901ef4c2cbc6c60f5c3`.

**Change:** Automatic logout if expired API keys

**Changed files:**

- `frontend/src/App.jsx`

## Update 044

**Date:** 2026-09-28. **Commit:** `54455d61f8f9f3af067b62770992839090bb78fd`.

**Change:** Fixed minor UI tweak for error details

**Changed files:**

- `frontend/src/App.jsx`

## Update 043

**Date:** 2026-09-28. **Commit:** `345cf84cddbaf05d26d97b22f8508e6600a723fe`.

**Change:** Improved error messages

**Changed files:**

- `frontend/src/App.jsx`

## Update 042

**Date:** 2026-09-28. **Commit:** `5ae4a0da4f9b3c1ef71543f5a23b023bb73be162`.

**Change:** Removed commands button from main home page

**Changed files:**

- `frontend/src/App.jsx`

## Update 041

**Date:** 2026-09-27. **Commit:** `852474c292fa943ba8e7636c02c324c3a88e0b64`.

**Change:** Updated ideas.txt

**Changed files:**

- `ideas.txt`

## Update 040

**Date:** 2026-09-26. **Commit:** `0a414208a324bb7481d79224060ba20e62fea758`.

**Change:** Added ideas for a resume tailoring app

**Changed files:**

- `ideas.txt`

## Update 039

**Date:** 2026-09-21. **Commit:** `8d22d0784278eff1e21ac5691daef956d113ca31`.

**Change:** Fixed folder logic for imported tasks

**Changed files:**

- `frontend/src/App.jsx`

## Update 038

**Date:** 2026-09-19. **Commit:** `57e6aa6ec046ca4e70fbcd85c5a146d396ab0682`.

**Change:** Improved organization of importing calendar

**Changed files:**

- `backend/server.js`

## Update 037

**Date:** 2026-09-19. **Commit:** `9dfa4ba9ad4597510d314038f257095185e86c0b`.

**Change:** Added admin bar

**Changed files:**

- `frontend/src/App.jsx`

## Update 036

**Date:** 2026-09-19. **Commit:** `1b95d19c20415c6d5d723c784f7b8cab07bc3f0b`.

**Change:** Added proper due date functionality

**Changed files:**

- `backend/server.js`
- `frontend/src/App.jsx`

## Update 035

**Date:** 2026-09-19. **Commit:** `3638887aba5987b225a5851221cfb71271c5e79f`.

**Change:** Added support to import from calendar

**Changed files:**

- `backend/package-lock.json`
- `backend/package.json`
- `backend/server.js`
- `frontend/src/App.jsx`

## Update 034

**Date:** 2026-09-19. **Commit:** `d00476cb444d2b3cfe97cd1963b5678e3216d077`.

**Change:** Added ICS file accessibility endpoint

**Changed files:**

- `backend/server.js`
- `frontend/src/App.jsx`

## Update 033

**Date:** 2026-09-19. **Commit:** `8ded8d67f8af1f8451ed6c5ab67876b1c116933b`.

**Change:** Test feature with calendar endpoint not courses

**Changed files:**

- `backend/server.js`

## Update 032

**Date:** 2026-09-19. **Commit:** `857c41d3712a8f50411b3d074384d863cfe73d34`.

**Change:** Sidelining direct canvas connect

**Changed files:**

- `backend/server.js`

## Update 031

**Date:** 2026-09-19. **Commit:** `335140921ea9e067dc9378984d47fee47521fcb0`.

**Change:** Fixed test connection feature

**Changed files:**

- `backend/server.js`
- `frontend/src/App.jsx`

## Update 030

**Date:** 2026-09-19. **Commit:** `a1c5f687e6902441c92e360172902eaefcb108f5`.

**Change:** Updated error message to be more descriptive

**Changed files:**

- `backend/server.js`

## Update 029

**Date:** 2026-09-19. **Commit:** `a660a5bf3a4e419988f45e76aeb959116dca8276`.

**Change:** Adding sync to canvas calendar capabilities

**Changed files:**

- `backend/server.js`
- `frontend/src/App.jsx`

## Update 028

**Date:** 2026-09-19. **Commit:** `4068c6eb456a8506ae23a579c538417b8359f04b`.

**Change:** Added data endpoints for canvas integration

**Changed files:**

- `backend/server.js`
- `frontend/src/App.jsx`

## Update 027

**Date:** 2026-09-19. **Commit:** `01b04f70570c38c573472667d37c1485ebdad506`.

**Change:** Implemented folder indicator for all tasks

**Changed files:**

- `frontend/src/App.jsx`

## Update 026

**Date:** 2026-09-19. **Commit:** `f7a0e62a67ab9daa8f6b0300fa7334cf2e37c937`.

**Change:** Developed All Tasks and Inbox functionality

**Changed files:**

- `frontend/src/App.jsx`

## Update 025

**Date:** 2026-09-19. **Commit:** `1485580886e24cf33c47dc6098540ac658e780a0`.

**Change:** Added clear inbox feature

**Changed files:**

- `frontend/src/App.jsx`

## Update 024

**Date:** 2026-09-19. **Commit:** `0ef9b41f4bb22b7d294acffc050d21469270f0dd`.

**Change:** Added ability to rename folders

**Changed files:**

- `backend/server.js`
- `frontend/src/App.jsx`

## Update 023

**Date:** 2026-09-19. **Commit:** `fead7c1217ccb6757f5c6523081567eb602046fa`.

**Change:** Clear notifications button added

**Changed files:**

- `frontend/src/App.jsx`

## Update 022

**Date:** 2026-09-18. **Commit:** `7cdd7119f69fe968e82f5590f0bed0242d57b088`.

**Change:** Added timestamps to when completed

**Changed files:**

- `backend/server.js`
- `frontend/src/App.jsx`

## Update 021

**Date:** 2026-09-16. **Commit:** `5799837cd81df1e329dc884552f232ca110eb79f`.

**Change:** Updated ideas.txt

**Changed files:**

- `ideas.txt`

## Update 020

**Date:** 2026-09-15. **Commit:** `e62b85c4dc9458c7dcfb5f4870c506a59835c4e7`.

**Change:** Addedd sorting functionality

**Changed files:**

- `frontend/src/App.jsx`

## Update 019

**Date:** 2026-09-14. **Commit:** `3dc1e07f6b970ef7b99a2872987f5429bb6356e7`.

**Change:** Focus button to new task added with slash

**Changed files:**

- `frontend/src/App.jsx`

## Update 018

**Date:** 2026-09-13. **Commit:** `4244a335c73dc36f1ece5dc836990cbbd0dcb024`.

**Change:** Added click outside to close feature for detail

**Changed files:**

- `frontend/src/App.jsx`

## Update 017

**Date:** 2026-09-13. **Commit:** `411b34fac8a6b22f29aa09420bfb2c3bf64ae046`.

**Change:** Added a task detail modal

**Changed files:**

- `frontend/src/App.jsx`

## Update 016

**Date:** 2026-09-13. **Commit:** `2c92317ec6f9cdeec0d73fe550a05579bfa9414e`.

**Change:** Updating font sizes to improve readability

**Changed files:**

- `frontend/src/App.jsx`

## Update 015

**Date:** 2026-09-13. **Commit:** `36a1561f2c1d1e02d511c67e73065486ee8aef90`.

**Change:** Fixed margins for site

**Changed files:**

- `frontend/src/App.jsx`

## Update 014

**Date:** 2026-09-13. **Commit:** `b0278f09ae4870aa200350c36c7add78b79bc111`.

**Change:** Improved styling to use entire screen

**Changed files:**

- `frontend/src/App.jsx`

## Update 013

**Date:** 2026-09-13. **Commit:** `ca818f1b1fca7ee75588e2c29769fc0df091beaf`.

**Change:** Updated UI behavior with edit widgets

**Changed files:**

- `frontend/src/App.jsx`

## Update 012

**Date:** 2026-09-12. **Commit:** `ee558727edec353301bcaef22316e80a7bb6d33e`.

**Change:** Added a profile page with user stats and settings

**Changed files:**

- `frontend/src/App.jsx`

## Update 011

**Date:** 2026-09-09. **Commit:** `b26ae97ba49ffe5345d52bceedf25f04ea7c33b9`.

**Change:** Added backend ability for desc and links

**Changed files:**

- `backend/server.js`
- `frontend/src/App.jsx`

## Update 010

**Date:** 2026-09-08. **Commit:** `4525e585d3b10aa20ae481046eec86998b065e4a`.

**Change:** Added drag and drop UI

**Changed files:**

- `backend/server.js`
- `frontend/src/App.jsx`

## Update 009

**Date:** 2026-09-08. **Commit:** `3d07ff47a015e3bee9bb2255fb8e49ee625c8559`.

**Change:** Updated package json with necessary dependencies

**Changed files:**

- `backend/package-lock.json`
- `backend/package.json`

## Update 008

**Date:** 2026-09-07. **Commit:** `ad714b8c7db46d819e493043ee59d79ef8c28444`.

**Change:** Added authentication system

**Changed files:**

- `.env.example`
- `backend/.env.example`
- `backend/package.json`
- `backend/server.js`
- `frontend/src/App.jsx`
- `frontend/src/components/Auth.jsx`
- `frontend/src/contexts/AuthContext.jsx`
- `frontend/src/main.jsx`

## Update 007

**Date:** 2026-09-07. **Commit:** `871cefe50fd1d28d175a73c6566c117e0c2c568b`.

**Change:** Updated vertical alignment of home page

**Changed files:**

- `frontend/src/App.jsx`
- `ideas.txt`

## Update 006

**Date:** 2026-09-07. **Commit:** `d51edf994afd6dedfabd7ee291633e482f8f89f8`.

**Change:** Added logic for folders

**Changed files:**

- `backend/server.js`
- `frontend/src/App.jsx`

## Update 005

**Date:** 2026-09-07. **Commit:** `59b0a885ec58d567d1ee0b428e6f5c1ca67810c7`.

**Change:** Updated to move completed into a separate folder

**Changed files:**

- `frontend/src/App.jsx`

## Update 004

**Date:** 2026-09-07. **Commit:** `7d743a1c5ffaa700b66521ee4b3dcf1ced69222c`.

**Change:** Added an ideas.txt file

**Changed files:**

- `ideas.txt`

## Update 003

**Date:** 2026-09-07. **Commit:** `7c9fa47e441919a4650c6c4d59846149ee2fdc86`.

**Change:** Added env example and updated gitignore

**Changed files:**

- `.env.example`
- `.gitignore`

## Update 002

**Date:** 2026-09-07. **Commit:** `177bb0b7c8b942e67e566a214bf5444d652edcfa`.

**Change:** Basic packaging file

**Changed files:**

- `frontend/package-lock.json`

## Update 001

**Date:** 2026-09-07. **Commit:** `34ee120c2b90140fef644a65ca5211c22732059e`.

**Change:** Initial version of Assignment Tracker

**Changed files:**

- `README.md`
- `SETUP.md`
- `backend/.env.example`
- `backend/.gitignore`
- `backend/Procfile`
- `backend/package-lock.json`
- `backend/package.json`
- `backend/server.js`
- `frontend/.gitignore`
- `frontend/index.html`
- `frontend/package.json`
- `frontend/postcss.config.js`
- `frontend/src/App.jsx`
- `frontend/src/index.css`
- `frontend/src/lib/utils.js`
- `frontend/src/main.jsx`
- `frontend/tailwind.config.js`
- `frontend/vite.config.js`
