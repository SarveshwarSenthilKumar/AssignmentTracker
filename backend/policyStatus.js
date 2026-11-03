// Policy verification is best effort. Unknown is distinct from confirmed missing
// agreement, and never writes an acceptance record to the account.
module.exports = function createPolicyStatus({ User, mongoose, termsVersion, privacyVersion }) {
  const cache = new Map(), pending = new Map();
  const remember = (id, result) => {
    const entry = { ...result, checkedAt: Date.now() };
    cache.delete(String(id)); cache.set(String(id), entry);
    if (cache.size > 10000) cache.delete(cache.keys().next().value);
    return entry;
  };
  async function check(userId) {
    const id = String(userId), previous = cache.get(id);
    if (previous && Date.now() - previous.checkedAt < 60000) return previous;
    if (mongoose.connection.readyState !== 1) return previous || null;
    if (!pending.has(id)) {
      const lookup = (async () => {
        let timer;
        try {
          const query = User.findById(id).select('termsAcceptance privacyAcceptance').setOptions({ maxTimeMS: 1500, bufferCommands: false }).lean().exec();
          const result = await Promise.race([
            query.then(account => ({ account })),
            new Promise(resolve => { timer = setTimeout(() => resolve(null), 1500); }),
          ]);
          // An explicit acceptance saved while this read was in flight wins.
          if (cache.get(id) !== previous) return cache.get(id) || null;
          if (!result) return previous || null;
          if (!result.account) return remember(id, { found: false });
          return remember(id, { found: true, current: result.account.termsAcceptance?.version === termsVersion && result.account.privacyAcceptance?.version === privacyVersion });
        } catch { return cache.get(id) || null; }
        finally { clearTimeout(timer); }
      })();
      pending.set(id, lookup);
      void lookup.finally(() => { if (pending.get(id) === lookup) pending.delete(id); });
    }
    return pending.get(id);
  }
  return { check, accepted: id => remember(id, { found: true, current: true }) };
};
