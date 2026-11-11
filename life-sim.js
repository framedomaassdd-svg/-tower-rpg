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

  const PLACES = Object.freeze({
    inn:    { x: 4250, y: 792, name: 'โรงแรม' },
    smith:  { x: 5805, y: 792, name: 'โรงตีเหล็ก' },
    market: { x: 360,  y: 792, name: 'ตลาด' },
    guild:  { x: 1000, y: 792, name: 'ลานฝึกกิลด์' },
    tavern: { x: 1550, y: 800, name: 'ร้านอาหาร' },
    bench:  { x: 2160, y: 792, name: 'ม้านั่งลานหอคอย' }
  });
  const STREET_Y = 812;
  const SPEED = 2520;            // world px per clock unit (≈ a brisk walk at ×1)
  const WAKE = 5;                // 06:00
  const WORK_END = 40 / 3;       // 16:00
  const DINNER_UNTIL = 15;       // 18:00
  const DINNER_MIN = 0.42;       // at least ~30 game minutes at the table
  const RENT = 5;

  const ORIGINS = Object.freeze([
    { id: 'office',  name: 'พนักงานบริษัท', stats: { strength: 2, agility: 3, intelligence: 6 }, money: 20, suggest: 'guild',
      perk: 'หัวไว: ปัญญาสูง ช่วยให้จังหวะมินิเกมกว้างขึ้นและอ่านสถานการณ์ในเหตุการณ์ได้ดีกว่า' },
    { id: 'chef',    name: 'พ่อครัว',       stats: { strength: 3, agility: 4, intelligence: 3 }, money: 15, suggest: 'market',
      perk: 'ทำกับข้าวเป็น: ค่าอาหารเย็นถูกลง 1 เหรียญ' },
    { id: 'craft',   name: 'ช่างฝีมือ',      stats: { strength: 4, agility: 3, intelligence: 3 }, money: 15, suggest: 'smith',
      perk: 'มือช่าง: จังหวะในมินิเกมตีเหล็กกว้างกว่าคนอื่นมาก' },
    { id: 'jobless', name: 'คนว่างงาน',      stats: { strength: 3, agility: 3, intelligence: 3 }, money: 8,  suggest: 'market',
      perk: 'ทนลำบาก: ถ้าต้องนอนข้างนอก ก็ยังฟื้นแรงได้มากกว่าคนอื่น' }
  ]);
  const PATHS = Object.freeze({
    smith:  { name: 'ช่างตีเหล็กฝึกหัด', place: 'smith',  energy: 30, minigame: true,
              desc: 'ไปช่วยงานโรงตีเหล็กทุกวัน มีมินิเกมตีเหล็ก ค่าแรงขึ้นกับฝีมือ และอาวุธที่ตีจะถูกส่งไปให้นักสู้ในหอคอย' },
    guild:  { name: 'ฝึกเพื่อเข้ากิลด์',   place: 'guild',  energy: 20,
              desc: 'ฝึกร่างกายที่ลานกิลด์ทุกวัน ยังไม่มีค่าแรง จนกว่าจะสอบผ่าน (กำลัง + คล่องตัว ≥ 8) แล้วรับงานขนเสบียง' },
    market: { name: 'รับจ้างที่ตลาด',     place: 'market', energy: 25,
              desc: 'ขนของให้แม่ค้า ค่าแรงไม่มาก แต่ได้อาหารติดมือกลับมาทุกวัน' }
  });

  function originOf(st) { return ORIGINS.find(o => o.name === st.profession) || ORIGINS[3]; }

  function newLife(st, rng) {
    const r = typeof rng === 'function' ? rng : Math.random;
    const origin = ORIGINS[Math.floor(r() * ORIGINS.length)];
    st.profession = origin.name;
    Object.assign(st, origin.stats);
    st.money = origin.money; st.energy = 100; st.health = 100; st.food = 1;
    st.life = { v: 1, origin: origin.id, age: 18 + Math.floor(r() * 28), path: origin.suggest, pendingPath: null,
      started: false, done: {}, sleptAt: 'inn', homeTonight: 'inn', restDay: 0, todayStars: null, workedDay: 0,
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
  function dayPlan(st) {
    const L = st.life, path = PATHS[L.path], work = path.place;
    const start = L.dayStart && L.dayStart.day === st.day ? L.dayStart.place : L.sleptAt;
    const segs = [stay(0, WAKE, start, start === 'inn' ? 'นอนหลับอยู่ในโรงแรม' : 'นอนบนม้านั่งลานหอคอย',
      { hidden: start === 'inn', milestoneEnd: 'wake' })];
    if (L.restDay === st.day) {
      segs.push(stay(WAKE, 20, start, 'ป่วย พักฟื้นทั้งวัน', { hidden: start === 'inn', milestones: [['rest', 12], ['home', 17]] }));
      return segs;
    }
    const w = walk(WAKE, start, work, 'เดินไป' + PLACES[work].name); segs.push(w);
    const atWork = stay(w.t1, Math.max(w.t1 + 0.3, WORK_END), work, path.minigame ? 'ช่วยงานในโรงตีเหล็ก' : path.place === 'guild' ? 'ฝึกที่ลานกิลด์' : 'ขนของในตลาด', { milestone: 'work' });
    segs.push(atWork);
    const toTavern = walk(atWork.t1, work, 'tavern', 'เดินไปกินข้าวเย็น'); segs.push(toTavern);
    const dinner = stay(toTavern.t1, Math.max(toTavern.t1 + DINNER_MIN, DINNER_UNTIL), 'tavern', 'กินข้าวเย็นที่ร้านอาหาร', { milestone: 'dinner' });
    segs.push(dinner);
    const home = L.homeTonight;
    const back = walk(dinner.t1, 'tavern', home, home === 'inn' ? 'เดินกลับโรงแรม' : 'ไม่มีค่าห้อง เดินไปลานหอคอย'); segs.push(back);
    segs.push(stay(back.t1, 20, home, home === 'inn' ? 'นอนหลับอยู่ในโรงแรม' : 'นอนบนม้านั่งลานหอคอย', { hidden: home === 'inn', milestone: 'home' }));
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
    const f = s.kind === 'walk' && s.t1 > s.t0 ? (c - s.t0) / (s.t1 - s.t0) : 0;
    const x = s.x0 + (s.x1 - s.x0) * clamp(f, 0, 1);
    return { x, y: s.y, hidden: !!s.hidden, moving: s.kind === 'walk', face: s.x1 > s.x0 ? 1 : s.x1 < s.x0 ? -1 : 0,
      act: s.act, place: PLACES[s.place].name, anim: c * 30 };
  }

  // ---- daily effects ----------------------------------------------------
  const say = (st, msg) => { if (typeof st._log === 'function') st._log(msg); return msg; };
  function tolerance(st) {
    const o = originOf(st);
    return (1 + 0.05 * (clamp(st.intelligence || 3, 1, 12) - 3)) * (o.id === 'craft' ? 1.4 : 1);
  }
  function applyWake(st) {
    const L = st.life, o = originOf(st);
    if (L.pendingPath && PATHS[L.pendingPath]) { L.path = L.pendingPath; L.pendingPath = null; say(st, 'เริ่มแนวทางใหม่: ' + PATHS[L.path].name); }
    if (L.sleptAt === 'inn') { st.energy = 100; st.health = Math.min(100, st.health + 5); }
    else st.energy = Math.max(st.energy, o.id === 'jobless' ? 80 : 50);
    L.todayStars = null; L.dayStart = { day: st.day, place: L.sleptAt }; L.homeTonight = 'inn';
    if (st.health < 30) { L.restDay = st.day; return say(st, 'ร่างกายไม่ไหว (สุขภาพ ' + st.health + ') วันนี้ขอพักฟื้น'); }
    return null;
  }
  function payWork(st, wage, core, ordinary) {
    const w = core && core.workWage ? core.workWage(wage, st.taxDue || 0, ordinary) : wage;
    st.money += w; st.work = (st.work || 0) + 1; st.jobDay = st.day; st.life.workedDay = st.day;
    return w;
  }
  function applyWork(st, core) {
    const L = st.life, path = PATHS[L.path];
    const tired = st.energy < path.energy;
    st.energy = Math.max(0, st.energy - path.energy);
    if (L.path === 'market') {
      const w = payWork(st, tired ? 4 : 8, core, true);
      st.food++; st.marketWork = (st.marketWork || 0) + 1; st.rep = (st.rep || 0) + 1;
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
      const w = payWork(st, tired ? 7 : 14, core, false);
      st.supplies = Math.min(30, (st.supplies || 0) + 2); st.guildWork = (st.guildWork || 0) + 1; st.rep = (st.rep || 0) + 1;
      return say(st, 'ขนเสบียงให้กิลด์ ได้ ' + w + ' เหรียญ · เสบียงเมือง +2');
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
  function applyDinner(st, core) {
    const L = st.life, price = originOf(st).id === 'chef' ? 3 : 4;
    const msgs = [];
    if ((st.taxDue || 0) > 0 && core && core.payTax && st.money >= price + 3) {
      const p = core.payTax(st); if (p.ok) msgs.push('จ่ายภาษีเมือง ' + p.paid + ' เหรียญ');
    }
    if (st.money >= price) { st.money -= price; st.food++; msgs.push('กินข้าวเย็น ' + price + ' เหรียญ'); }
    else msgs.push('เงินไม่พอกินข้าวเย็น');
    L.homeTonight = st.money >= RENT ? 'inn' : 'bench';
    if (L.homeTonight === 'bench') msgs.push('ไม่มีค่าห้องคืนนี้');
    return say(st, msgs.join(' · '));
  }
  function applyHome(st) {
    const L = st.life;
    if (L.homeTonight === 'inn' && st.money >= RENT) { st.money -= RENT; L.sleptAt = 'inn'; return say(st, 'จ่ายค่าห้อง ' + RENT + ' เหรียญ แล้วเข้านอน'); }
    L.sleptAt = 'bench'; L.homeTonight = 'bench';
    return say(st, 'คืนนี้ต้องนอนบนม้านั่งลานหอคอย');
  }
  function applyRest(st) {
    st.health = Math.min(100, st.health + 25);
    let meal = '';
    if (st.money >= 4) { st.money -= 4; st.food++; meal = ' · สั่งอาหารมากินในห้อง 4 เหรียญ'; }
    return say(st, 'นอนพักทั้งวัน สุขภาพ +25' + meal);
  }
  function nightReset(st) { if (st.life) st.life.homeTonight = 'inn'; }

  // ---- events: choices move the odds, never guarantee the result ----------
  const pct = p => Math.round(clamp(p, 0, 1) * 100) + '%';
  const EVENTS = {
    first_night: {
      title: 'คืนแรกในต่างโลก', speaker: 'ธนา', portrait: 'worker',
      lines: ['เธอเองก็ถูกอัญเชิญมาเหมือนกันสินะ ดูจากเสื้อผ้าแปลก ๆ นั่นก็รู้แล้ว',
        'ฉันมาได้สามเดือนแล้ว ตอนแรกนึกว่าจะได้เป็นผู้กล้า... สุดท้ายมาล้างจานอยู่ที่นี่',
        'เมื่อวานมอนสเตอร์หลุดออกมาจากชั้น 5 อีกแล้ว ถ้ากิลด์กันไม่อยู่ เมืองนี้จบแน่'],
      choices: [
        { label: 'ถามเรื่องหอคอยให้ละเอียด', odds: () => 'ได้ความรู้แน่นอน',
          resolve(st) { st.intelligence = Math.min(12, st.intelligence + 1); return 'ธนาเล่าเรื่องแต่ละชั้นของหอคอยจนดึก (ปัญญา +1)'; } },
        { label: 'ชวนไปฝึกด้วยกันพรุ่งนี้เช้า', odds: () => 'โอกาสสำเร็จ 60%',
          resolve(st, r) { if (r() < 0.6) { st.strength = Math.min(12, st.strength + 1); return 'ตื่นไปวิ่งรอบลานหอคอยด้วยกันตั้งแต่ตีห้า (กำลัง +1)'; }
            st.health = Math.max(1, st.health - 5); return 'ซ้อมหนักเกินตัว ข้อเท้าแพลง (สุขภาพ −5)'; } },
        { label: 'ขอตัวกลับไปพักก่อน', odds: () => 'ปลอดภัย',
          resolve(st) { st.health = Math.min(100, st.health + 10); return 'คุณกลับไปนอนเร็ว ตื่นมาสดชื่นกว่าปกติ (สุขภาพ +10)'; } }
      ]
    },
    alarm: {
      title: 'ระฆังเตือนภัย', speaker: 'มะลิ', portrait: 'merchant',
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
    }
  };
  function defendOdds(st) { return clamp(0.2 + 0.05 * (st.strength + st.agility) + 0.02 * (st.intelligence - 3) - (st.health < 50 ? 0.15 : 0), 0.1, 0.9); }
  function weaponOdds(st) { return clamp(0.35 + 0.06 * (st.life.todayStars || 0), 0.1, 0.9); }
  function pickEvent(st, rng) {
    const L = st.life, r = typeof rng === 'function' ? rng : Math.random;
    if (!L.seen.includes('first_night')) return 'first_night';
    if (st.danger >= 3 && st.day - L.lastEventDay >= 2 && r() < 0.45) return 'alarm';
    return null;
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

  return { PLACES, PATHS, ORIGINS, EVENTS, SPEED, WAKE, WORK_END, RENT, originOf, newLife, ensure, dayPlan, milestones, due, sample,
    tolerance, applyWake, applyWork, finishSmith, applyDinner, applyHome, applyRest, nightReset, pickEvent, choicesFor, resolveChoice,
    defendOdds, weaponOdds };
});
