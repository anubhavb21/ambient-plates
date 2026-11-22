// My Gallery: the user's own pictures, browsed like the TV's app row.
// The focused picture fills the screen; a row of tiles at the bottom scrolls with ◀ ▶ and hides itself when idle.
// Pictures come from the private gallery/data.js (never published). Each picture gets its own
// brightness/contrast/saturation correction so the whole set sits at one level, plus one shared colour grade.
// Keys: ◀ ▶ browse, OK = clean view (hide clock and row), ▲ ▼ = other themes (engine). Auto-advances every 30 s.
(function () {
  window.Themes = window.Themes || {};
  const CSS = `
.t-gal { --ink:#f6efe6; --acc:#e9b07a; background:#060608; color:var(--ink); font-family:"Instrument Sans","Segoe UI",sans-serif; }
.t-gal .shot { position:absolute; inset:0; opacity:0; overflow:hidden; transition:opacity 1.5s ease; }
.t-gal .shot.on { opacity:1; }
.t-gal .shot img { position:absolute; inset:-4%; width:108%; height:108%; object-fit:cover;
  transform:translateX(var(--from,0)) scale(1.04); transition:transform 1.6s cubic-bezier(.2,.8,.2,1); }
.t-gal .shot.on img { transform:translateX(0) scale(1.04); animation:galKen 34s linear 1.6s forwards; }
@keyframes galKen { to { transform:translateX(0) scale(1.13); } }
.t-gal .grade { position:absolute; inset:0; pointer-events:none; mix-blend-mode:soft-light;
  background:linear-gradient(160deg, rgba(255,190,130,.34), rgba(70,95,180,.32)); }
.t-gal .veil { position:absolute; inset:0; pointer-events:none;
  background:linear-gradient(0deg, rgba(6,6,8,.86) 0%, rgba(6,6,8,.35) 26%, rgba(6,6,8,0) 45%),
             linear-gradient(100deg, rgba(6,6,8,.7) 0%, rgba(6,6,8,.15) 34%, rgba(6,6,8,0) 52%),
             radial-gradient(ellipse 85% 80% at 55% 45%, transparent 60%, rgba(0,0,0,.45)); }
.t-gal .grain { position:absolute; inset:0; opacity:.09; mix-blend-mode:overlay; pointer-events:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
.t-gal .clock { position:absolute; left:4.5vw; top:7vh; transition:opacity .8s ease, transform 6s ease; }
.t-gal .time { font-family:"Fraunces",Georgia,serif; font-style:italic; font-weight:300; font-size:10.5vw; line-height:.9; letter-spacing:-.03em;
  text-shadow:0 .3vw 3vw rgba(0,0,0,.55); }
.t-gal .day { margin-top:1.6vh; font-size:1.15vw; letter-spacing:.34em; text-transform:uppercase; opacity:.88; text-shadow:0 0 1vw rgba(0,0,0,.6); }
.t-gal .bar { width:5vw; height:.22vw; border-radius:1vw; margin-top:2vh; background:var(--acc); transition:background 1.5s ease; }
.t-gal .dock { position:absolute; left:0; right:0; bottom:5vh; height:11vw; transition:opacity .7s ease, transform .7s cubic-bezier(.2,.8,.2,1); }
.t-gal .dock.away { opacity:0; transform:translateY(3vh); }
.t-gal .track { position:absolute; left:4.5vw; top:0; height:100%; display:flex; align-items:center; gap:1.3vw;
  transition:transform .75s cubic-bezier(.22,.9,.24,1); }
.t-gal .tile { position:relative; flex:none; width:15vw; aspect-ratio:16/9; border-radius:.9vw; overflow:hidden; opacity:.62;
  box-shadow:0 1vw 2.5vw rgba(0,0,0,.5); transform:scale(.92); transform-origin:50% 60%;
  transition:transform .55s cubic-bezier(.2,.8,.2,1), opacity .55s ease, box-shadow .55s ease; }
.t-gal .tile img { width:100%; height:100%; object-fit:cover; display:block; }
.t-gal .tile.focus { opacity:1; transform:scale(1.08); box-shadow:0 0 0 .2vw var(--acc), 0 1.4vw 3.5vw rgba(0,0,0,.6), 0 0 3vw rgba(255,255,255,.14); }
.t-gal .hint { position:absolute; right:4.5vw; bottom:2vh; font:400 .85vw "IBM Plex Mono",monospace; letter-spacing:.2em; opacity:.55; transition:opacity .7s ease; }
.t-gal .dock.away + .hint { opacity:0; }
.t-gal.clean .clock { opacity:0; }
.t-gal.clean .veil { opacity:.35; }
@media (prefers-reduced-motion: reduce) { .t-gal .shot.on img { animation:none; } }
`;

  function accent(hex) {                 // lighten the picture's average colour into a readable accent
    const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255];
    const mx = Math.max(c[0], c[1], c[2], 1);
    return 'rgb(' + c.map((v) => Math.min(255, (v * 215 / mx) * 0.75 + 60) | 0).join(',') + ')';
  }

  window.Themes.gallery = {
    title: 'My Gallery',
    create(root, api) {
      const items = (window.GALLERY_DATA || []).slice(), base = 'gallery/';
      root.classList.add('t-gal');
      root.innerHTML = '<style>' + CSS + '</style><div class="shots"></div><div class="grade"></div><div class="veil"></div><div class="grain"></div>' +
        '<div class="clock"><div class="time"></div><div class="day"></div><div class="bar"></div></div>' +
        '<div class="dock"><div class="track"></div></div><div class="hint"></div>';
      const q = (s) => root.querySelector(s);
      const shots = q('.shots'), track = q('.track'), dock = q('.dock'), hint = q('.hint'), clock = q('.clock');

      const tiles = items.map((it) => {
        const t = document.createElement('div'); t.className = 'tile';
        const im = new Image(); im.src = base + it.thumb; im.alt = ''; im.style.filter = it.filter;
        t.append(im); track.append(t); return t;
      });
      // Preload the full pictures so a scroll never waits.
      items.forEach((it) => { const im = new Image(); im.src = base + it.file; });

      let index = 0, current = null, idle = 0, auto = 0, clean = false;
      function show(dir) {
        const it = items[index];
        const s = document.createElement('div'); s.className = 'shot';
        const im = new Image(); im.alt = ''; im.decoding = 'async'; im.src = base + it.file;
        im.style.filter = it.filter;                         // per-picture correction to the common level
        s.style.setProperty('--from', (dir || 0) * 3 + '%');
        s.append(im); shots.append(s);
        void s.offsetWidth; s.classList.add('on');
        if (current) { const old = current; old.classList.remove('on'); setTimeout(() => old.remove(), 1700); }
        current = s;
        root.style.setProperty('--acc', accent(it.avg));
        tiles.forEach((t, i) => t.classList.toggle('focus', i === index));
        // Keep the focused tile in view, like the TV's app row.
        const tileW = innerWidth * 0.15 + innerWidth * 0.013;
        const maxShift = Math.max(0, tiles.length * tileW - innerWidth * 0.9);
        const shift = Math.min(maxShift, Math.max(0, (index - 2) * tileW));
        track.style.transform = 'translateX(' + (-shift) + 'px)';
        hint.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(items.length).padStart(2, '0') + '   ◀ ▶ browse   OK clean view';
      }
      function go(step) { if (!items.length) return; index = (index + step + items.length) % items.length; show(step); }
      function wake() { idle = 0; auto = 0; dock.classList.remove('away'); }

      function tick() {
        const d = api.now(), h = d.getHours();
        q('.time').textContent = (h % 12 || 12) + ':' + api.pad(d.getMinutes());
        q('.day').textContent = api.DAYS[d.getDay()] + ' · ' + d.getDate() + ' ' + api.MONTHS[d.getMonth()];
        if (++idle === 6) dock.classList.add('away');          // the row hides after 6 s without a key
        if (!clean && ++auto >= 30) { auto = 0; go(1); }
      }
      if (!items.length) q('.day').textContent = 'Add pictures to gallery/ to use this theme';
      else show(0);
      tick();
      const iv = setInterval(tick, 1000);
      const wheel = (e) => { e.preventDefault(); wake(); go(e.deltaY > 0 || e.deltaX > 0 ? 1 : -1); };
      root.addEventListener('wheel', wheel, { passive: false });

      return {
        onKey(k) {
          if (k === 39) { wake(); go(1); return true; }
          if (k === 37) { wake(); go(-1); return true; }
          return false;
        },
        onAction() { clean = !clean; root.classList.toggle('clean', clean); if (clean) dock.classList.add('away'); else wake(); },
        onPointer(nx, ny) { clock.style.transform = 'translate(' + (nx * 0.4).toFixed(2) + 'vw,' + (ny * 0.4).toFixed(2) + 'vw)'; },
        onHour() { go(1); },
        destroy() { clearInterval(iv); root.removeEventListener('wheel', wheel); },
      };
    },
  };
})();
