'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Life=require('../life-sim.js'),Ar=require('../artisan.js'),Bag=require('../bag.js'),Skills=require('../skills.js'),Alchemy=require('../alchemy.js'),Exp=require('../expedition.js');
let passed=0;
function test(name,fn){try{fn();++passed;console.log('PASS',name);}catch(e){console.error('FAIL',name,e.stack);process.exitCode=1;}}
function game(seed=.33){const st={day:1,money:5000,health:100,energy:100,events:[],townClock:8,position:620,positionY:820};Life.newLife(st,()=>seed);st.life.started=true;Life.ensure(st);return st;}
function fill(st,needs){for(const [id,n] of Object.entries(needs))assert.equal(Bag.add(st,id,n),n,id);}
function make(st,id){fill(st,Ar.FORGE_RECIPES[id].needs);return Ar.forge(st,id);}
test('12 ores with five tiers and ten biome slots retained',()=>{
 assert.equal(Object.keys(Ar.MINERALS).length,12);assert.deepEqual([...new Set(Object.values(Ar.MINERALS).map(m=>m.tier))].sort(),[1,2,3,4,5]);
 const st=game();for(let i=0;i<10;i++)assert.ok(Exp.themeFor(st,i*10+1));
 for(const [id,m]of Object.entries(Ar.MINERALS)){assert.equal(Bag.ITEMS[id].tier,m.tier);assert.equal(Bag.ITEMS[id].kind,'ore');assert.ok(Bag.unitWeight(id)>0);}
});
test('mining uses real floor biome, deterministic seed and tier cap, does not repeat same event',()=>{
 const a=game(),b=JSON.parse(JSON.stringify(a));const x=Ar.mine(a,1,'mine-start',3),y=Ar.mine(b,1,'mine-start',3);
 assert.deepEqual(x,y);assert.equal(x.tier,1);assert.equal(Bag.count(a,x.id),x.n);
 const repeat=Ar.mine(a,1,'mine-start',3);assert.equal(repeat.duplicate,true);assert.equal(Bag.count(a,x.id),x.n);
 for(let floor of [1,11,21,31,41]){const z=Ar.mine(a,floor,'floor-'+floor,3);assert.ok(z.tier<=1+Math.floor((floor-1)/10));}
});
test('mined ore respects manual loot toggle and is not claimed twice',()=>{
 const st=game();Bag.setAuto(st,false);Exp.plan(st,{});st.day=2;st.life.exp.floor=1;
 const result=Ar.mine(st,1,'manual-ore',2);assert.ok(result.queued);assert.equal(Bag.count(st,result.id),0);
 const loot=Bag.pending(st).find(p=>p.id===result.id);assert.ok(loot);assert.ok(Bag.claimLoot(st,loot.uid).ok);
 assert.equal(Bag.claimLoot(st,loot.uid).ok,false);assert.equal(Bag.count(st,result.id),result.n);
});
test('T2 forging is locked behind smith proficiency quest and consumes nothing',()=>{
 const st=game(),r=Ar.FORGE_RECIPES.ember_armor;fill(st,r.needs);let old=Bag.count(st,'ember_ore');
 const out=Ar.forge(st,'ember_armor');assert.equal(out.ok,false);assert.equal(Bag.count(st,'ember_ore'),old);assert.equal(Ar.data(st).attempts,0);
});
test('crafted gear is a unique instance, forge bonuses do not change item rarity or enhancement stage',()=>{
 const st=game();let out=make(st,'copper_knife');if(!out.success){out=make(st,'copper_knife');}
 assert.ok(out.success);const g=Skills.gear(st,out.instanceId);assert.ok(g);assert.equal(g.templateId,'dagger');assert.equal(g.rarity,'normal');assert.equal(g.step,0);assert.equal(g.successCount,0);
 assert.ok(Bag.list(st).some(x=>x.instanceId===g.instanceId));assert.equal(Ar.data(st).successes>=1,true);
 const before=Skills.effectiveGear(st,g.instanceId);assert.ok(Bag.equipGear(st,g.instanceId));assert.equal(st.equip.weapon,g.instanceId);
 assert.equal(Skills.effectiveGear(st,g.instanceId).atk,before.atk);
});
test('T3+ forged equipment remains in rank pool and can carry bonus stats and material special',()=>{
 let produced=[],foundSpecial=false,foundStats=false;
 for(let i=0;i<80&&!(foundSpecial&&foundStats);i++){
  const st=game();st.life.age=20+i;Ar.data(st).tier=3;const r=make(st,'venom_armor');if(r.success){
   const g=Skills.gear(st,r.instanceId);assert.equal(g.rarity,'captain');assert.equal(g.step,0);
   foundSpecial ||= !!g.special;foundStats ||= !!g.affixStats;produced.push(g);
   if(g.special){assert.equal(g.special.id,'poisonWard');assert.ok(g.special.potency>0);}
  }
 }
 assert.ok(produced.length>0);assert.ok(foundSpecial);assert.ok(foundStats);
});
test('smithing trials are three stages and a promotion never happens by XP alone',()=>{
 const st=game(),a=Ar.data(st);a.xp=80;a.successes=9;a.recipes={copper_knife:1,iron_sword:1};
 assert.equal(Ar.mentorStatus(st).status,'available');
 assert.equal(Ar.meetMentor(st).ok,true);assert.equal(a.tier,1);
 assert.equal(Ar.mentorStatus(st).status,'active');a.mineTier=1;
 assert.equal(Ar.meetMentor(st).ok,true);assert.equal(a.promotion.stage,1);
 a.successes+=3;assert.equal(Ar.meetMentor(st).ok,true);assert.equal(a.promotion.stage,2);
 assert.equal(Ar.meetMentor(st).promoted,true);assert.equal(a.tier,2);
 assert.equal(Ar.mentorStatus(st).status,'training');
});
test('all eleven forge recipes reference real stackable ore and gear templates',()=>{
 assert.equal(Object.keys(Ar.FORGE_RECIPES).length,11);
 for(const [id,r]of Object.entries(Ar.FORGE_RECIPES)){assert.ok(Skills.GEAR[r.template]);for(const k of Object.keys(r.needs))assert.ok(Bag.ITEMS[k],id+':'+k);}
});
test('six special remedies are registered and all require ingredients',()=>{
 for(const id of ['might_tonic','mind_draught','swift_tablet','ember_guard_liquid','venom_guard_tablet','aether_elixir']){
  assert.ok(Alchemy.RECIPES[id]);assert.ok(Alchemy.RECIPES[id].buff);assert.ok(Bag.ITEMS[id]);
  for(const k of Object.keys(Alchemy.RECIPES[id].needs))assert.ok(Bag.ITEMS[k]);
 }
 assert.equal(Object.keys(Alchemy.RECIPES).length,18);
});
test('special liquid buffs increase strength and expire after in-game hours, repeat recalc stable',()=>{
 const st=game();const before=st.strength;Bag.add(st,'might_tonic');const r=Alchemy.use(st,'might_tonic');assert.equal(r.ok,true);
 assert.equal(st.strength,before+10);Skills.recalc(st);assert.equal(st.strength,before+10);
 st.townClock+=4.99;assert.equal(Ar.expire(st),0);assert.equal(st.strength,before+10);
 st.townClock+=.02;assert.equal(Ar.expire(st),1);assert.equal(st.strength,before);
});
test('special tablet waits for onset before giving agility buff',()=>{
 const st=game();const before=st.agility;Bag.add(st,'swift_tablet');
 assert.equal(Alchemy.use(st,'swift_tablet',10).pending,true);assert.equal(st.agility,before);
 assert.equal(Alchemy.flush(st,10.24).length,0);assert.equal(Alchemy.flush(st,10.25).length,1);
 assert.ok(st.agility>before);
});
test('fire/poison resistance from potion or armor lowers incoming severity',()=>{
 const st=game();Alchemy.addStatus(st,'burn',2);const before=Alchemy.level(st,'burn');
 Ar.applyBuff(st,'ember_guard_liquid',{resist:'burn',potency:.55},8,'medicine');
 assert.equal(Ar.resistance(st,'burn'),.55);Alchemy.addStatus(st,'burn',1);assert.equal(Alchemy.level(st,'burn'),before);
});
test('five special food recipes use real ingredients and produce stackable meals',()=>{
 const st=game();assert.equal(Object.keys(Ar.SPECIAL_FOOD).length,5);
 for(const [id,r]of Object.entries(Ar.SPECIAL_FOOD)){assert.equal(Bag.ITEMS[id].kind,'meal');for(const k of Object.keys(r.needs))assert.ok(Bag.ITEMS[k]);}
 fill(st,Ar.SPECIAL_FOOD.meal_guardian.needs);const res=Ar.cook(st,'meal_guardian');assert.ok(res.ok);assert.equal(res.n,2);
 assert.equal(Bag.count(st,'meal_guardian'),2);assert.equal(Bag.slotRows(st).find(s=>s.id==='meal_guardian').n,2);
});
test('eating a special meal grants its stated buff and consumes one meal',()=>{
 const st=game(),base=st.strength;Bag.add(st,'meal_guardian',2);const used=Ar.consumeFood(st,'meal_guardian');
 assert.equal(used.ok,true);assert.equal(Bag.count(st,'meal_guardian'),1);assert.equal(st.strength,base+4);
});
test('meal auto-consumption on night also activates buff without doubling it',()=>{
 const st=game(),before=st.strength;Bag.add(st,'meal_guardian');const eaten=Bag.eat(st);
 // Ration expires earlier if carried; remove starter ration before the test without bypassing real Bag.
 if(eaten!=='meal_guardian'){Bag.add(st,'meal_guardian');Bag.take(st,'ration',Bag.count(st,'ration'));assert.equal(Bag.eat(st),'meal_guardian');}
 assert.equal(st.strength,before+4);
});
test('time-limited buffs persist through save serialization and migrate old saves',()=>{
 const st=game();Ar.applyBuff(st,'meal_guardian',{strength:4},8,'food');const copy=JSON.parse(JSON.stringify(st));Life.ensure(copy);
 assert.equal(Ar.buffs(copy).length,1);assert.equal(copy.strength,st.strength);
 delete copy.artisan;delete copy.buffs;Life.ensure(copy);assert.equal(Ar.data(copy).tier,1);assert.deepEqual(copy.buffs,[]);
});
test('forge/mentor/cook errands use actual city paths and do not repeat after completion',()=>{
 const st=game();const r=Ar.FORGE_RECIPES.copper_knife;fill(st,r.needs);
 Life.setOrder(st,{kind:'artisanForge',recipe:'copper_knife',repeat:false},8);
 assert.ok(Life.milestones(st).some(([k])=>k==='errand'));
 const done=Life.applyOrder(st,'errand');assert.ok(done&&done.includes('หลอม'));
 const attempts=Ar.data(st).attempts;assert.equal(Life.applyOrder(st,'errand'),null);assert.equal(Ar.data(st).attempts,attempts);
});
test('body stat and specials are visible in game interface and script load order is correct',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');const ui=fs.readFileSync(path.join(__dirname,'../life-ui.js'),'utf8');
 assert.ok(html.includes('artisan.js?v=121'));assert.ok(html.indexOf('artisan.js')<html.indexOf('alchemy.js'));
 assert.ok(html.indexOf('alchemy.js')<html.indexOf('bag.js'));assert.ok(ui.includes('artisanHtml'));assert.ok(ui.includes('data-artisan-forge'));
 assert.ok(ui.includes("stat('magicPower'"));
});
test('new life clears smith mastery and timed buffs instead of inheriting a prior hero',()=>{
 const st=game(),a=Ar.data(st);a.tier=4;a.xp=500;Ar.applyBuff(st,'might_tonic',{strength:10},6,'medicine');
 assert.equal(Ar.data(st).tier,4);assert.equal(Ar.buffs(st).length,1);
 Life.newLife(st,()=>.31);Life.ensure(st);assert.equal(Ar.data(st).tier,1);assert.equal(Ar.data(st).xp,0);assert.equal(Ar.buffs(st).length,0);
 assert.equal(st.base.magicPower,15);
});
test('all tiered ores can be sold to smith and tower safe trader without changing stack rules',()=>{
 const st=game();for(const id of Object.keys(Ar.MINERALS)){
  assert.ok(Bag.BUYERS.smith.takes.includes(id));assert.ok(Bag.SAFE_BUYER.includes(id));
  assert.ok(Bag.safeSellPrice(id,5)>0);
  assert.equal(Bag.add(st,id,30),30);assert.equal(Bag.slotRows(st).find(row=>row.id===id).n,30);
  const old=Bag.count(st,id);const sold=Bag.safeSell(st,id,5);assert.ok(sold.ok,id);assert.equal(Bag.count(st,id),old-1);
 }
});
test('slot engine is frozen and byte-for-byte unchanged',()=>{
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../tower-slot-engine.js'))).digest('hex'),'ab89494b158de760544e1ba4ddc5dd1d78ad68ac68590b69fdff35ce0c622319');
});
console.log('\nRESULT: '+passed+'/21 tests passed'+(process.exitCode?' (FAIL)':' (OK)'));
