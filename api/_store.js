const { redis }    = require('./_redis');
const { seedWeek } = require('./_seed');

function meta(w, open = true) {
  return {
    id: w.id, label: w.label, createdAt: w.createdAt, open,
    courses: w.courses.map(c => ({
      id: c.id, code: c.code, title: c.title,
      color: c.color, timePerQ: c.timePerQ, count: c.questions.length,
    })),
  };
}

function safeParse(raw, ctx) {
  try { return JSON.parse(raw); }
  catch { throw new Error(ctx + ' data is corrupted — contact the site admin.'); }
}

async function getIndex() {
  const raw = await redis(['GET', 'quiz:weeks']);
  if (raw) return safeParse(raw, 'Quiz index');
  // First boot: seed a demo week so the home page is never blank.
  const w = seedWeek();
  await redis(['SET', 'quiz:week:' + w.id, JSON.stringify(w)]);
  const idx = [meta(w)];
  await redis(['SET', 'quiz:weeks', JSON.stringify(idx), 'NX']);
  const again = await redis(['GET', 'quiz:weeks']);
  return safeParse(again, 'Quiz index');
}

async function saveIndex(idx)  { await redis(['SET', 'quiz:weeks', JSON.stringify(idx)]); }
async function getWeek(id) {
  const raw = await redis(['GET', 'quiz:week:' + id]);
  return raw ? safeParse(raw, 'Week') : null;
}
async function saveWeek(w)   { await redis(['SET', 'quiz:week:' + w.id, JSON.stringify(w)]); }
async function removeWeek(id){ await redis(['DEL', 'quiz:week:' + id]); }

function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  return b || {};
}

module.exports = { meta, getIndex, saveIndex, getWeek, saveWeek, removeWeek, body };
