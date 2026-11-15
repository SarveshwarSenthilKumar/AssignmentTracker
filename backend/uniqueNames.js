const nameKey = name => String(name ?? '').trim().normalize('NFC').toLowerCase();
const sameFolder = (left, right) => String(left ?? '') === String(right ?? '');

class DuplicateNameError extends Error {}

function checkNames(existing, incoming, folderField, label) {
  const occupied = new Set(existing.map(item => JSON.stringify([String(item[folderField] ?? ''), nameKey(item.name)])));
  for (const item of incoming) {
    const key = JSON.stringify([String(item[folderField] ?? ''), nameKey(item.name)]);
    if (occupied.has(key)) throw new DuplicateNameError(`A ${label} named “${item.name}” already exists in the destination folder.`);
    occupied.add(key);
  }
}

module.exports = { nameKey, sameFolder, checkNames, DuplicateNameError };
