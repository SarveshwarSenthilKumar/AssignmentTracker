const adminAccess = require('./adminAccess');

module.exports = function registerAccountApproval(app, auth, mongoose) {
  const User = mongoose.models.User;
  const path = '/api/admin/account-approvals';
  const requireAdmin = async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try {
      if (!(await adminAccess(mongoose, req.user.userId)).stats) {
        return res.status(404).json({ message: 'API endpoint not found.' });
      }
      next();
    } catch {
      res.status(503).json({ message: 'Could not verify administrator access.' });
    }
  };
  app.get(path, auth, requireAdmin, async (_req, res) => {
    try {
      const accounts = await User.find({ approvalPending: true }).select('username email createdAt').sort({ _id: 1 }).limit(100).lean();
      res.json({ accounts });
    } catch {
      res.status(503).json({ message: 'Could not load pending accounts.' });
    }
  });
  app.get('/api/admin/accounts', auth, requireAdmin, async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 120) : '';
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      const filter = search ? { $or: [{ username: { $regex: escaped, $options: 'i' } }, { email: { $regex: escaped, $options: 'i' } }] } : {};
      const accounts = await User.find(filter).select('username email deactivatedAt approvalPending').sort({ _id: -1 }).limit(100).lean();
      res.json({ accounts });
    } catch {
      res.status(503).json({ message: 'Could not load accounts.' });
    }
  });
  app.put('/api/admin/accounts/:id/access', auth, requireAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id) || typeof req.body?.active !== 'boolean') {
      return res.status(400).json({ message: 'Choose an account and access setting.' });
    }
    if (String(req.params.id) === String(req.user.userId)) return res.status(400).json({ message: 'You cannot deactivate your own account.' });
    try {
      const account = await User.findByIdAndUpdate(req.params.id, { $set: {
        deactivatedAt: req.body.active ? null : new Date(),
        deactivatedBy: req.body.active ? null : req.user.userId
      } }, { new: true }).select('username email deactivatedAt approvalPending').lean();
      if (!account) return res.status(404).json({ message: 'Account not found.' });
      res.json(account);
    } catch {
      res.status(503).json({ message: 'Could not update account access.' });
    }
  });
  app.post(`${path}/:id/approve`, auth, requireAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid account ID.' });
    try {
      const result = await User.updateOne({ _id: req.params.id, approvalPending: true }, {
        $set: { approvalPending: false, approvedAt: new Date(), approvedBy: req.user.userId }
      });
      if (!result.matchedCount) return res.status(404).json({ message: 'This account is no longer awaiting approval.' });
      res.status(204).end();
    } catch {
      res.status(503).json({ message: 'Could not approve this account.' });
    }
  });
};
