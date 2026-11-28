const { createHash } = require('node:crypto');
const { unexpired } = require('./shareLinkExpiry');

const hashToken = token => createHash('sha256').update(token).digest('hex');
const linkFields = '+shareLinkHash +shareLinkSecret +shareLinkRole +shareLinkExpiresAt +shareLinkMessage +audienceLinks';

function findLink(file, hash) {
  if (file.shareLinkHash && file.shareLinkHash === hash) return {
    hash, secret: file.shareLinkSecret, role: file.shareLinkRole || 'view', expiresAt: file.shareLinkExpiresAt,
    message: file.shareLinkMessage, legacy: true,
  };
  return file.audienceLinks?.find(link => link.hash === hash);
}

function linkFilter(hash, { edit = false, active = true } = {}) {
  const legacy = { shareLinkHash: hash, ...(edit && { shareLinkRole: 'edit' }), ...(active && unexpired()) };
  const audience = { hash, ...(edit && { role: 'edit' }) };
  if (active) audience.$or = [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }];
  return { $or: [legacy, { audienceLinks: { $elemMatch: audience } }] };
}

const linkExpired = link => !!link?.expiresAt && new Date(link.expiresAt).getTime() <= Date.now();

module.exports = { hashToken, linkFields, findLink, linkFilter, linkExpired };
