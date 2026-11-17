const adminAccess = require('./adminAccess');

module.exports = function registerAccountApproval(app, auth, mongoose) {
  const User = mongoose.models.User;
  const path = '/api/admin/account-approvals';
  const requireAdmin = async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try {
      if (!(await adminAccess(mongoose, req.user.userId)).stats) {
        return res.status(403).json({ message: 'Only full administrators can approve accounts.' });
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
