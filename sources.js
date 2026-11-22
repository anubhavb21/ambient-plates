// Photo sources: a live stream from Wikimedia Commons plus a bundled offline set.
// Only freely licensed, landscape-orientation, large JPEGs are used, and each one keeps its credit.
// Collections and filters were checked against the API on 2026-11-22 (photos/runtime-sources.json).
(function () {
  const API = 'https://commons.wikimedia.org/w/api.php';
  const SCENES = ['desert', 'lake', 'forest', 'coast', 'night'];
  const LICENSE_OK = /^(CC0|Public domain|CC BY(-SA)? \d)/i;
  const LICENSE_BAD = /\b(NC|ND)\b/;
  const BLOCK = /statue|buddha|idol|sculpture|monument|\bfort\b|palace|skyline|lights|illuminat|stadium|\bdam\b|pier|resort|hotel|castle|church|monaster|temple|mosque|city|town|village|harbou?r|marina|bridge|boat|ship|people|\bman\b|woman|tourist|portrait|festival|street|building|house|car\b|train|road/i;
  const BLOCK_NIGHT = /nebula|galaxy|\bNGC\b|\bIC \d|hubble|\bESO\b|comet|eclipse|messier|\bM\d+\b/i;
  const MIN_GAP_MS = 20000;            // Commons rate-limits bursts: at most one API call per 20 s
  const BACKOFF_MS = 10 * 60000;       // after a refused call, wait 10 minutes

  let cfg = {};
  let bundled = [];
  let lastCall = 0, blockedUntil = 0;
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ambient.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ambient.' + k, JSON.stringify(v)); } catch (e) {} },
  };
  let seen = store.get('seen', []);
  const queues = store.get('queues', {});      // cached between restarts so the monitor doesn't refetch every time
  const remember = (id) => { seen.push(id); if (seen.length > 800) seen = seen.slice(-800); store.set('seen', seen); };
  const strip = (html) => { const d = document.createElement('div'); d.innerHTML = html || ''; return (d.textContent || '').replace(/\s+/g, ' ').trim(); };
  const scenesFor = (mood) => ({ dawn: ['lake', 'forest', 'coast'], day: ['lake', 'forest', 'coast', 'desert'], dusk: ['desert', 'coast', 'lake'], night: ['night'] }[mood] || ['lake']);

  async function load() {
    if (window.PHOTO_DATA) { cfg = window.PHOTO_DATA.sources || {}; bundled = window.PHOTO_DATA.bundled || []; return; }
    try { cfg = await (await fetch('photos/runtime-sources.json')).json(); } catch (e) { cfg = {}; }
    try { bundled = await (await fetch('photos/photos.json')).json(); } catch (e) { bundled = []; }
  }

  function randomDate() {
    const from = Date.UTC(2008, 0, 1), to = Date.now();
    return new Date(from + Math.random() * (to - from)).toISOString().slice(0, 19) + 'Z';
  }

  function sourcesFor(scene) {
    const list = (cfg[scene] || (cfg.scenes && cfg.scenes[scene]) || []).slice();
    // Indian landscapes join the daytime scenes now and then.
    if (scene !== 'night' && cfg.india && Math.random() < 0.3) return cfg.india;
    return list;
  }

  async function call(entry) {
    const now = Date.now();
    if (now < blockedUntil || now - lastCall < MIN_GAP_MS) return [];
    lastCall = now;
    const q = {
      action: 'query', format: 'json', formatversion: '2', origin: '*',
      prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1920',
      iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|ObjectName',
    };
    const isSearch = entry.kind === 'search' || /^search:/.test(entry.category);
    if (isSearch) Object.assign(q, { generator: 'search', gsrnamespace: '6', gsrlimit: '20', gsrsort: 'random', gsrsearch: entry.category.replace(/^search:\s*/, '') });
    else Object.assign(q, { generator: 'categorymembers', gcmtitle: 'Category:' + entry.category, gcmtype: 'file', gcmlimit: '20', gcmsort: 'timestamp', gcmdir: Math.random() < 0.5 ? 'asc' : 'desc', gcmstart: randomDate() });
    const res = await fetch(API + '?' + new URLSearchParams(q).toString(), { headers: { 'Api-User-Agent': 'AmbientPlates/1.0 (Tizen ambient clock)' } });
    let data;
    try { data = await res.json(); } catch (e) { blockedUntil = Date.now() + BACKOFF_MS; return []; }
    return (data.query && data.query.pages) || [];
  }

  function keep(p, scene) {
    const ii = p.imageinfo && p.imageinfo[0];
    if (!ii || ii.mime !== 'image/jpeg' || ii.width < 3000) return null;
    const ratio = ii.width / ii.height;
    if (ratio < 1.3 || ratio > 3.2) return null;
    const m = ii.extmetadata || {}, lic = ((m.LicenseShortName && m.LicenseShortName.value) || '').trim();
    if (!LICENSE_OK.test(lic) || LICENSE_BAD.test(lic)) return null;
    const title = strip(m.ObjectName && m.ObjectName.value) || p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, '');
    if (BLOCK.test(p.title + ' ' + title) || (scene === 'night' && BLOCK_NIGHT.test(p.title + ' ' + title))) return null;
    if (seen.indexOf(p.title) >= 0) return null;
    return { id: p.title, src: ii.thumburl || ii.url, page: ii.descriptionurl, title, author: strip(m.Artist && m.Artist.value).slice(0, 80) || 'Unknown', license: lic, scene };
  }

  async function refill(scene) {
    const list = sourcesFor(scene);
    if (!list.length) return;
    const entry = list[Math.floor(Math.random() * list.length)];
    try {
      const fresh = (await call(entry)).map((p) => keep(p, scene)).filter(Boolean).sort(() => Math.random() - 0.5);
      queues[scene] = (queues[scene] || []).concat(fresh).slice(0, 60);
      store.set('queues', queues);
    } catch (e) { /* offline: bundled photos take over */ }
  }

  async function next(mood) {
    const options = scenesFor(mood);
    const scene = options[Math.floor(Math.random() * options.length)];
    if (!queues[scene] || queues[scene].length < 3) await refill(scene);
    const live = queues[scene] && queues[scene].shift();
    store.set('queues', queues);
    if (live && seen.indexOf(live.id) < 0) { remember(live.id); return live; }
    const recent = seen.slice(-8);
    let pool = bundled.filter((b) => options.indexOf(b.scene) >= 0 && recent.indexOf(b.file) < 0);
    if (!pool.length) pool = bundled.filter((b) => recent.indexOf(b.file) < 0);
    const b = pool[Math.floor(Math.random() * pool.length)];
    if (!b) return null;
    remember(b.file);
    return { id: b.file, src: 'photos/' + b.file, title: b.place, author: b.author, license: b.license, page: b.source, scene: b.scene, bundled: true, calmHint: b.leftSideCalm };
  }

  // Preload and measure which side of the image is calmer (less detail) for the text.
  function prepare(photo) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      const t = setTimeout(() => { img.src = ''; reject(new Error('slow image')); }, 45000);
      img.onload = () => {
        clearTimeout(t);
        let calmLeft = photo.calmHint !== false;
        try {
          const c = document.createElement('canvas'); c.width = 64; c.height = 36;
          const g = c.getContext('2d'); g.drawImage(img, 0, 0, 64, 36);
          const d = g.getImageData(0, 0, 64, 36).data;
          const busy = (x0, x1) => { let s = 0, n = 0; for (let y = 6; y < 36; y++) for (let x = x0 + 1; x < x1; x++) { const i = (y * 64 + x) * 4, j = i - 4; s += Math.abs(d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11 - (d[j] * 0.3 + d[j + 1] * 0.59 + d[j + 2] * 0.11)); n++; } return s / n; };
          calmLeft = busy(0, 26) <= busy(38, 64) * 1.08;
        } catch (e) { /* canvas blocked: keep hint */ }
        resolve({ img, calmLeft });
      };
      img.onerror = () => { clearTimeout(t); reject(new Error('image failed')); };
      img.src = photo.src;
    });
  }

  window.Sources = { load, next, prepare, SCENES };
})();
