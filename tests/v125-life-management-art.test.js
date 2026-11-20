'use strict';
/* Production assets and real game modules only (no fake NPC or mocked inventory). */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Life=require('../life-sim.js'),Management=require('../management.js'),NPCs=require('../town-npcs.js');
const ROOT=path.join(__dirname,'..'),AR=path.join(ROOT,'life-art');
let good=0,bad=0;
function test(name,run){try{run();good++;console.log('PASS',name);}catch(e){bad++;console.error('FAIL',name,e.stack);}}
const ids=['property_agent','carpenter','guild_registrar','guild_treasurer','wholesaler','rookie','veteran','neighbor'];
function game(){let st={day:1,money:3000,health:100,energy:100,position:620,positionY:820,townClock:5,events:[]};Life.newLife(st,()=>.33);st.money=3000;st.life.started=true;Life.ensure(st);return st;}
function img(name){const b=fs.readFileSync(path.join(AR,name+'.webp'));assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');return b;}
test('46 real WebP assets delivered and individually loadable',()=>{const all=fs.readdirSync(AR).filter(x=>x.endsWith('.webp'));assert.equal(all.length,46);for(const file of all)img(file.slice(0,-5));});
test('homes exterior and interior for all 3 property tiers',()=>{for(const x of Object.keys(Management.HOMES))for(const v of ['exterior','interior'])img(`home_${x}_${v}`);});
test('player guild artworks include all four room types and props',()=>{for(const id of ['exterior','hall','office','bedroom','storage','banner','board'])img('guild_player_'+id);});
test('shop visuals include correct signs and inventory props',()=>{img('shop_general_interior');for(const id of ['restaurant','smith','general','apothecary'])img('shop_sign_'+id);for(const id of ['food','weapons','goods','potions'])img('shop_stock_'+id);});
test('party 2 locations plus six management icons',()=>{for(const x of ['camp','meeting'])img('party_'+x);for(const x of ['home_deed','guild_crest','party','shop_ledger','happiness','relationship'])img('ui_'+x);});
test('all eight NPCs have real sprites and portraits',()=>{for(const id of ids){img('npc5_'+id);img('portrait_npc5_'+id);}});
test('NPCs are part of the actual deterministic town roster',()=>{for(const id of ids){const npc=NPCs.PEOPLE.find(x=>x.id===id);assert.ok(npc&&npc.stops?.length>=3,id);assert.ok(NPCs.SHEETS[id]);assert.ok(NPCs.snapshots(10).some(x=>x.id===id));}});
test('all new NPCs are in management relations and have visit locations',()=>{const st=game();for(const id of ids){assert.ok(Management.NPCS[id]);assert.ok(Management.meetPlace(id));assert.ok(Management.relation(st,id));}});
test('no NPC is teleported between different world zones',()=>{for(const id of ids){const npc=NPCs.PEOPLE.find(x=>x.id===id);let bounds={town:[0,7203],slum:[6450,11120],market:[15500,19880],guild:[20000,24700]};for(const q of npc.stops) assert.ok(q.x>=bounds[npc.zone][0]&&q.x<=bounds[npc.zone][1],id);}});
test('owned house day route reaches actual home scene, not an inn room',()=>{for(const id of Object.keys(Management.HOMES)){const st=game();assert.equal(Management.buyHome(st,id).ok,true);st.life.roomTonight='owned';st.life.homeTonight=Management.HOMES[id].place;const p=Life.dayPlan(st),night=p[p.length-1];assert.equal(night.room,'home_'+id);assert.ok(night.sleep);assert.match(night.act,/บ้านของตัวเอง/);}});
test('management UI uses real images, touch controls, and image loading paths',()=>{const ui=fs.readFileSync(path.join(ROOT,'life-ui.js'),'utf8'),html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');for(const section of ['home','party','guild','shops','relations'])assert.ok(ui.includes(section));for(const kind of ['mgPic','mgPortrait','data-m-houseview','data-m-guildroom','data-m-partyroom'])assert.ok(ui.includes(kind));assert.ok(html.includes('town-npcs.js?v=125'));assert.ok(html.includes('interiors.js?v=125'));assert.ok(!ui.includes('onmouseover'));});
console.log(`RESULT: ${good}/${good+bad} passed`);if(bad)process.exitCode=1;
