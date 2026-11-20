/* Tower RPG v124 — autonomous-world ownership, relationships and leadership.
   Data-only logic: no DOM, no animations.  NPCs retain their own schedules. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Management = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const Bag = (typeof globalThis !== 'undefined' && globalThis.Bag) || (typeof require === 'function' ? require('./bag.js') : null);
  const Skills = (typeof globalThis !== 'undefined' && globalThis.Skills) || (typeof require === 'function' ? require('./skills.js') : null);
  const TownNPCs = (typeof globalThis !== 'undefined' && globalThis.TownNPCs) || (typeof require === 'function' ? require('./town-npcs.js') : null);
  const TownResidents = (typeof globalThis !== 'undefined' && globalThis.TownResidents) || (typeof require === 'function' ? require('./town-residents.js') : null);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const result = (ok, why, extra = {}) => ({ ok, why, ...extra });
  const PEOPLE = Object.freeze(Array.from(new Map([...(TownNPCs?.PEOPLE || []), ...(TownResidents?.PEOPLE || [])]
    .filter(p => p && p.id && p.name && !/^(cat|dog|pigeon|rat|horse|mule|wagon)/.test(p.id))
    .map(p => [p.id, { id: p.id, name: p.name, job: p.job || '' }])).values()));
  const NPCS = Object.freeze(Object.fromEntries(PEOPLE.map(p => [p.id, p])));
  const MEET_PLACE = Object.freeze({smith:'smith',apothecary:'apothecary',chef:'tavern',thana:'tavern',mali:'bakery',innkeeper:'inn',clerk:'guildhall',instructor:'guild',ironboss:'guild',warrior:'guild',archer:'guild',mage:'guild',compassboss:'compass',explorer:'compass',scout:'compass',porterboss:'porter',porterA:'porter',porterB:'porter',merchboss:'tmerchant',appraiser:'tmerchant',pilgrim:'shrine',shopper1:'bazaar',shopper2:'bazaar',property_agent:'inn',carpenter:'bakery',guild_registrar:'guildhall',guild_treasurer:'guildhall',wholesaler:'bazaar',rookie:'guildhall',veteran:'guildhall',neighbor:'bakery',
    captain:'tavern',sentry:'tavern',oldknight:'tavern',pyro:'apothecary',nurse:'apothecary',priest:'soup',wolfkin:'cargo',nomad:'campfire',rogue:'bazaar',ranger:'bazaar',recruit:'guild',shieldmaiden:'guild'});
  const meetPlace = id => NPCS[id] ? MEET_PLACE[id] || 'bazaar' : null;
  const SHOPS = Object.freeze({
    restaurant: { name: 'ร้านอาหาร', icon: '🍲', buy: 650, open: 420, upkeep: 3, wage: 6, place: 'tavern', items: ['bread','jerky','meal_veg','meal_fish','meal_spice','fruit'], staff: ['chef','thana'] },
    smith: { name: 'ร้านตีเหล็ก', icon: '🔨', buy: 900, open: 550, upkeep: 5, wage: 8, place: 'smith', items: ['iron','scrap','copper_ore','tin_ore','iron_ore','silver_ore','knife','sword'], staff: ['smith'] },
    general: { name: 'ร้านขายของ', icon: '📦', buy: 600, open: 350, upkeep: 3, wage: 5, place: 'bazaar', items: ['bread','jerky','rice','veg','spice','fruit','herb','clean_water'], staff: ['mali','mktveg','shopper1','shopper2'] },
    apothecary: { name: 'ร้านยา', icon: '🧪', buy: 850, open: 520, upkeep: 4, wage: 7, place: 'apothecary', items: ['herb','root_food','clear_leaf','bind_grass','antidote_root','travel_tablet','wound_liquid','antidote_tablet','potion'], staff: ['apothecary'] }
  });
  const HOMES = Object.freeze({
    slum: { name: 'บ้านหลังเล็กในตรอก', price: 180, place: 'tenement', energy: 75, health: 2, joy: 1, upkeep: 1 },
    town: { name: 'บ้านในย่านตลาด', price: 650, place: 'inn', energy: 100, health: 7, joy: 3, upkeep: 2 },
    manor: { name: 'บ้านหลังใหญ่', price: 1900, place: 'inn', energy: 100, health: 12, joy: 6, upkeep: 5 }
  });
  const STANCES = Object.freeze({ safe: {name:'ระมัดระวัง',power:0.88}, balanced:{name:'สมดุล',power:1}, deep:{name:'เสี่ยงภัย',power:1.1} });
  const MISSIONS = Object.freeze({ supply:{name:'ขนเสบียง',pay:7,risk:3}, scout:{name:'สำรวจ',pay:12,risk:8}, raid:{name:'ล่ามอนสเตอร์',pay:18,risk:18} });
  function hash(...args) { let h=2166136261; for (const ch of args.join('|')) { h ^= ch.charCodeAt(0); h=Math.imul(h,16777619); } return (h>>>0)/4294967296; }
  function seed(st) { const L=st.life || {}; return (L.origin || '')+'|'+(L.age || '')+'|'+(st.profession || ''); }
  function ensure(st) {
    if (!st || !st.life || typeof st.life !== 'object') return null;
    const M=st.management && typeof st.management === 'object' && !Array.isArray(st.management) ? st.management : (st.management = {});
    M.version=124;
    if (!M.party || typeof M.party !== 'object') M.party={ leader:false,members:[],stance:'balanced',lastVoteDay:0 };
    if (!Array.isArray(M.party.members)) M.party.members=[];
    M.party.members=[...new Set(M.party.members)].filter(id => NPCS[id]).slice(0,3);
    if (!STANCES[M.party.stance]) M.party.stance='balanced';
    if (!M.relations || typeof M.relations !== 'object') M.relations={};
    if (!M.shops || typeof M.shops !== 'object') M.shops={};
    if (!M.happiness || typeof M.happiness !== 'object') M.happiness={ value:50, updatedDay:0 };
    M.happiness.value=clamp(Number(M.happiness.value)||0,0,100);
    if (!M.logs || !Array.isArray(M.logs)) M.logs=[];
    if (!Number.isInteger(M.lastDay)) M.lastDay=Math.max(0,(st.day || 1));
    return M;
  }
  function log(st, msg) { const M=ensure(st); if(M) M.logs.unshift('วันที่ '+st.day+' · '+msg); if(M) M.logs=M.logs.slice(0,40); return msg; }
  function relation(st,id) { const M=ensure(st); if(!M || !NPCS[id]) return null; return M.relations[id] || (M.relations[id]={trust:20,friendship:20,lastTalk:0,lastAsk:0,interactions:0}); }
  function relationships(st) { const M=ensure(st); return PEOPLE.map(p=>({...p,...(M.relations[p.id] || {trust:20,friendship:20,lastTalk:0})})); }
  function adjust(st,id,trust,friendship) { const r=relation(st,id); if(!r)return false; r.trust=clamp(r.trust+trust,0,100);r.friendship=clamp(r.friendship+friendship,0,100); return true; }
  function interact(st,id,kind='talk',item) {
    const r=relation(st,id); if(!r)return result(false,'ไม่พบ NPC นี้ในเมือง');
    if(st.life.dead)return result(false,'ตัวละครเสียชีวิตแล้ว');
    if(st.life.exp && !st.life.exp.over)return result(false,'ต้องกลับมาที่เมืองก่อน');
    if(r.lastTalk===st.day)return result(false,'วันนี้ได้พบพูดคุยกันแล้ว');
    if(!['talk','help','gift'].includes(kind))return result(false,'ไม่รู้จักกิจกรรมนี้');
    if(kind==='help' && (st.energy || 0)<12)return result(false,'ไม่มีแรงพอช่วยงาน');
    if(kind==='gift' && (!Bag || !item || !Bag.ITEMS[item] || Bag.count(st,item)<1 || Bag.ITEMS[item].equip))return result(false,'ไม่มีของขวัญที่ใช้ได้');
    if(kind==='help')st.energy-=12;
    if(kind==='gift')Bag.take(st,item,1);
    const roll=hash(seed(st),st.day,id,kind),joy=ensure(st).happiness.value;
    const trust=kind==='help'?4:kind==='gift'?2:1;
    const good=roll<(kind==='help'?.9:kind==='gift'?.84:.72)+Math.max(-.1,(joy-50)/500);
    adjust(st,id,good?trust:0,good?(kind==='talk'?3:kind==='help'?3:4):-1);
    r.lastTalk=st.day;r.interactions++;
    const msg=good?'สนิทกับ'+NPCS[id].name+'มากขึ้น':'การพูดคุยกับ'+NPCS[id].name+'ไม่ราบรื่นนัก';
    log(st,msg);return result(true,msg,{trust:r.trust,friendship:r.friendship});
  }
  function employed(st,id){const M=ensure(st);return Object.values(M.shops).some(s=>s.staff===id);}
  function occupied(st,id) { const M=ensure(st); return employed(st,id) || (M.guild && M.guild.members.includes(id)); }
  function askJoin(st,id) {
    const M=ensure(st),r=relation(st,id);if(!r)return result(false,'ไม่พบ NPC');
    if(st.life.exp && !st.life.exp.over)return result(false,'ต้องกลับเมืองก่อน');
    if(M.party.members.includes(id))return result(false,'อยู่ในทีมแล้ว');
    if(M.party.members.length>=3)return result(false,'ปาร์ตี้เต็มแล้ว (รวมผู้เล่น 4 คน)');
    if(employed(st,id))return result(false,'NPC ต้องทำงานในร้าน จึงยังออกสำรวจกับทีมไม่ได้');
    if(r.trust<55 || r.friendship<45)return result(false,'ต้องมีความไว้วางใจ 55 และมิตรภาพ 45 ก่อน');
    if(r.lastAsk===st.day)return result(false,'วันนี้ขอเข้าร่วมไปแล้ว');
    r.lastAsk=st.day;
    if(hash(seed(st),'party',st.day,id)>clamp(.45+(r.trust-55)/100+(r.friendship-45)/180,.2,.92))return result(false,log(st,NPCS[id].name+'ยังไม่พร้อมร่วมปาร์ตี้'));
    M.party.members.push(id);return result(true,log(st,NPCS[id].name+'ตกลงเข้าปาร์ตี้'));
  }
  function leaveParty(st,id) { const M=ensure(st);if(!M.party.members.includes(id))return result(false,'ไม่ได้อยู่ในทีม');M.party.members=M.party.members.filter(x=>x!==id);if(M.party.members.length<2)M.party.leader=false;return result(true,log(st,NPCS[id].name+'ออกจากปาร์ตี้')); }
  function requestLeader(st) {const M=ensure(st),p=M.party;if(p.leader)return result(false,'เป็นหัวหน้าอยู่แล้ว');if(p.members.length<2)return result(false,'ต้องมีเพื่อนร่วมทีมอย่างน้อย 2 คน');if(p.lastVoteDay===st.day)return result(false,'ลงคะแนนวันนี้ไปแล้ว');p.lastVoteDay=st.day;
    const support=p.members.filter(id=>relation(st,id).trust>=60 && relation(st,id).friendship>=45).length;
    if(support<2)return result(false,'ต้องมีสมาชิกอย่างน้อย 2 คนที่ไว้วางใจ 60 ขึ้นไป');
    if(hash(seed(st),'leader',st.day)>.25+support*.2)return result(false,log(st,'สมาชิกยังไม่พร้อมมอบตำแหน่งหัวหน้า'));
    p.leader=true;return result(true,log(st,'สมาชิกลงมติให้คุณเป็นหัวหน้าปาร์ตี้'));
  }
  function partyPower(st) {const p=ensure(st).party;if(!p.leader)return 0;return Math.round(p.members.reduce((n,id)=>{const r=relation(st,id);return n+18+Math.floor(r.trust*.20);},0)*STANCES[p.stance].power);}
  function setStance(st,stance){const p=ensure(st).party;if(!p.leader||!STANCES[stance])return result(false,'ต้องเป็นหัวหน้าก่อนจึงกำหนดนโยบายทีมได้');p.stance=stance;return result(true,log(st,'กำหนดแนวทางปาร์ตี้: '+STANCES[stance].name));}
  function buyHome(st,id){const M=ensure(st),H=HOMES[id];if(!H)return result(false,'ไม่มีบ้านแบบนี้');if(st.life.exp&&!st.life.exp.over)return result(false,'ต้องกลับเมืองก่อน');if(M.home)return result(false,'มีบ้านแล้ว สามารถอัปเกรดได้');if(st.money<H.price)return result(false,'เงินไม่พอ');st.money-=H.price;M.home=id;st.life.roomPref='owned';return result(true,log(st,'ซื้อ'+H.name+' ราคา '+H.price+' เหรียญ'));}
  function upgradeHome(st,id){const M=ensure(st),H=HOMES[id];if(!H||!M.home)return result(false,'ต้องมีบ้านก่อน');const current=HOMES[M.home];if(H.price<=current.price)return result(false,'ต้องอัปเกรดเป็นบ้านที่ดีกว่า');const cost=H.price-current.price;if(st.money<cost)return result(false,'เงินไม่พอ ('+cost+' เหรียญ)');st.money-=cost;M.home=id;return result(true,log(st,'อัปเกรดบ้านเป็น'+H.name+' ราคา '+cost+' เหรียญ'));}
  function homeInfo(st){const M=ensure(st);return M&&M.home?HOMES[M.home]:null;}
  function openShop(st,type,mode='open'){const M=ensure(st),S=SHOPS[type];if(!S)return result(false,'ไม่รู้จักประเภทร้าน');if(M.shops[type])return result(false,'เป็นเจ้าของร้านประเภทนี้อยู่แล้ว');if(st.life.exp&&!st.life.exp.over)return result(false,'ต้องกลับเมืองก่อน');if(!['open','buy'].includes(mode))return result(false,'วิธีเปิดร้านไม่ถูกต้อง');const cost=S[mode];if(st.money<cost)return result(false,'เงินไม่พอ ต้องใช้ '+cost+' เหรียญ');st.money-=cost;M.shops[type]={ mode,cash:0,staff:null,stock:{},stockLots:{},gearStock:[],price:100,lastDay:st.day,revenue:0,expense:0,days:0,open:true };
    return result(true,log(st,(mode==='buy'?'ซื้อกิจการ':'เปิดกิจการ')+S.name+' −'+cost+' เหรียญ'));}
  function stock(st,type,item,n){const M=ensure(st),b=M.shops[type],S=SHOPS[type];n=Math.floor(Number(n));if(!b||!S)return result(false,'ยังไม่มีร้านนี้');if(!S.items.includes(item)||!Bag?.ITEMS[item])return result(false,'ร้านนี้ไม่รับสินค้าชนิดนี้');if(!Number.isInteger(n)||n<=0)return result(false,'จำนวนไม่ถูกต้อง');if(Bag.count(st,item)<n)return result(false,'สินค้าไม่พอในกระเป๋า');
    const rows=Bag.list(st).filter(x=>x.id===item&&x.n>0&&!x.instanceId).sort((a,b)=>(a.quality||0)-(b.quality||0)||(a.exp||1e9)-(b.exp||1e9));
    let remain=n;const moved=[];for(const row of rows){const take=Math.min(row.n,remain);if(take)moved.push({n:take,exp:row.exp||0});remain-=take;if(!remain)break;}
    if(remain||!Bag.take(st,item,n))return result(false,'ไม่สามารถย้ายสินค้าได้');
    b.stockLots=b.stockLots||{};b.stockLots[item]=(b.stockLots[item]||[]).concat(moved);b.stock[item]=(b.stock[item]||0)+n;return result(true,log(st,'ส่ง'+Bag.name(item)+' ×'+n+' เข้าสต็อก'+S.name));}
  // Gear remains an individual instance while listed for sale; no cloning or price re-roll.
  function stockGear(st, type, instanceId) {
    const M=ensure(st),b=M.shops[type], item=Skills?.gear(st,instanceId);
    if(!b || type!=='smith')return result(false,'เฉพาะร้านตีเหล็กของตัวเองที่รับฝากขายอุปกรณ์');
    if(!item || !Bag.list(st).some(x=>x.instanceId===instanceId))return result(false,'ไม่มีอุปกรณ์ชิ้นนี้ในกระเป๋า');
    if(!Skills.GEAR[item.templateId] || Skills.GEAR[item.templateId].slot==='charm')return result(false,'ร้านไม่รับอุปกรณ์ชนิดนี้');
    if((b.gearStock||[]).includes(instanceId))return result(false,'อุปกรณ์อยู่ในร้านแล้ว');
    b.gearStock=b.gearStock||[];
    b.gearStock.push(instanceId);
    st.bag=Bag.list(st).filter(x=>x.instanceId!==instanceId);
    Bag.sync(st);
    return result(true,log(st,'ฝากขาย'+Skills.gearLabel(st,instanceId)+' ที่ร้านตีเหล็ก'));
  }
  function reclaimGear(st, type, instanceId) {
    const b=ensure(st).shops[type],item=Skills?.gear(st,instanceId);
    if(!b || type!=='smith' || !item || !(b.gearStock||[]).includes(instanceId))return result(false,'ไม่พบอุปกรณ์ที่ฝากขาย');
    if(Bag.slotCount(st)>=Bag.CAP)return result(false,'ช่องกระเป๋าเต็ม ไม่สามารถถอนอุปกรณ์');
    b.gearStock=b.gearStock.filter(id=>id!==instanceId);
    Bag.list(st).push({id:item.templateId,n:1,exp:0,instanceId});Bag.sync(st);
    return result(true,log(st,'ถอน'+Skills.gearLabel(st,instanceId)+' จากร้านตีเหล็ก'));
  }
  function storeCash(st,type,mode,amount){const M=ensure(st),b=M.shops[type];if(!b)return result(false,'ยังไม่มีร้าน');amount=Math.floor(Number(amount));if(!Number.isFinite(amount)||amount<=0)return result(false,'จำนวนต้องมากกว่า 0');if(mode==='in'){if(st.money<amount)return result(false,'เงินส่วนตัวไม่พอ');st.money-=amount;b.cash+=amount;}
    else if(mode==='out'){if(b.cash<amount)return result(false,'เงินร้านไม่พอ');b.cash-=amount;st.money+=amount;}
    else return result(false,'ไม่รู้จักการโอนเงิน');return result(true,log(st,(mode==='in'?'ฝาก':'ถอน')+'เงิน '+amount+' เหรียญ · '+SHOPS[type].name));}
  function hire(st,type,id){const M=ensure(st),b=M.shops[type],S=SHOPS[type];if(!b||!S)return result(false,'ยังไม่มีร้าน');if(!S.staff.includes(id)||!NPCS[id])return result(false,'NPC นี้ไม่ได้ทำงานอยู่ในสายอาชีพของร้าน');if(b.staff)return result(false,'ร้านมีผู้ดูแลอยู่แล้ว');if(M.party.members.includes(id)||occupied(st,id))return result(false,'NPC มีพันธะงานอื่นแล้ว');const r=relation(st,id);if(r.trust<40)return result(false,'ต้องมีความไว้วางใจอย่างน้อย 40');if(r.lastHireDay===st.day)return result(false,'วันนี้ชวนมาทำงานแล้ว');r.lastHireDay=st.day;if(hash(seed(st),'hire',st.day,id,type)>(.7+r.trust/400))return result(false,log(st,NPCS[id].name+'ปฏิเสธข้อเสนอจ้างงาน'));b.staff=id;return result(true,log(st,'จ้าง'+NPCS[id].name+' ดูแล'+S.name));}
  function fire(st,type){const b=ensure(st).shops[type];if(!b||!b.staff)return result(false,'ยังไม่มีพนักงาน');const id=b.staff;b.staff=null;adjust(st,id,-6,-8);return result(true,log(st,'เลิกจ้าง'+NPCS[id].name));}
  function price(st,type,pct){const b=ensure(st).shops[type],p=Number(pct);if(!b||![80,100,120,140].includes(p))return result(false,'ราคาไม่ถูกต้อง');b.price=p;return result(true,log(st,'ปรับราคาขาย'+SHOPS[type].name+' เป็น '+p+'%'));}
  function formGuild(st,name){const M=ensure(st);if(M.guild)return result(false,'มีกิลด์ของตัวเองอยู่แล้ว');if((st.rep||0)<5)return result(false,'ต้องมีชื่อเสียงอย่างน้อย 5');if(st.money<800)return result(false,'ต้องมีเงินอย่างน้อย 800 เหรียญ');name=String(name||'').trim().slice(0,24);if(name.length<2)return result(false,'ตั้งชื่อกิลด์อย่างน้อย 2 ตัวอักษร');if(st.life.exp&&!st.life.exp.over)return result(false,'ต้องกลับเมืองก่อน');st.money-=800;M.guild={name,treasury:0,members:[],mission:'supply',morale:70,lastDay:st.day,level:1};return result(true,log(st,'ก่อตั้งกิลด์ '+name+' และเสียค่าจดทะเบียน 800 เหรียญ'));}
  function guildMember(st,id){const M=ensure(st),G=M.guild,r=relation(st,id);if(!G)return result(false,'ยังไม่มีกิลด์');if(!r)return result(false,'ไม่พบ NPC');if(G.members.includes(id))return result(false,'เป็นสมาชิกแล้ว');if(G.members.length>=8)return result(false,'กิลด์รับสมาชิกได้มากสุด 8 คนในระบบรุ่นนี้');if(employed(st,id))return result(false,'NPC มีหน้าที่ในร้านแล้ว');if(r.lastGuildAsk===st.day)return result(false,'วันนี้ชวนเข้ากิลด์แล้ว');r.lastGuildAsk=st.day;if(r.trust<50)return result(false,'ต้องมีความไว้วางใจ 50 ขึ้นไป');if(hash(seed(st),'guild',st.day,id)>.5+r.trust/250)return result(false,log(st,NPCS[id].name+'ยังไม่พร้อมเข้ากิลด์'));G.members.push(id);return result(true,log(st,NPCS[id].name+'เข้าร่วมกิลด์'));}
  function guildCash(st,mode,amount){const G=ensure(st).guild;if(!G)return result(false,'ไม่มีกิลด์');amount=Math.floor(Number(amount));if(!Number.isFinite(amount)||amount<1)return result(false,'จำนวนไม่ถูกต้อง');if(mode==='in'){if(st.money<amount)return result(false,'เงินไม่พอ');st.money-=amount;G.treasury+=amount;}else if(mode==='out'){if(G.treasury<amount)return result(false,'กองกลางไม่พอ');G.treasury-=amount;st.money+=amount;}else return result(false,'คำสั่งไม่ถูกต้อง');return result(true,log(st,(mode==='in'?'ฝาก':'ถอน')+'เงินกิลด์ '+amount+' เหรียญ'));}
  function setMission(st,id){const G=ensure(st).guild;if(!G||!MISSIONS[id])return result(false,'ไม่มีภารกิจ');G.mission=id;return result(true,log(st,'กำหนดภารกิจกิลด์: '+MISSIONS[id].name));}
  function day(st,day){const M=ensure(st);if(!M)return [];
    const notices=[];
    for(const [type,b] of Object.entries(M.shops)) {const S=SHOPS[type];if(!S||b.lastDay>=day)continue;b.lastDay=day;b.days++;
      // Decay continues even if the shop is closed. Keep expiration per transferred lot.
      for(const item of Object.keys(b.stock)){
        const lots=b.stockLots?.[item];if(!Array.isArray(lots))continue;
        const lost=lots.filter(x=>x.exp&&x.exp<day).reduce((n,x)=>n+x.n,0);
        if(lost){b.stock[item]=Math.max(0,(b.stock[item]||0)-lost);notices.push(S.name+' สินค้า '+Bag.name(item)+' หมดอายุ '+lost+' ชิ้น');}
        b.stockLots[item]=lots.filter(x=>!x.exp||x.exp>=day);
      }
      if(!b.staff||!b.open)continue;
      const r=relation(st,b.staff);if(r.trust<=8){b.staff=null;notices.push(S.name+' ผู้ดูแลลาออก');continue;}
      const costs=S.wage+S.upkeep;if(b.cash<costs){notices.push(S.name+' เงินทุนหมุนเวียนไม่พอ ร้านหยุดขายวันนี้');r.trust=clamp(r.trust-1,0,100);continue;}
      b.cash-=costs;b.expense+=costs;let daily=0,units=0;
      for(const item of Object.keys(b.stock).sort()){let remain=b.stock[item]||0;if(remain<=0)continue;
        const h=hash(seed(st),day,type,item,'demand'),want=Math.min(remain,Math.floor(h*4)+1);
        const sell=Math.max(0,want-(b.price>=140?1:0));if(!sell)continue;
        const base=Math.max(1,Math.floor((Bag.ITEMS[item].sell||1)*1.7+1));
        daily+=sell*Math.max(1,Math.round(base*b.price/100));units+=sell;b.stock[item]-=sell;
        if(Array.isArray(b.stockLots?.[item])){
          let left=sell;for(const lot of b.stockLots[item]){const used=Math.min(lot.n,left);lot.n-=used;left-=used;if(!left)break;}
          b.stockLots[item]=b.stockLots[item].filter(x=>x.n>0);
        }
      }
      // Shop equipment is actual instance inventory, not generated from daily demand.
      if(type==='smith' && Array.isArray(b.gearStock) && b.gearStock.length){
        const id=b.gearStock[0],gear=Skills?.gear(st,id);
        if(!gear){b.gearStock.shift();notices.push('ลบรายการอุปกรณ์สูญหายจากสต็อกช่างตีเหล็ก');}
        else if(hash(seed(st),day,type,id,'gearDemand')<.55){
          const base=Math.max(1,Bag.ITEMS[gear.templateId]?.sell||1);
          const earned=Math.max(1,Math.round(Bag.gearSalePrice(st,id,base)*1.7*b.price/100));
          if(Bag.removeGear(st,id)){
            b.gearStock.shift();daily+=earned;units++;
            notices.push(S.name+' ขายอุปกรณ์รายชิ้น '+gear.templateId+' ['+gear.rarity+'] +'+gear.step+' ได้ '+earned+' เหรียญ');
          }
        }
      }
      b.cash+=daily;b.revenue+=daily;
      if(units)notices.push(S.name+' ขาย '+units+' ชิ้น รายรับ '+daily+' เหรียญ (หักค่าใช้จ่าย '+costs+')');
    }
    const G=M.guild;if(G && G.lastDay<day){G.lastDay=day;
      const personal=st.life?.exp,away=personal&&personal.party==='personal'&&day>=personal.start&&!personal.over;
      const onMission=G.members.filter(id=>!(away&&M.party.members.includes(id)));
      if(onMission.length){const staffCost=onMission.length*2;
        if(G.treasury>=staffCost){G.treasury-=staffCost;const mission=MISSIONS[G.mission]||MISSIONS.supply;
          const success=hash(seed(st),'guildmission',day)>mission.risk/100;
          if(success){const earned=mission.pay*onMission.length;G.treasury+=earned;G.morale=clamp(G.morale+1,0,100);}
          else {G.morale=clamp(G.morale-6,0,100);notices.push('กิลด์กลับจาก'+mission.name+'อย่างบอบช้ำ');}
        }else{G.morale=clamp(G.morale-5,0,100);notices.push('กิลด์ขาดเงินจ่ายสมาชิก');}}
      if(G.morale<=10 && G.members.length){const id=G.members.pop();adjust(st,id,-5,-5);notices.push(NPCS[id].name+'ออกจากกิลด์เพราะขวัญกำลังใจต่ำ');G.morale=20;}
    }
    const H=homeInfo(st);if(H){const paid=st.money>=H.upkeep;if(paid)st.money-=H.upkeep;else notices.push('บ้านขาดค่าดูแลรายวัน');}
    const happiness=M.happiness;
    let change=0;
    change+=(H?H.joy-2:-2);
    if((st.health||0)<40)change-=4;else if((st.health||0)>75)change++;
    if((st.energy||0)<25)change-=3;
    const nearby=Object.values(M.relations).filter(r=>r.friendship>=60).length;
    if(nearby)change+=Math.min(3,nearby);
    if(st.money<=0)change-=2;
    if(st.life?.dead)change-=20;
    happiness.value=clamp(happiness.value+change,0,100);happiness.updatedDay=day;
    return notices;
  }
  function tick(st){const M=ensure(st);if(!M)return [];
    const now=Math.max(1,Math.floor(st.day||1));const notices=[];
    for(let d=M.lastDay+1;d<=now;d++){notices.push(...day(st,d));}M.lastDay=now;
    for(const x of notices)log(st,x);
    return notices;
  }
  return { SHOPS,HOMES,STANCES,MISSIONS,PEOPLE,NPCS,meetPlace,ensure,relation,relationships,interact,askJoin,leaveParty,requestLeader,partyPower,setStance,buyHome,upgradeHome,homeInfo,openShop,stock,stockGear,reclaimGear,storeCash,hire,fire,price,formGuild,guildMember,guildCash,setMission,tick,hash };
});
