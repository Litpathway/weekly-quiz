const crypto    = require('crypto');
const { redis } = require('./_redis');
const { meta, getIndex, saveIndex, getWeek, saveWeek, removeWeek, body } = require('./_store');
const applyHeaders = require('./_headers');

const PALETTE = ['#8a5a3c','#1e5a8c','#b3382c','#17766e','#5b4b9a','#9a6a00','#2f7d32','#ad1457'];

function sha(s) { return crypto.createHash('sha256').update(String(s)).digest(); }
function authed(req) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return 'missing';
  const given = req.headers['x-admin-password'] || '';
  if (!given) return 'bad';          // guard: don't compare against empty string
  return crypto.timingSafeEqual(sha(given), sha(pw)) ? 'ok' : 'bad';
}
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);

function normCourse(c, i, used) {
  const title = String((c && c.title) || '').trim();
  if (!title) throw new Error('Course ' + (i + 1) + ' needs a "title"');
  if (!Array.isArray(c.questions) || !c.questions.length) throw new Error('"' + title + '" has no questions');
  const questions = c.questions.map((x, k) => {
    let q, opts, ans, why;
    if (Array.isArray(x)) { q = x[0]; ans = x[1]; opts = x.slice(1, 5); why = x[5]; }
    else { q = x && x.q; opts = x && x.opts; ans = x && x.ans; why = x && x.why; }
    const where = '"' + title + '" question ' + (k + 1);
    if (typeof q !== 'string' || !q.trim()) throw new Error(where + ' has no question text');
    if (!Array.isArray(opts) || opts.length < 2 || opts.length > 6 || opts.some(o => typeof o !== 'string' || !o.trim()))
      throw new Error(where + ' needs 2 to 6 options');
    if (new Set(opts).size !== opts.length) throw new Error(where + ' has duplicate options');
    if (!opts.includes(ans)) throw new Error(where + ': "ans" must match one option exactly');
    return { q: q.trim(), opts, ans, why: typeof why === 'string' ? why : '' };
  });
  let id = slug(c.id || title) || 'c' + i;
  while (used.has(id)) id += '-' + (i + 1);
  used.add(id);
  return {
    id, title, code: String(c.code || '').trim(),
    color: /^#[0-9a-f]{6}$/i.test(c.color || '') ? c.color : PALETTE[i % PALETTE.length],
    timePerQ: Math.max(10, Math.min(120, Number(c.timePerQ) || 30)),
    questions,
  };
}

module.exports = async (req, res) => {
  applyHeaders(res);
  const a = authed(req);
  if (a === 'missing') return res.status(500).json({ error: 'ADMIN_PASSWORD is not set in Vercel environment variables' });
  if (a !== 'ok')      return res.status(401).json({ error: 'Wrong password' });
  try {
    /* ── GET: load all data ─────────────────────────────────────────── */
    if (req.method === 'GET') {
      const raws   = await redis(['LRANGE', 'quiz:results', 0, -1]);
      const results = raws.map(r => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean).reverse();
      const weeks  = (await getIndex()).sort((x, y) => y.createdAt - x.createdAt);
      return res.status(200).json({ weeks, results });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const b = body(req);

    /* ── createWeek ─────────────────────────────────────────────────── */
    if (b.action === 'createWeek') {
      const label = String(b.label || '').trim();
      if (!label) return res.status(400).json({ error: 'Give the week a label, e.g. "Week 2"' });
      let courses = b.courses;
      if (typeof courses === 'string') { try { courses = JSON.parse(courses); } catch { return res.status(400).json({ error: 'The questions are not valid JSON' }); } }
      if (!Array.isArray(courses) || !courses.length) return res.status(400).json({ error: 'Add at least one course' });
      const used = new Set();
      let w;
      try { w = { id: 'w' + Date.now().toString(36), label, createdAt: Date.now(), courses: courses.map((c, i) => normCourse(c, i, used)) }; }
      catch (e) { return res.status(400).json({ error: e.message }); }
      if (JSON.stringify(w).length > 900000) return res.status(400).json({ error: 'That week is too large. Split it into two weeks.' });
      await saveWeek(w);
      const idx = await getIndex(); idx.push(meta(w)); await saveIndex(idx);
      return res.status(200).json({ ok: true, id: w.id });
    }

    /* ── editWeek (rename label) ────────────────────────────────────── */
    if (b.action === 'editWeek') {
      const label = String(b.label || '').trim();
      if (!label) return res.status(400).json({ error: 'Week label cannot be empty' });
      const idx = await getIndex();
      const m   = idx.find(w => w.id === b.week);
      if (!m)   return res.status(404).json({ error: 'Week not found' });
      m.label = label;
      // Also patch label inside the full week document so quiz pages see the new name.
      const w = await getWeek(b.week);
      if (w) { w.label = label; await saveWeek(w); }
      await saveIndex(idx);
      return res.status(200).json({ ok: true });
    }

    /* ── setOpen ────────────────────────────────────────────────────── */
    if (b.action === 'setOpen') {
      const idx = await getIndex();
      const m   = idx.find(w => w.id === b.week);
      if (!m) return res.status(404).json({ error: 'Week not found' });
      m.open = !!b.open; await saveIndex(idx);
      return res.status(200).json({ ok: true });
    }

    /* ── deleteWeek ─────────────────────────────────────────────────── */
    if (b.action === 'deleteWeek') {
      const idx = (await getIndex()).filter(w => w.id !== b.week);
      await saveIndex(idx); await removeWeek(b.week);
      return res.status(200).json({ ok: true });
    }

    /* ── deleteResult ───────────────────────────────────────────────── */
    if (b.action === 'deleteResult') {
      const id = String(b.id || '').trim();
      if (!id) return res.status(400).json({ error: 'Missing result id' });
      const raws = await redis(['LRANGE', 'quiz:results', 0, -1]);
      const raw  = raws.find(r => { try { return JSON.parse(r).id === id; } catch { return false; } });
      if (raw) await redis(['LREM', 'quiz:results', 1, raw]);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
