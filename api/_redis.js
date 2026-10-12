const URL_  = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

async function redis(cmd) {
  if (!URL_ || !TOKEN) {
    throw new Error('Database not connected. Add an Upstash Redis store to this Vercel project.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(URL_, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
      signal: controller.signal,
    });
    const j = await r.json();
    if (j.error) throw new Error('Database error: ' + j.error);
    return j.result;
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error('Database timed out — please try again in a moment.');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { redis };
