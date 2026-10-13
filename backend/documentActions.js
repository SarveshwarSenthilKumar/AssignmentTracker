function documentAction(body) {
  const { action, ids, folderId } = body;
  if (!['move', 'trash', 'restore'].includes(action)) throw new Error('Choose a supported document action.');
  if (!Array.isArray(ids) || !ids.length || ids.length > 500 || ids.some(id => typeof id !== 'string' || !/^[a-f0-9]{24}$/i.test(id))) throw new Error('Select between 1 and 500 valid documents.');
  if (action === 'move' && folderId !== null && (typeof folderId !== 'string' || !/^[a-f0-9]{24}$/i.test(folderId))) throw new Error('Choose a valid destination folder.');
  const now = new Date();
  return { action, ids: [...new Set(ids)], folderId, update: action === 'move' ? { pdfFolder: folderId, updatedAt: now } : { deletedAt: action === 'trash' ? now : null, updatedAt: now } };
}
module.exports = { documentAction };
