import crypto from 'node:crypto';

const COOKIE = 'hpsess';

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function b64urlJSON(o) { return b64url(JSON.stringify(o)); }

export function signSession(payload) {
  const secret = process.env.SESSION_SECRET || '';
  const head = b64urlJSON({ alg: 'HS256', typ: 'JWT' });
  const body = b64urlJSON(payload);
  const data = head + '.' + body;
  const sig = b64url(crypto.createHmac('sha256', secret).update(data).digest());
  return data + '.' + sig;
}

export function verifySession(token) {
  try {
    const secret = process.env.SESSION_SECRET || '';
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const data = parts[0] + '.' + parts[1];
    const expected = b64url(crypto.createHmac('sha256', secret).update(data).digest());
    const a = Buffer.from(expected), b = Buffer.from(parts[2]);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch (e) { return null; }
}

export function getCookie(req, name) {
  const h = req.headers.cookie || '';
  const m = h.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', COOKIE + '=' + encodeURIComponent(token) + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + (7 * 24 * 3600));
}
export function clearCookie(res) {
  res.setHeader('Set-Cookie', COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
}
export function sessionFrom(req) {
  const t = getCookie(req, COOKIE);
  if (!t) return null;
  return verifySession(t);
}
