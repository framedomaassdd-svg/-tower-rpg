'use strict';
// All assertions use the original shipping Skills, LifeSim and Expedition modules.
// No mock engine, monkey patch, or substituted loot/encounter functions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Skills = require('../skills.js');
const LifeSim = require('../life-sim.js');
const Expedition = require('../expedition.js');
const SlotEngine = require('../tower-slot-engine.js');
let passed = 0;
function check(name, fn) { try { fn(); passed++; console.log('PASS', name); }
  catch (e) { process.exitCode=1; console.error('FAIL', name, e.stack); } }
function hero() {
  const st = {day:1,money:100,health:100,energy:100,strength:3,agility:3,intelligence:3,events:[]};
  LifeSim.newLife(st,()=>.42); st.life.started=true;
  assert.equal(LifeSim.ensure(st),true); return st;
}
check('NPC skill contracts exist and new quest-only passive / active rewards are valid skill definitions',()=>{
  const qs=Object.values(Skills.SKILL_QUESTS);
  assert.equal(qs.length,8);
  assert.equal(qs.filter(q=>Skills.SKILLS[q.reward].type==='active').length,2);
  assert.equal(qs.filter(q=>Skills.SKILLS[q.reward].type==='passive').length,6);
  for(const q of qs) {assert.ok(q.npc && LifeSim.PLACES[q.place], q.name); assert.ok(q.objectives.every(x=>x.need>0));}
  assert.equal(Skills.SKILLS.sunfall.power.length,5);
  assert.equal(Skills.SKILLS.winterSeal.power.length,5);
});
check('new and migrated game saves both carry persistent skill-quest fields',()=>{
  const st=hero();assert.deepEqual(st.skillQuests,{});
  delete st.skillQuests; LifeSim.ensure(st);
  assert.deepEqual(st.skillQuests,{});
});
check('NPC meeting cannot grant skill before the quest is completed',()=>{
  const st=hero(); const before=Skills.power(st);
  assert.equal(Skills.questState(st,'porterTraining'),'available');
  const offer=Skills.meetQuestNPC(st,'porterTraining');assert.equal(offer.ok,true);
  assert.equal(Skills.questState(st,'porterTraining'),'active');
  assert.equal(Skills.meetQuestNPC(st,'porterTraining').ok,false);
  assert.ok(!st.skills.ironBack);assert.equal(Skills.power(st),before);
});
check('real city plan walks to the mentor as a scheduled after-work errand',()=>{
  const st=hero(); const on=LifeSim.setOrder(st,{kind:'skillquest',questId:'porterTraining',repeat:false},8);
  assert.equal(on,st.day);
  const segs=LifeSim.dayPlan(st);
  const visit=segs.find(s=>s.task==='mentor');
  assert.ok(visit, 'actual day plan must include visiting NPC');
  assert.equal(visit.place,'porter');
  const note=LifeSim.applyErrand(st,'errand');
  assert.match(note,/รับเควส/);
  assert.equal(Skills.questState(st,'porterTraining'),'active');
});
check('after-work quest meeting can be scheduled for the following day',()=>{
  const st=hero();const tomorrow=LifeSim.setOrder(st,{kind:'skillquest',questId:'compassEye',repeat:false},18);
  assert.equal(tomorrow,st.day+1);
  assert.equal(LifeSim.dayPlan(st).some(s=>s.task==='mentor'),false);
  st.day++;
  assert.equal(LifeSim.dayPlan(st).some(s=>s.task==='mentor'),true);
});
check('quest progress counts real milestone types; repeated event IDs do not double count',()=>{
  const st=hero();Skills.meetQuestNPC(st,'porterTraining');
  Skills.progress(st,'haul',undefined,'day1-haul');
  Skills.progress(st,'haul',undefined,'day1-haul');
  assert.equal(st.skillQuests.porterTraining.progress[0],1);
  for(let i=2;i<=4;i++) { st.day=i;Skills.progress(st,'haul',undefined,'day'+i+'-haul'); }
  assert.equal(st.skillQuests.porterTraining.progress[0],4);
  assert.equal(Skills.questState(st,'porterTraining'),'ready');
});
check('chapter 1 requires NPC visit but cannot grant the final skill early',()=>{
  const st=hero(); Skills.meetQuestNPC(st,'porterTraining');
  for(let i=0;i<4;i++) Skills.progress(st,'haul',undefined,'work-'+i);
  assert.ok(!st.skills.ironBack);
  const result=Skills.meetQuestNPC(st,'porterTraining'); assert.equal(result.stage,2);
  assert.equal(Skills.tierOf(st,'ironBack'),0);
  const loaded=JSON.parse(JSON.stringify(st));Skills.recalc(loaded);
  assert.equal(Skills.meetQuestNPC(loaded,'porterTraining').ok,false);
  assert.equal(Skills.tierOf(loaded,'ironBack'),0);
  assert.equal(Skills.questState(loaded,'porterTraining'),'active');
});
check('quest-exclusive passives are not learned automatically by ordinary work XP',()=>{
  const st=hero();
  Skills.train(st,'brawn',5);Skills.train(st,'keen',3);Skills.train(st,'nimble',2);
  for(const q of ['ironBack','trailEye','battleStep','herbalLore']) assert.ok(!st.skills[q],q);
});
check('rare active NPCs refuse contracts before twelve tower victories',()=>{
  const st=hero();
  for(const id of ['solarMaster','winterMaster']) {
    assert.equal(Skills.questState(st,id),'locked');
    assert.equal(Skills.meetQuestNPC(st,id).ok,false);
  }
  st.towerWins=12;assert.equal(Skills.questState(st,'solarMaster'),'available');
});
check('rare active mastery needs BOTH encounter achievements after quest acceptance',()=>{
  const st=hero();st.towerWins=12;Skills.meetQuestNPC(st,'solarMaster');
  const boss=Expedition.bossOf(st,4);
  assert.equal(!!boss,true);
  Skills.progress(st,'boss_win',4,'boss-4');
  Skills.progress(st,'boss_win',4,'boss-4');
  assert.equal(st.skillQuests.solarMaster.progress[0],1);
  assert.equal(Skills.questState(st,'solarMaster'),'active');
  const deepMonster=Expedition.monsterOf(st,16,'strong-encounter');
  assert.ok(deepMonster.power>=110);
  for(let i=0;i<4;i++) Skills.progress(st,'win',deepMonster.power,'hard-'+i);
  assert.equal(Skills.questState(st,'solarMaster'),'ready');
  const result=Skills.meetQuestNPC(st,'solarMaster');
  assert.equal(result.stage,2);
  assert.equal(Skills.tierOf(st,'sunfall'),0);
  assert.equal(Skills.SKILLS.sunfall.type,'active');
});
check('new active quest can be earned while an existing active remains selected',()=>{
  const st=hero(); Skills.train(st,'fire',1); Skills.selectActive(st,'fire');
  st.towerWins=12; Skills.meetQuestNPC(st,'winterMaster');
  Skills.progress(st,'elite_win',6,'elite-a'); Skills.progress(st,'elite_win',6,'elite-b');
  for(let i=0;i<3;i++) Skills.progress(st,'deep_map',7+i,'up'+i);
  assert.equal(Skills.questState(st,'winterMaster'),'ready');
  const next = Skills.meetQuestNPC(st,'winterMaster');
  assert.equal(next.stage,2);
  assert.equal(Skills.activeOf(st),'fire');
  assert.equal(Skills.selectActive(st,'winterSeal'),false);
  assert.equal(Skills.activeOf(st),'fire');
});
check('active effects require selected skill AND appropriate reel icon',()=>{
  const st=hero();Skills.train(st,'sunfall',1);Skills.train(st,'winterSeal',1);
  Skills.selectActive(st,'sunfall');
  assert.equal(Skills.activeEffect(st,['blank','sword','shield']),null);
  const burst=Skills.activeEffect(st,['skill','blank','sword']);
  assert.equal(burst.skill,'sunfall');assert.ok(burst.attackMult>=2);
  Skills.selectActive(st,'winterSeal');
  assert.equal(Skills.activeEffect(st,['fire','blank','shield']),null);
  const bind=Skills.activeEffect(st,['ice','blank','shield']);
  assert.ok(bind.enemyMult<.6 && bind.deadlyMult<=.3);
});
check('impactful active changes real combat odds, but no automatic victory',()=>{
  const st=hero();Skills.train(st,'sunfall',1);Skills.selectActive(st,'sunfall');
  const mon=Expedition.monsterOf(st,8,'combat-quest-test');
  const before=Skills.power(st);
  const withEffect=Skills.activeEffect(st,['skill','blank','blank']);
  const a=Skills.fight(st,mon,0,.999,.99,0,{activeEffect:withEffect,alone:false,r3:.999});
  const b=Skills.fight(st,mon,0,.999,.99,0,{alone:false,r3:.999});
  assert.ok(a.p>b.p);
  assert.equal(Skills.power(st),before);
  assert.equal(a.usedActive.skill,'sunfall');
  assert.equal(b.usedActive,undefined);
});
check('existing active abilities also gain prominent triggered combat effects',()=>{
  const st=hero();
  for(const [id,symbol] of [['sword','skill'],['fire','fire'],['ice','ice']]) {
    Skills.train(st,id,1);Skills.selectActive(st,id);
    const effect=Skills.activeEffect(st,[symbol,'blank','blank']);
    assert.equal(effect.skill,id);assert.ok(effect.attackMult>1);
  }
});
check('ordinary monster book drop rates stay intact while active book templates become rare',()=>{
  const st=hero(); let normalBooks=0, activeBooks=0;
  for(let i=0;i<100000;i++) {
    const result=Expedition.rollDrop(st,{rank:'Normal'},'rarity-'+i);
    if(result.special && result.special.kind==='book' && result.special.rarity==='normal') {
      normalBooks++;
      if(['book_fire','book_ice'].includes(result.special.templateId)) activeBooks++;
    }
  }
  assert.ok(normalBooks>=4500 && normalBooks<=5500, normalBooks);
  assert.ok(activeBooks>0 && activeBooks<normalBooks*.05, activeBooks);
  const info=Expedition.SAFE_KINDS.city;
  assert.ok(require('../bag.js').SAFE_SHOP.book_fire>=800);
  assert.ok(require('../bag.js').SAFE_SHOP.book_ice>=1000);
  assert.ok(info.shop.includes('book_fire') && info.shop.includes('book_ice'));
  assert.ok(!Skills.BOOK_SKILL.book_sunfall && !Skills.BOOK_SKILL.book_winterSeal);
});
check('frozen slot engine is unchanged; html deploys updated modules for Safari',()=>{
  assert.equal(Object.isFrozen(SlotEngine),true);
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  for(const id of ['bag','skills']) assert.ok(html.includes(id+'.js?v=119'));
  for(const id of ['expedition','life-sim','life-ui']) assert.ok(html.includes(id+'.js?v=119'));
  assert.ok(html.includes('tower-slot-engine.js?v=109'));
  assert.ok(html.includes('main-story.js?v=118'));
  const ui=fs.readFileSync(path.join(__dirname,'../life-ui.js'),'utf8');
  assert.ok(ui.includes('data-skillquest'));
  assert.ok(ui.includes('นัดพบผู้สอนหลังเลิกงาน'));
});
console.log(`\nRESULT: ${passed}/16 tests passed${process.exitCode?' (FAIL)':' (OK)'}`);
