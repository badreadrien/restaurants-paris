import { put, list, del } from '@vercel/blob';
import { timingSafeEqual } from 'node:crypto';

// Adrien's own ratings + comments, one blob per restaurant (ratings/<id>.json)
// so a save never overwrites another restaurant's note.
// GET is public (the page displays them); POST requires the edit key.

const PREFIX = 'ratings/';
const MAX_COMMENT = 1000;

// Constant-time key check (avoids leaking the key via response timing).
function keyOk(req) {
  const expected = process.env.EDIT_KEY;
  const given = req.headers['x-edit-key'];
  if (!expected || typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readAll() {
  const out = {};
  try {
    const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
    await Promise.all(blobs.map(async (b) => {
      try {
        const res = await fetch(b.url + '?v=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const id = b.pathname.slice(PREFIX.length).replace(/\.json$/, '');
        if (data && typeof data === 'object') out[id] = data;
      } catch { /* skip unreadable blob */ }
    }));
  } catch { /* no ratings yet */ }
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    return res.status(200).json(await readAll());
  }

  if (req.method === 'POST') {
    // Only the holder of the edit key (Adrien) may write.
    if (!keyOk(req)) {
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

    const path = PREFIX + body.id + '.json';
    let written = null;
    if (rating === 0 && comment === '') {
      const { blobs } = await list({ prefix: path, limit: 1 });
      const hit = blobs.find((b) => b.pathname === path);
      if (hit) await del(hit.url);
    } else {
      written = { rating, comment, updatedAt: new Date().toISOString() };
      await put(path, JSON.stringify(written), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json'
      });
    }

    // Merge the just-made change over the read-back: an overwritten blob can
    // be served stale for ~a minute by the CDN, and the response must reflect
    // the write so the UI never appears to revert a save.
    const ratings = await readAll();
    if (written) ratings[body.id] = written; else delete ratings[body.id];
    return res.status(200).json({ ok: true, ratings });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}
