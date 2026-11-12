/* v70 interiors: the inn (lobby, three bedrooms, laundry) and the restaurant (hall, kitchen).
   Each scene is one 1672×941 painting. The camera follows the hero sideways on narrow screens.
   Interiors.show(ctx, canvas, t, clock, info) draws the scene for info.room and returns true; info comes from LifeSim.sample(). */
(function (root) {
  'use strict';
  const V = '?v=70', IW = 1672, IH = 941, HERO_H = 330, FLOOR = 806;
  // stations: where the hero stands (x), facing the wall ('back') or the room ('front')
  const SCENES = {
    lobby:      { file: 'inn_lobby',          name: 'ล็อบบี้โรงแรม',  stand: { x: 720, look: 'back' } },
    bed_cheap:  { file: 'inn_room_cheap',     name: 'ห้องประหยัด',   bed: { head: 1285, y: 566, clip: null },          stand: { x: 700, look: 'front' } },
    bed_mid:    { file: 'inn_room_mid',       name: 'ห้องธรรมดา',    bed: { head: 1478, y: 520, clip: [1338, 430, 220, 160] }, stand: { x: 720, look: 'front' } },
    bed_luxe:   { file: 'inn_room_luxe',      name: 'ห้องหรู',       bed: { head: 1500, y: 512, clip: [1372, 420, 190, 160] }, stand: { x: 900, look: 'front' } },
    laundry:    { file: 'inn_laundry',        name: 'ห้องซักผ้าโรงแรม', route: [420, 800, 1130, 1420] },
    restaurant: { file: 'restaurant_hall',    name: 'ร้านอาหาร',     seat: { x: 757, foot: 716, cut: 577 } },
    kitchen:    { file: 'restaurant_kitchen', name: 'ห้องครัว',      route: [345, 670, 1055, 1385] }
  };
  const hasImage = typeof Image !== 'undefined';
  const img = {};
  function load() { if (!hasImage) return; for (const k in SCENES) if (!img[k]) { const i = new Image(); i.src = SCENES[k].file + '.webp' + V; img[k] = i; } }
  const ok = i => !!i && i.complete && i.naturalWidth > 0;
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
    root.HeroSprite.draw(ctx, Object.assign({ scale: HERO_H / root.HeroSprite.HEIGHT, face: 1 }, o, { face: 1 }));
    ctx.restore();
  }
  function shadow(ctx, x, foot) {
    ctx.fillStyle = 'rgba(40,20,10,.28)'; ctx.beginPath(); ctx.ellipse(x, foot - 2, 62, 13, 0, 0, Math.PI * 2); ctx.fill();
  }
  function sleeper(ctx, bed, t) {
    if (!root.HeroSprite || !root.HeroSprite.ready()) return;
    ctx.save();
    if (bed.clip) { ctx.beginPath(); ctx.rect(bed.clip[0], bed.clip[1], bed.clip[2], bed.clip[3]); ctx.clip(); }
    ctx.translate(bed.head - HERO_H, bed.y + Math.sin(t * 0.0016) * 1.5); ctx.rotate(Math.PI / 2);    // lying down, head on the pillow
    root.HeroSprite.draw(ctx, { scale: HERO_H / root.HeroSprite.HEIGHT, vdir: 1, moving: false, face: 1 });
    ctx.restore();
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

  let lastRoom = null, enteredAt = 0;
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
    else if (sc.route) { const r = onRoute(sc.route, (t - enteredAt) / 1000); act = { x: r.x, moving: r.moving, face: r.face, look: 'back', focus: r.x }; }
    else if (sc.seat) act = { seat: sc.seat, focus: sc.seat.x };
    else if (sc.stand) act = { x: sc.stand.x, look: sc.stand.look, moving: false, face: 1, focus: sc.stand.x };

    // camera: cover the screen, follow the hero sideways, keep the floor in view
    const scale = Math.max(W / IW, H / IH), vw = W / scale, vh = H / scale;
    const camX = Math.max(0, Math.min(IW - vw, (act ? act.focus : IW / 2) - vw / 2));
    const camY = Math.max(0, Math.min(IH - vh, 560 - vh / 2));
    ctx.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);
    ctx.drawImage(im, 0, 0, IW, IH);

    const anim = t * 0.008;
    if (act && act.sleep && sc.bed) sleeper(ctx, sc.bed, t);
    else if (act && act.seat) {
      const s = act.seat;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, IW, s.cut); ctx.clip();                    // lower body is behind the table
      hero(ctx, s.x, s.foot + Math.sin(t * 0.004) * 1.5, { vdir: 1, moving: false, anim });
      ctx.restore();
    } else if (act) {
      shadow(ctx, act.x, FLOOR);
      if (act.moving) hero(ctx, act.x, FLOOR, { moving: true, anim, face: act.face, horizontal: true });
      else if (act.look === 'back') hero(ctx, act.x, FLOOR, { vdir: -1, moving: !!sc.route, anim: t * 0.012 });   // busy at the counter
      else hero(ctx, act.x, FLOOR, { vdir: 1, moving: false, anim });
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
    if (act && act.sleep && sc.bed && !info.rest) zzz(ctx, sc.bed.head + 20, sc.bed.y - 70, t);

    // fade in when entering a room
    const fade = 1 - Math.min(1, (t - enteredAt) / 350);
    if (fade > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = 'rgba(15,10,8,' + fade.toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    return true;
  }
  load();
  root.Interiors = { SCENES, show, images, onRoute, _reset() { lastRoom = null; } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
