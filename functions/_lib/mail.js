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

/* Shared look for every email: the site's stone/paper palette, serif headline with one olive italic word,
   amber "pour" line, solid olive button. Table layout + inline styles so Gmail, Apple Mail and Outlook agree;
   the only image is the small public teapot drawing, so nothing breaks when images are blocked.
   Two themes: 'dark' (default, the presentation's steeped-tea palette) and 'light' (the site palette).
   `title` may contain one <em>…</em>, `steps` is an optional numbered list; all strings are our own copy (no user input), except `link`, which we build. */
const SITE = 'https://siorbaty-mozhna.com';   // images must load from the live site, even for mail sent in dev
const THEMES = {
  light: { stone: '#F5F4F0', paper: '#FBFAF7', ink: '#24211F', muted: '#7A7570', accent: '#5E6549', liquor: '#B07A3A',
    line: '#E6E2DA', btnText: '#FBFAF7', glow: '#E9B877', teapot: 'teapot-ink.png', scheme: 'light' },
  // the deck's "steeped tea" dark: warm near-black ground, sage accent, amber liquor
  dark: { stone: '#12110F', paper: '#1C1A17', ink: '#EFEAE2', muted: '#A39D93', accent: '#A6AD8C', liquor: '#D9A160',
    line: '#2E2B26', btnText: '#12110F', glow: '#F1C27D', teapot: 'teapot-ink-light.png', scheme: 'dark' },
};
const SERIF = "'Spectral',Georgia,'Times New Roman',serif";
const SANS = "'Manrope','Segoe UI',Helvetica,Arial,sans-serif";

export function emailLayout({ preheader, title, body, steps = [], cta, link, note }, theme = 'dark') {
  const C = THEMES[theme];
  const h1 = title.replace('<em>', `<em style="font-style:italic;color:${C.accent}">`);
  const plainTitle = title.replace(/<\/?em>/g, '');
  return `<!doctype html>
<html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="${C.scheme} only"><meta name="supported-color-schemes" content="${C.scheme}">
<title>${plainTitle}</title>
<link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,300;1,300&family=Manrope:wght@400;600&display=swap" rel="stylesheet">
<style>@media (max-width:600px){.card{padding:34px 24px!important}.h1{font-size:30px!important}}</style>
</head>
<body style="margin:0;padding:0;background:${C.stone};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}${'&#8199;&#847;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.stone}"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
  <tr><td style="padding:0 6px 18px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="font:600 15px ${SANS};color:${C.ink}">Сьорбати Можна</td>
      <td align="right" style="font:600 11px ${SANS};letter-spacing:3px;color:${C.muted}">ШКОЛА ЧАЮ</td>
    </tr></table>
  </td></tr>
  <tr><td class="card" style="background:${C.paper};border:1px solid ${C.line};border-radius:20px;padding:44px 48px">
    <img src="${SITE}/assets/illustrations/${C.teapot}" width="60" height="57" alt="" style="display:block;border:0;outline:none;opacity:.85">
    <h1 class="h1" style="margin:26px 0 0;font:300 36px/1.15 ${SERIF};color:${C.ink}">${h1}</h1>
    <div style="margin:22px 0 26px;width:120px;height:2px;line-height:2px;font-size:0;border-radius:2px;background:${C.liquor};background-image:linear-gradient(90deg,${C.liquor},${C.glow} 60%,transparent)">&nbsp;</div>
    <p style="margin:0;font:400 16px/1.65 ${SANS};color:${C.ink}">${body}</p>
    ${steps.length ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0">${steps.map((t, i) => `
      <tr><td valign="top" style="padding:0 14px 12px 0;font:600 13px/1.9 ${SANS};color:${C.liquor};letter-spacing:1px">0${i + 1}</td>
      <td valign="top" style="padding:0 0 12px;font:400 15px/1.6 ${SANS};color:${C.ink}">${t}</td></tr>`).join('')}</table>` : ''}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 30px"><tr>
      <td style="background:${C.accent};border-radius:999px">
        <a href="${link}" style="display:inline-block;padding:15px 30px;font:600 16px ${SANS};color:${C.btnText};text-decoration:none;border-radius:999px">${cta}&nbsp;&nbsp;→</a>
      </td>
    </tr></table>
    <p style="margin:0;padding-top:22px;border-top:1px solid ${C.line};font:400 13px/1.6 ${SANS};color:${C.muted}">Якщо кнопка не працює, відкрийте посилання:<br>
      <a href="${link}" style="color:${C.accent};word-break:break-all">${link}</a></p>
    ${note ? `<p style="margin:12px 0 0;font:400 13px/1.6 ${SANS};color:${C.muted}">${note}</p>` : ''}
  </td></tr>
  <tr><td align="center" style="padding:24px 6px 0;font:400 12px/1.7 ${SANS};color:${C.muted}">
    Сьорбати Можна · Школа чаю<br>
    <a href="https://www.instagram.com/siorbaty.mozhna/" style="color:${C.muted}">Instagram @siorbaty.mozhna</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}
