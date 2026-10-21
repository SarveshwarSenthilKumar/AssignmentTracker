const fs = require('node:fs/promises');
const { existsSync } = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');

exports.registerOneNoteImport = (app, authenticateToken, upload) => {
  const active = new Set();
  app.post('/api/documents/import-onenote', authenticateToken, (req, res) => {
    const user = String(req.user.userId);
    if (active.has(user) || active.size >= 2) return res.status(429).json({ message: 'An import is already running. Please try again shortly.' });
    active.add(user);
    upload.single('pdfFile')(req, res, async uploadError => {
      let temp;
      try {
        if (uploadError) return res.status(400).json({ message: 'Choose a .onepkg file no larger than 10 MB.' });
        if (!req.file || !/\.onepkg$/i.test(req.file.originalname)) return res.status(400).json({ message: 'Choose a OneNote .onepkg file.' });
        temp = await fs.mkdtemp(path.join(os.tmpdir(), 'assignmenttracker-onenote-'));
        const source = path.join(temp, 'notebook.onepkg');
        await fs.writeFile(source, req.file.buffer);
        const local = path.join(__dirname, '.venv-onenote', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
        const python = process.env.ONENOTE_PYTHON || (existsSync(local) ? local : process.platform === 'win32' ? 'python' : 'python3');
        const result = await new Promise((resolve, reject) => {
          execFile(python, [path.join(__dirname, 'scripts/import_onenote.py'), source, path.join(temp, 'extracted')], { timeout: 120000, maxBuffer: 26 * 1024 * 1024, windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }, (error, stdout) => {
            let payload;
            try { payload = JSON.parse(stdout); } catch { /* Handle missing runtime and conversion timeouts below. */ }
            if (error || payload?.error) reject(new Error(payload?.error || (error?.code === 'ENOENT' ? 'Install Python and the OneNote importer using README.md.' : 'OneNote conversion failed or timed out. Try a smaller notebook.')));
            else resolve(payload);
          });
        });
        res.json(result);
      } catch (error) { res.status(422).json({ message: error.message }); }
      finally { active.delete(user); if (temp) await fs.rm(temp, { recursive: true, force: true }).catch(() => {}); }
    });
  });
};
