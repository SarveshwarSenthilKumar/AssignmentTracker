// Merge non-overlapping edits against the exact text each editor started with.
function edit(base, value) {
  let start = 0, end = base.length, tail = value.length;
  while (start < end && start < tail && base[start] === value[start]) start++;
  while (end > start && tail > start && base[end - 1] === value[tail - 1]) { end--; tail--; }
  return { start, end, text: value.slice(start, tail) };
}
function mergeText(base, draft, latest) {
  if (base === latest || draft === latest) return draft;
  if (base === draft) return latest;
  const local = edit(base, draft), remote = edit(base, latest);
  if (local.end <= remote.start) return latest.slice(0, local.start) + local.text + latest.slice(local.end);
  if (local.start >= remote.end) {
    const offset = remote.text.length - (remote.end - remote.start);
    return latest.slice(0, local.start + offset) + local.text + latest.slice(local.end + offset);
  }
  return null;
}
module.exports = { mergeText };
