/* v72 townsfolk drawn from frame sprite sheets (Phase 5 art, same style as the hero).
   Sheet npc5_<id>.webp: 4 columns × 3 rows, cell 380×376, feet on y = 364.
     row 0 walk (side view, facing right) · row 1 work · row 2 idle (front).
   Everyone's position is a pure function of the town clock (0–20 = one day, 5 = 06:00), like town-residents.js,
   so the street is right after a reload or a time-speed change. Leg frames follow distance walked, so feet never slide.
   มะลิ and ธนา keep their records in town-residents.js; only their look and work-time movement live here. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TownNPCs = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const SHEET = { cw: 380, ch: 376, base: 364, src: 343 };        // src = standing height in sheet px
  const HERO = 124;                                                 // the hero's visible height in world px
  const S = 1080 / 724, wx = x => Math.round(x * S);                // painting x → world x (same as TownPano)
  const STRIDE = 0.2;                                               // one leg frame per 0.2 × height walked
  const hasImage = typeof Image !== 'undefined';
  const sheets = {};
  function load() {
    if (!hasImage) return [];
    for (const id of ['smith', 'teen', 'elder', 'child']) if (!sheets[id]) { const i = new Image(); i.src = 'npc5_' + id + '.webp?v=72'; sheets[id] = i; }
    return Object.values(sheets);
  }
  const ok = i => !!i && i.complete && i.naturalWidth > 0;

  // Two new residents with their own day. Clock units: out = leaves home, back = leaves work.
  const PEOPLE = Object.freeze([
    Object.freeze({ id: 'smith', name: 'ช่างตีเหล็ก', sheet: 'smith', height: HERO * 1.03,
      home: wx(3770), homeY: 790, work: wx(2640), y: 836, workFace: 1, out: 5.3, back: 15.0, speed: 1000, work_anim: 'hammer' }),
    Object.freeze({ id: 'clerk', name: 'เสมียนกิลด์', sheet: 'elder', height: HERO * 0.92,      // lodges at the inn
      home: wx(3172), homeY: 790, work: wx(1395), y: 826, workFace: -1, out: 5.6, back: 14.0, speed: 1100, work_anim: 'write' })
  ]);
  // Existing residents (town-residents.js) → sheet, size, and the stretch they carry sacks along at work.
  const RESIDENT_LOOK = Object.freeze({
    mali:  { sheet: 'teen',  height: HERO * 0.89, shuttle: 95, speed: 700 },
    thana: { sheet: 'child', height: HERO * 0.79, shuttle: 70, speed: 750 }
  });
  // Hold times (real seconds) for looping work/idle frames.
  const TIMING = { hammer: [.30, .14, .09, .24], write: [.7, .6, .8, 1.0], idle: [1.6, .45, 1.3, .14] };

  function loop(times, sec) {
    const total = times.reduce((a, b) => a + b, 0); let u = ((sec % total) + total) % total;
    for (let i = 0; i < times.length; i++) { if (u < times[i]) return i; u -= times[i]; }
    return times.length - 1;
  }
  const finiteClock = c => Math.max(0, Math.min(19.999, Number.isFinite(c) ? c : 0));

  // Home door → down the passage to the street lane → along the street. Returns position and distance walked.
  function route(p, progress) {
    const vertical = p.y - p.homeY, horizontal = Math.abs(p.work - p.home), d = (vertical + horizontal) * progress;
    if (d < vertical) return { x: p.home, y: p.homeY + d, d };
    return { x: p.home + Math.sign(p.work - p.home) * (d - vertical), y: p.y, d };
  }
  function walkTime(p) { return (Math.abs(p.y - p.homeY) + Math.abs(p.work - p.home)) / p.speed; }

  function scheduled(p, clock) {
    const t = finiteClock(clock), tw = walkTime(p);
    const base = { id: p.id, name: p.name, sheet: p.sheet, height: p.height, visible: true };
    if (t < p.out || t >= p.back + tw) return { ...base, visible: false, x: p.home, y: p.homeY, phase: 'พักที่บ้าน' };
    if (t < p.out + tw) { const r = route(p, (t - p.out) / tw); return { ...base, ...r, moving: true, face: Math.sign(p.work - p.home) || 1, phase: 'เดินไปทำงาน' }; }
    if (t < p.back) return { ...base, x: p.work, y: p.y, moving: false, working: true, face: p.workFace, anim: p.work_anim, phase: 'ทำงาน' };
    const r = route(p, 1 - (t - p.back) / tw), total = Math.abs(p.y - p.homeY) + Math.abs(p.work - p.home);
    return { ...base, ...r, d: total - r.d, moving: true, face: Math.sign(p.home - p.work) || 1, phase: 'เดินกลับ' };
  }

  // Back and forth along `shuttle` px either side of the work spot, pausing at each end, carrying a sack.
  // Laps start and finish at the work spot, and a whole number of them fit the shift, so there is no jump
  // when the walk to work hands over to the shuttle or the shuttle hands over to the walk home.
  const SHIFT = [7.5, 14];                                          // town-residents.js work hours
  function shuttle(r, look, clock) {
    const A = look.shuttle, walk = 2 * A / look.speed, len = SHIFT[1] - SHIFT[0];
    const laps = Math.max(1, Math.round(len / (2 * walk + 0.7))), cycle = len / laps, pause = (cycle - 2 * walk) / 2;
    const t = Math.max(0, finiteClock(clock) - SHIFT[0]), lap = Math.min(laps - 1, Math.floor(t / cycle));
    let u = t - lap * cycle;
    // [duration, from, to] in units of A around the work spot
    const segs = [[walk / 2, 0, 1], [pause, 1, 1], [walk, 1, -1], [pause, -1, -1], [walk / 2, -1, 0]];
    let off = 0, moving = false, face = 1, d = lap * 4 * A;
    for (const [dur, from, to] of segs) {
      const k = Math.min(1, u / dur);
      off = from + (to - from) * k; moving = to !== from && u < dur; face = to < from ? -1 : to > from ? 1 : face;
      d += Math.abs(to - from) * A * k;
      if (u < dur) break;
      u -= dur;
    }
    return { x: r.x + off * A, y: r.y, d, moving, face, carrying: true };
  }
  function fromResident(r, clock) {
    const look = RESIDENT_LOOK[r.id];
    if (!look) return null;
    const base = { id: r.id, name: r.name, sheet: look.sheet, height: look.height, visible: r.visible, phase: r.phase };
    if (!r.visible) return { ...base, x: r.x, y: r.y };
    if (r.phase === 'ทำงาน') return { ...base, ...shuttle(r, look, clock), working: true };
    const p = root && root.TownResidents && root.TownResidents.PEOPLE.find(q => q.id === r.id);
    const d = p ? Math.abs(r.x - p.home) + Math.abs(r.y - p.homeY) : Math.abs(r.x);
    return { ...base, x: r.x, y: r.y, d, moving: r.moving, face: r.face };
  }

  function snapshots(clock) {
    const out = PEOPLE.map(p => scheduled(p, clock));
    const residents = root && root.TownResidents ? root.TownResidents.snapshots(clock) : [];
    for (const r of residents) { const n = fromResident(r, clock); if (n) out.push(n); }
    return out;
  }

  // [row, col, flip] for a snapshot; `sec` is real time in seconds (work loops keep their own rhythm).
  function frameOf(n, sec) {
    if (n.moving) return [n.carrying ? 1 : 0, Math.floor((n.d || 0) / (n.height * STRIDE)) % 4, n.face < 0];
    if (n.carrying) return [1, 1, n.face < 0];                                   // standing with the sack
    if (n.anim && TIMING[n.anim]) return [1, loop(TIMING[n.anim], sec), n.face < 0];
    return [2, loop(TIMING.idle, sec + n.id.length * 1.37), false];
  }
  // Feet at (n.x, n.y). `depth` is CityCore.depthScale at that spot.
  function draw(ctx, n, sec, depth) {
    const im = sheets[n.sheet]; if (!ok(im)) return false;
    const [row, col, flip] = frameOf(n, sec), k = n.height / SHEET.src * (depth || 1);
    ctx.save(); ctx.translate(n.x, n.y); if (flip) ctx.scale(-1, 1);
    ctx.drawImage(im, col * SHEET.cw, row * SHEET.ch, SHEET.cw, SHEET.ch, -SHEET.cw / 2 * k, -SHEET.base * k, SHEET.cw * k, SHEET.ch * k);
    ctx.restore();
    return true;
  }
  return { PEOPLE, RESIDENT_LOOK, SHEET, load, snapshots, frameOf, draw };
});
