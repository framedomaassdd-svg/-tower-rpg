/* v76 town built from separate pieces (same art style as the characters):
   sky (tiles sideways, slow parallax) · the tower (parallax, seen through the arch) · one image per building ·
   a tiling street (sidewalk + kerb + cobbles). Every building was scaled by its door so doors are ≈ 1.3× the hero.
   Night: each building has a matching glow image (lit windows, lamps, the forge fire), added with 'screen'.
   ตรอกล่าง (x 6450–11100) is a separate scene with its own backdrop and dirt street; the hero reaches it by walking
   up the alley lane (life-sim LANE), the camera zooms in, the scene cuts, and he walks out of the alley on the other side. World: 11120 × 1080, buildings stand on y = 794, people walk at y ≈ 792–860. */
(function (root) {
  'use strict';
  const V = '?v=77';
  const WORLD_W = 11120, BASE = 794;
  // Two scenes on one strip: the town ends at the alley; ตรอกล่าง begins at the same alley seen from the other side.
  const ZONES = Object.freeze({ town: [0, 7203], slum: [6450, WORLD_W] });
  const zoneAt = x => x > ZONES.town[1] ? 'slum' : 'town';
  const hasImage = typeof Image !== 'undefined';
  const load = f => { if (!hasImage) return null; const i = new Image(); i.src = f + V; return i; };

  // id, image, left x, top y, width, height (world px); flip = mirrored copy of another building
  const BUILDINGS = Object.freeze([
    { id: 'gate', x: -8, y: 338, w: 673, h: 456 },
    { id: 'tavern', x: 669, y: 371, w: 579, h: 423 },
    { id: 'houseB', x: 1252, y: 376, w: 468, h: 418 },
    { id: 'houseA', x: 1723, y: 346, w: 422, h: 448 },
    { id: 'arch', x: 2149, y: 342, w: 702, h: 452 },
    { id: 'well', x: 2855, y: 567, w: 239, h: 227 },
    { id: 'bakery', x: 3098, y: 333, w: 590, h: 461 },
    { id: 'garden', x: 3693, y: 513, w: 434, h: 281 },
    { id: 'forge', x: 4130, y: 386, w: 558, h: 408 },
    { id: 'apothecary', x: 4692, y: 415, w: 418, h: 379 },
    { id: 'inn', x: 5114, y: 167, w: 904, h: 627 },
    { id: 'houseE', img: 'houseA', flip: true, x: 6021, y: 346, w: 422, h: 448 },
    // ตรอกล่าง
    { id: 'alley', x: 6450, y: 317, w: 753, h: 477 },
    { id: 'tenement', x: 7207, y: 202, w: 436, h: 592 },
    { id: 'soup', x: 7647, y: 336, w: 597, h: 458 },
    { id: 'washing', x: 8248, y: 461, w: 518, h: 333 },
    { id: 'junk', x: 8769, y: 357, w: 625, h: 437 },
    { id: 'shackA', x: 9398, y: 450, w: 487, h: 344 },
    { id: 'scrap', x: 9889, y: 433, w: 635, h: 361 },
    { id: 'shackB', x: 10527, y: 407, w: 566, h: 387 }
  ]);
  const art = { sky: load('town6_sky.webp'), road: load('town6_road.webp'), tower: load('town6_tower.webp'),
    slumBg: load('town6_slum_bg.webp'), slumRoad: load('town6_slum_road.webp') };
  for (const b of BUILDINGS) if (!b.img) { art[b.id] = load('town6_' + b.id + '.webp'); art['glow_' + b.id] = load('town6_glow_' + b.id + '.webp'); }
  const ok = i => !!i && i.complete && i.naturalWidth > 0;
  const ready = () => ok(art.road) && ok(art.inn);

  // Doors and spots other scripts use (world x)
  const SPOTS = Object.freeze({
    gateDoor: 328, tavernDoor: 897, terrace: 1115, houseB: 1557, houseA: 2005,
    stairs: 2501, plazaLeft: 2296, plazaRight: 2706, well: 2975, bakeryDoor: 3236, stall: 3445,
    gardenBench: 3886, anvil: 4488, forgeFire: 4367, apothecaryDoor: 4803, apothecaryWindow: 4935,
    innDoor: 5543, innCafe: 5818, houseE: 6162,
    alleyDoor: 6609, alleyLane: 6836, tenementDoor: 7440, soupDoor: 7803, soupCounter: 8052, trough: 8455,
    junkDoor: 8932, junkWindow: 9185, shackA: 9691, scrapDoor: 10014, scrapCart: 10413, shackB: 10873
  });
  const GATE = [240, 420];                                   // the lane up through the city gate
  const ARCH = [2380, 2620];                                 // the steps up toward the tower
  const PLACES = Object.freeze({
    tavern: SPOTS.tavernDoor,
    guild:  SPOTS.stairs,                                    // training plate in front of the arch
    market: SPOTS.stall,
    smith:  4562,                                            // just right of the anvil
    inn:    SPOTS.innDoor,
    bench:  6330,                                            // street bench past the last house
    tenement: SPOTS.tenementDoor,                            // ห้องเช่าตรอก
    soup:   SPOTS.soupCounter,                               // โรงทาน
    scrap:  10300                                            // ลานเก็บของเก่า
  });
  const BENCH_SEAT = 52;
  const NAMES = [
    [660, 'ประตูเมือง'], [1250, 'ร้านอาหาร'], [2150, 'ย่านที่พัก'], [2855, 'ลานหน้าหอคอย'], [3098, 'บ่อน้ำกลางเมือง'],
    [3690, 'ตลาดขนมปัง'], [4130, 'สวนริมทาง'], [4690, 'โรงตีเหล็ก'], [5110, 'ร้านยา'], [6020, 'โรงแรม'], [6640, 'ย่านที่พักตะวันออก'], [7205, 'ทางเข้าตรอกล่าง'], [7645, 'ห้องเช่าตรอก'], [8245, 'โรงทาน'],
    [8768, 'ลานซักผ้า'], [9395, 'ร้านรับซื้อของเก่า'], [9888, 'ตรอกล่าง'], [10525, 'ลานของเก่า'], [Infinity, 'ท้ายตรอก']
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

  // ---- drawing (ctx is already in world space; camera = left edge of the view, w = view width)
  // Street: image rows from ROAD_ROW down (two slab rows, the kerb, cobbles), tiled sideways.
  const ROAD_ROW = 70, ROAD_Y = 786, ROAD_S = 0.31;
  function tiled(ctx, im, sx, sy, sh, x0, y, s, camera, w, rate) {
    const tw = im.naturalWidth * s, off = camera * (1 - rate);
    let x = off + Math.floor((camera - off) / tw) * tw;
    for (; x < camera + w; x += tw) ctx.drawImage(im, sx, sy, im.naturalWidth, sh, x - 0.5, y, tw + 1, sh * s);
  }
  // Sky: whole image, 1 px = 1 world px, its bottom (a row of treetops) at y 830, drifting at 30% of the camera.
  const SKY_BOTTOM = 830, SKY_RATE = 0.3;
  // Tower: anchored behind the arch steps; moves a little slower than the street.
  const TOWER = { x: SPOTS.stairs, base: 626, h: 635, rate: 0.85 };
  function tower(ctx, camera, w) {
    const im = art.tower; if (!ok(im)) return;
    const tw = TOWER.h * im.naturalWidth / im.naturalHeight, mid = camera + w / 2;
    const x = TOWER.x + (mid - TOWER.x) * (1 - TOWER.rate) - tw / 2;
    if (x > camera + w || x + tw < camera) return;
    ctx.drawImage(im, x, TOWER.base - TOWER.h, tw, TOWER.h);
  }
  function building(ctx, b, im, camera, w) {
    if (!ok(im) || b.x > camera + w || b.x + b.w < camera) return;
    if (b.flip) { ctx.save(); ctx.translate(b.x + b.w, b.y); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, b.w, b.h); ctx.restore(); }
    else ctx.drawImage(im, b.x, b.y, b.w, b.h);
  }
  const SMOKE = [[6539, 335], [7129, 355], [7275, 219], [7739, 351], [8864, 371], [9778, 466], [9956, 445],[746, 385], [1631, 379], [2091, 349], [3586, 351], [4581, 390], [5219, 188], [4760, 427], [6076, 349]];
  function draw(ctx, camera, w, h, t, zone) {
    ctx.fillStyle = '#3d86e0'; ctx.fillRect(camera, 0, w, h);
    const road = im => tiled(ctx, im, 0, ROAD_ROW, im.naturalHeight - ROAD_ROW, 0, ROAD_Y, ROAD_S, camera, w, 1);
    if (zone === 'slum') {
      // backdrop smaller and hazed so its rooftops read as far away behind the real shacks
      ctx.fillStyle = '#9fb8dc'; ctx.fillRect(camera, 0, w, SKY_BOTTOM);
      if (ok(art.slumBg)) tiled(ctx, art.slumBg, 0, 0, art.slumBg.naturalHeight, 0, SKY_BOTTOM - art.slumBg.naturalHeight * 0.82, 0.82, camera, w, SKY_RATE);
      ctx.fillStyle = 'rgba(246,224,196,0.42)'; ctx.fillRect(camera, 0, w, SKY_BOTTOM);
      if (ok(art.slumRoad)) road(art.slumRoad);
    } else {
      if (ok(art.sky)) tiled(ctx, art.sky, 0, 0, art.sky.naturalHeight, 0, SKY_BOTTOM - art.sky.naturalHeight, 1, camera, w, SKY_RATE);
      tower(ctx, camera, w);
      if (ok(art.road)) road(art.road);
    }
    for (const b of BUILDINGS) building(ctx, b, art[b.img || b.id], camera, w);
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
    if (amount <= 0.01) return;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.min(1, amount) * (0.94 + 0.06 * Math.sin(t * 0.004));  // faint flicker
    for (let pass = 0; pass < 2; pass++) {                   // two passes: lit windows read clearly through the night tint
      for (const b of BUILDINGS) building(ctx, b, art['glow_' + (b.img || b.id)], camera, w);
      ctx.globalAlpha *= 0.7;
    }
    ctx.restore();
  }
  const S = 1080 / 724, wx = x => Math.round(x * S);       // kept for older callers
  root.TownPano = { ZONES, zoneAt, art, ready, draw, drawNight, walkable, depthScale, sceneName, PLACES, SPOTS, BUILDINGS, BENCH_SEAT, WORLD_W, BASE, GATE, ARCH, S, wx };
})(typeof globalThis !== 'undefined' ? globalThis : this);
