const crypto    = require('crypto');
const { redis } = require('./_redis');
const { getIndex, getWeek, body } = require('./_store');
const applyHeaders = require('./_headers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  applyHeaders(res);
  try {
    // ── Rate limit: 20 submissions per IP per hour ──────────────────────────
    const ip  = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const rlKey = 'ratelimit:submit:' + ip;
    const count = await redis(['INCR', rlKey]);
    if (count === 1) await redis(['EXPIRE', rlKey, 3600]);
    if (count > 20) {
      return res.status(429).json({ error: 'Too many submissions from your network. Please wait an hour and try again.' });
    }

    // ── Validate inputs ─────────────────────────────────────────────────────
    const b       = body(req);
    const name    = String(b.name    || '').trim().replace(/\s+/g, ' ');
    const contact = String(b.contact || '').trim();
    if (name.length < 2 || name.length > 60) return res.status(400).json({ error: 'Please enter your full name' });
    if (contact.length > 80)                 return res.status(400).json({ error: 'Contact is too long' });

    // ── Look up the week/course ─────────────────────────────────────────────
    const m = (await getIndex()).find(w => w.id === b.week);
    if (!m)              return res.status(404).json({ error: 'Week not found' });
    if (m.open === false) return res.status(403).json({ error: 'This week is closed' });
    const w = await getWeek(b.week);
    const c = w && w.courses.find(c => c.id === b.course);
    if (!c) return res.status(404).json({ error: 'Quiz not found' });

    // ── Grade ───────────────────────────────────────────────────────────────
    const given = {};
    for (const a of Array.isArray(b.answers) ? b.answers : []) {
      if (a && Number.isInteger(a.i) && typeof a.a === 'string') given[a.i] = a.a;
    }
    let score = 0;
    const review = c.questions.map((q, i) => {
      const yours = given[i] !== undefined ? given[i] : null;
      const ok    = yours === q.ans;
      if (ok) score++;
      return { q: q.q, yours, correct: q.ans, why: q.why || '', ok };
    });
    const total   = c.questions.length;
    const percent = Math.round((score / total) * 100);
    const seconds = Math.max(0, Math.min(86400, Math.round(Number(b.seconds) || 0)));

    // ── Persist ─────────────────────────────────────────────────────────────
    const key     = [w.id, c.id, name.toLowerCase()].join('|');
    const attempt = await redis(['HINCRBY', 'quiz:attempts', key, 1]);
    const rec = {
      id: crypto.randomBytes(6).toString('hex'),
      week: w.id, weekLabel: w.label, course: c.id, courseTitle: c.title,
      name, contact, score, total, percent, seconds, attempt, at: Date.now(),
    };
    await redis(['RPUSH', 'quiz:results', JSON.stringify(rec)]);
    res.status(200).json({ score, total, percent, attempt, review });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
