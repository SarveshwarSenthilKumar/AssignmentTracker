const equal = (a, b) => {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every(key => Object.prototype.hasOwnProperty.call(b, key) && equal(a[key], b[key]))
}

export function annotationChanges(base, draft) {
  const before = new Map(base.map(item => [item.id, item]))
  const upserts=[],patches=[]
  const remaining=new Set(before.keys())
  for(const item of draft){
    const previous=before.get(item.id)
    remaining.delete(item.id)
    if(equal(item,previous))continue
    upserts.push(item)
    if(previous)patches.push({
      id:item.id,
      set:Object.fromEntries(Object.entries(item).filter(([key,value])=>key!=='id'&&!equal(value,previous[key]))),
      unset:Object.keys(previous).filter(key=>key!=='id'&&!(key in item))
    })
  }
  return {upserts,removed:[...remaining],patches}
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
