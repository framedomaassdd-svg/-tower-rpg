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
  // v129 effects: fx/<id>.webp, 6 frames in a row on black → drawn with 'lighter' (no cut-out needed)
  const FX_IDS = ['sword', 'fire', 'ice', 'sunfall', 'winterseal', 'rift', 'limit', 'claw', 'heal'];
  const FX = {}; for (const id of FX_IDS) FX[id] = im('fx/fx_' + id + '.webp?v=129');
  const SKILL_FX = { sword: 'sword', fire: 'fire', ice: 'ice', sunfall: 'sunfall', winterSeal: 'winterseal', riftStrike: 'rift', limitBreak: 'limit' };
  const FLIES = { fire: 1, ice: 1, limit: 1 };         // these travel from the hero to the monster; the rest burst on the target
  function drawFx(ctx, id, q, x, y, h, flip) {          // q 0..1 through the effect, (x, y) = centre, h = height in px
    const img = FX[id]; if (!ok(img) || q < 0 || q >= 1) return;
    const fw = img.naturalWidth / 6, fh = img.naturalHeight, f = Math.min(5, Math.floor(q * 6)), w = h * fw / fh;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, f * fw, 0, fw, fh, -w / 2, -h / 2, w, h); ctx.restore();
  }
  let heal = 0;
  // v130 the people who came along: the guild party / hired guard / your own party, plus a stranded companion.
  // Drawn with the town's NPC sheets (4×3: walk / work / stand); nobody is drawn while you're separated from them.
  const TEAM_SHEETS = { guild: ['warrior', 'archer', 'mage'], compass: ['explorer', 'scout'], porter: ['porterA', 'warrior', 'porterB'], guard: ['veteran'] };
  function sheetOfPerson(id) {
    const N = root.TownNPCs; if (!N) return null;
    if (N.SHEETS[id]) return id;
    const p = (N.PEOPLE || []).find(q => q.id === id) || (root.TownResidents && (root.TownResidents.PEOPLE || []).find(q => q.id === id));
    if (p && p.sheet && N.SHEETS[p.sheet]) return p.sheet;
    if (N.RESIDENT_LOOK && N.RESIDENT_LOOK[id]) return N.RESIDENT_LOOK[id].sheet;
    return 'rookie';
  }
  function teamOf(st) {
    const x = X(st); if (!x) return [];
    let t = [];
    if (x.party && !x.separated) {
      if (x.party === 'personal') { const M = root.Management && root.Management.ensure(st); t = (M && M.party && M.party.members || []).map(sheetOfPerson); }
      else t = (TEAM_SHEETS[x.party] || []).slice();
    }
    if (x.ally) t.push('summoned');
    return t.filter(Boolean).slice(0, 4);
  }
  const sizeOf = sheet => (root.TownNPCs && root.TownNPCs.ADVENTURER_SIZE && root.TownNPCs.ADVENTURER_SIZE[sheet]) || 1;
  function drawMate(ctx, sheet, row, col, x, gy, u, face) {
    const N = root.TownNPCs; if (!N || !N.blit) return;
    N.blit(ctx, sheet, row, col, face < 0, 330 * u * sizeOf(sheet), x, gy - 8 * u);
  }
  // v131 soldiers/adventurers have their own fight sheet: npc_combat/<id>.webp 4×4 cells 620×420, anchor (290, 410), person 330 tall
  // rows: attack · special · hit/dodge/down/up · camp (sit, sleep, keep watch, victory)
  const NPC_COMBAT = ['captain', 'recruit', 'oldknight', 'sentry', 'priest', 'pyro', 'rogue', 'ranger', 'wolfkin', 'shieldmaiden', 'nomad', 'nurse'];
  const npcCombat = {};
  function combatOf(sheet) {
    if (!NPC_COMBAT.includes(sheet)) return null;
    if (!npcCombat[sheet]) npcCombat[sheet] = im('npc_combat/' + sheet + '.webp?v=131');
    return ok(npcCombat[sheet]) ? npcCombat[sheet] : null;
  }
  function drawMateFight(ctx, sheet, row, col, x, gy, u, face) {
    const img = combatOf(sheet); if (!img) return false;
    const k = u * sizeOf(sheet);
    ctx.save(); ctx.translate(x, gy); ctx.scale(face < 0 ? -1 : 1, 1);
    ctx.drawImage(img, col * 620, row * 420, 620, 420, -290 * k, -410 * k, 620 * k, 420 * k);
    ctx.restore(); return true;
  }
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
    fx = { t0: performance.now(), id, win: !!o.win, row: weaponRow(st), big: o.boss && id !== 'boss5' ? 1.3 : 1, skill: SKILL_FX[o.skill] || null };
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
    const now0 = performance.now();
    if (night) {
      const team = teamOf(st), spots = [0.62, 0.22, 0.72, 0.14];
      team.forEach((sh, i) => {
        const face = i % 2 ? 1 : -1, x = W * spots[i];
        // with a camp sheet: sit by the fire, sleep, and one keeps watch at night; town sprites just stand (only the watch at night)
        if (combatOf(sh)) { drawMateFight(ctx, sh, 3, info.sleep ? (i === 0 ? 2 : 1) : 0, x, gy - 4 * u, u, face); return; }
        if (info.sleep && i > 0) return; drawMate(ctx, sh, 2, 0, x, gy - 4 * u, u, face); });
      drawProp(ctx, PROPS.camp, W * 0.5, gy + 10 * u, 300 * u);
      if (info.sleep) drawLying(ctx, W * 0.34, gy + 6 * u, u); else drawWalk(ctx, 0, W * 0.36, gy, u, 1, false);
      if (heal) { const q = (now0 - heal) / 1000; if (q >= 1) heal = 0; else drawFx(ctx, 'heal', q, W * 0.36, gy - 190 * u, 720 * u); }
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
        const team = teamOf(st), busy = k > 0.3 && k < 1.2;
        team.forEach((sh, i) => {
          const x = hx - (150 + 120 * i) * u, y = gy - 8 * u * (i % 2);
          if (combatOf(sh)) {                       // attack (or a special every other mate), then cheer or take the hit
            const atk = Math.min(3, Math.max(0, Math.floor((k - 0.3 - 0.08 * i) / 0.2)));
            if (k < 0.3) drawMateFight(ctx, sh, 0, 0, x, y, u, 1);
            else if (k < 1.2) drawMateFight(ctx, sh, i % 2, atk, x, y, u, 1);
            else if (fx.win) drawMateFight(ctx, sh, 3, 3, x, y, u, 1);
            else drawMateFight(ctx, sh, 2, k < 1.7 ? 0 : 1, x, y, u, 1);
          } else drawMate(ctx, sh, busy ? 1 : 2, busy ? Math.floor(k * 7 + i) % 4 : 0, x, y, u, 1);
        });
        drawCombat(ctx, hcol, hrow, hx + (fx.win ? 0 : shake), gy, u, 1);
        // v128 the arrow flies from the bow to the monster (drawn in code; the sheet's own arrow is part of frame 3)
        if (fx.row === 2 && k > 0.62 && k < 0.78) {
          const q = (k - 0.62) / 0.16, ax0 = hx + 150 * u, ay = gy - 215 * u, ax1 = mx - 40 * u, x1 = ax0 + (ax1 - ax0) * q;
          ctx.save(); ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = Math.max(2, 5 * u); ctx.beginPath(); ctx.moveTo(x1 - 110 * u, ay); ctx.lineTo(x1, ay); ctx.stroke();
          ctx.fillStyle = '#cfd6dc'; ctx.beginPath(); ctx.moveTo(x1 + 22 * u, ay); ctx.lineTo(x1 - 4 * u, ay - 9 * u); ctx.lineTo(x1 - 4 * u, ay + 9 * u); ctx.fill();
          ctx.fillStyle = '#e9e2d0'; ctx.fillRect(x1 - 112 * u, ay - 8 * u, 20 * u, 16 * u); ctx.restore();
        }
        // v129 a triggered active skill plays its effect over the strike
        if (fx.skill) {
          const q = (k - 0.5) / 0.66, fly = FLIES[fx.skill];
          drawFx(ctx, fx.skill, q, fly ? (hx + mx) / 2 + 40 * u : mx - 10 * u, fx.skill === 'sunfall' ? gy - 330 * u : fx.skill === 'winterseal' ? gy - 70 * u : gy - 180 * u,
            (fly ? 900 : fx.skill === 'sunfall' ? 1050 : fx.skill === 'winterseal' ? 760 : 820) * u);
        }
        if (!fx.win) drawFx(ctx, 'claw', (k - 1.3) / 0.5, hx + 30 * u, gy - 200 * u, 620 * u, true);   // the monster's blow
        // a burst where the blow lands
        const hitAt = fx.win ? 0.75 : 1.36;
        if (k > hitAt && k < hitAt + 0.22 && (fx.win ? !fx.skill : !ok(FX.claw))) {
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
    const team = teamOf(st), dir = out ? 1 : -1;
    team.forEach((sh, i) => drawMate(ctx, sh, moving ? 0 : 2, moving ? (Math.floor(now / 150) + i) % 4 : 0, hx - dir * (125 + 115 * i) * u, gy - 6 * u * (i % 2), u, dir));
    drawWalk(ctx, Math.floor(now / 140), hx, gy, u, out ? 1 : -1, moving);
    if (heal) { const q = (now - heal) / 1000; if (q >= 1) heal = 0; else drawFx(ctx, 'heal', q, hx, gy - 190 * u, 720 * u); }
    if (dusk > 0) { ctx.fillStyle = 'rgba(40,20,50,' + (0.4 * dusk).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    return true;
  }
  const images = () => [...SCENES, ...Object.values(PROPS)].filter(Boolean);
  const healFx = () => { heal = performance.now(); };       // drinking a potion while the tower is on screen
  root.TowerView = { show, fight, healFx, images, idOf, MON, FIGHT_MS, FX };
})(typeof window !== 'undefined' ? window : globalThis);
