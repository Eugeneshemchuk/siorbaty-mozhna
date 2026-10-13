/* Sends one email through Resend (secret RESEND_API_KEY, sender MAIL_FROM in wrangler.toml).
   Without the key (local dev) it only logs `note`, so links can be copied from the console. */
export async function sendEmail(env, { to, subject, text, html }, note = subject) {
  if (!env.RESEND_API_KEY) { console.log(`[mail] to ${to}: ${note}`); return true; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to, subject, text, html }),
  });
  if (!r.ok) console.error('[mail] send failed', r.status, await r.text());
  return r.ok;
}
