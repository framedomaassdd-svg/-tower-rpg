'use strict';
// All gameplay APIs are required from the real shipping modules. No substitute Expedition/Bag/Skills/Engine fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Bag = require('../bag.js');
const Skills = require('../skills.js');
const SlotEngine = require('../tower-slot-engine.js');
const Expedition = require('../expedition.js');
const LifeSim = require('../life-sim.js');
let passed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('PASS', name); }
  catch (err) { console.error('FAIL', name, err.stack); process.exitCode = 1; }
}
function player(age, floor = 20) {
  const st = { day: 1, money: 5000, energy: 100, health: 100, food: 1,
    strength: 3, agility: 3, intelligence: 3, events: [] };
  LifeSim.newLife(st, () => 0.42);
  st.life.age = age;
  st.life.started = true;
  assert.equal(LifeSim.ensure(st), true);
  st.money = 5000;
  assert.equal(Expedition.plan(st, { party: null }).ok, true);
  st.day = 2;
  const x = Expedition.X(st);
  x.floor = floor; x.highest = floor;
  return st;
}
const knownAges = { meadow: 18, camp: 20, village: 23, city: 19 };
function byKind(kind) {
  const st = player(knownAges[kind]);
  assert.equal(Expedition.safeInfo(st).kind, kind);
  return st;
}

check('v112 still exports real frozen engine and four safe-floor configurations', () => {
  assert.equal(Object.isFrozen(SlotEngine), true);
  assert.equal(typeof SlotEngine.spin, 'function');
  assert.equal(typeof Skills.readBook, 'function');
  assert.equal(typeof Bag.safeBuy, 'function');
  assert.deepEqual(Object.keys(Expedition.SAFE_KINDS), ['meadow', 'camp', 'village', 'city']);
  for (const spec of Object.values(Expedition.SAFE_KINDS)) {
    assert.ok(spec.name && spec.desc && Array.isArray(spec.services));
    assert.equal(spec.services.includes('stone'), true);
    assert.equal(spec.services.includes('forage'), true);
    assert.ok(spec.weight.length === 3 && spec.price > 0);
  }
});
check('safe kind deterministic across identical real states and persisted even when seed changes', () => {
  const a = byKind('city');
  const b = player(knownAges.city);
  const kind = Expedition.safeInfo(a).kind;
  assert.equal(Expedition.safeInfo(b).kind, kind);
  assert.equal(a.tower.floors[20].safeKind, kind);
  const save = JSON.parse(JSON.stringify(a));
  save.life.age = 18; // would roll meadow on a newly generated floor 20
  assert.equal(Expedition.safeInfo(save).kind, kind, 'stored kind must win over a fresh hash');
  assert.equal(Expedition.floorWorld(save, 20).safeKind, kind);
  assert.equal(Expedition.floorWorld(a, 20), a.tower.floors[20]);
});
check('migration of v111 floor world adds one kind without resetting old species counts', () => {
  const st = player(29), fw = Expedition.floorWorld(st, 20);
  const before = JSON.parse(JSON.stringify(fw.species));
  delete fw.safeKind; st.tower.v = 111;
  const upgraded = Expedition.floorWorld(st, 20);
  assert.equal(upgraded.safeKind, 'village');
  assert.deepEqual(upgraded.species, before);
  assert.equal(st.tower.v, 114);
});
check('many real seeds produce all four kinds and deeper floors increase city weight', () => {
  const hits = {};
  for (const floor of [5, 10, 20]) {
    const counts = { meadow: 0, camp: 0, village: 0, city: 0 };
    for (let age = 10; age < 1010; age++) {
      const st = player(age, floor);
      counts[Expedition.safeInfo(st).kind]++;
    }
    assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), 1000);
    hits[floor] = counts;
  }
  assert.equal(hits[5].city, 0);
  assert.ok(hits[10].city > 0 && hits[20].city > hits[10].city);
  assert.ok(hits[20].meadow > 0);
  for (const type of Object.keys(Expedition.SAFE_KINDS)) assert.ok(hits[20][type] > 0, type);
  console.log('  OBSERVED floor 5/10/20:', JSON.stringify(hits));
});
check('safeInfo returns kind, name, services and preserves immediate stones for all kinds', () => {
  for (const kind of Object.keys(knownAges)) {
    const st = byKind(kind), info = Expedition.safeInfo(st), x = Expedition.X(st);
    assert.equal(info.kind, kind);
    assert.equal(info.name, Expedition.SAFE_KINDS[kind].name);
    assert.deepEqual(info.services, Expedition.SAFE_KINDS[kind].services);
    assert.deepEqual(x.stones[20], { exit: true, up: true });
    assert.equal(st.tower.floors[20].visited, true);
    assert.equal(Expedition.isSafeFloor(20), true);
    assert.equal(Expedition.isSafeFloor(21), false);
    assert.equal(Expedition.monsterOf(st, 20, 'test'), null);
    assert.equal(Expedition.monsterKill(st, 20, 0), false);
  }
});
check('meadow forbids shop/sell/chest/hire/read without changing money or inventory', () => {
  const st = byKind('meadow'), money = st.money;
  assert.equal(Bag.add(st, 'crystal', 2), 2);
  for (const [kind, id] of [['buy','bread'],['sell','crystal'],['deposit','crystal'],['withdraw','crystal'],['hire'],['read','book_fire']]) {
    const result = Expedition.safeAction(st, kind, id);
    assert.equal(result.ok, false, kind);
    assert.match(result.why, /^ที่นี่ไม่มี/, kind);
  }
  assert.equal(st.money, money);
  assert.equal(Bag.count(st, 'crystal'), 2);
  assert.deepEqual(Expedition.safeInfo(st).services, ['stone', 'forage']);
});
check('explorer camp only sells food/medicine; village has no hire or skill books', () => {
  const camp = byKind('camp'), village = byKind('village');
  for (const id of ['bread', 'jerky', 'potion']) assert.equal(Expedition.safeAction(camp, 'buy', id).ok, true, id);
  for (const id of ['sword','book_fire']) assert.equal(Expedition.safeAction(camp, 'buy', id).ok, false, id);
  assert.equal(Expedition.safeAction(camp, 'sell', 'ore').ok, false);
  assert.equal(Expedition.safeAction(camp, 'hire').ok, false);
  assert.equal(Expedition.safeAction(village, 'buy', 'sword').ok, true);
  assert.equal(Expedition.safeAction(village, 'buy', 'book_fire').ok, false);
  assert.equal(Expedition.safeAction(village, 'hire').ok, false);
  assert.equal(Expedition.safeAction(village, 'deposit', 'sword').ok, true);
});
check('city has every service; buying and reading a book and hiring work through real functions', () => {
  const st = byKind('city'), info = Expedition.safeInfo(st);
  assert.deepEqual(info.services, ['shop', 'sell', 'rest', 'chest', 'hire', 'stone', 'forage']);
  const before = st.money;
  assert.equal(Expedition.safeAction(st, 'buy', 'book_fire').ok, true);
  assert.equal(st.money, before - Bag.safeBuyPrice('book_fire', info.floor, info.price));
  assert.equal(Expedition.safeAction(st, 'read', 'book_fire').ok, true);
  assert.ok(st.skills.fire);
  assert.equal(Expedition.safeAction(st, 'hire').ok, true);
  assert.equal(Expedition.X(st).ally.power, 83);
});
check('city prices are lower than village and camp for shared items and lodging', () => {
  const camp = Expedition.safeInfo(byKind('camp'));
  const village = Expedition.safeInfo(byKind('village'));
  const city = Expedition.safeInfo(byKind('city'));
  assert.ok(Bag.safeBuyPrice('potion', 20, city.price) < Bag.safeBuyPrice('potion', 20, village.price));
  assert.ok(Bag.safeBuyPrice('potion', 20, village.price) < Bag.safeBuyPrice('potion', 20, camp.price));
  assert.ok(Math.ceil(16 * city.price) < Math.ceil(16 * village.price));
});
check('forage is daily, deterministic, persists on save, yields more in meadow than city', () => {
  for (const kind of Object.keys(knownAges)) {
    const st = byKind(kind), x = Expedition.X(st), amountBefore = Bag.count(st, 'fruit');
    const one = Expedition.safeAction(st, 'forage');
    assert.equal(one.ok, true);
    const gained = Bag.count(st, 'fruit') - amountBefore;
    assert.ok(gained >= Expedition.SAFE_KINDS[kind].forage[0]);
    assert.ok(gained <= Expedition.SAFE_KINDS[kind].forage[1]);
    assert.equal(Expedition.safeAction(st, 'forage').ok, false);
    assert.equal(x.safeForageDays[20], st.day);
    const restored = JSON.parse(JSON.stringify(st));
    assert.equal(Expedition.safeAction(restored, 'forage').ok, false);
    restored.day++;
    assert.equal(Expedition.safeAction(restored, 'forage').ok, true);
    if (kind === 'meadow') assert.ok(gained >= 2);
    if (kind === 'city') assert.equal(gained, 1);
  }
});
check('meadow free outdoor sleep safely heals less; indoor rooms restore more, once/day', () => {
  const meadow = byKind('meadow'); meadow.health = 25; meadow.energy = 20;
  const money = meadow.money, mealCount = Bag.meals(meadow);
  assert.equal(Expedition.safeAction(meadow, 'rest').ok, true);
  assert.equal(meadow.health, 35); assert.equal(meadow.energy, 65);
  assert.equal(meadow.money, money); assert.equal(Expedition.safeAction(meadow, 'rest').ok, false);
  assert.match(Expedition.camp(meadow), /กลางแจ้ง/);
  assert.equal(Bag.meals(meadow), Math.max(0, mealCount - 1));   // outdoor sleep still eats from the bag
  const camp = byKind('camp'); camp.health = 25; camp.energy = 20;
  assert.equal(Expedition.safeAction(camp, 'rest').ok, true);
  assert.equal(camp.health, 57); assert.equal(camp.energy, 100);
  assert.ok(camp.money < money);
});
check('exit and ascent stones work instantly on every kind without searches', () => {
  for (const kind of Object.keys(knownAges)) {
    const up = byKind(kind);
    assert.equal(Expedition.safeAction(up, 'stone', 'up', 11).ok, true);
    assert.equal(Expedition.X(up).floor, 21);
    assert.equal(Expedition.safeInfo(up), null);
    const down = byKind(kind);
    assert.equal(Expedition.safeAction(down, 'stone', 'exit', 11).ok, true);
    assert.equal(Expedition.X(down).exitDay, down.day);
    assert.equal(Expedition.encounter(down, 'x2'), null);
  }
});
check('only one arrival card appears for the current floor; no repeat after day/save', () => {
  const st = player(18), x = Expedition.X(st);
  assert.equal(x.safeSeen, undefined);
  const enc = Expedition.encounter(st, 'x1');
  assert.equal(enc.scene, 'safe'); assert.match(enc.title, /ทุ่งหญ้าโล่ง/);
  assert.match(enc.text, /ทุ่งหญ้า/);
  const result = Expedition.resolve(st, enc, 0);
  assert.equal(result.reels, null);
  assert.equal(x.safeSeen, 20);
  assert.equal(x.safePending, true);
  assert.equal(Expedition.encounter(st, 'x2'), null);
  x.safePending = false; // equivalent to closing the UI after its first opening
  st.day++;
  assert.equal(Expedition.encounter(st, 'x1'), null);
  const saved = JSON.parse(JSON.stringify(st));
  assert.equal(Expedition.encounter(saved, 'x2'), null);
  assert.equal(Expedition.X(saved).safePending, false);
});
check('no monster combat/night encounter or ecology simulation on safe floor', () => {
  const st = byKind('city'), floor = Expedition.floorWorld(st, 20);
  const pop = floor.species.map(x => ({ count: x.count, champion: x.champion }));
  Expedition.X(st).safeSeen = 20;
  for (const slot of ['x1', 'x2', 'x3', 'xcamp']) assert.equal(Expedition.encounter(st, slot), null, slot);
  Expedition.tickWorld(st, 91);
  assert.deepEqual(floor.species.map(x => ({ count: x.count, champion: x.champion })), pop);
});
check('UI implementation uses only available tabs, includes type on arrival, bag and visited-floor map', () => {
  const src = fs.readFileSync(path.join(__dirname, '../life-ui.js'), 'utf8');
  assert.ok(src.includes('allTabs.filter(([id]) => info.services.includes(id))'));
  assert.ok(src.includes('เซฟโซน ชั้น ${info.floor} · ${esc(info.name)}'));
  assert.ok(src.includes('safeForage') || src.includes("smallButton('forage'"));
  assert.ok(src.includes('visitedSafes'));
  assert.ok(src.includes('เปิดบริการเซฟโซน ชั้น'));
  assert.ok(!src.includes('MutationObserver'));
  assert.equal(typeof Expedition.safeAction, 'function');
});
console.log(`\nRESULT: ${passed}/15 tests passed${process.exitCode ? ' (FAIL)' : ' (OK)'}`);
