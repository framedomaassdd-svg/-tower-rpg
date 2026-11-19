'use strict';
// Regression tests call the shipping Skills, LifeSim and Expedition modules directly.
// They do not replace modules, monkey-patch functions or write fabricated quest progress.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Skills = require('../skills.js');
const LifeSim = require('../life-sim.js');
const Expedition = require('../expedition.js');
const SlotEngine = require('../tower-slot-engine.js');
let passed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('PASS', name); }
  catch (e) { console.error('FAIL',name,e.stack);process.exitCode=1; }
}
function hero() {
  const st = {day:1,money:500,energy:100,health:100,strength:3,agility:3,intelligence:3,events:[]};
  LifeSim.newLife(st,()=>0.42);st.life.started=true;
  assert.equal(LifeSim.ensure(st),true);
  return st;
}
let serial=0;
function finishStage(st,id) {
  const Q=Skills.SKILL_QUESTS[id], rec=st.skillQuests[id];
  const stage=rec.stage, chapter=Skills.questChapter(Q,stage);
  assert.equal(Skills.questState(st,id),'active');
  for(const [j,o] of chapter.objectives.entries()) for(let k=0;k<o.need;k++) {
    const eventId='mentorship-'+id+'-stage'+stage+'-objective'+j+'-event'+k+'-'+(++serial);
    const value=o.on==='deep_map' ? Math.max(o.min||1,6)+k : o.on==='elite_win' ? 6+k*5 : o.on==='boss_win' ? 4+k*5 : o.min;
    Skills.progress(st,o.on,value,eventId);
  }
  assert.equal(Skills.questState(st,id),'ready',id+' stage '+stage);
  return Skills.meetQuestNPC(st,id);
}
function completeChain(st,id) {
  const Q=Skills.SKILL_QUESTS[id];
  if(Q.minWins) st.towerWins=Math.max(st.towerWins||0,Q.minWins);
  const accepted=Skills.meetQuestNPC(st,id);
  assert.equal(accepted.ok,true);
  let result;
  for(let i=0;i<Skills.questChapterCount(Q);i++) result=finishStage(st,id);
  assert.equal(result.reward,Q.reward);
  assert.equal(Skills.questState(st,id),'claimed');
  return result;
}
check('all eight genuine NPC quests now have 3–4 sequential chapters with higher-tier rewards',()=>{
  assert.equal(Object.keys(Skills.SKILL_QUESTS).length,8);
  for(const [id,Q] of Object.entries(Skills.SKILL_QUESTS)) {
    assert.ok(LifeSim.PLACES[Q.place],id);
    assert.ok(Skills.SKILLS[Q.reward],id);
    assert.equal(Skills.questChapterCount(Q),Skills.SKILLS[Q.reward].type==='active'?4:3);
    assert.ok(Q.rewardTier>=2 && Q.rewardTier<=3);
    for(let n=0;n<Skills.questChapterCount(Q);n++) {
      const chapter=Skills.questChapter(Q,n);
      assert.ok(chapter.name && chapter.objectives.length>0,id+' chapter '+n);
      for(const o of chapter.objectives) assert.ok(o.on && o.need>0);
    }
  }
});
check('regular NPC passives start at tier 2; rare activated passives and actives start at tier 3',()=>{
  for(const id of ['porterTraining','compassEye','ironFootwork','apothecarySense']) assert.equal(Skills.SKILL_QUESTS[id].rewardTier,2);
  for(const id of ['fireBodyTrial','lastStandTrial','solarMaster','winterMaster']) assert.equal(Skills.SKILL_QUESTS[id].rewardTier,3);
});
check('simple porter chapter grants no skill; mentor must assign chapter two and chapter three first',()=>{
  const st=hero();
  assert.equal(Skills.meetQuestNPC(st,'porterTraining').stage,1);
  assert.equal(finishStage(st,'porterTraining').stage,2);
  assert.equal(Skills.tierOf(st,'ironBack'),0);
  assert.equal(finishStage(st,'porterTraining').stage,3);
  assert.equal(Skills.tierOf(st,'ironBack'),0);
  const result=finishStage(st,'porterTraining');
  assert.equal(result.reward,'ironBack');
  assert.equal(result.tier,2);
  assert.ok(Skills.bonus(st).strength>=7);
});
check('only NPC hand-ins advance quest chapters, even after all objectives are complete',()=>{
  const st=hero();Skills.meetQuestNPC(st,'compassEye');
  const Q=Skills.SKILL_QUESTS.compassEye;
  for(let i=0;i<4;i++) Skills.progress(st,'study',undefined,'study-'+i);
  assert.equal(Skills.questState(st,'compassEye'),'ready');
  for(let i=0;i<15;i++) Skills.progress(st,'study',undefined,'unclaimed-'+i);
  assert.equal(st.skillQuests.compassEye.stage,0);
  assert.equal(st.skillQuests.compassEye.progress.length,Q.objectives.length);
  assert.equal(Skills.tierOf(st,'trailEye'),0);
});
check('replaying event IDs across chapters cannot count toward a later chapter',()=>{
  const st=hero();Skills.meetQuestNPC(st,'porterTraining');
  for(let i=0;i<4;i++) Skills.progress(st,'haul',undefined,'old-haul-'+i);
  assert.equal(Skills.meetQuestNPC(st,'porterTraining').stage,2);
  Skills.progress(st,'haul',undefined,'old-haul-0');
  assert.equal(st.skillQuests.porterTraining.progress[0],0);
  Skills.progress(st,'haul',undefined,'fresh-haul');
  assert.equal(st.skillQuests.porterTraining.progress[0],1);
});
check('each mentor meeting is still routed through actual after-work schedule and city location',()=>{
  const st=hero();
  const when=LifeSim.setOrder(st,{kind:'skillquest',questId:'porterTraining',repeat:false},8);
  assert.equal(when,st.day);
  assert.equal(LifeSim.dayPlan(st).find(e=>e.task==='mentor').place,'porter');
  assert.match(LifeSim.applyErrand(st,'errand'),/รับเควสต่อเนื่อง/);
  assert.equal(Skills.questState(st,'porterTraining'),'active');
});
check('all four basic passive mentorship chains can be completed by real milestone API calls',()=>{
  for(const id of ['porterTraining','compassEye','ironFootwork','apothecarySense']) {
    const st=hero();const r=completeChain(st,id);
    assert.equal(Skills.tierOf(st,Skills.SKILL_QUESTS[id].reward),2);
    assert.equal(r.tier,2);
  }
});
check('fireBody and lastStand advanced mentorships unlock their trigger straight away',()=>{
  for(const id of ['fireBodyTrial','lastStandTrial']) {
    const st=hero();const result=completeChain(st,id);
    assert.equal(result.tier,3);
    assert.equal(Skills.tierOf(st,result.reward),3);
  }
  const st=hero(); completeChain(st,'fireBodyTrial');
  assert.ok(Skills.triggeredPassives(st,{startHealth:100,health:40,lost:60,alone:false,deadly:false})
    .some(([id])=>id==='fireBody'));
});
check('rare solar quest requires four stages with multiple real boss/elite milestone types',()=>{
  const Q=Skills.SKILL_QUESTS.solarMaster;
  assert.ok(Q.stages.some(stage=>stage.objectives.some(o=>o.on==='elite_win')));
  assert.ok(Q.stages.filter(stage=>stage.objectives.some(o=>o.on==='boss_win')).length>=2);
  const st=hero();st.towerWins=12;
  assert.equal(Skills.meetQuestNPC(st,'solarMaster').stage,1);
  for(let i=0;i<3;i++) {
    assert.equal(finishStage(st,'solarMaster').stage,i+2);
    assert.equal(Skills.tierOf(st,'sunfall'),0);
  }
  assert.equal(finishStage(st,'solarMaster').tier,3);
});
check('rare ice quest preserves selected active and gives tier-3 freeze impact on activation',()=>{
  const st=hero(); Skills.train(st,'fire',1);Skills.selectActive(st,'fire');
  const r=completeChain(st,'winterMaster');
  assert.equal(r.tier,3);assert.equal(Skills.activeOf(st),'fire');
  assert.equal(Skills.selectActive(st,'winterSeal'),true);
  const effect=Skills.activeEffect(st,['ice','blank','blank']);
  assert.equal(effect.skill,'winterSeal');
  assert.ok(effect.enemyMult<.5);
});
check('rare solar skill at tier 3 is meaningfully stronger but not guaranteed victory',()=>{
  const st=hero();completeChain(st,'solarMaster');Skills.selectActive(st,'sunfall');
  const impact=Skills.activeEffect(st,['skill','blank','blank']);
  assert.equal(impact.attackMult,3);
  const mon=Expedition.monsterOf(st,16,'mentor-chain-combat');
  const before=Skills.fight(st,mon,0,.999,.999,0,{r3:.999});
  st.health=100;
  const after=Skills.fight(st,mon,0,.999,.999,0,{activeEffect:impact,r3:.999});
  assert.ok(after.p>before.p);
  assert.equal(after.win,false);
});
check('a final mentor reward can be claimed only once even after save/load',()=>{
  const st=hero();completeChain(st,'porterTraining');
  const old=JSON.stringify(st);
  assert.equal(Skills.meetQuestNPC(st,'porterTraining').ok,false);
  assert.equal(JSON.stringify(st),old);
  const loaded=JSON.parse(old);Skills.recalc(loaded);
  assert.equal(Skills.questState(loaded,'porterTraining'),'claimed');
  assert.equal(Skills.meetQuestNPC(loaded,'porterTraining').ok,false);
  assert.equal(Skills.tierOf(loaded,'ironBack'),2);
});
check('a save during chapter two resumes exact stage and progress without reset',()=>{
  const st=hero();Skills.meetQuestNPC(st,'porterTraining');finishStage(st,'porterTraining');
  Skills.progress(st,'haul',undefined,'chapter2-progress');
  const loaded=JSON.parse(JSON.stringify(st));
  assert.equal(Skills.questState(loaded,'porterTraining'),'active');
  assert.equal(loaded.skillQuests.porterTraining.stage,1);
  assert.equal(loaded.skillQuests.porterTraining.progress[0],1);
  Skills.progress(loaded,'haul',undefined,'chapter2-progress');
  assert.equal(loaded.skillQuests.porterTraining.progress[0],1);
});
check('v115 partially completed saved quest preserves its original chapter and event dedup',()=>{
  const st=hero();
  st.skillQuests.porterTraining={accepted:true,claimed:false,progress:[2],seen:{'0:one':true,'0:two':true}};
  assert.equal(Skills.questState(st,'porterTraining'),'active');
  assert.equal(st.skillQuests.porterTraining.stage,0);
  Skills.progress(st,'haul',undefined,'one');
  assert.equal(st.skillQuests.porterTraining.progress[0],2);
  Skills.progress(st,'haul',undefined,'three');
  assert.equal(st.skillQuests.porterTraining.progress[0],3);
});
check('v115 already-claimed tier-1 quest keeps skill and continues at chapter 2',()=>{
  const st=hero();Skills.train(st,'ironBack',1);
  st.skillQuests.porterTraining={accepted:true,claimed:true,progress:[4],seen:{'0:old-haul':true}};
  assert.equal(Skills.questState(st,'porterTraining'),'active');
  assert.equal(st.skillQuests.porterTraining.stage,1);
  assert.equal(Skills.tierOf(st,'ironBack'),1);
  Skills.progress(st,'haul',undefined,'old-haul');
  assert.equal(st.skillQuests.porterTraining.progress[0],0);
  const r1=finishStage(st,'porterTraining');assert.equal(r1.stage,3);
  const r2=finishStage(st,'porterTraining');assert.equal(r2.tier,2);
  assert.equal(Skills.tierOf(st,'ironBack'),2);
});
check('v115 already-claimed rare active stays selected and can continue chapters 2–4',()=>{
  const st=hero();Skills.train(st,'sunfall',1);Skills.selectActive(st,'sunfall');
  st.skillQuests.solarMaster={accepted:true,claimed:true,progress:[1,4],seen:{}};
  assert.equal(Skills.questState(st,'solarMaster'),'active');
  assert.equal(st.skillQuests.solarMaster.stage,1);
  for(let i=1;i<4;i++) finishStage(st,'solarMaster');
  assert.equal(Skills.tierOf(st,'sunfall'),3);
  assert.equal(Skills.activeOf(st),'sunfall');
});
check('NPC teaching does not regress a tier-4 skill earned through promotion trials',()=>{
  const st=hero();Skills.meetQuestNPC(st,'porterTraining');
  st.skills.ironBack={tier:4,xp:10};
  for(let i=0;i<3;i++) finishStage(st,'porterTraining');
  assert.equal(Skills.tierOf(st,'ironBack'),4);
  assert.equal(st.skills.ironBack.xp,10);
});
check('new module cache keys load in order while the slot engine remains frozen and unchanged',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  for(const name of ['skills','bag']) assert.ok(html.includes(name+'.js?v=119'),name);
  for(const name of ['expedition','life-sim','life-ui']) assert.ok(html.includes(name+'.js?v=119'),name);
  assert.ok(html.includes('tower-slot-engine.js?v=109'));
  assert.ok(html.includes('main-story.js?v=118'));
  assert.equal(Object.isFrozen(SlotEngine),true);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../tower-slot-engine.js'))).digest('hex'),
    'ab89494b158de760544e1ba4ddc5dd1d78ad68ac68590b69fdff35ce0c622319');
  const ui=fs.readFileSync(path.join(__dirname,'../life-ui.js'),'utf8');
  assert.ok(ui.includes('เควสต่อเนื่อง'));
  assert.ok(ui.includes('tier ${Q.rewardTier}'));
});
console.log(`\nRESULT: ${passed}/18 tests passed${process.exitCode?' (FAIL)':' (OK)'}`);
