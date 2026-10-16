const { scrapeTxstEvents } = require('./scrapeTxstEvents');

// Shared public data: no personal calendar records or credentials are involved.
function registerTxstCalendar(app, authenticateToken, User, history) {
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
  const respond = async (req, res) => {
    let preferences;
    try {
      preferences = await User.findById(req.user.userId).select('hiddenCalendarIds hideTxstEvents').lean();
      if (!preferences) return res.status(404).json({message:'Account not found.'});
    } catch { return res.status(500).json({message:'Could not load calendar preferences.'}); }
    const interval = complete ? 60 * 60 * 1000 : 5 * 60 * 1000;
    const refreshRequested = req.method === 'POST';
    if (!syncing && Date.now() - attemptedAt >= (refreshRequested ? 60000 : interval)) refresh();
    res.set('Cache-Control', 'no-store');
    res.json({ events: events.map(({ raw, ...event }) => event), syncing, progress, warning, complete, updatedAt, hiddenCalendarIds:preferences.hiddenCalendarIds||[], hideTxstEvents:!!preferences.hideTxstEvents });
  };
  app.get('/api/calendar/txst-events', authenticateToken, respond);
  app.post('/api/calendar/txst-events/refresh', authenticateToken, respond);
  app.put('/api/calendar/visibility', authenticateToken, async (req,res)=>{
    const {action,id,ids}=req.body||{};
    let update;
    if(action==='hide' && typeof id==='string' && /^(?:txst:[\w-]{1,100}|task:[a-f\d]{24})$/i.test(id)) update={$addToSet:{hiddenCalendarIds:id}};
    else if(action==='hide-many' && Array.isArray(ids) && ids.length>0 && ids.length<=10000 && ids.every(value=>typeof value==='string'&&/^(?:txst:[\w-]{1,100}|(?:task|entry):[a-f\d]{24})$/i.test(value))) update={$addToSet:{hiddenCalendarIds:{$each:[...new Set(ids)]}}};
    else if(action==='hide-txst') update={$set:{hideTxstEvents:true}};
    else if(action==='restore') update={$set:{hiddenCalendarIds:[],hideTxstEvents:false}};
    else return res.status(400).json({message:'Choose a valid calendar item or action.'});
    try {
      const user=await history.mutate(req.user.userId,action==='restore'?'restore removed events':action==='hide-many'?'remove matching events':action==='hide-txst'?'remove all TXST events':'remove event',async session=>{
        const previous=await User.findById(req.user.userId).session(session).lean();
        const saved=await User.findByIdAndUpdate(req.user.userId,update,{new:true,runValidators:true,session}).select('hiddenCalendarIds hideTxstEvents').lean();
        return {value:saved,kind:'visibility',before:{hiddenCalendarIds:previous.hiddenCalendarIds||[],hideTxstEvents:!!previous.hideTxstEvents},after:{hiddenCalendarIds:saved.hiddenCalendarIds||[],hideTxstEvents:!!saved.hideTxstEvents}};
      });
      if(!user)return res.status(404).json({message:'Account not found.'});
      res.json({hiddenCalendarIds:user.hiddenCalendarIds||[],hideTxstEvents:!!user.hideTxstEvents});
    } catch { res.status(500).json({message:'Could not save calendar visibility.'}); }
  });
}

module.exports = { registerTxstCalendar };
