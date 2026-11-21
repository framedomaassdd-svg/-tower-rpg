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
  const Engine = need('TowerSlotEngine', './tower-slot-engine.js'), Skills = need('Skills', './skills.js'), Bag = need('Bag', './bag.js'), MainStory = need('MainStory', './main-story.js'), Regions = need('TowerRegions', './tower-regions.js');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---- v111 real floor map, world ecology, and safe zones
  const TERRAINS = [
    { upto: 3, name: 'ทุ่งหญ้าชั้นล่าง', scenes: { explore: 3, herb: 3, travel: 2, combat: 3 },
      monsters: [['กระต่ายเขาเดียว', 10], ['หมาป่าเงา', 22], ['ก๊อบลินถือขวาน', 30], ['หมูป่าเขี้ยวหัก', 27]] },
    { upto: 6, name: 'ป่าเห็ดเรืองแสง', scenes: { herb: 3, explore: 2, combat: 3, mine: 1 },
      monsters: [['ทากกรด', 38], ['แมงมุมสปอร์', 46], ['หมาป่าเงาฝูง', 52], ['กวางพิษ', 44]] },
    { upto: 9, name: 'ถ้ำสายแร่', scenes: { mine: 4, explore: 2, combat: 3 },
      monsters: [['ค้างคาวยักษ์', 58], ['หมีหิน', 68], ['หนอนเจาะหิน', 76], ['หนูถ้ำเขี้ยวยาว', 62]] },
    { upto: 12, name: 'ซากเมืองโบราณ', scenes: { explore: 3, combat: 4, mine: 1 },
      monsters: [['อัศวินผี', 88], ['การ์กอยล์', 100], ['ผู้เฝ้าซาก', 120], ['ทหารโครงกระดูก', 85]] },
    { upto: 15, name: 'หนองบึงวิญญาณ', scenes: { herb: 3, explore: 2, combat: 4 },
      monsters: [['ผีโคลน', 125], ['งูบึง', 139], ['ยุงโลหิต', 150], ['วิญญาณจมน้ำ', 159]] },
    { upto: 19, name: 'ป่าไม้ผลึก', scenes: { explore: 3, herb: 2, mine: 2, combat: 4 },
      monsters: [['จิ้งจอกผลึก', 170], ['แมลงปีกแก้ว', 190], ['เสือแร่', 208], ['รุกขปีศาจ', 220]] },
    { upto: 23, name: 'ช่องเขาพายุ', scenes: { travel: 3, mine: 2, combat: 5 },
      monsters: [['นกสายฟ้า', 240], ['แพะเขาหิน', 260], ['อสรพิษพายุ', 285], ['คนหินฟ้าคำราม', 300]] },
    { upto: 27, name: 'หุบเหวมืด', scenes: { explore: 3, mine: 3, combat: 5 },
      monsters: [['หมอกกินชีวิต', 315], ['แมงป่องรัตติกาล', 340], ['เงายักษ์', 360], ['อสูรชั้นลึก', 380]] },
    { upto: 30, name: 'วิหารดารา', scenes: { explore: 3, herb: 1, combat: 6 },
      monsters: [['ผู้เฝ้าดาว', 405], ['ค้างคาวอุกกาบาต', 425], ['อัศวินสุญญะ', 450], ['มังกรผลึก', 480]] },
    { upto: Infinity, name: 'ชั้นหอคอยนิรนาม', scenes: { explore: 3, combat: 6, mine: 2 },
      monsters: [['นักรบหลงทาง', 500], ['เงาบรรพกาล', 520], ['ผู้พิทักษ์หอคอย', 550], ['อสูรเหนือดารา', 600]] }
  ];
  // v118 biome allocation: ten fixed 10-floor bands, seeded only once per save.
  // Reuse original ecology templates as data; do not alter old instantiated floor species.
  const THEMES = Object.freeze([
    {id:'grass',name:'ทุ่งหญ้า',source:0},
    {id:'forest',name:'ป่าดึกดำบรรพ์',source:1},
    {id:'undead',name:'แดนอันเดธ',source:3},
    {id:'volcano',name:'ภูเขาไฟ',scenes:{mine:3,combat:5,explore:2},monsters:[['ซาลาแมนเดอร์เพลิง',10],['หมาป่าลาวา',16],['โกเลมเถ้าถ่าน',24],['อสูรหินหนืด',20]]},
    {id:'ice',name:'แดนน้ำแข็ง',scenes:{travel:2,mine:2,combat:4,herb:1},monsters:[['หมาป่าหิมะ',10],['จิ้งจอกเยือกแข็ง',16],['โกเลมน้ำแข็ง',24],['เงาพายุหิมะ',20]]},
    {id:'desert',name:'ทะเลทราย',scenes:{travel:3,mine:2,combat:4,explore:2},monsters:[['แมงป่องทราย',10],['จิ้งจกยักษ์',16],['โจรแห่งทะเลทราย',24],['หนอนทะเลทราย',20]]},
    {id:'swamp',name:'หนองน้ำพิษ',source:4},
    {id:'crystal',name:'ถ้ำผลึก',source:5},
    {id:'ruins',name:'ซากอารยธรรม',source:8},
    {id:'rift',name:'ห้วงมิติผิดปกติ',source:7}
  ].map(t=>Object.freeze({...t,scenes:Object.freeze({explore:1,herb:1,mine:1,travel:1,combat:2,...(t.scenes||TERRAINS[t.source].scenes)}),monsters:t.monsters||TERRAINS[t.source].monsters})));
  // v127 (ผู้สร้าง) the first floors are authored, each with its own scene and monsters (tower/floorN.webp, monsters/*.webp):
  // 1 grass · 2 glowing mushroom forest · 3 ore cave · 4 spirit swamp (boss floor) · 5–9 ancient ruins (5 is the safe floor,
  // 9 the boss floor: the death knight). Floor 10 onward keeps the v118 random 10-floor bands.
  const FLOOR_THEMES = Object.freeze([
    {id:'f1_grass',name:'ทุ่งหญ้าเชิงหอคอย',scene:1,scenes:{explore:3,herb:3,travel:2,combat:3},monsters:[['กระต่ายเขาเดียว',10],['หมาป่าเงา',22],['ก๊อบลินถือขวาน',30],['หมูป่าเขี้ยวหัก',27]]},
    {id:'f2_mushroom',name:'ป่าเห็ดเรืองแสง',scene:2,scenes:{herb:3,explore:2,combat:3,mine:1},monsters:[['ทากกรด',38],['แมงมุมสปอร์',46],['กวางพิษ',44],['เห็ดยักษ์เดินได้',50]]},
    {id:'f3_cave',name:'ถ้ำสายแร่',scene:3,scenes:{mine:4,explore:2,combat:3},monsters:[['ค้างคาวยักษ์',58],['หมีหิน',68],['หนอนเจาะหิน',76],['หนูถ้ำเขี้ยวยาว',62]]},
    {id:'f4_swamp',name:'หนองบึงวิญญาณ',scene:4,scenes:{herb:3,explore:2,combat:4},monsters:[['ผีโคลน',125],['งูบึง',139],['ยุงโลหิต',150],['วิญญาณจมน้ำ',159]]},
    {id:'f5_ruins',name:'ซากเมืองโบราณ',scene:5,scenes:{explore:3,combat:4,mine:1},monsters:[['อัศวินผี',88],['การ์กอยล์',100],['ทหารโครงกระดูก',85],['ผู้เฝ้าซาก',120]]}
  ].map(t=>Object.freeze({...t,scenes:Object.freeze({explore:1,herb:1,mine:1,travel:1,combat:2,...t.scenes}),monsters:t.monsters})));
  const fixedTheme = floor => floor <= 4 ? FLOOR_THEMES[floor - 1] : floor <= 9 ? FLOOR_THEMES[4] : null;
  function themeFor(st,floor) {
    floor = Math.max(1,Math.min(100,Math.floor(floor||1)));
    if (fixedTheme(floor)) return fixedTheme(floor);
    const w=ensureWorld(st),band=Math.floor((floor-1)/10);
    if(!Array.isArray(w.themes) || w.themes.length!==10 || w.themes.some(id=>!THEMES.some(t=>t.id===id))) {
      w.themes=[];
      for(let i=0;i<10;i++) {
        // Random with no consecutive repetition; a theme may return in a later band.
        const choices=THEMES.filter(t=>t.id!==w.themes[i-1]);
        let n=Math.floor(hash(seed(st),'biome-v118',i)*4294967296);
        n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);n^=n>>>16;
        const index=(n>>>0)%choices.length;
        w.themes.push(choices[index].id);
      }
    }
    return THEMES.find(t=>t.id===w.themes[band]);
  }
  // Without a state, this API is retained for older map previews/tests.
  const terrainOf=(floor,st)=>fixedTheme(Math.max(1,Math.floor(floor||1))) || (st ? themeFor(st,floor) : TERRAINS.find(t=>floor<=t.upto));
  const biomeOf=(st,floor)=>themeFor(st,floor);

  // Four independent territories per floor. A -> B -> C -> D -> A is a closed predation ring.
  const DIRECTIONS = Object.freeze(['เหนือ', 'ตะวันออก', 'ใต้', 'ตะวันตก']);
  const RANKS = Object.freeze(['Normal','Soldier','Captain','General','King','Emperor','Legendary']);
  const DROP_WEAPON = Object.freeze([0.1, 0.05, 0.01, 0.002, 0.0004, 0.00008, 0.000016]);
  const DROP_BOOK = Object.freeze([0.05, 0.01, 0.002, 0.0004, 0.00008, 0.000016, 0.0000032]);
  const WEAPON_TEMPLATES = Object.freeze(['knife', 'dagger', 'sword']);
  // v115 active books are extremely rare without changing the v113 book DROP probability.
  // Most book drops are passive; advanced quest-only actives never enter the monster pool.
  const BOOK_TEMPLATES = Object.freeze(Array(98).fill('book_sense').concat(['book_fire', 'book_ice']));
  const ADVANCED_BOOKS = Object.freeze(['book_fireBody', 'book_iceSkin', 'book_lastStand', 'book_shadowStep', 'card_spiritGuard']);
  // v134 set cores drop from floor guardians (and are sold in safe zones)
  const SET_CORE_CARDS = Object.freeze(['card_avatarForm', 'card_stormLance', 'card_earthBulwark', 'card_sanctuaryLight', 'card_spiritCall', 'card_spiritMend', 'card_spiritScout']);
  const isBossFloor = floor => Number.isInteger(floor) && floor >= 4 && (floor + 1) % 5 === 0;
  // A single special reward roll, shared by weapons and skill books; no slot modifiers.
  function rollDrop(st, monster, eventId) {
    const rank = Math.max(0, RANKS.findIndex(r => r.toLowerCase() === String(monster.rank || 'Normal').toLowerCase()));
    const outcomes = [];
    for (let tier = 6; tier >= rank; tier--) {
      const rate = tier - rank;
      outcomes.push({ kind: 'weapon', rarity: Skills.RARITIES[tier], probability: DROP_WEAPON[rate] });
      outcomes.push({ kind: 'book', rarity: Skills.RARITIES[tier], probability: DROP_BOOK[rate] });
    }
    const r = hash(seed(st), 'drop', eventId, 'special');
    let sum = 0, special = null;
    for (const candidate of outcomes) { sum += candidate.probability; if (r < sum) { special = { ...candidate }; delete special.probability; break; } }
    if (special) {
      const templates = special.kind === 'weapon' ? WEAPON_TEMPLATES :
        monster && monster.boss ? SET_CORE_CARDS : (rank >= 1 ? BOOK_TEMPLATES.concat(ADVANCED_BOOKS) : BOOK_TEMPLATES);
      special.templateId = templates[Math.floor(hash(seed(st), 'drop', eventId, 'type') * templates.length)];
    }
    const crystalRate = Math.min(1, 0.08 + rank * 0.04);
    return { special, soulCrystals: monster.elite ? 1 : monster.boss ? 2 + Math.floor(hash(seed(st), 'drop', eventId, 'boss-crystal') * 2) :
      (hash(seed(st), 'drop', eventId, 'soul') < crystalRate ? 1 : 0) };
  }
  const rankOf = power => Math.max(0, Math.min(6, [60, 120, 210, 340, 480, 650].filter(v => power >= v).length));
  function ensureWorld(st) {
    if (!st.tower || typeof st.tower !== 'object' || Array.isArray(st.tower)) st.tower = {};
    const w = st.tower;
    if (!w.floors || typeof w.floors !== 'object' || Array.isArray(w.floors)) w.floors = {};
    if (!Array.isArray(w.news)) w.news = [];
    if (!Number.isInteger(w.lastDay)) w.lastDay = st.day || 1;
    w.v = 114;
    if (!Number.isInteger(w.eliteLastPromotionDay)) w.eliteLastPromotionDay = -30;
    return w;
  }
  function floorWorld(st, floor) {
    const w = ensureWorld(st), key = String(Math.max(1, Math.floor(floor)));
    const previous = w.floors[key];
    if (!previous || !Array.isArray(previous.species) || previous.species.length !== 4) {
      const mobs = terrainOf(+key, st).monsters;
      // Biome gives names and relative strength only; how strong a floor is comes from its depth
      // (old v113 band for that floor), so a deep-biome theme on floor 1 is not 3-5x harder.
      const band = TERRAINS.find(t => +key <= t.upto) || TERRAINS[TERRAINS.length - 1];
      const avg = list => list.reduce((a, m) => a + m[1], 0) / list.length;
      const depth = avg(band.monsters), rel = i => mobs[i][1] / Math.max(1, avg(mobs));
      const basePower = i => Math.round(depth * rel(i) + (+key) * 2);
      w.floors[key] = { biome: themeFor(st, +key).id, species: DIRECTIONS.map((dir, i) => ({
        id: i, direction: dir, name: mobs[i][0], base: basePower(i),
        count: 8 + Math.floor(hash(seed(st), key, i, 'pop') * 9),
        champion: Math.min(900, basePower(i) + Math.floor(hash(seed(st), key, i, 'champ') * 20)),
        kills: 0, meals: 0, elite: null
      })), ...(previous && SAFE_KINDS[previous.safeKind] ? { safeKind: previous.safeKind } : {}) };
    }
    if (!w.floors[key].biome) w.floors[key].biome = themeFor(st, +key).id; // old-save migration preserves encountered species
    for (const s of w.floors[key].species) if (s.elite === undefined) s.elite = null;
    if (isBossFloor(+key) && !w.floors[key].boss) {
      const f = w.floors[key], i = Math.floor(hash(seed(st), key, 'boss') * f.species.length), m = f.species[i];
      const power = Math.round(Math.max(m.base, m.champion) * 1.8);
      f.boss = { name: +key === 9 && f.biome === 'f5_ruins' ? 'อัศวินมรณะผู้เฝ้าศิลาทางขึ้น' : m.name + ' · ผู้พิทักษ์ชั้น', power, species: m.id,
        rank: RANKS[Math.max(2, rankOf(power))], alive: true, boss: true };
    }
    if (isSafeFloor(+key) && !SAFE_KINDS[w.floors[key].safeKind]) {
      w.floors[key].safeKind = chooseSafeKind(st, +key);
    }
    return w.floors[key];
  }
  const eliteCap = (floor, normalRank) => Math.min(6, normalRank + 2, floor <= 20 ? 4 : 6);
  function eliteOf(st, floor, species) {
    const f = floorWorld(st, floor), s = f.species[species];
    return s && s.elite && s.elite.alive ? s.elite : null;
  }
  function monsterOf(st, floor, id, region) {
    if (isSafeFloor(floor)) return null;
    const f = floorWorld(st, floor), living = f.species.filter(s => s.count >
      (f.boss && f.boss.alive && f.boss.species === s.id ? 1 : 0) + (s.elite && s.elite.alive ? 1 : 0));
    // v135 a territory is home to one species: 65% of fights there are with it
    const home = region ? living.filter(s => s.name === region.species) : [];
    const pool = home.length && hash(seed(st), id, 'home') < 0.65 ? home : living.length ? living : f.species;
    const m = pool[Math.floor(hash(seed(st), id, 'm') * pool.length)], normalPower = Math.round(Math.max(m.base, m.champion));
    const elite = m.elite, x = X(st), lair = region && x && x.landmarks && x.landmarks[region.id + '_lair'];
    if (elite && elite.alive && hash(seed(st), id, 'elite') < (lair && region.species === m.name ? 0.2 : 0.06)) {
      const normalRank = rankOf(normalPower), delta = Math.max(0, RANKS.indexOf(elite.rank) - normalRank);
      return { name: 'จ่าฝูง' + m.name, power: Math.round(normalPower * Math.pow(1.35, delta)),
        direction: m.direction, species: m.id, rank: elite.rank, elite: true, eliteId: elite.id };
    }
    return { name: m.name, power: normalPower, direction: m.direction, species: m.id, rank: RANKS[rankOf(normalPower)] };
  }
  // ---- v135 territories (tower-regions.js): every normal floor of 1–9 has four, each with a home species,
  // three landmarks and its own things to gather. Entering a new one the first time in a day helps the search.
  function regionOf(st, floor, id) {
    const list = Regions && Regions.regionsOf(floor), x = X(st); if (!list || !x) return null;
    const seen = ((x.regions = x.regions || {})[floor] = x.regions[floor] || {});
    const unseen = list.filter(r => !seen[r.dir]), pick = unseen.length && hash(seed(st), id, 'region-new') < 0.55 ? unseen : list;
    return pick[Math.floor(hash(seed(st), id, 'region') * pick.length)];
  }
  const regionById = (floor, id) => (Regions && Regions.regionsOf(floor) || []).find(r => r.id === id) || null;
  const CAMP_FINDS = Object.freeze(['old_expedition_map', 'field_journal', 'sealed_cache_key', 'safe_pass']);
  function regionStep(st, enc, lines, gain) {
    const x = X(st), reg = enc.region && regionById(x.floor, enc.region); if (!reg) return 0;
    x.at = reg.id;
    let found = 0; const seen = ((x.regions = x.regions || {})[x.floor] = x.regions[x.floor] || {});
    if (!seen[reg.dir]) { seen[reg.dir] = st.day; lines.push('เข้าเขตใหม่: ' + reg.name);
      if (x.newRegionDay !== st.day) { x.newRegionDay = st.day; found += Regions.NEW_REGION_SEARCH; } }
    if (enc.scene === 'combat') return found;
    const L = x.landmarks = x.landmarks || {}, open = reg.landmarks.filter(l => !L[l.id]);
    if (open.length && hash(seed(st), enc.id, 'landmark') < 0.24) {
      const l = open[Math.floor(hash(seed(st), enc.id, 'lm') * open.length)]; L[l.id] = st.day;
      if (l.kind === 'stone') { found += 3; lines.push('พบ' + l.name + ' · รู้ทิศของศิลามากขึ้น'); }
      else if (l.kind === 'camp') { found += 1; lines.push('พบ' + l.name + ' · ค้นเสบียงที่ถูกทิ้งไว้');
        gain(CAMP_FINDS[Math.floor(hash(seed(st), enc.id, 'campfind') * CAMP_FINDS.length)], 1); if (hash(seed(st), enc.id, 'camppot') < 0.4) gain('potion', 1); }
      else { found += 1; lines.push('พบ' + l.name + ' · จ่าฝูงในเขตนี้จะโผล่บ่อยขึ้น'); }
    }
    if (['explore', 'herb', 'mine', 'travel'].includes(enc.scene)) for (const [id, ch, a, b] of reg.gather) {
      if (hash(seed(st), enc.id, 'gather', id) < ch) gain(id, a + Math.floor(hash(seed(st), enc.id, 'gq', id) * (b - a + 1)));
    }
    return found;
  }
  // v135 what each species leaves behind (GPT drop tables). Cards come at the monster's grade; higher ranks drop them rarer.
  const GUARD_TABLE = Object.freeze({ 1: 'ผู้พิทักษ์เขาเดี่ยว', 2: 'ราชาเห็ดเรืองแสง', 3: 'ราชาหนอนเจาะศิลา', 4: 'แชมป์วิญญาณบึง', 9: 'อัศวินมรณะผู้เฝ้าศิลาทางขึ้น' });
  const RANK_CARD_MULT = Object.freeze([1, 0.75, 0.48, 0.3, 0.18, 0.1, 0.06]);
  function speciesDrops(st, floor, monster, isBoss, eventId) {
    const out = []; if (!Regions) return out;
    const f = floorWorld(st, floor), sp = f.species[monster.species], rank = Math.max(0, RANKS.findIndex(r => r.toLowerCase() === String(monster.rank || 'Normal').toLowerCase()));
    const own = sp && Regions.DROPS[sp.name], guard = GUARD_TABLE[floor] && Regions.DROPS[GUARD_TABLE[floor]];
    const roll = (list, key, mult = 1) => { for (const [id, ch, a, b] of list || []) if (hash(seed(st), 'sd', eventId, key, id) < ch * mult)
      out.push({ id, n: a + Math.floor(hash(seed(st), 'sdq', eventId, key, id) * (b - a + 1)) }); };
    const tables = isBoss ? [guard] : monster.elite ? [own, guard] : [own];
    if (!isBoss && own) { roll(own.common, 'c'); roll(own.rare, 'r'); }
    if (monster.elite && own) roll(own.elite, 'e');
    if (isBoss && guard) roll(guard.boss, 'b');
    // at most one card per kill
    const cards = []; for (const t of tables) if (t) cards.push(...t.cards);
    const cm = RANK_CARD_MULT[rank] * (monster.elite ? 2 : 1);
    let r = hash(seed(st), 'sd', eventId, 'card'), sum = 0;
    for (const [id, ch] of cards) { sum += ch * cm; if (r < sum) { out.push({ id, n: 1, card: true, rarity: Skills.RARITIES[rank] }); break; } }
    return out;
  }
  function bossOf(st, floor) { return isBossFloor(floor) ? floorWorld(st, floor).boss : null; }
  function monsterKill(st, floor, species, isBoss = false, isElite = false, eliteId = null) {
    if (isSafeFloor(floor)) return false;
    const fw = floorWorld(st, floor), s = fw.species[species];
    if (!s || s.count < 1) return false;
    const reservedBoss = !!(fw.boss && fw.boss.alive && fw.boss.species === species) ? 1 : 0;
    const reservedElite = !!(s.elite && s.elite.alive) ? 1 : 0;
    const reserved = isBoss ? reservedElite : isElite ? reservedBoss : reservedBoss + reservedElite;
    if (s.count <= reserved) return false;
    if (isElite && !(s.elite && s.elite.alive && (!eliteId || s.elite.id === eliteId))) return false;
    if (isBoss) {
      if (!fw.boss || !fw.boss.alive || fw.boss.species !== species) return false;
      fw.boss.alive = false; fw.boss.defeatedDay = st.day;
    }
    if (isElite) {
      s.elite.alive = false; s.elite.defeatedDay = st.day;
      s.fallenEliteIds = s.fallenEliteIds || []; s.fallenEliteIds.push(s.elite.id);
    }
    s.count--; s.kills++; return true;
  }
  function recordEliteHunt(st, floor, species) {
    const elite = eliteOf(st, floor, species);
    if (elite) elite.progress.hunt++;
    return !!elite;
  }
  function tickWorld(st, day) {
    const w = ensureWorld(st), now = Math.max(1, Math.floor(day || st.day || 1));
    if (now <= w.lastDay) return [];
    const msgs = [];
    // Sparse world: the existing four species/populations persist, never individual monsters.
    // Only elite.progress grows; champion is a fixed, legacy base attribute.
    for (let d = w.lastDay + 1; d <= now; d++) {
      for (const [floor, f] of Object.entries(w.floors)) {
        if (isSafeFloor(+floor)) continue;
        for (const s of f.species) {
          if (d % 90 === 0) {
            s.count = Math.min(100, s.count + 3 + Math.floor(hash(seed(st), d, floor, s.id, 'spawn') * 6));
            if (s.elite && s.elite.alive) s.elite.progress.survive++;
            else if ((!s.elite || !s.elite.alive) && hash(seed(st), d, floor, s.id, 'elite-birth') < 0.15) {
              const normalRank = rankOf(Math.round(Math.max(s.base, s.champion)));
              const rank = RANKS[Math.min(normalRank + 1, eliteCap(+floor, normalRank))];
              s.elite = { id: 'elite-' + floor + '-' + s.id + '-' + d, rank,
                progress: { survive: 0, hunt: 0, feed: 0 }, born: d, alive: true, mealsSeen: s.meals };
            }
          }
        }
        // Preserve original closed predator ring, once every 45 days.
        if (d % 45 === 0) for (const s of f.species) {
          const prey = f.species[(s.id + 1) % 4];
          if (s.count > 0 && prey.count > (f.boss && f.boss.alive && f.boss.species === prey.id ? 1 : 0) +
              (prey.elite && prey.elite.alive ? 1 : 0) &&
              hash(seed(st), d, floor, s.id, 'eat') < 0.7) {
            prey.count--; s.meals++;
            if (s.elite && s.elite.alive && s.meals - s.elite.mealsSeen >= 10) {
              s.elite.progress.feed++; s.elite.mealsSeen += 10;
            }
            w.news.unshift('วันที่ ' + d + ' ชั้น ' + floor + ' ' + s.name + ' กิน ' + prey.name + ' (' + s.direction + ')');
            if (w.news.length > 40) w.news.length = 40;
          }
        }
      }
      // Global gate: at most one rank promotion in every 30 in-game days, tower-wide.
      if (d - w.eliteLastPromotionDay >= 30) {
        let promoted = false;
        for (const [floor, f] of Object.entries(w.floors)) {
          if (isSafeFloor(+floor)) continue;
          for (const s of f.species) {
            const e = s.elite;
            if (!e || !e.alive) continue;
            const baseRank = rankOf(Math.round(Math.max(s.base, s.champion))), r = RANKS.indexOf(e.rank);
            const score = e.progress.survive * 3 + e.progress.hunt * 4 + e.progress.feed;
            if (r >= 0 && r < eliteCap(+floor, baseRank) && score >= 12 * Math.pow(2, r)) {
              e.rank = RANKS[r + 1]; e.progress = { survive: 0, hunt: 0, feed: 0 };
              e.mealsSeen = s.meals;
              w.eliteLastPromotionDay = d;
              w.elitePromotions = (w.elitePromotions || 0) + 1;
              promoted = true; break;
            }
          }
          if (promoted) break;
        }
      }
    }
    w.lastDay = now; w.news = w.news.slice(0, 20);
    if (now % 90 === 0 && Object.keys(w.floors).length) msgs.push('อสูรในหอคอยเพิ่มจำนวนอีกระลอก (90 วัน)');
    return msgs;
  }
  const isSafeFloor = floor => Number.isInteger(floor) && floor >= 5 && floor % 5 === 0;
  // v112: weights are for floor 5, floors 10-15, and floors 20+ respectively.
  // Keep ids stable: floorWorld stores the chosen id in each save's tower.floors[floor].safeKind.
  const SAFE_KINDS = Object.freeze({
    meadow: Object.freeze({ name: 'ทุ่งหญ้าโล่ง', desc: 'ทุ่งหญ้าเงียบสงบ ไม่มีผู้ค้าและอาคารพักพิง เก็บผลไม้และนอนกลางแจ้งได้',
      services: Object.freeze(['stone', 'forage']), shop: Object.freeze([]), price: 1, weight: Object.freeze([40, 25, 15]), forage: Object.freeze([2, 4]) }),
    camp: Object.freeze({ name: 'ค่ายพักนักสำรวจ', desc: 'จุดพักของนักสำรวจ มีเตียง หีบ และร้านเล็กที่ขายเฉพาะอาหารกับยา',
      services: Object.freeze(['shop', 'rest', 'chest', 'stone', 'forage']), shop: Object.freeze(['bread', 'jerky', 'potion']),
      price: 1.12, weight: Object.freeze([40, 35, 25]), forage: Object.freeze([1, 3]) }),
    village: Object.freeze({ name: 'หมู่บ้านกลางหอคอย', desc: 'ผู้คนตั้งถิ่นฐาน มีร้านขายเสบียง อุปกรณ์ จุดรับซื้อ หีบ และที่พัก',
      enhance: true, services: Object.freeze(['shop', 'sell', 'rest', 'chest', 'stone', 'forage']),
      shop: Object.freeze(['bread', 'jerky', 'potion', 'leather', 'sword']),
      price: 1, weight: Object.freeze([20, 30, 35]), forage: Object.freeze([1, 2]) }),
    city: Object.freeze({ name: 'เมืองกลางหอคอย', desc: 'เมืองใหญ่ที่มีตลาด ที่พัก ผู้รับจ้าง ร้านการ์ดสกิล และศิลาทั้งสองชนิด',
      enhance: true, services: Object.freeze(['shop', 'sell', 'rest', 'chest', 'hire', 'stone', 'forage']),
      shop: Object.freeze(['bread', 'jerky', 'potion', 'leather', 'sword', 'book_fire', 'book_ice', 'book_sense', 'book_fireBody']),
      price: 0.9, weight: Object.freeze([0, 10, 25]), forage: Object.freeze([1, 1]) })
  });
  function chooseSafeKind(st, floor) {
    const bracket = floor >= 20 ? 2 : floor >= 10 ? 1 : 0;
    const names = Object.keys(SAFE_KINDS), weights = names.map(k => SAFE_KINDS[k].weight[bracket]);
    let r = hash(seed(st), 'safe', floor) * weights.reduce((s, n) => s + n, 0);
    for (let i = 0; i < names.length; i++) { r -= weights[i]; if (r < 0) return names[i]; }
    return names[names.length - 1];
  }
  // who comes along: a guild party (by path) or a hired guard; their power fights beside yours, and they can save your life
  const Management = (typeof globalThis !== 'undefined' && globalThis.Management) || (typeof require === 'function' ? require('./management.js') : null);
  const PARTY = { guild: { name: 'ทีมนักรบโล่เหล็ก', power: 55 }, compass: { name: 'ทีมสำรวจเข็มทิศเงิน', power: 30 }, porter: { name: 'ขบวนคนแบกกับทีมนักรบ', power: 45 },
    guard: { name: 'นักรบรับจ้าง', power: 25 }, personal: { name:'ปาร์ตี้ของคุณ', power:0 } };
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
  const needOf = floor => (Regions && Regions.SEARCH_NEED[floor]) || 8 + floor * 3;
  const SLOT_T = Object.fromEntries(SLOTS_OF_DAY);
  // set off tomorrow morning; you always enter at floor 1
  function plan(st, opts) {
    const L = st.life, party = opts.party && PARTY[opts.party] ? opts.party : null;
    if (party === 'personal' && !(Management && Management.ensure(st)?.party.leader && Management.ensure(st).party.members.length)) return {ok:false,why:'ต้องได้รับเลือกเป็นหัวหน้าและมีสมาชิกในปาร์ตี้ก่อน'};
    if (party === 'guard') { if (st.money < GUARD_FEE * 5) return { ok: false, why: 'เงินไม่พอจ้างนักรบ (มัดจำ ' + GUARD_FEE * 5 + ' เหรียญ)' }; st.money -= GUARD_FEE * 5; }
    L.exp = { start: st.day + 1, party, separated: false, floor: 1, highest: 1, search: 0, stones: {}, exitDay: 0, exitT: 0,
      over: false, pending: null, done: {}, hunted: false, log: [], wins: 0, loot: {}, guardPaid: 5, ally: null, path: L.path, safePending: false, safeRestDay: 0 };
    ensureWorld(st); floorWorld(st, 1);
    return { ok: true, start: L.exp.start };
  }
  function cancel(st) { const x = X(st); if (x && !active(st)) { if (x.party === 'guard') st.money += GUARD_FEE * 5; st.life.exp = null; return true; } return false; }
  const withTeam = st => { const x = X(st); return !!(x && x.party && !x.separated); };
  const allyPower = st => { const x = X(st); return (withTeam(st) ? (x.party === 'personal' && Management ? Management.partyPower(st) : PARTY[x.party].power + Math.round((x.floor - 1) * 1.5)) + Skills.tierOf(st, 'partyOath')*12 : 0) + (x && x.ally ? x.ally.power : 0); };
  function safeInfo(st) {
    const x = X(st); if (!active(st) || x.exitDay === st.day || !isSafeFloor(x.floor)) return null;
    const fw = floorWorld(st, x.floor); fw.visited = true;
    const kind = fw.safeKind, spec = SAFE_KINDS[kind];
    x.stones = x.stones || {}; x.stones[x.floor] = Object.assign(x.stones[x.floor] || {}, { exit: true, up: true });
    return { floor: x.floor, kind, name: spec.name, desc: spec.desc, services: [...spec.services],
      shop: [...spec.shop], enhance: !!spec.enhance, price: spec.price, restDay: x.safeRestDay || 0,
      forageDay: x.safeForageDays && x.safeForageDays[x.floor] || 0 };
  }
  function safeTravel(st, way, now) {
    const x = X(st); if (!safeInfo(st)) return { ok: false, why: 'ไม่ได้อยู่ในเซฟโซน' };
    if (Bag.loadStatus(st,st.strength).immobile) return {ok:false,why:'สัมภาระหนักจนเดินไม่ได้ ต้องลดน้ำหนักก่อนใช้ศิลา'};
    if (way === 'exit') { const left=Bag.abandonFloorLoot(st,x.floor); x.exitDay = st.day; x.exitT = clamp((Number.isFinite(now) ? now : 7) + 0.2, 7, 18.8); x.safePending = false;
      return { ok: true, travel: true, why: 'ใช้ศิลาทางออก กลับเมืองผ่านประตูหอคอย'+(left?' · ของที่ยังไม่เก็บตกหาย '+left+' รายการ':'') }; }
    if (way === 'up') { const left=Bag.abandonFloorLoot(st,x.floor); x.floor++; x.highest = Math.max(x.highest, x.floor); x.search = 0; x.safePending = false; floorWorld(st, x.floor);
      if (MainStory) MainStory.enter(st, x.floor);
      return { ok: true, travel: true, why: 'ใช้ศิลาทางขึ้น สู่ชั้น ' + x.floor + ' ' + terrainOf(x.floor, st).name+(left?' · ของที่ยังไม่เก็บตกหาย '+left+' รายการ':'') }; }
    return { ok: false, why: 'ศิลานี้ใช้งานไม่ได้' };
  }
  function safeAction(st, kind, id, now) {
    const info = safeInfo(st), x = X(st); if (!info) return { ok: false, why: 'ต้องอยู่ในเซฟโซนจึงจะใช้บริการได้' };
    const has = service => info.services.includes(service);
    const missing = service => ({ ok: false, why: 'ที่นี่ไม่มี' + ({ shop: 'ร้านค้า', sell: 'จุดรับซื้อ', rest: 'ที่พัก', chest: 'หีบฝากของ', hire: 'ผู้รับจ้าง', stone: 'ศิลา', forage: 'จุดหาของกิน' }[service] || 'บริการนี้') });
    if (kind === 'enhance') {
      if (!info.enhance) return missing('enhance');
      const opts = now && typeof now === 'object' ? now : {};
      return Skills.enhance(st, id, opts.sacrifices || [], 'safe');
    }
    if (kind === 'buy') {
      if (!has('shop')) return missing('shop');
      if (!info.shop.includes(id)) return { ok: false, why: 'ที่นี่ไม่มีสินค้าชนิดนี้' };
      return Bag.safeBuy(st, id, info.floor, info.price);
    }
    if (kind === 'sell') return has('sell') ? Bag.safeSell(st, id, info.floor, 1 / info.price) : missing('sell');
    if (kind === 'read') return has('shop') ? Skills.readBook(st, id, now && now.rarity || null) : missing('shop');
    if (kind === 'deposit' || kind === 'withdraw') {
      if (!has('chest')) return missing('chest');
      const moved = kind === 'deposit' ? Bag.depositItem(st, id) : Bag.withdrawItem(st, id);
      return { ok: moved > 0, why: moved ? (kind === 'deposit' ? 'ฝาก' : 'รับคืน') + Bag.name(Skills.gear(st,id) ? Skills.gear(st,id).templateId : id) + ' ×' + moved : 'ไม่มีของให้ย้าย หรือกระเป๋าเต็ม' };
    }
    if (kind === 'forage') {
      if (!has('forage')) return missing('forage');
      x.safeForageDays = x.safeForageDays || {};
      if (x.safeForageDays[info.floor] === st.day) return { ok: false, why: 'หาของกินในชั้นนี้ไปแล้ววันนี้' };
      const range = SAFE_KINDS[info.kind].forage;
      const amount = range[0] + Math.floor(hash(seed(st), 'forage', info.floor, st.day) * (range[1] - range[0] + 1));
      const queued = !Bag.auto(st);
      const got = queued ? (Bag.queueLoot(st,'fruit',amount,null,{from:'safe-forage',floor:info.floor,day:st.day},'forage:'+info.floor+':'+st.day) ? amount : 0)
        : Bag.add(st, 'fruit', amount, st.day);
      if (!got) return { ok: false, why: 'กระเป๋าเต็ม 20 ช่อง ไม่สามารถเก็บผลไม้ได้' };
      x.safeForageDays[info.floor] = st.day;
      return { ok: true, why: queued ? 'พบผลไม้ป่า ×'+got+' · เปิดกระเป๋าเพื่อเลือกเก็บ' : 'หาผลไม้ป่าได้ ×'+got };
    }
    if (kind === 'rest') {
      if (x.safeRestDay === st.day) return { ok: false, why: 'พักไปแล้ววันนี้' };
      if (!has('rest')) {
        // Meadow has no inn; sleeping outside is safe but heals less than a real room.
        const heal = 10;
        st.health = Math.min(100, (st.health || 0) + heal);
        st.energy = Math.min(100, (st.energy || 0) + 45);
        x.safeRestDay = st.day; x.safeRestOutside = true;
        return { ok: true, why: 'นอนกลางแจ้งอย่างปลอดภัย · สุขภาพ +' + heal + ' · แรง +45' };
      }
      const cost = Math.ceil(16 * info.price);
      if (st.money < cost) return { ok: false, why: 'ต้องใช้ ' + cost + ' เหรียญ' };
      st.money -= cost; st.health = Math.min(100, (st.health || 0) + 32); st.energy = 100;
      x.safeRestDay = st.day; x.safeRestOutside = false;
      return { ok: true, why: 'พักในเซฟโซน −' + cost + ' เหรียญ · สุขภาพ +32 · แรงเต็ม' };
    }
    if (kind === 'hire') {
      if (!has('hire')) return missing('hire');
      if (x.ally) return { ok: false, why: 'มีผู้ร่วมทางรับจ้างอยู่แล้ว' };
      const cost = Math.ceil(180 * info.price);
      if (st.money < cost) return { ok: false, why: 'ต้องใช้ ' + cost + ' เหรียญ' };
      st.money -= cost; x.ally = { name: 'ผู้คุ้มกันเซฟโซน', power: 83 };
      return { ok: true, why: 'จ้างผู้คุ้มกัน +83 พลัง (' + cost + ' เหรียญ)' };
    }
    if (kind === 'stone') return has('stone') ? safeTravel(st, id, now) : missing('stone');
    return { ok: false, why: 'ไม่มีบริการนี้' };
  }
  // the moment you step through the gate: dropped somewhere on floor 1, maybe away from your party
  function enter(st) {
    const x = X(st);
    if (MainStory) MainStory.enter(st, 1);
    if (x.party && hash(seed(st), st.day, 'enter') < 0.2) { x.separated = true; return 'แสงจากประตูหอคอยพาคุณไปโผล่ที่ไหนสักแห่งในชั้น 1 ... ไม่เห็น' + PARTY[x.party].name + 'เลย ต้องหาศิลาทางออกเองหรือตามหาทีม'; }
    return 'เข้าหอคอย โผล่กลางชั้น 1 ' + terrainOf(1, st).name + (x.party ? ' พร้อม' + PARTY[x.party].name : ' คนเดียว') + ' · ต้องหาศิลาทางออกหรือศิลาทางขึ้นจึงจะไปต่อได้';
  }
  const stonesHere = st => { const x = X(st), k = x.stones[x.floor] || {}; return k; };
  // ---- today's encounter at a slot (deterministic)
  function encounter(st, slot) {
    if (Bag && Bag.loadStatus(st,st.strength).immobile && slot !== 'xcamp') return null;
    const x = X(st); if (!x || x.over || (x.exitDay === st.day) || (x.done && x.done[slot + '@' + st.day])) return null;
    const T = terrainOf(x.floor, st), id = st.day + '-' + slot, r = hash(seed(st), id);
    if (safeInfo(st)) {
      if (slot === 'xcamp' || x.safeSeen === x.floor) return null;   // whole floor is safe: announce once on arrival
      const info = safeInfo(st);
      return { id, slot, scene: 'safe', kind: 'safe', noSpin: true, title: 'เซฟโซน ชั้น ' + x.floor + ' · ' + info.name,
        text: info.desc + ' · ศิลาทางออกและศิลาทางขึ้นพร้อมใช้',
        choices: [{ label: 'เปิดบริการเซฟโซน', hint: 'ซื้อ ขาย ใส่การ์ดสกิล ฝากของได้หลายครั้งก่อนปิด', use: 'safe' },
          { label: 'ใช้ศิลาทางออก กลับเมือง', hint: 'ออกจากหอคอย', use: 'exit' },
          { label: 'ใช้ศิลาทางขึ้น ไปชั้น ' + (x.floor + 1), hint: 'สู่ชั้นถัดไป', use: 'up' }] };
    }
    // The boss is an existing persisted member of one of the four floor species.
    const guardian = bossOf(st, x.floor);
    if (guardian && guardian.alive && slot === 'x2') return {
      id, slot, scene: 'combat', kind: 'boss', boss: true, beast: false,
      title: 'ผู้พิทักษ์ชั้น ' + x.floor, text: guardian.name + ' (พลัง ' + guardian.power + ') ขวางศิลาทางขึ้น',
      monster: { ...guardian }, choices: CHOICES.combat
    };
    // a stone you know of on this floor: offered each morning and right after finding one
    const K = stonesHere(st);
    if (guardian && guardian.alive) K.up = false;
    if ((K.exit || K.up) && (slot === 'x1' || x.justFound) && slot !== 'xcamp') {
      x.justFound = false;
      const choices = [];
      if (K.exit) choices.push({ label: 'ใช้ศิลาทางออก กลับเมือง', hint: 'ออกจากหอคอย ถึงประตูหอคอยวันนี้', use: 'exit' });
      if (K.up && !(guardian && guardian.alive)) choices.push({ label: 'ใช้ศิลาทางขึ้น ไปชั้น ' + (x.floor + 1), hint: terrainOf(x.floor + 1, st).name + ' · มอนสเตอร์แรงขึ้น · อาจหลุดจากทีม', use: 'up' });
      choices.push({ label: 'สำรวจชั้นนี้ต่อ', hint: 'จำตำแหน่งศิลาไว้ กลับมาใช้ได้ทุกเช้า', use: 'stay' });
      return { id, slot, scene: 'stone', kind: 'stone', noSpin: true, title: 'ศิลาในชั้น ' + x.floor,
        text: [K.exit && 'ศิลาทางออกเรืองแสงสีฟ้า', K.up && 'ศิลาทางขึ้นเรืองแสงสีทอง', guardian && guardian.alive && 'ศิลาทางขึ้นถูกผู้พิทักษ์ชั้นขวางอยู่'].filter(Boolean).join(' · ') + ' อยู่ไม่ไกลจากค่าย', choices };
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
      return { id, slot, scene: 'combat', kind: 'camp', beast: true, title: 'ถูกลอบโจมตีตอนหลับ', text: 'เสียงกิ่งไม้หักข้างกองไฟ ' + m.name + (m.elite ? ' · ' + m.rank : '') + 'โผล่มาจากความมืด!',
        monster: m, choices: CHOICES.camp };
    }
    let scene = 'combat';
    const reg = regionOf(st, x.floor, id), where = reg ? ' · ' + reg.name : '';
    if (!x.hunted) {
      const tot = Object.values(T.scenes).reduce((a, b) => a + b, 0); let n = r * tot;
      for (const [k, w] of Object.entries(T.scenes)) { n -= w; if (n < 0) { scene = k; break; } }
    }
    if (scene === 'combat') {
      const m = monsterOf(st, x.floor, id, reg);
      return { id, slot, scene, kind: 'combat', beast: hash(seed(st), id, 'b') < 0.6, title: (x.hunted ? 'สิ่งที่ตามมาโผล่ออกมา' : 'เจอมอนสเตอร์') + ' · ชั้น ' + x.floor, region: reg ? reg.id : null, text: (reg ? reg.name + ' — ' : '') + m.name + (m.elite ? ' · ' + m.rank : '') + ' (พลัง ' + m.power + ') ขวางทางอยู่',
        monster: m, choices: CHOICES.combat };
    }
    const TXT = { explore: ['ทางแยกในหอคอย', 'ทางเดินแยกออกเป็นหลายสาย มีลมเย็นพัดมาจากทางหนึ่ง'], herb: ['ดงพืชในหอคอย', 'พืชแปลกตาขึ้นเต็มซอกหิน บางต้นเรืองแสงอ่อน ๆ'],
      mine: ['สายแร่บนผนัง', 'ผนังหินมีเส้นแร่สีเงินพาดผ่าน'], travel: ['ระหว่างเดินทาง', 'ทีมเดินผ่านทางยาวที่ไม่มีใครทำแผนที่ไว้'] }[scene];
    const choices = scene === 'travel' && !withTeam(st) ? [Object.assign({}, CHOICES.travel[0], { label: 'เดินอย่างระวังตัว', hint: '⚠️ 🕳️ น้อยลง · 🤝 อาจเจอคนช่วยหรือทีม' })].concat(CHOICES.travel.slice(1)) : CHOICES[scene];
    return { id, slot, scene, kind: 'event', title: TXT[0] + ' · ชั้น ' + x.floor + ' ' + T.name, region: reg ? reg.id : null,
      text: (reg ? reg.name + ' (' + reg.desc + ') — ' : '') + TXT[1], choices };
  }
  // what the player sees on each choice button
  const choiceView = enc => enc.choices.map((c, i) => ({ index: i, label: c.label, hint: c.hint, noSpin: !!(c.noSpin || enc.noSpin) }));
  // choices that need no reels: using a stone, sharing food with someone stranded, walking on
  function decide(st, enc, index) {
    const x = X(st), c = enc.choices[index] || enc.choices[0], lines = [];
    const prior = x.done['id:' + enc.id] || x.done[enc.slot + '@' + st.day];
    if (prior) return prior.id === enc.id && prior.result ? prior.result : { reels: null, lines: ['เหตุการณ์นี้เสร็จแล้ว'], title: enc.title };
    x.pending = null;
    if (enc.kind === 'safe') x.safeSeen = x.floor;
    const res = { reels: null, title: c.label, description: '', lines, fatal: false, dead: false, eventId: enc.id, eventSlot: enc.slot };
    if (c.use === 'exit') {
      if (Bag && Bag.loadStatus(st,st.strength).immobile) {lines.push('สัมภาระหนักจนเดินไม่ได้ ต้องลดน้ำหนักก่อนใช้ศิลา');return finish(st,res);}
      const abandoned=Bag.abandonFloorLoot(st,x.floor);if(abandoned)lines.push('ของที่ยังไม่เก็บตกหาย '+abandoned+' รายการ');
      x.exitDay = st.day; x.exitT = (SLOT_T[enc.slot] || 7) + 0.3; lines.push('แตะศิลาทางออก แสงสีฟ้าพาคุณ' + (withTeam(st) ? 'และทีม' : '') + 'กลับไปที่ประตูหอคอย'); }
    else if (c.use === 'up') {
      if (Bag && Bag.loadStatus(st,st.strength).immobile) {lines.push('สัมภาระหนักจนเดินไม่ได้ ต้องลดน้ำหนักก่อนใช้ศิลา');return finish(st,res);}
      if (isBossFloor(x.floor) && bossOf(st, x.floor).alive) { lines.push('ศิลาทางขึ้นถูกผู้พิทักษ์ชั้นขวางอยู่'); return finish(st, res); }
      const abandoned=Bag.abandonFloorLoot(st,x.floor);if(abandoned)lines.push('ของที่ยังไม่เก็บตกหาย '+abandoned+' รายการ');
      x.floor++; x.highest = Math.max(x.highest, x.floor); x.search = 0;
      floorWorld(st, x.floor);
      if (MainStory) MainStory.enter(st, x.floor);
      if (isSafeFloor(x.floor)) { const info = safeInfo(st); x.safePending = true; x.safeSeen = x.floor;
        lines.push('พบเซฟโซน ชั้น ' + x.floor + ' · ' + info.name + ' · ' + info.desc); }
      lines.push('แตะศิลาทางขึ้น ... โผล่ที่ชั้น ' + x.floor + ' ' + terrainOf(x.floor, st).name);
      if (x.party && !x.separated && hash(seed(st), enc.id, 'sep') < 0.12) { x.separated = true; lines.push('ทีมไม่ได้ตามขึ้นมาด้วย ต้องเอาตัวรอดคนเดียว'); }
      if (Skills) lines.push(...Skills.progress(st, 'deep_map', x.floor, enc.id));
    }
    else if (c.use === 'safe') { x.safePending = true; lines.push('เข้าสู่เซฟโซน สามารถใช้บริการได้เรื่อย ๆ จนกว่าจะกดปิด'); }
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

  const Alchemy = (typeof globalThis !== 'undefined' && globalThis.Alchemy) || (typeof require === 'function' ? require('./alchemy.js') : null);
  const Artisan = (typeof globalThis !== 'undefined' && globalThis.Artisan) || (typeof require === 'function' ? require('./artisan.js') : null);
  // ---- resolve: spin, then turn the reels into real changes. Returns what the UI shows.
  function resolve(st, enc, index) {
    const x = X(st), prior = x && (x.done['id:' + enc.id] || x.done[enc.slot + '@' + st.day]);
    if (prior) return prior.id === enc.id && prior.result ? prior.result : { reels: null, lines: ['เหตุการณ์นี้เสร็จแล้ว'], title: enc.title };
    const x0 = enc.choices[index] || enc.choices[0];
    if (enc.noSpin || x0.noSpin) return decide(st, enc, index);
    const c = x0, T = terrainOf(x.floor, st);
    const engineScene = enc.scene === 'combat' ? 'combat' : enc.scene;
    const activeSkill = Skills.activeOf(st);
    const ctx = engineScene === 'combat' ? { hasActiveSkill: !!activeSkill, allyNearby: withTeam(st) || !!x.ally, elementalFire: activeSkill === 'fire' || activeSkill === 'sunfall', elementalIce: activeSkill === 'ice' || activeSkill === 'winterSeal', lethalPossible: true }
      : { oreQuality: T.id === 'crystal' || T.id === 'volcano' ? 3 : 2, hiddenCache: true, hiddenPassage: true, creatureNearby: true, allyNearby: !!x.party, magicPresence: ['crystal','ruins','rift','undead'].includes(T.id) || x.floor >= 3, hazardLevel: 1 + Math.floor(x.floor / 4), poisonPresence: ['swamp','forest','undead'].includes(T.id) || engineScene === 'herb', fireRisk: ['volcano','rift'].includes(T.id), lethalPossible: true };
    const out = Engine.spin(engineScene, { worldSeed: seed(st), eventId: enc.id + ':' + index, context: ctx, weights: mergeWeights(c.w, statWeights(st, engineScene)) });
    const n = id => out.reels.filter(r => r === id).length, lines = [];
    const gain = (id, k) => { if (!(k > 0) || !Bag) return;
      if (!Bag.auto(st)) {
        Bag.queueLoot(st,id,k,null,{from:'event',floor:x.floor,day:st.day},enc.id);
        lines.push('พบ'+Bag.name(id)+' ×'+k+' · รอเลือกเก็บในกระเป๋า');return;
      }
      let got = Bag.add(st, id, k, st.day);
      if (!got && Bag.ITEMS[id].kind === 'meal') {            // food matters more than loot: drop the cheapest non-food thing
        const junk = Bag.list(st).filter(s => Bag.ITEMS[s.id] && Bag.ITEMS[s.id].kind !== 'meal' && s.id !== 'potion').sort((a, b) => (Bag.ITEMS[a.id].sell || 0) - (Bag.ITEMS[b.id].sell || 0))[0];
        if (junk) { if (junk.instanceId) Bag.removeGear(st, junk.instanceId); else Bag.take(st, junk.id, 1); lines.push('ทิ้ง' + Bag.name(junk.id) + 'เพื่อเก็บของกิน'); got = Bag.add(st, id, k, st.day); }
      }
      if (got) { x.loot[id] = (x.loot[id] || 0) + got; lines.push(Bag.name(id) + ' +' + got); } else lines.push('กระเป๋าเต็ม ทิ้ง' + Bag.name(id)); };
    const hurt = (d, why) => { st.health = Math.max(1, st.health - d); lines.push(why + ' (สุขภาพ −' + d + ')'); };
    const learn = (id, xp) => { const m = Skills.train(st, id, xp); if (m) lines.push(m); };
    const sensed = Skills.tierOf(st, 'dangerSense');
    const regionSearch = regionStep(st, enc, lines, gain);
    if (regionSearch && enc.scene === 'combat') { x.search += regionSearch; lines.push('ค้นหาศิลา +' + regionSearch + ' (' + Math.min(x.search, needOf(x.floor)) + '/' + needOf(x.floor) + ')'); }
    const res = { reels: out.reels, kind: out.kind, title: out.title, description: out.source === 'automatic' ? '' : out.description, lines, fatal: false, dead: false, rescued: false, eventId: enc.id, eventSlot: enc.slot };
    x.pending = null;
    if (out.fatal) { if (enc.scene === 'combat' && enc.monster) recordEliteHunt(st, x.floor, enc.monster.species); return fatal(st, res, 'หายนะในหอคอย'); }
    if (n('skull') === 2) hurt(30, 'เฉียดตาย');

    if (enc.scene === 'combat') {
      const sig = (ids) => ids.reduce((a, id) => a + n(id), 0);
      const att = sig(['sword', 'target', 'speed', 'skill', 'fire', 'ice']), def = sig(['shield', 'dodge', 'ally', 'luck']), bad = sig(['danger', 'blood', 'stagger']);
      if (c.flee && !Bag.loadStatus(st,st.strength).immobile && sig(['dodge', 'speed']) >= 1 && bad === 0) {
        if (enc.kind === 'camp' && Bag) { const id = Bag.eat(st); if (id) lines.push('ทิ้ง' + Bag.name(id) + 'ไว้ข้างหลัง'); }
        if (x.party && !x.separated && hash(seed(st), enc.id, 'flee') < 0.3) { x.separated = true; lines.push('วิ่งหนีจนหลงจากทีม'); }
        lines.push('หนีพ้น' + enc.monster.name); learn('nimble', 2); x.hunted = false;
        return finish(st, res);
      }
      const shift = clamp(0.05 * (att + def) + (n('skill') ? 0.08 : 0) + n('fire') * 0.04 + n('ice') * 0.03 - 0.06 * bad - (c.flee ? 0.1 : 0), -0.25, 0.25);
      // v134 set cores: summon a spirit / take the avatar form before the blow; both last the rest of this day
      const impact = Skills.activeEffect(st, out.reels);
      if (x.summon && x.summon.day !== st.day) { lines.push(x.summon.name + 'กลับคืนสู่ความว่างเปล่าเมื่อวันใหม่มาถึง'); x.summon = null; }
      if (impact && impact.summon && (!x.summon || x.summon.kind !== impact.summon)) {
        const S = Skills.SUMMONS[impact.summon], t = Math.max(0, Skills.tierOf(st, impact.skill) - 1), g = Skills.cardMult(st, impact.skill), gt = Skills.tierOf(st, 'spiritGuard');
        const hp = Math.round(S.hp[t] * g * (Skills.setEffect(st, 'summonHpMult') || 1) * (1 + 0.1 * gt));
        x.summon = { kind: impact.summon, name: S.name, tank: S.tank, hp, max: hp, power: Math.round(S.power[t] * g + 2 * gt), heal: S.heal ? Math.round(S.heal[t] * g) : 0, search: S.search || 0, day: st.day, intercept: !!Skills.setEffect(st, 'summonIntercept') };
        lines.push('อัญเชิญ' + S.name + ' (พลังชีวิต ' + hp + ')' + (S.tank ? ' · คอยรับแรงปะทะแทน' : ''));
      }
      if (impact && impact.transform && x.avatarDay !== st.day) { x.avatarDay = st.day; x.avatarMult = impact.transform; lines.push('แปลงร่างเป็นผู้พิทักษ์หิน! (พลัง ×' + impact.transform + ' ทั้งวัน)'); }
      const transformed = x.avatarDay === st.day;
      const f = Skills.fight(st, enc.monster, allyPower(st) + (x.summon ? x.summon.power : 0), hash(seed(st), enc.id, 'f1'), hash(seed(st), enc.id, 'f2'), shift,
        { activeEffect: impact, affixRoll:hash(seed(st),enc.id,'affix'), r3: hash(seed(st), enc.id, 'f3'), r4: hash(seed(st), enc.id, 'f4'),
          alone: !withTeam(st) && !x.ally, terrain: T.name, reels: out.reels, team: withTeam(st), echoRoll: hash(seed(st), enc.id, 'echo'),
          powerMult: transformed ? (x.avatarMult || 1.2) : 1, injuryMult: transformed ? 1 - (Skills.setEffect(st, 'transformBonusArmor') || 0) : 1 });
      if (f.echo) lines.push('🔥 เปลวไฟสะท้อนซ้ำ พลิกกลับมาชนะ!');
      // v134 the spirit takes its share of the blow; the stone guardian shields the hero, the others only get hurt
      if (x.summon && !f.win && f.damage) {
        const S = x.summon, share = S.tank ? Math.round(f.damage * 0.6) : 0;
        if (share) { st.health = Math.min(100, st.health + share); f.damage -= share; lines.push(S.name + 'รับแรงปะทะแทน ' + share); }
        S.hp -= S.tank ? share + 4 : Math.round(f.damage * 0.5) + 2;
      }
      if (x.summon && f.deadly && (x.summon.tank || x.summon.intercept)) { f.deadly = false; lines.push(x.summon.name + 'รับเหตุรุนแรงแทนจนสลายไป'); x.summon.hp = 0; }
      if (x.summon && x.summon.hp <= 0) { if (!lines.some(l => l.includes('สลายไป'))) lines.push(x.summon.name + 'ได้รับความเสียหายหนักจนสลายไป'); res.summonGone = x.summon.kind; x.summon = null; }
      const healMult = Skills.setEffect(st, 'healingMult') || 1;
      if (x.summon && x.summon.heal) { const h0 = st.health; st.health = Math.min(100, st.health + Math.round(x.summon.heal * healMult)); if (st.health > h0) lines.push(x.summon.name + 'รักษา (สุขภาพ +' + (st.health - h0) + ')'); }
      if (x.summon && x.summon.search) { x.search += x.summon.search; lines.push(x.summon.name + 'บินสำรวจ ค้นหาศิลา +' + x.summon.search); }
      if (f.usedActive && f.usedActive.heal) { const h0 = st.health; st.health = Math.min(100, st.health + Math.round(f.usedActive.heal * healMult)); lines.push('แสงประคองชีวิต (สุขภาพ +' + (st.health - h0) + ')'); }
      const lowHeal = Skills.setEffect(st, 'lowHealthAllyHeal');
      if (lowHeal && st.health < 40 && Skills.activeOf(st) === 'sanctuaryLight') { st.health = Math.min(100, st.health + lowHeal); lines.push('แสงศักดิ์สิทธิ์ประคองชีวิตยามวิกฤต (สุขภาพ +' + lowHeal + ')'); }
      res.summon = x.summon ? { kind: x.summon.kind, hp: x.summon.hp, max: x.summon.max } : null; res.transformed = transformed;
      if (f.usedActive) {
        res.usedActive = f.usedActive;
        if (!f.usedActive.summon || f.usedActive.attackMult > 1.001) lines.push(f.usedActive.icon + ' ' + f.usedActive.name + ' สำแดงฤทธิ์! ' +
          (f.usedActive.enemyMult < 1 ? 'ศัตรูถูกผนึก พลังลดลง' : f.usedActive.heal ? 'แสงศักดิ์สิทธิ์ปกป้อง' : 'เกิดการโจมตีรุนแรงกว่าปกติ') +
          ' (พลังโจมตี ×' + f.usedActive.attackMult.toFixed(2) + ')');
      }
      if(f.affixProc)lines.push('✨ '+f.affixProc.name+' ทำงานกับศัตรูในจังหวะนี้');
      if (f.triggered) {
        res.triggered = f.triggered;
        lines.push(f.triggered.icon + ' ' + f.triggered.name + 'ตื่น! ' +
          (f.triggered.kind === 'summon' ? f.triggered.effectName + 'ปรากฏเคียงข้างคุณ' :
            f.triggered.kind === 'escape' ? 'ใช้' + f.triggered.effectName + 'เพื่อหลบหนี' :
            f.triggered.effectName + 'ทำงาน')); 
        lines.push('จังหวะสอง: ' + (f.escaped ? 'หนีรอด' : f.win ? 'พลิกกลับมาชนะ' : 'ยังไม่อาจเอาชนะได้') + (f.p2 === undefined ? '' : ' (โอกาส ' + Math.round(f.p2 * 100) + '%)'));
      }
      if (f.damage) {lines.push('บาดเจ็บจากจังหวะแรก สุขภาพ −' + f.damage);if(Alchemy&&f.damage>=18&&hash(seed(st),enc.id,'wound')<.3)lines.push('เลือดออกระดับ '+Alchemy.addStatus(st,'bleeding',1));}
      if (f.escaped) {
        const lost = Bag && Bag.list(st)[0];
        if (lost) {
          if (lost.instanceId) Bag.removeGear(st, lost.instanceId);
          else if (Bag.ITEMS[lost.id] && Bag.ITEMS[lost.id].kind === 'book') Bag.takeBook(st, lost.id, lost.rarity || null);
          else Bag.take(st, lost.id, 1);
          lines.push('ก้าวเงา: ทิ้ง' + Bag.name(lost.id) + 'ไว้ข้างหลัง 1 ชิ้น');
        }
        x.hunted = false;
        return finish(st, res);
      }
      res.fight = { p: Math.round(f.p * 100), win: f.win, power: Skills.power(st) + allyPower(st), monster: enc.monster.power };
      x.hunted = false;
      if (f.win) {
        x.wins++; st.towerWins = (st.towerWins || 0) + 1;
        const killed = monsterKill(st, x.floor, enc.monster.species, !!enc.boss, !!enc.monster.elite, enc.monster.eliteId);
        if (killed) {
          const reward = rollDrop(st, { ...enc.monster, boss: !!enc.boss }, enc.id);
          res.drop = reward;
          if (reward.special) {
            const d = reward.special, from = { from: 'drop', floor: x.floor, monster: enc.monster.name, day: st.day };
            const manual = !Bag.auto(st);
            const got = manual ? Bag.queueLoot(st,d.templateId,1,d.rarity,from,enc.id)
              : d.kind === 'weapon' ? Bag.addGear(st, d.templateId, d.rarity, from) : Bag.addBook(st, d.templateId, d.rarity, from);
            if (got) {
              if (!manual) x.loot[d.templateId] = (x.loot[d.templateId] || 0) + 1;
              lines.push('ดรอป ' + Bag.name(d.templateId) + ' [' + d.rarity + ']' + (manual ? ' · รอเลือกเก็บในกระเป๋า' : ''));
              res.reward = { ...d, gained: !manual, queued:manual };
            } else { lines.push('กระเป๋าเต็ม! ' + Bag.name(d.templateId) + ' [' + d.rarity + '] ตกหายไป'); res.reward = { ...d, gained: false }; }
          }
          if (reward.soulCrystals) gain('soul_crystal', reward.soulCrystals);
          for (const d of speciesDrops(st, x.floor, enc.monster, !!enc.boss, enc.id)) {
            const from = { from: 'drop', floor: x.floor, monster: enc.monster.name, day: st.day }, manual = !Bag.auto(st);
            if (d.card || Skills.GEAR[d.id]) {
              const rarity = d.rarity || 'normal';
              const ok = manual ? Bag.queueLoot(st, d.id, 1, rarity, from, enc.id) : d.card ? Bag.addBook(st, d.id, rarity, from) : Bag.addGear(st, d.id, rarity, from);
              lines.push((ok ? 'ดรอป ' : 'กระเป๋าเต็ม! ทิ้ง ') + Bag.name(d.id) + ' [' + rarity + ']' + (ok && manual ? ' · รอเลือกเก็บในกระเป๋า' : ''));
              if (ok && !manual) x.loot[d.id] = (x.loot[d.id] || 0) + 1;
              if (ok && !res.reward) res.reward = { kind: d.card ? 'book' : 'weapon', templateId: d.id, rarity, gained: !manual, queued: manual };
            } else gain(d.id, d.n);
          }
          if (enc.monster.elite) { lines.push('จ่าฝูงถูกกำจัดถาวร · ได้ผลึกวิญญาณแน่นอน 1 ชิ้น');
            lines.push(...Skills.progress(st, 'elite_win', x.floor, enc.id)); }
          if (enc.boss) {
            if (MainStory) MainStory.bossWin(st, x.floor);
            lines.push(...Skills.progress(st, 'boss_win', x.floor, enc.id));
            const K = x.stones[x.floor] = x.stones[x.floor] || {};
            K.up = true; x.justFound = true;
            lines.push('ผู้พิทักษ์ชั้นตายถาวร · ศิลาทางขึ้นปรากฏแล้ว!');
          }
        }
        if (activeSkill) learn(activeSkill, 2);
        lines.push('ชนะ' + enc.monster.name + ' (โอกาสชนะ ' + res.fight.p + '%)');
        gain('monster', 1 + (x.floor >= 4 ? 1 : 0) + (n('target') >= 2 ? 1 : 0));
        if (enc.beast && (c.hunt || hash(seed(st), enc.id, 'meat') < 0.4)) gain('meat', c.hunt ? 2 : 1);
        if (activeSkill === 'sword') learn('sword', 2 + (enc.monster.power > Skills.power(st) ? 2 : 0)); learn('nimble', 1);
        lines.push(...Skills.progress(st, 'win', enc.monster.power, enc.id)); if (!f.hurt) lines.push(...Skills.progress(st, 'clean_win', undefined, enc.id));
        if (MainStory) lines.push(...MainStory.observe(st,{eventId:enc.id,scene:'combat',floor:x.floor,win:true,boss:!!enc.boss,elite:!!enc.monster.elite,power:enc.monster.power}));
        if (st.towerWins >= 15) { const t = Skills.earnTitle(st, 'slayer'); if (t) lines.push(t); }
        if ((!f.damage && f.hurt) || n('blood')) {hurt(6 + x.floor, 'โดนข่วนระหว่างสู้');if(Alchemy&&hash(seed(st),enc.id,'bleeding')<.25)lines.push('เลือดออกระดับ '+Alchemy.addStatus(st,'bleeding',1));}
      } else {
        recordEliteHunt(st, x.floor, enc.monster.species);
        if (f.deadly) return fatal(st, res, enc.monster.name);
        learn('sword', 1);
        // Stage-one injury was already taken by Skills.fight; never apply defeat damage twice.
        lines.push('แพ้' + enc.monster.name + ' ต้องถอยหนี');
      }
      return finish(st, res);
    }
    // ---- events
    const F = x.floor, coin = k => { if (k > 0) { st.money += k; x.loot.coin = (x.loot.coin || 0) + k; lines.push('เหรียญ +' + k); } };
    if (enc.scene === 'mine') { gain('ore', n('mine') ? n('mine') + Math.floor(F / 4) : 0); gain('crystal', n('gem'));
      if(Artisan && n('mine')+n('gem')>0){const ore=Artisan.mine(st,F,enc.id,n('mine')+n('gem'));if(ore&&ore.n)lines.push('ขุดพบ'+Bag.name(ore.id)+' [T'+ore.tier+'] ×'+ore.n+(ore.queued?' · รอเลือกเก็บ':''));}
      learn('gathering', 2); }
    if (enc.scene === 'herb') { if (c.fruit) gain('fruit', 1 + n('herb') + n('luck')); else { gain('herb', n('herb') + n('mushroom')); if (Alchemy && n('herb')+n('mushroom')>0) {const found=Alchemy.forage(st,x.floor,enc.id,n('herb')+n('mushroom'));if(found)lines.push('พบ'+Bag.name(found.id)+(found.queued?' · รอเลือกเก็บ':' ×'+(found.n||0)));}} learn('gathering', 2); if (n('herb') + n('mushroom')) lines.push(...Skills.progress(st,'find',n('herb')+n('mushroom'),enc.id)); }
    if (enc.scene === 'explore' || enc.scene === 'travel') learn('mapping', 2);
    if (n('chest')) { coin((3 + F * 2) * n('chest') + (n('key') ? 6 + F * 2 : 0)); if (n('key') && hash(seed(st), enc.id, 'potion') < 0.5) gain('potion', 1); }
    if (n('scroll')) { learn('keen', 3 * n('scroll')); lines.push('อ่านบันทึกเก่าของนักสำรวจ'); }
    if (n('tracks')) learn('mapping', n('tracks'));
    if (n('luck')) coin(2 * F * n('luck'));
    if (n('ally') && !x.separated) { st.health = Math.min(100, st.health + 12); lines.push('มีคนช่วยทำแผลให้ (สุขภาพ +12)'); }
    if (n('magic') + n('orb')) gain('crystal', n('orb') + (n('magic') >= 2 ? 1 : 0));
    // searching for a stone: compass, tracks, scrolls and keys, the choice and the mapping skill all count
    const found = 2 * n('compass') + n('tracks') + n('scroll') + n('key') + (c.search || 0) + Skills.tierOf(st, 'mapping') + Skills.tierOf(st, 'trailEye') + regionSearch;
    if (found > 0) { x.search += found; lines.push('ค้นหาศิลา +' + found + ' (' + Math.min(x.search, needOf(x.floor)) + '/' + needOf(x.floor) + ')'); }
    if (x.search >= needOf(x.floor)) {
      const K = x.stones[x.floor] = x.stones[x.floor] || {};
      const guardian = bossOf(st, x.floor);
      if (guardian && guardian.alive) {
        if (!K.exit) { K.exit = true; x.justFound = true; lines.push('✦ พบศิลาทางออก!'); }
        else lines.push('ศิลาทางขึ้นถูกผู้พิทักษ์ชั้นขวางอยู่');
      } else {
        const kind = !K.exit && !K.up ? (hash(seed(st), enc.id, 'stone') < 0.5 ? 'exit' : 'up') : K.exit ? 'up' : 'exit';
        K[kind] = true; x.justFound = true;
        lines.push(kind === 'exit' ? '✦ พบศิลาทางออก!' : '✦ พบศิลาทางขึ้น!');
      }
      x.search = 0;
    }
    if (n('vortex')) { lines.push('พื้นที่บิดเบี้ยว ถูกพาไปอีกมุมของชั้น'); x.search = Math.max(0, x.search - 3); if (x.party && !x.separated && hash(seed(st), enc.id, 'v') < 0.5) { x.separated = true; lines.push('หลงจากทีม!'); } }
    if (n('hole') >= 2 && x.party && !x.separated) { x.separated = true; lines.push('ร่วงลงโพรงลึก หลงจากทีม!'); }
    if (x.separated && (n('ally') || n('tracks') >= 2)) { if (hash(seed(st), enc.id, 'rejoin') < 0.6 + 0.2 * n('ally')) { x.separated = false; lines.push('ได้ยินเสียงเรียก... กลับมารวมกับ' + PARTY[x.party].name + 'ได้แล้ว'); } }
    if (n('danger')) {
      hurt(Math.max(1, (5 + F) * n('danger') - sensed * 2), 'อุบัติเหตุ');
      if(Alchemy){
        const effect=T.id==='ice'?'cold':T.id==='desert'?'thirst':T.id==='swamp'?'infection':'injury';
        if(hash(seed(st),enc.id,'condition-danger')<.24)lines.push(Alchemy.CONDITIONS[effect].name+' ระดับ '+Alchemy.addStatus(st,effect,1));
      }
    }
    if (n('hole')) { hurt(7 * n('hole'), 'พลัดตกหลุม');if(Alchemy)lines.push('มึนงง ระดับ '+Alchemy.addStatus(st,'dizzy',1)); }
    if (n('poison')) {hurt(Math.max(1, Math.round((8 * n('poison') - Skills.tierOf(st, 'keen') - sensed - Skills.tierOf(st, 'herbalLore')*2) * (1-(Artisan?Artisan.resistance(st,'poison'):0)))), 'โดนพิษ'); if(Alchemy){const k=Alchemy.addStatus(st,'poison',n('poison'));lines.push('ติดพิษระดับ '+k);}}
    if (n('fire')) { hurt(Math.max(1,Math.round(8*(1-(Artisan?Artisan.resistance(st,'burn'):0)))), 'โดนไฟลวก');if(Alchemy)lines.push('แผลไฟลวก ระดับ '+Alchemy.addStatus(st,'burn',1)); if (Bag) { const id = Bag.eat(st); if (id) lines.push(Bag.name(id) + 'ไหม้ไป 1'); } }
    if (n('eye')) { x.hunted = true; lines.push('มีบางอย่างตามมา...');
      if(Alchemy&&['undead','rift'].includes(T.id)&&hash(seed(st),enc.id,'fear')<.3)lines.push('หวาดกลัวระดับ '+Alchemy.addStatus(st,'fear',1));
    }
    if(Alchemy&&n('vortex')&&hash(seed(st),enc.id,'hallucination')<.2)lines.push('ประสาทหลอนระดับ '+Alchemy.addStatus(st,'hallucination',1));
    if(Alchemy&&T.id==='undead'&&n('orb')&&hash(seed(st),enc.id,'curse')<.12)lines.push('ต้องคำสาประดับ '+Alchemy.addStatus(st,'curse',1));
    if(Alchemy&&T.id==='swamp'&&n('poison')&&hash(seed(st),enc.id,'infection')<.2)lines.push('ติดเชื้อระดับ '+Alchemy.addStatus(st,'infection',1));
    if (MainStory) lines.push(...MainStory.observe(st,{eventId:enc.id,scene:enc.scene,floor:x.floor,win:false}));
    if (!lines.length) lines.push('ไม่มีอะไรเกิดขึ้น');
    return finish(st, res);
  }
  function fatal(st, res, cause) {
    const x = X(st);
    if (withTeam(st) || x.ally) {
      const p = Skills.rescuePenalty(st, 6); st.health = Math.max(1, Math.min(st.health, 15));
      res.rescued = true; res.lines.push((withTeam(st) ? PARTY[x.party].name : x.ally.name) + 'ลากคุณหนีออกมาได้ทัน', 'เสียเงิน ' + p.money + ' เหรียญ' + (p.gear.length ? ' และ' + p.gearLabels.join(' ') : ''), 'ค่าสถานะลดครึ่งถึงวันที่ ' + p.until);
      const t = Skills.earnTitle(st, 'survivor'); if (t) res.lines.push(t);
      if (x.ally && !withTeam(st)) x.ally = null;          // the stranded companion doesn't survive saving you
      return finish(st, res);
    }
    res.dead = true; res.lines.push('ไม่มีใครอยู่ช่วย... ' + cause + 'คือสิ่งสุดท้ายที่เห็น');
    st.life.dead = { day: st.day, floor: x.floor, cause }; x.over = true;
    if (res.eventId) { const record = { id: res.eventId, result: res }; x.done[res.eventSlot + '@' + st.day] = record; x.done['id:' + res.eventId] = record; }
    return res;
  }
  function finish(st, res) {
    const x = X(st);
    if (res.eventId) { const record = { id: res.eventId, result: res }; x.done[res.eventSlot + '@' + st.day] = record; x.done['id:' + res.eventId] = record; }
    // a potion when badly hurt; going home when it gets too dangerous
    if (st.health < 40 && Bag && Bag.auto(st) && Bag.count(st, 'potion')) { Bag.take(st, 'potion', 1); st.health = Math.min(100, st.health + 30); res.lines.push('ดื่มยาฟื้นแรง (สุขภาพ +30)'); }
    if (st.health < 25) res.lines.push('บาดเจ็บหนัก ต้องหาศิลาทางออกให้เจอ');
    x.log.unshift({ day: st.day, title: res.title, lines: res.lines.slice(0, 4) }); x.log = x.log.slice(0, 12);
    return res;
  }
  // night at camp: one meal from the bag; nothing to eat = weaker; out of food = go home
  function camp(st) {
    const x = X(st), out = [];
    // sleeping outside on a safe floor is safe but still needs food from the bag
    if (safeInfo(st) && x.safeRestDay === st.day && !x.safeRestOutside) { st.life.sleptAt = 'tower'; st.life.roomSlept = null; st.life.fedDay = st.day;
      return x.safeRestOutside ? 'นอนกลางแจ้งในเซฟโซนอย่างปลอดภัย' : 'พักในที่พักเซฟโซนอย่างปลอดภัย'; }
    if (safeInfo(st) && x.safeRestDay === st.day && x.safeRestOutside) out.push('นอนกลางแจ้งในเซฟโซนอย่างปลอดภัย');
    if (x.avatarDay === st.day) { st.energy = Math.max(0, (st.energy || 0) - 25); out.push('คืนร่างจากอวตาร เหนื่อยล้ามาก (แรง −25)'); }   // v134
    const id = Bag ? Bag.eat(st) : null;
    if (id) {st.life.fedDay=st.day;out.push('กิน' + Bag.name(id) + 'ข้างกองไฟ');}
    else if (withTeam(st)) { st.health = Math.max(1, st.health - 3); out.push('ไม่มีอะไรกิน ทีมแบ่งเสบียงให้นิดหน่อย (สุขภาพ −3)'); }
    else {
      st.health = Math.max(0, st.health - 12); out.push('ไม่มีอะไรกิน หิวจนตาลาย (สุขภาพ −12)');
      if (st.health <= 0) { st.life.dead = { day: st.day, floor: x.floor, cause: 'อดอาหารในหอคอย' }; x.over = true; out.push('...'); return out.join(' · '); }
    }
    st.health = Math.max(1, st.health);
    if (Bag && !Bag.meals(st)) out.push('เสบียงหมดแล้ว ต้องหาผลไม้หรือล่าสัตว์กิน');
    if (x.separated) out.push('คืนนี้นอนคนเดียว');
    st.life.sleptAt = 'tower'; st.life.roomSlept = null; st.life.fedDay = st.day;
    return out.join(' · ');
  }
  // the day the hero walks out: report what came home
  function close(st) {
    const x = X(st); if (!x) return null;
    const abandoned=Bag&&Bag.abandonFloorLoot(st,x.floor)||0; x.over = true;
    // a guild member's party pays for every day inside (by the guild's rate); a hired guard's deposit covers 5 days
    const days = st.day - x.start + 1;
    const RATE = { guild: 14, compass: 6 + Math.floor((st.intelligence || 15) / 10), porter: 9 };
    if (x.party && RATE[x.party]) { const pay = RATE[x.party] * days; st.money += pay; x.loot.coin = (x.loot.coin || 0) + pay; }
    if (x.party === 'porter') st.porterTrips = (st.porterTrips || 0) + days;
    if (x.party === 'guard' && days > 5) { const due = Math.min(st.money, GUARD_FEE * (days - 5)); st.money -= due; x.why = 'จ่ายค่าจ้างนักรบเพิ่ม ' + due + ' เหรียญ'; }
    const L = Object.entries(x.loot).map(([id, k]) => (id === 'coin' ? 'เหรียญ' : Bag ? Bag.name(id) : id) + ' ' + k);
    return 'ออกจากหอคอยทางศิลาทางออก (' + days + ' วัน สูงสุดชั้น ' + x.highest + ' ชนะ ' + x.wins + ' ครั้ง)' + (L.length ? ' ได้ ' + L.join(', ') : '') + (x.why ? ' · ' + x.why : '')+(abandoned?' · ของที่ยังไม่เก็บตกหาย '+abandoned+' รายการ':'');
  }
  return { TERRAINS, THEMES, FLOOR_THEMES, themeFor, biomeOf, PARTY, GUARD_FEE, CHOICES, SLOTS_OF_DAY, CAMP_SLEEP, terrainOf, needOf, active, planned, plan, cancel, enter, withTeam, allyPower,
    regionOf, speciesDrops, GUARD_TABLE, encounter, choiceView, resolve, camp, close, X, DIRECTIONS, RANKS, SAFE_KINDS, DROP_WEAPON, DROP_BOOK, rollDrop, isBossFloor, bossOf, ensureWorld, floorWorld, tickWorld, monsterOf, monsterKill, eliteOf, recordEliteHunt, hash, seed, isSafeFloor, safeInfo, safeAction, safeTravel };
});
