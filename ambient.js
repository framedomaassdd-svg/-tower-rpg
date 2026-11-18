/* v86 ambient life: wind gusts, drifting clouds, butterflies, and leaves/petals blown along the street.
   Everything is a pure function of real time t (ms), so nothing needs saving or stepping.
   ambient.webp: 4×4 cells of 128 px — row 0 yellow butterfly, row 1 blue butterfly (4 flap frames, facing right),
   row 2 four leaves, row 3 four petals. cloud_0..3.webp: separate clouds. */
(function (root) {
  'use strict';
  const hasImage = typeof Image !== 'undefined', V = '?v=86b', C = 128;
  const load = src => { if (!hasImage) return null; const i = new Image(); i.src = src + V; return i; };
  const sheet = load('ambient.webp'), clouds = [0, 1, 2, 3].map(i => load('cloud_' + i + '.webp'));
  const ok = i => !!i && i.complete && i.naturalWidth > 0;
  const frac = x => x - Math.floor(x);
  const hash = n => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);

  // Wind strength 0..1: a slow swell with gusts riding on it.
  function wind(t) {
    const s = t / 1000;
    const base = 0.45 + 0.25 * Math.sin(s * 0.13) + 0.15 * Math.sin(s * 0.31 + 2);
    const gust = Math.max(0, Math.sin(s * 0.21 + 1.3)) ** 6 * 0.6;
    return Math.max(0.05, Math.min(1, base + gust));
  }

  // ---- clouds: a band in the upper sky, parallax 0.3 like the sky, each drifting at its own speed
  const CLOUDS = [
    { img: 0, y: 70, s: 0.85, v: 7, x: 0 },    { img: 1, y: 190, s: 0.75, v: 11, x: 700 },
    { img: 2, y: 120, s: 0.8, v: 9, x: 1250 }, { img: 3, y: 250, s: 0.7, v: 13, x: 400 },
    { img: 1, y: 40, s: 0.6, v: 6, x: 1700 },  { img: 2, y: 300, s: 0.55, v: 15, x: 1000 },
    { img: 0, y: 150, s: 0.55, v: 8, x: 2300 }
  ];
  function drawClouds(ctx, camera, w, t, alpha) {
    const s = t / 1000, span = w + 900;
    ctx.save(); ctx.globalAlpha = alpha === undefined ? 0.92 : alpha;
    for (const c of CLOUDS) {
      const im = clouds[c.img]; if (!ok(im)) continue;
      const cw = im.naturalWidth * c.s, ch = im.naturalHeight * c.s;
      const sx = ((c.x + s * c.v * (0.6 + wind(t) * 0.8) - camera * 0.3) % span + span) % span - 450;
      ctx.drawImage(im, camera + sx, c.y, cw, ch);
    }
    ctx.restore();
  }

  // ---- butterflies: flutter around flower spots in the daytime
  function butterfly(ctx, x, y, size, kind, t, seed) {
    if (!ok(sheet)) return;
    const s = t / 1000 + seed * 7;
    const ax = Math.sin(s * 0.7 + seed) * 70 + Math.sin(s * 1.9 + seed * 3) * 18;
    const ay = Math.sin(s * 1.1 + seed * 2) * 28 + Math.sin(s * 3.3) * 6;
    const vx = Math.cos(s * 0.7 + seed) * 0.7 * 70 + Math.cos(s * 1.9 + seed * 3) * 1.9 * 18;
    const f = [0, 1, 2, 3, 2, 1][Math.floor((s * 14) % 6)];
    ctx.save(); ctx.translate(x + ax, y + ay); if (vx < 0) ctx.scale(-1, 1);
    ctx.drawImage(sheet, f * C, kind * C, C, C, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  // ---- leaves and petals blown across a stretch [x0, x1], falling from height y0..y1 to the ground gy
  function flurry(ctx, area, camera, w, t, n, size) {
    if (!ok(sheet)) return;
    const s = t / 1000, wv = wind(t);
    for (let i = 0; i < n; i++) {
      const life = 7 + hash(i) * 5, phase = frac(s / life + hash(i + 50));
      if (wv < 0.35 + hash(i + 9) * 0.3) continue;                 // only when the wind is up
      const cyc = Math.floor(s / life + hash(i + 50));
      const x0 = area.x0 + hash(i * 13 + cyc) * (area.x1 - area.x0);
      const y0 = area.y0 + hash(i * 7 + cyc) * (area.y1 - area.y0);
      const x = x0 + phase * (180 + 260 * wv) + Math.sin(s * 2 + i) * 14;
      const y = Math.min(area.gy, y0 + phase * (area.gy - y0) * 1.1 + Math.sin(s * 3 + i * 2) * 8);
      if (x < camera - 40 || x > camera + w + 40) continue;
      const row = area.petals && hash(i + 3) < area.petals ? 3 : 2, col = Math.floor(hash(i + 21) * 4);
      const a = Math.min(1, phase * 6, (1 - phase) * 5);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(s * (1.5 + hash(i) * 2) * (i % 2 ? 1 : -1));
      const k = size * (0.7 + hash(i + 77) * 0.5);
      ctx.drawImage(sheet, col * C, row * C, C, C, -k / 2, -k / 2, k, k);
      ctx.restore();
    }
  }

  // ---- the street (world coordinates): flower spots for butterflies, trees that shed leaves
  const FLOWERS = [[1115, 700, 0], [2495, 690, 1], [3190, 730, 0], [4075, 690, 1], [4275, 700, 0], [5220, 700, 1], [1484, 552, 1]];
  const SLUM_FLOWERS = [[8455, 730, 0], [9691, 720, 1]];
  const TREES = [{ x0: 3975, x1: 4405, y0: 540, y1: 650, gy: 905, petals: 0.35 },   // the garden
                 { x0: 2535, x1: 2935, y0: 560, y1: 700, gy: 905, petals: 0.8 },     // flowers on the arch
                 { x0: 600, x1: 1300, y0: 520, y1: 700, gy: 905, petals: 0.5 }];
  const SLUM_TREES = [{ x0: 7000, x1: 7600, y0: 560, y1: 700, gy: 905, petals: 0.1 },
                      { x0: 9300, x1: 10200, y0: 560, y1: 700, gy: 905, petals: 0.1 }];
  function street(ctx, camera, w, t, zone, day) {
    const trees = zone === 'slum' ? SLUM_TREES : TREES, spots = zone === 'slum' ? SLUM_FLOWERS : FLOWERS;
    for (const a of trees) if (a.x1 + 600 > camera && a.x0 < camera + w) flurry(ctx, a, camera, w, t, 16, 30);
    if (day > 0.05) {
      ctx.save(); ctx.globalAlpha = Math.min(1, day * 1.5);
      spots.forEach(([x, y, k], i) => { if (x > camera - 150 && x < camera + w + 150) butterfly(ctx, x, y, 40, k, t, i + 1); });
      ctx.restore();
    }
  }

  root.Ambient = { wind, drawClouds, butterfly, flurry, street, ready: () => ok(sheet) };
})(typeof globalThis !== 'undefined' ? globalThis : this);
