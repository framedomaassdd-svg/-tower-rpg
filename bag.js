/* v93 กระเป๋าและไอเท็ม: what the hero carries, what it costs, how long it keeps, recipes, forging and gathering.
   The bag is a list of stacks { id, n, exp } on the save (st.bag). exp = the last day the stack is still good;
   at the night rollover into a later day it spoils. Pure data + small functions; LifeSim decides when they run. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Bag = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CAP = 20;                                   // inventory slots; stack quantity has no fixed cap
  // kind: meal (eaten for dinner / the night) · ingredient · material · tool (kept, gives a bonus) · goods (made to sell)
  // keep: days it stays good (0 = never spoils) · sell: what a buyer pays · heal: health when eaten
  const ITEMS = Object.freeze({
    ration:    { name: 'อาหารติดมือ',      icon: '🍙', kind: 'meal', keep: 2, sell: 0 },
    bread:     { name: 'ขนมปัง',            icon: '🍞', kind: 'meal', keep: 3, sell: 1 },
    riceball:  { name: 'ข้าวห่อใบตอง',      icon: '🍱', kind: 'meal', keep: 1, sell: 1 },
    jerky:     { name: 'ปลาแห้ง',           icon: '🐟', kind: 'meal', keep: 10, sell: 2 },
    fruit:     { name: 'ผลไม้ป่า',          icon: '🍎', kind: 'meal', keep: 4, sell: 1 },
    meal_veg:  { name: 'ข้าวต้มผัก',        icon: '🍲', kind: 'meal', keep: 1, sell: 0, heal: 3 },
    meal_fish: { name: 'ปลาย่างกับข้าว',    icon: '🍛', kind: 'meal', keep: 1, sell: 0, heal: 5 },
    meal_herbal:{name:'น้ำสมุนไพรเข้มข้น',icon:'🧪',kind:'meal',keep:3,sell:9,heal:18,desc:'สูตรยาจากเมนเควสหมอยา'},
    meal_spice:{ name: 'ข้าวผัดเครื่องเทศ', icon: '🥘', kind: 'meal', keep: 1, sell: 0, heal: 4 },
    rice:      { name: 'ข้าวสาร',           icon: '🌾', kind: 'ingredient', keep: 30, sell: 0 },
    veg:       { name: 'ผักสด',             icon: '🥬', kind: 'ingredient', keep: 4, sell: 1 },
    fish:      { name: 'ปลาสด',             icon: '🐠', kind: 'ingredient', keep: 1, sell: 1 },
    spice:     { name: 'เครื่องเทศ',        icon: '🌶️', kind: 'ingredient', keep: 60, sell: 1 },
    herb:      { name: 'สมุนไพร',           icon: '🌿', kind: 'material', keep: 5, sell: 2 },
    // v120 alchemy: herb tier controls discovery and recipe requirements; stack by item ID, unlimited n.
    root_food: { name:'รากอิ่มท้อง',icon:'🌱',kind:'herb',tier:1,keep:15,sell:5 },
    clear_leaf: { name:'ใบใสสติ',icon:'🍃',kind:'herb',tier:1,keep:15,sell:5 },
    bind_grass: { name:'หญ้าสมาน',icon:'🌿',kind:'herb',tier:1,keep:15,sell:5 },
    wake_leaf: { name:'ใบปลุกตื่น',icon:'🍀',kind:'herb',tier:1,keep:15,sell:5 },
    moist_moss: { name:'ตะไคร่น้ำชุ่ม',icon:'💧',kind:'herb',tier:1,keep:15,sell:4 },
    antidote_root: { name:'รากถอนพิษ',icon:'🥀',kind:'herb',tier:2,keep:20,sell:8 },
    warm_blossom: { name:'ดอกอุ่นกาย',icon:'🌺',kind:'herb',tier:2,keep:20,sell:8 },
    fever_mushroom: { name:'เห็ดลดไข้',icon:'🍄',kind:'herb',tier:2,keep:20,sell:7 },
    antiseptic_bark: { name:'เปลือกยับยั้งเชื้อ',icon:'🌳',kind:'herb',tier:3,keep:25,sell:12 },
    blood_flower: { name:'ดอกโลหิต',icon:'🌹',kind:'herb',tier:3,keep:25,sell:12 },
    vigor_seed: { name:'เมล็ดฟื้นแรง',icon:'🌰',kind:'herb',tier:3,keep:25,sell:12 },
    silver_moss: { name:'มอสเงิน',icon:'🌾',kind:'herb',tier:3,keep:25,sell:15 },
    shadow_petal: { name:'กลีบสะกดเงา',icon:'🌙',kind:'herb',tier:4,keep:30,sell:35 },
    verdant_heart: { name:'หัวใจพฤกษา',icon:'✨',kind:'herb',tier:5,keep:35,sell:150 },
    clean_water:{name:'น้ำสะอาด',icon:'💧',kind:'ingredient',keep:0,sell:1},
    tablet_binder:{name:'สารประสานยาเม็ด',icon:'⚪',kind:'ingredient',keep:0,sell:2},
    // v120 12 medicines: their status effects live in Alchemy.RECIPES.
    travel_tablet:{name:'เม็ดบำรุงเดินทาง',icon:'💊',kind:'medicine',tier:1,form:'tablet',keep:65,sell:9},
    wound_liquid:{name:'น้ำยาสมานแผล',icon:'🧪',kind:'medicine',tier:1,form:'liquid',keep:12,sell:9},
    waking_tea:{name:'ชาปลุกตื่น',icon:'🍵',kind:'medicine',tier:1,form:'liquid',keep:7,sell:9},
    hydration_liquid:{name:'น้ำยาชุ่มกาย',icon:'🫗',kind:'medicine',tier:1,form:'liquid',keep:9,sell:9},
    antidote_tablet:{name:'เม็ดถอนพิษ',icon:'💊',kind:'medicine',tier:2,form:'tablet',keep:100,sell:15},
    warmth_liquid:{name:'น้ำยาอุ่นกาย',icon:'🧪',kind:'medicine',tier:2,form:'liquid',keep:18,sell:15},
    fever_tablet:{name:'เม็ดลดไข้',icon:'💊',kind:'medicine',tier:2,form:'tablet',keep:100,sell:15},
    deep_wound_liquid:{name:'น้ำยาสมานลึก',icon:'🧪',kind:'medicine',tier:3,form:'liquid',keep:25,sell:21},
    vigor_tablet:{name:'เม็ดฟื้นแรง',icon:'💊',kind:'medicine',tier:3,form:'tablet',keep:110,sell:21},
    purify_liquid:{name:'น้ำยาชำระพิษ',icon:'🧪',kind:'medicine',tier:3,form:'liquid',keep:25,sell:21},
    curse_liquid:{name:'น้ำยาสลายคำสาป',icon:'🔮',kind:'medicine',tier:4,form:'liquid',keep:30,sell:27},
    verdant_liquid:{name:'น้ำยาแห่งพฤกษา',icon:'🌟',kind:'medicine',tier:5,form:'liquid',keep:40,sell:33},
    failed_weak_medicine:{name:'ยาคุณภาพต่ำ',icon:'🧫',kind:'medicine',tier:0,keep:6,sell:0},
    failed_tainted_medicine:{name:'ยาปนเปื้อน',icon:'☣️',kind:'medicine',tier:0,keep:6,sell:0},
    // v121 tiered ores. Ore quality is fixed by the source material, not gear rarity.
    copper_ore:{name:'แร่ทองแดง',icon:'🟠',kind:'ore',tier:1,keep:0,sell:5},
    tin_ore:{name:'แร่ดีบุก',icon:'⚪',kind:'ore',tier:1,keep:0,sell:5},
    iron_ore:{name:'แร่เหล็กบริสุทธิ์',icon:'⛏️',kind:'ore',tier:1,keep:0,sell:7},
    silver_ore:{name:'แร่เงินจันทรา',icon:'🌙',kind:'ore',tier:2,keep:0,sell:15},
    ember_ore:{name:'แร่ถ่านเพลิง',icon:'🔥',kind:'ore',tier:2,keep:0,sell:17},
    blood_ore:{name:'แร่โลหิต',icon:'🩸',kind:'ore',tier:2,keep:0,sell:18},
    frost_ore:{name:'แร่เยือกแข็ง',icon:'❄️',kind:'ore',tier:3,keep:0,sell:29},
    venom_ore:{name:'แร่พิษมรกต',icon:'☠️',kind:'ore',tier:3,keep:0,sell:30},
    mind_ore:{name:'แร่จิตสำนึก',icon:'🧠',kind:'ore',tier:3,keep:0,sell:32},
    star_ore:{name:'แร่ดารา',icon:'⭐',kind:'ore',tier:4,keep:0,sell:65},
    aegis_ore:{name:'แร่ผู้พิทักษ์',icon:'🛡️',kind:'ore',tier:4,keep:0,sell:70},
    void_ore:{name:'แร่ห้วงว่าง',icon:'🌀',kind:'ore',tier:5,keep:0,sell:170},
    // v121 special potion and buff meals use their existing stack and expiry machinery.
    might_tonic:{name:'น้ำยากำลัง',icon:'💪',kind:'medicine',tier:2,form:'liquid',keep:20,sell:18},
    mind_draught:{name:'น้ำยาปัญญา',icon:'🧠',kind:'medicine',tier:2,form:'liquid',keep:20,sell:18},
    swift_tablet:{name:'เม็ดลมกรด',icon:'💊',kind:'medicine',tier:3,form:'tablet',keep:90,sell:28},
    ember_guard_liquid:{name:'น้ำยาต้านเพลิง',icon:'🧪',kind:'medicine',tier:3,form:'liquid',keep:30,sell:33},
    venom_guard_tablet:{name:'เม็ดต้านพิษ',icon:'💊',kind:'medicine',tier:3,form:'tablet',keep:100,sell:32},
    aether_elixir:{name:'น้ำยาพลังเวท',icon:'🔮',kind:'medicine',tier:5,form:'liquid',keep:30,sell:99},
    meal_guardian:{name:'ซุปพลังนักขุด',icon:'🍲',kind:'meal',tier:1,keep:2,sell:6,heal:4},
    meal_ranger:{name:'สตูว์ตาพราน',icon:'🥘',kind:'meal',tier:2,keep:2,sell:12,heal:5},
    meal_sage:{name:'ข้าวสมาธิ',icon:'🍱',kind:'meal',tier:3,keep:2,sell:20,heal:6},
    meal_ember:{name:'อาหารต้านเพลิง',icon:'🍖',kind:'meal',tier:3,keep:2,sell:23,heal:7},
    meal_moon:{name:'สำรับแห่งจันทรา',icon:'🍛',kind:'meal',tier:4,keep:2,sell:38,heal:8},
    junk:      { name: 'ของเก่าพอใช้ได้',   icon: '🏺', kind: 'material', keep: 0, sell: 2 },
    scrap:     { name: 'เศษเหล็ก',          icon: '🔩', kind: 'material', keep: 0, sell: 1 },
    iron:      { name: 'เหล็กแท่ง',         icon: '⬛', kind: 'material', keep: 0, sell: 3 },
    monster:   { name: 'ชิ้นส่วนมอนสเตอร์', icon: '🦴', kind: 'material', keep: 0, sell: 6 },   // the tower, later
    knife:     { name: 'มีดครัว',           icon: '🔪', kind: 'tool', keep: 0, sell: 5, equip: 'weapon', desc: 'ทำอาหารได้เพิ่มอีก 1 ที่ · อาวุธพลังโจมตี +2' },
    sickle:    { name: 'เคียว',             icon: '🌙', kind: 'tool', keep: 0, sell: 5, desc: 'เก็บของนอกประตูเมืองได้เพิ่ม 1 ชิ้น' },
    hook:      { name: 'ตะขอคุ้ยของ',       icon: '🪝', kind: 'tool', keep: 0, sell: 5, desc: 'คุ้ยลานของเก่าได้เพิ่ม 1 ชิ้น' },
    dagger:    { name: 'มีดสั้น',           icon: '🗡️', kind: 'goods', keep: 0, sell: 14, equip: 'weapon', desc: 'อาวุธ พลังโจมตี +5' },
    // v109 from the tower
    meat:      { name: 'เนื้อมอนสเตอร์ย่าง', icon: '🍖', kind: 'meal', keep: 2, sell: 1 },
    ore:       { name: 'แร่เหล็กดิบ',        icon: '🪨', kind: 'material', keep: 0, sell: 3 },
    crystal:   { name: 'คริสตัลหอคอย',      icon: '💎', kind: 'material', keep: 0, sell: 15 },
    soul_crystal: { name: 'ผลึกวิญญาณ', icon: '🔷', kind: 'material', keep: 0, sell: 0 },
    potion:    { name: 'ยาฟื้นแรง',          icon: '🧪', kind: 'tool', keep: 0, sell: 2, desc: 'ในหอคอย ดื่มเองเมื่อสุขภาพต่ำกว่า 40 (+30)' },
    book_fire: { name: 'ตำราเพลิงวิญญาณ', icon: '📕', kind: 'book', keep: 0, sell: 40, desc: 'อ่านเพื่อเรียนสกิลแอ็กทีฟ เพลิงวิญญาณ' },
    book_ice:  { name: 'ตำราไอเยือกแข็ง', icon: '📘', kind: 'book', keep: 0, sell: 48, desc: 'อ่านเพื่อเรียนสกิลแอ็กทีฟ ไอเยือกแข็ง' },
    book_sense:{ name: 'ตำราญาณระวังภัย', icon: '📗', kind: 'book', keep: 0, sell: 55, desc: 'อ่านเพื่อเรียนสกิลพาสซีฟ ญาณระวังภัย' },
    book_fireBody: { name: 'ตำรากายาไฟ', icon: '🔥', kind: 'book', keep: 0, sell: 90, desc: 'พาสซีฟกายาไฟ เรียกจิตวิญญาณไฟเมื่อบาดเจ็บหนัก' },
    book_iceSkin: { name: 'ตำราผิวน้ำแข็ง', icon: '🧊', kind: 'book', keep: 0, sell: 90, desc: 'พาสซีฟลดความเสียหาย' },
    book_lastStand: { name: 'ตำราสู้ตาย', icon: '⚡', kind: 'book', keep: 0, sell: 90, desc: 'พาสซีฟเฮือกสุดท้าย' },
    book_shadowStep: { name: 'ตำราก้าวเงา', icon: '🌑', kind: 'book', keep: 0, sell: 90, desc: 'พาสซีฟหนีรอดเมื่อลำพัง' },
    // v108 gear (Skills.GEAR has the numbers)
    namelessBlade:{name:'ดาบของผู้ไม่มีชื่อ',icon:'⚔️',kind:'goods',keep:0,sell:95,equip:'weapon',desc:'อาวุธเควสลับ พลังพื้นฐาน 18'},
    sword:     { name: 'ดาบเหล็ก',          icon: '⚔️', kind: 'goods', keep: 0, sell: 24, equip: 'weapon', desc: 'อาวุธ พลังโจมตี +11' },
    leather:   { name: 'เสื้อหนัง',          icon: '🦺', kind: 'goods', keep: 0, sell: 7, equip: 'armor', desc: 'เกราะ ป้องกัน +5' },
    guardianVest: { name:'เกราะผู้พิทักษ์',icon:'🛡️',kind:'goods',keep:0,sell:120,equip:'armor',desc:'แบบแปลนเควสลับ · เกราะพิเศษ ป้องกันพื้นฐาน 25' },
    chain_vest:{ name: 'เสื้อเกราะโซ่',      icon: '🛡️', kind: 'goods', keep: 0, sell: 25, equip: 'armor', desc: 'เกราะ ป้องกัน +10' },
    // v94 parts for vehicles, and the vehicles themselves (kept in st.vehicles, not in the bag)
    oldwheel:  { name: 'ล้อเก่า',           icon: '🛞', kind: 'material', keep: 0, sell: 3 },
    chain:     { name: 'โซ่เก่า',           icon: '⛓️', kind: 'material', keep: 0, sell: 2 },
    plank:     { name: 'ไม้กระดาน',         icon: '🪵', kind: 'material', keep: 0, sell: 0 },
    horse:     { name: 'ม้า',              icon: '🐎', kind: 'vehicle', keep: 0, sell: 40, speed: 2.5, desc: 'เร็ว 2.5 เท่า ค่าอาหารม้าวันละ 1 เหรียญ' },
    bike:      { name: 'จักรยาน',           icon: '🚲', kind: 'vehicle', keep: 0, sell: 0, speed: 2.0, desc: 'เร็ว 2 เท่า ไม่ต้องเลี้ยง' },
    scooter:   { name: 'สกู๊ตเตอร์',         icon: '🛴', kind: 'vehicle', keep: 0, sell: 0, speed: 1.5, desc: 'เร็ว 1.5 เท่า ทำง่าย' }
  });
  // v119 physical weights (kg / unit). Carried weight never rejects an item; free SLOT count is still 20.
  // Balancing constants deliberately live here, not hidden in UI or combat code.
  const WEIGHTS = Object.freeze({
    ration:.35,bread:.35,riceball:.4,jerky:.18,fruit:.25,meal_veg:.6,meal_fish:.7,meal_herbal:.35,meal_spice:.65,
    rice:1,veg:.3,fish:.55,spice:.08,herb:.12,junk:1.1,scrap:.7,iron:1.8,monster:1.2,
    knife:.7,sickle:1.2,hook:.85,dagger:1.1,meat:.4,ore:2.2,crystal:.5,soul_crystal:.25,potion:.45,
    book_fire:.6,book_ice:.6,book_sense:.6,book_fireBody:.6,book_iceSkin:.6,book_lastStand:.6,book_shadowStep:.6,
    sword:3.5,namelessBlade:4.5,leather:4,chain_vest:9,guardianVest:12,oldwheel:7,chain:2,plank:4,
    horse:0,bike:0,scooter:0,charm:.3,
    root_food:0.12,clear_leaf:0.1,bind_grass:0.1,wake_leaf:0.09,moist_moss:0.15,antidote_root:0.13,warm_blossom:0.12,fever_mushroom:0.14,antiseptic_bark:0.25,blood_flower:0.13,vigor_seed:0.12,silver_moss:0.16,shadow_petal:0.06,verdant_heart:0.6,clean_water:.5,tablet_binder:.08,
    copper_ore:2.3,tin_ore:2,iron_ore:2.8,silver_ore:2.2,ember_ore:2.5,blood_ore:2.4,
    frost_ore:2,venom_ore:1.7,mind_ore:1.7,star_ore:1.4,aegis_ore:3.1,void_ore:1.3,
    might_tonic:.45,mind_draught:.45,swift_tablet:.05,ember_guard_liquid:.45,venom_guard_tablet:.05,aether_elixir:.6,
    meal_guardian:.7,meal_ranger:.85,meal_sage:.6,meal_ember:.9,meal_moon:.65,
    travel_tablet:0.05,wound_liquid:0.45,waking_tea:0.5,hydration_liquid:0.5,antidote_tablet:0.05,warmth_liquid:0.45,fever_tablet:0.05,deep_wound_liquid:0.45,vigor_tablet:0.05,purify_liquid:0.45,curse_liquid:0.5,verdant_liquid:0.6,failed_weak_medicine:.2,failed_tainted_medicine:.2
  });
  const unitWeight = id => WEIGHTS[id] === undefined ? .5 : WEIGHTS[id];
  const slotKey = row => row.instanceId ? 'gear:' + row.instanceId :
    (row.rarity ? 'rarity:' + row.id + ':' + row.rarity : 'item:' + row.id)+(row.quality ? ':quality:'+row.quality : '');
  const slotCount = st => new Set(list(st).filter(s=>s.n>0).map(slotKey)).size;
  const canFit = (st, id, rarity = null, instanceId = null, quality = 0) => {
    const key = instanceId ? 'gear:' + instanceId : rarity ? 'rarity:' + id + ':' + rarity : 'item:' + id;
    const effective = key + (quality ? ':quality:'+quality : '');
    return slotCount(st) < CAP || list(st).some(s=>slotKey(s) === effective);
  };
  const auto = st => st.inventoryAuto !== false;
  function setAuto(st, enabled) { st.inventoryAuto = !!enabled; return st.inventoryAuto; }
  const carriedWeight = st => Math.round((list(st).reduce((n,s)=>n+unitWeight(s.id)*s.n,0) +
    Object.values(st.equip || {}).reduce((n,g)=>n+unitWeight((st.gear && st.gear[g] || {}).templateId),0))*100)/100;
  // Soft-load ~= 10 + STR*0.7 kg; movement becomes impossible at 2.25x that load.
  // At 75% of the soft load agility begins to fall; the same curve slows real travel.
  function loadStatus(st, strength) {
    const str = Math.max(1, Number.isFinite(strength) ? strength : (st.strength || 15));
    const comfortable = 10 + .7*str, weight = carriedWeight(st), ratio = weight/comfortable;
    const speed = ratio <= .75 ? 1 : Math.max(0, Math.min(1, (2.25-ratio)/1.5));
    return { weight, comfortable:Math.round(comfortable*100)/100, ratio, speed,
      agilityFactor: speed <= 0 ? .1 : Math.max(.1,speed), immobile:speed===0 };
  }
  // Storage may hold multiple expiry batches in one *logical* slot. Each batch retains its original expiration.
  function slotRows(st) {
    const grouped = new Map();
    for (const s of list(st)) {
      const key=slotKey(s); let r=grouped.get(key);
      if (!r) { r={key,id:s.id,n:0,instanceId:s.instanceId||null,rarity:s.rarity||null,quality:s.quality||0,exp:0};grouped.set(key,r); }
      r.n+=s.n; if (s.exp && (!r.exp || s.exp<r.exp)) r.exp=s.exp;
    }
    return [...grouped.values()].map(r=>({...r,weight:Math.round(unitWeight(r.id)*r.n*100)/100}));
  }
  function moveSlot(st, key, direction) {
    const keys=slotRows(st).map(r=>r.key), i=keys.indexOf(key), j=i+direction;
    if (!Number.isInteger(direction) || Math.abs(direction)!==1 || i<0 || j<0 || j>=keys.length) return false;
    [keys[i],keys[j]]=[keys[j],keys[i]];
    const rank=new Map(keys.map((k,n)=>[k,n]));st.bag=list(st).slice().sort((a,b)=>rank.get(slotKey(a))-rank.get(slotKey(b)));
    return true;
  }
  function discardSlot(st,key,amount=1) {
    const entry=slotRows(st).find(r=>r.key===key);
    if (!entry) return 0;
    const n=Math.min(entry.n,amount==='all'?entry.n:Math.max(0,Math.floor(amount)));
    if (!n) return 0;
    if (entry.instanceId) return removeGear(st,entry.instanceId)?1:0;
    let remaining=n;
    for (const s of list(st).filter(r=>slotKey(r)===key).sort((a,b)=>(a.exp||1e9)-(b.exp||1e9))) {
      const used=Math.min(s.n,remaining);s.n-=used;remaining-=used;if (!remaining) break;
    }
    st.bag=list(st).filter(r=>r.n>0);sync(st);return n;
  }
  const pending = st => Array.isArray(st.bagPending) ? st.bagPending : (st.bagPending=[]);
  // Manual loot uses a persistent queue. No gear instance is created before the user claims it.
  function queueLoot(st,id,n=1,rarity=null,origin=null,eventId=null) {
    const quantity=Math.max(0,Math.floor(n));if(!ITEMS[id]||!quantity)return null;
    st.bagPendingNext=Math.max(0,Math.floor(st.bagPendingNext||0));
    const loot={uid:'loot'+(++st.bagPendingNext),id,n:quantity,rarity:rarity||null,origin:origin||null,eventId:eventId||null,day:st.day||1};
    pending(st).push(loot);return loot;
  }
  function claimLoot(st,uid) {
    const L=pending(st),i=L.findIndex(p=>p.uid===uid);if(i<0)return {ok:false,why:'ไม่พบของรอเก็บ'};
    const p=L[i];
    if(p.origin&&Number.isInteger(p.origin.floor)){
      const x=st.life&&st.life.exp;
      if(!x||x.over||x.floor!==p.origin.floor||x.exitDay===st.day)
        return {ok:false,why:'ของอยู่คนละชั้นหรือออกจากหอคอยไปแล้ว'};
    }
    let received=0;
    if (ITEMS[p.id].equip) received=addGear(st,p.id,p.rarity||'normal',p.origin||{from:'loot',day:p.day})?1:0;
    else if (ITEMS[p.id].kind==='book' && p.rarity) received=addBook(st,p.id,p.rarity,p.origin)?1:0;
    else received=add(st,p.id,p.n,p.day);
    if (!received) return {ok:false,why:'กระเป๋าเต็ม 20 ช่อง ต้องทิ้งหรือฝากของก่อน'};
    p.n-=received;if(p.n<=0)L.splice(i,1);return {ok:true,id:p.id,n:received,why:'เก็บ'+name(p.id)+' ×'+received};
  }
  function leaveLoot(st,uid) {const i=pending(st).findIndex(p=>p.uid===uid);if(i<0)return false;pending(st).splice(i,1);return true;}
  function abandonFloorLoot(st,floor){const L=pending(st),before=L.length;st.bagPending=L.filter(p=>!(p.origin&&p.origin.floor===floor));return before-st.bagPending.length;}

  // v100 item art: two 4×4 sheets of 128px cells (items_a/items_b.webp); missing art falls back to the emoji above
  const ICON_SHEETS = Object.freeze(['items_a.webp', 'items_b.webp']);
  const ICONS = Object.freeze({
    coin: [0, 0], ration: [0, 1], bread: [0, 2], riceball: [0, 3], jerky: [0, 4], fruit: [0, 5], meal_veg: [0, 6], meal_fish: [0, 7],
    meal_spice: [0, 8], rice: [0, 9], veg: [0, 10], fish: [0, 11], spice: [0, 12], herb: [0, 13], junk: [0, 14], scrap: [0, 15],
    iron: [1, 0], monster: [1, 1], knife: [1, 2], sickle: [1, 3], hook: [1, 4], dagger: [1, 5], sword: [1, 6], oldwheel: [1, 7],
    chain: [1, 8], plank: [1, 9], horse: [1, 10], bike: [1, 11], scooter: [1, 12], coins: [1, 13], potion: [1, 14], chest: [1, 15]
  });
  const COIN = Object.freeze({ name: 'เหรียญ', icon: '🪙' });
  // v111 tower safe-zone traders: rates are deliberately higher than in the city.
  const SAFE_SHOP = Object.freeze({ bread: 4, jerky: 6, potion: 10, clean_water: 4, leather: 22, sword: 72,
    book_fire: 800, book_ice: 1000, book_sense: 198, book_fireBody: 400 });
  const SAFE_BUYER = Object.freeze(['herb','ore','crystal','monster','junk','scrap','iron','fruit','oldwheel','chain',
    'copper_ore','tin_ore','iron_ore','silver_ore','ember_ore','blood_ore','frost_ore','venom_ore','mind_ore','star_ore','aegis_ore','void_ore']);
  // v112: multipliers are supplied by the actual safe-floor service, not patched onto Bag elsewhere.
  const safeBuyPrice = (id, floor, multiplier = 1) => Math.ceil((SAFE_SHOP[id] || 0) * (1 + Math.max(0, Math.floor((floor - 5) / 5)) * 0.13) * multiplier);
  const safeSellPrice = (id, floor, multiplier = 1) => SAFE_BUYER.includes(id) || (ITEMS[id] && ITEMS[id].equip) ?
    Math.max(1, Math.floor((ITEMS[id].sell || 0) * (1.39 + Math.max(0, Math.floor((floor - 5) / 5)) * 0.1) * multiplier)) : 0;
  const skills = () => (typeof globalThis !== 'undefined' && globalThis.Skills) || (typeof require === 'function' ? require('./skills.js') : null);
  function gearSalePrice(st, instanceId, basePrice) {
    const S = skills(), item = S && S.gear(st, instanceId);
    return item ? Math.max(1, Math.round(basePrice * S.rarityMultiplier(item.rarity) * (1 + 0.1 * item.step) * (1+(item.special?.potency||0)+(item.affixStats?0.15:0)))) : 0;
  }
  function sellGear(st, instanceId, multiplier = 1) {
    const S = skills(), item = S && S.gear(st, instanceId);
    if (!item || !list(st).some(s => s.instanceId === instanceId)) return { ok: false, why: 'ไม่มีอุปกรณ์ชิ้นนี้ในกระเป๋า' };
    const price = gearSalePrice(st, instanceId, (ITEMS[item.templateId].sell || 0) * multiplier);
    if (!price) return { ok: false, why: 'ร้านไม่รับซื้อ' };
    removeGear(st, instanceId); st.money = (st.money || 0) + price;
    return { ok: true, price, why: 'ขาย' + S.gearLabel({ gear: { [instanceId]: item } }, instanceId) + ' +' + price + ' เหรียญ' };
  }
  function safeBuy(st, id, floor, multiplier = 1) {
    if (!Object.prototype.hasOwnProperty.call(SAFE_SHOP, id)) return { ok: false, why: 'ร้านนี้ไม่มีสินค้าดังกล่าว' };
    const price = safeBuyPrice(id, floor, multiplier);
    if ((st.money || 0) < price) return { ok: false, why: 'เหรียญไม่เพียงพอ' };
    if (!canFit(st,id)) return { ok: false, why: 'กระเป๋าเต็ม 20 ช่อง' };
    if (add(st, id, 1, st.day) !== 1) return { ok: false, why: 'ซื้อไม่สำเร็จ' };
    st.money -= price; return { ok: true, why: 'ซื้อ' + name(id) + ' −' + price + ' เหรียญ' };
  }
  function safeSell(st, id, floor, multiplier = 1) {
    const S = skills(), gearItem = S && S.gear(st, id);
    if (gearItem) return sellGear(st, id, safeSellPrice(gearItem.templateId, floor, multiplier) / Math.max(1, ITEMS[gearItem.templateId].sell));
    if (ITEMS[id] && ITEMS[id].equip) { const entry = list(st).find(s => s.id === id && s.instanceId); if (entry) return safeSell(st, entry.instanceId, floor, multiplier); }
    const price = safeSellPrice(id, floor, multiplier);
    if (!price || !count(st, id)) return { ok: false, why: 'ไม่มีสินค้าที่ร้านรับซื้อ' };
    if (!take(st, id, 1)) return { ok: false, why: 'ขายไม่สำเร็จ' };
    st.money = (st.money || 0) + price; return { ok: true, why: 'ขาย' + name(id) + ' + ' + price + ' เหรียญ' };
  }
  // where things are bought (place = LifeSim place id)
  const SHOPS = Object.freeze({
    bazaar: { name: 'ตลาดใหญ่', place: 'bazaar', items: { rice: 1, veg: 1, fish: 2, spice: 3, riceball: 2, jerky: 4 } },
    bakery: { name: 'ร้านขนมปัง', place: 'bakery', items: { bread: 2 } },
    smith:  { name: 'โรงตีเหล็ก', place: 'smith', items: { iron: 5, leather: 14, chain_vest: 48, sword: 45 } },
    junk:   { name: 'ร้านรับซื้อของเก่า', place: 'junk', items: { plank: 1, chain: 4, oldwheel: 5 } },
    stable: { name: 'คอกม้าลานเกวียน', place: 'stable', items: { horse: 60 } },
    apothecary: { name: 'ร้านยา', place: 'apothecary', items: { potion: 6, clean_water: 2, tablet_binder: 3, root_food: 3, clear_leaf: 3, bind_grass: 3, wake_leaf: 3, moist_moss: 3 } }
  });
  // who buys what (everything they take is sold in one visit; tools are never sold automatically)
  const BUYERS = Object.freeze({
    junk:       { name: 'ร้านรับซื้อของเก่า', place: 'junk', takes: ['junk', 'scrap'] },
    apothecary: { name: 'ร้านยา', place: 'apothecary', takes: ['herb'] },
    bazaar:     { name: 'ตลาดใหญ่', place: 'bazaar', takes: ['fruit', 'veg', 'fish', 'jerky'] },
    smith:      { name: 'โรงตีเหล็ก', place: 'smith', takes: ['scrap', 'monster', 'ore',
      'copper_ore','tin_ore','iron_ore','silver_ore','ember_ore','blood_ore','frost_ore','venom_ore','mind_ore','star_ore','aegis_ore','void_ore'] },
    tmerchant:  { name: 'กิลด์พ่อค้าหอคอย', place: 'tmerchant', takes: ['monster', 'herb', 'crystal'] }   // v103 ย่านกิลด์
  });
  const RECIPES = Object.freeze({
    meal_veg:   { needs: { rice: 1, veg: 1 }, makes: 2 },
    meal_fish:  { needs: { rice: 1, fish: 1 }, makes: 2 },
    meal_spice: { needs: { rice: 1, veg: 1, spice: 1 }, makes: 3 },
    meal_herbal: { needs: { herb: 3, crystal: 1 }, makes: 2 }
  });
  // stoves: home = the room you sleep in tonight, if it has one
  const STOVES = Object.freeze({
    tavern:      { name: 'ยืมครัวร้านอาหาร', place: 'tavern', fee: 1, room: 'kitchen' },
    campfire:    { name: 'กองไฟคาราวาน', place: 'campfire', fee: 0 },
    streetstall: { name: 'เตาร้านริมทางในตลาด', place: 'streetstall', fee: 1 }
  });
  const HOME_STOVE = Object.freeze({ tenement: 'เตาถ่านในห้องเช่า', shrine: 'ก้อนเส้าหน้าศาลเจ้า', shack: 'เตาสังกะสีข้างเพิง' });
  const FORGE = Object.freeze({
    knife: { iron: 1 }, sickle: { iron: 1 }, hook: { iron: 1 }, dagger: { iron: 2 }, sword: { iron: 4 },
    scooter: { iron: 1, oldwheel: 2, plank: 1 }, bike: { iron: 2, oldwheel: 2, chain: 1 }, guardianVest:{iron:4,ore:4,crystal:3,soul_crystal:2}
  });
  const FORGE_FEE = 2;                               // waived for the smith's apprentice
  const GATHER = Object.freeze({
    scrap: { name: 'คุ้ยลานของเก่าท้ายตรอก', place: 'scrap', tool: 'hook', loot: [['junk', 1, 2], ['scrap', 0, 2], ['oldwheel', 1, 1, 0.25], ['chain', 1, 1, 0.2]] },
    field: { name: 'เก็บของในทุ่งนอกประตูเมือง', place: 'field', tool: 'sickle', loot: [['herb', 1, 2], ['fruit', 0, 2], ['veg', 0, 1]] }
  });

  const list = st => (Array.isArray(st.bag) ? st.bag : (st.bag = []));
  const count = (st, id) => list(st).reduce((n, s) => n + (s.id === id || s.instanceId === id ? s.n : 0), 0);
  const total = st => list(st).reduce((n, s) => n + s.n, 0);
  const meals = st => list(st).reduce((n, s) => n + (ITEMS[s.id] && ITEMS[s.id].kind === 'meal' ? s.n : 0), 0);
  const sync = st => { st.food = meals(st); const S=skills(); if (S && st.base) S.recalc(st); return st; };          // older code and the panel read st.food
  const vehicles = st => (st.vehicles && typeof st.vehicles === 'object' ? st.vehicles : (st.vehicles = {}));
  function add(st, id, n, day, quality = 0) {
    const it = ITEMS[id];
    if (it && it.kind === 'vehicle') {               // one of each, parked rather than carried
      const V = vehicles(st); if (V[id]) return 0;
      V[id] = { since: day || st.day || 1, hungry: 0 }; return 1;
    } n = Math.max(0, Math.floor(n === undefined ? 1 : n));
    if (!it || !n || !canFit(st,id,null,null,quality)) return 0;
    if (it.equip) {
      n = Math.min(n,CAP-slotCount(st));if(!n)return 0;
      const S = skills(); if (!S) return 0;
      S.data(st);
      for (let i = 0; i < n; i++) {
        const g = S.createGear(st, id, 'normal', 0, { from: 'shop', day: day || st.day || 1 });
        list(st).push({ id, n: 1, exp: 0, instanceId: g.instanceId });
      }
      sync(st); return n;
    }
    const exp = it.keep ? (day || st.day || 1) + it.keep : 0, L = list(st);
    const s = L.find(x => x.id === id && x.exp === exp && !x.rarity && !x.instanceId && (x.quality||0)===quality);
    if (s) s.n += n; else L.push({ id, n, exp, ...(quality?{quality}:{}) });
    sync(st); return n;
  }
  function take(st, id, n) {                          // oldest first; moving gear does not destroy the instance
    n = n === undefined ? 1 : n;
    if (count(st, id) < n) return false;
    const L = list(st).filter(s => s.id === id || s.instanceId === id).sort((a, b) => (a.quality||0)-(b.quality||0) || (a.exp || 1e9) - (b.exp || 1e9));
    for (const s of L) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (!n) break; }
    st.bag = list(st).filter(s => s.n > 0); sync(st); return true;
  }
  function addGear(st, templateId, rarity, origin, step = 0) {
    const S = skills(); if (!S || !S.GEAR[templateId] || slotCount(st) >= CAP) return null;
    S.data(st);
    const item = S.createGear(st, templateId, rarity, step, origin);
    list(st).push({ id: templateId, n: 1, exp: 0, instanceId: item.instanceId }); sync(st);
    return item;
  }
  function addBook(st, id, rarity, origin) {
    if (!ITEMS[id] || ITEMS[id].kind !== 'book' || !canFit(st,id,rarity)) return false;
    const row=list(st).find(s=>s.id===id && s.rarity===rarity && !s.instanceId);
    if (row) row.n++; else list(st).push({ id, n: 1, exp: 0, rarity, origin }); sync(st); return true;
  }
  function takeBook(st, id, rarity = null) {
    const row = list(st).find(s => s.id === id && (rarity === null || (s.rarity || 'normal') === rarity));
    if (!row) return false;
    row.n--; st.bag = list(st).filter(s => s.n > 0); sync(st); return true;
  }
  function removeGear(st, instanceId) {
    const S = skills(), item = S && S.gear(st, instanceId); if (!item) return false;
    st.bag = list(st).filter(s => s.instanceId !== instanceId);
    st.stash = stash(st).filter(s => s.instanceId !== instanceId);
    for (const slot of Object.keys(st.equip || {})) if (st.equip[slot] === instanceId) delete st.equip[slot];
    delete st.gear[instanceId]; sync(st); return true;
  }
  function equipGear(st, instanceId) {
    const S = skills(); if (!S) return false; S.data(st);
    const item = S.gear(st, instanceId), entry = list(st).find(s => s.instanceId === instanceId);
    if (!item || !entry) return false;
    const slot = S.GEAR[item.templateId].slot, previous = st.equip[slot];
    if (previous) list(st).push({ id: S.gear(st, previous).templateId, n: 1, exp: 0, instanceId: previous });
    take(st, instanceId, 1); st.equip[slot] = instanceId; S.recalc(st); return true;
  }
  function unequipGear(st, slot) {
    const S = skills(); if (!S) return false; S.data(st);
    const id = st.equip[slot], item = S.gear(st, id);
    if (!item || slotCount(st) >= CAP) return false;
    list(st).push({ id: item.templateId, n: 1, exp: 0, instanceId: id });
    delete st.equip[slot]; sync(st); S.recalc(st); return true;
  }
  // eat one meal: the one that spoils soonest (cooked food first on a tie). Returns the item id or null.
  function eat(st) {
    const L = list(st).filter(s => ITEMS[s.id] && ITEMS[s.id].kind === 'meal')
      .sort((a, b) => (a.exp || 1e9) - (b.exp || 1e9) || (ITEMS[b.id].heal || 0) - (ITEMS[a.id].heal || 0));
    if (!L.length) return null;
    const id = L[0].id; L[0].n--; st.bag = list(st).filter(s => s.n > 0);
    const heal = ITEMS[id].heal || 0; if (heal) st.health = Math.min(100, (st.health || 0) + heal);
    if (ITEMS[id] && ITEMS[id].tier && ITEMS[id].kind === 'meal') {
      const A=(typeof globalThis!=='undefined'&&globalThis.Artisan)||(typeof require==='function'?require('./artisan.js'):null);
      if(A&&A.SPECIAL_FOOD[id]) { const r=A.SPECIAL_FOOD[id],effect={...(r.buff||{}),...(r.resist?{resist:r.resist,potency:.35}:{})};A.applyBuff(st,id,effect,r.hours,'food'); }
    }
    sync(st); return id;
  }
  // night rollover into `day`: whatever's past its date goes off. Returns [[id, n], ...].
  function spoil(st, day) {
    const gone = {};
    for (const s of list(st)) if (s.exp && s.exp < day) gone[s.id] = (gone[s.id] || 0) + s.n;
    st.bag = list(st).filter(s => !(s.exp && s.exp < day)); sync(st);
    return Object.entries(gone);
  }
  const has = (st, needs) => Object.entries(needs).every(([id, n]) => count(st, id) >= n);
  // what's still missing for a recipe, and what it costs at the bazaar
  function missing(st, needs) {
    const out = {}; let cost = 0;
    for (const [id, n] of Object.entries(needs)) { const k = n - count(st, id); if (k > 0) { out[id] = k; cost += k * (SHOPS.bazaar.items[id] || 99); } }
    return { items: out, cost };
  }
  const daysLeft = (s, day) => s.exp ? s.exp - day : Infinity;
  const name = id => ITEMS[id] ? ITEMS[id].name : id;
  const label = pairs => pairs.map(([id, n]) => name(id) + (n > 1 ? ' ×' + n : '')).join(', ');
  function migrate(st) {                              // pre-v93 saves kept food as a bare number
    if (!Array.isArray(st.bag)) { st.bag = []; const n = Math.max(0, Math.min(6, Math.floor(st.food || 0))); if (n) add(st, 'ration', n); }
    const S = skills(); if (S) S.data(st);
    if(st.inventoryAuto===undefined)st.inventoryAuto=true;
    if(!Array.isArray(st.bagPending))st.bagPending=[];
    st.inventoryVersion=120;
    sync(st);
  }
  // v105 the guild storeroom chest: everything but food goes in; out comes as much as the bag can hold
  const stash = st => (Array.isArray(st.stash) ? st.stash : (st.stash = []));
  function deposit(st) {
    let n = 0; const keep = [];
    for (const s of list(st)) { if (ITEMS[s.id] && ITEMS[s.id].kind !== 'meal') { stash(st).push(s); n += s.n; } else keep.push(s); }
    st.bag = keep; sync(st); return n;
  }
  function withdraw(st) {
    let moved=0;const left=[];
    for(const s of stash(st)) {
      if(!canFit(st,s.id,s.rarity||null,s.instanceId||null)){left.push(s);continue;}
      const row=list(st).find(x=>x.id===s.id && x.exp===s.exp && (x.rarity||null)===(s.rarity||null) && (x.quality||0)===(s.quality||0) && !x.instanceId && !s.instanceId);
      if(row)row.n+=s.n;else list(st).push({...s});moved+=s.n;
    }
    st.stash=left;sync(st);return moved;
  }
  // Transfers keep original expiry batches and gear instance identifiers intact.
  function depositItem(st,id,n=1) {
    const template=(skills() && skills().gear(st,id)||{}).templateId||id;
    if(!ITEMS[template]||ITEMS[template].kind==='meal'||!Number.isInteger(n)||n<1||count(st,id)<n)return 0;
    let left=n;
    for(const s of list(st).filter(s=>s.id===id||s.instanceId===id).sort((a,b)=>(a.exp||1e9)-(b.exp||1e9))){
      const k=Math.min(left,s.n), target=stash(st).find(x=>x.id===s.id&&x.exp===s.exp&&(x.rarity||null)===(s.rarity||null)&&(x.quality||0)===(s.quality||0)&&!s.instanceId&&!x.instanceId);
      if(target)target.n+=k;else stash(st).push({...s,n:k});s.n-=k;left-=k;if(!left)break;
    }
    st.bag=list(st).filter(s=>s.n>0);sync(st);return n;
  }
  function withdrawItem(st,id,n=1) {
    const template=(skills() && skills().gear(st,id)||{}).templateId||id;
    if(!ITEMS[template]||!Number.isInteger(n)||n<1)return 0;
    let left=n,moved=0;
    for(const s of stash(st).filter(s=>s.id===id||s.instanceId===id)){
      if(!canFit(st,s.id,s.rarity||null,s.instanceId||null))break;
      const k=Math.min(left,s.n),target=list(st).find(x=>x.id===s.id&&x.exp===s.exp&&(x.rarity||null)===(s.rarity||null)&&(x.quality||0)===(s.quality||0)&&!s.instanceId&&!x.instanceId);
      if(target)target.n+=k;else list(st).push({...s,n:k});s.n-=k;moved+=k;left-=k;if(!left)break;
    }
    st.stash=stash(st).filter(s=>s.n>0);sync(st);return moved;
  }
  const stashCount = st => stash(st).reduce((n, s) => n + s.n, 0);
  return { WEIGHTS,unitWeight,slotKey,slotRows,slotCount,canFit,carriedWeight,loadStatus,auto,setAuto,moveSlot,discardSlot,
    pending,queueLoot,claimLoot,leaveLoot,abandonFloorLoot,stash, deposit, withdraw, depositItem, withdrawItem, stashCount, safeBuy, safeSell, sellGear, gearSalePrice, addGear, addBook, takeBook, removeGear, equipGear, unequipGear, SAFE_SHOP, SAFE_BUYER, safeBuyPrice, safeSellPrice, vehicles, CAP, ITEMS, ICON_SHEETS, ICONS, COIN, SHOPS, BUYERS, RECIPES, STOVES, HOME_STOVE, FORGE, FORGE_FEE, GATHER,
    list, count, total, meals, add, take, eat, spoil, has, missing, daysLeft, name, label, migrate, sync };
});
