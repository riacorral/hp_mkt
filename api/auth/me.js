import { sessionFrom } from '../_lib.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const s = sessionFrom(req);
  if (!s) return res.status(401).json({ error: 'unauthorized' });
  return res.status(200).json({ email: s.email, name: s.name });
}
