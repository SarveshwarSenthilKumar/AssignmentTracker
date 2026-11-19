const bcrypt = require('bcryptjs');

module.exports = function registerChangePassword(app, auth, User) {
  const attempts = new Map();
  app.put('/api/account/password', auth, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 1024 ||
        typeof newPassword !== 'string' || newPassword.length < 8 || !newPassword.trim() ||
        Buffer.byteLength(newPassword, 'utf8') > 72) {
      return res.status(400).json({ message: 'Use a new password with at least 8 characters and at most 72 UTF-8 bytes.' });
    }
    const id = String(req.user.userId);
    let limit = attempts.get(id);
    if (!limit) {
      limit = { count: 0 };
      attempts.set(id, limit);
      setTimeout(() => attempts.delete(id), 60000).unref();
    }
    if (limit.count >= 5) return res.status(429).json({ message: 'Too many attempts. Wait a minute before trying again.' });
    limit.count++;
    try {
      const user = await User.findById(id).select('password');
      if (!user) return res.status(404).json({ message: 'Account not found.' });
      if (!await bcrypt.compare(currentPassword, user.password)) {
        return res.status(403).json({ message: 'Your current password is incorrect.' });
      }
      if (await bcrypt.compare(newPassword, user.password)) {
        return res.status(400).json({ message: 'Choose a different new password.' });
      }
      const password = await bcrypt.hash(newPassword, 12);
      const result = await User.updateOne({ _id: id, password: user.password }, { $set: { password } });
      if (!result.matchedCount) return res.status(409).json({ message: 'Your password changed in another session. Enter the current password and try again.' });
      res.json({ message: 'Password changed. Use your new password the next time you sign in.' });
    } catch {
      res.status(503).json({ message: 'Could not change your password. Try again later.' });
    }
  });
};
