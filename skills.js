/* v108 skills, titles, equipment and combat.
   Stats only grow from three sources: passive skills (by tier), equipment and the active title.
   st.base holds the character's own stats; st.strength / agility / intelligence are recomputed from it (recalc).
   Every skill has 5 tiers. Using it fills a proficiency bar; when the bar is full it stops, and a promotion trial
   must be passed to reach the next tier (the bar starts again, longer, and the skill gets stronger). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Skills = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TIERS = Object.freeze([
    { name: 'ฝึกหัด', cap: 20 }, { name: 'ชำนาญ', cap: 40 }, { name: 'เชี่ยวชาญ', cap: 80 },
    { name: 'ยอดฝีมือ', cap: 160 }, { name: 'ปรมาจารย์', cap: 0 }
  ]);
  const STAT_NAME = { strength: 'กำลัง', agility: 'คล่องตัว', intelligence: 'ปัญญา' };
  // trial: what has to happen (progress(kind, value)) and how many times, for promotion out of tier t (1..4)
  const SKILLS = Object.freeze({
    brawn:     { name: 'แขนแกร่ง', type: 'passive', icon: '💪', stat: { strength: [4, 9, 15, 22, 30] }, desc: 'กำลังเพิ่มตามขั้น',
                 teacher: 'หัวหน้าสมาคมคนแบกของ', trial: t => ({ on: 'haul', need: 4 + t, text: 'แบกของเต็มวันโดยไม่หมดแรง ' + (4 + t) + ' วัน' }) },
    nimble:    { name: 'เท้าไว', type: 'passive', icon: '🦶', stat: { agility: [4, 9, 15, 22, 30] }, desc: 'คล่องตัวเพิ่มตามขั้น',
                 teacher: 'ครูฝึกกิลด์', trial: t => ({ on: 'clean_win', need: 2 + t, text: 'ชนะการต่อสู้โดยไม่บาดเจ็บ ' + (2 + t) + ' ครั้ง' }) },
    keen:      { name: 'ตาไว', type: 'passive', icon: '👁️', stat: { intelligence: [4, 9, 15, 22, 30] }, desc: 'ปัญญาเพิ่มตามขั้น',
                 teacher: 'หัวหน้ากิลด์เข็มทิศเงิน', trial: t => ({ on: 'study', need: 4 + t, text: 'ศึกษาแผนที่หรือตีราคาของ ' + (4 + t) + ' วัน' }) },
    fire:      { name: 'เพลิงวิญญาณ', type: 'active', icon: '🔥', power: [6, 12, 21, 32, 46], desc: 'ไฟปรากฏบนวงล้อต่อสู้เมื่อเลือกใช้สกิลนี้', teacher: 'ผู้จดตำราในเซฟโซน', trial: t => ({ on: 'win', min: 10 + 10 * t, need: 3, text: 'ชนะมอนสเตอร์พลังสูง 3 ครั้ง' }) },
    ice:       { name: 'ไอเยือกแข็ง', type: 'active', icon: '🧊', power: [5, 11, 19, 29, 42], desc: 'น้ำแข็งปรากฏบนวงล้อต่อสู้เมื่อเลือกใช้สกิลนี้', teacher: 'ผู้จดตำราในเซฟโซน', trial: t => ({ on: 'win', min: 10 + 10 * t, need: 3, text: 'ชนะมอนสเตอร์พลังสูง 3 ครั้ง' }) },
    dangerSense: { name: 'ญาณระวังภัย', type: 'passive', icon: '👁️', stat: { agility: [2, 5, 8, 12, 17] }, desc: 'ลดโอกาสอันตรายในการสำรวจ', teacher: 'ผู้จดตำราในเซฟโซน', trial: t => ({ on: 'deep_map', need: 1 + t, text: 'สำรวจชั้นลึกเพิ่มเติม' }) },
    sword:     { name: 'วิชาดาบ', type: 'active', icon: '⚔️', power: [4, 9, 16, 25, 36], desc: 'ฟันสองจังหวะเมื่อ ✨ ขึ้นบนวงล้อ เพิ่มพลังต่อสู้',
                 teacher: 'หัวหน้ากิลด์โล่เหล็ก', trial: t => { const m = [15, 30, 50, 75][t - 1]; return { on: 'win', min: m, need: 3, text: 'ชนะมอนสเตอร์พลัง ' + m + ' ขึ้นไป 3 ครั้ง' }; } },
    smithing:  { name: 'ตีเหล็ก', type: 'life', icon: '🔨', desc: 'จังหวะมินิเกมตีเหล็กกว้างขึ้น ค่าแรงช่างเพิ่ม',
                 teacher: 'ช่างตีเหล็ก', trial: t => ({ on: 'stars:smith', min: 5 + t, need: 3, text: 'ตีเหล็กได้ ' + (5 + t) + ' ดาวขึ้นไป 3 ครั้ง' }) },
    cooking:   { name: 'ทำอาหาร', type: 'life', icon: '🍳', desc: 'จังหวะหั่นผักกว้างขึ้น ค่าแรงครัวเพิ่ม',
                 teacher: 'พ่อครัว', trial: t => ({ on: 'stars:kitchen', min: 5 + t, need: 3, text: 'หั่นผักได้ ' + (5 + t) + ' ดาวขึ้นไป 3 ครั้ง' }) },
    mapping:   { name: 'ทำแผนที่', type: 'life', icon: '🧭', desc: 'ค่าแรงทีมสำรวจเพิ่ม เจอของในหอคอยบ่อยขึ้น',
                 teacher: 'หัวหน้ากิลด์เข็มทิศเงิน', trial: t => ({ on: 'deep_map', need: 1 + t, text: 'ทำแผนที่ภารกิจบุกชั้นลึกสำเร็จ ' + (1 + t) + ' ครั้ง' }) },
    haggling:  { name: 'ต่อรอง', type: 'life', icon: '⚖️', desc: 'ค่าแรงตีราคาและงานตลาดเพิ่ม',
                 teacher: 'หัวหน้ากิลด์พ่อค้าหอคอย', trial: t => ({ on: 'appraise', need: 4 + t, text: 'ตีราคาของหรือค้าขาย ' + (4 + t) + ' วัน' }) },
    gathering: { name: 'คุ้ยหาของ', type: 'life', icon: '🧺', desc: 'เจอของดีในลานของเก่าและในทุ่งบ่อยขึ้น',
                 teacher: 'ป้าโรงทาน', trial: t => ({ on: 'find', need: 1 + t, text: 'เจอของดีจากการคุ้ยหา ' + (1 + t) + ' ครั้ง' }) }
  });
  // titles: one is worn at a time
  const TITLES = Object.freeze({
    summoned:  { name: 'ผู้ถูกอัญเชิญ', bonus: { intelligence: 2 }, how: 'ได้ตั้งแต่มาถึงต่างโลก' },
    iron:      { name: 'นักรบโล่เหล็ก', bonus: { strength: 4 }, how: 'สอบเข้ากิลด์โล่เหล็กผ่าน' },
    compass:   { name: 'นักสำรวจเข็มทิศเงิน', bonus: { intelligence: 4 }, how: 'สอบเข้ากิลด์เข็มทิศเงินผ่าน' },
    appraiser: { name: 'นักตีราคา', bonus: { intelligence: 2, agility: 2 }, how: 'เป็นนักตีราคากิลด์พ่อค้า' },
    porter:    { name: 'หลังเหล็ก', bonus: { strength: 5 }, how: 'อยู่ในหอคอยกับขบวนคนแบกรวม 30 วัน' },
    slayer:    { name: 'ผู้ล่าอสูร', bonus: { strength: 3, agility: 3 }, how: 'ชนะมอนสเตอร์ 15 ครั้ง' },
    survivor:  { name: 'ผู้รอดตาย', bonus: { agility: 4 }, how: 'รอดชีวิตเพราะเพื่อนร่วมทีมช่วยไว้' }
  });
  // equipment: bag items with ITEMS[id].equip = slot; the numbers here
  const GEAR = Object.freeze({
    dagger: { slot: 'weapon', atk: 5 }, sword: { slot: 'weapon', atk: 11 }, knife: { slot: 'weapon', atk: 2 },
    leather: { slot: 'armor', def: 5 }, chain_vest: { slot: 'armor', def: 10 },
    charm: { slot: 'charm', bonus: { agility: 3 } }
  });
  const SLOTS = Object.freeze({ weapon: 'อาวุธ', armor: 'เกราะ', charm: 'เครื่องราง' });

  function data(st) {
    if (!st.base) st.base = { strength: (st.strength || 3) * 5, agility: (st.agility || 3) * 5, intelligence: (st.intelligence || 3) * 5 };
    if (!st.skills || typeof st.skills !== 'object') st.skills = {};
    if (!Array.isArray(st.titles)) st.titles = ['summoned'];
    if (!st.title || !TITLES[st.title]) st.title = st.titles[0];
    if (!st.equip || typeof st.equip !== 'object') st.equip = {};
    if (!st.trials || typeof st.trials !== 'object') st.trials = {};
    if (!st.wounds || typeof st.wounds !== 'object') st.wounds = { until: 0 };
    // Migration: older saves never stored a selected active skill.
    if (!st.activeSkill || !SKILLS[st.activeSkill] || SKILLS[st.activeSkill].type !== 'active' || !st.skills[st.activeSkill])
      st.activeSkill = st.skills.sword ? 'sword' : (['fire', 'ice'].find(k => !!st.skills[k]) || null);
    return st;
  }
  const tierOf = (st, id) => (st.skills && st.skills[id] ? st.skills[id].tier : 0);
  function bonus(st) {
    data(st); const b = { strength: 0, agility: 0, intelligence: 0 };
    for (const [id, s] of Object.entries(st.skills)) { const S = SKILLS[id]; if (S && S.stat) for (const k in S.stat) b[k] += S.stat[k][s.tier - 1] || 0; }
    for (const id of Object.values(st.equip)) { const g = GEAR[id]; if (g && g.bonus) for (const k in g.bonus) b[k] += g.bonus[k]; }
    const T = TITLES[st.title]; if (T) for (const k in T.bonus) b[k] += T.bonus[k];
    return b;
  }
  // effective stats (base + bonuses), halved while a defeat's wounds last
  function recalc(st) {
    data(st); const b = bonus(st), weak = (st.wounds.until || 0) >= (st.day || 1) ? 0.5 : 1;
    for (const k of ['strength', 'agility', 'intelligence']) st[k] = Math.max(1, Math.round((st.base[k] + b[k]) * weak));
    return st;
  }
  // proficiency: learn on first use; stops at the tier's cap until the trial is passed
  function train(st, id, xp) {
    data(st); const S = SKILLS[id]; if (!S || !(xp > 0)) return null;
    let s = st.skills[id]; const fresh = !s;
    if (!s) s = st.skills[id] = { tier: 1, xp: 0 };
    const cap = TIERS[s.tier - 1].cap;
    if (cap) s.xp = Math.min(cap, s.xp + xp);
    if (fresh) { if (S.type === 'active' && !st.activeSkill) st.activeSkill = id; recalc(st); return 'ได้สกิลใหม่ "' + S.name + '"'; }
    if (cap && s.xp >= cap && !st.trials[id]) { st.trials[id] = { offered: true, accepted: false, done: 0 }; return 'ความชำนาญ ' + S.name + ' เต็มขั้น — ' + S.teacher + 'มีภารกิจเลื่อนขั้นให้'; }
    return null;
  }
  const trialOf = (st, id) => { const s = st.skills[id]; return s && s.tier < 5 ? SKILLS[id].trial(s.tier) : null; };
  function accept(st, id) { data(st); const T = st.trials[id]; if (!T) return false; T.accepted = true; T.done = 0; return true; }
  // something happened that a trial may be waiting for. Returns messages (promotions).
  function progress(st, kind, value) {
    data(st); const out = [];
    for (const [id, T] of Object.entries(st.trials)) {
      if (!T.accepted) continue;
      const spec = trialOf(st, id); if (!spec || spec.on !== kind) continue;
      if (spec.min !== undefined && !(value >= spec.min)) continue;
      T.done++;
      if (T.done >= spec.need) {
        const s = st.skills[id]; s.tier++; s.xp = 0; delete st.trials[id]; recalc(st);
        out.push('ผ่านภารกิจเลื่อนขั้น! ' + SKILLS[id].name + ' ขึ้นเป็นขั้น' + TIERS[s.tier - 1].name);
      }
    }
    return out;
  }
  function earnTitle(st, id) { data(st); if (!TITLES[id] || st.titles.includes(id)) return null; st.titles.push(id); return 'ได้ฉายา "' + TITLES[id].name + '"'; }
  function wearTitle(st, id) { data(st); if (!st.titles.includes(id)) return false; st.title = id; recalc(st); return true; }

  const activeOf = st => { data(st); return st.activeSkill && st.skills[st.activeSkill] ? st.activeSkill : null; };
  function selectActive(st, id) {
    data(st);
    if (id !== null && (!SKILLS[id] || SKILLS[id].type !== 'active' || !st.skills[id])) return false;
    st.activeSkill = id; return true;
  }
  const BOOK_SKILL = Object.freeze({ book_fire: 'fire', book_ice: 'ice', book_sense: 'dangerSense' });
  function readBook(st, book) {
    data(st);
    const id = BOOK_SKILL[book];
    if (!id) return { ok: false, why: 'ไม่ใช่ตำราที่อ่านได้' };
    if (st.skills[id]) return { ok: false, why: 'เรียนสกิลนี้แล้ว' };
    // Skills does not mutate Bag; its Node/browser dependency is injected via the same module loaded by LifeSim.
    const B = (typeof globalThis !== 'undefined' && globalThis.Bag) || (typeof require === 'function' ? require('./bag.js') : null);
    if (!B || !B.count(st, book)) return { ok: false, why: 'ไม่มีตำราในกระเป๋า' };
    if (!B.take(st, book, 1)) return { ok: false, why: 'ใช้ตำราไม่สำเร็จ' };
    const notice = train(st, id, 1);
    return { ok: true, why: (notice || 'ได้สกิล ' + SKILLS[id].name) + (SKILLS[id].type === 'active' ? ' · เลือกใช้ในแท็บสกิล' : '') };
  }

  // ---- combat: stats + selected active skill + weapon/armor against a monster's power
  function power(st) {
    data(st); const w = GEAR[st.equip.weapon], a = GEAR[st.equip.armor], id = activeOf(st), sk = id && st.skills[id];
    return Math.round(st.strength + 0.6 * st.agility + 0.25 * st.intelligence + (w ? w.atk : 0) + (a ? a.def * 0.6 : 0) + (sk ? SKILLS[id].power[sk.tier - 1] : 0));
  }
  // chance to win against `mon` (power) with `ally` power fighting alongside: 1 / (1 + (m/h)^3)
  //   hero 50 vs rabbit 10 → 99.2% · equal → 50% · half as strong → 11%
  const winChance = (h, m) => 1 / (1 + Math.pow(Math.max(1, m) / Math.max(1, h), 3));
  // r: rolls 0..1 (deterministic per day in the caller). slot: optional shift (−0.15..+0.15) from the combat reels
  function fight(st, mon, ally, r1, r2, slot) {
    const h = power(st) + (ally || 0), p = clamp(winChance(h, mon.power) + (slot || 0), 0.005, 0.995);
    if (r1 < p) return { win: true, p, hurt: r2 < 0.25 * (1 - p) * 2 };
    // lost: how bad? the further outmatched, the likelier it turns deadly
    const deadly = r2 < clamp(0.15 * Math.pow(mon.power / Math.max(1, h), 2), 0.002, 0.6);
    return { win: false, p, deadly };
  }
  // defeat with someone strong at your side: they drag you out — half the money, half the gear, stats halved while wounded
  function rescuePenalty(st, days) {
    data(st);
    const money = Math.floor((st.money || 0) / 2); st.money -= money;
    const worn = Object.keys(SLOTS).filter(k => st.equip[k]), gear = [];
    for (const k of worn.slice(0, Math.ceil(worn.length / 2))) { gear.push(st.equip[k]); delete st.equip[k]; }
    st.wounds.until = (st.day || 1) + (days || 6);
    recalc(st);
    return { money, gear, until: st.wounds.until };
  }
  return { TIERS, SKILLS, TITLES, GEAR, SLOTS, STAT_NAME, data, bonus, recalc, train, trialOf, accept, progress, earnTitle, wearTitle, tierOf,
    power, winChance, fight, rescuePenalty, activeOf, selectActive, readBook, BOOK_SKILL };
});
