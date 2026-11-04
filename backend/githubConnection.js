const { randomBytes, createCipheriv, createDecipheriv, hkdfSync } = require('node:crypto');
function key() {
  if (!process.env.JWT_SECRET) throw new Error('Account encryption is unavailable.');
  return Buffer.from(hkdfSync('sha256', process.env.JWT_SECRET, 'AssignmentTracker', 'github-token-v1', 32));
}
function encrypt(token, user) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(String(user)));
  const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}
function decrypt(value, user) {
  const [iv, tag, data] = value.split(':'), cipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  cipher.setAAD(Buffer.from(String(user))); cipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([cipher.update(Buffer.from(data, 'base64')), cipher.final()]).toString('utf8');
}
async function github(path, token) {
  const response = await fetch(`https://api.github.com${path}`, { redirect: 'error', signal: AbortSignal.timeout(20000), headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'AssignmentTracker', 'X-GitHub-Api-Version': '2022-11-28' } });
  if (!response.ok) {
    const error = new Error(response.status === 401 ? 'GitHub rejected the token. Replace an expired or revoked token.' : response.status === 403 || response.status === 429 ? 'GitHub denied access or reached a rate limit. Check token permissions, organization approval, and try again later.' : response.status === 404 ? 'Repository or file not found, or this token cannot access it.' : 'GitHub could not complete this request. Try again.');
    error.status = [401, 403, 404, 429].includes(response.status) ? response.status : 502;
    throw error;
  }
  const text = await response.text();
  if (text.length > 4000000) throw new Error('GitHub response is too large to preview. Open it on GitHub instead.');
  return JSON.parse(text);
}
module.exports = (app, auth, { User }) => {
  const root = '/api/account/connections/github';
  app.use(root, (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const active = new Set();
  app.put(`${root}/token`, auth, async (req, res) => {
    const user = String(req.user.userId), token = typeof req.body.token === 'string' ? req.body.token.trim() : '';
    if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,240}$/.test(token)) return res.status(400).json({ message: 'Enter a GitHub fine-grained personal access token (github_pat_…) or classic token (ghp_…).' });
    if (active.has(user)) return res.status(409).json({ message: 'Wait for the current GitHub connection attempt to finish.' });
    active.add(user);
    try {
      const account = await User.findByIdAndUpdate(user, { $inc: { 'socialConnectionVersions.github': 1 } }, { new: true }).select('socialConnectionVersions').lean();
      if (!account) return res.status(404).json({ message: 'Account not found.' });
      const profile = await github('/user', token);
      if (!Number.isSafeInteger(profile.id) || typeof profile.login !== 'string' || !/^[\w-]+$/.test(profile.login)) throw new Error('GitHub returned an invalid profile.');
      const connection = { providerId: String(profile.id), username: profile.login, name: String(profile.name || profile.login).slice(0, 200), profileUrl: `https://github.com/${profile.login}`, connectedAt: new Date(), mode: 'token' };
      const result = await User.updateOne({ _id: user, 'socialConnectionVersions.github': account.socialConnectionVersions.github }, { $set: { 'socialConnections.github': connection, githubTokenEncrypted: encrypt(token, user) } });
      if (!result.matchedCount) return res.status(409).json({ message: 'This connection was changed or disconnected. Try again.' });
      res.json({ connected: true, ...connection });
    } catch (error) { res.status(error.status || 502).json({ message: error.status ? error.message : 'Could not connect GitHub. Check the token and try again.' }); }
    finally { active.delete(user); }
  });
  const access = async req => {
    const user = await User.findById(req.user.userId).select('+githubTokenEncrypted').lean();
    if (!user?.githubTokenEncrypted) { const error = new Error('Connect a GitHub token in Account first.'); error.status = 409; throw error; }
    try { return decrypt(user.githubTokenEncrypted, req.user.userId); }
    catch { const error = new Error('The saved GitHub token cannot be decrypted. Reconnect with a new token.'); error.status = 409; throw error; }
  };
  app.get(`${root}/repos`, auth, async (req, res) => {
    const page = Number(req.query.page || 1);
    if (!Number.isInteger(page) || page < 1 || page > 1000) return res.status(400).json({ message: 'Choose a valid repository page.' });
    try {
      const data = await github(`/user/repos?per_page=50&page=${page}&sort=updated&direction=desc`, await access(req));
      if (!Array.isArray(data)) throw new Error('Invalid repositories');
      res.json({ page, hasMore: data.length === 50, repositories: data.map(repo => ({ id: repo.id, name: repo.name, owner: repo.owner?.login, fullName: repo.full_name, private: !!repo.private, description: String(repo.description || '').slice(0, 1000), url: `https://github.com/${encodeURIComponent(repo.owner?.login)}/${encodeURIComponent(repo.name)}`, defaultBranch: repo.default_branch })) });
    } catch (error) { res.status(error.status || 502).json({ message: error.status ? error.message : 'Could not load GitHub repositories. Try again.' }); }
  });
  app.get(`${root}/contents`, auth, async (req, res) => {
    const { owner, repo, path = '', ref = '' } = req.query;
    if (typeof owner !== 'string' || !/^[\w-]{1,100}$/.test(owner) || typeof repo !== 'string' || !/^[\w.-]{1,100}$/.test(repo) || typeof path !== 'string' || path.length > 2000 || path.split('/').some(part => part === '.' || part === '..') || typeof ref !== 'string' || ref.length > 250) return res.status(400).json({ message: 'Choose a valid repository file.' });
    try {
      const endpoint = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;
      const data = await github(endpoint, await access(req));
      if (Array.isArray(data)) return res.json({ type: 'directory', entries: data.map(item => ({ name: item.name, path: item.path, type: item.type, size: item.size })) });
      if (data.type !== 'file' || data.encoding !== 'base64' || data.size > 262144 || typeof data.content !== 'string') return res.json({ type: 'unavailable', message: 'Open this item on GitHub. Inline previews support text files up to 256 KB.' });
      const bytes = Buffer.from(data.content, 'base64');
      if (bytes.includes(0)) return res.json({ type: 'unavailable', message: 'Binary files are not previewed. Open this file on GitHub.' });
      res.json({ type: 'file', content: bytes.toString('utf8') });
    } catch (error) { res.status(error.status || 502).json({ message: error.status ? error.message : 'Could not read the repository file. Try again.' }); }
  });
};
