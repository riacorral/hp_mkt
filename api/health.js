import SEED from './_seed.js';

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const H = () => ({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' });

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!SB_URL || !SB_KEY) return res.status(500).json({ ok: false, error: 'supabase env missing', url: !!SB_URL, key: !!SB_KEY });
    let r = await fetch(`${SB_URL}/rest/v1/app_state?id=eq.hitpaymkt&select=data,rev`, { headers: H(), cache: 'no-store' });
    if (!r.ok) return res.status(500).json({ ok: false, step: 'read', status: r.status, body: (await r.text()).slice(0, 300) });
    let rows = await r.json();
    if (!rows.length) {
      const body = [{ id: 'hitpaymkt', data: { items: SEED.items || [], merch: SEED.merch || [], bugs: SEED.bugs || [] }, rev: 1, updated_at: new Date().toISOString() }];
      const w = await fetch(`${SB_URL}/rest/v1/app_state?on_conflict=id`, { method: 'POST', headers: { ...H(), Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(body) });
      if (!w.ok) return res.status(500).json({ ok: false, step: 'seed', status: w.status, body: (await w.text()).slice(0, 300) });
      r = await fetch(`${SB_URL}/rest/v1/app_state?id=eq.hitpaymkt&select=data,rev`, { headers: H(), cache: 'no-store' });
      rows = await r.json();
    }
    const d = (rows[0] && rows[0].data) || {};
    return res.status(200).json({ ok: true, rev: rows[0] && rows[0].rev, items: (d.items || []).length, merch: (d.merch || []).length, bugs: (d.bugs || []).length });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
}
