const { createHash, randomBytes } = require('node:crypto');

const hash = value => createHash('sha256').update(value).digest('hex');
const validId = value => /^[a-f\d]{24}$/i.test(value);
const validToken = value => /^[A-Za-z0-9_-]{43}$/.test(value);

const groups = ['title', 'schedule', 'location', 'notes', 'reminder'];
const date = value => value ? new Date(value).toISOString() : null;
const values = entry => ({
  title: entry.title,
  schedule: {
    kind: entry.kind, allDay: entry.allDay,
    startDate: entry.startDate, endDate: entry.endDate || entry.startDate,
    startAt: date(entry.startAt), endAt: date(entry.endAt),
    sports: entry.kind === 'sports'
      ? Object.fromEntries(['sport', 'league', 'team', 'opponent'].map(key => [key, entry.sports?.[key] || ''])) : null,
  },
  location: entry.location || '',
  notes: entry.notes || '',
  reminder: entry.reminderMinutes ?? null,
});
const digest = value => hash(JSON.stringify(value));

class ShareError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = function registerCalendarEventSharing(app, auth, { User, CalendarEntry, PDF, PDFFolder, history, documentNames, nameKey }) {
  const ownerPath = '/api/calendar-entries/:id/share-link';
  const recipientPath = '/api/calendar-event-shares/:secret';
  const route = handler => async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try { await handler(req, res); }
    catch (error) {
      res.status(error instanceof ShareError ? error.status : 500).json({
        message: error instanceof ShareError ? error.message : 'Could not complete calendar sharing. Please try again.',
      });
    }
  };
  const owned = req => {
    if (!validId(req.params.id)) throw new ShareError(404, 'Calendar event not found.');
    return { _id: req.params.id, user: req.user.userId };
  };
  const shared = async (secret, session) => {
    if (!validToken(secret)) throw new ShareError(404, 'This event link is unavailable.');
    const entry = await CalendarEntry.findOne({ eventShareHash: hash(secret) })
      .select('+eventShareDocumentIds +eventShareHash').session(session).lean();
    if (!entry) throw new ShareError(404, 'This event link is unavailable.');
    return entry;
  };

  async function attachments(entry, ids, session) {
    const owner = await User.findById(entry.user).select('lockedSections').session(session).lean();
    const locks = new Set(owner?.lockedSections);
    if (!owner || locks.has('calendar')) throw new ShareError(403, 'This event is currently locked or unavailable.');
    if (!ids.length) return [];
    if (locks.has('documents')) throw new ShareError(403, 'The event has locked attachments.');
    const linked = new Set((entry.documentIds || []).map(String));
    const files = await PDF.find({ _id: { $in: ids }, user: entry.user, deletedAt: null })
      .select('name originalName mimeType pdfFolder').session(session).lean();
    if (files.length !== ids.length || ids.some(id => !linked.has(String(id)))) {
      throw new ShareError(409, 'An attachment is no longer available. The owner can create a new link with the current attachments.');
    }
    if (files.some(file => locks.has('file:' + file._id))) throw new ShareError(403, 'The event has locked attachments.');
    if (files.some(file => file.pdfFolder)) {
      const folders = await PDFFolder.find({ user: entry.user }).select('parentId').session(session).lean();
      const parents = new Map(folders.map(folder => [String(folder._id), folder.parentId]));
      for (const file of files) {
        const visited = new Set();
        for (let id = file.pdfFolder; id; id = parents.get(String(id))) {
          const key = String(id);
          if (!parents.has(key) || visited.has(key) || locks.has('documents:' + key)) {
            throw new ShareError(403, 'The event has an attachment in a locked or unavailable folder.');
          }
          visited.add(key);
        }
      }
    }
    const lookup = new Map(files.map(file => [String(file._id), file]));
    return ids.map(id => lookup.get(String(id)));
  }

  app.get(ownerPath, auth, route(async (req, res) => {
    const entry = await CalendarEntry.findOne(owned(req)).select('+eventShareHash').lean();
    if (!entry) throw new ShareError(404, 'Calendar event not found.');
    res.json({ active: Boolean(entry.eventShareHash) });
  }));

  app.post(ownerPath, auth, route(async (req, res) => {
    const filter = owned(req);
    const entry = await CalendarEntry.findOne(filter).lean();
    if (!entry) throw new ShareError(404, 'Calendar event not found.');
    const ids = [...new Set((entry.documentIds || []).map(String))];
    await attachments(entry, ids, null);
    const secret = randomBytes(32).toString('base64url');
    const attachmentMatch = entry.documentIds?.length
      ? { documentIds: entry.documentIds }
      : { $or: [{ documentIds: { $size: 0 } }, { documentIds: null }] };
    const result = await CalendarEntry.updateOne({ ...filter, ...attachmentMatch }, {
      $set: { eventShareHash: hash(secret), eventShareDocumentIds: ids },
    }, { timestamps: false });
    if (!result.matchedCount) throw new ShareError(409, 'The event changed. Reopen sharing and try again.');
    res.status(201).json({ path: '/shared-calendar-event/' + secret });
  }));

  app.delete(ownerPath, auth, route(async (req, res) => {
    const result = await CalendarEntry.updateOne(owned(req), {
      $unset: { eventShareHash: '', eventShareDocumentIds: '' },
    }, { timestamps: false });
    if (!result.matchedCount) throw new ShareError(404, 'Calendar event not found.');
    res.json({ active: false });
  }));

  const fields = entry => {
    const { title, kind, notes, location, allDay, startDate, endDate, startAt, endAt, reminderMinutes, sports } = entry;
    return { title, kind, notes, location, allDay, startDate, endDate, startAt, endAt, reminderMinutes, sports };
  };
  const existingCopy = (entry, user, session) => CalendarEntry.findOne({
    user, sharedFromEventId: entry._id,
  }).select('_id').session(session).lean();

  app.get(recipientPath, auth, route(async (req, res) => {
    const source = await shared(req.params.secret, null);
    const files = await attachments(source, source.eventShareDocumentIds || [], null);
    const user = req.user.userId;
    const existing = String(source.user) === String(user) ? source : await existingCopy(source, user, null);
    res.json({ ...fields(source), attachments: files.map(({ name, mimeType }) => ({ name, mimeType })),
      entryId: existing?._id, isCopy: !!existing && String(source.user) !== String(user) });
  }));

  const updatesPath = '/api/calendar-entries/:id/shared-updates';
  async function comparison(req, session) {
    const copy = await CalendarEntry.findOne(owned(req)).session(session).lean();
    if (!copy?.sharedFromEventId) throw new ShareError(404, 'This event is not a copy of a shared event.');
    const secret = req.body?.shareToken;
    const grant = typeof secret === 'string' && validToken(secret) ? hash(secret) : copy.sharedEventSync?.grant;
    if (!grant) throw new ShareError(409, 'Open the original sharing link to check updates for this copy.');
    const source = await CalendarEntry.findOne({ _id: copy.sharedFromEventId, eventShareHash: grant }).session(session).lean();
    if (!source) throw new ShareError(404, 'The original sharing link is unavailable. Ask the sender for an active link.');
    const owner = await User.findById(source.user).select('lockedSections deactivatedAt approvalPending').session(session).lean();
    if (!owner || owner.deactivatedAt || owner.approvalPending || owner.lockedSections?.includes('calendar')) {
      throw new ShareError(403, 'The original event is currently locked or unavailable.');
    }
    const current = values(copy), incoming = values(source);
    const baseline = copy.sharedEventSync?.baseline || {};
    const matching = {};
    const changes = groups.flatMap(key => {
      const localHash = digest(current[key]), sourceHash = digest(incoming[key]);
      if (sourceHash === localHash) {
        matching[key] = sourceHash;
        return [];
      }
      if (sourceHash === baseline[key]) return [];
      return [{ key, current: current[key], incoming: incoming[key], locallyEdited: !!baseline[key] && localHash !== baseline[key] }];
    });
    const version = digest([grant, current, incoming, groups.map(key => baseline[key] ?? null)]);
    return { copy, grant, version, changes, baseline, matching };
  }

  app.post(updatesPath + '/check', auth, route(async (req, res) => {
    const { version, changes, baseline } = await comparison(req, null);
    res.json({ version, changes, hasBaseline: groups.every(key => !!baseline[key]) });
  }));
  app.put(updatesPath, auth, route(async (req, res) => {
    const { version, selected } = req.body || {};
    if (typeof version !== 'string' || !/^[a-f\d]{64}$/.test(version) || !Array.isArray(selected) ||
      !selected.length || selected.length > groups.length || new Set(selected).size !== selected.length || selected.some(key => !groups.includes(key))) {
      throw new ShareError(400, 'Choose at least one change from the comparison.');
    }
    const updated = await history.mutate(req.user.userId, 'apply shared event updates', async session => {
      const state = await comparison(req, session);
      const changes = state.changes.filter(change => selected.includes(change.key));
      if (state.version !== version || changes.length !== selected.length) throw new ShareError(409, 'The event changed since your comparison. Check again before applying updates.');
      const patch = {};
      const baseline = { ...state.baseline, ...state.matching };
      for (const { key, incoming } of changes) {
        if (key === 'schedule') Object.assign(patch, incoming);
        else patch[key === 'reminder' ? 'reminderMinutes' : key] = incoming;
        baseline[key] = digest(incoming);
      }
      patch.sharedEventSync = { grant: state.grant, baseline };
      const document = await CalendarEntry.findOneAndUpdate(owned(req), { $set: patch }, { new: true, session, runValidators: true });
      return { value: document, kind: 'entry', entryId: document._id, before: state.copy, after: document.toObject() };
    });
    res.json(updated);
  }));

  app.post(recipientPath, auth, route(async (req, res) => {
    const user = req.user.userId;
    try {
      const entry = await history.mutate(user, 'copy shared event', async session => {
        const source = await shared(req.params.secret, session);
        const files = await attachments(source, source.eventShareDocumentIds || [], session);
        const existing = String(source.user) === String(user) ? source : await existingCopy(source, user, session);
        if (existing) throw Object.assign(new ShareError(409, 'This event is already in your calendar.'), { entryId: existing._id });

        const documentIds = [];
        const names = files.length ? new Set((await documentNames(PDF, user, null, [], session)).map(file => nameKey(file.name))) : new Set();
        let totalBytes = 0;
        for (const file of files) {
          const content = await PDF.findOne({ _id: file._id, user: source.user, deletedAt: null })
            .select('pdfData annotations documentKind whiteboardAppearance').session(session);
          if (!content?.pdfData) throw new ShareError(409, 'A shared attachment is no longer available.');
          totalBytes += content.pdfData.length + Buffer.byteLength(JSON.stringify(content.annotations || []));
          if (totalBytes > 50 * 1024 * 1024) throw new ShareError(413, 'The event attachments exceed the 50 MB copy limit.');
          const base = file.name.slice(0, 120).trimEnd();
          let name = base;
          for (let index = 1; names.has(nameKey(name)); index++) {
            const suffix = index === 1 ? ' (event copy)' : ' (event copy ' + index + ')';
            name = base.slice(0, 120 - suffix.length).trimEnd() + suffix;
          }
          names.add(nameKey(name));
          const [copy] = await PDF.create([{
            user, name, originalName: file.originalName, mimeType: file.mimeType,
            pdfData: content.pdfData, annotations: content.annotations,
            documentKind: content.documentKind, whiteboardAppearance: content.whiteboardAppearance,
          }], { session });
          documentIds.push(copy._id);
        }
        const [created] = await CalendarEntry.create([{
          ...fields(source), user, documentIds, sharedFromEventId: source._id,
          sharedEventSync: { grant: source.eventShareHash, baseline: Object.fromEntries(Object.entries(values(source)).map(([key, value]) => [key, digest(value)])) },
        }], { session });
        return { value: created, kind: 'entry', entryId: created._id, before: null, after: created.toObject() };
      });
      res.status(201).json({ entryId: entry._id });
    } catch (error) {
      if (error instanceof ShareError && error.entryId) return res.json({ entryId: error.entryId });
      throw error;
    }
  }));
};
