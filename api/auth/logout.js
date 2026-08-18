import { clearCookie } from '../_lib.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  clearCookie(res);
  return res.status(200).json({ ok: true });
}
