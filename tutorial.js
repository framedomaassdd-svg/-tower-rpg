/* Tower RPG v122: one-time, data-driven, save-compatible guidance. No DOM dependency. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.Tutorial=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const P=(text,image)=>({text,...(image?{image}:{})});
const TUTORIALS={
 start:{title:'เริ่มใช้ชีวิต',icon:'🏠',when:{event:'start'},pages:[P('ตัวละครใช้ชีวิต เดินและทำงานเอง\nเวลาในโลกเดินต่อเนื่อง'),P('แตะการ์ดเพื่อเลือกสิ่งที่ต้องการ\nเมนูด้านขวาใช้เปิดกระเป๋าและสกิล')]},
 bag:{title:'กระเป๋าและน้ำหนัก',icon:'🎒',when:{event:'bag'},pages:[P('กระเป๋ามี 20 ช่อง ของชนิดเดียวกันซ้อนกันได้\nจำนวนไม่จำกัด แต่ทุกชิ้นมีน้ำหนัก'),P('แบกหนักจะช้า จนเดินไม่ได้\nปิดอัตโนมัติเพื่อเลือกเก็บของเอง')]},
 skills:{title:'การเรียนสกิล',icon:'✨',when:{event:'skills'},pages:[P('สกิลฝึกจนชำนาญได้ และมีเควสเลื่อนขั้น'),P('เลือกแอ็กทีฟได้หนึ่งสกิล\nพาสซีฟพิเศษทำงานเมื่อครบเงื่อนไข')]},
 tower_enter:{title:'เตรียมเข้าหอคอย',icon:'🏰',when:{event:'tower_enter'},pages:[P('เข้าหอคอยเริ่มที่ชั้น 1 เสมอ\nกลับเมืองได้ทางศิลาทางออก'),P('เตรียมอาหาร ยา และสัมภาระให้พร้อม\nมอนสเตอร์และอุบัติเหตุอาจถึงตาย')]},
 tower_choice:{title:'ตัวเลือกในหอคอย',icon:'🎰',when:{event:'tower_choice'},pages:[P('เลือกการกระทำ แล้วหมุนวงล้อ\nผลอาจช่วยหรือทำให้เสียเปรียบ'),P('ตัวละครสู้และเดินเอง\nผลร้ายแรงอาจทำให้เสียชีวิต')]},
 stone:{title:'ศิลาสองชนิด',icon:'🪨',when:{event:'stone'},pages:[P('ศิลาทางออกพากลับเมือง\nศิลาทางขึ้นพาไปชั้นต่อไป')]},
 safe_floor:{title:'เซฟโซน',icon:'🏕️',when:{event:'safe_floor'},pages:[P('ทุก 5 ชั้นเป็นเขตปลอดภัย\nบริการมีหลายแบบตามสถานที่')]},
 boss_floor:{title:'ผู้พิทักษ์ก่อนเซฟโซน',icon:'👑',when:{event:'boss_floor'},pages:[P('ชั้นก่อนเซฟโซนมีบอสขวางศิลาขึ้น\nต้องชนะบอสจึงจะขึ้นได้')]},
 gear:{title:'อุปกรณ์รายชิ้น',icon:'⚔️',when:{event:'gear'},pages:[P('อุปกรณ์มี 7 ระดับความหายาก\nเลือกใส่และถอดในหน้าอุปกรณ์')]},
 enhance:{title:'การตีบวก',icon:'🔨',when:{event:'enhance'},pages:[P('ตีบวกใช้ผลึกวิญญาณและมีโอกาสพลาด'),P('สังเวยอาวุธเพิ่มโอกาสได้\nขั้นสูงอาจลดขั้นหรือทำให้อาวุธพัง')]},
 status:{title:'สถานะผิดปกติ',icon:'🩸',when:{event:'status'},pages:[P('อาการผิดปกติรุนแรงได้ระดับ 1–4\nยาแต่ละสูตรลดอาการต่างกัน')]},
 alchemy:{title:'ปรุงยา',icon:'🧪',when:{event:'alchemy'},pages:[P('สมุนไพรและตำรับมีหลายเทียร์\nยาน้ำออกฤทธิ์ไว ยาเม็ดช้ากว่า')]},
 artisan:{title:'ช่างฝีมือ',icon:'🔨',when:{event:'artisan'},pages:[P('แร่มีหลายเทียร์และส่งผลต่ออุปกรณ์'),P('อาหารพิเศษเพิ่มบัฟชั่วคราว\nฝึกฝีมือเพื่อปรุงสูตรระดับสูง')]},
 minigame_alchemy:{title:'มินิเกมปรุงยา',icon:'⚗️',when:{event:'minigame_alchemy'},pages:[P('บดสมุนไพรโดยแตะสลับซ้ายขวา\nอย่าบดเกินเส้น'),P('กดค้างเพื่อเพิ่มไฟ ปล่อยเพื่อลดไฟ\nรักษาเข็มในช่องสีเขียว'),P('หยดส่วนผสมตามชื่อบนจอ\nดาวมากช่วยเพิ่มโอกาสสำเร็จ')]},
 minigame_smith:{title:'มินิเกมตีเหล็ก',icon:'🔨',when:{event:'minigame_smith'},pages:[P('เผาเหล็ก ตีขึ้นรูป แล้วชุบน้ำ\nแตะให้ตรงจังหวะสีเป้าหมาย'),P('ดาว 6–8 ช่วยโอกาสสำเร็จและโบนัส\nดาว 9 ช่วยมากขึ้น ข้ามได้ 4 ดาว')]},
 minigame_cook:{title:'มินิเกมทำอาหาร',icon:'🍳',when:{event:'minigame_cook'},pages:[P('หั่นวัตถุดิบ คนกระทะ แล้วจับเวลาเสิร์ฟ'),P('แตะให้ตรงจังหวะเป้าหมาย\nดาวสูงช่วยคุณภาพและระยะเวลาบัฟ')]},
 death_risk:{title:'สุขภาพวิกฤต',icon:'❤️‍🩹',when:{event:'death_risk'},pages:[P('สุขภาพต่ำกว่า 30 อันตรายมาก\nพักผ่อนหรือใช้ยาช่วยรักษา')]},
 rescue:{title:'ถูกช่วยออกจากหอคอย',icon:'🚑',when:{event:'rescue'},pages:[P('การช่วยออกอาจเสียเงินครึ่งหนึ่ง\nและอุปกรณ์ครึ่งหนึ่ง พร้อมอาการอ่อนแรง')]}
};
const JOBS={smith:'ตีเหล็กรับค่าแรงและฝึกช่าง\nมีมินิเกมตีเหล็ก',guild:'ฝึกกับกิลด์นักรบเพื่อเข้าทีม\nได้เบี้ยเลี้ยงและสกิล',compass:'อ่านแผนที่และสำรวจ\nสะสมทักษะกับกิลด์เข็มทิศ',porter:'ขนสัมภาระและฝึกกำลัง\nเข้าหอคอยกับทีมได้',gchef:'ทำอาหารให้กิลด์และรับค่าแรง\nมีมินิเกมทำครัว',tmerchant:'ฝึกตีราคาสินค้าหอคอย\nเลื่อนชื่อเสียงเพื่อเพิ่มค่าแรง',market:'รับจ้างขนของที่ตลาด\nได้ค่าแรงและอาหาร',hotel:'ดูแลห้องพักและซักผ้า\nได้ค่าแรงและส่วนลดค่าห้อง',kitchen:'ช่วยร้านอาหารหั่นและปรุง\nมีมินิเกมพร้อมค่าแรง',cargo:'ขนของที่ลานเกวียน\nได้ค่าแรงและฝึกกำลัง',scrap:'ค้นหาของเก่าจากตรอก\nได้ค่าแรงและของขายเพิ่ม'};
for(const [path,body]of Object.entries(JOBS))TUTORIALS['job_'+path]={title:'งาน: '+path,icon:'🧰',when:{event:'job',path},pages:[P(body)]};
function records(st){if(!st.life||typeof st.life!=='object')st.life={};if(!st.life.tutorials||typeof st.life.tutorials!=='object'||Array.isArray(st.life.tutorials)){st.life.tutorials={};if((st.day||1)>1){for(const id of Object.keys(TUTORIALS))if(historical(st,id))st.life.tutorials[id]=Math.max(1,(st.day||1)-1);}}return st.life.tutorials;}
function historical(st,id){const L=st.life||{},x=L.exp||{},seen=st.life?.seen||[],days=Number(st.day)||1;
 if(id==='start')return !!L.started&&days>1;
 if(id.startsWith('job_'))return !!L.workedDay&&L.path===id.slice(4);
 if(id==='bag')return days>1&&!!(st.bagVersion||st.inventoryVersion||L.bagTouched);
 if(id==='tower_enter')return !!(x.start||x.highest||st.tower?.history?.length||st.floor>1);
 if(id==='tower_choice')return !!(x.done&&Object.keys(x.done).length||x.wins);
 if(id==='safe_floor')return !!(x.safeSeen&&Object.keys(x.safeSeen).length||x.highest>=5);
 if(id==='boss_floor')return !!(x.bossWins||st.floor>=5);
 if(id==='gear')return days>1&&!!(st.gearNextId||Object.keys(st.gear||{}).length);
 if(id==='skills')return days>1&&!!Object.keys(st.skills||{}).length;
 if(id==='alchemy')return !!(st.alchemy?.attempts||st.alchemy?.successes);
 if(id==='artisan')return !!(st.artisan?.attempts||st.artisan?.successes);
 if(id==='minigame_alchemy')return !!st.alchemy?.attempts;
 if(id==='minigame_smith')return !!st.artisan?.attempts;
 if(id==='minigame_cook')return !!Object.keys(st.artisan?.foodMade||{}).length;
 if(id==='rescue')return !!(x.rescued||x.rescues);
 if(id==='death_risk')return !!L.restDay&&days>1;
 return false;
}
function relevant(st,id,ctx){const w=TUTORIALS[id].when,L=st.life||{};if(id.startsWith('job_'))return ctx.event==='job'&&ctx.path===w.path;
 if(ctx.event===w.event)return true;
 if(w.event==='start')return !!L.started&&st.day===1;
 if(w.event==='bag')return ctx.event==='world'&&Array.isArray(st.bag)&&st.bag.length>0;
 if(w.event==='gear')return ctx.event==='world'&&!!Object.keys(st.gear||{}).length;
 if(w.event==='skills')return ctx.event==='world'&&!!Object.keys(st.skills||{}).length;
 if(w.event==='status')return ctx.event==='world'&&!!Object.values(st.conditions||{}).some(x=>(typeof x==='number'?x:x?.level||0)>0);
 if(w.event==='death_risk')return (st.health||100)<30;
 if(w.event==='tower_enter')return !!L.exp&&!L.exp.over&&ctx.event==='world';
 return false;
}
const ORDER=['start',...Object.keys(JOBS).map(p=>'job_'+p),'tower_enter','tower_choice','stone','safe_floor','boss_floor','bag','skills','gear','status','death_risk','rescue','enhance','alchemy','artisan','minigame_alchemy','minigame_smith','minigame_cook'];
function pending(st,ctx={}){if(!st||!st.life)return null;const r=records(st);const day=Math.max(1,st.day||1);if(st.life.tutorialLastDay===day&&ctx.clock!==undefined&&Math.abs((st.life.tutorialLastClock||0)-ctx.clock)<.04)return null;
 for(const id of ORDER){if(r[id]!==undefined)continue;if(relevant(st,id,ctx))return id;}return null;}
function done(st,id,clock){if(!TUTORIALS[id])return false;records(st)[id]=st.day||1;if(Number.isFinite(clock)){st.life.tutorialLastDay=st.day;st.life.tutorialLastClock=clock;}return true;}
function reset(st){if(!st.life)return;st.life.tutorials={};delete st.life.tutorialLastDay;delete st.life.tutorialLastClock;}
return {TUTORIALS,JOBS,pending,done,reset};
});
