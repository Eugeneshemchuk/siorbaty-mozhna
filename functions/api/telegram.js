/* Telegram bot webhook for managing students (same "allowed" list as scripts/students.sh).
     a message with emails, or /add <emails>   allow them to register and email each new one an invite
     /invite <emails>                           resend the invite email
     /remove <emails>                           revoke: deletes the allowance, account and sessions
     /list                                      allowed emails and whether each has registered
   Only Telegram user IDs in TELEGRAM_ADMINS (wrangler.toml) may use it; anyone else is told their ID.
   Telegram proves each call with the secret TELEGRAM_SECRET (set by scripts/telegram-setup.sh).
   Replies go back in the webhook response, so the bot token itself is never stored on the site. */
import { now, normEmail, validEmail, sameString } from '../_lib/auth.js';
import { sendEmail } from '../_lib/mail.js';

const HELP = `Надішліть email (або кілька), щоб додати учнів. Кожен новий отримає лист-запрошення.

/add email… додати
/invite email… надіслати запрошення ще раз
/remove email… видалити доступ і акаунт
/list список учнів`;

const reply = (chat, text) => new Response(JSON.stringify({ method: 'sendMessage', chat_id: chat, text: text.slice(0, 4000) }),
  { headers: { 'Content-Type': 'application/json' } });
const ok = () => new Response('ok');

async function invite(env, origin, email) {
  const link = `${origin}/login#register`;
  const line = 'Вас додано до онлайн-курсу «Сьорбати Можна». Щоб відкрити уроки, зареєструйтеся з цією адресою email і придумайте пароль.';
  const text = `${line}\n\nЗареєструватися: ${link}\n\nЯкщо ви вже зареєстровані, просто увійдіть.\n\nСьорбати Можна · Школа чаю`;
  const html = `<div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:24px;color:#24211F">
<p style="font-size:20px">Сьорбати Можна</p><p>${line}</p>
<p><a href="${link}" style="display:inline-block;padding:12px 22px;border:1px solid #5E6549;border-radius:999px;color:#5E6549;text-decoration:none">Зареєструватися</a></p>
<p style="color:#7A7570;font-size:13px">Якщо кнопка не працює, відкрийте посилання:<br>${link}</p>
<p style="color:#7A7570;font-size:13px">Якщо ви вже зареєстровані, просто увійдіть.</p></div>`;
  return sendEmail(env, { to: email, subject: 'Запрошення на курс · Сьорбати Можна', text, html }, `invite: ${link}`);
}

const commands = {
  async add(env, origin, emails) {
    const out = [];
    for (const e of emails) {
      const r = await env.DB.prepare('INSERT OR IGNORE INTO allowed (email, added_at) VALUES (?, ?)').bind(e, now()).run();
      if (!r.meta.changes) { out.push(`• ${e}: вже в списку`); continue; }
      out.push(`✅ ${e}: додано, ${await invite(env, origin, e) ? 'запрошення надіслано' : 'але лист не надіслався (/invite)'}`);
    }
    return out.join('\n');
  },
  async invite(env, origin, emails) {
    const out = [];
    for (const e of emails) {
      const known = await env.DB.prepare('SELECT 1 FROM allowed WHERE email = ?').bind(e).first();
      out.push(!known ? `• ${e}: не в списку (/add)` : await invite(env, origin, e) ? `✉️ ${e}: запрошення надіслано` : `⚠️ ${e}: лист не надіслався`);
    }
    return out.join('\n');
  },
  async remove(env, origin, emails) {
    const out = [];
    for (const e of emails) {
      const [r] = await env.DB.batch(['allowed', 'users', 'sessions', 'tokens']
        .map(t => env.DB.prepare(`DELETE FROM ${t} WHERE email = ?`).bind(e)));
      out.push(r.meta.changes ? `🗑 ${e}: видалено` : `• ${e}: не було в списку`);
    }
    return out.join('\n');
  },
  async list(env) {
    const { results } = await env.DB.prepare(`SELECT a.email, COALESCE(u.verified, 0) AS reg
      FROM allowed a LEFT JOIN users u USING (email) ORDER BY a.added_at`).all();
    if (!results.length) return 'Список порожній.';
    const done = results.filter(r => r.reg).length;
    return `Учнів: ${results.length}, зареєструвалися: ${done}\n\n` +
      results.map(r => `${r.reg ? '✅' : '⏳'} ${r.email}`).join('\n') + '\n\n✅ зареєструвався · ⏳ ще ні';
  },
};

export async function onRequestPost({ request, env }) {
  if (!env.TELEGRAM_SECRET || !sameString(request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '', env.TELEGRAM_SECRET))
    return new Response('Forbidden', { status: 403 });
  let msg;
  try { msg = (await request.json()).message; } catch { return ok(); }
  if (!msg?.text || msg.chat?.type !== 'private') return ok(); // emails never land in group chats
  const chat = msg.chat.id;
  const admins = String(env.TELEGRAM_ADMINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!admins.includes(String(msg.from?.id)))
    return reply(chat, `Цей бот лише для адміністраторів курсу «Сьорбати Можна».\nВаш Telegram ID: ${msg.from?.id}`);

  const text = msg.text.trim();
  const cmd = text.startsWith('/') ? text.slice(1).split(/[\s@]/)[0].toLowerCase() : 'add';
  const words = text.split(/[\s,;]+/).filter(w => w.includes('@') && !w.startsWith('/'));
  const emails = [...new Set(words.map(w => normEmail(w.replace(/^[<(]+|[>).]+$/g, ''))))];
  const bad = emails.filter(e => !validEmail(e)), good = emails.filter(validEmail);

  try {
    if (cmd === 'list') return reply(chat, await commands.list(env));
    if (!commands[cmd]) return reply(chat, HELP);
    if (!good.length) return reply(chat, bad.length ? `Не схоже на email: ${bad.join(', ')}` : HELP);
    const origin = new URL(request.url).origin;
    let out = await commands[cmd](env, origin, good);
    if (bad.length) out += `\n\nНе схоже на email: ${bad.join(', ')}`;
    return reply(chat, out);
  } catch (err) {
    console.error('[telegram]', err);
    return reply(chat, 'Помилка на сервері, спробуйте ще раз.');
  }
}
