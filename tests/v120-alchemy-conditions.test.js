'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Bag=require('../bag.js'),A=require('../alchemy.js'),Skills=require('../skills.js'),Life=require('../life-sim.js'),Exp=require('../expedition.js');
let passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name,e.stack);process.exitCode=1;}}
function game(){const st={day:1,money:5000,energy:100,health:100,position:620,positionY:820};Life.newLife(st,()=>.33);st.life.started=true;Life.ensure(st);return st;}
function fill(st,needs,n=1){for(const [id,qty]of Object.entries(needs)) assert.equal(Bag.add(st,id,qty*n),qty*n,'add '+id);}
function canHealPatient(st){const p=A.patient(st);return Object.keys(A.RECIPES).filter(id=>!!A.RECIPES[id].remove[p.id]);}
test('14 tiered herbs, original 12 plus 6 special liquid/tablet recipes, 18 conditions 4 levels',()=>{
 assert.equal(Object.keys(A.HERBS).length,14);assert.equal(Object.keys(A.RECIPES).length,18); // v121 adds six special medicines to the original twelveassert.equal(Object.keys(A.CONDITIONS).length,18);
 assert.equal(Object.values(A.HERBS).filter(x=>x.tier===5).length,1);
 assert.ok(Object.values(A.RECIPES).some(x=>x.form==='tablet'));
 assert.ok(Object.values(A.RECIPES).some(x=>x.form==='liquid'));
 for(const [id,r] of Object.entries(A.RECIPES)){assert.equal(Bag.ITEMS[id].tier,r.tier);for(const ingredient of Object.keys(r.needs))assert.ok(Bag.ITEMS[ingredient],ingredient);}
});
test('T1 dual remedy reduces both dizzy and hungry severity 2 -> 1 after tablet onset',()=>{
 const st=game();A.addStatus(st,'hungry',2);A.addStatus(st,'dizzy',2);
 Bag.add(st,'travel_tablet');const result=A.use(st,'travel_tablet',12);
 assert.ok(result.pending);assert.equal(Bag.count(st,'travel_tablet'),0);assert.equal(A.level(st,'hungry'),2);
 assert.deepEqual(A.flush(st,12.24),[]);assert.equal(A.flush(st,12.25).length,1);
 assert.equal(A.level(st,'hungry'),1);assert.equal(A.level(st,'dizzy'),1);assert.equal(A.flush(st,13).length,0);
});
test('liquid dual remedy works immediately; other statuses untouched',()=>{
 const st=game();A.addStatus(st,'thirst',3);A.addStatus(st,'dizzy',2);A.addStatus(st,'bleeding',2);
 Bag.add(st,'hydration_liquid');const r=A.use(st,'hydration_liquid');assert.ok(r.ok&&!r.pending);
 assert.equal(A.level(st,'thirst'),2);assert.equal(A.level(st,'dizzy'),1);assert.equal(A.level(st,'bleeding'),2);
});
test('one-status remedy affects only target, no underflow and level 4 cap',()=>{
 const st=game();A.addStatus(st,'bleeding',99);assert.equal(A.level(st,'bleeding'),4);
 Bag.add(st,'wound_liquid',5);A.use(st,'wound_liquid');assert.equal(A.level(st,'bleeding'),3);
 for(let i=0;i<4;i++)A.use(st,'wound_liquid');assert.equal(A.level(st,'bleeding'),0);
 A.addStatus(st,'bleeding',-100);assert.equal(A.level(st,'bleeding'),0);
});
test('carried weight and 20 slots still work; herbs stack without quantity limit',()=>{
 const st=game();Bag.add(st,'root_food',999);assert.equal(Bag.slotCount(st),2);
 assert.equal(Bag.slotRows(st).find(r=>r.id==='root_food').n,999);
 assert.equal(Bag.loadStatus(st).immobile,true);Bag.take(st,'root_food',999);
 assert.equal(Bag.loadStatus(st).immobile,false);
});
test('status agility penalty works with weight and restores without permanent loss',()=>{
 const st=game(),before=st.agility;A.addStatus(st,'dizzy',3);
 assert.ok(st.agility<before);const low=st.agility;
 Skills.recalc(st);Skills.recalc(st);assert.equal(st.agility,low);
 A.treat(st,{dizzy:3});assert.equal(st.agility,before);
});
test('recipe success probability monotonic with proficiency and capped',()=>{
 const st=game(),c1=A.chance(st,'wound_liquid','apothecary');
 A.data(st).tier=5;const c2=A.chance(st,'wound_liquid','apothecary');
 assert.ok(c2>c1);assert.ok(c2<=.95);assert.ok(c1>.5);
 A.addStatus(st,'fatigue',4);assert.ok(A.chance(st,'wound_liquid','apothecary')<c2);
});
test('high-tier recipes blocked for novice without consuming anything or increasing attempt counter',()=>{
 const st=game(),needs=A.RECIPES.deep_wound_liquid.needs;fill(st,needs);const before=Bag.count(st,'blood_flower');
 const n=A.data(st).attempts,res=A.craft(st,'deep_wound_liquid');assert.equal(res.ok,false);
 assert.equal(Bag.count(st,'blood_flower'),before);assert.equal(A.data(st).attempts,n);
});
test('craft success or failure consumes materials, increases XP and attempts exactly once',()=>{
 const st=game(),R=A.RECIPES.wound_liquid;fill(st,R.needs,6);
 const a=A.data(st),hp=st.health;
 const results=Array.from({length:6},()=>A.craft(st,'wound_liquid'));
 assert.equal(results.filter(r=>r.ok).length,6);assert.equal(a.attempts,6);assert.equal(a.count,6);
 assert.equal(Bag.count(st,'bind_grass'),0);assert.equal(st.health,hp);
 assert.ok(a.xp>=6);assert.ok(a.successes>0);
});
test('same save and same attempts produce same crafting results',()=>{
 const one=game(),two=JSON.parse(JSON.stringify(one)),R=A.RECIPES.wound_liquid;
 fill(one,R.needs,10);fill(two,R.needs,10);
 const x=Array.from({length:10},()=>A.craft(one,'wound_liquid'));
 const y=Array.from({length:10},()=>A.craft(two,'wound_liquid'));
 assert.deepEqual(x.map(r=>r.success),y.map(r=>r.success));assert.equal(one.alchemy.attempts,10);
});
test('old save migrates without losing old potion or legacy herbal items',()=>{
 const st=game();delete st.alchemy;delete st.conditions;Bag.add(st,'herb',10);Bag.add(st,'potion',3);
 const copy=JSON.parse(JSON.stringify(st));Life.ensure(copy);
 assert.equal(Bag.count(copy,'herb'),10);assert.equal(Bag.count(copy,'potion'),3);
 assert.equal(copy.alchemy.tier,1);assert.deepEqual(copy.conditions,{});
});
test('forage uses real stable biome and no rare T5 in early floor',()=>{
 const st=game(),t1=Exp.themeFor(st,1).id;
 const seen=[];
 for(let i=0;i<100;i++){const r=A.forage(st,1,'ev-'+i,1);assert.ok(r);seen.push(r.id);assert.equal(A.HERBS[r.id].tier,1);}
 assert.equal(Exp.themeFor(st,1).id,t1);
 assert.ok(A.data(st).gatherMax>=1);
});
test('manual gather respects auto pickup off and only claims once',()=>{
 const st=game();Bag.setAuto(st,false);Exp.plan(st,{});st.life.exp.floor=2;
 const r=A.forage(st,2,'manual-4',1);assert.ok(r.queued);
 assert.equal(Bag.count(st,r.id),0);assert.equal(Bag.pending(st).length,1);
 assert.ok(Bag.claimLoot(st,Bag.pending(st)[0].uid).ok);
 assert.equal(Bag.count(st,r.id),1);
});
test('daily hunger dehydration and sleeping conditions apply once per day, no double tick',()=>{
 const st=game();st.day=2;const r=A.daily(st,{fed:false,inTower:true,drank:false,rested:false});assert.ok(r.length);
 assert.equal(A.level(st,'hungry'),1);assert.equal(A.level(st,'thirst'),1);assert.equal(A.level(st,'sleepDebt'),1);
 A.daily(st,{fed:false,inTower:true,drank:false,rested:false});assert.equal(A.level(st,'hungry'),1);
});
test('critical bleed can kill on untreated daily progression (not all level 4 automatically lethal)',()=>{
 const st=game();st.health=5;A.addStatus(st,'bleeding',4);st.day++;
 A.daily(st,{fed:true,rested:true,inTower:false});assert.ok(st.life.dead);
 const other=game();A.addStatus(other,'dizzy',4);other.day++;A.daily(other,{fed:true,rested:true,inTower:false});assert.ok(!other.life.dead);
});
test('patient exists deterministically per game day and cannot duplicate full cure',()=>{
 const st=game(),saved=JSON.parse(JSON.stringify(st));
 assert.deepEqual(A.patient(st),A.patient(saved));
 let loops=0;while(!canHealPatient(st).length&&loops++<25){st.day++;}
 assert.ok(canHealPatient(st).length);
 const r=canHealPatient(st)[0];Bag.add(st,r,5);
 for(let i=0;i<5&&A.patient(st).level>0;i++)assert.ok(A.treatPatient(st,r).ok);
 assert.equal(A.patient(st).treated,true);assert.equal(A.treatPatient(st,r).ok,false);
});
test('mentor promotion requires actual crafting/gathering/treatment across sequential chapters',()=>{
 const st=game(),a=A.data(st);
 const recipeNames=['travel_tablet','wound_liquid'];
 for(let i=0;i<26;i++){
   const id=recipeNames[i%2],R=A.RECIPES[id];
   for(const [k,n]of Object.entries(R.needs)){if(Bag.count(st,k)<n)assert.equal(Bag.add(st,k,n*3),n*3);}
   A.craft(st,id);
 }
 assert.ok(a.xp>=65);assert.ok(a.successes>=8);assert.ok(Object.keys(a.recipes).length>=2);
 assert.equal(A.mentorStatus(st).status,'available');
 const a1=A.meetMentor(st);assert.ok(a1.ok);assert.equal(a.tier,1);
 assert.equal(A.meetMentor(st).ok,false); // still must discover herb
 A.forage(st,1,'mentor-forage',1);
 assert.equal(A.mentorStatus(st).status,'ready');assert.equal(A.meetMentor(st).ok,true);
 for(let i=0;i<4;i++){
   const id='wound_liquid',R=A.RECIPES[id];
   for(const [k,n]of Object.entries(R.needs))if(Bag.count(st,k)<n)Bag.add(st,k,n*3);
   A.craft(st,id);
 }
 assert.ok(A.mentorStatus(st).status==='ready');A.meetMentor(st);
 A.addStatus(st,'bleeding',2);assert.equal(Bag.add(st,'wound_liquid',2),2);
 A.use(st,'wound_liquid');A.use(st,'wound_liquid');
 assert.equal(A.mentorStatus(st).status,'ready');const res=A.meetMentor(st);
 assert.ok(res.promoted);assert.equal(a.tier,2);assert.equal(a.promotion,null);
});
test('all medicine effect totals respect per-tier balance caps',()=>{
 const totals=[0,2,3,5,7,9];
 for(const [id,r]of Object.entries(A.RECIPES)){
  const values=Object.values(r.remove);assert.ok(values.every(v=>v<=Math.min(4,r.tier)));
  assert.ok(values.reduce((x,y)=>x+y,0)<=totals[r.tier],id);
 }
});
test('every condition has at least one medicinal remedy',()=>{
 for(const id of Object.keys(A.CONDITIONS))assert.ok(Object.values(A.RECIPES).some(r=>r.remove[id]),id);
});
test('T5 verdant medicine protects from new poisoning temporarily',()=>{
 const st=game();Bag.add(st,'verdant_liquid');A.use(st,'verdant_liquid');A.addStatus(st,'poison',3);assert.equal(A.level(st,'poison'),0);st.day+=2;A.addStatus(st,'poison',1);assert.equal(A.level(st,'poison'),1);
});
test('real after-work route visits apothecary and crafts only once per appointment',()=>{
 const st=game(),r=A.RECIPES.wound_liquid;fill(st,r.needs);Life.setOrder(st,{kind:'alchemy',recipe:'wound_liquid',repeat:false},5);
 assert.ok(Life.dayPlan(st).some(seg=>seg.task==='alchemy'&&seg.place==='apothecary'));
 assert.equal(Life.applyOrder(st,'errand')?.includes('ปรุง'),true);
 assert.equal(A.data(st).attempts,1);assert.equal(Life.applyOrder(st,'errand'),null);assert.equal(A.data(st).attempts,1);
});
test('real daily night applies medicine status without changing tower ecology',()=>{
 const st=game();A.addStatus(st,'poison',2);st.day++;const before=st.health,age=st.day;
 const notes=Life.night(st);assert.ok(notes.some(t=>t.includes('ติดพิษ')));assert.ok(st.health<before);
 assert.equal(st.day,age);assert.ok(st.tower);
});
test('browser integration includes new module before dependent game scripts and preserves slot engine bytes',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.ok(html.indexOf('alchemy.js?v=120')<html.indexOf('bag.js?'));
 assert.ok(html.includes('tower-slot-engine.js?v=109'));
 const ui=fs.readFileSync(path.join(__dirname,'../life-ui.js'),'utf8');
 assert.ok(ui.includes('alchemyHtml'));assert.ok(ui.includes('data-alchemy-craft'));assert.ok(ui.includes('data-alchemy-mentor'));
});
console.log(`\nRESULT: ${passed}/23 tests passed (${process.exitCode?'FAIL':'OK'})`);
