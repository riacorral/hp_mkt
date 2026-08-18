import { put, list, del } from '@vercel/blob';
import { sessionFrom } from './_lib.js';

const PREFIX = 'state-';

// Read the newest state blob. Each write is a NEW object (unique URL), so the
// CDN never serves a stale overwrite — the newest URL is always fresh.
async function readState() {
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
  if (!blobs.length) return null;
  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  const newest = blobs[0];
  const r = await fetch(newest.url, { cache: 'no-store' });
  if (!r.ok) return null;
  try { return await r.json(); } catch (e) { return null; }
}

async function writeState(state) {
  const name = PREFIX + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.json';
  await put(name, JSON.stringify(state), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  });
  // prune older versions occasionally (list+del are metered "advanced" ops, so don't do this every write)
  if (Math.random() < 0.15) {
    try {
      const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
      blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      const stale = blobs.slice(4);
      if (stale.length) await del(stale.map((b) => b.url));
    } catch (e) { /* pruning is best-effort */ }
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; });
    req.on('end', () => resolve(d));
    req.on('error', () => resolve(''));
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!sessionFrom(req)) return res.status(401).json({ error: 'unauthorized' });
  try {
    if (req.method === 'GET') {
      const st = await readState();
      if (!st) return res.status(200).json({ empty: true, rev: 0 });
      return res.status(200).json(st);
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      const raw = await readBody(req);
      let body;
      try { body = JSON.parse(raw); } catch (e) { return res.status(400).json({ error: 'bad json' }); }
      if (!body || typeof body !== 'object') return res.status(400).json({ error: 'bad body' });
      const prev = await readState();
      const rev = ((prev && typeof prev.rev === 'number') ? prev.rev : 0) + 1;
      const state = {
        items: Array.isArray(body.items) ? body.items : [],
        merch: Array.isArray(body.merch) ? body.merch : [],
        bugs: Array.isArray(body.bugs) ? body.bugs : [],
        rev,
        updatedAt: new Date().toISOString(),
      };
      await writeState(state);
      return res.status(200).json({ ok: true, rev });
    }
    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
