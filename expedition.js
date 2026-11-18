/* v110 the tower works like this (ผู้สร้าง): you always enter at floor 1 and are dropped somewhere on it, usually with your
   party, sometimes on your own. There is no going home by choice: the only ways off a floor are a ศิลาทางออก (back to
   town) or a ศิลาทางขึ้น (up to the next floor), and they have to be found. The tower is huge — food grows and walks
   there (fruit, beasts), and some people have been stuck on a floor for a very long time.
   v109 expeditions into the tower (ช่วง 2).
   The player prepares (supplies, party), the hero sets off the next morning and lives in the tower day after day while
   the town's clock keeps running. Each day has encounters at fixed times: the game shows a choice, the choice shifts the
   symbol weights, then three reels (tower-slot-engine.js) decide what happens. Nights at camp eat one meal; sometimes
   something attacks in the dark. A deadly defeat with a party at your side = dragged out with the rescue penalty;
   alone = death.  Pure rules: every roll is seeded by the day and slot, so a reload never changes an outcome. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Expedition = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const need = (g, f) => (root && root[g]) || (typeof require === 'function' ? require(f) : null);
  const Engine = need('TowerSlotEngine', './tower-slot-engine.js'), Skills = need('Skills', './skills.js'), Bag = need('Bag', './bag.js');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---- the tower, floor by floor (phase 3 will grow this)
  const TERRAINS = [
    { upto: 3, name: 'ทุ่งหญ้าชั้นล่าง', scenes: { explore: 3, herb: 3, travel: 2, combat: 3 },
      monsters: [['กระต่ายเขาเดียว', 10], ['หมาป่าเงา', 22], ['ก๊อบลินถือขวาน', 30]] },
    { upto: 6, name: 'ป่าเห็ดเรืองแสง', scenes: { herb: 3, explore: 2, combat: 3, mine: 1 },
      monsters: [['ทากกรด', 38], ['แมงมุมสปอร์', 46], ['หมาป่าเงาฝูง', 52]] },
    { upto: 9, name: 'ถ้ำสายแร่', scenes: { mine: 4, explore: 2, combat: 3 },
      monsters: [['ค้างคาวยักษ์', 58], ['หมีหิน', 68], ['หนอนเจาะหิน', 76]] },
    { upto: 99, name: 'ซากเมืองโบราณ', scenes: { explore: 3, combat: 4, mine: 1 },
      monsters: [['อัศวินผี', 88], ['การ์กอยล์', 100], ['ผู้เฝ้าซาก', 120]] }
  ];
  const terrainOf = floor => TERRAINS.find(t => floor <= t.upto);
  // the first floor of each terrain only has its weaker beasts
  function monsterOf(st, floor, id) {
    const T = terrainOf(floor), first = TERRAINS.indexOf(T) ? TERRAINS[TERRAINS.indexOf(T) - 1].upto + 1 : 1;
    const pool = T.monsters.slice(0, Math.min(T.monsters.length, 2 + floor - first));
    const m = pool[Math.floor(hash(seed(st), id, 'm') * pool.length)];
    return { name: m[0], power: m[1] + floor * 2 };
  }
  // who comes along: a guild party (by path) or a hired guard; their power fights beside yours, and they can save your life
  const PARTY = { guild: { name: 'ทีมนักรบโล่เหล็ก', power: 55 }, compass: { name: 'ทีมสำรวจเข็มทิศเงิน', power: 30 }, porter: { name: 'ขบวนคนแบกกับทีมนักรบ', power: 45 },
    guard: { name: 'นักรบรับจ้าง', power: 25 } };
  const GUARD_FEE = 10;                                  // per day, paid up front
  const SLOTS_OF_DAY = [['x1', 7.0], ['x2', 10.0], ['x3', 13.0], ['xcamp', 15.6]];
  const CAMP_SLEEP = 50 / 3;                             // 20:00

  // ---- choices: label, hint, symbol weights; deeper = go down a floor when the reels allow
  const CHOICES = {
    explore: [
      { label: 'สำรวจทางหลักอย่างระวัง', hint: '🧭 มากขึ้น · ⚠️ 🕳️ น้อยลง', w: { compass: 1.5, tracks: 1.3, danger: 0.55, hole: 0.55, chest: 0.8 } },
      { label: 'ลัดเข้าทางแยกมืด', hint: '📦 🗝️ 📜 มากขึ้น · ⚠️ 🕳️ 👁️ มากขึ้น', w: { chest: 2.2, key: 2, scroll: 1.6, danger: 1.6, hole: 1.6, eye: 1.4 } },
      { label: 'ตามหาศิลา', hint: '🧭 👣 มากขึ้นมาก (หาศิลาเร็วขึ้น) · 🕳️ ⚠️ มากขึ้น', w: { compass: 2.4, tracks: 1.8, scroll: 1.3, hole: 1.6, danger: 1.3 }, search: 2 }],
    herb: [
      { label: 'เก็บเฉพาะที่รู้จัก', hint: '🌿 มากขึ้น · ☠️ น้อยลง', w: { herb: 1.7, poison: 0.35, mushroom: 0.6 } },
      { label: 'เก็บเห็ดแปลก ๆ ด้วย', hint: '🍄 ✨ มากขึ้น · ☠️ มากขึ้น', w: { mushroom: 2.3, magic: 1.6, orb: 1.4, poison: 1.8 } },
      { label: 'หาผลไม้กินได้', hint: 'ได้ผลไม้ป่าเป็นเสบียง · 🌿 🍀 มากขึ้น', w: { herb: 1.4, luck: 1.6, poison: 0.7 }, fruit: true }],
    mine: [
      { label: 'ขุดผิวสายแร่', hint: '⛏️ มากขึ้น · ⚠️ น้อยลง', w: { mine: 1.7, danger: 0.5, gem: 0.6, hole: 0.6 } },
      { label: 'ขุดลึกเข้าไป', hint: '💎 มากขึ้น · ⚠️ 🕳️ มากขึ้น', w: { gem: 2.4, mine: 1.2, danger: 1.8, hole: 1.5 } },
      { label: 'ตามแสงในรอยแยก', hint: '🔮 ✨ 🌀 มากขึ้น', w: { orb: 2.2, magic: 2, vortex: 1.6, hole: 1.4 } }],
    travel: [
      { label: 'เดินตามทีม', hint: '🤝 มากขึ้น · ⚠️ น้อยลง', w: { ally: 1.6, danger: 0.65, hole: 0.7 } },
      { label: 'แยกไปทางลัด', hint: '🧭 มากขึ้น (หาศิลาเร็วขึ้น) · 🕳️ ⚠️ มากขึ้น · อาจหลงจากทีม', w: { compass: 2.2, hole: 1.6, danger: 1.5, vortex: 1.3 }, search: 1 }],
    combat: [
      { label: 'บุกเข้าใส่', hint: '⚔️ 🎯 ⚡ มากขึ้น · 🩸 มากขึ้น', w: { sword: 1.8, target: 1.5, speed: 1.4, danger: 1.25, blood: 1.3 } },
      { label: 'ล่าเป็นอาหาร', hint: '⚔️ 🎯 มากขึ้น · ชนะแล้วได้เนื้อ', w: { sword: 1.5, target: 1.8, danger: 1.2 }, hunt: true },
      { label: 'ตั้งรับรอจังหวะ', hint: '🛡️ 💨 มากขึ้น · ⚔️ น้อยลง', w: { shield: 1.9, dodge: 1.6, sword: 0.7, blood: 0.7 } },
      { label: 'ถอยหนี', hint: 'ได้ 💨 ⚡ = หนีพ้น ไม่ได้ของ', w: { dodge: 3, speed: 2, sword: 0.3, target: 0.3 }, flee: true }],
    camp: [
      { label: 'ตื่นขึ้นสู้', hint: 'สู้ด้วยพลังเต็มที่', w: { shield: 1.3, sword: 1.3 } },
      { label: 'คว้าของแล้ววิ่ง', hint: 'ได้ 💨 ⚡ = หนีพ้น · เสียเสบียง 1', w: { dodge: 3, speed: 2, sword: 0.3 }, flee: true }]
  };

  // ---- state
  const X = st => st.life && st.life.exp;
  const active = st => { const x = X(st); return !!(x && !x.over && st.day >= x.start); };
  const planned = st => { const x = X(st); return !!(x && !x.over && st.day < x.start); };
  function hash(...a) { let h = 2166136261; for (const c of a.join(':')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
  const seed = st => (st.life && st.life.age || 0) + ':' + (st.life && st.life.origin || '');
  // how much searching it takes to come across a stone on this floor (the tower is huge; higher floors are bigger)
  const needOf = floor => 8 + floor * 3;
  const SLOT_T = Object.fromEntries(SLOTS_OF_DAY);
  // set off tomorrow morning; you always enter at floor 1
  function plan(st, opts) {
    const L = st.life, party = opts.party && PARTY[opts.party] ? opts.party : null;
    if (party === 'guard') { if (st.money < GUARD_FEE * 5) return { ok: false, why: 'เงินไม่พอจ้างนักรบ (มัดจำ ' + GUARD_FEE * 5 + ' เหรียญ)' }; st.money -= GUARD_FEE * 5; }
    L.exp = { start: st.day + 1, party, separated: false, floor: 1, highest: 1, search: 0, stones: {}, exitDay: 0, exitT: 0,
      over: false, pending: null, done: {}, hunted: false, log: [], wins: 0, loot: {}, guardPaid: 5, ally: null, path: L.path };
    return { ok: true, start: L.exp.start };
  }
  function cancel(st) { const x = X(st); if (x && !active(st)) { if (x.party === 'guard') st.money += GUARD_FEE * 5; st.life.exp = null; return true; } return false; }
  const withTeam = st => { const x = X(st); return !!(x && x.party && !x.separated); };
  const allyPower = st => { const x = X(st); return (withTeam(st) ? PARTY[x.party].power + Math.round((x.floor - 1) * 1.5) : 0) + (x && x.ally ? x.ally.power : 0); };
  // the moment you step through the gate: dropped somewhere on floor 1, maybe away from your party
  function enter(st) {
    const x = X(st);
    if (x.party && hash(seed(st), st.day, 'enter') < 0.2) { x.separated = true; return 'แสงจากประตูหอคอยพาคุณไปโผล่ที่ไหนสักแห่งในชั้น 1 ... ไม่เห็น' + PARTY[x.party].name + 'เลย ต้องหาศิลาทางออกเองหรือตามหาทีม'; }
    return 'เข้าหอคอย โผล่กลางชั้น 1 ' + terrainOf(1).name + (x.party ? ' พร้อม' + PARTY[x.party].name : ' คนเดียว') + ' · ต้องหาศิลาทางออกหรือศิลาทางขึ้นจึงจะไปต่อได้';
  }
  const stonesHere = st => { const x = X(st), k = x.stones[x.floor] || {}; return k; };
  // ---- today's encounter at a slot (deterministic)
  function encounter(st, slot) {
    const x = X(st); if (!x || x.over || (x.exitDay === st.day)) return null;
    const T = terrainOf(x.floor), id = st.day + '-' + slot, r = hash(seed(st), id);
    // a stone you know of on this floor: offered each morning and right after finding one
    const K = stonesHere(st);
    if ((K.exit || K.up) && (slot === 'x1' || x.justFound) && slot !== 'xcamp') {
      x.justFound = false;
      const choices = [];
      if (K.exit) choices.push({ label: 'ใช้ศิลาทางออก กลับเมือง', hint: 'ออกจากหอคอย ถึงประตูหอคอยวันนี้', use: 'exit' });
      if (K.up) choices.push({ label: 'ใช้ศิลาทางขึ้น ไปชั้น ' + (x.floor + 1), hint: terrainOf(x.floor + 1).name + ' · มอนสเตอร์แรงขึ้น · อาจหลุดจากทีม', use: 'up' });
      choices.push({ label: 'สำรวจชั้นนี้ต่อ', hint: 'จำตำแหน่งศิลาไว้ กลับมาใช้ได้ทุกเช้า', use: 'stay' });
      return { id, slot, scene: 'stone', kind: 'stone', noSpin: true, title: 'ศิลาในชั้น ' + x.floor,
        text: [K.exit && 'ศิลาทางออกเรืองแสงสีฟ้า', K.up && 'ศิลาทางขึ้นเรืองแสงสีทอง'].filter(Boolean).join(' · ') + ' อยู่ไม่ไกลจากค่าย', choices };
    }
    // someone stuck on this floor for a long time (floor 2 and up, rare)
    if (slot !== 'xcamp' && x.floor >= 2 && !x.metStranded && hash(seed(st), id, 'stranded') < 0.07) {
      x.metStranded = st.day;
      const years = 1 + Math.floor(hash(seed(st), id, 'y') * 9);
      return { id, slot, scene: 'explore', kind: 'stranded', title: 'คนที่ติดอยู่ในชั้น ' + x.floor,
        text: 'ชายผมยาวรุงรังนั่งข้างกองไฟเล็ก ๆ "ข้าติดอยู่ที่นี่มา ' + years + ' ปีแล้ว... ไม่เคยเจอศิลาเลยสักก้อน"',
        choices: [{ label: 'แบ่งอาหารให้ แล้วชวนไปด้วยกัน', hint: 'เสีย 1 มื้อ · เขาร่วมทาง (พลัง +18) และบอกทางที่เคยเดิน', noSpin: true, share: true },
                  { label: 'ถามทางที่เขาเคยสำรวจ', hint: '🧭 📜 มากขึ้น', w: { compass: 2, scroll: 2, tracks: 1.5 }, search: 1 },
                  { label: 'เดินผ่านไป', hint: 'ไม่มีอะไรเกิดขึ้น', noSpin: true }] };
    }
    if (slot === 'xcamp') {
      const attackP = clamp(0.12 + x.floor * 0.02 + (x.hunted ? 0.25 : 0) - (x.party ? 0.06 : 0), 0.05, 0.6);
      if (r >= attackP) return null;                     // a quiet night
      const m = monsterOf(st, x.floor, id);
      return { id, slot, scene: 'combat', kind: 'camp', beast: true, title: 'ถูกลอบโจมตีตอนหลับ', text: 'เสียงกิ่งไม้หักข้างกองไฟ ' + m.name + 'โผล่มาจากความมืด!',
        monster: m, choices: CHOICES.camp };
    }
    let scene = 'combat';
    if (!x.hunted) {
      const tot = Object.values(T.scenes).reduce((a, b) => a + b, 0); let n = r * tot;
      for (const [k, w] of Object.entries(T.scenes)) { n -= w; if (n < 0) { scene = k; break; } }
    }
    if (scene === 'combat') {
      const m = monsterOf(st, x.floor, id);
      return { id, slot, scene, kind: 'combat', beast: hash(seed(st), id, 'b') < 0.6, title: (x.hunted ? 'สิ่งที่ตามมาโผล่ออกมา' : 'เจอมอนสเตอร์') + ' · ชั้น ' + x.floor, text: m.name + ' (พลัง ' + m.power + ') ขวางทางอยู่',
        monster: m, choices: CHOICES.combat };
    }
    const TXT = { explore: ['ทางแยกในหอคอย', 'ทางเดินแยกออกเป็นหลายสาย มีลมเย็นพัดมาจากทางหนึ่ง'], herb: ['ดงพืชในหอคอย', 'พืชแปลกตาขึ้นเต็มซอกหิน บางต้นเรืองแสงอ่อน ๆ'],
      mine: ['สายแร่บนผนัง', 'ผนังหินมีเส้นแร่สีเงินพาดผ่าน'], travel: ['ระหว่างเดินทาง', 'ทีมเดินผ่านทางยาวที่ไม่มีใครทำแผนที่ไว้'] }[scene];
    const choices = scene === 'travel' && !withTeam(st) ? [Object.assign({}, CHOICES.travel[0], { label: 'เดินอย่างระวังตัว', hint: '⚠️ 🕳️ น้อยลง · 🤝 อาจเจอคนช่วยหรือทีม' })].concat(CHOICES.travel.slice(1)) : CHOICES[scene];
    return { id, slot, scene, kind: 'event', title: TXT[0] + ' · ชั้น ' + x.floor + ' ' + T.name, text: TXT[1], choices };
  }
  // what the player sees on each choice button
  const choiceView = enc => enc.choices.map((c, i) => ({ index: i, label: c.label, hint: c.hint, noSpin: !!(c.noSpin || enc.noSpin) }));
  // choices that need no reels: using a stone, sharing food with someone stranded, walking on
  function decide(st, enc, index) {
    const x = X(st), c = enc.choices[index] || enc.choices[0], lines = [];
    x.done[enc.slot + '@' + st.day] = true; x.pending = null;
    const res = { reels: null, title: c.label, description: '', lines, fatal: false, dead: false };
    if (c.use === 'exit') { x.exitDay = st.day; x.exitT = (SLOT_T[enc.slot] || 7) + 0.3; lines.push('แตะศิลาทางออก แสงสีฟ้าพาคุณ' + (withTeam(st) ? 'และทีม' : '') + 'กลับไปที่ประตูหอคอย'); }
    else if (c.use === 'up') {
      x.floor++; x.highest = Math.max(x.highest, x.floor); x.search = 0;
      lines.push('แตะศิลาทางขึ้น ... โผล่ที่ชั้น ' + x.floor + ' ' + terrainOf(x.floor).name);
      if (x.party && !x.separated && hash(seed(st), enc.id, 'sep') < 0.12) { x.separated = true; lines.push('ทีมไม่ได้ตามขึ้นมาด้วย ต้องเอาตัวรอดคนเดียว'); }
      if (Skills) lines.push(...Skills.progress(st, 'deep_map'));
    }
    else if (c.use === 'stay') lines.push('จำตำแหน่งศิลาไว้ แล้วสำรวจต่อ');
    else if (c.share) {
      const id = Bag && Bag.eat(st);
      if (id) { x.ally = { name: 'ผู้ติดค้าง', power: 18 }; x.search += 4; lines.push('แบ่ง' + Bag.name(id) + 'ให้ เขาขอร่วมทางและเล่าทางที่เคยเดิน (ค้นหา +4)'); }
      else lines.push('ไม่มีอะไรจะแบ่ง เขาพยักหน้าเข้าใจแล้วเดินจากไป');
    } else lines.push('เดินผ่านไปเงียบ ๆ');
    return finish(st, res);
  }

  // stats and skills shift the reels a little more (on top of the choice)
  function statWeights(st, scene) {
    const w = {}, g = Skills.tierOf(st, 'gathering'), m = Skills.tierOf(st, 'mapping'), sw = Skills.tierOf(st, 'sword');
    const careful = 1 - clamp((st.agility || 15) / 300, 0, 0.3);
    if (scene === 'combat') { Object.assign(w, { sword: 1 + 0.08 * sw, skill: 1 + 0.15 * sw, danger: careful, blood: careful, stagger: careful }); }
    else {
      Object.assign(w, { danger: careful, hole: careful, poison: careful - 0.05 * Skills.tierOf(st, 'keen') });
      if (scene === 'herb' || scene === 'mine') Object.assign(w, { herb: 1 + 0.12 * g, mushroom: 1 + 0.1 * g, mine: 1 + 0.12 * g, gem: 1 + 0.1 * g });
      if (scene === 'explore' || scene === 'travel') Object.assign(w, { compass: 1 + 0.12 * m, tracks: 1 + 0.1 * m, chest: 1 + 0.05 * m });
    }
    return w;
  }
  function mergeWeights(a, b) { const o = Object.assign({}, a); for (const k in b) o[k] = (o[k] === undefined ? 1 : o[k]) * b[k]; return o; }

  // ---- resolve: spin, then turn the reels into real changes. Returns what the UI shows.
  function resolve(st, enc, index) {
    const x0 = enc.choices[index] || enc.choices[0];
    if (enc.noSpin || x0.noSpin) return decide(st, enc, index);
    const x = X(st), c = x0, T = terrainOf(x.floor);
    const engineScene = enc.scene === 'combat' ? 'combat' : enc.scene;
    const ctx = engineScene === 'combat' ? { hasActiveSkill: !!(st.skills && st.skills.sword), allyNearby: !!x.party, elementalFire: false, elementalIce: false, lethalPossible: true }
      : { oreQuality: x.floor >= 4 ? 3 : 2, hiddenCache: true, hiddenPassage: true, creatureNearby: true, allyNearby: !!x.party, magicPresence: x.floor >= 3, hazardLevel: 1 + Math.floor(x.floor / 4), poisonPresence: engineScene === 'herb' || x.floor >= 4, fireRisk: x.floor >= 7, lethalPossible: true };
    const out = Engine.spin(engineScene, { worldSeed: seed(st), eventId: enc.id + ':' + index, context: ctx, weights: mergeWeights(c.w, statWeights(st, engineScene)) });
    const n = id => out.reels.filter(r => r === id).length, lines = [];
    const gain = (id, k) => { if (!(k > 0) || !Bag) return;
      let got = Bag.add(st, id, k, st.day);
      if (!got && Bag.ITEMS[id].kind === 'meal') {            // food matters more than loot: drop the cheapest non-food thing
        const junk = Bag.list(st).filter(s => Bag.ITEMS[s.id] && Bag.ITEMS[s.id].kind !== 'meal' && s.id !== 'potion').sort((a, b) => (Bag.ITEMS[a.id].sell || 0) - (Bag.ITEMS[b.id].sell || 0))[0];
        if (junk) { Bag.take(st, junk.id, 1); lines.push('ทิ้ง' + Bag.name(junk.id) + 'เพื่อเก็บของกิน'); got = Bag.add(st, id, k, st.day); }
      }
      if (got) { x.loot[id] = (x.loot[id] || 0) + got; lines.push(Bag.name(id) + ' +' + got); } else lines.push('กระเป๋าเต็ม ทิ้ง' + Bag.name(id)); };
    const hurt = (d, why) => { st.health = Math.max(1, st.health - d); lines.push(why + ' (สุขภาพ −' + d + ')'); };
    const learn = (id, xp) => { const m = Skills.train(st, id, xp); if (m) lines.push(m); };
    const res = { reels: out.reels, kind: out.kind, title: out.title, description: out.source === 'automatic' ? '' : out.description, lines, fatal: false, dead: false, rescued: false };
    x.done[enc.slot + '@' + st.day] = true; x.pending = null;
    if (out.fatal) return fatal(st, res, 'หายนะในหอคอย');
    if (n('skull') === 2) hurt(30, 'เฉียดตาย');

    if (enc.scene === 'combat') {
      const sig = (ids) => ids.reduce((a, id) => a + n(id), 0);
      const att = sig(['sword', 'target', 'speed', 'skill']), def = sig(['shield', 'dodge', 'ally', 'luck']), bad = sig(['danger', 'blood', 'stagger']);
      if (c.flee && sig(['dodge', 'speed']) >= 1 && bad === 0) {
        if (enc.kind === 'camp' && Bag) { const id = Bag.eat(st); if (id) lines.push('ทิ้ง' + Bag.name(id) + 'ไว้ข้างหลัง'); }
        if (x.party && !x.separated && hash(seed(st), enc.id, 'flee') < 0.3) { x.separated = true; lines.push('วิ่งหนีจนหลงจากทีม'); }
        lines.push('หนีพ้น' + enc.monster.name); learn('nimble', 2); x.hunted = false;
        return finish(st, res);
      }
      const shift = clamp(0.05 * (att + def) + (n('skill') ? 0.08 : 0) - 0.06 * bad - (c.flee ? 0.1 : 0), -0.25, 0.25);
      const f = Skills.fight(st, enc.monster, allyPower(st), hash(seed(st), enc.id, 'f1'), hash(seed(st), enc.id, 'f2'), shift);
      res.fight = { p: Math.round(f.p * 100), win: f.win, power: Skills.power(st) + allyPower(st), monster: enc.monster.power };
      x.hunted = false;
      if (f.win) {
        x.wins++; st.towerWins = (st.towerWins || 0) + 1;
        lines.push('ชนะ' + enc.monster.name + ' (โอกาสชนะ ' + res.fight.p + '%)');
        gain('monster', 1 + (x.floor >= 4 ? 1 : 0) + (n('target') >= 2 ? 1 : 0));
        if (enc.beast && (c.hunt || hash(seed(st), enc.id, 'meat') < 0.4)) gain('meat', c.hunt ? 2 : 1);
        learn('sword', 2 + (enc.monster.power > Skills.power(st) ? 2 : 0)); learn('nimble', 1);
        lines.push(...Skills.progress(st, 'win', enc.monster.power)); if (!f.hurt) lines.push(...Skills.progress(st, 'clean_win'));
        if (st.towerWins >= 15) { const t = Skills.earnTitle(st, 'slayer'); if (t) lines.push(t); }
        if (f.hurt || n('blood')) hurt(6 + x.floor, 'โดนข่วนระหว่างสู้');
      } else if (f.deadly) return fatal(st, res, enc.monster.name);
      else { learn('sword', 1); hurt(12 + x.floor * 2, 'แพ้' + enc.monster.name + ' ต้องถอยหนี'); }
      return finish(st, res);
    }
    // ---- events
    const F = x.floor, coin = k => { if (k > 0) { st.money += k; x.loot.coin = (x.loot.coin || 0) + k; lines.push('เหรียญ +' + k); } };
    if (enc.scene === 'mine') { gain('ore', n('mine') ? n('mine') + Math.floor(F / 4) : 0); gain('crystal', n('gem')); learn('gathering', 2); }
    if (enc.scene === 'herb') { if (c.fruit) gain('fruit', 1 + n('herb') + n('luck')); else gain('herb', n('herb') + n('mushroom')); learn('gathering', 2); }
    if (enc.scene === 'explore' || enc.scene === 'travel') learn('mapping', 2);
    if (n('chest')) { coin((3 + F * 2) * n('chest') + (n('key') ? 6 + F * 2 : 0)); if (n('key') && hash(seed(st), enc.id, 'potion') < 0.5) gain('potion', 1); }
    if (n('scroll')) { learn('keen', 3 * n('scroll')); lines.push('อ่านบันทึกเก่าของนักสำรวจ'); }
    if (n('tracks')) learn('mapping', n('tracks'));
    if (n('luck')) coin(2 * F * n('luck'));
    if (n('ally') && !x.separated) { st.health = Math.min(100, st.health + 12); lines.push('มีคนช่วยทำแผลให้ (สุขภาพ +12)'); }
    if (n('magic') + n('orb')) gain('crystal', n('orb') + (n('magic') >= 2 ? 1 : 0));
    // searching for a stone: compass, tracks, scrolls and keys, the choice and the mapping skill all count
    const found = 2 * n('compass') + n('tracks') + n('scroll') + n('key') + (c.search || 0) + Skills.tierOf(st, 'mapping');
    if (found > 0) { x.search += found; lines.push('ค้นหาศิลา +' + found + ' (' + Math.min(x.search, needOf(x.floor)) + '/' + needOf(x.floor) + ')'); }
    if (x.search >= needOf(x.floor)) {
      const K = x.stones[x.floor] = x.stones[x.floor] || {}, kind = !K.exit && !K.up ? (hash(seed(st), enc.id, 'stone') < 0.5 ? 'exit' : 'up') : K.exit ? 'up' : 'exit';
      K[kind] = true; x.search = 0; x.justFound = true;
      lines.push(kind === 'exit' ? '✦ พบศิลาทางออก!' : '✦ พบศิลาทางขึ้น!');
    }
    if (n('vortex')) { lines.push('พื้นที่บิดเบี้ยว ถูกพาไปอีกมุมของชั้น'); x.search = Math.max(0, x.search - 3); if (x.party && !x.separated && hash(seed(st), enc.id, 'v') < 0.5) { x.separated = true; lines.push('หลงจากทีม!'); } }
    if (n('hole') >= 2 && x.party && !x.separated) { x.separated = true; lines.push('ร่วงลงโพรงลึก หลงจากทีม!'); }
    if (x.separated && (n('ally') || n('tracks') >= 2)) { if (hash(seed(st), enc.id, 'rejoin') < 0.6 + 0.2 * n('ally')) { x.separated = false; lines.push('ได้ยินเสียงเรียก... กลับมารวมกับ' + PARTY[x.party].name + 'ได้แล้ว'); } }
    if (n('danger')) hurt((5 + F) * n('danger'), 'อุบัติเหตุ');
    if (n('hole')) { hurt(7 * n('hole'), 'พลัดตกหลุม'); }
    if (n('poison')) hurt(8 * n('poison') - Skills.tierOf(st, 'keen'), 'โดนพิษ');
    if (n('fire')) { hurt(8, 'โดนไฟลวก'); if (Bag) { const id = Bag.eat(st); if (id) lines.push(Bag.name(id) + 'ไหม้ไป 1'); } }
    if (n('eye')) { x.hunted = true; lines.push('มีบางอย่างตามมา...'); }
    if (!lines.length) lines.push('ไม่มีอะไรเกิดขึ้น');
    return finish(st, res);
  }
  function fatal(st, res, cause) {
    const x = X(st);
    if (withTeam(st) || x.ally) {
      const p = Skills.rescuePenalty(st, 6); st.health = Math.max(1, Math.min(st.health, 15));
      res.rescued = true; res.lines.push((withTeam(st) ? PARTY[x.party].name : x.ally.name) + 'ลากคุณหนีออกมาได้ทัน', 'เสียเงิน ' + p.money + ' เหรียญ' + (p.gear.length ? ' และ' + p.gear.map(id => Bag ? Bag.name(id) : id).join(' ') : ''), 'ค่าสถานะลดครึ่งถึงวันที่ ' + p.until);
      const t = Skills.earnTitle(st, 'survivor'); if (t) res.lines.push(t);
      if (x.ally && !withTeam(st)) x.ally = null;          // the stranded companion doesn't survive saving you
      return finish(st, res);
    }
    res.dead = true; res.lines.push('ไม่มีใครอยู่ช่วย... ' + cause + 'คือสิ่งสุดท้ายที่เห็น');
    st.life.dead = { day: st.day, floor: x.floor, cause }; x.over = true;
    return res;
  }
  function finish(st, res) {
    const x = X(st);
    // a potion when badly hurt; going home when it gets too dangerous
    if (st.health < 40 && Bag && Bag.count(st, 'potion')) { Bag.take(st, 'potion', 1); st.health = Math.min(100, st.health + 30); res.lines.push('ดื่มยาฟื้นแรง (สุขภาพ +30)'); }
    if (st.health < 25) res.lines.push('บาดเจ็บหนัก ต้องหาศิลาทางออกให้เจอ');
    x.log.unshift({ day: st.day, title: res.title, lines: res.lines.slice(0, 4) }); x.log = x.log.slice(0, 12);
    return res;
  }
  // night at camp: one meal from the bag; nothing to eat = weaker; out of food = go home
  function camp(st) {
    const x = X(st), out = [];
    const id = Bag ? Bag.eat(st) : null;
    if (id) out.push('กิน' + Bag.name(id) + 'ข้างกองไฟ');
    else if (withTeam(st)) { st.health = Math.max(1, st.health - 3); out.push('ไม่มีอะไรกิน ทีมแบ่งเสบียงให้นิดหน่อย (สุขภาพ −3)'); }
    else {
      st.health = Math.max(0, st.health - 12); out.push('ไม่มีอะไรกิน หิวจนตาลาย (สุขภาพ −12)');
      if (st.health <= 0) { st.life.dead = { day: st.day, floor: x.floor, cause: 'อดอาหารในหอคอย' }; x.over = true; out.push('...'); return out.join(' · '); }
    }
    st.health = Math.max(1, st.health);
    if (Bag && !Bag.meals(st)) out.push('เสบียงหมดแล้ว ต้องหาผลไม้หรือล่าสัตว์กิน');
    if (x.separated) out.push('คืนนี้นอนคนเดียว');
    st.life.sleptAt = 'tower'; st.life.roomSlept = null;
    return out.join(' · ');
  }
  // the day the hero walks out: report what came home
  function close(st) {
    const x = X(st); if (!x) return null; x.over = true;
    // a guild member's party pays for every day inside (by the guild's rate); a hired guard's deposit covers 5 days
    const days = st.day - x.start + 1;
    const RATE = { guild: 14, compass: 6 + Math.floor((st.intelligence || 15) / 10), porter: 9 };
    if (x.party && RATE[x.party]) { const pay = RATE[x.party] * days; st.money += pay; x.loot.coin = (x.loot.coin || 0) + pay; }
    if (x.party === 'porter') st.porterTrips = (st.porterTrips || 0) + days;
    if (x.party === 'guard' && days > 5) { const due = Math.min(st.money, GUARD_FEE * (days - 5)); st.money -= due; x.why = 'จ่ายค่าจ้างนักรบเพิ่ม ' + due + ' เหรียญ'; }
    const L = Object.entries(x.loot).map(([id, k]) => (id === 'coin' ? 'เหรียญ' : Bag ? Bag.name(id) : id) + ' ' + k);
    return 'ออกจากหอคอยทางศิลาทางออก (' + days + ' วัน สูงสุดชั้น ' + x.highest + ' ชนะ ' + x.wins + ' ครั้ง)' + (L.length ? ' ได้ ' + L.join(', ') : '') + (x.why ? ' · ' + x.why : '');
  }
  return { TERRAINS, PARTY, GUARD_FEE, CHOICES, SLOTS_OF_DAY, CAMP_SLEEP, terrainOf, needOf, active, planned, plan, cancel, enter, withTeam, allyPower,
    encounter, choiceView, resolve, camp, close, X };
});
