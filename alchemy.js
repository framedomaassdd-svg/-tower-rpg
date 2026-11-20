/* Tower RPG v120: medicinal herbs, tiered liquids/tablets, deterministic alchemy,
   four-severity conditions and mentor trials. No character level is created. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.Alchemy=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const CONDITIONS=Object.freeze({
 bleeding:{name:'เลือดออก',icon:'🩸',agility:.03,damage:2},poison:{name:'ติดพิษ',icon:'☠️',agility:.04,damage:2},
 hungry:{name:'หิว',icon:'🍖',agility:.02},thirst:{name:'ขาดน้ำ',icon:'💧',agility:.05},
 sleepy:{name:'ง่วง',icon:'💤',agility:.04},sleepDebt:{name:'อดนอน',icon:'🌙',agility:.05},
 fatigue:{name:'เหนื่อย',icon:'😮‍💨',agility:.06},dizzy:{name:'มึนงง',icon:'💫',agility:.08},
 nausea:{name:'คลื่นไส้',icon:'🤢',agility:.02},fever:{name:'มีไข้',icon:'🤒',agility:.03},
 infection:{name:'ติดเชื้อ',icon:'🦠',agility:.03,damage:1},burn:{name:'แผลไฟลวก',icon:'🔥',agility:.03,damage:1},
 cold:{name:'หนาวจัด',icon:'❄️',agility:.07},injury:{name:'บาดเจ็บกล้ามเนื้อ',icon:'🦴',agility:.07},
 fear:{name:'หวาดกลัว',icon:'😨',agility:.05},hallucination:{name:'ประสาทหลอน',icon:'👁️',agility:.04},
 curse:{name:'ต้องคำสาป',icon:'🔮',agility:.04},numb:{name:'ชา / อัมพาต',icon:'⚡',agility:.10}
});
const HERBS=Object.freeze({
 root_food:{tier:1,name:'รากอิ่มท้อง',biomes:['grass','forest','desert']},
 clear_leaf:{tier:1,name:'ใบใสสติ',biomes:['grass','forest','ruins']},
 bind_grass:{tier:1,name:'หญ้าสมาน',biomes:['grass','forest','swamp']},
 wake_leaf:{tier:1,name:'ใบปลุกตื่น',biomes:['grass','forest','ruins']},
 moist_moss:{tier:1,name:'ตะไคร่น้ำชุ่ม',biomes:['forest','swamp','ice']},
 antidote_root:{tier:2,name:'รากถอนพิษ',biomes:['swamp','forest','undead']},
 warm_blossom:{tier:2,name:'ดอกอุ่นกาย',biomes:['volcano','desert','grass']},
 fever_mushroom:{tier:2,name:'เห็ดลดไข้',biomes:['forest','swamp','undead']},
 antiseptic_bark:{tier:3,name:'เปลือกยับยั้งเชื้อ',biomes:['forest','ruins','swamp']},
 blood_flower:{tier:3,name:'ดอกโลหิต',biomes:['undead','forest','grass']},
 vigor_seed:{tier:3,name:'เมล็ดฟื้นแรง',biomes:['desert','volcano','grass']},
 silver_moss:{tier:3,name:'มอสเงิน',biomes:['crystal','ice','rift']},
 shadow_petal:{tier:4,name:'กลีบสะกดเงา',biomes:['undead','ruins','rift']},
 verdant_heart:{tier:5,name:'หัวใจพฤกษา',biomes:['forest','crystal','rift']}
});
// kind is liquid or tablet; individual medicines specify exactly which conditions and how much.
const RECIPES=Object.freeze({
 travel_tablet:{tier:1,form:'tablet',time:30,needs:{root_food:2,clear_leaf:1,tablet_binder:1},remove:{hungry:1,dizzy:1}},
 wound_liquid:{tier:1,form:'liquid',time:20,needs:{bind_grass:2,clean_water:1},remove:{bleeding:1}},
 waking_tea:{tier:1,form:'liquid',time:25,needs:{wake_leaf:2,clean_water:1},remove:{sleepy:1,sleepDebt:1}},
 hydration_liquid:{tier:1,form:'liquid',time:25,needs:{moist_moss:2,clean_water:1},remove:{thirst:1,dizzy:1}},
 antidote_tablet:{tier:2,form:'tablet',time:60,needs:{antidote_root:2,clear_leaf:1,tablet_binder:1},remove:{poison:2,dizzy:1}},
 warmth_liquid:{tier:2,form:'liquid',time:50,needs:{warm_blossom:2,clean_water:1},remove:{cold:2,fatigue:1}},
 fever_tablet:{tier:2,form:'tablet',time:65,needs:{fever_mushroom:2,tablet_binder:1},remove:{fever:2,nausea:1}},
 deep_wound_liquid:{tier:3,form:'liquid',time:120,needs:{blood_flower:2,antiseptic_bark:2,clean_water:1},remove:{bleeding:2,infection:2,injury:1}},
 vigor_tablet:{tier:3,form:'tablet',time:100,needs:{vigor_seed:2,wake_leaf:1,tablet_binder:1},remove:{fatigue:3,sleepDebt:2}},
 purify_liquid:{tier:3,form:'liquid',time:150,needs:{silver_moss:2,antidote_root:2,clean_water:1},remove:{poison:3,numb:2}},
 curse_liquid:{tier:4,form:'liquid',time:240,needs:{shadow_petal:2,silver_moss:2,clean_water:1},remove:{curse:3,hallucination:2,fear:2}},
 verdant_liquid:{tier:5,form:'liquid',time:360,needs:{verdant_heart:1,silver_moss:3,antiseptic_bark:2,soul_crystal:2,clean_water:1},remove:{poison:4,infection:3,burn:2},protect:'poison'},
 might_tonic:{tier:2,form:'liquid',time:70,needs:{vigor_seed:1,root_food:1,clean_water:1},remove:{fatigue:1},buff:{strength:10},hours:5},
 mind_draught:{tier:2,form:'liquid',time:75,needs:{clear_leaf:2,fever_mushroom:1,clean_water:1},remove:{dizzy:1},buff:{intelligence:10},hours:5},
 swift_tablet:{tier:3,form:'tablet',time:115,needs:{wake_leaf:2,fever_mushroom:2,tablet_binder:1},remove:{fatigue:1},buff:{agility:12},hours:8},
 ember_guard_liquid:{tier:3,form:'liquid',time:140,needs:{warm_blossom:2,ember_ore:1,clean_water:1},remove:{burn:1},buff:{resist:'burn',potency:.55},hours:8},
 venom_guard_tablet:{tier:3,form:'tablet',time:125,needs:{antidote_root:2,venom_ore:1,tablet_binder:1},remove:{poison:1},buff:{resist:'poison',potency:.55},hours:8},
 aether_elixir:{tier:5,form:'liquid',time:400,needs:{verdant_heart:1,shadow_petal:2,star_ore:1,soul_crystal:3,clean_water:1},remove:{curse:1},buff:{magicPower:18},hours:10}
});
const BASE_CHANCE=Object.freeze([.82,.68,.54,.38,.22]);
const STEPS=Object.freeze({liquid:['ล้างและคัดสมุนไพร','บดและต้มสกัด','กรองตะกอน','เคี่ยวตามเวลา','บรรจุขวด'],tablet:['ล้างและอบวัตถุดิบ','บดให้เป็นผงละเอียด','ผสมสารประสาน','อัดเป็นเม็ด','อบให้แห้ง']});
const PROMOTIONS=Object.freeze([
 {to:2,xp:65,success:8,variety:2,gather:1,practice:3,treat:2,minFloor:1,name:'ใบรับรองช่างปรุงยา'},
 {to:3,xp:180,success:25,variety:4,gather:2,practice:5,treat:3,minFloor:6,name:'ศาสตร์ถอนพิษ'},
 {to:4,xp:480,success:60,variety:7,gather:3,practice:7,treat:4,minFloor:16,name:'ตำรับของผู้รักษาที่สูญหาย'},
 {to:5,xp:1200,success:130,variety:10,gather:4,practice:10,treat:6,minFloor:31,name:'บททดสอบปรมาจารย์พฤกษา'}
]);
function bag(){return (typeof globalThis!=='undefined'&&globalThis.Bag)||(typeof require==='function'?require('./bag.js'):null);}
function skills(){return (typeof globalThis!=='undefined'&&globalThis.Skills)||(typeof require==='function'?require('./skills.js'):null);}
function exp(){return (typeof globalThis!=='undefined'&&globalThis.Expedition)||(typeof require==='function'?require('./expedition.js'):null);}
function hash(...parts){let h=2166136261;for(const c of parts.join(':')){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0)/4294967296;}
function worldSeed(st){const e=exp();return e&&e.seed?e.seed(st):[st.life&&st.life.origin,st.life&&st.life.age].join(':');}
function data(st){
 if(!st.conditions||typeof st.conditions!=='object'||Array.isArray(st.conditions))st.conditions={};
 for(const key of Object.keys(st.conditions)){
   if(!CONDITIONS[key])delete st.conditions[key];else{const n=clamp(Math.floor(+st.conditions[key]||0),0,4);if(!n)delete st.conditions[key];else st.conditions[key]=n;}
 }
 if(!st.alchemy||typeof st.alchemy!=='object'||Array.isArray(st.alchemy))st.alchemy={};
 const a=st.alchemy;
 for(const k of ['xp','attempts','successes','treated','gatherMax','count'])if(!Number.isFinite(a[k])||a[k]<0)a[k]=0;
 if(!Number.isInteger(a.tier)||a.tier<1||a.tier>5)a.tier=1;
 if(!a.recipes||typeof a.recipes!=='object')a.recipes={};
 if(!a.promotion||typeof a.promotion!=='object')a.promotion=null;
 if(!Array.isArray(a.pending))a.pending=[];
 if(!Array.isArray(a.history))a.history=[];
 if(!a.protect||typeof a.protect!=='object')a.protect={};
 a.version=120;return a;
}
function level(st,key){data(st);return st.conditions[key]||0;}
function factor(st){data(st);let penalty=0;for(const [k,n] of Object.entries(st.conditions))penalty+=(CONDITIONS[k]?.agility||0)*n;return clamp(1-penalty,.15,1);}
function addStatus(st,key,amount=1){if(!CONDITIONS[key])return 0;const a=data(st),before=level(st,key);if(amount>0&&a.protect[key]&&a.protect[key].until>=st.day)return before;
 const Ar=(typeof globalThis!=='undefined'&&globalThis.Artisan)||(typeof require==='function'?require('./artisan.js'):null);
 const resistance=amount>0&&Ar?Ar.resistance(st,key):0;
 // Resistances reduce incoming severity deterministically at the status layer, not reward drop rates.
 if(resistance>0)amount=Math.max(0,amount-Math.max(1,Math.floor(amount*resistance)));
 const after=clamp(before+amount,0,4);if(after)st.conditions[key]=after;else delete st.conditions[key];if(before!==after&&skills()?.recalc)skills().recalc(st);return after;}
function treat(st,removals){const a=data(st),result={};for(const [key,n] of Object.entries(removals||{})){
 if(!CONDITIONS[key])continue;const before=level(st,key);const after=clamp(before-Math.max(0,Math.floor(n)),0,4);if(after)st.conditions[key]=after;else delete st.conditions[key];if(before!==after){result[key]=before-after;a.treated+=before-after;}
 }if(Object.keys(result).length&&skills()?.recalc)skills().recalc(st);return result;}
function labels(st){data(st);return Object.entries(st.conditions).map(([id,level])=>({id,level,...CONDITIONS[id]}));}
function chance(st,id,station='basic'){
 const r=RECIPES[id],a=data(st),B=bag();if(!r)return 0;
 const quality=Object.keys(r.needs).filter(id=>HERBS[id]).map(id=>HERBS[id].tier);
 const avg=quality.length?quality.reduce((x,y)=>x+y,0)/quality.length:1;
 const qualityBonus=clamp(Math.round((avg-r.tier+1)*.02*100)/100,0,.08);
 const stationBonus=station==='apothecary'?.06:station==='master'?.10:0;
 const illness=Math.min(.2,level(st,'fatigue')*.025+level(st,'dizzy')*.025);
 const intelligence=clamp(((st.intelligence||15)-15)*.0006,0,.05);
 return clamp(Math.min(.95,BASE_CHANCE[r.tier-1]+.06*(a.tier-1)+qualityBonus+stationBonus+intelligence)-illness,.05,.95);
}
function craft(st,id,station='apothecary',score=null){
 const r=RECIPES[id],B=bag(),a=data(st);if(!r)return {ok:false,why:'ไม่รู้จักตำรับยา'};
 if(a.tier<r.tier)return {ok:false,why:'ต้องผ่านเควสเลื่อนขั้นปรุงยา Tier '+r.tier};
 if(st.life&&st.life.dead)return {ok:false,why:'ตัวละครเสียชีวิตแล้ว'};
 if(st.life?.exp&&!st.life.exp.over&&st.day>=st.life.exp.start)return {ok:false,why:'ต้องกลับเมืองก่อนจึงปรุงยาที่ร้านหมอยาได้'};
 if(!B?.has(st,r.needs))return {ok:false,why:'วัตถุดิบไม่ครบ'};
 if(!B.canFit(st,id)&&!Object.entries(r.needs).some(([k,n])=>B.count(st,k)===n&&B.slotRows(st).some(s=>s.id===k)))return {ok:false,why:'กระเป๋าเต็ม 20 ช่อง'};
 const CM=(typeof globalThis!=='undefined'&&globalThis.CraftGame)||(typeof require==='function'?require('./craft-game.js'):null);
 const mod=score&&CM?CM.modifiers(score.stars,score.skipped):null;
 const p=clamp(chance(st,id,station)+(mod?.chance||0),.05,.95),attempt=a.attempts++; // consume once, fixed by save seed/counter
 for(const [key,n] of Object.entries(r.needs))B.take(st,key,n);
 st.energy=Math.max(0,(st.energy||0)-Math.max(3,Math.ceil(r.time/30)));
 const success=hash(worldSeed(st),'alchemy',id,attempt)<p;
 a.xp+=success?4*r.tier:Math.max(1,r.tier);a.count++;
 if(success){a.successes++;a.recipes[id]=(a.recipes[id]||0)+1;const count=B.add(st,id,1,st.day,mod?.duration===1.25&&r.buff?1:(mod?.quality||0));
  if(!count)return {ok:true,success:false,chance:p,why:'ปรุงสำเร็จแต่ช่องกระเป๋าเต็ม ยาตกหายที่โต๊ะปรุง'};
  return {ok:true,success:true,chance:p,quality:mod?.quality||0,why:'ปรุง'+B.name(id)+' สำเร็จ ('+Math.round(p*100)+'%) · ความชำนาญ +'+4*r.tier};
 }
 const r2=hash(worldSeed(st),'alchemy-failure',id,attempt);
 const brokenChance=CM?.catastrophicRate?.(r.tier,mod?.stars??4,mod?.skipped)||.25;
 const failure=r2<brokenChance?'destroyed':(r2-brokenChance)/(1-brokenChance)<.70?'diluted':'tainted';
 if(failure==='destroyed')return {ok:true,success:false,chance:p,failure,catastrophic:true,breakChance:brokenChance,why:'💥 ปรุงยาพังทั้งชุด! วัตถุดิบทั้งหมดเสียไป ไม่ได้รับยา'};
 if(!B.add(st,failure==='diluted'?'failed_weak_medicine':'failed_tainted_medicine',1,st.day))return {ok:true,success:false,chance:p,failure:'destroyed',catastrophic:true,breakChance:brokenChance,why:'ปรุงยาพลาดและไม่มีช่องเก็บของที่เสีย ยาทั้งชุดสูญหาย'};
 return {ok:true,success:false,chance:p,failure,catastrophic:false,breakChance:brokenChance,why:failure==='diluted'?'ปรุงพลาด ได้ยาคุณภาพต่ำแทนตำรับที่ตั้งใจ':'ปรุงพลาด ได้ยาปนเปื้อน ต้องระวัง'};
}
function use(st,id,clock=0){const B=bag(),a=data(st),r=RECIPES[id];
 if(!r&&id!=='failed_weak_medicine'&&id!=='failed_tainted_medicine'&&id!=='clean_water')return {ok:false,why:'ไม่ใช่ยาที่ใช้ได้'};
 if(!B?.count(st,id))return {ok:false,why:'ไม่มีของในกระเป๋า'};
 if(st.life?.dead)return {ok:false,why:'ตัวละครเสียชีวิตแล้ว'};
 const quality=(st.bag||[]).filter(x=>x.id===id).sort((a,b)=>(a.quality||0)-(b.quality||0))[0]?.quality||0;
 if(!B.take(st,id,1))return {ok:false,why:'ไม่สามารถใช้ไอเทมนี้'};
 if(id==='clean_water'){a.drinkDay=st.day;const changed=treat(st,{thirst:1});return {ok:true,why:'ดื่มน้ำสะอาด'+(changed.thirst?' · ขาดน้ำ −1':'')};}
 if(id==='failed_tainted_medicine'){addStatus(st,'nausea',1);return {ok:true,why:'ยาปนเปื้อนทำให้คลื่นไส้ +1'};}
 if(id==='failed_weak_medicine'){treat(st,{fatigue:1});return {ok:true,why:'ยาคุณภาพต่ำ ลดเหนื่อยได้เล็กน้อย'};}
 if(r.form==='tablet'){
  let day=st.day,when=clock+.25;if(when>=20){day++;when-=20;}
  a.pending.push({id,day,clock:when,quality});return {ok:true,pending:true,why:'กิน'+B.name(id)+' · ยาเม็ดจะออกฤทธิ์ในประมาณ 20 นาทีของเวลาเกม'};
 }
 return applyMedicine(st,id,quality);
}
function applyMedicine(st,id,quality=0){const a=data(st),r=RECIPES[id];if(!r)return {ok:false,why:'ไม่มีสูตรยา'};
 const changes=Object.fromEntries(Object.entries(r.remove||{}).map(([k,n])=>[k,Math.max(1,n+Math.min(0,quality))]));const changed=treat(st,changes);if(r.protect)a.protect[r.protect]={until:(st.day||1)+1};
 if(r.buff){const Ar=(typeof globalThis!=='undefined'&&globalThis.Artisan)||(typeof require==='function'?require('./artisan.js'):null);if(Ar)Ar.applyBuff(st,id,r.buff,Math.max(1,(r.hours||6)*(quality<0?.75:quality>0?1.25:1)),'medicine');}
 const display=Object.entries(r.remove).map(([k,n])=>CONDITIONS[k].name+' −'+n).join(' · ');
 return {ok:true,changed,why:'ใช้'+bag().name(id)+' · '+display+(r.protect?' · ป้องกันพิษชั่วคราว':'')+(r.buff?' · รับบัฟ '+r.hours+' ชั่วโมงเกม':'')};
}
function flush(st,clock=0){const a=data(st),out=[],pending=[];
 for(const q of a.pending){if(st.day>q.day||st.day===q.day&&clock>=q.clock)out.push(applyMedicine(st,q.id,q.quality||0).why);else pending.push(q);}
 a.pending=pending;return out;
}
function daily(st,ctx={}){const a=data(st);if(a.lastDay===st.day)return [];
 a.lastDay=st.day;const out=[];
 function change(k,n){const old=level(st,k),newLvl=addStatus(st,k,n);if(newLvl!==old)out.push(CONDITIONS[k].name+' '+(n>0?'+':'')+(newLvl-old));}
 change('hungry',ctx.fed?-1:1);
 if(ctx.inTower){if(ctx.drank)change('thirst',-1);else change('thirst',1);}else change('thirst',-2);
 const rested=ctx.rested!==false;
 change('sleepy',rested?-2:1);change('sleepDebt',rested?-1:1);
 change('fatigue',(st.energy||0)<25?1:rested?-1:0);
 for(const k of ['bleeding','poison','infection','burn']){const n=level(st,k),d=CONDITIONS[k].damage||0;
  if(n){const amount=n*d;st.health=Math.max(0,(Number.isFinite(st.health)?st.health:100)-amount);out.push(CONDITIONS[k].name+' ทำให้สุขภาพ −'+amount);
   if(st.health<=0&&st.life&&!st.life.dead){st.life.dead={day:st.day,cause:CONDITIONS[k].name+'รุนแรง'};if(st.life.exp)st.life.exp.over=true;out.push('เสียชีวิตจาก'+CONDITIONS[k].name);} }
 }
 return out;
}
function forage(st,floor,eventId,count=1){const B=bag(),a=data(st);if(!B||!count)return null;
 const e=exp(),theme=e?.themeFor?.(st,floor)?.id||'grass';const tierCap=clamp(1+Math.floor((floor-1)/10),1,5);
 // Restrict rare herb growth sharply; match the biome first, fall back to viable plants.
 const r=hash(worldSeed(st),'herb-tier',eventId),wanted=r<.73?1:r<.91?Math.min(2,tierCap):r<.982?Math.min(3,tierCap):r<.997?Math.min(4,tierCap):tierCap;
 const pool=Object.entries(HERBS).filter(([id,v])=>v.tier===wanted);
 if(!pool.length)return null;
 const matching=pool.filter(([id,v])=>v.biomes.includes(theme));const valid=matching.length?matching:pool;
 const picked=valid[Math.floor(hash(worldSeed(st),'herb-choice',eventId)*valid.length)][0];
 a.gatherMax=Math.max(a.gatherMax,HERBS[picked].tier);
 const origin={from:'herb',floor,day:st.day};
 if(!B.auto(st)){B.queueLoot(st,picked,1,null,origin,eventId);return {id:picked,queued:true};}
 return {id:picked,n:B.add(st,picked,1,st.day)};
}
function forageField(st){const B=bag(),a=data(st),ids=Object.keys(HERBS).filter(id=>HERBS[id].tier===1);
 const id=ids[Math.floor(hash(worldSeed(st),'field-herb',st.day)*ids.length)];
 a.gatherMax=Math.max(a.gatherMax,1);
 const n=B.add(st,id,1,st.day);return n?{id,n}:null;
}
function patient(st){const a=data(st);if(!a.patients||typeof a.patients!=='object')a.patients={};
 if(!a.patients[st.day]){
   const ids=['hungry','dizzy','bleeding','sleepy','fatigue','thirst','poison','fever'];
   const index=Math.floor(hash(worldSeed(st),'patient-condition',st.day)*ids.length);
   a.patients[st.day]={id:ids[index],level:1+Math.floor(hash(worldSeed(st),'patient-severity',st.day)*3),treated:false};
 }
 return a.patients[st.day];
}
function treatPatient(st,id){const a=data(st),B=bag(),p=patient(st),r=RECIPES[id];
 if(!r||!B?.count(st,id))return {ok:false,why:'ไม่มีชนิดยานี้'};
 if(p.treated)return {ok:false,why:'รักษาผู้ป่วยวันนี้แล้ว'};
 const relief=(r.remove||{})[p.id]||0;
 if(!relief)return {ok:false,why:'ยานี้ไม่ตรงกับอาการของผู้ป่วย '+CONDITIONS[p.id].name};
 B.take(st,id,1);const reduced=Math.min(p.level,relief);p.level-=reduced;a.treated+=reduced;
 if(p.level<=0)p.treated=true;
 st.rep=(st.rep||0)+1;st.money=(st.money||0)+Math.min(8,reduced*2);
 return {ok:true,why:'รักษาผู้ป่วย: '+CONDITIONS[p.id].name+' −'+reduced+' ระดับ'+(p.treated?' · ผู้ป่วยหายแล้ว':' · ยังต้องรักษาเพิ่ม')};
}
function mentorStatus(st){const a=data(st),spec=PROMOTIONS[a.tier-1];if(!spec)return {status:'max'};
 const p=a.promotion;if(!p||p.to!==spec.to)return {status:a.xp>=spec.xp&&a.successes>=spec.success&&Object.keys(a.recipes).length>=spec.variety?'available':'training',spec};
 const ok=p.stage===0?a.gatherMax>=spec.gather:p.stage===1?a.successes-p.startSuccess>=spec.practice:a.treated-p.startTreated>=spec.treat;
 return {status:ok?'ready':'active',spec,stage:p.stage,ok};
}
function meetMentor(st){const a=data(st),q=mentorStatus(st),spec=q.spec;if(!spec)return {ok:false,why:'ชำนาญถึงระดับสูงสุดแล้ว'};
 if(q.status==='training')return {ok:false,why:'ต้องฝึกปรุงยาจน XP ≥'+spec.xp+' สำเร็จ '+spec.success+' ครั้ง และรู้ '+spec.variety+' ตำรับก่อน'};
 if(q.status==='available') {a.promotion={to:spec.to,stage:0,startSuccess:a.successes,startTreated:a.treated};return {ok:true,why:'หมอยามอบเควส '+spec.name+' บทที่ 1/3: ค้นพบสมุนไพร Tier '+spec.gather+' ขึ้นไป'};}
 if(q.status==='active')return {ok:false,why:q.stage===0?'ต้องค้นพบสมุนไพรตามเงื่อนไข':q.stage===1?'ต้องฝึกปรุงยาสำเร็จอีก '+spec.practice+' ครั้ง':'ต้องใช้ยารักษาสถานะรวม '+spec.treat+' ระดับ'};
 if(q.stage===0){a.promotion.stage=1;a.promotion.startSuccess=a.successes;return {ok:true,why:'ผ่านบทที่ 1! บท 2/3: ปรุงยาสำเร็จอีก '+spec.practice+' ครั้ง'};}
 if(q.stage===1){a.promotion.stage=2;a.promotion.startTreated=a.treated;return {ok:true,why:'ผ่านบทที่ 2! บท 3/3: ใช้ยารักษาสถานะรวม '+spec.treat+' ระดับ'};}
 a.tier++;a.promotion=null;return {ok:true,promoted:true,why:'สำเร็จเควส '+spec.name+'! เลื่อนเป็นนักปรุงยา Tier '+a.tier+' · ปลดล็อกสูตรยาใหม่'};
}
return {CONDITIONS,HERBS,RECIPES,STEPS,BASE_CHANCE,PROMOTIONS,data,level,factor,addStatus,treat,labels,chance,craft,use,flush,daily,forage,forageField,patient,treatPatient,mentorStatus,meetMentor,hash};
});
