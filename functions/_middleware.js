/* Gate the course behind login on the hosts listed in AUTH_HOSTS (wrangler.toml); other hosts stay open.
   The home page, login page, auth API and shared assets stay public; lessons, reference pages, PDFs and
   course photos need a session (functions/_lib/auth.js). */
import { currentUser, gated } from './_lib/auth.js';

const PRIVATE = [/^\/module(\.html)?$/, /^\/vydy-chaiu(\.html)?$/, /^\/voda(\.html)?$/,
  /^\/modules\/(?!index\.json$)/, /^\/assets\/.*\.pdf$/, /^\/assets\/img\//];

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  // One canonical host, so the login cookie isn't split between www and the bare domain
  if (url.hostname === 'www.siorbaty-mozhna.com') {
    url.hostname = 'siorbaty-mozhna.com';
    return Response.redirect(url.toString(), 301);
  }
  if (!gated(env, request.url) || !PRIVATE.some(r => r.test(url.pathname))) return next();
  if (await currentUser(request, env)) {
    const res = await next(); // logged-in content must not sit in shared caches
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', 'private, no-store');
    return out;
  }
  if (url.pathname.endsWith('.json') || request.headers.get('Accept')?.includes('application/json'))
    return new Response('{"error":"auth"}', { status: 401, headers: { 'Content-Type': 'application/json' } });
  const back = url.pathname + url.search;
  return Response.redirect(`${url.origin}/login?next=${encodeURIComponent(back)}`, 302);
}
