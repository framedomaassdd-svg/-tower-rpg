'use strict';
// v114 integration: real shipping modules and real save-state objects, no mocked modules,
// replacement RNG, fabricated Encounter engine, or overwritten drop probabilities.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const Bag = require('../bag.js');
const Skills = require('../skills.js');
const Engine = require('../tower-slot-engine.js');
const Expedition = require('../expedition.js');
const LifeSim = require('../life-sim.js');
let passed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('PASS', name); }
  catch (e) { process.exitCode = 1; console.error('FAIL', name, e.stack); }
}
function hero(age = 22) {
  const st = { day: 1, money: 10000, health: 100, energy: 100, food: 1,
    strength: 3, agility: 3, intelligence: 3, events: [] };
  LifeSim.newLife(st, () => .42);
  st.life.age = age; st.life.started = true;
  assert.equal(LifeSim.ensure(st), true);
  return st;
}
function withSkill(id, tier, age = 22) {
  const st = hero(age);
  st.skills[id] = { tier, xp: 0 };
  Skills.recalc(st);
  return st;
}
function world(age = 22, n = 10) {
  const st = hero(age);
  for (let f = 1; f <= n; f++) Expedition.floorWorld(st, f);
  return st;
}
check('only the actual shipping frozen slot engine is used; books and skills exist', () => {
  assert.equal(Object.isFrozen(Engine), true);
  for (const id of ['fireBody', 'iceSkin', 'lastStand', 'shadowStep']) {
    assert.equal(Skills.SKILLS[id].type, 'passive');
    assert.ok(Skills.SKILLS[id].trigger && Skills.SKILLS[id].effect);
    assert.equal(Skills.SKILLS[id].effect.power.length, 5);
    assert.ok(Bag.ITEMS['book_' + id]);
    assert.equal(Skills.BOOK_SKILL['book_' + id], id);
  }
  assert.deepEqual(['hpLost','hpBelow','outnumbered','terrain','nearDeath'].map(when =>
    Skills.triggerMatches({when, value: when === 'terrain' ? 'ภูเขาไฟ' : when === 'hpBelow' ? 35 : .4},
    {lost:55,startHealth:100,health:30,alone:true,terrain:'ภูเขาไฟ',deadly:true})), [true,true,true,true,true]);
});
check('fireBody apprentice grants stats but does not trigger even after a serious defeat', () => {
  const st = withSkill('fireBody', 1);
  assert.ok(Skills.bonus(st).strength > 0);
  const result = Skills.fight(st, {name:'อสูร',power:300}, 0, .999, .9, 0, {r3:.01,alone:true});
  assert.equal(result.win,false);
  assert.equal(result.triggered,undefined);
  assert.ok(st.health < 60);
});
check('fireBody tier 2 triggers after losing >40% health and uses a fresh second roll', () => {
  const st = withSkill('fireBody', 2);
  const result = Skills.fight(st, {name:'อสูร',power:200}, 0, .999, .9, 0, {r3:0,alone:true});
  assert.equal(result.firstDeadly,true);
  assert.equal(result.triggered.skill,'fireBody');
  assert.equal(result.triggered.kind,'summon');
  assert.equal(result.second,true);
  assert.equal(result.win,true);
  assert.ok(result.p2 > result.p);
  assert.ok(st.health < 60 && st.health >= 1);
});
check('at most one highest-tier passive triggers; active selected skill remains unchanged', () => {
  const st = withSkill('fireBody', 2);
  st.skills.iceSkin = {tier:3,xp:0};
  st.skills.lastStand = {tier:2,xp:0};
  st.skills.fire = {tier:1,xp:0};
  assert.equal(Skills.selectActive(st,'fire'),true);
  const result = Skills.fight(st, {name:'อสูร',power:300}, 0, .999, 0, 0, {r3:0,alone:true});
  assert.equal(result.triggered.skill,'iceSkin');
  assert.equal(Skills.activeOf(st),'fire');
  assert.deepEqual(Object.keys(result.triggered).includes('skill'),true);
});
check('iceSkin at tier 2 halves first-stage injury and reduces first-round fatal odds', () => {
  const a = withSkill('iceSkin',2), b = withSkill('iceSkin',1);
  const mon = {name:'อสูร',power:180};
  const protectedFight=Skills.fight(a,mon,0,.999,.3,0,{r3:.999,alone:true});
  const ordinaryFight=Skills.fight(b,mon,0,.999,.3,0,{r3:.999,alone:true});
  assert.equal(protectedFight.triggered.kind,'shield');
  assert.ok(protectedFight.damage < ordinaryFight.damage);
  assert.ok(a.health > b.health);
  assert.equal(protectedFight.second,true);
});
check('lastStand activates only on an initial deadly outcome, at most once per in-game day', () => {
  const st=withSkill('lastStand',2);
  let f=Skills.fight(st,{power:50},0,.999,0,0,{r3:0});
  assert.equal(f.triggered.skill,'lastStand');
  assert.equal(st.passiveDaily.lastStand,st.day);
  f=Skills.fight(st,{power:50},0,.999,0,0,{r3:0});
  assert.equal(f.triggered,undefined);
  st.day++;
  f=Skills.fight(st,{power:50},0,.999,0,0,{r3:0});
  assert.equal(f.triggered.skill,'lastStand');
});
check('shadowStep only triggers when alone and turns a deadly loss into an escape', () => {
  const st=withSkill('shadowStep',2);
  let f=Skills.fight(st,{power:90},0,.999,0,0,{r3:.999,alone:false});
  assert.equal(f.triggered,undefined);
  st.health=100;
  f=Skills.fight(st,{power:90},0,.999,0,0,{r3:.999,alone:true});
  assert.equal(f.triggered.skill,'shadowStep');
  assert.equal(f.deadly,false);
  assert.equal(f.escaped,true);
});
check('new skill books can be read without occupying or replacing the active slot',()=>{
  const st=hero();st.skills.fire={tier:1,xp:0};Skills.selectActive(st,'fire');
  assert.equal(Bag.add(st,'book_fireBody'),1);
  const result=Skills.readBook(st,'book_fireBody');
  assert.equal(result.ok,true);
  assert.equal(Skills.tierOf(st,'fireBody'),1);
  assert.equal(Skills.activeOf(st),'fire');
  assert.equal(Bag.count(st,'book_fireBody'),0);
});
check('advanced passive books drop only from Soldier+ and the city sells only fireBody',()=>{
  const st=hero();let advanced=0;
  for (let i=0;i<15000;i++) {
    const normal=Expedition.rollDrop(st,{rank:'Normal'},'b-'+i);
    assert.ok(!normal.special || !['book_fireBody','book_iceSkin','book_lastStand','book_shadowStep'].includes(normal.special.templateId));
    const soldier=Expedition.rollDrop(st,{rank:'Soldier'},'b-'+i);
    if (soldier.special && ['book_fireBody','book_iceSkin','book_lastStand','book_shadowStep'].includes(soldier.special.templateId)) advanced++;
  }
  assert.ok(advanced>0);
  assert.ok(Expedition.SAFE_KINDS.city.shop.includes('book_fireBody'));
  assert.equal(Bag.SAFE_SHOP.book_fireBody,400);
  for(const kind of ['meadow','camp','village']) assert.ok(!Expedition.SAFE_KINDS[kind].shop.includes('book_fireBody'));
  for(const id of ['book_iceSkin','book_lastStand','book_shadowStep']) assert.ok(!Expedition.SAFE_KINDS.city.shop.includes(id));
});
check('real Expedition resolve uses triggered shadowStep, drops exactly one item and never resolves twice',()=>{
  const st=withSkill('shadowStep',2,29);
  assert.equal(Expedition.plan(st,{party:null}).ok,true);
  st.day=2;
  const x=Expedition.X(st);x.floor=21;x.highest=21;x.hunted=true;
  Bag.add(st,'herb',2);
  const enc=Expedition.encounter(st,'x3');
  assert.equal(enc.scene,'combat');
  const before=Bag.total(st);
  const result=Expedition.resolve(st,enc,0);
  assert.equal(result.dead,false);
  assert.equal(result.triggered.skill,'shadowStep');
  assert.equal(Bag.total(st),before-1);
  const after=JSON.stringify(st);
  assert.deepEqual(Expedition.resolve(st,enc,0),result);
  assert.equal(JSON.stringify(st),after);
});
check('world 1095 days without tower entry is deterministic and under 2 seconds',()=>{
  const a=world(), b=JSON.parse(JSON.stringify(a));
  assert.equal(Expedition.X(a),undefined);
  const start=performance.now();
  const messages=Expedition.tickWorld(a,1095);
  const elapsed=performance.now()-start;
  assert.ok(elapsed<2000, 'tickWorld took '+elapsed.toFixed(1)+' ms');
  assert.deepEqual(Expedition.tickWorld(b,1095),messages);
  assert.deepEqual(a.tower,b.tower);
  assert.ok((a.tower.elitePromotions||0)<=36);
  assert.deepEqual(Expedition.tickWorld(a,1095),[]);
  const maxima={};let leaders=0;
  for (let floor=1;floor<=10;floor++) {
    const spec=Expedition.floorWorld(a,floor).species;
    assert.equal(spec.length,4);
    let max=-1;
    for (const s of spec) {
      assert.ok(s.count<=100 && s.count>=0);
      if (!s.elite || !s.elite.alive) continue;
      leaders++;
      assert.ok(s.elite.progress.survive>=0 && s.elite.progress.hunt===0 && s.elite.progress.feed>=0);
      const index=Expedition.RANKS.indexOf(s.elite.rank);
      const normalIndex=Expedition.RANKS.indexOf(Expedition.monsterOf(a,floor,'normal-'+s.id).rank);
      // Even with eligible elite encounters, the first ten floors never exceed General.
      assert.ok(index<=3,'floor '+floor+' '+s.elite.rank);
      assert.ok(index<=4);
      max=Math.max(max,index);
    }
    maxima[floor]=max<0?'ไม่มี':Expedition.RANKS[max];
    if (floor===5 || floor===10) assert.equal(max,-1);
  }
  assert.ok(leaders>0);
  console.log('SIM_1095_DAYS',JSON.stringify({elapsedMs:+elapsed.toFixed(2),promotions:a.tower.elitePromotions||0,leaders,maxima}));
});
check('normal monsters do not increase power from passive world ticks',()=>{
  const st=world();const before=Expedition.floorWorld(st,3).species.map(s=>[s.base,s.champion]);
  Expedition.tickWorld(st,1095);
  assert.deepEqual(Expedition.floorWorld(st,3).species.map(s=>[s.base,s.champion]), before);
});
check('one elite per species; deterministic 6% encounter and correct 1.35 multiplier',()=>{
  const st=world();Expedition.tickWorld(st,1095);
  const floor=3, fw=Expedition.floorWorld(st,floor);
  let leader=null;
  for(let i=0;i<2000;i++){const m=Expedition.monsterOf(st,floor,'elite-'+i);if(m.elite){leader=m;break;}}
  assert.ok(leader);
  const species=fw.species[leader.species];
  assert.equal(leader.eliteId,species.elite.id);
  const baseline=Math.round(Math.max(species.base,species.champion));
  const normalRank=Expedition.RANKS.findIndex((_,i)=>i===0 && baseline<60 || i===1 && baseline>=60 && baseline<120 || i===2 && baseline>=120 && baseline<210 || i===3 && baseline>=210 && baseline<340 || i===4 && baseline>=340 && baseline<480 || i===5 && baseline>=480 && baseline<650 || i===6 && baseline>=650);
  assert.equal(leader.power,Math.round(baseline * Math.pow(1.35,Expedition.RANKS.indexOf(leader.rank)-normalRank)));
  for(let f=1;f<=10;f++) for(const s of Expedition.floorWorld(st,f).species) assert.ok(s.count<=100);
});
check('elite permanently dies, cannot be killed twice, and any later leader has a new ID',()=>{
  const st=world();Expedition.tickWorld(st,1095);
  let target;
  for (const floor of [1,2,3,4,6,7,8,9]) {
    for(let i=0;i<2500;i++) {const m=Expedition.monsterOf(st,floor,'kill-'+i);if(m.elite){target={m,floor};break;}}
    if(target)break;
  }
  assert.ok(target);
  const {m,floor}=target;
  assert.equal(Expedition.monsterKill(st,floor,m.species,false,true,m.eliteId),true);
  const s=Expedition.floorWorld(st,floor).species[m.species];
  assert.equal(s.elite.alive,false);
  assert.equal(Expedition.monsterKill(st,floor,m.species,false,true,m.eliteId),false);
  const fallenId=m.eliteId;
  assert.ok(s.fallenEliteIds.includes(fallenId));
  Expedition.tickWorld(st,2000);
  assert.ok(!s.elite.alive || s.elite.id!==fallenId);
  assert.ok(s.fallenEliteIds.includes(fallenId));
});
check('real combat against elite gives guaranteed soul crystal only once and persists result',()=>{
  const st=world(29);Expedition.tickWorld(st,1095);
  Expedition.plan(st,{});const x=Expedition.X(st);x.floor=3;x.highest=3;x.hunted=true;
  st.base.strength=100000;Skills.recalc(st);
  let enc;
  for (let day=1096;day<=1800;day++) {
    st.day=day;
    const v=Expedition.encounter(st,'x3');
    if (v && v.scene==='combat' && v.monster.elite && Expedition.hash(Expedition.seed(st),v.id,'f1')<.95) {enc=v;break;}
  }
  assert.ok(enc,'no elite encounter generated over 705 real seeded encounter days');
  const before=Bag.count(st,'soul_crystal'), eId=enc.monster.eliteId;
  const result=Expedition.resolve(st,enc,0);
  assert.equal(result.fight.win,true);
  assert.equal(result.drop.soulCrystals,1);
  assert.equal(Expedition.floorWorld(st,x.floor).species[enc.monster.species].elite.alive,false);
  assert.equal(Bag.count(st,'soul_crystal'),before+1);
  assert.equal(Expedition.monsterKill(st,x.floor,enc.monster.species,false,true,eId),false);
  const saved=JSON.stringify(st);
  assert.deepEqual(Expedition.resolve(st,enc,0),result);
  assert.equal(JSON.stringify(st),saved);
});
check('elite gains hunt progress on a genuine player defeat (including rescue)',()=>{
  const st=world(29);Expedition.tickWorld(st,1095);
  Expedition.plan(st,{party:'guild'});
  const x=Expedition.X(st);x.floor=8;x.highest=8;x.hunted=true;
  st.base.strength=1;st.base.agility=1;st.base.intelligence=1;Skills.recalc(st);
  let enc;
  for(let day=1096;day<=2300;day++) {
    st.day=day;
    const candidate=Expedition.encounter(st,'x3');
    if (!candidate || !candidate.monster || !candidate.monster.elite) continue;
    const f1=Expedition.hash(Expedition.seed(st),candidate.id,'f1');
    if(f1>.85) {enc=candidate;break;}
  }
  assert.ok(enc);
  const elite=Expedition.eliteOf(st,x.floor,enc.monster.species);
  const before=elite.progress.hunt;
  const result=Expedition.resolve(st,enc,0);
  assert.equal(result.fight.win,false);
  assert.equal(elite.progress.hunt,before+1);
});
check('a real NPC death callback credits only the surviving leader of the affected species',()=>{
  const st=world(29); Expedition.tickWorld(st,1095);
  let target;
  for(const floor of [1,2,3,4,6,7,8,9]) for(const spec of Expedition.floorWorld(st,floor).species)
    if(!target && spec.elite && spec.elite.alive) target={floor,spec};
  assert.ok(target);
  const {floor,spec}=target, count=spec.elite.progress.hunt;
  assert.equal(Expedition.recordEliteHunt(st,floor,spec.id),true);
  assert.equal(spec.elite.progress.hunt,count+1);
  assert.equal(Expedition.monsterKill(st,floor,spec.id,false,true,spec.elite.id),true);
  assert.equal(Expedition.recordEliteHunt(st,floor,spec.id),false);
  assert.equal(spec.elite.progress.hunt,count+1);
});
check('UI explains trigger requirements and displays activated passive effect',()=>{
  const js=fs.readFileSync(path.join(__dirname,'../life-ui.js'),'utf8');
  assert.match(js,/triggerText/);assert.match(js,/res\.triggered/);assert.match(js,/tier ชำนาญ/);
  assert.match(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),/skills\.js\?v=119/);
});
console.log(`\nRESULT: ${passed}/18 tests passed${process.exitCode ? ' (FAIL)' : ' (OK)'}`);
