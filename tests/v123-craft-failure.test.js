'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Life=require('../life-sim.js'),Bag=require('../bag.js'),Craft=require('../craft-game.js');
const Ar=require('../artisan.js'),Al=require('../alchemy.js');
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS',name);}catch(e){failed++;console.error('FAIL',name,e.stack);}}
function game(n=0){const st={day:1,money:5000,health:100,energy:100,position:620,positionY:820,townClock:7};Life.newLife(st,()=>.33);st.life.started=true;Life.ensure(st);st.life.age=20+n;return st;}
function fill(st,needs){for(const [id,n] of Object.entries(needs))assert.equal(Bag.add(st,id,n),n,id);}
function findTwo(kind,id,score={stars:2}){
 const results={};
 for(let i=0;i<450;i++){
  const st=game(i),recipe=kind==='forge'?Ar.FORGE_RECIPES[id]:kind==='cook'?Ar.SPECIAL_FOOD[id]:Al.RECIPES[id];
  if(kind==='cook'){
   // The target recipe is T1; no fictional proficiency fixture is needed.
  }
  fill(st,recipe.needs);
  const result=kind==='forge'?Ar.forge(st,id,score):kind==='cook'?Ar.cook(st,id,score):Al.craft(st,id,'apothecary',score);
  if(result.ok&&result.success===false)results[result.failure]??={st,result};
  if(results.destroyed&&(kind==='forge'?results.damaged:kind==='cook'?results.poor:results.diluted||results.tainted))break;
 }
 return results;
}
test('catastrophic failure is possible but rare at low tier with good play',()=>{
 assert.ok(Math.abs(Craft.catastrophicRate(1,4)-.12)<1e-10);
 assert.ok(Craft.catastrophicRate(1,9)<Craft.catastrophicRate(1,2));
 assert.ok(Craft.catastrophicRate(5,4)>Craft.catastrophicRate(1,4));
 assert.ok(Craft.catastrophicRate(1,9)>0);
 assert.ok(Craft.catastrophicRate(5,0)<=.70);
 assert.equal(Craft.catastrophicRate(3,9,true),Craft.catastrophicRate(3,4));
});
test('failure never creates an equipment instance from nothing',()=>{
 const cases=findTwo('forge','copper_knife');assert.ok(cases.destroyed&&cases.damaged);
 for(const {st,result} of Object.values(cases)){
  assert.equal(result.instanceId,undefined);
  assert.equal(Object.keys(st.gear||{}).length,0);
  assert.equal(Bag.count(st,'scrap'),0);
  assert.equal(Ar.data(st).attempts,1);
 }
});
test('catastrophic forge destroys the workpiece and all materials',()=>{
 const {st,result}=findTwo('forge','copper_knife').destroyed;
 assert.equal(result.catastrophic,true);assert.equal(result.failure,'destroyed');
 assert.equal(Bag.count(st,'copper_ore'),0);assert.equal(Bag.count(st,'scrap'),0);
 assert.deepEqual(result.salvaged,{});
 assert.ok(result.why.includes('พัง'));
});
test('ordinary forge failure salvages some ore but no finished equipment',()=>{
 const {st,result}=findTwo('forge','copper_knife').damaged;
 assert.equal(result.catastrophic,false);assert.equal(Bag.count(st,'copper_ore'),1);
 assert.equal(result.salvaged.copper_ore,1);assert.ok(result.why.includes('คืน'));
});
test('alchemy failure can lose entire batch and never returns its medicine',()=>{
 const cases=findTwo('alchemy','wound_liquid');assert.ok(cases.destroyed);
 const {st,result}=cases.destroyed;
 assert.equal(result.catastrophic,true);assert.equal(result.failure,'destroyed');
 assert.equal(Bag.count(st,'wound_liquid'),0);assert.equal(Bag.count(st,'bind_grass'),0);
 assert.equal(Al.data(st).attempts,1);
});
test('normal medicine mistakes create lower-quality or contaminated medicine, not target recipe',()=>{
 const cases=findTwo('alchemy','wound_liquid');const other=cases.diluted||cases.tainted;assert.ok(other);
 const {st,result}=other;assert.equal(result.catastrophic,false);
 assert.equal(Bag.count(st,'wound_liquid'),0);
 assert.equal(Bag.count(st,result.failure==='diluted'?'failed_weak_medicine':'failed_tainted_medicine'),1);
});
test('a catastrophically burnt meal leaves no food and loses all ingredients',()=>{
 const cases=findTwo('cook','meal_guardian');assert.ok(cases.destroyed&&cases.poor);
 const {st,result}=cases.destroyed;
 assert.equal(result.catastrophic,true);assert.equal(result.n,0);
 assert.equal(Bag.count(st,'meal_guardian'),0);assert.equal(Bag.count(st,'rice'),0);
 assert.equal(Ar.data(st).cookAttempts,1);
});
test('ordinary failed meal yields one poor serving without claiming success',()=>{
 const {st,result}=findTwo('cook','meal_guardian').poor;
 assert.equal(result.success,false);assert.equal(result.catastrophic,false);assert.equal(result.n,1);
 assert.equal(Bag.count(st,'meal_guardian'),1);
 assert.equal(Bag.slotRows(st).find(x=>x.id==='meal_guardian').quality,-1);
});
test('identical save, attempt and stars have identical result and inventory, no rerolls',()=>{
 const kinds=[['forge','copper_knife'],['alchemy','wound_liquid'],['cook','meal_guardian']];
 for(const [kind,id]of kinds){const st=game(111),recipe=kind==='forge'?Ar.FORGE_RECIPES[id]:kind==='cook'?Ar.SPECIAL_FOOD[id]:Al.RECIPES[id];fill(st,recipe.needs);
  const copy=JSON.parse(JSON.stringify(st));
  const run=s=>kind==='forge'?Ar.forge(s,id,{stars:1}):kind==='cook'?Ar.cook(s,id,{stars:1}):Al.craft(s,id,'apothecary',{stars:1});
  const x=run(st),y=run(copy);assert.deepEqual(x,y);assert.deepEqual(st.bag,copy.bag);
  assert.equal(kind==='alchemy'?st.alchemy.attempts:kind==='forge'?st.artisan.attempts:st.artisan.cookAttempts,1);
 }
});
test('legacy cooking without minigame score still produces the expected meal',()=>{
 const st=game();fill(st,Ar.SPECIAL_FOOD.meal_guardian.needs);
 const r=Ar.cook(st,'meal_guardian');assert.equal(r.success,true);assert.equal(r.n,2);
});
test('UI explains catastrophic consequences and frozen slot engine remains unchanged',()=>{
 const ui=fs.readFileSync(path.resolve(__dirname,'../life-ui.js'),'utf8');
 assert.ok(ui.includes('พังทั้งชิ้น')&&ui.includes('พลาดอาจเสียยาทั้งชุด')&&ui.includes('ไหม้เสียทั้งหมด'));
 const h=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');assert.ok(h.includes('tower-slot-engine.js?v=109'));
});
console.log('\nRESULT: '+passed+'/'+(passed+failed)+' tests passed'+(failed?' (FAILED)':' (OK)'));if(failed)process.exitCode=1;
