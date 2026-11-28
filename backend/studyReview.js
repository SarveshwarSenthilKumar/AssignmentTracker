const day = 24 * 60;
const ratings = ['again', 'hard', 'good', 'easy'];

function nextReview(previous, rating, now) {
  const last = previous?.intervalMinutes || 0;
  let intervalMinutes;
  switch (rating) {
    case 'again': intervalMinutes = 10; break;
    case 'hard': intervalMinutes = Math.max(day, Math.round(last * 1.2)); break;
    case 'good': intervalMinutes = Math.max(2 * day, Math.round(last * 2)); break;
    case 'easy': intervalMinutes = Math.max(3 * day, Math.round(last * 3)); break;
  }
  intervalMinutes = Math.min(180 * day, intervalMinutes);
  return {
    intervalMinutes, rating, count: (previous?.count || 0) + 1,
    dueAt: new Date(now.getTime() + intervalMinutes * 60000),
  };
}

module.exports = { ratings, nextReview };
