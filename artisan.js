/* Tower RPG v121 — ores, teachable smithcraft, deterministic crafted affixes,
   temporary food/potion buffs. Separate from the frozen slot engine. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.Artisan=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const MINERALS=Object.freeze({
 copper_ore:{name:'แร่ทองแดง',tier:1,biomes:['grass','desert','ruins'],stat:'strength',affix:'bleedStrike'},
 tin_ore:{name:'แร่ดีบุก',tier:1,biomes:['grass','forest','swamp'],stat:'agility',affix:'bleedStrike'},
 iron_ore:{name:'แร่เหล็กบริสุทธิ์',tier:1,biomes:['grass','forest','ruins','desert'],stat:'strength',affix:'bleedStrike'},
 silver_ore:{name:'แร่เงินจันทรา',tier:2,biomes:['forest','undead','ice','ruins'],stat:'intelligence',affix:'curseWard'},
 ember_ore:{name:'แร่ถ่านเพลิง',tier:2,biomes:['volcano','desert','rift'],stat:'strength',affix:'fireWard'},
 blood_ore:{name:'แร่โลหิต',tier:2,biomes:['undead','swamp','volcano'],stat:'strength',affix:'bleedStrike'},
 frost_ore:{name:'แร่เยือกแข็ง',tier:3,biomes:['ice','crystal','rift'],stat:'agility',affix:'frostEdge'},
 venom_ore:{name:'แร่พิษมรกต',tier:3,biomes:['swamp','forest','undead'],stat:'intelligence',affix:'poisonWard'},
 mind_ore:{name:'แร่จิตสำนึก',tier:3,biomes:['ruins','crystal','rift'],stat:'intelligence',affix:'focus'},
 star_ore:{name:'แร่ดารา',tier:4,biomes:['crystal','rift','ice'],stat:'magicPower',affix:'frostEdge'},
 aegis_ore:{name:'แร่ผู้พิทักษ์',tier:4,biomes:['ruins','volcano','undead'],stat:'strength',affix:'fireWard'},
 void_ore:{name:'แร่ห้วงว่าง',tier:5,biomes:['rift','undead','crystal'],stat:'magicPower',affix:'curseWard'}
});
const AFFIX=Object.freeze({
 bleedStrike:{name:'คมเลือดไหล',icon:'🩸',type:'weapon',description:'มีโอกาสทำให้คู่ต่อสู้เสียเลือด'},
 fireWard:{name:'เกราะกันไฟ',icon:'🔥',type:'armor',description:'ลดอันตรายจากไฟและแผลไฟลวก'},
 poisonWard:{name:'เกราะกันพิษ',icon:'🛡️',type:'armor',description:'ลดการสะสมพิษ'},
 curseWard:{name:'ต้านคำสาป',icon:'🔮',type:'armor',description:'ลดผลของคำสาป'},
 frostEdge:{name:'คมเยือกแข็ง',icon:'❄️',type:'weapon',description:'มีโอกาสลดจังหวะรุกของศัตรู'},
 focus:{name:'สมาธิแห่งช่าง',icon:'✨',type:'either',description:'พลังเวทเพิ่มประสิทธิภาพการต่อสู้'}
});
// Requirements use named ore items, so materials (and their tier) actually determine affix probability.
const FORGE_RECIPES=Object.freeze({
 copper_knife:{name:'มีดทองแดง',tier:1,template:'dagger',needs:{copper_ore:3,scrap:1}},
 iron_sword:{name:'ดาบเหล็กบริสุทธิ์',tier:1,template:'sword',needs:{iron_ore:4,iron:1}},
 silver_chain:{name:'เสื้อเกราะเงิน',tier:2,template:'chain_vest',needs:{silver_ore:3,iron:2,soul_crystal:1}},
 blood_sword:{name:'ดาบโลหิต',tier:2,template:'sword',needs:{blood_ore:4,iron:2,soul_crystal:1}},
 ember_armor:{name:'เกราะถ่านเพลิง',tier:2,template:'chain_vest',needs:{ember_ore:4,iron:2,soul_crystal:1}},
 frost_sword:{name:'ดาบน้ำแข็ง',tier:3,template:'sword',needs:{frost_ore:4,silver_ore:2,soul_crystal:2}},
 venom_armor:{name:'เกราะพิษมรกต',tier:3,template:'chain_vest',needs:{venom_ore:4,iron:2,soul_crystal:2}},
 mind_sword:{name:'ดาบสมาธิ',tier:3,template:'sword',needs:{mind_ore:3,silver_ore:2,soul_crystal:2}},
 star_sword:{name:'ดาบดารา',tier:4,template:'sword',needs:{star_ore:4,frost_ore:2,soul_crystal:4}},
 aegis_armor:{name:'เกราะผู้พิทักษ์เพลิง',tier:4,template:'guardianVest',needs:{aegis_ore:4,ember_ore:2,soul_crystal:4}},
 void_armor:{name:'เกราะห้วงว่าง',tier:5,template:'guardianVest',needs:{void_ore:4,mind_ore:3,soul_crystal:6}}
});
const SPECIAL_FOOD=Object.freeze({
 meal_guardian:{name:'ซุปพลังนักขุด',tier:1,needs:{rice:2,veg:1,root_food:1},buff:{strength:4},hours:6,makes:2},
 meal_ranger:{name:'สตูว์ตาพราน',tier:2,needs:{rice:2,meat:1,wake_leaf:2},buff:{agility:6},hours:8,makes:2},
 meal_sage:{name:'ข้าวสมาธิ',tier:3,needs:{rice:2,fever_mushroom:2,silver_moss:1},buff:{intelligence:9},hours:8,makes:2},
 meal_ember:{name:'อาหารต้านเพลิง',tier:3,needs:{meat:2,warm_blossom:2,ember_ore:1},resist:'burn',hours:10,makes:2},
 meal_moon:{name:'สำรับแห่งจันทรา',tier:4,needs:{fish:2,shadow_petal:1,silver_moss:2},buff:{magicPower:12},hours:12,makes:2}
});
const PROMOTIONS=Object.freeze([
 {to:2,xp:60,success:6,variety:2,mine:1,practice:3,name:'ใบรับรองช่างหลอม'},
 {to:3,xp:180,success:20,variety:4,mine:2,practice:5,name:'ช่างตีเหล็กชำนาญ'},
 {to:4,xp:440,success:48,variety:6,mine:3,practice:7,name:'โลหะเวทแห่งหอคอย'},
 {to:5,xp:1000,success:105,variety:9,mine:4,practice:10,name:'บททดสอบปรมาจารย์ตีเหล็ก'}
]);
function B(){return (typeof globalThis!=='undefined'&&globalThis.Bag)||(typeof require==='function'?require('./bag.js'):null);}
function S(){return (typeof globalThis!=='undefined'&&globalThis.Skills)||(typeof require==='function'?require('./skills.js'):null);}
function E(){return (typeof globalThis!=='undefined'&&globalThis.Expedition)||(typeof require==='function'?require('./expedition.js'):null);}
function hash(...parts){let h=2166136261;for(const c of parts.join(':')){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0)/4294967296;}
function seed(st){return E()?.seed?.(st)||String(st.life?.origin||'')+':'+String(st.life?.age||'');}
function data(st){
 if(!st.artisan||typeof st.artisan!=='object'||Array.isArray(st.artisan))st.artisan={};const a=st.artisan;
 for(const k of ['xp','attempts','successes','mineTier'])if(!Number.isFinite(a[k])||a[k]<0)a[k]=0;
 a.tier=clamp(Math.floor(a.tier||1),1,5);
 if(!a.recipes||typeof a.recipes!=='object')a.recipes={};
 if(!a.mined||typeof a.mined!=='object')a.mined={};
 if(!a.promotion||typeof a.promotion!=='object')a.promotion=null;
 if(!Array.isArray(st.buffs))st.buffs=[];
 a.version=121;return a;
}
const now=st=>(Math.max(1,st.day||1)-1)*20+clamp(Number(st.townClock)||0,0,20);
function buffs(st){data(st);const t=now(st);return st.buffs.filter(x=>x&&x.until>t&&x.effect);}
function expire(st){data(st);const old=st.buffs.length;st.buffs=buffs(st);if(old!==st.buffs.length)S()?.recalc(st);return old-st.buffs.length;}
function applyBuff(st,key,effect,hours=6,category='meal'){
 data(st);const id=String(category)+':'+key;
 st.buffs=st.buffs.filter(x=>x.id!==id&&x.until>now(st));
 st.buffs.push({id,source:key,effect:{...effect},until:now(st)+hours});S()?.recalc(st);
 return {until:now(st)+hours,effect};
}
function bonus(st){const out={strength:0,agility:0,intelligence:0,magicPower:0};for(const x of buffs(st))for(const k of Object.keys(out))out[k]+=x.effect[k]||0;return out;}
function resistance(st,key){let p=0;for(const x of buffs(st))if(x.effect.resist===key)p=Math.max(p,x.effect.potency||0);
 const armor=st.gear&&st.equip&&st.gear[st.equip.armor];const sp=armor&&armor.special;if(sp&&({burn:'fireWard',poison:'poisonWard',curse:'curseWard'})[key]===sp.id)p=Math.max(p,sp.potency||0);
 return clamp(p,0,.85);
}
function consumeFood(st,id){const r=SPECIAL_FOOD[id],bag=B();if(!r||!bag?.count(st,id))return {ok:false,why:'ไม่มีอาหารพิเศษ'};
 if(!bag.take(st,id,1))return {ok:false,why:'ใช้ไม่ได้'};
 const effect={...r.buff,...(r.resist?{resist:r.resist,potency:.35}:{})};applyBuff(st,id,effect,r.hours,'food');
 const a=(typeof globalThis!=='undefined'&&globalThis.Alchemy)||(typeof require==='function'?require('./alchemy.js'):null);
 if(a)a.treat(st,{hungry:1});
 return {ok:true,why:'รับประทาน'+bag.name(id)+' · บัฟ '+r.hours+' ชั่วโมงเกม'};
}
function mine(st,floor,eventId,quantity=1){const a=data(st),bag=B();if(!bag||quantity<=0)return null;
 const key=String(eventId);if(a.mined[key])return {...a.mined[key],duplicate:true};
 const cap=clamp(1+Math.floor((floor-1)/10),1,5),r=hash(seed(st),'ore-tier',key);
 const rolled=r<.72?1:r<.92?2:r<.985?3:r<.998?4:5,tier=Math.min(cap,rolled);
 const biome=E()?.themeFor?.(st,floor)?.id||'grass';const pool=Object.entries(MINERALS).filter(([id,v])=>v.tier===tier);
 const matching=pool.filter(([id,v])=>v.biomes.includes(biome)),choices=matching.length?matching:pool;
 const id=choices[Math.floor(hash(seed(st),'ore-type',key)*choices.length)][0],amount=Math.max(1,Math.min(3,Math.floor(quantity/2)+1));
 a.mineTier=Math.max(a.mineTier,tier);
 const origin={from:'mine',floor,day:st.day};let count=0,queued=false;
 if(!bag.auto(st))queued=!!bag.queueLoot(st,id,amount,null,origin,key+':ore');
 else count=bag.add(st,id,amount,st.day);
 const result={id,n:queued?amount:count,queued,tier};a.mined[key]=result;return result;
}
function chance(st,id){const r=FORGE_RECIPES[id],a=data(st);if(!r)return 0;
 const skillBonus=.045*(a.tier-1),intelBonus=clamp(((st.intelligence||15)-15)*.0005,0,.04);
 return clamp([.8,.68,.53,.39,.25][r.tier-1]+skillBonus+intelBonus,.05,.95);
}
function affinity(recipe){const mineral=Object.keys(recipe.needs).filter(k=>MINERALS[k]).sort((a,b)=>MINERALS[b].tier-MINERALS[a].tier)[0];return mineral?MINERALS[mineral]:null;}
function forge(st,id){const r=FORGE_RECIPES[id],a=data(st),bag=B(),sk=S();if(!r)return {ok:false,why:'ไม่มีแบบแปลน'};
 if(st.life?.dead)return {ok:false,why:'ตัวละครเสียชีวิตแล้ว'};
 if(st.life?.exp&&!st.life.exp.over)return {ok:false,why:'ต้องกลับเมืองก่อน'};
 if(a.tier<r.tier)return {ok:false,why:'ต้องผ่านเควสช่างตีเหล็กขึ้น Tier '+r.tier};
 if(!bag?.has(st,r.needs))return {ok:false,why:'วัตถุดิบไม่ครบ'};
 if(bag.slotCount(st)>=bag.CAP&&!Object.entries(r.needs).some(([k,n])=>bag.count(st,k)===n))return {ok:false,why:'กระเป๋าเต็ม 20 ช่อง'};
 const attempt=a.attempts++,p=chance(st,id),ok=hash(seed(st),'forge-v121',id,attempt)<p;
 for(const [k,n] of Object.entries(r.needs))bag.take(st,k,n);
 st.energy=Math.max(0,(st.energy||0)-Math.max(8,5*r.tier));a.xp+=ok?r.tier*8:r.tier*2;
 if(!ok)return {ok:true,success:false,chance:p,why:'หลอม'+r.name+'ล้มเหลว วัตถุดิบสูญหาย'};
 const rarity=['normal','soldier','captain','general','king'][r.tier-1];
 const item=bag.addGear(st,r.template,rarity,{from:'artisan',recipe:id,day:st.day,materials:Object.keys(r.needs)},0);
 if(!item)return {ok:true,success:false,chance:p,why:'หลอมสำเร็จ แต่ไม่มีช่องเก็บ อุปกรณ์ตกหายที่โรงตีเหล็ก'};
 const min=affinity(r),affix=AFFIX[min.affix],kind=sk.GEAR[r.template].slot;
 const mainOre=Object.keys(r.needs).filter(k=>MINERALS[k]).sort((x,y)=>MINERALS[y].tier-MINERALS[x].tier)[0];
 const affixOdds=clamp(.10+.09*r.tier+.035*(a.tier-1)+.025*Math.min(4,r.needs[mainOre]||0),.05,.82);
 const statOdds=clamp(.18+.07*r.tier+.03*(a.tier-1),.05,.75);
 if(hash(seed(st),'forge-stat',id,attempt)<statOdds){item.affixStats={[min.stat]:Math.max(1,Math.round(r.tier*(1+hash(seed(st),'forge-stat-value',id,attempt)*1.5)))};}
 if(hash(seed(st),'forge-special',id,attempt)<affixOdds&&['either',kind].includes(affix.type))item.special={id:min.affix,potency:Math.min(.55,.12+.06*r.tier),name:affix.name};
 a.successes++;a.recipes[id]=(a.recipes[id]||0)+1;sk.recalc(st);
 return {ok:true,success:true,chance:p,instanceId:item.instanceId,statOdds,affixOdds,stats:item.affixStats||{},special:item.special||null,why:'หลอม'+r.name+' สำเร็จ ['+rarity+']'+(item.special?' · '+item.special.name:'')+(item.affixStats?' · โบนัสค่าสถานะ':'')};
}
function cook(st,id){const r=SPECIAL_FOOD[id],a=data(st),bag=B();if(!r)return {ok:false,why:'ไม่มีสูตรอาหารนี้'};
 const cookingTier=S()?.tierOf(st,'cooking')||1;if(r.tier>Math.max(1,cookingTier))return {ok:false,why:'ต้องฝึกสกิลทำอาหารจนถึงขั้น '+r.tier};
 if(st.life?.exp&&!st.life.exp.over)return {ok:false,why:'ต้องกลับเมืองก่อนจึงทำอาหาร'};
 if(!bag?.has(st,r.needs))return {ok:false,why:'วัตถุดิบไม่ครบ'};
 if(!bag.canFit(st,id)&&!Object.entries(r.needs).some(([k,n])=>bag.count(st,k)===n))return {ok:false,why:'กระเป๋าเต็ม'};
 for(const [k,n] of Object.entries(r.needs))bag.take(st,k,n);
 const gained=bag.add(st,id,r.makes,st.day);S()?.train(st,'cooking',r.tier*3);
 return {ok:true,n:gained,why:'ทำ'+bag.name(id)+' สำเร็จ ×'+gained+' · ให้บัฟ '+r.hours+' ชั่วโมงเกม'};
}
function mentorStatus(st){const a=data(st),spec=PROMOTIONS[a.tier-1];if(!spec)return {status:'max'};
 const p=a.promotion;if(!p||p.to!==spec.to)return {status:a.xp>=spec.xp&&a.successes>=spec.success&&Object.keys(a.recipes).length>=spec.variety?'available':'training',spec};
 const ok=p.stage===0?a.mineTier>=spec.mine:p.stage===1?a.successes-p.startSuccess>=spec.practice:true;
 return {status:ok?'ready':'active',spec,stage:p.stage};
}
function meetMentor(st){const a=data(st),q=mentorStatus(st),s=q.spec;if(!s)return {ok:false,why:'เป็นปรมาจารย์แล้ว'};
 if(q.status==='training')return {ok:false,why:'ต้องมี XP '+s.xp+' ตีสำเร็จ '+s.success+' ครั้ง และสำเร็จ '+s.variety+' สูตร'};
 if(q.status==='available'){a.promotion={to:s.to,stage:0,startSuccess:a.successes};return {ok:true,why:'ช่างตีเหล็กมอบบทที่ 1/3: หาแร่ Tier '+s.mine+' ขึ้นไป'};}
 if(q.status==='active')return {ok:false,why:q.stage===0?'ต้องพบแร่ตามเกณฑ์ก่อน':'ต้องหลอมอุปกรณ์สำเร็จเพิ่ม '+s.practice+' ครั้ง'};
 if(q.stage===0){a.promotion.stage=1;a.promotion.startSuccess=a.successes;return {ok:true,why:'บทที่ 2/3: หลอมอุปกรณ์สำเร็จอีก '+s.practice+' ครั้ง'};}
 if(q.stage===1){a.promotion.stage=2;return {ok:true,why:'บทที่ 3/3: กลับมาสอบภาคทฤษฎีและรับรองที่โรงตีเหล็ก'};}
 a.tier++;a.promotion=null;return {ok:true,promoted:true,why:'ผ่านเควส '+s.name+' · ปลดล็อกช่างตีเหล็ก Tier '+a.tier};
}
return {MINERALS,AFFIX,FORGE_RECIPES,SPECIAL_FOOD,PROMOTIONS,data,mine,chance,forge,cook,mentorStatus,meetMentor,applyBuff,bonus,buffs,expire,resistance,consumeFood,now,hash};
});
