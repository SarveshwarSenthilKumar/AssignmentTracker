(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('view') !== 'my-events') return;
  const key = 'daily-events-progress-v1';
  const panel = document.getElementById('progress-tasks');
  const list = document.getElementById('progress-list');
  const status = document.getElementById('progress-status');
  const create = document.getElementById('progress-create');
  panel.hidden = false;
  const centralDate = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = () => {
    const parts = centralDate.formatToParts(new Date());
    const get = type => parts.find(part => part.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  };
  const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
  const positive = value => Number.isSafeInteger(value) && value > 0 && value <= 1000000000;
  const id = () => crypto.randomUUID();
  const number = value => value.toLocaleString('en-US');
  const dateLabel = value => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
  const element = (tag, text, className) => {
    const item = document.createElement(tag);
    if (text != null) item.textContent = text;
    if (className) item.className = className;
    return item;
  };
  let tasks = [], storageReadable = true;
  function read() {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(saved) || !saved.every(task => task && typeof task.id === 'string' && typeof task.title === 'string' && typeof task.unit === 'string' && positive(task.target) && Array.isArray(task.logs) && task.logs.every(log => log && typeof log.id === 'string' && validDay(log.day) && positive(log.amount)) && Number.isSafeInteger(task.logs.reduce((sum, log) => sum + log.amount, 0)))) throw new Error('Invalid saved tasks');
    return saved;
  }
  function save(next, message) {
    if (!storageReadable) { status.textContent = 'Saved tasks could not be read. Reload after restoring browser storage before making changes.'; return false; }
    try { localStorage.setItem(key, JSON.stringify(next)); }
    catch { status.textContent = 'Could not save. Browser storage may be full or disabled. Your change was not applied.'; return false; }
    tasks = next;
    render();
    status.textContent = message;
    return true;
  }
  try { tasks = read(); }
  catch { storageReadable = false; status.textContent = 'Saved tasks could not be read. Browser storage may be disabled or the saved data may be damaged.'; }

  function render() {
    list.replaceChildren();
    if (!tasks.length) { list.append(element('p', 'No progress tasks yet. Try “Apply to jobs” with a target of 200.', 'progress-empty')); return; }
    tasks.forEach(task => {
      const total = task.logs.reduce((sum, log) => sum + log.amount, 0);
      const complete = total >= task.target;
      const card = element('article', null, 'progress-card');
      const title = element('h3', task.title);
      const tally = element('p', `${number(total)} / ${number(task.target)} ${task.unit || 'units'}`, 'progress-tally');
      const meter = document.createElement('progress');
      meter.max = task.target; meter.value = Math.min(total, task.target);
      meter.setAttribute('aria-label', `${task.title}: ${number(total)} of ${number(task.target)}`);
      const remaining = element('p', `${Math.min(100, Math.floor(total / task.target * 100))}% complete · ${complete ? 'Goal reached!' : `${number(task.target - total)} remaining`}`, 'progress-meta');
      const todayTotal = task.logs.filter(log => log.day === today()).reduce((sum, log) => sum + log.amount, 0);
      card.append(title, tally, meter, remaining, element('p', `Today: ${number(todayTotal)} ${task.unit || 'units'} · Central time`, 'progress-meta'));

      const form = element('form', null, 'progress-log-form');
      const dateWrap = element('label', 'Day');
      const date = document.createElement('input');
      date.type = 'date'; date.required = true; date.value = today(); date.max = today();
      dateWrap.append(date);
      const amountWrap = element('label', `Add ${task.unit || 'progress'}`);
      const amount = document.createElement('input');
      amount.type = 'number'; amount.min = '1'; amount.max = '1000000000'; amount.step = '1'; amount.required = true; amount.placeholder = '20';
      amountWrap.append(amount);
      const submit = element('button', 'Log progress'); submit.type = 'submit';
      const error = element('p', '', 'progress-error'); error.setAttribute('role', 'alert');
      form.append(dateWrap, amountWrap, submit, error);
      form.addEventListener('submit', event => {
        event.preventDefault(); error.textContent = ''; date.max = today();
        const value = Number(amount.value);
        if (!positive(value)) { error.textContent = 'Enter a positive whole number up to 1,000,000,000.'; return; }
        if (!validDay(date.value) || date.value > today()) { error.textContent = 'Choose today or an earlier day.'; return; }
        if (!Number.isSafeInteger(total + value)) { error.textContent = 'This amount exceeds the supported total.'; return; }
        const log = { id: id(), day: date.value, amount: value };
        if (save(tasks.map(item => item.id === task.id ? { ...item, logs: [...item.logs, log] } : item), `Added ${number(value)} to ${task.title} for ${dateLabel(log.day)}.`)) {
          // Return focus to this task's freshly rendered logging input.
          document.getElementById(`task-${task.id}`)?.querySelector('input[type=number]')?.focus();
        }
      });
      card.id = `task-${task.id}`;
      card.append(form);
      const history = element('details'); history.append(element('summary', `Daily history (${task.logs.length} ${task.logs.length === 1 ? 'entry' : 'entries'})`));
      if (!task.logs.length) history.append(element('p', 'Log your first bit of progress above.', 'progress-meta'));
      const days = [...new Set(task.logs.map(log => log.day))].sort().reverse();
      days.forEach(day => {
        const entries = task.logs.filter(log => log.day === day);
        const group = element('div', null, 'progress-day');
        group.append(element('strong', `${dateLabel(day)} · ${number(entries.reduce((sum, log) => sum + log.amount, 0))} ${task.unit || 'units'}`));
        entries.forEach(log => {
          const row = element('div', null, 'progress-history-row');
          const remove = element('button', 'Remove entry'); remove.type = 'button';
          remove.setAttribute('aria-label', `Remove ${number(log.amount)} from ${task.title} on ${dateLabel(day)}`);
          remove.addEventListener('click', () => { if (save(tasks.map(item => item.id === task.id ? { ...item, logs: item.logs.filter(entry => entry.id !== log.id) } : item), 'Entry removed; task totals updated.')) document.getElementById(`task-${task.id}`)?.querySelector('summary')?.focus(); });
          row.append(element('span', `+${number(log.amount)}`), remove); group.append(row);
        });
        history.append(group);
      });
      const removeTask = element('button', 'Delete task'); removeTask.type = 'button';
      removeTask.addEventListener('click', () => {
        if (!confirm(`Delete “${task.title}” and its progress history?`)) return;
        if (save(tasks.filter(item => item.id !== task.id), 'Progress task deleted.')) document.querySelector('#new-progress-task>summary').focus();
      });
      card.append(history, removeTask); list.append(card);
    });
  }
  create.addEventListener('submit', event => {
    event.preventDefault();
    const fields = new FormData(create), title = String(fields.get('title') || '').trim(), target = Number(fields.get('target')), unit = String(fields.get('unit') || '').trim();
    if (!title || !positive(target)) { status.textContent = 'Enter a name and a whole-number target between 1 and 1,000,000,000.'; return; }
    if (save([...tasks, { id: id(), title, target, unit, logs: [] }], `Created ${title}. Log a little progress whenever you work on it.`)) { create.reset(); document.getElementById('new-progress-task').open = false; document.querySelector('#new-progress-task>summary').focus(); }
  });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    try { tasks = read(); storageReadable = true; render(); status.textContent = 'Tasks updated from another tab.'; }
    catch { storageReadable = false; status.textContent = 'Could not read task changes from another tab. Reload before editing.'; }
  });
  render();
})();
