/* Cyber District: an original neon megacity in the rain, drawn procedurally.
   Layers: low-res sky (gradient, glow, drifting smog, lightning) -> far / mid / near skylines
   (pre-rendered "lit" and "dark" copies; windows, signs and beacons flicker by redrawing small
   rects) -> fog bands -> flying traffic -> wet street with rippled reflections -> rain, drone, HUD.
   Font: Orbitron (fonts/Cyber-Orbitron.woff2), Copyright 2018 The Orbitron Project Authors,
   SIL Open Font License 1.1, latin subset from Google Fonts.
   All names, brands and glyphs below are invented. Nothing here is real data. */
(function () {
  'use strict';

  // ---------------------------------------------------------------- palettes
  var PAL = {
    night: {
      sky: ['#010208', '#070b25', '#2a1146'], glow: ['#ff2bd6', '#139dff'], glowA: 0.62,
      cloud: '#2e1f5c', under: '#ff3bc8', cloudA: 0.55,
      L: [['#1d2350', '#151a3a'], ['#0c0f28', '#070811'], ['#07080f', '#020204']],
      glass: '#222c60', haze: '#2a2462',
      rim: ['#2be8ff', '#ff3bd4'],
      win: ['#8ff3ff', '#ffd08a', '#ff8be0', '#e8f0ff', '#7fb2ff', '#ffe9a8'],
      lit: 0.4, neonA: 1,
      neon: ['#ff2bd6', '#22f2ff', '#ffe347', '#9b6bff', '#ff4d6d', '#3dffa8'],
      fog: '#4b3396', fogA: 0.3,
      rain: '#a9ccff',
      street: ['#0d0c22', '#020206'],
      hud: ['#eafeff', '#25f0ff', '#ff2bd6'],
      orb: { kind: 'moon', x: 0.83, y: 0.13, r: 0.016, c: '#d6e4ff' },
      beam: '#c6ecff', bolt: true, label: 'NIGHT CYCLE'
    },
    dusk: {
      sky: ['#13072a', '#5e1756', '#ff6d3f'], glow: ['#ff5a2b', '#ff2bd6'], glowA: 0.6,
      cloud: '#4a1a50', under: '#ff7a4a', cloudA: 0.6,
      L: [['#5a2a5c', '#3c1a44'], ['#24102f', '#12071c'], ['#0d0614', '#040207']],
      glass: '#4a2050', haze: '#b8456a',
      rim: ['#ff9a3c', '#ff2bd6'],
      win: ['#ffcf7a', '#ff9f5a', '#ffe6b0', '#ff7ad1', '#8ff3ff'],
      lit: 0.3, neonA: 1,
      neon: ['#ff2bd6', '#22f2ff', '#ffb02e', '#a66bff', '#ff4d6d', '#ffe347'],
      fog: '#d0507a', fogA: 0.24,
      rain: '#ffc4d4',
      street: ['#1c0a20', '#050208'],
      hud: ['#fff3ea', '#ff4fb0', '#ffb347'],
      orb: { kind: 'sun', x: 0.6, y: 0.74, r: 0.05, c: '#ffb070' },
      beam: '#ffd9c2', bolt: true, label: 'DUSK CYCLE'
    },
    day: {
      sky: ['#46525e', '#7c878a', '#b9b49b'], glow: ['#f2e8b8', '#9fe6ff'], glowA: 0.35,
      cloud: '#5b6670', under: '#c9c2a2', cloudA: 0.65,
      L: [['#7a838e', '#6c7580'], ['#3c4652', '#2b333d'], ['#1b2028', '#0d1015']],
      glass: '#56626e', haze: '#a7aea6',
      rim: ['#e2f6ff', '#ffd1ee'],
      win: ['#fff6d8', '#d8f4ff', '#ffe9b8'],
      lit: 0.1, neonA: 0.8,
      neon: ['#ff3fb4', '#18d8f0', '#ffd23a', '#8f6bff', '#ff5a6e', '#2fe8a0'],
      fog: '#c8ccc6', fogA: 0.3,
      rain: '#e6eef6',
      street: ['#353d45', '#14181c'],
      hud: ['#ffffff', '#12d9f5', '#ff2e9e'],
      orb: { kind: 'haze', x: 0.28, y: 0.16, r: 0.09, c: '#fff8e0' },
      beam: '#ffffff', bolt: true, label: 'DAY CYCLE · SMOG VEIL'
    },
    dawn: {
      sky: ['#121834', '#5a4a7e', '#eb9c86'], glow: ['#ff9a7a', '#7ad8ff'], glowA: 0.45,
      cloud: '#3c3460', under: '#ffa48a', cloudA: 0.6,
      L: [['#5d5478', '#463e62'], ['#272644', '#18172d'], ['#0f0f1d', '#06060d']],
      glass: '#3a3860', haze: '#a87a9a',
      rim: ['#ffb08a', '#7ae8ff'],
      win: ['#ffd9a0', '#bfefff', '#ffb3d0', '#fff1d6'],
      lit: 0.22, neonA: 0.9,
      neon: ['#ff4fc0', '#3ae6ff', '#ffc65a', '#9b7bff', '#ff6d7d', '#5dffb5'],
      fog: '#e09ab0', fogA: 0.26,
      rain: '#e2d8f4',
      street: ['#1e1a32', '#08070f'],
      hud: ['#fff4ee', '#ff7aa8', '#6ff0ff'],
      orb: { kind: 'sun', x: 0.16, y: 0.8, r: 0.045, c: '#ffc3a0' },
      beam: '#fff0e6', bolt: false, label: 'DAWN CYCLE'
    }
  };
  var BRANDS = ['NULLSPRING', 'HYPERMILK', 'VOXA SLEEP', 'ORBIT NOODLE', 'KILOWATT TEA', 'PALE ARCADE'];
  var TAGS = ['DRINK THE STATIC', 'DREAM AT 8K', 'OPEN ALL CYCLES', 'NOW WITH MORE RAIN', 'BREW THE GRID', 'INSERT SOUL TO CONTINUE'];
  var ORB = "'CyberOrbitron', 'IBM Plex Mono', monospace";
  var MONO = "'IBM Plex Mono', monospace";

  // ---------------------------------------------------------------- helpers
  function hex(c) { c = c.replace('#', ''); return [parseInt(c.substr(0, 2), 16), parseInt(c.substr(2, 2), 16), parseInt(c.substr(4, 2), 16)]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a == null ? 1 : +a.toFixed(3)) + ')'; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function mkCanvas(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function prep(src) {
    var P = {}, k;
    for (k in src) P[k] = src[k];
    P.sky = src.sky.map(hex); P.glow = src.glow.map(hex); P.cloud = hex(src.cloud); P.under = hex(src.under);
    P.L = src.L.map(function (p) { return [hex(p[0]), hex(p[1])]; });
    P.glass = hex(src.glass); P.haze = hex(src.haze); P.rim = src.rim.map(hex); P.win = src.win.map(hex);
    P.neonS = src.neon; P.neon = src.neon.map(hex); P.fog = hex(src.fog); P.rain = hex(src.rain);
    P.street = src.street.map(hex); P.beam = hex(src.beam);
    return P;
  }

  // Invented glyph alphabet: strokes on a 3x4 point grid.
  function makeGlyphs(R) {
    var out = [], g, k, j;
    for (g = 0; g < 48; g++) {
      var strokes = [];
      if (R() < 0.55) strokes.push(R() < 0.5 ? [[0.5, 0], [0.5, 1]] : [[0, 1 / 3], [1, 1 / 3]]);
      var n = 1 + ((R() * 3) | 0);
      for (k = 0; k < n; k++) {
        var p = [((R() * 3) | 0) / 2, ((R() * 4) | 0) / 3], pts = [p];
        var len = 1 + ((R() * 2) | 0);
        for (j = 0; j < len; j++) {
          var q = [clamp(p[0] + (((R() * 3) | 0) - 1) * 0.5, 0, 1), clamp(p[1] + (((R() * 3) | 0) - 1) / 3, 0, 1)];
          if (q[0] === p[0] && q[1] === p[1]) q = [1 - p[0], p[1]];
          pts.push(q); p = q;
        }
        strokes.push(pts);
      }
      if (R() < 0.3) strokes.push([[0.25, 1], [0.75, 1]]);
      out.push(strokes);
    }
    return out;
  }
  function glyphPath(ctx, g, x, y, w, h) {
    for (var s = 0; s < g.length; s++) {
      var pts = g[s];
      ctx.moveTo(x + pts[0][0] * w, y + pts[0][1] * h);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(x + pts[i][0] * w, y + pts[i][1] * h);
    }
  }

  // Icosahedron for the wireframe sculptures.
  var ICO = (function () {
    var t = (1 + Math.sqrt(5)) / 2, v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
    var n = Math.sqrt(1 + t * t), e = [], i, j;
    v = v.map(function (p) { return [p[0] / n, p[1] / n, p[2] / n]; });
    for (i = 0; i < 12; i++) for (j = i + 1; j < 12; j++) {
      var d = Math.pow(v[i][0] - v[j][0], 2) + Math.pow(v[i][1] - v[j][1], 2) + Math.pow(v[i][2] - v[j][2], 2);
      if (d < 1.2) e.push([i, j]);
    }
    return { v: v, e: e };
  })();
  function wire(ctx, cx, cy, r, a, b) {
    var ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), P2 = [];
    for (var i = 0; i < ICO.v.length; i++) {
      var p = ICO.v[i], x = p[0] * ca - p[2] * sa, z = p[0] * sa + p[2] * ca, y = p[1] * cb - z * sb, z2 = p[1] * sb + z * cb, s = 3 / (3 + z2);
      P2.push([cx + x * r * s, cy + y * r * s]);
    }
    ctx.beginPath();
    for (i = 0; i < ICO.e.length; i++) { var A = P2[ICO.e[i][0]], B = P2[ICO.e[i][1]]; ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); }
    ctx.stroke();
  }

  var CSS = [
    "@font-face{font-family:'CyberOrbitron';font-style:normal;font-weight:400 900;font-display:block;src:url('fonts/Cyber-Orbitron.woff2') format('woff2');}",
    '.t-cyber{--m:#eafeff;--g:#25f0ff;--a:#ff2bd6;--sh:rgba(0,0,0,0);background:#000;overflow:hidden;font-family:' + MONO + ';color:var(--m);}',
    '.t-cyber .cy-world{position:absolute;left:0;top:0;width:100%;height:100%;}',
    '.t-cyber canvas{position:absolute;display:block;left:0;top:0;}',
    '.t-cyber .cy-l{will-change:transform;}',
    '.t-cyber .cy-fog{position:absolute;left:0;width:200vw;pointer-events:none;background-size:100vw 100%;background-repeat:repeat-x;will-change:transform;}',
    '.t-cyber .cy-hud{position:absolute;left:6vw;top:12.5vh;will-change:transform,opacity;white-space:nowrap;}',
    '.t-cyber .cy-hud:before{content:"";position:absolute;left:-8vw;top:-10vh;right:-8vw;bottom:-10vh;z-index:-1;background:radial-gradient(ellipse at 45% 50%,rgba(0,0,6,.55),rgba(0,0,6,.3) 45%,rgba(0,0,6,0) 72%);}',
    '.t-cyber .cy-k{position:absolute;width:2.6vw;height:2.6vw;border:0 solid var(--g);opacity:.75;}',
    '.t-cyber .cy-k1{left:-2.2vw;top:-2.6vh;border-left-width:.16vw;border-top-width:.16vw;}',
    '.t-cyber .cy-k2{right:-2.2vw;top:-2.6vh;border-right-width:.16vw;border-top-width:.16vw;}',
    '.t-cyber .cy-k3{left:-2.2vw;bottom:-2.6vh;border-left-width:.16vw;border-bottom-width:.16vw;}',
    '.t-cyber .cy-k4{right:-2.2vw;bottom:-2.6vh;border-right-width:.16vw;border-bottom-width:.16vw;}',
    '.t-cyber .cy-tag{position:absolute;right:-2.2vw;top:-4.6vh;font-size:.75vw;letter-spacing:.35em;color:var(--g);opacity:.6;}',
    '.t-cyber .cy-head{font-size:1.15vw;letter-spacing:.34em;color:var(--g);margin-left:.5vw;text-shadow:0 0 .6em var(--g),0 0 .3em var(--sh);}',
    '.t-cyber .cy-tri{display:inline-block;width:0;height:0;border-left:.7vw solid transparent;border-bottom:.7vw solid var(--a);margin-right:.8vw;vertical-align:.05vw;}',
    '.t-cyber .cy-clock{position:relative;display:flex;align-items:flex-end;margin-top:.4vh;}',
    ".t-cyber .cy-tw{position:relative;font-family:" + ORB + ";font-weight:800;font-size:13.6vw;line-height:1.02;letter-spacing:.01em;}",
    '.t-cyber .cy-t{display:block;white-space:nowrap;}',
    '.t-cyber .cy-tm{position:relative;color:var(--m);text-shadow:0 0 .03em #fff,0 0 .1em var(--g),0 0 .32em var(--g),0 .02em .25em var(--sh);}',
    '.t-cyber .cy-tr,.t-cyber .cy-tc{position:absolute;left:0;top:0;opacity:.75;}',
    '.t-cyber .cy-tr{color:#ff1f5a;transform:translateX(-.028em);}',
    '.t-cyber .cy-tc{color:#00e8ff;transform:translateX(.028em);}',
    '.t-cyber .cy-gb{position:absolute;left:0;height:.06em;width:100%;opacity:0;}',
    ".t-cyber .cy-sec{font-family:" + ORB + ";font-weight:700;font-size:3.6vw;line-height:1;color:var(--a);margin:0 0 2.3vw 1.6vw;width:6.2vw;text-shadow:0 0 .25em var(--a),0 0 .3em var(--sh);}",
    '.t-cyber .cy-sl{display:block;font-family:' + MONO + ';font-size:.8vw;letter-spacing:.4em;color:var(--g);opacity:.8;margin-bottom:.8vh;text-shadow:none;}',
    '.t-cyber .cy-bar{display:flex;margin:.6vh 0 0 .6vw;}',
    '.t-cyber .cy-bar i{display:block;width:.52vw;height:.75vh;margin-right:.33vw;background:var(--g);opacity:.16;}',
    '.t-cyber .cy-bar i:nth-child(5n){height:1.3vh;}',
    '.t-cyber .cy-bar i.on{opacity:.8;}',
    '.t-cyber .cy-bar i.now{background:var(--a);opacity:1;box-shadow:0 0 .6vw var(--a);}',
    '.t-cyber .cy-date{margin:2vh 0 0 .5vw;font-size:2vw;letter-spacing:.24em;color:var(--m);text-shadow:0 0 .5em var(--g),0 0 .3em var(--sh);}',
    '.t-cyber .cy-date b{color:var(--a);font-weight:400;text-shadow:0 0 .5em var(--a),0 0 .3em var(--sh);}',
    '.t-cyber .cy-alert{margin:1.3vh 0 0 .55vw;font-size:.95vw;letter-spacing:.34em;color:var(--g);opacity:.75;text-shadow:0 0 .3em var(--sh);}',
    '.t-cyber .cy-alert span{display:inline-block;width:.6vw;height:.6vw;background:var(--g);margin-right:.8vw;box-shadow:0 0 .5vw var(--g);}',
    '.t-cyber.cy-emp .cy-alert{color:#ff3b5c;opacity:1;}',
    '.t-cyber.cy-emp .cy-alert span{background:#ff3b5c;box-shadow:0 0 .6vw #ff3b5c;}',
    '.t-cyber .cy-ticker{position:absolute;left:0;width:100%;bottom:2.4vh;height:3.6vh;overflow:hidden;border-top:1px solid rgba(255,255,255,.12);border-bottom:1px solid rgba(255,255,255,.08);background:linear-gradient(90deg,rgba(0,0,0,.6),rgba(0,0,0,.28) 30%,rgba(0,0,0,.28) 70%,rgba(0,0,0,.6));will-change:transform;}',
    '.t-cyber .cy-tk{position:absolute;left:0;top:0;white-space:nowrap;font-size:1.2vw;line-height:3.6vh;letter-spacing:.22em;color:var(--g);opacity:.85;will-change:transform;}',
    '.t-cyber .cy-tl{position:absolute;left:0;top:0;height:100%;padding:0 1.4vw 0 6vw;font-size:1vw;line-height:3.6vh;letter-spacing:.3em;color:#000;background:var(--g);font-weight:400;}',
    '.t-cyber .cy-tl:after{content:"";position:absolute;right:-1.8vh;top:0;border-left:1.8vh solid var(--g);border-top:1.8vh solid transparent;border-bottom:1.8vh solid transparent;}',
    ".t-cyber .cy-ban{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);font-family:" + ORB + ";font-weight:800;font-size:4.2vw;letter-spacing:.22em;padding:2.4vh 3.2vw 2.2vh 3.6vw;color:var(--m);border:.16vw solid var(--g);background:rgba(0,8,16,.62);text-shadow:0 0 .2em var(--g),0 0 .6em var(--g);opacity:0;white-space:nowrap;text-align:center;}",
    '.t-cyber .cy-ban small{display:block;font-family:' + MONO + ';font-weight:400;font-size:1vw;letter-spacing:.5em;color:var(--g);margin-top:1.2vh;text-shadow:none;}',
    '.t-cyber .cy-ov{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;background:repeating-linear-gradient(to bottom,rgba(0,0,0,0) 0,rgba(0,0,0,0) 2px,rgba(0,0,0,.14) 3px),radial-gradient(ellipse at 50% 46%,rgba(0,0,0,0) 52%,rgba(0,0,0,.6) 100%);}',
    '.t-cyber .cy-dim{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;background:rgba(0,0,8,.32);display:none;}'
  ].join('\n');

  // ---------------------------------------------------------------- theme
  function create(root, api) {
    root.classList.add('t-cyber');
    var alive = true, raf = 0, lastFrame = 0, T = 0, fc = 0;
    var R = api.rng(20771);            // layout: same city every time
    var rnd = api.rng();               // runtime randomness
    var iw = root.clientWidth || window.innerWidth || 1920;
    var ih = root.clientHeight || window.innerHeight || 1080;
    var W = 1920, H = clamp(Math.round(W * ih / iw), 700, 1500), HZ = Math.round(H * 0.83);
    var K = iw / W;                    // CSS px per design px
    var moodName = api.mood(), P = prep(PAL[moodName]);
    var calm = api.calm(), reduced = !!api.reduced, gentle = calm || reduced;
    var GLYPHS = makeGlyphs(R);

    function el(tag, cls, parent) { var e = document.createElement(tag); if (cls) e.className = cls; (parent || root).appendChild(e); return e; }
    var style = el('style'); style.textContent = CSS;
    var world = el('div', 'cy-world');

    // ---------------- sky (low-res; CSS scales it up, which doubles as haze)
    var SW = 480, SH = Math.round(480 * H / W);
    var sky = mkCanvas(SW, SH); world.appendChild(sky); sky.style.width = '100vw'; sky.style.height = '100vh';
    var sctx = sky.getContext('2d');
    var skyBase = mkCanvas(SW, SH), skyGlow = mkCanvas(SW, SH), cloudTex = mkCanvas(SW * 2, Math.round(SH * 0.72));
    var glowK = 1, flash = 0, nextBolt = 40 + rnd() * 60, bolt = null;

    function renderSky() {
      var c = skyBase.getContext('2d'), hz = HZ / H * SH, R2 = api.rng(331), i;
      var g = c.createLinearGradient(0, 0, 0, SH);
      g.addColorStop(0, rgba(P.sky[0])); g.addColorStop(hz / SH * 0.55, rgba(P.sky[1])); g.addColorStop(hz / SH, rgba(P.sky[2])); g.addColorStop(1, rgba(P.sky[2]));
      c.fillStyle = g; c.fillRect(0, 0, SW, SH);
      var o = P.orb, ox = o.x * SW, oy = o.y * SH, orr = o.r * SW, oc = hex(o.c);
      var rg = c.createRadialGradient(ox, oy, 0, ox, oy, orr * (o.kind === 'moon' ? 9 : 5));
      rg.addColorStop(0, rgba(oc, o.kind === 'haze' ? 0.55 : 0.5)); rg.addColorStop(0.3, rgba(oc, 0.14)); rg.addColorStop(1, rgba(oc, 0));
      c.fillStyle = rg; c.fillRect(0, 0, SW, SH);
      if (o.kind !== 'haze') { c.fillStyle = rgba(oc, o.kind === 'moon' ? 0.85 : 0.7); c.beginPath(); c.arc(ox, oy, orr, 0, 6.283); c.fill(); }
      if (o.kind === 'moon') { // faint, smog-dimmed stars
        for (i = 0; i < 40; i++) { c.fillStyle = 'rgba(220,230,255,' + (0.1 + R2() * 0.35).toFixed(2) + ')'; c.fillRect(R2() * SW, R2() * hz * 0.5, 1, 1); }
      }
      for (i = 0; i < 16; i++) { // smog bands
        var y = R2() * hz, x = R2() * SW, rx = 60 + R2() * 160;
        c.save(); c.translate(x, y); c.scale(1, 0.09 + R2() * 0.08);
        var bg = c.createRadialGradient(0, 0, 0, 0, 0, rx);
        var col = R2() < 0.5 ? P.cloud : mix(P.sky[2], P.cloud, 0.5);
        bg.addColorStop(0, rgba(col, 0.22)); bg.addColorStop(1, rgba(col, 0));
        c.fillStyle = bg; c.fillRect(-rx, -rx, rx * 2, rx * 2); c.restore();
      }
      // light pollution from the city, separate so the EMP can dim it
      var gc = skyGlow.getContext('2d'); gc.clearRect(0, 0, SW, SH);
      [[0.28, P.glow[0], 0.36], [0.72, P.glow[1], 0.32], [0.5, P.glow[0], 0.5]].forEach(function (q, k) {
        gc.save(); gc.translate(q[0] * SW, hz); gc.scale(1, k === 2 ? 0.25 : 0.45);
        var r = SW * q[2], gg = gc.createRadialGradient(0, 0, 0, 0, 0, r);
        gg.addColorStop(0, rgba(q[1], 0.7)); gg.addColorStop(0.5, rgba(q[1], 0.22)); gg.addColorStop(1, rgba(q[1], 0));
        gc.fillStyle = gg; gc.fillRect(-r, -r, r * 2, r * 2); gc.restore();
      });
      // drifting smog wisps, under-lit by the city (tileable, period SW)
      var cc = cloudTex.getContext('2d'), CH = cloudTex.height; cc.clearRect(0, 0, SW * 2, CH);
      for (i = 0; i < 30; i++) {
        var wx = R2() * SW, wy = CH * (0.1 + R2() * 0.9), wr = 40 + R2() * 110, sq = 0.1 + R2() * 0.14;
        var wc = mix(P.cloud, P.under, clamp(wy / CH, 0, 1) * 0.55), wa = P.cloudA * (0.25 + R2() * 0.6);
        for (var rep = -1; rep <= 2; rep++) {
          cc.save(); cc.translate(wx + rep * SW, wy); cc.scale(1, sq);
          var wg = cc.createRadialGradient(0, 0, 0, 0, 0, wr);
          wg.addColorStop(0, rgba(wc, wa)); wg.addColorStop(1, rgba(wc, 0));
          cc.fillStyle = wg; cc.fillRect(-wr, -wr, wr * 2, wr * 2); cc.restore();
        }
      }
    }
    function drawSky() {
      sctx.globalAlpha = 1; sctx.drawImage(skyBase, 0, 0);
      var off = (T * 2.2) % SW;
      sctx.drawImage(cloudTex, -off, 0);
      sctx.globalAlpha = clamp(P.glowA * glowK, 0, 1); sctx.drawImage(skyGlow, 0, 0);
      sctx.globalAlpha = 1;
      if (flash > 0.01) {
        sctx.fillStyle = 'rgba(205,215,255,' + (flash * 0.55).toFixed(3) + ')'; sctx.fillRect(0, 0, SW, HZ / H * SH);
        if (bolt && flash > 0.25) {
          sctx.strokeStyle = 'rgba(240,245,255,' + flash.toFixed(2) + ')'; sctx.lineWidth = 1;
          sctx.beginPath(); sctx.moveTo(bolt[0][0], bolt[0][1]);
          for (var i = 1; i < bolt.length; i++) sctx.lineTo(bolt[i][0], bolt[i][1]);
          sctx.stroke();
        }
      }
    }

    // ---------------- skyline layers
    var LC = [
      { amp: 0.02, s: 0.6, win: [3, 4, 3, 5], reg: 0.06, cam: 0.35 },
      { amp: 0.045, s: 0.85, win: [5, 7, 4, 7], reg: 0.25, cam: 0.6 },
      { amp: 0.085, s: 1, win: [8, 12, 6, 9], reg: 0.7, cam: 1 }
    ];
    var layers = LC.map(function (cfg, i) { return genLayer(i, cfg); });

    function makeBld(L, x, w, top, kind) {
      var b = { x: x, w: w, top: top, tiers: [], roof: null, ant: [], ws: (R() * 3) | 0, rim: R() < 0.5 ? 0 : 1, bright: 0.8 + R() * 0.4, pil: R() < 0.55 ? 5 + ((R() * 9) | 0) : 0, seed: (R() * 1e9) | 0, kind: kind || '' };
      var hTot = HZ - top, nt = kind ? 3 : R() < 0.45 ? 1 + ((R() * 2) | 0) : 0;
      var mainH = nt ? hTot * (0.6 + 0.18 * R()) : hTot, bx = x, bw = w, cy = HZ - mainH;
      b.tiers.push({ x: bx, w: bw, y: cy, b: HZ });
      for (var k = 0; k < nt; k++) {
        var nw = bw * (kind ? 0.78 : 0.55 + 0.3 * R()), nx = bx + (bw - nw) * (kind ? 0.5 : R()), nh = (cy - top) / (nt - k);
        b.tiers.push({ x: nx, w: nw, y: cy - nh, b: cy }); cy -= nh; bx = nx; bw = nw;
      }
      var tt = b.tiers[b.tiers.length - 1], r = R();
      if (kind === 'arco') b.roof = { t: 'spire', h: tt.w * 1.4 };
      else if (kind === 'tower') b.roof = { t: 'spire', h: tt.w * 0.9 };
      else if (r < 0.16 && L.i < 2) b.roof = { t: 'spire', h: tt.w * (0.3 + R() * 0.8) };
      else if (r < 0.3 && L.i < 2) b.roof = { t: 'slant', h: tt.w * (0.15 + R() * 0.25), d: R() < 0.5 };
      else if (r < 0.45) b.roof = { t: 'crown' };
      var sc = [0.5, 0.8, 1][L.i];
      if (R() < 0.45 || kind) {
        var na = kind ? 1 : 1 + ((R() * 2) | 0);
        for (k = 0; k < na; k++) {
          var ax = kind ? tt.x + tt.w / 2 : tt.x + tt.w * (0.15 + R() * 0.7), ah = (kind ? 60 : 18 + R() * 70) * sc;
          var ay = tt.y - ah - (b.roof && b.roof.t === 'spire' && kind ? b.roof.h : 0);
          b.ant.push({ x: ax, y: ay, h: ah });
          L.beacons.push({ x: ax, y: ay, r: 2.2 * sc + 0.6, per: 1.1 + R() * 1.8, ph: R() * 3, on: true });
        }
      }
      return b;
    }

    function genLayer(i, cfg) {
      var LW = Math.round(W * (1 + 2 * cfg.amp)), off0 = cfg.amp * W;
      var L = { i: i, cfg: cfg, amp: cfg.amp, s: cfg.s, LW: LW, off0: off0, blds: [], specials: [], wins: [], signs: [], beacons: [], bbs: [], neon: [], wires: [], shift: 0, shiftY: 0 };
      var x = -10, b, xn, bw, top;
      while (x < LW + 10) {
        xn = (x - off0) / W;
        if (i === 0) { bw = 24 + R() * 64; top = H * (0.3 + 0.3 * R()); if (R() < 0.12) top -= H * 0.08; }
        else if (i === 1) { bw = 60 + R() * 95; top = H * (0.32 + 0.3 * R()); if (R() < 0.15) top -= H * 0.1; }
        else if (xn < 0.07 || xn > 0.89) { bw = 220 + R() * 120; top = H * (0.03 + 0.14 * R()); }
        else { bw = 120 + R() * 140; top = H * (0.57 + 0.15 * R()); }
        b = makeBld(L, x, bw, top);
        L.blds.push(b);
        x += bw * (i === 0 ? 0.7 + 0.3 * R() : i === 1 ? 0.85 + 0.4 * R() : 0.95 + 0.25 * R());
      }
      if (i === 0) { // the arcology: a stepped spire far away
        b = makeBld(L, off0 + W * 0.3 - 75, 150, H * 0.16, 'arco'); L.specials.push(b);
        L.neon.push({ x1: b.tiers[1].x, y1: b.tiers[1].y + 6, x2: b.tiers[1].x + b.tiers[1].w, y2: b.tiers[1].y + 6, ci: 1, a: 0.55 });
        L.neon.push({ x1: b.tiers[2].x, y1: b.tiers[2].y + 6, x2: b.tiers[2].x + b.tiers[2].w, y2: b.tiers[2].y + 6, ci: 0, a: 0.55 });
      }
      if (i === 1) { // the sculpture tower
        b = makeBld(L, off0 + W * 0.7 - 70, 140, H * 0.36, 'tower'); L.specials.push(b);
        var t0 = b.tiers[0], t3 = b.tiers[b.tiers.length - 1];
        L.neon.push({ x1: t0.x + 3, y1: t0.y, x2: t0.x + 3, y2: HZ, ci: 1, a: 1 });
        L.neon.push({ x1: t0.x + t0.w - 3, y1: t0.y, x2: t0.x + t0.w - 3, y2: HZ, ci: 0, a: 1 });
        L.neon.push({ x1: t3.x, y1: t3.y + 4, x2: t3.x + t3.w, y2: t3.y + 4, ci: 1, a: 1 });
        L.tower = { cx: t3.x + t3.w / 2, top: t3.y - b.roof.h - 60 * 0.8 };
        var t1 = b.tiers[1];
        var tbh = Math.min(t1.b - t1.y - 28, (t1.w - 20) * 2);
        L.bbs.push({ x: t1.x + 10, y: t1.y + 14, w: t1.w - 20, h: tbh, vert: tbh > (t1.w - 20) * 1.3, ci: 1, cj: 0, br: 0, mode: 'brand', next: 6, mt: 0, boot: 0 });
      }
      // signs, neon trim, billboards
      var all = L.blds.concat(L.specials);
      all.forEach(function (b2) {
        var t0 = b2.tiers[0], sxn = (b2.x + b2.w / 2 - off0) / W;
        if (i > 0 && !b2.kind && R() < (i === 2 ? 0.75 : 0.42)) {
          var sw = i === 2 ? 26 + R() * 20 : 13 + R() * 10, sh = sw * (4 + R() * 5);
          var side = R() < 0.5, sx = side ? b2.x - sw * 0.35 : b2.x + b2.w - sw * 0.65;
          var sy = t0.y + 30 + R() * Math.max(0, HZ - t0.y - sh - 120);
          if (sy + sh < HZ - 20) L.signs.push({ x: sx, y: sy, w: sw, h: sh, v: true, ci: (R() * 6) | 0, g: (R() * 48) | 0, st: 0, next: 4 + R() * 30, until: 0, on: true });
        }
        if (i > 0 && !b2.kind && R() < 0.35 && b2.w > 70) {
          var hw = b2.w * (0.45 + R() * 0.3), hh = Math.max(10, hw * 0.2), hx = b2.x + (b2.w - hw) * R(), hy = t0.y + 20 + R() * Math.max(0, (HZ - t0.y) * 0.5);
          if (hy + hh < HZ - 30) L.signs.push({ x: hx, y: hy, w: hw, h: hh, v: false, ci: (R() * 6) | 0, g: (R() * 48) | 0, st: 0, next: 4 + R() * 30, until: 0, on: true });
        }
        if (!b2.kind && R() < [0.12, 0.3, 0.45][i]) {
          var ci = (R() * 6) | 0, tt = b2.tiers[b2.tiers.length - 1];
          if (R() < 0.5) L.neon.push({ x1: tt.x, y1: tt.y + 2, x2: tt.x + tt.w, y2: tt.y + 2, ci: ci, a: i === 0 ? 0.5 : 1 });
          else { var ex = R() < 0.5 ? t0.x + 2 : t0.x + t0.w - 2; L.neon.push({ x1: ex, y1: t0.y + 10, x2: ex, y2: t0.y + 10 + (HZ - t0.y) * (0.3 + R() * 0.5), ci: ci, a: i === 0 ? 0.5 : 1 }); }
        }
        // billboards: mid on wide buildings, near only right of the clock
        var want = i === 1 ? 4 : i === 2 ? 2 : 0, ttop = b2.tiers[b2.tiers.length - 1];
        if (!b2.kind && L.bbs.length < want && b2.w > (i === 2 ? 150 : 68) && (!b2.roof || b2.roof.t !== 'spire') && ttop.w > (i === 2 ? 120 : 60) && (i === 1 ? sxn > 0.63 && sxn < 0.97 && Math.abs(sxn - 0.7) > 0.06 && b2.top > H * 0.33 : sxn > 0.5 && sxn < 0.88 && Math.abs(sxn - 0.7) > 0.08)) {
          var far = L.bbs.every(function (o) { return Math.abs(o.x - b2.x) > (i === 2 ? 380 : 230); });
          if (far) { // rooftop billboard on struts
            var vert = i === 1 && R() < 0.25, bw2 = vert ? 70 : i === 2 ? 210 + R() * 50 : 150 + R() * 60, bh2 = vert ? 160 : bw2 * (0.48 + R() * 0.1);
            var by = ttop.y - (b2.roof && b2.roof.t === 'slant' ? b2.roof.h : 0) - bh2 - (i === 2 ? 26 : 16);
            if (by > H * 0.2) L.bbs.push({ x: b2.x + (b2.w - bw2) / 2, y: by, w: bw2, h: bh2, roofY: ttop.y, vert: vert, ci: (R() * 6) | 0, cj: (R() * 6) | 0, br: (R() * BRANDS.length) | 0, mode: 'brand', next: 3 + R() * 8, mt: 0, boot: 0 });
          }
        }
      });
      if (i === 2) { // cables between near rooftops
        for (var k = 0; k < 5; k++) { var x1 = R() * LW, x2 = x1 + 200 + R() * 400, y1 = H * (0.55 + R() * 0.15); L.wires.push([x1, y1, x2, y1 + (R() - 0.5) * 40, 25 + R() * 50]); }
      }
      // DOM canvas
      var cw = Math.ceil(LW * cfg.s), ch = Math.ceil(HZ * cfg.s);
      L.cv = mkCanvas(cw, ch); L.cv.className = 'cy-l';
      L.cv.style.left = (-cfg.amp * 100) + 'vw'; L.cv.style.width = ((1 + 2 * cfg.amp) * 100) + 'vw'; L.cv.style.height = (HZ / H * 100) + 'vh';
      L.ctx = L.cv.getContext('2d');
      L.lit = mkCanvas(cw, ch); L.dark = mkCanvas(cw, ch);
      return L;
    }

    function bodyAt(b, pc, y) { var t = clamp((y - b.top) / (HZ - b.top), 0, 1); return mix(mix(pc[0], pc[1], t), [0, 0, 0], 1 - b.bright > 0 ? (1 - b.bright) * 0.6 : 0); }

    function drawBody(ctx, L, b, mode) {
      var pc = P.L[L.i], c0 = bodyAt(b, pc, b.top), c1 = bodyAt(b, pc, HZ);
      if (b.bright > 1) { c0 = mix(c0, [255, 255, 255], (b.bright - 1) * 0.12); }
      var g = ctx.createLinearGradient(0, b.top, 0, HZ); g.addColorStop(0, rgba(c0)); g.addColorStop(1, rgba(c1));
      ctx.fillStyle = g;
      var i, t, tt = b.tiers[b.tiers.length - 1];
      for (i = 0; i < b.tiers.length; i++) { t = b.tiers[i]; ctx.fillRect(t.x, t.y, t.w, t.b - t.y + 1); }
      if (b.roof) {
        ctx.beginPath();
        if (b.roof.t === 'spire') { ctx.moveTo(tt.x, tt.y + 1); ctx.lineTo(tt.x + tt.w / 2, tt.y - b.roof.h); ctx.lineTo(tt.x + tt.w, tt.y + 1); ctx.fill(); }
        else if (b.roof.t === 'slant') { if (b.roof.d) { ctx.moveTo(tt.x, tt.y + 1); ctx.lineTo(tt.x, tt.y - b.roof.h); ctx.lineTo(tt.x + tt.w, tt.y + 1); } else { ctx.moveTo(tt.x, tt.y + 1); ctx.lineTo(tt.x + tt.w, tt.y - b.roof.h); ctx.lineTo(tt.x + tt.w, tt.y + 1); } ctx.fill(); }
        else if (b.roof.t === 'crown') { ctx.fillRect(tt.x + tt.w * 0.1, tt.y - tt.w * 0.12, tt.w * 0.25, tt.w * 0.12); ctx.fillRect(tt.x + tt.w * 0.55, tt.y - tt.w * 0.2, tt.w * 0.3, tt.w * 0.2); }
      }
      ctx.fillStyle = rgba(c0);
      for (i = 0; i < b.ant.length; i++) ctx.fillRect(b.ant[i].x - 0.75, b.ant[i].y, 1.5, b.ant[i].h + 2);
      if (b.pil && L.i > 0) { // facade ribs
        ctx.fillStyle = 'rgba(255,255,255,0.025)';
        for (i = 0; i < b.tiers.length; i++) { t = b.tiers[i]; for (var px = t.x + b.pil * 2; px < t.x + t.w - 2; px += b.pil * 3) ctx.fillRect(px, t.y, 1, t.b - t.y); }
      }
      // rim light from the neon sky
      var rc = P.rim[b.rim], rg = ctx.createLinearGradient(0, b.top, 0, HZ);
      rg.addColorStop(0, rgba(rc, L.i === 0 ? 0.18 : 0.42)); rg.addColorStop(0.5, rgba(rc, 0.08)); rg.addColorStop(1, rgba(rc, 0));
      ctx.fillStyle = rg;
      for (i = 0; i < b.tiers.length; i++) { t = b.tiers[i]; ctx.fillRect(b.rim ? t.x + t.w - 2 : t.x, t.y, 2, t.b - t.y); ctx.fillRect(t.x, t.y, t.w, 1.5); }
      drawWindows(ctx, L, b, mode);
    }

    function drawWindows(ctx, L, b, mode) {
      var wr = api.rng(b.seed), cw = L.cfg.win, ww = cw[0], wh = cw[1], gx = cw[2], gy = cw[3];
      var pc = P.L[L.i], nwc = P.win.length, regP = L.cfg.reg;
      var dayK = moodName === 'day' ? 0.45 : 0;
      for (var ti = 0; ti < b.tiers.length; ti++) {
        var t = b.tiers[ti], th = t.b - t.y;
        if (t.w < ww * 3 || th < wh * 3) continue;
        var wW = b.ws === 1 ? ww * 3 + gx * 2 : b.ws === 2 ? Math.max(2, ww * 0.55) : ww, wH = b.ws === 2 ? wh * 1.6 : wh;
        var mX = Math.max(gx, t.w * 0.08), mY = gy * 1.5;
        var cols = Math.floor((t.w - 2 * mX + gx) / (wW + gx)), rows = Math.floor((th - 2 * mY + gy) / (wH + gy));
        if (cols < 1 || rows < 1) continue;
        var x0 = t.x + (t.w - (cols * (wW + gx) - gx)) / 2;
        for (var r = 0; r < rows; r++) {
          var y = t.y + mY + r * (wH + gy), f = wr() < 0.28 ? 0.12 : 0.5 + wr() * 1.3;
          var offC = mix(bodyAt(b, pc, y), P.glass, 0.25), off = rgba(offC);
          for (var c = 0; c < cols; c++) {
            var q = wr(), ci = (wr() * 97) | 0, v = wr(), reg = wr() < regP;
            var x = x0 + c * (wW + gx), on = q < P.lit * f;
            var lc = P.win[ci % nwc];
            if (L.i === 0) lc = mix(lc, P.haze, 0.35);
            lc = rgba(mix(lc, offC, v * 0.4 + dayK));
            ctx.fillStyle = mode === 1 && on ? lc : off;
            ctx.fillRect(x, y, wW, wH);
            if (mode === 1 && reg) L.wins.push({ x: x, y: y, w: wW, h: wH, c: lc, o: off, on: on, f: f });
          }
        }
      }
    }

    function drawSign(ctx, sg, on) {
      var col = P.neonS[sg.ci], lw = Math.max(1, (sg.v ? sg.w : sg.h) * 0.07);
      ctx.shadowBlur = 0;
      ctx.fillStyle = on ? 'rgba(6,3,14,0.88)' : 'rgba(9,9,13,0.95)';
      ctx.fillRect(sg.x, sg.y, sg.w, sg.h);
      ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (on) { ctx.shadowColor = col; ctx.shadowBlur = Math.max(6, lw * 7); ctx.strokeStyle = col; ctx.globalAlpha = P.neonA; }
      else ctx.strokeStyle = 'rgba(70,70,84,0.55)';
      ctx.strokeRect(sg.x + lw, sg.y + lw, sg.w - lw * 2, sg.h - lw * 2);
      ctx.beginPath();
      var n, k, gs;
      if (sg.v) { gs = sg.w * 0.56; n = Math.floor((sg.h - sg.w * 0.4) / (gs * 1.35)); for (k = 0; k < n; k++) glyphPath(ctx, GLYPHS[(sg.g + k * 7) % 48], sg.x + sg.w * 0.22, sg.y + sg.w * 0.3 + k * gs * 1.35, gs, gs * 1.1); }
      else { gs = sg.h * 0.52; n = Math.floor((sg.w - sg.h * 0.4) / (gs * 1.1)); for (k = 0; k < n; k++) glyphPath(ctx, GLYPHS[(sg.g + k * 5) % 48], sg.x + sg.h * 0.3 + k * gs * 1.1, sg.y + sg.h * 0.24, gs * 0.8, gs); }
      ctx.stroke();
      if (on) { ctx.shadowBlur = 0; ctx.lineWidth = lw * 0.45; ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    function drawCity(ctx, L, mode) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, L.cv.width, L.cv.height);
      ctx.setTransform(L.s, 0, 0, L.s, 0, 0);
      var i, all = L.blds.concat(L.specials);
      for (i = 0; i < all.length; i++) drawBody(ctx, L, all[i], mode);
      // cables
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1.5;
      for (i = 0; i < L.wires.length; i++) { var w = L.wires[i]; ctx.beginPath(); ctx.moveTo(w[0], w[1]); ctx.quadraticCurveTo((w[0] + w[2]) / 2, Math.max(w[1], w[3]) + w[4], w[2], w[3]); ctx.stroke(); }
      if (mode === 1) {
        ctx.lineCap = 'round';
        for (i = 0; i < L.neon.length; i++) {
          var n = L.neon[i], col = P.neonS[n.ci];
          ctx.globalAlpha = n.a * P.neonA; ctx.shadowColor = col; ctx.shadowBlur = L.i === 0 ? 4 : 10; ctx.strokeStyle = col; ctx.lineWidth = L.i === 0 ? 1.5 : 2.2;
          ctx.beginPath(); ctx.moveTo(n.x1, n.y1); ctx.lineTo(n.x2, n.y2); ctx.stroke();
        }
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      }
      for (i = 0; i < L.signs.length; i++) drawSign(ctx, L.signs[i], mode === 1);
      for (i = 0; i < L.beacons.length; i++) {
        var bc = L.beacons[i];
        if (mode === 1) { ctx.shadowColor = '#ff2040'; ctx.shadowBlur = bc.r * 4; ctx.fillStyle = '#ff5a6a'; }
        else { ctx.shadowBlur = 0; ctx.fillStyle = '#2a0a10'; }
        ctx.beginPath(); ctx.arc(bc.x, bc.y, bc.r, 0, 6.283); ctx.fill();
      }
      ctx.shadowBlur = 0;
      for (i = 0; i < L.bbs.length; i++) {
        var bb = L.bbs[i];
        ctx.fillStyle = '#030306'; ctx.fillRect(bb.x - 4, bb.y - 4, bb.w + 8, bb.h + 8);
        if (bb.roofY) { // struts and catwalk
          ctx.fillStyle = rgba(mix(P.L[L.i][0], [0, 0, 0], 0.4));
          ctx.fillRect(bb.x + bb.w * 0.18, bb.y + bb.h, 4, bb.roofY - bb.y - bb.h + 2); ctx.fillRect(bb.x + bb.w * 0.8, bb.y + bb.h, 4, bb.roofY - bb.y - bb.h + 2);
          ctx.fillRect(bb.x + bb.w * 0.5, bb.y + bb.h, 3, bb.roofY - bb.y - bb.h + 2); ctx.fillRect(bb.x - 6, bb.y + bb.h + 6, bb.w + 12, 2);
        }
        if (mode === 1) { ctx.shadowColor = P.neonS[bb.ci]; ctx.shadowBlur = 26; ctx.strokeStyle = rgba(P.neon[bb.ci], 0.75 * P.neonA); ctx.lineWidth = 2; ctx.strokeRect(bb.x - 2, bb.y - 2, bb.w + 4, bb.h + 4); ctx.shadowBlur = 0; }
        else { ctx.strokeStyle = '#16161e'; ctx.lineWidth = 2; ctx.strokeRect(bb.x - 2, bb.y - 2, bb.w + 4, bb.h + 4); }
        ctx.fillStyle = '#020204'; ctx.fillRect(bb.x, bb.y, bb.w, bb.h);
      }
    }

    function renderLayer(L) {
      L.wins = [];
      drawCity(L.lit.getContext('2d'), L, 1);
      drawCity(L.dark.getContext('2d'), L, 2);
      L.ctx.setTransform(1, 0, 0, 1, 0, 0); L.ctx.clearRect(0, 0, L.cv.width, L.cv.height); L.ctx.drawImage(L.lit, 0, 0);
      L.signs.forEach(function (s) { s.on = true; s.st = 0; });
      L.beacons.forEach(function (b) { b.on = true; });
    }
    function blit(L, src, x, y, w, h) {
      var s = L.s, X = Math.max(0, Math.floor(x * s)), Y = Math.max(0, Math.floor(y * s));
      var X2 = Math.min(L.cv.width, Math.ceil((x + w) * s)), Y2 = Math.min(L.cv.height, Math.ceil((y + h) * s));
      if (X2 <= X || Y2 <= Y) return;
      L.ctx.setTransform(1, 0, 0, 1, 0, 0);
      L.ctx.clearRect(X, Y, X2 - X, Y2 - Y);
      L.ctx.drawImage(src, X, Y, X2 - X, Y2 - Y, X, Y, X2 - X, Y2 - Y);
    }

    // ---------------- billboards (painted live into the layer canvas)
    var scanPat = (function () { var c = mkCanvas(1, 3), x = c.getContext('2d'); x.fillStyle = 'rgba(0,0,0,0.38)'; x.fillRect(0, 2, 1, 1); return c; })();
    var scanFill = null;
    var hourEv = null, emp = null;
    var MODES_H = ['brand', 'geo', 'eq', 'brand', 'eye', 'glyph'], MODES_V = ['brand', 'glyph', 'eye', 'eq'];

    function paintBB(L, bb) {
      var ctx = L.ctx; ctx.setTransform(L.s, 0, 0, L.s, 0, 0);
      var x = bb.x, y = bb.y, w = bb.w, h = bb.h, c1 = P.neon[bb.ci], c2 = P.neon[bb.cj === bb.ci ? (bb.ci + 2) % 6 : bb.cj];
      var mode = bb.mode, k, i, n;
      if (hourEv && T - hourEv.t0 > 0.6 && T - hourEv.t0 < 12.5) mode = 'sync';
      if (bb.boot > 0) mode = 'boot';
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      var tm = T - bb.mt;
      if (mode === 'brand') {
        var g = ctx.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, rgba(mix(c1, [0, 0, 0], 0.55))); g.addColorStop(1, rgba(mix(c2, [0, 0, 0], 0.7)));
        ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        for (k = 0; k < 6; k++) { var sx = x + ((T * 30 + k * w / 6) % w); ctx.fillRect(sx, y, w / 22, h); }
        var name = BRANDS[bb.br], tag = TAGS[bb.br];
        ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
        var pulse = 0.85 + 0.15 * Math.sin(T * 5 + bb.x);
        if (!bb.vert) {
          var fs = Math.min(h * 0.34, w * 0.92 / (name.length * 0.95));
          ctx.font = '900 ' + fs.toFixed(1) + 'px ' + ORB;
          var ty = y + h * 0.42, slide = tm < 0.6 ? (1 - ease(tm / 0.6)) * w : 0;
          ctx.fillStyle = rgba(c2, 0.8); ctx.fillText(name, x + w / 2 + slide - fs * 0.06, ty);
          ctx.fillStyle = rgba(c1, 0.8); ctx.fillText(name, x + w / 2 + slide + fs * 0.06, ty);
          ctx.fillStyle = 'rgba(255,255,255,' + pulse.toFixed(2) + ')'; ctx.fillText(name, x + w / 2 + slide, ty);
          var ts = h * 0.1; ctx.font = ts.toFixed(1) + 'px ' + MONO; ctx.fillStyle = rgba(mix(c1, [255, 255, 255], 0.5), 0.9);
          ctx.textAlign = 'left';
          var tw2 = tag.length * ts * 0.62 + w * 0.4, mx = x + w - ((T * 40) % (tw2 + w));
          ctx.fillText(tag, mx, y + h * 0.75);
          ctx.fillStyle = rgba(c1, 0.9); ctx.fillRect(x + w * 0.1, y + h * 0.62, w * 0.8 * ((T * 0.3) % 1), Math.max(1.5, h * 0.015));
        } else {
          var vs = Math.min(w * 0.62, h * 0.86 / name.length);
          ctx.font = '900 ' + vs.toFixed(1) + 'px ' + ORB;
          for (i = 0; i < name.length; i++) {
            var lit = ((T * 6 + i) | 0) % (name.length + 4) !== i;
            ctx.fillStyle = lit ? 'rgba(255,255,255,' + pulse.toFixed(2) + ')' : rgba(c1, 0.5);
            ctx.fillText(name[i], x + w / 2, y + h * 0.07 + (i + 0.5) * vs * 1.0);
          }
        }
      } else if (mode === 'geo') {
        ctx.fillStyle = 'rgba(2,4,12,1)'; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = rgba(c2, 0.35); ctx.lineWidth = 1; ctx.beginPath();
        var hor = y + h * 0.62;
        for (k = 0; k < 7; k++) { var gy2 = hor + Math.pow(((k + (T * 0.8) % 1) / 7), 2) * (h * 0.4); ctx.moveTo(x, gy2); ctx.lineTo(x + w, gy2); }
        for (k = -6; k <= 6; k++) { ctx.moveTo(x + w / 2 + k * w * 0.04, hor); ctx.lineTo(x + w / 2 + k * w * 0.2, y + h); }
        ctx.stroke();
        ctx.lineWidth = 1.6; ctx.strokeStyle = rgba(c1, 0.95); wire(ctx, x + w / 2, y + h * 0.42, Math.min(w, h) * 0.3, T * 0.9, T * 0.5);
        ctx.lineWidth = 1; ctx.strokeStyle = rgba(c2, 0.7); wire(ctx, x + w / 2, y + h * 0.42, Math.min(w, h) * 0.16, -T * 1.4, T * 0.3);
      } else if (mode === 'eq') {
        ctx.fillStyle = rgba(mix(c2, [0, 0, 0], 0.85)); ctx.fillRect(x, y, w, h);
        n = bb.vert ? 10 : 22;
        for (k = 0; k < n; k++) {
          var lv = 0.15 + 0.85 * Math.abs(Math.sin(T * (2.1 + k * 0.37) + k) * Math.sin(T * 1.3 + k * 0.7));
          var g2 = ctx.createLinearGradient(0, y + h, 0, y);
          g2.addColorStop(0, rgba(c1, 0.95)); g2.addColorStop(1, rgba(c2, 0.95)); ctx.fillStyle = g2;
          if (!bb.vert) { var bwid = w / n; ctx.fillRect(x + k * bwid + bwid * 0.15, y + h * 0.88 - lv * h * 0.75, bwid * 0.7, lv * h * 0.75); }
          else { var bh = h / n; ctx.fillRect(x + w * 0.1, y + k * bh + bh * 0.2, lv * w * 0.8, bh * 0.6); }
        }
      } else if (mode === 'eye') {
        ctx.fillStyle = 'rgba(3,2,10,1)'; ctx.fillRect(x, y, w, h);
        var cx = x + w / 2, cy = y + h / 2, rr = Math.min(w, h) * 0.38, bl = Math.abs(Math.sin(T * 0.7)) > 0.97 ? 0.08 : 1;
        ctx.save(); ctx.translate(cx, cy); ctx.scale(1, bl);
        ctx.strokeStyle = rgba(c1, 0.9); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, rr, 0, 6.283); ctx.stroke();
        ctx.strokeStyle = rgba(c2, 0.85); ctx.lineWidth = 1;
        ctx.beginPath(); for (k = 0; k < 24; k++) { var a = k / 24 * 6.283 + T * 0.4; ctx.moveTo(Math.cos(a) * rr * 0.35, Math.sin(a) * rr * 0.35); ctx.lineTo(Math.cos(a) * rr * 0.82, Math.sin(a) * rr * 0.82); } ctx.stroke();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(Math.sin(T * 0.5) * rr * 0.15, 0, rr * 0.3, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(Math.sin(T * 0.5) * rr * 0.15 - rr * 0.1, -rr * 0.1, rr * 0.06, 0, 6.283); ctx.fill();
        ctx.restore();
      } else if (mode === 'glyph') {
        ctx.fillStyle = 'rgba(1,4,6,1)'; ctx.fillRect(x, y, w, h);
        var gs = Math.max(6, Math.min(w, h) * (bb.vert ? 0.18 : 0.11)), cols = Math.floor(w / (gs * 1.3));
        ctx.lineWidth = Math.max(1, gs * 0.1); ctx.lineCap = 'round';
        for (k = 0; k < cols; k++) {
          var sp = 0.8 + ((k * 37) % 10) / 6, head = ((T * sp * 3 + k * 1.7) % (h / (gs * 1.4) + 6)) | 0;
          for (i = Math.max(0, head - 6); i <= head; i++) {
            var gy3 = y + i * gs * 1.4; if (gy3 > y + h) continue;
            ctx.strokeStyle = i === head ? 'rgba(255,255,255,0.95)' : rgba(c1, 0.25 + 0.6 * (1 - (head - i) / 6));
            ctx.beginPath(); glyphPath(ctx, GLYPHS[(k * 11 + i * 7) % 48], x + k * gs * 1.3 + gs * 0.2, gy3, gs * 0.8, gs); ctx.stroke();
          }
        }
      } else if (mode === 'sync') {
        var beat = 0.5 + 0.5 * Math.cos((T - hourEv.t0) * 6.283 * 0.75), sc = P.neon[1];
        ctx.fillStyle = rgba(mix(sc, [0, 0, 0], 0.7 - beat * 0.25)); ctx.fillRect(x, y, w, h);
        var lbl = api.pad(hourEv.h) + ':00';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (!bb.vert) {
          ctx.font = '900 ' + Math.min(h * 0.5, w / 3.6).toFixed(1) + 'px ' + ORB; ctx.fillStyle = '#fff'; ctx.fillText(lbl, x + w / 2, y + h * 0.45);
          ctx.font = (h * 0.09).toFixed(1) + 'px ' + MONO; ctx.fillStyle = rgba(sc); ctx.fillText('HOUR SYNC // DISTRICT 7', x + w / 2, y + h * 0.82);
        } else {
          ctx.font = '900 ' + (w * 0.5).toFixed(1) + 'px ' + ORB; ctx.fillStyle = '#fff';
          ctx.fillText(api.pad(hourEv.h), x + w / 2, y + h * 0.35); ctx.fillText('00', x + w / 2, y + h * 0.62);
        }
      } else if (mode === 'boot') {
        ctx.fillStyle = '#020306'; ctx.fillRect(x, y, w, h);
        var pr = clamp(1 - bb.boot / 1.4, 0, 1);
        ctx.fillStyle = rgba(c1, 0.9); ctx.fillRect(x + w * 0.12, y + h * 0.6, w * 0.76 * pr, Math.max(2, h * 0.05));
        ctx.strokeStyle = rgba(c1, 0.5); ctx.lineWidth = 1; ctx.strokeRect(x + w * 0.12, y + h * 0.6, w * 0.76, Math.max(2, h * 0.05));
        ctx.font = (Math.min(w, h) * 0.12).toFixed(1) + 'px ' + MONO; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = rgba(c1); ctx.fillText('BOOT_' + ((pr * 100) | 0), x + w * 0.12, y + h * 0.42);
      }
      // mode-change interference
      if (tm < 0.35 && mode !== 'sync' && mode !== 'boot') {
        for (k = 0; k < 6; k++) { ctx.fillStyle = rnd() < 0.5 ? rgba(c1, 0.7) : 'rgba(255,255,255,0.5)'; ctx.fillRect(x + rnd() * w * 0.5, y + rnd() * h, w * (0.2 + rnd() * 0.6), 1 + rnd() * h * 0.06); }
      }
      if (!scanFill) scanFill = ctx.createPattern(scanPat, 'repeat');
      ctx.fillStyle = scanFill; ctx.fillRect(x, y, w, h);
      var gl = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
      gl.addColorStop(0, 'rgba(255,255,255,0.10)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)'); ctx.fillStyle = gl; ctx.fillRect(x, y, w, h);
      if (moodName === 'day') { ctx.fillStyle = 'rgba(150,160,160,0.18)'; ctx.fillRect(x, y, w, h); }
      ctx.restore();
    }

    // ---------------- EMP helpers
    var CHUNK = 48, BLOCK = 96;
    function lstate(L, x, y) {
      if (!emp) return 1;
      if (!L.dk[Math.floor(x / CHUNK)]) return 1;
      var bk = L.blk[Math.floor(x / BLOCK) * 3 + clamp(Math.floor(y / (HZ / 3)), 0, 2)];
      return bk && bk.st === 2 ? 1 : 0;
    }

    function updateLayers(dt) {
      var i, L, k;
      for (var li = 0; li < 3; li++) {
        L = layers[li];
        L.ctx.setTransform(L.s, 0, 0, L.s, 0, 0);
        // window flicker
        if (!emp && L.wins.length) {
          var rate = (gentle ? 0.12 : 1.1) * [0.3, 0.8, 1][li];
          var n = Math.floor(rate) + (rnd() < rate % 1 ? 1 : 0);
          for (k = 0; k < n; k++) {
            var w = L.wins[(rnd() * L.wins.length) | 0], want = rnd() < clamp(P.lit * w.f, 0.02, 0.95);
            if (want !== w.on) { w.on = want; L.ctx.fillStyle = want ? w.c : w.o; L.ctx.fillRect(w.x, w.y, w.w, w.h); }
          }
          if (!gentle && li > 0 && rnd() < 0.03) L.stut = { w: L.wins[(rnd() * L.wins.length) | 0], until: T + 0.4 + rnd() * 0.8 };
          if (L.stut) {
            var sw = L.stut.w, on = T > L.stut.until ? sw.on : rnd() < 0.5;
            L.ctx.fillStyle = on ? sw.c : sw.o; L.ctx.fillRect(sw.x, sw.y, sw.w, sw.h);
            if (T > L.stut.until) L.stut = null;
          }
        }
        // signs: buzz and fail
        if (!emp) for (i = 0; i < L.signs.length; i++) {
          var s = L.signs[i], wantOn = true;
          if (T > s.next && s.st === 0) {
            if (gentle) s.next = T + 1e9;
            else { var r = rnd(); s.st = r < 0.65 ? 1 : 2; s.until = T + (s.st === 1 ? 0.3 + rnd() * 1.1 : 1.5 + rnd() * 4); }
          }
          if (s.st === 1) wantOn = rnd() < 0.5;
          else if (s.st === 2) wantOn = rnd() < 0.03;
          if (s.st && T > s.until) { s.st = 0; s.next = T + 6 + rnd() * 34; wantOn = true; }
          if (wantOn !== s.on) { s.on = wantOn; var pd = (s.v ? s.w : s.h) * 0.5; blit(L, wantOn ? L.lit : L.dark, s.x - pd, s.y - pd, s.w + pd * 2, s.h + pd * 2); }
        }
        // beacons
        if (!emp) for (i = 0; i < L.beacons.length; i++) {
          var b = L.beacons[i], bon = ((T + b.ph) % b.per) < b.per * 0.22;
          if (bon !== b.on) { b.on = bon; blit(L, bon ? L.lit : L.dark, b.x - b.r * 5, b.y - b.r * 5, b.r * 10, b.r * 10); }
        }
        // billboards at ~15 fps
        if ((fc + li) % 2 === 0) for (i = 0; i < L.bbs.length; i++) {
          var bb = L.bbs[i];
          if (lstate(L, bb.x + bb.w / 2, bb.y + bb.h / 2) === 0) continue;
          if (bb.boot > 0) bb.boot -= 2 * dt;
          if (T > bb.next && !hourEv) {
            var ms = bb.vert ? MODES_V : MODES_H, nm = ms[(rnd() * ms.length) | 0];
            if (nm === 'brand') bb.br = (rnd() * BRANDS.length) | 0;
            bb.mode = nm; bb.mt = T; bb.next = T + (gentle ? 14 : 7) + rnd() * 6;
            if (rnd() < 0.4) { bb.ci = (rnd() * 6) | 0; bb.cj = (rnd() * 6) | 0; }
          }
          paintBB(L, bb);
        }
      }
    }

    // ---------------- flying traffic
    var FS = 0.75, FW = Math.round(W * FS), FH = Math.round(H * FS);
    var fxFar = mkCanvas(FW, FH), fctx = fxFar.getContext('2d');
    var fxNear = mkCanvas(W, H), nctx = fxNear.getContext('2d');
    var glowCache = {};
    function glow(col) {
      if (glowCache[col]) return glowCache[col];
      var c = mkCanvas(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32), rgb = hex(col);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.12, rgba(rgb, 0.9)); g.addColorStop(0.35, rgba(rgb, 0.3)); g.addColorStop(1, rgba(rgb, 0));
      x.fillStyle = g; x.fillRect(0, 0, 64, 64); glowCache[col] = c; return c;
    }
    var lanes = [];
    (function () {
      for (var i = 0; i < 4; i++) {
        var lane = { y: H * (0.2 + i * 0.07), sl: (R() - 0.5) * 0.04, ph: R() * 6, dir: i % 2 ? 1 : -1, sp: 50 + R() * 40, dots: [] };
        for (var k = 0; k < 16; k++) lane.dots.push(R() * W * 1.1);
        lanes.push(lane);
      }
    })();
    var vehicles = [], nextNear = 4 + rnd() * 6;
    function spawnV(depth, opt) {
      opt = opt || {};
      var dir = opt.dir || (rnd() < 0.5 ? 1 : -1), z = depth === 'near' ? 1 : 0.35 + rnd() * 0.5;
      var size = depth === 'near' ? 13 + rnd() * 9 : 3.5 + z * 8;
      var speed = depth === 'near' ? 520 + rnd() * 380 : 90 + z * 230;
      if (opt.size) size = opt.size;
      if (opt.speed) speed = opt.speed;
      var y = opt.y != null ? opt.y : depth === 'near' ? H * (0.12 + rnd() * 0.55) : H * (0.2 + rnd() * 0.42);
      vehicles.push({ d: depth, x: opt.x != null ? opt.x : dir > 0 ? -400 : W + 400, y: y, vx: speed * dir, vy: speed * (rnd() - 0.5) * 0.06, s: size, ph: rnd() * 6,
        head: rnd() < 0.5 ? '#fff4d8' : '#c8f6ff', tail: rnd() < 0.6 ? '#ff2a48' : '#ff3bd4', under: P.neonS[(rnd() * 6) | 0] });
    }
    function drawVehicle(ctx, v, sh) {
      var x = v.x + sh, y = v.y + Math.sin(T * 2 + v.ph) * v.s * 0.15, s = v.s, d = v.vx > 0 ? 1 : -1;
      var tl = Math.abs(v.vx) * (v.d === 'near' ? 0.32 : 0.45);
      ctx.globalCompositeOperation = 'lighter';
      var tg = ctx.createLinearGradient(x, y, x - d * tl, y);
      tg.addColorStop(0, v.tail); tg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.strokeStyle = tg; ctx.globalAlpha = 0.55; ctx.lineWidth = Math.max(1, s * 0.3);
      ctx.beginPath(); ctx.moveTo(x - d * s * 1.2, y); ctx.lineTo(x - d * tl, y - v.vy * 0.3); ctx.stroke();
      ctx.globalAlpha = 1;
      if (s > 4) ctx.drawImage(glow(v.under), x - s * 1.6, y + s * 0.1, s * 3.2, s * 0.9);
      ctx.globalCompositeOperation = 'source-over';
      if (s > 3) {
        ctx.fillStyle = '#05060b';
        ctx.beginPath(); ctx.moveTo(x + d * s * 1.25, y + s * 0.05); ctx.lineTo(x + d * s * 0.4, y - s * 0.38); ctx.lineTo(x - d * s * 1.1, y - s * 0.3); ctx.lineTo(x - d * s * 1.35, y + s * 0.22); ctx.lineTo(x + d * s * 0.8, y + s * 0.28); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = rgba(hex(v.under), 0.6); ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      if (v.d === 'near') {
        var bg = ctx.createLinearGradient(x, y, x + d * s * 14, y);
        bg.addColorStop(0, 'rgba(255,250,230,0.22)'); bg.addColorStop(1, 'rgba(255,250,230,0)');
        ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(x + d * s, y); ctx.lineTo(x + d * s * 14, y - s * 2); ctx.lineTo(x + d * s * 14, y + s * 2.6); ctx.closePath(); ctx.fill();
      }
      var hs = Math.max(4, s * 2.4);
      ctx.drawImage(glow(v.head), x + d * s * 1.2 - hs / 2, y - hs / 2, hs, hs);
      var ts = Math.max(3, s * 1.6);
      ctx.drawImage(glow(v.tail), x - d * s * 1.25 - ts / 2, y - ts / 2, ts, ts);
      if (v.d === 'near' && ((T * 2 + v.ph) % 1) < 0.15) ctx.drawImage(glow('#ff3050'), x - s * 0.5, y - s * 0.8, s, s);
      ctx.globalCompositeOperation = 'source-over';
    }

    // ---------------- street (low-res, rippled reflections)
    var STS = 0.4, SLW = layers[2].LW, STH = H - HZ;
    var street = mkCanvas(SLW * STS, STH * STS), stctx = street.getContext('2d');
    street.className = 'cy-l';
    street.style.left = (-LC[2].amp * 100) + 'vw'; street.style.width = ((1 + 2 * LC[2].amp) * 100) + 'vw';
    street.style.top = (HZ / H * 100) + 'vh'; street.style.height = (STH / H * 100) + 'vh';
    function drawStreet() {
      var c = stctx, N = layers[2];
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      var g = c.createLinearGradient(0, 0, 0, street.height); g.addColorStop(0, rgba(P.street[0])); g.addColorStop(1, rgba(P.street[1]));
      c.fillStyle = g; c.fillRect(0, 0, street.width, street.height);
      c.setTransform(STS, 0, 0, STS, 0, 0);
      var step = 7, sd = 1.25;
      for (var li = 0; li < 3; li++) {
        var L = layers[li], lx0 = (L.off0 - N.off0) + (N.shift - L.shift);
        c.globalAlpha = [0.5, 0.6, 0.75][li];
        for (var d = 0; d < STH; d += step) {
          var sy = HZ - (d + step) * sd, wob = Math.sin(d * 0.21 + T * 2.6) * (1.5 + d * 0.04) + Math.sin(d * 0.07 - T * 1.3) * 3;
          if (sy < 0) break;
          c.drawImage(L.cv, Math.max(0, (lx0 + wob) * L.s), sy * L.s, SLW * L.s, step * sd * L.s, 0, d, SLW, step + 0.5);
        }
      }
      c.globalAlpha = 1;
      // vertical smear: wet asphalt stretches every light downward
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 0.35; c.globalCompositeOperation = 'lighter';
      c.drawImage(street, 0, 0, street.width, street.height * 0.5, 0, street.height * 0.15, street.width, street.height);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      var dg = c.createLinearGradient(0, 0, 0, street.height);
      dg.addColorStop(0, rgba(P.street[0], 0.2)); dg.addColorStop(1, rgba(P.street[1], 0.72));
      c.fillStyle = dg; c.fillRect(0, 0, street.width, street.height);
      // lane markings converging toward the vanishing point
      c.setTransform(STS, 0, 0, STS, 0, 0);
      c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 3; c.beginPath();
      var vx = N.off0 + W / 2 - N.shift * 0.5;
      for (var k = -3; k <= 3; k++) { c.moveTo(vx + k * 40, 0); c.lineTo(vx + k * 520, STH); }
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(0, 0, SLW, 1.5);
    }

    // ---------------- rain + splashes
    var drops = [], splashes = [], NR = reduced ? 120 : calm ? 200 : 340, WIND = 0.16;
    function newDrop(d, top) {
      var z = rnd();
      d.z = z; d.x = rnd() * (W + 300); d.y = top ? -rnd() * 200 : rnd() * H;
      d.l = 12 + z * 34; d.v = (900 + z * 1300) * (calm ? 0.75 : 1);
      d.gy = z > 0.55 ? HZ + rnd() * (H - HZ) : rnd() * H * 1.2;
      return d;
    }
    for (var di = 0; di < NR; di++) drops.push(newDrop({}, false));
    function drawRain(dt) {
      var c = nctx, b, k, d;
      var buckets = [[], [], []];
      for (k = 0; k < drops.length; k++) {
        d = drops[k]; d.y += d.v * dt; d.x -= d.v * dt * WIND;
        if (d.y > d.gy) {
          if (d.z > 0.55 && splashes.length < 40 && d.gy < H) splashes.push({ x: d.x, y: d.gy, t: 0, z: d.z });
          newDrop(d, true);
        }
        buckets[d.z < 0.35 ? 0 : d.z < 0.7 ? 1 : 2].push(d);
      }
      for (b = 0; b < 3; b++) {
        c.strokeStyle = rgba(P.rain, [0.14, 0.22, 0.34][b] * (calm ? 0.7 : 1)); c.lineWidth = [0.8, 1.1, 1.6][b];
        c.beginPath();
        for (k = 0; k < buckets[b].length; k++) { d = buckets[b][k]; c.moveTo(d.x, d.y); c.lineTo(d.x + d.l * WIND, d.y - d.l); }
        c.stroke();
      }
      c.lineWidth = 1;
      for (k = splashes.length - 1; k >= 0; k--) {
        var s = splashes[k]; s.t += dt / 0.35;
        if (s.t >= 1) { splashes.splice(k, 1); continue; }
        var r = (2 + s.t * 9) * s.z;
        c.strokeStyle = rgba(P.rain, (1 - s.t) * 0.45);
        c.beginPath(); c.ellipse(s.x, s.y, r, r * 0.28, 0, 0, 6.283); c.stroke();
        c.fillStyle = rgba(P.rain, (1 - s.t) * 0.6);
        var hgt = Math.sin(s.t * 3.14) * 7 * s.z;
        c.fillRect(s.x - s.t * 7, s.y - hgt, 1.5, 1.5); c.fillRect(s.x + s.t * 6, s.y - hgt * 0.8, 1.5, 1.5);
      }
    }

    // ---------------- searchlight drone
    function drawDrone(c) {
      var M = layers[1], x = W * (0.55 + 0.33 * Math.sin(T / 41)) + M.shift, y = H * (0.2 + 0.05 * Math.sin(T / 17));
      var ang = Math.sin(T / 7.5) * 0.45, len = HZ + 60 - y, gx = x + Math.tan(ang) * len, spread = 110;
      var a = (gentle ? 0.1 : 0.16) * (moodName === 'day' ? 0.6 : 1);
      c.globalCompositeOperation = 'lighter';
      var g = c.createLinearGradient(x, y, gx, y + len);
      g.addColorStop(0, rgba(P.beam, a)); g.addColorStop(0.7, rgba(P.beam, a * 0.35)); g.addColorStop(1, rgba(P.beam, 0));
      c.fillStyle = g; c.beginPath(); c.moveTo(x - 3, y + 4); c.lineTo(gx - spread, y + len); c.lineTo(gx + spread, y + len); c.lineTo(x + 3, y + 4); c.closePath(); c.fill();
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#07080d'; c.fillRect(x - 14, y - 3, 28, 6); c.fillRect(x - 20, y - 5, 8, 2); c.fillRect(x + 12, y - 5, 8, 2);
      c.globalCompositeOperation = 'lighter';
      c.drawImage(glow('#ffffff'), x - 7, y - 3, 14, 14);
      if ((T % 1.1) < 0.12) c.drawImage(glow('#ff2a48'), x - 26, y - 12, 14, 14);
      if (((T + 0.55) % 1.1) < 0.12) c.drawImage(glow('#22f2ff'), x + 12, y - 12, 14, 14);
      c.globalCompositeOperation = 'source-over';
    }

    // ---------------- hour hologram
    function startHour(h) {
      var img = mkCanvas(1400, 480), x = img.getContext('2d'), lbl = api.pad(h) + ':00';
      x.font = '900 400px ' + ORB; x.textAlign = 'center'; x.textBaseline = 'middle';
      var g = x.createLinearGradient(0, 30, 0, 440); g.addColorStop(0, '#f4ffff'); g.addColorStop(0.5, rgba(P.neon[1])); g.addColorStop(1, rgba(P.neon[3], 0.6));
      x.shadowColor = rgba(P.neon[1]); x.shadowBlur = 36;
      x.fillStyle = g; x.fillText(lbl, 700, 245); x.shadowBlur = 0;
      x.lineWidth = 5; x.strokeStyle = 'rgba(255,255,255,0.75)'; x.strokeText(lbl, 700, 245);
      hourEv = { t0: T, h: h, img: img };
      if (!reduced) {
        var n = gentle ? 4 : 11;
        for (var k = 0; k < n; k++) {
          var row = Math.abs(k - (n - 1) / 2);
          spawnV(k % 3 === 0 && !gentle ? 'near' : 'mid', { dir: 1, x: -300 - row * 160 - 400, y: H * (0.42 + (k % 2 ? 1 : -1) * row * 0.022), speed: 420, size: k % 3 === 0 && !gentle ? 14 : 8 });
        }
      }
    }
    function drawHolo(c) {
      var te = T - hourEv.t0;
      if (te > 14.5) { hourEv = null; return; }
      var rise = ease(te / 2.6), out = ease((te - 11) / 2.5), img = hourEv.img;
      var M = layers[1], cx = W * 0.56 + M.shift * 0.8, hh = H * 0.3, hw = hh * img.width / img.height;
      var bottom = lerp(HZ * 0.92, H * 0.44, rise), top = bottom - hh, left = cx - hw / 2, ey = HZ * 0.66;
      var fl = (gentle ? 0.7 : 0.8) + 0.2 * Math.sin(T * 40) * Math.sin(T * 3.1);
      c.globalCompositeOperation = 'lighter';
      // projector beams
      var bg = c.createLinearGradient(0, ey, 0, top);
      bg.addColorStop(0, rgba(P.neon[1], 0.32 * (1 - out))); bg.addColorStop(1, rgba(P.neon[1], 0.03));
      c.fillStyle = bg; c.beginPath(); c.moveTo(cx - 30, ey); c.lineTo(left, bottom); c.lineTo(left + hw, bottom); c.lineTo(cx + 30, ey); c.closePath(); c.fill();
      // emitter rings
      c.strokeStyle = rgba(P.neon[1], 0.6 * (1 - out)); c.lineWidth = 2;
      for (var r = 0; r < 3; r++) { c.beginPath(); c.ellipse(cx, ey - r * 14, 60 + r * 30 + Math.sin(T * 3 + r) * 8, 10 + r * 4, 0, 0, 6.283); c.stroke(); }
      // the digits, in scan strips that jitter and dissolve upward
      var strips = 70, ih2 = img.height / strips, dh = hh / strips;
      for (var k = 0; k < strips; k++) {
        var f = k / strips, gone = out > 0 && f < out * 1.2;
        var dx = Math.sin(k * 0.7 + T * 7) * 2 + (rnd() < 0.03 ? (rnd() - 0.5) * 60 : 0);
        var dy = gone ? -out * 80 * (1 - f) : 0;
        c.globalAlpha = clamp(fl * (gone ? 1 - out : 1) * (0.55 + (k % 2) * 0.45), 0, 1);
        c.drawImage(img, 0, k * ih2, img.width, ih2 * 0.7, left + dx, top + k * dh + dy, hw, dh * 0.72);
      }
      c.globalAlpha = 1 - out;
      c.font = '22px ' + MONO; c.textAlign = 'center'; c.fillStyle = rgba(P.neon[1]);
      c.fillText('HOUR ' + api.pad(hourEv.h) + '  //  DISTRICT 7  //  ALL SCREENS IN SYNC', cx, top - 6);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }

    // ---------------- DOM assembly (back to front)
    world.appendChild(layers[0].cv);
    var fogA = el('div', 'cy-fog', world); fogA.style.top = '28vh'; fogA.style.height = '56vh';
    world.appendChild(fxFar); fxFar.style.width = '100vw'; fxFar.style.height = '100vh';
    world.appendChild(layers[1].cv);
    var fogB = el('div', 'cy-fog', world); fogB.style.top = '48vh'; fogB.style.height = '37vh';
    world.appendChild(layers[2].cv);
    world.appendChild(street);
    var fogG = el('div', 'cy-fog', world); fogG.style.top = '74vh'; fogG.style.height = '20vh';
    world.appendChild(fxNear); fxNear.style.width = '100vw'; fxNear.style.height = '100vh';

    var hud = el('div', 'cy-hud');
    hud.innerHTML =
      '<div class="cy-k cy-k1"></div><div class="cy-k cy-k2"></div><div class="cy-k cy-k3"></div><div class="cy-k cy-k4"></div>' +
      '<div class="cy-tag">SYS.CLK // LOCAL</div>' +
      '<div class="cy-head"><span class="cy-tri"></span><span class="cy-hd"></span></div>' +
      '<div class="cy-clock"><div class="cy-tw"><span class="cy-t cy-tr"></span><span class="cy-t cy-tc"></span><span class="cy-t cy-tm"></span>' +
      '<i class="cy-gb"></i><i class="cy-gb"></i><i class="cy-gb"></i></div>' +
      '<div class="cy-sec"><span class="cy-sl">SEC</span><span class="cy-sv">00</span></div></div>' +
      '<div class="cy-bar"></div><div class="cy-date"></div><div class="cy-alert"><span></span><em class="cy-at"></em></div>';
    function q(s) { return hud.querySelector(s); }
    var tR = q('.cy-tr'), tC = q('.cy-tc'), tM = q('.cy-tm'), secEl = q('.cy-sv'), dateEl = q('.cy-date'), headEl = q('.cy-hd'), alertEl = q('.cy-at');
    var gbars = hud.querySelectorAll('.cy-gb'), barEl = q('.cy-bar'), ticks = [];
    for (var ti = 0; ti < 60; ti++) ticks.push(el('i', '', barEl));
    alertEl.style.fontStyle = 'normal';
    var ticker = el('div', 'cy-ticker'), tk = el('div', 'cy-tk', ticker), tl = el('div', 'cy-tl', ticker);
    tl.textContent = 'D7 FEED';
    var ban = el('div', 'cy-ban'); ban.innerHTML = 'SYSTEM RESTORED<small>GRID 7 // ALL SECTORS ONLINE</small>';
    el('div', 'cy-ov');
    var dim = el('div', 'cy-dim');

    // ---------------- palette application
    function fogBG(c, a) {
      var s1 = rgba(c, a), s2 = rgba(c, a * 0.55), s0 = rgba(c, 0);
      return 'radial-gradient(ellipse 30vw 9vh at 22% 58%,' + s1 + ',' + s0 + ' 70%),' +
        'radial-gradient(ellipse 38vw 12vh at 72% 36%,' + s2 + ',' + s0 + ' 70%),' +
        'linear-gradient(to bottom,' + s0 + ' 0%,' + s2 + ' 60%,' + s1 + ' 100%)';
    }
    function applyPalette() {
      renderSky();
      layers.forEach(renderLayer);
      fogA.style.background = fogBG(P.fog, P.fogA); fogA.style.backgroundSize = '100vw 100%';
      fogB.style.background = fogBG(P.fog, P.fogA * 0.8); fogB.style.backgroundSize = '100vw 100%';
      fogG.style.background = 'linear-gradient(to bottom,' + rgba(P.fog, 0) + ',' + rgba(P.fog, P.fogA * 1.3) + ' 45%,' + rgba(P.fog, 0) + ')';
      root.style.setProperty('--m', P.hud[0]); root.style.setProperty('--g', P.hud[1]); root.style.setProperty('--a', P.hud[2]);
      root.style.setProperty('--sh', moodName === 'day' ? 'rgba(0,10,20,.55)' : 'rgba(0,0,0,0)');
      dim.style.display = calm ? 'block' : 'none';
      scanFill = null;
    }

    // ---------------- clock
    var shown = '', lastSec = -1, gl = null, mismatchAt = 0;
    function hhmm(d) { return api.pad(d.getHours()) + ':' + api.pad(d.getMinutes()); }
    function setTime(s) { shown = s; tR.textContent = s; tC.textContent = s; tM.textContent = s; }
    function mon3(d) { return api.MONTHS[d.getMonth()].slice(0, 3).toUpperCase(); }
    function setInfo(d) {
      headEl.textContent = 'DISTRICT 7  ·  ' + P.label + '  ·  ' + d.getDate() + ' ' + mon3(d);
      dateEl.innerHTML = '<b>' + api.DAYS[d.getDay()].toUpperCase() + '</b>  //  ' + d.getDate() + ' ' + api.MONTHS[d.getMonth()].toUpperCase() + ' ' + d.getFullYear();
      var items = ['DISTRICT 7', P.label, api.DAYS[d.getDay()].toUpperCase() + ' ' + d.getDate() + ' ' + mon3(d), 'SKYLANE 3 · OPEN', 'RAIN · CONTINUOUS',
        'NULLSPRING — DRINK THE STATIC', 'GRID 7-C · NOMINAL', 'MAGLEV LOOP B · RUNNING', 'NOODLE STALLS ON LEVEL 2 · OPEN ALL CYCLES',
        'LOST DRONE · ANSWERS TO "PIXEL"', 'HYPERMILK — DREAM AT 8K', 'PRESS OK · GRID TEST'];
      var s = items.join('   ///   ') + '   ///   ';
      tk.textContent = s + s; tkW = 0;
    }
    var tkX = 0, tkW = 0;
    function tickClock() {
      var d = api.now(), s = d.getSeconds();
      if (s === lastSec) return;
      lastSec = s;
      secEl.textContent = api.pad(s);
      for (var i = 0; i < 60; i++) ticks[i].className = i < s ? 'on' : i === s ? 'now' : '';
      var want = hhmm(d);
      if (!gl && want !== shown) {
        if (!shown) setTime(want);
        else if (!mismatchAt) mismatchAt = T;
        else if (T - mismatchAt > 1.5) { glitch(gentle ? 0.35 : 1); mismatchAt = 0; }
      } else mismatchAt = 0;
      if (s === 0 || !headEl.textContent) setInfo(d);
    }
    function glitch(str) { gl = { t0: T, dur: str < 0.5 ? 0.5 : 0.95, str: str, done: false }; }
    var SCR = '0123456789#%$&?';
    function runGlitch() {
      if (!gl) return;
      var k = (T - gl.t0) / gl.dur;
      if (k >= 1) {
        tR.style.transform = ''; tC.style.transform = ''; tM.style.transform = '';
        tR.style.clipPath = ''; tC.style.clipPath = ''; tR.style.webkitClipPath = ''; tC.style.webkitClipPath = '';
        for (var j = 0; j < gbars.length; j++) gbars[j].style.opacity = 0;
        setTime(hhmm(api.now())); gl = null; return;
      }
      var a = gl.str * (1 - k * 0.6);
      [tR, tC].forEach(function (e, i) {
        if (rnd() < 0.75) {
          var s0 = rnd() * 85, s1 = clamp(s0 + 6 + rnd() * 35, 0, 100), clip = 'inset(' + s0.toFixed(1) + '% 0 ' + (100 - s1).toFixed(1) + '% 0)';
          e.style.clipPath = clip; e.style.webkitClipPath = clip;
          e.style.transform = 'translateX(' + ((i ? 1 : -1) * (0.03 + rnd() * 0.16 * a)).toFixed(3) + 'em)';
        }
      });
      tM.style.transform = rnd() < 0.35 * a ? 'translateX(' + ((rnd() - 0.5) * 0.06 * a).toFixed(3) + 'em) skewX(' + ((rnd() - 0.5) * 14 * a).toFixed(1) + 'deg)' : '';
      for (var b = 0; b < gbars.length; b++) {
        var gb = gbars[b];
        if (rnd() < 0.6 * a) { gb.style.opacity = (0.5 + rnd() * 0.5).toFixed(2); gb.style.top = (rnd() * 95).toFixed(1) + '%'; gb.style.left = ((rnd() - 0.3) * 40).toFixed(1) + '%'; gb.style.width = (20 + rnd() * 70).toFixed(0) + '%'; gb.style.background = rnd() < 0.5 ? '#ff1f5a' : rnd() < 0.5 ? '#00e8ff' : '#ffffff'; }
        else gb.style.opacity = 0;
      }
      var target = hhmm(api.now());
      if (k > 0.38 && k < 0.66 && gl.str > 0.5) {
        var out = '';
        for (var c = 0; c < target.length; c++) out += target[c] === ':' ? ':' : (target[c] !== (shown[c] || '') || rnd() < 0.25) ? SCR[(rnd() * SCR.length) | 0] : target[c];
        tR.textContent = out; tC.textContent = out; tM.textContent = out;
      } else if (k >= 0.66 || (k > 0.38 && gl.str <= 0.5)) {
        if (tM.textContent !== target) setTime(target);
      }
    }

    // ---------------- EMP (OK button)
    function startEmp(x, y) {
      if (emp && T - emp.t0 < 7.5) return;
      if (emp) finishEmp();
      emp = { t0: T, x: x, y: y, banner: 0 };
      layers.forEach(function (L) {
        L.snap = mkCanvas(L.cv.width, L.cv.height); L.snap.getContext('2d').drawImage(L.cv, 0, 0);
        var nc = Math.ceil(L.LW / CHUNK), nb = Math.ceil(L.LW / BLOCK);
        L.dk = []; for (var c = 0; c < nc; c++) L.dk.push(0);
        L.blk = [];
        for (var b = 0; b < nb; b++) for (var r = 0; r < 3; r++) {
          var sx = (b + 0.5) * BLOCK - L.off0, dist = Math.abs(sx - x) / W;
          L.blk.push({ x: b * BLOCK, y: r * HZ / 3, t: 2.4 + dist * 1.9 + (2 - r) * 0.12 + rnd() * 0.55 + (2 - L.i) * 0.15, st: 0 });
        }
      });
      root.classList.add('cy-emp');
      alertEl.textContent = 'EMP SURGE  ·  GRID 7 OFFLINE';
      glitch(gentle ? 0.5 : 1.3); gl.dur = 1.2;
    }
    function finishEmp() {
      layers.forEach(function (L) {
        if (L.snap) { L.ctx.setTransform(1, 0, 0, 1, 0, 0); L.ctx.clearRect(0, 0, L.cv.width, L.cv.height); L.ctx.drawImage(L.snap, 0, 0); L.snap.width = 0; L.snap = null; }
      });
      emp = null; glowK = 1; root.classList.remove('cy-emp'); alertEl.textContent = 'GRID 7-C  ·  NOMINAL'; ban.style.opacity = 0; world.style.transform = '';
    }
    function runEmp(c) {
      var te = T - emp.t0, i, L;
      var r = 2600 * Math.pow(te, 0.85);
      for (var li = 2; li >= 0; li--) {
        L = layers[li];
        for (i = 0; i < L.dk.length; i++) {
          if (L.dk[i]) continue;
          var sx = (i + 0.5) * CHUNK - L.off0 + L.shift;
          if (Math.abs(sx - emp.x) + (2 - li) * 140 < r) { L.dk[i] = 1; blit(L, L.dark, i * CHUNK, 0, CHUNK, HZ); }
        }
        for (i = 0; i < L.blk.length; i++) {
          var bk = L.blk[i];
          if (bk.st === 0 && te > bk.t) { bk.st = 1; blit(L, gentle ? L.snap : L.lit, bk.x, bk.y, BLOCK, HZ / 3 + 1); }
          else if (bk.st === 1 && te > bk.t + 0.14) {
            bk.st = 2; blit(L, L.snap, bk.x, bk.y, BLOCK, HZ / 3 + 1);
            for (var k = 0; k < L.bbs.length; k++) { var bb = L.bbs[k]; if (bb.x + bb.w / 2 >= bk.x && bb.x + bb.w / 2 < bk.x + BLOCK && bb.y + bb.h / 2 >= bk.y && bb.y + bb.h / 2 < bk.y + HZ / 3) bb.boot = 1.4; }
          }
        }
      }
      glowK = te < 2.3 ? 1 - 0.78 * ease(te / 1.1) : 0.22 + 0.78 * ease((te - 2.4) / 2.6);
      // shockwave
      c.globalCompositeOperation = 'lighter';
      if (te < 1.6) {
        var fa = 1 - te / 1.6;
        c.lineWidth = 7; c.strokeStyle = 'rgba(190,250,255,' + (fa * 0.9).toFixed(3) + ')'; c.beginPath(); c.arc(emp.x, emp.y, r, 0, 6.283); c.stroke();
        c.lineWidth = 2; c.strokeStyle = rgba(P.neon[0], fa * 0.8); c.beginPath(); c.arc(emp.x, emp.y, r * 0.82, 0, 6.283); c.stroke();
        c.lineWidth = 1; c.strokeStyle = rgba(P.neon[1], fa * 0.5); c.beginPath(); c.arc(emp.x, emp.y, r * 0.65, 0, 6.283); c.stroke();
      }
      if (te < 0.35) {
        var f = 1 - te / 0.35, rg = c.createRadialGradient(emp.x, emp.y, 0, emp.x, emp.y, 260);
        rg.addColorStop(0, 'rgba(255,255,255,' + f.toFixed(3) + ')'); rg.addColorStop(0.3, rgba(P.neon[1], f * 0.5)); rg.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = rg; c.fillRect(emp.x - 260, emp.y - 260, 520, 520);
        if (!gentle) {
          c.strokeStyle = 'rgba(210,250,255,' + f.toFixed(3) + ')'; c.lineWidth = 1.5;
          for (var a = 0; a < 7; a++) {
            var ang = a / 7 * 6.283 + rnd() * 0.5, px = emp.x, py = emp.y; c.beginPath(); c.moveTo(px, py);
            for (var s = 0; s < 6; s++) { px += Math.cos(ang) * 40 + (rnd() - 0.5) * 40; py += Math.sin(ang) * 40 + (rnd() - 0.5) * 40; c.lineTo(px, py); }
            c.stroke();
          }
          c.fillStyle = 'rgba(200,240,255,' + (f * 0.18).toFixed(3) + ')'; c.fillRect(0, 0, W, H);
        }
      }
      c.globalCompositeOperation = 'source-over';
      world.style.transform = !gentle && te < 0.5 ? 'translate(' + ((rnd() - 0.5) * 14 * (1 - te * 2)).toFixed(1) + 'px,' + ((rnd() - 0.5) * 10 * (1 - te * 2)).toFixed(1) + 'px)' : '';
      // HUD status
      if (te > 2.3 && te < 5.2) {
        var tot = 0, done = 0;
        layers.forEach(function (L2) { for (var j = 0; j < L2.blk.length; j++) { tot++; if (L2.blk[j].st === 2) done++; } });
        alertEl.textContent = 'REBOOTING SECTORS  ·  ' + api.pad(Math.min(99, Math.round(done / tot * 100))) + '%';
      }
      if (te > 5.2 && !emp.banner) { emp.banner = 1; root.classList.remove('cy-emp'); alertEl.textContent = 'GRID 7-C  ·  NOMINAL'; glitch(0.4); }
      if (te > 5.2) {
        var bt = te - 5.2;
        ban.style.opacity = bt < 0.45 ? (rnd() < 0.6 ? 1 : 0.2) : bt < 2.6 ? 1 : clamp(1 - (bt - 2.6) / 0.6, 0, 1);
        ban.style.transform = 'translate(-50%,-50%)' + (bt < 0.45 ? ' translateX(' + ((rnd() - 0.5) * 20).toFixed(0) + 'px)' : '');
      }
      if (te > 8.6) finishEmp();
    }

    // ---------------- main loop
    var cam = { x: 0, y: 0, tx: 0, ty: 0 }, fogX = 0, lastMood = moodName;
    function frame(now) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      if (now - lastFrame < 31) return;
      var dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 1 / 30;
      lastFrame = now; T += dt; fc++;
      if (reduced) { cam.x = cam.tx * 0.3; cam.y = cam.ty * 0.3; }
      else { cam.x += (cam.tx - cam.x) * 0.05; cam.y += (cam.ty - cam.y) * 0.05; }
      for (var i = 0; i < 3; i++) {
        var L = layers[i]; L.shift = -cam.x * L.amp * W * 0.9; L.shiftY = i < 2 ? -cam.y * (i ? 6 : 3) : 0;
        L.cv.style.transform = 'translate3d(' + (L.shift * K).toFixed(2) + 'px,' + (L.shiftY * K).toFixed(2) + 'px,0)';
      }
      street.style.transform = 'translate3d(' + (layers[2].shift * K).toFixed(2) + 'px,0,0)';
      fogX += dt * 9;
      var fw = iw;
      fogA.style.transform = 'translate3d(' + (-((fogX * 0.6 - layers[0].shift * K) % fw) - fw * 0.0).toFixed(1) + 'px,0,0)';
      fogB.style.transform = 'translate3d(' + (-((fogX + fw * 0.37 - layers[1].shift * K) % fw)).toFixed(1) + 'px,0,0)';
      fogG.style.transform = 'translate3d(' + (-((fogX * 1.4 + fw * 0.61 - layers[2].shift * K) % fw)).toFixed(1) + 'px,0,0)';

      tickClock(); runGlitch();
      // lightning
      if (P.bolt && !gentle && T > nextBolt) {
        nextBolt = T + 50 + rnd() * 100; flash = 0.0001;
        var bx = SW * (0.15 + rnd() * 0.7), by = 0; bolt = [[bx, by]];
        while (by < HZ / H * SH * 0.7) { bx += (rnd() - 0.5) * 14; by += 4 + rnd() * 8; bolt.push([bx, by]); }
        flashT = T;
      }
      if (flash > 0) {
        var ft = T - flashT;
        flash = ft < 0.06 ? 1 : ft < 0.12 ? 0.25 : ft < 0.19 ? 0.75 : Math.max(0, 0.75 - (ft - 0.19) * 1.6);
        if (ft > 0.7) { flash = 0; bolt = null; }
      }
      if (fc % 2 === 0 || flash > 0 || emp) drawSky();

      updateLayers(dt);

      // far fx: lane traffic, mid vehicles, sculpture, hour hologram
      fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.clearRect(0, 0, FW, FH); fctx.setTransform(FS, 0, 0, FS, 0, 0);
      var shF = layers[0].shift, shM = layers[1].shift, k, d;
      for (k = 0; k < lanes.length; k++) {
        var ln = lanes[k], mult = hourEv ? 1.8 : 1;
        fctx.fillStyle = ln.dir > 0 ? 'rgba(255,90,110,0.85)' : 'rgba(255,245,220,0.9)';
        for (d = 0; d < ln.dots.length; d++) {
          ln.dots[d] += ln.dir * ln.sp * dt * mult;
          if (ln.dots[d] > W * 1.1) ln.dots[d] -= W * 1.2; else if (ln.dots[d] < -W * 0.1) ln.dots[d] += W * 1.2;
          var lx = ln.dots[d], ly = ln.y + lx * ln.sl + Math.sin(lx * 0.002 + ln.ph) * 12;
          fctx.fillRect(lx + shF, ly, 3, 1.6);
        }
      }
      // sculpture above the tower
      var M = layers[1];
      if (M.tower) {
        var sx2 = M.tower.cx - M.off0 + shM, sy2 = M.tower.top - 70, sf = hourEv ? 1 - ease((T - hourEv.t0) / 1.5) + ease((T - hourEv.t0 - 12) / 2) : 1;
        if (sf > 0.02) {
          fctx.globalCompositeOperation = 'lighter'; fctx.globalAlpha = clamp(sf, 0, 1) * (moodName === 'day' ? 0.7 : 1);
          var bm = fctx.createLinearGradient(0, M.tower.top + 70, 0, sy2);
          bm.addColorStop(0, rgba(P.neon[1], 0.25)); bm.addColorStop(1, rgba(P.neon[1], 0));
          fctx.fillStyle = bm; fctx.beginPath(); fctx.moveTo(sx2 - 4, M.tower.top + 70); fctx.lineTo(sx2 - 55, sy2); fctx.lineTo(sx2 + 55, sy2); fctx.lineTo(sx2 + 4, M.tower.top + 70); fctx.fill();
          fctx.lineWidth = 2; fctx.strokeStyle = rgba(P.neon[1], 0.85); wire(fctx, sx2, sy2, 52, T * 0.35, 0.4 + Math.sin(T * 0.2) * 0.3);
          fctx.lineWidth = 1.2; fctx.strokeStyle = rgba(P.neon[0], 0.8); wire(fctx, sx2, sy2, 30, -T * 0.6, T * 0.25);
          fctx.strokeStyle = rgba(P.neon[1], 0.4); fctx.beginPath(); fctx.ellipse(sx2, sy2 + 66, 70, 12, 0, 0, 6.283); fctx.stroke();
          fctx.globalAlpha = 1; fctx.globalCompositeOperation = 'source-over';
        }
      }
      if (hourEv) drawHolo(fctx);
      // vehicles
      var wantMid = reduced ? 2 : gentle ? 3 : 7, nMid = 0;
      for (k = vehicles.length - 1; k >= 0; k--) {
        var v = vehicles[k];
        v.x += v.vx * dt; v.y += v.vy * dt;
        if (v.x < -700 || v.x > W + 700) { vehicles.splice(k, 1); continue; }
        if (v.d === 'mid') { nMid++; drawVehicle(fctx, v, shM); }
      }
      if (nMid < wantMid && rnd() < dt * 0.8) spawnV('mid');
      if (!reduced && T > nextNear) { nextNear = T + (gentle ? 25 + rnd() * 25 : 6 + rnd() * 9); spawnV('near'); }

      // near fx: near vehicles, drone, rain, emp
      nctx.setTransform(1, 0, 0, 1, 0, 0); nctx.clearRect(0, 0, W, H);
      for (k = 0; k < vehicles.length; k++) if (vehicles[k].d === 'near') drawVehicle(nctx, vehicles[k], layers[2].shift);
      drawDrone(nctx);
      drawRain(dt);
      if (emp) runEmp(nctx);

      if (fc % 2 === 1) drawStreet();

      // HUD drift (burn-in care) and fades
      var hx = Math.sin(T / 347 + 0.5) * 1.6, hy = Math.sin(T / 271 + 1.1) * 2;
      var htf = 'translate(' + hx.toFixed(2) + 'vw,' + hy.toFixed(2) + 'vh)';
      if (htf !== hudTf) { hudTf = htf; hud.style.transform = htf; }
      var ho = calm ? 0.82 : 1;
      if (hourEv) { var he = T - hourEv.t0; ho *= 1 - 0.9 * ease(he / 1.2) * (1 - ease((he - 11.5) / 1.5)); }
      var hos = ho.toFixed(2);
      if (hos !== hudOp) { hudOp = hos; hud.style.opacity = hos; }
      var ttf = 'translateY(' + (Math.sin(T / 300) * 0.5).toFixed(2) + 'vh)';
      if (ttf !== tickTf) { tickTf = ttf; ticker.style.transform = ttf; }
      if (!tkW) tkW = tk.scrollWidth / 2;
      if (tkW) { tkX = (tkX + dt * (gentle ? 40 : 70)) % tkW; tk.style.transform = 'translate3d(' + (-tkX).toFixed(1) + 'px,0,0)'; }
    }
    var flashT = 0, hudTf = '', hudOp = '', tickTf = '';

    function start() { if (!raf && alive && !document.hidden) { lastFrame = 0; raf = requestAnimationFrame(frame); } }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    function onVis() { if (document.hidden) stop(); else start(); }
    function onResize() { iw = root.clientWidth || window.innerWidth; ih = root.clientHeight || window.innerHeight; K = iw / W; tkW = 0; }
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', onResize);

    applyPalette();
    alertEl.textContent = 'GRID 7-C  ·  NOMINAL';
    var d0 = api.now(); setTime(hhmm(d0)); setInfo(d0);
    // a little traffic already in the air
    for (var vi = 0; vi < (reduced ? 2 : 5); vi++) spawnV('mid', { x: rnd() * W });
    if (document.fonts && document.fonts.load) {
      document.fonts.load('800 100px CyberOrbitron').then(function () { if (alive) tkW = 0; }, function () {});
    }
    start();

    function checkMood() {
      var m = api.mood(), c = api.calm();
      if (c !== calm) { calm = c; gentle = calm || reduced; }
      if (m !== lastMood && !emp) { lastMood = moodName = m; P = prep(PAL[m]); applyPalette(); glitch(gentle ? 0.35 : 1); }
      dim.style.display = calm ? 'block' : 'none';
    }

    return {
      destroy: function () {
        alive = false; stop();
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('resize', onResize);
        layers.forEach(function (L) { L.cv.width = 0; L.lit.width = 0; L.dark.width = 0; if (L.snap) L.snap.width = 0; });
        fxFar.width = 0; fxNear.width = 0; street.width = 0;
      },
      onPointer: function (nx, ny) { cam.tx = clamp(nx, -1, 1); cam.ty = clamp(ny, -1, 1); },
      onAction: function (x, y) { startEmp(x / K, y * H / ih); },
      onMinute: function (date) { checkMood(); glitch(gentle ? 0.35 : 1); setInfo(date || api.now()); },
      onHour: function (date) { startHour((date || api.now()).getHours()); }
    };
  }

  window.Themes = window.Themes || {};
  window.Themes.cyber = { title: 'Cyber District', create: create };
})();
