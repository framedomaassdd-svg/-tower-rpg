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
if (state.life && LifeSim.ensure(state)) state.gearVersion = 113; // v113 equipment migration before the first save
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
  TownResidents.closeDay(state); clock = 0; state.day++; state.townClock = 0;
  const taxPeriods = CityCore.accrueTax(state);
  if (taxPeriods) log('ถึงรอบภาษีเมือง ยอดค้าง ' + state.taxDue + ' เหรียญ');
  if (LifeSim.night) for (const m of LifeSim.night(state)) log(m);              // v93: spoilage + supper from the bag
  else if (state.food > 0) state.food--; else { state.health = Math.max(1, state.health - 5); log('ไม่มีอาหาร สุขภาพลดลง 5'); }
  if (typeof Management !== 'undefined' && state.life) for (const m of Management.tick(state)) log(m);
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
  if (n.alpha !== undefined && n.alpha < 1) ctx.globalAlpha = n.alpha;
  CityLighting.actorShadow(ctx, n.x, n.y, depth * .8 * (n.worldH || n.height) / 124, clock);
  TownNPCs.draw(ctx, n, performance.now() / 1000, depth);
  ctx.globalAlpha = 1;
}
// What the hero does at a street workplace. Indoor jobs (inn laundry, kitchen) are drawn by interiors.js.
const HERO_VISIBLE = HeroSprite.HEIGHT * 648 / 680;                  // standing height without the cell's padding
function heroWorkPose(info) {
  const L = state.life || {}, path = L.path;
  const carrying = () => { const q = TownNPCs.heroShuttle(clock, 75); return { kind: 'carry', dx: q.x, face: q.face, moving: q.moving, d: q.d }; };
  if (info && info.task === 'cook') return { kind: 'chop', dx: 0, face: 1 };      // v93 cooking for himself
  if (info && info.task === 'gather') return carrying();                              // v93 gathering
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
// v92: asleep on the mat in a free shelter (ศาลเจ้าร้าง / เพิงข้างกองขยะ)
function shelterBed(info) { return info && info.lie && info.shelter && TownPano.BEDS[info.shelter]; }
function shelterZzz(info) {
  const b = shelterBed(info); if (!b) return;
  const t = performance.now(); ctx.save(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  for (let i = 0; i < 3; i++) {
    const k = ((t * 0.00035) + i / 3) % 1;
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9; ctx.font = '700 ' + Math.round(12 + 10 * k) + 'px system-ui';
    ctx.fillText('z', b.x - 40 + 14 * k + 6 * Math.sin(k * 5), b.y - 50 - 50 * k);
  }
  ctx.restore();
}
function drawPlayer(info) {
  if (!HeroSprite.ready()) return;
  const depth = CityCore.depthScale(player, playerY);
  const bed = shelterBed(info);
  if (bed && TownNPCs.heroReady('sleep')) {
    ctx.save(); ctx.translate(bed.x, bed.y);
    TownNPCs.drawHero(ctx, 'sleep', { height: HERO_VISIBLE, face: 1, sec: performance.now() / 1000 });
    ctx.restore();
    return;
  }
  if (info && info.lie && TownPano.benchSleepReady() && Math.abs(player - TownPano.PLACES.bench) < 30) {   // painted asleep on the garden bench
    return;                                                         // its z's are drawn over the night tint (benchZzz)
  }
  if (info && info.lie && TownNPCs.heroReady('bench')) {             // dozing on the street bench (the sheet draws the bench)
    ctx.save(); ctx.translate(player, playerY); ctx.scale(depth, depth);
    TownNPCs.drawHero(ctx, 'bench', { height: HERO_VISIBLE, face: 1, sec: performance.now() / 1000 });
    ctx.restore();
    return;
  }
  if (info && info.ride && moving) {                                  // v94 riding: the coach (hero inside), or his own ride
    const kind = info.ride === 'coach' ? (TownNPCs.heroReady('coach') ? 'coach' : 'coach_old') : 'ride_' + info.ride;
    if (TownNPCs.heroReady(kind)) {
      const big = ({ coach: 1.7, horse: 1.4, bike: 1.38, scooter: 1.38 })[info.ride] * (kind === 'coach_old' ? 0.66 : 1);   // object height ÷ the hero standing
      CityLighting.actorShadow(ctx, player, playerY, depth, clock);
      ctx.save(); ctx.translate(player, playerY); ctx.scale(depth, depth);
      TownNPCs.drawHero(ctx, kind, { height: HERO_VISIBLE * big, face, moving: true, d: Math.abs(player) });
      ctx.restore();
      return;
    }
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
  const pose = !moving && info && (info.working || info.task === 'cook' || info.task === 'gather') ? heroWorkPose(info) : null;
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
// v97 birds in the sky: distant flapping silhouettes (no more standing pigeons sliding across the sky).
// Each flock drifts along with its own speed, height and loose V; every bird flaps on its own beat and bobs a little.
// At dusk and night the birds go home and a few bats flit about instead.
const FLOCKS = [
  { y: 200, speed: 95, gap: 2300, n: 5, dir: 1, seed: 0, size: 8, flap: 7.5 },          // sparrows: small, fast wingbeats
  { y: 320, speed: 62, gap: 3100, n: 3, dir: -1, seed: 900, size: 12, flap: 3.2 },      // crows: bigger, slow and steady
  { y: 140, speed: 120, gap: 4100, n: 7, dir: 1, seed: 1700, size: 7, flap: 9 },        // swallows: quick, swooping
  { y: 260, speed: 48, gap: 5200, n: 2, dir: -1, seed: 2600, size: 15, flap: 2.2, glide: 0.6 }   // egrets: long glides
];
function birdShape(x, y, size, phase, dir, alpha) {
  const up = Math.sin(phase), wing = size * (0.35 + 0.65 * Math.abs(up)), lift = -up * size * 0.55;
  ctx.globalAlpha = alpha; ctx.lineWidth = Math.max(1.4, size * 0.2); ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - wing, y + lift * 0.6);
  ctx.quadraticCurveTo(x - wing * 0.45, y + lift - size * 0.15, x, y);
  ctx.quadraticCurveTo(x + wing * 0.45, y + lift - size * 0.15, x + wing, y + lift * 0.6);
  ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x + dir * size * 0.12, y + size * 0.05, size * 0.22, size * 0.12, 0, 0, Math.PI * 2); ctx.fill();
}
// bats come out after dark; drawn over the night tint so they show as black shapes against the dark-blue sky
function drawBats(camera, w, t) {
  const lamps = CityLighting.sample(clock).lamps, sec = t / 1000; if (lamps <= 0.45) return;
  ctx.save(); ctx.strokeStyle = ctx.fillStyle = '#07060a';
  if (lamps > 0.45) for (let i = 0; i < 5; i++) {                        // bats: jerky, darting loops near the rooftops
    const k = sec * 0.18 + i * 1.37, x = camera + ((Math.sin(k * 1.3) * 0.5 + 0.5) * 0.8 + 0.1) * w + Math.sin(sec * 5.1 + i) * 30;
    const y = 170 + i * 30 + Math.sin(k * 3.7) * 60 + Math.sin(sec * 7.3 + i * 2) * 12;
    birdShape(x, y, 10, sec * 14 + i, Math.cos(k * 1.3) > 0 ? 1 : -1, Math.min(1, (lamps - 0.45) * 3) * 0.9);
  }
  ctx.restore();
}
function drawBirds(camera, w, t) {
  const lamps = CityLighting.sample(clock).lamps, light = 1 - lamps, sec = t / 1000;
  ctx.save(); ctx.strokeStyle = ctx.fillStyle = '#2c2a33';
  if (light > 0.25) for (const F of FLOCKS) {
    const span = w + F.gap, p = ((sec * F.speed + F.seed) % span + span) % span;
    const lead = F.dir > 0 ? camera - 200 + p : camera + w + 200 - p;
    for (let i = 0; i < F.n; i++) {
      const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;                  // a loose V behind the leader
      const x = lead - F.dir * row * F.size * 4.2 + Math.sin(sec * 0.7 + i * 2.1) * F.size * 0.8;
      const y = F.y + side * row * F.size * 1.6 + Math.sin(sec * 1.3 + i * 1.7) * F.size * 0.7 + (F.flap > 8 ? Math.sin(sec * 0.9 + i) * 22 : 0);
      const beat = sec * F.flap + i * 1.9, gliding = F.glide && Math.sin(sec * 0.5 + i) > 1 - F.glide * 2;
      birdShape(x, y, F.size, gliding ? -0.35 : beat, F.dir, Math.min(1, light) * 0.85);
    }
  }
  ctx.restore();
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
  const ex=state.life&&state.life.exp;
  const away=ex&&ex.party==='personal'&&state.day>=ex.start&&!ex.over&&ex.exitDay!==state.day
    ? new Set(Management.ensure(state).party.members) : null;
  for (const n of TownNPCs.snapshots(clock, [{ x: player, y: playerY }])) if (n.visible && (!away||!away.has(n.id)) && (n.zone || 'town') === zone) actors.push({ y: n.y, draw: () => drawNpc(n) });
  for (const p of TownNPCs.props()) if ((p.zone || 'town') === zone) actors.push({ y: p.z, draw: () => TownNPCs.drawProp(ctx, p.id, p.x, p.foot, p.h, t, p.fire) });
  if (!window.LIFE_HIDDEN) actors.push({ y: playerY, draw: () => drawPlayer(info) });
  // v95 the hero's horse waits tied at the cart-yard stable whenever he isn't riding it
  if (zone === 'carts' && state.vehicles && state.vehicles.horse && !(info && info.ride === 'horse' && moving) && TownNPCs.heroReady('horse_parked'))
    actors.push({ y: 826, draw: () => { ctx.save(); ctx.translate(13470, 826); TownNPCs.drawHero(ctx, 'horse_parked', { height: HERO_VISIBLE * 1.0, face: -1, sec: performance.now() / 1000 }); ctx.restore(); } });
  actors.sort((a, b) => a.y - b.y);
  for (const a of actors) a.draw();
  if (window.Ambient) Ambient.street(ctx, camera, w, t, zone, 1 - CityLighting.sample(clock).lamps);   // leaves, petals, butterflies
  CityLighting.draw(ctx, camera, w, h, clock, { lights: [] });       // day/night tint over street and people
  const lamps = CityLighting.sample(clock).lamps;
  if (lamps > 0.01) {                                                 // the painting is very bright, so nights need a second, deeper pass
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(70,82,140,' + (0.5 * lamps).toFixed(3) + ')';
    ctx.fillRect(camera, 0, w, h); ctx.restore();
  }
  TownPano.drawNight(ctx, camera, w, lamps, t, zone);
  drawBats(camera, w, t);
  shelterZzz(info);
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
// v106 no night to watch: once the hero is in bed the screen blinks like closing eyes, goes black, and opens on the morning
let sleepFx = null;
const SLEEP_FX = { close: 1.1, jump: 1.35, black: 1.9, open: 2.6 };
function lidsAt(k) {                       // 0 = eyes open … 1 = shut
  if (k < 0.35) return 0.75 * k / 0.35;
  if (k < 0.5) return 0.75 - 0.5 * (k - 0.35) / 0.15;                 // a blink: half open again
  if (k < SLEEP_FX.close) return 0.25 + 0.75 * (k - 0.5) / (SLEEP_FX.close - 0.5);
  if (k < SLEEP_FX.black) return 1;
  return Math.max(0, 1 - (k - SLEEP_FX.black) / (SLEEP_FX.open - SLEEP_FX.black));
}
function drawLids(c01, label) {
  const W = c.width, H = c.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (c01 > 0.001) {
    ctx.fillStyle = 'rgba(10,6,4,' + (0.35 * c01).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
    const ry = Math.max(0, (1 - c01) * H * 0.78), rx = W * 0.78;
    ctx.fillStyle = '#0a0604'; ctx.beginPath(); ctx.rect(0, 0, W, H);
    if (ry > 0.5) ctx.ellipse(W / 2, H / 2, rx, ry, 0, 0, Math.PI * 2, true);
    ctx.fill();
  }
  if (label) { ctx.fillStyle = '#f6ecd8'; ctx.globalAlpha = label[1]; ctx.font = '600 ' + Math.round(H * 0.035) + 'px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(label[0], W / 2, H / 2); ctx.globalAlpha = 1; }
}
function frame(t) {
  requestAnimationFrame(frame);
  if (window.HeroLook) HeroLook.set(LifeSim.lookOf(state));   // v126 hero art follows origin + sex
  if (!sceneReady) { last = t; return; }
  const elapsed = Math.min((t - last) / 1000 || 0, .2); last = t;
  if (!document.hidden) {
    const upright = window.matchMedia && matchMedia('(orientation:portrait) and (max-width:900px)').matches;   // v128 paused while the phone is held upright
    if (!state.paused && !window.LIFE_BLOCK && !sleepFx && !upright) {
      clock += CityLighting.clockDelta(elapsed, state.timeSpeed);
      if (clock >= 20) { const overflow = clock - 20; nextDay(); clock = overflow; }
    }
    saveClock += elapsed; if (saveClock >= 2) { saveClock = 0; save(); }
  }
  LifeUI.drive();
  window.LIFE_STATE_OK = !!(state.life && state.life.started);
  const I = window.LIFE_INFO;
  if (!sleepFx && window.LIFE_STATE_OK && I && (I.sleep || I.lie) && !I.rest && !state.paused && !window.LIFE_BLOCK && (clock >= 10 || clock < 4.95))
    { sleepFx = { t0: t, jumped: false }; const lc = document.getElementById('lgloot'); if (lc) lc.classList.remove('show'); }
  const lie = !!(window.LIFE_INFO && window.LIFE_INFO.lie && !window.LIFE_INFO.shelter);         // fade the sleeper on the garden bench in
  if (lie && !lieSince) lieSince = t; if (!lie) lieSince = 0;
  window.BENCH_SLEEP = lie ? Math.min(1, (t - lieSince) / 600) : 0;
  const inside = !!(window.LIFE_INFO && ((window.TowerView && TowerView.show(ctx, c, t, clock, window.LIFE_INFO, state)) || Interiors.show(ctx, c, t, clock, window.LIFE_INFO)));   // v127 tower scene
  if (!inside) drawTown(t);
  // circle wipe whenever the view switches between the street and an interior
  if (inside !== wasInside) { wasInside = inside; wipeStart = t; }
  const wk = (t - wipeStart) / 520;
  if (wk >= 0 && wk < 1) {
    const e = 1 - Math.pow(1 - wk, 3), R = Math.hypot(c.width, c.height) / 2 * e;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#140e0a'; ctx.beginPath();
    ctx.rect(0, 0, c.width, c.height); ctx.arc(c.width / 2, c.height * 0.55, Math.max(1, R), 0, Math.PI * 2, true); ctx.fill();
  }
  if (sleepFx) {
    const k = (t - sleepFx.t0) / 1000;
    if (k >= SLEEP_FX.jump && !sleepFx.jumped) {          // straight to 06:00 (the next day if it's still evening)
      sleepFx.jumped = true; if (clock >= 5) nextDay(); clock = 5; save();
    }
    const txt = k > SLEEP_FX.jump ? ['วันที่ ' + state.day + ' · เช้าวันใหม่', Math.min(1, (k - SLEEP_FX.jump) / 0.25) * Math.min(1, Math.max(0, (SLEEP_FX.open - 0.15 - k) / 0.4))] : null;
    drawLids(lidsAt(k), txt);
    if (k >= SLEEP_FX.open) sleepFx = null;
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
if (window.HeroLook) HeroLook.set(LifeSim.lookOf(state));   // v127 pick the look before the hero's art starts loading (no double download)
const imageSet = [...Object.values(TownPano.art), HeroSprite.load(), ...TownNPCs.load(), ...Interiors.images(), ...(window.TowerView ? TowerView.images() : [])];
Promise.all(imageSet.map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
  img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true });
}))).then(() => {
  sceneReady = true; $('loading').hidden = true;
  if (imageSet.some(img => !img.naturalWidth)) { const w = $('assetWarning'); w.textContent = 'ภาพบางส่วนโหลดไม่สำเร็จ ลองโหลดหน้าเกมอีกครั้ง'; w.hidden = false; }
});
update(); LifeUI.init(); requestAnimationFrame(frame);
