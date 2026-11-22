/* Anime Sky — an original, procedurally painted cel-shaded landscape clock.
 * Everything (sky, cumulus, mountains, town, viaduct, train, petals, fireflies) is drawn in code.
 * Font: Quicksand by Andrew Paglinawan — SIL Open Font License 1.1 (Google Fonts, latin subset)
 *       -> fonts/Anime-Quicksand.woff2
 * Contract: window.Themes.anime = { title, create(root, api) -> { destroy, onPointer, onAction, onMinute, onHour } }
 */
(function () {
  'use strict';
  var TAU = Math.PI * 2;

  // ---------------------------------------------------------------- palettes
  var PAL = {
    day: {
      sky: [[0, '#1450c0'], [0.32, '#2c7fe6'], [0.56, '#62b2f4'], [0.68, '#a3d9fb'], [1, '#e2f6ff']],
      stars: 0,
      cloud: { sT: '#c9d6f0', sB: '#8597cb', mid: '#f4f7fd', mid2: '#dde6f6', hi: '#ffffff', rim: '#ffffff', haze: '#9cc8f2', glow: 0.35 },
      sun: { kind: 'sun', core: '#fffdf2', edge: '#fff4d0', glow: [255, 246, 214], r: 40, halo: 0.55 },
      far1: { base: '#8fb2df', lit: '#b9d3f1', haze: '#d2ebfc' },
      far2: { base: '#5f8bc6', lit: '#93b9e4', haze: '#b9ddf7' },
      rail: { wall: '#7189ad', lit: '#b3c6de', dark: '#536a8f', haze: '#a9cbe9', body: '#f3f0e6', body2: '#d9d6cc', stripe: '#2b8ea9', roof: '#8f9db1', win: '#33506f', lit_: false },
      hills: { base: '#4a975a', lit: '#7cc566', dark: '#357a4d', field: '#62ad58', walls: ['#f3ebdc', '#e8decd', '#dfe5ea'], roofs: ['#c4574b', '#4f70a5', '#5a806a', '#8c5c45', '#d0874d'], shade: '#b3aa9d', win: '#40607e', winLit: 0, haze: '#a6cdea' },
      tree: { sT: '#3f8a4c', sB: '#2b6a45', mid: '#5fae4f', mid2: '#4f9b49', hi: '#93d36c', rim: '#d0f28e', haze: '#8cc0a0', glow: 0 },
      near: { base: '#2a6b3b', lit: '#4f9e46', rim: '#acdc6c', grass: '#357e3e', grassHi: '#8fcc5c', pole: '#3c404c', poleLit: '#8c96a6', wire: 'rgba(34,40,54,0.85)', trunk: '#4c3b32', trunkLit: '#7d6352', flowers: ['#ffffff', '#ffd9e8', '#fff1a6'] },
      tree2: { sT: '#2f7a40', sB: '#1f5a36', mid: '#4f9e44', mid2: '#428e40', hi: '#86c95e', rim: '#cdf08a', haze: '#2f7a40', glow: 0 },
      part: 'petal', petal: ['#fff1f5', '#f8b9cf'],
      flare: [255, 240, 200], flareAmt: 0.55, rays: [255, 250, 225], raysAmt: 0.75,
      ink: '#fffdf8', glow: 'rgba(80,150,255,0.65)', shade: 'rgba(8,36,96,0.45)', tint: '#e8f2ff',
      vign: 'rgba(10,30,80,0.28)'
    },
    dawn: {
      sky: [[0, '#25336c'], [0.3, '#5a5a9e'], [0.52, '#b98bb4'], [0.66, '#f4b2a4'], [0.8, '#ffd3ae'], [1, '#ffe8c0']],
      stars: 50,
      cloud: { sT: '#9c94c4', sB: '#6c69a4', mid: '#f8c7c5', mid2: '#eeb0b9', hi: '#ffeed8', rim: '#fff6e4', haze: '#d6a6c2', glow: 0.55 },
      sun: { kind: 'sun', core: '#fff6e0', edge: '#ffd2a8', glow: [255, 196, 160], r: 54, halo: 0.75 },
      far1: { base: '#a08fc0', lit: '#e6b5c4', haze: '#f6cdc0' },
      far2: { base: '#7a6ea7', lit: '#c79bbb', haze: '#e4b6bd' },
      rail: { wall: '#6b6290', lit: '#e0a8b6', dark: '#4b4574', haze: '#c9a2bd', body: '#efe6e6', body2: '#cfc2cc', stripe: '#3a7f9c', roof: '#8a82a6', win: '#ffd99c', lit_: true },
      hills: { base: '#5b6b8e', lit: '#c09cb2', dark: '#46557c', field: '#6a7898', walls: ['#eadada', '#dacbd6', '#e4d4cc'], roofs: ['#9d4f5c', '#4b5d8b', '#6a6a8c', '#b56a5a'], shade: '#9888a2', win: '#ffd89a', winLit: 0.35, haze: '#c9a6c0' },
      tree: { sT: '#4b5a7c', sB: '#37466a', mid: '#6b7c9c', mid2: '#5d6e90', hi: '#cda2b8', rim: '#ffd6cc', haze: '#8d8cae', glow: 0 },
      near: { base: '#33375c', lit: '#5c5882', rim: '#f4b4ba', grass: '#3d4169', grassHi: '#d99cb6', pole: '#262840', poleLit: '#a48cb0', wire: 'rgba(30,28,52,0.88)', trunk: '#2e2a42', trunkLit: '#8a6e8e', flowers: ['#ffe6ee', '#fff0d0'] },
      tree2: { sT: '#353d64', sB: '#272e52', mid: '#4b5280', mid2: '#424876', hi: '#b38ab0', rim: '#ffc4c4', haze: '#353d64', glow: 0 },
      part: 'petal', petal: ['#fff0f4', '#f4a9c4'],
      flare: [255, 200, 180], flareAmt: 0.7, rays: [255, 214, 190], raysAmt: 1,
      ink: '#fff8f4', glow: 'rgba(255,140,170,0.6)', shade: 'rgba(60,30,90,0.45)', tint: '#ffe6ee',
      vign: 'rgba(40,20,70,0.32)'
    },
    dusk: {
      sky: [[0, '#14174a'], [0.26, '#3b2d78'], [0.46, '#9a4b86'], [0.6, '#ec6f6c'], [0.72, '#ffa36a'], [0.86, '#ffcf88'], [1, '#ffe3a6']],
      stars: 110,
      cloud: { sT: '#7c5c9e', sB: '#463876', mid: '#f59a86', mid2: '#de7782', hi: '#ffd9a2', rim: '#fff1c4', haze: '#b9628c', glow: 0.8 },
      sun: { kind: 'sun', core: '#fff4cc', edge: '#ffb070', glow: [255, 150, 80], r: 78, halo: 0.9 },
      far1: { base: '#7a4e8b', lit: '#d8738a', haze: '#f39a84' },
      far2: { base: '#513976', lit: '#a5577f', haze: '#d47a86' },
      rail: { wall: '#3e2f5f', lit: '#ec9478', dark: '#2a2049', haze: '#8a4f7e', body: '#3b3456', body2: '#2c2644', stripe: '#e8a452', roof: '#29233f', win: '#ffd27a', lit_: true },
      hills: { base: '#3a2c5b', lit: '#a05e7c', dark: '#2a2049', field: '#44345f', walls: ['#5c4b72', '#504169', '#62506c'], roofs: ['#2f2547', '#3b2d53', '#47304f'], shade: '#3a2e55', win: '#ffcf70', winLit: 0.6, haze: '#8a4f7e' },
      tree: { sT: '#2f2651', sB: '#221c41', mid: '#4b3967', mid2: '#40315d', hi: '#be6c7a', rim: '#ffb27a', haze: '#6a4470', glow: 0 },
      near: { base: '#1e1735', lit: '#3a2850', rim: '#ff9e6c', grass: '#2a1f44', grassHi: '#ffa070', pole: '#17122a', poleLit: '#e88e6c', wire: 'rgba(22,14,36,0.92)', trunk: '#1a1430', trunkLit: '#b8604e', flowers: [] },
      tree2: { sT: '#1d1636', sB: '#140f2a', mid: '#2e2248', mid2: '#281e42', hi: '#9a4e66', rim: '#ff9a68', haze: '#1d1636', glow: 0 },
      part: 'dusk', petal: ['#ffc07a', '#ec7a4c'],
      flare: [255, 170, 110], flareAmt: 0.75, rays: [255, 190, 130], raysAmt: 1.1,
      ink: '#fff6ec', glow: 'rgba(255,128,84,0.62)', shade: 'rgba(40,16,60,0.5)', tint: '#ffe2c8',
      vign: 'rgba(30,10,50,0.38)'
    },
    night: {
      sky: [[0, '#03061a'], [0.32, '#0a1446'], [0.58, '#14296c'], [0.76, '#1f4486'], [1, '#2f6698']],
      stars: 700,
      cloud: { sT: '#222c5c', sB: '#121a3e', mid: '#323f7a', mid2: '#29356c', hi: '#5d70aa', rim: '#b4c6ff', haze: '#1a2a5a', glow: 0.5 },
      sun: { kind: 'moon', core: '#f6f2de', edge: '#e6e2cc', glow: [170, 200, 255], r: 48, halo: 0.6 },
      far1: { base: '#182a5c', lit: '#2d4684', haze: '#22427c' },
      far2: { base: '#0f1c46', lit: '#1f3468', haze: '#1b346a' },
      rail: { wall: '#0d1637', lit: '#3a5894', dark: '#080f28', haze: '#18306a', body: '#1b2242', body2: '#141a34', stripe: '#3d5ea6', roof: '#121831', win: '#ffd889', lit_: true },
      hills: { base: '#0c1535', lit: '#1d3262', dark: '#080e27', field: '#0f1a3e', walls: ['#1b2346', '#171f40', '#1d2444'], roofs: ['#0e1431', '#121a39', '#141834'], shade: '#10183b', win: '#ffd27a', winLit: 0.75, haze: '#18306a' },
      tree: { sT: '#0e1839', sB: '#0a122d', mid: '#16244d', mid2: '#132045', hi: '#2c437a', rim: '#7d9ce4', haze: '#122250', glow: 0 },
      near: { base: '#060b1f', lit: '#0f1939', rim: '#5d7cd0', grass: '#0a1231', grassHi: '#4b69bb', pole: '#05081b', poleLit: '#3c5294', wire: 'rgba(5,8,24,0.95)', trunk: '#060a1d', trunkLit: '#2c3e78', flowers: [] },
      tree2: { sT: '#070d24', sB: '#050a1c', mid: '#0c1636', mid2: '#0a1330', hi: '#1f3166', rim: '#6b8ad8', haze: '#070d24', glow: 0 },
      part: 'firefly', petal: ['#d8f7a0', '#9fe070'],
      flare: [170, 200, 255], flareAmt: 0, rays: [170, 200, 255], raysAmt: 0,
      ink: '#f3f6ff', glow: 'rgba(110,150,255,0.62)', shade: 'rgba(0,4,30,0.55)', tint: '#dfe8ff',
      vign: 'rgba(0,2,16,0.45)'
    }
  };

  // ---------------------------------------------------------------- helpers
  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function hex(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgba(a, al) { return 'rgba(' + a[0] + ',' + a[1] + ',' + a[2] + ',' + al + ')'; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function mix(a, b, t) { var A = hex(a), B = hex(b); return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' + Math.round(A[1] + (B[1] - A[1]) * t) + ',' + Math.round(A[2] + (B[2] - A[2]) * t) + ')'; }
  function norm(x, y) { var l = Math.sqrt(x * x + y * y) || 1; return { x: x / l, y: y / l }; }
  function dither(ctx, w, h, amt) {
    try {
      var id = ctx.getImageData(0, 0, w, h), d = id.data, s = 1234567;
      for (var i = 0; i < d.length; i += 4) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        var n = ((s / 0x7fffffff) - 0.5) * amt;
        d[i] += n; d[i + 1] += n; d[i + 2] += n;
      }
      ctx.putImageData(id, 0, 0);
    } catch (e) {}
  }
  function mpd(rng, n, rough) {
    var N = 1 << n, a = new Array(N + 1), step = N, amp = 1;
    a[0] = rng() * 2 - 1; a[N] = rng() * 2 - 1;
    while (step > 1) {
      var half = step >> 1;
      for (var i = half; i < N; i += step) a[i] = (a[i - half] + a[i + half]) / 2 + (rng() * 2 - 1) * amp;
      amp *= rough; step = half;
    }
    var mn = Infinity, mx = -Infinity, j;
    for (j = 0; j <= N; j++) { if (a[j] < mn) mn = a[j]; if (a[j] > mx) mx = a[j]; }
    for (j = 0; j <= N; j++) a[j] = (a[j] - mn) / ((mx - mn) || 1);
    return a;
  }

  // ---- cel-shaded puffs: the heart of the look (clouds and tree canopies) ----
  function genPuffs(rng, w, h, kind) {
    var cs = [], i, base;
    if (kind === 'tower') {
      base = h * 0.86;
      var LV = 9;
      for (var lv = 0; lv < LV; lv++) {
        var t = lv / (LV - 1);
        var yy = base - t * h * 0.6;
        var half = w * (0.4 - 0.22 * t + 0.14 * t * t * t);
        var cx = w * 0.5 + Math.sin(lv * 1.9) * w * 0.035;
        var r0 = h * (0.085 + 0.05 * t);
        var n = Math.max(2, Math.round(half * 2 / (r0 * 1.5)));
        for (i = 0; i < n; i++) {
          var x = cx - half + (i + 0.5) * (2 * half / n) + (rng() - 0.5) * r0 * 0.7;
          cs.push({ x: x, y: yy - rng() * r0 * 0.5, r: r0 * (0.7 + rng() * 0.7) });
        }
      }
      for (i = 0; i < 7; i++) cs.push({ x: w * 0.5 + (rng() - 0.5) * w * 0.42, y: base - h * 0.6 + (rng() - 0.2) * h * 0.06, r: h * (0.07 + rng() * 0.05) });
    } else if (kind === 'puffy') {
      base = h * 0.84;
      var N = 15;
      for (i = 0; i < N; i++) {
        var uu = (i + 0.2 + rng() * 0.6) / N, env = Math.sin(Math.PI * uu);
        var r = h * (0.12 + 0.17 * env) * (0.78 + rng() * 0.36);
        cs.push({ x: w * (0.13 + 0.74 * uu), y: base - r * 0.35 - env * h * 0.26 * rng(), r: r });
      }
      for (i = 0; i < 7; i++) cs.push({ x: w * (0.16 + 0.68 * i / 6), y: base, r: h * 0.1 * (0.8 + rng() * 0.4) });
    } else if (kind === 'streak') {
      base = h * 0.74;
      for (i = 0; i < 11; i++) {
        var u2 = (i + rng() * 0.7) / 11, e2 = Math.sin(Math.PI * u2);
        var rr = h * (0.3 + 0.32 * e2) * (0.8 + rng() * 0.4);
        cs.push({ x: w * (0.08 + 0.84 * u2), y: base - rr * 0.18 - e2 * h * 0.12 * rng(), r: rr * 1.9, ry: rr * 0.5 });
      }
    } else { // 'canopy' — rounder, no flat base
      base = h;
      for (i = 0; i < 30; i++) {
        var a = rng() * TAU, d = Math.sqrt(rng());
        var px = w * 0.5 + Math.cos(a) * d * w * 0.34, py = h * 0.52 + Math.sin(a) * d * h * 0.32;
        cs.push({ x: px, y: py, r: Math.min(w, h) * (0.1 + rng() * 0.07) });
      }
    }
    return { cs: cs, base: base };
  }

  function renderPuffs(rng, w, h, kind, P, L, u, hazeAmt) {
    var pad = Math.round(Math.max(18 * u, h * 0.06));
    var c = mk(w + 2 * pad, h + 2 * pad), x = c.getContext('2d');
    var g = genPuffs(rng, w, h, kind), cs = g.cs, base = g.base;
    x.translate(pad, pad);
    var gS = x.createLinearGradient(0, 0, 0, base); gS.addColorStop(0, P.sT); gS.addColorStop(1, P.sB);
    var gM = x.createLinearGradient(0, 0, 0, base); gM.addColorStop(0, P.mid); gM.addColorStop(1, P.mid2);
    cs.sort(function (a, b) { return a.y - b.y; });
    // big-form shading: puffs on the far side of the light fall into one shadow mass
    var mx = 0, my = 0, i, ext = 1;
    for (i = 0; i < cs.length; i++) { mx += cs[i].x; my += cs[i].y; }
    mx /= cs.length; my /= cs.length;
    for (i = 0; i < cs.length; i++) ext = Math.max(ext, Math.abs((cs[i].x - mx) * L.x + (cs[i].y - my) * L.y) + cs[i].r * 0.5);
    var shadeBody = mix(P.sT, P.mid2, 0.32), shadeEdge = mix(P.sB, P.sT, 0.3);
    var thr = kind === 'tower' ? -0.05 : kind === 'canopy' ? -0.1 : -0.3;
    var leafy = kind === 'canopy';
    // a puff outline: plain ellipse for clouds, a scalloped leaf clump for trees
    function shape(p, ox, oy, sc) {
      var r = p.r * sc, ry = (p.ry || p.r) * sc, cx = p.x + ox, cy = p.y + oy;
      x.beginPath();
      if (!leafy) { x.ellipse(cx, cy, r, ry, 0, 0, TAU); return; }
      x.moveTo(cx + r * 0.84, cy); x.arc(cx, cy, r * 0.84, 0, TAU);
      for (var b = 0; b < 11; b++) {
        var a = b / 11 * TAU + p.seed, bx = cx + Math.cos(a) * r * 0.8, by = cy + Math.sin(a) * r * 0.8, br = r * (0.2 + 0.08 * Math.sin(b * 2.7 + p.seed * 3));
        x.moveTo(bx + br, by); x.arc(bx, by, br, 0, TAU);
      }
    }
    for (i = 0; i < cs.length; i++) {
      var p = cs[i], ry = p.ry || p.r;
      p.seed = rng() * TAU;
      var sp = ((p.x - mx) * L.x + (p.y - my) * L.y) / ext + (rng() - 0.5) * 0.4;
      var lit = sp > thr;
      x.save();
      shape(p, 0, 0, 1); x.clip();
      x.fillStyle = lit ? gS : shadeEdge; x.fill();
      shape(p, L.x * p.r * 0.26, L.y * ry * 0.26, 0.93);
      x.fillStyle = lit ? gM : shadeBody; x.fill();
      if (lit && sp > thr + 0.35) {
        shape(p, L.x * p.r * 0.7, L.y * ry * 0.7, 0.5);
        x.globalAlpha = 0.9; x.fillStyle = P.hi; x.fill();
      }
      x.restore();
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
    var cut = kind === 'tower' || kind === 'puffy';
    if (cut) {
      x.clearRect(0, pad + base, c.width, c.height);
      x.globalCompositeOperation = 'source-atop';
      var gb = x.createLinearGradient(0, pad + base - h * 0.1, 0, pad + base);
      gb.addColorStop(0, 'rgba(0,0,0,0)'); gb.addColorStop(1, rgba(hex(P.sB), 0.5));
      x.fillStyle = gb; x.fillRect(0, pad + base - h * 0.1, c.width, h * 0.1);
      x.globalCompositeOperation = 'source-over';
    }
    // rim light on the edge that faces the light
    var rimW = Math.max(2, (kind === 'streak' ? 3 : 6) * u);
    var rc = mk(c.width, c.height), r = rc.getContext('2d');
    r.drawImage(c, 0, 0);
    r.globalCompositeOperation = 'source-in'; r.fillStyle = P.rim; r.fillRect(0, 0, rc.width, rc.height);
    r.globalCompositeOperation = 'destination-out'; r.drawImage(c, -L.x * rimW, -L.y * rimW);
    if (cut) r.clearRect(0, pad + base - rimW * 1.5, rc.width, rc.height);
    // atmospheric haze toward the base
    if (hazeAmt > 0) {
      x.globalCompositeOperation = 'source-atop';
      var gh = x.createLinearGradient(0, pad, 0, pad + base);
      var hz = hex(P.haze);
      gh.addColorStop(0, rgba(hz, hazeAmt * 0.25)); gh.addColorStop(1, rgba(hz, hazeAmt));
      x.fillStyle = gh; x.fillRect(0, 0, c.width, c.height);
      x.globalCompositeOperation = 'source-over';
    }
    if (P.glow > 0) {
      x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = P.glow * 0.8;
      x.filter = 'blur(' + Math.round(7 * u) + 'px)'; x.drawImage(rc, 0, 0); x.restore();
    }
    x.drawImage(rc, 0, 0);
    c._pad = pad; c._base = base;
    return c;
  }

  // ---------------------------------------------------------------- CSS
  var CSS = [
    "@font-face{font-family:'Anime Quicksand';font-style:normal;font-weight:300 700;font-display:block;src:url('fonts/Anime-Quicksand.woff2') format('woff2');}",
    ".t-anime{overflow:hidden;background:#0a1440;font-family:'Anime Quicksand','Quicksand','Segoe UI',sans-serif;color:#fff;cursor:default;}",
    ".t-anime .sc{position:absolute;left:0;top:0;right:0;bottom:0;opacity:1;transition:opacity 3.2s ease;}",
    ".t-anime .sc.pre{opacity:0;}",
    ".t-anime canvas{position:absolute;left:0;top:0;display:block;will-change:transform;transform-origin:50% 50%;}",
    ".t-anime .vg{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;}",
    ".t-anime .dim{position:absolute;left:0;top:0;right:0;bottom:0;background:#01030c;opacity:0;transition:opacity 4s ease;pointer-events:none;}",
    ".t-anime .clk{position:absolute;left:5.6vw;top:6.5vh;z-index:5;pointer-events:none;transition:transform 60s linear, opacity 2s ease;}",
    ".t-anime .tm{display:flex;align-items:flex-end;font-size:14.5vw;font-weight:600;line-height:.92;letter-spacing:-.01em;color:var(--ink);",
    "  text-shadow:0 0 .05em var(--glow),0 0 .22em var(--glow),0 .03em .1em var(--shade);}",
    ".t-anime .hm{display:flex;}",
    ".t-anime .dg{position:relative;display:inline-block;width:.6em;height:1em;text-align:center;}",
    ".t-anime .dg.col{width:.27em;}",
    ".t-anime .dg.col .d{animation:anime-blink 2s ease-in-out infinite;}",
    ".t-anime .d{position:absolute;left:0;right:0;top:0;display:block;}",
    ".t-anime .d.in{animation:anime-in .9s cubic-bezier(.2,.8,.2,1) both;}",
    ".t-anime .d.out{animation:anime-out .7s ease-in both;}",
    ".t-anime .ap{font-size:.2em;font-weight:600;letter-spacing:.08em;margin-left:.25em;margin-bottom:.95em;opacity:.92;text-transform:lowercase;}",
    ".t-anime .dt{display:flex;align-items:center;gap:1.1vw;margin-top:1.6vh;margin-left:.6vw;font-size:2.5vw;font-weight:600;letter-spacing:.06em;color:var(--ink);",
    "  text-shadow:0 0 .3em var(--glow),0 .06em .25em var(--shade);}",
    ".t-anime .dt i{display:inline-block;width:.42em;height:.42em;transform:rotate(45deg);background:var(--tint);box-shadow:0 0 .5em var(--glow);opacity:.9;}",
    ".t-anime .lb{margin-top:1.4vh;margin-left:.7vw;font-size:1.25vw;font-weight:600;letter-spacing:.42em;text-transform:uppercase;color:var(--tint);opacity:.88;",
    "  text-shadow:0 0 .6em var(--glow),0 .1em .4em var(--shade);}",
    ".t-anime .lb:before{content:'';display:inline-block;vertical-align:middle;width:3.2vw;height:2px;margin-right:1vw;background:linear-gradient(90deg,transparent,var(--tint));}",
    ".t-anime.calm .clk{opacity:.78;}",
    "@keyframes anime-in{0%{opacity:0;transform:translateY(.35em) scale(.92);filter:blur(.06em);}60%{opacity:1;}100%{opacity:1;transform:none;filter:none;}}",
    "@keyframes anime-out{0%{opacity:1;transform:none;}100%{opacity:0;transform:translateY(-.3em) scale(1.04);filter:blur(.05em);}}",
    "@keyframes anime-blink{0%,100%{opacity:1;}50%{opacity:.45;}}",
    "@media (prefers-reduced-motion: reduce){.t-anime .d.in,.t-anime .d.out,.t-anime .dg.col .d{animation:none;}.t-anime .clk{transition:none;}}"
  ].join('\n');

  // ---------------------------------------------------------------- theme
  function create(root, api) {
    root.classList.add('t-anime');
    if (/[?&]shot(&|$)/.test(location.search)) root.style.transition = 'none';   // headless screenshots: skip the 1.2 s engine fade
    var style = document.createElement('style'); style.textContent = CSS; root.appendChild(style);

    var dead = false, raf = 0, timers = [], lastTs = 0, T = 0;
    var reduced = !!api.reduced;
    var R = api.rng(); // runtime randomness
    var k, W, H, u, PX, PY;
    function measure() {
      var iw = root.clientWidth || innerWidth || 1920, ih = root.clientHeight || innerHeight || 1080;
      k = Math.min(window.devicePixelRatio || 1, 1920 / iw, 1080 / ih);
      W = Math.round(iw * k); H = Math.round(ih * k); u = H / 1080;
      PX = 0.034 * W; PY = 0.022 * H;
    }
    measure();

    function later(fn, ms) { var id = setTimeout(function () { timers.splice(timers.indexOf(id), 1); fn(); }, ms); timers.push(id); return id; }
    function el(tag, cls, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }

    var stage = el('div', 'stagebox', root);
    stage.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;';
    var front = mk(W, H); front.style.width = (W / k) + 'px'; front.style.height = (H / k) + 'px'; front.style.zIndex = 3;
    root.appendChild(front);
    var fx = front.getContext('2d');
    var dim = el('div', 'dim', root); dim.style.zIndex = 4;

    // ---- clock DOM
    var clk = el('div', 'clk', root);
    var tm = el('div', 'tm', clk), hm = el('span', 'hm', tm), ap = el('span', 'ap', tm);
    var dt = el('div', 'dt', clk), dy = el('span', '', dt); el('i', '', dt); var dd = el('span', '', dt);
    var lb = el('div', 'lb', clk);
    var cells = [];

    // ---- camera
    var cam = { x: 0, y: 0, tx: 0, ty: 0 };

    // ---- scene state
    var scene = null, oldScene = null, curMood = null, curKey = '';
    var sprites = null;
    var train = { active: false, x: 0, dir: 1, speed: 0 };
    var part = null;   // clouds parting {t0}
    var raysBoost = 0, raysBoostT = 0;
    var gusts = [], rings = [], meteors = [], birds = [];
    var parts = [], extra = [];
    var next = { train: 0, star: 0, birds: 0 };

    function sunAt(mood, d) {
      var h = d.getHours() + d.getMinutes() / 60, t;
      if (mood === 'day') { t = clamp((h - 8) / 9, 0, 1); return { x: 0.83 + 0.07 * t, y: 0.2 - 0.07 * Math.sin(Math.PI * t) }; }
      if (mood === 'dawn') { t = clamp((h - 5) / 3, 0, 1); return { x: 0.26 + 0.04 * t, y: 0.74 - 0.22 * t }; }
      if (mood === 'dusk') { t = clamp((h - 17) / 3, 0, 1); return { x: 0.75 + 0.02 * t, y: 0.47 + 0.2 * t }; }
      return { x: 0.87, y: 0.15 };
    }

    // ------------------------------------------------------------ scene building
    function buildScene(mood, d) {
      var P = PAL[mood];
      var sc = { mood: mood, P: P, layers: [], clouds: [], el: el('div', 'sc'), sun: null, rail: null, trainC: null };
      var seed = { dawn: 11, day: 23, dusk: 37, night: 53 }[mood];
      var rngL = api.rng(9001);                       // landscape: same town every time
      var rngC = api.rng(seed * 97 + d.getHours());   // clouds: new sky every hour
      var s = sunAt(mood, d), sx = s.x * W, sy = s.y * H;
      sc.sun = { x: sx, y: sy };

      function layer(c, f, x0, y0, z) {
        c.style.width = (c.width / k) + 'px'; c.style.height = (c.height / k) + 'px';
        if (z !== undefined) c.style.zIndex = z;
        sc.el.appendChild(c);
        var L = { el: c, f: f, x0: x0, y0: y0, dx: 0, last: '' };
        sc.layers.push(L);
        return L;
      }
      function margin(f) { return Math.ceil(PX * f) + 2; }
      function vmargin(f) { return Math.ceil(PY * f) + 2; }

      // ---- sky
      var fS = 0.05, mS = margin(fS), vS = vmargin(fS);
      var sky = mk(W + 2 * mS, H + 2 * vS), g = sky.getContext('2d');
      var gr = g.createLinearGradient(0, 0, 0, sky.height);
      P.sky.forEach(function (st) { gr.addColorStop(st[0], st[1]); });
      g.fillStyle = gr; g.fillRect(0, 0, sky.width, sky.height);
      var glowC = P.sun.glow;
      var hr = g.createRadialGradient(sx + mS, sy + vS, 0, sx + mS, sy + vS, W * 0.75);
      hr.addColorStop(0, rgba(glowC, mood === 'night' ? 0.18 : 0.45 * P.sun.halo)); hr.addColorStop(0.35, rgba(glowC, mood === 'night' ? 0.06 : 0.16 * P.sun.halo)); hr.addColorStop(1, rgba(glowC, 0));
      g.fillStyle = hr; g.fillRect(0, 0, sky.width, sky.height);
      // horizon band glow
      var hb = g.createLinearGradient(0, H * 0.45, 0, H * 0.75);
      hb.addColorStop(0, rgba(glowC, 0)); hb.addColorStop(1, rgba(glowC, mood === 'day' ? 0.12 : 0.22));
      g.fillStyle = hb; g.fillRect(0, H * 0.45, sky.width, H * 0.4);
      if (P.stars) drawStars(g, sky.width, sky.height, P.stars, mood, rngC);
      dither(g, sky.width, sky.height, 3);
      layer(sky, fS, -mS, -vS, 0);

      // ---- back fx (twinkles, meteors) at half resolution
      var back = mk(W / 2, H / 2); back.style.zIndex = 1;
      layer(back, fS, 0, 0); back.style.width = (W / k) + 'px'; back.style.height = (H / k) + 'px';
      sc.back = back; sc.backCtx = back.getContext('2d'); sc.backDirty = true;

      // ---- sun / moon
      var sr = P.sun.r * u, sunSize = Math.round(sr * 9);
      var sunC = mk(sunSize, sunSize), sg = sunC.getContext('2d'), sc0 = sunSize / 2;
      var halo = sg.createRadialGradient(sc0, sc0, sr * 0.6, sc0, sc0, sc0);
      halo.addColorStop(0, rgba(glowC, 0.7 * P.sun.halo)); halo.addColorStop(0.18, rgba(glowC, 0.28 * P.sun.halo)); halo.addColorStop(0.5, rgba(glowC, 0.07 * P.sun.halo)); halo.addColorStop(1, rgba(glowC, 0));
      sg.fillStyle = halo; sg.fillRect(0, 0, sunSize, sunSize);
      if (P.sun.kind === 'sun') {
        var dg = sg.createRadialGradient(sc0, sc0, 0, sc0, sc0, sr);
        dg.addColorStop(0, P.sun.core); dg.addColorStop(0.7, P.sun.core); dg.addColorStop(1, P.sun.edge);
        sg.fillStyle = dg; sg.beginPath(); sg.arc(sc0, sc0, sr, 0, TAU); sg.fill();
        sg.globalCompositeOperation = 'lighter';
        var dg2 = sg.createRadialGradient(sc0, sc0, sr * 0.9, sc0, sc0, sr * 1.6);
        dg2.addColorStop(0, rgba(glowC, 0.6)); dg2.addColorStop(1, rgba(glowC, 0));
        sg.fillStyle = dg2; sg.beginPath(); sg.arc(sc0, sc0, sr * 1.6, 0, TAU); sg.fill();
        sg.globalCompositeOperation = 'source-over';
      } else {
        sg.fillStyle = 'rgba(150,175,230,0.16)'; sg.beginPath(); sg.arc(sc0, sc0, sr, 0, TAU); sg.fill();
        var mc = mk(sr * 2.4, sr * 2.4), mg = mc.getContext('2d'), m0 = sr * 1.2;
        var mgr = mg.createRadialGradient(m0 - sr * 0.3, m0 - sr * 0.3, 0, m0, m0, sr);
        mgr.addColorStop(0, '#fffdf0'); mgr.addColorStop(1, P.sun.edge);
        mg.fillStyle = mgr; mg.beginPath(); mg.arc(m0, m0, sr, 0, TAU); mg.fill();
        mg.globalCompositeOperation = 'destination-out';
        mg.beginPath(); mg.arc(m0 - sr * 0.42, m0 - sr * 0.22, sr * 0.92, 0, TAU); mg.fill();
        sg.drawImage(mc, sc0 - m0, sc0 - m0);
      }
      layer(sunC, 0.08, sx - sc0, sy - sc0, 1);

      // ---- clouds
      var cl = [];
      var towerW = 0.38 * W, towerH = 0.6 * H, towerCx = (mood === 'dawn' ? 0.62 : mood === 'dusk' ? 0.52 : 0.6) * W, towerBase = 0.63 * H;
      cl.push({ kind: 'tower', w: towerW, h: towerH, cx: towerCx, base: towerBase, z: 0.32, speed: 0, haze: 0.28 });
      var puffs = [
        { w: 0.17, y: 0.6, z: 0.25 }, { w: 0.2, y: 0.585, z: 0.4 }, { w: 0.24, y: 0.54, z: 0.6 },
        { w: 0.28, y: 0.5, z: 0.8 }, { w: 0.21, y: 0.53, z: 0.5 }
      ];
      puffs.forEach(function (p, i) {
        var w = p.w * W * (0.85 + rngC() * 0.3);
        var pcx = (i / puffs.length + rngC() * 0.15) * W * 1.2 - 0.1 * W;
        if (sy > 0.4 * H && Math.abs(pcx - sx) < (w * 0.5 + 0.08 * W)) pcx = sx + (pcx < sx ? -1 : 1) * (w * 0.5 + 0.1 * W);
        cl.push({ kind: 'puffy', w: w, h: w * 0.5, cx: pcx, base: p.y * H, z: p.z, speed: (2.5 + 9 * p.z) * u, haze: 0.5 - p.z * 0.4 });
      });
      for (var si = 0; si < 3; si++) {
        var sw = (0.22 + rngC() * 0.16) * W;
        cl.push({ kind: 'streak', w: sw, h: sw * 0.13, cx: rngC() * W, base: (0.08 + si * 0.055 + rngC() * 0.03) * H, z: 0.45 + si * 0.1, speed: (5 + 4 * si) * u, haze: 0.2, alpha: 0.55 });
      }
      cl.sort(function (a, b) { return a.z - b.z; });
      cl.forEach(function (c) {
        var cy = c.base - c.h * 0.4;
        var L = norm(sx - c.cx, sy - cy);
        var cv = renderPuffs(rngC, c.w, c.h, c.kind, P.cloud, L, u, c.haze);
        var pad = cv._pad;
        var x0 = c.cx - c.w / 2 - pad, y0 = c.base - cv._base - pad;
        if (c.alpha) cv.style.opacity = c.alpha;
        var f = 0.06 + 0.22 * c.z;
        var Ly = layer(cv, f, x0, y0, 1);
        Ly.cloud = c; c.layer = Ly; c.x = x0; c.dirPart = (c.cx > sx ? 1 : -1);
        sc.clouds.push(c);
      });

      // ---- rays (half res)
      var rays = mk(W / 2, H / 2); rays.style.zIndex = 1;
      layer(rays, 0.08, 0, 0); rays.style.width = (W / k) + 'px'; rays.style.height = (H / k) + 'px';
      sc.rays = rays; sc.raysCtx = rays.getContext('2d');

      // ---- far mountains
      var fF = 0.22, mF = margin(fF), vF = vmargin(fF);
      var far = mk(W + 2 * mF, H + vF), fg = far.getContext('2d');
      drawRange(fg, far.width, far.height, rngL, 0.6 * H, 0.1 * H, P.far1, sx + mF, 5, 0.52);
      drawRange(fg, far.width, far.height, rngL, 0.675 * H, 0.055 * H, P.far2, sx + mF, 6, 0.48);
      layer(far, fF, -mF, 0, 1);

      // ---- viaduct
      var fR = 0.42, mR = margin(fR), vR = vmargin(fR);
      var rail = mk(W + 2 * mR, H + vR), rg = rail.getContext('2d');
      var deckY = 0.735 * H;
      drawViaduct(rg, rail.width, rail.height, deckY, P.rail, sx + mR, u);
      layer(rail, fR, -mR, 0, 1);
      var tc = renderTrain(P.rail, u, mood);
      tc.style.visibility = 'hidden';
      sc.trainL = layer(tc, fR, -mR, deckY - tc._deck, 1);
      sc.trainL.train = true;
      sc.railW = rail.width; sc.trainLen = tc.width;

      // ---- hills + town
      var fH = 0.6, mH = margin(fH), vH = vmargin(fH);
      var hills = mk(W + 2 * mH, H + vH), hg = hills.getContext('2d');
      drawHills(hg, hills.width, hills.height, rngL, P, sx + mH, u, mood);
      layer(hills, fH, -mH, 0, 1);

      // ---- near foreground
      var fN = 1, mN = margin(fN), vN = vmargin(fN);
      var near = mk(W + 2 * mN, H + vN), ng = near.getContext('2d');
      drawNear(ng, near.width, near.height, rngL, P, sx + mN, sy, u, mN, mood);
      layer(near, fN, -mN, 0, 2);

      // ---- vignette
      var vg = el('div', 'vg', sc.el); vg.style.zIndex = 2;
      vg.style.background = 'radial-gradient(ellipse 75% 70% at 50% 45%, rgba(0,0,0,0) 55%, ' + P.vign + ' 100%)';
      return sc;
    }

    function drawStars(g, w, h, n, mood, rng) {
      var limit = mood === 'night' ? 0.8 : mood === 'dusk' ? 0.38 : 0.3;
      if (mood === 'night') {
        // milky band: soft colored clouds + dense dust
        var ax = 0.36 * w, ay = -0.05 * h, bx = 0.82 * w, by = 0.72 * h;
        g.save(); g.globalCompositeOperation = 'lighter';
        for (var b = 0; b < 46; b++) {
          var t = rng(), off = (rng() - 0.5) * 0.12 * w;
          var cx = ax + (bx - ax) * t + off, cy = ay + (by - ay) * t - off * 0.4;
          var rr = (0.04 + rng() * 0.07) * w;
          var col = rng() < 0.5 ? [120, 90, 200] : [70, 140, 210];
          var rg = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
          rg.addColorStop(0, rgba(col, 0.07)); rg.addColorStop(1, rgba(col, 0));
          g.fillStyle = rg; g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
        }
        for (var m = 0; m < 1400; m++) {
          var t2 = rng(), gs = (rng() + rng() + rng() - 1.5) * 0.09 * w;
          var x2 = ax + (bx - ax) * t2 + gs, y2 = ay + (by - ay) * t2 - gs * 0.4;
          g.fillStyle = 'rgba(220,230,255,' + (0.15 + rng() * 0.45) + ')';
          g.fillRect(x2, y2, rng() < 0.85 ? 1 : 1.6, rng() < 0.85 ? 1 : 1.6);
        }
        g.restore();
      }
      for (var i = 0; i < n; i++) {
        var x = rng() * w, y = Math.pow(rng(), 1.4) * h * limit;
        var fade = 1 - y / (h * limit);
        var big = rng();
        var a = (0.25 + rng() * 0.75) * fade;
        var col2 = rng() < 0.2 ? '255,220,200' : rng() < 0.4 ? '200,220,255' : '255,255,255';
        if (big > 0.985) {
          var r2 = (2.2 + rng() * 2) * u;
          var sg2 = g.createRadialGradient(x, y, 0, x, y, r2 * 4);
          sg2.addColorStop(0, 'rgba(' + col2 + ',' + a + ')'); sg2.addColorStop(0.2, 'rgba(' + col2 + ',' + a * 0.4 + ')'); sg2.addColorStop(1, 'rgba(' + col2 + ',0)');
          g.fillStyle = sg2; g.fillRect(x - r2 * 4, y - r2 * 4, r2 * 8, r2 * 8);
          g.fillStyle = 'rgba(' + col2 + ',' + a * 0.6 + ')';
          g.fillRect(x - r2 * 4, y - 0.5, r2 * 8, 1); g.fillRect(x - 0.5, y - r2 * 4, 1, r2 * 8);
        } else {
          g.fillStyle = 'rgba(' + col2 + ',' + a + ')';
          var s = big > 0.9 ? 2 * u : 1.2 * u;
          g.fillRect(x, y, s, s);
        }
      }
    }

    function drawRange(g, w, h, rng, yb, amp, C, sunX, n, rough) {
      var v = mpd(rng, n, rough), N = v.length - 1, pts = [], i;
      for (i = 0; i <= N; i++) pts.push({ x: (i / N) * w, y: yb - v[i] * amp });
      g.save();
      g.beginPath(); g.moveTo(0, h); for (i = 0; i <= N; i++) g.lineTo(pts[i].x, pts[i].y); g.lineTo(w, h); g.closePath();
      g.fillStyle = C.base; g.fill();
      g.clip();
      // faceted lit faces: from each peak down its sun-facing slope
      g.fillStyle = C.lit;
      for (i = 1; i < N; i++) {
        if (!(pts[i].y < pts[i - 1].y && pts[i].y < pts[i + 1].y)) continue;
        var dir = sunX > pts[i].x ? 1 : -1, j = i;
        while (j + dir > 0 && j + dir < N && pts[j + dir].y >= pts[j].y) j += dir;
        if (Math.abs(j - i) < 1) continue;
        g.beginPath(); g.moveTo(pts[i].x, pts[i].y);
        for (var q = i + dir; dir > 0 ? q <= j : q >= j; q += dir) g.lineTo(pts[q].x, pts[q].y);
        var depth = (pts[j].y - pts[i].y);
        g.lineTo(pts[j].x - dir * Math.abs(pts[j].x - pts[i].x) * 0.15, pts[j].y + depth * 0.5);
        g.lineTo(pts[i].x + (pts[j].x - pts[i].x) * 0.3, pts[j].y + depth * 0.9);
        g.closePath(); g.fill();
      }
      var hz = hex(C.haze);
      var gr = g.createLinearGradient(0, yb - amp, 0, yb + 0.06 * h);
      gr.addColorStop(0, rgba(hz, 0)); gr.addColorStop(0.55, rgba(hz, 0.25)); gr.addColorStop(1, rgba(hz, 0.85));
      g.fillStyle = gr; g.fillRect(0, yb - amp, w, h);
      g.restore();
    }

    function drawViaduct(g, w, h, deckY, C, sunX, u) {
      var span = 112 * u, pier = 22 * u, bottom = deckY + 260 * u, ar = (span - pier) / 2, top = deckY + 36 * u;
      var wall = mk(w, h), wg = wall.getContext('2d');
      wg.fillStyle = C.wall; wg.fillRect(0, deckY - 4 * u, w, bottom - deckY);
      wg.globalCompositeOperation = 'destination-out';
      for (var x = -span / 2; x < w + span; x += span) {
        var cx = x + span / 2;
        wg.beginPath(); wg.arc(cx, top + ar, ar, Math.PI, 0); wg.lineTo(cx + ar, bottom + 10); wg.lineTo(cx - ar, bottom + 10); wg.closePath(); wg.fill();
      }
      wg.globalCompositeOperation = 'source-atop';
      // lit pier faces + arch soffit shading
      var dir = 1;
      for (x = -span / 2; x < w + span; x += span) {
        var px = x + span / 2 + ar;          // right pier start
        dir = sunX > px ? 1 : -1;
        wg.fillStyle = C.lit; wg.globalAlpha = 0.7;
        wg.fillRect(dir > 0 ? px + pier - 5 * u : px, top + ar * 0.6, 5 * u, bottom - top);
        wg.globalAlpha = 1;
      }
      wg.fillStyle = C.dark; wg.fillRect(0, deckY + 22 * u, w, 7 * u);
      wg.fillStyle = C.lit; wg.fillRect(0, deckY - 4 * u, w, 3 * u);
      var hz = hex(C.haze), gr = wg.createLinearGradient(0, deckY, 0, bottom);
      gr.addColorStop(0, rgba(hz, 0)); gr.addColorStop(1, rgba(hz, 0.75));
      wg.fillStyle = gr; wg.fillRect(0, deckY, w, bottom - deckY);
      g.drawImage(wall, 0, 0);
      // railing + catenary
      g.fillStyle = C.dark;
      g.fillRect(0, deckY - 9 * u, w, 2 * u);
      for (x = 0; x < w; x += 14 * u) g.fillRect(x, deckY - 9 * u, 1.5 * u, 6 * u);
      for (x = 60 * u; x < w; x += 224 * u) {
        g.fillRect(x, deckY - 52 * u, 3 * u, 48 * u);
        g.fillRect(x - 14 * u, deckY - 50 * u, 20 * u, 2.5 * u);
      }
      g.strokeStyle = C.dark; g.lineWidth = 1.2 * u; g.beginPath();
      for (x = 60 * u; x < w; x += 224 * u) { g.moveTo(x - 10 * u, deckY - 47 * u); g.quadraticCurveTo(x + 102 * u, deckY - 42 * u, x + 214 * u, deckY - 47 * u); }
      g.stroke();
    }

    function renderTrain(C, u, mood) {
      var cars = 5, cl = 150 * u, gap = 5 * u, ch = 27 * u, beam = mood === 'night' || mood === 'dusk' ? 240 * u : 0;
      var len = cars * cl + (cars - 1) * gap, hgt = 64 * u;
      var c = mk(len + beam + 10 * u, hgt), g = c.getContext('2d');
      var base = hgt - 6 * u, topY = base - ch;
      for (var i = 0; i < cars; i++) {
        var x0 = i * (cl + gap), lead = i === cars - 1;
        // bogies
        g.fillStyle = '#1c1f2a';
        g.fillRect(x0 + 14 * u, base, 26 * u, 5 * u); g.fillRect(x0 + cl - 40 * u, base, 26 * u, 5 * u);
        // body
        g.beginPath();
        var rr = 5 * u, nose = lead ? 22 * u : rr;
        g.moveTo(x0 + rr, topY); g.lineTo(x0 + cl - nose, topY);
        g.quadraticCurveTo(x0 + cl, topY, x0 + cl, topY + (lead ? ch * 0.7 : rr));
        g.lineTo(x0 + cl, base); g.lineTo(x0, base); g.lineTo(x0, topY + rr); g.quadraticCurveTo(x0, topY, x0 + rr, topY);
        g.closePath();
        var bg = g.createLinearGradient(0, topY, 0, base); bg.addColorStop(0, C.body); bg.addColorStop(1, C.body2);
        g.fillStyle = bg; g.fill();
        g.save(); g.clip();
        g.fillStyle = C.roof; g.fillRect(x0, topY, cl, 4 * u);
        g.fillStyle = C.stripe; g.fillRect(x0, base - 9 * u, cl, 4 * u);
        g.fillStyle = C.lit; g.globalAlpha = 0.8; g.fillRect(x0, topY, cl, 1.6 * u); g.globalAlpha = 1;
        g.restore();
        // windows
        g.save();
        if (C.lit_) { g.shadowColor = C.win; g.shadowBlur = 10 * u; }
        g.fillStyle = C.win;
        for (var wx = x0 + 12 * u; wx < x0 + cl - (lead ? 34 : 16) * u; wx += 17 * u) g.fillRect(wx, topY + 7 * u, 11 * u, 8 * u);
        if (lead) { g.beginPath(); g.moveTo(x0 + cl - 24 * u, topY + 6 * u); g.lineTo(x0 + cl - 9 * u, topY + 6 * u); g.lineTo(x0 + cl - 3 * u, topY + 15 * u); g.lineTo(x0 + cl - 24 * u, topY + 15 * u); g.fill(); }
        g.restore();
        // pantograph
        if (i === 1 || i === 3) {
          g.strokeStyle = '#2a2d38'; g.lineWidth = 1.4 * u; g.beginPath();
          g.moveTo(x0 + cl * 0.4, topY); g.lineTo(x0 + cl * 0.5, topY - 12 * u); g.lineTo(x0 + cl * 0.6, topY);
          g.moveTo(x0 + cl * 0.42, topY - 12 * u); g.lineTo(x0 + cl * 0.58, topY - 12 * u); g.stroke();
        }
      }
      // headlight + beam
      var hx = len - 2 * u, hy = base - 8 * u;
      g.save(); g.globalCompositeOperation = 'lighter';
      var hl = g.createRadialGradient(hx, hy, 0, hx, hy, 14 * u);
      hl.addColorStop(0, 'rgba(255,250,220,1)'); hl.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = hl; g.fillRect(hx - 14 * u, hy - 14 * u, 28 * u, 28 * u);
      if (beam) {
        var bmg = g.createLinearGradient(hx, 0, hx + beam, 0);
        bmg.addColorStop(0, 'rgba(255,236,190,0.45)'); bmg.addColorStop(1, 'rgba(255,236,190,0)');
        g.fillStyle = bmg; g.beginPath(); g.moveTo(hx, hy - 2 * u); g.lineTo(hx + beam, hy - 16 * u); g.lineTo(hx + beam, hy + 12 * u); g.closePath(); g.fill();
      }
      g.restore();
      c._deck = hgt - 2 * u; c._len = len;
      return c;
    }

    function hillY(x, w, h, ph) {
      return h * 0.772 + h * 0.016 * Math.sin(x / w * 5.3 + ph) + h * 0.011 * Math.sin(x / w * 12.1 + ph * 2.3) + h * 0.012 * Math.sin(x / w * 2.1 + 0.5);
    }

    function drawHills(g, w, h, rng, P, sunX, u, mood) {
      var C = P.hills, ph = 1.7, x, i;
      function path(dy) {
        g.beginPath(); g.moveTo(0, h);
        for (x = 0; x <= w; x += 8 * u) g.lineTo(x, hillY(x, w, h, ph) + dy);
        g.lineTo(w, h); g.closePath();
      }
      path(0); g.fillStyle = C.lit; g.fill();
      path(7 * u); g.fillStyle = C.base; g.fill();
      // fields: soft cel tone bands
      g.save(); path(7 * u); g.clip();
      for (i = 0; i < 9; i++) {
        var fx0 = rng() * w, fw = (80 + rng() * 260) * u, fy = h * (0.8 + rng() * 0.12), fh = (8 + rng() * 14) * u;
        g.fillStyle = rng() < 0.5 ? C.field : C.dark; g.globalAlpha = 0.55;
        g.beginPath(); g.moveTo(fx0, fy); g.lineTo(fx0 + fw, fy - fh * 0.3); g.lineTo(fx0 + fw + 20 * u, fy + fh); g.lineTo(fx0 + 10 * u, fy + fh * 1.2); g.closePath(); g.fill();
      }
      g.globalAlpha = 1;
      var hz = hex(C.haze), gr = g.createLinearGradient(0, h * 0.75, 0, h * 0.95);
      gr.addColorStop(0, rgba(hz, 0.35)); gr.addColorStop(1, rgba(hz, 0));
      g.fillStyle = gr; g.fillRect(0, h * 0.7, w, h * 0.3);
      g.restore();

      // tree clumps on the right
      var trees = [];
      for (i = 0; i < 14; i++) {
        var tx = w * (0.44 + rng() * 0.56), tw = (40 + rng() * 60) * u;
        trees.push({ x: tx, w: tw, y: hillY(tx, w, h, ph) + (rng() * 10) * u });
      }
      // a few behind houses on the left too
      for (i = 0; i < 6; i++) { var tx2 = w * (0.02 + rng() * 0.4); trees.push({ x: tx2, w: (34 + rng() * 40) * u, y: hillY(tx2, w, h, ph) + 2 * u }); }
      trees.sort(function (a, b) { return a.y - b.y; });
      trees.forEach(function (t) {
        var L = norm(sunX - t.x, -0.6 * h);
        var cv = renderPuffs(rng, t.w, t.w * 0.95, 'canopy', P.tree, L, u, 0.25);
        g.fillStyle = P.near.trunk; g.fillRect(t.x - 2 * u, t.y - t.w * 0.3, 4 * u, t.w * 0.35);
        g.drawImage(cv, t.x - cv.width / 2, t.y - t.w * 0.95 * 0.88 - cv._pad);
      });

      // town
      var houses = [];
      for (i = 0; i < 34; i++) {
        var hx = w * (0.03 + rng() * 0.42), depth = rng();
        houses.push({ x: hx, d: depth, y: hillY(hx, w, h, ph) + (4 + depth * 46) * u, s: 0.75 + depth * 0.55 });
      }
      houses.sort(function (a, b) { return a.y - b.y; });
      houses.forEach(function (hh) {
        var s = hh.s * u, bw = (26 + rng() * 26) * s, bh = (16 + rng() * 14) * s, rh = (10 + rng() * 8) * s, side = (8 + rng() * 8) * s;
        var x0 = hh.x, y0 = hh.y, lit = sunX > x0 ? 1 : -1;
        var wall = C.walls[(rng() * C.walls.length) | 0], roof = C.roofs[(rng() * C.roofs.length) | 0];
        // side face
        g.fillStyle = C.shade;
        var sx0 = lit > 0 ? x0 - side : x0 + bw;
        g.fillRect(sx0, y0 - bh, side, bh);
        g.fillStyle = wall; g.fillRect(x0, y0 - bh, bw, bh);
        // roof (gable seen from the side)
        g.fillStyle = roof;
        g.beginPath(); g.moveTo(x0 - 3 * s, y0 - bh); g.lineTo(x0 + bw + 3 * s, y0 - bh); g.lineTo(x0 + bw * 0.5 + (lit > 0 ? 6 : -6) * s, y0 - bh - rh); g.lineTo(x0 + bw * 0.5 - (lit > 0 ? 6 : -6) * s, y0 - bh - rh); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.beginPath(); g.moveTo(x0 + bw * 0.5, y0 - bh - rh); g.lineTo(x0 + bw * 0.5 + (lit > 0 ? 6 : -6) * s, y0 - bh - rh); g.lineTo(lit > 0 ? x0 + bw + 3 * s : x0 - 3 * s, y0 - bh); g.lineTo(x0 + bw * 0.5, y0 - bh); g.closePath(); g.fill();
        // gable end triangle on side face
        g.fillStyle = C.shade;
        g.beginPath(); g.moveTo(sx0, y0 - bh); g.lineTo(sx0 + side, y0 - bh); g.lineTo(sx0 + side / 2, y0 - bh - rh * 0.7); g.closePath(); g.fill();
        // windows
        var nw = Math.max(1, Math.round(bw / (12 * s)));
        for (var wi = 0; wi < nw; wi++) {
          var on = rng() < C.winLit;
          g.save();
          if (on) { g.shadowColor = C.win; g.shadowBlur = 9 * u; g.fillStyle = C.win; } else g.fillStyle = mood === 'day' ? C.win : 'rgba(0,0,0,0.25)';
          if (mood !== 'day' && !on) g.fillStyle = 'rgba(10,10,30,0.35)';
          if (mood === 'day') g.fillStyle = C.win;
          g.fillRect(x0 + (wi + 0.5) * bw / nw - 2.6 * s, y0 - bh * 0.66, 5.2 * s, 5.5 * s);
          g.restore();
        }
      });
      // street lamps at night
      if (mood === 'night' || mood === 'dusk') {
        for (i = 0; i < 9; i++) {
          var lx = w * (0.04 + rng() * 0.42), ly = hillY(lx, w, h, ph) + (10 + rng() * 40) * u;
          var lg = g.createRadialGradient(lx, ly, 0, lx, ly, 26 * u);
          lg.addColorStop(0, 'rgba(255,220,150,0.9)'); lg.addColorStop(0.15, 'rgba(255,200,120,0.35)'); lg.addColorStop(1, 'rgba(255,190,110,0)');
          g.fillStyle = lg; g.fillRect(lx - 26 * u, ly - 26 * u, 52 * u, 52 * u);
        }
      }
      // water tower
      var wtx = w * 0.4, wty = hillY(wtx, w, h, ph) + 6 * u;
      g.fillStyle = P.near.pole;
      g.fillRect(wtx - 12 * u, wty - 56 * u, 2.5 * u, 56 * u); g.fillRect(wtx + 10 * u, wty - 56 * u, 2.5 * u, 56 * u);
      g.fillRect(wtx - 12 * u, wty - 30 * u, 24 * u, 2 * u);
      g.fillStyle = C.walls[2] || C.walls[0];
      g.beginPath(); g.ellipse(wtx, wty - 70 * u, 19 * u, 15 * u, 0, 0, TAU); g.fill();
      g.fillStyle = C.shade; g.beginPath(); g.ellipse(wtx + (sunX > wtx ? -6 : 6) * u, wty - 68 * u, 13 * u, 13 * u, 0, 0, TAU); g.fill();
      g.fillStyle = C.roofs[1]; g.beginPath(); g.moveTo(wtx - 21 * u, wty - 78 * u); g.lineTo(wtx, wty - 96 * u); g.lineTo(wtx + 21 * u, wty - 78 * u); g.closePath(); g.fill();
      if (mood === 'night' || mood === 'dusk') {
        var rl = g.createRadialGradient(wtx, wty - 97 * u, 0, wtx, wty - 97 * u, 12 * u);
        rl.addColorStop(0, 'rgba(255,80,70,0.95)'); rl.addColorStop(1, 'rgba(255,60,60,0)');
        g.fillStyle = rl; g.fillRect(wtx - 12 * u, wty - 109 * u, 24 * u, 24 * u);
      }
    }

    function nearY(x, w, h) {
      var t = x / w;
      return h * (0.945 - 0.11 * smooth(t * 1.1 - 0.05)) + h * 0.008 * Math.sin(t * 17) + h * 0.005 * Math.sin(t * 41 + 1);
    }

    function drawNear(g, w, h, rng, P, sunX, sunY, u, m, mood) {
      var C = P.near, x, i;
      function path(dy) { g.beginPath(); g.moveTo(0, h); for (x = 0; x <= w; x += 6 * u) g.lineTo(x, nearY(x, w, h) + dy); g.lineTo(w, h); g.closePath(); }
      // wires (behind the tree, in front of everything else)
      var poleX = m + 0.17 * (w - 2 * m), poleBase = nearY(poleX, w, h), poleTop = 0.52 * h;
      g.strokeStyle = C.wire; g.lineWidth = 1.6 * u;
      for (i = 0; i < 3; i++) {
        var oy = i * 9 * u, ax = (i - 1) * 26 * u;
        g.beginPath(); g.moveTo(-10, 0.47 * h + oy); g.quadraticCurveTo(poleX * 0.5, 0.52 * h + oy + 30 * u, poleX + ax, poleTop + 6 * u + oy * 0.4);
        g.quadraticCurveTo((poleX + w) * 0.55, poleTop + 70 * u + oy, w + 10, 0.55 * h + oy);
        g.stroke();
      }
      // hill
      path(0); g.fillStyle = C.rim; g.fill();
      path(5 * u); g.fillStyle = C.lit; g.fill();
      path(22 * u); g.fillStyle = C.base; g.fill();
      // soft shadow gradient toward the bottom
      g.save(); path(0); g.clip();
      var gb = g.createLinearGradient(0, h * 0.85, 0, h); gb.addColorStop(0, 'rgba(0,0,0,0)'); gb.addColorStop(1, 'rgba(0,0,10,0.3)');
      g.fillStyle = gb; g.fillRect(0, h * 0.8, w, h * 0.2);
      g.restore();
      // grass blades along the crest
      for (x = 0; x < w; x += 4.5 * u) {
        var y = nearY(x, w, h) + 4 * u, bh = (8 + rng() * 20) * u * (0.6 + 0.6 * (x / w)), lean = (rng() - 0.35) * 8 * u;
        g.fillStyle = rng() < 0.45 ? C.grassHi : (rng() < 0.5 ? C.lit : C.grass);
        g.beginPath(); g.moveTo(x - 2.4 * u, y); g.quadraticCurveTo(x + lean * 0.3, y - bh * 0.6, x + lean, y - bh); g.quadraticCurveTo(x + lean * 0.4 + 1 * u, y - bh * 0.5, x + 2.6 * u, y); g.closePath(); g.fill();
      }
      // flowers
      if (C.flowers.length) {
        for (i = 0; i < 90; i++) {
          var fx0 = rng() * w, fy0 = nearY(fx0, w, h) + (6 + rng() * 60) * u;
          g.fillStyle = C.flowers[(rng() * C.flowers.length) | 0];
          g.beginPath(); g.arc(fx0, fy0, (1.6 + rng() * 1.8) * u, 0, TAU); g.fill();
        }
      }
      // telephone pole
      var lit = sunX > poleX ? 1 : -1;
      g.fillStyle = C.pole; g.fillRect(poleX - 5 * u, poleTop, 10 * u, poleBase - poleTop + 10 * u);
      g.fillStyle = C.poleLit; g.fillRect(lit > 0 ? poleX + 2.5 * u : poleX - 5 * u, poleTop, 2.5 * u, poleBase - poleTop);
      g.fillStyle = C.pole;
      g.fillRect(poleX - 36 * u, poleTop + 6 * u, 72 * u, 5 * u);
      g.fillRect(poleX - 26 * u, poleTop + 34 * u, 52 * u, 4 * u);
      for (i = -1; i <= 1; i++) { g.fillRect(poleX + i * 26 * u - 2.5 * u, poleTop + 1 * u, 5 * u, 6 * u); }
      g.fillRect(poleX + 6 * u, poleTop + 60 * u, 16 * u, 22 * u); // transformer box
      g.fillStyle = C.poleLit; g.fillRect(poleX + (lit > 0 ? 19 : 6) * u, poleTop + 60 * u, 3 * u, 22 * u);
      // big framing tree, right edge
      var tx = w - m - 0.06 * (w - 2 * m), ty = nearY(tx, w, h) + 8 * u;
      var tw = 0.36 * w, th = 0.5 * h, crownY = ty - th * 0.62;
      function trunk(col, off, wid) {
        g.fillStyle = col; trunkPath(off, wid); g.fill();
      }
      function trunkPath(off, wid) {
        g.beginPath();
        g.moveTo(tx - 30 * u + off, ty + 12 * u);
        g.bezierCurveTo(tx - 10 * u + off, ty - th * 0.2, tx - 24 * u + off, crownY + 40 * u, tx - 40 * u + off, crownY);
        g.lineTo(tx - 40 * u + off + wid * 0.55, crownY);
        g.bezierCurveTo(tx + 6 * u + off, crownY + 50 * u, tx + 8 * u + off, ty - th * 0.2, tx - 30 * u + off + wid, ty + 12 * u);
        g.closePath();
      }
      // cel-lit trunk: lit tone, then the body shifted away from the light leaves a lit sliver
      g.save(); trunkPath(0, 52 * u); g.clip();
      g.fillStyle = C.trunkLit; g.fill();
      trunk(C.trunk, -lit * 9 * u, 52 * u);
      g.restore();
      g.strokeStyle = C.trunk; g.lineCap = 'round';
      g.lineWidth = 12 * u; g.beginPath(); g.moveTo(tx - 22 * u, crownY + 60 * u); g.quadraticCurveTo(tx - 90 * u, crownY + 10 * u, tx - 150 * u, crownY - 10 * u); g.stroke();
      g.lineWidth = 9 * u; g.beginPath(); g.moveTo(tx - 12 * u, crownY + 40 * u); g.quadraticCurveTo(tx + 40 * u, crownY - 10 * u, tx + 80 * u, crownY - 60 * u); g.stroke();
      var L = norm(sunX - tx, sunY - crownY);
      var cv = renderPuffs(rng, tw, th * 0.62, 'canopy', P.tree2, L, u, 0);
      g.drawImage(cv, tx - tw * 0.52 - cv._pad, crownY - th * 0.62 * 0.62 - cv._pad);
      var cv2 = renderPuffs(rng, tw * 0.75, th * 0.5, 'canopy', P.tree2, L, u, 0);
      g.drawImage(cv2, tx - tw * 0.12 - cv2._pad, crownY - th * 0.62 * 0.95 - cv2._pad);
    }

    // ------------------------------------------------------------ sprites
    function makeSprites(P) {
      var S = {}, s = Math.round(26 * u);
      function petal(c1, c2) {
        var c = mk(s, s), x = c.getContext('2d');
        x.translate(s / 2, s / 2);
        x.beginPath(); x.moveTo(0, s * 0.42);
        x.bezierCurveTo(s * 0.44, s * 0.18, s * 0.36, -s * 0.36, s * 0.1, -s * 0.44);
        x.lineTo(0, -s * 0.3); x.lineTo(-s * 0.1, -s * 0.44);
        x.bezierCurveTo(-s * 0.36, -s * 0.36, -s * 0.44, s * 0.18, 0, s * 0.42); x.closePath();
        x.fillStyle = c2; x.fill();
        x.save(); x.clip(); x.beginPath(); x.ellipse(-s * 0.14, -s * 0.06, s * 0.3, s * 0.46, -0.25, 0, TAU); x.fillStyle = c1; x.fill(); x.restore();
        return c;
      }
      function leaf(c1, c2) {
        var c = mk(s, s), x = c.getContext('2d');
        x.translate(s / 2, s / 2); x.rotate(0.6);
        x.beginPath(); x.moveTo(0, -s * 0.45); x.quadraticCurveTo(s * 0.32, 0, 0, s * 0.45); x.quadraticCurveTo(-s * 0.32, 0, 0, -s * 0.45);
        x.fillStyle = c2; x.fill();
        x.beginPath(); x.moveTo(0, -s * 0.45); x.quadraticCurveTo(s * 0.32, 0, 0, s * 0.45); x.lineTo(0, -s * 0.45); x.fillStyle = c1; x.fill();
        return c;
      }
      function glow(r, col, core) {
        var c = mk(r * 2, r * 2), x = c.getContext('2d');
        var gr = x.createRadialGradient(r, r, 0, r, r, r);
        gr.addColorStop(0, core); gr.addColorStop(0.18, rgba(col, 0.75)); gr.addColorStop(0.45, rgba(col, 0.18)); gr.addColorStop(1, rgba(col, 0));
        x.fillStyle = gr; x.fillRect(0, 0, r * 2, r * 2);
        return c;
      }
      function sparkle(r, col) {
        var c = mk(r * 2, r * 2), x = c.getContext('2d');
        var gr = x.createRadialGradient(r, r, 0, r, r, r * 0.6);
        gr.addColorStop(0, rgba(col, 0.9)); gr.addColorStop(1, rgba(col, 0));
        x.fillStyle = gr; x.fillRect(0, 0, r * 2, r * 2);
        x.fillStyle = 'rgba(255,255,255,0.95)';
        x.beginPath();
        x.moveTo(r, 0); x.lineTo(r + r * 0.09, r - r * 0.09); x.lineTo(r * 2, r); x.lineTo(r + r * 0.09, r + r * 0.09);
        x.lineTo(r, r * 2); x.lineTo(r - r * 0.09, r + r * 0.09); x.lineTo(0, r); x.lineTo(r - r * 0.09, r - r * 0.09); x.closePath(); x.fill();
        return c;
      }
      function ghost(r, col, ring) {
        var c = mk(r * 2, r * 2), x = c.getContext('2d');
        var gr = x.createRadialGradient(r, r, ring ? r * 0.7 : 0, r, r, r);
        if (ring) { gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.7, rgba(col, 0.35)); gr.addColorStop(1, rgba(col, 0)); }
        else { gr.addColorStop(0, rgba(col, 0.3)); gr.addColorStop(0.75, rgba(col, 0.18)); gr.addColorStop(1, rgba(col, 0)); }
        x.fillStyle = gr; x.beginPath();
        for (var i = 0; i < 6; i++) { var a = i / 6 * TAU + 0.3; x.lineTo(r + Math.cos(a) * r, r + Math.sin(a) * r); }
        x.closePath(); x.fill();
        return c;
      }
      S.petalA = petal(P.petal[0], P.petal[1]);
      S.petalB = petal('#ffffff', P.petal[0]);
      S.leafA = leaf(P.petal[0], P.petal[1]);
      S.leafB = leaf('#ffd890', '#d0703c');
      S.mote = glow(Math.round(12 * u), [255, 210, 150], 'rgba(255,245,220,1)');
      S.fly = glow(Math.round(22 * u), [200, 255, 120], 'rgba(255,255,220,1)');
      S.spark = sparkle(Math.round(16 * u), P.flare);
      S.sparkBig = sparkle(Math.round(30 * u), P.flare);
      S.g1 = ghost(Math.round(60 * u), P.flare, false);
      S.g2 = ghost(Math.round(26 * u), [140, 200, 255], false);
      S.g3 = ghost(Math.round(110 * u), P.flare, true);
      S.g4 = ghost(Math.round(40 * u), [255, 140, 200], false);
      var hz = mk(Math.round(400 * u), Math.round(40 * u)), hx = hz.getContext('2d');
      var hg = hx.createLinearGradient(0, 0, hz.width, 0);
      hg.addColorStop(0, rgba(P.flare, 0)); hg.addColorStop(0.5, rgba(P.flare, 0.45)); hg.addColorStop(1, rgba(P.flare, 0));
      hx.fillStyle = hg; hx.fillRect(0, hz.height / 2 - 1.5 * u, hz.width, 3 * u);
      S.streak = hz;
      return S;
    }

    // ------------------------------------------------------------ particles
    function ambientCount() {
      var n = curMood === 'night' ? 46 : 70;
      if (api.calm()) n = Math.round(n * 0.5);
      if (reduced) n = Math.round(n * 0.25);
      return n;
    }
    function spawn(p, initial) {
      var kind = PAL[curMood].part;
      p.kind = kind === 'dusk' ? (R() < 0.6 ? 'mote' : 'leaf') : kind;
      p.z = 0.45 + R() * 0.9;
      p.ph = R() * TAU; p.life = 0; p.max = 0; p.alpha = 1;
      if (p.kind === 'firefly') {
        p.x = R() * W; p.y = H * (0.5 + R() * 0.46);
        p.vx = (R() - 0.5) * 12 * u; p.vy = (R() - 0.5) * 8 * u;
        p.blink = 0.4 + R() * 0.9;
      } else if (p.kind === 'mote') {
        p.x = R() * W; p.y = initial ? H * (0.3 + R() * 0.7) : H + 20 * u;
        p.vx = (6 + R() * 10) * u; p.vy = -(6 + R() * 14) * u;
      } else {
        if (initial) { p.x = R() * W; p.y = R() * H; }
        else if (R() < 0.55) { p.x = -30 * u; p.y = R() * H * 0.85; }
        else { p.x = R() * W * 0.9; p.y = -30 * u; }
        p.vx = (28 + R() * 40) * u * p.z; p.vy = (14 + R() * 18) * u * p.z;
        p.rot = R() * TAU; p.vr = (R() - 0.5) * 2.4; p.flip = R() * TAU; p.vf = 1.5 + R() * 3;
        p.spr = p.kind === 'leaf' ? (R() < 0.5 ? 'leafA' : 'leafB') : (R() < 0.6 ? 'petalA' : 'petalB');
      }
      if (reduced) { p.vx *= 0.3; p.vy *= 0.3; }
      return p;
    }
    function fillParticles() {
      var n = ambientCount();
      while (parts.length < n) parts.push(spawn({}, true));
      if (parts.length > n) parts.length = n;
    }
    function burst(x, y, n) {
      for (var i = 0; i < n; i++) {
        var p = spawn({}, true), a = R() * TAU, sp = (60 + R() * 220) * u;
        p.x = x + Math.cos(a) * 20 * u; p.y = y + Math.sin(a) * 20 * u;
        p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - 40 * u;
        p.max = 5 + R() * 4; p.burst = true;
        if (p.kind === 'firefly') { p.max = 7 + R() * 5; }
        extra.push(p);
      }
    }
    function sparkles(x, y, w, h, n) {
      for (var i = 0; i < n; i++) {
        extra.push({ kind: 'spark', x: x + R() * w, y: y + R() * h, vx: (R() - 0.5) * 30 * u, vy: -(10 + R() * 30) * u, life: 0, max: 1.2 + R() * 1.4, z: 0.5 + R() * 0.8, ph: R() * TAU, burst: true });
      }
    }

    function stepParticle(p, dt) {
      var i, gx = 0, gy = 0;
      for (i = 0; i < gusts.length; i++) {
        var G = gusts[i], age = T - G.t0, env = smooth(age / 0.4) * (1 - smooth((age - 1.2) / G.dur));
        if (env <= 0) continue;
        var dx = p.x - G.x, dy = p.y - G.y, d2 = dx * dx + dy * dy, R2 = G.r * G.r;
        if (d2 > R2 * 4) continue;
        var f = Math.exp(-d2 / R2) * env * G.s, d = Math.sqrt(d2) || 1;
        gx += (-dy / d) * f + (dx / d) * f * 0.35; gy += (dx / d) * f + (dy / d) * f * 0.35 - f * 0.3;
      }
      if (p.kind === 'firefly') {
        p.ph += dt * p.blink;
        p.vx += (Math.sin(T * 0.7 + p.ph * 3) * 8 * u - p.vx * 0.5) * dt + gx * dt;
        p.vy += (Math.cos(T * 0.5 + p.ph * 2) * 6 * u - p.vy * 0.5) * dt + gy * dt;
      } else if (p.kind === 'mote') {
        p.ph += dt;
        p.vx += (gx - (p.vx - 10 * u)) * dt; p.vy += (gy - (p.vy + 10 * u) * 0.5) * dt;
      } else if (p.kind === 'spark') {
        p.vy += 4 * u * dt;
      } else {
        var wind = (36 + 18 * Math.sin(T * 0.23 + p.z)) * u * p.z;
        p.vx += ((wind - p.vx) * 0.6 + gx) * dt;
        p.vy += ((20 * u * p.z - p.vy) * 0.6 + gy + Math.sin(T * 1.3 + p.ph) * 18 * u) * dt;
        p.rot += p.vr * dt; p.flip += p.vf * dt;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.max) { p.life += dt; p.alpha = Math.min(1, p.life * 3) * (1 - smooth((p.life - p.max * 0.6) / (p.max * 0.4))); }
    }

    function outOf(p) {
      if (p.kind === 'firefly') return p.x < -60 * u || p.x > W + 60 * u || p.y < H * 0.25 || p.y > H + 40 * u;
      if (p.kind === 'mote') return p.y < H * 0.15 || p.x > W + 30 * u;
      return p.x > W + 40 * u || p.y > H + 40 * u || p.x < -80 * u || p.y < -120 * u;
    }

    // ------------------------------------------------------------ events
    function startTrain(midway) {
      if (train.active || !scene) return;
      train.active = true; train.dir = R() < 0.5 ? 1 : -1;
      train.speed = (api.calm() ? 150 : 230) * u;
      var span = scene.railW + scene.trainLen;
      train.x = train.dir > 0 ? -scene.trainLen : scene.railW;
      if (midway) train.x += train.dir * span * (0.35 + R() * 0.2);
    }
    function meteor(opts) {
      opts = opts || {};
      var a = opts.angle !== undefined ? opts.angle : (Math.PI * (0.78 + R() * 0.12));
      var sp = (900 + R() * 700) * u * (api.calm() ? 0.7 : 1);
      var x = opts.x !== undefined ? opts.x : W * (0.3 + R() * 0.65), y = opts.y !== undefined ? opts.y : H * (R() * 0.3);
      meteors.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.9 + R() * 0.7, len: (140 + R() * 200) * u, a: opts.alpha || (api.calm() ? 0.55 : 1), w: opts.w || 1 });
    }
    function flock(big) {
      var n = big ? 9 : 4 + ((R() * 4) | 0), dir = R() < 0.5 ? 1 : -1;
      var f = { x: dir > 0 ? -80 * u : W + 80 * u, y: H * (0.18 + R() * 0.25), vx: dir * (70 + R() * 30) * u, vy: -(R() * 8) * u, b: [] };
      for (var i = 0; i < n; i++) f.b.push({ dx: -dir * (i * 26 + R() * 14) * u, dy: (Math.abs(i - n / 2) * 10 + R() * 10 - 30) * u + (i % 2 ? 8 : -4) * u, ph: R() * TAU, s: (0.7 + R() * 0.5) });
      birds.push(f);
    }
    function moment() {           // the hourly "big moment"
      var m = curMood;
      startTrain(false);
      if (m === 'night') {
        var n = api.calm() ? 7 : 22, spread = api.calm() ? 22000 : 14000;
        for (var i = 0; i < n; i++) later(function () { if (!dead) meteor({ angle: Math.PI * (0.76 + R() * 0.06) }); }, 300 + R() * spread);
        gusts.push({ x: W * 0.5, y: H * 0.8, r: W * 0.4, s: 90 * u, t0: T, dur: 5 });
      } else {
        part = { t0: T };
        raysBoostT = T;
        flock(true);
        gusts.push({ x: W * 0.15, y: H * 0.7, r: W * 0.45, s: 220 * u, t0: T, dur: 4 });
        burst(W * 0.1, H * 0.75, api.calm() ? 20 : 60);
      }
    }

    // ------------------------------------------------------------ render loop
    function placeLayers(sc) {
      var cx = cam.x * PX, cy = cam.y * PY;
      for (var i = 0; i < sc.layers.length; i++) {
        var L = sc.layers[i], x = L.x0 + L.dx + cx * L.f, y = L.y0 + cy * L.f;
        var tr = 'translate3d(' + (x / k).toFixed(2) + 'px,' + (y / k).toFixed(2) + 'px,0)';
        if (L.train) tr += train.dir < 0 ? ' scaleX(-1)' : '';
        if (tr !== L.last) { L.el.style.transform = tr; L.last = tr; }
      }
    }

    function updateClouds(sc, dt) {
      var pe = 0;
      if (part) {
        var a = T - part.t0;
        pe = smooth(a / 6) * (1 - smooth((a - 16) / 14));
        if (a > 32) part = null;
      }
      for (var i = 0; i < sc.clouds.length; i++) {
        var c = sc.clouds[i], L = c.layer;
        if (!reduced) {
          c.x += c.speed * dt * (api.calm() ? 0.5 : 1);
          var cw = L.el.width;
          if (c.x > W + PX) c.x = -cw - PX;
        }
        var pof = c.kind === 'tower' ? 0.04 : 0.22;
        L.x0 = c.x + c.dirPart * pe * pof * W;
      }
    }

    function drawRays(sc, dt) {
      var P = sc.P, g = sc.raysCtx;
      var boost = 0;
      if (raysBoostT) { var a = T - raysBoostT; boost = smooth(a / 4) * (1 - smooth((a - 14) / 12)); if (a > 30) raysBoostT = 0; }
      var amt = P.raysAmt * (api.calm() ? 0.45 : 1) * (1 + boost * 1.6);
      if (!amt) { if (!sc.raysClear) { g.clearRect(0, 0, sc.rays.width, sc.rays.height); sc.raysClear = true; } return; }
      sc.raysClear = false;
      g.setTransform(0.5, 0, 0, 0.5, 0, 0);
      g.clearRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter';
      var sx = sc.sun.x, sy = sc.sun.y, Rr = W * 1.15, n = 14;
      var gr = g.createRadialGradient(sx, sy, 0, sx, sy, Rr);
      gr.addColorStop(0, rgba(P.rays, 0.32)); gr.addColorStop(0.25, rgba(P.rays, 0.12)); gr.addColorStop(1, rgba(P.rays, 0));
      g.fillStyle = gr;
      var rot = reduced ? 0 : T * 0.012;
      for (var i = 0; i < n; i++) {
        var ang = rot + i / n * TAU + Math.sin(i * 7.31) * 0.2;
        var wdt = 0.035 + 0.03 * (0.5 + 0.5 * Math.sin(i * 3.7));
        var al = (0.35 + 0.45 * (0.5 + 0.5 * Math.sin((reduced ? 0 : T) * 0.35 + i * 2.1))) * amt * 0.55;
        if (al <= 0.01) continue;
        g.globalAlpha = Math.min(1, al);
        g.beginPath(); g.moveTo(sx, sy);
        g.lineTo(sx + Math.cos(ang - wdt) * Rr, sy + Math.sin(ang - wdt) * Rr);
        g.lineTo(sx + Math.cos(ang + wdt) * Rr, sy + Math.sin(ang + wdt) * Rr);
        g.closePath(); g.fill();
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }

    function drawBack(sc, dt) {
      var g = sc.backCtx, P = sc.P;
      var tw = sc.twinkles;
      if (!tw) {
        tw = sc.twinkles = [];
        var n = sc.mood === 'night' ? 46 : sc.mood === 'dusk' ? 10 : 0;
        for (var i = 0; i < n; i++) tw.push({ x: R() * W, y: Math.pow(R(), 1.5) * H * (sc.mood === 'night' ? 0.62 : 0.3), s: 0.5 + R() * 0.8, ph: R() * TAU, sp: 0.6 + R() * 2 });
      }
      if (!tw.length && !meteors.length) { if (sc.backDirty) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, sc.back.width, sc.back.height); sc.backDirty = false; } return; }
      sc.backDirty = true;
      g.setTransform(0.5, 0, 0, 0.5, 0, 0);
      g.clearRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter';
      var spr = sprites.spark, calmF = api.calm() ? 0.6 : 1;
      for (var j = 0; j < tw.length; j++) {
        var t = tw[j], a = (0.5 + 0.5 * Math.sin(T * t.sp + t.ph));
        a = a * a * calmF;
        if (a < 0.03) continue;
        g.globalAlpha = a;
        var ss = spr.width * t.s;
        g.drawImage(spr, t.x - ss / 2, t.y - ss / 2, ss, ss);
      }
      for (var m = meteors.length - 1; m >= 0; m--) {
        var M = meteors[m];
        M.life += dt; M.x += M.vx * dt; M.y += M.vy * dt;
        if (M.life > M.max) { meteors.splice(m, 1); continue; }
        var env = Math.sin(Math.PI * M.life / M.max) * M.a;
        var sp = Math.sqrt(M.vx * M.vx + M.vy * M.vy), ux = M.vx / sp, uy = M.vy / sp;
        var tx = M.x - ux * M.len, ty = M.y - uy * M.len;
        var lg = g.createLinearGradient(M.x, M.y, tx, ty);
        lg.addColorStop(0, 'rgba(255,255,255,' + env + ')'); lg.addColorStop(0.25, 'rgba(210,230,255,' + env * 0.75 + ')'); lg.addColorStop(1, 'rgba(160,190,255,0)');
        g.strokeStyle = lg; g.lineCap = 'round';
        g.globalAlpha = 0.35; g.lineWidth = 12 * u * M.w; g.beginPath(); g.moveTo(M.x, M.y); g.lineTo(tx, ty); g.stroke();
        g.globalAlpha = 1; g.lineWidth = 4 * u * M.w; g.stroke();
        g.globalAlpha = env;
        var hs = sprites.spark.width * 1.6 * M.w;
        g.drawImage(sprites.spark, M.x - hs / 2, M.y - hs / 2, hs, hs);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }

    function drawFront(dt) {
      var g = fx, S = sprites, P = scene.P, i, p;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, W, H);
      // lens flare
      if (P.flareAmt && !api.calm()) {
        var sx = scene.sun.x + cam.x * PX * 0.08, sy = scene.sun.y + cam.y * PY * 0.08;
        var cx = W / 2, cy = H / 2, vx = cx - sx, vy = cy - sy;
        var fl = P.flareAmt * (0.85 + 0.15 * Math.sin(T * 0.9)) * (sy > H * 0.7 ? 0.4 : 1);
        g.globalCompositeOperation = 'lighter';
        var gh = [[0.28, S.g2, 0.9], [0.55, S.g1, 0.5], [0.8, S.g4, 0.5], [1.2, S.g2, 0.7], [1.55, S.g3, 0.55], [1.9, S.g1, 0.35]];
        for (i = 0; i < gh.length; i++) {
          var q = gh[i], gx = sx + vx * q[0], gy = sy + vy * q[0], gw = q[1].width;
          g.globalAlpha = fl * q[2];
          g.drawImage(q[1], gx - gw / 2, gy - gw / 2);
        }
        g.globalAlpha = fl * 0.8;
        g.drawImage(S.streak, sx - S.streak.width / 2, sy - S.streak.height / 2);
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      }
      // birds
      for (i = birds.length - 1; i >= 0; i--) {
        var f = birds[i];
        f.x += f.vx * dt; f.y += f.vy * dt;
        if (f.x < -400 * u || f.x > W + 400 * u) { birds.splice(i, 1); continue; }
        g.strokeStyle = curMood === 'day' ? 'rgba(30,45,80,0.85)' : 'rgba(30,18,46,0.9)'; g.lineWidth = 2.2 * u; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath();
        for (var b = 0; b < f.b.length; b++) {
          var B = f.b[b], bx = f.x + B.dx, by = f.y + B.dy + Math.sin(T * 1.3 + B.ph) * 4 * u, fl2 = Math.sin(T * 9 + B.ph) * 7 * u * B.s, ws = 11 * u * B.s;
          g.moveTo(bx - ws, by - fl2); g.quadraticCurveTo(bx - ws * 0.4, by - fl2 * 0.2 - 2 * u, bx, by + 2 * u);
          g.quadraticCurveTo(bx + ws * 0.4, by - fl2 * 0.2 - 2 * u, bx + ws, by - fl2);
        }
        g.stroke();
      }
      // particles
      var all = [parts, extra];
      for (var pass = 0; pass < 2; pass++) {
        g.globalCompositeOperation = pass ? 'lighter' : 'source-over';
        for (var arr = 0; arr < 2; arr++) {
          var list = all[arr];
          for (i = 0; i < list.length; i++) {
            p = list[i];
            var glow = p.kind === 'firefly' || p.kind === 'mote' || p.kind === 'spark';
            if ((pass === 1) !== glow) continue;
            var al = p.alpha === undefined ? 1 : p.alpha;
            if (p.kind === 'firefly') {
              var bl = 0.5 + 0.5 * Math.sin(p.ph * 2.2); al *= 0.15 + 0.85 * bl * bl;
              var fs = S.fly.width * (0.5 + p.z * 0.45);
              g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = al * (api.calm() ? 0.7 : 1);
              g.drawImage(S.fly, p.x - fs / 2, p.y - fs / 2, fs, fs);
            } else if (p.kind === 'mote') {
              var ms = S.mote.width * (0.5 + p.z * 0.6);
              g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = al * (0.5 + 0.5 * Math.sin(T * 1.7 + p.ph * 5));
              g.drawImage(S.mote, p.x - ms / 2, p.y - ms / 2, ms, ms);
            } else if (p.kind === 'spark') {
              var sa = Math.sin(Math.PI * clamp(p.life / p.max, 0, 1));
              var ss = S.spark.width * p.z * (0.7 + 0.3 * Math.sin(T * 8 + p.ph));
              g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = sa;
              g.drawImage(S.spark, p.x - ss / 2, p.y - ss / 2, ss, ss);
            } else {
              var spr = S[p.spr], sc2 = 0.55 + p.z * 0.5, co = Math.cos(p.rot) * sc2, si = Math.sin(p.rot) * sc2, fy = Math.cos(p.flip);
              if (Math.abs(fy) < 0.08) fy = fy < 0 ? -0.08 : 0.08;
              g.setTransform(co, si, -si * fy, co * fy, p.x, p.y);
              g.globalAlpha = al;
              g.drawImage(spr, -spr.width / 2, -spr.height / 2);
            }
          }
        }
      }
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
      // shimmer rings from OK presses
      g.globalCompositeOperation = 'lighter';
      for (i = rings.length - 1; i >= 0; i--) {
        var r = rings[i], a = (T - r.t0) / 1.6;
        if (a > 1) { rings.splice(i, 1); continue; }
        var rr = (20 + 380 * smooth(a)) * u;
        g.strokeStyle = rgba(r.col, (1 - a) * 0.7); g.lineWidth = (7 - 5 * a) * u;
        g.beginPath(); g.arc(r.x, r.y, rr, 0, TAU); g.stroke();
        g.globalAlpha = (1 - a);
        var bs = S.sparkBig.width * (1 + a);
        g.drawImage(S.sparkBig, r.x - bs / 2, r.y - bs / 2, bs, bs);
        g.globalAlpha = 1;
      }
      g.globalCompositeOperation = 'source-over';
    }

    function frame(ts) {
      raf = 0;
      if (dead) return;
      if (document.hidden) return;
      raf = requestAnimationFrame(frame);
      if (lastTs && ts - lastTs < 30) return;
      var dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0.033;
      lastTs = ts; T += dt;
      try { tick(dt); } catch (e) { if (window.console) console.error(e); }
    }

    function tick(dt) {
      if (!scene) return;
      var ease = Math.min(1, dt * 1.2);
      cam.x += (cam.tx - cam.x) * ease; cam.y += (cam.ty - cam.y) * ease;
      updateClouds(scene, dt);
      // train
      if (train.active) {
        train.x += train.dir * train.speed * dt;
        if ((train.dir > 0 && train.x > scene.railW + 20 * u) || (train.dir < 0 && train.x < -scene.trainLen - 20 * u)) train.active = false;
      }
      var tl = scene.trainL;
      tl.dx = train.x; tl.el.style.visibility = train.active ? 'visible' : 'hidden';
      placeLayers(scene);
      if (oldScene) placeLayers(oldScene);
      // ambient schedule
      if (!reduced) {
        if (T > next.train) { startTrain(false); next.train = T + (api.calm() ? 420 + R() * 600 : 150 + R() * 200); }
        if (curMood === 'night' || curMood === 'dusk') {
          if (T > next.star) { meteor(); next.star = T + (api.calm() ? 60 + R() * 90 : 22 + R() * 45) * (curMood === 'dusk' ? 3 : 1); }
        }
        if (curMood !== 'night' && T > next.birds) { flock(false); next.birds = T + 70 + R() * 110; }
      }
      // particles
      var i;
      var want = PAL[curMood].part;
      for (i = 0; i < parts.length; i++) {
        var pk = parts[i].kind, ok = want === 'dusk' ? (pk === 'mote' || pk === 'leaf') : pk === want;
        stepParticle(parts[i], dt);
        if (outOf(parts[i]) || (!ok && R() < 0.01)) spawn(parts[i], false);
      }
      for (i = extra.length - 1; i >= 0; i--) { stepParticle(extra[i], dt); if (extra[i].life > extra[i].max) extra.splice(i, 1); }
      for (i = gusts.length - 1; i >= 0; i--) if (T - gusts[i].t0 > gusts[i].dur + 2) gusts.splice(i, 1);
      drawRays(scene, dt);
      drawBack(scene, dt);
      drawFront(dt);
    }

    function start() { if (!raf && !dead && !document.hidden) { lastTs = 0; raf = requestAnimationFrame(frame); } }
    function onVis() { if (!document.hidden) start(); }
    document.addEventListener('visibilitychange', onVis);

    // ------------------------------------------------------------ scene swap
    function applyMood(mood) {
      var P = PAL[mood];
      root.style.setProperty('--ink', P.ink);
      root.style.setProperty('--glow', P.glow);
      root.style.setProperty('--shade', P.shade);
      root.style.setProperty('--tint', P.tint);
    }
    function setScene(animate) {
      var d = api.now(), mood = api.mood(d.getHours()), key = mood + d.getHours();
      if (key === curKey && scene) return;
      curKey = key;
      var moodChanged = mood !== curMood;
      curMood = mood;
      applyMood(mood);
      var sc = buildScene(mood, d);
      if (moodChanged || !sprites) sprites = makeSprites(sc.P);
      if (animate && scene) {
        sc.el.classList.add('pre');
        stage.appendChild(sc.el);
        if (oldScene) { oldScene.el.remove(); }
        oldScene = scene;
        var old = oldScene;
        void sc.el.offsetWidth; sc.el.classList.remove('pre');
        later(function () { if (old.el.parentNode) old.el.remove(); if (oldScene === old) oldScene = null; }, 3500);
      } else {
        if (scene) scene.el.remove();
        stage.appendChild(sc.el);
      }
      scene = sc;
      fillParticles();
      root.classList.toggle('calm', api.calm());
      dim.style.opacity = api.calm() ? (mood === 'night' ? 0.3 : 0.2) : 0;
    }

    // ------------------------------------------------------------ clock
    function setDigits(str, animate) {
      var i;
      if (cells.length !== str.length) {
        hm.innerHTML = ''; cells = [];
        for (i = 0; i < str.length; i++) {
          var c = el('span', 'dg' + (str[i] === ':' ? ' col' : ''), hm), d = el('span', 'd', c);
          d.textContent = str[i]; cells.push({ el: c, ch: str[i], cur: d });
        }
        return;
      }
      for (i = 0; i < str.length; i++) {
        var cell = cells[i];
        if (cell.ch === str[i]) continue;
        cell.ch = str[i];
        if (!animate || reduced) { cell.cur.textContent = str[i]; continue; }
        var old = cell.cur; old.className = 'd out';
        var n = el('span', 'd in', cell.el); n.textContent = str[i]; cell.cur = n;
        (function (o) { later(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 900); })(old);
      }
    }
    var lastHourSeen = -1;
    function label(d) {
      var h = d.getHours(), m = api.mood(h);
      if (m === 'dawn') return 'first light';
      if (m === 'day') return h < 12 ? 'clear morning' : h < 15 ? 'high summer sky' : 'long afternoon';
      if (m === 'dusk') return h < 19 ? 'golden hour' : 'evening glow';
      return api.calm() ? 'quiet starry night' : 'starry night';
    }
    function updateClock(animate) {
      var d = api.now(), h = d.getHours(), m = d.getMinutes();
      var h12 = h % 12 || 12;
      setDigits(h12 + ':' + api.pad(m), animate);
      ap.textContent = h < 12 ? 'am' : 'pm';
      dy.textContent = api.DAYS[d.getDay()];
      dd.textContent = api.MONTHS[d.getMonth()] + ' ' + d.getDate();
      lb.textContent = label(d);
      // burn-in care: wander a little over the hour
      var tot = h * 60 + m;
      var ox = Math.sin(tot / 9.3) * 1.1, oy = Math.cos(tot / 13.7) * 1.4;
      var tr = 'translate(' + ox.toFixed(2) + 'vw,' + oy.toFixed(2) + 'vh)';
      if (clk.style.transform !== tr) clk.style.transform = tr;
      if (h !== lastHourSeen) { if (lastHourSeen !== -1) setScene(true); lastHourSeen = h; }
    }

    // ------------------------------------------------------------ boot
    setScene(false);
    updateClock(false);
    fillParticles();
    if (!reduced) startTrain(true);
    next.train = T + 150 + R() * 150;
    next.star = T + 2.5;
    next.birds = T + 4 + R() * 30;
    var secId = setInterval(function () { if (!dead) updateClock(true); }, 1000);
    var rsT = 0;
    function onResize() {
      clearTimeout(rsT);
      rsT = setTimeout(function () {
        if (dead) return;
        measure();
        front.width = W; front.height = H; front.style.width = (W / k) + 'px'; front.style.height = (H / k) + 'px';
        curKey = ''; if (oldScene) { oldScene.el.remove(); oldScene = null; }
        setScene(false); sprites = makeSprites(scene.P); parts = []; fillParticles();
      }, 400);
    }
    window.addEventListener('resize', onResize);
    start();

    return {
      destroy: function () {
        dead = true;
        if (raf) cancelAnimationFrame(raf); raf = 0;
        clearInterval(secId); clearTimeout(rsT);
        timers.forEach(clearTimeout); timers = [];
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('resize', onResize);
        parts = []; extra = []; meteors = []; birds = []; gusts = [];
        if (style.parentNode) style.parentNode.removeChild(style);
      },
      onPointer: function (nx, ny) { cam.tx = clamp(nx, -1, 1); cam.ty = clamp(ny, -1, 1); },
      onAction: function (cx, cy) {
        if (dead || !scene) return;
        var x = cx * k, y = cy * k;
        var rc = curMood === 'night' ? [190, 255, 140] : curMood === 'dusk' ? [255, 190, 120] : hex(PAL[curMood].petal[1]);
        rings.push({ x: x, y: y, t0: T, col: rc });
        gusts.push({ x: x, y: y, r: (api.calm() ? 220 : 340) * u, s: (api.calm() ? 160 : 320) * u, t0: T, dur: 3 });
        burst(x, y, reduced ? 8 : api.calm() ? 24 : 70);
        sparkles(x - 120 * u, y - 100 * u, 240 * u, 200 * u, api.calm() ? 8 : 22);
        if (curMood === 'night' || curMood === 'dusk') {
          meteor({ x: Math.min(W * 0.98, x + W * 0.25), y: Math.max(H * 0.02, y - H * 0.4), angle: Math.atan2(H * 0.4, -W * 0.25), w: 1.4 });
        } else {
          raysBoostT = T; flock(false);
        }
        startTrain(false);
      },
      onMinute: function () {
        updateClock(true);
        if (dead || !scene) return;
        var r = tm.getBoundingClientRect();
        sparkles(r.left * k, r.top * k + r.height * 0.1 * k, r.width * k, r.height * 0.8 * k, api.calm() ? 6 : 16);
      },
      onHour: function () {
        if (dead) return;
        setScene(true);
        moment();
      }
    };
  }

  window.Themes = window.Themes || {};
  window.Themes.anime = { title: 'Anime Sky', create: create };
})();
