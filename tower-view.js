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
  // v135 one scene per territory (f1_north …) once the art exists; list ids here when their webp is in tower/regions/
  // v137 only territories whose art matches the floor's own look; the rest wait for re-drawn scenes (fall back to the floor scene)
  const REGION_ART = ['f1_east', 'f1_south', 'f1_west'];
  const REGION_IMG = {};
  const regionBg = (id, night) => REGION_ART.includes(id) ? (REGION_IMG[id + night] = REGION_IMG[id + night] || im('tower/regions/' + (night ? 'night/' : '') + id + '.webp?v=136')) : null;
  // v136 which territory picture: the team's current territory on this floor; floor 5 (safe zone) by the time of day
  function regionId(st, clock, camp) {
    const x = X(st); if (!x) return null; const f = x.floor || 1;
    if (f === 5) return clock >= camp ? 'f5_refuge' : clock < 8.5 ? 'f5_gate' : 'f5_market';
    return x.at && x.at.indexOf('f' + f + '_') === 0 ? x.at : null;
  }
  // v136 the people of the floor-5 safe zone (rows: 0 walk right · 1 their work · 2 standing facing you)
  const SAFE_NPC = {"mara_human_quartermaster":[307,363,154,355],"durn_dwarf_smith":[282,296,141,288],"avelin_elf_pathfinder":[324,376,162,368],"lumi_spirit_healer":[272,330,136,322],"koro_wolfblood_scout":[293,362,141,354],"borga_half_orc_guard":[322,394,174,386],"pikk_goblin_salvager":[248,269,124,261],"sesh_lizardfolk_alchemist":[328,360,165,352],"talla_stonekin_mason":[374,381,187,373],"orin_human_medic":[305,378,151,370],"naiya_elf_spirit_bridge":[335,361,172,353]};
  const SAFE_IMG = {};
  const safeImg = id => SAFE_IMG[id] = SAFE_IMG[id] || im('safe_npc/' + id + '.webp?v=136');
  // where each one is in each district: [id, x (share of width), row, walks back and forth over this share]
  const SAFE_SPOTS = {
    f5_gate: [['borga_half_orc_guard', 0.78, 2], ['koro_wolfblood_scout', 0.62, 0, 0.12], ['avelin_elf_pathfinder', 0.9, 1]],
    f5_market: [['durn_dwarf_smith', 0.06, 1], ['mara_human_quartermaster', 0.6, 1], ['pikk_goblin_salvager', 0.74, 1], ['sesh_lizardfolk_alchemist', 0.88, 1]],
    f5_refuge: [['lumi_spirit_healer', 0.04, 1], ['orin_human_medic', 0.33, 1], ['talla_stonekin_mason', 0.85, 1], ['naiya_elf_spirit_bridge', 0.95, 2]]   // around the team's camp spots
  };
  function drawSafeNpcs(ctx, rid, W, gy, u, now) {
    const list = SAFE_SPOTS[rid]; if (!list) return;
    list.forEach(([id, fx0, row, walk], i) => {
      const img = safeImg(id), d = SAFE_NPC[id]; if (!ok(img) || !d) return;
      const [cw, ch, ax, base] = d, v = u * 0.92;
      let x = W * fx0, dir = 1, col = Math.floor(now / (row === 1 ? 260 : 420) + i) % 4;
      if (walk) { const ph = (now / 1000 / 9 + i * 0.3) % 1, q = ph < 0.5 ? ph * 2 : 2 - ph * 2; x = W * (fx0 - walk / 2 + walk * q); dir = ph < 0.5 ? 1 : -1; col = Math.floor(now / 160) % 4; }
      ctx.save(); ctx.translate(x, gy - 4 * u); ctx.scale(dir, 1);
      ctx.drawImage(img, col * cw, row * ch, cw, ch, -ax * v, -base * v, cw * v, ch * v); ctx.restore();
    });
  }
  const PROPS = { exit: im('tower/stone_exit.webp?v=127'), up: im('tower/stone_up.webp?v=127'), camp: im('tower/camp.webp?v=127') };
  // [cw, ch, ax, base] from the cutter; fly = lifted off the ground (units)
  const MON = {
    rabbit: [175, 147, 90, 139], wolf: [369, 225, 202, 217], goblin: [392, 290, 202, 282], boar: [335, 239, 179, 231],
    slug: [243, 166, 131, 158], spider: [304, 203, 159, 195], deer: [466, 359, 266, 351], shroom: [426, 342, 245, 334],
    bat: [418, 304, 230, 296, 150], bear: [568, 432, 301, 424], worm: [510, 428, 282, 420], rat: [264, 163, 144, 155],
    mudghost: [486, 393, 252, 385], snake: [445, 339, 237, 331], mosquito: [274, 224, 143, 216, 130], drowned: [421, 367, 219, 359, 25],
    // v136 own sprites: pack leaders of floors 1–3, guardians of floors 4 and 9, the special monsters of 4 and 9
    elite_f1: [495,331,281,323], elite_f2: [523,388,279,380], elite_f3: [632,385,350,377], boss_f4: [684,510,345,502], boss_f9: [776,515,429,507], sp_armor_mimic: [446,330,224,322], sp_bone_rune_hound: [494,336,260,328], sp_echoeater: [518,428,282,420], sp_lantern_wisp: [344,237,158,229,120], sp_marrow_warden: [661,490,350,482], sp_reedstalker: [509,398,269,390], sp_silt_golem: [616,442,306,434], sp_soul_leech: [384,179,215,171,20],
    ghostknight: [489, 381, 264, 373], gargoyle: [471, 354, 257, 346], skeleton: [495, 388, 294, 380], warden: [612, 523, 328, 515],
    boss5: [900, 715, 489, 707]
  };
  const NAMES = [['กระต่ายเขาเดียว', 'rabbit'], ['หมาป่าเงา', 'wolf'], ['ก๊อบลิน', 'goblin'], ['หมูป่า', 'boar'], ['ทากกรด', 'slug'], ['แมงมุมสปอร์', 'spider'],
    ['กวางพิษ', 'deer'], ['เห็ดยักษ์', 'shroom'], ['ค้างคาว', 'bat'], ['หมีหิน', 'bear'], ['หนอนเจาะหิน', 'worm'], ['หนู', 'rat'], ['ผีโคลน', 'mudghost'],
    ['งูบึง', 'snake'], ['ยุง', 'mosquito'], ['วิญญาณจมน้ำ', 'drowned'], ['อัศวินมรณะ', 'boss5'], ['อัศวินผี', 'ghostknight'], ['การ์กอยล์', 'gargoyle'],
    ['โครงกระดูก', 'skeleton'], ['ผู้เฝ้าซาก', 'warden']];
  // v129 effects: fx/<id>.webp, 6 frames in a row on black → drawn with 'lighter' (no cut-out needed)
  const FX_IDS = ['sword', 'fire', 'ice', 'sunfall', 'winterseal', 'rift', 'limit', 'claw', 'heal',
    'avatar', 'stormlance', 'earthbulwark', 'sanctuary', 'spiritcall', 'spiritmend', 'spiritscout'];   // v134 set cores
  const FX = {}; for (const id of FX_IDS) FX[id] = im('fx/fx_' + id + '.webp?v=129');
  const SKILL_FX = { sword: 'sword', fire: 'fire', ice: 'ice', sunfall: 'sunfall', winterSeal: 'winterseal', riftStrike: 'rift', limitBreak: 'limit',
    avatarForm: 'avatar', stormLance: 'stormlance', earthBulwark: 'earthbulwark', sanctuaryLight: 'sanctuary', spiritCall: 'spiritcall', spiritMend: 'spiritmend', spiritScout: 'spiritscout' };
  const FLIES = { fire: 1, ice: 1, limit: 1, stormlance: 1 };
  const AT_HERO = { avatar: 1, sanctuary: 1, spiritcall: 1, spiritmend: 1, spiritscout: 1, earthbulwark: 1 };   // these happen around the hero
  // v134 summoned spirits and the avatar form: summons/<kind>.webp 4×3 (idle · attack · hurt/vanish), facing right
  // [cw, ch, ax, base, lift] in units (a person = 345)
  const SUMMON = { stone: [370, 331, 164, 323, 0], wisp: [279, 160, 119, 152, 230], hawk: [277, 266, 135, 258, 250] };
  const AVATAR = [497, 436, 257, 428];
  const sumImg = {}; const sumOf = k => { if (!SUMMON[k] && k !== 'avatar') return null; if (!sumImg[k]) sumImg[k] = im('summons/' + k + '.webp?v=134'); return ok(sumImg[k]) ? sumImg[k] : null; };
  function drawSummon(ctx, kind, row, col, x, gy, u, face, alpha) {
    const img = sumOf(kind), m = kind === 'avatar' ? AVATAR : SUMMON[kind]; if (!img || !m) return false;
    const [cw, ch, ax, base, lift] = m;
    ctx.save(); if (alpha !== undefined) ctx.globalAlpha = Math.max(0, alpha); ctx.translate(x, gy - (lift || 0) * u); ctx.scale(face < 0 ? -1 : 1, 1);
    ctx.drawImage(img, col * cw, row * ch, cw, ch, -ax * u, -base * u, cw * u, ch * u); ctx.restore(); return true;
  }
  const summonSpot = (kind, hx, dir, u) => kind === 'stone' ? hx + dir * 150 * u : kind === 'wisp' ? hx - dir * 70 * u : hx + dir * 40 * u;         // these travel from the hero to the monster; the rest burst on the target
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
  function drawMon(ctx, id, col, row, x, gy, u, alpha, glow) {
    const img = monOf(id), m = MON[id]; if (!ok(img) || !m) return;
    const [cw, ch, ax, base, fly] = m;
    ctx.save(); if (alpha !== undefined) ctx.globalAlpha = alpha;
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = Math.max(14, 70 * u);   // twice for a stronger rank glow
      ctx.drawImage(img, col * cw, row * ch, cw, ch, x - ax * u, gy - (base + (fly || 0)) * u, cw * u, ch * u); }
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
    // v138 own sprites only once they pass the style check (OWN_OK); until then the species' sprite with the rank aura
    const OWN_OK = [];
    const pick = o.sprite ? 'sp_' + o.sprite : o.boss && (o.floor === 4 || o.floor === 9) ? 'boss_f' + o.floor : o.elite && o.floor >= 1 && o.floor <= 3 ? 'elite_f' + o.floor : null;
    const own = pick && MON[pick] && OWN_OK.includes(pick) ? pick : null;
    const id = own || (o.boss && o.floor === 9 ? 'boss5' : idOf(o.base || o.name) || floorMonsters(st)[0] || 'goblin');
    // v135 rank shows on the monster: bigger, an aura in the rank's colour and a label (tower-regions.js RANK_VISUAL)
    const RV = root.TowerRegions && root.TowerRegions.RANK_VISUAL || {};
    const look = (o.boss ? RV.boss : o.elite ? RV.elite : RV[o.rank]) || { scale: o.boss ? 1.3 : 1, aura: null, label: '' };
    fx = { t0: performance.now(), id, win: !!o.win, row: weaponRow(st), big: id === 'boss5' || own ? 1 : Math.min(1.6, look.scale || 1), aura: look.aura, label: look.label, skill: SKILL_FX[o.skill] || null,
      summon: o.summon || null, summonGone: !!o.summonGone, avatar: !!o.transformed };
    return FIGHT_MS;
  }
  // ---- v139 motion: easing, squash & stretch, turning, breathing, shadows, dust, lunges, hit-stop and camera shake.
  // The sheets have only 4 frames per action; this layer adds the in-between movement so nobody moves like a robot.
  const ease = q => q <= 0 ? 0 : q >= 1 ? 1 : q * q * (3 - 2 * q);
  const easeOut = q => q <= 0 ? 0 : q >= 1 ? 1 : 1 - (1 - q) * (1 - q) * (1 - q);
  const easeOutBack = q => { if (q <= 0) return 0; if (q >= 1) return 1; const c = 1.7, z = q - 1; return 1 + (c + 1) * z * z * z + c * z * z; };
  const seg = (k, a, b) => (k - a) / (b - a);
  function posed(ctx, x, gy, sx, sy, rot, draw) {             // scale/rotate around the feet
    ctx.save(); ctx.translate(x, gy); if (rot) ctx.rotate(rot); ctx.scale(sx, sy); ctx.translate(-x, -gy); draw(); ctx.restore();
  }
  function shadow(ctx, x, gy, w, alpha) {
    ctx.save(); ctx.globalAlpha = alpha === undefined ? 0.28 : alpha; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x, gy + 2, w, w * 0.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  const breathe = (t, seed) => 1 + 0.014 * Math.sin(t * 2.6 + (seed || 0));
  const dust = [];
  function puff(x, gy, u, dir) { dust.push({ x, y: gy - 6 * u, vx: -dir * (20 + Math.random() * 25) * u, r: (10 + Math.random() * 8) * u, t0: performance.now() }); if (dust.length > 30) dust.shift(); }
  function drawDust(ctx, now) {
    for (let i = dust.length - 1; i >= 0; i--) {
      const d = dust[i], q = (now - d.t0) / 520; if (q >= 1) { dust.splice(i, 1); continue; }
      ctx.save(); ctx.globalAlpha = 0.35 * (1 - q); ctx.fillStyle = '#e8dcc0';
      ctx.beginPath(); ctx.arc(d.x + d.vx * q, d.y - 14 * q * d.r / 10, d.r * (0.6 + 0.9 * q), 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }
  const walker = { moving: false, since: 0, face: 1, faceSince: 0, frame: -1 };
  function turnSquash(now, since) { const q = (now - since) / 150; return q >= 1 ? 1 : 0.25 + 0.75 * easeOutBack(q); }
  function show(ctx, cv, t, clock, info, st) { const r = showScene(ctx, cv, t, clock, info, st); ctx.setTransform(1, 0, 0, 1, 0, 0); return r; }
  function showScene(ctx, cv, t, clock, info, st) {
    if (!info || !info.tower || !st) { fx = null; return false; }
    const CAMP0 = root.Expedition && root.Expedition.SLOTS_OF_DAY ? (root.Expedition.SLOTS_OF_DAY.find(s => s[0] === 'xcamp') || [0, 15.6])[1] : 15.6;
    const W = cv.width, H = cv.height, n = sceneOf(st), rid = regionId(st, clock, CAMP0), rb = rid ? regionBg(rid, '') : null, bg = ok(rb) ? rb : SCENES[n - 1];
    const dusk0 = Math.max(0, Math.min(1, (clock - (CAMP0 - 1.6)) / 1.6)), rn = rid && (dusk0 > 0 || info.sleep) ? regionBg(rid, 'n') : null;
    const nightArt = ok(rb) && ok(rn);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1b1410'; ctx.fillRect(-30, -30, W + 60, H + 60);
    const s = Math.max(W / 1672, H / 941), ox = (W - 1672 * s) / 2, oy = (H - 941 * s) / 2;
    let camX = 0, camY = 0;
    if (fx) { const kq = (performance.now() - fx.t0) / 1000, hit = fx.win ? 0.75 : 1.36, q = (kq - hit) / 0.3;
      if (q > 0 && q < 1) { const a = (1 - q) * (1 - q) * 9 * (fx.big || 1); camX = Math.sin(kq * 97) * a * s; camY = Math.cos(kq * 71) * a * 0.6 * s; } }
    ctx.translate(camX, camY);
    if (ok(bg)) ctx.drawImage(bg, ox - 12 * s, oy - 7 * s, 1672 * s + 24 * s, 941 * s + 14 * s);
    if (nightArt) { ctx.save(); ctx.globalAlpha = info.sleep ? 1 : dusk0; ctx.drawImage(rn, ox - 12 * s, oy - 7 * s, 1672 * s + 24 * s, 941 * s + 14 * s); ctx.restore(); }  // painted night replaces most of the tint
    const gy = oy + 941 * s * 0.85, u = Math.min(941 * s * 0.30 / 345, W / 1150);   // a person is 30% of the scene's height (narrower on portrait screens)
    const x = X(st), stones = x && x.stones && x.stones[x.floor] || {};
    const CAMP = root.Expedition && root.Expedition.SLOTS_OF_DAY ? (root.Expedition.SLOTS_OF_DAY.find(s => s[0] === 'xcamp') || [0, 15.6])[1] : 15.6;
    const night = (info.sleep || clock >= CAMP) && !fx;                 // camp from the evening slot, asleep after 20:00
    const dusk = Math.max(0, Math.min(1, (clock - (CAMP - 1.6)) / 1.6));
    if (stones.exit) drawProp(ctx, PROPS.exit, W * 0.88, gy, 250 * u);
    if (stones.up) drawProp(ctx, PROPS.up, W * 0.95, gy, 430 * u);
    const now0 = performance.now();
    if (night) {
      if (rid && rid.indexOf('f5_') === 0) drawSafeNpcs(ctx, rid, W, gy, u, now0);
      const team = teamOf(st), spots = [0.62, 0.22, 0.72, 0.14];
      team.forEach((sh, i) => {
        const face = i % 2 ? 1 : -1, x = W * spots[i];
        // with a camp sheet: sit by the fire, sleep, and one keeps watch at night; town sprites just stand (only the watch at night)
        if (combatOf(sh)) { drawMateFight(ctx, sh, 3, info.sleep ? (i === 0 ? 2 : 1) : 0, x, gy - 4 * u, u, face); return; }
        if (info.sleep && i > 0) return; drawMate(ctx, sh, 2, 0, x, gy - 4 * u, u, face); });
      const xc = X(st); if (xc && xc.summon && xc.summon.day === st.day) drawSummon(ctx, xc.summon.kind, 0, Math.floor(now0 / 200) % 4, W * 0.42, gy, u, 1);
      drawProp(ctx, PROPS.camp, W * 0.5, gy + 10 * u, 300 * u);
      if (info.sleep) drawLying(ctx, W * 0.34, gy + 6 * u, u); else drawWalk(ctx, 0, W * 0.36, gy, u, 1, false);
      if (heal) { const q = (now0 - heal) / 1000; if (q >= 1) heal = 0; else drawFx(ctx, 'heal', q, W * 0.36, gy - 190 * u, 720 * u); }
      ctx.fillStyle = 'rgba(8,10,30,0.55)'; ctx.fillRect(-30, -30, W + 60, H + 60);
      const g = ctx.createRadialGradient(W * 0.47, gy - 60 * u, 10, W * 0.47, gy - 60 * u, 420 * u);
      g.addColorStop(0, 'rgba(255,170,70,0.38)'); g.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = g; ctx.globalCompositeOperation = 'lighter'; ctx.fillRect(-30, -30, W + 60, H + 60); ctx.globalCompositeOperation = 'source-over';
      return true;
    }
    const now = performance.now();
    if (fx) {
      const kr = (now - fx.t0) / 1000, hitAt0 = fx.win ? 0.75 : 1.36, STOP = 0.09;
      // hit-stop: everything freezes for a moment when the blow lands
      const k = kr < hitAt0 ? kr : kr < hitAt0 + STOP ? hitAt0 : kr - STOP;
      const melee = fx.row !== 2, reach = (W * 0.66 - W * 0.36) * 0.42;
      // the hero dashes in, strikes and steps back (archers lean into the shot); takes a knock back when hit
      const lunge = melee ? reach * (k < 0.3 ? 0 : k < 0.62 ? easeOut(seg(k, 0.3, 0.62)) : k < 0.9 ? 1 : 1 - ease(seg(k, 0.9, 1.25))) : 0;
      const knock = !fx.win && k > 1.36 ? -60 * u * easeOut(seg(k, 1.36, 1.6)) * (1 - ease(seg(k, 1.9, 2.4))) : 0;
      const hx = W * 0.36 + lunge + knock;
      // the monster lunges when it strikes; gets pushed back and squashed when struck
      const mLunge = !fx.win && k > 1.0 ? -reach * 0.8 * (k < 1.3 ? easeOut(seg(k, 1.0, 1.3)) : 1 - ease(seg(k, 1.5, 1.9))) : 0;
      const mKnock = fx.win && k > 0.75 ? 70 * u * easeOut(seg(k, 0.75, 0.95)) : 0;
      const mx = W * 0.66 + mLunge + mKnock, mu = u * fx.big, f4 = (a, b) => Math.min(3, Math.max(0, Math.floor((k - a) / b)));
      const mHit = fx.win && k > 0.75 && k < 1.05 ? 1 - seg(k, 0.75, 1.05) : 0;
      const mSx = 1 + 0.12 * mHit * Math.cos(seg(k, 0.75, 1.05) * 9), mSy = (1 - 0.1 * mHit * Math.cos(seg(k, 0.75, 1.05) * 9)) * (mHit ? 1 : breathe(k * 1.4, 1));
      if (kr > FIGHT_MS / 1000 + 0.6 + STOP) fx = null;
      else {
        // monster
        let mrow = 0, mcol = Math.floor(k * 6) % 4, malpha;
        if (fx.win) { if (k > 0.75 && k < 1.35) { mrow = 2; mcol = k < 1.05 ? 0 : 1; } else if (k >= 1.35) { mrow = 2; mcol = k < 1.65 ? 2 : 3; malpha = Math.max(0, 1 - (k - 2.1) / 0.8); } }
        else if (k > 1.0) { mrow = 1; mcol = f4(1.0, 0.18); }
        const shake = (fx.win ? k > 0.75 && k < 0.95 : k > 1.36 && k < 1.56) ? Math.sin(k * 90) * 6 * u : 0;
        if (fx.aura) {                                                   // rank aura on the ground and around the body
          const pulse = 0.75 + 0.25 * Math.sin(k * 6), R = 170 * mu;
          ctx.save(); ctx.globalAlpha = (malpha === undefined ? 1 : malpha) * 0.8 * pulse;
          const g = ctx.createRadialGradient(mx, gy, R * 0.05, mx, gy, R);
          g.addColorStop(0, fx.aura); g.addColorStop(0.6, fx.aura + '55'); g.addColorStop(1, fx.aura + '00');
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(mx, gy, R, R * 0.22, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = fx.aura; ctx.lineWidth = Math.max(2, 5 * u); ctx.beginPath(); ctx.ellipse(mx, gy, R * 0.8, R * 0.17, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
        shadow(ctx, mx, gy, 120 * mu, 0.3 * (malpha === undefined ? 1 : malpha));
        posed(ctx, mx, gy, mSx, mSy, 0, () => drawMon(ctx, fx.id, mcol, mrow, mx + (fx.win ? shake : 0), gy, mu, malpha, fx.aura));
        if (fx.label && (malpha === undefined || malpha > 0.3)) {
          const fs = Math.max(12, 30 * u), M = MON[fx.id] || [0, 0, 0, 300, 0], ly = gy - (M[3] + (M[4] || 0)) * mu - 14 * u;
          ctx.save(); ctx.font = 'bold ' + fs + 'px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = Math.max(3, fs / 5);
          ctx.strokeStyle = 'rgba(20,12,8,.9)'; ctx.fillStyle = fx.aura || '#fff';
          ctx.strokeText(fx.label, mx, ly); ctx.fillText(fx.label, mx, ly); ctx.restore();
        }
        // hero
        let hrow = fx.row, hcol = 0;
        if (k > 0.3 && k < 1.1) hcol = f4(0.3, 0.2);
        else if (!fx.win && k >= 1.36) { hrow = 4; hcol = k < 1.8 ? 0 : 2; }
        else if (k >= 1.1) hcol = 3;
        const team = teamOf(st), busy = k > 0.3 && k < 1.2;
        team.forEach((sh, i) => {
          const x = W * 0.36 + lunge * 0.35 - (150 + 120 * i) * u, y = gy - 8 * u * (i % 2);
          shadow(ctx, x, y, 60 * u);
          if (combatOf(sh)) {                       // attack (or a special every other mate), then cheer or take the hit
            const atk = Math.min(3, Math.max(0, Math.floor((k - 0.3 - 0.08 * i) / 0.2)));
            if (k < 0.3) drawMateFight(ctx, sh, 0, 0, x, y, u, 1);
            else if (k < 1.2) drawMateFight(ctx, sh, i % 2, atk, x, y, u, 1);
            else if (fx.win) drawMateFight(ctx, sh, 3, 3, x, y, u, 1);
            else drawMateFight(ctx, sh, 2, k < 1.7 ? 0 : 1, x, y, u, 1);
          } else drawMate(ctx, sh, busy ? 1 : 2, busy ? Math.floor(k * 7 + i) % 4 : 0, x, y, u, 1);
        });
        if (fx.summon) {          // the spirit fights too; a spirit that broke this fight fades out
          const sx = summonSpot(fx.summon, hx, 1, u), gone = fx.summonGone && k > 1.3;
          drawSummon(ctx, fx.summon, gone ? 2 : k > 0.3 && k < 1.1 ? 1 : 0, gone ? Math.min(3, Math.floor((k - 1.3) / 0.25)) : Math.floor(k * 6) % 4, sx, gy, u, 1, gone ? 1 - (k - 2.1) / 0.5 : undefined);
        }
        if (fx.avatar) drawSummon(ctx, 'avatar', k > 0.3 && k < 1.1 ? 1 : 0, k > 0.3 && k < 1.1 ? hcol : 0, hx + (fx.win ? 0 : shake), gy, u, 1);
        else {
          // squash on the wind-up, stretch on the strike, a little lean forward while dashing
          const wind = k > 0.3 && k < 0.45 ? Math.sin(seg(k, 0.3, 0.45) * Math.PI) : 0, strike = k > 0.55 && k < 0.8 ? Math.sin(seg(k, 0.55, 0.8) * Math.PI) : 0;
          const hurt = !fx.win && k > 1.36 && k < 1.7 ? Math.sin(seg(k, 1.36, 1.7) * Math.PI) : 0;
          const hsx = 1 + 0.07 * wind - 0.04 * strike + 0.06 * hurt, hsy = (1 - 0.07 * wind + 0.05 * strike - 0.06 * hurt) * (k < 0.3 || k > 1.3 ? breathe(k, 0) : 1);
          const lean = melee && k > 0.3 && k < 0.9 ? 0.06 * Math.sin(seg(k, 0.3, 0.9) * Math.PI) : -0.08 * hurt;
          shadow(ctx, hx, gy, 75 * u);
          if (melee && k > 0.3 && k < 0.62 && Math.floor(k * 30) % 3 === 0) puff(hx - 40 * u, gy, u, 1);
          posed(ctx, hx, gy, hsx, hsy, lean, () => drawCombat(ctx, hcol, hrow, hx + (fx.win ? 0 : shake), gy, u, 1));
          drawDust(ctx, now);
        }
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
          const at = AT_HERO[fx.skill] ? (fx.skill === 'earthbulwark' ? hx + 140 * u : fx.skill.startsWith('spirit') && fx.summon ? summonSpot(fx.summon, hx, 1, u) : hx) : null;
          drawFx(ctx, fx.skill, q, at !== null ? at : fly ? (hx + mx) / 2 + 40 * u : mx - 10 * u, fx.skill === 'sunfall' ? gy - 330 * u : fx.skill === 'winterseal' ? gy - 70 * u : AT_HERO[fx.skill] ? gy - 200 * u : gy - 180 * u,
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
        if (k > 0.75 && k < 0.9 && fx.win || !fx.win && k > 1.36 && k < 1.5) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-30, -30, W + 60, H + 60); }
        if (info.sleep || clock >= CAMP) { ctx.fillStyle = nightArt ? 'rgba(8,10,30,0.12)' : 'rgba(8,10,30,0.45)'; ctx.fillRect(-30, -30, W + 60, H + 60); }
        return true;
      }
    }
    // exploring: the hero walks back and forth; one of the floor's monsters prowls on the far side
    // v139 eased walk: starts and stops smoothly, feet step with the distance walked (no sliding), turns with a squash
    const ph = (now / 1000) % 16, out = ph < 8, lp = ph % 8, wq = ease(seg(lp, 0.6, 7.4)), pq = out ? wq : 1 - wq;
    const x0 = W * 0.14, span = W * 0.36, hx = x0 + span * pq, speed = Math.sin(Math.PI * Math.min(1, Math.max(0, seg(lp, 0.6, 7.4))));
    const moving = lp > 0.6 && lp < 7.4 && speed > 0.12;
    const stride = 92 * u, dist = out ? span * wq : span + span * wq, wframe = Math.floor(dist / stride) % 4;
    if (moving !== walker.moving) { walker.moving = moving; walker.since = now; }
    const wdir = out ? 1 : -1; if (wdir !== walker.face) { walker.face = wdir; walker.faceSince = now; }
    if (moving && wframe !== walker.frame && (wframe === 0 || wframe === 2)) puff(hx - wdir * 30 * u, gy, u, wdir);
    walker.frame = wframe;
    const mons = floorMonsters(st);
    if (mons.length && !(x && x.floor % 5 === 0)) {
      const id = mons[(st.day || 0) % mons.length], mp = (now / 1000) % 20, mx = W * (0.72 - 0.06 * Math.sin(mp / 20 * Math.PI * 2));
      shadow(ctx, mx, gy, 110 * u, 0.25);
      posed(ctx, mx, gy, 1, breathe(now / 1000 * 1.3, 2), 0, () => drawMon(ctx, id, Math.floor(now / 160) % 4, 0, mx, gy, u));
    }
    if (rid && rid.indexOf('f5_') === 0) drawSafeNpcs(ctx, rid, W, gy, u, now);
    const team = teamOf(st), dir = out ? 1 : -1;
    const tsq = Math.min(turnSquash(now, walker.since), turnSquash(now, walker.faceSince));
    drawDust(ctx, now);
    team.forEach((sh, i) => {
      const tx = hx - dir * (125 + 115 * i) * u, ty = gy - 6 * u * (i % 2), mf = Math.floor((dist + 40 * u * (i + 1)) / stride) % 4;
      shadow(ctx, tx, ty, 58 * u);
      posed(ctx, tx, ty, tsq, moving ? 1 : breathe(now / 1000, i + 1), moving ? 0.03 * dir * speed : 0,
        () => drawMate(ctx, sh, moving ? 0 : 2, moving ? mf : 0, tx, ty, u, dir));
    });
    const xs = X(st), sm = xs && xs.summon && xs.summon.day === st.day ? xs.summon.kind : null;
    if (sm) drawSummon(ctx, sm, 0, Math.floor(now / 170) % 4, summonSpot(sm, hx, dir, u), gy, u, dir);
    if (xs && xs.avatarDay === st.day) drawSummon(ctx, 'avatar', moving ? 0 : 0, moving ? Math.floor(now / 150) % 4 : 0, hx, gy, u, dir);
    else { shadow(ctx, hx, gy, 72 * u);
      posed(ctx, hx, gy, tsq, moving ? 1 : breathe(now / 1000, 0), moving ? 0.035 * wdir * speed : 0, () => drawWalk(ctx, wframe, hx, gy, u, wdir, moving)); }
    if (heal) { const q = (now - heal) / 1000; if (q >= 1) heal = 0; else drawFx(ctx, 'heal', q, hx, gy - 190 * u, 720 * u); }
    if (dusk > 0) { ctx.fillStyle = 'rgba(40,20,50,' + ((nightArt ? 0.1 : 0.4) * dusk).toFixed(3) + ')'; ctx.fillRect(-30, -30, W + 60, H + 60); }
    return true;
  }
  const images = () => [...SCENES, ...Object.values(PROPS)].filter(Boolean);
  const healFx = () => { heal = performance.now(); };       // drinking a potion while the tower is on screen
  root.TowerView = { show, fight, healFx, images, idOf, MON, FIGHT_MS, FX };
})(typeof window !== 'undefined' ? window : globalThis);
