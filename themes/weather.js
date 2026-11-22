// Live Sky: a living window onto the real weather and time of day at the user's location.
// Data: Open-Meteo (free, no key), one request every 15 minutes, cached in localStorage (ambient.weather).
// Scene: procedural Canvas 2D (sky from the real sun position, sun/moon with phase, stars, clouds that follow
// cloud cover, rain/snow/hail/fog/lightning/wind/heat shimmer) behind a DOM clock + weather panel.
// Keys: OK cycles Now -> 24h -> 7 days; left/right move along the forecast and the sky previews that hour/day.
// Test hook: ?wx=clear|partly|overcast|fog|drizzle|rain|heavy|freezing|snow|heavysnow|thunder|hail|wind|hot
// forces a state with fake numbers and no network (marked "TEST DATA" on screen).
// Add &wxbolt (with ?wx=thunder or hail) to hold a lightning strike on screen for screenshots.
(function () {
  'use strict';
  window.Themes = window.Themes || {};

  var DEFAULT_LOC = { name: 'Mumbai', lat: 19.076, lon: 72.8777 };
  var REFRESH = 15 * 60 * 1000, DAY = 864e5, HOUR = 36e5, RAD = Math.PI / 180;

  // ---------- helpers ----------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function hex(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function mul(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }
  function rgb(c, a) {
    var s = (clamp(c[0], 0, 255) | 0) + ',' + (clamp(c[1], 0, 255) | 0) + ',' + (clamp(c[2], 0, 255) | 0);
    return a == null ? 'rgb(' + s + ')' : 'rgba(' + s + ',' + clamp(a, 0, 1).toFixed(3) + ')';
  }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  // Location wall-clock time is kept as "L" milliseconds: getUTC*() of new Date(L) reads the location's local clock.
  function parseL(s) { var m = String(s).split(/[-T:]/); return Date.UTC(+m[0], m[1] - 1, +m[2], +(m[3] || 0), +(m[4] || 0)); }
  function fmtL(L) { var d = new Date(L); return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()) + 'T' + p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()); }
  function h12L(L, mins) {
    var d = new Date(L), h = d.getUTCHours(), ap = h < 12 ? 'am' : 'pm';
    return (h % 12 || 12) + (mins ? ':' + p2(d.getUTCMinutes()) : '') + ' ' + ap;
  }

  // ---------- weather codes (WMO) ----------
  // [state, word, intensity]
  var CODES = {
    0: ['clear', 'Clear'], 1: ['clear', 'Mainly clear'], 2: ['partly', 'Partly cloudy'], 3: ['overcast', 'Overcast'],
    45: ['fog', 'Fog'], 48: ['fog', 'Rime fog'],
    51: ['drizzle', 'Light drizzle', 0.18], 53: ['drizzle', 'Drizzle', 0.28], 55: ['drizzle', 'Dense drizzle', 0.4],
    56: ['freezing', 'Freezing drizzle', 0.3], 57: ['freezing', 'Freezing drizzle', 0.45],
    61: ['rain', 'Light rain', 0.4], 63: ['rain', 'Rain', 0.62], 65: ['heavy', 'Heavy rain', 1],
    66: ['freezing', 'Freezing rain', 0.45], 67: ['freezing', 'Heavy freezing rain', 0.75],
    71: ['snow', 'Light snow', 0.35], 73: ['snow', 'Snow', 0.6], 75: ['heavysnow', 'Heavy snow', 1], 77: ['snow', 'Snow grains', 0.3],
    80: ['rain', 'Rain showers', 0.45], 81: ['rain', 'Heavy showers', 0.75], 82: ['heavy', 'Violent showers', 1],
    85: ['snow', 'Snow showers', 0.5], 86: ['heavysnow', 'Heavy snow showers', 0.95],
    95: ['thunder', 'Thunderstorm', 0.75], 96: ['hail', 'Thunderstorm, hail', 0.6], 99: ['hail', 'Thunderstorm, heavy hail', 0.75],
  };
  var BASE = { cloud: 0, dark: 0, rain: 0, snow: 0, fog: 0, thunder: 0, hail: 0, ice: 0, drizzle: 0, heat: 0, windX: 0, windS: 0 };
  var STATES = {
    clear: { cloud: 0.04 }, partly: { cloud: 0.45 }, overcast: { cloud: 1, dark: 0.3 },
    fog: { cloud: 0.35, dark: 0.1, fog: 1 },
    drizzle: { cloud: 0.92, dark: 0.3, rain: 0.28, fog: 0.15, drizzle: 1 },
    rain: { cloud: 1, dark: 0.45, rain: 0.62 }, heavy: { cloud: 1, dark: 0.65, rain: 1, fog: 0.2 },
    freezing: { cloud: 1, dark: 0.4, rain: 0.5, ice: 1, snow: 0.15 },
    snow: { cloud: 0.95, dark: 0.22, snow: 0.6, fog: 0.1 }, heavysnow: { cloud: 1, dark: 0.38, snow: 1, fog: 0.35 },
    thunder: { cloud: 1, dark: 0.8, rain: 0.75, thunder: 1 }, hail: { cloud: 1, dark: 0.85, rain: 0.6, thunder: 1, hail: 1 },
  };
  function stateOf(code) { var c = CODES[code]; return c ? c[0] : 'clear'; }
  function wordOf(code) { var c = CODES[code]; return c ? c[1] : 'Clear'; }

  function sceneParams(code, o) {
    var c = CODES[code], st = c ? c[0] : 'clear', p = {}, k;
    for (k in BASE) p[k] = BASE[k];
    for (k in STATES[st]) p[k] = STATES[st][k];
    if (c && c[2] != null) { if (p.rain) p.rain = c[2]; if (p.snow && st !== 'freezing') p.snow = c[2]; }
    if (o.cloud != null) {
      var cc = o.cloud / 100;
      if (st === 'clear') p.cloud = clamp(cc, 0, 0.35);
      else if (st === 'partly') p.cloud = clamp(cc, 0.25, 0.8);
      else p.cloud = Math.max(p.cloud * 0.85, cc);
    }
    if (o.precip != null && p.rain > 0 && o.precip > 0) p.rain = clamp(p.rain * 0.55 + o.precip / 7, 0.12, 1);
    if (o.snowfall != null && p.snow > 0 && o.snowfall > 0 && st !== 'freezing') p.snow = clamp(p.snow * 0.6 + o.snowfall / 2.5, 0.15, 1);
    var ws = o.wind || 0, dr = (o.dir || 0) * RAD;
    p.windS = ws; p.windX = -Math.sin(dr) * ws;          // wind FROM the east pushes things left (we look north)
    p.heat = o.temp != null && st === 'clear' ? smooth(34.5, 41, o.temp) : 0;
    return p;
  }

  // ---------- sun ----------
  function declination(dayL) {
    var d = new Date(dayL), N = Math.floor((dayL - Date.UTC(d.getUTCFullYear(), 0, 1)) / DAY) + 1, g = 2 * Math.PI / 365 * (N - 1);
    return 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  }
  function solar(dayL, lat, lon, tzH) {       // NOAA approximation -> [sunriseL, sunsetL]
    var d = new Date(dayL), N = Math.floor((dayL - Date.UTC(d.getUTCFullYear(), 0, 1)) / DAY) + 1, g = 2 * Math.PI / 365 * (N - 1);
    var eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    var de = declination(dayL), la = lat * RAD;
    var cosH = Math.cos(90.833 * RAD) / (Math.cos(la) * Math.cos(de)) - Math.tan(la) * Math.tan(de);
    var ha = Math.acos(clamp(cosH, -1, 1)) / RAD;
    var rise = 720 - 4 * (lon + ha) - eq + tzH * 60, set = 720 - 4 * (lon - ha) - eq + tzH * 60;
    if (ha < 1) { rise = 719; set = 721; }
    return [dayL + rise * 6e4, dayL + set * 6e4];
  }
  function moonPhase(ms) {                      // 0 new, .5 full
    var syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
    var p = ((ms - ref) / DAY / syn) % 1; return p < 0 ? p + 1 : p;
  }

  // sky palette keyed by sun elevation (deg): zenith, mid, horizon, glow
  var PAL = [
    [-90, '#02040a', '#040914', '#081022', '#081022'],
    [-18, '#030712', '#071027', '#0e1a33', '#101c38'],
    [-12, '#05102a', '#0d1d44', '#1e2c58', '#2a2f5e'],
    [-6, '#0b1a44', '#25386e', '#59578a', '#8a5f80'],
    [-3, '#16285a', '#3e4f8a', '#a26c88', '#e07a62'],
    [0, '#25407a', '#5e70a8', '#e89a78', '#ff8c46'],
    [4, '#3560a0', '#7b97c8', '#f2bf8e', '#ffb060'],
    [10, '#3b70b8', '#83abd8', '#e9d4b4', '#ffd28a'],
    [20, '#3a78c6', '#7cb2e2', '#c9e0f0', '#fff0d0'],
    [40, '#2f6cc2', '#6aa6e2', '#b8d8f2', '#fff8e8'],
    [90, '#2a64bc', '#62a0e0', '#b2d4f2', '#ffffff'],
  ].map(function (r) { return [r[0], hex(r[1]), hex(r[2]), hex(r[3]), hex(r[4])]; });
  function palette(el, pm) {
    var i = 1; while (i < PAL.length - 1 && PAL[i][0] < el) i++;
    var a = PAL[i - 1], b = PAL[i], t = clamp((el - a[0]) / (b[0] - a[0]), 0, 1);
    var o = { zen: mix(a[1], b[1], t), mid: mix(a[2], b[2], t), hor: mix(a[3], b[3], t), glow: mix(a[4], b[4], t) };
    var dusk = pm * (1 - smooth(4, 9, Math.abs(el + 1))) * 0.22;   // evenings run a little rosier
    if (dusk > 0) { o.hor = mix(o.hor, [232, 106, 110], dusk); o.mid = mix(o.mid, [122, 90, 154], dusk); }
    return o;
  }

  // ---------- icons (SVG, viewBox 64) ----------
  var CL = 'M20 48H46A10 10 0 0 0 46 28A14 14 0 0 0 19.5 26A11 11 0 0 0 20 48Z';
  function sunSvg(tr) {
    var r = '';
    for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, c = Math.cos(a), s = Math.sin(a); r += '<line x1="' + (32 + c * 17).toFixed(1) + '" y1="' + (32 + s * 17).toFixed(1) + '" x2="' + (32 + c * 23).toFixed(1) + '" y2="' + (32 + s * 23).toFixed(1) + '"/>'; }
    return '<g transform="' + (tr || '') + '"><circle cx="32" cy="32" r="11" fill="#ffd36b"/><g stroke="#ffd36b" stroke-width="3.4" stroke-linecap="round">' + r + '</g></g>';
  }
  function moonSvg(tr) { return '<g transform="' + (tr || '') + '"><path d="M38 11A21 21 0 1 0 54 43A17 17 0 1 1 38 11Z" fill="#e3e8ff"/></g>'; }
  function cloudSvg(fill, tr) { return '<path d="' + CL + '" fill="' + fill + '" transform="' + (tr || '') + '"/>'; }
  function icon(code, day) {
    var st = stateOf(code), s = '', up = 'translate(0,-7)';
    function lines(n, col, len) { var o = '<g stroke="' + col + '" stroke-width="3" stroke-linecap="round">'; for (var i = 0; i < n; i++) { var x = 22 + i * (22 / Math.max(1, n - 1)); o += '<line x1="' + x + '" y1="48" x2="' + (x - 3) + '" y2="' + (48 + len) + '"/>'; } return o + '</g>'; }
    function dots(n, col, r) { var o = '<g fill="' + col + '">'; for (var i = 0; i < n; i++) o += '<circle cx="' + (22 + i * (22 / Math.max(1, n - 1))) + '" cy="' + (52 + (i % 2) * 6) + '" r="' + r + '"/>'; return o + '</g>'; }
    function flakes(n) { var o = '<g stroke="#ffffff" stroke-width="2.2" stroke-linecap="round">'; for (var i = 0; i < n; i++) { var x = 22 + i * (22 / Math.max(1, n - 1)), y = 53 + (i % 2) * 6; o += '<line x1="' + (x - 3) + '" y1="' + y + '" x2="' + (x + 3) + '" y2="' + y + '"/><line x1="' + x + '" y1="' + (y - 3) + '" x2="' + x + '" y2="' + (y + 3) + '"/>'; } return o + '</g>'; }
    var bolt = '<path d="M34 40L26 53H32L28 63L40 48H33L37 40Z" fill="#ffd84a"/>';
    if (st === 'clear') s = day ? sunSvg() : moonSvg('translate(2,2) scale(.9)');
    else if (st === 'partly') s = (day ? sunSvg('translate(-6,-9) scale(.78)') : moonSvg('translate(-2,-8) scale(.7)')) + cloudSvg('#eef2f8', 'translate(4,6) scale(.92)');
    else if (st === 'overcast') s = cloudSvg('#9aa6b8', 'translate(10,-8) scale(.8)') + cloudSvg('#e3e8ef', 'translate(-2,3)');
    else if (st === 'fog') s = cloudSvg('#c9d0da', 'translate(0,-10)') + '<g stroke="#d7dde6" stroke-width="3.4" stroke-linecap="round"><line x1="12" y1="47" x2="52" y2="47"/><line x1="16" y1="54" x2="48" y2="54"/><line x1="20" y1="61" x2="44" y2="61"/></g>';
    else if (st === 'drizzle') s = cloudSvg('#dfe5ee', up) + dots(4, '#8cc4ff', 2);
    else if (st === 'rain') s = cloudSvg('#d7dee8', up) + lines(3, '#7fb6ff', 9);
    else if (st === 'heavy') s = cloudSvg('#9ea9ba', up) + lines(5, '#6aa8ff', 12);
    else if (st === 'freezing') s = cloudSvg('#d7dee8', up) + lines(3, '#bfe6ff', 8) + dots(3, '#ffffff', 1.8);
    else if (st === 'snow') s = cloudSvg('#e9eef5', up) + flakes(3);
    else if (st === 'heavysnow') s = cloudSvg('#c8d0dc', up) + flakes(5);
    else if (st === 'thunder') s = cloudSvg('#8792a6', up) + bolt;
    else if (st === 'hail') s = cloudSvg('#8792a6', up) + bolt + '<g fill="#fff"><circle cx="20" cy="54" r="2.6"/><circle cx="46" cy="52" r="2.6"/><circle cx="44" cy="61" r="2.2"/></g>';
    return '<svg viewBox="0 0 64 66" aria-hidden="true">' + s + '</svg>';
  }
  var DROP = '<svg class="wx-drop" viewBox="0 0 12 16" aria-hidden="true"><path d="M6 1C6 1 1 7.5 1 10.5a5 5 0 0 0 10 0C11 7.5 6 1 6 1Z" fill="currentColor"/></svg>';
  var ARROW = '<svg class="wx-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2L19 20L12 16L5 20Z" fill="currentColor"/></svg>';
  var PIN = '<svg class="wx-pin" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7Zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2Z" fill="currentColor"/></svg>';
  var COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  // ---------- test data (?wx=) ----------
  var FAKE = {
    clear: { code: 0, t: 27, h: 38, w: 9, cc: 4 }, partly: { code: 2, t: 25, h: 50, w: 12, cc: 45 },
    overcast: { code: 3, t: 21, h: 72, w: 14, cc: 98 }, fog: { code: 45, t: 11, h: 98, w: 3, cc: 80 },
    drizzle: { code: 53, t: 17, h: 92, w: 10, cc: 95, pr: 0.4 }, rain: { code: 63, t: 19, h: 90, w: 22, cc: 100, pr: 3.4 },
    heavy: { code: 65, t: 18, h: 96, w: 44, g: 72, cc: 100, pr: 14 }, freezing: { code: 67, t: -1, h: 93, w: 16, cc: 100, pr: 2 },
    snow: { code: 73, t: -3, h: 88, w: 12, cc: 96, sf: 1.1 }, heavysnow: { code: 75, t: -7, h: 90, w: 32, cc: 100, sf: 3 },
    thunder: { code: 95, t: 24, h: 88, w: 34, g: 61, cc: 100, pr: 9 }, hail: { code: 99, t: 21, h: 90, w: 38, g: 70, cc: 100, pr: 11 },
    wind: { code: 1, t: 22, h: 40, w: 52, g: 80, cc: 20 }, hot: { code: 0, t: 42, h: 14, w: 7, cc: 2 },
  };
  var FAKE_ALIAS = { cloudy: 'overcast', heavyrain: 'heavy', storm: 'thunder', thunderstorm: 'thunder', sun: 'clear', windy: 'wind' };
  function fakeData(state, loc, tzSec, nowL) {
    var f = FAKE[state] || FAKE.clear, day0 = Math.floor(nowL / DAY) * DAY, tzH = tzSec / 3600;
    var seq = [f.code, f.code, 3, 2, 1, 0, 2, 61, 63, 80, 95, 45, 71, 73, 0, 1];
    var H = { time: [], temperature_2m: [], precipitation_probability: [], weather_code: [], cloud_cover: [], wind_speed_10m: [], is_day: [] };
    var nowIdx = Math.floor((nowL - day0) / HOUR);
    for (var i = 0; i < 168; i++) {
      var L = day0 + i * HOUR, hr = i % 24, st = solar(Math.floor(L / DAY) * DAY, loc.lat, loc.lon, tzH);
      var code = i <= nowIdx + 4 ? f.code : seq[Math.floor((i - nowIdx - 5) / 3) % seq.length];
      H.time.push(fmtL(L));
      H.temperature_2m.push(Math.round((f.t + 4 * (Math.sin((hr - 9) / 24 * 2 * Math.PI) - Math.sin((nowIdx % 24 - 9) / 24 * 2 * Math.PI)) + Math.sin(i / 17) - Math.sin(nowIdx / 17)) * 10) / 10);
      H.weather_code.push(code);
      H.precipitation_probability.push(stateOf(code) === 'clear' || stateOf(code) === 'partly' ? 5 : stateOf(code) === 'overcast' || stateOf(code) === 'fog' ? 20 : 80);
      H.cloud_cover.push(stateOf(code) === 'clear' ? 5 : stateOf(code) === 'partly' ? 45 : 98);
      H.wind_speed_10m.push(Math.round(f.w * (0.8 + 0.4 * Math.sin(i / 5))));
      H.is_day.push(L > st[0] && L < st[1] ? 1 : 0);
    }
    var dseq = [f.code, 2, 61, 95, 0, 73, 45], D = { time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [], sunrise: [], sunset: [], precipitation_probability_max: [], uv_index_max: [] };
    for (var d = 0; d < 7; d++) {
      var dl = day0 + d * DAY, ss = solar(dl, loc.lat, loc.lon, tzH);
      D.time.push(fmtL(dl).slice(0, 10)); D.weather_code.push(dseq[d]);
      D.temperature_2m_max.push(f.t + 4 + (d % 3)); D.temperature_2m_min.push(f.t - 5 - (d % 2));
      D.sunrise.push(fmtL(ss[0])); D.sunset.push(fmtL(ss[1]));
      D.precipitation_probability_max.push([30, 10, 70, 85, 0, 60, 20][d]); D.uv_index_max.push(5);
    }
    return {
      utc_offset_seconds: tzSec, fake: true,
      current: { time: fmtL(nowL), temperature_2m: f.t, apparent_temperature: f.t + (f.h > 70 ? 2 : -1), relative_humidity_2m: f.h, is_day: 1,
        precipitation: f.pr || 0, rain: f.pr || 0, showers: 0, snowfall: f.sf || 0, weather_code: f.code, cloud_cover: f.cc,
        wind_speed_10m: f.w, wind_direction_10m: 250, wind_gusts_10m: f.g || Math.round(f.w * 1.5) },
      hourly: H, daily: D,
    };
  }

  // ---------- styles ----------
  var CSS = [
    '.t-weather{--acc:#ffd28a;font-family:"Instrument Sans","Segoe UI",sans-serif;color:#f4f6fb;background:#04060c;overflow:hidden;}',
    '.t-weather .wx-cv{position:absolute;inset:0;width:100%;height:100%;display:block;}',
    '.t-weather .wx-vig{position:absolute;inset:0;pointer-events:none;background:',
    ' linear-gradient(180deg,rgba(2,6,16,.3) 0%,rgba(2,6,16,.08) 24%,rgba(2,6,16,0) 40%),',
    ' linear-gradient(0deg,rgba(2,5,12,.55) 0%,rgba(2,5,12,0) 30%),',
    ' radial-gradient(ellipse 90% 85% at 50% 48%,rgba(0,0,0,0) 62%,rgba(0,0,0,.42) 100%);}',
    '.t-weather .wx-ui{position:absolute;inset:0;will-change:transform;}',
    '.t-weather .wx-clock{position:absolute;left:4.6vw;top:6vh;text-shadow:0 .15vw 1.6vw rgba(0,8,24,.55);}',
    '.t-weather .wx-time{font-family:"Fraunces",Georgia,serif;font-style:italic;font-weight:300;font-size:8.6vw;line-height:.9;letter-spacing:-.03em;white-space:nowrap;}',
    '.t-weather .wx-ampm{font-family:"Instrument Sans",sans-serif;font-style:normal;font-size:1.7vw;letter-spacing:.22em;margin-left:.9vw;opacity:.78;text-transform:uppercase;}',
    '.t-weather .wx-date{margin-top:2vh;font-size:1.3vw;letter-spacing:.32em;text-transform:uppercase;opacity:.92;}',
    '.t-weather .wx-city{margin-top:1.1vh;font-size:1.25vw;opacity:.82;display:flex;align-items:center;gap:.5vw;letter-spacing:.04em;}',
    '.t-weather .wx-pin{width:1.15vw;height:1.15vw;color:var(--acc);}',
    '.t-weather .wx-chips{margin-top:1.3vh;display:flex;gap:.7vw;flex-wrap:wrap;}',
    '.t-weather .wx-chip{font:400 .78vw/1 "IBM Plex Mono",monospace;letter-spacing:.14em;text-transform:uppercase;padding:.45vw .7vw;border-radius:2vw;',
    ' background:rgba(8,12,22,.38);border:.08vw solid rgba(255,255,255,.18);opacity:.85;}',
    '.t-weather .wx-chip.test{color:#ffcf7a;border-color:rgba(255,190,90,.6);}',
    '.t-weather .wx-now{position:absolute;right:4.6vw;top:6vh;text-align:right;text-shadow:0 .15vw 1.6vw rgba(0,8,24,.55);}',
    '.t-weather .wx-temp{font-family:"Fraunces",Georgia,serif;font-weight:300;font-size:7.8vw;line-height:.9;letter-spacing:-.02em;}',
    '.t-weather .wx-cond{font-size:2.1vw;font-weight:500;margin-top:1.2vh;letter-spacing:.01em;}',
    '.t-weather .wx-meta{display:flex;justify-content:flex-end;align-items:center;gap:1.5vw;margin-top:1.5vh;font-size:1.18vw;opacity:.9;}',
    '.t-weather .wx-meta b{font-weight:600;}',
    '.t-weather .wx-arrow{width:1.25vw;height:1.25vw;vertical-align:-.2vw;margin-right:.35vw;color:var(--acc);transition:transform 2s ease;}',
    '.t-weather .wx-sun{margin-top:1vh;font-size:1.08vw;opacity:.78;}',
    '.t-weather .wx-phase{margin-top:1.8vh;font:400 .82vw "IBM Plex Mono",monospace;letter-spacing:.32em;text-transform:uppercase;color:var(--acc);opacity:.85;}',
    '.t-weather .wx-prev{position:absolute;left:50%;top:4.2vh;transform:translateX(-50%) translateY(-1vh);padding:.7vw 1.5vw;border-radius:3vw;white-space:nowrap;',
    ' background:rgba(8,12,22,.5);border:.1vw solid rgba(255,255,255,.22);font-size:1.15vw;letter-spacing:.05em;opacity:0;transition:opacity .5s ease,transform .5s ease;}',
    '.t-weather .wx-prev.on{opacity:1;transform:translateX(-50%);}',
    '.t-weather .wx-prev i{font-style:normal;color:var(--acc);font-weight:600;letter-spacing:.12em;text-transform:uppercase;font-size:.95vw;margin-right:.5vw;}',
    '.t-weather .wx-strip{position:absolute;left:0;right:0;bottom:4vh;transition:opacity .7s ease,transform .7s cubic-bezier(.2,.8,.2,1);}',
    '.t-weather .wx-strip.away{opacity:0;transform:translateY(3vh);}',
    '.t-weather .wx-tabs{margin-left:4.6vw;display:flex;gap:2vw;font:400 .85vw "IBM Plex Mono",monospace;letter-spacing:.26em;text-transform:uppercase;}',
    '.t-weather .wx-tab{opacity:.45;padding-bottom:.4vw;border-bottom:.15vw solid transparent;transition:opacity .4s,border-color .4s,color .4s;}',
    '.t-weather .wx-tab.on{opacity:1;color:var(--acc);border-color:var(--acc);}',
    '.t-weather .wx-view{position:relative;overflow:hidden;padding:1.1vw 0 1.1vw 4.6vw;margin-top:.4vh;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 4vw,#000 calc(100% - 4vw),transparent 100%);}',
    '.t-weather .wx-track{display:flex;gap:.9vw;transition:transform .6s cubic-bezier(.22,.9,.24,1);}',
    '.t-weather .wx-tile{flex:none;width:7.3vw;height:10.2vw;box-sizing:border-box;border-radius:1vw;padding:1vw .3vw .9vw;display:flex;flex-direction:column;align-items:center;justify-content:space-between;',
    ' background:linear-gradient(180deg,rgba(255,255,255,.15),rgba(255,255,255,.05));border:.1vw solid rgba(255,255,255,.15);',
    ' box-shadow:0 .8vw 2vw rgba(0,0,0,.28);transition:transform .45s cubic-bezier(.2,.8,.2,1),background .45s,border-color .45s,box-shadow .45s;}',
    '.t-weather .wx-7d .wx-tile{width:11.7vw;}',
    '.t-weather .wx-tile.sel{transform:scale(1.08);background:linear-gradient(180deg,rgba(255,255,255,.32),rgba(255,255,255,.12));border-color:var(--acc);',
    ' box-shadow:0 0 0 .12vw var(--acc),0 1vw 2.6vw rgba(0,0,0,.45);}',
    '.t-weather .wx-tl{font-size:1.05vw;opacity:.88;letter-spacing:.04em;white-space:nowrap;}',
    '.t-weather .wx-ic svg{width:3.6vw;height:3.7vw;display:block;filter:drop-shadow(0 .2vw .4vw rgba(0,0,0,.3));}',
    '.t-weather .wx-tt{font-size:1.6vw;font-weight:600;white-space:nowrap;}',
    '.t-weather .wx-tt small{font-size:1.15vw;font-weight:400;opacity:.6;margin-left:.3vw;}',
    '.t-weather .wx-tp{font-size:.92vw;color:#a8d4ff;display:flex;align-items:center;gap:.25vw;}',
    '.t-weather .wx-tp.dry{opacity:.35;}',
    '.t-weather .wx-drop{width:.62vw;height:.85vw;}',
    '.t-weather .wx-empty{font-size:1.2vw;opacity:.7;padding:3vw 0;}',
    '.t-weather .wx-hint{position:absolute;right:4.6vw;bottom:3.4vh;font:400 .85vw "IBM Plex Mono",monospace;letter-spacing:.2em;opacity:0;transition:opacity .7s ease;}',
    '.t-weather .wx-strip.away ~ .wx-hint{opacity:.55;}',
    '.t-weather .wx-flash{position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse 120% 90% at 50% 10%,rgba(225,228,255,1),rgba(190,198,255,.45) 55%,rgba(160,170,230,.2));}',
    '.t-weather .wx-dim{position:absolute;inset:0;pointer-events:none;background:#000;opacity:0;transition:opacity 4s ease;}',
    '.t-weather.calm .wx-dim{opacity:.3;}',
  ].join('\n');

  function create(root, api) {
    var params = new URLSearchParams(location.search);
    root.classList.add('t-weather');
    root.innerHTML = '<style>' + CSS + '</style><canvas class="wx-cv"></canvas><div class="wx-vig"></div>' +
      '<div class="wx-ui">' +
      '<div class="wx-clock"><div class="wx-time"><span class="wx-hm">--:--</span><span class="wx-ampm"></span></div><div class="wx-date"></div>' +
      '<div class="wx-city">' + PIN + '<span class="wx-cityname"></span></div><div class="wx-chips"></div></div>' +
      '<div class="wx-now"><div class="wx-temp"></div><div class="wx-cond"></div><div class="wx-meta"></div><div class="wx-sun"></div><div class="wx-phase"></div></div>' +
      '<div class="wx-prev"></div>' +
      '<div class="wx-strip away"><div class="wx-tabs"><span class="wx-tab" data-m="now">Now</span><span class="wx-tab" data-m="24h">Next 24 hours</span><span class="wx-tab" data-m="7d">7 days</span></div>' +
      '<div class="wx-view"><div class="wx-track"></div></div></div>' +
      '<div class="wx-hint">◀ ▶ forecast · OK view</div>' +
      '</div><div class="wx-flash"></div><div class="wx-dim"></div>';
    var q = function (s) { return root.querySelector(s); };
    var cv = q('.wx-cv'), ctx = cv.getContext('2d', { alpha: false });
    var ui = q('.wx-ui'), elHM = q('.wx-hm'), elAP = q('.wx-ampm'), elDate = q('.wx-date'), elCity = q('.wx-cityname'), elChips = q('.wx-chips');
    var elTemp = q('.wx-temp'), elCond = q('.wx-cond'), elMeta = q('.wx-meta'), elSun = q('.wx-sun'), elPhase = q('.wx-phase');
    var elPrev = q('.wx-prev'), strip = q('.wx-strip'), view = q('.wx-view'), track = q('.wx-track'), elFlash = q('.wx-flash');
    var tabs = root.querySelectorAll('.wx-tab');

    var dead = false, raf = 0, lastTs = 0, T = 0, iv = 0, fetchT = 0, inflight = null, fails = 0;
    var reduced = !!api.reduced, calm = api.calm();

    // ---------- location + data ----------
    var loc = DEFAULT_LOC;
    (function () {
      function ok(l) { return l && isFinite(+l.lat) && isFinite(+l.lon) && l.lat !== null && l.lon !== null; }
      var l = window.AMBIENT_LOCATION;
      if (!ok(l)) { try { l = JSON.parse(localStorage.getItem('ambient.location')); } catch (e) { l = null; } }
      if (ok(l)) loc = { name: l.name || 'Your location', lat: +l.lat, lon: +l.lon };
    })();
    var wxParam = (params.get('wx') || '').toLowerCase();
    var fake = wxParam ? (FAKE_ALIAS[wxParam] || wxParam) : '';
    if (fake && !FAKE[fake]) fake = 'clear';
    var boltTest = !!fake && params.has('wxbolt');     // test only: holds a lightning strike on screen
    var data = null, dataT = 0, hT = [], sunCache = {};
    function tzSec() { return data && isFinite(data.utc_offset_seconds) ? data.utc_offset_seconds : -new Date().getTimezoneOffset() * 60; }
    function nowL() { return api.now().getTime() + tzSec() * 1000; }

    function setData(j, t) {
      data = j; dataT = t; sunCache = {};
      hT = (j.hourly && j.hourly.time || []).map(parseL);
      buildTiles(); refreshNow(); live = liveParams();
    }
    if (fake) { data = fakeData(fake, loc, -new Date().getTimezoneOffset() * 60, api.now().getTime() - new Date().getTimezoneOffset() * 6e4); dataT = Date.now(); hT = data.hourly.time.map(parseL); }
    else {
      try {
        var c = JSON.parse(localStorage.getItem('ambient.weather'));
        if (c && c.data && c.data.current && Math.abs(c.lat - loc.lat) < 0.05 && Math.abs(c.lon - loc.lon) < 0.05 && Date.now() - c.t < 3 * DAY) { data = c.data; dataT = c.t; hT = (data.hourly && data.hourly.time || []).map(parseL); }
      } catch (e) {}
    }
    function url() {
      return 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat.toFixed(4) + '&longitude=' + loc.lon.toFixed(4) +
        '&current=temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m' +
        '&hourly=temperature_2m,precipitation_probability,weather_code,cloud_cover,wind_speed_10m,is_day' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,uv_index_max&timezone=auto&forecast_days=7';
    }
    function schedule(ms) { clearTimeout(fetchT); fetchT = setTimeout(load, ms); }
    function load() {
      if (dead || fake) return;
      if (document.hidden) { schedule(60000); return; }
      var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var to = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
      inflight = ctl;
      fetch(url(), ctl ? { signal: ctl.signal, cache: 'no-store' } : { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (j) {
          clearTimeout(to); inflight = null;
          if (dead) return;
          if (!j || !j.current || !j.hourly || !j.daily) throw new Error('bad data');
          var t = Date.now();
          try { localStorage.setItem('ambient.weather', JSON.stringify({ t: t, lat: loc.lat, lon: loc.lon, data: j })); } catch (e) {}
          fails = 0; setData(j, t); schedule(REFRESH);
        })
        .catch(function () {
          clearTimeout(to); inflight = null;
          if (dead) return;
          fails++; refreshNow();
          schedule(Math.min(REFRESH, 30000 * Math.pow(2, fails - 1)));
        });
    }

    function sunTimes(dayL) {
      var k = 'd' + dayL; if (sunCache[k]) return sunCache[k];
      var r = null, D = data && data.daily;
      if (D && D.time && D.sunrise) {
        for (var i = 0; i < D.time.length; i++) if (parseL(D.time[i]) === dayL && D.sunrise[i] && D.sunset[i]) { r = [parseL(D.sunrise[i]), parseL(D.sunset[i])]; break; }
      }
      if (!r) r = solar(dayL, loc.lat, loc.lon, tzSec() / 3600);
      sunCache[k] = r; return r;
    }
    function skyAt(L) {
      var d0 = Math.floor(L / DAY) * DAY, st = sunTimes(d0), sr = st[0], ss = st[1], noon = (sr + ss) / 2;
      var de = declination(d0), la = loc.lat * RAD, h = (L - noon) / 6e4 / 4 * RAD;
      var el = Math.asin(clamp(Math.sin(la) * Math.sin(de) + Math.cos(la) * Math.cos(de) * Math.cos(h), -1, 1)) / RAD;
      var r = { el: el, noonEl: Math.max(15, 90 - Math.abs(loc.lat - de / RAD)), pm: L > noon ? 1 : 0, p: clamp((L - sr) / (ss - sr), 0, 1), q: 0.5, sr: sr, ss: ss, noon: noon };
      if (L < sr) { var ps = sunTimes(d0 - DAY)[1]; r.q = clamp((L - ps) / (sr - ps), 0, 1); }
      else if (L > ss) { var nr = sunTimes(d0 + DAY)[0]; r.q = clamp((L - ss) / (nr - ss), 0, 1); }
      return r;
    }
    function phaseName(sk, L) {
      var el = sk.el;
      if (el > 0 && Math.abs(L - sk.noon) < 75 * 6e4) return 'Noon';
      if (!sk.pm) return el < -12 ? 'Night' : el < -4 ? 'Pre-dawn' : el < 3 ? 'Sunrise' : 'Morning';
      return el < -12 ? 'Night' : el < -4 ? 'Blue hour' : el < 2 ? 'Sunset' : el < 10 ? 'Golden hour' : 'Afternoon';
    }

    // the live weather: current block, or the hourly slot for now if the cache is old
    function liveInfo() {
      if (!data) return null;
      var c = data.current, L = nowL(), age = Date.now() - dataT;
      var info = { code: c.weather_code, temp: c.temperature_2m, feels: c.apparent_temperature, hum: c.relative_humidity_2m, wind: c.wind_speed_10m, dir: c.wind_direction_10m, cloud: c.cloud_cover, precip: c.precipitation, snowfall: c.snowfall };
      if (age > 45 * 6e4 && hT.length) {
        var i = hourIndex(L), H = data.hourly;
        if (i >= 0) { info.code = H.weather_code[i]; info.temp = H.temperature_2m[i]; info.cloud = H.cloud_cover[i]; info.wind = H.wind_speed_10m[i]; info.precip = null; info.snowfall = null; info.feels = null; }
      }
      return info;
    }
    function hourIndex(L) { for (var i = 0; i < hT.length; i++) if (hT[i] <= L && L < hT[i] + HOUR) return i; return -1; }
    function liveParams() {
      var i = liveInfo();
      if (!i) { var p = sceneParams(0, {}); p.cloud = 0.14; return p; }
      return sceneParams(i.code, { cloud: i.cloud, precip: i.precip, snowfall: i.snowfall, wind: i.wind, dir: i.dir, temp: i.temp });
    }
    var live = liveParams();

    // ---------- modes / tiles ----------
    var mode = 'now', sel = 0, idle = 0, items = [], tiles = [], preview = null;
    function buildTiles() {
      items = []; tiles = []; track.innerHTML = '';
      view.classList.toggle('wx-7d', mode === '7d');
      for (var t = 0; t < tabs.length; t++) tabs[t].classList.toggle('on', tabs[t].getAttribute('data-m') === mode);
      if (!data || !hT.length) { track.innerHTML = '<div class="wx-empty">The forecast appears once the weather loads.</div>'; return; }
      var H = data.hourly, D = data.daily, L = nowL(), html = '';
      var dirNow = data.current ? data.current.wind_direction_10m : 0;
      if (mode === '7d') {
        var d0 = Math.floor(L / DAY) * DAY;
        for (var j = 0; j < D.time.length && items.length < 7; j++) {
          var dl = parseL(D.time[j]); if (dl < d0) continue;
          var mid = dl + 14 * HOUR, hi = Math.round((mid - hT[0]) / HOUR), hv = hi >= 0 && hi < hT.length;
          var it = { kind: 'day', L: mid, code: D.weather_code[j], temp: D.temperature_2m_max[j], cloud: hv ? H.cloud_cover[hi] : null, wind: hv ? H.wind_speed_10m[hi] : 0, dir: dirNow,
            label: items.length === 0 ? 'Today' : api.DAYS[new Date(dl).getUTCDay()].slice(0, 3), long: items.length === 0 ? 'Today' : api.DAYS[new Date(dl).getUTCDay()] };
          items.push(it);
          var pr = D.precipitation_probability_max ? D.precipitation_probability_max[j] : null;
          html += '<div class="wx-tile"><div class="wx-tl">' + it.label + '</div><div class="wx-ic">' + icon(it.code, true) + '</div>' +
            '<div class="wx-tt">' + Math.round(D.temperature_2m_max[j]) + '°<small>' + Math.round(D.temperature_2m_min[j]) + '°</small></div>' +
            '<div class="wx-tp' + (pr > 0 ? '' : ' dry') + '">' + DROP + (pr == null ? '–' : pr + '%') + '</div></div>';
        }
      } else {
        var i0 = hourIndex(L); if (i0 < 0) i0 = 0;
        for (var i = i0; i < hT.length && items.length < 24; i++) {
          var it2 = { kind: 'hour', L: hT[i] + 30 * 6e4, code: H.weather_code[i], temp: H.temperature_2m[i], cloud: H.cloud_cover[i], wind: H.wind_speed_10m[i], dir: dirNow,
            label: items.length === 0 ? 'Now' : h12L(hT[i], false), isDay: H.is_day ? H.is_day[i] : 1 };
          var dd = new Date(hT[i]); it2.long = api.DAYS[dd.getUTCDay()].slice(0, 3) + ' ' + h12L(hT[i], false);
          items.push(it2);
          var pp = H.precipitation_probability ? H.precipitation_probability[i] : null;
          html += '<div class="wx-tile"><div class="wx-tl">' + it2.label + '</div><div class="wx-ic">' + icon(it2.code, !!it2.isDay) + '</div>' +
            '<div class="wx-tt">' + Math.round(it2.temp) + '°</div>' +
            '<div class="wx-tp' + (pp > 0 ? '' : ' dry') + '">' + DROP + (pp == null ? '–' : pp + '%') + '</div></div>';
        }
      }
      track.innerHTML = html;
      tiles = Array.prototype.slice.call(track.children);
      sel = clamp(sel, 0, Math.max(0, items.length - 1));
      markSel();
    }
    function markSel() {
      var on = mode !== 'now';
      tiles.forEach(function (t, i) { t.classList.toggle('sel', on && i === sel); });
      if (!tiles.length) return;
      var step = tiles.length > 1 ? tiles[1].offsetLeft - tiles[0].offsetLeft : tiles[0].offsetWidth;
      var maxShift = Math.max(0, track.scrollWidth - view.clientWidth + view.clientWidth * 0.05);
      var shift = on ? clamp((sel - 3) * step, 0, maxShift) : 0;
      track.style.transform = 'translateX(' + (-shift) + 'px)';
      // preview
      var it = on && sel > 0 ? items[sel] : null;
      preview = it ? { L: it.L, p: sceneParams(it.code, { cloud: it.cloud, wind: it.wind, dir: it.dir, temp: it.temp }) } : null;
      if (it) {
        elPrev.innerHTML = '<i>Preview</i>' + it.long + ' · ' + wordOf(it.code) + ' · ' + Math.round(it.temp) + '°';
        elPrev.classList.add('on');
      } else elPrev.classList.remove('on');
    }
    function setMode(m) { mode = m; sel = 0; buildTiles(); }
    function wake() { idle = 0; strip.classList.remove('away'); }

    // ---------- UI text ----------
    function refreshClock() {
      var d = api.now(), h = d.getHours();
      var hm = (h % 12 || 12) + ':' + api.pad(d.getMinutes());
      if (elHM.textContent !== hm) elHM.textContent = hm;
      var ap = h < 12 ? 'am' : 'pm'; if (elAP.textContent !== ap) elAP.textContent = ap;
      var ds = api.DAYS[d.getDay()] + ' · ' + d.getDate() + ' ' + api.MONTHS[d.getMonth()];
      if (elDate.textContent !== ds) elDate.textContent = ds;
    }
    function ago(ms) { var m = Math.round(ms / 6e4); return m < 2 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; }
    function refreshNow() {
      elCity.textContent = loc.name;
      var chips = '';
      if (fake) chips += '<span class="wx-chip test">Test data · wx=' + fake + '</span>';
      else if (data) chips += '<span class="wx-chip">' + (fails && Date.now() - dataT > 30 * 6e4 ? 'Offline · updated ' : 'Updated ') + ago(Date.now() - dataT) + '</span>';
      if (elChips.innerHTML !== chips) elChips.innerHTML = chips;
      var L = nowL(), sk = skyAt(L), i = liveInfo();
      elPhase.textContent = phaseName(sk, L);
      elSun.textContent = 'Sunrise ' + h12L(sk.sr, true) + '  ·  Sunset ' + h12L(sk.ss, true);
      if (!i) {
        elTemp.textContent = ''; elCond.textContent = 'Weather unavailable';
        elMeta.textContent = 'Showing the sky by time'; return;
      }
      elTemp.textContent = Math.round(i.temp) + '°';
      elCond.textContent = wordOf(i.code);
      var m = '';
      if (i.feels != null) m += '<span>Feels <b>' + Math.round(i.feels) + '°</b></span>';
      if (i.hum != null) m += '<span>Humidity <b>' + Math.round(i.hum) + '%</b></span>';
      if (i.wind != null) {
        var dir = i.dir || 0;
        m += '<span>' + ARROW.replace('class="wx-arrow"', 'class="wx-arrow" style="transform:rotate(' + Math.round(dir + 180) + 'deg)"') +
          '<b>' + Math.round(i.wind) + '</b> km/h ' + COMPASS[Math.round(dir / 45) % 8] + '</span>';
      }
      if (elMeta.innerHTML !== m) elMeta.innerHTML = m;
    }

    // ---------- canvas geometry + static layers ----------
    var W = 0, H = 0, S = 1, HZ = 0, SHORE = 0, LW = 0;
    var stars = null, twinklers = [], far = null, midL = null, city = null, lights = null, facets = null, refl = null, blinkers = [], glitter = [];
    var cloudSprites = [], clouds = [], fogSprite = null, dotSprite = null, moonSpr = null, moonKey = '';
    var tmpC = null;
    function size() {
      var iw = Math.max(320, innerWidth), ih = Math.max(180, innerHeight);
      W = Math.min(1280, iw); H = Math.round(W * ih / iw); S = W / 1280;
      cv.width = W; cv.height = H; HZ = Math.round(H * 0.74); SHORE = Math.round(H * 0.865); LW = Math.round(W * 1.08);
      buildStars(); buildLand(); buildClouds(); buildMisc(); lastTint = null;
    }
    function radialSprite(r, inner) {
      var c = mk(r * 2, r * 2), g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(inner, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return c;
    }
    function buildStars() {
      var r = api.rng(9001), c = mk(W, HZ), g = c.getContext('2d');
      // milky way: a faint diagonal band of soft blobs and dense dim stars
      for (var i = 0; i < 220; i++) {
        var t = r(), bx = lerp(0.05, 0.95, t) * W, by = lerp(-0.05, 0.85, t) * HZ, off = (r() - 0.5) * 0.16 * W;
        var x = bx + off * 0.7, y = by - off * 0.45, rad = (12 + r() * 34) * S;
        var gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, 'rgba(190,200,255,' + (0.022 + r() * 0.03).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(190,200,255,0)');
        g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        g.fillStyle = 'rgba(230,235,255,' + (0.2 + r() * 0.4).toFixed(2) + ')'; g.fillRect(x + (r() - 0.5) * 40 * S, y + (r() - 0.5) * 40 * S, 0.9 * S + 0.3, 0.9 * S + 0.3);
      }
      twinklers = [];
      var cols = ['#ffffff', '#dfe8ff', '#cfdcff', '#fff1dc', '#ffe2c4'];
      for (var k = 0; k < 460; k++) {
        var sx = r() * W, sy = Math.pow(r(), 1.35) * HZ * 0.98, sz = (0.5 + Math.pow(r(), 3) * 1.4) * S + 0.2, a = 0.25 + r() * 0.75;
        g.globalAlpha = a * (1 - smooth(0.7, 1, sy / HZ) * 0.7); g.fillStyle = cols[(r() * cols.length) | 0];
        g.beginPath(); g.arc(sx, sy, sz, 0, 6.283); g.fill();
        if (k < 36) twinklers.push({ x: sx, y: sy, s: sz * 1.6 + 0.6, ph: r() * 6.28, f: 0.6 + r() * 1.6 });
      }
      g.globalAlpha = 1; stars = c;
    }
    function fbm(r, oct) {
      var ph = [], fr = [], am = [];
      for (var i = 0; i < oct; i++) { ph.push(r() * 100); fr.push(Math.pow(2.1, i) * (0.9 + r() * 0.3)); am.push(Math.pow(0.5, i)); }
      return function (x) { var v = 0; for (var i = 0; i < oct; i++) v += am[i] * Math.sin(x * fr[i] + ph[i]); return v; };
    }
    function layer(y0, y1) { var m = mk(LW, y1 - y0); return { y0: y0, m: m, c: mk(LW, y1 - y0), cap: null, capT: null }; }
    function capOf(L, d, peakY) {      // the top edge of a silhouette (for snow on ridges and roofs)
      var c = mk(L.m.width, L.m.height), g = c.getContext('2d');
      g.drawImage(L.m, 0, 0); g.globalCompositeOperation = 'destination-out'; g.drawImage(L.m, 0, d);
      if (peakY) {               // snow line: only the peaks keep their caps, fading out below
        var gr = g.createLinearGradient(0, peakY - d, 0, peakY + d);
        gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalCompositeOperation = 'destination-in'; g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
      }
      L.cap = c; L.capT = mk(c.width, c.height);
    }
    function buildLand() {
      var r = api.rng(4242), x, y, g;
      // far mountains
      far = layer(Math.round(HZ - H * 0.2), SHORE + 4); g = far.m.getContext('2d');
      var n1 = fbm(r, 5), n2 = fbm(r, 4);
      g.fillStyle = '#000'; g.beginPath(); g.moveTo(0, far.m.height);
      for (x = 0; x <= LW; x += 3) { var u = x / LW * 6.5; y = HZ - far.y0 - H * (0.07 + 0.045 * n1(u) + 0.02 * Math.abs(n1(u * 3.3))); g.lineTo(x, y); }
      g.lineTo(LW, far.m.height); g.closePath(); g.fill();
      capOf(far, Math.round(16 * S) + 2, HZ - far.y0 - H * 0.085);
      // mid hills with a fringe of trees
      midL = layer(Math.round(HZ - H * 0.08), SHORE + 4); g = midL.m.getContext('2d');
      var ridge = function (xx) { var u = xx / LW * 4; return HZ - midL.y0 + H * 0.012 - H * (0.03 + 0.022 * n2(u)); };
      g.fillStyle = '#000'; g.beginPath(); g.moveTo(0, midL.m.height);
      for (x = 0; x <= LW; x += 4) g.lineTo(x, ridge(x));
      g.lineTo(LW, midL.m.height); g.closePath(); g.fill();
      for (x = 0; x < LW; x += (3 + r() * 6) * S) {
        var th = (4 + r() * 10) * S, ry = ridge(x);
        g.beginPath(); g.ellipse(x, ry - th * 0.45, (2.5 + r() * 3.5) * S, th * 0.6, 0, 0, 6.283); g.fill();
      }
      capOf(midL, Math.round(3 * S) + 1);
      // city on the shore
      city = layer(Math.round(SHORE - H * 0.26), SHORE + Math.round(H * 0.012)); g = city.m.getContext('2d');
      lights = mk(LW, city.m.height); var lg = lights.getContext('2d');
      facets = mk(LW, city.m.height); var fg = facets.getContext('2d');
      refl = mk(LW, H - SHORE); var rg = refl.getContext('2d');
      blinkers = [];
      var base = SHORE - city.y0;
      g.fillStyle = '#000'; g.fillRect(0, base - 3 * S, LW, city.m.height);
      var wins = ['#ffd98a', '#ffe6b0', '#fff2d8', '#ffcf7a', '#c9e4ff'];
      for (x = -10; x < LW;) {
        var fx = x / LW, down = smooth(0.42, 0.55, fx) * (1 - smooth(0.8, 0.9, fx));
        var bw = (12 + r() * 30) * S, bh = (12 + r() * 30 + down * (40 + r() * 120)) * S;
        if (r() < 0.12 && !down) { x += bw * 0.6; continue; }         // gaps between low-rise blocks
        var top = base - bh;
        g.fillRect(x, top, bw, bh + 4);
        fg.fillStyle = 'rgba(255,255,255,' + (0.35 + r() * 0.45).toFixed(2) + ')'; fg.fillRect(x, top, bw * (0.3 + r() * 0.25), bh);
        fg.fillStyle = 'rgba(255,255,255,.9)'; fg.fillRect(x, top, bw, Math.max(1, S));
        if (bh > 70 * S && r() < 0.5) { g.fillRect(x + bw * 0.2, top - bh * 0.12, bw * 0.6, bh * 0.12 + 1); top -= bh * 0.12; }   // setback
        if (bh > 90 * S && r() < 0.55) { var sx = x + bw * (0.3 + r() * 0.4); g.fillRect(sx - S, top - 26 * S, 2 * S + 0.5, 26 * S); blinkers.push({ x: sx, y: top - 26 * S, ph: r() * 6 }); }
        // windows
        if (bh > 18 * S) {
          var ww = 2 * S + 0.4, wh = 2.6 * S + 0.4, gx = 5.2 * S, gy = 6.4 * S, lit = 0.22 + down * 0.18;
          for (var wy = top + 5 * S; wy < base - 5 * S; wy += gy) {
            for (var wx = x + 3 * S; wx < x + bw - 4 * S; wx += gx) {
              if (r() < lit) {
                var col = wins[(r() * wins.length) | 0], a = 0.55 + r() * 0.45;
                lg.globalAlpha = a; lg.fillStyle = col; lg.fillRect(wx, wy, ww, wh);
                if (r() < 0.35) {        // its reflection on the water, stretched and soft
                  var dep = base - wy, ry2 = dep * 0.6, len = (6 + r() * 10) * S;
                  var gr2 = rg.createLinearGradient(0, ry2 - len * 0.3, 0, ry2 + len);
                  gr2.addColorStop(0, 'rgba(255,220,160,0)'); gr2.addColorStop(0.3, col); gr2.addColorStop(1, 'rgba(255,220,160,0)');
                  rg.globalAlpha = a * 0.45; rg.fillStyle = gr2; rg.fillRect(wx - 0.5, ry2 - len * 0.3, ww + 1.5 * S, len * 1.3);
                }
              }
            }
          }
        }
        x += bw + (r() < 0.3 ? r() * 6 * S : 0);
      }
      lg.globalAlpha = 1; rg.globalAlpha = 1;
      capOf(city, Math.round(2 * S) + 1);
      glitter = [];
      for (var k = 0; k < 44; k++) glitter.push({ fy: Math.pow(r(), 1.3), dx: (r() - 0.5), w: 0.5 + r(), ph: r() * 6.28, f: 1 + r() * 2.5 });
    }
    function buildCloudSprite(r, flat) {
      // many small puffs on a dome profile give a cauliflower edge; a second, offset set of puffs is the sunlit side
      var w = flat ? 640 : 512, h = flat ? 170 : 280;
      var shape = mk(w, h), light = mk(w, h), gs = shape.getContext('2d'), gl = light.getContext('2d');
      var base = h * (flat ? 0.6 : 0.8), n = flat ? 46 : 40, blobs = [];
      for (var i = 0; i < n; i++) {
        var fx = 0.08 + r() * 0.84, dome = Math.max(0, 1 - Math.pow((fx - 0.5) / 0.46, 2));
        var rad = w * (flat ? 0.025 + r() * 0.045 : 0.03 + (0.04 + r() * 0.07) * dome);
        var y = flat ? base - rad * 0.3 - r() * h * 0.18 * dome : base - rad * 0.55 - Math.sqrt(r()) * h * 0.5 * dome;
        blobs.push({ x: fx * w, y: y, r: rad });
      }
      blobs.sort(function (a, b) { return b.y - a.y; });
      blobs.forEach(function (b) {
        var g1 = gs.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g1.addColorStop(0, 'rgba(0,0,0,1)'); g1.addColorStop(0.68, 'rgba(0,0,0,.95)'); g1.addColorStop(0.9, 'rgba(0,0,0,.42)'); g1.addColorStop(1, 'rgba(0,0,0,0)');
        gs.save(); if (flat) { gs.translate(0, b.y); gs.scale(1, 0.6); gs.translate(0, -b.y); }
        gs.fillStyle = g1; gs.beginPath(); gs.arc(b.x, b.y, b.r, 0, 6.283); gs.fill(); gs.restore();
        var lx = b.x - b.r * 0.2, ly = b.y - b.r * (flat ? 0.25 : 0.4), lr = b.r * 0.82, g2 = gl.createRadialGradient(lx, ly, 0, lx, ly, lr);
        g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(0.55, 'rgba(0,0,0,.7)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
        gl.fillStyle = g2; gl.beginPath(); gl.arc(lx, ly, lr, 0, 6.283); gl.fill();
      });
      // flatten and soften the underside
      var cut = gs.createLinearGradient(0, base - h * 0.04, 0, base + h * 0.1);
      cut.addColorStop(0, 'rgba(0,0,0,1)'); cut.addColorStop(1, 'rgba(0,0,0,0)');
      gs.globalCompositeOperation = 'destination-in'; gs.fillStyle = cut; gs.fillRect(0, 0, w, h);
      // the light fades toward the base, so the bottoms stay in shadow
      var lf = gl.createLinearGradient(0, 0, 0, base);
      lf.addColorStop(0, 'rgba(0,0,0,1)'); lf.addColorStop(0.6, 'rgba(0,0,0,.85)'); lf.addColorStop(1, 'rgba(0,0,0,.15)');
      gl.globalCompositeOperation = 'destination-in'; gl.fillStyle = lf; gl.fillRect(0, 0, w, h);
      gl.drawImage(shape, 0, 0);
      return { w: w, h: h, shape: shape, light: light, out: mk(w, h), flat: flat };
    }
    function buildClouds() {
      if (!cloudSprites.length) {
        var r = api.rng(777);
        for (var i = 0; i < 6; i++) cloudSprites.push(buildCloudSprite(r, false));
        for (var j = 0; j < 3; j++) cloudSprites.push(buildCloudSprite(r, true));
        tmpC = mk(640, 280);
      }
      var rr = api.rng(31337); clouds = [];
      var ranks = []; for (var k = 0; k < 16; k++) ranks.push((k + rr()) / 16);
      for (var a = ranks.length - 1; a > 0; a--) { var b = (rr() * (a + 1)) | 0, t = ranks[a]; ranks[a] = ranks[b]; ranks[b] = t; }
      for (var d = 0; d < 6; d++) clouds.push({ L: 3, x: rr() * 1.6 - 0.3, y: (0.02 + rr() * 0.3) * H, sc: 1.9 + rr() * 0.7, sp: cloudSprites[6 + (d % 3)], rank: 0.55 + rr() * 0.4, k: 0.25 });
      for (var c = 0; c < 16; c++) {
        var L = c < 5 ? 0 : c < 11 ? 1 : 2;
        var y = L === 0 ? HZ - (0.07 + rr() * 0.12) * H : L === 1 ? (0.25 + rr() * 0.2) * H : (0.04 + rr() * 0.24) * H;
        var sc = L === 0 ? 0.32 + rr() * 0.22 : L === 1 ? 0.6 + rr() * 0.3 : 0.95 + rr() * 0.5;
        var sp = L === 0 && rr() < 0.5 ? cloudSprites[6 + ((rr() * 3) | 0)] : cloudSprites[(rr() * 6) | 0];
        clouds.push({ L: L, x: rr() * 1.6 - 0.3, y: y, sc: sc, sp: sp, rank: ranks[c], k: 0.4 + L * 0.35 });
      }
    }
    function buildMisc() {
      var r = api.rng(555);
      fogSprite = { m: mk(900, 140), c: mk(900, 140) };
      var g = fogSprite.m.getContext('2d');
      for (var i = 0; i < 40; i++) {
        var x = 60 + r() * 780, y = 70 + (r() - 0.5) * 40, rx = 60 + r() * 120;
        var gr = g.createRadialGradient(x, y, 0, x, y, rx);
        gr.addColorStop(0, 'rgba(0,0,0,.34)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.save(); g.translate(x, y); g.scale(1, 0.32); g.translate(-x, -y); g.fillStyle = gr; g.fillRect(x - rx, y - rx, rx * 2, rx * 2); g.restore();
      }
      dotSprite = radialSprite(8, 0.35);
    }
    function buildMoon(phase) {
      var R = Math.round(28 * S) + 2, D = R * 2 + 4, c = mk(D, D), g = c.getContext('2d'), cx = D / 2, cy = D / 2;
      var tex = mk(D, D), tg = tex.getContext('2d'), r = api.rng(1234);
      var gr = tg.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
      gr.addColorStop(0, '#fbfaf2'); gr.addColorStop(1, '#d9d8cf');
      tg.fillStyle = gr; tg.beginPath(); tg.arc(cx, cy, R, 0, 6.283); tg.fill();
      tg.globalCompositeOperation = 'source-atop';
      for (var i = 0; i < 22; i++) {     // maria
        var a = r() * 6.28, d = r() * R * 0.75, mr = (0.07 + r() * 0.2) * R;
        tg.fillStyle = 'rgba(130,134,145,' + (0.05 + r() * 0.08).toFixed(2) + ')';
        tg.beginPath(); tg.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, mr, 0, 6.283); tg.fill();
      }
      // lit part mask
      var m = mk(D, D), mg = m.getContext('2d'), wax = phase < 0.5, k = Math.cos(phase * 2 * Math.PI);  // k: 1 new .. -1 full
      mg.fillStyle = '#000';
      mg.beginPath(); mg.arc(cx, cy, R + 0.5, -Math.PI / 2, Math.PI / 2, !wax); mg.closePath(); mg.fill();   // lit half (right when waxing)
      mg.globalCompositeOperation = k > 0 ? 'destination-out' : 'source-over';
      mg.beginPath(); mg.ellipse(cx, cy, Math.abs(k) * R + 0.5, R + 0.5, 0, 0, 6.283); mg.fill();
      // earthshine + lit texture
      g.globalAlpha = 0.13; g.drawImage(tex, 0, 0); g.globalAlpha = 1;
      var lit = mk(D, D), lgc = lit.getContext('2d');
      lgc.drawImage(tex, 0, 0); lgc.globalCompositeOperation = 'destination-in'; lgc.drawImage(m, 0, 0);
      g.drawImage(lit, 0, 0);
      return { c: c, R: R, illum: (1 - k) / 2 };
    }

    // ---------- tinting (re-done only when the colours really move) ----------
    var lastTint = null, tintAt = 0;
    function tintInto(dst, src, color) {
      var g = dst.getContext('2d'); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, dst.width, dst.height);
      g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, dst.width, dst.height);
      g.globalCompositeOperation = 'source-over';
    }
    function retint(col) {
      tintInto(far.c, far.m, rgb(col.far)); tintInto(midL.c, midL.m, rgb(col.midc)); tintInto(city.c, city.m, rgb(col.city));
      if (cur.snow > 0.01 || cur.snowCover > 0.01) { tintInto(far.capT, far.cap, rgb(col.snowCap)); tintInto(midL.capT, midL.cap, rgb(col.snowCap)); tintInto(city.capT, city.cap, rgb(col.snowCap)); }
      tintInto(fogSprite.c, fogSprite.m, rgb(col.fog));
      var tg = tmpC.getContext('2d');
      cloudSprites.forEach(function (sp) {
        tintInto(sp.out, sp.shape, rgb(col.shade));
        tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, tmpC.width, tmpC.height); tg.drawImage(sp.light, 0, 0);
        tg.globalCompositeOperation = 'source-in'; tg.fillStyle = rgb(col.light); tg.fillRect(0, 0, sp.w, sp.h); tg.globalCompositeOperation = 'source-over';
        sp.out.getContext('2d').drawImage(tmpC, 0, 0, sp.w, sp.h, 0, 0, sp.w, sp.h);
      });
    }
    function colorKey(col) { return col.far.concat(col.light, col.shade, col.fog, col.city); }

    // ---------- scene state (crossfaded) ----------
    var cur = {}, k0;
    for (k0 in BASE) cur[k0] = live[k0];
    cur.snowCover = cur.snow > 0.3 ? 1 : 0;
    var sk0 = skyAt(nowL());
    var sky = { el: sk0.el, noonEl: sk0.noonEl, pm: sk0.pm, p: sk0.p, q: sk0.q, L: nowL() };
    var cam = { x: 0, tx: 0, y: 0, ty: 0 };
    var col = null;

    // particles
    var MAXR = 340, MAXS = 300, MAXH = 40, MAXLEAF = 24;
    var drops = [], flakes = [], hail = [], leaves = [], ripples = [], sparks = [];
    var R0 = api.rng(((Date.now() / 1000) | 0) ^ 0x51c);
    function groundY(z) { return z > 0.55 ? SHORE + (z - 0.55) / 0.45 * (H - SHORE) * (0.35 + R0() * 0.65) : HZ + R0() * (SHORE - HZ); }
    function mkP(n) { var a = []; for (var i = 0; i < n; i++) a.push({ x: 0, y: 0, z: 0.3 + R0() * 0.7, on: false, gy: 0, ph: R0() * 6.28, rot: 0, vr: 0 }); return a; }
    drops = mkP(MAXR); flakes = mkP(MAXS); hail = mkP(MAXH); leaves = mkP(MAXLEAF);
    function spawnTop(p, spread, vxRatio) {
      p.y = -R0() * spread - 20; p.x = R0() * (W + Math.abs(vxRatio) * H) - (vxRatio > 0 ? vxRatio * H : 0);
      p.gy = groundY(p.z); p.on = true;
    }

    // lightning
    var strike = null, strikeIn = 4 + R0() * 6;
    function newStrike() {
      var pulses = [[0, 1], [0.09, 0.45], [0.2, 0.85], [0.34, 0.3]].slice(0, 2 + ((R0() * 3) | 0));
      var x = (0.15 + R0() * 0.7) * W, y = 0.22 * H, pts = [[x, y]], br = [];
      while (y < HZ - 0.02 * H) { y += (10 + R0() * 22) * S; x += (R0() - 0.5) * 26 * S; pts.push([x, y]); if (R0() < 0.18 && br.length < 2) br.push(branch(x, y)); }
      strike = { t0: T, pulses: pulses, x: pts[0][0], bolt: R0() < 0.6 || boltTest ? pts : null, br: br };
    }
    function branch(x, y) { var b = [[x, y]], n = 3 + ((R0() * 5) | 0), dir = R0() < 0.5 ? -1 : 1; for (var i = 0; i < n; i++) { x += dir * (6 + R0() * 14) * S; y += (8 + R0() * 14) * S; b.push([x, y]); } return b; }
    function flashLevel() {
      if (!strike) return 0;
      var dt = boltTest ? 0.03 : T - strike.t0, f = 0;   // test hook holds the strike at its peak
      for (var i = 0; i < strike.pulses.length; i++) { var pt = dt - strike.pulses[i][0]; if (pt >= 0) f += strike.pulses[i][1] * Math.exp(-pt / 0.07); }
      if (dt > 1.2 && !boltTest) strike = null;
      return Math.min(1, f);
    }

    // ---------- per-frame ----------
    function step(dt) {
      var tgt = preview ? preview.p : live;
      var kf = 1 - Math.exp(-dt / 2.4);
      for (var k in BASE) cur[k] += (tgt[k] - cur[k]) * kf;
      cur.snowCover += ((tgt.snow > 0.3 ? 1 : tgt.snow > 0.05 ? cur.snowCover : 0) - cur.snowCover) * (1 - Math.exp(-dt / 8));
      var L = preview ? preview.L : nowL(), sk = skyAt(L), ks = 1 - Math.exp(-dt / 1.3);
      sky.el += (sk.el - sky.el) * ks; sky.noonEl += (sk.noonEl - sky.noonEl) * ks; sky.pm += (sk.pm - sky.pm) * ks;
      sky.p += (sk.p - sky.p) * ks; sky.q += (sk.q - sky.q) * ks; sky.L = L;
      cam.x += (cam.tx - cam.x) * Math.min(1, dt * 1.5); cam.y += (cam.ty - cam.y) * Math.min(1, dt * 1.5);
      if (boltTest && cur.thunder > 0.5 && !strike) strikeIn = Math.min(strikeIn, 0.2);
      if (cur.thunder > 0.5 && !reduced) {
        strikeIn -= dt;
        if (strikeIn <= 0) { newStrike(); strikeIn = calm ? 14 + R0() * 20 : 5 + R0() * 11; }
      }
    }
    function colors() {
      var el = sky.el, P = palette(el, sky.pm > 0.5 ? 1 : sky.pm), Lt = smooth(-8, 12, el);
      var golden = smooth(-6, 0, el) * (1 - smooth(5, 15, el));
      var ovc = smooth(0.55, 1, cur.cloud) * 0.9, dk = cur.dark;
      var gTop = mul(mix([18, 22, 30], [118, 126, 138], Lt), 1 - dk * 0.62), gHor = mul(mix([28, 32, 42], [168, 172, 180], Lt), 1 - dk * 0.5);
      gHor = mix(gHor, P.glow, golden * 0.22);
      var zen = mix(P.zen, gTop, ovc), mid = mix(P.mid, mix(gTop, gHor, 0.5), ovc), hor = mix(P.hor, gHor, ovc * 0.9), glow = mix(P.glow, gHor, ovc * 0.8);
      var fogC = mul(mix([30, 36, 48], [206, 210, 214], Lt), 1 - dk * 0.35);
      zen = mix(zen, fogC, cur.fog * 0.55); mid = mix(mid, fogC, cur.fog * 0.72); hor = mix(hor, fogC, cur.fog * 0.85);
      var light = mix([62, 74, 100], [255, 255, 255], Lt); light = mix(light, mix(P.glow, [255, 226, 214], 0.3), golden * 0.75);
      var shade = mix([16, 22, 36], [150, 160, 178], Lt); shade = mix(shade, mix(P.hor, [70, 56, 80], 0.5), golden * 0.45);
      light = mix(light, mix(gHor, [255, 255, 255], 0.12), ovc * 0.55); light = mix(light, mix(shade, [96, 102, 112], 0.5), dk * 0.8); shade = mul(shade, 1 - dk * 0.5);
      var farC = mix(hor, [10, 16, 30], 0.42 + (1 - Lt) * 0.2), midC = mix(hor, [6, 9, 16], 0.72), cityC = mix(hor, [3, 4, 8], 0.86);
      return { zen: zen, mid: mid, hor: hor, glow: glow, Lt: Lt, golden: golden, ovc: ovc, fog: mix(fogC, [255, 255, 255], 0.18 * Lt), haze: fogC, light: light, shade: shade,
        far: farC, midc: midC, city: cityC, snowCap: mix([70, 80, 100], [236, 240, 246], Lt) };
    }

    function draw(dt) {
      col = colors();
      var key = colorKey(col);
      if (!lastTint || (T - tintAt > 0.12 && diff(key, lastTint) > 5)) { retint(col); lastTint = key; tintAt = T; }
      var c = ctx, el = sky.el, Lt = col.Lt, pmul = (calm ? 0.55 : 1) * (reduced ? 0.4 : 1);
      var flash = flashLevel() * cur.thunder * (calm ? 0.45 : 1) * (reduced ? 0.25 : 1);
      var windPx = cur.windX * 9 * S + Math.sin(T * 0.7) * cur.windS * 1.2 * S;
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';

      // sky
      var g = c.createLinearGradient(0, 0, 0, HZ);
      g.addColorStop(0, rgb(col.zen)); g.addColorStop(0.55, rgb(col.mid)); g.addColorStop(1, rgb(col.hor));
      c.fillStyle = g; c.fillRect(0, 0, W, SHORE + 2);
      var sunX = lerp(0.1, 0.9, sky.p) * W - cam.x * 0.01 * W;
      var twi = smooth(-12, -1, el) * (1 - smooth(8, 24, el)), glowA = (twi * 0.85 + 0.18 * smooth(10, 40, el)) * (1 - col.ovc * 0.75) * (1 - cur.fog * 0.6);
      if (glowA > 0.01) {
        var gx = el > -1 ? sunX : (sky.pm > 0.5 ? 0.85 * W : 0.15 * W);
        var rg = c.createRadialGradient(gx, HZ, 0, gx, HZ, W * 0.75);
        rg.addColorStop(0, rgb(col.glow, glowA)); rg.addColorStop(0.4, rgb(col.glow, glowA * 0.35)); rg.addColorStop(1, rgb(col.glow, 0));
        c.fillStyle = rg; c.fillRect(0, 0, W, SHORE);
      }
      // stars
      var starA = (1 - smooth(-14, -4, el)) * (1 - cur.cloud * 0.92) * (1 - cur.fog * 0.9);
      if (starA > 0.01) {
        c.globalAlpha = starA; c.drawImage(stars, -cam.x * 0.004 * W, 0);
        c.fillStyle = '#fff';
        for (var i = 0; i < twinklers.length; i++) {
          var tw = twinklers[i], a = 0.5 + 0.5 * Math.sin(T * tw.f + tw.ph);
          c.globalAlpha = starA * a * a; c.fillRect(tw.x - tw.s / 2, tw.y - tw.s / 2, tw.s, tw.s);
        }
        c.globalAlpha = 1;
      }
      // moon
      var moonA = (1 - smooth(-8, -1, el)) * (1 - smooth(0.55, 0.95, cur.cloud)) * (1 - cur.fog * 0.8);
      if (moonA > 0.01) {
        var ph = moonPhase(sky.L - tzSec() * 1000), mk2 = (ph * 60 | 0) + ':' + W;
        if (mk2 !== moonKey) { moonSpr = buildMoon(ph); moonKey = mk2; }
        var mx = lerp(0.12, 0.88, sky.q) * W - cam.x * 0.01 * W, my = HZ - Math.sin(Math.PI * sky.q) * 0.52 * H - 0.04 * H;
        var hr = moonSpr.R * 5, mg = c.createRadialGradient(mx, my, 0, mx, my, hr);
        mg.addColorStop(0, 'rgba(210,222,255,' + (0.28 * moonA * (0.3 + moonSpr.illum * 0.7)).toFixed(3) + ')'); mg.addColorStop(1, 'rgba(210,222,255,0)');
        c.fillStyle = mg; c.fillRect(mx - hr, my - hr, hr * 2, hr * 2);
        c.globalAlpha = moonA; c.drawImage(moonSpr.c, mx - moonSpr.c.width / 2, my - moonSpr.c.height / 2); c.globalAlpha = 1;
      }
      // sun
      var sunA = smooth(-2, 0.5, el) * (1 - smooth(0.35, 0.95, cur.cloud) * 0.97) * (1 - cur.fog * 0.6);
      var sunY = HZ - clamp(el / sky.noonEl, -0.1, 1) * (HZ - 0.14 * H);
      if (sunA > 0.01) {
        var low = 1 - smooth(2, 16, el), sr = (20 + low * 8) * S, core = mix([255, 250, 236], [255, 150, 80], low);
        var sh = c.createRadialGradient(sunX, sunY, 0, sunX, sunY, 190 * S);
        sh.addColorStop(0, rgb(mix(core, [255, 255, 255], 0.4), 0.55 * sunA)); sh.addColorStop(0.18, rgb(core, 0.22 * sunA)); sh.addColorStop(1, rgb(core, 0));
        c.fillStyle = sh; c.fillRect(sunX - 190 * S, sunY - 190 * S, 380 * S, 380 * S);
        var bl = c.createRadialGradient(sunX, sunY, sr * 0.6, sunX, sunY, sr * 2.6);
        bl.addColorStop(0, rgb([255, 248, 232], 0.85 * sunA)); bl.addColorStop(0.35, rgb([255, 244, 222], 0.35 * sunA)); bl.addColorStop(1, rgb([255, 240, 215], 0));
        c.fillStyle = bl; c.fillRect(sunX - sr * 2.6, sunY - sr * 2.6, sr * 5.2, sr * 5.2);
        c.globalAlpha = sunA; c.fillStyle = rgb(mix(core, [255, 255, 255], 0.7));
        c.beginPath(); c.arc(sunX, sunY, sr, 0, 6.283); c.fill(); c.globalAlpha = 1;
      }
      // clouds
      var drift = (cur.windX * 0.55 + (Math.abs(cur.windX) < 3 ? 3 : 0)) * S;
      for (var j = 0; j < clouds.length; j++) {
        var cl = clouds[j], vis;
        if (cl.L === 3) vis = smooth(0.68, 0.96, cur.cloud) * 0.95;
        else vis = smooth(cl.rank - 0.09, cl.rank + 0.07, cur.cloud * 1.08 - 0.02);
        var sw = cl.sp.w * cl.sc * S, shh = cl.sp.h * cl.sc * S;
        cl.x += drift * cl.k * dt / W;
        var span = 1 + 2 * sw / W;
        if (cl.x * W > W + sw) cl.x -= span; else if (cl.x * W < -sw * 2) cl.x += span;
        if (vis < 0.01) continue;
        c.globalAlpha = vis * (1 - cur.fog * (cl.L === 0 ? 0.85 : 0.7));
        c.drawImage(cl.sp.out, cl.x * W - sw / 2 - cam.x * cl.k * 6 * S, cl.y - shh / 2, sw, shh);
      }
      c.globalAlpha = 1;
      // lightning: in-cloud glow + bolt (behind the hills)
      if (flash > 0.005 && strike) {
        var lg = c.createRadialGradient(strike.x, 0.22 * H, 0, strike.x, 0.22 * H, 0.45 * W);
        lg.addColorStop(0, 'rgba(225,228,255,' + (flash * 0.55).toFixed(3) + ')'); lg.addColorStop(1, 'rgba(200,205,255,0)');
        c.fillStyle = lg; c.fillRect(0, 0, W, HZ);
        if (strike.bolt && (T - strike.t0 < 0.5 || boltTest)) {
          var paths = [strike.bolt].concat(strike.br);
          c.lineCap = 'round'; c.lineJoin = 'round';
          for (var pass = 0; pass < 2; pass++) {
            c.strokeStyle = pass ? 'rgba(255,255,255,' + Math.min(1, flash * 1.4).toFixed(3) + ')' : 'rgba(180,190,255,' + (flash * 0.35).toFixed(3) + ')';
            c.lineWidth = (pass ? 1.6 : 7) * S;
            c.beginPath();
            for (var b = 0; b < paths.length; b++) { var pp = paths[b]; c.moveTo(pp[0][0], pp[0][1]); for (var m = 1; m < pp.length; m++) c.lineTo(pp[m][0], pp[m][1]); }
            c.stroke();
          }
        }
      }
      // landscape
      var off = (LW - W) / 2, M = LW - W;
      c.globalAlpha = 1 - cur.fog * 0.78; c.drawImage(far.c, -off - cam.x * M * 0.12, far.y0);
      if (cur.snowCover > 0.01) { c.globalAlpha = cur.snowCover * (1 - cur.fog * 0.78) * 0.9; c.drawImage(far.capT, -off - cam.x * M * 0.12, far.y0); }
      fogBank(HZ - 0.035 * H, 1.3, 0.55, 0.18);
      c.globalAlpha = 1 - cur.fog * 0.5; c.drawImage(midL.c, -off - cam.x * M * 0.25, midL.y0);
      if (cur.snowCover > 0.01) { c.globalAlpha = cur.snowCover * (1 - cur.fog * 0.5) * 0.85; c.drawImage(midL.capT, -off - cam.x * M * 0.25, midL.y0); }
      fogBank(SHORE - 0.06 * H, 1.6, 0.65, 0.3);
      var cityX = -off - cam.x * M * 0.45;
      c.globalAlpha = 1 - cur.fog * 0.45; c.drawImage(city.c, cityX, city.y0);
      var facA = col.Lt * 0.13 * (1 - cur.dark * 0.7) * (1 - cur.fog * 0.5);
      if (facA > 0.01) { c.globalAlpha = facA; c.drawImage(facets, cityX, city.y0); }
      if (cur.snowCover > 0.01) { c.globalAlpha = cur.snowCover * 0.8; c.drawImage(city.capT, cityX, city.y0); }
      var lightsA = Math.max(1 - smooth(-5, 7, el), cur.dark * 0.45) * (1 - cur.fog * 0.45);
      if (lightsA > 0.01) {
        c.globalAlpha = lightsA; c.drawImage(lights, cityX, city.y0);
        c.fillStyle = '#ff4a3a';
        for (var bl = 0; bl < blinkers.length; bl++) {
          var on = Math.sin(T * 2.2 + blinkers[bl].ph) > 0.55 ? 1 : 0.15;
          c.globalAlpha = lightsA * on; c.fillRect(cityX + blinkers[bl].x - 1.5 * S, city.y0 + blinkers[bl].y - 1.5 * S, 3 * S, 3 * S);
        }
      }
      c.globalAlpha = 1;
      // water
      drawWater(c, cityX, lightsA, sunX, sunY, sunA, moonA, dt);
      fogBank(SHORE + 0.02 * H, 2, 0.6, 0.45);
      if (cur.fog > 0.02) {      // haze wash: thick near the ground, thinning upward
        var hzg = c.createLinearGradient(0, HZ - 0.3 * H, 0, H);
        hzg.addColorStop(0, rgb(col.haze, 0)); hzg.addColorStop(0.45, rgb(col.haze, cur.fog * 0.42)); hzg.addColorStop(1, rgb(col.haze, cur.fog * 0.3));
        c.fillStyle = hzg; c.fillRect(0, HZ - 0.3 * H, W, H - HZ + 0.3 * H);
      }
      // heat shimmer over the horizon band
      if (cur.heat > 0.02 && el > 3 && cur.rain < 0.05) {
        var y0 = Math.round(HZ - 0.06 * H), y1 = SHORE + Math.round(0.04 * H), hgt = 2;
        for (var yy = y0; yy < y1; yy += hgt) {
          var amp = cur.heat * 0.9 * S * smooth(y0, y1, yy);          // stronger toward the ground
          var o = Math.sin(yy * 0.07 + T * 4.2) * amp + Math.sin(yy * 0.19 - T * 2.7) * amp * 0.4;
          c.drawImage(cv, 0, yy, W, hgt, o, yy, W, hgt);
        }
        var hz = c.createLinearGradient(0, HZ - 0.12 * H, 0, SHORE);
        hz.addColorStop(0, 'rgba(255,214,160,0)'); hz.addColorStop(1, 'rgba(255,214,160,' + (0.2 * cur.heat).toFixed(3) + ')');
        c.fillStyle = hz; c.fillRect(0, HZ - 0.12 * H, W, SHORE - HZ + 0.12 * H);
      }
      // precipitation + wind
      drawRain(c, dt, windPx, pmul, flash);
      drawSnow(c, dt, windPx, pmul);
      drawLeaves(c, dt, windPx, pmul);
      // flash
      if (flash > 0.005) { c.fillStyle = 'rgba(215,220,255,' + (flash * 0.3).toFixed(3) + ')'; c.fillRect(0, 0, W, H); }
      elFlash.style.opacity = (flash * 0.16).toFixed(3);
      c.globalAlpha = 1;
    }
    function diff(a, b) { var d = 0; for (var i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i])); return d; }
    function fogBank(y, sc, speed, seed) {
      var a = cur.fog * 0.85 + smooth(0.5, 1, cur.rain) * 0.3 + cur.snow * 0.12;
      if (a < 0.02) return;
      var c = ctx, fw = fogSprite.c.width * sc * S, fh = fogSprite.c.height * sc * S;
      var x = ((T * (speed * 14 + cur.windX * 0.6) * S + seed * 2000 * S) % fw + fw) % fw - fw;
      c.globalAlpha = Math.min(1, a);
      for (; x < W; x += fw * 0.82) c.drawImage(fogSprite.c, x, y - fh / 2, fw, fh);
      c.globalAlpha = 1;
    }
    function drawWater(c, cityX, lightsA, sunX, sunY, sunA, moonA, dt) {
      var wh = H - SHORE, g = c.createLinearGradient(0, SHORE, 0, H);
      g.addColorStop(0, rgb(mix(col.hor, [0, 0, 0], 0.45))); g.addColorStop(1, rgb(mix(col.zen, [0, 0, 0], 0.62)));
      c.fillStyle = g; c.fillRect(0, SHORE, W, wh);
      // reflected skyline
      c.save(); c.beginPath(); c.rect(0, SHORE, W, wh); c.clip();
      c.setTransform(1, 0, 0, -0.62, 0, SHORE * 1.62);
      c.globalAlpha = 0.42; c.drawImage(city.c, cityX, city.y0);
      c.restore();
      // reflected window light, shimmering in slices
      if (lightsA > 0.01) {
        var n = 8, sh = Math.ceil(wh / n);
        c.globalAlpha = lightsA * 0.95;
        for (var i = 0; i < n; i++) {
          var dx = Math.sin(T * 1.7 + i * 0.9) * (1 + i * 0.5) * S;
          c.drawImage(refl, 0, i * sh, LW, sh, cityX + dx, SHORE + i * sh, LW, sh);
        }
      }
      // glitter path under the sun or moon
      var src = sunA > 0.05 ? { x: sunX, a: sunA * (0.6 + 0.4 * (1 - smooth(5, 40, sky.el))), c: sky.el < 12 ? '255,200,140' : '255,250,235' } :
        moonA > 0.05 ? { x: lerp(0.12, 0.88, sky.q) * W - cam.x * 0.01 * W, a: moonA * 0.55 * (moonSpr ? 0.3 + moonSpr.illum * 0.7 : 0.6), c: '215,225,255' } : null;
      if (src) {
        c.globalCompositeOperation = 'lighter';
        for (var k = 0; k < glitter.length; k++) {
          var gl = glitter[k], fy = gl.fy, tw = 0.5 + 0.5 * Math.sin(T * gl.f + gl.ph);
          var gx = src.x + gl.dx * (14 + 140 * fy) * S + Math.sin(T * 0.6 + gl.ph) * 3 * S, gy = SHORE + 2 + fy * (wh - 4);
          c.fillStyle = 'rgba(' + src.c + ',' + (src.a * tw * tw * 0.7).toFixed(3) + ')';
          c.fillRect(gx, gy, (3 + 26 * fy) * gl.w * S, (0.8 + fy * 1.2) * S);
        }
        c.globalCompositeOperation = 'source-over';
      }
      // shoreline
      c.globalAlpha = 0.35; c.fillStyle = rgb(mix(col.hor, [255, 255, 255], 0.2)); c.fillRect(0, SHORE, W, Math.max(1, S));
      c.globalAlpha = 1;
      // ripples + splashes
      var wet = Math.max(cur.rain, cur.ice * 0.6);
      c.lineWidth = Math.max(1, S);
      for (var r = ripples.length - 1; r >= 0; r--) {
        var rp = ripples[r]; rp.t += dt;
        if (rp.t > 0.7) { ripples.splice(r, 1); continue; }
        var f = rp.t / 0.7, rx = (2 + 12 * f) * rp.z * S;
        c.strokeStyle = 'rgba(' + (Lt3()) + ',' + ((1 - f) * 0.45 * rp.z).toFixed(3) + ')';
        c.beginPath(); c.ellipse(rp.x, rp.y, rx, rx * 0.28, 0, 0, 6.283); c.stroke();
        if (rp.t < 0.12) { c.fillStyle = c.strokeStyle; c.fillRect(rp.x - 0.5 * S, rp.y - (1 - rp.t / 0.12) * 6 * rp.z * S, Math.max(1, S), 3 * S * rp.z); }
      }
      // wet glints on the water
      if (wet > 0.05) {
        if (sparks.length < 24 * wet && R0() < 0.6) sparks.push({ x: R0() * W, y: SHORE + 3 + R0() * (wh - 6), t: 0, l: 0.25 + R0() * 0.4 });
        c.globalCompositeOperation = 'lighter';
        for (var s = sparks.length - 1; s >= 0; s--) {
          var sp = sparks[s]; sp.t += dt; if (sp.t > sp.l) { sparks.splice(s, 1); continue; }
          var fa = Math.sin(Math.PI * sp.t / sp.l);
          c.fillStyle = 'rgba(' + (cur.ice > 0.3 ? '220,240,255' : Lt3()) + ',' + (fa * 0.5).toFixed(3) + ')';
          c.fillRect(sp.x, sp.y, 3 * S, Math.max(1, S));
        }
        c.globalCompositeOperation = 'source-over';
      }
    }
    function Lt3() { var v = mix([150, 168, 200], [225, 232, 242], col.Lt); return (v[0] | 0) + ',' + (v[1] | 0) + ',' + (v[2] | 0); }
    function drawRain(c, dt, windPx, pmul, flash) {
      var active = Math.round(MAXR * clamp(cur.rain, 0, 1) * pmul);
      var hailN = Math.round(MAXH * cur.hail * pmul);
      if (!active && !hailN && !anyOn(drops) && !anyOn(hail)) return;
      var rc = Lt3(), fl = flash * 0.5, slow = cur.drizzle > 0.5 ? 0.6 : 1;
      if (cur.ice > 0.3) rc = '215,235,255';
      var buckets = [[], [], []];
      for (var i = 0; i < drops.length; i++) {
        var d = drops[i];
        if (!d.on) { if (i < active) { d.z = 0.3 + R0() * 0.7; spawnTop(d, H, windPx / 1400); } else continue; }
        var vy = (700 + 1100 * d.z) * S * slow, vx = clamp(windPx * d.z, -0.55 * vy, 0.55 * vy);
        d.x += vx * dt; d.y += vy * dt; d.vx = vx / vy;
        if (d.y > d.gy) {
          if (d.gy > SHORE + 2 && ripples.length < 70 && R0() < 0.55) ripples.push({ x: d.x, y: d.gy, z: d.z, t: 0 });
          if (i < active) spawnTop(d, H * 0.15, vx / vy); else d.on = false;
          continue;
        }
        buckets[d.z < 0.55 ? 0 : d.z < 0.8 ? 1 : 2].push(d);
      }
      var alphas = [0.16, 0.26, 0.38], widths = [0.9, 1.2, 1.7], lens = [14, 24, 36];
      for (var b = 0; b < 3; b++) {
        var bk = buckets[b]; if (!bk.length) continue;
        c.strokeStyle = 'rgba(' + rc + ',' + Math.min(1, alphas[b] * (0.7 + cur.rain * 0.5) + fl).toFixed(3) + ')';
        c.lineWidth = widths[b] * S + 0.2; c.beginPath();
        var ln = lens[b] * S * slow * (cur.drizzle > 0.5 ? 0.5 : 1);
        for (var k = 0; k < bk.length; k++) { var p = bk[k]; c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * ln, p.y - ln); }
        c.stroke();
      }
      // hail: fast white pellets
      if (hailN || anyOn(hail)) {
        c.fillStyle = 'rgba(240,245,255,.85)';
        for (var h = 0; h < hail.length; h++) {
          var e = hail[h];
          if (!e.on) { if (h < hailN) spawnTop(e, H, windPx / 1800); else continue; }
          var hv = (900 + 700 * e.z) * S; e.x += clamp(windPx * e.z, -0.4 * hv, 0.4 * hv) * dt; e.y += hv * dt;
          if (e.y > e.gy) { if (h < hailN) spawnTop(e, H * 0.1, windPx / 1800); else e.on = false; continue; }
          var hs = (1.6 + e.z * 2.2) * S; c.fillRect(e.x - hs / 2, e.y - hs, hs, hs * 1.6);
        }
      }
    }
    function anyOn(a) { for (var i = 0; i < a.length; i++) if (a[i].on) return true; return false; }
    function drawSnow(c, dt, windPx, pmul) {
      var active = Math.round(MAXS * clamp(cur.snow, 0, 1) * pmul);
      if (!active && !anyOn(flakes)) return;
      var heavy = cur.snow > 0.8 ? 1.2 : 1;
      c.globalAlpha = 1;
      for (var i = 0; i < flakes.length; i++) {
        var f = flakes[i];
        if (!f.on) { if (i < active) { f.z = 0.25 + R0() * 0.75; spawnTop(f, H, windPx * 0.5 / 80); } else continue; }
        var vy = (32 + 78 * f.z) * S * heavy, vx = windPx * 0.5 * f.z + Math.sin(T * (0.7 + f.z) + f.ph) * 22 * S * f.z;
        f.x += vx * dt; f.y += vy * dt;
        if (f.x < -30) f.x += W + 60; else if (f.x > W + 30) f.x -= W + 60;
        if (f.y > f.gy) { if (i < active) spawnTop(f, H * 0.1, 0); else f.on = false; continue; }
        var r = (1.2 + 5.2 * f.z * f.z) * S;
        c.globalAlpha = 0.45 + 0.5 * f.z;
        c.drawImage(dotSprite, f.x - r, f.y - r, r * 2, r * 2);
      }
      c.globalAlpha = 1;
    }
    function drawLeaves(c, dt, windPx, pmul) {
      var amt = smooth(26, 50, cur.windS) * (1 - cur.snow) * (1 - smooth(-6, 2, -sky.el) * 0.3);
      var active = Math.round(MAXLEAF * amt * pmul), dir = windPx >= 0 ? 1 : -1;
      if (!active && !anyOn(leaves)) return;
      var lc = rgb(mix(col.city, [70, 48, 26], 0.45 * col.Lt));
      c.fillStyle = lc;
      for (var i = 0; i < leaves.length; i++) {
        var l = leaves[i];
        if (!l.on) {
          if (i >= active || R0() > 0.02) continue;
          l.on = true; l.x = dir > 0 ? -20 : W + 20; l.y = (0.35 + R0() * 0.6) * H; l.rot = R0() * 6; l.vr = (R0() - 0.5) * 8; l.sp = 0.6 + R0() * 0.7;
        }
        l.x += (Math.abs(windPx) * 1.6 + 120 * S) * dir * l.sp * dt;
        l.y += (Math.sin(T * 2.3 + l.ph) * 60 + 18) * S * dt; l.rot += l.vr * dt;
        if (l.x < -40 || l.x > W + 40 || l.y > H + 20) { l.on = false; continue; }
        c.save(); c.translate(l.x, l.y); c.rotate(l.rot); c.scale(1, Math.abs(Math.sin(T * 3 + l.ph)) * 0.8 + 0.2);
        c.beginPath(); c.ellipse(0, 0, (3 + l.z * 3) * S, (1.4 + l.z * 1.4) * S, 0, 0, 6.283); c.fill(); c.restore();
      }
    }

    function frame(ts) {
      if (dead) return;
      raf = requestAnimationFrame(frame);
      if (lastTs && ts - lastTs < 30) return;
      var dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0.033; lastTs = ts;
      T += dt;
      step(dt); draw(dt);
    }

    // ---------- ticking UI (1 s) ----------
    var lastHourIdx = -2, tickN = 0;
    function tick() {
      if (dead) return;
      refreshClock();
      var c2 = api.calm(); if (c2 !== calm) { calm = c2; root.classList.toggle('calm', calm); }
      idle++;
      if (mode === 'now' && idle >= 8) strip.classList.add('away');
      if (mode !== 'now' && idle >= 20) { setMode('now'); strip.classList.add('away'); }
      var hi = data ? hourIndex(nowL()) : -1;
      if (hi !== lastHourIdx) { lastHourIdx = hi; live = liveParams(); if (mode !== '7d') buildTiles(); }
      if (++tickN % 15 === 0) { live = liveParams(); refreshNow(); }
      if (col) root.style.setProperty('--acc', rgb(mix(mix(col.glow, [255, 214, 150], 0.4), [255, 255, 255], 0.25)));
    }
    function onVis() {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
      else if (!raf && !dead) {
        lastTs = 0; raf = requestAnimationFrame(frame);
        if (!fake && Date.now() - dataT > REFRESH) schedule(500);
      }
    }
    var resizeT = 0;
    function onResize() { clearTimeout(resizeT); resizeT = setTimeout(function () { if (!dead) size(); }, 400); }

    size();
    root.classList.toggle('calm', calm);
    refreshClock(); refreshNow(); buildTiles();
    if (!fake) schedule(data && Date.now() - dataT < REFRESH ? REFRESH - (Date.now() - dataT) : 50);
    iv = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', onResize);
    raf = requestAnimationFrame(frame);
    // show the strip briefly at start so the forecast is discoverable
    strip.classList.remove('away');

    return {
      onKey: function (k) {
        if (dead) return false;
        if (k !== 37 && k !== 39) return false;
        wake();
        if (mode === 'now') { mode = '24h'; sel = k === 39 ? 1 : 0; buildTiles(); return true; }
        sel = clamp(sel + (k === 39 ? 1 : -1), 0, Math.max(0, items.length - 1));
        markSel();
        return true;
      },
      onAction: function () {
        if (dead) return;
        wake();
        setMode(mode === 'now' ? '24h' : mode === '24h' ? '7d' : 'now');
      },
      onPointer: function (nx, ny) {
        cam.tx = clamp(nx, -1, 1); cam.ty = clamp(ny, -1, 1);
        // burn-in care: the text drifts slowly (camera sway plus a slow minute-scale wander)
        var m = api.now().getTime() / 60000;
        var dx = nx * 0.45 + Math.sin(m / 7.3) * 0.7, dy = ny * 0.35 + Math.sin(m / 11.1 + 1) * 0.5;
        ui.style.transform = 'translate(' + dx.toFixed(3) + 'vw,' + dy.toFixed(3) + 'vh)';
      },
      onMinute: function () { if (!dead) { refreshClock(); refreshNow(); } },
      onHour: function () { if (!dead) { live = liveParams(); buildTiles(); } },
      destroy: function () {
        dead = true; cancelAnimationFrame(raf); raf = 0;
        clearInterval(iv); clearTimeout(fetchT); clearTimeout(resizeT);
        if (inflight) { try { inflight.abort(); } catch (e) {} inflight = null; }
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('resize', onResize);
        drops = flakes = hail = leaves = ripples = sparks = []; clouds = []; cloudSprites = [];
        stars = far = midL = city = lights = facets = refl = fogSprite = moonSpr = null;
        cv.width = cv.height = 1;
      },
    };
  }

  window.Themes.weather = { title: 'Live Sky', create: create };
})();
