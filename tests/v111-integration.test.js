'use strict';
// Tests import the EXACT shipping modules in this ZIP. No mock Expedition/Skills/Bag/LifeSim/Engine.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Bag = require('../bag.js');
const Skills = require('../skills.js');
const Engine = require('../tower-slot-engine.js');
const Expedition = require('../expedition.js');
const LifeSim = require('../life-sim.js');
let passed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('PASS', name); }
  catch (error) { console.error('FAIL', name, error.stack); process.exitCode = 1; }
}
function hero() {
  const st = { day: 1, money: 10, energy: 100, health: 100, food: 1, strength: 3, agility: 3, intelligence: 3, events: [] };
  const origin = LifeSim.newLife(st, () => 0.42);
  st.life.started = true;
  assert.ok(origin && LifeSim.ensure(st));
  return st;
}
function safeHero(floor = 25) {
  const st = hero(); st.money = 5000;
  assert.equal(Expedition.plan(st, {party: null}).ok, true);
  st.day = 2; const x = Expedition.X(st); x.floor = 4; x.stones[4] = {up: true};
  const e = Expedition.encounter(st, 'x1');
  assert.equal(e.scene, 'stone');
  const move = Expedition.resolve(st, e, e.choices.findIndex(q => q.use === 'up'));
  assert.equal(move.reels, null); assert.equal(x.floor, 5);
  if (floor !== 5) {
    x.floor = floor; x.highest = floor; x.safeSeen = floor; x.safePending = true;
    Expedition.safeInfo(st);
  }
  return st;
}
check('actual CommonJS module APIs, frozen slot engine is NOT monkeypatched', () => {
  for (const mod of [Bag, Skills, Engine, Expedition, LifeSim]) assert.equal(typeof mod, 'object');
  assert.equal(Object.isFrozen(Engine), true);
  assert.equal(typeof Engine.spin, 'function');
  assert.equal(typeof Expedition.safeAction, 'function');
  assert.equal(typeof Skills.readBook, 'function');
});
check('new game enters tower at floor 1; old saves migrate with no new-field assumptions', () => {
  const st = hero();
  assert.equal(Expedition.plan(st, {}).ok, true);
  assert.equal(Expedition.X(st).floor, 1);
  const old = hero(); delete old.tower; delete old.activeSkill;
  old.skills.sword = {tier: 2, xp: 3}; LifeSim.ensure(old);
  assert.equal(old.activeSkill, 'sword'); assert.equal(old.tower.v, 112);
  assert.ok(old.tower.floors && Array.isArray(old.tower.news));
});
check('floor 5 arrival opens repeatable safe zone once; floor 10 is also a safe zone', () => {
  const st = safeHero(5), x = Expedition.X(st);
  assert.equal(x.safePending, true); assert.equal(Expedition.isSafeFloor(5), true);
  assert.equal(Expedition.isSafeFloor(11), false); assert.equal(Expedition.isSafeFloor(10), true);
  assert.deepEqual(x.stones[5], {exit: true, up: true});
  assert.equal(Expedition.encounter(st, 'x2'), null);   // announced once on arrival, no repeat cards
  x.safeSeen = 0;
  const e = Expedition.encounter(st, 'x2');
  assert.equal(e.scene, 'safe'); assert.equal(e.noSpin, true);
  assert.ok(e.choices.find(q => q.use === 'safe'));
});
check('multiple purchases, sales and reads within same day/session and correct money/item accounting', () => {
  const st = safeHero(), start = st.money, info = Expedition.safeInfo(st);
  const paid = ['book_fire','book_ice','jerky','jerky'].reduce((sum,id) => sum + Bag.safeBuyPrice(id,info.floor,info.price),0);
  assert.equal(Expedition.safeAction(st, 'buy', 'book_fire').ok, true);
  assert.equal(Expedition.safeAction(st, 'buy', 'book_ice').ok, true);
  assert.equal(Expedition.safeAction(st, 'buy', 'jerky').ok, true);
  assert.equal(Expedition.safeAction(st, 'buy', 'jerky').ok, true);
  assert.equal(Bag.count(st, 'jerky'), 2);
  assert.equal(st.money, start - paid);
  assert.equal(Expedition.safeAction(st, 'read', 'book_fire').ok, true);
  assert.equal(Expedition.safeAction(st, 'read', 'book_ice').ok, true);
  assert.equal(Bag.count(st, 'book_fire'), 0);
  assert.equal(Bag.count(st, 'book_ice'), 0);
  assert.ok(st.skills.fire && st.skills.ice);
  assert.equal(Expedition.safeAction(st, 'read', 'book_ice').ok, false);
  assert.equal(Bag.add(st, 'ore', 3), 3);
  const cash = st.money;
  assert.equal(Expedition.safeAction(st, 'sell', 'ore').ok, true);
  assert.equal(Expedition.safeAction(st, 'sell', 'ore').ok, true);
  assert.equal(Bag.count(st, 'ore'), 1);
  assert.equal(st.money, cash + 2 * Bag.safeSellPrice('ore', info.floor, 1 / info.price));
});
check('chest deposit and withdrawal individually repeat; never silently sell/eat items', () => {
  const st = safeHero(); assert.equal(Bag.add(st,'crystal',3),3);
  assert.equal(Expedition.safeAction(st,'deposit','crystal').ok,true);
  assert.equal(Expedition.safeAction(st,'deposit','crystal').ok,true);
  assert.equal(Bag.count(st,'crystal'),1); assert.equal(Bag.stashCount(st),2);
  assert.equal(Expedition.safeAction(st,'withdraw','crystal').ok,true);
  assert.equal(Expedition.safeAction(st,'withdraw','crystal').ok,true);
  assert.equal(Bag.count(st,'crystal'),3); assert.equal(Bag.stashCount(st),0);
  assert.equal(Expedition.safeAction(st,'deposit','ration').ok,false);
});
check('rest limits only rest, while shop/chest still work; hiring is unique', () => {
  const st = safeHero(); st.health=25; st.energy=10;
  assert.equal(Expedition.safeAction(st,'rest').ok,true);
  assert.equal(st.health,57); assert.equal(st.energy,100);
  assert.equal(Expedition.safeAction(st,'rest').ok,false);
  assert.equal(Expedition.safeAction(st,'buy','bread').ok,true);
  assert.equal(Expedition.safeAction(st,'hire').ok,true);
  assert.equal(Expedition.X(st).ally.power,83);
  assert.equal(Expedition.safeAction(st,'hire').ok,false);
});
check('safe stones are usable immediately; exit only via stone, not free return', () => {
  const st = safeHero(); const x = Expedition.X(st), origin = x.floor;
  const up = Expedition.safeAction(st, 'stone', 'up', 11);
  assert.equal(up.ok,true); assert.equal(x.floor,origin+1); assert.equal(Expedition.safeInfo(st),null);
  x.floor=10; assert.equal(Expedition.safeInfo(st).floor,10);
  const ex = Expedition.safeAction(st,'stone','exit',12);
  assert.equal(ex.ok,true); assert.equal(x.exitDay,st.day);
  assert.ok(x.exitT > 12); assert.equal(Expedition.encounter(st,'x3'),null);
});
check('one selected active skill: fire/ice gating passes via context; no write to frozen spin', () => {
  const st = safeHero();
  assert.equal(Expedition.safeAction(st,'buy','book_fire').ok,true);
  assert.equal(Expedition.safeAction(st,'buy','book_ice').ok,true);
  Expedition.safeAction(st,'read','book_fire'); Expedition.safeAction(st,'read','book_ice');
  assert.equal(Skills.activeOf(st),'fire');
  assert.equal(Skills.selectActive(st,'ice'),true);
  assert.equal(Skills.activeOf(st),'ice');
  const possible = ctx => Engine.eligible('combat',Engine.contextFor('combat',ctx)).map(a=>a.id);
  assert.ok(possible({elementalFire:false,elementalIce:true}).includes('ice'));
  assert.ok(!possible({elementalFire:false,elementalIce:true}).includes('fire'));
  assert.equal(Skills.selectActive(st,'fire'),true);
  assert.equal(Skills.activeOf(st),'fire');
  assert.equal(Object.isFrozen(Engine),true);
});
check('Expedition.resolve uses real Engine.spin contextual elemental fire/ice (not external wrapper)', () => {
  for (const active of ['fire','ice']) {
    const st = safeHero(), x = Expedition.X(st);
    const book = active === 'fire' ? 'book_fire' : 'book_ice';
    Expedition.safeAction(st,'buy',book); Expedition.safeAction(st,'read',book);
    Skills.selectActive(st,active);
    x.floor = 6; Expedition.floorWorld(st,6);
    // Spin with the exact context and weights Expedition.statWeights uses. Choose an ID that yields the element.
    const element = active;
    const careful = 1 - Math.min(0.3,(st.agility || 15)/300);
    const weights = {sword:1,skill:1,danger:careful,blood:careful,stagger:careful};
    let enc, expected;
    for(let i=0;i<2000;i++) {
      const id='element-'+active+'-'+i;
      const result = Engine.spin('combat',{ worldSeed:st.life.age+':'+st.life.origin, eventId:id+':0',
        context:{hasActiveSkill:true,allyNearby:false,elementalFire:active==='fire',elementalIce:active==='ice',lethalPossible:true},weights });
      if(result.reels.includes(element) && !result.fatal) {
        enc={id,slot:'x2',scene:'combat',kind:'combat',monster:{name:'ฝึกทดสอบ',power:10,species:0},choices:[{w:{}}],beast:false};
        expected=result;break;
      }
    }
    assert.ok(enc,'found elemental spin seed');
    const got=Expedition.resolve(st,enc,0);
    assert.deepEqual(got.reels,expected.reels);
    assert.ok(got.reels.includes(element),'observed '+element+' inside real expedition spin');
  }
});
check('terrains cover floor 30+ and each generated floor has 4 directional species', () => {
  const st=hero();
  for (const floor of [1,5,10,15,20,25,30,31,50]) {
    assert.ok(Expedition.terrainOf(floor));
    const f=Expedition.floorWorld(st,floor);
    assert.equal(f.species.length,4); assert.deepEqual(f.species.map(y=>y.direction),Expedition.DIRECTIONS);
  }
  assert.ok(Expedition.TERRAINS.length >= 7);
});
check('world evolves deterministically independent of the hero and food chain is closed', () => {
  const a=hero(); Expedition.floorWorld(a,1); Expedition.floorWorld(a,10);
  const b=JSON.parse(JSON.stringify(a));
  assert.deepEqual(Expedition.tickWorld(a,366),Expedition.tickWorld(b,366));
  assert.deepEqual(a.tower,b.tower);
  assert.equal(a.tower.lastDay,366);
  assert.ok(a.tower.floors[1].species.some(y=>y.meals>0));
  assert.ok(a.tower.floors[1].species.every(y=>y.champion<=900));
  assert.deepEqual(Expedition.tickWorld(a,366),[]);
  assert.equal(Expedition.floorWorld(a,1).species.length,4);
});
check('LifeSim.night calls real tower simulation and safe-zone camp meal is not consumed twice', () => {
  const st=safeHero(); st.health=50; st.energy=50;
  const mealsBefore=Bag.meals(st);
  Expedition.safeAction(st,'rest');
  assert.ok(Expedition.camp(st).includes('เซฟโซน'));
  assert.equal(Bag.meals(st),mealsBefore);
  st.day++;
  const messages=LifeSim.night(st);
  assert.equal(st.tower.lastDay,st.day);
  assert.ok(Array.isArray(messages));
  assert.equal(Bag.meals(st),mealsBefore);
});
check('actual life-ui.js loads in Node under minimal document interfaces; no observers/wrapper injected', () => {
  // The UI is browser-native and intentionally not a CommonJS module; only DOM creation at load is stubbed.
  global.document={ createElement:() => ({ textContent:'' }), head:{appendChild(){}} };
  global.window={}; global.Image = class Image { constructor(){ this.complete=false; this.naturalWidth=0; } };
  require('../life-ui.js');
  assert.equal(typeof window.LifeUI.init,'function');
  assert.equal(typeof window.LifeUI.safeCard,'function');
  assert.equal(typeof window.LifeUI.panel,'function');
  const src=fs.readFileSync(path.join(__dirname,'../life-ui.js'),'utf8');
  assert.ok(src.includes('data-safe-action')); assert.ok(!src.includes('MutationObserver'));
  assert.ok(src.includes("['shop','ร้าน']")); assert.ok(src.includes("['forage','หาของกิน']"));
});
check('index.html loads the edited original modules with v112 cache keys in correct order', () => {
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  for (const name of ['bag','expedition','life-ui']) assert.ok(html.includes(name+'.js?v=112'),name);
  for (const name of ['skills','life-sim']) assert.ok(html.includes(name+'.js?v=111'),name);
  assert.ok(html.indexOf('tower-slot-engine.js') < html.indexOf('expedition.js'));
  assert.ok(html.indexOf('expedition.js') < html.indexOf('life-sim.js'));
  assert.ok(html.indexOf('life-sim.js') < html.indexOf('life-ui.js'));
});
console.log(`\nRESULT: ${passed}/14 tests passed${process.exitCode ? ' (FAIL)' : ' (OK)'}`);
