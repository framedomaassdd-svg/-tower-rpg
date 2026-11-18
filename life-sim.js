/* Autonomous daily life for the summoned protagonist.
   Pure rules: the position on the street is a function of the town clock (0–20 = one day),
   so it stays correct when time speed changes or the game is reloaded mid-day. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LifeSim = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // street positions come from the painted town (town-pano.js); the fallback keeps Node simulations identical
  const PANO = (typeof globalThis !== 'undefined' && globalThis.TownPano) || null;
  // v93 the bag (bag.js); Node simulations load it with require
  const Bag = (typeof globalThis !== 'undefined' && globalThis.Bag) || (typeof require === 'function' ? require('./bag.js') : null);
  const PX = PANO ? PANO.PLACES : { tavern: 897, guild: 21258, compass: 21941, porter: 22646, tmerchant: 23358, tower: 24198, market: 16733, smith: 4847, inn: 5828, bench: 4171, tenement: 7440, soup: 8052, scrap: 10300, slumyard: 10014, cargo: 14050, stable: 13283, shrine: 11000, shack: 19666, bazaar: 17274, field: 11270, campfire: 11715, streetstall: 19029 };
  const PLACES = Object.freeze({
    inn:    { x: PX.inn, y: 792, name: 'โรงแรม' },
    smith:  { x: PX.smith, y: 792, name: 'โรงตีเหล็ก' },
    market: { x: PX.market, y: 792, name: 'ตลาดใหญ่' },
    guild:  { x: PX.guild, y: 792, name: 'กิลด์นักรบโล่เหล็ก' },
    // v103 ย่านกิลด์: the other three guilds and the way up into the tower
    compass: { x: PX.compass || 21941, y: 792, name: 'กิลด์นักสำรวจเข็มทิศเงิน' },
    porter: { x: PX.porter || 22646, y: 792, name: 'สมาคมคนแบกของ' },
    tmerchant: { x: PX.tmerchant || 23358, y: 792, name: 'กิลด์พ่อค้าหอคอย' },
    tower:  { x: PX.tower || 24198, y: 812, name: 'ประตูขึ้นหอคอย' },
    slumyard: { x: PX.slumyard || 10014, y: 792, name: 'ลานฝึกตรอก' },
    cargo:  { x: PX.cargo || 14050, y: 792, name: 'ลานเกวียน' },
    tavern: { x: PX.tavern, y: 792, name: 'ร้านอาหาร' },
    bench:  { x: PX.bench, y: 792, name: 'ม้านั่งในสวน' },
    tenement: { x: PX.tenement, y: 792, name: 'ห้องเช่าตรอก' },
    soup:   { x: PX.soup, y: 812, name: 'โรงทาน' },
    scrap:  { x: PX.scrap, y: 812, name: 'ลานของเก่า' },
    shrine: { x: PX.shrine || 11000, y: 792, name: 'ศาลเจ้าร้าง' },
    shack:  { x: PX.shack || 19666, y: 792, name: 'เพิงข้างกองขยะ' },
    // v93 places for the after-work order (ซื้อของ / ทำอาหาร / ตีเหล็ก / เก็บของ / ขายของ)
    bazaar: { x: PX.bazaar || 17274, y: 836, name: 'แผงในตลาดใหญ่' },
    stable: { x: PX.stable || 13283, y: 812, name: 'คอกม้าลานเกวียน' },
    field:  { x: PX.field || 11270, y: 812, name: 'ทุ่งนอกประตูเมือง' },
    campfire: { x: PX.campfire || 11715, y: 840, name: 'กองไฟคาราวาน' },
    streetstall: { x: PX.streetstall || 19029, y: 838, name: 'ร้านริมทางในตลาด' },
    // doors used for short errands after work (each has an interior in interiors.js)
    bakery: { x: 3521, y: 792, name: 'ร้านขนมปัง' },
    apothecary: { x: 5088, y: 792, name: 'ร้านยา' },
    guildhall: { x: PX.guild, y: 792, name: 'ห้องโถงกิลด์' },
    junk:   { x: 8932, y: 792, name: 'ร้านรับซื้อของเก่า' }
  });
  // place → room (interior) and what the errand is
  const ERRANDS = Object.freeze({
    bakery:     { place: 'bakery', room: 'bakery', act: 'รับค่าแรงที่ร้านขนมปัง', dur: 0.3 },
    guildhall:  { place: 'guildhall', room: 'guild', act: 'รายงานตัวที่ห้องโถงกิลด์', dur: 0.3 },
    junk:       { place: 'junk', room: 'junk', act: 'ขายของดีให้ร้านรับซื้อของเก่า', dur: 0.35 },
    apothecary: { place: 'apothecary', room: 'apothecary', act: 'ซื้อยาที่ร้านยา', dur: 0.4 }
  });
  const MEDICINE = { price: 3, health: 15 };
  const STREET_Y = 812;
  const SPEED = 2520;            // world px per clock unit (≈ a brisk walk at ×1)
  const WAKE = 5;                // 06:00
  const WORK_END = 40 / 3;       // 16:00
  const DINNER_UNTIL = 15;       // 18:00
  const DINNER_MIN = 0.42;       // at least ~30 game minutes at the table
  const CHECKIN = 0.22;          // a moment at the inn's front desk before going up
  // Inn rooms. The player sets a preference; if the money is short the character takes the best room it can pay for.
  const ROOMS = ({
    cheap: { name: 'ห้องประหยัด', price: 2,  energy: 80,  health: 0,  room: 'bed_cheap', desc: 'เตียงไม้กับผ้าห่มผืนเดียว ตื่นมาแรง 80' },
    mid:   { name: 'ห้องธรรมดา',  price: 5,  energy: 100, health: 5,  room: 'bed_mid',   desc: 'ห้องสะอาด นอนเต็มอิ่ม แรง 100 สุขภาพ +5' },
    luxe:  { name: 'ห้องหรู',     price: 12, energy: 100, health: 12, room: 'bed_luxe',  focus: 1.15, desc: 'เตียงสี่เสา แรง 100 สุขภาพ +12 และวันถัดไปจังหวะมินิเกมกว้างขึ้น' },
    // not at the inn: a room in the tenement in ตรอกล่าง
    slum:  { name: 'ห้องเช่าตรอก', price: 1,  energy: 65,  health: -3, room: null, place: 'tenement', desc: 'ห้องแคบอับชื้นในตึกเช่าท้ายตรอก 1 เหรียญ ตื่นมาแรง 65 สุขภาพ -3 ยังดีกว่านอนข้างถนน' },
    // v92: free shelters. Only used when chosen; being broke never sends the character this far (it falls back to the bench).
    shrine: { name: 'ศาลเจ้าร้าง', price: 0, energy: 70, health: -2, room: null, place: 'shrine', free: true, desc: 'ศาลเจ้าเก่าท้ายลานเกวียน นอนฟรีบนเสื่อกับหลวงตาเร่ร่อน ตื่นมาแรง 70 สุขภาพ -2 ใกล้งานกรรมกร' },
    shack:  { name: 'เพิงข้างกองขยะ', price: 0, energy: 60, health: -4, room: null, place: 'shack', free: true, desc: 'เพิงไม้ผุท้ายตลาดใหญ่ นอนฟรีแต่กลิ่นแรง ตื่นมาแรง 60 สุขภาพ -4 ใกล้งานในตลาด' }
  });
    // v105 a bed in your own guild (members only, chosen by hand); the place is your guild's hall
  ROOMS.gbed = Object.freeze({ name: 'ห้องพักกิลด์', price: 1, energy: 100, health: 4, room: null, place: 'guildbed', guild: true, desc: 'เตียงในกิลด์ของคุณ 1 เหรียญ ใกล้ประตูหอคอย ตื่นมาแรง 100 สุขภาพ +4 (เฉพาะสมาชิก)' });
  const ROOM_ORDER = ['luxe', 'mid', 'gbed', 'cheap', 'slum', 'shrine', 'shack'];
  const SHELTER = { shrine: 1, shack: 1 };
  // v105 guilds: which guild the current path belongs to, and whether the hero counts as a member there
  const GUILD_KEY = { guild: 'iron', compass: 'compass', porter: 'porter', tmerchant: 'merch' };
  const GUILD_NAME = { iron: 'กิลด์โล่เหล็ก', compass: 'กิลด์เข็มทิศเงิน', porter: 'สมาคมคนแบกของ', merch: 'กิลด์พ่อค้าหอคอย' };
  const KEY_PLACE = { iron: 'guild', compass: 'compass', porter: 'porter', merch: 'tmerchant' };
  function guildOf(st) {
    const L = st.life || {}, key = L.path === 'gchef' ? (KEY_PLACE[L.chefAt] ? L.chefAt : 'iron') : GUILD_KEY[L.path];
    if (!key) return null;
    const member = L.path === 'gchef' || L.path === 'porter' || (L.path === 'guild' && !!st.guild) || (L.path === 'compass' && !!st.compassMember) || (L.path === 'tmerchant' && !!st.merchMember);
    return { key, place: KEY_PLACE[key], member, name: GUILD_NAME[key] };
  }
  const placeKey = place => Object.keys(KEY_PLACE).find(k => KEY_PLACE[k] === place) || null;
  const gscene = (key, room) => 'g_' + key + '_' + room;              // Interiors scene id
  const TOWER_PATH = { guild: 1, compass: 1, porter: 1 };
  // v105 the quest board: how deep today's party goes (pay, injury risk and loot multiply)
  const QUESTS = Object.freeze({
    safe:   { name: 'คุ้มกันชั้นตื้น', pay: 0.7, risk: 0.4, loot: 0.5, desc: 'ค่าแรง ×0.7 แทบไม่เจ็บ ของน้อย' },
    normal: { name: 'สำรวจชั้นกลาง', pay: 1, risk: 1, loot: 1, desc: 'ค่าแรงปกติ' },
    deep:   { name: 'บุกชั้นลึก', pay: 1.5, risk: 2, loot: 2, desc: 'ค่าแรง ×1.5 เจ็บง่ายขึ้นสองเท่า ได้ของมากขึ้น' }
  });
  const questOf = st => QUESTS[st.life && st.life.quest] || QUESTS.normal;
  let PLAN_ST = null;                                     // the state dayPlan is planning (roomPlace needs the guild)
  const roomPlace = (id, st) => { const r = ROOMS[id]; if (!r) return 'inn'; if (r.guild) { const g = guildOf(st || PLAN_ST || {}); return g ? g.place : 'inn'; } return r.place || 'inn'; };
  const RENT = ROOMS.mid.price;

  const ORIGINS = Object.freeze([
    { id: 'office',  name: 'พนักงานบริษัท', stats: { strength: 2, agility: 3, intelligence: 6 }, money: 20, suggest: 'compass',
      perk: 'หัวไว: ปัญญาสูง ช่วยให้จังหวะมินิเกมกว้างขึ้นและอ่านสถานการณ์ในเหตุการณ์ได้ดีกว่า' },
    { id: 'chef',    name: 'พ่อครัว',       stats: { strength: 3, agility: 4, intelligence: 3 }, money: 15, suggest: 'kitchen',
      perk: 'ทำกับข้าวเป็น: ค่าอาหารเย็นถูกลง 1 เหรียญ ค่าแรงในครัว +3 และจังหวะหั่นผักกว้างกว่าคนอื่น' },
    { id: 'craft',   name: 'ช่างฝีมือ',      stats: { strength: 4, agility: 3, intelligence: 3 }, money: 15, suggest: 'smith',
      perk: 'มือช่าง: จังหวะในมินิเกมตีเหล็กกว้างกว่าคนอื่นมาก' },
    { id: 'jobless', name: 'คนว่างงาน',      stats: { strength: 3, agility: 3, intelligence: 3 }, money: 8,  suggest: 'market',
      perk: 'ทนลำบาก: ถ้าต้องนอนข้างนอก ก็ยังฟื้นแรงได้มากกว่าคนอื่น' }
  ]);
  const PATHS = Object.freeze({
    smith:  { name: 'ช่างตีเหล็กฝึกหัด', place: 'smith',  energy: 30, minigame: true, room: 'forge', act: 'ตีเหล็กในโรงตีเหล็ก',
              desc: 'ไปช่วยงานโรงตีเหล็กทุกวัน มีมินิเกมตีเหล็ก ค่าแรงขึ้นกับฝีมือ และอาวุธที่ตีจะถูกส่งไปให้นักสู้ในหอคอย' },
    guild:  { name: 'กิลด์นักรบโล่เหล็ก',   place: 'guild',  energy: 20,
              desc: 'ฝึกที่ลานกิลด์โล่เหล็กในย่านกิลด์ ยังไม่มีค่าแรงจนกว่าจะสอบผ่าน (กำลัง + คล่องตัว ≥ 8) แล้วเข้าหอคอยกับทีมนักรบ ค่าแรง 14 เหรียญ มีโอกาสบาดเจ็บ และบางวันได้ชิ้นส่วนมอนสเตอร์' },
    // v103 the other guilds of ย่านกิลด์
    compass: { name: 'กิลด์นักสำรวจเข็มทิศเงิน', place: 'compass', energy: 22,
              desc: 'ฝึกอ่านและวาดแผนที่ จนสอบผ่าน (ปัญญา ≥ 6) แล้วตามทีมสำรวจเข้าหอคอยไปทำแผนที่ ค่าแรง 6 + ปัญญา เหรียญ บางวันเก็บสมุนไพรหรือของแปลกกลับมา' },
    porter: { name: 'สมาคมคนแบกของ', place: 'porter', energy: 35,
              desc: 'ไม่ต้องสอบ แบกเสบียงตามทีมเข้าหอคอยแล้วแบกของกลับ ค่าแรงรอบละ 8 เหรียญ (+3 ถ้ากำลัง ≥ 6) งานหนักและเสี่ยงโดนมอนสเตอร์บ้าง ทุก 4 วันกำลัง +1' },
    gchef:  { name: 'พ่อครัวกิลด์', place: 'guild', energy: 25, minigame: true, act: 'ทำอาหารในครัวกิลด์',
              desc: 'ทำอาหารให้สมาชิกในครัวกิลด์ (เลือกกิลด์ได้) มีมินิเกมหั่นผัก ค่าแรง 5 + ดาว เหรียญ กินข้าวเย็นที่โรงอาหารกิลด์ฟรี และนอนห้องพักกิลด์ได้' },
    tmerchant: { name: 'กิลด์พ่อค้าหอคอย', place: 'tmerchant', energy: 15,
              desc: 'เริ่มเป็นลูกมือตีราคา ค่าแรง 4 เหรียญ ชื่อเสียงขึ้นทุกวัน เมื่อชื่อเสียงถึง 5 ได้เป็นนักตีราคา ค่าแรง 6 + ชื่อเสียง/2 เหรียญ (สูงสุด 12) และรับซื้อชิ้นส่วนมอนสเตอร์ราคาดี' },
    market: { name: 'รับจ้างที่ตลาด',     place: 'market', energy: 25,
              desc: 'ขนของให้แม่ค้า ค่าแรงไม่มาก แต่ได้อาหารติดมือกลับมาทุกวัน' },
    hotel:  { name: 'พนักงานโรงแรม',     place: 'inn',    energy: 20, room: 'laundry', act: 'ซักผ้าและจัดห้องพัก',
              desc: 'ซักผ้า ปูเตียง ถูพื้นในโรงแรม ค่าแรง 8 เหรียญ งานเบา และได้ส่วนลดค่าห้องครึ่งราคาทุกคืน' },
    kitchen:{ name: 'ผู้ช่วยครัว',         place: 'tavern', energy: 25, room: 'kitchen', act: 'ช่วยงานในครัว', minigame: true,
              desc: 'หั่นผักในครัวร้านอาหาร มีมินิเกมหั่นแครอท ค่าแรง 3 + ดาว (สูงสุด 12) ได้กินข้าวเย็นฟรีและอาหารติดมือ' },
    cargo:  { name: 'กรรมกรลานเกวียน',    place: 'cargo',  energy: 35,
              desc: 'ออกประตูเมืองไปแบกกระสอบลงจากเกวียนขึ้นโกดัง งานหนัก ค่าแรง 9 เหรียญ วันที่คาราวานพ่อค้าเข้าเมือง (ทุก 3 วัน) ได้เพิ่มอีก 4 เหรียญ และมีโอกาสกำลังเพิ่ม' },
    scrap:  { name: 'เก็บของเก่าในตรอก',  place: 'scrap',  energy: 25,
              desc: 'คัดของเก่าและเข็นของที่ลานท้ายตรอกล่าง ไม่ต้องสอบเข้า ค่าแรง 6 เหรียญ ทุก 4 วันจะเจอของดีขายให้ร้านรับซื้อได้อีก 5 เหรียญ' }
  });

  function originOf(st) { return ORIGINS.find(o => o.name === st.profession) || ORIGINS[3]; }

  function newLife(st, rng) {
    const r = typeof rng === 'function' ? rng : Math.random;
    const origin = ORIGINS[Math.floor(r() * ORIGINS.length)];
    st.profession = origin.name;
    Object.assign(st, origin.stats);
    st.money = origin.money; st.energy = 100; st.health = 100; st.food = 1; st.bag = []; if (Bag) Bag.add(st, 'ration', 1);
    st.life = { v: 1, origin: origin.id, age: 18 + Math.floor(r() * 28), path: origin.suggest, pendingPath: null,
      started: false, done: {}, sleptAt: 'inn', homeTonight: 'inn', roomPref: 'mid', roomSlept: 'mid', roomTonight: 'mid', focusDay: 0,
      restDay: 0, todayStars: null, workedDay: 0,
      seen: [], lastEventDay: 0, history: [] };
    return origin;
  }
  function ensure(st) {
    const L = st.life;
    if (!L || typeof L !== 'object') return false;
    if (!PATHS[L.path]) L.path = 'smith';
    if (!L.done || typeof L.done !== 'object') L.done = {};
    if (!Array.isArray(L.seen)) L.seen = [];
    if (!Array.isArray(L.history)) L.history = [];
    if (!PLACES[L.sleptAt]) L.sleptAt = 'inn';
    if (!PLACES[L.homeTonight]) L.homeTonight = 'inn';
    for (const k of ['roomPref', 'roomSlept', 'roomTonight']) if (!ROOMS[L[k]]) L[k] = 'mid';
    if (Bag) Bag.migrate(st);
    if (L.eatBag === undefined) L.eatBag = true;
    return true;
  }

  // ---- schedule ---------------------------------------------------------
  function stay(t0, t1, place, act, extra) {
    const p = PLACES[place];
    return Object.assign({ kind: 'stay', t0, t1, x0: p.x, x1: p.x, y: p.y, place, act, hidden: false }, extra || {});
  }
  function walk(t0, from, to, act) {
    const a = PLACES[from], b = PLACES[to], d = Math.abs(b.x - a.x) / SPEED;
    return { kind: 'walk', t0, t1: t0 + d, x0: a.x, x1: b.x, y: STREET_Y, place: to, act };
  }
  // ตรอกล่าง is its own scene, reached only through the alley at the east end of town: the hero walks up the
  // alley lane in town (camera zooms in), the scene cuts, and he walks down out of the lane on the slum side.
  const SLUM_PLACES = { tenement: 1, soup: 1, scrap: 1, junk: 1, slumyard: 1 };
  // v87: ลานเกวียน (outside the city) is a third scene, reached through the city gate: up the gate lane in town,
  // out of the outer gate on the yard side. Between the slum and the yard the hero crosses town.
  const CARTS_PLACES = { cargo: 1, shrine: 1, field: 1, campfire: 1, stable: 1 };
  // v90: ตลาดใหญ่ is a fourth scene, reached by the market lane off the main street.
  const MARKET_PLACES = { market: 1, shack: 1, bazaar: 1, streetstall: 1 };
  // v103: ย่านกิลด์ is a fifth scene, up the steps under the tower arch
  const GUILD_PLACES = { guild: 1, guildhall: 1, compass: 1, porter: 1, tmerchant: 1, tower: 1 };
  const zoneOf = place => SLUM_PLACES[place] ? 'slum' : CARTS_PLACES[place] ? 'carts' : MARKET_PLACES[place] ? 'market' : GUILD_PLACES[place] ? 'guild' : 'town';
  const LANE = Object.freeze({ x: 6836, top: 724, dur: 0.13 });   // dur: clock units per half (≈0.8 s at ×1)
  const CROSS = Object.freeze({ slum: { town: LANE.x, other: LANE.x, act: 'เดินเข้าตรอกล่าง' },
                                carts: { town: 328, other: 15046, act: 'ออกประตูเมืองไปลานเกวียน' },
                                market: { town: 1864, other: 15986, act: 'เดินเข้าตรอกตลาด' },
                                guild: { town: 2786, other: 20472, act: 'ขึ้นบันไดซุ้มหอคอยไปย่านกิลด์' } });
  // ---- v94 getting around: riding your own horse / bike / scooter, or the coach (รถม้าโดยสาร) on long stretches.
  // RIDE is set by dayPlan for the state being planned (route() has no state of its own).
  const COACH = Object.freeze({ town: [120, 1340, 4430, 6300], carts: [11290, 12160, 13720, 14620] });   // = the stop signs in town-pano
  const ROAD_Y = 896, ROAD_STEP = 0.035;   // the cobbled road below the sidewalk (wagons use 905)
  const COACH_SPEED = 3, COACH_WAIT = 0.1, COACH_FARE = 1, COACH_MIN = 1800;
  let RIDE = { mode: null, coach: false, n: 0 };
  function rideOf(st) {
    // fixed at wake so a change mid-walk never moves the hero; a change shows from the next morning
    const L = st.life || {}, V = (Bag && Bag.vehicles(st)) || {}, T = L.rideDay && L.rideDay.day === st.day ? L.rideDay : L;
    const mode = T.ride && V[T.ride] ? T.ride : null;
    const weak = mode === 'horse' && (V.horse.hungry || 0) >= 2;            // a hungry horse only trots
    return { mode, mult: mode ? (weak ? 1.6 : Bag.ITEMS[mode].speed) : 1, coach: !mode && !!T.coach, n: 0 };
  }
  const nearest = (list, x) => list.reduce((a, b) => Math.abs(b - x) < Math.abs(a - x) ? b : a);
  // one stretch along a street: walk, ride, or walk–wait–coach–walk
  function stretch(t, x0, x1, zone, to, act) {
    const R = RIDE, mk = (t0, a, b, v, extra) => Object.assign({ kind: 'walk', t0, t1: t0 + Math.abs(b - a) / v, x0: a, x1: b, y: STREET_Y, place: to, act, zone }, extra || {});
    // v96: anything on wheels or hooves uses the road, not the sidewalk: step down, ride along it, step back up
    const onRoad = (t0, a, b, v, ride, extra) => {
      const down = { kind: 'walk', t0, t1: t0 + ROAD_STEP, x0: a, x1: a, y: STREET_Y, y1: ROAD_Y, place: to, act, zone, ride };
      const along = mk(down.t1, a, b, v, Object.assign({ ride, y: ROAD_Y }, extra || {}));
      const up = { kind: 'walk', t0: along.t1, t1: along.t1 + ROAD_STEP, x0: b, x1: b, y: ROAD_Y, y1: STREET_Y, place: to, act: along.act, zone, ride };
      return [down, along, up];
    };
    if (R.mode) return Math.abs(x1 - x0) < 60 ? [mk(t, x0, x1, SPEED)] : onRoad(t, x0, x1, SPEED * R.mult, R.mode);
    const stops = COACH[zone];
    if (R.coach && stops && Math.abs(x1 - x0) >= COACH_MIN) {
      const sa = nearest(stops, x0), sb = nearest(stops, x1);
      if (sa !== sb && Math.abs(sb - sa) > Math.abs(x1 - x0) * 0.5) {
        const out = [], w1 = mk(t, x0, sa, SPEED); out.push(w1);
        const wait = { kind: 'stay', t0: w1.t1, t1: w1.t1 + COACH_WAIT, x0: sa, x1: sa, y: STREET_Y, place: to, act: 'รอรถม้าโดยสารที่ป้าย', zone, milestone: 'coach' + (++R.n) };
        const ride = onRoad(wait.t1, sa, sb, SPEED * COACH_SPEED, 'coach', { act: 'นั่งรถม้าโดยสาร' });
        out.push(wait, ...ride, mk(ride[2].t1, sb, x1, SPEED));
        return out;
      }
    }
    return [mk(t, x0, x1, SPEED)];
  }
  function route(t0, from, to, act) {
    const za = zoneOf(from), zb = zoneOf(to);
    const a = PLACES[from], b = PLACES[to], segs = [];
    if (za === zb) return stretch(t0, a.x, b.x, za, to, act);
    const leg = (t, x0, x1, zone) => { const l = stretch(t, x0, x1, zone, to, act); segs.push(...l.slice(0, -1)); return l[l.length - 1]; };
    const hops = [za, 'town', zb].filter((z, i, l) => i === 0 || z !== l[i - 1]);
    let x = a.x, t = t0;
    for (let i = 1; i < hops.length; i++) {
      const p = hops[i - 1], q = hops[i], c = CROSS[p === 'town' ? q : p];
      const px = p === 'town' ? c.town : c.other, qx = q === 'town' ? c.town : c.other;
      const say = q === 'town' ? 'เดินกลับเข้าเมือง' : c.act;
      const w = leg(t, x, px, p); segs.push(w);
      const into = { kind: 'lane', lane: 'in', t0: w.t1, t1: w.t1 + LANE.dur, x0: px, x1: px, y: STREET_Y, y1: LANE.top, place: to, act: say, zone: p };
      const out = { kind: 'lane', lane: 'out', t0: into.t1, t1: into.t1 + LANE.dur, x0: qx, x1: qx, y: LANE.top, y1: STREET_Y, place: to, act: say, zone: q };
      segs.push(into, out); x = qx; t = out.t1;
    }
    segs.push(leg(t, x, b.x, zb));
    return segs;
  }
  const end = segs => segs[segs.length - 1];
  const WORK_ACT = { cargo: 'แบกกระสอบขึ้นโกดังที่ลานเกวียน', smith: 'ช่วยงานในโรงตีเหล็ก', guild: 'ฝึกที่ลานฝึกกิลด์', market: 'ขนของในตลาด', scrap: 'คัดของเก่าในลานท้ายตรอก' };
  // Dinner: the restaurant, or the soup kitchen when there is no money for a meal. Fixed once dinner has happened.
  const GUILD_MEAL = 2;                                   // v105 members eat in their guild's dining hall
  function dinnerPrice(st) { return st.life.path === 'kitchen' || st.life.path === 'gchef' ? 0 : originOf(st).id === 'chef' ? 3 : 4; }
  function dinnerPlace(st) {
    const L = st.life;
    if (L.dinnerAt && L.dinnerAt.day === st.day) return L.dinnerAt.place;
    const food = Bag ? Bag.meals(st) : 0;
    if (L.eatBag && food > 0 && L.path !== 'kitchen' && L.path !== 'gchef') return 'bag';           // v93: eat what's in the bag first
    const G = guildOf(st);
    if (G && G.member && (L.path === 'gchef' || st.money >= GUILD_MEAL)) return 'gdine';
    return st.money >= dinnerPrice(st) ? 'tavern' : food > 0 ? 'bag' : 'soup';
  }
  function dayPlan(st) {
    RIDE = rideOf(st); PLAN_ST = st;
    const L = st.life, today = L.dayStart && L.dayStart.day === st.day ? L.dayStart : { place: L.sleptAt, room: L.roomSlept };
    // v85: guild training happens inside a training yard — the guild's behind the tower arch, or (waking in the slum) the alley yard
    let path = PATHS[L.path];
    if (L.path === 'guild') path = today.place === 'tenement'
      ? Object.assign({}, path, { place: 'slumyard', room: 'slumyard', act: 'ฝึกร่างกายที่ลานฝึกตรอก' })
      : Object.assign({}, path, { room: 'yard', act: st.guild ? 'ซ้อมกับครูฝึกที่ลานฝึกกิลด์' : 'ฝึกที่ลานฝึกกิลด์' });
    if (L.path === 'guild' && st.guild && today.place !== 'tenement') path = Object.assign({}, path, { place: 'tower', room: null, inside: true, act: 'เข้าหอคอยกับทีมนักรบโล่เหล็ก' });
    if (L.path === 'compass') path = st.compassMember ? Object.assign({}, path, { place: 'tower', inside: true, act: 'ตามทีมสำรวจเข้าไปทำแผนที่ในหอคอย' })
      : Object.assign({}, path, { inside: true, act: 'ฝึกอ่านแผนที่ในกิลด์เข็มทิศเงิน' });
    if (L.path === 'porter') path = Object.assign({}, path, { place: 'tower', inside: true, act: 'แบกเสบียงตามทีมเข้าหอคอย' });
    if (L.path === 'tmerchant') path = Object.assign({}, path, { inside: true, act: st.merchMember ? 'ตีราคาของจากหอคอยในกิลด์พ่อค้า' : 'เป็นลูกมือตีราคาในกิลด์พ่อค้า' });
    const G = guildOf(st);
    if (L.path === 'compass' && !st.compassMember) path = Object.assign({}, path, { room: gscene('compass', 'hall'), act: 'ฝึกอ่านแผนที่ที่โถงกิลด์เข็มทิศเงิน' });
    if (L.path === 'gchef') path = Object.assign({}, path, { place: G.place, room: gscene(G.key, 'kitchen'), act: 'ทำอาหารในครัว' + G.name });
    const work = path.place;
    const start = today.place, bed = ROOMS[today.room] || ROOMS.mid;
    const asleep = place => place === 'inn' ? 'นอนหลับอยู่ในโรงแรม' : place === 'tenement' ? 'นอนในห้องเช่าตรอก' : SHELTER[place] ? 'นอนหลับใน' + PLACES[place].name : placeKey(place) ? 'นอนในห้องพัก' + GUILD_NAME[placeKey(place)] : 'นอนบนม้านั่งในสวน';
    const inBed = (place, room) => place === 'inn' ? { hidden: true, room: room.room, sleep: true } : place === 'tenement' ? { hidden: true, sleep: true, room: 'tenement' }
      : SHELTER[place] ? { lie: true, shelter: place } : placeKey(place) ? { hidden: true, sleep: true, room: gscene(placeKey(place), 'bed') } : { lie: true };
    const segs = [stay(0, WAKE, start, asleep(start), Object.assign(inBed(start, bed), { milestoneEnd: 'wake' }))];
    if (L.restDay === st.day) {
      segs.push(stay(WAKE, 20, start, 'ป่วย พักฟื้นทั้งวัน', Object.assign(inBed(start, bed), { rest: true, milestones: [['rest', 12], ['home', 17]] })));
      return segs;
    }
    // v105 tower days start at the guild's quest board: take today's job, then up to the tower with the party
    let w0 = { t1: WAKE }, wfrom = start;
    if (TOWER_PATH[L.path] && G && G.member && work === 'tower') {
      const toHall = end(route(WAKE, start, G.place, 'เดินไป' + G.name).map(x => (segs.push(x), x)));
      const board = stay(toHall.t1, toHall.t1 + 0.22, G.place, 'รับภารกิจ "' + questOf(st).name + '" จากกระดาน', { room: gscene(G.key, 'hall'), hidden: true });
      segs.push(board); w0 = board; wfrom = G.place;
    }
    const w = end(route(w0.t1, wfrom, work, 'เดินไป' + (path.room === 'laundry' ? 'ทำงานที่โรงแรม' : PLACES[work].name)).map(x => (segs.push(x), x)));
    const atWork = stay(w.t1, Math.max(w.t1 + 0.3, WORK_END), work, path.act || WORK_ACT[L.path],
      { milestone: 'work', room: path.room || null, hidden: !!(path.room || path.inside), working: true });
    segs.push(atWork);
    let from = work, free = atWork.t1;
    // v105 called to the guild master's office (decided at wake)
    if (G && L.talk && L.talk.day === st.day && EVENTS[L.talk.ev]) {
      const go = end(route(free, from, G.place, 'หัวหน้ากิลด์เรียกพบ').map(x => (segs.push(x), x)));
      const at = stay(go.t1, go.t1 + 0.35, G.place, 'คุยกับหัวหน้ากิลด์ในห้องทำงาน', { milestone: 'gtalk', room: gscene(G.key, 'office'), hidden: true });
      segs.push(at); from = G.place; free = at.t1;
    }
    const O = orderToday(st), plan = O ? orderStops(st, O) : null;
    let E = !plan && L.errand && L.errand.day === st.day && ERRANDS[L.errand.kind];
    if (!plan && L.errand && L.errand.day === st.day && L.errand.kind === 'gstore' && G)
      E = { place: G.place, room: gscene(G.key, 'store'), act: 'ฝากและรับของที่ห้องเก็บของ' + G.name, dur: 0.3 };
    if (plan) {
      plan.stops.forEach((p, i) => {
        const go = end(route(free, from, p.place, 'เดินไป' + PLACES[p.place].name).map(x => (segs.push(x), x)));
        const at = stay(go.t1, go.t1 + p.dur, p.place, p.act, { milestone: i ? 'errand2' : 'errand', room: p.room || null, hidden: !!p.room, task: p.task || null });
        if (p.task === 'cook') at.milestones = [['cook', go.t1 + p.dur * 0.8]];
        segs.push(at); from = p.place; free = at.t1;
      });
    }
    if (E) {
      const go = end(route(free, from, E.place, 'เดินไป' + PLACES[E.place].name).map(x => (segs.push(x), x)));
      const at = stay(go.t1, go.t1 + E.dur, E.place, E.act, { milestone: 'errand', room: E.room, hidden: true });
      segs.push(at); from = E.place; free = at.t1;
    }
    const eatAt = plan && plan.cooked ? 'cooked' : dinnerPlace(st), soup = eatAt === 'soup';
    let dinner;
    if (eatAt === 'cooked' || eatAt === 'bag') {                       // ate what was just cooked, or out of the bag, right where they are
      dinner = stay(free, Math.max(free + DINNER_MIN, Math.min(DINNER_UNTIL, free + 0.6)), from,
        eatAt === 'cooked' ? 'กินข้าวที่ทำเอง' : 'นั่งกินของในกระเป๋า', { milestone: 'dinner', eating: true, task: 'eat' });
    } else {
      const gd = eatAt === 'gdine', dest = gd ? G.place : eatAt;
      const toTavern = end(route(free, from, dest, soup ? 'ไม่มีเงินกินข้าว เดินไปโรงทาน' : gd ? 'เดินไปโรงอาหารกิลด์' : 'เดินไปกินข้าวเย็น').map(x => (segs.push(x), x)));
      dinner = stay(toTavern.t1, Math.max(toTavern.t1 + DINNER_MIN, DINNER_UNTIL), dest, soup ? 'รับซุปฟรีที่โรงทาน' : gd ? 'กินข้าวเย็นที่โรงอาหาร' + G.name : 'กินข้าวเย็นที่ร้านอาหาร',
        { milestone: 'dinner', room: soup ? 'soup' : gd ? gscene(G.key, 'dining') : 'restaurant', hidden: true, eating: true });
      from = dest;
    }
    segs.push(dinner);
    const home = L.homeTonight, tonight = ROOMS[L.roomTonight] || ROOMS.mid;
    const back = end(route(dinner.t1, from, home, home === 'inn' ? 'เดินกลับโรงแรม' : home === 'tenement' ? 'เดินกลับห้องเช่าในตรอก' : SHELTER[home] ? 'เดินไปนอนที่' + PLACES[home].name : placeKey(home) ? 'เดินกลับห้องพักกิลด์' : 'ไม่มีค่าห้อง เดินไปหาม้านั่ง').map(x => (segs.push(x), x)));
    if (home === 'inn') {
      const desk = stay(back.t1, back.t1 + CHECKIN, 'inn', 'รับกุญแจที่ล็อบบี้', { milestone: 'home', room: 'lobby', hidden: true });
      segs.push(desk, stay(desk.t1, 20, 'inn', asleep('inn'), inBed('inn', tonight)));
    } else if (home === 'tenement') segs.push(stay(back.t1, 20, 'tenement', asleep('tenement'), { hidden: true, sleep: true, room: 'tenement', milestone: 'home' }));
    else if (SHELTER[home]) segs.push(stay(back.t1, 20, home, asleep(home), { lie: true, shelter: home, milestone: 'home' }));
    else if (placeKey(home)) segs.push(stay(back.t1, 20, home, asleep(home), { hidden: true, sleep: true, room: gscene(placeKey(home), 'bed'), milestone: 'home' }));
    else segs.push(stay(back.t1, 20, 'bench', asleep('bench'), { lie: true, milestone: 'home' }));
    for (const s of segs) { s.t0 = Math.min(s.t0, 19.99); s.t1 = Math.min(s.t1, 20); }
    return segs;
  }
  function milestones(st) {
    const list = [];
    for (const s of dayPlan(st)) {
      if (s.milestoneEnd) list.push([s.milestoneEnd, s.t1]);
      if (s.milestone) list.push([s.milestone, s.t0]);
      if (s.milestones) for (const m of s.milestones) list.push(m);
    }
    return list.sort((a, b) => a[1] - b[1]);
  }
  function due(st, clock) {
    const L = st.life;
    return milestones(st).filter(([k, t]) => t <= clock + 1e-9 && L.done[k] !== st.day).map(([k]) => k);
  }
  function sample(st, clock) {
    const c = clamp(Number.isFinite(clock) ? clock : 0, 0, 19.999);
    const segs = dayPlan(st);
    let s = segs[segs.length - 1];
    for (const seg of segs) if (c >= seg.t0 && c < seg.t1) { s = seg; break; }
    const f = s.kind !== 'stay' && s.t1 > s.t0 ? clamp((c - s.t0) / (s.t1 - s.t0), 0, 1) : 0;
    const x = s.x0 + (s.x1 - s.x0) * f, y = s.y1 !== undefined ? s.y + (s.y1 - s.y) * f : s.y;
    return { x, y, hidden: !!s.hidden, moving: s.kind !== 'stay', face: s.x1 > s.x0 ? 1 : s.x1 < s.x0 ? -1 : 0,
      zone: s.zone || zoneOf(s.place), lane: s.lane || null, laneT: s.kind === 'lane' ? f : 0,
      act: s.act, place: PLACES[s.place].name, anim: c * 30,
      task: s.task || null, ride: s.ride || null, room: s.room || null, sleep: !!s.sleep, rest: !!s.rest, lie: !!s.lie, shelter: s.shelter || null, working: !!s.working, eating: !!s.eating };
  }

  // ---- daily effects ----------------------------------------------------
  const say = (st, msg) => { if (typeof st._log === 'function') st._log(msg); return msg; };
  function tolerance(st) {
    const o = originOf(st);
    const rested = st.life && st.life.focusDay === st.day ? ROOMS.luxe.focus : 1;
    return (1 + 0.05 * (clamp(st.intelligence || 3, 1, 12) - 3)) * (o.id === 'craft' ? 1.4 : 1) * rested;
  }
  function applyWake(st) {
    const L = st.life, o = originOf(st);
    if (L.chefNext) { L.chefAt = L.chefNext; L.chefNext = null; }
    if (L.pendingPath && PATHS[L.pendingPath]) { L.path = L.pendingPath; L.pendingPath = null; say(st, 'เริ่มแนวทางใหม่: ' + PATHS[L.path].name); }
    if (L.sleptAt === 'inn' || L.sleptAt === 'tenement' || SHELTER[L.sleptAt] || placeKey(L.sleptAt)) {
      const room = ROOMS[L.roomSlept] || ROOMS.mid;
      st.energy = Math.max(st.energy, room.energy); st.health = clamp(st.health + room.health, 1, 100);
      if (room.focus) L.focusDay = st.day;
    } else st.energy = Math.max(st.energy, o.id === 'jobless' ? 80 : 50);
    L.rideDay = { day: st.day, ride: L.ride || null, coach: !!L.coach };
    L.todayStars = null; L.dayStart = { day: st.day, place: L.sleptAt, room: L.roomSlept }; L.homeTonight = 'inn'; L.roomTonight = L.roomPref;
    L.errand = { day: st.day, kind: pickErrand(st) };
    // v105 does the guild master call you in after work today? (fixed at wake so the day's walk never changes)
    const G = guildOf(st), gev = GUILD_EVENT[L.path];
    L.talk = null;
    if (G && gev && (L.path !== 'guild' || st.guild) && st.day - (L.lastEventDay || 0) >= 2 && roll(st, 9) < (L.seen.includes(gev) ? 0.2 : 0.6)) L.talk = { day: st.day, ev: gev };
    if (st.health < 30) { L.restDay = st.day; return say(st, 'ร่างกายไม่ไหว (สุขภาพ ' + st.health + ') วันนี้ขอพักฟื้น'); }
    return null;
  }
  // One short stop between work and dinner, fixed at wake so the day's plan never shifts under the hero.
  function pickErrand(st) {
    const L = st.life;
    if (st.health < 60 && st.money >= MEDICINE.price) return 'apothecary';
    if (L.path === 'scrap' && ((st.scrapWork || 0) + 1) % 4 === 0) return 'junk';
    if (L.path === 'market') return 'bakery';
    if (L.stashReq && guildOf(st) && guildOf(st).member) return 'gstore';
    return null;
  }
  // v105 the guild's storeroom: a locked chest that holds what the bag can't
  function stashNow(st) {
    const L = st.life, how = L.stashReq; L.stashReq = null;
    if (!Bag || !how) return null;
    const n = how === 'in' ? Bag.deposit(st) : Bag.withdraw(st);
    return say(st, how === 'in' ? 'ฝากของ ' + n + ' ชิ้นไว้ในหีบของกิลด์' : 'รับของ ' + n + ' ชิ้นคืนจากหีบของกิลด์');
  }
  function requestStash(st, how, clock) {
    const L = st.life; L.stashReq = how;
    if (clock < WORK_END && (!L.errand || L.errand.day !== st.day || !L.errand.kind)) { L.errand = { day: st.day, kind: 'gstore' }; return st.day; }
    return st.day + 1;
  }
  function applyErrand(st, which) {
    if (orderToday(st)) return applyOrder(st, which || 'errand');
    const L = st.life, k = L.errand && L.errand.day === st.day ? L.errand.kind : null;
    if (k === 'apothecary') {
      if (st.money < MEDICINE.price) return say(st, 'ไปถึงร้านยาแต่เงินไม่พอซื้อยา');
      st.money -= MEDICINE.price; st.health = Math.min(100, st.health + MEDICINE.health);
      return say(st, 'ซื้อยาบำรุงจากหมอยา ' + MEDICINE.price + ' เหรียญ (สุขภาพ +' + MEDICINE.health + ')');
    }
    if (k === 'junk') return say(st, 'เอาของดีจากกองขยะไปขายที่ร้านรับซื้อของเก่า');
    if (k === 'bakery') return say(st, 'แวะรับค่าแรงจากแม่ค้าในร้านขนมปัง');
    if (k === 'gstore') return stashNow(st);
    if (k === 'guildhall') return say(st, 'รายงานตัวที่ห้องโถงกิลด์ ดูใบประกาศงานบนกระดาน');
    return null;
  }
  // ---- v93 the after-work order (ธุระหลังเลิกงาน) ---------------------------------------------
  // L.order = { kind, day, repeat, ... }. It counts for a day if set for it (or standing). Set before the work
  // ends it already counts today: only the after-work part of the plan changes, never where the hero is now.
  function orderToday(st) {
    const O = st.life && st.life.order;
    if (!O || !Bag) return null;
    return O.day === st.day || (O.repeat && O.day <= st.day) ? O : null;
  }
  function stovePlace(st, O) {
    const home = roomPlace(pickRoom(st) || 'mid', st);
    if ((!O.stove || O.stove === 'home') && Bag.HOME_STOVE[home]) return { place: home, name: Bag.HOME_STOVE[home], fee: 0 };
    const S = Bag.STOVES[O.stove] || Bag.STOVES.tavern;
    return { place: S.place, name: S.name, fee: st.life.path === 'kitchen' && S.place === 'tavern' ? 0 : S.fee, room: S.room };
  }
  // the stops an order adds after work; cooked = dinner is what got cooked
  function orderStops(st, O) {
    const stops = [];
    if (O.kind === 'buy') {
      const S = Bag.SHOPS[O.shop]; if (!S) return null;
      stops.push({ place: S.place, dur: 0.25, act: 'ซื้อของที่' + S.name, room: S.place === 'bakery' ? 'bakery' : S.place === 'smith' ? 'forge' : null, task: 'buy' });
      return { stops };
    }
    if (O.kind === 'cook') {
      const R = Bag.RECIPES[O.recipe]; if (!R) return null;
      const need = Bag.missing(st, R.needs), stove = stovePlace(st, O);
      if (Object.keys(need.items).length) stops.push({ place: 'bazaar', dur: 0.2, act: 'ซื้อวัตถุดิบในตลาด', task: 'buy' });
      stops.push({ place: stove.place, dur: 0.45, act: 'ทำ' + Bag.name(O.recipe) + 'ที่' + stove.name, task: 'cook',
        room: stove.room || (stove.place === 'tenement' ? 'tenement' : null) });
      return { stops, cooked: true };
    }
    if (O.kind === 'forge') {
      if (!Bag.FORGE[O.item]) return null;
      stops.push({ place: 'smith', dur: 0.6, act: 'ตี' + Bag.name(O.item) + 'เองในโรงตีเหล็ก', room: 'forge', task: 'forge' });
      return { stops };
    }
    if (O.kind === 'gather') {
      const G = Bag.GATHER[O.spot]; if (!G) return null;
      stops.push({ place: G.place, dur: 0.7, act: G.name, task: 'gather' });
      return { stops };
    }
    if (O.kind === 'sell') {
      const B = Bag.BUYERS[O.buyer]; if (!B) return null;
      stops.push({ place: B.place, dur: 0.2, act: 'เอาของไปขายที่' + B.name, room: ({ junk: 'junk', apothecary: 'apothecary', smith: 'forge' })[O.buyer] || null, task: 'sell' });
      return { stops };
    }
    return null;
  }
  function buyList(st, shop, wants) {               // buys what it can afford and carry; returns [[id, n], ...]
    const S = Bag.SHOPS[shop], got = [];
    for (const [id, n0] of Object.entries(wants || {})) {
      const price = S && S.items[id]; if (!price) continue;
      let n = 0; while (n < n0 && st.money >= price && Bag.add(st, id, 1)) { st.money -= price; n++; }
      if (n) got.push([id, n]);
    }
    return got;
  }
  function orderDone(st) { const L = st.life; if (L.order && !L.order.repeat && L.order.day === st.day) L.order.doneDay = st.day; }
  // milestone 'errand' / 'errand2' / 'cook' while an order runs
  function applyOrder(st, k) {
    const L = st.life, O = orderToday(st); if (!O) return null;
    if (O.kind === 'buy') {
      const got = buyList(st, O.shop, O.items); orderDone(st);
      const ride = got.some(([id]) => Bag.ITEMS[id].kind === 'vehicle');
      return say(st, got.length ? 'ซื้อ' + Bag.label(got) + (ride ? ' เลือกใช้ได้ในส่วนการเดินทาง' : ' ใส่กระเป๋า') + ' (เหลือเงิน ' + st.money + ')' : 'เงินไม่พอหรือกระเป๋าเต็ม ซื้ออะไรไม่ได้');
    }
    if (O.kind === 'cook') {
      const R = Bag.RECIPES[O.recipe];
      if (k === 'errand') {                            // the market stop on the way
        const want = Bag.missing(st, R.needs).items; if (!Object.keys(want).length) return null;
        const got = buyList(st, 'bazaar', want);
        return say(st, got.length ? 'ซื้อวัตถุดิบ ' + Bag.label(got) : 'เงินไม่พอซื้อวัตถุดิบ');
      }
      if (k !== 'cook') return null;
      const stove = stovePlace(st, O); orderDone(st);
      if (!Bag.has(st, R.needs)) { L.dinnerAt = null; return say(st, 'วัตถุดิบไม่ครบ ทำ' + Bag.name(O.recipe) + 'ไม่ได้'); }
      if (st.money < stove.fee) return say(st, 'ไม่มีเงินค่ายืมเตา');
      st.money -= stove.fee;
      for (const [id, n] of Object.entries(R.needs)) Bag.take(st, id, n);
      const portions = R.makes + (Bag.count(st, 'knife') ? 1 : 0);
      const kept = Bag.add(st, O.recipe, portions - 1);   // one is eaten now
      L.fedDay = st.day; L.dinnerAt = { day: st.day, place: 'cooked' };
      const heal = Bag.ITEMS[O.recipe].heal || 0; st.health = Math.min(100, st.health + heal);
      return say(st, 'ทำ' + Bag.name(O.recipe) + 'ที่' + stove.name + (stove.fee ? ' (ค่าเตา ' + stove.fee + ')' : '') + ' กินไป 1 ที่ สุขภาพ +' + heal + (kept ? ' · เก็บใส่กระเป๋าอีก ' + kept + ' ที่' : ''));
    }
    if (O.kind === 'forge') {
      const need = Bag.FORGE[O.item], fee = L.path === 'smith' ? 0 : Bag.FORGE_FEE; orderDone(st);
      if (Bag.ITEMS[O.item].kind === 'vehicle' && Bag.vehicles(st)[O.item]) return say(st, 'มี' + Bag.name(O.item) + 'อยู่แล้ว');
      const short = (need.iron || 0) - Bag.count(st, 'iron');
      if (short > 0) buyList(st, 'smith', { iron: short });
      const lack = Object.entries(need).filter(([id, n]) => Bag.count(st, id) < n).map(([id, n]) => [id, n - Bag.count(st, id)]);
      if (lack.length) return say(st, 'ของไม่ครบ ขาด ' + Bag.label(lack) + (lack.some(([id]) => id !== 'iron') ? ' (หาได้ที่ลานของเก่าหรือร้านรับซื้อของเก่า)' : ''));
      if (st.money < fee) return say(st, 'ไม่มีเงินค่าเช่าเตาหลอม ' + fee + ' เหรียญ');
      st.money -= fee; st.energy = Math.max(0, st.energy - 12); for (const [id, n] of Object.entries(need)) Bag.take(st, id, n);
      const odds = clamp(0.6 + 0.03 * (st.smithWork || 0) + 0.02 * (st.strength || 3), 0.6, 0.95);
      if (Math.random() > odds) return say(st, 'ตี' + Bag.name(O.item) + 'พลาด ของเสียหายไปหมด (โอกาสสำเร็จ ' + Math.round(odds * 100) + '%)');
      if (!Bag.add(st, O.item, 1)) return say(st, 'ตี' + Bag.name(O.item) + 'เสร็จ แต่กระเป๋าเต็ม ต้องทิ้งไว้ที่โรงตีเหล็ก');
      return say(st, 'ตี' + Bag.name(O.item) + 'เองสำเร็จ' + (fee ? ' (ค่าเตา ' + fee + ')' : '') + ' · ' + (Bag.ITEMS[O.item].desc || 'ขายได้ ' + Bag.ITEMS[O.item].sell + ' เหรียญ'));
    }
    if (O.kind === 'gather') {
      const G = Bag.GATHER[O.spot], got = []; orderDone(st);
      st.energy = Math.max(0, st.energy - 10);
      G.loot.forEach(([id, a, b, chance], i) => {
        if (chance && Math.random() > chance) return;
        let n = a + Math.floor(Math.random() * (b - a + 1)) + (i === 0 && Bag.count(st, G.tool) ? 1 : 0);
        n = Bag.add(st, id, n); if (n) got.push([id, n]);
      });
      return say(st, got.length ? G.name + ' ได้ ' + Bag.label(got) : 'กระเป๋าเต็ม เก็บอะไรไม่ได้');
    }
    if (O.kind === 'sell') {
      const B = Bag.BUYERS[O.buyer], sold = []; let money = 0; orderDone(st);
      for (const id of B.takes) { const n = Bag.count(st, id); if (n) { Bag.take(st, id, n); money += n * Bag.ITEMS[id].sell; sold.push([id, n]); } }
      st.money += money;
      return say(st, sold.length ? 'ขาย ' + Bag.label(sold) + ' ให้' + B.name + ' ได้ ' + money + ' เหรียญ' : B.name + 'ไม่รับซื้ออะไรในกระเป๋า');
    }
    return null;
  }
  function applyCoach(st) {                          // the fare, paid when the coach comes
    const L = st.life;
    if (st.money >= COACH_FARE + (L.coachDebt || 0)) { st.money -= COACH_FARE + (L.coachDebt || 0); L.coachDebt = 0; return null; }
    L.coachDebt = (L.coachDebt || 0) + COACH_FARE;
    return say(st, 'ไม่มีเงินค่ารถม้า คนขับให้ติดไว้ก่อน (ค้าง ' + L.coachDebt + ' เหรียญ)');
  }
  function setOrder(st, O, clock) {                  // today if the work isn't over yet, otherwise tomorrow
    const L = st.life;
    if (!O) { L.order = null; return null; }
    const today = !L.done || L.done.errand !== st.day && L.done.dinner !== st.day && (clock === undefined || clock < WORK_END - 0.05);
    L.order = Object.assign({}, O, { day: today ? st.day : st.day + 1 });
    return L.order.day;
  }
  // night rollover (called by the town right after the day number goes up): spoil, then make sure they ate
  function night(st) {
    if (!Bag) return [];
    const L = st.life || {}, msgs = [], V = Bag.vehicles(st);
    if (V.horse) {                                     // the horse eats every day
      if (st.money >= 1) { st.money -= 1; V.horse.hungry = 0; }
      else if (++V.horse.hungry >= 4) { delete V.horse; if (L.ride === 'horse') L.ride = null; msgs.push('ไม่มีเงินซื้ออาหารม้ามาหลายวัน ม้าหนีออกจากคอกไปแล้ว'); }
      else msgs.push('ไม่มีเงินซื้ออาหารม้า ม้าหิว' + (V.horse.hungry >= 2 ? ' วิ่งช้าลง' : ''));
    }
    const gone = Bag.spoil(st, st.day);
    if (gone.length) msgs.push(Bag.label(gone) + ' เสียแล้ว ต้องทิ้ง');
    if (L.fedDay !== st.day - 1) {
      const id = Bag.eat(st);
      if (id) msgs.push('ไม่ได้กินข้าวเย็น เลยกิน' + Bag.name(id) + 'จากกระเป๋าก่อนนอน');
      else { st.health = Math.max(1, st.health - 5); msgs.push('ไม่มีอาหาร สุขภาพลดลง 5'); }
    }
    return msgs;
  }

  // v103 a repeatable 0–1 roll per day (so a reload never re-rolls the day's luck)
  function roll(st, k) { const x = Math.sin((st.day || 1) * 12.9898 + k * 78.233 + (st.life && st.life.age || 0) * 3.7) * 43758.5453; return x - Math.floor(x); }
  function payWork(st, wage, core, ordinary) {
    const w = core && core.workWage ? core.workWage(wage, st.taxDue || 0, ordinary) : wage;
    st.money += w; st.work = (st.work || 0) + 1; st.jobDay = st.day; st.life.workedDay = st.day;
    return w;
  }
  function applyWork(st, core) {
    const L = st.life, path = PATHS[L.path], Q = questOf(st);
    if (L.path === 'gchef') return finishKitchen(st, 5, core, true);   // without the minigame (Node sims): an average day
    const tired = st.energy < path.energy;
    st.energy = Math.max(0, st.energy - path.energy);
    if (L.path === 'market') {
      const w = payWork(st, tired ? 4 : 8, core, true);
      if (Bag) Bag.add(st, 'ration'); else st.food++; st.marketWork = (st.marketWork || 0) + 1; st.rep = (st.rep || 0) + 1;
      return say(st, (tired ? 'เหนื่อยจนทำได้ครึ่งวัน ' : '') + 'ขนของในตลาด ได้ ' + w + ' เหรียญ และอาหาร 1 ชุด');
    }
    if (L.path === 'guild') {
      if (!st.guild) {
        const key = st.strength <= st.agility ? 'strength' : 'agility';
        if (!tired && st[key] < 12) st[key]++;
        const label = key === 'strength' ? 'กำลัง' : 'คล่องตัว';
        let msg = tired ? 'เหนื่อยเกินไป ฝึกได้ไม่เต็มที่' : 'ฝึกที่ลานกิลด์ ' + label + ' +1';
        if (st.strength + st.agility >= 8) {
          st.guild = true; st.examResult = 'passed'; st.examDay = st.day; st.equipment = 'อุปกรณ์ฝึกพื้นฐาน';
          if (!st.joinedBefore) { st.money += 10; st.joinedBefore = true; }
          msg += ' · สอบผ่าน! เข้ากิลด์แล้ว ได้เงินช่วยเหลือ 10 เหรียญ';
        }
        st.jobDay = st.day; L.workedDay = st.day;
        return say(st, msg);
      }
      const w = payWork(st, Math.round((tired ? 7 : 14) * Q.pay), core, false);
      st.supplies = Math.min(30, (st.supplies || 0) + 2); st.guildWork = (st.guildWork || 0) + 1; st.rep = (st.rep || 0) + 1;
      let msg = 'ภารกิจ' + Q.name + 'กับทีมนักรบโล่เหล็ก ได้ ' + w + ' เหรียญ';
      // v103 the tower bites back: tired or weak fighters get hurt more often; sometimes there's something to bring home
      if (roll(st, 1) < ((tired ? 0.3 : 0.12) + (st.health < 50 ? 0.1 : 0)) * Q.risk) { st.health = Math.max(1, st.health - 12); msg += ' · โดนกรงเล็บมอนสเตอร์ (สุขภาพ −12)'; }
      if (roll(st, 2) < 0.3 * Q.loot && Bag && Bag.add(st, 'monster', 1, st.day)) msg += ' · ได้ชิ้นส่วนมอนสเตอร์ 1 ชิ้น';
      return say(st, msg);
    }
    if (L.path === 'compass') {
      st.compassWork = (st.compassWork || 0) + 1; L.workedDay = st.day; st.jobDay = st.day;
      if (!st.compassMember) {
        if (!tired && st.intelligence < 12) st.intelligence++;
        let msg = tired ? 'ง่วงจนอ่านแผนที่ไม่เข้าหัว' : 'ฝึกอ่านแผนที่ในกิลด์เข็มทิศเงิน ปัญญา +1';
        if (st.intelligence >= 6) { st.compassMember = true; msg += ' · สอบผ่าน! ได้เข็มทิศเงินประจำตัว เข้ากิลด์นักสำรวจแล้ว'; }
        return say(st, msg);
      }
      const w = payWork(st, Math.round((6 + clamp(st.intelligence, 1, 12)) * (tired ? 0.5 : 1) * Q.pay), core, false);
      st.rep = (st.rep || 0) + 1;
      let msg = 'ภารกิจ' + Q.name + ' ทำแผนที่กับทีมสำรวจ ได้ ' + w + ' เหรียญ';
      if (roll(st, 3) < 0.35 * Q.loot && Bag) { const id = roll(st, 4) < 0.6 ? 'herb' : 'monster'; if (Bag.add(st, id, 1, st.day)) msg += ' · เก็บ' + Bag.name(id) + 'กลับมา 1 ชิ้น'; }
      if (roll(st, 5) < 0.06 * Q.risk) { st.health = Math.max(1, st.health - 8); msg += ' · พลัดตกหลุมในหอคอย (สุขภาพ −8)'; }
      return say(st, msg);
    }
    if (L.path === 'porter') {
      const strong = st.strength >= 6;
      const w = payWork(st, Math.round((8 + (strong ? 3 : 0)) * (tired ? 0.5 : 1) * Q.pay), core, true);
      st.porterWork = (st.porterWork || 0) + 1; st.rep = (st.rep || 0) + 1;
      if (!tired && st.porterWork % 4 === 0 && st.strength < 12) st.strength++;
      let msg = (tired ? 'เหนื่อยจนแบกได้ครึ่งทาง ' : '') + 'ภารกิจ' + Q.name + ' แบกเสบียงตามทีม ได้ ' + w + ' เหรียญ' + (!tired && st.porterWork % 4 === 0 && st.strength <= 12 ? ' · กำลัง +1' : '');
      if (roll(st, 6) < (tired ? 0.22 : 0.1) * Q.risk) { st.health = Math.max(1, st.health - 8); msg += ' · โดนมอนสเตอร์ข่วนตอนแบกของ (สุขภาพ −8)'; }
      return say(st, msg);
    }
    if (L.path === 'tmerchant') {
      st.tmerchWork = (st.tmerchWork || 0) + 1; st.rep = (st.rep || 0) + 1;
      if (!st.merchMember) {
        const w = payWork(st, tired ? 2 : 4, core, true);
        let msg = 'เป็นลูกมือตีราคาในกิลด์พ่อค้า ได้ ' + w + ' เหรียญ ชื่อเสียง +1';
        if (st.rep >= 5) { st.merchMember = true; msg += ' · หัวหน้ากิลด์รับเป็นนักตีราคาเต็มตัวแล้ว'; }
        return say(st, msg);
      }
      const w = payWork(st, Math.round(Math.min(12, 6 + Math.floor((st.rep || 0) / 2)) * (tired ? 0.5 : 1)), core, true);
      return say(st, 'ตีราคาของจากหอคอย ได้ ' + w + ' เหรียญ');
    }
    if (L.path === 'cargo') {
      const caravan = st.day % 3 === 0;
      const w = payWork(st, (tired ? 5 : 9) + (caravan && !tired ? 4 : 0), core, true);
      st.cargoWork = (st.cargoWork || 0) + 1; st.rep = (st.rep || 0) + 1;
      if (!tired && st.cargoWork % 4 === 0 && st.strength < 12) st.strength++;
      return say(st, (tired ? 'เหนื่อยจนแบกได้ครึ่งวัน ' : '') + (caravan ? 'คาราวานเข้าเมือง ของเยอะ! ' : '') + 'แบกกระสอบที่ลานเกวียน ได้ ' + w + ' เหรียญ'
        + (!tired && st.cargoWork % 4 === 0 && st.strength <= 12 ? ' · กำลัง +1' : ''));
    }
    if (L.path === 'hotel') {
      const w = payWork(st, tired ? 4 : 8, core, true);
      st.hotelWork = (st.hotelWork || 0) + 1; st.rep = (st.rep || 0) + 1;
      return say(st, (tired ? 'เหนื่อยจนทำได้ครึ่งวัน ' : '') + 'ซักผ้าและจัดห้องพัก ได้ ' + w + ' เหรียญ');
    }
    if (L.path === 'kitchen') {
      const base = 6 + (originOf(st).id === 'chef' ? 3 : 0);
      const w = payWork(st, tired ? Math.ceil(base / 2) : base, core, true);
      if (Bag) Bag.add(st, 'ration'); else st.food++; st.tavernWork = (st.tavernWork || 0) + 1; st.rep = (st.rep || 0) + 1;
      return say(st, (tired ? 'เหนื่อยจนทำได้ครึ่งวัน ' : '') + 'ช่วยงานในครัว ได้ ' + w + ' เหรียญ และอาหาร 1 ชุด');
    }
    if (L.path === 'scrap') {
      const w = payWork(st, tired ? 3 : 6, core, true);
      st.scrapWork = (st.scrapWork || 0) + 1;
      let msg = (tired ? 'เหนื่อยจนทำได้ครึ่งวัน ' : '') + 'คัดของเก่าในตรอก ได้ ' + w + ' เหรียญ';
      if (!tired && st.scrapWork % 4 === 0) { st.money += 5; msg += ' · เจอของดีในกองขยะ ขายให้ร้านรับซื้อได้อีก 5 เหรียญ'; }
      return say(st, msg);
    }
    return null; // smith is resolved by the minigame
  }
  function finishSmith(st, totalStars, core) {
    const L = st.life, stars = clamp(Math.round(totalStars) || 0, 0, 9);
    const tired = st.energy < PATHS.smith.energy;
    st.energy = Math.max(0, st.energy - PATHS.smith.energy);
    const w = payWork(st, Math.max(2, Math.round((6 + 2 * stars) * (tired ? 0.5 : 1))), core, true);
    st.smithWork = (st.smithWork || 0) + 1;
    if (stars >= 6) st.rep = (st.rep || 0) + 1;
    L.todayStars = stars;
    L.history.unshift({ day: st.day, stars }); L.history = L.history.slice(0, 30);
    return say(st, 'ตีเหล็กได้ ' + stars + '/9 ดาว ได้ค่าแรง ' + w + ' เหรียญ' + (tired ? ' (เหนื่อย ค่าแรงลดครึ่ง)' : ''));
  }
  // kitchen: the chef's hands play the role the craftsman's play at the forge
  function kitchenTolerance(st) {
    const o = originOf(st), rested = st.life && st.life.focusDay === st.day ? ROOMS.luxe.focus : 1;
    return (1 + 0.05 * (clamp(st.intelligence || 3, 1, 12) - 3)) * (o.id === 'chef' ? 1.35 : 1) * rested;
  }
  function finishKitchen(st, stars, core, skipped) {
    const L = st.life, s = clamp(Math.round(stars) || 0, 0, 9), P = PATHS[L.path] || PATHS.kitchen, tired = st.energy < P.energy;
    st.energy = Math.max(0, st.energy - P.energy);
    const guild = L.path === 'gchef';
    const base = (guild ? 5 : 3) + s + (originOf(st).id === 'chef' ? 3 : 0);
    if (guild) { L.workedDay = st.day; st.gchefWork = (st.gchefWork || 0) + 1; }
    const w = payWork(st, Math.max(2, Math.round(base * (tired ? 0.5 : 1))), core, true);
    if (!guild) { if (Bag) Bag.add(st, 'ration'); else st.food++; st.tavernWork = (st.tavernWork || 0) + 1; }
    if (s >= 6) st.rep = (st.rep || 0) + 1;
    L.todayStars = null;
    return say(st, (skipped ? 'ให้ลูกมือช่วย ' : '') + 'หั่นผักได้ ' + s + '/9 ดาว ได้ค่าแรง ' + w + ' เหรียญ และอาหาร 1 ชุด' + (tired ? ' (เหนื่อย ค่าแรงลดครึ่ง)' : ''));
  }
  function roomPrice(st, id) {
    const p = ROOMS[id].price;
    return st.life && st.life.path === 'hotel' && !ROOMS[id].place ? Math.ceil(p / 2) : p;       // staff discount (inn rooms)
  }
  // best room at or below the preference that the character can pay for right now
  function pickRoom(st) {
    const from = Math.max(0, ROOM_ORDER.indexOf(st.life.roomPref));
    for (const id of ROOM_ORDER.slice(from)) {
      const R = ROOMS[id];
      if (R.guild && !(id === st.life.roomPref && guildOf(st) && guildOf(st).member)) continue;
      if ((!R.free || id === st.life.roomPref) && st.money >= roomPrice(st, id)) return id;
    }
    return null;
  }
  function applyDinner(st, core) {
    const L = st.life, staff = L.path === 'kitchen', price = dinnerPrice(st), O = orderToday(st);
    // a cooking evening: they ate what they cooked; if the cooking failed, the bag or nothing (they never walk off to pay)
    const at = O && O.kind === 'cook' ? (L.fedDay === st.day ? 'cooked' : Bag.meals(st) ? 'bag' : 'hungry') : dinnerPlace(st);
    const msgs = [];
    L.dinnerAt = { day: st.day, place: O && O.kind === 'cook' ? 'cooked' : at };
    if (at === 'soup') { L.fedDay = st.day; msgs.push('ไม่มีเงินกินข้าว ป้าที่โรงทานตักซุปให้ฟรี'); }
    else if (at === 'cooked') { L.fedDay = st.day; }
    else if (at === 'bag') { const id = Bag && Bag.eat(st); if (id) { L.fedDay = st.day; msgs.push('กิน' + Bag.name(id) + 'จากกระเป๋า ไม่เสียค่าข้าว'); } else msgs.push('ในกระเป๋าไม่มีของกิน'); }
    if ((st.taxDue || 0) > 0 && core && core.payTax && st.money >= price + 3) {
      const p = core.payTax(st); if (p.ok) msgs.push('จ่ายภาษีเมือง ' + p.paid + ' เหรียญ');
    }
    if (at === 'hungry') msgs.push('คืนนี้ไม่มีอะไรกิน');
    if (at === 'soup' || at === 'cooked' || at === 'bag' || at === 'hungry') { /* settled above */ }
    else if (at === 'gdine') { const p = L.path === 'gchef' ? 0 : GUILD_MEAL;
      if (st.money >= p) { st.money -= p; L.fedDay = st.day; msgs.push('กินข้าวเย็นที่โรงอาหาร' + guildOf(st).name + (p ? ' ' + p + ' เหรียญ' : ' ฟรี (พ่อครัวกิลด์)')); } else msgs.push('เงินไม่พอกินข้าวเย็น'); }
    else if (staff) { L.fedDay = st.day; msgs.push('กินข้าวพนักงานในครัว ไม่เสียเงิน'); }
    else if (st.money >= price) { st.money -= price; L.fedDay = st.day; msgs.push('กินข้าวเย็น ' + price + ' เหรียญ'); }
    else msgs.push('เงินไม่พอกินข้าวเย็น');
    const room = pickRoom(st);
    L.homeTonight = room ? roomPlace(room, st) : 'bench'; L.roomTonight = room || L.roomPref;
    if (!room) msgs.push('ไม่มีค่าห้องคืนนี้');
    else if (room !== L.roomPref) msgs.push('เงินไม่พอ' + ROOMS[L.roomPref].name + ' คืนนี้พัก' + ROOMS[room].name);
    return msgs.length ? say(st, msgs.join(' · ')) : null;
  }
  function applyHome(st) {
    const L = st.life, planned = L.homeTonight !== 'bench' ? pickRoom(st) : null;
    const room = planned && roomPlace(planned, st) === L.homeTonight ? planned : null;   // stay where the walk led
    if (room) {
      const price = roomPrice(st, room);
      st.money -= price; L.sleptAt = roomPlace(room, st); L.roomSlept = room; L.roomTonight = room;
      if (!price) return say(st, 'เข้านอนที่' + ROOMS[room].name + ' ไม่เสียเงิน');
      return say(st, 'จ่ายค่า' + ROOMS[room].name + ' ' + price + ' เหรียญ' + (L.path === 'hotel' && room !== 'slum' ? ' (ราคาพนักงาน)' : '') + ' แล้วเข้านอน');
    }
    L.sleptAt = 'bench'; L.homeTonight = 'bench';
    return say(st, 'คืนนี้ต้องนอนบนม้านั่งในสวน');
  }
  function applyRest(st) {
    st.health = Math.min(100, st.health + 25);
    let meal = '';
    if (st.money >= 4) { st.money -= 4; st.life.fedDay = st.day; meal = ' · สั่งอาหารมากินในห้อง 4 เหรียญ'; }
    return say(st, 'นอนพักทั้งวัน สุขภาพ +25' + meal);
  }
  function nightReset(st) { if (st.life) st.life.homeTonight = 'inn'; }
  function setRoomPref(st, id) { if (!ROOMS[id]) return false; st.life.roomPref = id; return true; }

  // ---- events: choices move the odds, never guarantee the result ----------
  const pct = p => Math.round(clamp(p, 0, 1) * 100) + '%';
  // v104 the guild masters of ย่านกิลด์ (odds use the stats each guild cares about)
  const frontOdds = st => clamp(0.25 + 0.05 * (st.strength + st.agility) - (st.health < 50 ? 0.15 : 0), 0.15, 0.9);
  const shortcutOdds = st => clamp(0.1 + 0.07 * st.intelligence, 0.15, 0.92);
  const heavyOdds = st => clamp(0.2 + 0.08 * st.strength - (st.energy < 30 ? 0.15 : 0), 0.15, 0.92);
  const appraiseOdds = st => clamp(0.2 + 0.04 * st.intelligence + 0.04 * Math.min(10, st.rep || 0), 0.15, 0.9);
  const GUILD_EVENT = { guild: 'iron_short', compass: 'compass_shortcut', porter: 'porter_chest', tmerchant: 'merch_horn' };
  const EVENTS = {
    iron_short: {
      title: 'ทีมขาดคน', speaker: 'หัวหน้ากิลด์โล่เหล็ก', portrait: 'ironboss', faces: [3, 0, 1],
      lines: ['นักธนูของทีมเราโดนพิษแมงมุมที่ชั้นสี่ ต้องนอนพักอีกหลายวัน',
        'พรุ่งนี้ทีมต้องลงไปเคลียร์ทางให้คนแบกของ ขาดคนแนวหน้าไปหนึ่งคน',
        'เจ้ายังใหม่อยู่ แต่ข้าเห็นเจ้าซ้อมทุกเช้า... จะลองยืนแถวหน้าไหม'],
      choices: [
        { label: 'รับยืนแนวหน้า', odds: st => 'โอกาสรอดแบบไม่เจ็บ ' + pct(frontOdds(st)) + ' (ขึ้นกับกำลัง + คล่องตัว)',
          resolve(st, r) { if (r() < frontOdds(st)) { st.money += 12; st.rep = (st.rep || 0) + 2; if (Bag) Bag.add(st, 'monster', 1, st.day);
              return 'คุณกันมอนสเตอร์ไว้ให้ทีมผ่านได้ หัวหน้าตบไหล่ (ได้ 12 เหรียญ ชิ้นส่วนมอนสเตอร์ 1 ชิ้น ชื่อเสียง +2)'; }
            st.health = Math.max(1, st.health - 18); st.money += 4; return 'โล่แตกตั้งแต่ห้องแรก ทีมต้องลากคุณกลับ (สุขภาพ −18 ได้ค่าเสี่ยงภัย 4 เหรียญ)'; } },
        { label: 'ขออยู่แนวหลัง คุ้มกันคนแบกของ', odds: () => 'ปลอดภัยกว่า ได้เงินน้อยกว่า',
          resolve(st) { st.money += 5; st.rep = (st.rep || 0) + 1; return 'คุณเดินคุมท้ายขบวนคนแบกของจนจบวัน (ได้ 5 เหรียญ ชื่อเสียง +1)'; } },
        { label: 'ขอตัวพักก่อน', odds: () => 'ไม่ได้อะไร หัวหน้าอาจผิดหวังนิดหน่อย',
          resolve(st) { st.health = Math.min(100, st.health + 5); return 'หัวหน้าพยักหน้าเงียบ ๆ แล้วหันไปถามคนอื่น (สุขภาพ +5)'; } }
      ]
    },
    compass_shortcut: {
      title: 'ทางลัดบนแผนที่', speaker: 'หัวหน้ากิลด์เข็มทิศเงิน', portrait: 'compassboss', faces: [0, 2, 1],
      lines: ['มานี่สิ ดูแผนที่ชั้นหกที่ทีมเพิ่งส่งมา',
        'ตรงนี้ทางเดินหายไปเฉย ๆ แต่ลมจากช่องหินพัดมาจากทางทิศเหนือ',
        'ถ้าเธอเดาถูกว่ามีทางลัด ทีมจะประหยัดเวลาไปได้ครึ่งวันเลยนะ'],
      choices: [
        { label: 'ชี้ทางลัดตามที่คิด', odds: st => 'โอกาสถูก ' + pct(shortcutOdds(st)) + ' (ขึ้นกับปัญญา)',
          resolve(st, r) { if (r() < shortcutOdds(st)) { st.money += 10; st.rep = (st.rep || 0) + 2; st.intelligence = Math.min(12, st.intelligence + 1);
              return 'ทีมเจอทางลัดจริง! หัวหน้าจดชื่อคุณไว้มุมแผนที่ (ได้ 10 เหรียญ ปัญญา +1 ชื่อเสียง +2)'; }
            st.rep = Math.max(0, (st.rep || 0) - 1); return 'ทางนั้นเป็นทางตัน ทีมเสียเวลาไปครึ่งวัน (ชื่อเสียง −1)'; } },
        { label: 'ขอลอกแผนที่กลับไปศึกษา', odds: () => 'ได้ความรู้แน่นอน แต่เหนื่อย',
          resolve(st) { st.intelligence = Math.min(12, st.intelligence + 1); st.energy = Math.max(0, st.energy - 15); return 'คุณนั่งลอกแผนที่ใต้ตะเกียงจนดึก (ปัญญา +1 แรง −15)'; } },
        { label: 'บอกว่ายังไม่แน่ใจ', odds: () => 'ปลอดภัย',
          resolve(st) { return 'หัวหน้าหัวเราะ "ระวังดีแล้ว นักสำรวจที่รีบมักไม่ได้กลับมา"'; } }
      ]
    },
    porter_chest: {
      title: 'หีบเหล็กใบใหญ่', speaker: 'หัวหน้าสมาคมคนแบกของ', portrait: 'porterboss', faces: [0, 3, 1],
      lines: ['ปี๊ด! เฮ้ เจ้าคนใหม่ มานี่หน่อย',
        'ทีมโล่เหล็กเจอหีบเหล็กที่ชั้นสาม หนักจนคนแบกสองคนยังบ่น',
        'ใครแบกขึ้นมาถึงประตูได้ ข้าจ่ายสองเท่า'],
      choices: [
        { label: 'แบกคนเดียว รับสองเท่า', odds: st => 'โอกาสแบกไหว ' + pct(heavyOdds(st)) + ' (ขึ้นกับกำลัง)',
          resolve(st, r) { if (r() < heavyOdds(st)) { st.money += 12; st.rep = (st.rep || 0) + 1; if (st.strength < 12 && r() < 0.5) st.strength++;
              return 'คุณแบกหีบขึ้นบันไดหอคอยได้ทีละขั้นจนถึงประตู คนแบกของทั้งสมาคมปรบมือ (ได้ 12 เหรียญ ชื่อเสียง +1)'; }
            st.health = Math.max(1, st.health - 12); return 'หีบลื่นหลุดมือทับเท้า (สุขภาพ −12)'; } },
        { label: 'ชวนเพื่อนคนแบกช่วยกัน', odds: () => 'แบ่งเงินกัน แต่ได้แน่',
          resolve(st) { st.money += 5; st.rep = (st.rep || 0) + 1; st.life.porterFriend = true; return 'สองคนช่วยกันหามหีบขึ้นมาได้ เพื่อนใหม่ชวนไปกินข้าวด้วยกัน (ได้ 5 เหรียญ ชื่อเสียง +1)'; } },
        { label: 'ปฏิเสธ หลังจะพังแล้ว', odds: () => 'ปลอดภัย',
          resolve(st) { st.energy = Math.min(100, st.energy + 10); return 'หัวหน้าเป่านกหวีดเรียกคนอื่นแทน คุณได้พักหลัง (แรง +10)'; } }
      ]
    },
    merch_horn: {
      title: 'เขาสัตว์ปริศนา', speaker: 'หัวหน้ากิลด์พ่อค้าหอคอย', portrait: 'merchboss', faces: [0, 2, 1],
      lines: ['ทีมสำรวจเอาเขาสัตว์อันนี้มาขาย ฉันไม่เคยเห็นมาก่อนเลย',
        'ถ้ามันเป็นเขามังกรน้อย ราคาจะสูงกว่าบ้านหลังหนึ่ง ถ้าไม่ใช่ ก็แค่เขาแพะภูเขา',
        'เธอว่าเราควรให้ราคาเท่าไหร่ดี'],
      choices: [
        { label: 'ตีราคาสูง กล้าเสี่ยง', odds: st => 'โอกาสตีถูก ' + pct(appraiseOdds(st)) + ' (ขึ้นกับปัญญา + ชื่อเสียง)',
          resolve(st, r) { if (r() < appraiseOdds(st)) { st.money += 15; st.rep = (st.rep || 0) + 2; return 'เป็นเขามังกรน้อยจริง ๆ! หัวหน้าแบ่งกำไรให้ (ได้ 15 เหรียญ ชื่อเสียง +2)'; }
            st.rep = Math.max(0, (st.rep || 0) - 2); st.money = Math.max(0, st.money - 3); return 'เป็นแค่เขาแพะ กิลด์ขาดทุน คุณโดนหักค่าแรง (เงิน −3 ชื่อเสียง −2)'; } },
        { label: 'ขายชิ้นส่วนมอนสเตอร์ของตัวเองให้', available: st => !!Bag && Bag.count(st, 'monster') > 0,
          odds: st => 'รับซื้อชิ้นละ 8 เหรียญ (มี ' + (Bag ? Bag.count(st, 'monster') : 0) + ' ชิ้น)',
          resolve(st) { const n = Bag.count(st, 'monster'); Bag.take(st, 'monster', n); st.money += 8 * n; return 'หัวหน้ารับซื้อชิ้นส่วนมอนสเตอร์ทั้งหมด ' + n + ' ชิ้น (ได้ ' + 8 * n + ' เหรียญ)'; } },
        { label: 'ตีราคากลาง ๆ ไว้ก่อน', odds: () => 'ปลอดภัย',
          resolve(st) { st.rep = (st.rep || 0) + 1; return 'หัวหน้าพยักหน้า "รอบคอบดี" (ชื่อเสียง +1)'; } }
      ]
    },
    first_night: {
      title: 'คืนแรกในต่างโลก', speaker: 'ธนา', portrait: 'worker', faces: [0, 1, 3],
      lines: ['เธอเองก็ถูกอัญเชิญมาเหมือนกันสินะ ดูจากเสื้อผ้าแปลก ๆ นั่นก็รู้แล้ว',
        'ฉันมาได้สามเดือนแล้ว ตอนแรกนึกว่าจะได้เป็นผู้กล้า... สุดท้ายมาล้างจานอยู่ที่นี่',
        'เมื่อวานมอนสเตอร์หลุดออกมาจากชั้น 5 อีกแล้ว ถ้ากิลด์กันไม่อยู่ เมืองนี้จบแน่'],
      choices: [
        { label: 'ถามเรื่องหอคอยให้ละเอียด', odds: () => 'ได้ความรู้แน่นอน',
          resolve(st) { st.intelligence = Math.min(12, st.intelligence + 1); return 'ธนาเล่าเรื่องแต่ละชั้นของหอคอยจนดึก (ปัญญา +1)'; } },
        { label: 'ชวนไปฝึกด้วยกันพรุ่งนี้เช้า', odds: () => 'โอกาสสำเร็จ 60%',
          resolve(st, r) { if (r() < 0.6) { st.strength = Math.min(12, st.strength + 1); return 'ตื่นไปวิ่งรอบลานหน้าหอคอยด้วยกันตั้งแต่ตีห้า (กำลัง +1)'; }
            st.health = Math.max(1, st.health - 5); return 'ซ้อมหนักเกินตัว ข้อเท้าแพลง (สุขภาพ −5)'; } },
        { label: 'ขอตัวกลับไปพักก่อน', odds: () => 'ปลอดภัย',
          resolve(st) { st.health = Math.min(100, st.health + 10); return 'คุณกลับไปนอนเร็ว ตื่นมาสดชื่นกว่าปกติ (สุขภาพ +10)'; } }
      ]
    },
    alarm: {
      title: 'ระฆังเตือนภัย', speaker: 'มะลิ', portrait: 'merchant', faces: [2, 3],
      lines: ['ระฆังดังมาจากประตูหอคอย!', 'มอนสเตอร์หลุดออกมาที่ลานหน้าหอคอยแล้ว ทหารยามไม่พอ!'],
      choices: [
        { label: 'ออกไปช่วยกั้นลานหอคอย', odds: st => 'โอกาสรอดแบบไม่เจ็บ ' + pct(defendOdds(st)),
          resolve(st, r) { if (r() < defendOdds(st)) { st.danger = Math.max(1, st.danger - 1); st.rep = (st.rep || 0) + 2; st.money += 5;
              return 'คุณช่วยดันมอนสเตอร์กลับเข้าประตูได้ กิลด์ให้รางวัล 5 เหรียญ (อันตราย −1 ชื่อเสียง +2)'; }
            st.health = Math.max(1, st.health - 20); return 'ถูกกรงเล็บข่วนจนต้องหามกลับ (สุขภาพ −20)'; } },
        { label: 'เอาอาวุธที่ตีวันนี้ไปส่งทหาร', available: st => st.life.todayStars !== null && st.life.todayStars !== undefined,
          odds: st => 'โอกาสอาวุธช่วยได้ ' + pct(weaponOdds(st)) + ' (ขึ้นกับดาววันนี้)',
          resolve(st, r) { if (r() < weaponOdds(st)) { st.danger = Math.max(1, st.danger - 1); st.money += 8; st.rep = (st.rep || 0) + 1;
              return 'ดาบของคุณอยู่ในมือทหารแนวหน้า กันลานไว้ได้ (อันตราย −1 ได้ 8 เหรียญ)'; }
            st.rep = Math.max(0, (st.rep || 0) - 1); return 'ดาบหักกลางการต่อสู้ ทหารมองคุณไม่ค่อยดี (ชื่อเสียง −1)'; } },
        { label: 'หลบอยู่ในร้าน', odds: () => 'ตัวเองปลอดภัย แต่เมืองอาจเสียหาย 50%',
          resolve(st, r) { if (r() < 0.5) { st.danger = Math.min(5, st.danger + 1); return 'เช้ามามีข่าวว่ามีคนบาดเจ็บหลายคน (อันตราย +1)'; }
            return 'กองกำลังกิลด์จัดการได้ก่อนรุ่งเช้า'; } }
      ]
    },
    // ---- ตรอกล่าง (only when the day touched the poor district: soup dinner, scrap work, or sleeping in the tenement)
    soup_granny: {
      title: 'ซุปชามแรกจากโรงทาน', speaker: 'ป้าโรงทาน', portrait: 'granny', faces: [1, 0, 1], once: true,
      lines: ['มา ๆ หนุ่มน้อย ชามนี้ป้าตักเนื้อให้เยอะหน่อย ดูหน้าตาซีดเชียว',
        'คนที่นี่ไม่ได้ขี้เกียจหรอกนะ แค่โชคไม่ดี มาจากที่อื่นแล้วไม่มีใครรู้จัก',
        'กินให้อิ่ม พรุ่งนี้จะได้มีแรงสู้ต่อ'],
      choices: [
        { label: 'อยู่ช่วยป้าล้างชามจนดึก', odds: () => 'เหนื่อยหน่อย แต่ได้น้ำใจคนในตรอก',
          resolve(st) { st.energy = Math.max(0, st.energy - 10); st.rep = (st.rep || 0) + 2; st.life.slumFriend = true;
            return 'คุณล้างชามจนมือเปื่อย ป้ายิ้มแล้วบอกคนในตรอกว่าคุณเป็นคนดี (ชื่อเสียง +2 · แรง −10)'; } },
        { label: 'ถามป้าเรื่องงานในตรอก', odds: () => 'ได้รู้จักงานเก็บของเก่า',
          resolve(st) { return 'ป้าบอกว่าลานท้ายตรอกรับคนคัดของเก่าทุกวัน ไม่ต้องสอบอะไรเลย (เลือกแนวทาง "เก็บของเก่าในตรอก" ได้จากปุ่มชีวิต)'; } },
        { label: 'ขอบคุณแล้วรีบกลับไปพัก', odds: () => 'ปลอดภัย',
          resolve(st) { st.health = Math.min(100, st.health + 5); return 'ซุปร้อน ๆ ทำให้หลับสบาย (สุขภาพ +5)'; } }
      ]
    },
    thug_toll: {
      title: 'ค่าผ่านทาง', speaker: 'นักเลงตรอก', portrait: 'thug', faces: [0, 1, 0],
      lines: ['เฮ้ย หยุดก่อน หน้าใหม่ใช่ไหม', 'ตรอกนี้ข้าดูแลอยู่ จะเดินผ่านทุกวันก็ต้องมีค่าผ่านทางหน่อย', 'สามเหรียญ ไม่มากหรอก จ่ายมาซะดี ๆ'],
      choices: [
        { label: 'จ่ายไป 3 เหรียญ', available: st => st.money >= 3, odds: () => 'เสียเงิน แต่จบเรื่อง',
          resolve(st) { st.money -= 3; return 'นักเลงยัดเหรียญใส่กระเป๋าแล้วหลีกทางให้ (เงิน −3)'; } },
        { label: 'ยืนหยัด ไม่จ่าย', odds: st => 'โอกาสเขาถอยเอง ' + pct(tollOdds(st)) + ' (ขึ้นกับกำลัง คล่องตัว และชื่อเสียงในตรอก)',
          resolve(st, r) { if (r() < tollOdds(st)) { st.rep = (st.rep || 0) + 1; st.life.tollFree = true;
              return 'เขาจ้องอยู่นานแล้วหัวเราะ "ใจถึงดีนี่" แล้วไม่เคยเรียกเก็บอีกเลย (ชื่อเสียง +1)'; }
            st.health = Math.max(1, st.health - 15); st.money = Math.max(0, st.money - 2);
            return 'โดนต่อยจนล้มแล้วโดนล้วงไป 2 เหรียญ (สุขภาพ −15)'; } },
        { label: 'วิ่งหนีเข้าตรอกซอย', odds: st => 'โอกาสหนีพ้น ' + pct(clamp(0.3 + 0.07 * st.agility, 0.1, 0.9)),
          resolve(st, r) { if (r() < clamp(0.3 + 0.07 * st.agility, 0.1, 0.9)) return 'คุณลัดเลาะตรอกแคบจนเขาตามไม่ทัน';
            st.health = Math.max(1, st.health - 10); return 'สะดุดกองไม้ล้มลง เขาตามมาทันแล้วเตะซ้ำ (สุขภาพ −10)'; } }
      ]
    },
    street_kid: {
      title: 'มือเล็ก ๆ ในกระเป๋า', speaker: 'เด็กจรจัด', portrait: 'streetkid', faces: [3, 0, 1],
      lines: ['(คุณรู้สึกมีอะไรขยับในกระเป๋า หันไปเจอเด็กมอมแมมคนหนึ่งยืนตัวแข็ง)', 'ข...ขอโทษครับ ผมหิวมากเลย ไม่ได้กินอะไรมาสองวันแล้ว',
        'ถ้าพี่ไม่บอกทหาร ผมจะบอกที่ซ่อนของดีในลานขยะให้นะ!'],
      choices: [
        { label: 'แบ่งอาหารสำรองให้ 1 ชุด', available: st => (Bag ? Bag.meals(st) : st.food) > 0, odds: () => 'เด็กจะจำน้ำใจนี้',
          resolve(st) { if (Bag) Bag.eat(st); else st.food--; st.money += 4; st.life.slumFriend = true;
            return 'เด็กกินหมดในพริบตา แล้วพาไปขุดกล่องเหรียญเก่าที่ฝังไว้ใต้กองไม้ (อาหาร −1 · เงิน +4)'; } },
        { label: 'ดุแล้วปล่อยไป', odds: () => 'ไม่ได้อะไร ไม่เสียอะไร',
          resolve() { return 'เด็กวิ่งหายเข้าตรอกไป ทิ้งไว้แค่รอยเท้าเปื้อนดิน'; } },
        { label: 'จับส่งทหารยาม', odds: () => 'ได้ชื่อเสียงในเมือง แต่คนในตรอกจะไม่ชอบ',
          resolve(st) { st.rep = Math.max(0, (st.rep || 0) + 1); st.life.slumFriend = false;
            return 'ทหารพาเด็กไปที่ป้อม ชาวตรอกมองคุณด้วยสายตาเย็นชา (ชื่อเสียงในเมือง +1)'; } }
      ]
    },
    washer_help: {
      title: 'ตะกร้าผ้าใบใหญ่', speaker: 'แม่ซักผ้า', portrait: 'washer', faces: [3, 0, 1],
      lines: ['ขอโทษนะคะ... ช่วยยกตะกร้านี้ขึ้นชั้นสามให้หน่อยได้ไหม ลูกฉันไม่สบาย ฉันทิ้งไว้นานไม่ได้',
        'ห้องเช่าที่นี่ทั้งชื้นทั้งหนาว เด็ก ๆ ป่วยกันบ่อย', 'ถ้าช่วย เดี๋ยวฉันซักเสื้อให้ฟรีนะ ใส่ผ้าสะอาดแล้วจะได้ไม่ป่วยเหมือนพวกเรา'],
      choices: [
        { label: 'ช่วยยกขึ้นไป', odds: () => 'แรง −10 · ได้เสื้อสะอาด',
          resolve(st) { st.energy = Math.max(0, st.energy - 10); st.health = Math.min(100, st.health + 8); st.life.slumFriend = true;
            return 'เธอซักเสื้อให้จนหอมสะอาด นอนคืนนี้ไม่คันไม่เปียกชื้น (สุขภาพ +8 · แรง −10)'; } },
        { label: 'ให้เงินซื้อยา 2 เหรียญ', available: st => st.money >= 2, odds: () => 'เงิน −2 · ชื่อเสียง +2',
          resolve(st) { st.money -= 2; st.rep = (st.rep || 0) + 2; return 'เธอรีบวิ่งไปร้านยาฝั่งเมือง พร้อมขอบคุณไม่หยุด (เงิน −2 · ชื่อเสียง +2)'; } },
        { label: 'ขอตัวก่อน วันนี้เหนื่อย', odds: () => 'ไม่มีผล',
          resolve() { return 'เธอพยักหน้าเข้าใจ แล้วแบกตะกร้าขึ้นบันไดไปช้า ๆ'; } }
      ]
    },
    // v87 ลานเกวียน
    foreman_rush: {
      title: 'เกวียนมาเกินคิว', speaker: 'หัวหน้าคนงาน', portrait: 'foreman', faces: [2, 3, 0],
      lines: ['เฮ้ย! คาราวานมาก่อนเวลาสองคัน ของเต็มลานแล้ว!', 'ถ้าขนขึ้นโกดังไม่ทันก่อนค่ำ ฝนตกมาแป้งเสียหมดแน่',
        'ใครอยู่ช่วยต่ออีกชั่วโมง ข้าจ่ายเพิ่มให้ ว่าไง ไอ้หนุ่มต่างโลก?'],
      choices: [
        { label: 'อยู่ช่วยต่อ', odds: st => 'แรง −15 · เงิน +5' + (st.energy < 25 ? ' (เหนื่อยมากแล้ว สุขภาพอาจลด)' : ''),
          resolve(st) { const worn = st.energy < 25; st.energy = Math.max(0, st.energy - 15); st.money += 5; st.rep = (st.rep || 0) + 1;
            if (worn) st.health = Math.max(1, st.health - 6);
            return 'แบกจนไหล่ระบม แต่ของขึ้นโกดังทันก่อนฝน หัวหน้าตบไหล่แล้วยัดเหรียญใส่มือ (เงิน +5 · แรง −15' + (worn ? ' · สุขภาพ −6' : '') + ')'; } },
        { label: 'ขอตัวกลับก่อน', odds: () => 'ไม่มีผล',
          resolve() { return 'หัวหน้าบ่นอุบอิบ แล้วเป่านกหวีดเรียกคนอื่นแทน'; } }
      ]
    },
    caravan_offer: {
      title: 'เครื่องเทศจากแดนไกล', speaker: 'พ่อค้าคาราวาน', portrait: 'caravan', faces: [1, 0, 2],
      lines: ['สหาย! เจ้าแบกกระสอบของข้าอย่างระวังทุกใบ ข้าเห็นนะ', 'ข้าเดินทางผ่านมาแล้วสิบเมือง ไม่มีที่ไหนมีหอคอยแบบนี้เลย',
        'นี่ ซองเครื่องเทศจากทะเลทรายของข้า ต้มน้ำดื่มแล้วหายเหนื่อย ขายให้เจ้าราคาเพื่อน แค่ 3 เหรียญ'],
      choices: [
        { label: 'ซื้อ 3 เหรียญ', available: st => st.money >= 3, odds: () => 'เงิน −3 · แรง +25 · สุขภาพ +5',
          resolve(st) { st.money -= 3; st.energy = Math.min(100, st.energy + 25); st.health = Math.min(100, st.health + 5);
            return 'กลิ่นหอมแปลก ๆ อุ่นถึงท้อง ความเหนื่อยหายไปครึ่งหนึ่ง (แรง +25 · สุขภาพ +5)'; } },
        { label: 'ถามเรื่องเมืองอื่น', odds: () => 'ปัญญา +1',
          resolve(st) { if (st.intelligence < 12) st.intelligence++; return 'เขาเล่าเรื่องเมืองทราย ตลาดลอยน้ำ และหอคอยที่พังไปแล้วในแดนตะวันออก (ปัญญา +1)'; } },
        { label: 'ไม่เป็นไร ขอบคุณ', odds: () => 'ไม่มีผล',
          resolve() { return 'เขาหัวเราะเสียงดัง "ไว้คราวหน้านะสหาย!"'; } }
      ]
    }
  };
  function tollOdds(st) { return clamp(0.15 + 0.04 * (st.strength + st.agility) + 0.03 * Math.min(10, st.rep || 0) + (st.life.slumFriend ? 0.15 : 0), 0.1, 0.9); }
  function slumToday(st) {
    const L = st.life;
    return L.path === 'scrap' || L.homeTonight === 'tenement' || (L.dinnerAt && L.dinnerAt.day === st.day && L.dinnerAt.place === 'soup');
  }
  function defendOdds(st) { return clamp(0.2 + 0.05 * (st.strength + st.agility) + 0.02 * (st.intelligence - 3) - (st.health < 50 ? 0.15 : 0), 0.1, 0.9); }
  function weaponOdds(st) { return clamp(0.35 + 0.06 * (st.life.todayStars || 0), 0.1, 0.9); }
  function pickEvent(st, rng) {
    const L = st.life, r = typeof rng === 'function' ? rng : Math.random;
    if (!L.seen.includes('first_night')) return 'first_night';
    if (st.danger >= 3 && st.day - L.lastEventDay >= 2 && r() < 0.45) return 'alarm';
    if (L.path === 'cargo' && L.workedDay === st.day && st.day - L.lastEventDay >= 2) {
      const yard = ['foreman_rush', 'caravan_offer'].filter(k => !L.seen.includes(k) || k === 'foreman_rush');
      if (yard.length && r() < 0.45) return yard[Math.floor(r() * yard.length) % yard.length];
    }
    // v104 a guild master stops you after a day's work (first time likely, then now and then)
    const gev = GUILD_EVENT[L.path];
    void gev;                                             // v105: guild talks happen in the master's office (L.talk, milestone gtalk)
    if (!slumToday(st)) return null;
    if (L.dinnerAt && L.dinnerAt.day === st.day && L.dinnerAt.place === 'soup' && !L.seen.includes('soup_granny')) return 'soup_granny';
    if (st.day - L.lastEventDay < 2) return null;
    const pool = [];
    if (!L.tollFree && !L.seen.includes('thug_toll')) pool.push('thug_toll');
    else if (!L.tollFree && st.money >= 3) pool.push('thug_toll');
    if (!L.seen.includes('street_kid')) pool.push('street_kid');
    if (L.homeTonight === 'tenement' && !L.seen.includes('washer_help')) pool.push('washer_help');
    if (!pool.length || r() > 0.5) return null;
    return pool[Math.floor(r() * pool.length) % pool.length];
  }
  function choicesFor(st, id) {
    return EVENTS[id].choices.map((c, i) => ({ index: i, label: c.label, odds: c.odds(st), enabled: !c.available || c.available(st) }));
  }
  function resolveChoice(st, id, index, rng) {
    const ev = EVENTS[id], c = ev && ev.choices[index];
    if (!c || (c.available && !c.available(st))) return null;
    const L = st.life; if (!L.seen.includes(id)) L.seen.push(id); L.lastEventDay = st.day;
    return say(st, ev.title + ': ' + c.resolve(st, typeof rng === 'function' ? rng : Math.random));
  }

  return { guildOf, gscene, QUESTS, requestStash, GUILD_MEAL, applyCoach, COACH, COACH_FARE, applyErrand, applyOrder, orderToday, setOrder, stovePlace, night, Bag, ERRANDS, LANE, zoneOf, PLACES, PATHS, ORIGINS, EVENTS, ROOMS, ROOM_ORDER, SPEED, WAKE, WORK_END, RENT, roomPrice, pickRoom, setRoomPref, originOf, newLife, ensure, dayPlan, milestones, due, sample,
    tolerance, kitchenTolerance, applyWake, applyWork, finishSmith, finishKitchen, applyDinner, applyHome, applyRest, nightReset, pickEvent, choicesFor, resolveChoice,
    defendOdds, weaponOdds };
});
