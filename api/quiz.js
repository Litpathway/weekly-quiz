const { getIndex, getWeek } = require('./_store');
const applyHeaders = require('./_headers');

function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Returns questions WITHOUT answers or explanations.
module.exports = async (req, res) => {
  applyHeaders(res);
  res.setHeader('X-Robots-Tag', 'noindex');
  try {
    const { week, course } = req.query || {};
    const m = (await getIndex()).find(w => w.id === week);
    if (!m)               return res.status(404).json({ error: 'Week not found' });
    if (m.open === false) return res.status(403).json({ error: 'This week is closed' });
    const w = await getWeek(week);
    const c = w && w.courses.find(c => c.id === course);
    if (!c) return res.status(404).json({ error: 'Quiz not found' });
    res.status(200).json({
      week:    { id: w.id, label: w.label },
      course:  { id: c.id, code: c.code, title: c.title, color: c.color, timePerQ: c.timePerQ },
      questions: c.questions.map((q, i) => ({ i, q: q.q, opts: shuffle(q.opts) })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
