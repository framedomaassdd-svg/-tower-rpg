'use strict';
// Real shipping modules and real save states only. No fake gameplay modules, monkey patches, or modified drop tables.
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
  catch (e) { process.exitCode = 1; console.error('FAIL', name, e.stack); }
}
function hero(age = 22) {
  const st = { day: 1, money: 100000, energy: 100, health: 100, food: 1, strength: 3, agility: 3, intelligence: 3, events: [] };
  LifeSim.newLife(st, () => .42);
  st.life.age = age; st.life.started = true;
  assert.equal(LifeSim.ensure(st), true);
  st.money = 100000;
  return st;
}
function findItem(st, step = 0, successCount = 0, condition = r => r >= .5, rarity = 'normal') {
  // Search real sequentially created instances by their deterministic seed roll; no RNG stubs.
  for (let i = 0; i < 300; i++) {
    const item = Bag.addGear(st,'sword',rarity,{from:'drop',floor:4,monster:'อสูร',day:st.day},step);
    assert.ok(item);
    item.successCount = successCount;
    const r = Skills.hashGear(st,item.instanceId,item.successCount,1);
    if (condition(r,item)) return item;
    Bag.removeGear(st,item.instanceId);
  }
  throw Error('cannot find deterministic gear');
}
check('seven rarity IDs, multipliers, colors, three slots and frozen slot engine', () => {
  assert.deepEqual(Skills.RARITIES, ['normal','soldier','captain','general','king','emperor','legendary']);
  assert.deepEqual(Skills.RARITY_MULT, [1,1.3,1.7,2.2,2.9,3.8,5]);
  assert.equal(Skills.RARITY_COLORS.length,7);
  assert.deepEqual(Object.keys(Skills.SLOTS), ['weapon','armor','charm']);
  assert.equal(Object.isFrozen(Engine),true);
  assert.equal(Expedition.RANKS.length,7);
});
check('old worn sword/leather and bag/stash stacks migrate once, preserving power and quantity', () => {
  const st=hero(); st.gearVersion=112;st.gear={};st.gearNextId=0;
  st.equip={weapon:'sword',armor:'leather'};
  st.bag=[{id:'sword',n:2,exp:0},{id:'leather',n:1,exp:0},{id:'bread',n:2,exp:9}];
  st.stash=[{id:'sword',n:3,exp:0}];
  LifeSim.ensure(st);
  assert.equal(st.gearVersion,113);
  assert.equal(Bag.count(st,'sword'),2);assert.equal(Bag.count(st,'leather'),1);
  assert.equal(Bag.stashCount(st),3);
  assert.equal(Object.keys(st.gear).length,8);
  assert.equal(Object.values(st.equip).every(id=>!!st.gear[id]),true);
  const expected = Math.round(st.strength + .6*st.agility + .25*st.intelligence + 11 + 5*.6);
  assert.equal(Skills.power(st),expected);
  const saved=JSON.parse(JSON.stringify(st));LifeSim.ensure(saved);
  assert.equal(Object.keys(saved.gear).length,8);
  const ids=[...Bag.list(saved).filter(s=>s.instanceId).map(s=>s.instanceId),...Bag.stash(saved).map(s=>s.instanceId),...Object.values(saved.equip)];
  assert.equal(new Set(ids).size,ids.length);
  assert.equal(Skills.power(saved), expected);
});
check('every physical gear is one slot, bag exchange and chest transfer retain identity',()=>{
  const st=hero();assert.equal(Bag.add(st,'sword',2),2);
  const [a,b]=Bag.list(st).filter(s=>s.id==='sword').map(s=>s.instanceId);
  assert.notEqual(a,b);
  assert.equal(Bag.equipGear(st,a),true);assert.equal(st.equip.weapon,a);
  assert.equal(Bag.depositItem(st,b),1);
  assert.equal(Bag.count(st,b),0);assert.equal(Bag.withdrawItem(st,b),1);
  assert.equal(Bag.count(st,b),1);assert.equal(Bag.equipGear(st,b),true);
  assert.equal(st.equip.weapon,b);assert.equal(Bag.count(st,a),1);
  assert.equal(Bag.unequipGear(st,'weapon'),true);assert.equal(Bag.count(st,b),1);
  assert.equal(Object.keys(st.gear).length,2);
});
check('normal +3 remains normal and base values use rarity multiplier and step',()=>{
  const st=hero(), item=Bag.addGear(st,'sword','normal',{from:'drop'},3);
  assert.equal(item.rarity,'normal');assert.equal(Skills.effectiveGear(st,item.instanceId).atk,14);
  const rare=Bag.addGear(st,'leather','legendary',{from:'drop'},2);
  assert.equal(Skills.effectiveGear(st,rare.instanceId).def,30);
  const charm=Skills.createGear(st,'charm','soldier',2,'shop');
  assert.equal(Skills.effectiveGear(st,charm.instanceId).bonus.agility,6);
});
check('dropped +2 with no successful enhancements starts with 50%',()=>{
  const st=hero(), item=Bag.addGear(st,'sword','captain',{from:'drop'},2);
  assert.equal(item.successCount,0);assert.equal(Skills.enhanceChance(item),.5);
});
check('failed attempt at +2 retains step and success count, later success changes chance to 40%',()=>{
  const st=hero(), item=findItem(st,2,0,r=>r>=.5);
  Bag.add(st,'soul_crystal',3);
  const failed=Skills.enhance(st,item.instanceId,[],'city');
  assert.equal(failed.ok,true);assert.equal(failed.succeeded,false);assert.equal(item.step,2);
  assert.equal(item.successCount,0);assert.equal(item.enhanceAttempts,1);
  assert.equal(Skills.enhanceChance(item),.5);
  let result;
  for(let attempt=2;attempt<150;attempt++){
    if (Skills.hashGear(st,item.instanceId,0,attempt)<.5) break;
    item.enhanceAttempts=attempt;
  }
  const old=item.enhanceAttempts;
  const needed=Skills.enhanceCost(item).crystals;
  if (Bag.count(st,'soul_crystal')<needed) Bag.add(st,'soul_crystal',needed);
  result=Skills.enhance(st,item.instanceId,[],'city');
  assert.ok(result.ok && result.succeeded);
  assert.equal(item.step,3);assert.equal(item.successCount,1);
  assert.equal(item.enhanceAttempts,old+1);assert.equal(Skills.enhanceChance(item),.4);
});
check('sacrifice rejects other rarity/equipped gear, consumes two matching weapons, max 90%',()=>{
  const st=hero(), target=Bag.addGear(st,'sword','general',{from:'drop'},1);
  const wrong=Bag.addGear(st,'dagger','normal',{from:'drop'});
  const a=Bag.addGear(st,'dagger','general',{from:'drop'},4);
  const b=Bag.addGear(st,'knife','general',{from:'drop'},5);
  const c=Bag.addGear(st,'dagger','general',{from:'drop'});
  Bag.add(st,'soul_crystal',5);
  assert.equal(Skills.enhance(st,target.instanceId,[wrong.instanceId],'city').ok,false);
  assert.equal(Skills.enhance(st,target.instanceId,[target.instanceId],'city').ok,false);
  assert.equal(Bag.equipGear(st,c.instanceId),true);
  assert.equal(Skills.enhance(st,target.instanceId,[c.instanceId],'city').ok,false);
  assert.equal(Skills.enhanceChance(target,[a,b]),.9);
  const r=Skills.enhance(st,target.instanceId,[a.instanceId,b.instanceId],'city');
  assert.equal(r.ok,true);assert.equal(r.chance,.9);
  assert.equal(Skills.gear(st,a.instanceId),null);assert.equal(Skills.gear(st,b.instanceId),null);
  assert.equal(Bag.count(st,'soul_crystal'),4);
});
check('failure at +4 loses one step but rarity and successCount remain',()=>{
  const st=hero(), item=findItem(st,4,0,r=>r>=.5,'king');
  Bag.add(st,'soul_crystal',2);const r=Skills.enhance(st,item.instanceId,[],'city');
  assert.equal(r.succeeded,false);assert.equal(item.step,3);assert.equal(item.rarity,'king');assert.equal(item.successCount,0);
});
check('failure at +6 can destroy item with 20% independent deterministic roll',()=>{
  const st=hero(), item=findItem(st,6,0,(r,g)=>r>=.5 && Skills.hashGear(st,g.instanceId,0,1,'destroy')<.2,'emperor');
  Bag.add(st,'soul_crystal',3);const r=Skills.enhance(st,item.instanceId,[],'city');
  assert.ok(r.ok && r.destroyed && !r.succeeded);assert.equal(Skills.gear(st,item.instanceId),null);assert.equal(Bag.count(st,item.instanceId),0);
});
check('enhance is deterministic on saved clone including attempt counter and costs',()=>{
  const st=hero();const item=Bag.addGear(st,'sword','normal','shop');Bag.add(st,'soul_crystal',8);
  const saved=JSON.parse(JSON.stringify(st));
  const a=Skills.enhance(st,item.instanceId,[],'city'),b=Skills.enhance(saved,item.instanceId,[],'city');
  assert.deepEqual(a,b);assert.deepEqual(st.gear,saved.gear);assert.equal(st.money,saved.money);
  assert.equal(Bag.count(st,'soul_crystal'),7);
});
check('safe village/city enhancements are available but meadow/camp never gain them',()=>{
  assert.equal(Expedition.SAFE_KINDS.village.enhance,true);
  assert.equal(Expedition.SAFE_KINDS.city.enhance,true);
  assert.equal(Expedition.SAFE_KINDS.meadow.enhance,undefined);
  assert.equal(Expedition.SAFE_KINDS.camp.enhance,undefined);
  const st=hero(23);Expedition.plan(st,{});st.day=2;Expedition.X(st).floor=20;
  assert.equal(Expedition.safeInfo(st).enhance,true);
  const item=Bag.addGear(st,'sword','normal','shop');Bag.add(st,'soul_crystal');
  const action=Expedition.safeAction(st,'enhance',item.instanceId,{sacrifices:[]});
  assert.equal(action.ok,true);assert.equal(st.money,100000);
});
check('Normal monsters drop normal weapons ~10% and normal books ~5% across 200,000 seeds',()=>{
  const st=hero(22);let weapon=0,book=0;
  for(let i=0;i<200000;i++){
    const out=Expedition.rollDrop(st,{rank:'Normal'},'kill-'+i);
    if(out.special && out.special.rarity==='normal') {
      if(out.special.kind==='weapon') weapon++;else book++;
    }
    assert.ok(!out.special || ['weapon','book'].includes(out.special.kind));
  }
  assert.ok(Math.abs(weapon/200000-.10)<=.005, String(weapon));
  assert.ok(Math.abs(book/200000-.05)<=.005, String(book));
  console.log('  NORMAL DROPS',weapon,book);
});
check('higher monster rank shifts rewards, cuts beyond legendary, and soul crystal is separate',()=>{
  const st=hero();for(const rank of Expedition.RANKS.slice(1)) {
    for(let i=0;i<1000;i++){
      const r=Expedition.rollDrop(st,{rank},'rank-'+rank+'-'+i);
      assert.ok(!r.special || Skills.rarityIndex(r.special.rarity) >= Expedition.RANKS.indexOf(rank));
      assert.ok([0,1].includes(r.soulCrystals));
    }
  }
  assert.ok(Expedition.rollDrop(st,{rank:'Legendary'},'top').special === null ||
    Expedition.rollDrop(st,{rank:'Legendary'},'top').special.rarity==='legendary');
});
check('book rarity persists and multiplies proficiency on reading',()=>{
  const st=hero();assert.equal(Bag.addBook(st,'book_fire','legendary',{from:'drop'}),true);
  const r=Skills.readBook(st,'book_fire','legendary');
  assert.equal(r.ok,true);assert.equal(st.skills.fire.xp,5);
  assert.equal(Bag.count(st,'book_fire'),0);
  Bag.addBook(st,'book_fire','normal',{from:'drop'});Skills.readBook(st,'book_fire','normal');
  assert.equal(st.skills.fire.xp,6);
});
check('boss lives persistently on floors 4/9/14, floor 5 remains fully safe',()=>{
  const st=hero();for(const floor of [4,9,14,19]){
    const a=Expedition.bossOf(st,floor), b=Expedition.bossOf(st,floor);
    assert.deepEqual(a,b);assert.ok(a && a.alive && a.boss);
    assert.ok(Expedition.RANKS.indexOf(a.rank)>=2);
    assert.equal(Expedition.floorWorld(st,floor).species.length,4);
  }
  assert.equal(Expedition.isBossFloor(5),false);
  assert.equal(Expedition.isSafeFloor(5),true);
  assert.equal(Expedition.monsterOf(st,5,'none'),null);
});
check('floor 4 up stone is blocked by living boss; exit stone still works',()=>{
  const st=hero();Expedition.plan(st,{});st.day=2;const x=Expedition.X(st);
  x.floor=4;x.stones[4]={exit:true,up:true};
  const e=Expedition.encounter(st,'x1');
  assert.equal(e.scene,'stone');assert.match(e.text,/ศิลาทางขึ้นถูกผู้พิทักษ์ชั้นขวางอยู่/);
  assert.ok(e.choices.some(c=>c.use==='exit'));assert.equal(e.choices.some(c=>c.use==='up'),false);
  assert.equal(x.stones[4].up,false);
});
check('boss encounter uses actual combat choices and persists defeat, then ascent reaches safe floor',()=>{
  const st=hero(22);st.base.strength=10000;st.base.agility=10000;Skills.recalc(st);
  Expedition.plan(st,{});st.day=2;const x=Expedition.X(st);x.floor=4;
  const enc=Expedition.encounter(st,'x2');assert.equal(enc.boss,true);
  assert.ok(enc.choices.some(c=>c.flee));
  const res=Expedition.resolve(st,enc,0);assert.ok(res.fight && res.fight.win && !res.dead);
  assert.equal(Expedition.bossOf(st,4).alive,false);
  assert.equal(res.drop.soulCrystals>=2 && res.drop.soulCrystals<=3,true);
  assert.equal(x.stones[4].up,true);
  const before=JSON.stringify(st.gear), bagBefore=JSON.stringify(st.bag);
  const repeated=Expedition.resolve(st,enc,0);assert.deepEqual(repeated,res);
  assert.equal(JSON.stringify(st.gear),before);assert.equal(JSON.stringify(st.bag),bagBefore);
  assert.equal(Expedition.monsterKill(st,4,enc.monster.species,true),false);
  const stone=Expedition.encounter(st,'x1');assert.equal(stone.scene,'stone');
  const n=stone.choices.findIndex(q=>q.use==='up');assert.ok(n>=0);
  Expedition.resolve(st,stone,n);assert.equal(x.floor,5);assert.equal(Expedition.safeInfo(st).floor,5);
});
check('rescued hero loses actual worn instances one by one and retains surviving gear',()=>{
  const st=hero();const a=Bag.addGear(st,'sword','normal','shop'),b=Bag.addGear(st,'leather','normal','shop');
  Bag.equipGear(st,a.instanceId);Bag.equipGear(st,b.instanceId);
  const p=Skills.rescuePenalty(st,6);
  assert.equal(p.gear.length,1);
  assert.equal(Skills.gear(st,p.gear[0]),null);
  assert.equal(Object.values(st.equip).length,1);
});
check('rarity-based selling consumes exactly one unique gear and raises price',()=>{
  const st=hero(), a=Bag.addGear(st,'sword','normal','shop'),b=Bag.addGear(st,'sword','legendary','shop',3);
  const pa=Bag.gearSalePrice(st,a.instanceId,24),pb=Bag.gearSalePrice(st,b.instanceId,24);
  assert.ok(pb>pa);let money=st.money;
  assert.equal(Bag.sellGear(st,b.instanceId).ok,true);
  assert.equal(st.money,money+pb);
  assert.ok(Skills.gear(st,a.instanceId));assert.equal(Skills.gear(st,b.instanceId),null);
});
check('actual UI implements enhance actions and deployed cache keys change',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../life-ui.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  for(const term of ['data-enhance-city','data-enhance-pick','data-enhance-sac','data-enhance-go','data-gear-sell']) assert.ok(src.includes(term),term);
  for(const file of ['bag','skills','expedition','life-sim','life-ui']) assert.ok(html.includes(file+'.js?v=') && html.includes('gear=113'));
});
console.log(`\nRESULT: ${passed}/20 tests passed${process.exitCode?' (FAIL)':' (OK)'}`);
