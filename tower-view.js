/* v127 the tower on screen (ผู้สร้าง: ฉากหอคอย 5 ชั้น + มอนสเตอร์ + ท่าโจมตีด้วยดาบ/หอก/ธนู/กระบอง).
   While the hero is inside the tower (LifeSim.sample → info.tower) the game draws the floor's scene instead of the town:
   the hero exploring, a monster of the floor prowling, the stones found on this floor, and the camp at night.
   TowerView.fight({ name, win, boss }) plays a short fight (hero attack row by weapon kind, monster hurt/attack/defeat)
   and returns its length in ms; life-ui hides the encounter card while it plays.
   Art: tower/floorN.webp (1672×941) · tower/stone_exit|stone_up|camp.webp · monsters/<id>.webp (4×3: idle / attack / hurt+defeat,
   facing left; sizes in "units" where a person is 345 tall) · npc5_heroCombat.webp per look (4×5 cells 512×400, anchor 250,390:
   sword / spear / bow / club / hit-dodge-down-up). */
(function (root) {
  'use strict';
  const hasImage = typeof Image !== 'undefined';
  const im = src => { if (!hasImage) return null; const i = new Image(); i.src = src; return i; };
  const ok = i => i && i.complete && i.naturalWidth > 0;
  const SCENES = [1, 2, 3, 4, 5].map(n => im('tower/floor' + n + '.webp?v=127'));
  const PROPS = { exit: im('tower/stone_exit.webp?v=127'), up: im('tower/stone_up.webp?v=127'), camp: im('tower/camp.webp?v=127') };
  // [cw, ch, ax, base] from the cutter; fly = lifted off the ground (units)
  const MON = {
    rabbit: [175, 147, 90, 139], wolf: [369, 225, 202, 217], goblin: [392, 290, 202, 282], boar: [335, 239, 179, 231],
    slug: [243, 166, 131, 158], spider: [304, 203, 159, 195], deer: [466, 359, 266, 351], shroom: [426, 342, 245, 334],
    bat: [418, 304, 230, 296, 150], bear: [568, 432, 301, 424], worm: [510, 428, 282, 420], rat: [264, 163, 144, 155],
    mudghost: [486, 393, 252, 385], snake: [445, 339, 237, 331], mosquito: [274, 224, 143, 216, 130], drowned: [421, 367, 219, 359, 25],
    ghostknight: [489, 381, 264, 373], gargoyle: [471, 354, 257, 346], skeleton: [495, 388, 294, 380], warden: [612, 523, 328, 515],
    boss5: [900, 715, 489, 707]
  };
  const NAMES = [['กระต่ายเขาเดียว', 'rabbit'], ['หมาป่าเงา', 'wolf'], ['ก๊อบลิน', 'goblin'], ['หมูป่า', 'boar'], ['ทากกรด', 'slug'], ['แมงมุมสปอร์', 'spider'],
    ['กวางพิษ', 'deer'], ['เห็ดยักษ์', 'shroom'], ['ค้างคาว', 'bat'], ['หมีหิน', 'bear'], ['หนอนเจาะหิน', 'worm'], ['หนู', 'rat'], ['ผีโคลน', 'mudghost'],
    ['งูบึง', 'snake'], ['ยุง', 'mosquito'], ['วิญญาณจมน้ำ', 'drowned'], ['อัศวินมรณะ', 'boss5'], ['อัศวินผี', 'ghostknight'], ['การ์กอยล์', 'gargoyle'],
    ['โครงกระดูก', 'skeleton'], ['ผู้เฝ้าซาก', 'warden']];
  const monImg = {};
  const monOf = id => { if (!MON[id]) return null; if (!monImg[id]) monImg[id] = im('monsters/' + id + '.webp?v=127'); return monImg[id]; };
  const idOf = name => { name = String(name || ''); const n = NAMES.find(([k]) => name.includes(k)); return n ? n[1] : null; };
  // theme → scene for floors past the authored ones
  const THEME_SCENE = { grass: 1, desert: 1, forest: 2, swamp: 4, crystal: 3, volcano: 3, ice: 3, undead: 5, ruins: 5, rift: 5 };
  const WEAPON_ROW = { sword: 0, namelessBlade: 0, dagger: 0, knife: 0, spear: 1, bow: 2, club: 3 };
  let combat = null;
  const heroSheet = f => root.HeroLook && root.HeroLook.get ? root.HeroLook.get(f) : null;
  function combatSheet() { if (!combat && root.HeroLook) combat = root.HeroLook.img('npc5_heroCombat.webp', 127); return combat; }
  const X = st => root.Expedition && st && root.Expedition.X(st);
  function sceneOf(st) {
    const x = X(st), f = x && x.floor || 1, E = root.Expedition, th = E && E.themeFor ? E.themeFor(st, f) : null;
    return th && th.scene || THEME_SCENE[th && th.id] || 1;
  }
  function weaponRow(st) {
    const id = st && st.equip && st.equip.weapon, g = id && st.gear && st.gear[id];
    const t = g ? g.templateId : id;
    return WEAPON_ROW[t] !== undefined ? WEAPON_ROW[t] : 3;     // no weapon: a stick picked up on the way
  }
  function floorMonsters(st) {
    const E = root.Expedition, x = X(st); if (!E || !x || !E.floorWorld) return [];
    try { const w = E.floorWorld(st, x.floor); return (w && w.species || []).map(s => idOf(s.name)).filter(Boolean); } catch (e) { return []; }
  }
  // ---- drawing helpers (all positions in canvas pixels; u = pixels per unit, a person = 345 units)
  function drawMon(ctx, id, col, row, x, gy, u, alpha) {
    const img = monOf(id), m = MON[id]; if (!ok(img) || !m) return;
    const [cw, ch, ax, base, fly] = m;
    ctx.save(); if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.drawImage(img, col * cw, row * ch, cw, ch, x - ax * u, gy - (base + (fly || 0)) * u, cw * u, ch * u);
    ctx.restore();
  }
  function drawCombat(ctx, col, row, x, gy, u, face) {
    const img = combatSheet(); if (!ok(img)) return false;
    ctx.save(); ctx.translate(x, gy); ctx.scale(face || 1, 1);
    ctx.drawImage(img, col * 512, row * 400, 512, 400, -250 * u, -390 * u, 512 * u, 400 * u);
    ctx.restore(); return true;
  }
  function drawWalk(ctx, frame, x, gy, u, face, moving) {
    const img = heroSheet('hero_sprite.webp'); if (!ok(img)) return;
    const k = u * 345 / 647, row = moving ? 0 : 2, col = moving ? frame % 4 : 0;
    ctx.save(); ctx.translate(x, gy); ctx.scale(face || 1, 1);
    ctx.drawImage(img, col * 480, row * 680, 480, 680, -240 * k, -662 * k, 480 * k, 680 * k);
    ctx.restore();
  }
  function drawLying(ctx, x, gy, u) {
    const img = heroSheet('npc5_heroC.webp'); if (!ok(img)) return;
    ctx.drawImage(img, 0, 0, 440, 384, x - 220 * u, gy - 372 * u, 440 * u, 384 * u);
  }
  function drawProp(ctx, img, x, gy, h) {
    if (!ok(img)) return; const w = h * img.naturalWidth / img.naturalHeight;
    ctx.drawImage(img, x - w / 2, gy - h * 0.97, w, h);
  }
  // ---- the fight currently playing
  let fx = null;
  const FIGHT_MS = 2600;
  function fight(o) {
    const st = o.state;
    const id = o.boss && o.floor === 9 ? 'boss5' : idOf(o.name) || floorMonsters(st)[0] || 'goblin';
    fx = { t0: performance.now(), id, win: !!o.win, row: weaponRow(st), big: o.boss && id !== 'boss5' ? 1.3 : 1 };
    return FIGHT_MS;
  }
  function show(ctx, cv, t, clock, info, st) {
    if (!info || !info.tower || !st) { fx = null; return false; }
    const W = cv.width, H = cv.height, n = sceneOf(st), bg = SCENES[n - 1];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1b1410'; ctx.fillRect(0, 0, W, H);
    const s = Math.max(W / 1672, H / 941), ox = (W - 1672 * s) / 2, oy = (H - 941 * s) / 2;
    if (ok(bg)) ctx.drawImage(bg, ox, oy, 1672 * s, 941 * s);
    const gy = oy + 941 * s * 0.85, u = Math.min(941 * s * 0.30 / 345, W / 1150);   // a person is 30% of the scene's height (narrower on portrait screens)
    const x = X(st), stones = x && x.stones && x.stones[x.floor] || {};
    const CAMP = root.Expedition && root.Expedition.SLOTS_OF_DAY ? (root.Expedition.SLOTS_OF_DAY.find(s => s[0] === 'xcamp') || [0, 15.6])[1] : 15.6;
    const night = (info.sleep || clock >= CAMP) && !fx;                 // camp from the evening slot, asleep after 20:00
    const dusk = Math.max(0, Math.min(1, (clock - (CAMP - 1.6)) / 1.6));
    if (stones.exit) drawProp(ctx, PROPS.exit, W * 0.88, gy, 250 * u);
    if (stones.up) drawProp(ctx, PROPS.up, W * 0.95, gy, 430 * u);
    if (night) {
      drawProp(ctx, PROPS.camp, W * 0.5, gy + 10 * u, 300 * u);
      if (info.sleep) drawLying(ctx, W * 0.34, gy + 6 * u, u); else drawWalk(ctx, 0, W * 0.36, gy, u, 1, false);
      ctx.fillStyle = 'rgba(8,10,30,0.55)'; ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W * 0.47, gy - 60 * u, 10, W * 0.47, gy - 60 * u, 420 * u);
      g.addColorStop(0, 'rgba(255,170,70,0.38)'); g.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = g; ctx.globalCompositeOperation = 'lighter'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
      return true;
    }
    const now = performance.now();
    if (fx) {
      const k = (now - fx.t0) / 1000, hx = W * 0.36, mx = W * 0.66, mu = u * fx.big, f4 = (a, b) => Math.min(3, Math.max(0, Math.floor((k - a) / b)));
      if (k > FIGHT_MS / 1000 + 0.6) fx = null;
      else {
        // monster
        let mrow = 0, mcol = Math.floor(k * 6) % 4, malpha;
        if (fx.win) { if (k > 0.75 && k < 1.35) { mrow = 2; mcol = k < 1.05 ? 0 : 1; } else if (k >= 1.35) { mrow = 2; mcol = k < 1.65 ? 2 : 3; malpha = Math.max(0, 1 - (k - 2.1) / 0.8); } }
        else if (k > 1.0) { mrow = 1; mcol = f4(1.0, 0.18); }
        const shake = (fx.win ? k > 0.75 && k < 0.95 : k > 1.36 && k < 1.56) ? Math.sin(k * 90) * 6 * u : 0;
        drawMon(ctx, fx.id, mcol, mrow, mx + (fx.win ? shake : 0), gy, mu, malpha);
        // hero
        let hrow = fx.row, hcol = 0;
        if (k > 0.3 && k < 1.1) hcol = f4(0.3, 0.2);
        else if (!fx.win && k >= 1.36) { hrow = 4; hcol = k < 1.8 ? 0 : 2; }
        else if (k >= 1.1) hcol = 3;
        drawCombat(ctx, hcol, hrow, hx + (fx.win ? 0 : shake), gy, u, 1);
        // v128 the arrow flies from the bow to the monster (drawn in code; the sheet's own arrow is part of frame 3)
        if (fx.row === 2 && k > 0.62 && k < 0.78) {
          const q = (k - 0.62) / 0.16, ax0 = hx + 150 * u, ay = gy - 215 * u, ax1 = mx - 40 * u, x1 = ax0 + (ax1 - ax0) * q;
          ctx.save(); ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = Math.max(2, 5 * u); ctx.beginPath(); ctx.moveTo(x1 - 110 * u, ay); ctx.lineTo(x1, ay); ctx.stroke();
          ctx.fillStyle = '#cfd6dc'; ctx.beginPath(); ctx.moveTo(x1 + 22 * u, ay); ctx.lineTo(x1 - 4 * u, ay - 9 * u); ctx.lineTo(x1 - 4 * u, ay + 9 * u); ctx.fill();
          ctx.fillStyle = '#e9e2d0'; ctx.fillRect(x1 - 112 * u, ay - 8 * u, 20 * u, 16 * u); ctx.restore();
        }
        // a burst where the blow lands
        const hitAt = fx.win ? 0.75 : 1.36;
        if (k > hitAt && k < hitAt + 0.22) {
          const q = (k - hitAt) / 0.22, cx = fx.win ? mx - 20 * u : hx + 40 * u, cy = gy - (fx.win ? 150 : 200) * u, r = (40 + 90 * q) * u;
          ctx.save(); ctx.globalAlpha = 1 - q; ctx.strokeStyle = '#fff4c2'; ctx.lineWidth = Math.max(2, 7 * u * (1 - q));
          for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + 0.3; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.35, cy + Math.sin(a) * r * 0.35); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); }
          ctx.restore();
        }
        if (k > 0.75 && k < 0.9 && fx.win || !fx.win && k > 1.36 && k < 1.5) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(0, 0, W, H); }
        if (info.sleep || clock >= CAMP) { ctx.fillStyle = 'rgba(8,10,30,0.45)'; ctx.fillRect(0, 0, W, H); }
        return true;
      }
    }
    // exploring: the hero walks back and forth; one of the floor's monsters prowls on the far side
    const ph = (now / 1000) % 16, out = ph < 8, p = out ? ph / 8 : (16 - ph) / 8, moving = (ph % 8) > 0.6 && (ph % 8) < 7.4;
    const hx = W * (0.14 + 0.36 * Math.min(1, Math.max(0, (p * 8 - 0.6) / 6.8)));
    const mons = floorMonsters(st);
    if (mons.length && !(x && x.floor % 5 === 0)) {
      const id = mons[(st.day || 0) % mons.length], mp = (now / 1000) % 20, mx = W * (0.72 - 0.06 * Math.sin(mp / 20 * Math.PI * 2));
      drawMon(ctx, id, Math.floor(now / 160) % 4, 0, mx, gy, u);
    }
    drawWalk(ctx, Math.floor(now / 140), hx, gy, u, out ? 1 : -1, moving);
    if (dusk > 0) { ctx.fillStyle = 'rgba(40,20,50,' + (0.4 * dusk).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    return true;
  }
  const images = () => [...SCENES, ...Object.values(PROPS)].filter(Boolean);
  root.TowerView = { show, fight, images, idOf, MON, FIGHT_MS };
})(typeof window !== 'undefined' ? window : globalThis);
