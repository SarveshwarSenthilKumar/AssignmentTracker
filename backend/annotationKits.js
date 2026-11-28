const path = '/api/account/annotation-kits';
const color = value => typeof value === 'string' && /^#[a-f\d]{6}$/i.test(value);
const bounded = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const references = new Set(['unit-circle', 'trig-reference']);
const named = (name, max) => typeof name === 'string' && name.trim() && name.trim().length <= max;
const list = (items, limit, validate) => {
  if (!Array.isArray(items) || items.length > limit) throw new Error('This kit contains too many tools.');
  return items.map(validate);
};

function cleanKits(items) {
  const ids = new Set();
  return list(items, 24, kit => {
    if (typeof kit?.id !== 'string' || !/^[a-f\d]{32}$/.test(kit.id) || ids.has(kit.id) || !named(kit.name, 60)) {
      throw new Error('Give each kit a name of up to 60 characters.');
    }
    ids.add(kit.id);
    const brushes = values => list(values, 6, brush => {
      if (!color(brush?.color) || !bounded(brush.width, Number.MIN_VALUE, 10000)) throw new Error('Enter a valid brush color and a positive stroke width up to 10,000 pt.');
      return { color: brush.color, width: brush.width };
    });
    return {
      id: kit.id, name: kit.name.trim(),
      pens: brushes(kit.pens), highlighters: brushes(kit.highlighters),
      notes: list(kit.notes, 6, note => {
        if (!color(note?.background) || !color(note.color) || !bounded(note.fontSize, 6, 144)) throw new Error('Choose valid note colors and a font size from 6 to 144 pt.');
        return { background: note.background, color: note.color, fontSize: note.fontSize };
      }),
      stamps: list(kit.stamps, 12, stamp => {
        if (!named(stamp?.label, 40) || !color(stamp.color)) throw new Error('Enter stamp text of up to 40 characters and choose its color.');
        return { label: stamp.label.trim(), color: stamp.color };
      }),
      references: [...new Set(list(kit.references, 2, reference => {
        if (!references.has(reference)) throw new Error('Choose a supported math reference.');
        return reference;
      }))],
    };
  });
}

module.exports = function registerAnnotationKits(app, auth, User) {
  app.get(path, auth, async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try {
      const user = await User.findById(req.user.userId).select('+annotationKits +annotationKitRevision').lean();
      if (!user) return res.status(404).json({ message: 'Account unavailable.' });
      res.json({ kits: user.annotationKits || [], revision: user.annotationKitRevision || 0 });
    } catch {
      res.status(503).json({ message: 'Could not load annotation kits.' });
    }
  });
  app.put(path, auth, async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    const { revision } = req.body || {};
    if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER) {
      return res.status(400).json({ message: 'Reload your kits before saving.' });
    }
    let kits;
    try { kits = cleanKits(req.body.kits); }
    catch (error) { return res.status(400).json({ message: error.message }); }
    try {
      const filter = { _id: req.user.userId, ...(revision === 0
        ? { $or: [{ annotationKitRevision: 0 }, { annotationKitRevision: { $exists: false } }] }
        : { annotationKitRevision: revision }) };
      const result = await User.updateOne(filter, { $set: { annotationKits: kits, annotationKitRevision: revision + 1 } });
      if (!result.matchedCount) return res.status(409).json({ message: 'Your kits changed elsewhere. Reopen this menu to reload them.' });
      res.json({ kits, revision: revision + 1 });
    } catch {
      res.status(503).json({ message: 'Could not save annotation kits.' });
    }
  });
};
