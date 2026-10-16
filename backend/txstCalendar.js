const { scrapeTxstEvents } = require('./scrapeTxstEvents');

// Shared public data: no personal calendar records or credentials are involved.
function registerTxstCalendar(app, authenticateToken) {
  let events = [], updatedAt = null, attemptedAt = 0, syncing = false;
  let warning = '', progress = '', complete = false;
  const refresh = () => {
    syncing = true;
    attemptedAt = Date.now();
    progress = 'Loading TXST event listings…';
    warning = '';
    scrapeTxstEvents({
      onProgress: message => { progress = message; },
      onEvent: event => {
        const index = events.findIndex(previous => String(previous.id) === String(event.id));
        if (index < 0) events.push(event);
        else if (event.raw.detail || !events[index].raw.detail) events[index] = event;
      },
    })
      .then(result => {
        if (result.complete) events = result.events;
        else {
          // Keep previously collected details when a refresh only partially succeeds.
          const merged = new Map(events.map(event => [String(event.id), event]));
          for (const event of result.events) {
            const previous = merged.get(String(event.id));
            merged.set(String(event.id), !event.raw.detail && previous?.raw.detail ? previous : event);
          }
          events = [...merged.values()];
        }
        complete = result.complete;
        if (result.complete) updatedAt = result.scrapedAt;
        else warning = `Some TXST events could not be loaded. ${result.errors[0]?.message || 'Try refreshing later.'}`;
      })
      .catch(error => { complete = false; warning = `TXST events are temporarily unavailable: ${error.message}`; })
      .finally(() => { syncing = false; progress = ''; });
  };
  const respond = (req, res) => {
    const interval = complete ? 60 * 60 * 1000 : 5 * 60 * 1000;
    const refreshRequested = req.method === 'POST';
    if (!syncing && Date.now() - attemptedAt >= (refreshRequested ? 60000 : interval)) refresh();
    res.set('Cache-Control', 'no-store');
    res.json({ events: events.map(({ raw, ...event }) => event), syncing, progress, warning, complete, updatedAt });
  };
  app.get('/api/calendar/txst-events', authenticateToken, respond);
  app.post('/api/calendar/txst-events/refresh', authenticateToken, respond);
}

module.exports = { registerTxstCalendar };
