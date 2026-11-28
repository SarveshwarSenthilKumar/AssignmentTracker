import { useEffect, useState } from 'react'
import { sharedDocumentRequest } from '../lib/sharedDocumentRequest'

const groups = { all: 'All changes', text: 'Text', annotations: 'Annotations', pages: 'Pages', file: 'File' }
const timestamp = value => value ? new Date(value).toLocaleString() : ''
const revisionLabel = item => item.at ? item.action + ' · ' + timestamp(item.at) : item.action

function changedText(before, after) {
  const left = Array.from(before)
  const right = Array.from(after)
  let start = 0
  let end = 0
  const sharedLength = Math.min(left.length, right.length)
  while (start < sharedLength && left[start] === right[start]) start++
  while (end < sharedLength - start && left[left.length - 1 - end] === right[right.length - 1 - end]) end++
  return [left, right].map(chars => [
    chars.slice(0, start).join(''),
    chars.slice(start, chars.length - end).join(''),
    chars.slice(chars.length - end).join(''),
  ])
}

function ChangeValues({ row }) {
  const before = row.before ?? ''
  const after = row.after ?? ''
  const values = row.kind === 'text' ? changedText(before, after) : [['', before, ''], ['', after, '']]
  return <div className="revision-columns">
    {values.map(([start, changed, end], index) => <div key={index} className={index ? 'revision-added' : 'revision-removed'}>
      <span className="revision-value-label">{index ? 'After' : 'Before'}</span>
      <pre>{start}{changed && <mark>{changed}</mark>}{end}{!(start || changed || end) && <i>Empty</i>}</pre>
    </div>)}
  </div>
}

export default function DocumentRevisionComparison({ items, url, token, onBack }) {
  const [from, setFrom] = useState(items[1]?.id || 'baseline')
  const [to, setTo] = useState(items[0]?.id || '')
  const [group, setGroup] = useState('all')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)

  const fromIndex = items.findIndex(item => item.id === from)
  const toIndex = items.findIndex(item => item.id === to)
  const fromStamp = items[fromIndex]?.at
  const toStamp = items[toIndex]?.at

  useEffect(() => {
    const controller = new AbortController()
    setError('')
    setResult(null)
    if (!to || from === to) {
      setBusy(false)
      return () => controller.abort()
    }
    setBusy(true)
    const query = new URLSearchParams({ from, to })
    sharedDocumentRequest(url + '?' + query, {
      signal: controller.signal, cache: 'no-store', headers: token ? { Authorization: 'Bearer ' + token } : {},
    }).then(async response => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Could not compare these revisions.')
      if (!controller.signal.aborted) setResult(data)
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure.message)
    }).finally(() => {
      if (!controller.signal.aborted) setBusy(false)
    })
    return () => controller.abort()
  }, [url, token, from, to, fromStamp, toStamp])

  const values = (result?.values || []).filter(row => group === 'all' || row.group === group)
  const changes = (result?.changes || []).map(change => ({
    ...change, rows: change.rows.filter(row => group === 'all' || row.group === group),
  })).filter(change => change.rows.length)

  return <>
    <div className="revision-toolbar">
      <button type="button" onClick={onBack}>Back to history</button>
      <div className="revision-columns">
        <label>Earlier revision
          <select value={from} onChange={event => setFrom(event.target.value)}>
            <option value="baseline">Before the first retained edit</option>
            {items.map((item, index) => <option key={item.id} value={item.id} disabled={index <= toIndex}>{revisionLabel(item)}</option>)}
          </select>
        </label>
        <label>Later revision
          <select value={to} onChange={event => setTo(event.target.value)}>
            {items.map((item, index) => <option key={item.id} value={item.id} disabled={from !== 'baseline' && index >= fromIndex}>{revisionLabel(item)}</option>)}
          </select>
        </label>
      </div>
      <label>Show changes
        <select value={group} onChange={event => setGroup(event.target.value)}>
          {Object.entries(groups).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
        </select>
      </label>
    </div>
    <div className="revision-results" aria-busy={busy}>
      {busy && <p role="status">Comparing revisions…</p>}
      {error && <p className="document-history-error" role="alert">{error}</p>}
      {result && <>
        <p className="revision-note">Compare recorded details between the selected revisions. File text is shown in excerpts, and page operations appear in save order.</p>
        {!!values.length && <section className="revision-edit" aria-label="Recorded revision values">
          <div className="revision-columns">
            <h3>{revisionLabel(result.earlier)}</h3>
            <h3>{revisionLabel(result.later)}</h3>
          </div>
          {values.map((row, index) => <article key={index}>
            <h4>{row.label} <span>{groups[row.group]}</span></h4>
            <ChangeValues row={row}/>
          </article>)}
        </section>}
        {result.changes.some(change => change.partial) && <p className="revision-note">Some edits have only a summary or include more changes than history retained.</p>}
        {!changes.length && !values.length && <p>No recorded {group === 'all' ? '' : groups[group].toLowerCase() + ' '}changes in this range.</p>}
        {changes.map(change => <section key={change.id} className="revision-edit">
          <h3>{change.action}</h3>
          <p className="revision-note">{change.actor} · {timestamp(change.at)}{change.pages.length > 0 && ' · Pages ' + change.pages.join(', ')}</p>
          {change.rows.map((row, index) => <article key={row.key || index}>
            <h4>{row.label} <span>{groups[row.group]}</span></h4>
            {row.kind === 'note' ? <p className="revision-note">{row.text}</p> : <ChangeValues row={row}/>}
          </article>)}
        </section>)}
      </>}
    </div>
  </>
}
