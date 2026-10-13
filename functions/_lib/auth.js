/* Auth helpers shared by functions/_middleware.js and functions/api/auth/[[route]].js.
   Passwords: PBKDF2-SHA256 (100k iterations, the Workers maximum). Sessions and email links are random
   tokens; only their SHA-256 is stored, so a leaked database can't be used to log in. */
const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export const SESSION_COOKIE = 'sid';
export const SESSION_DAYS = 30;
export const now = () => Date.now();
export const normEmail = e => String(e || '').trim().toLowerCase();
export const validEmail = e => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function sha256(s) { return b64(await crypto.subtle.digest('SHA-256', enc.encode(s))); }

export async function hashPassword(password, saltB64) {
  const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  return { hash: b64(bits), salt: b64(salt) };
}
export function sameString(a, b) { // constant-time compare
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export function getCookie(request, name) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}
export const sessionCookie = (token, maxAge) =>
  `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

/* Returns the logged-in email or null. */
export async function currentUser(request, env) {
  const t = getCookie(request, SESSION_COOKIE);
  if (!t) return null;
  const row = await env.DB.prepare('SELECT email, expires FROM sessions WHERE hash = ?').bind(await sha256(t)).first();
  return row && row.expires > now() ? row.email : null;
}

export async function createSession(env, email) {
  const t = randomToken();
  await env.DB.prepare('INSERT INTO sessions (hash, email, expires) VALUES (?, ?, ?)')
    .bind(await sha256(t), email, now() + SESSION_DAYS * 864e5).run();
  return sessionCookie(t, SESSION_DAYS * 86400);
}
