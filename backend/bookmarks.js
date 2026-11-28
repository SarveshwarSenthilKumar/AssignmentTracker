const validId = value => typeof value === 'string' && /^[a-z\d_-]{1,80}$/i.test(value);

function cleanLibrary(value) {
  if (!value || !Array.isArray(value.bookmarks) || !Array.isArray(value.folders) ||
    value.bookmarks.length > 5000 || value.folders.length > 500 || Buffer.byteLength(JSON.stringify(value)) > 2 * 1024 * 1024) {
    throw new Error('Keep the bookmark library under 2 MB with up to 5,000 bookmarks and 500 folders.');
  }
  const ids = new Set();
  const folderNames = new Set();
  const folders = value.folders.map(folder => {
    const name = typeof folder?.name === 'string' ? folder.name.trim() : '';
    if (!validId(folder?.id) || ['all','quick','suggestions'].includes(folder.id) ||
        ids.has(folder.id) || !name || name.length > 100 || folderNames.has(name.toLowerCase())) throw new Error('Invalid or duplicate bookmark folder.');
    ids.add(folder.id);
    folderNames.add(name.toLowerCase());
    return { id: folder.id, name };
  });
  const folderIds = new Set(ids);
  const urls = new Set();
  const bookmarks = value.bookmarks.map(item => {
    const title = typeof item?.title === 'string' ? item.title.trim() : '';
    const url = typeof item?.url === 'string' ? item.url.trim() : '';
    if (!validId(item?.id) || ids.has(item.id) || !title || title.length > 100 ||
        !url || url.length > 2048 || urls.has(url) || (item.folderId !== '' && !folderIds.has(item.folderId))) {
      throw new Error('Invalid or duplicate bookmark.');
    }
    if (!/^#\/[a-z0-9][^\s]*$/i.test(url)) {
      let address;
      try { address = new URL(url); } catch { throw new Error('Enter a valid bookmark address.'); }
      if (!['http:', 'https:'].includes(address.protocol) || address.username || address.password) {
        throw new Error('Use an HTTP, HTTPS, or platform link.');
      }
    }
    ids.add(item.id);
    urls.add(url);
    return { id: item.id, title, url, folderId: item.folderId };
  });
  return { bookmarks, folders };
}

module.exports = function registerBookmarks(app, auth, User) {
  const path = '/api/account/bookmarks';

  app.get(path, auth, async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try {
      const user = await User.findById(req.user.userId).select('+bookmarkLibrary +bookmarkRevision').lean();
      if (!user) return res.status(404).json({ message: 'Account unavailable.' });
      res.json({ library: user.bookmarkLibrary || { bookmarks: [], folders: [] }, revision: user.bookmarkRevision || 0 });
    } catch {
      res.status(503).json({ message: 'Could not load account bookmarks.' });
    }
  });

  app.put(path, auth, async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    const { revision } = req.body || {};
    if (!Number.isSafeInteger(revision) || revision < 0 || revision === Number.MAX_SAFE_INTEGER) {
      return res.status(400).json({ message: 'Refresh your bookmarks before saving.' });
    }
    let library;
    try { library = cleanLibrary(req.body?.library); }
    catch (error) { return res.status(400).json({ message: error.message }); }
    try {
      const filter = { _id: req.user.userId, ...(revision === 0
        ? { $or: [{ bookmarkRevision: 0 }, { bookmarkRevision: { $exists: false } }] }
        : { bookmarkRevision: revision }) };
      const result = await User.updateOne(filter, { $set: { bookmarkLibrary: library, bookmarkRevision: revision + 1 } });
      if (!result.matchedCount) return res.status(409).json({ message: 'Bookmarks changed on another device. Reload bookmarks and try again.' });
      res.json({ library, revision: revision + 1 });
    } catch {
      res.status(503).json({ message: 'Could not save account bookmarks.' });
    }
  });
};
