async function calendarLinksOwned(entry, userId, previous, models) {
  for (const [key, model, extra] of [['taskIds', models.Todo, {}], ['documentIds', models.PDF, { deletedAt: null }]]) {
    const oldIds = new Set((previous[key] || []).map(String));
    const added = (entry[key] || []).filter(id => !oldIds.has(id));
    if (added.length && await model.countDocuments({ _id: { $in: added }, user: userId, ...extra }) !== added.length) return false;
  }
  return true;
}
module.exports = { calendarLinksOwned };
