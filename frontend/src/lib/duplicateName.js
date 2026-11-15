const nameKey = name => String(name ?? '').trim().normalize('NFC').toLowerCase()
const folderKey = folder => String(folder?._id || folder || '')

export function hasDuplicateName(items, name, folderField, folderId, excludeId) {
  const key = nameKey(name)
  return !!key && items.some(item =>
    !item.deletedAt && item._id !== excludeId &&
    folderKey(item[folderField]) === folderKey(folderId) && nameKey(item.name) === key
  )
}
