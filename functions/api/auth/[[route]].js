/* Auth API (all POST bodies are JSON):
     POST /api/auth/register {email, password}  allowed emails only; sends a verification link
     GET  /api/auth/verify?token=…              confirms the email, logs in, redirects to the course
     POST /api/auth/login    {email, password}
     POST /api/auth/forgot   {email}            sends a password reset link
     POST /api/auth/reset    {token, password}
     POST /api/auth/logout
     GET  /api/auth/me                           {email} or 401
   Register/forgot answer the same way whether or not the email is known, so the student list can't be probed. */
import { gated, now, normEmail, validEmail, randomToken, sha256, hashPassword, sameString,
  getCookie, SESSION_COOKIE, sessionCookie, currentUser, createSession } from '../../_lib/auth.js';
import { sendEmail, emailLayout } from '../../_lib/mail.js';

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
  const m = kind === 'verify'
    ? { subject: 'Підтвердіть email · Сьорбати Можна', preheader: 'Один клік, і реєстрацію на курсі завершено.',
        title: 'Підтвердіть <em>email</em>', body: 'Щоб завершити реєстрацію на курсі «Сьорбати Можна», підтвердіть свою адресу.',
        cta: 'Підтвердити email', note: 'Посилання діє 48 годин. Якщо ви не реєструвалися, просто проігноруйте цей лист.' }
    : { subject: 'Новий пароль · Сьорбати Можна', preheader: 'Посилання для зміни пароля діє 2 години.',
        title: 'Новий <em>пароль</em>', body: 'Ви попросили змінити пароль до курсу. Натисніть кнопку і придумайте новий.',
        cta: 'Створити новий пароль', note: 'Посилання діє 2 години. Якщо це були не ви, просто проігноруйте лист: пароль не зміниться.' };
  const { subject } = m;
  const text = `${m.body}\n\n${m.cta}:\n${link}\n\n${m.note}\n\n—\nСьорбати Можна · Школа чаю`;
  const html = emailLayout({ ...m, link });
  await sendEmail(env, { to: email, subject, text, html }, `${kind} link: ${link}`);
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
  if (!route || !gated(ctx.env, request.url)) return fail('Not found', 404);
  // CSRF: state-changing calls must come from our own pages
  if (request.method === 'POST' && request.headers.get('Origin') !== url.origin) return fail('Bad origin', 403);
  try { return await route(ctx, url.origin); }
  catch (e) { console.error('[auth]', e); return fail('Щось пішло не так. Спробуйте ще раз.', 500); }
}
