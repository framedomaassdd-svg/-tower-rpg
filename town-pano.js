/* v70 painted town. One continuous street painting, stored as two halves (town_west + town_east, 2172×724 each)
   and a matching pair of night-glow overlays (lit windows, street lamps, forge).
   World space: 1 image px = S world px, the painting fills the 1080-high reference frame, the kerb sits at y ≈ 798. */
(function (root) {
  'use strict';
  const V = '?v=70';
  const HALF_W = 2172, IMG_H = 724, S = 1080 / IMG_H;
  const WORLD_W = Math.round(2 * HALF_W * S);              // 6480
  const wx = imageX => Math.round(imageX * S);              // painting x → world x
  const hasImage = typeof Image !== 'undefined';
  const load = f => { if (!hasImage) return null; const i = new Image(); i.src = f + V; return i; };
  const art = { west: load('town_west.webp'), east: load('town_east.webp'), glowW: load('town_glow_west.webp'), glowE: load('town_glow_east.webp') };
  const ok = i => !!i && i.complete && i.naturalWidth > 0;
  const ready = () => ok(art.west) && ok(art.east);

  // ---- where things are (painting x → world x)
  const GATE = [35, 200];                                   // city gate lane at the west end
  const ARCH = [wx(1180), wx(1330)];                        // steps up to the tower
  const PLACES = Object.freeze({
    tavern: wx(490),      // restaurant terrace
    guild:  wx(1255),     // plaza in front of the tower arch
    market: wx(1730),     // bakery stall beside the well
    smith:  wx(2755),     // just right of the anvil
    inn:    wx(3172),     // inn door
    bench:  wx(4037)      // street bench near the east houses
  });
  const BENCH_SEAT = 52;                                    // seat height above the foot line, world px
  const NAMES = [
    [wx(150), 'ประตูเมือง'], [wx(680), 'ร้านอาหาร'], [wx(1070), 'ย่านที่พัก'], [wx(1440), 'ลานหน้าหอคอย'], [wx(1640), 'บ่อน้ำกลางเมือง'],
    [wx(2000), 'ตลาดขนมปัง'], [wx(2400), 'สวนริมทาง'], [wx(2860), 'โรงตีเหล็ก'], [wx(3090), 'ร้านยา'], [wx(3580), 'โรงแรม'], [Infinity, 'ย่านที่พักตะวันออก']
  ];
  function sceneName(x) { for (const [limit, name] of NAMES) if (x < limit) return name; return 'ถนนในเมือง'; }
  function walkable(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 35 || x > WORLD_W - 35 || y < 650 || y > 1040) return false;
    if (y >= 765) return true;
    if (x >= GATE[0] && x <= GATE[1]) return y >= 700;
    return x >= ARCH[0] + 20 && x <= ARCH[1] - 20 && y >= 655;
  }
  function depthScale(x, y) {
    if (y >= 765) return 1;
    return Math.max(0.62, Math.min(1, 0.62 + (y - 650) / 115 * 0.38));
  }

  // ---- drawing
  function halves(ctx, a, b, camera, w) {
    const pw = HALF_W * S;
    if (ok(a) && camera < pw + 2) ctx.drawImage(a, 0, 0, pw + 1, 1080);          // +1 hides the seam between the halves
    if (ok(b) && camera + w > pw - 2) ctx.drawImage(b, pw, 0, pw, 1080);
  }
  const SMOKE = [[wx(300), 250], [wx(2522), 300], [wx(3205), 150], [wx(1920), 320]];
  function draw(ctx, camera, w, h, t) {
    ctx.fillStyle = '#3f6fc0'; ctx.fillRect(camera, 0, w, h);
    halves(ctx, art.west, art.east, camera, w);
    ctx.save();
    for (const [x, y] of SMOKE) {
      if (x < camera - 120 || x > camera + w + 120) continue;
      for (let i = 0; i < 6; i++) {
        const k = ((t * 0.00009) + i / 6) % 1, px = x + Math.sin(t * 0.0006 + i * 1.7) * 14 * k + 26 * k, py = y - 120 * k;
        ctx.globalAlpha = 0.34 * (1 - k) * Math.min(1, k * 6); ctx.fillStyle = '#f4efe8';
        ctx.beginPath(); ctx.arc(px, py, 9 + 26 * k, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }
  // lit windows and lamps; call after the day/night tint. `amount` is 0–1 (CityLighting.sample(clock).lamps)
  function drawNight(ctx, camera, w, amount, t) {
    if (amount <= 0.01 || !ok(art.glowW) || !ok(art.glowE)) return;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.min(1, amount) * (0.94 + 0.06 * Math.sin(t * 0.004));  // faint flicker
    halves(ctx, art.glowW, art.glowE, camera, w);
    ctx.restore();
  }
  root.TownPano = { art, ready, draw, drawNight, walkable, depthScale, sceneName, PLACES, BENCH_SEAT, WORLD_W, GATE, ARCH, S, wx };
})(typeof globalThis !== 'undefined' ? globalThis : this);
