const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parse } = require('dotenv');

const [, , argument, ...extra] = process.argv;
const email = argument?.trim().toLowerCase();
const key = 'ADMIN_PORTAL_EDITOR_EMAILS';
const envPath = resolve(__dirname, '..', '.env');

if (!email || email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z0-9-]+$/i.test(email) || extra.length) {
  console.error('Usage: node backend/scripts/add-admin.js name@example.com');
  process.exitCode = 1;
} else {
  try {
    let source;
    try { source = readFileSync(envPath, 'utf8'); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      source = '';
    }
    const match = /^(?:export\s+)?ADMIN_PORTAL_EDITOR_EMAILS[ \t]*=[^\r\n]*/gm;
    const entries = [...source.matchAll(match)];
    const configured = parse(source)[key] || '';
    if (entries.length > 1 || /[\r\n]/.test(configured) || (configured && !entries.length)) {
      throw new Error('Use a single-line admin email list in backend/.env before running this script.');
    }
    const admins = configured.split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
    if (admins.includes(email)) {
      console.log('That email is already on the local admin list.');
    } else {
      const line = `${key}="${[...admins, email].join(',')}"`;
      const newline = source.includes('\r\n') ? '\r\n' : '\n';
      const output = entries.length
        ? source.slice(0, entries[0].index) + line + source.slice(entries[0].index + entries[0][0].length)
        : source + (source && !source.endsWith('\n') ? newline : '') + line + newline;
      writeFileSync(envPath, output, { encoding: 'utf8', mode: 0o600 });
      console.log('Admin email added to backend/.env. Restart the backend to apply it.');
    }
  } catch (error) {
    console.error(error.code ? 'Could not update backend/.env.' : error.message);
    process.exitCode = 1;
  }
}
