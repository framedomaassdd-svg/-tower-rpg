'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const Life=require('../life-sim.js'),Bag=require('../bag.js'),Skills=require('../skills.js');
const Tutorial=require('../tutorial.js'),Craft=require('../craft-game.js'),Alchemy=require('../alchemy.js'),Artisan=require('../artisan.js');
const AlchemyGame=require('../alchemy-minigame.js'),CookGame=require('../cook-minigame.js');
const SmithGame=require('../smith-minigame.js'),CarrotGame=require('../carrot-minigame.js');
let passed=0,failed=0;
function test(title,fn){try{fn();passed++;console.log('PASS',title);}catch(e){failed++;console.error('FAIL',title,e.stack);}}
function game(){const st={day:1,money:5000,energy:100,health:100,position:620,positionY:820,townClock:7};Life.newLife(st,()=>.33);st.life.started=true;Life.ensure(st);return st;}
function addNeeds(st,needs){for(const [id,n]of Object.entries(needs))assert.equal(Bag.add(st,id,n),n);}
test('tutorial UMD exports exact required API and 11 real paths',()=>{
 for(const fn of ['pending','done','reset'])assert.equal(typeof Tutorial[fn],'function');
 for(const id of Object.keys(Life.PATHS))assert.ok(Tutorial.TUTORIALS['job_'+id],id);
 assert.equal(Object.keys(Life.PATHS).length,11);
 for(const [id,t] of Object.entries(Tutorial.TUTORIALS)){assert.ok(t.when&&t.title&&t.icon);assert.ok(t.pages.length>=1&&t.pages.length<=3);assert.ok(t.pages.every(p=>p.text.length<200),id);}
});
test('start guide is shown once after choice and stored by day',()=>{
 const st=game();assert.equal(Tutorial.pending(st,{event:'start',clock:6}),'start');assert.equal(Tutorial.done(st,'start',6),true);
 assert.equal(st.life.tutorials.start,1);assert.notEqual(Tutorial.pending(st,{event:'start',clock:8}),'start');
});
test('skip/done marks topic; reset allows it to be read again',()=>{
 const st=game();Tutorial.done(st,'alchemy');assert.notEqual(Tutorial.pending(st,{event:'alchemy',clock:7}),'alchemy');
 Tutorial.reset(st);assert.equal(Tutorial.pending(st,{event:'alchemy',clock:7}),'start');
 Tutorial.done(st,'start');assert.equal(Tutorial.pending(st,{event:'alchemy',clock:7}),'alchemy');
});
test('legacy save which visited tower does not replay old tower entrance',()=>{
 const st=game();st.day=24;st.life.exp={start:8,highest:6,done:{'x1@8':true}};delete st.life.tutorials;
 assert.notEqual(Tutorial.pending(st,{event:'tower_enter',clock:8}),'tower_enter');
 assert.ok(st.life.tutorials.tower_enter>0);assert.ok(st.life.tutorials.tower_choice>0);
});
test('legacy craft proficiency skips already completed alchemy tutorial',()=>{
 const st=game();st.day=10;Alchemy.data(st).attempts=4;delete st.life.tutorials;
 assert.notEqual(Tutorial.pending(st,{event:'minigame_alchemy',clock:10}),'minigame_alchemy');
});
test('a new job path can still teach its guide after previously doing another job',()=>{
 const st=game();Tutorial.done(st,'start');st.life.workedDay=3;st.day=5;st.life.path='kitchen';
 assert.equal(Tutorial.pending(st,{event:'job',path:'kitchen',clock:9}),'job_kitchen');
});
test('new item, skill, status and danger guide conditions use real state',()=>{
 const st=game();Tutorial.done(st,'start');assert.equal(Tutorial.pending(st,{event:'world',clock:8}),'bag');
 Tutorial.done(st,'bag');Skills.train(st,'cooking',10);assert.equal(Tutorial.pending(st,{event:'world',clock:9}),'skills');
 Tutorial.done(st,'skills');Alchemy.addStatus(st,'dizzy',1);assert.equal(Tutorial.pending(st,{event:'world',clock:10}),'status');
});
test('one tutorial is queued at a time for a given time instant',()=>{
 const st=game();Tutorial.done(st,'start',10);
 assert.equal(Tutorial.pending(st,{event:'world',clock:10}),null);
 assert.equal(Tutorial.pending(st,{event:'world',clock:10.1}),'bag');
});
test('uniform score: skipping is four stars and does not change chance',()=>{
 assert.deepEqual({...Craft.modifiers(9,true),skipped:false},Craft.modifiers(4,false));
 assert.equal(Craft.modifiers(0).chance,-.1);assert.equal(Craft.modifiers(2).quality,-1);
 assert.equal(Craft.modifiers(4).chance,0);assert.equal(Craft.modifiers(7).chance,.08);
 assert.equal(Craft.modifiers(7).affix,.05);assert.equal(Craft.modifiers(9).chance,.12);
 assert.equal(Craft.modifiers(9).duration,1.25);
});
test('chance cap 5 to 95 percent for every score',()=>{
 for(const stars of [0,1,2,3,4,5,6,7,8,9]){assert.ok(Craft.probability(.995,stars)<=.95);assert.ok(Craft.probability(0,stars)>=.05);}
 assert.ok(Math.abs(Craft.probability(.82,7)-.90)<1e-9);
});
test('craft targets grow with proficiency, narrow with recipe tier',()=>{
 assert.ok(Craft.tolerance(5,2)>Craft.tolerance(1,2));assert.ok(Craft.tolerance(2,5)<Craft.tolerance(2,1));
});
test('recording a scheduled job is immutable and saved in the real life state',()=>{
 const st=game(),order={kind:'alchemy',recipe:'wound_liquid'};
 const start=Craft.begin(st,'alchemy',order);assert.equal(start.recovered,false);
 const again=Craft.begin(st,'alchemy',order);assert.equal(again.recovered,true);assert.equal(again.record.stars,4);
 const done=Craft.commit(st,start.key,8,false);assert.equal(done.stars,8);
 assert.equal(Craft.commit(st,start.key,2,false).stars,8);
 const restored=JSON.parse(JSON.stringify(st));assert.equal(Craft.begin(restored,'alchemy',order).record.stars,8);
 assert.equal(restored.life.craftSessions[start.key].status,'done');
});
test('unfinished activity after reload resumes as neutral four-star skip',()=>{
 const st=game(),order={kind:'artisanForge',recipe:'copper_knife'};Craft.begin(st,'smith',order);
 const restored=JSON.parse(JSON.stringify(st)),again=Craft.begin(restored,'smith',order);
 assert.equal(again.recovered,true);assert.equal(again.record.stars,4);assert.equal(again.record.skipped,true);
});
test('same recipe/day score key stable, new day starts a new session',()=>{
 const st=game(),o={kind:'artisanCook',recipe:'meal_guardian'};const x=Craft.key(st,'cook',o);
 assert.equal(Craft.key(JSON.parse(JSON.stringify(st)),'cook',o),x);st.day++;assert.notEqual(Craft.key(st,'cook',o),x);
});
test('alchemy real chance uses score while preserving default odds and cap',()=>{
 const st=game(),base=Alchemy.chance(st,'wound_liquid','apothecary');
 const poor=JSON.parse(JSON.stringify(st)),best=JSON.parse(JSON.stringify(st));
 addNeeds(poor,Alchemy.RECIPES.wound_liquid.needs);addNeeds(best,Alchemy.RECIPES.wound_liquid.needs);
 const a=Alchemy.craft(poor,'wound_liquid','apothecary',{stars:1}),b=Alchemy.craft(best,'wound_liquid','apothecary',{stars:9});
 assert.ok(Math.abs(a.chance-Math.max(.05,base-.1))<1e-9);
 assert.ok(Math.abs(b.chance-Math.min(.95,base+.12))<1e-9);
 assert.equal(poor.alchemy.attempts,1);assert.equal(best.alchemy.attempts,1);
});
test('low-score medicine is stored as a separate lower-quality batch if successful',()=>{
 let verified=false;
 for(let i=0;i<35;i++){const st=game();st.life.age=20+i;addNeeds(st,Alchemy.RECIPES.wound_liquid.needs);
  const r=Alchemy.craft(st,'wound_liquid','apothecary',{stars:1});if(r.success){assert.equal(Bag.slotRows(st).find(x=>x.id==='wound_liquid').quality,-1);verified=true;break;}}
 assert.ok(verified);
});
test('smith forging chance is affected by stars and original hash outcome is preserved',()=>{
 const st=game(),id='copper_knife',recipe=Artisan.FORGE_RECIPES[id],base=Artisan.chance(st,id);
 const a=JSON.parse(JSON.stringify(st)),b=JSON.parse(JSON.stringify(st));addNeeds(a,recipe.needs);addNeeds(b,recipe.needs);
 const x=Artisan.forge(a,id,{stars:1}),y=Artisan.forge(b,id,{stars:9});
 assert.equal(x.chance,Math.max(.05,base-.10));assert.equal(y.chance,Math.min(.95,base+.12));
 assert.equal(a.artisan.attempts,1);assert.equal(b.artisan.attempts,1);
});
test('cooking with nine stars stores extended-duration food per batch',()=>{
 const st=game(),id='meal_guardian',recipe=Artisan.SPECIAL_FOOD[id];addNeeds(st,recipe.needs);
 const result=Artisan.cook(st,id,{stars:9});assert.ok(result.ok);assert.ok(result.n>0);
 assert.equal(Bag.slotRows(st).find(r=>r.id===id).quality,1);
 st.townClock=8;const r=Artisan.consumeFood(st,id);assert.equal(r.ok,true);
 const buff=st.buffs.find(x=>x.source===id);assert.ok(buff);assert.equal(buff.until-Artisan.now(st),recipe.hours*1.25);
});
test('cooking with poor score stores inferior food without changing unrelated stacks',()=>{
 const st=game(),id='meal_guardian',recipe=Artisan.SPECIAL_FOOD[id];addNeeds(st,recipe.needs);
 const result=Artisan.cook(st,id,{stars:2});assert.ok(result.ok);
 assert.equal(Bag.slotRows(st).find(r=>r.id===id).quality,-1);
});
test('cooking daily steps are deterministic and offer 2 or 3 stages',()=>{
 for(const id of Object.keys(Artisan.SPECIAL_FOOD))for(let day=1;day<=9;day++){
  const steps=CookGame.stepsFor(id,Artisan.SPECIAL_FOOD[id].tier,day);
  assert.deepEqual(steps,CookGame.stepsFor(id,Artisan.SPECIAL_FOOD[id].tier,day));
  assert.ok(steps.length>=2&&steps.length<=3);assert.ok(steps.every(v=>['chop','stir','serve'].includes(v)));
 }
});
test('alchemy ingredient sequence uses actual herb/item IDs from recipe',()=>{
 const keys=AlchemyGame.requiredIngredients(Alchemy.RECIPES.travel_tablet,Bag.ITEMS);
 assert.deepEqual(keys,['root_food','clear_leaf','tablet_binder']);
});
test('minigame original modules and new ones all load in Node without DOM',()=>{
 assert.equal(typeof SmithGame.open,'function');assert.equal(typeof CarrotGame.open,'function');
 assert.equal(typeof CookGame.open,'function');assert.equal(typeof AlchemyGame.open,'function');
 assert.equal(typeof Craft.open,'function');
});
test('index loads tutorial before life-ui and all minigames before the UI',()=>{
 const h=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
 for(const f of ['tutorial.js','craft-game.js','alchemy-minigame.js','cook-minigame.js','smith-minigame.js','carrot-minigame.js']){
   assert.ok(h.includes(f+'?'),f);assert.ok(h.indexOf(f+'?')<h.indexOf('life-ui.js?'),f);
 }
 assert.ok(h.includes('tower-slot-engine.js?v=109'));
});
test('life UI opens tutorials before jobs and mini-games before automatic errand resolution',()=>{
 const u=fs.readFileSync(path.resolve(__dirname,'../life-ui.js'),'utf8');
 assert.ok(u.indexOf("if(maybeGuide('world'")<u.indexOf("if (L.pendingEvent"));
 assert.ok(u.indexOf('scheduledCraft(k,LifeSim.orderToday(state))')<u.indexOf('LifeSim.applyErrand(state, k)'));
 assert.ok(u.includes("res.rescued"));assert.ok(u.includes('data-guide'));
});
console.log('\nRESULT: '+passed+'/'+(passed+failed)+' tests passed'+(failed?' (FAILED)':' (OK)'));if(failed)process.exitCode=1;
