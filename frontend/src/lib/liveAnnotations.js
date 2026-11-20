const equal = (a, b) => {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every(key => Object.prototype.hasOwnProperty.call(b, key) && equal(a[key], b[key]))
}

export function annotationChanges(base, draft) {
  const before = new Map(base.map(item => [item.id, item]))
  const after = new Map(draft.map(item => [item.id, item]))
  return {
    upserts: draft.filter(item => !equal(item, before.get(item.id))),
    removed: base.filter(item => !after.has(item.id)).map(item => item.id),
    patches: draft.filter(item => before.has(item.id) && !equal(item, before.get(item.id))).map(item => ({
      id: item.id,
      set: Object.fromEntries(Object.entries(item).filter(([key, value]) => key !== 'id' && !equal(value, before.get(item.id)[key]))),
      unset: Object.keys(before.get(item.id)).filter(key => key !== 'id' && !(key in item))
    }))
  }
}

// Reapply only local changes to the newest shared state. Remote additions survive.
export function rebaseAnnotations(base, draft, remote) {
  const { upserts, removed, patches } = annotationChanges(base, draft)
  const edits = new Map(patches.map(patch => [patch.id, patch]))
  const result = new Map(remote.map(item => [item.id, item]))
  removed.forEach(id => result.delete(id))
  upserts.forEach(item => {
    const patch = edits.get(item.id)
    if (patch && result.has(item.id)) {
      const merged = { ...result.get(item.id), ...patch.set }
      patch.unset.forEach(key => delete merged[key])
      result.set(item.id, merged)
    } else result.set(item.id, item)
  })
  return [...result.values()]
}
