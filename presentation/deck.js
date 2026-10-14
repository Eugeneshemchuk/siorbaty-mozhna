/* Deck controls.
   → / Space / PageDown / click: next step, then next slide.   ← / PageUp: back.
   F: fullscreen.   G: toggle the video-area guide.   Home / End: first / last slide.
   URL hash #3 opens slide 3. ?guide shows the guide on load. ?all reveals every step (for stills). */
(() => {
  const stage = document.querySelector(".stage");
  const slides = [...document.querySelectorAll(".slide")];
  const hud = document.querySelector(".hud");
  const bar = hud.querySelector(".bar i");
  const count = hud.querySelector(".count");
  let cur = 0;
  const params = new URLSearchParams(location.search);
  const all = params.has("all");

  const fit = () => stage.style.setProperty("--s", Math.min(innerWidth / 1920, innerHeight / 1080));
  addEventListener("resize", fit);
  fit();

  const steps = s => [...s.querySelectorAll("[data-step]")];
  const pad = n => String(n).padStart(2, "0");

  function show(i, fromEnd = false) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((s, k) => {
      if (k === i) {
        // restart the entry animations each time a slide is entered
        s.classList.remove("on"); void s.offsetWidth; s.classList.add("on");
      } else s.classList.remove("on");
    });
    steps(slides[i]).forEach(el => el.classList.toggle("shown", fromEnd || all));
    cur = i;
    hud.classList.toggle("on-dark", slides[i].classList.contains("dark"));
    bar.style.width = ((i + 1) / slides.length) * 100 + "%";
    count.textContent = pad(i + 1) + " / " + pad(slides.length);
    history.replaceState(null, "", "#" + (i + 1));
  }

  function next() {
    const hidden = steps(slides[cur]).find(el => !el.classList.contains("shown"));
    if (hidden) hidden.classList.add("shown");
    else if (cur < slides.length - 1) show(cur + 1);
  }
  function prev() {
    const shown = steps(slides[cur]).filter(el => el.classList.contains("shown"));
    if (shown.length) shown.at(-1).classList.remove("shown");
    else if (cur > 0) show(cur - 1, true);
  }

  addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (["ArrowRight", " ", "PageDown", "Enter"].includes(k)) { e.preventDefault(); next(); }
    else if (["ArrowLeft", "PageUp", "Backspace"].includes(k)) { e.preventDefault(); prev(); }
    else if (k === "Home") show(0);
    else if (k === "End") show(slides.length - 1, true);
    else if (k === "f" || k === "F") document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    else if (k === "g" || k === "G") document.body.classList.toggle("guide");
  });
  stage.addEventListener("click", next);

  if (params.has("guide")) document.body.classList.add("guide");
  show((parseInt(location.hash.slice(1), 10) || 1) - 1);
})();
