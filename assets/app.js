/* Tea Study - shared script. Content lives in /modules/*.json and /assets/icons.json. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const store = {
    get(k){ try { return localStorage.getItem('tea:' + k); } catch { return null; } },
    set(k, v){ try { localStorage.setItem('tea:' + k, v); } catch {} }
  };
  const getJSON = p => fetch(p).then(r => { if (!r.ok) throw new Error(p); return r.json(); });
  const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M4 12h15M14 7l5 5-5 5"/></svg>';
  const LEAF = '<svg viewBox="0 0 24 24"><path d="M5 19C5 10.5 10.6 5 19 5c0 8.4-5.5 14-14 14z"/><path d="M5 19 13.8 10.2"/></svg>';
  const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12-7.5z"/></svg>';
  const svgOf = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

  /* ---------- motion: smooth scroll, reveal, parallax ---------- */
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js');
  let lenis = null;
  if (window.Lenis && !reduced) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  const scrollToEl = el => lenis ? lenis.scrollTo(el, { offset: -16, duration: 1.6 }) : el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.06 })
    : null;
  let par = [];
  const parallax = () => {
    const h = innerHeight;
    const narrow = innerWidth <= 900; // single-column layout: moving whole blocks would overlap neighbours
    par.forEach(({ el, s }) => { if (narrow && el.tagName !== 'IMG') { el.style.translate = ''; return; } const r = el.getBoundingClientRect(); if (r.bottom < -200 || r.top > h + 200) return; el.style.translate = `0 ${((r.top + r.height / 2 - h / 2) * -s).toFixed(1)}px`; });
  };
  function animate(scope = document) {
    scope.querySelectorAll('.reveal:not(.in)').forEach(el => {
      const sibs = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
      el.style.setProperty('--d', Math.min(sibs.indexOf(el), 5) * 0.09 + 's');
      if (reduced || !io || el.getBoundingClientRect().top < innerHeight * 0.92) el.classList.add('in'); else io.observe(el);
    });
    if (reduced) return;
    par = [...document.querySelectorAll('.hero .media, .mod-hero .big, .gallery .media>img')]
      .map(el => ({ el, s: el.classList.contains('big') ? 0.14 : el.tagName === 'IMG' ? 0.06 : 0.08 }));
    parallax();
  }
  if (!reduced) lenis ? lenis.on('scroll', parallax) : addEventListener('scroll', parallax, { passive: true });

  const lessonsDone =(id, n) => { let d = 0; for (let i = 0; i < n; i++) if (store.get(`${id}:l${i}`) === '1') d++; return d; };

  /* ---------- media ---------- */
  function videoHTML(url, label) {
    const yt = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
    const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (yt) return `<iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0" title="${esc(label)}" allow="encrypted-media; picture-in-picture; fullscreen" loading="lazy"></iframe>`;
    if (vm) return `<iframe src="https://player.vimeo.com/video/${vm[1]}?dnt=1" title="${esc(label)}" allow="fullscreen; picture-in-picture" loading="lazy"></iframe>`;
    if (/\.(mp4|webm)(\?|$)/i.test(url)) return `<video src="${esc(url)}" controls preload="metadata" playsinline></video>`;
    if (url) return `<a class="play" href="${esc(url)}" target="_blank" rel="noopener" aria-label="Відкрити відео: ${esc(label)}">${PLAY}</a>`;
    return `<span class="play" aria-hidden="true">${PLAY}</span><span class="ph">VIDEO · ${esc(label)} · placeholder</span>`;
  }
  const imgHTML = (img, label) => img.src
    ? `<img src="${esc(img.src)}" alt="${esc(img.caption)}" loading="lazy">`
    : `<span class="ph">IMAGE · ${esc(label)} · placeholder</span>`;

  /* ---------- icons ---------- */
  async function renderIcons(grid) {
    const icons = await getJSON('assets/icons.json');
    icons.forEach(ic => {
      const svg = svgOf(ic.body);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ic'; b.id = 'ic-' + ic.id;
      b.setAttribute('aria-label', 'Скопіювати SVG: ' + ic.name);
      b.innerHTML = svg + `<span>${esc(ic.name)}</span>`;
      const label = $('span', b);
      b.addEventListener('click', () => {
        const done = () => { b.classList.add('done'); label.textContent = 'скопійовано'; setTimeout(() => { b.classList.remove('done'); label.textContent = ic.name; }, 1400); };
        try { navigator.clipboard.writeText(svg).then(done, () => { label.textContent = 'не вдалося'; }); } catch { label.textContent = 'не вдалося'; }
      });
      grid.appendChild(b);
    });
  }

  /* Ukrainian plural: 1 урок, 3 уроки, 13 уроків */
  const lessonsWord = n => (n % 10 === 1 && n % 100 !== 11) ? 'урок' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? 'уроки' : 'уроків';

  /* ---------- home ---------- */
  async function renderHome(list) {
    const mods = await getJSON('modules/index.json');
    const data = await Promise.all(mods.map(m => m.ready ? getJSON(`modules/${m.id}.json`).catch(() => null) : null));
    list.innerHTML = mods.map((m, i) => {
      const L = data[i]?.lessons || [], n = L.length, d = m.ready ? lessonsDone(m.id, n) : 0;
      const taken = L.map((l, k) => store.get(`${m.id}:q${k}`)).filter(Boolean);
      const quiz = taken.length ? `${taken.reduce((a, t) => a + +t.split('/')[0], 0)}/${taken.reduce((a, t) => a + +t.split('/')[1], 0)}` : '';
      const state = m.ready
        ? `<div class="state"><span class="label">${d} / ${n} ${lessonsWord(n)}${quiz ? ' · тести ' + esc(quiz) : ''}</span><div class="bar"><i style="--p:${n ? d / n * 100 : 0}%"></i></div></div>`
        : `<div class="state"><span class="label">Скоро</span></div>`;
      const inner = `<span class="n">${m.id}</span><h3>${esc(m.title)}</h3><p>${esc(m.teaser)}</p>${state}${m.ready ? ARROW : '<span></span>'}`;
      return m.ready ? `<li class="reveal"><a class="row" href="module.html#${m.id}">${inner}</a></li>` : `<li class="row soon reveal">${inner}</li>`;
    }).join('');
    animate(list);
  }

  /* ---------- module ---------- */
  async function renderModule(root) {
    const [hid, hles] = location.hash.slice(1).split('-'); // #02 or #02-2 (module 02, lesson 2)
    const id = (hid || '01').replace(/\W/g, '');
    let mod, mods;
    try { [mod, mods] = await Promise.all([getJSON(`modules/${id}.json`), getJSON('modules/index.json')]); }
    catch { root.innerHTML = '<p class="intro" style="padding-block:80px">Модуль не знайдено. <a href="index.html">Повернутися до списку модулів</a>.</p>'; return; }
    document.title = `${mod.id} ${mod.title} · Сьорбати Можна`;
    const L = mod.lessons;
    const idx = mods.findIndex(m => m.id === mod.id);
    const next = mods.slice(idx + 1).find(m => m.ready);

    root.innerHTML = `
      ${mod.draft ? '<p class="ph draft">Чорновий вміст: тексти, тести й медіа буде замінено матеріалами з уроків.</p>' : ''}
      <div class="mod-hero">
        <div class="ornament" aria-hidden="true"></div>
        <div class="leafband" aria-hidden="true"></div>
        <span class="big">${esc(mod.id)}</span>
        <div>
          <p class="label">Модуль ${esc(mod.id)} з ${String(mods.length).padStart(2, '0')}</p>
          <h1><span class="ln"><span>${esc(mod.title)}</span></span></h1>
          <p class="intro">${esc(mod.intro)}</p>
          <div class="mod-meta"><span class="label">${L.length} ${lessonsWord(L.length)}</span><span class="label">Тест після кожного уроку</span></div>
        </div>
      </div>
      <div class="mod-layout">
        <nav class="toc" aria-label="Уроки модуля">
          <span class="label">Уроки</span>
          ${L.map((l, i) => `<button type="button" data-go="${i}" id="toc-${i}"><span class="k">${i + 1}</span><span>${esc(l.title)}</span><span class="dot"></span></button>`).join('')}
          <div class="progress"><span class="label" id="progLabel"></span><div class="bar"><i id="progBar"></i></div></div>
        </nav>
        <div>
          ${L.map((l, i) => `
          <article class="lesson" id="lesson-${i}">
            <div class="qbar"><span class="label">Урок ${i + 1}${l.duration ? ' · ' + esc(l.duration) : ''}</span></div>
            <h2 class="reveal">${esc(l.title)}</h2>
            <div class="media video reveal">${videoHTML(l.video || '', 'урок ' + (i + 1))}</div>
            <p class="summary">${esc(l.summary)}</p>
            ${l.points?.length ? `<div style="display:grid;gap:12px"><span class="label">Головне</span><ul class="points">${l.points.map(p => `<li>${LEAF}<span>${esc(p)}</span></li>`).join('')}</ul></div>` : ''}
            ${(l.links || []).map(k => `<a class="lesson-link" href="${esc(k.href)}"><div><span class="label">${esc(k.kicker || 'Довідник')}</span><h3>${esc(k.label)}</h3></div>${ARROW}</a>`).join('')}
            ${l.images?.length ? `<div class="gallery">${l.images.map((im, k) => `<figure class="reveal"><div class="media">${imgHTML(im, `урок ${i + 1} · ${k + 1}`)}</div>${im.caption ? `<figcaption>${esc(im.caption)}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}
            ${l.quiz?.length ? `<div class="lesson-quiz"><span class="label">Перевірте себе · ${l.quiz.length} питання</span><div class="quiz" id="quiz-${i}"></div></div>` : ''}
            <div class="lesson-foot"><button type="button" class="cta" data-done="${i}" aria-pressed="false">Позначити як переглянутий</button>
            ${i < L.length - 1 ? `<button type="button" class="cta" data-go="${i + 1}" style="border-color:var(--line);color:var(--muted)">Наступний урок ${ARROW}</button>` : ''}</div>
          </article>`).join('')}
          ${next ? `<a class="next" href="module.html#${next.id}"><span class="leafband" aria-hidden="true"></span><div><span class="label">Далі · модуль ${next.id}</span><h3>${esc(next.title)}</h3></div>${ARROW}</a>` : `<a class="next" href="index.html"><span class="leafband" aria-hidden="true"></span><div><span class="label">Усі модулі</span><h3>Повернутися на головну</h3></div>${ARROW}</a>`}
        </div>
      </div>`;

    const sync = () => {
      let d = 0;
      L.forEach((_, i) => {
        const on = store.get(`${mod.id}:l${i}`) === '1'; if (on) d++;
        $(`#toc-${i}`).classList.toggle('done', on);
        const b = $(`[data-done="${i}"]`); b.setAttribute('aria-pressed', on); b.textContent = on ? 'Переглянуто' : 'Позначити як переглянутий';
      });
      $('#progLabel').textContent = `${d} / ${L.length} ${lessonsWord(L.length)}`;
      $('#progBar').style.setProperty('--p', `${d / L.length * 100}%`);
    };
    root.addEventListener('click', e => {
      const go = e.target.closest('[data-go]'), done = e.target.closest('[data-done]');
      if (go) scrollToEl($(`#lesson-${go.dataset.go}`));
      if (done) { const k = `${mod.id}:l${done.dataset.done}`; store.set(k, store.get(k) === '1' ? '0' : '1'); sync(); }
    });
    sync();
    animate(root);
    const target = $(`#lesson-${+hles - 1}`);
    if (target) setTimeout(() => { lenis?.resize(); lenis ? lenis.scrollTo(target, { offset: -16, immediate: true, force: true }) : target.scrollIntoView(); }, 60);
    L.forEach((l, i) => { if (l.quiz?.length) runQuiz($(`#quiz-${i}`), l.quiz, `${mod.id}:q${i}`, () => { store.set(`${mod.id}:l${i}`, '1'); sync(); }); });
  }

  /* ---------- quiz ---------- */
  function runQuiz(box, Q, key, onEnd) {
    const KEYS = 'АБВГД';
    let i = 0, score = 0;
    const show = () => {
      const q = Q[i];
      box.innerHTML = `
        <div class="qbar"><span class="label">Питання ${i + 1} з ${Q.length}</span><span class="label">Бали · ${score}</span></div>
        <h3>${esc(q.q)}</h3>
        <div class="opts">${q.options.map((o, k) => `<button type="button" class="opt" data-k="${k}"><span class="k">${KEYS[k]}</span>${esc(o)}</button>`).join('')}</div>
        <div class="qfoot"><p class="feedback" aria-live="polite">Оберіть відповідь.</p><div class="qnext"></div></div>`;
      box.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => {
        const k = +b.dataset.k, ok = k === q.answer;
        if (ok) score++;
        box.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (+x.dataset.k === q.answer) x.classList.add('right'); });
        if (!ok) b.classList.add('wrong');
        $('.feedback', box).innerHTML = `<b${ok ? '' : ' class="no"'}>${ok ? 'Так.' : 'Не зовсім.'}</b> ${esc(q.explain)}`;
        $('.qbar .label:last-child', box).textContent = `Бали · ${score}`;
        const last = i === Q.length - 1;
        $('.qnext', box).innerHTML = `<button type="button" class="cta">${last ? 'Побачити результат' : 'Наступне питання'} ${ARROW}</button>`;
        $('.qnext button', box).addEventListener('click', () => { last ? end() : (i++, show()); scrollToEl(box); });
        const over = $('.qnext', box).getBoundingClientRect().bottom + 24 - innerHeight;
        if (over > 0) lenis ? lenis.scrollTo(scrollY + over) : scrollBy({ top: over, behavior: reduced ? 'auto' : 'smooth' });
      }));
    };
    const end = () => {
      const prev = store.get(key), best = prev ? Math.max(+prev.split('/')[0], score) : score;
      store.set(key, `${best}/${Q.length}`);
      onEnd?.();
      const r = score / Q.length;
      box.innerHTML = `
        <span class="label">Результат</span>
        <p class="qresult">${score} / ${Q.length}</p>
        <p class="feedback">${r === 1 ? 'Усі відповіді правильні.' : r >= .67 ? 'Добре. Поверніться до моменту уроку, де була помилка.' : 'Варто переглянути урок ще раз і спробувати знову.'}${best > score ? ` Ваш найкращий результат: ${best} / ${Q.length}.` : ''}</p>
        <button type="button" class="cta" id="qagain">Пройти ще раз</button>`;
      $('#qagain', box).addEventListener('click', () => { i = 0; score = 0; show(); });
    };
    show();
  }

  /* ---------- boot ---------- */
  const list = $('#moduleList'), grid = $('#iconGrid'), mod = $('#module');
  if (list) renderHome(list).catch(() => { list.innerHTML = '<li class="row"><p>Не вдалося завантажити модулі.</p></li>'; });
  if (grid) renderIcons(grid).catch(() => {});
  if (mod) { renderModule(mod); addEventListener('hashchange', () => { if (!location.hash.includes('-')) lenis ? lenis.scrollTo(0, { immediate: true }) : scrollTo(0, 0); renderModule(mod); }); }
  animate();
})();
