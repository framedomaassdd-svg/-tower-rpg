'use strict';
const assert = require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const Bag=require('../bag.js'), Skills=require('../skills.js'), LifeSim=require('../life-sim.js'), Exp=require('../expedition.js');
let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name,e.stack);process.exitCode=1;}}
function game(seed=0){
 const st={day:1,money:10000,energy:100,health:100,position:620,positionY:820};
 LifeSim.newLife(st,()=>seed);st.life.started=true;LifeSim.ensure(st);return st;
}
check('same resource unlimited per slot while retaining quantity',()=>{
 const st=game();assert.equal(Bag.add(st,'herb',1000,1),1000);
 assert.equal(Bag.count(st,'herb'),1000);assert.equal(Bag.slotRows(st).find(x=>x.id==='herb').n,1000);
 assert.equal(Bag.slotCount(st),2); // starter ration and herbs
 assert.ok(Bag.loadStatus(st).immobile);assert.ok(st.agility<st.unburdenedAgility);
});
check('different expiry batches use one slot and spoil separately',()=>{
 const st=game();Bag.add(st,'herb',30,1);Bag.add(st,'herb',50,3);
 assert.equal(Bag.slotRows(st).filter(x=>x.id==='herb').length,1);
 assert.equal(Bag.count(st,'herb'),80);
 assert.equal(Bag.spoil(st,7).find(x=>x[0]==='herb')[1],30);
 assert.equal(Bag.count(st,'herb'),50);
});
check('20 slot limit counts types not total items, and adding same type still works',()=>{
 const st=game();const ids=Object.keys(Bag.ITEMS).filter(k=>!Bag.ITEMS[k].equip&&Bag.ITEMS[k].kind!=='vehicle'&&k!=='ration');
 for(const id of ids.slice(0,19))assert.ok(Bag.add(st,id,1));
 assert.equal(Bag.slotCount(st),20);const different=ids[19];assert.equal(Bag.add(st,different,1),0);
 assert.equal(Bag.add(st,ids[0],100),100);assert.ok(Bag.total(st)>20);
});
check('books of differing rarity occupy distinct slots and do not get merged',()=>{
 const st=game();assert.ok(Bag.addBook(st,'book_sense','normal','drop'));assert.ok(Bag.addBook(st,'book_sense','soldier','drop'));
 assert.ok(Bag.addBook(st,'book_sense','normal','drop'));
 assert.deepEqual(Bag.slotRows(st).filter(x=>x.id==='book_sense').map(x=>x.n),[2,1]);
});
check('individual gear occupies one slot, equipping and unequipping preserves ids and counts',()=>{
 const st=game();const a=Bag.addGear(st,'sword','normal','shop'),b=Bag.addGear(st,'sword','captain','drop');
 assert.equal(Bag.slotCount(st),3);assert.equal(Bag.equipGear(st,a.instanceId),true);
 assert.equal(Bag.slotCount(st),2);assert.equal(st.equip.weapon,a.instanceId);
 assert.equal(Bag.unequipGear(st,'weapon'),true);assert.equal(Bag.slotCount(st),3);
 assert.equal(Skills.gear(st,a.instanceId).instanceId,a.instanceId);assert.equal(Skills.gear(st,b.instanceId).instanceId,b.instanceId);
});
check('stronger character supports more weight; no pickup weight cap exists',()=>{
 const weak=game(),strong=game();weak.base.strength=15;strong.base.strength=90;Skills.recalc(weak);Skills.recalc(strong);
 Bag.add(weak,'iron',35);Bag.add(strong,'iron',35);
 assert.equal(Bag.count(weak,'iron'),35);assert.equal(Bag.count(strong,'iron'),35);
 assert.ok(Bag.loadStatus(weak).speed<Bag.loadStatus(strong).speed);
});
check('agility penalty is reversible and does not accumulate across stat recalculation',()=>{
 const st=game();const before=st.agility;Bag.add(st,'ore',50);
 assert.equal(st.agility,Math.max(1,Math.round(before*.1)));
 Skills.recalc(st);Skills.recalc(st);assert.equal(st.agility,Math.max(1,Math.round(before*.1)));
 Bag.take(st,'ore',50);assert.equal(st.agility,before);
});
check('immobile character stays put and scheduled errands do not fire',()=>{
 const st=game();st.life.weightAnchor={x:2222,y:820,zone:'town',day:st.day,hidden:false};Bag.add(st,'ore',150);
 const sample=LifeSim.sample(st,12);assert.equal(sample.moving,false);assert.equal(sample.x,2222);
 assert.deepEqual(LifeSim.due(st,12),[]);
});
check('dropping sufficient weight restores motion and automatic events are not backfilled',()=>{
 const st=game();Bag.add(st,'ore',150);LifeSim.sample(st,12);
 Bag.take(st,'ore',150);const sample=LifeSim.sample(st,12);
 assert.ok(sample.moving!==undefined);
 assert.equal(Bag.loadStatus(st).immobile,false);
 assert.equal(st.life.weightSkipDay,st.day);assert.ok(st.life.weightSkipClock>=12);
});
check('inventory automatic toggle persists across save and manual loot claims once',()=>{
 const st=game();Bag.setAuto(st,false);const entry=Bag.queueLoot(st,'herb',1000,null,{from:'event'},'evt1');
 const saved=JSON.parse(JSON.stringify(st));assert.equal(Bag.auto(saved),false);
 const got=Bag.claimLoot(saved,entry.uid);assert.equal(got.n,1000);assert.equal(Bag.count(saved,'herb'),1000);
 assert.equal(Bag.claimLoot(saved,entry.uid).ok,false);assert.equal(Bag.pending(saved).length,0);
});
check('manual rare weapon loot keeps rarity and origin without precreating instance',()=>{
 const st=game();Exp.plan(st,{});st.day=st.life.exp.start;st.life.exp.floor=4;const before=Object.keys(st.gear).length;
 const item=Bag.queueLoot(st,'sword',1,'legendary',{from:'drop',floor:4,monster:'boss',day:st.day},'event-4');
 assert.equal(Object.keys(st.gear).length,before);
 const res=Bag.claimLoot(st,item.uid);assert.ok(res.ok);
 const row=Bag.slotRows(st).find(s=>s.id==='sword'),inst=Skills.gear(st,row.instanceId);
 assert.equal(inst.rarity,'legendary');assert.equal(inst.origin.floor,4);
});
check('manual bag supports drop all, partial discard and independent reorder',()=>{
 const st=game();Bag.add(st,'herb',200);Bag.add(st,'iron',30);
 const old=Bag.slotRows(st).map(x=>x.key),key=old[2];assert.equal(Bag.moveSlot(st,key,-1),true);
 assert.equal(Bag.slotRows(st)[1].key,key);
 assert.equal(Bag.discardSlot(st,'item:herb',50),50);assert.equal(Bag.count(st,'herb'),150);
 assert.equal(Bag.discardSlot(st,'item:herb','all'),150);assert.equal(Bag.count(st,'herb'),0);
});
check('withdraw from chest respects 20 slots but unlimited count of existing type',()=>{
 const st=game();Bag.add(st,'herb',400);assert.equal(Bag.depositItem(st,'herb',400),400);
 const ids=Object.keys(Bag.ITEMS).filter(k=>k!=='ration'&&k!=='herb'&&!Bag.ITEMS[k].equip&&Bag.ITEMS[k].kind!=='vehicle');
 for(const id of ids.slice(0,19))Bag.add(st,id,1);
 assert.equal(Bag.slotCount(st),20);assert.equal(Bag.withdrawItem(st,'herb',100),0);
 Bag.discardSlot(st,Bag.slotRows(st)[1].key,'all');assert.equal(Bag.withdrawItem(st,'herb',400),400);
 assert.equal(Bag.count(st,'herb'),400);assert.equal(Bag.slotCount(st),20);
});
check('real safe-floor forage queues manual pickup and cannot be duplicated',()=>{
 const st=game();Exp.plan(st,{party:null});st.day=st.life.exp.start;st.life.exp.floor=5;
 Exp.floorWorld(st,5);assert.ok(Exp.safeInfo(st));Bag.setAuto(st,false);
 const a=Exp.safeAction(st,'forage');assert.ok(a.ok,a.why);assert.ok(Bag.pending(st).length>=1);
 const b=Exp.safeAction(st,'forage');assert.equal(b.ok,false);
 const fruit=Bag.pending(st).find(p=>p.id==='fruit');assert.ok(fruit);const n=fruit.n;
 assert.ok(Bag.claimLoot(st,fruit.uid).ok);assert.equal(Bag.count(st,'fruit'),n);
});
check('immobility blocks real safe-floor ascent and exit until weight is reduced',()=>{
 const st=game();Exp.plan(st,{});st.day=st.life.exp.start;st.life.exp.floor=5;Exp.floorWorld(st,5);Exp.safeInfo(st);
 Bag.add(st,'ore',150);assert.equal(Exp.safeTravel(st,'up',11).ok,false);assert.equal(st.life.exp.floor,5);
 Bag.take(st,'ore',150);assert.equal(Exp.safeTravel(st,'up',11).ok,true);assert.equal(st.life.exp.floor,6);
});
check('unclaimed manual drops stay on their floor and vanish after ascending',()=>{
 const st=game();Exp.plan(st,{});st.day=st.life.exp.start;st.life.exp.floor=5;Exp.floorWorld(st,5);Exp.safeInfo(st);
 Bag.setAuto(st,false);const pending=Bag.queueLoot(st,'herb',33,null,{from:'event',floor:5,day:st.day},'e5');
 const up=Exp.safeTravel(st,'up',11);assert.ok(up.ok);assert.equal(st.life.exp.floor,6);
 assert.equal(Bag.pending(st).length,0);assert.equal(Bag.claimLoot(st,pending.uid).ok,false);
});
check('original slot engine remains untouched and v119 scripts load in the original order',()=>{
 const crypto=require('node:crypto');
 const now=fs.readFileSync(path.join(__dirname,'../tower-slot-engine.js'));
 assert.equal(crypto.createHash('sha256').update(now).digest('hex'),'ab89494b158de760544e1ba4ddc5dd1d78ad68ac68590b69fdff35ce0c622319');
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 for(const name of ['bag','skills','life-sim','life-ui','expedition'])assert.ok(html.includes(name+'.js?v=119'),name);
});
console.log('\nRESULT: '+passed+'/17 tests passed'+(process.exitCode?' (FAIL)':' (OK)'));
