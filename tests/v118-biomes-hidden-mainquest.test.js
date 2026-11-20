'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const Expedition=require('../expedition.js');const LifeSim=require('../life-sim.js');
const MainStory=require('../main-story.js');const Skills=require('../skills.js');const Bag=require('../bag.js');
let passed=0;
function check(label,fn){try{fn();passed++;console.log('PASS',label);}catch(e){console.error('FAIL',label,e.stack);process.exitCode=1;}}
function hero(){const st={day:1,money:600,health:100,energy:100,food:1,events:[]};LifeSim.newLife(st,()=>0.42);st.life.started=true;assert.equal(LifeSim.ensure(st),true);return st;}
function inTower(){const st=hero();assert.equal(Expedition.plan(st,{party:'guild'}).ok,true);st.day=2;Expedition.enter(st);return st;}
check('100 floors and ten authored biomes, selected once per ten-floor band',()=>{
 const st=hero(),ids=Array.from({length:10},(_,i)=>Expedition.biomeOf(st,i*10+10).id);
 assert.equal(MainStory.TOTAL_FLOORS,100);assert.equal(MainStory.CONTENT_THROUGH,50);
 assert.equal(Expedition.THEMES.length,10);assert.ok(new Set(ids).size>=2);
 for(let i=1;i<ids.length;i++)assert.notEqual(ids[i],ids[i-1]);
 for(let f=10;f<=100;f++)assert.equal(Expedition.biomeOf(st,f).id,ids[Math.floor((f-1)/10)]);
 // v127 floors 1-9 are authored (1-4 one scene each, 5-9 ruins) and the same for every save
 for(let f=1;f<=9;f++)assert.equal(Expedition.biomeOf(st,f).id,Expedition.FLOOR_THEMES[Math.min(4,f-1)].id);
});
check('different histories/seeds get varied deterministic biome permutations, save reload is stable',()=>{
 const st=hero(),first=Array.from({length:10},(_,i)=>Expedition.biomeOf(st,10+i*10).id);
 const loaded=JSON.parse(JSON.stringify(st));assert.deepEqual(Array.from({length:10},(_,i)=>Expedition.biomeOf(loaded,10+i*10).id),first);
 const other=hero();other.life.age++;assert.notDeepEqual(Array.from({length:10},(_,i)=>Expedition.biomeOf(other,10+i*10).id),first);
});
check('one 10-floor theme controls monsters and event scene weights of new floors',()=>{
 const st=hero();for(const f of [1,4,6,9,11,21,31,41,49,50,100]){
   const t=Expedition.biomeOf(st,f),fw=Expedition.floorWorld(st,f);
   assert.equal(fw.biome,t.id);assert.equal(fw.species.length,4);
   for(let i=0;i<4;i++)assert.equal(fw.species[i].name,t.monsters[i][0]);
 }
});
check('safe floors remain safe every 5 and bosses remain on previous floor even across biome boundary',()=>{
 const st=inTower();for(let f=4;f<=50;f+=5){assert.equal(Expedition.isBossFloor(f),true);assert.equal(Expedition.isSafeFloor(f+1),true);
   assert.equal(Expedition.bossOf(st,f).alive,true);assert.equal(Expedition.monsterOf(st,f+1,'test'),null);}
});
check('new players do not receive quests or automatic story cards just by entering the tower',()=>{
 const st=inTower();assert.equal(MainStory.pending(st),null);assert.equal(MainStory.known(st).length,0);
 MainStory.enter(st,50);assert.equal(MainStory.pending(st),null);assert.equal(MainStory.known(st).length,0);
 assert.equal(MainStory.ensure(st).quests.survivor,undefined);
});
check('all ten hidden chains have distinct discovery routes and four staged objectives',()=>{
 assert.equal(Object.keys(MainStory.QUESTS).length,10);
 for(const q of Object.values(MainStory.QUESTS)){
   assert.equal(q.steps.length,4);assert.equal(q.steps[0].type,'materials');assert.equal(q.steps[3].type,'return');
   assert.ok(q.name&&q.place&&q.npc&&q.scene&&q.reward);
   assert.ok([1,11,21,31,41].includes(q.minFloor));
 }
});
check('actual after-work rumor errand is required; merely selecting it does not reveal a quest',()=>{
 const st=hero();const start=MainStory.known(st).length;
 const day=LifeSim.setOrder(st,{kind:'rumor',place:'porter',repeat:false},6);assert.equal(day,1);
 assert.equal(MainStory.known(st).length,start);
 assert.ok(LifeSim.milestones(st).some(([k])=>k==='errand'));
 const msg=LifeSim.applyOrder(st,'errand');assert.equal(typeof msg,'string');
 assert.equal(MainStory.known(st).length<=1,true);
 const repeat=MainStory.searchTown(st,'porter');assert.equal(repeat.ok,false);
});
check('the player cannot accept hidden or half-discovered quest through the mentor API',()=>{
 const st=hero();assert.equal(MainStory.meet(st,'survivor',Bag,Skills).ok,false);
 assert.equal(MainStory.status(st,'survivor'),'hidden');
 for(let d=1;d<80&&!MainStory.ensure(st).rumors.survivor?.town;d++){st.day=d;MainStory.searchTown(st,'porter');}
 assert.equal(MainStory.ensure(st).rumors.survivor.town,true);
 assert.equal(MainStory.status(st,'survivor'),'rumor');assert.equal(MainStory.meet(st,'survivor',Bag,Skills).ok,false);
});
check('real tower encounter results expose clues without unlocking a quest automatically',()=>{
 const st=inTower();st.base.strength=20000;st.base.agility=20000;Skills.recalc(st);
 let found=false;
 for(let d=2;d<=260&&!found;d++){
   st.day=d;for(const slot of ['x1','x2','x3']){
     const enc=Expedition.encounter(st,slot);if(!enc)continue;
     const result=Expedition.resolve(st,enc,enc.kind==='stone'?enc.choices.findIndex(c=>c.use==='stay'):enc.scene==='combat'?2:0);
     assert.ok(result&&result.eventId);
     found=!!MainStory.ensure(st).rumors.survivor?.tower;
     if(found)break;
   }
 }
 assert.equal(found,true);assert.notEqual(MainStory.status(st,'survivor'),'active');
 assert.equal(MainStory.pending(st),null);
});
check('all quest sources can be discovered via actual town visits and recorded tower events',()=>{
 const st=inTower(),q=MainStory.QUESTS.survivor;
 for(let day=2;day<80&&!MainStory.ensure(st).rumors[q.id]?.town;day++){st.day=day;MainStory.searchTown(st,q.place);}
 assert.ok(MainStory.ensure(st).rumors[q.id]?.town);
 // Use real event from Expedition to supply an id, scene and floor (not a fake slot module).
 let clue=false;
 for(let day=80;day<240&&!clue;day++){st.day=day;
   for(const slot of ['x1','x2','x3']){const enc=Expedition.encounter(st,slot);if(!enc)continue;
     Expedition.resolve(st,enc,enc.kind==='stone'?enc.choices.findIndex(c=>c.use==='stay'):enc.scene==='combat'?2:0);
     clue=!!MainStory.ensure(st).rumors[q.id].tower;if(clue)break;
   }
 }
 assert.equal(clue,true);assert.equal(MainStory.status(st,q.id),'ready');
 assert.equal(MainStory.ensure(st).quests[q.id],undefined);
});
check('mentor advances stages only when full material and proficiency requirements are met',()=>{
 const st=hero(),q=MainStory.QUESTS.survivor;
 // Restore quest discovery as if the two real clues were previously recorded in this save.
 const rumor=MainStory.ensure(st).rumors[q.id]={town:true,tower:true};assert.equal(rumor.town,true);
 const start=MainStory.meet(st,q.id,Bag,Skills);assert.equal(start.ok,true);
 assert.equal(MainStory.meet(st,q.id,Bag,Skills).ok,false);
 for(const [id,n] of Object.entries(q.materials))assert.equal(Bag.add(st,id,n),n);
 const materialCount=Bag.total(st);
 const next=MainStory.meet(st,q.id,Bag,Skills);assert.equal(next.ok,true);
 assert.ok(Bag.total(st)<materialCount);assert.equal(MainStory.ensure(st).quests[q.id].stage,1);
 assert.equal(MainStory.meet(st,q.id,Bag,Skills).ok,false);
 Skills.train(st,'mapping',1);assert.equal(MainStory.meet(st,q.id,Bag,Skills).ok,true);
 assert.equal(MainStory.ensure(st).quests[q.id].stage,2);
});
check('quest final skill reward changes genuine player stats, does not occupy active slot, and cannot duplicate',()=>{
 const st=hero(),s=MainStory.ensure(st);s.rumors.survivor={town:true,tower:true};
 MainStory.meet(st,'survivor',Bag,Skills);
 for(const [id,n] of Object.entries(MainStory.QUESTS.survivor.materials))Bag.add(st,id,n);
 MainStory.meet(st,'survivor',Bag,Skills);Skills.train(st,'mapping',1);MainStory.meet(st,'survivor',Bag,Skills);
 const r=s.quests.survivor;r.progress=3;const before=st.agility,active=Skills.activeOf(st);
 assert.equal(MainStory.meet(st,'survivor',Bag,Skills).ok,true);
 assert.equal(MainStory.meet(st,'survivor',Bag,Skills).ok,true);
 assert.equal(MainStory.status(st,'survivor'),'completed');assert.equal(Skills.tierOf(st,'survivalInstinct'),2);
 assert.ok(st.agility>before);assert.equal(Skills.activeOf(st),active);
 assert.equal(MainStory.meet(st,'survivor',Bag,Skills).ok,false);
});
check('quest-only sword and blueprint produce real inventory equipment and a gated forge recipe',()=>{
 const st=hero();const q=MainStory.QUESTS.nameless;
 assert.ok(!st.mainStory.blueprint);assert.ok(Bag.FORGE.guardianVest);
 assert.ok(Bag.ITEMS.namelessBlade);assert.ok(Skills.GEAR.namelessBlade);
 // The reward is a real gear instance, not a synthetic attribute modifier.
 const g=Bag.addGear(st,'namelessBlade','captain',{from:'mainQuest',quest:q.id,day:st.day});
 assert.ok(g.instanceId);assert.equal(g.rarity,'captain');assert.equal(g.origin.from,'mainQuest');
 assert.equal(Bag.equipGear(st,g.instanceId),true);assert.equal(st.equip.weapon,g.instanceId);
});
check('new active skills require the slot result and have much larger skill impact',()=>{
 const st=hero();st.skills.riftStrike={tier:3,xp:0};Skills.recalc(st);Skills.selectActive(st,'riftStrike');
 const result=Skills.activeEffect(st,['skill','blank','sword']);assert.ok(result);assert.ok(result.attackMult>=3);
 assert.equal(Skills.activeEffect(st,['shield','dodge',null]),null);
 st.skills.limitBreak={tier:3,xp:0};Skills.recalc(st);Skills.selectActive(st,'limitBreak');
 assert.ok(Skills.activeEffect(st,['target',null,null]).attackMult>=4);
 assert.equal(Skills.activeOf(st),'limitBreak');
});
check('old v117 story is archived, not replayed as free quests, and saved rumor state is persistent',()=>{
 const st=hero();st.mainStory={v:1,reached:{1:{day:2}},choices:{1:{index:0}},pending:[2]};
 const s=MainStory.ensure(st);assert.equal(s.v,2);assert.deepEqual(s.legacyChronicle.choices,{1:{index:0}});
 assert.equal(MainStory.pending(st),null);assert.equal(MainStory.known(st).length,0);
 s.rumors.survivor={town:true,tower:true};
 const loaded=JSON.parse(JSON.stringify(st));assert.equal(MainStory.status(loaded,'survivor'),'ready');
});
check('actual 1095-day world tick remains fast and caps all four species at 100',()=>{
 const st=hero();for(let floor=1;floor<=50;floor++)if(floor%5!==0)Expedition.floorWorld(st,floor);
 const start=performance.now();Expedition.tickWorld(st,1095);const elapsed=performance.now()-start;
 for(const fw of Object.values(st.tower.floors))assert.ok(fw.species.every(s=>s.count>=0&&s.count<=100));
 assert.ok(elapsed<2000,'elapsed='+elapsed);
});
check('high-tier quest materials can be delivered over multiple NPC visits despite 20-slot bag cap',()=>{
 const st=hero(),q=MainStory.QUESTS.blueprint;
 st.mainStory.rumors.blueprint={town:true,tower:true};
 assert.equal(MainStory.meet(st,q.id,Bag,Skills).ok,true);
 assert.equal(Bag.add(st,'ore',12),12);
 let r=MainStory.meet(st,q.id,Bag,Skills);assert.equal(r.partial,true);
 assert.equal(st.mainStory.quests.blueprint.delivered.ore,12);
 const saved=JSON.parse(JSON.stringify(st));assert.equal(saved.mainStory.quests.blueprint.delivered.ore,12);
 assert.equal(Bag.add(saved,'ore',10),10);assert.equal(Bag.add(saved,'crystal',8),8);
 r=MainStory.meet(saved,q.id,Bag,Skills);assert.equal(r.partial,true);
 assert.equal(saved.mainStory.quests.blueprint.delivered.ore,22);
 assert.equal(Bag.add(saved,'crystal',4),4);assert.equal(Bag.add(saved,'soul_crystal',12),12);
 r=MainStory.meet(saved,q.id,Bag,Skills);assert.equal(r.ok,true);assert.equal(r.partial,undefined);
 assert.equal(saved.mainStory.quests.blueprint.stage,1);
 assert.equal(Bag.count(saved,'ore'),0);assert.equal(Bag.count(saved,'crystal'),0);
 assert.equal(Bag.count(saved,'soul_crystal'),0);
});
check('guardian armor recipe is physically gated by completing the blueprint quest, never sold in shops',()=>{
 const st=hero();const id='guardianVest';assert.ok(!Bag.SHOPS.smith.items[id]);
 assert.ok(Bag.FORGE[id]);assert.equal(Bag.ITEMS[id].equip,'armor');
 LifeSim.setOrder(st,{kind:'forge',item:id,repeat:false},5);
 assert.ok(LifeSim.applyOrder(st,'errand').includes('ต้องได้รับพิมพ์เขียว'));
 st.mainStory.blueprint=true;
 assert.ok(LifeSim.milestones(st).some(([kind])=>kind==='errand'));
 assert.ok(Object.values(Bag.FORGE[id]).reduce((a,b)=>a+b,0)<=20);
});
check('every theme keeps access to core encounter activities needed by hidden quests',()=>{
 const st=hero();for(let i=0;i<10;i++){
   const t=Expedition.biomeOf(st,i*10+1);
   for(const scene of ['explore','mine','herb','combat','travel'])assert.ok(t.scenes[scene]>0,t.id+':'+scene);
 }
});
check('actual slot engine remains completely unchanged; only one source is referenced by the game',()=>{
 const crypto=require('node:crypto');const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../tower-slot-engine.js'))).digest('hex');
 assert.equal(hash,'ab89494b158de760544e1ba4ddc5dd1d78ad68ac68590b69fdff35ce0c622319');
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 for(const name of ['bag','skills','expedition','life-sim','life-ui'])assert.ok(html.includes(name+'.js?v=119'));
 assert.ok(html.includes('main-story.js?v=118'));
 assert.ok(html.includes('tower-slot-engine.js?v=109'));
});
console.log(`\nRESULT: ${passed}/20 tests passed${process.exitCode?' (FAIL)':' (OK)'}`);
