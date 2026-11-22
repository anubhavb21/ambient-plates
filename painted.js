// Endless painted landscapes. Every call makes a new scene from a template,
// a fresh random seed and a palette that suits the time of day.
(function () {
  const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const between = (r, a, b) => a + r() * (b - a);
  const pick = (r, list) => list[Math.floor(r() * list.length)];

  function ridge(r, { base, amp, rough = 0.5, trees = 0, tw = 1.1 }) {
    const f0 = 0.035 + r() * 0.04;
    const waves = [0, 1, 2, 3].map((o) => ({ f: f0 * Math.pow(2.2, o), p: r() * 6.283, a: Math.pow(rough, o) }));
    const norm = waves.reduce((s, w) => s + w.a, 0);
    const y = (x) => base - amp * (0.5 + (0.5 * waves.reduce((s, w) => s + Math.sin(x * w.f + w.p) * w.a, 0)) / norm);
    const pts = [];
    if (!trees) for (let x = 0; x <= 100.001; x += 0.5) pts.push([x, y(x)]);
    else {
      let x = -1;
      while (x <= 101) {
        const w = tw * (0.6 + r() * 0.8), h = trees * (0.45 + r() * 0.55);
        pts.push([x, y(x)], [x + w / 2, y(x + w / 2) - h], [x + w, y(x + w)]);
        x += w * (0.55 + r() * 0.5);
      }
    }
    return 'polygon(0% 100%, ' + pts.map(([a, b]) => a.toFixed(2) + '% ' + b.toFixed(2) + '%').join(', ') + ', 100% 100%)';
  }
  const div = (cls, css) => { const d = document.createElement('div'); d.className = cls; if (css) Object.assign(d.style, css); return d; };
  const orb = (o) => div('p-orb', { left: o.x + '%', top: o.y + '%', width: o.size * 3 + 'vw', background: 'radial-gradient(circle, ' + o.core + ' 0 21%, ' + o.glow + ' 25%, transparent 68%)' });
  function addLayers(parent, r, list) {
    list.forEach((l) => {
      const lr = rng(l.seed);
      parent.append(div('p-layer', { clipPath: ridge(lr, l), background: 'linear-gradient(' + l.top + ' ' + Math.max(0, l.base - l.amp - (l.trees || 0)) + '%, ' + l.bot + ' 100%)' }));
      if (l.fog) parent.append(div('p-fog', { top: l.base - l.amp - 4 + '%', bottom: 'auto', height: l.amp + 14 + '%', background: 'linear-gradient(transparent, ' + l.fog + ' 55%, transparent)' }));
    });
  }
  function stars(r) {
    const g = [];
    for (let i = 0; i < 110; i++) { const s = (0.05 + r() * 0.12).toFixed(2); g.push('radial-gradient(' + s + 'vw ' + s + 'vw at ' + (r() * 100).toFixed(1) + '% ' + (r() * 62).toFixed(1) + '%, rgba(255,255,255,' + (0.35 + r() * 0.65).toFixed(2) + '), transparent)'); }
    return div('p-stars', { backgroundImage: g.join(',') });
  }

  // Palettes per template; each is [sky gradient, orb core, orb glow, layer tops/bottoms..., water]
  const T = {
    desert: {
      label: 'Desert', moods: { dusk: 'last light', dawn: 'first light', day: 'midday haze' },
      palettes: {
        dusk: { sky: ['#1f2638', '#4f4a60', '#a9787a', '#e7ac87', '#f3c69c'], core: '#fff0d6', glow: 'rgba(255,196,140,.5)', l: [['#b48370', '#7d5a52'], ['#8a6258', '#4e3735'], ['#4a3430', '#211819']], fog: 'rgba(240,180,140,.22)' },
        dawn: { sky: ['#2e3654', '#7d7393', '#d9a2a0', '#f2c3a8', '#f8dcc0'], core: '#fff6ea', glow: 'rgba(255,214,190,.5)', l: [['#c99a86', '#946f63'], ['#9b7166', '#5d443f'], ['#57403b', '#281d1d']], fog: 'rgba(250,210,190,.22)' },
        day: { sky: ['#4f86b8', '#8fb6d6', '#d9dcd2', '#efd8b4', '#f2e0bf'], core: '#fffdf4', glow: 'rgba(255,250,230,.35)', l: [['#e0b88d', '#b98d67'], ['#c4956b', '#8a623f'], ['#7c5638', '#3b2817']], fog: 'rgba(250,236,210,.25)' },
      },
      build(r, p) {
        const sun = { x: between(r, 25, 75), y: between(r, 48, 56), size: between(r, 4.5, 7), core: p.core, glow: p.glow };
        return { sky: p.sky, orb: sun, focus: [sun.x, sun.y],
          back: [
            { seed: (r() * 1e9) | 0, base: between(r, 60, 65), amp: between(r, 3, 7), rough: 0.35, top: p.l[0][0], bot: p.l[0][1], fog: p.fog },
            { seed: (r() * 1e9) | 0, base: between(r, 71, 76), amp: between(r, 6, 11), rough: 0.3, top: p.l[1][0], bot: p.l[1][1] },
            { seed: (r() * 1e9) | 0, base: between(r, 85, 90), amp: between(r, 6, 11), rough: 0.28, top: p.l[2][0], bot: p.l[2][1] },
          ] };
      },
    },
    lake: {
      label: 'Mountain lake', moods: { dawn: 'first light', day: 'clear morning', dusk: 'alpenglow' },
      palettes: {
        dawn: { sky: ['#4d6c95', '#94a9c6', '#e6c2ae', '#f6d9bf'], core: '#fff6e6', glow: 'rgba(255,226,196,.55)', l: [['#eef2f8', '#8292ae'], ['#6e809e', '#465776'], ['#2f3f44', '#22302f']], water: 'linear-gradient(#b3bfd2, #5a6a84 60%, #3d4a61)', fore: ['#16201f', '#0d1414'] },
        day: { sky: ['#3f78b5', '#7fb0dc', '#c4dcef', '#e4eef5'], core: '#ffffff', glow: 'rgba(255,255,250,.3)', l: [['#ffffff', '#9fb2c8'], ['#6c8a7a', '#3f5a4c'], ['#28402f', '#1a2b20']], water: 'linear-gradient(#9cc4dd, #3f6f8c 60%, #284a5e)', fore: ['#13221a', '#0b140f'] },
        dusk: { sky: ['#2b2f5a', '#6c5d8f', '#e08f8f', '#f4b48d'], core: '#ffe7c8', glow: 'rgba(255,170,140,.45)', l: [['#f6c6c0', '#9a7496'], ['#5d5478', '#3a3554'], ['#262536', '#1a1926']], water: 'linear-gradient(#c79aa6, #4d4769 60%, #2b2944)', fore: ['#141320', '#0b0a13'] },
      },
      build(r, p) {
        const hz = between(r, 57, 63);
        const sun = { x: between(r, 18, 82), y: hz - between(r, 2, 6), size: between(r, 2.6, 4), core: p.core, glow: p.glow };
        return { sky: p.sky, orb: sun, focus: [sun.x, hz], hz, water: p.water, glitter: sun.x,
          back: [
            { seed: (r() * 1e9) | 0, base: hz - between(r, 16, 20), amp: between(r, 15, 22), rough: 0.72, top: p.l[0][0], bot: p.l[0][1] },
            { seed: (r() * 1e9) | 0, base: hz - between(r, 7, 10), amp: between(r, 9, 13), rough: 0.68, top: p.l[1][0], bot: p.l[1][1], fog: 'rgba(240,225,215,.22)' },
            { seed: (r() * 1e9) | 0, base: hz - 1, amp: 2.5, trees: between(r, 2, 3.2), tw: 0.8, top: p.l[2][0], bot: p.l[2][1] },
          ],
          fore: r() < 0.7 ? [{ seed: (r() * 1e9) | 0, base: between(r, 90, 94), amp: 2, trees: between(r, 9, 13), tw: 2.2, top: p.fore[0], bot: p.fore[1] }] : [] };
      },
    },
    forest: {
      label: 'Pine forest', moods: { dawn: 'morning mist', day: 'soft rain light', dusk: 'evening haze' },
      palettes: {
        dawn: { sky: ['#a6b5ad', '#c8d1c5', '#e0e4d8'], core: 'rgba(255,252,236,.85)', glow: 'rgba(255,250,230,.25)', ridges: ['#8c9e96', '#687a70', '#46584e', '#283731', '#121b18'], fog: [216, 224, 214] },
        day: { sky: ['#9fb0b8', '#c4ced2', '#dde3e3'], core: 'rgba(255,255,255,.7)', glow: 'rgba(255,255,255,.2)', ridges: ['#8a9ca3', '#62767e', '#425660', '#25363d', '#101a1e'], fog: [210, 220, 224] },
        dusk: { sky: ['#5f5a78', '#b28d8f', '#e6b79a'], core: 'rgba(255,226,190,.9)', glow: 'rgba(255,200,160,.3)', ridges: ['#9a8291', '#6f5e72', '#4a4053', '#2b2533', '#15121a'], fog: [230, 200, 190] },
      },
      build(r, p) {
        const n = 4 + Math.round(r());
        const back = [];
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1), a = (0.8 - t * 0.6).toFixed(2);
          back.push({ seed: (r() * 1e9) | 0, base: 46 + t * 50, amp: between(r, 5, 9), trees: 4 + t * 9, tw: 1 + t * 0.7, top: p.ridges[i], bot: p.ridges[i], fog: i < n - 1 ? 'rgba(' + p.fog.join(',') + ',' + a + ')' : null });
        }
        const sun = { x: between(r, 20, 80), y: between(r, 18, 30), size: between(r, 7, 10), core: p.core, glow: p.glow };
        return { sky: p.sky, orb: sun, focus: [sun.x, 60], back };
      },
    },
    coast: {
      label: 'Coast', moods: { dusk: 'golden hour', dawn: 'sunrise', day: 'bright afternoon' },
      palettes: {
        dusk: { sky: ['#2c3e63', '#6f6f93', '#d99a8a', '#f7c48e'], core: '#fff1d0', glow: 'rgba(255,190,120,.55)', isl: ['#5b5570', '#4a4560'], water: 'linear-gradient(#e0a886 0%, #6d6488 34%, #1f2a44 100%)', rock: ['#1a1a24', '#0e0e15'] },
        dawn: { sky: ['#30456e', '#8a8fb4', '#f0b6a6', '#fbd5b0'], core: '#fff7e6', glow: 'rgba(255,215,180,.55)', isl: ['#6d6d8c', '#585877'], water: 'linear-gradient(#f2c0aa 0%, #7c84a8 34%, #2a3657 100%)', rock: ['#1d1f2c', '#10111a'] },
        day: { sky: ['#2f6fb0', '#68a6d8', '#b9dbef', '#e2f1f6'], core: '#ffffff', glow: 'rgba(255,255,250,.3)', isl: ['#6f8c8a', '#557170'], water: 'linear-gradient(#a7d6e4 0%, #2f86a6 40%, #0f4b66 100%)', rock: ['#26302d', '#151c1a'] },
      },
      build(r, p) {
        const hz = between(r, 55, 60);
        const sun = { x: between(r, 20, 80), y: hz - between(r, 1.5, 5), size: between(r, 4, 6), core: p.core, glow: p.glow };
        return { sky: p.sky, orb: sun, focus: [sun.x, hz], hz, water: p.water, glitter: sun.x,
          back: [{ seed: (r() * 1e9) | 0, base: hz + between(r, 0.5, 1.5), amp: between(r, 3, 7), rough: 0.6, top: p.isl[0], bot: p.isl[1] }],
          fore: [{ seed: (r() * 1e9) | 0, base: between(r, 95, 99), amp: between(r, 5, 9), rough: 0.55, top: p.rock[0], bot: p.rock[1] }] };
      },
    },
    night: {
      label: 'Meadow', moods: { night: 'under the moon' },
      palettes: {
        night: { sky: ['#050816', '#0d1630', '#1d2b4f', '#2a3a5e'], core: '#f5f1e3', glow: 'rgba(200,212,255,.32)', l: [['#1b2642', '#141c33'], ['#131a2e', '#0d1222'], ['#080b14', '#05070d']] },
      },
      build(r, p) {
        const moon = { x: between(r, 15, 85), y: between(r, 14, 30), size: between(r, 2.4, 3.4), core: p.core, glow: p.glow };
        return { sky: p.sky, stars: true, orb: moon, focus: [moon.x, moon.y + 10],
          back: [
            { seed: (r() * 1e9) | 0, base: between(r, 62, 68), amp: between(r, 4, 8), rough: 0.4, top: p.l[0][0], bot: p.l[0][1], fog: 'rgba(120,140,190,.12)' },
            { seed: (r() * 1e9) | 0, base: between(r, 74, 79), amp: between(r, 5, 9), rough: 0.35, top: p.l[1][0], bot: p.l[1][1] },
            { seed: (r() * 1e9) | 0, base: between(r, 91, 94), amp: 3, trees: between(r, 1.8, 2.8), tw: 0.35, top: p.l[2][0], bot: p.l[2][1] },
          ] };
      },
    },
  };

  // Which templates and palettes suit the hour.
  function moodFor(h) { return h < 5 || h >= 20 ? 'night' : h < 9 ? 'dawn' : h < 16 ? 'day' : 'dusk'; }

  function make(hour, seed) {
    const r = rng(seed || ((Math.random() * 2147483646) | 0) + 1);
    const mood = moodFor(hour);
    const options = Object.keys(T).filter((k) => T[k].palettes[mood]);
    const kind = pick(r, options);
    const t = T[kind], p = t.palettes[mood];
    const s = t.build(r, p);

    const el = div('slide'), c = div('canvas', { background: 'linear-gradient(' + s.sky.join(', ') + ')' });
    c.style.setProperty('--ox', s.focus[0] + '%'); c.style.setProperty('--oy', s.focus[1] + '%');
    if (s.stars) c.append(stars(r));
    if (s.orb) c.append(orb(s.orb));
    addLayers(c, r, s.back);
    if (s.hz) {
      c.style.setProperty('--hz', s.hz + '%');
      c.append(div('p-water', { background: s.water }));
      const refl = div('p-refl');
      if (s.orb) refl.append(orb(s.orb));
      addLayers(refl, r, s.back);
      c.append(refl);
      c.append(div('p-water', { mixBlendMode: 'screen', background: 'radial-gradient(3.5% 75% at ' + s.glitter + '% 0%, rgba(255,226,180,.5), transparent 70%)' }));
      c.append(div('p-shimmer'));
    }
    addLayers(c, r, s.fore || []);
    el.append(c);
    // Calm side: text goes opposite the sun or moon.
    const calmLeft = s.orb ? s.orb.x > 45 : true;
    return { el, kind, mood, calmLeft, title: t.label + ', ' + (t.moods[mood] || mood), credit: 'Painted live · scene ' + (seed || '').toString(36) };
  }

  window.Painted = { make, moodFor };
})();
