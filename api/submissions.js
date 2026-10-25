import { put, list, del } from '@vercel/blob';

// Queue of "add this restaurant" requests submitted from the site itself.
// One blob per submission (submissions/<id>.json), so creating or updating
// one entry never touches the others. Everything here is private: all
// methods require the edit key. A scheduled job on Adrien's Muse picks
// pending entries up, enriches them (verification, menu / wine-list
// research) and adds them via /api/restaurants.

const PREFIX = 'submissions/';
const MAX_NAME = 120;
const MAX_NOTE = 300;

async function fetchJson(url) {
  const res = await fetch(url + '?v=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

async function readAll() {
  try {
    const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
    const items = await Promise.all(blobs.map(async (b) => {
      try { return await fetchJson(b.url); } catch { return null; }
    }));
    return items
      .filter((e) => e && typeof e.id === 'string')
      .sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)));
  } catch {
    return [];
  }
}

async function readOne(id) {
  const { blobs } = await list({ prefix: PREFIX + id + '.json', limit: 1 });
  const hit = blobs.find((b) => b.pathname === PREFIX + id + '.json');
  if (!hit) return null;
  try { return await fetchJson(hit.url); } catch { return null; }
}

async function writeOne(entry) {
  await put(PREFIX + entry.id + '.json', JSON.stringify(entry), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json'
  });
}

function authorized(req) {
  return !!process.env.EDIT_KEY && req.headers['x-edit-key'] === process.env.EDIT_KEY;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!authorized(req)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }

  if (req.method === 'GET') {
    return res.status(200).json(await readAll());
  }

  if (req.method === 'POST') {
    const name = body && typeof body.name === 'string' ? body.name.trim().slice(0, MAX_NAME) : '';
    if (!name) return res.status(400).json({ error: 'name required' });
    const note = body && typeof body.note === 'string' ? body.note.trim().slice(0, MAX_NOTE) : '';
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name,
      note,
      status: 'pending',
      submittedAt: new Date().toISOString()
    };
    await writeOne(entry);
    return res.status(200).json({ ok: true, entry });
  }

  if (req.method === 'PATCH') {
    const id = body && typeof body.id === 'string' ? body.id : '';
    const status = body && typeof body.status === 'string' ? body.status : '';
    if (!id || !['pending', 'done', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'bad id or status' });
    }
    const entry = await readOne(id);
    if (!entry) return res.status(404).json({ error: 'not found' });
    entry.status = status;
    entry.processedAt = new Date().toISOString();
    if (typeof body.result === 'string') entry.result = body.result.slice(0, MAX_NOTE);
    await writeOne(entry);
    return res.status(200).json({ ok: true, entry });
  }

  if (req.method === 'DELETE') {
    const id = (body && typeof body.id === 'string' && body.id) || (req.query && req.query.id) || '';
    if (!id) return res.status(400).json({ error: 'bad id' });
    const { blobs } = await list({ prefix: PREFIX + id + '.json', limit: 1 });
    const hit = blobs.find((b) => b.pathname === PREFIX + id + '.json');
    if (!hit) return res.status(404).json({ error: 'not found' });
    await del(hit.url);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
}
