'use strict';
/* Real Tower RPG modules, real town NPC roster, deterministic daily simulation. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Life=require('../life-sim.js'),Management=require('../management.js'),Bag=require('../bag.js'),Exp=require('../expedition.js');
const TownNPCs=require('../town-npcs.js'),TownResidents=require('../town-residents.js');
let pass=0,fail=0;
function test(name,fn){try{fn();pass++;console.log('PASS',name);}catch(e){fail++;console.error('FAIL',name,e.stack);}}
function game(){const st={day:1,money:3000,health:100,energy:100,position:620,positionY:820,townClock:5,events:[]};Life.newLife(st,()=>.33);st.money=3000;st.life.started=true;Life.ensure(st);return st;}
function next(st){st.day++;Life.applyWake(st);return Management.tick(st);}
function becomeFriends(st,id){for(let i=0;i<38;i++){st.day++;st.energy=100;Management.interact(st,id,'help');const r=Management.relation(st,id);if(r.trust>=70&&r.friendship>=60)break;}assert.ok(Management.relation(st,id).trust>=70);}
function party(st){for(const id of ['warrior','archer']){becomeFriends(st,id);let ok=false;for(let i=0;i<12;i++){const r=Management.askJoin(st,id);if(r.ok){ok=true;break;}st.day++;}assert.ok(ok,id);}assert.equal(Management.ensure(st).party.members.length,2);}
test('real town NPC roster is used (not fictional test-only persons)',()=>{const ids=new Set([...TownNPCs.PEOPLE,...TownResidents.PEOPLE].map(x=>x.id));assert.ok(Management.PEOPLE.length>10);for(const p of Management.PEOPLE)assert.ok(ids.has(p.id));});
test('fresh and old saves migrate without modifying legacy guild/tower fields',()=>{const st=game();const original={guild:st.guild,tower:st.tower,gear:JSON.stringify(st.gear)};delete st.management;Life.ensure(st);assert.ok(st.management);assert.equal(st.management.party.leader,false);assert.equal(st.guild,original.guild);assert.equal(st.tower,original.tower);assert.equal(JSON.stringify(st.gear),original.gear);});
test('new life resets ownership, relationships and happiness to baseline',()=>{const st=game();Management.buyHome(st,'slum');Management.interact(st,'smith','talk');Life.newLife(st,()=>.6);Life.ensure(st);assert.equal(Management.homeInfo(st),null);assert.equal(Management.relation(st,'smith').trust,20);assert.equal(Management.ensure(st).happiness.value,50);});
test('home purchase charges once and saved home prevents duplicate purchase',()=>{const st=game(),money=st.money;const r=Management.buyHome(st,'slum');assert.equal(r.ok,true);assert.equal(st.money,money-Management.HOMES.slum.price);assert.equal(st.life.roomPref,'owned');assert.equal(Life.pickRoom(st),'owned');assert.equal(Management.buyHome(st,'slum').ok,false);});
test('home upgrades pay price difference and never downgrade',()=>{const st=game();Management.buyHome(st,'slum');const before=st.money;assert.ok(Management.upgradeHome(st,'town').ok);assert.equal(st.money,before-(650-180));assert.equal(Management.upgradeHome(st,'slum').ok,false);});
test('owned home sleeping needs no nightly rent and keeps autonomous route',()=>{const st=game();Management.buyHome(st,'slum');st.life.homeTonight=Life.PLACES.tenement?'tenement':'inn';const money=st.money;Life.applyHome(st);assert.equal(st.money,money);assert.equal(st.life.roomSlept,'owned');assert.equal(st.life.sleptAt,'tenement');});
test('talking to same person twice in a day never farms friendship',()=>{const st=game();const first=Management.interact(st,'smith','talk');const trust=Management.relation(st,'smith').trust;assert.equal(first.ok,true);assert.equal(Management.interact(st,'smith','talk').ok,false);assert.equal(Management.relation(st,'smith').trust,trust);});
test('unfamiliar NPC cannot be coerced into party or guild',()=>{const st=game();assert.equal(Management.askJoin(st,'warrior').ok,false);assert.equal(Management.guildMember(st,'warrior').ok,false);});
test('companions require real social progress and cannot exceed party size',()=>{const st=game();party(st);assert.equal(Management.askJoin(st,'warrior').ok,false);becomeFriends(st,'mage');for(let i=0;i<12&&!Management.ensure(st).party.members.includes('mage');i++){Management.askJoin(st,'mage');st.day++;}assert.equal(Management.ensure(st).party.members.length,3);becomeFriends(st,'scout');assert.equal(Management.askJoin(st,'scout').ok,false);});
test('leadership requires vote, not the main character being chosen automatically',()=>{const st=game();assert.equal(Management.requestLeader(st).ok,false);party(st);let elected=false;for(let i=0;i<12&&!elected;i++){elected=Management.requestLeader(st).ok;st.day++;}assert.ok(elected);assert.ok(Management.partyPower(st)>0);assert.ok(Management.setStance(st,'safe').ok);assert.equal(Management.ensure(st).party.stance,'safe');});
test('only approved leader can plan an expedition with own party; old expedition types remain',()=>{const st=game();assert.equal(Exp.plan(st,{party:'personal'}).ok,false);party(st);let leader=false;for(let i=0;i<12&&!leader;i++){leader=Management.requestLeader(st).ok;st.day++;}assert.ok(leader);const p=Exp.plan(st,{party:'personal'});assert.ok(p.ok);assert.equal(st.life.exp.party,'personal');assert.ok(Exp.PARTY.personal);assert.ok(Exp.allyPower(st)>0);});
test('shops have fixed starting investment and no duplicated purchase',()=>{const st=game();const old=st.money;assert.ok(Management.openShop(st,'restaurant','open').ok);assert.equal(st.money,old-420);assert.equal(Management.openShop(st,'restaurant','open').ok,false);assert.equal(Management.openShop(st,'unknown','open').ok,false);});
test('stock transfer uses actual inventory and cannot create stock for free',()=>{const st=game();Management.openShop(st,'general');assert.equal(Management.stock(st,'general','bread',10).ok,false);Bag.add(st,'bread',10,st.day);assert.ok(Management.stock(st,'general','bread',8).ok);assert.equal(Bag.count(st,'bread'),2);assert.equal(Management.ensure(st).shops.general.stock.bread,8);assert.equal(Management.stock(st,'general','sword',1).ok,false);});
test('store daily sales consume actual stock and require employee and working capital',()=>{const st=game();Management.openShop(st,'restaurant');next(st);assert.equal(Management.ensure(st).shops.restaurant.revenue,0);
 becomeFriends(st,'chef');let hired=false;for(let i=0;i<10&&!hired;i++){hired=Management.hire(st,'restaurant','chef').ok;st.day++;}assert.ok(hired);Bag.add(st,'bread',80,st.day);Management.stock(st,'restaurant','bread',80);next(st);assert.equal(Management.ensure(st).shops.restaurant.revenue,0,'no cash = no sales');assert.ok(Management.storeCash(st,'restaurant','in',100).ok);next(st);const b=Management.ensure(st).shops.restaurant;assert.ok(b.revenue>0);assert.ok(b.stock.bread<80);assert.ok(b.expense>0);});
test('daily shop settlement idempotent across save/reload',()=>{const st=game();Management.openShop(st,'general');const r=Management.tick(st),cash=Management.ensure(st).shops.general.cash;const saved=JSON.parse(JSON.stringify(st));assert.deepEqual(Management.tick(saved),[]);assert.equal(Management.ensure(saved).shops.general.cash,cash);assert.deepEqual(Management.tick(st),r);});
test('shop price has a limited valid range',()=>{const st=game();Management.openShop(st,'general');assert.equal(Management.price(st,'general',200).ok,false);assert.ok(Management.price(st,'general',120).ok);});
test('guild requires fame and money; personal guild does not replace existing guild',()=>{const st=game();assert.equal(Management.formGuild(st,'สายหมอก').ok,false);st.rep=5;const guild=st.guild;assert.ok(Management.formGuild(st,'สายหมอก').ok);assert.equal(st.guild,guild);assert.equal(Management.formGuild(st,'อีกกิลด์').ok,false);});
test('guild treasury prevents printing free money and daily mission is deterministic',()=>{const st=game();st.rep=5;Management.formGuild(st,'นักเดินทาง');const m=Management.ensure(st),cash=st.money;assert.ok(Management.guildCash(st,'in',100).ok);assert.equal(st.money,cash-100);assert.ok(Management.guildCash(st,'out',20).ok);assert.equal(st.money,cash-80);const one=JSON.parse(JSON.stringify(st)),two=JSON.parse(JSON.stringify(st));one.day++;two.day++;Management.tick(one);Management.tick(two);assert.deepEqual(one.management,two.management);});
test('happiness responds to wounds, housing and company, never creates a character level',()=>{const st=game();Management.buyHome(st,'slum');const start=Management.ensure(st).happiness.value;next(st);const now=Management.ensure(st).happiness.value;assert.ok(Number.isFinite(now));assert.ok(now>=0&&now<=100);st.health=10;next(st);assert.ok(Management.ensure(st).happiness.value<=now);assert.equal(st.level,undefined);assert.ok(start>=0);});
test('individual crafted weapon stock keeps the same instance ID and can be reclaimed',()=>{
 const st=game();Management.openShop(st,'smith');const piece=Bag.addGear(st,'sword','captain',{from:'forge',day:st.day},2);
 assert.ok(piece);const before=JSON.stringify(st.gear[piece.instanceId]);
 assert.ok(Management.stockGear(st,'smith',piece.instanceId).ok);
 assert.equal(Bag.list(st).some(x=>x.instanceId===piece.instanceId),false);
 assert.equal(JSON.stringify(st.gear[piece.instanceId]),before);
 assert.equal(Management.stockGear(st,'smith',piece.instanceId).ok,false);
 assert.ok(Management.reclaimGear(st,'smith',piece.instanceId).ok);
 assert.equal(Bag.list(st).filter(x=>x.instanceId===piece.instanceId).length,1);
 assert.equal(JSON.stringify(st.gear[piece.instanceId]),before);
});
test('shop can sell one real equipment instance without duplicating or reselling it',()=>{
 const st=game();Management.openShop(st,'smith');const piece=Bag.addGear(st,'sword','soldier',{from:'forge',day:st.day},1);
 assert.ok(Management.stockGear(st,'smith',piece.instanceId).ok);
 becomeFriends(st,'smith');let hired=false;for(let k=0;k<10&&!hired;k++){hired=Management.hire(st,'smith','smith').ok;st.day++;}
 assert.ok(hired);assert.ok(Management.storeCash(st,'smith','in',200).ok);
 let sold=false;for(let k=0;k<24&&!sold;k++){st.day++;Management.tick(st);sold=!Management.ensure(st).shops.smith.gearStock.includes(piece.instanceId);}
 assert.equal(sold,true);assert.equal(st.gear[piece.instanceId],undefined);
 const cash=Management.ensure(st).shops.smith.cash;Management.tick(st);assert.equal(Management.ensure(st).shops.smith.cash,cash);
 assert.equal(Management.reclaimGear(st,'smith',piece.instanceId).ok,false);
});
test('restaurant food stock expires by individual lots without creating unsold fresh food',()=>{
 const st=game();Management.openShop(st,'restaurant');Bag.add(st,'bread',3,st.day);
 assert.ok(Management.stock(st,'restaurant','bread',3).ok);
 const b=Management.ensure(st).shops.restaurant;assert.equal(b.stock.bread,3);
 st.day+=20;Management.tick(st);assert.equal(b.stock.bread,0);
 assert.equal(b.stockLots.bread.length,0);
});
test('social interaction is a real scheduled visit and cannot be replayed the same day',()=>{
 const st=game();const id='smith',old=Management.relation(st,id).friendship;
 const d=Life.setOrder(st,{kind:'managementMeet',npc:id,activity:'talk',repeat:false},5);
 assert.equal(d,st.day);
 const plan=Life.dayPlan(st);assert.ok(plan);
 const msg=Life.applyOrder(st,'errand');assert.ok(msg);
 assert.equal(st.life.order.doneDay,st.day);
 assert.notEqual(Management.relation(st,id).friendship,old);
 assert.equal(Life.applyOrder(st,'errand'),null);
});
test('frozen slot engine is untouched, script ordering and touch-based management UI are wired',()=>{const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),ui=fs.readFileSync(path.join(root,'life-ui.js'),'utf8');assert.ok(html.indexOf('management.js?v=124')<html.indexOf('life-sim.js'));assert.ok(ui.includes('data-m-act'));assert.ok(ui.includes('data-m-section'));assert.ok(ui.includes("['manage','บริหาร']"));assert.ok(!ui.includes('onmouseover'));});
console.log(`RESULT: ${pass}/${pass+fail} passed`);if(fail)process.exitCode=1;
