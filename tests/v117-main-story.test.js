'use strict';
// v118 compatibility expectations: the old v117 automatic floor dialogues were
// deliberately removed at the designer's request. Uses actual game modules.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const M=require('../main-story.js'),E=require('../expedition.js'),L=require('../life-sim.js');
let passed=0;function check(name,fn){try{fn();++passed;console.log('PASS',name);}catch(e){console.error('FAIL',name,e.stack);process.exitCode=1;}}
function hero(){const st={day:1,health:100,energy:100,money:300,food:1,events:[]};L.newLife(st,()=>.42);st.life.started=true;L.ensure(st);return st;}
function tower(){const st=hero();assert.equal(E.plan(st,{}).ok,true);st.day=2;E.enter(st);return st;}
check('world still targets exactly 100 floors; first ten hidden lines are available through floor 50',()=>{
 assert.equal(M.TOTAL_FLOORS,100);assert.equal(M.CONTENT_THROUGH,50);
 assert.equal(Object.keys(M.QUESTS).length,10);
});
check('ordinary floor entry never creates an automatic main-story popup',()=>{
 const st=tower();M.enter(st,50);assert.equal(M.pending(st),null);
 assert.equal(M.known(st).length,0);assert.equal(Object.keys(M.ensure(st).quests).length,0);
});
check('reaching safe zones and defeating guardians cannot claim undiscovered quests',()=>{
 const st=tower();for(let i=4;i<50;i+=5){E.floorWorld(st,i);M.bossWin(st,i);}
 assert.equal(M.known(st).length,0);assert.equal(Object.keys(M.ensure(st).quests).length,0);
});
check('real boss gate is independent of hidden quests',()=>{
 const st=tower(),x=E.X(st);x.floor=4;x.highest=4;
 assert.equal(E.bossOf(st,4).alive,true);x.stones[4]={up:true};
 const r=E.safeTravel(st,'up',10);assert.equal(r.ok,false);
 assert.equal(E.isSafeFloor(5),true);
});
check('migrate v117 automatic dialogue choices into archival data, not quest rewards',()=>{
 const st=hero();st.mainStory={v:1,reached:{1:{day:2}},choices:{1:{attitude:'knowledge',day:2}},pending:[2],knowledge:1};
 const s=M.ensure(st);assert.equal(s.v,2);assert.equal(s.legacyChronicle.knowledge,1);
 assert.equal(M.pending(st),null);assert.equal(Object.keys(s.quests).length,0);
});
check('old v116 games with no mainStory can load and discover new hidden quests',()=>{
 const st=hero();delete st.mainStory;L.ensure(st);
 assert.equal(M.ensure(st).v,2);assert.equal(M.known(st).length,0);
});
check('old new-life flow clears the new story state',()=>{
 const st=tower();M.ensure(st).rumors.survivor={town:true,tower:true};L.newLife(st,()=>.42);
 assert.equal(st.mainStory,null);assert.equal(M.ensure(st).rumors.survivor,undefined);
});
check('browser loads real story module before expedition and life-sim with versioned cache key',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.ok(html.includes('main-story.js?v=118'));
 assert.ok(html.indexOf('main-story.js')<html.indexOf('expedition.js'));
 assert.ok(html.indexOf('expedition.js')<html.indexOf('life-sim.js'));
});
console.log(`\nRESULT: ${passed}/8 tests passed${process.exitCode?' (FAIL)':' (OK)'}`);
