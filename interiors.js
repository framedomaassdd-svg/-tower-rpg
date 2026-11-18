/* v79 interiors: the inn (lobby, three bedrooms, laundry), the restaurant (hall, kitchen), the forge, the bakery,
   the guild hall, the apothecary, and in ตรอกล่าง the soup kitchen, the junk shop and a tenement room.
   Each scene is one 1672×941 painting. The camera follows the hero sideways on narrow screens.
   Interiors.show(ctx, canvas, t, clock, info) draws the scene for info.room and returns true; info comes from LifeSim.sample(). */
(function (root) {
  'use strict';
  const V = '?v=70', IW = 1672, IH = 941, HERO_H = 330, FLOOR = 806;
  // stations: where the hero stands (x), facing the wall ('back') or the room ('front')
  const SCENES = {
    lobby:      { file: 'inn_lobby',          name: 'ล็อบบี้โรงแรม',  stand: { x: 720, look: 'back' } },
    bed_cheap:  { file: 'inn_room_cheap',     name: 'ห้องประหยัด',   bed: { head: 1285, y: 566, clip: null, zz: [1215, 470] },          stand: { x: 700, look: 'front' } },
    bed_mid:    { file: 'inn_room_mid',       name: 'ห้องธรรมดา',    bed: { head: 1478, y: 520, clip: [1338, 430, 220, 160], zz: [1395, 420] }, stand: { x: 720, look: 'front' } },
    bed_luxe:   { file: 'inn_room_luxe',      name: 'ห้องหรู',       bed: { head: 1500, y: 512, clip: [1372, 420, 190, 160], zz: [1460, 410] }, stand: { x: 900, look: 'front' } },
    laundry:    { file: 'inn_laundry',        name: 'ห้องซักผ้าโรงแรม', route: [420, 800, 1130, 1420] },
    restaurant: { file: 'restaurant_hall',    name: 'ร้านอาหาร',     seat: { x: 757, foot: 716, cut: 577, table: 578, h: 205 } },
    kitchen:    { file: 'restaurant_kitchen', name: 'ห้องครัว',      route: [345, 670, 1055, 1385] },
    // v79 (newer paintings, file names int_*). work: a hero pose at x; npcs: townsfolk sheets (h = × hero height)
    forge:      { file: 'int_forge',      name: 'โรงตีเหล็ก', k: 1.12, work: { kind: 'hammer', x: 1040, face: -1 },
                  npcs: [{ sheet: 'smith', x: 430, loop: 'hammer', face: 1, h: 1.03 }],
                  props: [{ id: 'anvil', x: 575, foot: 810, w: 0.5 }, { id: 'anvil', x: 895, foot: 810, w: 0.5 }] },   // one anvil each
    bakery:     { file: 'int_bakery',     name: 'ร้านขนมปัง', k: 1.28, stand: { x: 1180, look: 'back' } },
    guild:      { file: 'int_guild',      name: 'ห้องโถงกิลด์', k: 1.22, stand: { x: 800, look: 'back' },
                  npcs: [{ sheet: 'elder', x: 330, loop: 'write', face: 1, h: 0.8 / 1.22, foot: 640, behind: 528 }] },
    apothecary: { file: 'int_apothecary', name: 'ร้านยา', k: 1.28, stand: { x: 640, look: 'back' },
                  npcs: [{ sheet: 'apothecary', x: 1040, loop: 'grind', face: -1, h: 0.93 }] },
    junk:       { file: 'int_junk',       name: 'ร้านรับซื้อของเก่า', k: 1.34, stand: { x: 1250, look: 'back' } },
    soup:       { file: 'int_soup',       name: 'โรงทาน', k: 1.2, seat: { x: 1230, foot: 585, cut: 488, table: 484, h: 200 },
                  npcs: [{ sheet: 'granny', x: 560, foot: 735, loop: 'stir', face: 1, h: 0.82 }],
                  props: [{ id: 'cauldron', x: 693, foot: 742, w: 0.46 * 0.82 / 0.88, fire: true, front: true }] },
    // v85 training yards: the guild's (behind the tower arch) and the alley one (through the scrap yard)
    yard:       { file: 'int_yard',       name: 'ลานฝึกกิลด์', k: 1.0, work: { kind: 'swing', x: 820, face: -1 },
                  npcs: [{ sheet: 'instructor', x: 400, loop: 'swing', face: 1, h: 1.0 }],
                  ambient: { leaves: [{ x0: 0, x1: 480, y0: 20, y1: 200, gy: 860, petals: 0.3 }, { x0: 430, x1: 1600, y0: 110, y1: 160, gy: 860, petals: 1 }],
                             flowers: [[505, 200, 0], [1570, 200, 1], [770, 600, 1]] } },
    slumyard:   { file: 'int_slumyard',   name: 'ลานฝึกตรอก', k: 1.0, work: { kind: 'swing', x: 1060, face: 1 },
                  npcs: [{ sheet: 'thug', x: 460, loop: 'knuckle', face: 1, h: 1.04 }, { sheet: 'streetkid', x: 250, loop: 'juggle', face: 1, h: 0.72 }],
                  ambient: { leaves: [{ x0: 0, x1: 380, y0: 10, y1: 130, gy: 860, petals: 0 }], flowers: [[900, 560, 0]] } },
    tenement:   { file: 'int_tenement',   name: 'ห้องเช่าตรอก', k: 1.15, bed: { head: 490, y: 540, headLeft: true, clip: [380, 330, 225, 260], zz: [470, 420] },
                  stand: { x: 800, look: 'front' } }
  };
  // v105 guild rooms (gi_<guild>_<room>.webp). Per guild: master's office, hall (quest board), dining hall, kitchen,
  // members' bedroom, storeroom. The merchants' guild has no paintings yet and borrows the Iron Shield's rooms.
  const GUILD_ROOMS = {
    iron: { boss: 'ironboss', office: { desk: 830, top: 458 }, hall: null, store: 836, dine: { x: 845, table: 548 }, cook: [720, 1150, 1420], bed: [300, 505] },
    compass: { boss: 'compassboss', office: { desk: 840, top: 455 }, hall: { board: 835, clerk: 300, top: 538 }, store: 836, dine: { x: 410, table: 545 }, cook: [660, 1150, 1460], bed: [545, 455] },
    porter: { boss: 'porterboss', office: { desk: 860, top: 446 }, hall: { board: 840, clerk: 340, top: 505 }, store: 836, dine: { x: 470, table: 520 }, cook: [650, 1080, 1360], bed: [590, 470] }
  };
  GUILD_ROOMS.merch = Object.assign({}, GUILD_ROOMS.iron, { boss: 'merchboss', borrow: 'iron' });
  const GNAME = { iron: 'กิลด์โล่เหล็ก', compass: 'กิลด์เข็มทิศเงิน', porter: 'สมาคมคนแบกของ', merch: 'กิลด์พ่อค้าหอคอย' };
  for (const g in GUILD_ROOMS) {
    const R = GUILD_ROOMS[g], f = room => 'gi_' + (R.borrow || g) + '_' + room, n = GNAME[g], K = 1.12;
    SCENES['g_' + g + '_office'] = { file: f('office'), name: 'ห้องทำงานหัวหน้า' + n, k: K, stand: { x: R.office.desk - 340, look: 'back' },
      npcs: [{ sheet: R.boss, x: R.office.desk, loop: 'idle', face: 1, h: 0.95, foot: 640, behind: R.office.top + 4 }] };
    SCENES['g_' + g + '_hall'] = R.hall || R.borrow ? (R.hall
      ? { file: f('hall'), name: 'โถง' + n, k: K, stand: { x: R.hall.board, look: 'back' }, npcs: [{ sheet: 'elder', x: R.hall.clerk, loop: 'write', face: 1, h: 0.72, foot: 660, behind: R.hall.top }] }
      : Object.assign({}, SCENES.guild, { name: 'โถง' + n })) : Object.assign({}, SCENES.guild, { name: 'โถง' + n });
    SCENES['g_' + g + '_store'] = { file: f('store'), name: 'ห้องเก็บของ' + n, k: K, stand: { x: R.store + 170, look: 'back' },
      npcs: [{ sheet: 'elder', x: R.store - 80, loop: 'write', face: 1, h: 0.72, foot: 660, behind: 520 }] };
    SCENES['g_' + g + '_dining'] = { file: f('dining'), name: 'โรงอาหาร' + n, k: K, seat: { x: R.dine.x, table: R.dine.table, h: 200, foot: R.dine.table + 160, cut: R.dine.table } };
    SCENES['g_' + g + '_kitchen'] = { file: f('kitchen'), name: 'ครัว' + n, k: K, route: R.cook, pose: 'chop' };
    SCENES['g_' + g + '_bed'] = { file: f('bed'), name: 'ห้องพัก' + n, k: K, bed: { head: R.bed[0] + 190, y: R.bed[1], nohero: true, zz: [R.bed[0] + 10, R.bed[1] - 40] } };
  }
  const hasImage = typeof Image !== 'undefined';
  const img = {};
  function load() { if (!hasImage) return; for (const k in SCENES) if (!img[k]) { const i = new Image(); i.src = SCENES[k].file + '.webp' + (SCENES[k].file.startsWith('int_') ? '?v=79' : SCENES[k].file.startsWith('gi_') ? '?v=105' : V); img[k] = i; } }
  const ok = i => !!i && i.complete && i.naturalWidth > 0;
  // v81: the hero asleep is painted into each bed (a patch of the room, laid over it), and eats facing the camera
  const SLEEP = { bed_cheap: [755, 440], bed_mid: [985, 405], bed_luxe: [1120, 380], tenement: [345, 425] };
  const sleepImg = {}; let eatImg = null;
  if (hasImage) {
    for (const k in SLEEP) { const i = new Image(); i.src = 'sleep_' + k + '.webp?v=81'; sleepImg[k] = i; }
    eatImg = new Image(); eatImg.src = 'npc5_heroEat.webp?v=81';
  }
  // v83: dinner painted into the room — A = the whole room with the hero eating (spoon in the bowl), B = spoon at his mouth
  const DINE = { soup: { id: 'soup', B: [1116, 285], bowl: [1240, 512] }, restaurant: { id: 'rest', B: [633, 403], bowl: [728, 556] } };
  const dineImg = {};
  if (hasImage) for (const k in DINE) for (const f of ['A', 'B']) { const i = new Image(); i.src = 'eat_' + DINE[k].id + '_' + f + '.webp?v=83'; dineImg[k + f] = i; }
  function steam(ctx, x, y, t) {
    ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.0004) + i / 3) % 1, sx = x + (i - 1) * 14;
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.35; ctx.beginPath();
      for (let j = 0; j <= 8; j++) { const q = j / 8, yy = y - 10 - k * 40 - q * 26; ctx[j ? 'lineTo' : 'moveTo'](sx + Math.sin(q * 5 + t * 0.003 + i) * 5, yy); }
      ctx.stroke();
    }
    ctx.restore();
  }
  const EAT = { cell: 560, base: 4, body: 534, times: [1.3, 0.8, 1.1, 1.6] };
  const s0 = seat => !!seat.table;
  function eatFront(ctx, s, sec) {                 // waist-up, the bowl resting on the table top
    if (!ok(eatImg)) return false;
    let q = sec % EAT.times.reduce((a, b) => a + b, 0), f = 0;
    while (q >= EAT.times[f]) { q -= EAT.times[f]; f++; }
    const k = s.h / EAT.body, bob = f === 1 ? -3 : 0;
    ctx.drawImage(eatImg, f * EAT.cell, 0, EAT.cell, EAT.cell, s.x - EAT.cell / 2 * k, s.table - (EAT.cell - EAT.base) * k + bob, EAT.cell * k, EAT.cell * k);
    return true;
  }
  const images = () => Object.values(img);

  // ---- walking a route: dwell at each station, then walk to the next (there and back again)
  const DWELL = 3.4, SPEED = 300;
  function onRoute(route, seconds) {
    const order = route.concat(route.slice(1, -1).reverse());            // 0 1 2 3 2 1
    let total = 0; const legs = [];
    for (let i = 0; i < order.length; i++) {
      const a = order[i], b = order[(i + 1) % order.length], walk = Math.abs(b - a) / SPEED;
      legs.push({ a, b, walk }); total += DWELL + walk;
    }
    let s = ((seconds % total) + total) % total;
    for (const leg of legs) {
      if (s < DWELL) return { x: leg.a, moving: false, face: 1 };
      s -= DWELL;
      if (s < leg.walk) return { x: leg.a + (leg.b - leg.a) * (s / leg.walk), moving: true, face: leg.b > leg.a ? 1 : -1 };
      s -= leg.walk;
    }
    return { x: route[0], moving: false, face: 1 };
  }

  function hero(ctx, x, foot, o) {
    if (!root.HeroSprite || !root.HeroSprite.ready()) return;
    ctx.save(); ctx.translate(x, foot); ctx.scale(o.face || 1, 1);
    root.HeroSprite.draw(ctx, Object.assign({ scale: HERO_H * (o.k || 1) / root.HeroSprite.HEIGHT, face: 1 }, o, { face: 1 }));
    ctx.restore();
  }
  // A work pose from the hero's work sheets (town-npcs.js); false if those images are not loaded yet.
  function pose(ctx, kind, x, foot, o) {
    const N = root.TownNPCs; if (!N || !N.heroReady(kind)) return false;
    ctx.save(); ctx.translate(x, foot);
    N.drawHero(ctx, kind, Object.assign({ height: HERO_H * 648 / 680 * (o.k || 1) }, o));
    ctx.restore();
    return true;
  }
  const WORK_POSE = { kitchen: 'chop', laundry: 'mop' };
  function shadow(ctx, x, foot, k) {
    k = k || 1; ctx.fillStyle = 'rgba(40,20,10,.28)'; ctx.beginPath(); ctx.ellipse(x, foot - 2, 62 * k, 13 * k, 0, 0, Math.PI * 2); ctx.fill();
  }
  function sleeper(ctx, bed, t) {
    // real sleeping frames: lying on the back, head on the pillow (sheet's head is on the left, so it is mirrored)
    const k = HERO_H * 648 / 680 / 353;
    if (root.TownNPCs && root.TownNPCs.heroReady('sleep')) {
      ctx.save();
      if (bed.clip) {                                   // under the blanket: only the head and shoulders show above its fold
        if (bed.headLeft) { ctx.beginPath(); ctx.rect(bed.clip[0], bed.clip[1], bed.clip[2], bed.clip[3]); ctx.clip(); }
        else { const left = Math.max(bed.clip[0], bed.head - 63);
          ctx.beginPath(); ctx.rect(left, bed.clip[1], bed.clip[0] + bed.clip[2] - left, bed.clip[3]); ctx.clip(); }
      }
      const ok = bed.headLeft ? pose(ctx, 'sleep', bed.head + 150 * k - 62, bed.y + 68 * k + 25, { sec: t / 1000, face: 1 })
        : pose(ctx, 'sleep', bed.head - 150 * k + 62, bed.y + 68 * k + 25, { sec: t / 1000, face: -1 });
      ctx.restore();
      if (ok) return;
    }
    if (!root.HeroSprite || !root.HeroSprite.ready()) return;
    ctx.save();
    if (bed.clip) { ctx.beginPath(); ctx.rect(bed.clip[0], bed.clip[1], bed.clip[2], bed.clip[3]); ctx.clip(); }
    ctx.translate(bed.head - HERO_H, bed.y + Math.sin(t * 0.0016) * 1.5); ctx.rotate(Math.PI / 2);    // lying down, head on the pillow
    root.HeroSprite.draw(ctx, { scale: HERO_H / root.HeroSprite.HEIGHT, vdir: 1, moving: false, face: 1 });
    ctx.restore();
  }
  // townsfolk inside a room (their own sheets via TownNPCs); `behind` clips them at a counter top
  function people(ctx, sc, t) {
    const N = root.TownNPCs; if (!N || !sc.npcs) return;
    for (const p of sc.npcs) {
      const h = HERO_H * 648 / 680 * p.h * (sc.k || 1), [row, col, flip] = N.frameOf({ id: p.sheet, loop: p.loop, face: p.face, height: h }, t / 1000);
      ctx.save();
      if (p.behind) { ctx.beginPath(); ctx.rect(0, 0, IW, p.behind); ctx.clip(); }
      const f = p.foot || FLOOR; if (!p.behind) shadow(ctx, p.x, f, h / (HERO_H * 648 / 680)); N.blit(ctx, p.sheet, row, col, flip, h, p.x, f, 1);
      ctx.restore();
    }
  }
  function zzz(ctx, x, y, t) {
    ctx.save(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.00035) + i / 3) % 1;
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9; ctx.font = '700 ' + Math.round(26 + 22 * k) + 'px system-ui';
      ctx.fillText('z', x + 30 * k + 14 * Math.sin(k * 5), y - 110 * k);
    }
    ctx.restore();
  }

  let lastRoom = null, enteredAt = 0, sleepSince = 0, wasAsleep = false;
  function show(ctx, cv, t, clock, info) {
    const sc = SCENES[info && info.room], im = sc && img[info.room];
    if (!sc) { lastRoom = null; return false; }
    if (info.room !== lastRoom) { lastRoom = info.room; enteredAt = t; }
    const W = cv.width, H = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#1b130f'; ctx.fillRect(0, 0, W, H);
    if (!ok(im)) return true;

    // what the hero is doing
    let act = null;
    if (info.sleep) act = { sleep: true, focus: sc.bed ? sc.bed.head - 190 : IW / 2 };
    else if (sc.work) act = { x: sc.work.x, work: sc.work, focus: sc.work.x };
    else if (sc.route) { const r = onRoute(sc.route, (t - enteredAt) / 1000); act = { x: r.x, moving: r.moving, face: r.face, look: 'back', focus: r.x }; }
    else if (sc.seat) act = { seat: sc.seat, focus: sc.seat.x };
    else if (sc.stand) act = { x: sc.stand.x, look: sc.stand.look, moving: false, face: 1, focus: sc.stand.x };

    // camera: cover the screen, follow the hero sideways, keep the floor in view
    const scale = Math.max(W / IW, H / IH), vw = W / scale, vh = H / scale;
    const camX = Math.max(0, Math.min(IW - vw, (act ? act.focus : IW / 2) - vw / 2));
    const camY = Math.max(0, Math.min(IH - vh, 560 - vh / 2));
    ctx.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);
    const dine = info.eating && DINE[info.room] && ok(dineImg[info.room + 'A']) && ok(dineImg[info.room + 'B']) ? DINE[info.room] : null;
    ctx.drawImage(dine ? dineImg[info.room + 'A'] : im, 0, 0, IW, IH);
    if (dine) {
      const sec = (t - enteredAt) / 1000 % 2.6;                    // spoon down 1.6 s, spoon at the mouth 1 s
      if (sec >= 1.6) ctx.drawImage(dineImg[info.room + 'B'], dine.B[0], dine.B[1]);
      else steam(ctx, dine.bowl[0], dine.bowl[1], t);
    }

    const anim = t * 0.008, K = sc.k || 1;
    const prop = front => { const N = root.TownNPCs; if (!N || !sc.props) return;          // work props, sized like on the street
      for (const p of sc.props) if (!!p.front === front) N.drawProp(ctx, p.id, p.x, p.foot, p.w * HERO_H * 648 / 680 * K, t, p.fire); };
    prop(false);
    people(ctx, sc, t);
    const patch = SLEEP[info.room] && sleepImg[info.room], asleep = !!(act && act.sleep);
    if (asleep && !wasAsleep) sleepSince = t; wasAsleep = asleep;
    if (act && act.sleep && sc.bed) {
      if (ok(patch)) { ctx.save(); ctx.globalAlpha = Math.min(1, (t - Math.max(enteredAt, sleepSince)) / 600); ctx.drawImage(patch, SLEEP[info.room][0], SLEEP[info.room][1]); ctx.restore(); }
      else if (!sc.bed.nohero) sleeper(ctx, sc.bed, t);
    }
    else if (act && act.work) { shadow(ctx, act.x, FLOOR, K);
      if (!pose(ctx, act.work.kind, act.x, FLOOR, { sec: t / 1000, face: act.work.face, k: K })) hero(ctx, act.x, FLOOR, { vdir: -1, moving: true, anim: t * 0.012, k: K }); }
    else if (act && act.seat && dine) { /* the hero is part of the painting */ }
    else if (act && act.seat && info.eating && s0(act.seat) && eatFront(ctx, act.seat, t / 1000)) { /* eating, facing the camera */ }
    else if (act && act.seat) {
      const s = act.seat;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, IW, s.cut); ctx.clip();                    // lower body is behind the table
      if (!(info.eating && pose(ctx, 'eat', s.x, s.foot, { sec: t / 1000, face: 1, k: s.k })))
        hero(ctx, s.x, s.foot + Math.sin(t * 0.004) * 1.5, { vdir: 1, moving: false, anim, k: s.k });
      ctx.restore();
    } else if (act) {
      shadow(ctx, act.x, FLOOR, K);
      if (act.moving) hero(ctx, act.x, FLOOR, { moving: true, anim, face: act.face, horizontal: true, k: K });
      else if (sc.route && (WORK_POSE[info.room] || sc.pose) && pose(ctx, WORK_POSE[info.room] || sc.pose, act.x, FLOOR, { sec: t / 1000, face: act.face, k: K })) { /* working at a station */ }
      else if (act.look === 'back') hero(ctx, act.x, FLOOR, { vdir: -1, moving: !!sc.route, anim: t * 0.012, k: K });   // busy at the counter
      else hero(ctx, act.x, FLOOR, { vdir: 1, moving: false, anim, k: K });
    }

    prop(true);
    if (sc.ambient && root.Ambient) {                            // outdoor yards: leaves on the wind, butterflies by the flowers
      for (const a of sc.ambient.leaves || []) root.Ambient.flurry(ctx, a, camX, vw, t, 10, 60);
      (sc.ambient.flowers || []).forEach(([x, y, k], i) => root.Ambient.butterfly(ctx, x, y, 80, k, t, i + 4));
    }
    // light: evening warmth, and a dark room while asleep
    let lamps = 0, tint = null;
    try { const l = root.CityLighting.sample(clock); lamps = l.lamps; tint = l; } catch (e) {}
    if (act && act.sleep && !info.rest) {
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(52,62,112,' + (0.25 + 0.5 * lamps).toFixed(3) + ')';
      ctx.fillRect(camX, camY, vw, vh); ctx.restore();
    } else if (lamps > 0.02) {
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(255,196,140,' + (0.35 * lamps).toFixed(3) + ')';
      ctx.fillRect(camX, camY, vw, vh); ctx.restore();
    }
    if (act && act.sleep && sc.bed && !info.rest) { const z = sc.bed.zz || [sc.bed.head + 20, sc.bed.y - 70]; zzz(ctx, z[0], z[1], t); }

    // fade in when entering a room
    const fade = 1 - Math.min(1, (t - enteredAt) / 350);
    if (fade > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = 'rgba(15,10,8,' + fade.toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    return true;
  }
  load();
  root.Interiors = { SCENES, show, images, onRoute, _reset() { lastRoom = null; } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
