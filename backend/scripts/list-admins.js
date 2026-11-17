const { resolve } = require('node:path');
const mongoose = require('mongoose');
require('dotenv').config({ path: resolve(__dirname, '..', '.env') });

async function main() {
  const emails = [...new Set((process.env.ADMIN_PORTAL_EDITOR_EMAILS || '')
    .split(',').map(email => email.trim().toLowerCase()).filter(Boolean))].sort();
  if (!emails.length) {
    console.log('No full administrators are configured in ADMIN_PORTAL_EDITOR_EMAILS.');
    return;
  }
  if (!process.env.MONGODB_URI?.trim()) {
    console.error('Set MONGODB_URI to check which configured admins have registered accounts.');
    process.exitCode = 1;
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    const users = await mongoose.connection.collection('users')
      .find({ email: { $in: emails } }, { projection: { _id: 0, email: 1, username: 1, approvalPending: 1 } })
      .toArray();
    const accounts = new Map(users.map(user => [user.email, user]));
    console.table(emails.map(email => {
      const user = accounts.get(email);
      return {
        email,
        username: user?.username || '',
        status: user ? user.approvalPending ? 'Awaiting account approval' : 'Administrator' : 'No registered account'
      };
    }));
  } catch {
    console.error('Could not read the admin list from MongoDB. Check MONGODB_URI and the database network access list.');
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(() => {
  console.error('Could not finish checking administrator accounts.');
  process.exitCode = 1;
});
