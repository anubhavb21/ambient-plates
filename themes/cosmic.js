/* Cosmic Saga — an original space-opera ambient clock.
 * Parallax starfield, painted nebula, a ringed gas giant with turning cloud bands, a moon,
 * a drifting asteroid belt, an orbital station with a docking shuttle and, now and then,
 * a fleet of original ships. OK = warp jump to a new procedurally generated system.
 * After 23:00 (api.calm()) it turns serene: dim, slow, no flashes, no fleets.
 *
 * Font: Exo 2 by Natanael Gama — SIL Open Font License 1.1 (Google Fonts, latin subset),
 * shipped as fonts/Cosmic-Exo2.woff2.
 */
(function () {
  'use strict';
  window.Themes = window.Themes || {};

  var TAU = Math.PI * 2;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  var mkCanvas = function (w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  var mix3 = function (a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; };
  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    var f = function (t) { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  var rgba = function (c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')'; };

  // Value noise with optional horizontal period (for seamless planet bands).
  function Noise(rnd) {
    var perm = new Uint8Array(512), vals = new Float32Array(256), i;
    for (i = 0; i < 256; i++) { perm[i] = i; vals[i] = rnd(); }
    for (i = 255; i > 0; i--) { var j = (rnd() * (i + 1)) | 0, t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (i = 0; i < 256; i++) perm[i + 256] = perm[i];
    var h = function (x, y) { return vals[perm[perm[x & 255] + (y & 255)]]; };
    function n2(x, y, P) {
      var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ix1 = ix + 1;
      if (P) { ix = ((ix % P) + P) % P; ix1 = ((ix1 % P) + P) % P; }
      var u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      var a = h(ix, iy), b = h(ix1, iy), c = h(ix, iy + 1), d = h(ix1, iy + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function fbm(x, y, oct, P) {
      var s = 0, amp = 0.5, f = 1, n = 0;
      for (var o = 0; o < oct; o++) { s += amp * n2(x * f, y * f, P ? P * f : 0); n += amp; amp *= 0.5; f *= 2; }
      return s / n;
    }
    return { n2: n2, fbm: fbm };
  }

  var MOODS = {
    dawn:  { neb: [[255, 96, 140], [255, 168, 96], [120, 80, 210]],  glow: [255, 196, 176], accent: '#ffb9a0', sun: [255, 206, 170], word: 'DAWN WATCH' },
    day:   { neb: [[52, 190, 255], [74, 96, 255], [120, 255, 220]],  glow: [160, 226, 255], accent: '#8fe3ff', sun: [225, 242, 255], word: 'DAY WATCH' },
    dusk:  { neb: [[255, 112, 56], [146, 70, 255], [255, 72, 140]],  glow: [255, 204, 160], accent: '#ffc58e', sun: [255, 214, 176], word: 'DUSK WATCH' },
    night: { neb: [[92, 70, 255], [28, 186, 176], [206, 60, 206]],   glow: [176, 204, 255], accent: '#a6c4ff', sun: [206, 224, 255], word: 'NIGHT WATCH' },
  };
  var SYL = ['ka', 'ves', 'tor', 'ae', 'lyn', 'dra', 'mir', 'oth', 'sel', 'qua', 'ren', 'zha', 'vi', 'or', 'tes', 'an', 'cor', 'ith', 'nel', 'sa', 'ul', 'ky', 'bre', 'dae', 'mo', 'rhe', 'ix', 'thal'];
  var ROMAN = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'IX', 'XI'];
  var HUES = [32, 198, 268, 166, 12, 222, 46, 300];

  var CSS = [
    "@font-face{font-family:'Cosmic Exo';font-style:normal;font-weight:100 700;font-display:swap;src:url('fonts/Cosmic-Exo2.woff2') format('woff2');}",
    ".t-cosmic{--glow:176,204,255;--accent:#a6c4ff;font-family:'Cosmic Exo','Instrument Sans',sans-serif;color:#eef3ff;overflow:hidden;background:#000;}",
    ".t-cosmic .cz-cv{position:absolute;left:0;top:0;width:100%;height:100%;display:block;transition:opacity 4s ease;}",
    ".t-cosmic.calm .cz-cv{opacity:.6;}",
    ".t-cosmic .cz-vig{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;background:radial-gradient(ellipse 80% 75% at 50% 50%,rgba(0,0,0,0) 52%,rgba(0,0,0,.62) 100%);}",
    ".t-cosmic .cz-hud{position:absolute;top:50%;left:6.5vw;text-transform:uppercase;will-change:transform;transition:opacity 4s ease;}",
    ".t-cosmic .cz-hud.right{left:auto;right:6.5vw;text-align:right;}",
    ".t-cosmic .cz-top{font-size:1.22vw;letter-spacing:.48em;font-weight:400;color:rgba(226,236,255,.8);white-space:nowrap;margin-left:.35vw;text-shadow:0 0 .8vw rgba(var(--glow),.35);}",
    ".t-cosmic .cz-od{color:var(--accent);font-weight:600;margin-right:.9em;}",
    ".t-cosmic .cz-time{font-size:12.6vw;font-weight:200;line-height:1;letter-spacing:.02em;margin:.4vh 0 1.2vh -.55vw;white-space:nowrap;color:#f1f6ff;text-shadow:0 0 .5vw rgba(var(--glow),.6),0 0 2.6vw rgba(var(--glow),.32),0 0 7vw rgba(var(--glow),.16);}",
    ".t-cosmic .cz-d{display:inline-block;width:.6em;text-align:center;}",
    ".t-cosmic .cz-colon{display:inline-block;width:.28em;text-align:center;color:rgb(var(--glow));animation:czBreath 2.2s ease-in-out infinite;position:relative;top:-.06em;}",
    ".t-cosmic .cz-sec{display:inline-block;font-size:.17em;font-weight:300;vertical-align:top;margin:.55em 0 0 .5em;letter-spacing:.12em;color:var(--accent);width:1.6em;text-align:left;}",
    ".t-cosmic .right .cz-sec{text-align:left;}",
    ".t-cosmic .cz-rule{position:relative;height:2px;width:100%;background:linear-gradient(90deg,rgba(var(--glow),.55),rgba(var(--glow),.18) 60%,rgba(var(--glow),0));}",
    ".t-cosmic .right .cz-rule{background:linear-gradient(270deg,rgba(var(--glow),.55),rgba(var(--glow),.18) 60%,rgba(var(--glow),0));}",
    ".t-cosmic .cz-rule i{position:absolute;top:50%;left:0;width:.55vw;height:.55vw;margin:-.275vw 0 0 -.275vw;transform:rotate(45deg);background:#fff;box-shadow:0 0 .6vw .15vw rgba(var(--glow),.9);transition:left 1s linear;}",
    ".t-cosmic .cz-rule b{position:absolute;top:-.6vw;width:1px;height:1.2vw;background:rgba(var(--glow),.45);}",
    ".t-cosmic .cz-bot{margin-top:1.6vh;font-size:1.02vw;letter-spacing:.46em;color:rgba(206,220,255,.62);white-space:nowrap;}",
    ".t-cosmic .cz-watch{color:var(--accent);margin-right:1.4em;}",
    ".t-cosmic .cz-banner{position:absolute;top:-6.5vh;left:.35vw;right:0;font-size:.95vw;letter-spacing:.9em;color:rgba(var(--glow),1);opacity:0;white-space:nowrap;}",
    ".t-cosmic .cz-banner.show{animation:czBanner 7s ease forwards;}",
    ".t-cosmic .cz-d.in{animation:czIn 1s cubic-bezier(.2,.7,.2,1);}",
    ".t-cosmic .cz-d.soft{animation:czSoft 2.6s ease;}",
    ".t-cosmic.calm .cz-hud{opacity:.66;}",
    ".t-cosmic.calm .cz-time{text-shadow:0 0 .5vw rgba(var(--glow),.32),0 0 2.6vw rgba(var(--glow),.14);}",
    ".t-cosmic.calm .cz-colon{animation-duration:5s;}",
    "@keyframes czBreath{0%,100%{opacity:.3}50%{opacity:1}}",
    "@keyframes czIn{0%{opacity:0;transform:translateY(-.06em) scale(1.06);filter:blur(.35vw)}25%{opacity:.9}40%{opacity:.3}55%{opacity:1;filter:blur(0)}100%{opacity:1;transform:none}}",
    "@keyframes czSoft{0%{opacity:0}100%{opacity:1}}",
    "@keyframes czBanner{0%{opacity:0;letter-spacing:1.5em}14%{opacity:1;letter-spacing:.9em}78%{opacity:1}100%{opacity:0;letter-spacing:.8em}}",
    "@media (prefers-reduced-motion: reduce){.t-cosmic .cz-d.in,.t-cosmic .cz-colon{animation:none}}",
  ].join('\n');

  function create(root, api) {
    root.classList.add('t-cosmic');
    root.innerHTML =
      '<style>' + CSS + '</style>' +
      '<canvas class="cz-cv"></canvas><div class="cz-vig"></div>' +
      '<div class="cz-hud"><div class="cz-banner"></div>' +
      '<div class="cz-top"><span class="cz-od"></span><span class="cz-date"></span></div>' +
      '<div class="cz-time"><span class="cz-d">0</span><span class="cz-d">0</span><span class="cz-colon">:</span><span class="cz-d">0</span><span class="cz-d">0</span><span class="cz-sec">00</span></div>' +
      '<div class="cz-rule"><b style="left:25%"></b><b style="left:50%"></b><b style="left:75%"></b><i></i></div>' +
      '<div class="cz-bot"><span class="cz-watch"></span><span class="cz-sys"></span></div></div>';
    var q = function (s) { return root.querySelector(s); };
    var cv = q('.cz-cv'), ctx = cv.getContext('2d', { alpha: false });
    var hud = q('.cz-hud'), elOd = q('.cz-od'), elDate = q('.cz-date'), elSec = q('.cz-sec'), elWatch = q('.cz-watch'), elSys = q('.cz-sys'), elBanner = q('.cz-banner'), elTick = q('.cz-rule i');
    var digits = root.querySelectorAll('.cz-d');

    var groupAlpha = 1;
    var A = function (a) { ctx.globalAlpha = a * groupAlpha; };
    var dead = false, raf = 0, timers = [], W = 0, H = 0, T = 0, lastFrame = 0;
    var cam = { x: 0, y: 0, tx: 0, ty: 0 };
    var mood = api.mood(), calm = api.calm(), reduced = !!api.reduced;
    var sys = null, bg = null, prevBg = null, prevBgA = 0;
    var stars = [], rocks = [], warpP = null;
    var fleet = null, comets = [], warp = null, pendingFleet = false;
    var nextFleet = 70 + Math.random() * 90;
    var dockPhase = 0.18;           // shuttle cycle starts mid-approach so it's visible early
    var planetRot = Math.random() * 512, planetAcc = 0;
    var hudState = { side: 0 };
    var R0 = api.rng(((Date.now() / 1000) | 0) ^ 0x5eed);

    // ---------- sprites that never change ----------
    function radial(size, stops) {
      var c = mkCanvas(size, size), g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
      g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
    }
    var glowW = radial(64, [[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,255,255,.55)'], [0.5, 'rgba(255,255,255,.12)'], [1, 'rgba(255,255,255,0)']]);
    var glowE = radial(64, [[0, 'rgba(255,255,255,1)'], [0.15, 'rgba(200,235,255,.9)'], [0.4, 'rgba(110,180,255,.35)'], [1, 'rgba(60,120,255,0)']]);
    var ghostSpr = radial(128, [[0, 'rgba(255,255,255,.10)'], [0.75, 'rgba(255,255,255,.16)'], [0.88, 'rgba(255,255,255,.32)'], [1, 'rgba(255,255,255,0)']]);
    var streakSpr = (function () {
      var c = mkCanvas(1024, 32), g = c.getContext('2d');
      var gr = g.createLinearGradient(0, 0, 1024, 0);
      gr.addColorStop(0, 'rgba(120,170,255,0)'); gr.addColorStop(0.42, 'rgba(150,200,255,.35)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(0.58, 'rgba(150,200,255,.35)'); gr.addColorStop(1, 'rgba(120,170,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 1024, 32);
      g.globalCompositeOperation = 'destination-in';
      var v = g.createLinearGradient(0, 0, 0, 32); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.5, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = v; g.fillRect(0, 0, 1024, 32); return c;
    })();

    // ---------- original ship designs ----------
    // "Lance": long blade hull, raised dorsal spine, split twin bow, swept fins, triple engine block.
    // "Talon": compact arrowhead escort with forward-swept wings.
    var SHIPS = {
      lance: { engines: [[-0.5, -0.058, 1], [-0.5, -0.004, 1.15], [-0.5, 0.05, 1]], nav: [-0.33, -0.19] },
      talon: { engines: [[-0.47, -0.03, 1], [-0.47, 0.035, 1]], nav: [0.1, 0.2] },
    };
    function shipSprite(kind, len) {
      var c = mkCanvas(len * 1.12, len * 0.5), g = c.getContext('2d');
      g.translate(c.width / 2, c.height / 2); g.scale(len, len);
      var poly = function (pts) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); };
      var hullGrad = function (y0, y1) { var gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#e3e8f1'); gr.addColorStop(0.28, '#8d97a8'); gr.addColorStop(0.55, '#3c4452'); gr.addColorStop(1, '#0b0e14'); return gr; };
      g.lineJoin = 'round';
      var rr = api.rng(kind === 'lance' ? 4242 : 1717);
      // plating, greebles, trenches and shading — painted only over the hull (source-atop)
      function detail(lw, n) {
        g.save(); g.globalCompositeOperation = 'source-atop';
        for (var i = 0; i < n; i++) {
          var x = -0.48 + rr() * 0.9, y = -0.15 + rr() * 0.24, w = 0.02 + rr() * 0.07, h = 0.004 + rr() * 0.01;
          g.fillStyle = rr() < 0.5 ? 'rgba(255,255,255,' + (0.025 + rr() * 0.05) + ')' : 'rgba(0,0,0,' + (0.06 + rr() * 0.12) + ')';
          g.fillRect(x, y, w, h);
        }
        g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = lw; g.beginPath();
        g.moveTo(0.42, 0.004); g.lineTo(-0.46, 0.012); g.moveTo(0.2, -0.04); g.lineTo(-0.46, -0.048);
        for (i = 0; i < 9; i++) { var px = -0.44 + rr() * 0.8, py = -0.1 + rr() * 0.08; g.moveTo(px, py); g.lineTo(px, py + 0.02 + rr() * 0.06); }
        g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(0.42, 0.004 + lw * 1.5); g.lineTo(-0.46, 0.012 + lw * 1.5); g.moveTo(0.2, -0.04 + lw * 1.5); g.lineTo(-0.46, -0.048 + lw * 1.5); g.stroke();
        var bel = g.createLinearGradient(0, 0, 0, 0.1); bel.addColorStop(0, 'rgba(0,0,0,0)'); bel.addColorStop(1, 'rgba(0,0,0,.55)');
        g.fillStyle = bel; g.fillRect(-0.6, 0, 1.2, 0.3);
        var sp = g.createLinearGradient(0, -0.16, 0, -0.02); sp.addColorStop(0, 'rgba(255,255,255,.0)'); sp.addColorStop(0.5, 'rgba(255,255,255,.14)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = sp; g.fillRect(-0.6, -0.2, 1.2, 0.2);
        g.restore();
      }
      if (kind === 'lance') {
        // dorsal fin + ventral fin (behind hull)
        poly([-0.12, -0.1, -0.31, -0.2, -0.36, -0.195, -0.28, -0.095]); g.fillStyle = hullGrad(-0.2, -0.08); g.fill();
        poly([-0.06, 0.06, -0.31, 0.2, -0.39, 0.2, -0.27, 0.065]); g.fillStyle = hullGrad(0.05, 0.21); g.fill();
        // main blade
        var hull = [0.5, -0.006, 0.31, -0.036, 0.13, -0.052, 0.03, -0.088, -0.17, -0.112, -0.34, -0.103, -0.43, -0.08, -0.47, -0.035, -0.47, 0.06, -0.41, 0.082, -0.1, 0.072, 0.2, 0.04, 0.38, 0.016];
        poly(hull); g.fillStyle = hullGrad(-0.112, 0.085); g.fill();
        // split lower bow prong
        poly([0.44, 0.03, 0.2, 0.062, 0.16, 0.046]); g.fillStyle = hullGrad(0.02, 0.07); g.fill();
        // bridge block on the spine
        poly([-0.16, -0.112, -0.135, -0.14, -0.06, -0.14, -0.04, -0.1]); g.fillStyle = hullGrad(-0.14, -0.09); g.fill();
        // engine block
        g.fillStyle = '#1a1f28'; g.fillRect(-0.505, -0.08, 0.05, 0.155);
        detail(0.0035, 260);
        // rim light on the upper edge
        g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 0.005;
        g.beginPath(); g.moveTo(0.5, -0.006); g.lineTo(0.31, -0.036); g.lineTo(0.13, -0.052); g.lineTo(0.03, -0.088); g.lineTo(-0.17, -0.112); g.lineTo(-0.34, -0.103); g.stroke();
        // hull stripe (no insignia)
        g.fillStyle = 'rgba(214,92,60,.85)'; poly([0.36, -0.018, 0.14, -0.03, 0.14, -0.02, 0.36, -0.01]); g.fill();
        // windows
        g.fillStyle = '#ffe6b8';
        for (var x = 0.08; x > -0.38; x -= 0.014) if (Math.sin(x * 97) > -0.4) g.fillRect(x, -0.03, 0.006, 0.006);
        for (x = -0.15; x > -0.38; x -= 0.02) if (Math.sin(x * 51) > 0) g.fillRect(x, -0.065, 0.005, 0.005);
        g.fillStyle = '#bfe6ff'; g.fillRect(-0.13, -0.132, 0.06, 0.007);
      } else {
        poly([-0.04, 0.045, 0.16, 0.22, 0.09, 0.235, -0.26, 0.08]); g.fillStyle = hullGrad(0.04, 0.24); g.fill();
        poly([0.5, 0.0, 0.12, -0.07, -0.22, -0.1, -0.46, -0.065, -0.46, 0.07, -0.22, 0.09, 0.12, 0.055]); g.fillStyle = hullGrad(-0.1, 0.09); g.fill();
        poly([-0.02, -0.075, -0.2, -0.17, -0.26, -0.165, -0.17, -0.085]); g.fillStyle = hullGrad(-0.17, -0.07); g.fill();
        detail(0.006, 90);
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 0.008;
        g.beginPath(); g.moveTo(0.5, 0); g.lineTo(0.12, -0.07); g.lineTo(-0.22, -0.1); g.stroke();
        g.fillStyle = 'rgba(214,92,60,.85)'; g.fillRect(0.05, -0.05, 0.12, 0.012);
        g.fillStyle = '#bfe6ff'; g.fillRect(0.16, -0.035, 0.07, 0.012);
        g.fillStyle = '#1a1f28'; g.fillRect(-0.49, -0.06, 0.04, 0.12);
      }
      return c;
    }
    var SPR = { lance: shipSprite('lance', 520), talon: shipSprite('talon', 220), shuttle: shipSprite('talon', 96) };

    function drawShip(kind, spr, x, y, len, dir, alpha, stretch, ang) {
      var def = SHIPS[kind], k = len / (spr.width / 1.12);
      ctx.save();
      ctx.translate(x, y); if (ang) ctx.rotate(ang);
      ctx.scale(dir * (stretch || 1), 1);
      A(alpha);
      // exhaust plumes + engine glows
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < def.engines.length; i++) {
        var e = def.engines[i], ex = e[0] * len, ey = e[1] * len, fl = 0.85 + 0.15 * Math.sin(T * 31 + i * 2.1) * Math.sin(T * 17 + i);
        var pl = len * 0.5 * e[2] * fl, ph = len * 0.017 * e[2], gr = ctx.createLinearGradient(ex, 0, ex - pl, 0);
        gr.addColorStop(0, 'rgba(200,235,255,.75)'); gr.addColorStop(0.25, 'rgba(110,170,255,.35)'); gr.addColorStop(1, 'rgba(60,110,255,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(ex, ey - ph); ctx.quadraticCurveTo(ex - pl * 0.3, ey - ph * 0.9, ex - pl, ey); ctx.quadraticCurveTo(ex - pl * 0.3, ey + ph * 0.9, ex, ey + ph); ctx.fill();
        var gs = len * 0.13 * e[2] * fl;
        ctx.drawImage(glowE, ex - gs / 2, ey - gs / 2, gs, gs);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(spr, -spr.width / 2 * k, -spr.height / 2 * k, spr.width * k, spr.height * k);
      // blinking nav light
      if (Math.sin(T * 4.4 + x * 0.01) > 0.86) {
        ctx.globalCompositeOperation = 'lighter';
        var ns = len * 0.06;
        ctx.drawImage(glowW, def.nav[0] * len - ns / 2, def.nav[1] * len - ns / 2, ns, ns);
      }
      ctx.restore();
    }

    // ---------- backdrop (nebula + far stars + galaxy + sun haze) ----------
    var OVER = 0.045;
    function buildBackdrop() {
      var pal = MOODS[mood], r = api.rng(sys.seed * 7 + 13), NZ = Noise(api.rng(sys.seed + 101));
      var BW = Math.round(W * (1 + 2 * OVER)), BH = Math.round(H * (1 + 2 * OVER));
      var nw = 360, nh = Math.round(nw * BH / BW);
      var c1 = mix3(pal.neb[0], pal.neb[2], r() * 0.4), c2 = mix3(pal.neb[1], pal.neb[2], r() * 0.3), c3 = mix3(pal.neb[2], [255, 255, 255], 0.25);
      if (r() < 0.5) { var t = c1; c1 = c2; c2 = t; }
      var slope = (r() - 0.5) * 0.9, b0 = 0.3 + r() * 0.35, bw = 0.22 + r() * 0.1, sc = 4 + r() * 2;
      var small = mkCanvas(nw, nh), sg = small.getContext('2d'), img = sg.createImageData(nw, nh), d = img.data;
      for (var y = 0; y < nh; y++) {
        var v = y / nh;
        for (var x = 0; x < nw; x++) {
          var u = x / nw, X = u * sc, Y = v * sc * nh / nw;
          var qn = NZ.fbm(X, Y, 4);
          var w2 = NZ.fbm(X + 3.2 * qn + 1.7, Y + 3.2 * qn + 9.2, 5);
          var bd = (v - (b0 + slope * (u - 0.5))) / bw, band = Math.exp(-bd * bd);
          var dens = smooth(0.4, 0.86, w2) * (0.18 + 0.82 * band);
          var m = smooth(0.3, 0.7, NZ.fbm(X * 0.6 + 20, Y * 0.6 + 5, 3));
          var dust = smooth(0.5, 0.7, NZ.fbm(X * 1.8 + 40, Y * 1.8 + 11, 4)) * band;
          var hot = dens * dens * dens, k = (1 - 0.8 * dust);
          var i = (y * nw + x) * 4;
          d[i] = (3 + 10 * band + ((c1[0] * (1 - m) + c2[0] * m) * dens * 0.78 + c3[0] * hot * 0.55 + 255 * hot * hot * 0.25)) * k;
          d[i + 1] = (5 + 12 * band + ((c1[1] * (1 - m) + c2[1] * m) * dens * 0.78 + c3[1] * hot * 0.55 + 255 * hot * hot * 0.25)) * k;
          d[i + 2] = (12 + 22 * band + ((c1[2] * (1 - m) + c2[2] * m) * dens * 0.78 + c3[2] * hot * 0.55 + 255 * hot * hot * 0.25)) * k;
          d[i + 3] = 255;
        }
      }
      sg.putImageData(img, 0, 0);
      var c = mkCanvas(BW, BH), g = c.getContext('2d');
      g.fillStyle = '#010208'; g.fillRect(0, 0, BW, BH);
      g.imageSmoothingEnabled = true; try { g.imageSmoothingQuality = 'high'; } catch (e) {}
      g.drawImage(small, 0, 0, BW, BH);
      // sun haze in the lit corner
      var sx = sys.side > 0 ? BW * 1.02 : -BW * 0.02, sy = BH * 0.02;
      var hz = g.createRadialGradient(sx, sy, 0, sx, sy, BW * 0.6);
      hz.addColorStop(0, rgba(pal.sun, 0.35)); hz.addColorStop(0.35, rgba(pal.sun, 0.08)); hz.addColorStop(1, rgba(pal.sun, 0));
      g.globalCompositeOperation = 'lighter'; g.fillStyle = hz; g.fillRect(0, 0, BW, BH);
      // far stars, denser in the band
      var cols = ['#ffffff', '#cfe0ff', '#ffe9cf', '#dfe8ff'];
      for (var n = 0; n < 2200; n++) {
        var sx2 = r() * BW, sy2;
        if (r() < 0.55) { sy2 = (b0 + slope * (sx2 / BW - 0.5) + (r() + r() + r() - 1.5) * bw * 0.7) * BH; } else sy2 = r() * BH;
        var a = 0.12 + Math.pow(r(), 2.2) * 0.75;
        g.globalAlpha = a; g.fillStyle = cols[(r() * 4) | 0];
        var s = r() < 0.92 ? 1 : 1.6;
        g.fillRect(sx2, sy2, s, s);
      }
      // a few bright stars with fine spikes
      for (n = 0; n < 14; n++) {
        var bx = r() * BW, by = r() * BH, bs = 10 + r() * 18;
        g.globalAlpha = 0.5 + r() * 0.4; g.drawImage(glowW, bx - bs / 2, by - bs / 2, bs, bs);
        g.globalAlpha *= 0.35; g.fillStyle = '#dfe9ff';
        g.fillRect(bx - bs * 1.4, by - 0.5, bs * 2.8, 1); g.fillRect(bx - 0.5, by - bs * 1.4, 1, bs * 2.8);
      }
      // distant spiral galaxy on the clock side, low
      var gx = (sys.side > 0 ? 0.16 : 0.84) * BW, gy = (0.84 + r() * 0.06) * BH, gs2 = BW * (0.045 + r() * 0.02), tilt = r() * TAU, sq = 0.3 + r() * 0.25;
      g.save(); g.translate(gx, gy); g.rotate(tilt); g.scale(1, sq);
      g.globalAlpha = 0.35; g.drawImage(glowW, -gs2, -gs2, gs2 * 2, gs2 * 2);
      for (n = 0; n < 2600; n++) {
        var arm = n % 3 === 0 ? 2 : n & 1, tt = Math.pow(r(), 0.8), th = arm * Math.PI + tt * 3.6 + (r() - 0.5) * (0.4 + tt * 0.9), rad = gs2 * tt * (0.9 + r() * 0.2);
        if (arm === 2) { th = r() * TAU; rad = gs2 * Math.pow(r(), 2) * 0.6; }
        g.globalAlpha = (0.16 * (1 - tt) + 0.03); g.fillStyle = tt < 0.3 ? '#ffe6c4' : (n % 5 ? '#c4d8ff' : '#ffc4e0');
        var ds = r() < 0.15 ? 2.2 : 1.2;
        g.fillRect(Math.cos(th) * rad, Math.sin(th) * rad, ds, ds / sq);
      }
      g.globalAlpha = 0.8; g.drawImage(glowW, -gs2 * 0.3, -gs2 * 0.3, gs2 * 0.6, gs2 * 0.6);
      g.restore();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      return c;
    }

    // ---------- planet: sphere-mapped bands (updated a few times a second), ring sprite, moon ----------
    var TW = 512, TH = 256, PD = 400, PPAD = 0.16;
    var P = null;   // planet build
    function buildPlanet() {
      var r = api.rng(sys.seed * 3 + 7), NZ = Noise(api.rng(sys.seed + 202));
      var h0 = sys.hue, K = 7, pal = [];
      for (var k = 0; k < K; k++) {
        var hh = h0 + (r() - 0.5) * 30, l = (k % 2 ? 0.64 : 0.42) + (r() - 0.5) * 0.16, s = 0.22 + r() * 0.38;
        if (k === 3) { hh = h0 + 160 + r() * 40; s = 0.18; }
        pal.push(hsl(hh, s, l));
      }
      var stormCol = hsl(h0 + 12 + r() * 20, 0.55, 0.62);
      var nb = 5 + r() * 4;
      var tex = new Uint8Array(TW * TH * 3);
      var stx = r() * TW, sty = TH * (0.58 + 0.14 * r()), srx = TW * 0.034, sry = TH * 0.028;
      for (var y = 0; y < TH; y++) {
        var lat = y / (TH - 1), rowShift = NZ.fbm(3.3, lat * 10, 3) - 0.5, pole = 0.62 + 0.38 * Math.sin(lat * Math.PI);
        for (var x = 0; x < TW; x++) {
          var u = x / TW;
          var turb = NZ.fbm(u * 8, lat * 26, 4, 8) - 0.5;
          var b = (lat + turb * 0.05 + rowShift * 0.09) * nb * K / 3;
          var i0 = Math.floor(b), f = smooth(0.15, 0.85, b - i0);
          var ca = pal[((i0 % K) + K) % K], cb = pal[(((i0 + 1) % K) + K) % K];
          var streak = 0.84 + 0.3 * NZ.fbm(u * 16, lat * 96, 3, 16);
          var cr = lerp(ca[0], cb[0], f) * streak * pole, cg = lerp(ca[1], cb[1], f) * streak * pole, cbb = lerp(ca[2], cb[2], f) * streak * pole;
          var dx = x - stx; if (dx > TW / 2) dx -= TW; if (dx < -TW / 2) dx += TW;
          var ex = dx / srx, ey = (y - sty) / sry, e2 = ex * ex + ey * ey;
          if (e2 < 5) {
            var kk = Math.exp(-e2 * 1.1), sw = 0.82 + 0.25 * Math.sin(e2 * 5 + Math.atan2(ey, ex) * 2);
            cr = lerp(cr, stormCol[0] * sw, kk); cg = lerp(cg, stormCol[1] * sw, kk); cbb = lerp(cbb, stormCol[2] * sw, kk);
          }
          var ti = (y * TW + x) * 3;
          tex[ti] = clamp(cr, 0, 255); tex[ti + 1] = clamp(cg, 0, 255); tex[ti + 2] = clamp(cbb, 0, 255);
        }
      }
      // ring profile
      var NR = 512, prof = new Float32Array(NR), gap = 0.52 + r() * 0.14;
      for (var i = 0; i < NR; i++) {
        var fr = i / (NR - 1), dn = smooth(0.25, 0.8, 0.3 + 0.7 * NZ.fbm(fr * 42, 7.7, 3));
        dn *= smooth(0, 0.05, fr) * smooth(1, 0.93, fr);
        if (Math.abs(fr - gap) < 0.028) dn *= 0.05;
        dn *= 1 - 0.85 * Math.exp(-Math.pow((fr - 0.86) / 0.007, 2));
        if (fr < 0.22) dn *= 0.3 + 0.7 * fr / 0.22;
        prof[i] = dn * 0.92;
      }
      var rin = sys.ringIn, rout = sys.ringOut;
      var ringA = function (rho) { if (rho < rin || rho > rout) return 0; var f = (rho - rin) / (rout - rin) * (NR - 1), i = f | 0, t = f - i; return i >= NR - 1 ? prof[NR - 1] : prof[i] * (1 - t) + prof[i + 1] * t; };

      var cosR = Math.cos(sys.roll), sinR = Math.sin(sys.roll), sI = sys.sinI, cI = Math.sqrt(1 - sI * sI);
      var L = sys.L, Lx = L[0] * cosR + L[1] * sinR, Ly = -L[0] * sinR + L[1] * cosR, Lz = L[2];
      var LA = -Ly * cI + Lz * sI;   // L · axis
      var atmo = mix3(hsl(h0, 0.7, 0.7), [150, 200, 255], 0.45);
      var Lxy = Math.sqrt(L[0] * L[0] + L[1] * L[1]) || 1;

      var S = Math.round(PD * (1 + 2 * PPAD)), cc = S / 2, rr = PD / 2;
      var can = mkCanvas(S, S), g = can.getContext('2d'), img = g.createImageData(S, S), d = img.data;
      var halo = mkCanvas(S, S), hg = halo.getContext('2d'), himg = hg.createImageData(S, S), hd = himg.data;
      var cnt = 0, cap = Math.ceil(Math.PI * (rr + 2) * (rr + 2));
      var pidx = new Int32Array(cap), tv = new Int32Array(cap), tu = new Float32Array(cap);
      var sr = new Float32Array(cap), sgc = new Float32Array(cap), sb = new Float32Array(cap), ar = new Float32Array(cap), ag = new Float32Array(cap), ab = new Float32Array(cap);
      for (y = 0; y < S; y++) {
        for (x = 0; x < S; x++) {
          var px = (x + 0.5 - cc) / rr, py = (y + 0.5 - cc) / rr, d2 = px * px + py * py, dd = Math.sqrt(d2), o = (y * S + x) * 4;
          if (dd > 1 - 2 / rr) {
            var hdist = Math.max(0, dd - 1) / 0.05, hv = Math.exp(-hdist) * 0.9 + Math.exp(-hdist * 0.25) * 0.12;
            var hdir = clamp(((px * L[0] + py * L[1]) / dd) / Lxy * 0.65 + 0.35, 0, 1);
            hd[o] = atmo[0]; hd[o + 1] = atmo[1]; hd[o + 2] = atmo[2]; hd[o + 3] = clamp(hv * hdir, 0, 1) * 255;
          }
          if (dd < 1 + 1 / rr) {
            var z = Math.sqrt(Math.max(0, 1 - d2));
            var x1 = px * cosR + py * sinR, y1 = -px * sinR + py * cosR;
            var sinLat = clamp(-y1 * cI + z * sI, -1, 1), e2v = y1 * sI + z * cI;
            var lon = Math.atan2(x1, e2v), latr = Math.asin(sinLat);
            var ndl = x1 * Lx + y1 * Ly + z * Lz;
            var lt = clamp(ndl * 1.08 + 0.05, 0, 1); lt = lt * lt * (3 - 2 * lt) * 0.35 + lt * 0.65;
            lt *= 0.62 + 0.38 * Math.sqrt(z);
            var tint = Math.exp(-(ndl / 0.14) * (ndl / 0.14));
            // ring shadow on the planet
            if (sys.ring) {
              var pa = -y1 * cI + z * sI;
              if (pa * LA < 0 && Math.abs(LA) > 1e-3) {
                var tt = -pa / LA, Qx = x1 + tt * Lx, Qy = y1 + tt * Ly, Qz = z + tt * Lz, rho = Math.sqrt(Qx * Qx + Qy * Qy + Qz * Qz);
                lt *= 1 - 0.8 * ringA(rho);
              }
            }
            var amb = 0.022;
            pidx[cnt] = o; tu[cnt] = (lon / TAU + 0.5) * TW; tv[cnt] = Math.round((0.5 - latr / Math.PI) * (TH - 1)) * TW;
            sr[cnt] = lt * (1 + 0.3 * tint) + amb * 0.8; sgc[cnt] = lt * (1 - 0.05 * tint) + amb; sb[cnt] = lt * (1 - 0.25 * tint) + amb * 1.6;
            var fres = Math.pow(1 - z, 2.6) * clamp(ndl + 0.3, 0, 1.2);
            ar[cnt] = atmo[0] * fres * 0.85; ag[cnt] = atmo[1] * fres * 0.85; ab[cnt] = atmo[2] * fres * 0.85;
            d[o + 3] = clamp((1 - dd) * rr + 0.5, 0, 1) * 255;
            cnt++;
          }
        }
      }
      hg.putImageData(himg, 0, 0);
      // ring sprite (already squashed to the viewing angle) with the planet's shadow baked in
      var ring = null;
      if (sys.ring) {
        var RS = 1100, RSH = Math.round(RS * sI), kpx = (RS / 2) / rout, rc = mkCanvas(RS, RSH), rg = rc.getContext('2d'), ri = rg.createImageData(RS, RSH), rd = ri.data;
        var rcol = hsl(h0 + 18, 0.22, 0.74), rcol2 = hsl(h0 - 20, 0.3, 0.55);
        var bright = 0.55 + 0.6 * Math.sqrt(Math.abs(LA));
        for (y = 0; y < RSH; y++) {
          for (x = 0; x < RS; x++) {
            var a = (x + 0.5 - RS / 2) / kpx, bb = (y + 0.5 - RSH / 2) / (kpx * sI), rho2 = Math.sqrt(a * a + bb * bb);
            var al2 = ringA(rho2); if (al2 <= 0.003) continue;
            var Qx2 = a, Qy2 = bb * sI, Qz2 = bb * cI, QL = Qx2 * Lx + Qy2 * Ly + Qz2 * Lz, sh = 1;
            if (QL < 0) sh = 1 - 0.82 * smooth(-0.06, 0.12, QL * QL - (rho2 * rho2 - 1));
            var fr2 = (rho2 - rin) / (rout - rin), cm = 0.5 + 0.5 * Math.sin(fr2 * 23 + 1.3);
            var o2 = (y * RS + x) * 4, lum = bright * sh;
            rd[o2] = lerp(rcol2[0], rcol[0], cm) * lum; rd[o2 + 1] = lerp(rcol2[1], rcol[1], cm) * lum; rd[o2 + 2] = lerp(rcol2[2], rcol[2], cm) * lum;
            rd[o2 + 3] = al2 * 255;
          }
        }
        rg.putImageData(ri, 0, 0);
        ring = rc;
      }
      P = { halo: halo, can: can, g: g, img: img, d: d, cnt: cnt, pidx: pidx, tv: tv, tu: tu, sr: sr, sg: sgc, sb: sb, ar: ar, ag: ag, ab: ab, tex: tex, S: S, ring: ring };
      paintPlanet();
    }
    function paintPlanet() {
      var p = P, d = p.d, tex = p.tex, off = planetRot, n = p.cnt;
      for (var k = 0; k < n; k++) {
        var u = ((p.tu[k] + off) | 0) & (TW - 1), ti = (p.tv[k] + u) * 3, o = p.pidx[k];
        d[o] = tex[ti] * p.sr[k] + p.ar[k];
        d[o + 1] = tex[ti + 1] * p.sg[k] + p.ag[k];
        d[o + 2] = tex[ti + 2] * p.sb[k] + p.ab[k];
      }
      p.g.putImageData(p.img, 0, 0);
    }
    var moonSpr = null;
    function buildMoon() {
      var r = api.rng(sys.seed * 5 + 3), NZ = Noise(api.rng(sys.seed + 303)), D = 150, c = mkCanvas(D, D), g = c.getContext('2d'), img = g.createImageData(D, D), d = img.data;
      var tint = hsl(sys.hue + 180 + r() * 60, 0.12, 0.6), L = sys.L, rr = D / 2 - 1, cr = [];
      for (var i = 0; i < 18; i++) cr.push([r() * 2 - 1, r() * 2 - 1, 0.04 + Math.pow(r(), 2) * 0.22]);
      for (var y = 0; y < D; y++) for (var x = 0; x < D; x++) {
        var px = (x + 0.5 - D / 2) / rr, py = (y + 0.5 - D / 2) / rr, d2 = px * px + py * py; if (d2 > 1.02) continue;
        var z = Math.sqrt(Math.max(0, 1 - d2)), ndl = px * L[0] + py * L[1] + z * L[2];
        var lt = clamp(ndl * 1.1 + 0.02, 0, 1), alb = 0.55 + 0.5 * NZ.fbm(px * 3 + 5, py * 3, 4);
        for (var j = 0; j < cr.length; j++) {
          var dx = px - cr[j][0], dy = py - cr[j][1], e = Math.sqrt(dx * dx + dy * dy) / cr[j][2];
          if (e < 1.15) alb *= e < 0.85 ? 0.78 : 1.18;
        }
        var o = (y * D + x) * 4;
        d[o] = tint[0] * alb * lt + 3; d[o + 1] = tint[1] * alb * lt + 4; d[o + 2] = tint[2] * alb * lt + 8;
        d[o + 3] = clamp((1 - Math.sqrt(d2)) * rr + 0.5, 0, 1) * 255;
      }
      g.putImageData(img, 0, 0);
      moonSpr = c;
    }
    var rockSpr = [];
    function buildRocks() {
      var r = api.rng(sys.seed * 11 + 5), NZ = Noise(api.rng(sys.seed + 404)), L = sys.L;
      rockSpr = [];
      for (var s = 0; s < 6; s++) {
        var c = mkCanvas(64, 64), g = c.getContext('2d');
        g.translate(32, 32); g.beginPath();
        for (var i = 0; i < 16; i++) {
          var th = i / 16 * TAU, rad = 24 * (0.7 + 0.45 * NZ.fbm(Math.cos(th) * 1.5 + s * 7, Math.sin(th) * 1.5 + s * 3, 3)) * (i % 2 ? 1 : 0.94);
          if (i === 0) g.moveTo(Math.cos(th) * rad, Math.sin(th) * rad * (0.7 + s * 0.05)); else g.lineTo(Math.cos(th) * rad, Math.sin(th) * rad * (0.7 + s * 0.05));
        }
        g.closePath();
        var gr = g.createRadialGradient(L[0] * 14, L[1] * 14, 2, 0, 0, 30);
        var warm = 0.85 + r() * 0.3;
        gr.addColorStop(0, rgba([150 * warm, 138, 124 / warm], 1)); gr.addColorStop(0.45, '#3b3632'); gr.addColorStop(1, '#070606');
        g.fillStyle = gr; g.fill();
        g.save(); g.clip();
        for (i = 0; i < 6; i++) { g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.arc((r() - 0.5) * 30, (r() - 0.5) * 22, 1.5 + r() * 4, 0, TAU); g.fill(); }
        g.restore();
        rockSpr.push(c);
      }
      rocks = [];
      for (var n = 0; n < 90; n++) {
        var z = 0.3 + Math.pow(r(), 2.4) * 1.5;
        rocks.push({ x: r() * 1.2, y: (r() + r() - 1), z: z, s: (0.0022 + Math.pow(r(), 3) * 0.012) * z * z, spr: (r() * 6) | 0, rot: r() * TAU, vr: (r() - 0.5) * 0.3, v: 0.0018 + r() * 0.0015 });
      }
      rocks.sort(function (a, b) { return a.z - b.z; });
    }

    // ---------- stars (animated layers) ----------
    function buildStars() {
      var r = api.rng(sys.seed * 13 + 1), cols = ['#ffffff', '#cfe0ff', '#ffe4c4'];
      stars = [];
      var add = function (n, f, s0, s1, a0, a1) {
        for (var i = 0; i < n; i++) stars.push({ x: r(), y: r(), f: f, s: s0 + Math.pow(r(), 2) * (s1 - s0), a: a0 + r() * (a1 - a0), tw: r() < 0.3 ? 0.55 : 0.18, w: 0.6 + r() * 2.4, p: r() * TAU, c: (r() * 3) | 0 });
      };
      add(300, 0.018, 0.9, 1.7, 0.25, 0.8);
      add(110, 0.036, 1.3, 2.8, 0.4, 1);
      stars.sort(function (a, b) { return a.c - b.c; });
      stars.cols = cols;
      warpP = { X: new Float32Array(420), Y: new Float32Array(420), Z: new Float32Array(420) };
      for (var i = 0; i < 420; i++) { var a = r() * TAU, d = 0.08 + Math.sqrt(r()) * 1.2; warpP.X[i] = Math.cos(a) * d; warpP.Y[i] = Math.sin(a) * d * 0.7; warpP.Z[i] = 0.05 + r(); }
    }

    // ---------- system generation ----------
    function nameFor(r) {
      var n = SYL[(r() * SYL.length) | 0] + SYL[(r() * SYL.length) | 0] + (r() < 0.45 ? SYL[(r() * SYL.length) | 0] : '');
      return n.charAt(0).toUpperCase() + n.slice(1) + ' ' + ROMAN[(r() * ROMAN.length) | 0];
    }
    function genSystem(seed, keepSide, forceSide) {
      var r = api.rng(seed);
      var side = r() < 0.62 ? 1 : -1;
      if (keepSide) side = -sys.side;
      if (forceSide) side = forceSide;
      var lz = 0.5 + r() * 0.2, L = [side * (0.55 + r() * 0.12), -(0.52 + r() * 0.16), lz], ll = Math.sqrt(L[0] * L[0] + L[1] * L[1] + L[2] * L[2]);
      L = [L[0] / ll, L[1] / ll, L[2] / ll];
      sys = {
        seed: seed, side: side, L: L,
        hue: HUES[(r() * HUES.length) | 0] + (r() - 0.5) * 24,
        px: side > 0 ? 0.74 + r() * 0.03 : 0.26 - r() * 0.03, py: 0.56 + r() * 0.07, pr: 0.27 + r() * 0.04,
        roll: -side * (0.22 + r() * 0.2), sinI: 0.17 + r() * 0.12,
        ring: r() < 0.94, ringIn: 1.32 + r() * 0.15, ringOut: 2.0 + r() * 0.35,
        name: nameFor(r), bearing: (r() * 360).toFixed(1),
        moonX: side > 0 ? 0.47 + r() * 0.08 : 0.53 - r() * 0.08, moonY: 0.1 + r() * 0.06, moonR: 0.028 + r() * 0.014,
        stX: side > 0 ? 0.57 + r() * 0.05 : 0.43 - r() * 0.05, stY: 0.2 + r() * 0.05,
      };
      var ta = Date.now();
      bg = buildBackdrop(); buildPlanet(); buildMoon(); buildRocks(); buildStars();
      sys.buildMs = Date.now() - ta;
      updateHudSide();
    }
    function updateHudSide() {
      hud.classList.toggle('right', sys.side < 0);
      elSys.textContent = 'SYSTEM ' + sys.name.toUpperCase() + '  ·  BEARING ' + sys.bearing;
    }
    function applyMood() {
      var pal = MOODS[mood];
      root.style.setProperty('--glow', (pal.glow[0] | 0) + ',' + (pal.glow[1] | 0) + ',' + (pal.glow[2] | 0));
      root.style.setProperty('--accent', pal.accent);
      elWatch.textContent = pal.word;
    }

    // ---------- sizing ----------
    function size() {
      var iw = root.clientWidth || innerWidth, ih = root.clientHeight || innerHeight, k = Math.min(1, 1920 / iw, 1080 / ih);
      var nw = Math.round(iw * k), nh = Math.round(ih * k);
      if (nw === W && nh === H) return false;
      W = cv.width = nw; H = cv.height = nh; return true;
    }

    // ---------- events in the sky ----------
    function startFleet(warpIn) {
      var r = api.rng((Date.now() & 0xffffff) + 9), dir = r() < 0.5 ? 1 : -1, upper = r() < 0.6;
      var base = upper ? 0.17 + r() * 0.06 : 0.8 + r() * 0.05;
      var ships = [{ kind: 'lance', spr: SPR.lance, dx: 0, dy: 0, z: 1, len: 0.23 }];
      var form = [[-0.13, -0.075, 0.55], [-0.16, 0.085, 0.6], [-0.27, -0.02, 0.45], [-0.33, 0.12, 0.5], [0.05, -0.12, 0.4], [-0.42, -0.1, 0.38]];
      form.forEach(function (f) { ships.push({ kind: 'talon', spr: SPR.talon, dx: f[0], dy: f[1] * (upper ? 1 : -0.8), z: f[2], len: 0.075 * f[2] / 0.55 }); });
      var dur = 46;
      fleet = { t0: T, dir: dir, base: base, ships: ships, dur: dur, warpIn: !!warpIn, u0: warpIn ? 0.6 : 0, slope: (r() - 0.5) * 0.06 };
      if (warpIn) ships.forEach(function (s, i) { s.arrive = T + 0.25 + i * 0.22 + (s.kind === 'lance' ? 0.4 : 0); });
    }
    function startComet(dim) {
      var r = Math.random, fromLeft = r() < 0.5;
      comets.push({ kind: 'comet', t0: T, dur: 11 + r() * 5, x0: fromLeft ? -0.05 : 1.05, y0: 0.05 + r() * 0.2, x1: fromLeft ? 0.6 + r() * 0.3 : 0.4 - r() * 0.3, y1: 0.25 + r() * 0.25, a: dim ? 0.35 : 1 });
    }
    function startGlint(dim) {
      var r = Math.random, y = 0.06 + r() * 0.3;
      comets.push({ kind: 'glint', t0: T, dur: 18, x0: r() < 0.5 ? 0.1 : 0.9, y0: y, x1: 0.5 + (r() - 0.5) * 0.3, y1: y + (r() - 0.5) * 0.15, a: dim ? 0.45 : 1 });
    }
    function banner(text) {
      elBanner.textContent = text; elBanner.classList.remove('show'); void elBanner.offsetWidth; elBanner.classList.add('show');
    }
    function startWarp(kind) {
      if (warp) return;
      warp = { t0: T, kind: kind, regen: false, vx: W / 2, vy: H / 2 };
      if (kind === 'jump') fleet = null;
    }

    // ---------- per-frame drawing ----------
    function parallax(f) { return [-cam.x * f * W, -cam.y * f * H * 0.7]; }
    // Very slow wall-clock drift so nothing bright sits on the same pixels for hours.
    var WT = 0;
    function drift(k) { return [Math.sin(WT / 2300 + k) * 0.018 * W, Math.sin(WT / 3100 + k * 2) * 0.014 * H]; }

    function drawStars(alpha) {
      if (alpha <= 0.01) return;
      var cols = stars.cols, cur = -1, spanW = W * 1.2, spanH = H * 1.2, drift = T * 3 * -sys.side;
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        if (s.c !== cur) { cur = s.c; ctx.fillStyle = cols[cur]; }
        var ox = -cam.x * s.f * W + drift * s.f * 40, oy = -cam.y * s.f * H * 0.7;
        var x = ((s.x * spanW + ox) % spanW + spanW) % spanW - W * 0.1, y = ((s.y * spanH + oy) % spanH + spanH) % spanH - H * 0.1;
        var a = s.a * (1 - s.tw + s.tw * (0.5 + 0.5 * Math.sin(T * s.w + s.p))) * alpha;
        A(a);
        if (s.s > 2.2) { ctx.drawImage(glowW, x - s.s * 3, y - s.s * 3, s.s * 6, s.s * 6); }
        ctx.fillRect(x - s.s / 2, y - s.s / 2, s.s, s.s);
      }
      A(1);
    }

    function drawPlanetGroup() {
      var o = parallax(0.026), dr = drift(0), cx = sys.px * W + o[0] + dr[0], cy = sys.py * H + o[1] + dr[1], R = sys.pr * H;
      var k = R / (PD / 2), S = P.S * k;
      if (P.ring) {
        var rs = sys.ringOut * R * 2;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(sys.roll);
        ctx.beginPath(); ctx.rect(-rs, -rs, rs * 2, rs); ctx.clip();
        ctx.drawImage(P.ring, -rs / 2, -rs / 2 * sys.sinI, rs, rs * sys.sinI);
        ctx.restore();
      }
      ctx.drawImage(P.halo, cx - S / 2, cy - S / 2, S, S);
      ctx.drawImage(P.can, cx - S / 2, cy - S / 2, S, S);
      if (P.ring) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(sys.roll);
        ctx.beginPath(); ctx.rect(-rs, 0, rs * 2, rs); ctx.clip();
        ctx.drawImage(P.ring, -rs / 2, -rs / 2 * sys.sinI, rs, rs * sys.sinI);
        ctx.restore();
      }
    }

    function drawMoon() {
      var o = parallax(0.02), dr = drift(1.7), r = sys.moonR * H, x = sys.moonX * W + o[0] + dr[0] + Math.sin(T / 90) * W * 0.01, y = sys.moonY * H + o[1] + dr[1];
      ctx.drawImage(moonSpr, x - r, y - r, r * 2, r * 2);
    }

    function drawStation() {
      var o = parallax(0.036), dr = drift(3.1), s = H * 0.07, x = sys.stX * W + o[0] + dr[0], y = sys.stY * H + o[1] + dr[1] + Math.sin(T / 17) * H * 0.003;
      var spin = T * (calm ? 0.05 : 0.09), tilt = -0.16 * sys.side, ry = 0.3, L = sys.L;
      var lit = MOODS[mood].sun;
      ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
      var gr = ctx.createLinearGradient(-L[0] * s, -L[1] * s, L[0] * s, L[1] * s);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, rgba(lit, 0.85));
      var ringHalf = function (back) {
        var a0 = back ? Math.PI : 0, a1 = back ? TAU : Math.PI;
        ctx.beginPath(); ctx.ellipse(0, 0, s, s * ry, 0, a0, a1);
        ctx.lineWidth = s * 0.15; ctx.strokeStyle = back ? '#181d26' : '#262d39'; ctx.stroke();
        ctx.lineWidth = s * 0.06; ctx.strokeStyle = gr; ctx.globalAlpha = back ? 0.5 : 1; ctx.stroke(); ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.ellipse(0, 0, s * 1.075, s * ry * 1.075, 0, a0, a1); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(200,215,240,' + (back ? 0.15 : 0.35) + ')'; ctx.stroke();
        // habitat modules riding the ring (they make the spin readable)
        ctx.lineWidth = s * 0.2; ctx.strokeStyle = back ? '#20262f' : '#343c4a';
        for (var mI = 0; mI < 8; mI++) {
          var m0 = mI / 8 * TAU + spin, mm = (m0 % TAU + TAU) % TAU;
          if ((mm > Math.PI) !== back) continue;
          ctx.beginPath(); ctx.ellipse(0, 0, s, s * ry, 0, m0 - 0.09, m0 + 0.09); ctx.stroke();
        }
        ctx.fillStyle = '#ffd9a0';
        for (var k = 0; k < 28; k++) {
          var th = k / 28 * TAU + spin, sn = Math.sin(th);
          if ((sn < 0) !== back || k % 2) continue;
          A(0.5 + 0.5 * Math.abs(sn));
          ctx.fillRect(Math.cos(th) * s - 1, sn * s * ry - 1, 2.2, 2.2);
        }
        A(1);
        ctx.strokeStyle = '#3b4352'; ctx.lineWidth = Math.max(1, s * 0.022);
        ctx.beginPath();
        for (k = 0; k < 4; k++) {
          var t2 = spin + k * Math.PI / 2;
          if ((Math.sin(t2) < 0) !== back) continue;
          ctx.moveTo(0, 0); ctx.lineTo(Math.cos(t2) * s * 0.94, Math.sin(t2) * s * ry * 0.94);
        }
        ctx.stroke();
      };
      ringHalf(true);
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.5, s * 0.5 * ry, 0, 0, TAU); ctx.lineWidth = Math.max(1, s * 0.03); ctx.strokeStyle = '#3a4352'; ctx.stroke();
      // solar arrays
      ctx.fillStyle = '#16244a'; ctx.strokeStyle = 'rgba(120,160,230,.55)'; ctx.lineWidth = 1;
      [-1, 1].forEach(function (sd) {
        ctx.fillRect(sd > 0 ? s * 0.08 : -s * 0.62, -s * 0.5, s * 0.54, s * 0.13);
        ctx.strokeRect(sd > 0 ? s * 0.08 : -s * 0.62, -s * 0.5, s * 0.54, s * 0.13);
      });
      var sweep = (T * 0.07) % 1;
      ctx.fillStyle = 'rgba(180,210,255,' + (0.35 * Math.sin(sweep * Math.PI)) + ')';
      ctx.fillRect(-s * 0.62 + sweep * s * 1.24, -s * 0.5, s * 0.06, s * 0.13);
      // spindle
      var gr = ctx.createLinearGradient(-s * 0.07 * sys.side, 0, s * 0.07 * sys.side, 0);
      gr.addColorStop(0, '#11151c'); gr.addColorStop(0.6, '#5a6474'); gr.addColorStop(1, rgba(lit, 0.95));
      ctx.fillStyle = gr; ctx.fillRect(-s * 0.065, -s * 0.62, s * 0.13, s * 1.3);
      var hub = ctx.createRadialGradient(s * 0.05 * sys.side, -s * 0.05, 0, 0, 0, s * 0.16);
      hub.addColorStop(0, rgba(lit, 1)); hub.addColorStop(0.45, '#5b6575'); hub.addColorStop(1, '#0e1218');
      ctx.fillStyle = hub; ctx.beginPath(); ctx.arc(0, 0, s * 0.16, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#6b7484'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -s * 0.62); ctx.lineTo(0, -s * 0.9); ctx.stroke();
      ringHalf(false);
      ctx.globalCompositeOperation = 'lighter';
      if ((T % 1.7) < 0.14) { A(calm ? 0.4 : 0.9); ctx.drawImage(glowW, -6, -s * 0.9 - 6, 12, 12); ctx.fillStyle = '#ff5a4a'; ctx.fillRect(-1, -s * 0.9 - 1, 2, 2); }
      A(0.5 + 0.3 * Math.sin(T * 1.3));
      var dockGlow = dockFlash();
      ctx.drawImage(glowW, -5 - dockGlow * 8, s * 0.68 - 5 - dockGlow * 8, 10 + dockGlow * 16, 10 + dockGlow * 16);
      A(1); ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      drawShuttle(x, y, s, tilt);
    }
    var DOCK = 84;
    function dockFlash() { var c = ((T / DOCK + dockPhase) % 1) * DOCK; return c > 30 && c < 34 ? Math.sin((c - 30) / 4 * Math.PI) : 0; }
    function drawShuttle(x, y, s, tilt) {
      var c = ((T / DOCK + dockPhase) % 1) * DOCK, u, fade = 1;
      if (c < 31) u = 1 - Math.pow(1 - c / 31, 2.2);
      else if (c < 33) { u = 1; fade = 1 - (c - 31) / 2; }
      else if (c > 52 && c < 78) { u = 1 - Math.pow((c - 52) / 26, 2); if (c < 54) fade = (c - 52) / 2; }
      else return;
      var dx = x - Math.sin(tilt) * s * 0.74, dy = y + Math.cos(tilt) * s * 0.74;
      var sx = dx + sys.side * W * 0.32, sy = dy + H * 0.42, cx1 = dx + sys.side * W * 0.02, cy1 = dy + H * 0.3;
      var b = function (a0, a1, a2, t) { return (1 - t) * (1 - t) * a0 + 2 * (1 - t) * t * a1 + t * t * a2; };
      var px = b(sx, cx1, dx, u), py = b(sy, cy1, dy, u);
      var tx = b(sx, cx1, dx, Math.min(1, u + 0.01)) - b(sx, cx1, dx, Math.max(0, u - 0.01)), ty = b(sy, cy1, dy, Math.min(1, u + 0.01)) - b(sy, cy1, dy, Math.max(0, u - 0.01));
      var ang = Math.atan2(ty, tx);
      if (c > 52) ang += Math.PI;   // departing: nose away from the station
      var len = W * 0.024 * (0.7 + 0.3 * u);
      drawShip('talon', SPR.shuttle, px, py, len, 1, fade, 1, ang);
    }

    function drawRocks() {
      var o = parallax(0.06), side = sys.side;
      for (var i = 0; i < rocks.length; i++) {
        var k = rocks[i];
        var span = 1.2, xx = ((k.x - T * k.v * k.z * side * (calm ? 0.5 : 1)) % span + span) % span - 0.1;
        var x = xx * W + o[0] * k.z, y = (0.84 + k.y * 0.035 * (0.6 + k.z) + (k.z - 0.8) * 0.07 - 0.05 * Math.sin(xx * Math.PI) + (xx - 0.5) * 0.08 * side) * H + o[1] * k.z;
        var s = k.s * W, rot = k.rot + T * k.vr;
        A(clamp(0.35 + k.z * 0.5, 0, 1));
        ctx.setTransform(Math.cos(rot) * s / 48, Math.sin(rot) * s / 48, -Math.sin(rot) * s / 48, Math.cos(rot) * s / 48, x, y);
        ctx.drawImage(rockSpr[k.spr], -32, -32);
      }
      A(1);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function drawFleet() {
      if (!fleet) return;
      var te = T - fleet.t0, u = fleet.u0 + te / fleet.dur, o = parallax(0.085), dir = fleet.dir;
      if (u > 1.6) { fleet = null; return; }
      var order = fleet.ships.slice().sort(function (a, b) { return a.z - b.z; });
      for (var i = 0; i < order.length; i++) {
        var s = order[i], speedK = 0.55 + 0.45 * s.z;
        var fx = -0.35 + u * 1.6 * speedK + 0.12 * (1 - speedK);
        var x = (dir > 0 ? fx + s.dx : 1 - fx - s.dx) * W + o[0] * s.z, y = (fleet.base + s.dy + fleet.slope * u) * H + o[1] * s.z + Math.sin(T * 0.5 + s.dx * 9) * H * 0.003;
        var len = s.len * W, alpha = clamp(0.55 + 0.45 * s.z, 0, 1), stretch = 1;
        if (fleet.warpIn) {
          var tl = T - s.arrive;
          if (tl < -0.35) continue;
          if (tl < 0) {   // incoming streak
            var k = 1 + tl / 0.35, head = x, tail = x - dir * W * 1.4 * (1 - k * 0.6);
            ctx.globalCompositeOperation = 'lighter';
            var gr = ctx.createLinearGradient(tail, y, head, y); gr.addColorStop(0, 'rgba(120,180,255,0)'); gr.addColorStop(1, 'rgba(230,245,255,' + (0.9 * k) + ')');
            ctx.fillStyle = gr; ctx.fillRect(Math.min(tail, head), y - len * 0.012, Math.abs(head - tail), len * 0.024);
            ctx.globalCompositeOperation = 'source-over';
            continue;
          }
          if (tl < 0.7) {
            stretch = 1 + 2.2 * Math.pow(1 - tl / 0.7, 3);
            ctx.globalCompositeOperation = 'lighter'; A(Math.pow(1 - tl / 0.7, 2));
            var fs = len * 1.3; ctx.drawImage(glowE, x - fs / 2, y - fs / 2, fs, fs);
            ctx.drawImage(streakSpr, x - len * 1.6, y - len * 0.05, len * 3.2, len * 0.1);
            A(1); ctx.globalCompositeOperation = 'source-over';
          }
        }
        drawShip(s.kind, s.spr, x, y, len, dir, alpha, stretch, 0);
      }
    }

    function drawComets() {
      var o = parallax(0.01);
      for (var i = comets.length - 1; i >= 0; i--) {
        var c = comets[i], k = (T - c.t0) / c.dur;
        if (k > 1) { comets.splice(i, 1); continue; }
        var x = lerp(c.x0, c.x1, k) * W + o[0], y = lerp(c.y0, c.y1, k) * H + o[1], env = Math.sin(k * Math.PI);
        ctx.globalCompositeOperation = 'lighter';
        if (c.kind === 'comet') {
          var vx = (c.x1 - c.x0) * W, vy = (c.y1 - c.y0) * H, vl = Math.sqrt(vx * vx + vy * vy), tl = W * 0.24, tx = x - vx / vl * tl, ty = y - vy / vl * tl;
          var nx = -vy / vl, ny = vx / vl, fan = W * 0.012;
          var gr = ctx.createLinearGradient(x, y, tx, ty); gr.addColorStop(0, 'rgba(190,230,255,' + (0.5 * env * c.a) + ')'); gr.addColorStop(0.4, 'rgba(120,180,255,' + (0.16 * env * c.a) + ')'); gr.addColorStop(1, 'rgba(90,140,255,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x + nx * 2, y + ny * 2); ctx.lineTo(tx + nx * fan, ty + ny * fan); ctx.lineTo(tx - nx * fan * 0.4, ty - ny * fan * 0.4); ctx.lineTo(x - nx * 2, y - ny * 2); ctx.fill();
          var g2 = ctx.createLinearGradient(x, y, x - vx / vl * tl * 0.6, y - vy / vl * tl * 0.6); g2.addColorStop(0, 'rgba(255,255,255,' + (0.9 * env * c.a) + ')'); g2.addColorStop(1, 'rgba(160,210,255,0)');
          ctx.strokeStyle = g2; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - vx / vl * tl * 0.6, y - vy / vl * tl * 0.6); ctx.stroke();
          A(env * c.a); ctx.drawImage(glowE, x - 14, y - 14, 28, 28); ctx.drawImage(glowW, x - 5, y - 5, 10, 10);
        } else {
          var fl = Math.exp(-Math.pow((k - 0.5) / 0.035, 2));
          A(Math.min(1, env * 3) * c.a * 0.85); ctx.fillStyle = '#e8f0ff'; ctx.fillRect(x - 1, y - 1, 2, 2);
          if (fl > 0.02) {
            A(fl * c.a); var gs = 8 + fl * 34; ctx.drawImage(glowW, x - gs / 2, y - gs / 2, gs, gs);
            A(fl * 0.8 * c.a); ctx.drawImage(streakSpr, x - 70, y - 2, 140, 4);
            ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 2); ctx.drawImage(streakSpr, -30, -1.5, 60, 3); ctx.restore();
          }
        }
        A(1); ctx.globalCompositeOperation = 'source-over';
      }
    }

    function drawSunAndFlare(alpha) {
      var o = parallax(0.006), pal = MOODS[mood];
      var sx = (sys.side > 0 ? 0.985 : 0.015) * W + o[0] - sys.side * (0.5 + 0.5 * Math.sin(WT / 2700)) * 0.06 * W, sy = (0.035 + 0.03 * Math.sin(WT / 1900)) * H + o[1];
      var pulse = 0.9 + 0.1 * Math.sin(T * 0.7);
      ctx.globalCompositeOperation = 'lighter';
      A(0.9 * alpha); var g1 = H * 0.5 * pulse; ctx.drawImage(glowW, sx - g1 / 2, sy - g1 / 2, g1, g1);
      A(alpha); var g2 = H * 0.12; ctx.drawImage(glowW, sx - g2 / 2, sy - g2 / 2, g2, g2);
      A(0.45 * alpha * pulse); ctx.drawImage(streakSpr, sx - W * 0.75, sy - H * 0.012, W * 1.5, H * 0.024);
      if (!calm) {
        var gx = W / 2 - sx, gy = H / 2 - sy, tints = [[0.45, 0.014, 'c'], [0.8, 0.03, 'a'], [1.25, 0.022, 'v']];
        for (var i = 0; i < tints.length; i++) {
          var t = tints[i], r = t[1] * H, x = sx + gx * t[0], y = sy + gy * t[0];
          A(0.15 * alpha);
          ctx.drawImage(ghostSpr, x - r, y - r, r * 2, r * 2);
        }
              }
      A(1); ctx.globalCompositeOperation = 'source-over';
    }

    function drawWarpStreaks(spd, alpha) {
      if (alpha <= 0.01) return;
      var vx = warp.vx, vy = warp.vy, F = W * 0.06, X = warpP.X, Y = warpP.Y, Z = warpP.Z, n = X.length;
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      var buckets = [[0.75, '#9fd0ff', 1.1], [0.45, '#dbeeff', 1.6], [0.0, '#ffffff', 2.2]];
      for (var b = 0; b < 3; b++) {
        ctx.beginPath();
        for (var i = 0; i < n; i++) {
          var z = Z[i]; if (b === 0 ? z < 0.75 : b === 1 ? (z >= 0.75 || z < 0.45) : z >= 0.45) continue;
          var zz = z + 0.02 + spd * 0.35;
          ctx.moveTo(vx + X[i] / zz * F, vy + Y[i] / zz * F); ctx.lineTo(vx + X[i] / z * F, vy + Y[i] / z * F);
        }
        ctx.strokeStyle = buckets[b][1]; ctx.lineWidth = buckets[b][2]; A(alpha * (0.45 + b * 0.25));
        ctx.stroke();
      }
      A(1); ctx.globalCompositeOperation = 'source-over';
    }

    // ---------- update + draw ----------
    function frame(now) {
      if (dead) return;
      raf = requestAnimationFrame(frame);
      if (now - lastFrame < 30) return;
      var dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0.033; lastFrame = now;
      T += dt; groupAlpha = 1; WT = api.now().getTime() / 1000;
      var e = Math.min(1, dt * 1.6); cam.x += (cam.tx - cam.x) * e; cam.y += (cam.ty - cam.y) * e;

      // planet cloud bands turn
      planetRot += dt * (calm ? 0.45 : 0.9); planetAcc += dt;
      if (planetAcc > (calm ? 0.33 : 0.2)) { planetAcc = 0; paintPlanet(); }

      if (!calm && !reduced && !fleet && !warp && T > nextFleet) { startFleet(false); nextFleet = T + 200 + Math.random() * 220; }

      // warp state
      var sceneS = 1, sceneA = 1, starA = 1, flash = 0, tunnel = 0, spd = 0, shock = -1;
      if (warp) {
        var te = T - warp.t0;
        if (warp.kind === 'jump') {
          if (te < 1.75) {
            var a = te / 1.75; spd = 0.03 + Math.pow(a, 2.5) * 1.3;
            sceneS = 1 + 0.5 * Math.pow(a, 3); sceneA = 1 - smooth(0.35, 1, a); starA = 1 - smooth(0.1, 0.6, a); tunnel = a * a;
          } else if (te < 2.05) {
            spd = 1.35; sceneA = 0; starA = 0; tunnel = 1;
          } else {
            var k = clamp((te - 2.05) / 2.2, 0, 1); spd = 1.35 * Math.pow(1 - k, 2.5);
            sceneS = 0.82 + 0.18 * (1 - Math.pow(1 - k, 3)); sceneA = smooth(0, 0.55, k); starA = smooth(0.25, 1, k); tunnel = Math.pow(1 - k, 2);
            shock = k;
          }
          flash = Math.exp(-Math.pow((te - 1.9) / 0.16, 2));
          if (te >= 1.85 && !warp.regen) {
            warp.regen = true;
            var t0 = Date.now();
            genSystem((Math.random() * 2147483647) | 0, true);
            warp.t0 += (Date.now() - t0) / 1000;   // freeze the timeline across the rebuild
          }
          if (te > 4.4) { warp = null; banner('ARRIVED  ·  ' + sys.name.toUpperCase()); if (pendingFleet) { pendingFleet = false; startFleet(true); } }
          // warp particles
          if (warp) for (var i = 0; i < warpP.Z.length; i++) { warpP.Z[i] -= spd * dt * 0.9; if (warpP.Z[i] < 0.03) warpP.Z[i] += 1; }
        } else {   // serene drift: fade out, rebuild, fade in
          if (te < 2.2) sceneA = 1 - smooth(0, 1, te / 2.2);
          else {
            if (!warp.regen) { warp.regen = true; prevBg = bg; prevBgA = 1; genSystem((Math.random() * 2147483647) | 0, true); }
            sceneA = smooth(0, 1, (te - 2.2) / 3.5);
          }
          if (te > 6) { warp = null; banner('NOW DRIFTING  ·  ' + sys.name.toUpperCase()); }
        }
      }
      if (prevBg) { prevBgA -= dt / 5; if (prevBgA <= 0) { prevBg = null; } }

      // ---- draw ----
      A(1); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      var ob = parallax(0.008), vx = W / 2, vy = H / 2;
      ctx.save();
      if (warp && warp.kind === 'jump') { var bs = 1 + (sceneS - 1) * 0.3; ctx.translate(vx, vy); ctx.scale(bs, bs); ctx.translate(-vx, -vy); A(0.25 + 0.75 * Math.max(sceneA, starA)); }
      ctx.drawImage(bg, -OVER * W + ob[0], -OVER * H + ob[1]);
      if (prevBg) { A(Math.max(0, prevBgA)); ctx.drawImage(prevBg, -OVER * W + ob[0], -OVER * H + ob[1]); }
      ctx.restore();
      A(1);

      drawStars(starA);
      if (warp && warp.kind === 'jump') drawWarpStreaks(spd, Math.min(1, spd * 2));
      if (sceneA > 0.005) {
        ctx.save();
        if (sceneS !== 1) { ctx.translate(vx, vy); ctx.scale(sceneS, sceneS); ctx.translate(-vx, -vy); }
        groupAlpha = sceneA; A(1);
        drawComets();
        drawMoon();
        drawPlanetGroup();
        drawStation();
        drawRocks();
        if (sceneS !== 1) { ctx.translate(vx, vy); ctx.scale(sceneS, sceneS); ctx.translate(-vx, -vy); }   // ships read nearer: extra zoom
        drawFleet();
        ctx.restore();
        groupAlpha = 1;
        drawSunAndFlare(sceneA * (calm ? 0.5 : 1));
      }
      if (tunnel > 0.01) {
        var tg = ctx.createRadialGradient(vx, vy, 0, vx, vy, W * 0.45);
        tg.addColorStop(0, 'rgba(200,225,255,' + (0.55 * tunnel) + ')'); tg.addColorStop(0.3, 'rgba(90,140,255,' + (0.22 * tunnel) + ')'); tg.addColorStop(1, 'rgba(40,60,160,0)');
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
      }
      if (shock >= 0 && shock < 0.7) {
        var sk = shock / 0.7;
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(190,220,255,' + (0.5 * (1 - sk)) + ')'; ctx.lineWidth = 2 + 10 * (1 - sk);
        ctx.beginPath(); ctx.ellipse(vx, vy, sk * W * 0.75, sk * W * 0.75 * 0.55, 0, 0, TAU); ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
      }
      if (flash > 0.01) { ctx.fillStyle = 'rgba(236,244,255,' + Math.min(1, flash * 1.05) + ')'; ctx.fillRect(0, 0, W, H); }

      // HUD: slow burn-in drift + a touch of counter-parallax
      var tt = api.now().getTime() / 1000, vw = (root.clientWidth || innerWidth) / 100, vh = (root.clientHeight || innerHeight) / 100;
      var hx = Math.sin(tt / 1530) * 2.2 * vw + Math.sin(tt / 397) * 0.5 * vw - cam.x * 0.5 * vw;
      var hy = Math.sin(tt / 2170 + 1) * 3.2 * vh + Math.sin(tt / 611) * 0.6 * vh - cam.y * 0.5 * vh;
      var hs = 1;
      if (warp && warp.kind === 'jump') { var wte = T - warp.t0; hs = 1 + 0.025 * Math.exp(-Math.pow((wte - 1.9) / 0.5, 2)); hx += (Math.random() - 0.5) * spd * 3; }
      hud.style.transform = 'translate3d(' + hx.toFixed(1) + 'px,' + hy.toFixed(1) + 'px,0) translateY(-50%) scale(' + hs.toFixed(4) + ')';
    }

    // ---------- clock ----------
    var last = { digits: '', sec: -1, min: -1, date: '' };
    function doy(d) { var s = new Date(d.getFullYear(), 0, 1); return Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - s) / 86400000) + 1; }
    function tick() {
      if (dead) return;
      var d = api.now(), h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
      var str = api.pad(h) + api.pad(m);
      if (str !== last.digits) {
        for (var i = 0; i < 4; i++) {
          if (last.digits && last.digits[i] === str[i]) continue;
          var el = digits[i]; el.textContent = str[i];
          if (last.digits) { el.classList.remove('in', 'soft'); void el.offsetWidth; el.classList.add(calm || reduced ? 'soft' : 'in'); }
        }
        last.digits = str;
      }
      if (s !== last.sec) {
        last.sec = s; elSec.textContent = api.pad(s);
        var pct = (s / 59) * 100; if (sys && sys.side < 0) pct = 100 - pct;
        if (s === 0) { elTick.style.transition = 'none'; elTick.style.left = pct + '%'; void elTick.offsetWidth; elTick.style.transition = ''; }
        else elTick.style.left = pct + '%';
      }
      var ds = 'ORBIT DAY ' + d.getFullYear() + '.' + ('00' + doy(d)).slice(-3) + '|·  ' + api.DAYS[d.getDay()].toUpperCase() + '  ·  ' + d.getDate() + ' ' + api.MONTHS[d.getMonth()].toUpperCase();
      if (ds !== last.date) { last.date = ds; var parts = ds.split('|'); elOd.textContent = parts[0]; elDate.textContent = parts[1]; }
      var c = api.calm();
      if (c !== calm) { calm = c; root.classList.toggle('calm', calm); }
      var md = api.mood();
      if (md !== mood && !warp) { mood = md; applyMood(); prevBg = bg; prevBgA = 1; bg = buildBackdrop(); }
    }

    // ---------- lifecycle ----------
    function onVis() {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
      else if (!raf && !dead) { lastFrame = 0; raf = requestAnimationFrame(frame); }
    }
    var resizeT = 0;
    function onResize() { clearTimeout(resizeT); resizeT = setTimeout(function () { if (!dead && !warp && size() && sys) genSystem(sys.seed, false, sys.side); }, 400); }

    size();
    root.classList.toggle('calm', calm);
    applyMood();
    var seedQ = /[?&]seed=(\d+)/.exec(location.search);   // testing: ?seed=123 pins the first system
    genSystem(seedQ ? +seedQ[1] : (R0() * 2147483647) | 0, false);
    tick();
    timers.push(setInterval(tick, 250));
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', onResize);
    raf = requestAnimationFrame(frame);

    return {
      destroy: function () {
        dead = true; cancelAnimationFrame(raf); raf = 0;
        timers.forEach(clearInterval); timers = []; clearTimeout(resizeT);
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('resize', onResize);
        bg = prevBg = null; P = null; moonSpr = null; rockSpr = []; fleet = null; warp = null;
        cv.width = cv.height = 1;
      },
      onPointer: function (nx, ny) { cam.tx = clamp(nx, -1, 1); cam.ty = clamp(ny, -1, 1); },
      onAction: function () {
        if (dead || warp) return;
        startWarp(calm || reduced ? 'drift' : 'jump');
      },
      onMinute: function () {
        if (dead) return;
        if (calm || reduced) { if (Math.random() < 0.5) startGlint(true); return; }
        if (Math.random() < 0.45) startComet(false); else startGlint(false);
      },
      onHour: function (d) {
        if (dead) return;
        if (calm || reduced) { if (!warp) startWarp('drift'); return; }
        var hh = api.pad(d.getHours()) + ':00';
        if (d.getHours() % 2 === 0 && !warp) { pendingFleet = true; startWarp('jump'); banner('JUMP  ·  ' + hh); }
        else { startFleet(true); banner('FLEET ARRIVAL  ·  ' + hh); }
      },
    };
  }

  window.Themes.cosmic = { title: 'Cosmic Saga', create: create };
})();
