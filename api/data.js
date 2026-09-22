import { sessionFrom } from './_lib.js';
import SEED from './_seed.js';

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const ROW_ID = 'hitpaymkt';

function h() {
  return { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };
}

async function readState() {
  const r = await fetch(`${SB_URL}/rest/v1/app_state?id=eq.${ROW_ID}&select=data,rev`, { headers: h(), cache: 'no-store' });
  if (!r.ok) throw new Error('supabase read ' + r.status + ' ' + (await r.text()));
  const rows = await r.json();
  if (!rows.length) return null;
  const d = rows[0].data || {};
  return { items: d.items || [], merch: d.merch || [], bugs: d.bugs || [], events: d.events || [], partners: d.partners || [], content: d.content || [], prospects: d.prospects || [], etEvents: d.etEvents || [], etLeads: d.etLeads || [], rev: rows[0].rev || 0 };
}

async function writeState(state) {
  const body = [{
    id: ROW_ID,
    data: { items: state.items, merch: state.merch, bugs: state.bugs, events: state.events, partners: state.partners, content: state.content, prospects: state.prospects, etEvents: state.etEvents, etLeads: state.etLeads },
    rev: state.rev,
    updated_at: new Date().toISOString(),
  }];
  const r = await fetch(`${SB_URL}/rest/v1/app_state?on_conflict=id`, {
    method: 'POST',
    headers: { ...h(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('supabase write ' + r.status + ' ' + (await r.text()));
}

function readBody(req) {
  return new Promise((resolve) => {
    let d = ''; req.on('data', (c) => { d += c; }); req.on('end', () => resolve(d)); req.on('error', () => resolve(''));
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!sessionFrom(req)) return res.status(401).json({ error: 'unauthorized' });
  if (!SB_URL || !SB_KEY) return res.status(500).json({ error: 'supabase not configured' });
  try {
    if (req.method === 'GET') {
      const st = await readState();
      if (st) return res.status(200).json(st);
      // first run: migrate the backed-up data in
      const seeded = { items: SEED.items || [], merch: SEED.merch || [], bugs: SEED.bugs || [], events: SEED.events || [], partners: SEED.partners || [], content: SEED.content || [], prospects: SEED.prospects || [], etEvents: SEED.etEvents || [], etLeads: SEED.etLeads || [], rev: 1 };
      await writeState(seeded);
      return res.status(200).json(seeded);
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      const raw = await readBody(req);
      let body; try { body = JSON.parse(raw); } catch (e) { return res.status(400).json({ error: 'bad json' }); }
      if (!body || typeof body !== 'object') return res.status(400).json({ error: 'bad body' });
      const prev = await readState();
      const rev = ((prev && typeof prev.rev === 'number') ? prev.rev : 0) + 1;
      // Preserve any collection the client did NOT send, so an older/stale tab
      // (whose payload omits a newer key like `events`) can't blank it for everyone.
      const keep = (key) => Array.isArray(body[key]) ? body[key] : ((prev && Array.isArray(prev[key])) ? prev[key] : []);
      const state = {
        items: keep('items'),
        merch: keep('merch'),
        bugs: keep('bugs'),
        events: keep('events'),
        partners: keep('partners'),
        content: keep('content'),
        prospects: keep('prospects'),
        etEvents: keep('etEvents'),
        etLeads: keep('etLeads'),
        rev,
      };
      await writeState(state);
      return res.status(200).json({ ok: true, rev });
    }
    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
