/* Auth API (all POST bodies are JSON):
     POST /api/auth/register {email, password}  allowed emails only; sends a verification link
     GET  /api/auth/verify?token=…              confirms the email, logs in, redirects to the course
     POST /api/auth/login    {email, password}
     POST /api/auth/forgot   {email}            sends a password reset link
     POST /api/auth/reset    {token, password}
     POST /api/auth/logout
     GET  /api/auth/me                           {email} or 401
   Register/forgot answer the same way whether or not the email is known, so the student list can't be probed. */
import { now, normEmail, validEmail, randomToken, sha256, hashPassword, sameString,
  getCookie, SESSION_COOKIE, sessionCookie, currentUser, createSession } from '../../_lib/auth.js';

const LINK_HOURS = { verify: 48, reset: 2 };
const RESEND_GAP = 60e3;          // at most one email per address per minute
const MAX_FAILS = 5, LOCK_MS = 15 * 60e3;
const MIN_PW = 8;

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
const fail = (msg, status = 400) => json({ error: msg }, status);
const SENT = 'Якщо цей email є у списку учасників курсу, ми надіслали на нього лист. Перевірте пошту, зокрема папку «Спам».';

async function body(request) { try { return await request.json(); } catch { return {}; } }

async function sendLink(env, origin, email, kind) {
  const recent = await env.DB.prepare('SELECT MAX(created_at) AS t FROM tokens WHERE email = ? AND kind = ?').bind(email, kind).first();
  if (recent?.t && now() - recent.t < RESEND_GAP) return;
  const token = randomToken();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM tokens WHERE email = ? AND kind = ?').bind(email, kind),
    env.DB.prepare('INSERT INTO tokens (hash, email, kind, expires, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(await sha256(token), email, kind, now() + LINK_HOURS[kind] * 3600e3, now()),
  ]);
  const link = kind === 'verify' ? `${origin}/api/auth/verify?token=${token}` : `${origin}/login#reset=${token}`;
  const [subject, line, cta] = kind === 'verify'
    ? ['Підтвердіть email · Сьорбати Можна', 'Щоб завершити реєстрацію на курсі, підтвердіть свою адресу.', 'Підтвердити email']
    : ['Новий пароль · Сьорбати Можна', 'Ви попросили змінити пароль до курсу. Посилання діє 2 години.', 'Створити новий пароль'];
  const text = `${line}\n\n${cta}: ${link}\n\nЯкщо це були не ви, просто проігноруйте цей лист.\n\nСьорбати Можна · Школа чаю`;
  const html = `<div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:24px;color:#24211F">
<p style="font-size:20px">Сьорбати Можна</p><p>${line}</p>
<p><a href="${link}" style="display:inline-block;padding:12px 22px;border:1px solid #5E6549;border-radius:999px;color:#5E6549;text-decoration:none">${cta}</a></p>
<p style="color:#7A7570;font-size:13px">Якщо кнопка не працює, відкрийте посилання:<br>${link}</p>
<p style="color:#7A7570;font-size:13px">Якщо це були не ви, просто проігноруйте цей лист.</p></div>`;
  if (!env.CF_EMAIL_TOKEN) { console.log(`[auth] ${kind} link for ${email}: ${link}`); return; }
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/email/sending/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CF_EMAIL_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: email, subject, text, html }),
  });
  if (!r.ok) console.error('[auth] email send failed', r.status, await r.text());
}

async function takeToken(env, token, kind) {
  if (!token) return null;
  const hash = await sha256(token);
  const row = await env.DB.prepare('SELECT email, expires FROM tokens WHERE hash = ? AND kind = ?').bind(hash, kind).first();
  if (!row) return null;
  await env.DB.prepare('DELETE FROM tokens WHERE hash = ?').bind(hash).run();
  return row.expires > now() ? row.email : null;
}

const routes = {
  async 'POST register'({ request, env }, origin) {
    const b = await body(request), email = normEmail(b.email), pw = String(b.password || '');
    if (!validEmail(email)) return fail('Перевірте email.');
    if (pw.length < MIN_PW) return fail(`Пароль має бути не коротшим за ${MIN_PW} символів.`);
    const allowed = await env.DB.prepare('SELECT 1 FROM allowed WHERE email = ?').bind(email).first();
    const user = await env.DB.prepare('SELECT verified FROM users WHERE email = ?').bind(email).first();
    if (allowed && !user?.verified) { // a verified account is never overwritten here; use "forgot password"
      const { hash, salt } = await hashPassword(pw);
      await env.DB.prepare(`INSERT INTO users (email, pw_hash, pw_salt, created_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET pw_hash = excluded.pw_hash, pw_salt = excluded.pw_salt`).bind(email, hash, salt, now()).run();
      await sendLink(env, origin, email, 'verify');
    }
    return json({ ok: true, message: SENT });
  },

  async 'GET verify'({ request, env }, origin) {
    const email = await takeToken(env, new URL(request.url).searchParams.get('token'), 'verify');
    if (!email) return Response.redirect(`${origin}/login#expired`, 302);
    await env.DB.prepare('UPDATE users SET verified = 1 WHERE email = ?').bind(email).run();
    return new Response(null, { status: 302, headers: { Location: `${origin}/module.html`, 'Set-Cookie': await createSession(env, email) } });
  },

  async 'POST login'({ request, env }) {
    const b = await body(request), email = normEmail(b.email), pw = String(b.password || '');
    const bad = fail('Невірний email або пароль.', 401);
    const u = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    if (!u) { await hashPassword(pw); return bad; } // same work as a real check
    if (u.locked_until > now()) return fail('Забагато спроб. Спробуйте за 15 хвилин або відновіть пароль.', 429);
    const { hash } = await hashPassword(pw, u.pw_salt);
    if (!sameString(hash, u.pw_hash)) {
      const failed = u.failed + 1;
      await env.DB.prepare('UPDATE users SET failed = ?, locked_until = ? WHERE email = ?')
        .bind(failed >= MAX_FAILS ? 0 : failed, failed >= MAX_FAILS ? now() + LOCK_MS : 0, email).run();
      return bad;
    }
    if (!u.verified) return fail('Спершу підтвердіть email: відкрийте посилання з листа. Щоб отримати лист ще раз, зареєструйтеся повторно.', 403);
    await env.DB.prepare('UPDATE users SET failed = 0, locked_until = 0 WHERE email = ?').bind(email).run();
    return json({ ok: true }, 200, { 'Set-Cookie': await createSession(env, email) });
  },

  async 'POST forgot'({ request, env }, origin) {
    const email = normEmail((await body(request)).email);
    if (!validEmail(email)) return fail('Перевірте email.');
    const u = await env.DB.prepare('SELECT verified FROM users WHERE email = ?').bind(email).first();
    if (u?.verified) await sendLink(env, origin, email, 'reset');
    return json({ ok: true, message: SENT });
  },

  async 'POST reset'({ request, env }) {
    const b = await body(request), pw = String(b.password || '');
    if (pw.length < MIN_PW) return fail(`Пароль має бути не коротшим за ${MIN_PW} символів.`);
    const email = await takeToken(env, b.token, 'reset');
    if (!email) return fail('Посилання застаріло або вже використане. Попросіть новий лист.');
    const { hash, salt } = await hashPassword(pw);
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET pw_hash = ?, pw_salt = ?, failed = 0, locked_until = 0 WHERE email = ?').bind(hash, salt, email),
      env.DB.prepare('DELETE FROM sessions WHERE email = ?').bind(email), // log out everywhere else
    ]);
    return json({ ok: true }, 200, { 'Set-Cookie': await createSession(env, email) });
  },

  async 'POST logout'({ request, env }) {
    const t = getCookie(request, SESSION_COOKIE);
    if (t) await env.DB.prepare('DELETE FROM sessions WHERE hash = ?').bind(await sha256(t)).run();
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
  },

  async 'GET me'({ request, env }) {
    const email = await currentUser(request, env);
    return email ? json({ email }) : fail('auth', 401);
  },
};

export async function onRequest(ctx) {
  const { request, params } = ctx;
  const url = new URL(request.url);
  const route = routes[`${request.method} ${(params.route || []).join('/')}`];
  if (!route) return fail('Not found', 404);
  // CSRF: state-changing calls must come from our own pages
  if (request.method === 'POST' && request.headers.get('Origin') !== url.origin) return fail('Bad origin', 403);
  try { return await route(ctx, url.origin); }
  catch (e) { console.error('[auth]', e); return fail('Щось пішло не так. Спробуйте ще раз.', 500); }
}
