/* v118: discoverable progression quests, NOT automatic floor-by-floor dialogue.
   Existing v117 story choices are archived on migration; no character levels. */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MainStory=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TOTAL_FLOORS=100,CONTENT_THROUGH=50;
  const HISTORY=Object.freeze({1:'รากฐานเมือง',2:'เงาแห่งกิลด์แรก',3:'กิลด์แตกแยก',4:'การสำรวจล้มเหลว',5:'เมืองมั่งคั่ง',6:'เศรษฐกิจตกต่ำ',7:'สภาแห่งธงหลากสี',8:'เด็กที่เกิดใต้หอคอย',9:'ฤดูผลึกวิญญาณขาดแคลน',10:'บันทึกหน้าประตูบอส'});
  const Q=[
    ['survivor','บันทึกของผู้รอดชีวิต',1,'porter','หัวหน้าคนแบกของ','explore','survivalInstinct',2,{ore:4,monster:2},'mapping',1,3,'win'],
    ['nameless','เหล็กของผู้ไม่มีชื่อ',1,'smith','ช่างตีเหล็กผู้เก็บอาวุธเก่า','mine','namelessBlade',0,{ore:12,soul_crystal:3},'smithing',1,4,'boss'],
    ['cartographer','ศิษย์ของนักสำรวจไร้ทางกลับ',11,'compass','นักสำรวจผู้เก็บแผนที่','explore','trailEye',3,{crystal:5,ore:4},'mapping',2,5,'win'],
    ['apothecary','ยาที่ไม่มีใครปรุงสำเร็จ',11,'apothecary','หมอยาผู้เฝ้าสูตรเก่า','herb','herbalLore',3,{herb:8,crystal:3},'gathering',2,5,'win'],
    ['undying','ผู้ไม่ยอมตาย',21,'shrine','ผู้ดูแลศาลเจ้าร้าง','combat','iceSkin',3,{soul_crystal:6,monster:8},'nimble',2,1,'boss'],
    ['forbidden','วิชาที่ถูกลบจากบันทึก',21,'guild','อดีตปรมาจารย์ผู้ไร้นาม','explore','riftStrike',3,{crystal:10,soul_crystal:8},'sword',2,2,'elite'],
    ['oath','คำสาบานของผู้ที่ยังอยู่',31,'guild','ครูฝึกคณะสำรวจ','combat','partyOath',3,{monster:12,soul_crystal:6},'battleStep',2,3,'win'],
    ['blueprint','พิมพ์เขียวของช่างตีเหล็กคนสุดท้าย',31,'smith','ช่างหลอมพิมพ์เขียว','mine','forgeBlueprint',0,{ore:22,crystal:12,soul_crystal:12},'smithing',2,2,'boss'],
    ['letter','จดหมายที่ส่งไปไม่ถึง',41,'inn','ผู้ดูแลจดหมายผู้ถูกอัญเชิญ','explore','homeResolve',3,{crystal:12,herb:10},'mapping',2,4,'win'],
    ['limit','ผู้ฝ่าขีดจำกัด',41,'tower','ผู้เฝ้าประตูชั้นลึก','combat','limitBreak',3,{soul_crystal:20,monster:15},'sword',3,2,'boss']
  ].map(([id,name,minFloor,place,npc,scene,reward,tier,materials,skill,skillTier,need,winType],i)=>Object.freeze({id,name,minFloor,place,npc,scene,reward,tier,materials,skill,skillTier,need,winType,
    lead:'ข่าวลือเกี่ยวกับ “'+name+'”',hint:'ลองถามผู้คนแถว'+({smith:'โรงตีเหล็ก',porter:'สมาคมคนแบกของ',compass:'กิลด์เข็มทิศเงิน',apothecary:'ร้านยา',guild:'กิลด์นักรบ',shrine:'ศาลเจ้า',inn:'โรงแรม',tower:'ประตูหอคอย'}[place]||'เมือง')+' และหาหลักฐานในหอคอย',
    steps:Object.freeze([{type:'materials',name:'รวบรวมวัตถุดิบจากหอคอย',items:materials},{type:'skill',name:'ฝึกความชำนาญจริง',skill,tier:skillTier},{type:'win',name:'พิสูจน์ฝีมือกับอสูร',need,winType,minFloor},{type:'return',name:'กลับไปพบผู้สอนเพื่อรับการถ่ายทอด'}])}));
  const QUESTS=Object.freeze(Object.fromEntries(Q.map(q=>[q.id,q])));
  const SEED=st=>String(st.life&&st.life.age||0)+':'+String(st.life&&st.life.origin||'');
  function hash(...parts){let h=2166136261;for(const ch of parts.join(':')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0)/4294967296;}
  function detectedHistory(st){const raw=st&&(st.historyPath||(st.worldHistory&&st.worldHistory.path));const id=Number(raw&&typeof raw==='object'?raw.id:raw);return Number.isInteger(id)&&HISTORY[id]?id:null;}
  function historyNote(st){const id=detectedHistory(st);return id?'เส้นประวัติศาสตร์โลก: '+HISTORY[id]:null;}
  function ensure(st){if(!st||typeof st!=='object')return null;
    const old=st.mainStory;
    if(!old||old.v!==2){st.mainStory={v:2,rumors:{},quests:{},townSearch:{},observed:{},kills:{},legacyChronicle:old&&old.v===1?old:null};}
    const s=st.mainStory;for(const k of ['rumors','quests','townSearch','observed','kills'])if(!s[k]||typeof s[k]!=='object')s[k]={};return s;
  }
  function high(st){const x=st.life&&st.life.exp;return Math.max(1,x&&x.highest||1);}
  function eligible(st,q,floor){return Math.max(high(st),floor||0)>=q.minFloor;}
  function rumorState(st,q){const s=ensure(st);return s.rumors[q.id]||(s.rumors[q.id]={town:false,tower:false});}
  function status(st,id){const q=QUESTS[id];if(!q)return'unknown';const s=ensure(st),r=s.quests[id],l=rumorState(st,q);
    if(r&&r.claimed)return'completed';if(r&&r.accepted)return'active';return l.town&&l.tower?'ready':l.town||l.tower?'rumor':'hidden';
  }
  // The player must physically visit a location after work. No generic quest button can generate a clue.
  function searchTown(st,place){const s=ensure(st),key=String(st.day)+':'+place;
    if(s.townSearch[key])return{ok:false,why:'วันนี้สอบถามคนแถวนี้ไปแล้ว'};
    s.townSearch[key]=true;
    const pool=Q.filter(q=>q.place===place&&eligible(st,q)&&!rumorState(st,q).town&&!s.quests[q.id]?.claimed);
    if(!pool.length)return{ok:true,why:'สอบถามผู้คนแล้ว แต่ยังไม่มีข่าวใหม่เกี่ยวกับการฝึกฝนขั้นสูง'};
    const q=pool[Math.floor(hash(SEED(st),'rumor',key,'pick')*pool.length)];
    if(hash(SEED(st),'rumor',key,'chance')>=0.46)return{ok:true,why:'คนแถวนั้นพูดถึงการสำรวจทั่วไป ยังไม่พบเบาะแสสำคัญ'};
    rumorState(st,q).town=true;
    return{ok:true,quest:q.id,why:'ได้ยินข่าวลือ: '+q.lead+' · ต้องค้นหลักฐานเพิ่มเติมในหอคอยก่อนจะเริ่มเควส'};
  }
  function relevant(q,scene){return q.scene===scene||((q.scene==='explore'||q.scene==='combat')&&scene==='travel');}
  // Event observations are idempotent, stored before any follow-up UI can reopen.
  function observe(st,event){const s=ensure(st),id=String(event&&event.eventId||'');if(!id||s.observed[id])return[];
    s.observed[id]=true;const lines=[],floor=Number(event.floor)||1,scene=event.scene;
    if(event.win&&(event.boss||event.elite)){s.kills[id]={floor,boss:!!event.boss,elite:!!event.elite,power:event.power||0};}
    const clues=Q.filter(q=>eligible(st,q,floor)&&floor>=q.minFloor&&relevant(q,scene)&&!rumorState(st,q).tower&&!s.quests[q.id]?.claimed);
    for(const q of clues){if(hash(SEED(st),'quest-clue',id,q.id)>=0.25)continue;
      rumorState(st,q).tower=true;lines.push('📜 พบเบาะแสลึกลับเกี่ยวกับ '+q.name+' · ตรวจสมุดข่าวลือ');break;}
    for(const q of Q){const r=s.quests[q.id];if(!r||!r.accepted||r.claimed)continue;
      const step=q.steps[r.stage];if(step&&step.type==='win'&&event.win&&floor>=step.minFloor&&
        (step.winType==='win'||(step.winType==='boss'&&event.boss)||(step.winType==='elite'&&(event.elite||event.boss)))){
        const k='win:'+id;if(!r.seen[k]){r.seen[k]=true;r.progress=Math.min(step.need,(r.progress||0)+1);if(r.progress===step.need)lines.push('📖 '+q.name+' ผ่านเงื่อนไขการต่อสู้ กลับไปพบ'+q.npc);}
      }
    }
    return lines;
  }
  function ready(st,q,r,bag,skills){const step=q.steps[r.stage];if(!step)return false;
    if(step.type==='materials')return Object.entries(step.items).some(([id,n])=>(r.delivered&&r.delivered[id]||0)<n&&bag.count(st,id)>0) || Object.entries(step.items).every(([id,n])=>(r.delivered&&r.delivered[id]||0)>=n);
    if(step.type==='skill')return skills.tierOf(st,step.skill)>=step.tier;
    if(step.type==='win'){
      // Permanent bosses and elites defeated before a quest started count as documented proof.
      const records=Object.values(ensure(st).kills).filter(k=>k.floor>=step.minFloor);
      const prior=step.winType==='win'?0:step.winType==='elite'?
        records.filter(k=>k.elite||k.boss).length:
        new Set(records.filter(k=>k.boss).map(k=>k.floor).concat(Object.entries(st.tower&&st.tower.floors||{})
          .filter(([floor,f])=>+floor>=step.minFloor&&f.boss&&f.boss.alive===false).map(([floor])=>+floor))).size;
      return (step.winType==='win' ? (r.progress||0) : Math.max(r.progress||0,prior))>=step.need;
    }
    return true;
  }
  function meet(st,id,bag,skills){const q=QUESTS[id];if(!q)return{ok:false,why:'ไม่มีผู้สอนคนนี้'};
    const s=ensure(st),statusNow=status(st,id);if(statusNow==='hidden'||statusNow==='rumor')return{ok:false,why:'ยังไม่มีเบาะแสเพียงพอที่จะขอรับการฝึก'};
    if(statusNow==='completed')return{ok:false,why:'ผ่านสายเควสนี้แล้ว'};
    let r=s.quests[id];if(!r){s.quests[id]=r={accepted:true,claimed:false,stage:0,progress:0,seen:{}};return{ok:true,why:'พบ'+q.npc+'และเริ่มสายเมนเควส “'+q.name+'” · ขั้น 1/'+q.steps.length+' · '+q.steps[0].name};}
    if(!ready(st,q,r,bag,skills))return{ok:false,why:'เงื่อนไขยังไม่ครบ: '+q.steps[r.stage].name};
    const step=q.steps[r.stage];if(step.type==='materials'){
      r.delivered=r.delivered||{};
      for(const [item,n] of Object.entries(step.items)){
        const k=Math.min(Math.max(0,n-(r.delivered[item]||0)),bag.count(st,item));
        if(k){if(!bag.take(st,item,k))return{ok:false,why:'ส่งวัตถุดิบไม่สำเร็จ'};r.delivered[item]=(r.delivered[item]||0)+k;}
      }
      const missing=Object.entries(step.items).filter(([item,n])=>(r.delivered[item]||0)<n)
        .map(([item,n])=>bag.name(item)+' '+(n-(r.delivered[item]||0))+' ชิ้น');
      if(missing.length)return{ok:true,partial:true,why:'ส่งวัตถุดิบบางส่วนให้'+q.npc+'แล้ว · ยังขาด '+missing.join(', ')+' · นำมาส่งเพิ่มเติมได้ภายหลัง'};
      r.materialHistory=r.delivered;delete r.delivered;
    }
    r.stage++;r.progress=0;r.seen={};
    if(r.stage<q.steps.length)return{ok:true,why:'ผ่าน '+step.name+' · ผู้สอนมอบบทถัดไป '+(r.stage+1)+'/'+q.steps.length+' : '+q.steps[r.stage].name};
    const grant=grantReward(st,q,bag,skills);if(!grant.ok){r.stage--;return grant;}
    r.claimed=true;r.completedDay=st.day||1;return{ok:true,reward:q.reward,why:'สำเร็จเมนเควส “'+q.name+'” · '+grant.why};
  }
  function grantReward(st,q,bag,skills){if(q.reward==='namelessBlade'){
      const gear=bag.addGear(st,'namelessBlade','captain',{from:'mainQuest',quest:q.id,day:st.day});
      return gear?{ok:true,why:'ได้รับดาบระดับ Captain รายชิ้นจากช่างตีเหล็ก'}:{ok:false,why:'กระเป๋าเต็ม กรุณาเคลียร์ที่ก่อนรับดาบ'};
    }
    if(q.reward==='forgeBlueprint'){sBlueprint(st);return{ok:true,why:'ได้รับสิทธิ์สร้างเกราะผู้พิทักษ์ที่โรงตีเหล็ก'};}
    skills.data(st);const prev=st.skills[q.reward];if(!skills.SKILLS[q.reward])return{ok:false,why:'ไม่มีสกิลรางวัลในระบบ'};
    if(!prev)st.skills[q.reward]={tier:q.tier,xp:0};else if(prev.tier<q.tier){prev.tier=q.tier;prev.xp=0;}
    skills.recalc(st);if(q.id==='apothecary')ensure(st).herbalRecipe=true;return{ok:true,why:'เรียน '+skills.SKILLS[q.reward].name+' ระดับ '+q.tier+(skills.SKILLS[q.reward].type==='active'?' · สามารถเลือกใช้ในช่องแอ็กทีฟเดียว':q.id==='apothecary'?' · ปลดล็อกสูตรน้ำสมุนไพรเข้มข้น':'')};
  }
  function sBlueprint(st){ensure(st).blueprint=true;}
  function known(st){return Q.map(q=>({ ...q,status:status(st,q.id),rumor:rumorState(st,q),record:ensure(st).quests[q.id]||null })).filter(q=>q.status!=='hidden');}
  function journal(st,bag,skills){return known(st).map(q=>({ ...q,step:q.steps[q.record&&q.record.stage||0],canTurnIn:!!q.record&&q.record.accepted&&!q.record.claimed&&ready(st,q,q.record,bag,skills) }));}
  // Legacy API calls from the tower deliberately do not queue a narrative popup.
  function enter(st,floor){ensure(st);return null;}
  function bossWin(st,floor){ensure(st);return true;}
  function pending(){return null;}
  return Object.freeze({TOTAL_FLOORS,CONTENT_THROUGH,HISTORY,QUESTS,QUEST_LIST:Object.freeze(Q),detectedHistory,historyNote,ensure,enter,bossWin,pending,searchTown,observe,meet,ready,status,known,journal});
});
