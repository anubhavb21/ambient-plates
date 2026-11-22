// Comic Strike: an original comic-book action theme for the ambient clock.
// The screen is a comic page: panels slam in with angled gutters, Ben-Day halftone, CMYK
// misregistration, speed lines, a masked hero of our own design (no publisher's characters,
// emblems or costumes), sound-effect lettering on every minute, a full cover splash on the hour.
// Everything is procedural: Canvas 2D on one full-screen canvas, sprites pre-rendered offscreen.
//
// Lettering font: "Bangers" by Vernon Adams, SIL Open Font License 1.1
// (fonts/Comic-Bangers.woff2, latin subset from Google Fonts). Falls back to Impact.
(function () {
  'use strict';

  var FAM = 'ComicStrikeBangers';
  var FONT = '"' + FAM + '", Bangers, Impact, "Arial Black", sans-serif';
  var TAU = Math.PI * 2;

  // ---------- small helpers ----------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function eOutC(k) { k = clamp(k, 0, 1); return 1 - Math.pow(1 - k, 3); }
  function eInC(k) { k = clamp(k, 0, 1); return k * k * k; }
  function eOutBack(k) { k = clamp(k, 0, 1); var c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); }
  function eOutElastic(k) { k = clamp(k, 0, 1); if (k === 0 || k === 1) return k; return Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * TAU / 3) + 1; }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  function pick(arr, r) { return arr[Math.floor(r() * arr.length) % arr.length]; }
  function shuffle(arr, r) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }

  function polyPath(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); }
  // keep the part of a convex polygon where nx*x + ny*y + c >= 0
  function clipHalf(poly, nx, ny, c) {
    var out = [], n = poly.length;
    for (var i = 0; i < n; i++) {
      var A = poly[i], B = poly[(i + 1) % n];
      var da = nx * A[0] + ny * A[1] + c, db = nx * B[0] + ny * B[1] + c;
      if (da >= 0) out.push(A);
      if ((da >= 0) !== (db >= 0)) { var k = da / (da - db); out.push([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k]); }
    }
    return out;
  }
  // split a convex polygon by the line a->b leaving a gutter of `gap` px; returns [positive side, negative side]
  function split(poly, a, b, gap) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy);
    var nx = -dy / L, ny = dx / L, c = -(nx * a[0] + ny * a[1]);
    return [clipHalf(poly, nx, ny, c - gap / 2), clipHalf(poly, -nx, -ny, -c - gap / 2)];
  }
  function bbox(poly) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, sx = 0, sy = 0;
    poly.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); sx += p[0]; sy += p[1]; });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: sx / poly.length, cy: sy / poly.length };
  }
  // Ben-Day dots on a 60-degree grid; radius comes from fn(x, y)
  function dots(g, x0, y0, w, h, step, fn, color) {
    g.fillStyle = color; g.beginPath();
    var row = 0;
    for (var y = y0; y < y0 + h + step; y += step * 0.866, row++) {
      var off = (row & 1) ? step / 2 : 0;
      for (var x = x0 - step + off; x < x0 + w + step; x += step) {
        var r = fn(x, y);
        if (r > 0.35) { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); }
      }
    }
    g.fill();
  }
  function burstPts(rx, ry, n, r, jag) {
    var pts = [];
    for (var i = 0; i < n * 2; i++) {
      var a = i / (n * 2) * TAU + (r() - 0.5) * 0.12;
      var k = (i % 2) ? 1 - jag * (0.75 + r() * 0.6) : 1 + r() * 0.14;
      pts.push([Math.cos(a) * rx * k, Math.sin(a) * ry * k]);
    }
    return pts;
  }
  function scalePts(pts, s) { return pts.map(function (p) { return [p[0] * s, p[1] * s]; }); }

  // ---------- palettes ----------
  var PALS = {
    dawn: {
      paper: '#f3d8c2', paperDot: 'rgba(236,0,140,0.13)', speck: 'rgba(60,0,40,0.08)', ink: '#1d1026', near: '#2a1338',
      sky1: '#ff6f91', sky2: '#ffd59a', skyDot: 'rgba(255,240,200,0.5)', acc: '#ff3f6c', acc2: '#9e1646', hi: '#ffd166',
      cyan: '#00aeef', mag: '#ec008c', far: '#b46a9c', farWin: '#f0b2cf', win: '#fff0b0', moon: '#fff1c1', moonShade: '#ffb36b',
      moonGlow: 'rgba(255,230,180,0.5)', raysA: '#ff9bb0', raysB: '#ffc58f', rayDot: 'rgba(158,22,70,0.22)', burst: '#ff3f6c', burst2: '#ff7d5c',
      burstDot: 'rgba(120,0,50,0.3)', clockFill: '#fff6b8', clockFill2: '#ffc14d', clockDepth: '#9e1646', capBg: '#ffe0a3', capFg: '#1d1026',
      suit: '#5b2f96', suitDark: '#2a1338', cape: '#a3184e', mask: '#c41e5a', lens: '#ffffff', rim: '#ffd166', cloud: '#fff3ea', beam: 'rgba(255,240,200,',
      flightA: '#ff6f91', flightB: '#ffd166', coverA: '#ffb0c0', coverB: '#ff7d9b', flash: '#fff4d6', isSun: true
    },
    day: {
      paper: '#f1e3bf', paperDot: 'rgba(214,40,40,0.13)', speck: 'rgba(40,20,0,0.08)', ink: '#15121c', near: '#1a2142',
      sky1: '#1aa3f2', sky2: '#a9ecff', skyDot: 'rgba(255,255,255,0.42)', acc: '#ef2d2a', acc2: '#9e121a', hi: '#ffd60a',
      cyan: '#00aeef', mag: '#ec008c', far: '#5a8bcd', farWin: '#a9cdf2', win: '#d9f4ff', moon: '#fff3a0', moonShade: '#ffb000',
      moonGlow: 'rgba(255,255,200,0.5)', raysA: '#ffd60a', raysB: '#ffad00', rayDot: 'rgba(200,40,0,0.2)', burst: '#ef2d2a', burst2: '#ff6a3d',
      burstDot: 'rgba(110,0,0,0.3)', clockFill: '#fff27a', clockFill2: '#ffb300', clockDepth: '#7a0d14', capBg: '#ffe36e', capFg: '#15121c',
      suit: '#2848c4', suitDark: '#141a3a', cape: '#c8181c', mask: '#d8231f', lens: '#ffffff', rim: '#ffd60a', cloud: '#ffffff', beam: 'rgba(255,255,220,',
      flightA: '#18a0f0', flightB: '#9fe8ff', coverA: '#ffd60a', coverB: '#ff9f0a', flash: '#fffbe6', isSun: true
    },
    dusk: {
      paper: '#2a1436', paperDot: 'rgba(255,120,60,0.16)', speck: 'rgba(255,200,150,0.07)', ink: '#12061c', near: '#12061c',
      sky1: '#3b1a6e', sky2: '#ff7a3d', skyDot: 'rgba(255,190,70,0.5)', acc: '#ff5a1f', acc2: '#8f2410', hi: '#ffd23f',
      cyan: '#00c2ff', mag: '#ff2e93', far: '#4a2370', farWin: '#d0708e', win: '#ffd23f', moon: '#ffc46b', moonShade: '#ff6a2b',
      moonGlow: 'rgba(255,150,80,0.45)', raysA: '#ff6a2b', raysB: '#b3175a', rayDot: 'rgba(40,0,30,0.3)', burst: '#b3175a', burst2: '#ff5a1f',
      burstDot: 'rgba(30,0,20,0.35)', clockFill: '#ffe75a', clockFill2: '#ff9f1a', clockDepth: '#3b0a2a', capBg: '#ffd23f', capFg: '#12061c',
      suit: '#2e1c66', suitDark: '#12061c', cape: '#9c1a3c', mask: '#ff5a1f', lens: '#fff7d6', rim: '#ff9f43', cloud: '#ffae86', beam: 'rgba(255,220,170,',
      flightA: '#5b2a86', flightB: '#ff7a3d', coverA: '#ff6a2b', coverB: '#b3175a', flash: '#ffe9c4', isSun: true
    },
    night: {
      paper: '#0b1233', paperDot: 'rgba(70,120,255,0.2)', speck: 'rgba(150,190,255,0.06)', ink: '#02040d', near: '#03050f',
      sky1: '#040a2a', sky2: '#1b3c92', skyDot: 'rgba(90,150,255,0.32)', acc: '#ff3b3b', acc2: '#8f1020', hi: '#ffe14d',
      cyan: '#4dd6ff', mag: '#ff3fa4', far: '#11225e', farWin: '#3557b0', win: '#ffe14d', moon: '#fff4c2', moonShade: '#d9b74e',
      moonGlow: 'rgba(255,240,180,0.28)', raysA: '#16307a', raysB: '#0c1c4f', rayDot: 'rgba(120,170,255,0.18)', burst: '#1d43c9', burst2: '#3467ff',
      burstDot: 'rgba(0,10,60,0.4)', clockFill: '#fff07a', clockFill2: '#ffb21a', clockDepth: '#050a24', capBg: '#ffe14d', capFg: '#02040d',
      suit: '#17266a', suitDark: '#060b26', cape: '#a3122a', mask: '#c8162a', lens: '#fffbe0', rim: '#4dd6ff', cloud: '#22397a', beam: 'rgba(255,245,190,',
      flightA: '#071445', flightB: '#2b52c4', coverA: '#1d43c9', coverB: '#0c1c4f', flash: '#e8f0ff', isSun: false
    }
  };
  // the quiet "night issue" after 23:00: same ink, lower contrast, no hot colours
  PALS.calm = Object.assign({}, PALS.night, {
    paper: '#070b22', paperDot: 'rgba(70,110,220,0.13)', hi: '#d8be55', win: '#c9ab45', raysA: '#0d1d4f', raysB: '#081538',
    rayDot: 'rgba(110,150,240,0.12)', burst: '#142e86', burst2: '#1d3fa8', clockFill: '#eed872', clockFill2: '#c99a2a', capBg: '#d8be55',
    rim: '#3a8fc0', cape: '#6e1424', acc: '#c23a44', mask: '#8e1424', lens: '#e9e4c8', sky2: '#132a6a', coverA: '#142e86', coverB: '#081538'
  });

  var MOOD_LINE = {
    dawn: 'Dawn breaks over the city…',
    day: 'Meanwhile, high above the city…',
    dusk: 'As the sun goes down…',
    night: 'Night falls. The city never sleeps…',
    calm: 'Late. All is quiet… for now.'
  };
  var MINUTE_WORDS = ['KRAK!', 'WHAM!', 'ZOOM!', 'POW!', 'KA-BLAM!', 'BLAM!', 'SKRAKOOM!', 'BOOM!', 'ZAPP!', 'WHOOSH!', 'KRUNCH!', 'BAM!',
    'ZZAKK!', 'VRROOM!', 'SHOOM!', 'KA-CHUNK!', 'TICK-TOK!', 'KLANG!', 'SMASH!', 'THOOM!', 'FWOOSH!', 'KA-ZING!'];
  var HIT_WORDS = ['POW!', 'WHAM!', 'KRAK!', 'BLAM!', 'KA-POW!', 'THWAKK!', 'SMAK!', 'BOOM!', 'KRASH!'];
  var CALM_WORDS = ['tick…', 'tock…', 'hush…', 'zzz…', 'shhh…'];
  var HOUR_NAMES = ['TWELVE', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN'];
  var HOUR_WORDS = ['KA-BOOM!', 'BWONNG!', 'KLANNG!', 'DOOOM!', 'GONNG!'];

  // hero poses: angles in degrees, 0 = straight down, 90 = forward (facing), 180 = up
  var POSES = {
    stand: { torso: 178, head: 184, sh1: 42, el1: -58, sh2: -30, el2: 30, hip1: 17, kn1: 8, hip2: -15, kn2: -9 },
    fly: { torso: 98, head: 112, sh1: 104, el1: 100, sh2: -76, el2: -84, hip1: -80, kn1: -84, hip2: -70, kn2: -106 },
    leap: { torso: 140, head: 150, sh1: 158, el1: 150, sh2: -62, el2: -40, hip1: 86, kn1: 14, hip2: -56, kn2: -124 },
    crouch: { torso: 132, head: 160, sh1: 40, el1: 70, sh2: 16, el2: 46, hip1: 108, kn1: -4, hip2: 36, kn2: -80 }
  };
  function lerpPose(a, b, k) { var o = {}; for (var key in a) o[key] = lerp(a[key], b[key], k); return o; }

  function create(root, api) {
    var reduced = !!api.reduced;
    root.classList.add('t-comic');
    var style = document.createElement('style');
    style.textContent = [
      '@font-face{font-family:"' + FAM + '";font-style:normal;font-weight:400;font-display:block;src:url("fonts/Comic-Bangers.woff2") format("woff2");}',
      '.t-comic{background:#000;overflow:hidden;}',
      '.t-comic .cs-canvas{position:absolute;left:0;top:0;width:100%;height:100%;display:block;}',
      '.t-comic .cs-dim{position:absolute;left:0;top:0;right:0;bottom:0;background:#00020c;opacity:0;transition:opacity 4s ease;pointer-events:none;}',
      '.t-comic .cs-probe{position:absolute;left:-100vw;top:0;font-family:"' + FAM + '";font-size:2vw;visibility:hidden;}'
    ].join('\n');
    root.appendChild(style);
    var cv = document.createElement('canvas'); cv.className = 'cs-canvas'; root.appendChild(cv);
    var dimEl = document.createElement('div'); dimEl.className = 'cs-dim'; root.appendChild(dimEl);
    var probe = document.createElement('div'); probe.className = 'cs-probe'; probe.textContent = 'KRAK! 0123456789'; root.appendChild(probe);
    var ctx = cv.getContext('2d');

    var W = 0, H = 0, K = 1, M = 0, LW = 0, F = 0;
    var PAL = PALS.night, moodName = '', calm = false;
    var layout = null, prev = null, trans = null, layoutBorn = 0;
    var cam = { x: 0, y: 0 }, camT = { x: 0, y: 0 };
    var shake = 0, flash = 0, rt = 0, t = 0, last = 0, raf = 0, dead = false, hidden = false;
    var effects = [], word = null, cover = null, page = null;
    var clk = { spr: null, key: '', pop: -9, x: -1, y: -1, tx: 0, ty: 0, rot: -0.03, sec: -1, secPop: -9, ampm: 'AM' };
    var capSpr = null, issueSpr = null, capKey = '';
    var R = api.rng(((api.now().getTime() / 1000) | 0) ^ 0x5eed);
    var resizeT = 0, wd = 0;

    function soft() { return calm || reduced; }
    function boil() { return soft() ? 0 : ((rt * 8) | 0) % 3; }

    function size() {
      var cw = Math.max(320, root.clientWidth || innerWidth), ch = Math.max(180, root.clientHeight || innerHeight);
      K = Math.min(1, 1920 / cw, 1080 / ch);
      W = Math.round(cw * K); H = Math.round(ch * K);
      cv.width = W; cv.height = H;
      M = Math.round(W * 0.026); LW = Math.max(3, W * 0.0044); F = W * 0.185;
    }

    function applyMood() {
      var m = api.mood(), c = !!api.calm();
      if (m === moodName && c === calm && page) return false;
      moodName = m; calm = c;
      PAL = c ? PALS.calm : PALS[m];
      dimEl.style.opacity = c ? '0.3' : '0';
      page = buildPage();
      return true;
    }

    // ================= text sprites =================
    function measure(text, px) { var g = mk(8, 8).getContext('2d'); g.font = px + 'px ' + FONT; return Math.ceil(g.measureText(text).width); }

    // comic lettering: coloured extrusion, ink keyline, cyan ghost plate, gradient fill with halftone, off-register fill
    function renderWord(text, px, o) {
      o = o || {};
      var tw = measure(text, px);
      var pad = Math.ceil(px * 0.28), dep = o.depth != null ? o.depth : px * 0.085;
      var cw = tw + pad * 2 + dep, ch = Math.ceil(px * 1.12 + pad * 2 + dep);
      var c = mk(cw, ch), g = c.getContext('2d');
      var x = pad, y = pad + px * 0.9, ink = o.ink || PAL.ink;
      g.font = px + 'px ' + FONT; g.lineJoin = 'round';
      var stp = Math.max(1, px * 0.012), d;
      g.strokeStyle = ink; g.lineWidth = px * 0.15;
      for (d = dep; d > 0; d -= stp) g.strokeText(text, x + d, y + d);
      if (o.depthCol) { g.fillStyle = o.depthCol; for (d = dep - stp; d > 0; d -= stp) g.fillText(text, x + d, y + d); }
      g.lineWidth = px * 0.16; g.strokeText(text, x, y);
      var m = px * (o.mis != null ? o.mis : 0.022);
      if (m > 0) { g.globalAlpha = 0.8; g.fillStyle = o.ghost || PAL.cyan; g.fillText(text, x - m * 1.3, y + m * 0.9); g.globalAlpha = 1; }
      var tc = mk(cw, ch), tg = tc.getContext('2d');
      tg.font = g.font;
      var gr = tg.createLinearGradient(0, y - px * 0.78, 0, y);
      gr.addColorStop(0, o.fill1 || PAL.clockFill); gr.addColorStop(1, o.fill2 || PAL.clockFill2);
      tg.fillStyle = gr; tg.fillText(text, x, y);
      tg.globalCompositeOperation = 'source-atop';
      var st = Math.max(3, px * 0.055);
      dots(tg, 0, y - px * 0.8, cw, px * 0.9, st, function (xx, yy) { var v = (yy - (y - px * 0.42)) / (px * 0.42); return v > 0 ? st * 0.46 * Math.min(1, v) : 0; }, o.dot || 'rgba(0,0,0,0.2)');
      tg.fillStyle = 'rgba(255,255,255,0.5)'; tg.fillRect(0, y - px * 0.66, cw, px * 0.055);
      g.drawImage(tc, m * 0.55, -m * 0.45);
      g.lineWidth = Math.max(1, px * 0.022); g.strokeStyle = ink; g.strokeText(text, x, y);
      return { c: c, cx: x + tw / 2, cy: y - px * 0.38, tw: tw };
    }

    // lettering inside a jagged explosion balloon
    function renderBurstText(text, px, o) {
      var wd = renderWord(text, px, o);
      var rx = wd.tw * 0.5 + px * (o.padX || 0.45), ry = px * (o.ry || 0.8);
      var cw = Math.ceil(rx * 2.4 + px * 0.2), ch = Math.ceil(ry * 2.4 + px * 0.2);
      var c = mk(cw, ch), g = c.getContext('2d'), cx = cw / 2, cy = ch / 2;
      var r = api.rng(o.seed || 7);
      var pts = burstPts(rx, ry, o.spikes || 16, r, o.jag || 0.2);
      g.save(); g.translate(cx + px * 0.07, cy + px * 0.09); polyPath(g, pts); g.fillStyle = PAL.ink; g.fill(); g.restore();
      g.save(); g.translate(cx, cy); polyPath(g, pts); g.fillStyle = o.burst; g.fill();
      g.save(); g.clip();
      var st = Math.max(4, px * 0.07);
      dots(g, -rx * 1.2, -ry * 1.2, rx * 2.4, ry * 2.4, st, function (xx, yy) { var v = Math.sqrt(xx * xx / (rx * rx) + yy * yy / (ry * ry)); return st * 0.5 * clamp(v * v, 0, 1); }, o.burstDot || 'rgba(0,0,0,0.25)');
      if (o.burst2) { polyPath(g, scalePts(pts, 0.7)); g.fillStyle = o.burst2; g.globalAlpha = 0.55; g.fill(); g.globalAlpha = 1; }
      g.restore();
      polyPath(g, pts); g.lineJoin = 'miter'; g.lineWidth = Math.max(3, px * 0.045); g.strokeStyle = PAL.ink; g.stroke();
      g.restore();
      g.drawImage(wd.c, cx - wd.cx, cy - wd.cy);
      return { c: c, cx: cx, cy: cy, rx: rx, ry: ry };
    }

    // a rectangular caption box
    function renderCaption(lines, px, bg, fg) {
      var tw = 0; lines.forEach(function (l) { tw = Math.max(tw, measure(l, px)); });
      var pad = px * 0.55, lh = px * 1.12, sh = px * 0.22;
      var bw = tw + pad * 2, bh = lines.length * lh + pad * 1.1;
      var c = mk(bw + sh + 6, bh + sh + 6), g = c.getContext('2d');
      g.fillStyle = PAL.ink; g.fillRect(3 + sh, 3 + sh, bw, bh);
      g.fillStyle = bg; g.fillRect(3, 3, bw, bh);
      g.save(); g.beginPath(); g.rect(3, 3, bw, bh); g.clip();
      var st = px * 0.32; dots(g, 3, 3, bw, bh, st, function (x, y) { return st * 0.32 * clamp((y - 3) / bh, 0, 1); }, 'rgba(0,0,0,0.1)');
      g.restore();
      g.lineWidth = Math.max(2, px * 0.1); g.strokeStyle = PAL.ink; g.strokeRect(3, 3, bw, bh);
      g.font = px + 'px ' + FONT; g.fillStyle = fg; g.textBaseline = 'alphabetic';
      lines.forEach(function (l, i) { g.fillText(l, 3 + pad, 3 + pad * 0.55 + lh * i + px * 0.92); });
      return c;
    }

    function renderIssue(d) {
      var px = W * 0.016, n = String(dayOfYear(d));
      var bw = px * 6.2, bh = px * 6.4, sh = px * 0.25;
      var c = mk(bw + sh + 6, bh + sh + 6), g = c.getContext('2d');
      g.fillStyle = PAL.ink; g.fillRect(3 + sh, 3 + sh, bw, bh);
      g.fillStyle = '#f4ecd6'; g.fillRect(3, 3, bw, bh);
      g.fillStyle = PAL.acc; g.fillRect(3, 3, bw, px * 1.5);
      g.lineWidth = Math.max(2, px * 0.12); g.strokeStyle = PAL.ink; g.strokeRect(3, 3, bw, bh);
      g.textAlign = 'center'; g.font = px * 0.95 + 'px ' + FONT; g.fillStyle = '#fff8e0';
      g.fillText('ISSUE', 3 + bw / 2, 3 + px * 1.17);
      g.fillStyle = PAL.ink; g.font = px * 0.9 + 'px ' + FONT; g.fillText('No.', 3 + bw / 2, 3 + px * 2.55);
      g.font = px * 2.6 + 'px ' + FONT; g.fillStyle = PAL.acc2; g.fillText(n, 3 + bw / 2 + px * 0.08, 3 + px * 4.75);
      g.fillStyle = PAL.ink; g.fillText(n, 3 + bw / 2, 3 + px * 4.7);
      g.font = px * 0.95 + 'px ' + FONT; g.fillText(api.MONTHS[d.getMonth()].slice(0, 3).toUpperCase() + ' ' + d.getDate(), 3 + bw / 2, 3 + px * 5.95);
      return c;
    }

    function dayOfYear(d) {
      var a = new Date(d.getFullYear(), d.getMonth(), d.getDate()), b = new Date(d.getFullYear(), 0, 0);
      return Math.round((a - b) / 864e5);
    }

    function makeClockSprite(d) {
      var h = d.getHours();
      var text = ((h % 12) || 12) + ':' + api.pad(d.getMinutes());
      clk.ampm = h < 12 ? 'AM' : 'PM';
      return renderBurstText(text, F, {
        fill1: PAL.clockFill, fill2: PAL.clockFill2, depthCol: PAL.clockDepth, depth: F * 0.09, burst: PAL.burst, burst2: PAL.burst2,
        burstDot: PAL.burstDot, spikes: 22, jag: 0.16, ry: 0.78, padX: 0.42, seed: d.getMinutes() * 31 + h, ghost: calm ? 'rgba(77,214,255,0.5)' : PAL.cyan,
        dot: 'rgba(120,40,0,0.22)'
      });
    }

    function updateCaption(d) {
      var key = d.toDateString() + moodName + calm;
      if (key === capKey && capSpr) return;
      capKey = key;
      var line1 = api.DAYS[d.getDay()] + ', ' + api.MONTHS[d.getMonth()] + ' ' + d.getDate();
      capSpr = renderCaption([line1.toUpperCase(), (calm ? MOOD_LINE.calm : MOOD_LINE[moodName]).toUpperCase()], W * 0.0175, PAL.capBg, PAL.capFg);
      issueSpr = renderIssue(d); placeOverlays();
    }

    // ================= static art =================
    function buildPage() {
      var c = mk(W, H), g = c.getContext('2d');
      g.fillStyle = PAL.paper; g.fillRect(0, 0, W, H);
      var st = W * 0.0072;
      dots(g, 0, 0, W, H, st, function () { return st * 0.26; }, PAL.paperDot);
      var r = api.rng(11); g.fillStyle = PAL.speck;
      for (var i = 0; i < 500; i++) g.fillRect(r() * W, r() * H, 1 + r() * 2.5, 1 + r() * 2.5);
      return c;
    }

    function cloud(g, x, y, s, r) {
      var n = 4 + ((r() * 3) | 0), cs = [];
      for (var i = 0; i < n; i++) cs.push([x + (i - n / 2) * s * 0.75 + r() * s * 0.2, y - (i > 0 && i < n - 1 ? s * 0.35 * r() : 0), s * (0.42 + r() * 0.35)]);
      g.beginPath();
      cs.forEach(function (q) { g.moveTo(q[0] + q[2], q[1]); g.arc(q[0], q[1], q[2], 0, TAU); });
      g.lineWidth = LW * 1.6; g.strokeStyle = PAL.ink; g.stroke();
      g.fillStyle = PAL.cloud; g.fill();
    }

    function paintMoon(g, x, y, Rm, r) {
      g.save();
      if (PAL.isSun) {
        g.beginPath();
        for (var i = 0; i < 16; i++) {
          var a = i / 16 * TAU;
          g.moveTo(x + Math.cos(a - 0.09) * Rm * 1.1, y + Math.sin(a - 0.09) * Rm * 1.1);
          g.lineTo(x + Math.cos(a) * Rm * (i % 2 ? 1.45 : 1.7), y + Math.sin(a) * Rm * (i % 2 ? 1.45 : 1.7));
          g.lineTo(x + Math.cos(a + 0.09) * Rm * 1.1, y + Math.sin(a + 0.09) * Rm * 1.1);
          g.closePath();
        }
        g.fillStyle = PAL.hi; g.fill(); g.lineWidth = LW * 0.6; g.strokeStyle = PAL.ink; g.stroke();
      } else {
        var gg = g.createRadialGradient(x, y, Rm * 0.9, x, y, Rm * 2.4);
        gg.addColorStop(0, PAL.moonGlow); gg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gg; g.beginPath(); g.arc(x, y, Rm * 2.4, 0, TAU); g.fill();
      }
      g.beginPath(); g.arc(x, y, Rm, 0, TAU); g.fillStyle = PAL.moon; g.fill();
      g.save(); g.clip();
      var st = Math.max(4, Rm * 0.1);
      dots(g, x - Rm, y - Rm, Rm * 2, Rm * 2, st, function (px, py) { var d = ((px - x) + (py - y)) / (2 * Rm) + 0.1; return d > 0 ? st * 0.56 * Math.min(1, d * 1.7) : 0; }, PAL.moonShade);
      if (!PAL.isSun) {
        g.fillStyle = 'rgba(150,120,40,0.28)';
        for (var k = 0; k < 6; k++) { g.beginPath(); g.arc(x + (r() - 0.6) * Rm * 1.2, y + (r() - 0.5) * Rm * 1.2, Rm * (0.08 + r() * 0.14), 0, TAU); g.fill(); }
      }
      g.restore();
      g.beginPath(); g.arc(x, y, Rm, 0, TAU); g.lineWidth = LW * 0.8; g.strokeStyle = PAL.ink; g.stroke();
      g.restore();
    }

    function paintSky(g, w, h, r, o) {
      var gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, PAL.sky1); gr.addColorStop(1, PAL.sky2);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      var st = W * 0.0105;
      dots(g, 0, 0, w, h, st, function (x, y) { var v = y / h; return st * 0.52 * v * v; }, PAL.skyDot);
      if (!PAL.isSun) {
        g.fillStyle = PAL.hi;
        for (var i = 0; i < 26; i++) {
          var sx = r() * w, sy = r() * h * 0.6, s = W * (0.002 + r() * 0.004);
          g.beginPath(); g.moveTo(sx, sy - s * 2); g.lineTo(sx + s * 0.4, sy - s * 0.4); g.lineTo(sx + s * 2, sy); g.lineTo(sx + s * 0.4, sy + s * 0.4);
          g.lineTo(sx, sy + s * 2); g.lineTo(sx - s * 0.4, sy + s * 0.4); g.lineTo(sx - s * 2, sy); g.lineTo(sx - s * 0.4, sy - s * 0.4); g.closePath();
          g.globalAlpha = 0.35 + r() * 0.5; g.fill();
        }
        g.globalAlpha = 1;
      }
      if (o.moon) paintMoon(g, o.moon.x, o.moon.y, o.moon.R, r);
      for (var j = 0; j < (o.clouds || 0); j++) cloud(g, r() * w, h * (0.12 + r() * 0.38), W * (0.022 + r() * 0.03), r);
    }

    function waterTower(g, cx, top, s) {
      g.fillRect(cx - s * 0.42, top - s * 0.7, s * 0.09, s * 0.72);
      g.fillRect(cx + s * 0.33, top - s * 0.7, s * 0.09, s * 0.72);
      g.fillRect(cx - s * 0.5, top - s * 1.55, s, s * 0.9);
      g.beginPath(); g.moveTo(cx - s * 0.56, top - s * 1.5); g.lineTo(cx, top - s * 1.95); g.lineTo(cx + s * 0.56, top - s * 1.5); g.fill();
    }

    function skyline(g, w, h, r, o) {
      var x = -r() * w * 0.05, roofs = [], rimW = Math.max(1.5, W * 0.0013);
      while (x < w) {
        var bw = h * (o.minW + r() * (o.maxW - o.minW)), bh = h * (o.minH + r() * (o.maxH - o.minH)), top = h - bh;
        g.fillStyle = o.col; g.fillRect(x, top, bw + 1, bh + 2);
        if (r() < 0.38) {
          var sw = bw * (0.3 + r() * 0.4), sx = x + (bw - sw) * r(), shh = h * (0.03 + r() * 0.07);
          g.fillRect(sx, top - shh, sw, shh + 1);
          if (r() < 0.6) g.fillRect(sx + sw / 2 - 1.5, top - shh - h * 0.1, 3, h * 0.1);
          if (o.rim) { g.fillStyle = o.rim; g.fillRect(sx, top - shh, rimW, shh); g.fillStyle = o.col; }
        }
        if (o.towers && r() < 0.3) waterTower(g, x + bw * (0.3 + r() * 0.4), top, h * 0.07);
        var ww = o.ws, wh = ww * 1.5, gx = ww * 2.1, gy = wh * 1.8;
        g.fillStyle = o.win;
        for (var yy = top + gy * 0.8; yy < h - gy * 0.5; yy += gy) {
          for (var xx = x + gx * 0.6; xx < x + bw - gx * 0.5; xx += gx) if (r() < o.winP) g.fillRect(xx, yy, ww, wh);
        }
        if (o.rim) { g.fillStyle = o.rim; g.fillRect(x, top, rimW, bh); g.fillRect(x, top, bw, rimW); }
        roofs.push([x, x + bw, top]);
        x += bw + (r() < 0.3 ? h * 0.025 * r() : 0);
      }
      return roofs;
    }

    function radialLines(w, h, cx, cy, n, col, r, inner) {
      var c = mk(w, h), g = c.getContext('2d'), D = Math.sqrt(w * w + h * h);
      g.fillStyle = col; g.beginPath();
      for (var i = 0; i < n; i++) {
        var a = r() * TAU, da = 0.006 + r() * 0.016, r1 = D * (inner + r() * 0.3), r2 = D * 1.1;
        g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        g.lineTo(cx + Math.cos(a - da) * r2, cy + Math.sin(a - da) * r2);
        g.lineTo(cx + Math.cos(a + da) * r2, cy + Math.sin(a + da) * r2);
        g.closePath();
      }
      g.fill();
      return c;
    }

    function radialDots(w, h, cx, cy, col, st) {
      var c = mk(w, h), g = c.getContext('2d');
      var D = Math.sqrt(Math.pow(Math.max(cx, w - cx), 2) + Math.pow(Math.max(cy, h - cy), 2));
      dots(g, 0, 0, w, h, st, function (x, y) { var v = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / D; return st * 0.55 * v * v; }, col);
      return c;
    }

    // ================= the hero (original design: masked runner with a tattered cape) =================
    function joints(P, f) {
      function D(a, l) { var q = a * Math.PI / 180; return [Math.sin(q) * l * f, Math.cos(q) * l]; }
      function A(p, d) { return [p[0] + d[0], p[1] + d[1]]; }
      var hip = [0, 0], neck = A(hip, D(P.torso, 33)), sh = A(hip, D(P.torso, 28)), head = A(neck, D(P.head, 8.5));
      var e1 = A(sh, D(P.sh1, 16)), h1 = A(e1, D(P.el1, 15)), e2 = A(sh, D(P.sh2, 16)), h2 = A(e2, D(P.el2, 15));
      var k1 = A(hip, D(P.hip1, 22)), f1 = A(k1, D(P.kn1, 22)), k2 = A(hip, D(P.hip2, 22)), f2 = A(k2, D(P.kn2, 22));
      return { hip: hip, neck: neck, sh: sh, head: head, e1: e1, h1: h1, e2: e2, h2: h2, k1: k1, f1: f1, k2: k2, f2: f2, hd: D(P.head, 1) };
    }
    function limb(g, a, b, wa, wb) {
      var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / L, ny = dx / L;
      g.beginPath();
      g.moveTo(a[0] + nx * wa / 2, a[1] + ny * wa / 2); g.lineTo(b[0] + nx * wb / 2, b[1] + ny * wb / 2);
      g.lineTo(b[0] - nx * wb / 2, b[1] - ny * wb / 2); g.lineTo(a[0] - nx * wa / 2, a[1] - ny * wa / 2); g.closePath(); g.fill();
      g.beginPath(); g.arc(a[0], a[1], wa / 2, 0, TAU); g.fill();
      g.beginPath(); g.arc(b[0], b[1], wb / 2, 0, TAU); g.fill();
    }
    function boot(g, k, a, f) {
      var dx = a[0] - k[0], dy = a[1] - k[1], L = Math.sqrt(dx * dx + dy * dy) || 1; dx /= L; dy /= L;
      var fd = f > 0 ? [dy, -dx] : [-dy, dx];
      limb(g, a, [a[0] + fd[0] * 7.5, a[1] + fd[1] * 7.5], 6.4, 4.4);
    }
    function cape(g, J, tt, o) {
      var wd = o.wind || [-1, 0.4], L = Math.sqrt(wd[0] * wd[0] + wd[1] * wd[1]); wd = [wd[0] / L, wd[1] / L];
      var wn = [-wd[1], wd[0]], len = o.len || 60, sp = o.speed || 6, amp = o.amp || 4, N = 10, Ls = [], Rs = [], a = J.sh, i;
      for (i = 0; i <= N; i++) {
        var s = i / N, wave = (Math.sin(tt * sp - s * 4.5) + 0.45 * Math.sin(tt * sp * 1.7 - s * 8)) * amp * s;
        var cx = a[0] + wd[0] * len * s + wn[0] * wave, cy = a[1] + wd[1] * len * s + wn[1] * wave + s * s * len * (o.sag != null ? o.sag : 0.1);
        var hw = 5 + s * 12;
        Ls.push([cx + wn[0] * hw, cy + wn[1] * hw]); Rs.push([cx - wn[0] * hw, cy - wn[1] * hw]);
      }
      g.beginPath(); g.moveTo(Ls[0][0], Ls[0][1]);
      for (i = 1; i <= N; i++) g.lineTo(Ls[i][0], Ls[i][1]);
      var e1 = Ls[N], e2 = Rs[N];
      for (var k = 1; k < 5; k++) { var q = k / 5, back = (k % 2) ? -8 : 1; g.lineTo(lerp(e1[0], e2[0], q) + wd[0] * back, lerp(e1[1], e2[1], q) + wd[1] * back); }
      for (i = N; i >= 0; i--) g.lineTo(Rs[i][0], Rs[i][1]);
      g.closePath(); g.fill();
    }
    function heroShape(g, J, f, tt, o, col) {
      if (o.capeFill && col !== o.rimCol) { g.fillStyle = o.capeFill; cape(g, J, tt, o); g.lineJoin = 'round'; g.lineWidth = 1.6; g.strokeStyle = col; g.stroke(); }
      else { g.fillStyle = col; cape(g, J, tt, o); }
      g.fillStyle = col;
      limb(g, J.hip, J.k2, 15, 10.5); limb(g, J.k2, J.f2, 10.5, 7); boot(g, J.k2, J.f2, f);
      limb(g, J.sh, J.e2, 9, 7); limb(g, J.e2, J.h2, 7, 5.6); g.beginPath(); g.arc(J.h2[0], J.h2[1], 4.2, 0, TAU); g.fill();
      limb(g, J.hip, J.sh, 15, 23);
      var cx = lerp(J.hip[0], J.sh[0], 0.62), cy = lerp(J.hip[1], J.sh[1], 0.62);
      g.beginPath(); g.arc(cx, cy, 10.5, 0, TAU); g.fill();
      limb(g, J.sh, J.head, 7.5, 7);
      g.beginPath(); g.arc(J.head[0], J.head[1], 7.8, 0, TAU); g.fill();
      limb(g, J.hip, J.k1, 15.5, 10.8); limb(g, J.k1, J.f1, 10.8, 7.2); boot(g, J.k1, J.f1, f);
      limb(g, J.sh, J.e1, 10, 7.6); limb(g, J.e1, J.h1, 7.6, 6); g.beginPath(); g.arc(J.h1[0], J.h1[1], 4, 0, TAU); g.fill();
    }
    function heroEye(g, J, f, col) {
      var u = J.hd, fw = f > 0 ? [-u[1], u[0]] : [u[1], -u[0]], c = J.head;
      function P(a, b) { return [c[0] + fw[0] * a - u[0] * b, c[1] + fw[1] * a - u[1] * b]; }
      var a = P(1.4, -1.2), b = P(7.4, -2.8), d = P(7.0, -0.4), e = P(1.8, 0.1);
      g.fillStyle = col; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(d[0], d[1]); g.lineTo(e[0], e[1]); g.closePath(); g.fill();
    }
    // the hero is drawn as an ink silhouette with an offset rim-light copy behind it
    function drawHero(g, x, y, sc, P, f, tt, o) {
      var J = joints(P, f);
      g.save(); g.translate(x, y); if (o.rot) g.rotate(o.rot); g.scale(sc, sc);
      o.rimCol = o.rim || PAL.rim;
      if (o.capeFill === undefined) o.capeFill = PAL.cape;
      g.save(); g.translate(o.rimX != null ? o.rimX : -1.7, o.rimY != null ? o.rimY : -1.5); heroShape(g, J, f, tt, o, o.rimCol); g.restore();
      heroShape(g, J, f, tt, o, o.ink || PAL.ink);
      heroEye(g, J, f, o.eye || PAL.lens);
      g.restore();
    }

    // ================= panel scenes =================
    function buildCity(p) {
      var w = p.w, h = p.h, r = api.rng(p.seed), c = {}, g;
      c.sky = mk(w, h); g = c.sky.getContext('2d');
      paintSky(g, w, h, r, { moon: { x: w * (0.2 + r() * 0.6), y: h * 0.27, R: Math.min(w, h) * 0.12 }, clouds: PAL.isSun ? 3 : 2 });
      c.far = mk(w, h); g = c.far.getContext('2d');
      skyline(g, w, h, r, { minH: 0.3, maxH: 0.62, minW: 0.07, maxW: 0.18, col: PAL.far, win: PAL.farWin, winP: 0.35, ws: W * 0.0024 });
      c.near = mk(w, h); g = c.near.getContext('2d');
      c.roofs = skyline(g, w, h, r, { minH: 0.13, maxH: 0.34, minW: 0.1, maxW: 0.24, col: PAL.near, win: PAL.win, winP: PAL.isSun ? 0.16 : 0.42, ws: W * 0.0032, rim: PAL.rim, towers: true });
      var sum = 0; c.roofs.forEach(function (q) { sum += q[2]; }); c.base = sum / c.roofs.length;
      c.lights = [[w * (0.12 + r() * 0.25), r() * 6], [w * (0.58 + r() * 0.3), r() * 6]];
      c.birds = [];
      for (var i = 0; i < 6; i++) c.birds.push({ x: r() * w, y: h * (0.12 + r() * 0.25), s: W * (0.004 + r() * 0.003), v: W * (0.012 + r() * 0.01), ph: r() * 6 });
      return c;
    }
    function drawCity(p, c) {
      var px = -cam.x * M, py = -cam.y * M * 0.6, w = p.w, h = p.h, i;
      ctx.drawImage(c.sky, px * 0.25, py * 0.25);
      if (!PAL.isSun || moodName === 'dusk') {
        for (i = 0; i < c.lights.length; i++) {
          var L = c.lights[i], bx = L[0] + px * 0.55, by = h + 4;
          var ang = -Math.PI / 2 + Math.sin(t * 0.33 + L[1]) * 0.62, len = h * 1.7, spr = 0.055;
          var gr = ctx.createLinearGradient(bx, by, bx + Math.cos(ang) * len, by + Math.sin(ang) * len);
          gr.addColorStop(0, PAL.beam + (calm ? '0.3)' : '0.5)')); gr.addColorStop(1, PAL.beam + '0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(bx - 4, by);
          ctx.lineTo(bx + Math.cos(ang - spr) * len, by + Math.sin(ang - spr) * len);
          ctx.lineTo(bx + Math.cos(ang + spr) * len, by + Math.sin(ang + spr) * len);
          ctx.lineTo(bx + 4, by); ctx.closePath(); ctx.fill();
        }
      }
      ctx.drawImage(c.far, px * 0.55, py * 0.55);
      if (PAL.isSun && moodName !== 'dusk') {
        ctx.strokeStyle = PAL.ink; ctx.lineWidth = Math.max(1.5, W * 0.0014); ctx.lineCap = 'round'; ctx.beginPath();
        c.birds.forEach(function (b) {
          var bxp = ((b.x + t * b.v) % (w + 40)) - 20 + px * 0.4, byp = b.y + Math.sin(t * 0.8 + b.ph) * h * 0.02 + py * 0.4, fl = Math.sin(t * 9 + b.ph) * b.s * 0.6;
          ctx.moveTo(bxp - b.s, byp - fl); ctx.quadraticCurveTo(bxp - b.s * 0.4, byp - b.s * 0.3, bxp, byp); ctx.quadraticCurveTo(bxp + b.s * 0.4, byp - b.s * 0.3, bxp + b.s, byp - fl);
        });
        ctx.stroke(); ctx.lineCap = 'butt';
      }
      ctx.drawImage(c.near, px, py);
      if (!p.leap && t >= p.nextLeap) p.leap = { t0: t, dir: R() < 0.5 ? 1 : -1, dur: calm ? 3.6 : 2.4 };
      if (p.leap) {
        var u = (t - p.leap.t0) / p.leap.dur;
        if (u >= 1) { p.leap = null; p.nextLeap = t + (calm ? 26 : 8) + R() * 7; }
        else drawLeaper(p, c, u, px, py);
      }
    }
    function drawLeaper(p, c, u, px, py) {
      var dir = p.leap.dir, w = p.w, h = p.h;
      var sc = Math.min(h * 0.3, W * 0.085) / 100;
      var x = dir > 0 ? lerp(-0.12 * w, 1.12 * w, u) : lerp(1.12 * w, -0.12 * w, u);
      var hu = (u * 2) % 1, arc = Math.sin(Math.PI * hu), vy = Math.cos(Math.PI * hu);
      var y = c.base - 24 * sc - arc * h * 0.26 + py;
      var pose = lerpPose(POSES.crouch, POSES.leap, Math.min(1, arc * 2.4));
      // trailing speed lines
      ctx.fillStyle = PAL.ink; ctx.globalAlpha = 0.75; ctx.beginPath();
      for (var k = 0; k < 6; k++) {
        var ly = y - sc * 10 + (k - 2.5) * sc * 8 + vy * sc * k * 3, lx = x + px - dir * sc * (26 + (k % 3) * 10), ll = sc * (50 + ((k * 37) % 4) * 18), th = sc * (1 + (k % 2));
        ctx.moveTo(lx, ly - th); ctx.lineTo(lx - dir * ll, ly); ctx.lineTo(lx, ly + th); ctx.closePath();
      }
      ctx.fill(); ctx.globalAlpha = 1;
      drawHero(ctx, x + px, y, sc, pose, dir, t, { wind: [-dir, 0.25 + vy * 0.6], len: 60, speed: 14, amp: 5, sag: 0.04 });
    }

    function buildFlight(p) {
      var w = p.w, h = p.h, r = api.rng(p.seed), c = {}, g;
      c.dir = p.cx < W / 2 ? 1 : -1;
      c.bg = mk(w, h); g = c.bg.getContext('2d');
      var gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, PAL.flightA); gr.addColorStop(1, PAL.flightB);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      var st = W * 0.011;
      dots(g, 0, 0, w, h, st, function (x, y) { var v = c.dir > 0 ? 1 - x / w : x / w; return st * 0.5 * v; }, PAL.isSun ? 'rgba(255,255,255,0.35)' : 'rgba(90,150,255,0.3)');
      c.lines = [];
      for (var k = 0; k < 3; k++) {
        var lc = mk(w, h), lg = lc.getContext('2d'), rr = api.rng(p.seed + 17 * k + 1);
        for (var i = 0; i < 46; i++) {
          var y = rr() * h, len = w * (0.25 + rr() * 0.7), x0 = c.dir > 0 ? rr() * w * 0.5 : w - rr() * w * 0.5, th = H * (0.002 + rr() * 0.007);
          lg.fillStyle = rr() < 0.55 ? 'rgba(0,0,0,0.55)' : (PAL.isSun ? 'rgba(255,255,255,0.75)' : 'rgba(150,200,255,0.5)');
          lg.beginPath(); lg.moveTo(x0, y - th); lg.lineTo(x0 - c.dir * len, y); lg.lineTo(x0, y + th); lg.closePath(); lg.fill();
        }
        c.lines.push(lc);
      }
      c.puffs = [];
      for (var j = 0; j < 4; j++) c.puffs.push({ x: r() * w, y: h * (0.1 + r() * 0.8), s: 0.5 + r() * 0.7, v: W * (0.35 + r() * 0.4) });
      c.cl = mk(W * 0.2, W * 0.08); cloud(c.cl.getContext('2d'), W * 0.1, W * 0.05, W * 0.028, r);
      return c;
    }
    function drawFlight(p, c) {
      var px = -cam.x * M, py = -cam.y * M * 0.6, w = p.w, h = p.h, dir = c.dir, sp = calm ? 0.35 : 1;
      ctx.drawImage(c.bg, px * 0.2, py * 0.2);
      ctx.drawImage(c.lines[boil()], px * 0.5, py * 0.5);
      c.puffs.forEach(function (q) {
        var cw = c.cl.width * q.s * 1.7, chh = c.cl.height * q.s, span = w + cw * 2;
        var xx = ((q.x - dir * rt * q.v * sp) % span + span) % span - cw;
        ctx.drawImage(c.cl, xx + px * 0.8, q.y - chh / 2 + py * 0.8, cw, chh);
      });
      var sc = Math.min(w * 0.55 / 125, h * 0.62 / 60);
      var P = Object.assign({}, POSES.fly);
      P.kn2 += Math.sin(t * 4) * 12; P.hip2 += Math.sin(t * 4) * 5; P.kn1 += Math.sin(t * 4 + 1.5) * 5;
      var bob = Math.sin(t * 1.7) * h * 0.05;
      drawHero(ctx, w / 2 + px * 1.2 - dir * sc * 6, h / 2 + bob + py + sc * 8, sc, P, dir, t, { wind: [-dir, 0.06], len: 68, speed: calm ? 5 : 12, amp: 5, sag: 0.02, rot: dir * (-0.1 + Math.sin(t * 0.9) * 0.05) });
    }

    function buildEyes(p) {
      var w = p.w, h = p.h, r = api.rng(p.seed), c = {}, g;
      var fx = w / 2, fy = h * 0.57, Rf = Math.max(w * 0.36, h * 0.52);
      c.fx = fx; c.fy = fy; c.R = Rf; c.ph = r() * 5;
      c.bg = mk(w, h); g = c.bg.getContext('2d');
      var gr = g.createRadialGradient(fx, fy - Rf * 0.25, 0, fx, fy - Rf * 0.25, Math.max(w, h) * 0.75);
      gr.addColorStop(0, PAL.hi); gr.addColorStop(1, PAL.acc);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.globalAlpha = 0.5; g.drawImage(radialDots(w, h, fx, fy - Rf * 0.25, PAL.acc2, W * 0.012), 0, 0); g.globalAlpha = 1;
      c.lines = [0, 1, 2].map(function (k) { return radialLines(w, h, fx, fy - Rf * 0.25, 60, 'rgba(0,0,0,0.6)', api.rng(p.seed + k * 31 + 3), 0.3); });
      c.face = mk(w, h); g = c.face.getContext('2d');
      function X(k) { return fx + k * Rf; }
      function Y(k) { return fy + k * Rf; }
      function headPath() {
        g.beginPath(); g.moveTo(X(0), Y(-1));
        g.bezierCurveTo(X(0.62), Y(-1), X(0.86), Y(-0.62), X(0.84), Y(-0.18));
        g.bezierCurveTo(X(0.83), Y(0.18), X(0.74), Y(0.42), X(0.56), Y(0.62));
        g.bezierCurveTo(X(0.4), Y(0.8), X(0.22), Y(0.9), X(0), Y(0.9));
        g.bezierCurveTo(X(-0.22), Y(0.9), X(-0.4), Y(0.8), X(-0.56), Y(0.62));
        g.bezierCurveTo(X(-0.74), Y(0.42), X(-0.83), Y(0.18), X(-0.84), Y(-0.18));
        g.bezierCurveTo(X(-0.86), Y(-0.62), X(-0.62), Y(-1), X(0), Y(-1));
        g.closePath();
      }
      // neck and shoulders
      g.fillStyle = PAL.suitDark; g.strokeStyle = PAL.ink; g.lineWidth = LW * 1.4;
      g.beginPath(); g.moveTo(X(-0.42), Y(0.5)); g.lineTo(X(0.42), Y(0.5)); g.lineTo(X(0.5), Y(0.95)); g.lineTo(X(1.9), Y(1.35)); g.lineTo(X(2), Y(3)); g.lineTo(X(-2), Y(3)); g.lineTo(X(-1.9), Y(1.35)); g.lineTo(X(-0.5), Y(0.95)); g.closePath();
      g.fill(); g.stroke();
      g.fillStyle = PAL.suit; g.beginPath(); g.moveTo(X(-0.4), Y(0.5)); g.lineTo(X(0.4), Y(0.5)); g.lineTo(X(0.36), Y(1.05)); g.lineTo(X(-0.36), Y(1.05)); g.closePath(); g.fill(); g.stroke();
      // head
      headPath(); g.fillStyle = PAL.suit; g.fill();
      g.save(); g.clip();
      var st = Rf * 0.055;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.moveTo(X(0.3), Y(-1.1)); g.bezierCurveTo(X(0.5), Y(-0.6), X(0.12), Y(-0.1), X(0.3), Y(0.3));
      g.bezierCurveTo(X(0.42), Y(0.55), X(0.22), Y(0.75), X(0.3), Y(1)); g.lineTo(X(1), Y(1)); g.lineTo(X(1), Y(-1.1)); g.closePath(); g.fill();
      dots(g, X(-1), Y(-1), Rf * 2, Rf * 2, st, function (x, y) { var v = (x - fx) / (Rf * 0.84) + 0.15 + (y - fy) / Rf * 0.15; return v > 0 ? st * 0.5 * Math.min(1, v * 1.3) : 0; }, 'rgba(0,0,0,0.4)');
      // mask band
      g.beginPath();
      g.moveTo(X(-1), Y(-0.52)); g.lineTo(X(0), Y(-0.38)); g.lineTo(X(1), Y(-0.52));
      g.lineTo(X(1), Y(-0.04)); g.lineTo(X(0.22), Y(-0.06)); g.lineTo(X(0), Y(0.06)); g.lineTo(X(-0.22), Y(-0.06)); g.lineTo(X(-1), Y(-0.04)); g.closePath();
      g.fillStyle = PAL.mask; g.fill();
      g.lineWidth = LW * 1.1; g.strokeStyle = PAL.ink; g.stroke();
      g.save(); g.clip();
      dots(g, X(-1), Y(-0.6), Rf * 2, Rf * 0.7, st * 0.8, function (x) { var v = (x - fx) / Rf + 0.2; return v > 0 ? st * 0.42 * Math.min(1, v * 1.4) : 0; }, 'rgba(0,0,0,0.4)');
      g.restore();
      // cheek hatching
      g.strokeStyle = PAL.ink; g.lineWidth = LW * 0.55; g.lineCap = 'round'; g.beginPath();
      for (var i = 0; i < 5; i++) { g.moveTo(X(0.5 + i * 0.05), Y(0.08 + i * 0.03)); g.lineTo(X(0.4 + i * 0.05), Y(0.3 + i * 0.03)); }
      g.stroke();
      g.restore();
      // rim light and outline
      g.save(); g.translate(-LW * 1.2, -LW * 0.6); headPath(); g.restore();
      g.lineWidth = LW * 1.6; g.strokeStyle = PAL.rim; g.stroke();
      headPath(); g.lineWidth = LW * 1.5; g.strokeStyle = PAL.ink; g.stroke();
      // nose, mouth, chin
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.moveTo(X(0.03), Y(0.1)); g.lineTo(X(0.12), Y(0.31)); g.lineTo(X(-0.03), Y(0.33)); g.closePath(); g.fill();
      g.lineCap = 'round'; g.lineWidth = LW * 1.0; g.strokeStyle = PAL.ink;
      g.beginPath(); g.moveTo(X(0.04), Y(0.12)); g.lineTo(X(0.12), Y(0.31)); g.lineTo(X(0.02), Y(0.33)); g.stroke();
      g.lineWidth = LW * 1.5; g.beginPath(); g.moveTo(X(-0.24), Y(0.56)); g.quadraticCurveTo(X(-0.2), Y(0.52), X(0), Y(0.52)); g.quadraticCurveTo(X(0.2), Y(0.52), X(0.23), Y(0.57)); g.stroke();
      g.lineWidth = LW * 0.8; g.beginPath(); g.moveTo(X(-0.08), Y(0.65)); g.lineTo(X(0.09), Y(0.645)); g.stroke();
      g.beginPath(); g.moveTo(X(0), Y(0.8)); g.lineTo(X(0.01), Y(0.86)); g.stroke();
      g.lineCap = 'butt';
      return c;
    }
    function drawEyes(p, c) {
      var px = -cam.x * M, py = -cam.y * M * 0.6;
      ctx.drawImage(c.bg, px * 0.2, py * 0.2);
      ctx.drawImage(c.lines[boil()], px * 0.35, py * 0.35);
      ctx.drawImage(c.face, px, py);
      var ph = (t + c.ph) % 5.6, open = ph < 0.22 ? Math.abs(ph - 0.11) / 0.11 : 1;
      if (calm) open = Math.min(open, 0.55 + Math.sin(t * 0.3) * 0.1);
      var s = c.R * 0.2;
      for (var side = -1; side <= 1; side += 2) {
        var ex = c.fx + px + side * c.R * 0.37, ey = c.fy + py - c.R * 0.24;
        var pts = [[-0.95, 0.04], [1.0, -0.52], [1.08, 0.3], [-0.72, 0.36]].map(function (q) { return [ex + q[0] * side * s, ey + (q[1] - 0.05) * s * Math.max(0.08, open)]; });
        if (!PAL.isSun) {
          var gg = ctx.createRadialGradient(ex, ey, 0, ex, ey, s * 2.2);
          gg.addColorStop(0, 'rgba(255,250,200,0.45)'); gg.addColorStop(1, 'rgba(255,250,200,0)');
          ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(ex, ey, s * 2.2, 0, TAU); ctx.fill();
        }
        polyPath(ctx, pts); ctx.fillStyle = PAL.lens; ctx.fill();
        ctx.lineJoin = 'miter'; ctx.lineWidth = s * 0.16; ctx.strokeStyle = PAL.ink; ctx.stroke();
        ctx.lineCap = 'round'; ctx.lineWidth = s * 0.2;
        ctx.beginPath(); ctx.moveTo(ex - side * s * 1.05, ey - s * 0.22); ctx.lineTo(ex + side * s * 1.12, ey - s * 0.92); ctx.stroke();
        ctx.lineCap = 'butt';
      }
    }

    function buildVigil(p) {
      var w = p.w, h = p.h, r = api.rng(p.seed), c = {}, g;
      c.facing = p.cx < W / 2 ? 1 : -1;
      var mx = c.facing > 0 ? w * 0.64 : w * 0.36;
      c.sky = mk(w, h); g = c.sky.getContext('2d');
      paintSky(g, w, h, r, { moon: { x: mx, y: h * 0.4, R: Math.min(w, h) * 0.3 }, clouds: 0 });
      c.far = mk(w, h); g = c.far.getContext('2d');
      skyline(g, w, h, r, { minH: 0.16, maxH: 0.4, minW: 0.06, maxW: 0.14, col: PAL.far, win: PAL.farWin, winP: 0.3, ws: W * 0.0022 });
      c.near = mk(w, h); g = c.near.getContext('2d');
      var ly = h * 0.8, side = c.facing > 0 ? 0 : 1;
      g.fillStyle = PAL.near;
      g.fillRect(side ? w * 0.3 : 0, ly, w * 0.7, h - ly);
      g.fillRect(side ? w * 0.3 - w * 0.02 : 0, ly - h * 0.035, w * 0.72, h * 0.035);
      g.fillStyle = PAL.rim; g.fillRect(side ? w * 0.28 : 0, ly - h * 0.035, w * 0.72, Math.max(2, W * 0.0015));
      var edge = side ? w * 0.28 : w * 0.72; g.fillRect(edge - (side ? 0 : 2), ly - h * 0.035, Math.max(2, W * 0.0015), h);
      // antenna mast on the far side
      c.mast = [side ? w * 0.12 : w * 0.88, h * 0.5];
      g.fillStyle = PAL.near;
      g.fillRect(c.mast[0] - W * 0.0015, c.mast[1], W * 0.003, h);
      for (var i = 0; i < 8; i++) { var yy = c.mast[1] + i * h * 0.06; g.fillRect(c.mast[0] - W * 0.006, yy, W * 0.012, W * 0.0015); }
      c.ledge = ly - h * 0.035;
      c.heroX = c.facing > 0 ? w * (0.3 + r() * 0.1) : w * (0.7 - r() * 0.1);
      c.cl = mk(W * 0.2, W * 0.08); cloud(c.cl.getContext('2d'), W * 0.1, W * 0.05, W * 0.03, r);
      return c;
    }
    function drawVigil(p, c) {
      var px = -cam.x * M, py = -cam.y * M * 0.6, w = p.w, h = p.h;
      ctx.drawImage(c.sky, px * 0.2, py * 0.2);
      for (var i = 0; i < 2; i++) {
        var span = w + c.cl.width * 2, xx = ((t * W * 0.008 * (i + 1) + i * span * 0.55) % span) - c.cl.width;
        ctx.globalAlpha = PAL.isSun ? 0.95 : 0.85; ctx.drawImage(c.cl, xx + px * 0.3, h * (0.22 + i * 0.16) + py * 0.3); ctx.globalAlpha = 1;
      }
      ctx.drawImage(c.far, px * 0.5, py * 0.5);
      ctx.drawImage(c.near, px, py);
      var blink = calm ? 0.5 + 0.5 * Math.sin(t * 1.2) : ((t % 1.6) < 0.5 ? 1 : 0.15);
      ctx.fillStyle = 'rgba(255,60,60,' + blink.toFixed(2) + ')'; ctx.beginPath(); ctx.arc(c.mast[0] + px, c.mast[1] + py, W * 0.004, 0, TAU); ctx.fill();
      var sc = h * 0.42 / 100, P = Object.assign({}, POSES.stand);
      P.sh1 += Math.sin(t * 0.8) * 3; P.head += Math.sin(t * 0.4) * 4;
      drawHero(ctx, c.heroX + px, c.ledge + py - 45 * sc, sc, P, c.facing, t, { wind: [-c.facing, 0.05 + 0.18 * Math.sin(t * 0.7)], len: 66, speed: calm ? 2.5 : 4.5, amp: 7, sag: 0.08 });
    }

    function buildClockPanel(p) {
      var c = {};
      c.dots = radialDots(p.w, p.h, p.cx - p.bb.x + M, p.cy - p.bb.y + M, PAL.rayDot, W * 0.0115);
      return c;
    }
    function drawClockPanel(p, c) {
      var px = -cam.x * M, py = -cam.y * M * 0.6;
      var cx = (clk.x > 0 ? clk.x : p.cx) - (p.bb.x - M), cy = (clk.y > 0 ? clk.y : p.cy) - (p.bb.y - M);
      ctx.fillStyle = PAL.raysB; ctx.fillRect(0, 0, p.w, p.h);
      var n = 18, rot = t * (calm ? 0.012 : 0.05), RR = Math.sqrt(p.w * p.w + p.h * p.h) * 1.2;
      ctx.fillStyle = PAL.raysA; ctx.beginPath();
      for (var i = 0; i < n; i++) {
        var a0 = rot + i / n * TAU, a1 = a0 + TAU / n * 0.5;
        ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a0) * RR, cy + Math.sin(a0) * RR); ctx.lineTo(cx + Math.cos(a1) * RR, cy + Math.sin(a1) * RR); ctx.closePath();
      }
      ctx.fill();
      ctx.drawImage(c.dots, px * 0.5, py * 0.5);
    }

    var BUILD = { city: buildCity, flight: buildFlight, eyes: buildEyes, vigil: buildVigil, clock: buildClockPanel };
    var DRAW = { city: drawCity, flight: drawFlight, eyes: drawEyes, vigil: drawVigil, clock: drawClockPanel };

    // ================= page layouts =================
    function mkPanel(poly, type, seed) {
      var b = bbox(poly);
      var p = { poly: poly, bb: b, cx: b.cx, cy: b.cy, type: type, seed: seed, w: b.w + 2 * M, h: b.h + 2 * M, anim: null, nextLeap: t + 1.5 + R() * 4, leap: null };
      p.c = BUILD[type](p);
      return p;
    }
    function affinity(type, asp) {
      if (type === 'city') return asp > 1.6 ? 1.3 : asp > 1 ? 0.6 : -0.4;
      if (type === 'flight') return asp > 1.2 ? 0.8 : 0.1;
      if (type === 'eyes') return asp > 0.7 && asp < 2.6 ? 0.8 : -0.6;
      return asp < 1.7 ? 0.9 : 0;   // vigil
    }
    function makeLayout(seed) {
      var r = api.rng(seed), s = function (k) { return (r() - 0.5) * k; };
      var mx = W * 0.016, my = H * 0.024, g = W * 0.012;
      var P = [[mx, my], [W - mx, my], [W - mx, H - my], [mx, H - my]];
      var vs = function (poly, xt, xb) { return split(poly, [xt * W, 0], [xb * W, H], g); };
      var hs = function (poly, yl, yr) { return split(poly, [W, yr * H], [0, yl * H], g); };
      var kind = Math.floor(r() * 5), clock, others = [], a, b, c, d;
      if (kind === 0) {           // big clock left, stack right
        var x = 0.57 + s(0.04); d = s(0.12);
        a = vs(P, x + d, x - d); clock = a[0];
        b = hs(a[1], 0.5 + s(0.16), 0.5 + s(0.16)); others.push(b[0]);
        if (r() < 0.5) { c = vs(b[1], 0.785 + s(0.06), 0.785 + s(0.06)); others.push(c[0], c[1]); } else others.push(b[1]);
      } else if (kind === 1) {    // clock across the top, three below
        var y = 0.6 + s(0.04); d = s(0.1);
        a = hs(P, y + d, y - d); clock = a[0];
        var x1 = 0.34 + s(0.06), x2 = 0.67 + s(0.06);
        b = vs(a[1], x1 + s(0.08), x1 + s(0.08)); others.push(b[0]);
        c = vs(b[1], x2 + s(0.08), x2 + s(0.08)); others.push(c[0], c[1]);
      } else if (kind === 2) {    // two-panel strip on top, clock bottom-left
        a = hs(P, 0.33 + s(0.06), 0.33 + s(0.06));
        b = vs(a[0], 0.46 + s(0.12), 0.46 + s(0.12)); others.push(b[0], b[1]);
        c = vs(a[1], 0.64 + s(0.05), 0.6 + s(0.05)); clock = c[0]; others.push(c[1]);
      } else if (kind === 3) {    // diagonal cut
        a = vs(P, 0.7 + s(0.04), 0.47 + s(0.04)); clock = a[0];
        b = hs(a[1], 0.42 + s(0.1), 0.5 + s(0.1)); others.push(b[0], b[1]);
      } else {                    // clock band in the middle, strips above and below
        a = hs(P, 0.27 + s(0.04), 0.27 + s(0.04));
        b = vs(a[0], 0.5 + s(0.14), 0.5 + s(0.14)); others.push(b[0], b[1]);
        c = hs(a[1], 0.76 + s(0.04), 0.76 + s(0.04)); clock = c[0]; others.push(c[1]);
      }
      var fx = r() < 0.5, fy = kind !== 4 && kind !== 2 && r() < 0.35;
      var flip = function (poly) { return poly.map(function (q) { return [fx ? W - q[0] : q[0], fy ? H - q[1] : q[1]]; }); };
      clock = flip(clock); others = others.map(flip);
      var panels = [mkPanel(clock, 'clock', seed)];
      var used = {}, pool = shuffle(['city', 'flight', 'eyes', 'vigil'], r);
      others.map(function (q) { return { q: q, b: bbox(q) }; }).sort(function (A, B) { return B.b.w * B.b.h - A.b.w * A.b.h; }).forEach(function (o, i) {
        var asp = o.b.w / o.b.h, best = pool[0], bs = -99;
        pool.forEach(function (ty) { var sc = affinity(ty, asp) + r() * 0.7 - (used[ty] ? 3 : 0); if (sc > bs) { bs = sc; best = ty; } });
        used[best] = 1;
        panels.push(mkPanel(o.q, best, seed + 101 * (i + 1)));
      });
      return { panels: panels, clock: panels[0], cap: panels[1] };
    }

    function newLayout(instant) {
      var old = layout;
      layout = makeLayout(((R() * 1e9) | 0) + 1);
      layoutBorn = rt;
      var slow = soft();
      if (old && !instant) {
        prev = old;
        trans = { t0: rt, wipe: slow ? 1.4 : 0.5 };
      } else { prev = null; trans = null; }
      var base = rt + (trans ? trans.wipe * 0.55 : 0.05);
      layout.panels.forEach(function (p, i) {
        p.anim = instant ? null : { t0: base + i * (slow ? 0.45 : 0.16), dur: slow ? 1.2 : 0.42, rot: (R() - 0.5) * 0.22 };
      });
      jitterClock(); placeOverlays();
      if (!instant && !calm && word == null && old) newWord(MINUTE_WORDS);
    }

    function shufflePanel() {
      var cands = layout.panels.filter(function (p) { return p.type !== 'clock' && !p.anim; });
      if (!cands.length) return;
      var p = pick(cands, R), have = {};
      layout.panels.forEach(function (q) { have[q.type] = 1; });
      var types = ['city', 'flight', 'eyes', 'vigil'].filter(function (ty) { return ty !== p.type && !have[ty]; });
      if (!types.length) types = ['city', 'flight', 'eyes', 'vigil'].filter(function (ty) { return ty !== p.type; });
      p.type = pick(types, R); p.seed = (R() * 1e9) | 0; p.c = BUILD[p.type](p); p.leap = null; p.nextLeap = t + 1;
      p.anim = { t0: rt, dur: soft() ? 1.2 : 0.42, rot: (R() - 0.5) * 0.22 };
    }

    function jitterClock() {
      if (!layout) return;
      var p = layout.clock;
      clk.tx = p.cx + (R() - 0.5) * p.bb.w * 0.14;
      clk.ty = p.cy + (R() - 0.5) * p.bb.h * 0.12;
      if (clk.spr) {
        var hw = clk.spr.rx * 0.95, hh = clk.spr.ry * 0.95;
        clk.tx = clamp(clk.tx, hw + W * 0.01, W - hw - W * 0.01); clk.ty = clamp(clk.ty, hh + H * 0.02, H - hh - H * 0.02);
      }
      clk.rot = (R() - 0.5) * 0.09;
      if (clk.x < 0) { clk.x = clk.tx; clk.y = clk.ty; }
    }

    function newWord(list) {
      if (!layout) return;
      var cands = layout.panels.filter(function (p) { return p.type !== 'clock'; });
      var p = cands.length ? pick(cands, R) : layout.clock;
      var txt = pick(calm ? CALM_WORDS : list, R), px = W * (calm ? 0.045 : 0.068);
      var useBurst = !calm && R() < 0.5;
      var spr = useBurst
        ? renderBurstText(txt, px, { fill1: PAL.acc, fill2: PAL.acc2, depthCol: PAL.ink, burst: PAL.hi, burst2: '#ffffff', burstDot: 'rgba(200,60,0,0.25)', spikes: 13, jag: 0.3, seed: (R() * 999) | 0, ghost: PAL.cyan })
        : renderWord(txt, px, { fill1: calm ? PAL.hi : '#fff27a', fill2: calm ? PAL.clockFill2 : PAL.acc, depthCol: calm ? PAL.raysA : PAL.acc2, ghost: calm ? 'rgba(77,214,255,0.4)' : PAL.mag });
      var hw = spr.c.width / 2, hh = spr.c.height / 2, x = 0, y = 0, bs = 1e18;
      for (var k = 0; k < 8; k++) {
        var q = k === 0 ? p : (cands.length ? pick(cands, R) : layout.clock);
        var cx = clamp(q.cx + (R() - 0.5) * q.bb.w * 0.4, hw * 0.8, W - hw * 0.8), cy = clamp(q.cy + (R() - 0.5) * q.bb.h * 0.4, hh * 0.8, H - hh * 0.8);
        var sc = 0;
        if (clk.spr) {
          var dx = (cx - clk.tx) / (clk.spr.rx + hw * 0.7), dy = (cy - clk.ty) / (clk.spr.ry + hh * 0.7), d = dx * dx + dy * dy;
          sc = d < 1 ? (1 - d) * 100 : 0;
        }
        sc += R() * 0.5;
        if (sc < bs) { bs = sc; x = cx; y = cy; }
      }
      word = { spr: spr, x: x, y: y, rot: (R() - 0.5) * 0.4, t0: rt, life: calm ? 14 : 24, txt: txt };
      if (!soft()) shake = Math.max(shake, W * 0.006);
    }

    // ================= drawing =================
    function slamState(p) {
      if (!p.anim) return null;
      var q = (rt - p.anim.t0) / p.anim.dur;
      if (q < 0) return 'wait';
      if (q >= 1) { p.anim = null; if (!soft()) shake = Math.max(shake, W * 0.005); return null; }
      if (soft()) { var e = eOutC(q); return { s: 1 + (1 - e) * 0.06, rot: 0, a: e }; }
      var k = eOutC(q);
      return { s: 1 + (1 - k) * 0.5, rot: p.anim.rot * (1 - k), a: Math.min(1, q * 4) };
    }
    function drawPanel(p, st) {
      ctx.save();
      if (st) {
        ctx.translate(p.cx, p.cy); ctx.rotate(st.rot); ctx.scale(st.s, st.s); ctx.translate(-p.cx, -p.cy);
        ctx.globalAlpha = st.a;
      }
      ctx.translate(cam.x * W * 0.003, cam.y * H * 0.003);
      ctx.save();
      polyPath(ctx, p.poly); ctx.clip();
      ctx.translate(p.bb.x - M, p.bb.y - M);
      DRAW[p.type](p, p.c);
      ctx.restore();
      polyPath(ctx, p.poly); ctx.lineJoin = 'miter'; ctx.lineWidth = LW; ctx.strokeStyle = PAL.ink; ctx.stroke();
      ctx.restore();
    }

    function drawLayout(L, live) {
      var later = [];
      L.panels.forEach(function (p) {
        var st = live ? slamState(p) : null;
        if (st === 'wait') return;
        if (st) later.push([p, st]); else drawPanel(p, null);
      });
      later.forEach(function (it) { drawPanel(it[0], it[1]); });
    }

    function drawWipe() {
      var q = (rt - trans.t0) / trans.wipe;
      if (q >= 1) { prev = null; return; }
      var e = soft() ? q : eOutC(q), ex = lerp(-0.3 * W, 1.3 * W, e), sl = W * 0.12;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(-W * 0.1, -10); ctx.lineTo(ex + sl, -10); ctx.lineTo(ex - sl, H + 10); ctx.lineTo(-W * 0.1, H + 10); ctx.closePath();
      ctx.save(); ctx.clip(); ctx.drawImage(page, 0, 0); ctx.restore();
      ctx.beginPath(); ctx.moveTo(ex + sl, -10); ctx.lineTo(ex - sl, H + 10); ctx.lineWidth = LW * 2.2; ctx.strokeStyle = PAL.ink; ctx.stroke();
      if (!soft()) {
        ctx.fillStyle = PAL.ink; ctx.beginPath();
        for (var i = 0; i < 9; i++) {
          var yy = (i + 0.5) / 9 * H, xx = ex + sl * (1 - 2 * yy / H) - W * 0.01, ll = W * (0.08 + ((i * 7) % 5) * 0.03);
          ctx.moveTo(xx, yy - 3); ctx.lineTo(xx - ll, yy); ctx.lineTo(xx, yy + 3); ctx.closePath();
        }
        ctx.fill();
      }
      ctx.restore();
    }

    // horizontal extent of a convex polygon at height y
    function rowRange(poly, y) {
      var lo = 1e9, hi = -1e9;
      for (var i = 0; i < poly.length; i++) {
        var A = poly[i], B = poly[(i + 1) % poly.length];
        if ((A[1] - y) * (B[1] - y) > 0) continue;
        var x = Math.abs(B[1] - A[1]) < 1e-6 ? A[0] : A[0] + (B[0] - A[0]) * (y - A[1]) / (B[1] - A[1]);
        lo = Math.min(lo, x); hi = Math.max(hi, x);
        if (Math.abs(B[1] - A[1]) < 1e-6) { lo = Math.min(lo, B[0]); hi = Math.max(hi, B[0]); }
      }
      return [lo, hi];
    }
    function overlapArea(a, b) {
      if (!a || !b) return 0;
      var ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      return ox > 0 && oy > 0 ? ox * oy : 0;
    }
    // caption and issue box go into panel corners that stay clear of the clock (and of each other)
    function placeOverlays() {
      if (!layout || !capSpr || !issueSpr) return;
      var cl = layout.clock, ell = null, badge = null;
      if (clk.spr) {
        var jx = cl.bb.w * 0.07, jy = cl.bb.h * 0.06;
        ell = { x: cl.cx, y: cl.cy, ax: clk.spr.rx * 1.02 + jx, ay: clk.spr.ry * 1.08 + jy };
        badge = { x: cl.cx + clk.spr.rx * 0.84 - W * 0.04 - jx, y: cl.cy - clk.spr.ry * 0.66 - W * 0.04 - jy, w: W * 0.08 + jx * 2, h: W * 0.08 + jy * 2 };
      }
      // the part of each scene that should stay visible
      layout.panels.forEach(function (p) {
        var ox = p.bb.x - M, oy = p.bb.y - M, c = p.c;
        if (p.type === 'eyes') p.hot = { x: ox + c.fx - c.R * 0.8, y: oy + c.fy - c.R * 0.62, w: c.R * 1.6, h: c.R * 1.3 };
        else if (p.type === 'vigil') p.hot = { x: ox + c.heroX - p.h * 0.28, y: oy + c.ledge - p.h * 0.55, w: p.h * 0.56, h: p.h * 0.55 };
        else if (p.type === 'flight') p.hot = { x: ox + p.w * 0.2, y: oy + p.h * 0.22, w: p.w * 0.6, h: p.h * 0.56 };
        else p.hot = null;
      });
      function inEll(s) {
        if (!ell) return 0;
        var n = 0;
        for (var i = 0; i < 5; i++) for (var j = 0; j < 5; j++) {
          var x = s.x + s.w * i / 4, y = s.y + s.h * j / 4, dx = (x - ell.x) / ell.ax, dy = (y - ell.y) / ell.ay;
          if (dx * dx + dy * dy < 1) n++;
        }
        return n / 25 * s.w * s.h;
      }
      function slots(p, w, h) {
        var ins = W * 0.016, out = [];
        [p.bb.y + ins, p.bb.y + p.bb.h - ins - h].forEach(function (y, row) {
          var a = rowRange(p.poly, y), b = rowRange(p.poly, y + h), L = Math.max(a[0], b[0]) + ins, Rr = Math.min(a[1], b[1]) - ins;
          if (Rr - L >= w) { out.push({ p: p, x: L, y: y, w: w, h: h, row: row }); out.push({ p: p, x: Rr - w, y: y, w: w, h: h, row: row }); }
        });
        return out;
      }
      function best(spr, prefer, taken) {
        var bestS = null, bs = 1e18;
        layout.panels.forEach(function (p) {
          slots(p, spr.width, spr.height).forEach(function (s) {
            var sc = inEll(s) * 6 + overlapArea(s, badge) * 6 + overlapArea(s, taken) * 6;
            layout.panels.forEach(function (q) { sc += overlapArea(s, q.hot) * 3; });
            sc += (p === prefer ? 0 : W * H * 0.003) + s.row * W * H * 0.0015;
            if (sc < bs) { bs = sc; bestS = s; }
          });
        });
        return bestS;
      }
      layout.issuePos = best(issueSpr, cl, null);
      layout.capPos = best(capSpr, layout.cap, layout.issuePos);
    }
    function drawOverlays() {
      if (!layout) return;
      var ox = cam.x * W * 0.006, oy = cam.y * H * 0.006;
      var visible = function (s) { return s && (!s.p.anim || rt >= s.p.anim.t0 + s.p.anim.dur * 0.6); };
      var cp = layout.capPos, ip = layout.issuePos;
      if (capSpr && visible(cp)) { ctx.save(); ctx.translate(cp.x + ox, cp.y + oy); ctx.rotate(-0.012); ctx.drawImage(capSpr, 0, 0); ctx.restore(); }
      if (issueSpr && visible(ip)) { ctx.save(); ctx.translate(ip.x + ox, ip.y + oy); ctx.rotate(ip.x < W / 2 ? -0.035 : 0.035); ctx.drawImage(issueSpr, 0, 0); ctx.restore(); }
    }

    function drawClock() {
      var s = clk.spr; if (!s) return;
      var k = soft() ? 0.035 : 0.06;
      clk.x += (clk.tx - clk.x) * k; clk.y += (clk.ty - clk.y) * k;
      var u = rt - clk.pop, sc = soft() ? lerp(1.04, 1, eOutC(u / 1)) : (u < 0.5 ? lerp(1.3, 1, eOutBack(u / 0.5)) : 1);
      if (!soft()) sc *= 1 + Math.exp(-((rt - clk.secPop)) * 7) * 0.008;
      var x = clk.x + cam.x * W * 0.012, y = clk.y + cam.y * H * 0.014;
      ctx.save(); ctx.translate(x, y); ctx.rotate(clk.rot + Math.sin(t * 0.5) * 0.01); ctx.scale(sc, sc);
      ctx.drawImage(s.c, -s.cx, -s.cy);
      // AM/PM tag
      var tw = W * 0.052, th = W * 0.03;
      ctx.save(); ctx.translate(s.rx * 0.62, s.ry * 0.78); ctx.rotate(-0.07);
      ctx.fillStyle = PAL.ink; ctx.fillRect(-tw / 2 + th * 0.15, -th / 2 + th * 0.15, tw, th);
      ctx.fillStyle = PAL.capBg; ctx.fillRect(-tw / 2, -th / 2, tw, th);
      ctx.lineWidth = Math.max(2, W * 0.0018); ctx.strokeStyle = PAL.ink; ctx.strokeRect(-tw / 2, -th / 2, tw, th);
      ctx.font = W * 0.022 + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = PAL.ink;
      ctx.fillText(clk.ampm, 0, th * 0.06);
      ctx.restore();
      // seconds badge
      var bu = rt - clk.secPop, bs = soft() ? 1 : 1 + 0.2 * Math.max(0, 1 - bu / 0.25), br = W * 0.027;
      ctx.save(); ctx.translate(s.rx * 0.84, -s.ry * 0.66); ctx.scale(bs, bs);
      ctx.beginPath(); ctx.arc(br * 0.12, br * 0.14, br, 0, TAU); ctx.fillStyle = PAL.ink; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, br, 0, TAU); ctx.fillStyle = PAL.hi; ctx.fill();
      ctx.lineWidth = Math.max(2, W * 0.0022); ctx.strokeStyle = PAL.ink; ctx.stroke();
      ctx.font = br * 1.15 + 'px ' + FONT; ctx.fillStyle = PAL.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(api.pad(Math.max(0, clk.sec)), 0, br * 0.08);
      ctx.restore();
      ctx.restore();
    }

    function drawWord() {
      if (!word) return;
      var u = rt - word.t0;
      if (u > word.life) { word = null; return; }
      var sIn = soft() ? eOutC(u / 1.4) : eOutElastic(Math.min(1, u / 0.8));
      var sOut = u > word.life - 0.5 ? 1 - (u - (word.life - 0.5)) / 0.5 : 1;
      var s = Math.max(0.01, sIn * sOut * (1 + (soft() ? 0 : Math.sin(u * 5) * 0.015)));
      var x = word.x + cam.x * W * 0.016, y = word.y + cam.y * H * 0.016;
      ctx.save(); ctx.translate(x, y);
      if (!soft() && u < 0.5) {
        var e = eOutC(u / 0.5), r1 = W * 0.06 + e * W * 0.12, r2 = r1 + W * 0.08 * (1 - e);
        ctx.fillStyle = PAL.ink; ctx.globalAlpha = 1 - e; ctx.beginPath();
        for (var i = 0; i < 16; i++) { var a = i / 16 * TAU + 0.2; ctx.moveTo(Math.cos(a - 0.03) * r1, Math.sin(a - 0.03) * r1); ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); ctx.lineTo(Math.cos(a + 0.03) * r1, Math.sin(a + 0.03) * r1); ctx.closePath(); }
        ctx.fill(); ctx.globalAlpha = 1;
      }
      ctx.rotate(word.rot + (soft() ? 0 : Math.sin(u * 2) * 0.025)); ctx.scale(s, s);
      if (calm) ctx.globalAlpha = 0.85 * Math.min(1, u);
      ctx.drawImage(word.spr.c, -word.spr.cx, -word.spr.cy);
      ctx.restore();
    }

    // ---------- OK button: impact ----------
    function addImpact(x, y) {
      var r = api.rng(((rt * 1000) | 0) + 77);
      var e = { x: x, y: y, t0: rt, pts: burstPts(1, 1, 14, r, 0.38), rot: (r() - 0.5) * 0.5, dur: soft() ? 2.6 : 1.8 };
      var txt = pick(calm ? CALM_WORDS : HIT_WORDS, r);
      e.word = renderWord(txt, W * (calm ? 0.05 : 0.085), { fill1: '#fff27a', fill2: calm ? PAL.clockFill2 : PAL.acc, depthCol: calm ? PAL.raysA : PAL.acc2, ghost: PAL.mag });
      effects.push(e); if (effects.length > 4) effects.shift();
      if (!soft()) { shake = Math.max(shake, W * 0.016); flash = 0.45; }
      if (layout) layout.panels.forEach(function (p) { if (p.type === 'city' && !p.leap) p.nextLeap = t; });
    }
    function drawImpact(e) {
      var p = (rt - e.t0) / e.dur;
      if (p >= 1) return false;
      var x = e.x, y = e.y, i, a;
      ctx.save();
      // halftone shockwave ring
      var Rr = eOutC(p) * W * 0.42, band = W * 0.07, st = W * 0.016, mid = Rr - band / 2;
      ctx.globalAlpha = (1 - p) * (calm ? 0.5 : 0.9); ctx.fillStyle = PAL.hi; ctx.beginPath();
      for (var rr = Math.max(st, Rr - band); rr <= Rr; rr += st * 0.87) {
        var prof = 1 - Math.abs(rr - mid) / (band / 2), dr = st * 0.46 * clamp(prof, 0, 1);
        if (dr < 0.6) continue;
        var n = Math.max(8, Math.floor(TAU * rr / st)), off = (Math.round(rr / st) & 1) * 0.5;
        for (i = 0; i < n; i++) { a = (i + off) / n * TAU; var dx = x + Math.cos(a) * rr, dy = y + Math.sin(a) * rr; ctx.moveTo(dx + dr, dy); ctx.arc(dx, dy, dr, 0, TAU); }
      }
      ctx.fill();
      ctx.globalAlpha = 1;
      // impact lines
      if (!calm && p < 0.55) {
        var r1 = W * 0.07 + eOutC(p / 0.55) * W * 0.14, r2 = r1 + W * 0.09 * (1 - p / 0.55);
        ctx.fillStyle = PAL.ink; ctx.beginPath();
        for (i = 0; i < 22; i++) { a = i / 22 * TAU + e.rot; ctx.moveTo(x + Math.cos(a - 0.025) * r1, y + Math.sin(a - 0.025) * r1); ctx.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2); ctx.lineTo(x + Math.cos(a + 0.025) * r1, y + Math.sin(a + 0.025) * r1); ctx.closePath(); }
        ctx.fill();
      }
      // explosion balloon + lettering
      var bIn = soft() ? eOutC(p * 3) : eOutBack(Math.min(1, p * 5)), fade = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
      var bs = W * 0.13 * bIn * (1 + p * 0.15);
      ctx.globalAlpha = fade;
      ctx.translate(x, y); ctx.rotate(e.rot * 0.3);
      ctx.save(); ctx.scale(bs, bs * 0.78);
      polyPath(ctx, e.pts); ctx.fillStyle = calm ? PAL.burst2 : PAL.hi; ctx.fill();
      ctx.lineWidth = LW / bs * 1.2; ctx.strokeStyle = PAL.ink; ctx.lineJoin = 'miter'; ctx.stroke();
      polyPath(ctx, scalePts(e.pts, 0.66)); ctx.fillStyle = calm ? PAL.burst : '#ffffff'; ctx.fill();
      ctx.restore();
      var ws = soft() ? eOutC(p * 3) : eOutElastic(Math.min(1, p * 2.2));
      ctx.rotate(e.rot); ctx.scale(ws, ws);
      ctx.drawImage(e.word.c, -e.word.cx, -e.word.cy);
      ctx.restore();
      return true;
    }

    // ---------- the hour: a full cover splash ----------
    function startCover(d) {
      var h = d.getHours(), r = api.rng(h * 977 + 13);
      var c = { t0: rt, dur: calm ? 11 : 15, hour: h, hit: false };
      c.mast = renderWord('COMIC STRIKE', W * 0.095, { fill1: '#fff27a', fill2: PAL.isSun && moodName === 'day' ? PAL.acc : '#ffb21a', depthCol: PAL.acc2, depth: W * 0.012, ghost: PAL.cyan });
      c.title = renderBurstText(HOUR_NAMES[h % 12] + " O'CLOCK!", W * (h % 12 === 7 || h % 12 === 11 ? 0.105 : 0.115), {
        fill1: PAL.clockFill, fill2: PAL.clockFill2, depthCol: PAL.clockDepth, burst: calm ? PAL.burst : PAL.acc, burst2: calm ? PAL.burst2 : PAL.hi,
        burstDot: 'rgba(0,0,0,0.25)', spikes: 20, jag: 0.18, ry: 0.85, seed: h + 5
      });
      c.boom = calm ? null : renderBurstText(pick(HOUR_WORDS, r), W * 0.06, { fill1: PAL.acc, fill2: PAL.acc2, depthCol: PAL.ink, burst: '#fff6d8', burst2: PAL.hi, spikes: 12, jag: 0.32, seed: h + 9 });
      var dd = api.DAYS[d.getDay()] + ', ' + api.MONTHS[d.getMonth()] + ' ' + d.getDate();
      c.cap = renderCaption([(calm ? 'THE NIGHT ISSUE · ' : '') + 'ISSUE #' + dayOfYear(d) + ' · ' + dd.toUpperCase(), calm ? 'THE CITY SLEEPS. ONE HERO WATCHES.' : 'THE HOUR STRIKES!'], W * 0.019, PAL.capBg, PAL.capFg);
      c.dots = radialDots(W, H, W * 0.68, H * 0.45, 'rgba(0,0,0,0.16)', W * 0.012);
      c.city = mk(W + 2 * M, H * 0.32);
      skyline(c.city.getContext('2d'), W + 2 * M, H * 0.32, r, { minH: 0.3, maxH: 0.85, minW: 0.12, maxW: 0.3, col: PAL.near, win: PAL.win, winP: 0.3, ws: W * 0.0035, rim: PAL.rim, towers: true });
      cover = c;
      if (!soft()) { shake = W * 0.016; flash = 0.6; }
    }
    function drawCover() {
      var c = cover, u = rt - c.t0, D = c.dur;
      if (u >= D) { cover = null; newLayout(false); return; }
      var inP = soft() ? eOutC(u / 1.4) : eOutC(u / 0.45), outP = u > D - 0.7 ? eInC((u - (D - 0.7)) / 0.7) : 0;
      ctx.save();
      if (soft()) ctx.globalAlpha = Math.min(inP, 1 - outP);
      else {
        var e1 = lerp(-0.4 * W, 1.4 * W, inP), e0 = lerp(-0.4 * W, 1.4 * W, outP), sl = W * 0.14;
        ctx.beginPath(); ctx.moveTo(e0 + sl, -20); ctx.lineTo(e1 + sl, -20); ctx.lineTo(e1 - sl, H + 20); ctx.lineTo(e0 - sl, H + 20); ctx.closePath(); ctx.clip();
      }
      var hx = W * 0.68, hy = H * 0.45;
      ctx.fillStyle = PAL.coverB; ctx.fillRect(-20, -20, W + 40, H + 40);
      var n = 22, rot = rt * (soft() ? 0.01 : 0.06), RR = W * 1.3;
      ctx.fillStyle = PAL.coverA; ctx.beginPath();
      for (var i = 0; i < n; i++) { var a0 = rot + i / n * TAU, a1 = a0 + TAU / n * 0.5; ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a0) * RR, hy + Math.sin(a0) * RR); ctx.lineTo(hx + Math.cos(a1) * RR, hy + Math.sin(a1) * RR); ctx.closePath(); }
      ctx.fill();
      ctx.drawImage(c.dots, 0, 0);
      ctx.drawImage(c.city, -M - cam.x * M, H - c.city.height + 2);
      // hero swoops in and hovers
      var k = eOutC((u - 0.35) / (soft() ? 2.5 : 1.3));
      if (u > 0.35) {
        var q = 1 - k, bx = (1 - q) * (1 - q) * hx + 2 * q * (1 - q) * (W * 0.2) + q * q * (-W * 0.25), by = (1 - q) * (1 - q) * hy + 2 * q * (1 - q) * (H * 0.95) + q * q * (H * 1.25);
        if (k >= 1) { bx += cam.x * W * 0.01; by += Math.sin(rt * 1.5) * H * 0.018 + cam.y * H * 0.01; }
        var sc = H * 0.5 / 100 * lerp(1, 1.7, q);
        if (k < 1 && !soft()) {
          ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.beginPath();
          for (var j = 0; j < 12; j++) {
            var ang = Math.atan2(by - H * 1.1, bx + W * 0.2) + Math.PI + (j - 6) * 0.03, d0 = sc * 40, d1 = sc * (110 + (j % 3) * 40);
            ctx.moveTo(bx + Math.cos(ang - 0.01) * d0, by + Math.sin(ang - 0.01) * d0); ctx.lineTo(bx + Math.cos(ang) * d1, by + Math.sin(ang) * d1); ctx.lineTo(bx + Math.cos(ang + 0.01) * d0, by + Math.sin(ang + 0.01) * d0); ctx.closePath();
          }
          ctx.fill();
        }
        var P = Object.assign({}, POSES.fly); P.kn2 += Math.sin(rt * 3) * 10; P.sh1 -= 4; P.el1 -= 6;
        drawHero(ctx, bx, by, sc, P, 1, rt, { wind: [-1, 0.08], len: 74, speed: soft() ? 4 : 11, amp: 6, sag: 0.02, rot: lerp(-0.32, -0.75, q) + Math.sin(rt * 0.8) * 0.03 });
        if (k >= 1 && !c.hit) { c.hit = true; if (!soft()) shake = W * 0.012; }
      }
      // masthead + caption
      var mIn = soft() ? eOutC((u - 0.2) / 1.2) : eOutBack((u - 0.15) / 0.45);
      if (mIn > 0) {
        ctx.save(); ctx.translate(W * 0.035 + c.mast.c.width / 2, H * 0.03 + c.mast.c.height / 2); ctx.rotate(-0.035); ctx.scale(mIn, mIn);
        ctx.drawImage(c.mast.c, -c.mast.c.width / 2, -c.mast.c.height / 2); ctx.restore();
        ctx.save(); ctx.globalAlpha *= clamp(mIn, 0, 1); ctx.translate(W * 0.05, H * 0.03 + c.mast.c.height * 0.92); ctx.rotate(-0.02); ctx.drawImage(c.cap, 0, 0); ctx.restore();
      }
      var tIn = soft() ? eOutC((u - 0.8) / 1.5) : eOutElastic((u - 0.8) / 0.9);
      if (u > 0.8) {
        ctx.save(); ctx.translate(Math.max(W * 0.33, c.title.rx * 1.02 + W * 0.03) + cam.x * W * 0.01, H * 0.68 + cam.y * H * 0.01); ctx.rotate(-0.07); ctx.scale(Math.max(0.01, tIn), Math.max(0.01, tIn));
        ctx.drawImage(c.title.c, -c.title.cx, -c.title.cy); ctx.restore();
      }
      if (c.boom && u > 1.65) {
        var bIn = eOutElastic((u - 1.65) / 0.7);
        ctx.save(); ctx.translate(W * 0.86, H * 0.8); ctx.rotate(0.12 + Math.sin(rt * 2) * 0.02); ctx.scale(bIn, bIn); ctx.drawImage(c.boom.c, -c.boom.cx, -c.boom.cy); ctx.restore();
      }
      ctx.lineWidth = LW * 1.6; ctx.strokeStyle = PAL.ink; ctx.strokeRect(W * 0.012, H * 0.02, W * 0.976, H * 0.96);
      ctx.restore();
      if (!soft() && inP < 1) {
        var ee = lerp(-0.4 * W, 1.4 * W, inP), s2 = W * 0.14;
        ctx.beginPath(); ctx.moveTo(ee + s2, -20); ctx.lineTo(ee - s2, H + 20); ctx.lineWidth = LW * 2.5; ctx.strokeStyle = PAL.ink; ctx.stroke();
      }
    }

    function render() {
      ctx.save();
      if (shake > 0.4) { ctx.translate((R() - 0.5) * shake * 2, (R() - 0.5) * shake * 2); shake *= 0.85; } else shake = 0;
      var cu = cover ? rt - cover.t0 : 0;
      var full = cover && cu > (soft() ? 1.6 : 0.6) && cu < cover.dur - 0.8;
      if (!full) {
        ctx.drawImage(page, 0, 0);
        if (prev && trans) { drawLayout(prev, false); drawWipe(); }
        if (layout) drawLayout(layout, true);
        if (trans && !prev && layout.panels.every(function (p) { return !p.anim; })) trans = null;
        drawOverlays();
        drawClock();
        drawWord();
      }
      if (cover) drawCover();
      effects = effects.filter(drawImpact);
      if (flash > 0.02 && !soft()) { ctx.globalAlpha = flash; ctx.fillStyle = PAL.flash; ctx.fillRect(-40, -40, W + 80, H + 80); ctx.globalAlpha = 1; flash *= 0.75; } else flash = 0;
      ctx.restore();
    }

    // ================= clock / loop =================
    function checkClock() {
      var d = api.now(), key = d.getHours() + ':' + d.getMinutes();
      if (key !== clk.key) {
        var first = !clk.key;
        clk.key = key;
        if (applyMood() && !first) { capKey = ''; newLayout(false); }
        clk.spr = makeClockSprite(d); clk.pop = rt;
        updateCaption(d);
        if (first) jitterClock();
      }
      var s = d.getSeconds();
      if (s !== clk.sec) { clk.sec = s; clk.secPop = rt; }
    }

    // rAF drives the loop; a slow timer watchdog keeps it alive where rAF is throttled (some TV builds, headless previews)
    function schedule() {
      cancelAnimationFrame(raf); clearTimeout(wd);
      raf = requestAnimationFrame(frame);
      wd = setTimeout(function () { frame(performance.now()); }, 90);
    }
    function frame(now) {
      if (dead || hidden) return;
      schedule();
      if (last && now - last < 31) return;
      var dt = last ? Math.min(0.1, (now - last) / 1000) : 0.033; last = now;
      rt += dt; t += dt * (soft() ? 0.45 : 1);
      checkClock();
      var ck = soft() ? 0.03 : 0.06;
      cam.x += (camT.x - cam.x) * ck; cam.y += (camT.y - cam.y) * ck;
      if (!cover && !trans && rt - layoutBorn > (calm ? 360 : 180)) newLayout(false);
      render();
    }

    function rebuildText() {
      if (dead) return;
      var d = api.now();
      clk.spr = makeClockSprite(d); capKey = ''; updateCaption(d);
      if (word) { var w = word; newWord([w.txt]); word.t0 = w.t0; word.x = w.x; word.y = w.y; }
    }

    function onVis() {
      hidden = document.hidden;
      cancelAnimationFrame(raf); clearTimeout(wd);
      if (!hidden && !dead) { last = 0; schedule(); }
    }
    function onResize() {
      clearTimeout(resizeT);
      resizeT = setTimeout(function () {
        if (dead) return;
        size(); page = buildPage(); capKey = ''; clk.x = -1; rebuildText(); newLayout(true);
      }, 300);
    }

    // ---- start ----
    size();
    applyMood();
    checkClock();
    newLayout(false);
    jitterClock();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', onResize);
    if (document.fonts && document.fonts.load) {
      document.fonts.load('64px "' + FAM + '"').then(function () { rebuildText(); }, function () {});
    }
    hidden = !!document.hidden;
    if (!hidden) schedule();

    return {
      destroy: function () {
        dead = true;
        cancelAnimationFrame(raf); clearTimeout(wd);
        clearTimeout(resizeT);
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('resize', onResize);
        effects = []; word = null; cover = null; prev = null;
      },
      onPointer: function (nx, ny) { camT.x = clamp(+nx || 0, -1, 1); camT.y = clamp(+ny || 0, -1, 1); },
      onAction: function (x, y) { if (!dead) addImpact((x == null ? innerWidth / 2 : x) * K, (y == null ? innerHeight / 2 : y) * K); },
      onMinute: function () {
        if (dead || !layout) return;
        checkClock();
        if (!cover && !trans && rt - layoutBorn < (calm ? 330 : 150)) shufflePanel();
        jitterClock();
        newWord(MINUTE_WORDS);
      },
      onHour: function (d) { if (!dead) startCover(d || api.now()); }
    };
  }

  window.Themes = window.Themes || {};
  window.Themes.comic = { title: 'Comic Strike', create: create };
})();
