/* v76 townsfolk and the hero's work poses, drawn from frame sprite sheets (same style as the hero).
   Sheet npc5_<id>.webp: 4 columns × 3 rows; row 0 walk (side view, facing right) · row 1 work · row 2 idle (front).
   Everyone's position is a pure function of the town clock (0–20 = one day, 5 = 06:00), so the street is right after
   a reload or a time-speed change. Leg frames follow distance walked, so feet never slide.
   A person's day is a list of stops; between stops they walk (out of a door, along the street, into a door).
   มะลิ and ธนา keep their records in town-residents.js; only their look and work-time movement live here. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TownNPCs = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  // Sheet layouts. src = standing height in sheet px (helmet, hat or hair top to sole; spears not counted).
  const A = { cw: 380, ch: 376, base: 364 }, B = { cw: 440, ch: 384, base: 372 };
  const SHEETS = Object.freeze({
    smith: { ...A, src: 343 }, teen: { ...A, src: 343 }, elder: { ...A, src: 343 }, child: { ...A, src: 343 },
    guard1: { ...B, src: 334 }, guard2: { ...B, src: 325 }, chef: { ...B, src: 344 }, innkeeper: { ...B, src: 347 },
    apothecary: { ...B, src: 342 }, instructor: { ...B, src: 345 }, summoned: { ...B, src: 350 }, summoned_work: { ...B, src: 350 },
    wagons: { cw: 480, ch: 320, base: 310, src: 281 },
    heroA: { ...B, src: 353 }, heroB: { ...B, src: 353 }, heroC: { ...B, src: 353 },
    kids: { ...B, src: 311 }, farmer: { ...B, src: 344 }, animals: { ...B, src: 265 },    // animals: src = the sitting cat
    washer: { ...B, src: 348 }, thug: { ...B, src: 345 }, streetkid: { ...B, src: 340 }, granny: { ...B, src: 346 },
    laborer: { ...B, src: 344 }, foreman: { ...B, src: 336 }, caravan: { ...B, src: 344 },
    wagons2: { cw: 480, ch: 320, base: 310, src: 281 },
    // v92 market people and the shrine's pilgrim
    mktveg: { ...B, src: 347 }, mktspice: { ...B, src: 347 }, mktcloth: { ...B, src: 347 }, mktcook: { ...B, src: 347 },
    garbage: { ...B, src: 347 }, shopper: { ...B, src: 347 }, pilgrim: { ...B, src: 347 },
    // v95 rides: src = the whole rider + mount (or coach) in sheet px
    heroHorse: { cw: 480, ch: 320, base: 310, src: 296 }, heroBike: { cw: 480, ch: 320, base: 310, src: 296 },
    heroScooter: { cw: 480, ch: 320, base: 310, src: 296 }, coach: { cw: 480, ch: 320, base: 310, src: 265 },
    // v98 animals: src 1, so a critter's `height` is the scale of its sheet (see CRITTERS)
    cats: { ...B, src: 1 }, dogs: { ...B, src: 1 }, rats: { ...B, src: 1 }, gbirds: { ...B, src: 1 },
    // v103 ย่านกิลด์ (src = head top to sole; the porters' loads stick up above their heads)
    warrior: { ...B, src: 345 }, archer: { ...B, src: 345 }, mage: { ...B, src: 345 }, ironboss: { ...B, src: 345 },
    explorer: { ...B, src: 345 }, scout: { ...B, src: 345 }, compassboss: { ...B, src: 345 },
    porterA: { ...B, src: 323 }, porterB: { ...B, src: 284 }, porterboss: { ...B, src: 345 },
    appraiser: { ...B, src: 345 }, merchboss: { ...B, src: 345 }
  });
  const HERO = 124;                                                 // the hero's visible height in world px
  const S = 1080 / 724, wx = x => Math.round(x * S);                // painting x → world x (same as TownPano)
  const H = h => h / 1.2;                                           // hour of day → clock units
  const STRIDE = 0.2;                                               // one leg frame per 0.2 × height walked
  const DOOR = 790;                                                 // y where a passage meets the street
  const hasImage = typeof Image !== 'undefined';
  const sheets = {};
  function load() {
    if (!hasImage) return [];
    for (const id in SHEETS) if (!sheets[id]) { const i = new Image(); i.src = 'npc5_' + id + '.webp?v=103'; sheets[id] = i; }
    return Object.values(sheets);
  }
  const ok = i => !!i && i.complete && i.naturalWidth > 0;

  // Looping poses: which row, and how long each of the 4 frames is held (real seconds).
  const LOOPS = Object.freeze({
    hammer: { row: 1, times: [.30, .14, .09, .24] }, write: { row: 1, times: [.7, .6, .8, 1.0] },
    sweep:  { row: 1, times: [.38, .3, .3, .36] },   grind: { row: 1, times: [.45, .4, .5, .9] },
    swing:  { row: 1, times: [.42, .1, .22, .7] },   phone: { row: 1, times: [1.4, .7, 1.2, 1.1] },
    guard:  { row: 1, times: [2.2, .5, 1.6, 1.2] },  offer: { row: 1, times: [2.4, .4, 1.6, 1.0] },
    scrub:  { row: 1, times: [.35, .3, .35, .5] },   stir:  { row: 1, times: [.8, .7, .9, 1.6] },
    juggle: { row: 1, times: [.22, .22, .22, .22] }, knuckle: { row: 1, times: [1.8, .5, .35, 2.2] },
    order:  { row: 1, times: [1.1, 1.6, 1.4, 1.8] }, haggle: { row: 1, times: [1.3, 1.0, .8, 1.5] },
    wok:    { row: 1, times: [.4, .3, .28, .55] },   pray:  { row: 1, times: [2.0, 1.4, 1.8, 2.6] },
    idle:   { row: 2, times: [1.6, .45, 1.3, .14] }
  });

  // stop: x, y, until (clock), and what they do there: hidden (inside), loop (a LOOPS key), face, shuttle {A, speed, sheet}.
  // carry on a stop: they carry their load (row 1) while walking TO it.
  const PEOPLE = Object.freeze([
    { id: 'smith', name: 'ช่างตีเหล็ก', sheet: 'smith', height: HERO * 1.03, speed: 1500, stops: [
      { x: 1864, y: DOOR, until: H(6.4), hidden: true },                         // lives up the market lane
      { x: 4700, y: 800, until: H(18), loop: 'hammer', face: 1 },               // left of the anvil
      { x: 1864, y: DOOR, until: 20, hidden: true }] },
    { id: 'clerk', name: 'เสมียนกิลด์', sheet: 'elder', height: HERO * 0.92, speed: 1450, stops: [
      { x: 21258, y: DOOR, until: H(5.9), hidden: true },                    // v107 moved to ย่านกิลด์: lodges in the Iron Shield hall
      { x: 20930, y: 826, until: H(16.8), loop: 'write', face: -1 },           // signing up newcomers just inside the district gate
      { x: 21258, y: DOOR, until: 20, hidden: true }] },
    { id: 'chef', name: 'พ่อครัว', sheet: 'chef', height: HERO * 1.12, speed: 1450, stops: [
      { x: 1602, y: DOOR, until: H(5.4), hidden: true },
      { x: 3730, y: 842, until: H(7.6), loop: 'idle' },                       // picking vegetables at the market
      { x: 897, y: DOOR, until: H(21.6), hidden: true, carry: true },          // carries the crate back, cooks all day
      { x: 1602, y: DOOR, until: 20, hidden: true }] },
    { id: 'innkeeper', name: 'เจ้าของโรงแรม', sheet: 'innkeeper', height: HERO * 0.95, speed: 1100, stops: [
      { x: 5828, y: DOOR, until: H(6.6), hidden: true },
      { x: 5935, y: 818, until: H(8.2), loop: 'sweep', face: 1 },
      { x: 5828, y: DOOR, until: H(15.4), hidden: true },
      { x: 5725, y: 818, until: H(16.6), loop: 'sweep', face: -1 },
      { x: 5828, y: DOOR, until: 20, hidden: true }] },
    { id: 'apothecary', name: 'หมอยา', sheet: 'apothecary', height: HERO * 0.93, speed: 1450, stops: [
      { x: 5088, y: DOOR, until: H(7.6), hidden: true },                         // lives above the shop
      { x: 5220, y: 822, until: H(17.5), loop: 'grind', face: -1 },
      { x: 5088, y: DOOR, until: 20, hidden: true }] },
    { id: 'instructor', name: 'ครูฝึกกิลด์', sheet: 'instructor', height: HERO * 1.0, speed: 1500, stops: [
      { x: 21258, y: DOOR, until: H(16.2), hidden: true },                    // v107 teaching in the Iron Shield's training yard
      { x: 21420, y: 832, until: H(18.6), loop: 'guard', face: -1 },           // waits out front for the party to come back
      { x: 21258, y: DOOR, until: 20, hidden: true }] },
    { id: 'summoned', name: 'ผู้ถูกอัญเชิญอีกคน', sheet: 'summoned', height: HERO * 1.0, speed: 1500, stops: [
      { x: 5828, y: DOOR, until: H(5.4), hidden: true },                     // also lodges at the inn
      { x: 3215, y: 832, until: H(8.4), loop: 'phone', face: 1 },             // still trying his phone by the well
      { x: 3585, y: 832, until: H(15.4), shuttle: { A: 80, speed: 760, sheet: 'summoned_work' } },
      { x: 2925, y: 834, until: H(17.2), loop: 'phone', face: -1 },
      { x: 5828, y: DOOR, until: 20, hidden: true }] }
  ]);
  // A farm woman walks in through the west gate and sells apples by the well; two kids play tag (their dog trails them).
  const MORE = [
    { id: 'farmer', name: 'แม่ค้าผลไม้', sheet: 'farmer', height: HERO * 0.93, speed: 1300, stops: [
      { x: 328, y: 770, until: H(6.9), hidden: true },                           // through the city gate
      { x: 3360, y: 846, until: H(15.2), loop: 'offer', face: 1 },
      { x: 328, y: 770, until: 20, hidden: true }] },
    { id: 'kids', name: 'เด็ก ๆ', sheet: 'kids', height: HERO * 0.74, speed: 1400, stops: [
      { x: 1864, y: DOOR, until: H(8), hidden: true },
      { x: 3245, y: 858, until: H(11.5), shuttle: { A: 130, speed: 1500, play: true } },
      { x: 1864, y: DOOR, until: H(13), hidden: true },
      { x: 4185, y: 856, until: H(17.2), shuttle: { A: 150, speed: 1500, play: true } },
      { x: 1864, y: DOOR, until: 20, hidden: true }] }
  ];
  // ตรอกล่าง (the poor district east of town)
  const SLUM = [   // zone 'slum': drawn only in the ตรอกล่าง scene
    { id: 'granny', name: 'ป้าโรงทาน', sheet: 'granny', height: HERO * 0.88, speed: 900, stops: [
      { x: 7803, y: DOOR, until: H(9), hidden: true },
      { x: 7965, y: 806, until: H(20), loop: 'stir', face: 1 },                 // at the soup pot
      { x: 7803, y: DOOR, until: 20, hidden: true }] },
    { id: 'washer', name: 'แม่ซักผ้า', sheet: 'washer', height: HERO * 0.88, speed: 1100, stops: [
      { x: 7440, y: DOOR, until: H(6.5), hidden: true },                       // rents in the tenement
      { x: 8385, y: 810, until: H(15), loop: 'scrub', face: 1 },
      { x: 7440, y: DOOR, until: 20, hidden: true }] },
    { id: 'streetkid', name: 'เด็กจรจัด', sheet: 'streetkid', height: HERO * 0.72, speed: 1400, stops: [
      { x: 9691, y: DOOR, until: H(7.5), hidden: true },                       // sleeps in the shack
      { x: 6930, y: 848, until: H(11), loop: 'juggle', face: 1 },               // busking by the alley gate
      { x: 7900, y: 848, until: H(12.5), loop: 'idle' },                        // waiting for soup
      { x: 9200, y: 848, until: H(18), loop: 'juggle', face: 1 },
      { x: 9691, y: DOOR, until: 20, hidden: true }] },
    { id: 'thug', name: 'นักเลงตรอก', sheet: 'thug', height: HERO * 1.04, speed: 1500, stops: [
      { x: 10873, y: DOOR, until: H(7.5), hidden: true },
      { x: 6760, y: 830, until: H(17), loop: 'knuckle', face: 1 },              // minding "his" gate
      { x: 8995, y: 824, until: H(22.3), loop: 'knuckle', face: -1 },          // and the junk shop at night
      { x: 10873, y: DOOR, until: 20, hidden: true }] }
  ];
  // Carts on the road (sheet 'wagons': row 0 horse wagon, row 1 donkey hay cart). They drive in through the
  // city gate, stop to unload, and drive back out. Stops carry y = road lane; legs are straight along it.
  const ROAD = 905, OFF = -420;
  const CARTS = [
    { id: 'wagon', name: 'เกวียนพ่อค้า', sheet: 'wagons', vrow: 0, height: HERO * 1.45, speed: 4200, stops: [
      { x: OFF, y: ROAD, until: H(6.3), hidden: true },
      { x: 3615, y: ROAD, until: H(8.4) },                                     // unloading flour at the bakery
      { x: 5705, y: ROAD, until: H(10.2) },                                    // then supplies for the inn
      { x: OFF, y: ROAD, until: 20, hidden: true }] },
    { id: 'haycart', name: 'เกวียนฟาง', sheet: 'wagons', vrow: 1, height: HERO * 1.2, speed: 2600, stops: [
      { x: OFF, y: ROAD + 12, until: H(12.4), hidden: true },
      { x: 4535, y: ROAD + 12, until: H(15.6) },                                 // hay for the forge's horse
      { x: OFF, y: ROAD + 12, until: 20, hidden: true }] }
  ];
  // ลานเกวียน (zone 'carts', outside the west gate): porters carry sacks from the carts up to the warehouse dock,
  // the foreman calls the work, a caravan merchant haggles by his tents. Porters carry only toward the dock.
  const CARTS_YARD = [
    { id: 'porter1', name: 'กรรมกรลานเกวียน', sheet: 'laborer', height: HERO * 1.0, speed: 1300, stops: [
      { x: 13283, y: DOOR, until: H(6.4), hidden: true },                      // sleeps over the stable
      { x: 14080, y: 838, until: H(12), shuttle: { A: 150, speed: 520, oneWay: 1 } },
      { x: 11715, y: 846, until: H(13), loop: 'idle' },                         // lunch by the caravan fire
      { x: 14080, y: 838, until: H(17.5), shuttle: { A: 150, speed: 520, oneWay: 1 } },
      { x: 13283, y: DOOR, until: 20, hidden: true }] },
    { id: 'porter2', name: 'กรรมกรลานเกวียน', sheet: 'laborer', height: HERO * 0.97, speed: 1250, stops: [
      { x: 13283, y: DOOR, until: H(6.8), hidden: true },
      { x: 13560, y: 852, until: H(17.2), shuttle: { A: 190, speed: 480, oneWay: -1 } },   // from the caravan wagon to the stable store
      { x: 13283, y: DOOR, until: 20, hidden: true }] },
    { id: 'foreman', name: 'หัวหน้าคนงาน', sheet: 'foreman', height: HERO * 0.97, speed: 1100, stops: [
      { x: 12545, y: DOOR, until: H(6.5), hidden: true },
      { x: 13900, y: 826, until: H(11.5), loop: 'order', face: 1 },            // calling the work at the dock
      { x: 12700, y: 818, until: H(14), loop: 'order', face: -1 },             // tallies by the office
      { x: 13900, y: 826, until: H(17.6), loop: 'order', face: 1 },
      { x: 12545, y: DOOR, until: 20, hidden: true }] },
    { id: 'caravan', name: 'พ่อค้าคาราวาน', sheet: 'caravan', height: HERO * 1.0, speed: 1000, stops: [
      { x: 11715, y: 820, until: H(7), loop: 'idle', face: 1 },
      { x: 11960, y: 828, until: H(12), loop: 'haggle', face: -1 },            // selling at his spice tent
      { x: 13760, y: 840, until: H(14.5), loop: 'haggle', face: 1 },           // bargaining with the foreman's men
      { x: 11960, y: 828, until: H(19.5), loop: 'haggle', face: -1 },
      { x: 11715, y: 820, until: 20, loop: 'idle', face: 1 }] },
    // carts: the ox caravan rolls in from the country road in the morning; the mule cart comes and goes
    { id: 'oxwagon', name: 'เกวียนคาราวาน', sheet: 'wagons2', vrow: 0, height: HERO * 1.6, speed: 1800, stops: [
      { x: 10900, y: ROAD, until: H(6.6), hidden: true },
      { x: 13480, y: ROAD, until: H(15.8) },                                    // unloading by the stable
      { x: 10900, y: ROAD, until: 20, hidden: true }] },
    { id: 'mulecart', name: 'เกวียนล่อขนลัง', sheet: 'wagons2', vrow: 1, height: HERO * 1.75,   /* v99: the walking drover = a person's height */ speed: 2200, stops: [
      { x: 10900, y: ROAD + 14, until: H(8.4), hidden: true },
      { x: 14330, y: ROAD + 14, until: H(11.8) },                               // crates for the warehouse
      { x: 10900, y: ROAD + 14, until: H(13.2), hidden: true },
      { x: 14330, y: ROAD + 14, until: H(16.6) },
      { x: 10900, y: ROAD + 14, until: 20, hidden: true }] }
  ];
  // Two guards walk the whole street day and night, one on each half.
  const PATROLS = Object.freeze([
    { id: 'guard1', name: 'ทหารยาม', sheet: 'guard1', height: HERO * 1.02, from: 300, to: 3485, y: 846, speed: 650, offset: 0.0, rest: 0.45 },
    { id: 'guard2', name: 'ทหารยาม', sheet: 'guard2', height: HERO * 1.0, from: 3545, to: 6280, y: 832, speed: 650, offset: 4.2, rest: 0.45 }
  ]);
  // Existing residents (town-residents.js) → sheet, size, and the stretch they carry sacks along at work.
  const RESIDENT_LOOK = Object.freeze({
    mali:  { sheet: 'teen',  height: HERO * 0.89, shuttle: 95, speed: 700 },
    thana: { sheet: 'child', height: HERO * 0.79, shuttle: 70, speed: 750 }
  });

  const finiteClock = c => Math.max(0, Math.min(19.999, Number.isFinite(c) ? c : 0));
  function loopFrame(times, sec) {
    const total = times.reduce((a, b) => a + b, 0); let u = ((sec % total) + total) % total;
    for (let i = 0; i < times.length; i++) { if (u < times[i]) return i; u -= times[i]; }
    return times.length - 1;
  }

  // Walk from a to b: down/up to the lane (the lower of the two y's), along it, then up/down to b.
  function legLength(a, b) { const lane = Math.max(a.y, b.y); return (lane - a.y) + Math.abs(b.x - a.x) + (lane - b.y); }
  function along(a, b, d) {
    const lane = Math.max(a.y, b.y), v1 = lane - a.y, h = Math.abs(b.x - a.x);
    if (d <= v1) return { x: a.x, y: a.y + d };
    if (d <= v1 + h) return { x: a.x + Math.sign(b.x - a.x) * (d - v1), y: lane };
    return { x: b.x, y: lane - (d - v1 - h) };
  }
  // Back and forth A px either side of x between t0 and t1, pausing at each end; a whole number of laps, so it
  // starts and ends on x (no jump when walking in or out).
  function shuttleAt(x, y, A, speed, t0, t1, clock) {
    const walk = 2 * A / speed, len = Math.max(0.01, t1 - t0);
    const laps = Math.max(1, Math.round(len / (2 * walk + 0.7))), cycle = len / laps, pause = Math.max(0, (cycle - 2 * walk) / 2);
    const t = Math.max(0, clock - t0), lap = Math.min(laps - 1, Math.floor(t / cycle));
    let u = t - lap * cycle, off = 0, moving = false, face = 1, d = lap * 4 * A;
    const segs = [[walk / 2, 0, 1], [pause, 1, 1], [walk, 1, -1], [pause, -1, -1], [walk / 2, -1, 0]];
    for (const [dur, from, to] of segs) {
      const k = dur > 0 ? Math.min(1, u / dur) : 1;
      off = from + (to - from) * k; moving = to !== from && u < dur; face = to < from ? -1 : to > from ? 1 : face;
      d += Math.abs(to - from) * A * k;
      if (u < dur) break;
      u -= dur;
    }
    return { x: x + off * A, y, d, moving, face };
  }

  for (const p of SLUM) p.zone = 'slum';
  // v90 ตลาดใหญ่ (zone 'market'): stall keepers come out of the market lane in the morning and go home at dusk.
  // They borrow existing sheets for now (a boy, an old clerk, an auntie) until the market gets its own people.
  const LANE_M = 15986;                       // the market lane: where market folk go home
  const MARKET = [
    { id: 'mkt_veg', name: 'ป้าแผงผัก', sheet: 'mktveg', height: HERO * 0.9, speed: 1200, stops: [
      { x: LANE_M, y: DOOR, until: H(5.6), hidden: true },
      { x: 16560, y: 830, until: H(17.8), loop: 'offer', face: 1 },
      { x: LANE_M, y: DOOR, until: 20, hidden: true }] },
    { id: 'mkt_spice', name: 'พ่อค้าเครื่องเทศ', sheet: 'mktspice', height: HERO * 1.0, speed: 1300, stops: [
      { x: LANE_M, y: DOOR, until: H(6.8), hidden: true },
      { x: 17150, y: 828, until: H(18.2), loop: 'grind', face: 1 },
      { x: LANE_M, y: DOOR, until: 20, hidden: true }] },
    { id: 'mkt_cloth', name: 'ช่างผ้า', sheet: 'mktcloth', height: HERO * 0.92, speed: 1300, stops: [
      { x: LANE_M, y: DOOR, until: H(7.2), hidden: true },
      { x: 18390, y: 830, until: H(18.4), loop: 'write', face: 1 },
      { x: LANE_M, y: DOOR, until: 20, hidden: true }] },
    { id: 'mkt_cook', name: 'พ่อครัวริมทาง', sheet: 'mktcook', height: HERO * 0.95, speed: 1400, stops: [
      { x: LANE_M, y: DOOR, until: H(5.2), hidden: true },
      { x: 18900, y: 836, until: H(21.2), loop: 'wok', face: 1 },
      { x: LANE_M, y: DOOR, until: 20, hidden: true }] },
    { id: 'garbage', name: 'ลุงเก็บขยะ', sheet: 'garbage', height: HERO * 0.88, speed: 900, stops: [
      { x: 19480, y: 846, until: H(4.6), loop: 'idle', face: -1 },               // dozes against his heap
      { x: 17000, y: 850, until: H(7.4), shuttle: { A: 900, speed: 500 } },       // walks the market before it opens
      { x: 16300, y: 852, until: H(9.5), loop: 'sweep', face: 1 },
      { x: 19480, y: 846, until: H(13), loop: 'idle', face: -1 },
      { x: 17800, y: 852, until: H(18.5), loop: 'sweep', face: -1 },             // by the fountain
      { x: 19480, y: 846, until: 20, loop: 'idle', face: -1 }] },
    { id: 'shopper1', name: 'คนมาจ่ายตลาด', sheet: 'shopper', height: HERO * 0.9, speed: 1200, stops: [
      { x: LANE_M, y: DOOR, until: H(7.6), hidden: true },
      { x: 16820, y: 858, until: H(8.4), loop: 'offer', face: -1 },               // picking fruit at the veg stall
      { x: 17290, y: 860, until: H(9.1), loop: 'idle', face: -1 },
      { x: 18560, y: 858, until: H(9.8), loop: 'offer', face: 1 },
      { x: LANE_M, y: DOOR, until: H(15.5), hidden: true },
      { x: 16840, y: 858, until: H(16.4), loop: 'offer', face: -1 },
      { x: LANE_M, y: DOOR, until: 20, hidden: true }] },
    { id: 'shopper2', name: 'คนมาจ่ายตลาด', sheet: 'shopper', height: HERO * 0.86, speed: 1100, stops: [
      { x: LANE_M, y: DOOR, until: H(10.2), hidden: true },
      { x: 17370, y: 862, until: H(11), loop: 'offer', face: -1 },
      { x: 18760, y: 864, until: H(12.2), loop: 'idle', face: 1 },                // waiting for noodles
      { x: LANE_M, y: DOOR, until: 20, hidden: true }] }
  ];
  // v92 ศาลเจ้าร้าง (zone 'carts'): an old wandering monk who sleeps there, prays out front and begs at the caravan fire
  const SHRINE = [
    { id: 'pilgrim', name: 'หลวงตาเร่ร่อน', sheet: 'pilgrim', height: HERO * 0.9, speed: 800, stops: [
      { x: 11000, y: DOOR, until: H(5.4), hidden: true },
      { x: 10930, y: 812, until: H(11), loop: 'pray', face: 1 },
      { x: 11640, y: 840, until: H(13), loop: 'idle', face: 1 },                  // alms by the caravan fire
      { x: 10930, y: 812, until: H(18.5), loop: 'pray', face: 1 },
      { x: 11000, y: DOOR, until: 20, hidden: true }] }
  ];

  // v103 ย่านกิลด์ (zone 'guild'): each guild's people live in their hall. In the morning the parties gather out front,
  // walk east past the halls and up into the tower (off the east end), and come back down in the late afternoon.
  const G = { iron: 21258, compass: 21941, porter: 22646, merch: 23358, tower: 24198 };
  const party = (id, name, sheet, hall, h, speed, gather, loop, out, back, y) => ({ id, name, sheet, height: HERO * h, speed, stops: [
    { x: hall, y: DOOR, until: H(gather[0]), hidden: true },
    { x: gather[1], y, until: H(out), loop, face: 1 },
    { x: G.tower + (y - 840) * 2, y: 662, until: H(back), hidden: true },    // up the gate's stairs and into the tower
    { x: gather[1] + 40, y, until: H(back + 2.2), loop: 'idle', face: -1 },    // back out front, telling the day's story
    { x: hall, y: DOOR, until: 20, hidden: true }] });
  const GUILD = [
    { id: 'ironboss', name: 'หัวหน้ากิลด์โล่เหล็ก', sheet: 'ironboss', height: HERO * 1.08, speed: 1100, stops: [
      { x: G.iron, y: DOOR, until: H(6.3), hidden: true },
      { x: G.iron - 150, y: 826, until: H(8.2), loop: 'order', face: 1 },     // briefing the party
      { x: G.iron, y: DOOR, until: H(16.6), hidden: true },
      { x: G.iron - 150, y: 826, until: H(18.6), loop: 'order', face: 1 },
      { x: G.iron, y: DOOR, until: 20, hidden: true }] },
    party('warrior', 'นักรบโล่เหล็ก', 'warrior', G.iron, 1.0, 1500, [6.4, G.iron - 40], 'swing', 8.0, 16.4, 838),
    party('archer', 'นักธนูโล่เหล็ก', 'archer', G.iron, 0.95, 1500, [6.6, G.iron + 60], 'swing', 8.05, 16.45, 846),
    party('mage', 'นักเวทโล่เหล็ก', 'mage', G.iron, 0.93, 1450, [6.8, G.iron + 150], 'offer', 8.1, 16.5, 834),
    { id: 'compassboss', name: 'หัวหน้ากิลด์เข็มทิศเงิน', sheet: 'compassboss', height: HERO * 0.9, speed: 800, stops: [
      { x: G.compass, y: DOOR, until: H(7.0), hidden: true },
      { x: G.compass - 190, y: 822, until: H(17.4), loop: 'write', face: 1 },   // her map book on its lectern
      { x: G.compass, y: DOOR, until: 20, hidden: true }] },
    party('explorer', 'นักสำรวจเข็มทิศเงิน', 'explorer', G.compass, 0.97, 1400, [6.5, G.compass + 90], 'write', 8.4, 16.8, 836),
    party('scout', 'หน่วยสอดแนมเข็มทิศเงิน', 'scout', G.compass, 0.92, 1550, [6.7, G.compass + 190], 'guard', 8.45, 16.85, 846),
    { id: 'porterboss', name: 'หัวหน้าสมาคมคนแบกของ', sheet: 'porterboss', height: HERO * 1.05, speed: 1000, stops: [
      { x: G.porter, y: DOOR, until: H(5.8), hidden: true },
      { x: G.porter - 170, y: 828, until: H(18.4), loop: 'order', face: 1 },
      { x: G.porter, y: DOOR, until: 20, hidden: true }] },
    party('porterA', 'คนแบกของ', 'porterA', G.porter, 1.0, 1250, [6.0, G.porter + 40], 'grind', 8.15, 16.55, 840),
    party('porterB', 'คนแบกของ', 'porterB', G.porter, 0.92, 1200, [6.2, G.porter + 150], 'scrub', 8.5, 16.9, 848),
    { id: 'merchboss', name: 'หัวหน้ากิลด์พ่อค้าหอคอย', sheet: 'merchboss', height: HERO * 0.94, speed: 900, stops: [
      { x: G.merch, y: DOOR, until: H(8.5), hidden: true },
      { x: G.merch - 160, y: 826, until: H(12), loop: 'haggle', face: 1 },
      { x: G.merch, y: DOOR, until: H(16.8), hidden: true },
      { x: G.merch - 160, y: 826, until: H(19.5), loop: 'haggle', face: 1 },  // buying what the parties brought back
      { x: G.merch, y: DOOR, until: 20, hidden: true }] },
    { id: 'appraiser', name: 'นักตีราคา', sheet: 'appraiser', height: HERO * 0.95, speed: 1100, stops: [
      { x: G.merch, y: DOOR, until: H(7.6), hidden: true },
      { x: G.merch + 170, y: 834, until: H(19.8), loop: 'offer', face: -1 },
      { x: G.merch, y: DOOR, until: 20, hidden: true }] }
  ];
  for (const p of GUILD) p.zone = 'guild';
  for (const p of PEOPLE) if (p.id === 'clerk' || p.id === 'instructor') p.zone = 'guild';
  for (const p of CARTS_YARD) p.zone = 'carts';
  for (const p of MARKET) p.zone = 'market';
  for (const p of SHRINE) p.zone = 'carts';
  const ALL_PEOPLE = PEOPLE.concat(MORE, SLUM, CARTS, CARTS_YARD, MARKET, SHRINE, GUILD);
  function scheduled(p, clock) {
    const t = finiteClock(clock), base = { id: p.id, name: p.name, sheet: p.sheet, height: p.height, visible: true, zone: p.zone || 'town', vrow: p.vrow };
    let prev = p.stops[0], start = 0, walked = 0;
    for (let i = 0; i < p.stops.length; i++) {
      const s = p.stops[i];
      if (i > 0) {                          // walking from prev to s; leaves at prev.until, but never before arriving there
        const len = legLength(prev, s), dur = len / p.speed, t0 = Math.max(prev.until, start);
        if (t < t0 + dur) {
          const pos = along(prev, s, (t - t0) * p.speed);
          return { ...base, ...pos, d: walked + (t - t0) * p.speed, moving: true, carrying: !!s.carry, face: Math.sign(s.x - prev.x) || 1,
            phase: s.hidden ? 'กำลังกลับ' : 'กำลังเดินทาง' };
        }
        walked += len; start = t0 + dur;
      }
      if (t < Math.max(s.until, start) || i === p.stops.length - 1) {
        if (s.hidden) return { ...base, visible: false, x: s.x, y: s.y, phase: 'อยู่ข้างใน' };
        if (s.shuttle) {
          const q = shuttleAt(s.x, s.y, s.shuttle.A, s.shuttle.speed, start, Math.max(s.until, start), t);
          const play = !!s.shuttle.play, carry = s.shuttle.oneWay ? q.face === s.shuttle.oneWay : !play;
          return { ...base, ...q, d: walked + q.d, sheet: s.shuttle.sheet || p.sheet, carrying: carry, run: play, working: !play, phase: play ? 'วิ่งเล่น' : 'ทำงาน' };
        }
        return { ...base, x: s.x, y: s.y, moving: false, face: s.face || 1, loop: s.loop || 'idle', working: !!s.loop, phase: 'ทำงาน' };
      }
      prev = s;
    }
    return { ...base, visible: false, x: prev.x, y: prev.y };
  }

  function patrol(g, clock) {
    // there and back, with a short look-around at each end
    const len = g.to - g.from, walk = len / g.speed, period = 2 * (walk + g.rest), c = finiteClock(clock) + g.offset;
    const p = ((c % period) + period) % period, laps = Math.floor(c / period) * 2 * len;
    const base = { id: g.id, name: g.name, sheet: g.sheet, height: g.height, visible: true, y: g.y, phase: 'ลาดตระเวน' };
    if (p < walk) return { ...base, x: g.from + p * g.speed, moving: true, face: 1, d: laps + p * g.speed };
    if (p < walk + g.rest) return { ...base, x: g.to, moving: false, face: 1, loop: 'guard' };
    if (p < 2 * walk + g.rest) { const q = p - walk - g.rest; return { ...base, x: g.to - q * g.speed, moving: true, face: -1, d: laps + len + q * g.speed }; }
    return { ...base, x: g.from, moving: false, face: -1, loop: 'guard' };
  }

  function fromResident(r, clock) {
    const look = RESIDENT_LOOK[r.id];
    if (!look) return null;
    const base = { id: r.id, name: r.name, sheet: look.sheet, height: look.height, visible: r.visible, phase: r.phase };
    if (!r.visible) return { ...base, x: r.x, y: r.y };
    if (r.phase === 'ทำงาน') return { ...base, ...shuttleAt(r.x, r.y, look.shuttle, look.speed, 7.5, 14, finiteClock(clock)), carrying: true, working: true };
    const p = root && root.TownResidents && root.TownResidents.PEOPLE.find(q => q.id === r.id);
    const d = p ? Math.abs(r.x - p.home) + Math.abs(r.y - p.homeY) : Math.abs(r.x);
    return { ...base, x: r.x, y: r.y, d, moving: r.moving, face: r.face };
  }

  // ---- animals (one sheet: row 0 cat · row 1 dog walk · row 2 pigeons) ----
  const PIGEONS = [-70, 15, 80].map((dx, i) => ({ id: 'pigeon' + i, x: 3260 + dx, y: 852 + i * 6 }));
  function cat(clock) {
    const h = finiteClock(clock) * 1.2, night = h < 6 || h >= 21;
    const col = night ? 2 : [0, 1, 0, 2, 2, 3][Math.floor(finiteClock(clock) * 4) % 6];      // sit · lick · sit · nap · nap · stretch
    return { id: 'cat', name: 'แมว', sheet: 'animals', height: HERO * 0.32, visible: true, x: 6155, y: 808, face: -1, still: [0, col] };
  }
  function dog(clock) {
    // trails the kids along their own path, a moment behind them
    const k = scheduled(MORE[1], clock - 0.065), now = scheduled(MORE[1], clock);
    if (!k.visible || !now.visible) return { id: 'dog', visible: false, x: k.x, y: k.y };
    return { id: 'dog', name: 'หมา', sheet: 'animals', height: HERO * 0.46, visible: true, x: k.x, y: k.y + 8, face: k.face,
      moving: k.moving, d: k.d, dogWalk: true };
  }
  // movers: [{x, y}] of anyone else walking about (the hero). Pigeons flutter up when someone comes close.
  function pigeons(out, movers) {
    const near = movers.concat(out.filter(n => n.visible && n.moving));
    return PIGEONS.map(p => {
      let dist = Infinity;
      for (const m of near) if (Math.abs(m.y - p.y) < 70) dist = Math.min(dist, Math.abs(m.x - p.x));
      const lift = dist < 150 ? (150 - dist) * 1.3 : 0;
      return { id: p.id, name: 'นกพิราบ', sheet: 'animals', height: HERO * 0.26, visible: true, x: p.x, y: p.y, lift, startled: lift > 0,
        face: p.id === 'pigeon1' ? -1 : 1 };
    });
  }

  // ---- v98 critters: cats, dogs, rats, mice, sparrows, crows, a hen with chicks ----------------------------
  // Each wanders inside its range in hops: walk to a new spot, then idle there (pose picked per hop), all a pure
  // function of the clock. Birds and rats bolt (fade away) when someone walks right up to them.
  // k = sheet scale; walk: [row]; idle: [[row, col], ...]; loop: idle frames that animate (pecking); day/night: hours.
  const CAT = 0.16, DOG = 0.2, RAT = 0.1;
  const CRITTERS = [
    // town
    { id: 'tabby', name: 'แมวลายเทา', sheet: 'cats', k: CAT, zone: 'town', range: [3500, 4350], y: 812, speed: 420, hop: 0.9,
      walk: 0, idle: [[1, 0], [1, 1], [1, 3], [1, 0]], night: { range: [5260, 5300], idle: [[1, 2]] } },
    { id: 'sparrows', name: 'นกกระจอก', sheet: 'gbirds', k: 0.075, zone: 'town', range: [3560, 3780], y: 852, speed: 260, hop: 0.35,
      walk: 0, loop: [[0, 2], [0, 3]], flock: 3, shy: true, day: [6, 19] },
    { id: 'crowT', name: 'อีกา', sheet: 'gbirds', k: 0.11, zone: 'town', range: [2440, 2600], y: 848, speed: 200, hop: 0.6,
      walk: 1, loop: [[1, 2], [1, 3], [1, 0]], shy: true, day: [6, 18] },
    // ตรอกล่าง
    { id: 'stray', name: 'หมาจร', sheet: 'dogs', k: DOG, zone: 'slum', range: [7000, 9600], y: 846, speed: 700, hop: 1.1,
      walk: 0, idle: [[1, 0], [1, 1], [1, 3], [1, 2]], night: { range: [8000, 8040], idle: [[1, 2]] } },
    { id: 'blackcat', name: 'แมวดำ', sheet: 'cats', k: CAT, zone: 'slum', range: [8900, 9400], y: 816, speed: 380, hop: 1.0,
      walk: 0, tint: 'black', idle: [[2, 0], [2, 1], [2, 2], [2, 3]] },
    { id: 'ratS', name: 'หนู', sheet: 'rats', k: RAT, zone: 'slum', range: [9750, 10500], y: 830, speed: 1100, hop: 0.3,
      walk: 0, idle: [[1, 0], [1, 1], [1, 2]], flock: 2, shy: true, nightFlock: 4 },
    { id: 'mouseS', name: 'หนูหริ่ง', sheet: 'rats', k: RAT, zone: 'slum', range: [7600, 8100], y: 824, speed: 1000, hop: 0.25,
      walk: 2, idle: [[2, 1]], shy: true, day: [19, 6] },
    // ตลาดใหญ่
    { id: 'fishcat', name: 'แมวรอเศษปลา', sheet: 'cats', k: CAT, zone: 'market', range: [16860, 16960], y: 830, speed: 300, hop: 1.4,
      walk: 0, idle: [[1, 0], [1, 1], [1, 0], [1, 3]], night: { range: [19500, 19520], idle: [[1, 2]] } },
    { id: 'ratM', name: 'หนู', sheet: 'rats', k: RAT, zone: 'market', range: [19330, 19820], y: 806, speed: 1100, hop: 0.3,
      walk: 0, idle: [[1, 0], [1, 1], [1, 3]], flock: 2, shy: true, nightFlock: 3 },
    { id: 'crowM', name: 'อีกา', sheet: 'gbirds', k: 0.11, zone: 'market', range: [18700, 19200], y: 850, speed: 200, hop: 0.6,
      walk: 1, loop: [[1, 2], [1, 3], [1, 0]], flock: 2, shy: true, day: [6, 18.5] },
    { id: 'sparrowM', name: 'นกกระจอก', sheet: 'gbirds', k: 0.075, zone: 'market', range: [17600, 17950], y: 852, speed: 260, hop: 0.35,
      walk: 0, loop: [[0, 2], [0, 3]], flock: 4, shy: true, day: [6, 18.5] },
    // ลานเกวียน
    { id: 'guarddog', name: 'หมาเฝ้าคอก', sheet: 'dogs', k: DOG, zone: 'carts', range: [12950, 13650], y: 840, speed: 600, hop: 1.2,
      walk: 2, idle: [[2, 1]], night: { range: [13300, 13320], idle: [[2, 1]] } },
    { id: 'hen', name: 'แม่ไก่กับลูก', sheet: 'gbirds', k: 0.14, zone: 'carts', range: [13950, 14450], y: 846, speed: 160, hop: 0.7,
      walk: 2, loop: [[2, 2], [2, 3], [2, 0], [2, 2]], day: [5.5, 18.5] },
    { id: 'crowF', name: 'อีกา', sheet: 'gbirds', k: 0.11, zone: 'carts', range: [10900, 11600], y: 850, speed: 200, hop: 0.6,
      walk: 1, loop: [[1, 2], [1, 3], [1, 0]], flock: 3, shy: true, day: [6, 18] }
  ];
  const ROWH = { cats: 288, dogs: 280, rats: 170, gbirds: 220 };   // walk-row height in sheet px (for shadows)
  const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  const idNum = s => [...s].reduce((n, ch) => n * 31 + ch.charCodeAt(0), 7) % 9973;
  const inHours = (h, [a, b]) => a <= b ? h >= a && h < b : h >= a || h < b;
  function critterAt(c, j, clock, movers) {
    const hour = clock * 1.2, isNight = hour < 6 || hour >= 20;
    const id = c.id + (j ? '_' + j : ''), base = { id, name: c.name, sheet: c.sheet, height: c.k, worldH: ROWH[c.sheet] * c.k, zone: c.zone, visible: false, x: c.range[0], y: c.y };
    if (c.day && !inHours(hour, c.day)) return base;
    const mode = isNight && c.night ? c.night : c, range = mode.range, idle = mode.idle || c.idle, seed = idNum(id);
    const hop = c.hop * (0.8 + 0.4 * hash(seed, 1)), seg = Math.floor(clock / hop), t = clock - seg * hop;
    const at = s => range[0] + (range[1] - range[0]) * hash(seed, s);
    const a = at(seg - 1), b = at(seg), travel = Math.abs(b - a) / c.speed;
    const y = c.y + (j % 3) * 7 - (hash(seed, 2) * 6);
    let x, moving = false, face = b >= a ? 1 : -1, frame;
    if (t < travel && travel > 0) {
      moving = true; x = a + (b - a) * (t / travel);
      frame = [c.walk, Math.floor(Math.abs(x) / (ROWH[c.sheet] * c.k * 0.32)) % 4];
    } else {
      x = b;
      if (c.loop) frame = { loop: c.loop, rate: 2.6 + hash(seed, 3) };
      else frame = idle[Math.floor(hash(seed, seg + 0.5) * idle.length)];
    }
    let alpha = 1;
    if (c.shy) {                                                   // bolts when someone comes close
      let dist = Infinity;
      for (const m of movers) if (Math.abs(m.y - y) < 80) dist = Math.min(dist, Math.abs(m.x - x));
      alpha = Math.max(0, Math.min(1, (dist - 70) / 60));
      if (alpha <= 0) return base;
    }
    return Object.assign(base, { visible: true, x, y, face, moving, crit: frame, alpha });
  }
  function critters(clock, movers) {
    const out = [], c0 = finiteClock(clock), hour = c0 * 1.2, night = hour < 6 || hour >= 20;
    for (const c of CRITTERS) {
      const n = (night && c.nightFlock) || c.flock || 1;
      for (let j = 0; j < n; j++) out.push(critterAt(c, j, c0, movers));
    }
    return out;
  }

  function snapshots(clock, movers) {
    const out = ALL_PEOPLE.map(p => scheduled(p, clock)).concat(PATROLS.map(g => patrol(g, clock)));
    const residents = root && root.TownResidents ? root.TownResidents.snapshots(clock) : [];
    for (const r of residents) { const n = fromResident(r, clock); if (n) out.push(n); }
    out.push(cat(clock), dog(clock));
    const walkers = (movers || []).concat(out.filter(n => n.visible && n.moving));
    return out.concat(pigeons(out, movers || []), critters(clock, walkers));
  }

  // [row, col, flip] for a snapshot; `sec` is real time in seconds (work loops keep their own rhythm).
  function frameOf(n, sec) {
    if (n.crit) {                                                                // v98 critters
      const f = n.crit.loop ? n.crit.loop[Math.floor(sec * n.crit.rate + n.x * 0.013) % n.crit.loop.length] : n.crit;
      return [f[0], f[1], n.face < 0];
    }
    if (n.vrow !== undefined) return [n.vrow, n.moving ? Math.floor((n.d || 0) / 46) % 4 : 1, n.face < 0];
    if (n.still) return [n.still[0], n.still[1], n.face < 0];
    if (n.dogWalk) return [1, n.moving ? Math.floor((n.d || 0) / (n.height * 0.35)) % 4 : 1, n.face < 0];
    if (n.startled !== undefined) {                                             // pigeons
      if (n.startled) return [2, 2 + (Math.floor(sec * 9) % 2), n.face < 0];
      return [2, [0, 1, 0, 1][loopFrame([1.4, .35, .9, .35], sec + n.x * 0.01)], n.face < 0];
    }
    if (n.moving && n.run) return [1, Math.floor((n.d || 0) / (n.height * 0.3)) % 4, n.face < 0];
    if (n.run) return [2, loopFrame(LOOPS.idle.times, sec), false];               // catching their breath
    if (n.moving) return [n.carrying ? 1 : 0, Math.floor((n.d || 0) / (n.height * STRIDE)) % 4, n.face < 0];
    if (n.carrying) return [1, 1, n.face < 0];                                   // standing with the load
    const L = LOOPS[n.loop] || LOOPS.idle;
    const phase = L === LOOPS.idle ? n.id.length * 1.37 : 0;                    // blinks out of sync
    return [L.row, loopFrame(L.times, sec + phase), L.row === 2 ? false : n.face < 0];
  }
  function blit(ctx, sheetId, row, col, flip, height, x, y, depth) {
    const im = sheets[sheetId], L = SHEETS[sheetId]; if (!ok(im) || !L) return false;
    const k = height / L.src * (depth || 1);
    ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
    ctx.drawImage(im, col * L.cw, row * L.ch, L.cw, L.ch, -L.cw / 2 * k, -L.base * k, L.cw * k, L.ch * k);
    ctx.restore();
    return true;
  }
  // Feet at (n.x, n.y). `depth` is CityCore.depthScale at that spot.
  function draw(ctx, n, sec, depth) { const [row, col, flip] = frameOf(n, sec); return blit(ctx, n.sheet, row, col, flip, n.height, n.x, n.y - (n.lift || 0), depth); }

  // ---- the hero's work poses -------------------------------------------------------------------------
  // kind: hammer · carry · chop (heroA) · swing · mop · eat (heroB). Drawn with feet at (0,0) of the current
  // transform; o.height = the hero's visible standing height there; o.d = distance walked, for carry while moving.
  const HERO_POSE = Object.freeze({
    hammer: { sheet: 'heroA', row: 0, times: [.30, .14, .09, .24] }, carry: { sheet: 'heroA', row: 1 },
    chop:   { sheet: 'heroA', row: 2, times: [.22, .12, .16, .3] },
    swing:  { sheet: 'heroB', row: 0, times: [.42, .1, .22, .7] },  mop: { sheet: 'heroB', row: 1, times: [.4, .3, .32, .38] },
    eat:    { sheet: 'heroB', row: 2, times: [1.1, .6, .9, 1.2] },
    sleep:  { sheet: 'heroC', row: 0, times: [2.2, 1.6, 2.2, 1.4] },  bench: { sheet: 'heroC', row: 1, times: [1.8, 2.4, .5, 2.5] },
    tired:  { sheet: 'heroC', row: 2 },
    coach_old: { sheet: 'wagons', row: 0 },                              // v94 stand-in for the passenger coach
    coach: { sheet: 'coach', row: 0 }, ride_horse: { sheet: 'heroHorse', row: 0 }, ride_bike: { sheet: 'heroBike', row: 0 }, ride_scooter: { sheet: 'heroScooter', row: 0 },
    horse_parked: { sheet: 'heroHorse', row: 1, times: [2.4, 1.6, 3.2, 1.8] }
  });
  function heroReady(kind) { const P = HERO_POSE[kind]; return !!P && ok(sheets[P.sheet]); }
  function drawHero(ctx, kind, o) {
    const P = HERO_POSE[kind]; if (!P) return false;
    const col = P.times ? loopFrame(P.times, o.sec || 0) : o.moving ? Math.floor((o.d || 0) / (o.height * STRIDE)) % 4 : 1;
    return blit(ctx, P.sheet, P.row, col, (o.face || 1) < 0, o.height, 0, 0, 1);
  }
  // The hero carrying loads back and forth around a work spot (visual only; LifeSim keeps the spot).
  function heroShuttle(clock, A) { return shuttleAt(0, 0, A, 700, 0, 20, finiteClock(clock)); }

  // v84: work props standing on the street right where the hammer, ladle or washboard lands (the painted ones sit too deep).
  // h = height in world px (image scaled to it), x/foot = bottom centre, z = draw order among people (lower = further back).
  const PROPS = Object.freeze([
    { id: 'anvil',    x: 4751, foot: 803, z: 799, h: HERO * 0.5 },                    // the smith hammers it from the left
    { id: 'cauldron', x: 8012, foot: 812, z: 807, h: HERO * 0.46, zone: 'slum', fire: true }, // ป้าโรงทาน stirs from the left
    { id: 'tub',      x: 8418, foot: 816, z: 811, h: HERO * 0.34, zone: 'slum' }        // แม่ซักผ้า's washboard stands in it
  ]);
  const propImg = {};
  function propReady(id) {
    if (!hasImage) return false;
    if (!propImg[id]) { propImg[id] = new Image(); propImg[id].src = 'prop_' + id + '.webp?v=84'; }
    return ok(propImg[id]);
  }
  function drawProp(ctx, id, x, foot, h, t, fire) {
    if (!propReady(id)) return;
    const im = propImg[id], w = h * im.naturalWidth / im.naturalHeight;
    ctx.drawImage(im, x - w / 2, foot - h, w, h);
    if (fire) {                                                   // flickering firelight and steam
      const f = 0.55 + 0.25 * Math.sin(t * 0.017) + 0.2 * Math.sin(t * 0.041 + 1);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(x, foot - h * 0.18, 1, x, foot - h * 0.18, h * 0.45);
      gr.addColorStop(0, 'rgba(255,170,60,' + (0.45 * f).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,120,30,0)');
      ctx.fillStyle = gr; ctx.fillRect(x - h * 0.5, foot - h * 0.65, h, h * 0.65); ctx.restore();
      ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, h * 0.035); ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const k = ((t * 0.00045) + i / 3) % 1, sx = x + (i - 1) * h * 0.18;
        ctx.globalAlpha = Math.sin(k * Math.PI) * 0.4; ctx.beginPath();
        for (let j = 0; j <= 8; j++) { const q = j / 8, yy = foot - h * 0.95 - k * h * 0.6 - q * h * 0.4; ctx[j ? 'lineTo' : 'moveTo'](sx + Math.sin(q * 5 + t * 0.003 + i) * h * 0.06, yy); }
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  function props() { return PROPS; }

  return { blit, PEOPLE: ALL_PEOPLE, PATROLS, RESIDENT_LOOK, SHEETS, SHEET: SHEETS.teen, LOOPS, HERO_POSE,
    load, snapshots, frameOf, draw, drawHero, heroReady, heroShuttle, props, drawProp, propReady };
});
