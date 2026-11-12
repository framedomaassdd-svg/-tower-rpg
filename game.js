/* v70 main loop. The character lives on its own (life-sim.js decides where it is from the town clock);
   this file keeps the clock, the save, and draws either the painted street (town-pano.js) or an interior (interiors.js).
   Top-level names here are shared with life-ui.js: state, clock, player, playerY, face, moving, anim, log, update, save, $. */
const c = document.querySelector('canvas'), ctx = c.getContext('2d');
const $ = id => document.getElementById(id);
const ART_V = '?v=62';
const sprite = new Image();                       // old 8-frame hero, only a fallback for the HUD portrait
const sceneObjects = [];                          // kept for life-ui (the smithy minigame looks up an optional backdrop here)
const residentImages = { merchant: new Image(), worker: new Image() };
residentImages.merchant.src = 'npc_merchant_v48.webp' + ART_V;
residentImages.worker.src = 'npc_worker_v48.webp' + ART_V;
const guardImage = new Image(); guardImage.src = 'townsfolk_guard_v63.webp?v=63';
HeroSprite.load();

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

// ---- street actors
const GUARD_BEATS = [
  { from: 300, to: 2950, y: 846, speed: 650, offset: 0.0 },
  { from: 3000, to: 6150, y: 832, speed: 650, offset: 4.2 }
];
function guards() {
  return GUARD_BEATS.map(b => {
    const len = b.to - b.from, period = 2 * len / b.speed, p = ((clock + b.offset) % period + period) % period;
    const fwd = p < period / 2, d = fwd ? p * b.speed : (period - p) * b.speed;
    return { x: b.from + d, y: b.y, face: fwd ? 1 : -1, frame: Math.floor(clock * 42) % 4 };
  });
}
function drawSheetActor(image, a) {
  if (!image.complete || !image.naturalWidth) return;
  const depth = CityCore.depthScale(a.x, a.y);
  CityLighting.actorShadow(ctx, a.x, a.y, depth * .8, clock);
  ctx.save(); ctx.translate(a.x, a.y); ctx.scale(a.face * depth, depth);
  ctx.drawImage(image, a.frame * 543, 0, 543, 724, -50, -129, 100, 133);
  ctx.restore();
}
function drawPlayer(info) {
  if (!HeroSprite.ready()) return;
  const depth = CityCore.depthScale(player, playerY);
  if (info && info.lie) {                                             // asleep on the street bench
    const seat = TownPano.BENCH_SEAT, h = HeroSprite.HEIGHT;
    ctx.save(); ctx.translate(player - h * 0.52, playerY - seat - 14); ctx.rotate(Math.PI / 2);
    HeroSprite.draw(ctx, { vdir: 1, moving: false, face: 1 }); ctx.restore();
    return;
  }
  CityLighting.actorShadow(ctx, player, playerY, depth, clock);
  ctx.save(); ctx.translate(player, playerY); ctx.scale(face * depth, depth);
  if (moving) HeroSprite.draw(ctx, { anim, moving: true, face: 1, run: state.timeSpeed > 1, horizontal: true });
  else if (info && info.working) HeroSprite.draw(ctx, { anim: performance.now() * 0.012, moving: true, vdir: -1, face: 1 });   // busy, back to the street
  else HeroSprite.draw(ctx, { anim, moving: false, face: 1 });
  ctx.restore();
}
function drawTown(t) {
  const info = window.LIFE_INFO || null;
  const view = CityCore.viewport(c.width, c.height, player), scale = view.scale, w = view.width, h = view.height;
  const camera = Math.round(view.cameraX * scale) / scale;
  ctx.setTransform(scale, 0, 0, scale, -camera * scale, 0);
  TownPano.draw(ctx, camera, w, h, t);
  const actors = [];
  for (const r of TownResidents.snapshots(clock)) if (r.visible) actors.push({ y: r.y, draw: () => drawSheetActor(residentImages[r.image], r) });
  for (const g of guards()) actors.push({ y: g.y, draw: () => drawSheetActor(guardImage, g) });
  if (!window.LIFE_HIDDEN) actors.push({ y: playerY, draw: () => drawPlayer(info) });
  actors.sort((a, b) => a.y - b.y);
  for (const a of actors) a.draw();
  CityLighting.draw(ctx, camera, w, h, clock, { lights: [] });       // day/night tint over street and people
  const lamps = CityLighting.sample(clock).lamps;
  if (lamps > 0.01) {                                                 // the painting is very bright, so nights need a second, deeper pass
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(70,82,140,' + (0.5 * lamps).toFixed(3) + ')';
    ctx.fillRect(camera, 0, w, h); ctx.restore();
  }
  TownPano.drawNight(ctx, camera, w, lamps, t);
}

// ---- frame
function resize() {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  c.width = Math.round(innerWidth * ratio); c.height = Math.round(innerHeight * ratio);
  ctx.imageSmoothingEnabled = true; if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
}
addEventListener('resize', resize); resize();

let sceneReady = false;
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
  if (window.LIFE_INFO && Interiors.show(ctx, c, t, clock, window.LIFE_INFO)) return;
  drawTown(t);
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
const imageSet = [TownPano.art.west, TownPano.art.east, TownPano.art.glowW, TownPano.art.glowE, HeroSprite.load(),
  residentImages.merchant, residentImages.worker, guardImage, ...Interiors.images()];
Promise.all(imageSet.map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
  img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true });
}))).then(() => {
  sceneReady = true; $('loading').hidden = true;
  if (imageSet.some(img => !img.naturalWidth)) { const w = $('assetWarning'); w.textContent = 'ภาพบางส่วนโหลดไม่สำเร็จ ลองโหลดหน้าเกมอีกครั้ง'; w.hidden = false; }
});
update(); LifeUI.init(); requestAnimationFrame(frame);
