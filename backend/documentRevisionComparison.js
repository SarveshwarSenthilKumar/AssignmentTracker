const revision = ({ id, actor, action, at }) => ({ id, actor, action, at });

function compareRevisions(file, from, to) {
  const history = file.editHistory || [];
  const start = from === 'baseline' ? -1 : history.findIndex(item => item.id === from);
  const end = history.findIndex(item => item.id === to);
  if ((start === -1 && from !== 'baseline') || end < 0) return null;
  if (start >= end) return { invalidOrder: true };

  const changes = history.slice(start + 1, end + 1).map(item => {
    const details = item.details || [];
    const page = item.pageChange;
    const pageOperation = /^(?:Added pages|Deleted a page|Reordered pages)$/.test(item.action);
    const rows = [];
    if (page) {
      const noun = page.count === 1 ? 'page' : 'pages';
      const positions = page.count > 1 ? `${page.to}–${page.to + page.count - 1}` : page.to;
      rows.push({
        group: 'pages', label: item.action, kind: 'value',
        before: page.mode === 'duplicate' ? `Source page ${page.from}` : page.from ? `Page ${page.from}` : 'Not present',
        after: page.to ? `${page.count > 1 ? 'Pages' : 'Page'} ${positions}` : 'Removed',
      });
      if (page.beforeCount !== page.afterCount) rows.push({
        group: 'pages', label: 'Page count', kind: 'value',
        before: `${page.beforeCount} pages`, after: `${page.afterCount} pages`,
      });
      if (page.mode === 'duplicate') rows[0].label = 'Duplicated page';
      if (page.mode === 'blank') rows[0].label = `Inserted blank ${noun}`;
    }
    for (const detail of details) {
      if (page && detail.key === 'operation') continue;
      const group = detail.kind === 'text' || detail.key.startsWith('file:text:') ? 'text'
        : detail.key === 'operation' && pageOperation ? 'pages'
          : detail.key.startsWith('file:') ? 'file' : 'annotations';
      rows.push({ ...detail, group });
    }
    if (!rows.length) rows.push({
      group: pageOperation ? 'pages' : /text/i.test(item.action) ? 'text'
        : /annotations|sticky notes|ink|formatting|inserted media/i.test(item.action) ? 'annotations' : 'file',
      kind: 'note', label: item.action,
      text: item.description || 'This entry contains a summary only.',
    });
    return {
      ...revision(item), rows, pages: item.pages || [],
      partial: !!item.detailsTruncated || (!details.length && !page),
    };
  });

  const candidates = new Map();
  if (!changes.some(change => change.partial)) {
    for (const change of changes) {
      for (const row of change.rows) {
        if (!row.key || row.kind === 'note' || !Object.hasOwn(row, 'before') || !Object.hasOwn(row, 'after') ||
          row.group === 'pages' || row.key.startsWith('file:text:') || row.key.endsWith(':added') || row.key.endsWith(':removed')) continue;
        const candidate = candidates.get(row.key);
        if (!candidate) candidates.set(row.key, { value: { ...row }, continuous: true });
        else {
          candidate.continuous &&= candidate.value.after === row.before && !String(row.before).endsWith('…');
          candidate.value.after = row.after;
          candidate.value.label = row.label;
        }
      }
    }
  }
  const values = [...candidates.values()].filter(candidate => candidate.continuous).map(candidate => candidate.value);
  const compared = new Set(values.map(row => row.key));
  for (const change of changes) change.rows = change.rows.filter(row => !compared.has(row.key));

  return {
    values: values,
    earlier: start < 0 ? { id: 'baseline', action: 'Before the first retained edit' } : revision(history[start]),
    later: revision(history[end]), changes,
  };
}

module.exports = { compareRevisions };
