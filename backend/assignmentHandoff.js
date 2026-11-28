const JSZip = require('jszip');
const { validDay } = require('./calendarEntries');

const validId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const maxArchiveBytes = 10 * 1024 * 1024;
const maxInputBytes = 25 * 1024 * 1024;
const statuses = { todo: 'To Do', 'in-progress': 'In Progress', completed: 'Completed' };

function safeName(value, fallback) {
  return String(value || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').trim().slice(0, 100).replace(/[ .]+$/, '') || fallback;
}

module.exports = function registerAssignmentHandoff(app, auth, { User, Todo, Folder, PDF, isLocked }) {
  app.post('/api/assignment-handoffs/preview', auth, async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    const { title, note = '', taskIds, documentIds } = req.body || {};
    const validSelection = (ids, max) => Array.isArray(ids) && ids.length <= max && ids.every(validId) &&
      new Set(ids.map(id => id.toLowerCase())).size === ids.length;
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 100 ||
        typeof note !== 'string' || note.length > 5000 || !validSelection(taskIds, 50) ||
        !validSelection(documentIds, 20) || (!taskIds.length && !documentIds.length && !note.trim())) {
      return res.status(400).json({ message: 'Enter a title and include a note, up to 50 tasks, or up to 20 files.' });
    }

    try {
      const user = req.user.userId;
      const account = await User.findById(user).select('lockedSections').lean();
      if (!account) return res.status(404).json({ message: 'This account is unavailable.' });
      const locks = new Set(account.lockedSections || []);
      if ((taskIds.length && locks.has('tasks')) || (documentIds.length && locks.has('documents'))) {
        return res.status(403).json({ message: 'Remove the applicable section lock before adding its contents to a handoff.' });
      }

      const tasks = taskIds.length ? await Todo.find({ user, _id: { $in: taskIds } })
        .select('text description status dueDate scheduledDate calendarAllDay calendarDate folder').lean() : [];
      if (tasks.length !== taskIds.length) return res.status(404).json({ message: 'A selected task is no longer available.' });
      if (tasks.some(task => task.folder)) {
        const folders = await Folder.find({ user }).select('parentId').lean();
        const parents = new Map(folders.map(folder => [String(folder._id), folder.parentId]));
        for (const task of tasks) {
          const visited = new Set();
          for (let id = task.folder; id; id = parents.get(String(id))) {
            const key = String(id);
            if (!parents.has(key) || visited.has(key) || locks.has('tasks:' + key)) {
              return res.status(403).json({ message: 'A selected task is in a locked or unavailable folder.' });
            }
            visited.add(key);
          }
        }
      }

      const zip = new JSZip();
      const attachments = [];
      let inputBytes = 0;
      for (const [index, id] of documentIds.entries()) {
        const filter = { _id: id, user, deletedAt: null };
        const file = await PDF.findOne(filter).select('originalName name pdfFolder user').lean();
        if (!file) return res.status(404).json({ message: 'A selected file is no longer available.' });
        if (await isLocked(file)) return res.status(403).json({ message: 'A selected file is locked. Remove its lock before sharing.' });
        const content = await PDF.findOne({ ...filter, pdfFolder: file.pdfFolder ?? null }).select('pdfData');
        if (!content?.pdfData) return res.status(409).json({ message: 'A selected file changed. Preview the handoff again.' });
        inputBytes += content.pdfData.length;
        if (inputBytes > maxInputBytes) return res.status(413).json({ message: 'Select up to 25 MB of source files.' });
        const path = 'files/' + String(index + 1).padStart(2, '0') + '-' + safeName(file.originalName || file.name, 'file');
        zip.file(path, content.pdfData);
        attachments.push({ path, bytes: content.pdfData.length });
      }

      const byId = new Map(tasks.map(task => [String(task._id), task]));
      const lines = [title.trim()];
      if (note.trim()) lines.push('', 'Handoff note', note.trim());
      if (tasks.length) {
        lines.push('', 'Tasks');
        for (const [index, id] of taskIds.entries()) {
          const task = byId.get(id.toLowerCase());
          lines.push('', (index + 1) + '. ' + task.text, 'Status: ' + (statuses[task.status] || 'To Do'));
          if (task.calendarAllDay && validDay(task.calendarDate)) lines.push('Due: ' + task.calendarDate + ' (all day)');
          else if (task.dueDate) lines.push('Due: ' + task.dueDate.toISOString());
          if (validDay(task.scheduledDate)) lines.push('Planned work day: ' + task.scheduledDate);
          if (task.description) lines.push('', task.description);
        }
      }
      if (attachments.length) lines.push('', 'Files', ...attachments.map(file => file.path + ' (' + file.bytes + ' bytes)'));
      const text = lines.join('\n') + '\n';
      if (Buffer.byteLength(text) > 1024 * 1024) return res.status(413).json({ message: 'The handoff text exceeds 1 MB. Select fewer tasks.' });
      zip.file('handoff.txt', text);
      const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      if (archive.length > maxArchiveBytes) return res.status(413).json({ message: 'The ZIP exceeds the 10 MB sharing limit. Remove a file and try again.' });

      res.json({ text, attachments, filename: safeName(title, 'Assignment handoff') + '.zip', zip: archive.toString('base64') });
    } catch {
      res.status(503).json({ message: 'Could not prepare the assignment handoff.' });
    }
  });
};
