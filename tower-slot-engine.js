/* Tower RPG — Dual Slot Engine V1 (from tower-slot-v2; v109 adds opts.weights in spin) (plain JavaScript, browser + Node compatible)
 * Deterministic rolls per world seed/event ID. This module proposes effects; the game
 * simulation remains the authority for items, injuries, routes, monsters and deaths.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TowerSlotEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const E = [
    ['blank','', 'ว่างเปล่า','neutral',30],
    ['mine','⛏️','ขุดแร่','gain',12], ['stone','🪨','หิน','obstacle',10],
    ['gem','💎','แร่มีค่า','gain',3], ['herb','🌿','สมุนไพร','gain',12],
    ['mushroom','🍄','เห็ด','gain',7], ['tool','🛠️','เครื่องมือ','gain',7],
    ['chest','📦','สิ่งของ','discover',4], ['key','🗝️','กุญแจ','discover',3],
    ['scroll','📜','บันทึก','discover',5], ['compass','🧭','สำรวจ','discover',9],
    ['tracks','👣','ร่องรอย','discover',7], ['luck','🍀','โชค','good',7],
    ['ally','🤝','ผู้พบเจอ','good',4], ['magic','✨','พลังเวท','magic',6],
    ['orb','🔮','วัตถุลึกลับ','magic',3], ['vortex','🌀','ความผิดปกติ','magic',3],
    ['eye','👁️','ถูกจับตามอง','risk',5], ['danger','⚠️','อันตราย','risk',6],
    ['poison','☠️','พิษ','risk',4], ['hole','🕳️','หลุมลึก','risk',4],
    ['fire','🔥','ไฟ','risk',3], ['skull','💀','หายนะ','fatal',0]
  ];
  const C = [
    ['blank','', 'ว่างเปล่า','neutral',27],
    ['sword','⚔️','โจมตี','attack',16], ['shield','🛡️','ป้องกัน','defense',14],
    ['dodge','💨','หลบหลีก','defense',12], ['target','🎯','จุดอ่อน','attack',8],
    ['skill','✨','สกิล','attack',7], ['speed','⚡','ความเร็ว','attack',8],
    ['fire','🔥','ไฟ','attack',4], ['ice','🧊','น้ำแข็ง','attack',4],
    ['luck','🍀','โชค','good',6], ['ally','🤝','ช่วยเหลือ','defense',4],
    ['vortex','🌀','สถานการณ์เปลี่ยน','magic',3],
    ['danger','⚠️','ผิดพลาด','risk',7], ['blood','🩸','บาดเจ็บ','risk',6],
    ['stagger','💥','เสียหลัก','risk',6], ['skull','💀','หายนะ','fatal',0]
  ];
  function asCatalog(rows){return Object.fromEntries(rows.map(([id,emoji,label,category,weight])=>[id,{id,emoji,label,category,weight}]));}
  const SYMBOLS = Object.freeze({event:Object.freeze(asCatalog(E)),combat:Object.freeze(asCatalog(C))});
  const SCENARIOS = Object.freeze({
    mine: {name:'ขุดแร่', kind:'event', intro:'ระหว่างขุดแร่'},
    herb: {name:'เก็บสมุนไพร', kind:'event', intro:'ระหว่างเก็บสมุนไพร'},
    explore: {name:'สำรวจหอคอย', kind:'event', intro:'ระหว่างสำรวจ'},
    travel: {name:'เดินทาง', kind:'event', intro:'ระหว่างเดินทาง'},
    rest: {name:'พักแรม', kind:'event', intro:'ระหว่างพักแรม'},
    combat: {name:'ต่อสู้', kind:'combat', intro:'ระหว่างการต่อสู้'}
  });
  // The *full* catalog contains 23/16 symbols. Each scene enables a thematic subset.
  const POOLS = Object.freeze({
    mine:'blank mine stone gem tool chest key compass tracks luck magic orb vortex eye danger hole fire skull',
    herb:'blank herb mushroom tracks compass luck ally magic orb vortex eye poison danger fire skull',
    explore:'blank compass tracks chest key scroll luck ally magic orb vortex eye danger poison hole fire skull',
    travel:'blank compass tracks ally luck eye danger hole fire magic skull',
    rest:'blank herb mushroom luck ally magic eye danger poison fire skull',
    combat:C.map(r=>r[0]).join(' ')
  });
  const CONTEXTS = Object.freeze({
    mine:{oreQuality:3,hiddenCache:true,hiddenPassage:true,creatureNearby:true,allyNearby:false,magicPresence:true,hazardLevel:2,poisonPresence:false,fireRisk:true,lethalPossible:true},
    herb:{oreQuality:0,hiddenCache:false,hiddenPassage:false,creatureNearby:true,allyNearby:true,magicPresence:true,hazardLevel:2,poisonPresence:true,fireRisk:true,lethalPossible:true},
    explore:{oreQuality:0,hiddenCache:true,hiddenPassage:true,creatureNearby:true,allyNearby:true,magicPresence:true,hazardLevel:2,poisonPresence:true,fireRisk:true,lethalPossible:true},
    travel:{oreQuality:0,hiddenCache:false,hiddenPassage:true,creatureNearby:true,allyNearby:true,magicPresence:true,hazardLevel:1,poisonPresence:false,fireRisk:true,lethalPossible:true},
    rest:{oreQuality:0,hiddenCache:false,hiddenPassage:false,creatureNearby:true,allyNearby:true,magicPresence:true,hazardLevel:1,poisonPresence:true,fireRisk:true,lethalPossible:true},
    combat:{allyNearby:true,hasActiveSkill:true,elementalFire:true,elementalIce:true,magicPresence:true,hazardLevel:2,lethalPossible:true}
  });
  const RECIPES = [];
  function canonical(reels){return reels.slice().sort().join('|');}
  function add(scene, tokens, title, description, type='advantage'){
    const reels=tokens.trim().split(' ');
    if(reels.length !== 3) throw Error('Recipe needs three symbols: '+tokens);
    if(!reels.every(x=>SYMBOLS[SCENARIOS[scene].kind][x])) throw Error('Unknown symbol: '+tokens);
    RECIPES.push({scene,reels,title,description,type,key:canonical(reels)});
  }
  // Special outcomes have priority over all combinations and are independent of reel order.
  const UNIVERSAL = [
    {reels:['blank','blank','blank'],title:'ไม่มีเหตุการณ์พิเศษ',description:'สล็อตว่างทั้งหมด เหตุการณ์ดำเนินไปตามกลไกปกติของโลก ไม่มีโบนัสหรือโทษจากสล็อต',type:'neutral',key:canonical(['blank','blank','blank'])},
    {reels:['skull','skull','skull'],title:'เสียชีวิตทันที',description:'เกิดเหตุการณ์หายนะที่ทำให้ตัวละครเสียชีวิตทันที โดยสาเหตุจริงต้องสอดคล้องกับสถานที่และการต่อสู้',type:'fatal',key:canonical(['skull','skull','skull'])}
  ];
  // Mining: 14 explicitly authored recipes.
  add('mine','mine blank blank','ได้แร่เล็กน้อย','ขุดได้ทรัพยากรปกติจากสายแร่จริง');
  add('mine','mine mine blank','ขุดได้ผลดี','การขุดครั้งนี้มีประสิทธิภาพมากขึ้น');
  add('mine','mine mine mine','ขุดได้มากเป็นพิเศษ','ผลผลิตเพิ่มขึ้นภายใต้ปริมาณสำรองที่เหลือของสายแร่');
  add('mine','stone stone stone','ชั้นหินแข็ง','เจอชั้นหินแข็ง ทำให้งานขุดลำบากขึ้น','danger');
  add('mine','mine gem blank','แร่คุณภาพดี','พบร่องรอยแร่ที่มีคุณภาพดีในแหล่งแร่');
  add('mine','gem gem blank','สายแร่มีค่า','พบแนวแร่มีค่าในบริเวณที่กำลังขุด','discovery');
  add('mine','gem gem gem','สายแร่หายากมาก','ค้นพบสายแร่หายากมาก หากมีอยู่จริงในสถานที่นี้','discovery');
  add('mine','mine tool luck','การขุดราบรื่น','เครื่องมือและจังหวะช่วยให้ขุดได้โดยใช้เวลาน้อยลง');
  add('mine','gem danger mine','แร่มีค่าพร้อมความเสี่ยง','พบแร่มีค่าแต่การขุดทำให้เกิดอุบัติเหตุ','mixed');
  add('mine','stone danger danger','หินถล่ม','ผนังหินไม่มั่นคงหรือเครื่องมือเสียหาย','danger');
  add('mine','hole mine compass','โพรงซ่อนเร้น','ขุดเข้าไปพบโพรงหรือเส้นทางที่มีอยู่จริง','discovery');
  add('mine','hole gem orb','โพรงแร่ผิดธรรมชาติ','พบโพรงแร่ที่มีพลังลึกลับตามสภาพชั้นหอคอย','discovery');
  add('mine','skull skull mine','เฉียดตายจากการขุด','เกิดอุบัติเหตุร้ายแรงและอาจบาดเจ็บหนัก แต่ไม่ใช่ผลตายทันที','danger');
  // Herb gathering: 12 explicitly authored recipes, + universal.
  add('herb','herb blank blank','สมุนไพรเล็กน้อย','เก็บสมุนไพรได้ตามแหล่งที่พบ');
  add('herb','herb herb blank','แหล่งสมุนไพร','พบพืชสมุนไพรหลายต้นในบริเวณเดียวกัน');
  add('herb','herb herb herb','สมุนไพรอุดมสมบูรณ์','เก็บผลผลิตได้มากโดยไม่เกินพืชที่มีอยู่');
  add('herb','mushroom mushroom mushroom','กลุ่มเห็ดหายาก','พบกลุ่มเห็ดที่มีคุณสมบัติพิเศษตามสภาพแวดล้อม','discovery');
  add('herb','herb luck magic','สมุนไพรพลังเวท','พบสมุนไพรที่ได้รับอิทธิพลจากพลังเวท','discovery');
  add('herb','herb poison blank','พืชพิษปะปน','อาจเก็บพืชพิษผิดจากสมุนไพรที่ต้องการ','mixed');
  add('herb','herb herb poison','สมุนไพรปนเปื้อนพิษ','ได้สมุนไพรแต่เสี่ยงสัมผัสพิษ','mixed');
  add('herb','mushroom poison poison','สปอร์พิษ','สปอร์พิษกระจาย ทำให้เกิดอันตรายรุนแรง','danger');
  add('herb','herb eye tracks','ถูกเฝ้ามอง','ขณะเก็บสมุนไพรมีสิ่งมีชีวิตใกล้เคียงเฝ้ามอง','danger');
  add('herb','herb vortex orb','พืชผิดธรรมชาติ','พบพืชซึ่งเปลี่ยนแปลงจากปรากฏการณ์ลึกลับ','discovery');
  add('herb','skull skull herb','ภัยร้ายระหว่างเก็บพืช','เกิดเหตุการณ์รุนแรงที่เกือบเอาชีวิตไม่รอด','danger');
  // Exploration: 14 explicitly authored recipes.
  add('explore','compass blank blank','เบาะแสเส้นทาง','พบข้อมูลเล็กน้อยเกี่ยวกับเส้นทางในพื้นที่','discovery');
  add('explore','tracks tracks blank','ร่องรอยคนเดิน','พบร่องรอยนักเดินทางที่เคยผ่านที่นี่','discovery');
  add('explore','compass compass compass','เส้นทางสำคัญ','พบทางเชื่อมหรือทางลัดที่มีอยู่จริง','discovery');
  add('explore','chest chest chest','แหล่งเก็บของ','พบคลังหรือจุดซ่อนสิ่งของที่ยังไม่ถูกค้น','discovery');
  add('explore','key chest blank','หีบปิดล็อก','พบสิ่งของหรือทางเข้าที่ถูกล็อก','discovery');
  add('explore','key scroll compass','เบาะแสห้องลับ','ได้ข้อมูลเกี่ยวกับทางเข้าพื้นที่ลับ','discovery');
  add('explore','chest luck magic','ของมีค่าตกค้าง','พบสิ่งของมีค่าที่ถูกทิ้งไว้ในบริเวณนี้','discovery');
  add('explore','tracks eye danger','ร่องรอยอันตราย','พบร่องรอยของสิ่งมีชีวิตที่อาจอยู่ใกล้','danger');
  add('explore','ally scroll compass','พบนักสำรวจ','พบบุคคลซึ่งอาจให้ข้อมูลเรื่องเส้นทาง','discovery');
  add('explore','vortex orb magic','ปรากฏการณ์เวท','พบร่องรอยพลังลึกลับในหอคอย','discovery');
  add('explore','chest key danger','หีบมีกับดัก','พบหีบที่มีความเสี่ยงจากกับดัก','mixed');
  add('explore','compass hole danger','ทางลงอันตราย','พบเส้นทางที่ไม่มั่นคงและอาจเกิดอุบัติเหตุ','danger');
  add('explore','eye eye eye','ถูกติดตาม','สิ่งมีชีวิตบางชนิดกำลังติดตาม','danger');
  add('explore','skull skull compass','หลงในแดนอันตราย','หลงเข้าใกล้เขตที่อาจเกิดเหตุการณ์ร้ายแรง','danger');
  // Combat: attacking/positioning — 9 recipes.
  add('combat','sword blank blank','จังหวะโจมตี','เพิ่มโอกาสโจมตีที่ได้เปรียบเล็กน้อย');
  add('combat','sword sword blank','จังหวะรุกต่อเนื่อง','มีโอกาสโจมตีต่อเนื่องตามความสามารถ');
  add('combat','sword sword sword','โอกาสโจมตีรุนแรง','เปิดโอกาสโจมตีอย่างมีประสิทธิภาพ ไม่ใช่ชนะทันที');
  add('combat','target target sword','พบจุดอ่อน','สังเกตช่องว่างของการป้องกันศัตรู');
  add('combat','sword speed speed','จังหวะเร่งรุก','ได้โอกาสเคลื่อนและโจมตีรวดเร็ว');
  add('combat','sword dodge target','มุมโจมตีได้เปรียบ','เคลื่อนตัวเข้ามุมที่มีโอกาสโจมตี');
  add('combat','sword skill target','สกิลเข้าจังหวะ','สกิลที่ตัวละครมีอยู่แล้วอาจทำงานได้ดีขึ้น');
  add('combat','target target target','จุดอ่อนสำคัญ','พบความเปราะบางของท่าทางศัตรู');
  add('combat','sword luck luck','จังหวะโชคดี','ได้รับโอกาสรุกจากเหตุบังเอิญ');
  // Combat: defense/survival — 9 recipes.
  add('combat','shield blank blank','จังหวะตั้งรับ','เพิ่มโอกาสป้องกันเล็กน้อย');
  add('combat','shield shield blank','ป้องกันดีขึ้น','เตรียมรับการโจมตีได้เหมาะสม');
  add('combat','shield shield shield','ป้องกันยอดเยี่ยม','สร้างจังหวะตั้งรับที่ดีเยี่ยม');
  add('combat','dodge dodge dodge','หลบหลีกยอดเยี่ยม','เปลี่ยนตำแหน่งได้คล่องตัวตามสถานการณ์');
  add('combat','shield dodge luck','รอดหวุดหวิด','มีโอกาสหลบพ้นอันตรายอย่างหวุดหวิด');
  add('combat','shield sword dodge','จังหวะสวนกลับ','ตั้งรับและอาจสวนกลับเมื่อศัตรูเปิดช่อง');
  add('combat','ally shield danger','เพื่อนเข้าช่วย','เพื่อนร่วมทีมที่อยู่ในระยะอาจเข้าช่วยป้องกัน','mixed');
  add('combat','luck luck luck','โชคช่วย','เกิดเหตุบังเอิญที่เอื้อต่อการรอดชีวิต');
  add('combat','skull skull shield','รอดอย่างบอบช้ำ','รอดพ้นช่วงวิกฤต แต่เสี่ยงบาดเจ็บหนัก','danger');
  // Combat: mistakes/injuries — 10 recipes.
  add('combat','danger blank blank','ผิดจังหวะ','เกิดความผิดพลาดเล็กน้อย','danger');
  add('combat','danger danger blank','เสียจังหวะ','การเคลื่อนไหวหรือการป้องกันเสียจังหวะ','danger');
  add('combat','stagger danger blank','เสียการทรงตัว','ถูกบีบให้เสียหลัก','danger');
  add('combat','blood blood blank','บาดเจ็บรุนแรง','ได้รับบาดเจ็บรุนแรงขึ้น','danger');
  add('combat','danger danger danger','ความผิดพลาดครั้งใหญ่','เกิดความผิดพลาดร้ายแรงในสนาม','danger');
  add('combat','stagger stagger danger','เสียหลักอย่างหนัก','ล้มเสียหลักจนศัตรูได้เปรียบ','danger');
  add('combat','blood blood blood','บาดแผลสาหัส','เกิดบาดแผลรุนแรง แต่ไม่ได้สั่งให้ตายทันที','danger');
  add('combat','skull danger stagger','จังหวะอันตรายถึงชีวิต','เกิดเหตุผิดพลาดที่อาจทำให้เสียชีวิตจากเหตุการณ์ต่อเนื่อง','danger');
  add('combat','skull skull blank','เฉียดตาย','เกิดสถานการณ์วิกฤตอย่างรุนแรง แต่ผลสล็อตนี้ไม่สั่งตายทันที','danger');

  function getCatalog(scene){
    const meta=SCENARIOS[scene]; if (!meta) throw Error('Unknown scene: '+scene);
    return SYMBOLS[meta.kind];
  }
  function contextFor(scene, overrides={}){return {...CONTEXTS[scene],...overrides};}
  function allowed(scene, id, ctx){
    if (!POOLS[scene].split(' ').includes(id)) return false;
    if (id==='blank') return true;
    if (id==='skull') return !!ctx.lethalPossible;
    if (id==='ally') return !!ctx.allyNearby;
    if (id==='skill') return !!ctx.hasActiveSkill;
    if (id==='gem') return (ctx.oreQuality||0)>=2;
    if (id==='chest'||id==='key') return !!ctx.hiddenCache;
    if (id==='compass' && scene==='mine') return !!ctx.hiddenPassage;
    if (id==='tracks'||id==='eye') return !!ctx.creatureNearby;
    if (id==='orb'||id==='vortex'||id==='magic') return !!ctx.magicPresence;
    if (id==='poison') return !!ctx.poisonPresence;
    if (id==='hole'||id==='danger') return (ctx.hazardLevel||0)>0;
    if (id==='fire' && scene!=='combat') return !!ctx.fireRisk;
    if (id==='fire' && scene==='combat') return !!ctx.elementalFire;
    if (id==='ice') return !!ctx.elementalIce;
    return true;
  }
  function eligible(scene, context={}){
    const catalog=getCatalog(scene), ctx=contextFor(scene,context);
    return POOLS[scene].split(' ').filter(id=>catalog[id] && allowed(scene,id,ctx)).map(id=>catalog[id]);
  }
  function mulberry32(seed){
    let a=seed>>>0;
    return function(){a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};
  }
  function hashSeed(value){let h=2166136261;for(const char of String(value)){h^=char.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
  function rollOne(pool, rng, ctx){
    // Skull is exactly 0.5% per reel when lethal outcomes are possible.
    const deathChance=ctx.lethalPossible ? 0.005 : 0;
    if (deathChance && rng()<deathChance) return 'skull';
    const other=pool.filter(s=>s.id!=='skull');
    const total=other.reduce((s,x)=>s+x.weight,0);
    let n=rng()*total;
    for(const entry of other){n-=entry.weight;if(n<0)return entry.id;}
    return other[other.length-1].id;
  }
  const EVENT_EFFECT = {
    mine:'พบร่องรอยสายแร่',stone:'เจอหินแข็ง',gem:'พบแร่มีค่า',herb:'พบสมุนไพร',mushroom:'พบเห็ด',tool:'เครื่องมือช่วยงาน',chest:'พบที่เก็บสิ่งของ',key:'พบบางสิ่งที่ถูกล็อก',scroll:'พบบันทึก',compass:'ค้นพบข้อมูลเส้นทาง',tracks:'พบร่องรอยผู้ผ่านทาง',luck:'มีจังหวะโชคดี',ally:'พบความช่วยเหลือ',magic:'เกิดอิทธิพลเวทมนตร์',orb:'พบสิ่งลึกลับ',vortex:'เกิดความผิดปกติ',eye:'รู้สึกว่าถูกเฝ้ามอง',danger:'เกิดความเสี่ยงจากสภาพแวดล้อม',poison:'เผชิญความเสี่ยงจากพิษ',hole:'พบหลุมหรือโพรง',fire:'เกิดอันตรายจากไฟ',skull:'เกิดอันตรายร้ายแรง'
  };
  const COMBAT_EFFECT = {
    sword:'มีโอกาสรุก',shield:'มีจังหวะตั้งรับ',dodge:'มีโอกาสหลบ',target:'สังเกตช่องโหว่',skill:'มีจังหวะใช้สกิลที่ครอบครอง',speed:'เคลื่อนตัวเร็วขึ้น',fire:'เกิดปฏิสัมพันธ์กับไฟ',ice:'เกิดปฏิสัมพันธ์กับน้ำแข็ง',luck:'มีโชคช่วย',ally:'เพื่อนเข้าช่วยได้',vortex:'สถานการณ์แปรปรวน',danger:'เกิดข้อผิดพลาด',blood:'เสี่ยงบาดเจ็บ',stagger:'อาจเสียหลัก',skull:'เกิดอันตรายร้ายแรง'
  };
  function autoResolve(scene,reels){
    const kind=SCENARIOS[scene].kind,catalog=getCatalog(scene);
    const meaningful=reels.filter(x=>x!=='blank');
    const categories=meaningful.map(x=>catalog[x].category);
    const risks=categories.filter(x=>['risk','fatal','obstacle'].includes(x)).length;
    const gains=categories.filter(x=>['gain','good','discover','magic','attack','defense'].includes(x)).length;
    const skulls=reels.filter(x=>x==='skull').length;
    const repeated=meaningful.length>=2 && meaningful.every(x=>x===meaningful[0]);
    let title,type;
    if(skulls>=2){title='วิกฤตเฉียดตาย';type='danger';}
    else if(risks&&gains){title='โอกาสพร้อมความเสี่ยง';type='mixed';}
    else if(risks){title='เหตุการณ์ไม่เป็นใจ';type='danger';}
    else if(repeated&&gains){title='จังหวะที่โดดเด่น';type='advantage';}
    else if(gains){title=kind==='combat'?'จังหวะต่อสู้':'โอกาสระหว่างกิจกรรม';type='advantage';}
    else {title='ไม่มีผลสำคัญ';type='neutral';}
    const phrases=meaningful.map(x=>kind==='combat'?COMBAT_EFFECT[x]:EVENT_EFFECT[x]);
    return {title,description:SCENARIOS[scene].intro+' '+phrases.join(' / ')+(skulls>=2?' ตัวละครเผชิญอันตรายขั้นวิกฤต แต่ยังไม่ใช่ผลตายทันที':'')+' ผลสุดท้ายขึ้นอยู่กับสถานะโลกและตัวละคร',type,source:'automatic'};
  }
  function resolve(scene,reels,opts={}){
    if (!Array.isArray(reels)||reels.length!==3)throw Error('Exactly three reel IDs required');
    const catalog=getCatalog(scene);
    if(!reels.every(x=>catalog[x]))throw Error('Reel ID not found in catalog for '+scene);
    const context=contextFor(scene,opts.context||{});
    if(!opts.preview && !reels.every(id=>allowed(scene,id,context))) throw Error('Symbol not eligible in the current world context');
    const key=canonical(reels);
    const globalRecipe=UNIVERSAL.find(r=>r.key===key);
    const found=globalRecipe||RECIPES.find(r=>r.scene===scene&&r.key===key);
    const outcome=found?{title:found.title,description:found.description,type:found.type,source:globalRecipe?'universal':'preset'}:autoResolve(scene,reels);
    const fatal=key===UNIVERSAL[1].key;
    const countBlank=reels.filter(x=>x==='blank').length;
    return {scene,kind:SCENARIOS[scene].kind,reels:reels.slice(),key,...outcome,fatal,blankCount:countBlank,
      // Pure result, NOT mutation. Game integration validates world effects before applying.
      requiresWorldValidation:true};
  }
  function spin(scene, opts={}){
    getCatalog(scene);
    const ctx=contextFor(scene,opts.context||{});
    // v109 (Tower RPG): opts.weights multiplies symbol weights (choices, stats and skills shift the reels)
    const W=opts.weights||{};
    const pool=eligible(scene,ctx).map(x=>W[x.id]===undefined?x:Object.assign({},x,{weight:Math.max(0,x.weight*W[x.id])}));
    const rng=opts.rng || mulberry32(hashSeed(String(opts.worldSeed??'tower-demo')+':'+String(opts.eventId??'event-1')+':'+scene));
    const reels=[rollOne(pool,rng,ctx),rollOne(pool,rng,ctx),rollOne(pool,rng,ctx)];
    return resolve(scene,reels,{context:ctx});
  }
  function listRecipes(scene){return [...UNIVERSAL.map(r=>({...r,scene:'all'})),...RECIPES.filter(r=>!scene||r.scene===scene)].map(r=>({...r,emojis:r.reels.map(id=> (SYMBOLS[r.scene==='all'?'event':SCENARIOS[r.scene].kind][id]||{}).emoji||'□').join(' ')}));}
  function audit(){
    const uniq=new Set();const duplicates=[];
    for(const r of RECIPES){const key=r.scene+':'+r.key;if(uniq.has(key))duplicates.push(key);uniq.add(key);}
    return {eventSymbolCount:Object.keys(SYMBOLS.event).length,combatSymbolCount:Object.keys(SYMBOLS.combat).length,exclusivePresets:RECIPES.length,universalPresets:UNIVERSAL.length,duplicates,scenes:Object.keys(SCENARIOS)};
  }
  return Object.freeze({version:'1.0.0',SYMBOLS,SCENARIOS,POOLS,CONTEXTS,RECIPES,UNIVERSAL,contextFor,eligible,resolve,spin,listRecipes,audit,mulberry32,hashSeed});
});
