import { OAuth2Client } from 'google-auth-library';
import { signSession, setSessionCookie } from '../_lib.js';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const DOMAIN = (process.env.ALLOWED_DOMAIN || 'hit-pay.com').toLowerCase();
const client = new OAuth2Client(CLIENT_ID);

function readBody(req) {
  return new Promise((resolve) => {
    let d = ''; req.on('data', (c) => { d += c; }); req.on('end', () => resolve(d)); req.on('error', () => resolve(''));
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  try {
    const raw = await readBody(req);
    let body; try { body = JSON.parse(raw); } catch (e) { return res.status(400).json({ error: 'bad json' }); }
    const credential = body && body.credential;
    if (!credential) return res.status(400).json({ error: 'no credential' });
    const ticket = await client.verifyIdToken({ idToken: credential, audience: CLIENT_ID });
    const p = ticket.getPayload();
    const email = (p.email || '').toLowerCase();
    if (!p.email_verified || !email.endsWith('@' + DOMAIN)) {
      return res.status(403).json({ error: 'Only @' + DOMAIN + ' accounts can access this.' });
    }
    const now = Math.floor(Date.now() / 1000);
    const token = signSession({ email: email, name: p.name || email, exp: now + 7 * 24 * 3600 });
    setSessionCookie(res, token);
    return res.status(200).json({ ok: true, email: email, name: p.name || email });
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
}
