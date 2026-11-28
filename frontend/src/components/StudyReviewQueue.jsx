import { useEffect, useRef, useState } from 'react'
import { ArrowRight, RotateCcw } from 'lucide-react'
import AssistantMarkdown from './AssistantMarkdown'
import { answersFor, studyRequest } from '../lib/study'
import { activeTimeZone } from '../lib/timeZone'

const options = [
  ['again', 'Again', 'I couldn’t recall it'],
  ['hard', 'Hard', 'I recalled part of it or needed a hint'],
  ['good', 'Good', 'I recalled it with some effort'],
  ['easy', 'Easy', 'I recalled it confidently'],
]
export const isReviewDue = (item, now) => item.kind === 'question' && (!item.review?.dueAt || Date.parse(item.review.dueAt) <= now)
export const reviewTime = value => new Date(value).toLocaleString(undefined, {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: activeTimeZone(),
})
const attempt = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')

export default function StudyReviewQueue({ token, items, now, onRated, onClose }) {
  const [revealedId, setRevealedId] = useState(null)
  const [deferred, setDeferred] = useState([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [count, setCount] = useState(0)
  const [subject, setSubject] = useState('')
  const pending = useRef(false)
  const lastAttempt = useRef(null)
  const heading = useRef(null)
  const questions = items.filter(item => item.kind === 'question')
  const subjects = [...new Set(questions.map(item => item.topic).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const selected = questions.filter(item => !subject || item.topic === subject)
  const due = selected.filter(item => isReviewDue(item, now)).sort((a, b) => {
    const order = deferred.indexOf(a._id) - deferred.indexOf(b._id)
    if (order) return order
    return (a.review?.dueAt ? Date.parse(a.review.dueAt) : Infinity) -
      (b.review?.dueAt ? Date.parse(b.review.dueAt) : Infinity) || Date.parse(a.createdAt) - Date.parse(b.createdAt)
  })
  const current = due[0]
  const next = selected.map(item => item.review?.dueAt).filter(value => value && Date.parse(value) > now).sort()[0]
  const revealed = current && current._id === revealedId
  const answers = current ? answersFor(current) : []

  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [current?._id])

  async function rate(rating) {
    if (!current || !revealed || pending.current) return
    const { _id: id } = current
    const version = current.review?.count || 0
    if (lastAttempt.current?.id !== id || lastAttempt.current.version !== version || lastAttempt.current.rating !== rating) {
      lastAttempt.current = { id, version, rating, attemptId: attempt() }
    }
    pending.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const saved = await studyRequest(token, '/' + id + '/review', {
        method: 'POST', body: JSON.stringify({ version, rating, questionUpdatedAt: current.updatedAt, attemptId: lastAttempt.current.attemptId }),
      })
      onRated(saved)
      setRevealedId(null)
      setDeferred(previous => previous.filter(value => value !== id))
      setCount(value => value + 1)
      setNotice('Next review scheduled for ' + reviewTime(saved.review.dueAt) + '.')
    } catch (failure) { setError(failure.message) }
    finally { pending.current = false; setBusy(false) }
  }

  return <section className="study-review" aria-label="Review queue">
    <header className="study-review-header">
      <div><h2>Review queue</h2><p>{due.length} due now · {count} reviewed this session</p></div>
      <div><label>Subject <select value={subject} disabled={busy} onChange={event => {
        setSubject(event.target.value); setRevealedId(null); setError('')
      }}><option value="">All subjects</option>{subjects.map(value => <option key={value}>{value}</option>)}</select></label>
      <button type="button" disabled={busy} onClick={onClose}>Back to question bank</button></div>
    </header>
    {notice && <p role="status" className="study-review-notice">{notice}</p>}
    {error && <div className="study-review-notice"><p role="alert">{error}</p><button type="button" onClick={() => {
      setError(''); window.dispatchEvent(new Event('study-changed'))
    }}><RotateCcw size={14}/>Refresh queue</button></div>}
    {current ? <article>
      <p className="study-review-meta">{current.topic || 'Unfiled'} · {current.review?.dueAt ? 'Due for review' : 'First review'}</p>
      <h3 ref={heading} tabIndex={-1}>{current.title}</h3>
      {!revealed ? <div className="study-review-actions">
        <p>Try to answer from memory before revealing the saved answer.</p>
        <button type="button" onClick={() => setRevealedId(current._id)}>Reveal answer</button>
        <button type="button" disabled={due.length < 2} onClick={() => {
          setDeferred(previous => [...previous.filter(id => id !== current._id), current._id])
          setRevealedId(null)
          setError('')
        }}>Skip for now<ArrowRight size={14}/></button>
      </div> : <>
        <div className="study-review-answer">
          {answers.length ? answers.map((answer, index) => <section className="study-answer" key={index}>
            <h4>{answers.length === 1 ? 'Saved answer' : 'Answer ' + (index + 1)}</h4>
            <AssistantMarkdown content={answer}/>
          </section>) : <p>No saved answer. Rate how well you recalled it.</p>}
          {current.notes && <p className="study-notes">{current.notes}</p>}
        </div>
        <fieldset className="study-review-ratings" disabled={busy}>
          <legend>How confidently did you answer?</legend>
          {options.map(([id, label, detail]) => <button type="button" key={id} onClick={() => rate(id)}>
            <strong>{label}</strong><small>{detail}</small>
          </button>)}
        </fieldset>
      </>}
    </article> : <div className="study-review-empty">
      <h3 ref={heading} tabIndex={-1}>{selected.length ? 'You’re caught up' : 'No questions in this queue'}</h3>
      <p>{next ? 'Next question due ' + reviewTime(next) + '.' : 'Save a question to add it to the review queue.'}</p>
    </div>}
  </section>
}
