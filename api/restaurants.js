import { put, list, del } from '@vercel/blob';

// The restaurant list lives server-side (Vercel Blob), not in the code.
// One blob per restaurant (restaurants/<id>.json): writes never touch other
// records, so concurrent writes can't clobber each other.
// GET is public (the page renders from it). Writes require the edit key.

const PREFIX = 'restaurants/';

async function readAll() {
  try {
    const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
    const items = await Promise.all(blobs.map(async (b) => {
      try {
        const res = await fetch(b.url + '?v=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return null;
        return await res.json();
      } catch { return null; }
    }));
    return items
      .filter((r) => r && typeof r.id === 'string')
      .sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

async function putRecord(r, position) {
  const record = { ...r, position: typeof position === 'number' ? position : (r.position ?? 999) };
  await put(PREFIX + r.id + '.json', JSON.stringify(record), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json'
  });
  return record;
}

async function deleteById(id) {
  const { blobs } = await list({ prefix: PREFIX + id + '.json', limit: 1 });
  const hit = blobs.find((b) => b.pathname === PREFIX + id + '.json');
  if (hit) await del(hit.url);
}

function validRecord(r) {
  return r && typeof r.id === 'string' && /^[a-z0-9-]{1,64}$/.test(r.id)
    && typeof r.name === 'string' && r.name.length > 0 && r.name.length <= 200;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    return res.status(200).json(await readAll());
  }

  if (req.method === 'POST') {
    if (!process.env.EDIT_KEY || req.headers['x-edit-key'] !== process.env.EDIT_KEY) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = null; }
    }
    if (!body) return res.status(400).json({ error: 'bad body' });

    // Full replace: POST an array (array order becomes the display order).
    if (Array.isArray(body)) {
      if (!body.every(validRecord)) return res.status(400).json({ error: 'bad record' });
      const existing = await readAll();
      const keep = new Set(body.map((r) => r.id));
      for (const old of existing) {
        if (!keep.has(old.id)) await deleteById(old.id);
      }
      for (let i = 0; i < body.length; i++) await putRecord(body[i], i);
      return res.status(200).json({ ok: true, count: body.length });
    }

    // Append/upsert one record: POST { add: {...} } (keeps its position if it
    // already has one, otherwise goes last).
    if (body.add && validRecord(body.add)) {
      const existing = await readAll();
      const prev = existing.find((r) => r.id === body.add.id);
      const position = prev ? (prev.position ?? existing.length) : existing.length;
      await putRecord(body.add, position);
      return res.status(200).json({ ok: true, count: existing.length + (prev ? 0 : 1) });
    }

    // Remove one record: POST { remove: "<id>" }.
    if (typeof body.remove === 'string') {
      await deleteById(body.remove);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'expected array, {add} or {remove}' });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}
