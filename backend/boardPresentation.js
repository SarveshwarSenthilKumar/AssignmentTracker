const bounded = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const maxStops = 40;

function cleanPresentationStops(value, whiteboard = false) {
  if (!Array.isArray(value) || value.length > maxStops) throw new Error('Save up to 40 presentation stops.');
  const ids = new Set();
  return value.map(stop => {
    const title = typeof stop?.title === 'string' ? stop.title.trim() : '';
    if (!stop || typeof stop.id !== 'string' || !/^[a-f\d]{32}$/.test(stop.id) || ids.has(stop.id) ||
      !title || title.length > 80 || !bounded(stop.zoom, whiteboard ? .25 : .02, whiteboard ? 4 : 3)) {
      throw new Error('Each stop needs a name and a valid zoom.');
    }
    ids.add(stop.id);
    const base = { id: stop.id, title, zoom: stop.zoom };
    if (whiteboard) {
      if (!Number.isInteger(stop.page) || !bounded(stop.page, 1, 10000) ||
        !bounded(stop.u, 0, 1) || !bounded(stop.v, 0, 1) || ![0, 90, 180, 270].includes(stop.rotation)) {
        throw new Error('Select a valid area of the whiteboard.');
      }
      return { ...base, page: stop.page, u: stop.u, v: stop.v, rotation: stop.rotation };
    }
    if (!bounded(stop.x, 0, 2000000) || !bounded(stop.y, 0, 2000000)) throw new Error('Select a valid area of the wall.');
    return { ...base, x: stop.x, y: stop.y };
  });
}

function remapPresentationStops(stops, { mode, from, to, count }) {
  return (stops || []).flatMap(stop => {
    const { page } = stop;
    if (mode === 'delete') return page === from ? [] : [{ ...stop, page: page > from ? page - 1 : page }];
    if (mode === 'reorder') {
      const adjusted = page === from ? to : page > from && page <= to ? page - 1 : page < from && page >= to ? page + 1 : page;
      return [{ ...stop, page: adjusted }];
    }
    return [{ ...stop, page: page >= to ? page + count : page }];
  });
}

const presentationMatch = revision => revision === 0
  ? { $or: [{ presentationRevision: 0 }, { presentationRevision: { $exists: false } }] }
  : { presentationRevision: revision };

module.exports = { cleanPresentationStops, remapPresentationStops, presentationMatch };
