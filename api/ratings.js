import { put, list } from '@vercel/blob';

const BLOB_PATH = 'ratings.json';
const MAX_COMMENT = 1000;

async function readAll() {
  try {
    const { blobs } = await list({ prefix: BLOB_PATH, limit: 1 });
    if (!blobs || blobs.length === 0) return {};
    const res = await fetch(blobs[0].url);
    if (!res.ok) return {};
    const data = await res.json();
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    return res.status(200).json(await readAll());
  }

  if (req.method === 'POST') {
    // Only the holder of the edit key (Adrien) may write.
    if (!process.env.EDIT_KEY || req.headers['x-edit-key'] !== process.env.EDIT_KEY) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = null; }
    }
    if (!body || typeof body.id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(body.id)) {
      return res.status(400).json({ error: 'bad id' });
    }
    const rating = Number.isInteger(body.rating) ? body.rating : NaN;
    if (!(rating >= 0 && rating <= 5)) {
      return res.status(400).json({ error: 'bad rating' });
    }
    const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, MAX_COMMENT) : '';

    const all = await readAll();
    if (rating === 0 && comment === '') {
      delete all[body.id];
    } else {
      all[body.id] = { rating, comment, updatedAt: new Date().toISOString() };
    }

    await put(BLOB_PATH, JSON.stringify(all), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json'
    });

    return res.status(200).json({ ok: true, ratings: all });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}
