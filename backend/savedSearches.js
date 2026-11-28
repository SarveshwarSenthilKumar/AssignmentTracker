const { randomBytes } = require('node:crypto');
const scopes = ['all', 'tasks', 'documents', 'shared', 'events', 'jobs'];
const path = '/api/account/saved-searches';

module.exports = function registerSavedSearches(app, auth, User) {
  const route = (method, suffix, handler) => app[method](path + suffix, auth, async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try { await handler(req, res); }
    catch { res.status(503).json({ message: 'Could not access your saved searches.' }); }
  });
  route('get', '', async (req, res) => {
    const user = await User.findById(req.user.userId).select('+savedSearches').lean();
    if (!user) return res.status(404).json({ message: 'Account unavailable.' });
    res.json(user.savedSearches || []);
  });
  route('post', '', async (req, res) => {
    const { name, query, scope, overdue, trash, pinned } = req.body || {};
    const label = typeof name === 'string' ? name.trim() : '';
    const text = typeof query === 'string' ? query.trim() : null;
    if (!label || label.length > 80 || text === null || (text.length < 2 && (text.length || scope === 'all')) ||
      text.length > 160 || text.split(/\s+/).length > 12 || !scopes.includes(scope) ||
      [overdue, trash, pinned].some(value => typeof value !== 'boolean')) {
      return res.status(400).json({ message: 'Name the search, choose a scope, and use up to 12 search terms.' });
    }
    const search = { id: randomBytes(12).toString('hex'), name: label, query: text, scope,
      overdue: scope === 'tasks' && overdue, trash: ['all', 'documents'].includes(scope) && trash, pinned };
    const result = await User.updateOne({ _id: req.user.userId, 'savedSearches.39': { $exists: false } }, { $push: { savedSearches: search } });
    if (!result.matchedCount) return res.status(409).json({ message: 'You can save up to 40 searches.' });
    res.status(201).json(search);
  });
  route('patch', '/:id', async (req, res) => {
    const { pinned } = req.body || {};
    if (typeof pinned !== 'boolean') return res.status(400).json({ message: 'Choose whether to pin this search.' });
    const result = await User.updateOne({ _id: req.user.userId, 'savedSearches.id': req.params.id },
      { $set: { 'savedSearches.$.pinned': pinned } });
    if (!result.matchedCount) return res.status(404).json({ message: 'This saved search is unavailable.' });
    res.json({ pinned });
  });
  route('delete', '/:id', async (req, res) => {
    await User.updateOne({ _id: req.user.userId }, { $pull: { savedSearches: { id: req.params.id } } });
    res.status(204).end();
  });
};
