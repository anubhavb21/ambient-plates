// Ambient Plates: editorial clock over an endless mix of real photos and painted scenes.
(function () {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ambient.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ambient.' + k, JSON.stringify(v)); } catch (e) {} },
  };
  const MODES = ['mix', 'photos', 'painted'];
  const MODE_TEXT = { mix: 'Mix · photos and painted scenes', photos: 'Photos only', painted: 'Painted scenes only' };
  let mode = params.get('mode') || store.get('mode', 'mix');
  const SECONDS = Math.max(8, Number(params.get('interval')) || store.get('interval', 90));
  document.documentElement.style.setProperty('--dur', SECONDS + 8 + 's');
  if (params.get('fade') === '0') document.documentElement.style.setProperty('--fade', '0s');

  // ---------- clock ----------
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const roman = (n) => { const m = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; };
  const pad = (n) => String(n).padStart(2, '0');
  const when = (h) => (h < 5 ? 'at night.' : h < 12 ? 'in the morning.' : h < 17 ? 'in the afternoon.' : h < 21 ? 'in the evening.' : 'at night.');
  function tick() {
    const d = new Date(), h = d.getHours();
    $('time').textContent = (h % 12 || 12) + ':' + pad(d.getMinutes());
    $('when').textContent = when(h);
    $('day').textContent = DAYS[d.getDay()];
    $('roman').textContent = d.getDate() + ' · ' + roman(d.getMonth() + 1) + ' · ' + d.getFullYear();
  }

  // ---------- quotations (tagged by scene) ----------
  const QUOTES = [
    ['What makes the desert beautiful is that somewhere it hides a well.', 'Antoine de Saint-Exupéry', 'desert'],
    ['The mountains are calling and I must go.', 'John Muir', 'lake'],
    ['Climb the mountains and get their good tidings.', 'John Muir', 'lake'],
    ['The clearest way into the Universe is through a forest wilderness.', 'John Muir', 'forest'],
    ['I went to the woods because I wished to live deliberately.', 'Henry David Thoreau', 'forest'],
    ['Heaven is under our feet as well as over our heads.', 'Henry David Thoreau', 'any'],
    ['The cure for anything is salt water: sweat, tears or the sea.', 'Isak Dinesen', 'coast'],
    ['The sea is everything.', 'Jules Verne', 'coast'],
    ['I often think that the night is more alive and more richly colored than the day.', 'Vincent van Gogh', 'night'],
    ['In every walk with nature one receives far more than he seeks.', 'John Muir', 'any'],
    ['Adopt the pace of nature: her secret is patience.', 'Ralph Waldo Emerson', 'any'],
    ['Let life be beautiful like summer flowers and death like autumn leaves.', 'Rabindranath Tagore', 'any'],
    ['Clouds come floating into my life, no longer to carry rain or usher storm, but to add color to my sunset sky.', 'Rabindranath Tagore', 'desert'],
    ['We shall not cease from exploration.', 'T. S. Eliot', 'any'],
  ];
  let lastQuote = -1;
  function quoteFor(scene) {
    const pool = QUOTES.map((q, i) => i).filter((i) => i !== lastQuote && (QUOTES[i][2] === scene || QUOTES[i][2] === 'any'));
    lastQuote = pool[Math.floor(Math.random() * pool.length)];
    return QUOTES[lastQuote];
  }

  // ---------- building slides ----------
  let count = store.get('count', 0), mixStep = 0;
  function wantPhoto() {
    if (mode === 'photos') return true;
    if (mode === 'painted') return false;
    mixStep++;
    return mixStep % 3 !== 0;        // photo, photo, painted, ...
  }
  function slideFromPhoto(photo, prepared) {
    const el = document.createElement('div'); el.className = 'slide';
    const c = document.createElement('div'); c.className = 'canvas';
    c.style.setProperty('--ox', prepared.calmLeft ? '70%' : '30%');
    c.style.setProperty('--tx', prepared.calmLeft ? '-1.2%' : '1.2%');
    prepared.img.alt = '';
    c.append(prepared.img); el.append(c);
    return { el, calmLeft: prepared.calmLeft, scene: photo.scene || 'any', title: photo.title,
      meta: 'Photo: ' + photo.author + ' · ' + photo.license + (photo.bundled ? ' · saved on this monitor' : ' · Wikimedia Commons'),
      plate: photo.title + ' · ' + photo.author, photo };
  }
  async function build(desc) {
    const hour = new Date().getHours(), mood = Painted.moodFor(hour);
    if (!desc) desc = wantPhoto() ? { type: 'photo' } : { type: 'painted', seed: ((Math.random() * 2147483646) | 0) + 1 };
    if (desc.type === 'photo') {
      for (let tries = 0; tries < 4; tries++) {
        const photo = desc.photo || (await Sources.next(mood));
        if (!photo) break;
        try { const p = await Sources.prepare(photo); desc.photo = photo; return Object.assign(slideFromPhoto(photo, p), { desc }); }
        catch (e) { desc.photo = null; }
      }
      desc = { type: 'painted', seed: ((Math.random() * 2147483646) | 0) + 1 };
    }
    const s = Painted.make(hour, desc.seed);
    return { el: s.el, calmLeft: s.calmLeft, scene: s.kind, title: s.title, meta: s.credit, plate: 'Painted · ' + s.title, desc };
  }

  // ---------- slideshow ----------
  const history = [];
  let current = null, upcoming = null, timer = null, busy = false;
  async function show(item) {
    count++; store.set('count', count);
    $('slides').append(item.el);
    void item.el.offsetWidth;
    item.el.classList.add('on');
    if (current) {
      const old = current.el;
      old.classList.remove('on'); old.classList.add('out');
      setTimeout(() => old.remove(), 4000);
    }
    current = item;
    // ?side=right keeps the text on the right (e.g. as a desktop wallpaper, where icons sit on the left).
    const side = params.get('side');
    $('stage').classList.toggle('flip', side === 'right' ? true : side === 'left' ? false : !item.calmLeft);
    const q = quoteFor(item.scene);
    $('quote').style.opacity = '0'; $('plate').style.opacity = '0';
    setTimeout(() => {
      $('quote').innerHTML = '<blockquote>“' + q[0] + '”</blockquote><figcaption>' + q[1] + '</figcaption>';
      $('plateNo').textContent = 'Plate ' + roman(count);
      $('plateText').textContent = item.plate;
      $('infoTitle').textContent = item.title;
      $('infoMeta').textContent = item.meta;
      $('quote').style.opacity = '1'; $('plate').style.opacity = '1';
    }, 1400);
    history.push(item.desc); if (history.length > 20) history.shift();
  }
  async function advance(desc) {
    if (busy || !started) return; busy = true;
    clearTimeout(timer);
    try {
      const item = desc ? await build(desc) : (upcoming ? await upcoming : await build());
      upcoming = null;
      await show(item);
      upcoming = build();                       // preload the next one while this one is on screen
    } finally {
      busy = false;
      if (started) timer = setTimeout(() => advance(), SECONDS * 1000);
    }
  }
  function previous() {
    if (history.length < 2) return;
    history.pop();                              // current
    const desc = history.pop();
    upcoming = null;
    advance(desc);
  }

  // ---------- small overlays ----------
  let toastTimer;
  function toast(text) { const t = $('toast'); t.textContent = text; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2600); }
  function setMode(dir) {
    mode = MODES[(MODES.indexOf(mode) + dir + MODES.length) % MODES.length];
    store.set('mode', mode); mixStep = 0; upcoming = null;
    toast(MODE_TEXT[mode]);
    advance();
  }

  // Burn-in care: the text drifts a little every minute.
  setInterval(() => {
    const x = (Math.random() * 0.7 - 0.35).toFixed(2), y = (Math.random() * 0.7 - 0.35).toFixed(2);
    $('ink').style.transform = 'translate(' + x + 'vw, ' + y + 'vw)';
  }, 60000);

  // ---------- remote / keyboard ----------
  try {
    tizen.tvinputdevice.registerKey('Info');
    tizen.tvinputdevice.registerKey('MediaPlayPause');
  } catch (e) {}
  try { webapis.appcommon.setScreenSaver(webapis.appcommon.AppCommonScreenSaverState.SCREEN_SAVER_OFF); } catch (e) {}
  document.addEventListener('keydown', (e) => {
    if (!started) return;                                         // another theme is on screen
    switch (e.keyCode) {
      case 39: advance(); break;                                  // right
      case 37: previous(); break;                                 // left
      case 38: setMode(-1); break;                                // up
      case 40: setMode(1); break;                                 // down
      case 13: case 457: case 73: $('info').hidden = !$('info').hidden; break;   // OK, Info, "i"
      case 10009: try { tizen.application.getCurrentApplication().exit(); } catch (err) {} break;  // Back
      default: return;
    }
    e.preventDefault();
  });

  tick(); setInterval(tick, 1000);
  // The theme engine (engine.js) starts and stops this theme; without the engine it runs on its own.
  let started = false, loaded = null;
  window.Editorial = {
    start() { if (started) return; started = true; (loaded = loaded || Sources.load()).then(() => advance()); },
    stop() { started = false; clearTimeout(timer); upcoming = null; },
  };
  if (!document.getElementById('themeRoot')) window.Editorial.start();
})();
