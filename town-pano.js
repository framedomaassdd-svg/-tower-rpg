/* v76 town built from separate pieces (same art style as the characters):
   sky (tiles sideways, slow parallax) · the tower (parallax, seen through the arch) · one image per building ·
   a tiling street (sidewalk + kerb + cobbles). Every building was scaled by its door so doors are ≈ 1.3× the hero.
   Night: each building has a matching glow image (lit windows, lamps, the forge fire), added with 'screen'.
   ตรอกล่าง (x 6450–11100) is a separate scene with its own backdrop and dirt street; the hero reaches it by walking
   up the alley lane (life-sim LANE), the camera zooms in, the scene cuts, and he walks out of the alley on the other side. World: 11120 × 1080, buildings stand on y = 794, people walk at y ≈ 792–860. */
(function (root) {
  'use strict';
  const V = '?v=163';
  const WORLD_W = 24700, BASE = 794;
  // Two scenes on one strip: the town ends at the alley; ตรอกล่าง begins at the same alley seen from the other side.
  // v87: ลานเกวียน (outside the west gate) is a third scene further along the strip, reached through the city gate.
  // v103: ย่านกิลด์ (guild) is a fifth scene, up the steps under the tower arch
  const ZONES = Object.freeze({ town: [0, 7203], slum: [6450, 11120], carts: [10700, 15400], market: [15500, 19880], guild: [20000, WORLD_W] });
  const zoneAt = x => x >= ZONES.guild[0] ? 'guild' : x >= ZONES.market[0] ? 'market' : x >= 11300 ? 'carts' : x > ZONES.town[1] ? 'slum' : 'town';
  const hasImage = typeof Image !== 'undefined';
  const load = f => { if (!hasImage) return null; const i = new Image(); i.src = f + V; return i; };

  // id, image, left x, top y, width, height (world px); flip = mirrored copy of another building
  const BUILDINGS = Object.freeze([
    { id: 'gate', x: -8, y: 338, w: 673, h: 456 },
    { id: 'tavern', x: 669, y: 371, w: 579, h: 423 },
    { id: 'mkt_mouth', x: 1252, y: 156, w: 1178, h: 638 },          // v90: ปากตรอกตลาด (replaces houses A, B and E)
    { id: 'arch', x: 2434, y: 342, w: 702, h: 452 },
    { id: 'well', x: 3140, y: 567, w: 239, h: 227 },
    { id: 'bakery', x: 3383, y: 333, w: 590, h: 461 },
    { id: 'garden', x: 3978, y: 513, w: 434, h: 281, sway: { top: 0.66, amp: 5 } },   // tree crowns sway in the breeze
    { id: 'forge', x: 4415, y: 386, w: 558, h: 408 },
    { id: 'apothecary', x: 4977, y: 415, w: 418, h: 379 },
    { id: 'inn', x: 5399, y: 167, w: 904, h: 627 },
    // ตรอกล่าง
    { id: 'alley', zones: ['town', 'slum'], x: 6450, y: 317, w: 753, h: 477 },
    { id: 'tenement', x: 7207, y: 202, w: 436, h: 592 },
    { id: 'soup', x: 7647, y: 336, w: 597, h: 458 },
    { id: 'washing', x: 8248, y: 461, w: 518, h: 333 },
    { id: 'junk', x: 8769, y: 357, w: 625, h: 437 },
    { id: 'shackA', x: 9398, y: 450, w: 487, h: 344 },
    { id: 'scrap', x: 9889, y: 433, w: 635, h: 361 },
    { id: 'shackB', x: 10527, y: 407, w: 566, h: 387 },
    // ลานเกวียน (outside the city wall; the city gate is at its east end)
    { id: 'shrine', zone: 'carts', x: 10760, y: 425, w: 485, h: 369 },   // v92 ศาลเจ้าร้าง: a free place to sleep
    { id: 'camp', x: 11330, y: 444, w: 771, h: 350 },
    { id: 'office', x: 12220, y: 374, w: 664, h: 420 },
    { id: 'stable', x: 12975, y: 404, w: 616, h: 390 },
    { id: 'warehouse', x: 13850, y: 339, w: 705, h: 455 },
    { id: 'cgate', x: 14700, y: 324, w: 693, h: 470 },
    // v90 ตลาดใหญ่ (its own scene, reached by the market lane off the main street)
    { id: 'mkt_gate', x: 15520, y: 210, w: 932, h: 584 },
    { id: 'mkt_produce', x: 16470, y: 444, w: 526, h: 350 },
    { id: 'mkt_spice', x: 17010, y: 442, w: 528, h: 352 },
    { id: 'mkt_fountain', x: 17550, y: 353, w: 652, h: 441 },        // v91: น้ำพุลานตลาด (benches ≈ knee height)
    { id: 'mkt_cloth', x: 18220, y: 443, w: 528, h: 351 },
    { id: 'mkt_food', x: 18765, y: 444, w: 528, h: 350 },
    { id: 'mkt_shack', x: 19310, y: 529, w: 513, h: 265 },          // v92 เพิงข้างกองขยะ: a free place to sleep
    // v103 ย่านกิลด์: the gate with the four guilds' banners, then one hall per guild; the tower lies beyond the east end
    { id: 'ggate', x: 20050, y: 234, w: 843, h: 560 },
    { id: 'giron', x: 20960, y: 404, w: 597, h: 390 },             // กิลด์นักรบโล่เหล็ก
    { id: 'gcompass', x: 21620, y: 354, w: 642, h: 440 },          // กิลด์นักสำรวจเข็มทิศเงิน
    { id: 'gporter', x: 22330, y: 369, w: 632, h: 425 },           // สมาคมคนแบกของ
    { id: 'gmerch', x: 23040, y: 349, w: 636, h: 445 },            // กิลด์พ่อค้าหอคอย
    { id: 'gtower', x: 23740, y: 174, w: 917, h: 620 },            // v104 ประตูขึ้นหอคอย: the parties climb its stairs into the tower
    // v95 coach stops (รถม้าโดยสาร): x = centre - 167; life-sim COACH lists the same centres (drawn last: in front)
    { id: 'stop0', img: 'coachstop', zone: 'town', x: -47, y: 578, w: 335, h: 216 },
    { id: 'stop1', img: 'coachstop', zone: 'town', x: 1173, y: 578, w: 335, h: 216 },
    { id: 'stop2', img: 'coachstop', zone: 'town', x: 4263, y: 578, w: 335, h: 216 },
    { id: 'stop3', img: 'coachstop', zone: 'town', x: 6133, y: 578, w: 335, h: 216 },
    { id: 'stop4', img: 'coachstop', zone: 'carts', x: 11123, y: 578, w: 335, h: 216 },
    { id: 'stop5', img: 'coachstop', zone: 'carts', x: 11993, y: 578, w: 335, h: 216 },
    { id: 'stop6', img: 'coachstop', zone: 'carts', x: 13553, y: 578, w: 335, h: 216 },
    { id: 'stop7', img: 'coachstop', zone: 'carts', x: 14453, y: 578, w: 335, h: 216 }
  ]);
  const art = { sky: load('town6_sky.webp'), road: load('town6_road.webp'), tower: load('town6_tower.webp'),
    slumBg: load('town6_slum_bg.webp'), slumRoad: load('town6_slum_road.webp'), cartsBg: load('town6_carts_bg.webp'), mktBg: load('town6_mkt_bg.webp'), backRow: load('v47_backstreet.webp'), benchSleep: load('sleep_bench.webp?v=82') };
  art.guildBg = load('town6_guild_bg.webp');
  art.coachstop = load('town6_coachstop.webp'); art.glow_coachstop = load('town6_glow_coachstop.webp');
  for (const b of BUILDINGS) if (!b.img) { art[b.id] = load('town6_' + b.id + '.webp'); art['glow_' + b.id] = load('town6_glow_' + b.id + '.webp'); }
  const ok = i => !!i && i.complete && i.naturalWidth > 0;
  const ready = () => ok(art.road) && ok(art.inn);

  // Doors and spots other scripts use (world x)
  const SPOTS = Object.freeze({
    gateDoor: 328, tavernDoor: 897, terrace: 1115, mouthDoor: 1602, marketLane: 1864,
    stairs: 2786, plazaLeft: 2581, plazaRight: 2991, well: 3260, bakeryDoor: 3521, stall: 3730,
    gardenBench: 4171, anvil: 4773, forgeFire: 4652, apothecaryDoor: 5088, apothecaryWindow: 5220,
    innDoor: 5828, innCafe: 6103,
    alleyDoor: 6609, alleyLane: 6836, tenementDoor: 7440, soupDoor: 7803, soupCounter: 8052, trough: 8455,
    junkDoor: 8932, junkWindow: 9185, shackA: 9691, scrapDoor: 10014, scrapCart: 10413, shackB: 10873,
    campFire: 11715, officeDoor: 12545, stableDoor: 13283, dock: 14202, outerGate: 15046,
    marketGate: 15986, produce: 16733, spice: 17274, fountain: 17876, cloth: 18484, foodStall: 19029,
    shrine: 11000, shack: 19666,
    guildLane: 20472, ironDoor: 21258, compassDoor: 21941, porterDoor: 22646, merchDoor: 23358, towerPath: 24198
  });
  const GATE = [240, 420];                                   // the lane up through the city gate
  const ARCH = [2665, 2905];                                 // the steps up toward the tower
  const PLACES = Object.freeze({
    tavern: SPOTS.tavernDoor,
    market: SPOTS.stall,
    smith:  4847,                                            // just right of the anvil
    inn:    SPOTS.innDoor,
    bench:  SPOTS.gardenBench,                               // v82: the garden bench (the hero asleep is painted onto it)
    tenement: SPOTS.tenementDoor,                            // ห้องเช่าตรอก
    soup:   SPOTS.soupCounter,                               // โรงทาน
    scrap:  10300,                                           // ลานเก็บของเก่า
    slumyard: SPOTS.scrapDoor,                               // v85: ลานฝึกตรอก, through the scrap yard's door
    cargo:  14050,                                           // v87: ลานเกวียน, by the warehouse dock
    shrine: SPOTS.shrine,                                    // v92 free shelters
    shack:  SPOTS.shack,
    market: SPOTS.produce,                                   // v90: งานรับจ้างที่ตลาดใหญ่ (was the bakery stall)
    guild: SPOTS.ironDoor,                                   // v103 the four guild halls, and the way into the tower
    compass: SPOTS.compassDoor, porter: SPOTS.porterDoor, tmerchant: SPOTS.merchDoor, tower: SPOTS.towerPath
  });
  const BENCH_SEAT = 52, BENCH_PATCH = [280, 438];     // patch position in the garden image's pixels
  const NAMES = [
    [660, 'ประตูเมือง'], [1250, 'ร้านอาหาร'], [2435, 'ปากตรอกตลาด'], [3140, 'ลานหน้าหอคอย'], [3383, 'บ่อน้ำกลางเมือง'],
    [3975, 'ตลาดขนมปัง'], [4415, 'สวนริมทาง'], [4975, 'โรงตีเหล็ก'], [5395, 'ร้านยา'], [6305, 'โรงแรม'], [7205, 'ทางเข้าตรอกล่าง'], [7645, 'ห้องเช่าตรอก'], [8245, 'โรงทาน'],
    [8768, 'ลานซักผ้า'], [9395, 'ร้านรับซื้อของเก่า'], [9888, 'ตรอกล่าง'], [10525, 'ลานของเก่า'], [11300, 'ท้ายตรอก'], [12220, 'ค่ายคาราวาน'], [12975, 'ซุ้มหัวหน้าคนงาน'], [13850, 'คอกสัตว์'], [14700, 'โกดังสินค้า'], [15450, 'ประตูเมืองฝั่งนอก'],
    [16460, 'ปากตรอกฝั่งตลาด'], [17000, 'แผงผักผลไม้'], [17550, 'แผงเครื่องเทศ'], [18215, 'น้ำพุลานตลาด'], [18760, 'แผงผ้า'], [19300, 'ร้านอาหารริมทาง'], [20000, 'กองขยะท้ายตลาด'],
    [20950, 'ซุ้มประตูย่านกิลด์'], [21600, 'กิลด์นักรบโล่เหล็ก'], [22320, 'กิลด์นักสำรวจเข็มทิศเงิน'], [23030, 'สมาคมคนแบกของ'], [23700, 'กิลด์พ่อค้าหอคอย'], [Infinity, 'ประตูขึ้นหอคอย']
  ];
  function sceneName(x) { for (const [limit, name] of NAMES) if (x < limit) return name; return 'ถนนในเมือง'; }
  function walkable(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 35 || x > WORLD_W - 35 || y < 650 || y > 1040) return false;
    if (y >= 765) return true;
    if (x >= GATE[0] && x <= GATE[1]) return y >= 700;
    return x >= ARCH[0] + 20 && x <= ARCH[1] - 20 && y >= 655;
  }
  // v99 perspective: the sidewalk (y ≈ 765–840) is the reference; the road below it is nearer the camera,
  // so anything on it (wagons, the coach, riders) is drawn bigger — about ×1.25 in the middle of the road.
  const NEAR_FROM = 840, NEAR_RATE = 0.0042;
  function depthScale(x, y) {
    if (y >= 765) return 1 + Math.max(0, y - NEAR_FROM) * NEAR_RATE;
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
  function building(ctx, b, im, camera, w, t) {
    if (!ok(im) || b.x > camera + w || b.x + b.w < camera) return;
    if (b.sway && t !== undefined) {                     // upper part drawn in strips, bent a little more toward the top
      const S = b.sway, N = 24, cut = S.top, iw = im.naturalWidth, ih = im.naturalHeight;
      const wv = root.Ambient ? root.Ambient.wind(t) : 0.5;               // stronger sway when the wind gusts
      const gust = (Math.sin(t * 0.0011) * 0.7 + Math.sin(t * 0.0029 + 1.3) * 0.3) * (0.5 + wv * 1.3);
      for (let i = 0; i < N; i++) {
        const f0 = cut * i / N, f1 = cut * (i + 1) / N, k = 1 - (f0 + f1) / 2 / cut;
        const dx = S.amp * gust * k * k;
        ctx.drawImage(im, 0, ih * f0, iw, ih * (f1 - f0) + 1, b.x + dx, b.y + b.h * f0, b.w, b.h * (f1 - f0) + 0.6);
      }
      ctx.drawImage(im, 0, ih * cut, iw, ih * (1 - cut), b.x, b.y + b.h * cut, b.w, b.h * (1 - cut));
      return;
    }
    if (b.flip) { ctx.save(); ctx.translate(b.x + b.w, b.y); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, b.w, b.h); ctx.restore(); }
    else ctx.drawImage(im, b.x, b.y, b.w, b.h);
  }
  // v89: rows of houses behind the main street so the town no longer stands alone in open country.
  // Two copies of one row, the far one smaller, slower and hazier (scale, parallax rate, bottom y, haze).
  const BACK_ROWS = [[0.62, 0.55, 700, 0.5], [0.8, 0.75, 770, 0.25]];
  const hazed = {};                                       // the row image with its haze baked in (only the houses, not the sky)
  function hazedRow(im, haze) {
    if (hazed[haze]) return hazed[haze];
    if (typeof document === 'undefined') return im;
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(190,215,240,${haze})`; g.fillRect(0, 0, c.width, c.height);
    c.naturalWidth = c.width; c.naturalHeight = c.height;
    return (hazed[haze] = c);
  }
  function backRows(ctx, camera, w) {
    const im = art.backRow; if (!ok(im)) return;
    for (const [s, rate, y, haze] of BACK_ROWS) {
      const row = hazedRow(im, haze);
      tiled(ctx, row, 0, 0, row.naturalHeight, 0, y - row.naturalHeight * s, s, camera, w, rate);
    }
  }
  // v92: each scene draws only its own buildings, so scenes may share x ranges (the shrine sits west of the cart yard)
  const inZone = (b, zone) => !zone || (b.zones ? b.zones.includes(zone) : (b.zone || zoneAt(b.x + b.w / 2)) === zone);
  // where the hero lies down in the free shelters (world px; feet-line of the lying sprite)
  const BEDS = Object.freeze({ shrine: { x: 10990, y: 703 }, shack: { x: 19662, y: 763 } });
  const SMOKE = [[6539, 335], [7129, 355], [7275, 219], [7739, 351], [8864, 371], [9778, 466], [9956, 445],[746, 385], [1382, 190], [2294, 166], [18960, 600], [19050, 605], [3871, 351], [4866, 390], [5504, 188], [5045, 427]];
  function draw(ctx, camera, w, h, t, zone) {
    ctx.fillStyle = '#3d86e0'; ctx.fillRect(camera, 0, w, h);
    const road = im => tiled(ctx, im, 0, ROAD_ROW, im.naturalHeight - ROAD_ROW, 0, ROAD_Y, ROAD_S, camera, w, 1);
    if (zone === 'carts') {                                // open country: far fields and hills, a dirt yard
      ctx.fillStyle = '#7fb2e8'; ctx.fillRect(camera, 0, w, SKY_BOTTOM);
      if (ok(art.cartsBg)) tiled(ctx, art.cartsBg, 0, 0, art.cartsBg.naturalHeight, 0, SKY_BOTTOM + 10 - art.cartsBg.naturalHeight * 1.37, 1.37, camera, w, SKY_RATE);
      if (root.Ambient && t !== undefined) root.Ambient.drawClouds(ctx, camera, w, t, 0.55);
      ctx.fillStyle = 'rgba(250,232,200,0.12)'; ctx.fillRect(camera, 0, w, SKY_BOTTOM);
      if (ok(art.slumRoad)) road(art.slumRoad);
    } else if (zone === 'market') {                      // v90: rows of stalls and roofs, the city wall behind
      ctx.fillStyle = '#9fc0ea'; ctx.fillRect(camera, 0, w, SKY_BOTTOM);
      if (ok(art.mktBg)) tiled(ctx, art.mktBg, 0, 0, art.mktBg.naturalHeight, 0, SKY_BOTTOM + 20 - art.mktBg.naturalHeight * 1.05, 1.05, camera, w, SKY_RATE);
      if (root.Ambient && t !== undefined) root.Ambient.drawClouds(ctx, camera, w, t, 0.5);
      ctx.fillStyle = 'rgba(240,226,206,0.3)'; ctx.fillRect(camera, 0, w, SKY_BOTTOM);
      if (ok(art.road)) road(art.road);
    } else if (zone === 'guild') {                       // v103: one wide painting, slid so its two ends meet the zone's ends
      ctx.fillStyle = '#a9c4ec'; ctx.fillRect(camera, 0, w, h);
      const im = art.guildBg;
      if (ok(im)) {
        const s = Math.max(1.22, (w * 1.15) / im.naturalWidth), iw = im.naturalWidth * s, Z = ZONES.guild;
        const f = Math.max(0, Math.min(1, (camera - Z[0]) / Math.max(1, Z[1] - Z[0] - w)));
        ctx.drawImage(im, camera - f * (iw - w), 780 - 630 * s, iw, im.naturalHeight * s);
      }
      if (root.Ambient && t !== undefined) root.Ambient.drawClouds(ctx, camera, w, t, 0.45);
      ctx.fillStyle = 'rgba(240,226,206,0.22)'; ctx.fillRect(camera, 0, w, SKY_BOTTOM);
      if (ok(art.road)) road(art.road);
    } else if (zone === 'slum') {
      // backdrop smaller and hazed so its rooftops read as far away behind the real shacks
      ctx.fillStyle = '#9fb8dc'; ctx.fillRect(camera, 0, w, SKY_BOTTOM);
      if (ok(art.slumBg)) tiled(ctx, art.slumBg, 0, 0, art.slumBg.naturalHeight, 0, SKY_BOTTOM - art.slumBg.naturalHeight * 0.82, 0.82, camera, w, SKY_RATE);
      if (root.Ambient && t !== undefined) root.Ambient.drawClouds(ctx, camera, w, t, 0.8);
      ctx.fillStyle = 'rgba(246,224,196,0.42)'; ctx.fillRect(camera, 0, w, SKY_BOTTOM);
      if (ok(art.slumRoad)) road(art.slumRoad);
    } else {
      if (ok(art.sky)) tiled(ctx, art.sky, 0, 0, art.sky.naturalHeight, 0, SKY_BOTTOM - art.sky.naturalHeight, 1, camera, w, SKY_RATE);
      if (root.Ambient && t !== undefined) root.Ambient.drawClouds(ctx, camera, w, t);
      tower(ctx, camera, w);
      backRows(ctx, camera, w);
      if (ok(art.road)) road(art.road);
    }
    for (const b of BUILDINGS) {
      if (!inZone(b, zone)) continue;
      building(ctx, b, art[b.img || b.id], camera, w, t);
      const a = root.BENCH_SLEEP || 0;                     // hero asleep on the garden bench: a patch of the garden painting
      if (b.id === 'garden' && a > 0 && ok(art.benchSleep) && ok(art.garden)) {
        const k = b.w / art.garden.naturalWidth;
        ctx.save(); ctx.globalAlpha = Math.min(1, a);
        ctx.drawImage(art.benchSleep, b.x + BENCH_PATCH[0] * k, b.y + BENCH_PATCH[1] * k, art.benchSleep.naturalWidth * k, art.benchSleep.naturalHeight * k);
        ctx.restore();
      }
    }
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
  function drawNight(ctx, camera, w, amount, t, zone) {
    if (amount <= 0.01) return;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.min(1, amount) * (0.94 + 0.06 * Math.sin(t * 0.004));  // faint flicker
    for (let pass = 0; pass < 2; pass++) {                   // two passes: lit windows read clearly through the night tint
      for (const b of BUILDINGS) if (inZone(b, zone)) building(ctx, b, art['glow_' + (b.img || b.id)], camera, w);
      ctx.globalAlpha *= 0.7;
    }
    ctx.restore();
  }
  const S = 1080 / 724, wx = x => Math.round(x * S);       // kept for older callers
  root.TownPano = { ZONES, zoneAt, art, ready, draw, drawNight, walkable, depthScale, sceneName, PLACES, SPOTS, BUILDINGS, BEDS, BENCH_SEAT, benchSleepReady: () => ok(art.benchSleep) && ok(art.garden), WORLD_W, BASE, GATE, ARCH, S, wx };
})(typeof globalThis !== 'undefined' ? globalThis : this);
