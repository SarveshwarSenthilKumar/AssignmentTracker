const objectId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const workspaceId = value => typeof value === 'string' && /^[a-z\d_-]{1,80}$/i.test(value);

module.exports = async function validateStudySources(values, user, PDF, previous = []) {
  if (!Array.isArray(values) || values.length > 5) return null;
  const sources = [];
  for (const value of values) {
    if (value?.kind === 'pdf' && objectId(value.documentId) &&
        Number.isInteger(value.page) && value.page >= 1 && value.page <= 10000) {
      sources.push({ kind: 'pdf', documentId: value.documentId.toLowerCase(), page: value.page });
    } else if (value?.kind === 'note' && ['profileId', 'tabId', 'windowId', 'paneId'].every(key => workspaceId(value[key])) &&
        typeof value.section === 'string' && value.section.length <= 500 &&
        Number.isInteger(value.occurrence) && value.occurrence >= 0 && value.occurrence <= 3000) {
      const { profileId, tabId, windowId, paneId, section, occurrence } = value;
      sources.push({ kind: 'note', profileId, tabId, windowId, paneId, section, occurrence });
    } else return null;
  }
  const keys = new Set(sources.map(source => JSON.stringify(source)));
  if (keys.size !== sources.length) return null;
  const previousPages = new Set(previous.filter(source => source.kind === 'pdf').map(source => source.documentId + ':' + source.page));
  const ids = [...new Set(sources.filter(source => source.kind === 'pdf' && !previousPages.has(source.documentId + ':' + source.page))
    .map(source => source.documentId))];
  if (ids.length && await PDF.countDocuments({
    _id: { $in: ids }, user, deletedAt: null, documentKind: { $ne: 'whiteboard' },
    $or: [{ mimeType: 'application/pdf' }, { originalName: /\.pdf$/i }],
  }) !== ids.length) return null;
  return sources;
};
