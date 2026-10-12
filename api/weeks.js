const { getIndex } = require('./_store');
module.exports = async (req, res) => {
  try {
    const idx = (await getIndex()).filter(w => w.open !== false);
    idx.sort((a, b) => b.createdAt - a.createdAt);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ weeks: idx });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
