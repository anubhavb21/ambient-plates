// Theme engine for the standalone TV app.
// Picks a theme (by URL, by time of day, or by remote key) and feeds it time events,
// a slowly drifting "camera" (there is no mouse on a TV) and OK-button presses.
//
// Theme contract (app/themes/<name>.js):
//   window.Themes.<name> = { title, create(root, api) -> instance }
//   instance: { destroy(), onPointer?(nx, ny), onAction?(x, y), onMinute?(date), onHour?(date) }
//   root is an empty full-screen <div>; size everything in vw/vh; stop every timer/rAF in destroy().
(function () {
  const params = new URLSearchParams(location.search);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ambient.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ambient.' + k, JSON.stringify(v)); } catch (e) {} },
  };
  const ORDER = ['editorial', 'anime', 'comic', 'cyber', 'cosmic'];
  // Time-aware rotation: the hour each theme takes over.
  const SCHEDULE = [[6, 'anime'], [10, 'comic'], [16, 'editorial'], [19, 'cyber'], [23, 'cosmic']];
  const scheduled = (h) => { let t = 'cosmic'; for (const [start, n] of SCHEDULE) if (h >= start) t = n; return t; };
  const Themes = (window.Themes = window.Themes || {});
  const stage = document.getElementById('stage');
  const layer = document.getElementById('themeRoot');
  const toastEl = document.getElementById('toast');
  document.body.append(toastEl); toastEl.style.position = 'fixed';   // visible above every theme, not only Editorial

  // Editorial is the original photo/painted clock (app.js), wrapped as a theme.
  Themes.editorial = {
    title: 'Editorial',
    create() { stage.hidden = false; window.Editorial.start(); return { destroy() { window.Editorial.stop(); stage.hidden = true; } }; },
  };

  // Testing hooks for the PC preview: ?at=19:30 fakes the time, ?event=hour|minute|action fires that event after 2 s.
  const at = /^(\d{1,2}):(\d{2})$/.exec(params.get('at') || '');
  const offset = at ? (() => { const d = new Date(); d.setHours(+at[1], +at[2], 0, 0); return d - Date.now(); })() : 0;
  const now = () => new Date(Date.now() + offset);
  const mulberry =(a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const api = {
    now,
    mood: (h = now().getHours()) => (h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night'),
    calm: () => { const h = now().getHours(); return params.has('calm') || h >= 23 || h < 6; },
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    rng: (seed) => mulberry(seed || (Math.random() * 2 ** 31) | 0),
    pad: (n) => String(n).padStart(2, '0'),
    DAYS: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    MONTHS: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  };

  let rotate = params.has('theme') ? false : store.get('rotate', true);
  let name = params.get('theme') || (rotate ? scheduled(now().getHours()) : store.get('theme', 'editorial'));
  let inst = null, root = null;

  function toast(text) { toastEl.textContent = text; toastEl.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (toastEl.hidden = true), 2600); }

  function use(next, announce) {
    if (!Themes[next]) next = 'editorial';
    const old = inst, oldRoot = root;
    name = next; document.body.dataset.theme = next;
    root = document.createElement('div'); root.className = 'theme-root';
    if (next === 'editorial') { root.style.background = 'transparent'; root.style.pointerEvents = 'none'; }
    layer.append(root);
    try { inst = Themes[next].create(root, api) || {}; }
    catch (e) { console.error(e); root.remove(); root = oldRoot; inst = old; if (next !== 'editorial') use('editorial'); return; }
    void root.offsetWidth; root.classList.add('on');
    if (old) {
      oldRoot.classList.remove('on');
      setTimeout(() => { try { old.destroy && old.destroy(); } catch (e) {} oldRoot.remove(); }, 1300);
    }
    if (next === 'editorial') { stage.hidden = false; }
    if (announce) toast(Themes[next].title + (rotate ? ' · changes through the day' : ''));
  }
  function call(fn, ...args) { try { inst && inst[fn] && inst[fn](...args); } catch (e) { console.error(e); } }

  // ---- time events ----
  let lastMin = now().getMinutes(), lastHour = now().getHours();
  setInterval(() => {
    const d = now();
    if (d.getMinutes() !== lastMin) { lastMin = d.getMinutes(); call('onMinute', d); }
    if (d.getHours() !== lastHour) {
      lastHour = d.getHours();
      if (rotate && scheduled(lastHour) !== name) use(scheduled(lastHour), true); else call('onHour', d);
    }
  }, 1000);

  // ---- drifting camera: a slow Lissajous path stands in for a mouse ----
  const t0 = performance.now();
  (function drift() {
    const t = (performance.now() - t0) / 1000;
    call('onPointer', Math.sin(t / 23) * 0.8, Math.sin(t / 31 + 1.3) * 0.6);
    setTimeout(drift, 50);
  })();

  // ---- remote keys ----
  try { ['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', '1', '2', '3', '4', '5', '0', 'Info'].forEach((k) => tizen.tvinputdevice.registerKey(k)); } catch (e) {}
  try { webapis.appcommon.setScreenSaver(webapis.appcommon.AppCommonScreenSaverState.SCREEN_SAVER_OFF); } catch (e) {}
  const pick = (n) => { rotate = false; store.set('rotate', false); store.set('theme', n); use(n, true); };
  document.addEventListener('keydown', (e) => {
    const k = e.keyCode;
    if (k >= 49 && k <= 53) return pick(ORDER[k - 49]);                       // 1-5
    if (k >= 403 && k <= 406) return pick(ORDER[k - 403 + 1]);                // red/green/yellow/blue = anime/comic/cyber/cosmic
    if (k === 48) { rotate = true; store.set('rotate', true); use(scheduled(new Date().getHours()), true); return; }   // 0 = auto
    if (name === 'editorial') return;                                         // app.js handles its own keys
    if (k === 39 || k === 37) { const i = ORDER.indexOf(name) + (k === 39 ? 1 : -1); pick(ORDER[(i + ORDER.length) % ORDER.length]); e.preventDefault(); }
    else if (k === 13) { call('onAction', innerWidth / 2, innerHeight / 2); e.preventDefault(); }
    else if (k === 10009) { try { tizen.application.getCurrentApplication().exit(); } catch (err) {} }
  });
  // On the PC preview a click stands in for OK.
  document.addEventListener('pointerdown', (e) => { if (name !== 'editorial') call('onAction', e.clientX, e.clientY); });

  // ---- performance readout: press 9 on the remote (or open with ?perf) ----
  // Shows frames per second, the slowest frames and JS memory, so each theme can be checked on the monitor itself.
  const perf = document.createElement('div');
  perf.style.cssText = 'position:fixed;left:1vw;bottom:1vw;z-index:20;padding:.5vw .8vw;border-radius:.4vw;background:rgba(0,0,0,.7);color:#9f9;font:400 .9vw/1.5 "IBM Plex Mono",monospace;white-space:pre;pointer-events:none';
  perf.hidden = !params.has('perf'); document.body.append(perf);
  const frames = []; let lastT = performance.now(), worst = [];
  (function meter(t) {
    frames.push(t - lastT); lastT = t; if (frames.length > 300) frames.shift();
    requestAnimationFrame(meter);
  })(lastT);
  setInterval(() => {
    if (!frames.length) return;
    const s = frames.slice().sort((a, b) => a - b), avg = s.reduce((a, b) => a + b, 0) / s.length;
    const fps = 1000 / avg, p95 = s[Math.floor(s.length * 0.95)];
    const mem = performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + ' MB' : 'n/a';
    worst.push(fps); if (worst.length > 60) worst.shift();
    const line = Themes[name].title + '\n' + fps.toFixed(0) + ' fps   slowest frames ' + p95.toFixed(0) + ' ms\nmemory ' + mem + '   lowest fps (1 min) ' + Math.min.apply(null, worst).toFixed(0);
    perf.textContent = line;
    if (!perf.hidden) console.log('[perf] ' + line.replace(/\n/g, ' | '));
  }, 1000);
  document.addEventListener('keydown', (e) => { if (e.keyCode === 57) perf.hidden = !perf.hidden; });
  try { tizen.tvinputdevice.registerKey('9'); } catch (e) {}

  window.Engine = { use: pick, get current() { return name; }, ORDER, scheduled };
  stage.hidden = name !== 'editorial';
  use(name, false);
  const ev = params.get('event');
  if (ev) setTimeout(() => (ev === 'action' ? call('onAction', innerWidth * 0.6, innerHeight * 0.45) : call(ev === 'hour' ? 'onHour' : 'onMinute', now())), 2000);
})();
