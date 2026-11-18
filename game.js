/* v78 main loop. The character lives on its own (life-sim.js decides where it is from the town clock);
   this file keeps the clock, the save, and draws either the painted street (town-pano.js) or an interior (interiors.js).
   Top-level names here are shared with life-ui.js: state, clock, player, playerY, face, moving, anim, log, update, save, $. */
const c = document.querySelector('canvas'), ctx = c.getContext('2d');
const $ = id => document.getElementById(id);
const ART_V = '?v=62';
const sprite = new Image();                       // old 8-frame hero, only a fallback for the HUD portrait
const sceneObjects = [];                          // kept for life-ui (the smithy minigame looks up an optional backdrop here)
HeroSprite.load(); TownNPCs.load();

const defaults = { day: 1, money: 10, energy: 100, floor: 5, supplies: 10, danger: 1, rep: 0, guild: false, jobDay: 0, work: 0, strength: 3, agility: 3,
  health: 100, food: 2, marketWork: 0, tavernWork: 0, guildWork: 0, hotelWork: 0, joinedBefore: false, position: 620, positionY: 820, paused: false,
  townClock: 5, timeSpeed: 1, events: [], profession: 'คนว่างงาน' };

// ---- save
let old = {}, saveReadBlocked = false;
try {
  const raw = localStorage.getItem('towerLife');
  if (raw) { const parsed = JSON.parse(raw); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid save'); old = parsed; }
} catch (e) { saveReadBlocked = true; }
let state = CityCore.migrateSave(old, defaults); TownResidents.ensure(state);
state.scene = 'town';
let player = state.position, playerY = state.positionY, face = 1, moving = false, anim = 0, last = 0;
let clock = Number.isFinite(state.townClock) ? Math.max(0, Math.min(19.999, state.townClock)) : 5, saveClock = 0;
state.timeSpeed = CityLighting.validSpeed(state.timeSpeed);

function showSaveProblem(message) { const el = $('saveWarning'); el.textContent = message; el.hidden = false; }
function save() {
  state.position = player; state.positionY = playerY; state.townClock = clock; state.layoutRevision = CityCore.LAYOUT_REVISION;
  if (saveReadBlocked) { showSaveProblem('อ่านข้อมูลบันทึกไม่ได้ จึงยังไม่เขียนทับข้อมูลเดิม'); return false; }
  try { localStorage.setItem('towerLife', JSON.stringify(state)); $('saveWarning').hidden = true; return true; }
  catch (e) { showSaveProblem('บันทึกเกมไม่สำเร็จ ความคืบหน้าอาจหายเมื่อปิดหน้าเกม'); return false; }
}
function log(text) { state.events.unshift('วันที่ ' + state.day + ' · ' + text); state.events = state.events.slice(0, 8); }
function update() { save(); }

// ---- the town keeps going whether or not the player does anything
function nextDay() {
  TownResidents.closeDay(state); clock = 0; state.day++;
  const taxPeriods = CityCore.accrueTax(state);
  if (taxPeriods) log('ถึงรอบภาษีเมือง ยอดค้าง ' + state.taxDue + ' เหรียญ');
  if (state.food > 0) state.food--; else { state.health = Math.max(1, state.health - 5); log('ไม่มีอาหาร สุขภาพลดลง 5'); }
  const roll = Math.random();
  if (roll < .27) { state.danger = Math.min(5, state.danger + 1); log('มอนสเตอร์เพิ่มจำนวนรอบเมือง ระดับอันตรายสูงขึ้น'); }
  else if (roll < .5) { state.danger = Math.max(1, state.danger - 1); log('หน่วยลาดตระเวนกำจัดมอนสเตอร์ใกล้เมือง'); }
  else if (roll < .73) { state.supplies = Math.max(0, state.supplies - 2); log('กิลด์ส่งเสบียงให้ทีมสำรวจ'); }
  else if (roll < .88) { state.supplies = Math.min(30, state.supplies + 3); log('ขบวนพ่อค้านำเสบียงเข้ามาในเมือง'); }
  else { state.floor++; state.supplies = Math.max(0, state.supplies - 3); log('ทีมกิลด์สำรวจถึงชั้น ' + state.floor + ' โดยไม่รอผู้เล่น'); }
  if (state.danger >= 5 && Math.random() < .35) { state.supplies = Math.max(0, state.supplies - 4); state.danger = 3; log('มอนสเตอร์ทะลักเข้าเมือง กองกำลังสกัดไว้ได้ แต่เสบียงเสียหาย'); }
  update();
}

// ---- street actors (townsfolk sheets in town-npcs.js; the old guard patrol is retired until it has art in the new style)
function drawNpc(n) {
  const depth = CityCore.depthScale(n.x, n.y);
  CityLighting.actorShadow(ctx, n.x, n.y, depth * .8 * n.height / 124, clock);
  TownNPCs.draw(ctx, n, performance.now() / 1000, depth);
}
// What the hero does at a street workplace. Indoor jobs (inn laundry, kitchen) are drawn by interiors.js.
const HERO_VISIBLE = HeroSprite.HEIGHT * 648 / 680;                  // standing height without the cell's padding
function heroWorkPose() {
  const L = state.life || {}, path = L.path;
  const carrying = () => { const q = TownNPCs.heroShuttle(clock, 75); return { kind: 'carry', dx: q.x, face: q.face, moving: q.moving, d: q.d }; };
  if (path === 'smith') return { kind: 'hammer', dx: 0, face: -1 };            // the anvil is just to the left
  if (path === 'market' || path === 'scrap' || path === 'cargo') return carrying();
  if (path === 'guild') return state.guild ? carrying() : { kind: 'swing', dx: 0, face: -1 };   // sparring toward the instructor
  return null;
}
function benchZzz() {
  const a = window.BENCH_SLEEP || 0; if (a <= 0 || !TownPano.benchSleepReady()) return;
  const t = performance.now(); ctx.save(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  for (let i = 0; i < 3; i++) {
    const k = ((t * 0.00035) + i / 3) % 1;
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9 * Math.min(1, a); ctx.font = '700 ' + Math.round(12 + 10 * k) + 'px system-ui';
    ctx.fillText('z', 4137 + 14 * k + 6 * Math.sin(k * 5), 712 - 50 * k);
  }
  ctx.restore();
}
function drawPlayer(info) {
  if (!HeroSprite.ready()) return;
  const depth = CityCore.depthScale(player, playerY);
  if (info && info.lie && TownPano.benchSleepReady() && Math.abs(player - TownPano.PLACES.bench) < 30) {   // painted asleep on the garden bench
    return;                                                         // its z's are drawn over the night tint (benchZzz)
  }
  if (info && info.lie && TownNPCs.heroReady('bench')) {             // dozing on the street bench (the sheet draws the bench)
    ctx.save(); ctx.translate(player, playerY); ctx.scale(depth, depth);
    TownNPCs.drawHero(ctx, 'bench', { height: HERO_VISIBLE, face: 1, sec: performance.now() / 1000 });
    ctx.restore();
    return;
  }
  if (info && info.lane) {                                            // walking up into the alley (back view) or out of it (front)
    ctx.save(); ctx.translate(player, playerY); ctx.scale(depth, depth);
    HeroSprite.draw(ctx, { anim, moving: true, vdir: info.lane === 'in' ? -1 : 1, face: 1 });
    ctx.restore();
    return;
  }
  if (info && info.lie) {                                             // asleep on the street bench (fallback before the sheet loads)
    const seat = TownPano.BENCH_SEAT, h = HeroSprite.HEIGHT;
    ctx.save(); ctx.translate(player - h * 0.52, playerY - seat - 14); ctx.rotate(Math.PI / 2);
    HeroSprite.draw(ctx, { vdir: 1, moving: false, face: 1 }); ctx.restore();
    return;
  }
  const pose = !moving && info && info.working ? heroWorkPose() : null;
  if (pose && TownNPCs.heroReady(pose.kind)) {                        // a real work pose from the hero's work sheets
    const x = player + pose.dx;
    CityLighting.actorShadow(ctx, x, playerY, depth, clock);
    ctx.save(); ctx.translate(x, playerY); ctx.scale(depth, depth);
    TownNPCs.drawHero(ctx, pose.kind, { height: HERO_VISIBLE, face: pose.face, sec: performance.now() / 1000, moving: pose.moving, d: pose.d });
    ctx.restore();
    return;
  }
  CityLighting.actorShadow(ctx, player, playerY, depth, clock);
  if (moving && (state.energy < 30 || state.health < 35) && TownNPCs.heroReady('tired')) {   // worn out: hunched, dragging his feet
    ctx.save(); ctx.translate(player, playerY); ctx.scale(depth, depth);
    TownNPCs.drawHero(ctx, 'tired', { height: HERO_VISIBLE, face, moving: true, d: Math.abs(player) + Math.abs(playerY) });
    ctx.restore();
    return;
  }
  ctx.save(); ctx.translate(player, playerY); ctx.scale(face * depth, depth);
  if (moving) HeroSprite.draw(ctx, { anim, moving: true, face: 1, run: state.timeSpeed > 1, horizontal: true });
  else if (info && info.working) HeroSprite.draw(ctx, { anim: performance.now() * 0.012, moving: true, vdir: -1, face: 1 });   // busy, back to the street
  else HeroSprite.draw(ctx, { anim, moving: false, face: 1 });
  ctx.restore();
}
// Birds crossing the sky in small flocks (the pigeon flying frames of the animals sheet). Daytime only.
const FLOCKS = [{ y: 210, speed: 95, gap: 2300, n: 4, dir: 1, seed: 0 }, { y: 330, speed: 70, gap: 3100, n: 3, dir: -1, seed: 900 },
  { y: 150, speed: 120, gap: 4100, n: 5, dir: 1, seed: 1700 }];
function drawBirds(camera, w, t) {
  const light = 1 - CityLighting.sample(clock).lamps; if (light < 0.3) return;
  const sec = t / 1000;
  for (const F of FLOCKS) {
    const span = w + F.gap, p = ((sec * F.speed + F.seed) % span + span) % span;
    const lead = F.dir > 0 ? camera - 200 + p : camera + w + 200 - p;
    for (let i = 0; i < F.n; i++) {
      const x = lead - F.dir * (i * 46 + (i % 2) * 18), y = F.y + (i % 2 ? 22 : 0) + Math.sin(sec * 1.7 + i) * 6 + i * 5;
      const col = 2 + (Math.floor(sec * 7 + i * 1.3) % 2);
      ctx.globalAlpha = Math.min(1, light);
      TownNPCs.blit(ctx, 'animals', 2, col, F.dir < 0, 26, x, y, 1);
    }
  }
  ctx.globalAlpha = 1;
}
// Going through a door: the camera eases in on the hero during the last steps before he disappears inside.
const DOOR_LEAD = 0.1;                                                // clock units (~0.6 s at ×1)
function doorZoom(info) {
  if (!info || info.hidden || info.lane || !info.moving || !window.LIFE_STATE_OK) return 0;
  for (let i = 1; i <= 5; i++) {
    const dt = DOOR_LEAD * i / 5, n = LifeSim.sample(state, clock + dt);
    if (n.hidden) { const k = 1 - (dt - DOOR_LEAD / 5) / DOOR_LEAD; return Math.max(0, Math.min(1, k)) * 0.75; }
  }
  return 0;
}
// Walking through the alley between the town and ตรอกล่าง: zoom toward the lane mouth while going in,
// then start zoomed in on the other side and pull back out. k = 0 (normal) … 1 (fully in, screen darkest).
function laneZoom(info) {
  if (!info || !info.lane) return 0;
  const f = info.laneT || 0, k = info.lane === 'in' ? f : 1 - f;
  return k * k * (3 - 2 * k);                                         // smoothstep
}
function drawTown(t) {
  const info = window.LIFE_INFO || null;
  const zone = (info && info.zone) || TownPano.zoneAt(player), Z = TownPano.ZONES[zone];
  const view = CityCore.viewport(c.width, c.height, player), scale = view.scale, w = view.width, h = view.height;
  const cam0 = Math.max(Z[0], Math.min(view.cameraX, Math.max(Z[0], Z[1] - w)));
  const camera = Math.round(cam0 * scale) / scale;
  const kl = laneZoom(info), kd = kl ? 0 : doorZoom(info), k = kl || kd, zoom = 1 + (kl ? 1.7 : 1.1) * k;
  // the lane mouth (or the hero at a door) slides toward the centre of the screen as we zoom into it
  const fx = (player - camera) * scale, fy = (kl ? LifeSim.LANE.top + 20 : playerY - 70) * scale;
  const tx = fx + (c.width / 2 - fx) * k, ty = fy + (c.height * 0.55 - fy) * k;
  ctx.setTransform(scale * zoom, 0, 0, scale * zoom, tx - (fx + camera * scale) * zoom, ty - fy * zoom);
  TownPano.draw(ctx, camera, w, h, t, zone);
  drawBirds(camera, w, t);
  const actors = [];
  for (const n of TownNPCs.snapshots(clock, [{ x: player, y: playerY }])) if (n.visible && (n.zone || 'town') === zone) actors.push({ y: n.y, draw: () => drawNpc(n) });
  for (const p of TownNPCs.props()) if ((p.zone || 'town') === zone) actors.push({ y: p.z, draw: () => TownNPCs.drawProp(ctx, p.id, p.x, p.foot, p.h, t, p.fire) });
  if (!window.LIFE_HIDDEN) actors.push({ y: playerY, draw: () => drawPlayer(info) });
  actors.sort((a, b) => a.y - b.y);
  for (const a of actors) a.draw();
  if (window.Ambient) Ambient.street(ctx, camera, w, t, zone, 1 - CityLighting.sample(clock).lamps);   // leaves, petals, butterflies
  CityLighting.draw(ctx, camera, w, h, clock, { lights: [] });       // day/night tint over street and people
  const lamps = CityLighting.sample(clock).lamps;
  if (lamps > 0.01) {                                                 // the painting is very bright, so nights need a second, deeper pass
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(70,82,140,' + (0.5 * lamps).toFixed(3) + ')';
    ctx.fillRect(camera, 0, w, h); ctx.restore();
  }
  TownPano.drawNight(ctx, camera, w, lamps, t);
  benchZzz();
  if (k > 0.001) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = 'rgba(20,14,10,' + (0.85 * k * k).toFixed(3) + ')'; ctx.fillRect(0, 0, c.width, c.height); }
}

// ---- frame
function resize() {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  c.width = Math.round(innerWidth * ratio); c.height = Math.round(innerHeight * ratio);
  ctx.imageSmoothingEnabled = true; if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
}
addEventListener('resize', resize); resize();

let sceneReady = false, wasInside = false, wipeStart = -1e9, lieSince = 0;
function frame(t) {
  requestAnimationFrame(frame);
  if (!sceneReady) { last = t; return; }
  const elapsed = Math.min((t - last) / 1000 || 0, .2); last = t;
  if (!document.hidden) {
    if (!state.paused && !window.LIFE_BLOCK) {
      clock += CityLighting.clockDelta(elapsed, state.timeSpeed);
      if (clock >= 20) { const overflow = clock - 20; nextDay(); clock = overflow; }
    }
    saveClock += elapsed; if (saveClock >= 2) { saveClock = 0; save(); }
  }
  LifeUI.drive();
  window.LIFE_STATE_OK = !!(state.life && state.life.started);
  const lie = !!(window.LIFE_INFO && window.LIFE_INFO.lie);         // fade the sleeper on the garden bench in
  if (lie && !lieSince) lieSince = t; if (!lie) lieSince = 0;
  window.BENCH_SLEEP = lie ? Math.min(1, (t - lieSince) / 600) : 0;
  const inside = !!(window.LIFE_INFO && Interiors.show(ctx, c, t, clock, window.LIFE_INFO));
  if (!inside) drawTown(t);
  // circle wipe whenever the view switches between the street and an interior
  if (inside !== wasInside) { wasInside = inside; wipeStart = t; }
  const wk = (t - wipeStart) / 520;
  if (wk >= 0 && wk < 1) {
    const e = 1 - Math.pow(1 - wk, 3), R = Math.hypot(c.width, c.height) / 2 * e;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#140e0a'; ctx.beginPath();
    ctx.rect(0, 0, c.width, c.height); ctx.arc(c.width / 2, c.height * 0.55, Math.max(1, R), 0, Math.PI * 2, true); ctx.fill();
  }
}

// ---- time controls
$('speed').onclick = () => { state.timeSpeed = CityLighting.nextSpeed(state.timeSpeed); $('speed').textContent = 'เวลา ×' + state.timeSpeed; save(); };
$('pause').onclick = () => {
  state.paused = !state.paused; const label = state.paused ? 'เดินเวลาต่อ' : 'หยุดเวลา';
  $('pause').textContent = label; $('pause').setAttribute('aria-label', label); save();
};
$('speed').textContent = 'เวลา ×' + state.timeSpeed;
$('pause').textContent = state.paused ? 'เดินเวลาต่อ' : 'หยุดเวลา';
addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

// ---- wait for the art, then start
const imageSet = [...Object.values(TownPano.art), HeroSprite.load(), ...TownNPCs.load(), ...Interiors.images()];
Promise.all(imageSet.map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
  img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true });
}))).then(() => {
  sceneReady = true; $('loading').hidden = true;
  if (imageSet.some(img => !img.naturalWidth)) { const w = $('assetWarning'); w.textContent = 'ภาพบางส่วนโหลดไม่สำเร็จ ลองโหลดหน้าเกมอีกครั้ง'; w.hidden = false; }
});
update(); LifeUI.init(); requestAnimationFrame(frame);
