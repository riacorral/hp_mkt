const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const r = await fetch(`${SB_URL}/rest/v1/app_state?id=eq.hitpaymkt&select=data,rev`, {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }, cache: 'no-store',
    });
    const rows = await r.json();
    const d = (rows[0] && rows[0].data) || {};
    res.status(200).json({
      rev: rows[0] && rows[0].rev,
      hasEventsKey: Object.prototype.hasOwnProperty.call(d, 'events'),
      itemsN: (d.items || []).length,
      merchN: (d.merch || []).length,
      eventsN: (d.events || []).length,
      keys: Object.keys(d),
    });
  } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
}
