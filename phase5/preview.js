/* Tower RPG Phase 5 integrated scene PREVIEW. Does not modify main game or save data.
 * P0: conservative fixed-camera city art and limited motion parallax.
 * P1: four real 6-part canvas rigs. Ambient NPC movement is preview-only.
 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const cv=$('scene'), ctx=cv.getContext('2d',{alpha:false});
const WORLD_W=4344,WORLD_H=724;
const src=window.PHASE5_ASSETS;
const images={}, failed=[];
const roles=[
  {id:'smith',name:'ช่างตีเหล็ก',occupation:'ตีเหล็ก',x:2535,y:614,home:3770,work:2620,foot:615,dayStart:7,dayEnd:18,height:124,workAnim:'hammer',equip:'hammer',apron:true,face:1},
  {id:'teen',name:'เด็กฝึกงานหญิง',occupation:'ช่วยร้านขนมปัง',x:1690,y:610,home:2950,work:1770,foot:612,dayStart:8,dayEnd:18,height:104,workAnim:'carry',equip:'none',face:1},
  {id:'elder',name:'เสมียนกิลด์',occupation:'ทำบัญชีกิลด์',x:3110,y:610,home:1010,work:3320,foot:611,dayStart:8,dayEnd:17,height:115,workAnim:'idle',equip:'none',face:1},
  {id:'child',name:'เด็กส่งของ',occupation:'ส่งสินค้าในเมือง',x:900,y:620,home:890,work:1950,foot:619,dayStart:9,dayEnd:19,height:90,workAnim:'carry',equip:'none',face:1,hop:0},
  {id:'hero',name:'ผู้เล่น',occupation:'สำรวจและหางานในเมือง',x:1950,y:617,home:3170,work:1515,foot:620,dayStart:9,dayEnd:20,height:125,face:1}
];
const roleMap=Object.fromEntries(roles.map(r=>[r.id,r]));
const state={ready:false,paused:false,elapsed:0,worldMin:8*60+15,day:1,velocity:4,zoom:1,cam:1550,focus:'free',dragging:false,light:0,mode:0,lastTime:0,drawCount:0,errors:[],loaded:0,total:0,stamp:0};
const layers=[
 {id:'sky',y:0,rate:.14}, {id:'clouds',y:0,rate:.18,flow:.22},
 {id:'mountains',y:125,rate:.37}, {id:'aqueduct',y:204,rate:.49},
 {id:'forest',y:267,rate:.68}
];
const lamps=[{id:'westLamp',x:680,y:335},{id:'archLamp',x:1050,y:335},{id:'bakeryLamp',x:1940,y:330},{id:'eastLamp',x:4052,y:330},{id:'wellFront',x:1477,y:476}];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const progress=()=>{$('progress').textContent=`${state.loaded}/${state.total} ภาพ`};
function requestImage(id,url){state.total++;const im=new Image();images[id]=im;im.decoding='async';im.onload=()=>{state.loaded++;progress()};im.onerror=()=>{failed.push(url);state.loaded++;progress()};im.src=url;return new Promise(resolve=>{if(im.complete){resolve()} else{im.addEventListener('load',resolve,{once:true});im.addEventListener('error',resolve,{once:true})}})}
async function initialize(){
  const loadJobs=Object.entries(src).map(([id,url])=>requestImage(id,url));
  for(const slug of ['smith','teen','elder','child']) window.TowerRigs[slug].load(path=>`rigs/${slug}/${path}`);
  await Promise.all(loadJobs);
  const hero=HeroSprite.load(src.hero);
  if(!hero.complete)await new Promise(res=>{hero.onload=res;hero.onerror=res});
  if(failed.length)notify('ไฟล์ภาพโหลดไม่ครบ: '+failed.join(', '));
  state.ready=true; $('busy').hidden=true;state.lastTime=performance.now(); requestAnimationFrame(tick);
}
function notify(s){state.errors.push(s); $('errors').textContent=state.errors.join('\n');}
function dimensions(){const r=cv.getBoundingClientRect(), dpr=Math.min(window.devicePixelRatio||1,2);
  const w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));
  if(w!==cv.width||h!==cv.height){cv.width=w;cv.height=h}
  let sc=h/WORLD_H*state.zoom;sc=Math.max(.1,sc);
  return {w,h,sc,view:w/sc,top:0};
}
function constrainCamera(cam,view){return clamp(cam,0,Math.max(0,WORLD_W-view))}
function sceneBg(im,layer,cam,view){
  if(!im || !im.naturalWidth)return;
  let width=Math.min(view,WORLD_W),cap=Math.max(0,im.naturalWidth-width),anchor=Math.max(0,2172-width/2);
  let drift=layer.flow?state.elapsed*layer.flow:0;
  // Source crop rather than reflected textures: layers move independently without revealing empty edges.
  const sx=clamp(anchor+(cam-anchor)*layer.rate+drift,0,cap);
  ctx.drawImage(im,sx,0,width,im.naturalHeight,cam,layer.y,width,im.naturalHeight);
  // The crop is clamped at actual painted image edges, so no artificial mirrored scenery is exposed.
}
function lightingAmount(){if(state.mode===1)return 0;if(state.mode===2)return 1;
  const h=state.worldMin/60;
  if(h>=19.5||h<5)return 1;
  if(h>=17.5)return (h-17.5)/2;
  if(h<7)return 1-(h-5)/2;
  return 0;
}
function workActive(r,h){return h>=r.dayStart&&h<r.dayEnd}
function chooseGoal(r){const hour=state.worldMin/60;
  if(!workActive(r,hour))return {x:r.home,act:'พักผ่อน'};
  if(r.id==='child'){
    // Delivery route repeats; the route is based on world time, not rendered animation frames.
    const pts=[790,1380,1980,2540,3350,1830];
    return {x:pts[Math.floor((state.worldMin-9*60)/47 + 1000)%pts.length],act:'ส่งของ'};
  }
  return {x:r.work,act:r.occupation};
}
function update(dt){if(state.paused)return;
  state.elapsed+=dt;
  // At x1, one real second advances three in-game minutes, at x4 it advances twelve.
  state.worldMin+=dt*3*state.velocity;
  while(state.worldMin>=1440){state.worldMin-=1440;state.day++}
  for(const a of roles){
    const goal=chooseGoal(a);a.target=goal.x;
    let delta=goal.x-a.x, moving=Math.abs(delta)>2;
    if(moving){const step=Math.min(Math.abs(delta),Math.max(24,a.height*.68)*dt);a.x+=Math.sign(delta)*step;a.face=delta>=0?1:-1;}
    a.moving=moving;a.anim=moving?'walk':workActive(a,state.worldMin/60)?a.workAnim||'idle':'idle';
    if(a.id==='hero'&& !moving) a.anim='idle';
    a.activity=moving?'กำลังเดินทาง':goal.act;
    if(a.id==='child'&&a.anim==='idle'&&workActive(a,state.worldMin/60))a.anim='carry';
  }
}
function drawHero(r){ctx.save();ctx.translate(r.x,r.y);ctx.scale(r.face,1);
  const fi=r.moving?Math.floor(state.elapsed*7)%4:0,row=r.moving?0:2;
  const w=125*480/680,h=125;
  if(images.hero&&images.hero.naturalWidth)ctx.drawImage(images.hero,fi*480,row*680,480,680,-w/2,-h+4,w,h);
  ctx.restore();
}
function drawRig(a){const rig=window.TowerRigs[a.id];if(!rig?.ready())return;
 ctx.save();ctx.translate(a.x,a.y);ctx.scale(a.face,1);
 rig.draw(ctx,a.anim||'idle',state.elapsed,a.height,a.equip,a.apron);ctx.restore();
}
function drawPerson(a){ctx.save();ctx.fillStyle='rgba(16,17,21,.21)';ctx.beginPath();ctx.ellipse(a.x,a.y,18*a.height/125,4,0,0,Math.PI*2);ctx.fill();ctx.restore();
 if(a.id==='hero')drawHero(a);else drawRig(a);
}
function drawActors(){
  for(const a of [...roles].sort((a,b)=>a.y-b.y)){
    drawPerson(a);
    // A depth mask is drawn only over actors whose feet stand behind the object.
    for(const o of lamps){const im=images[o.id];if(!im?.naturalWidth)continue;
      if(a.x>=o.x-a.height*.55&&a.x<o.x+im.naturalWidth+a.height*.55 && a.y<o.y+im.naturalHeight-4){
        ctx.drawImage(im,o.x,o.y);
      }
    }
  }
}
function draw(){if(!state.ready)return;
 const {w,h,sc,view}=dimensions();const selection=roleMap[state.focus];
 if(selection){state.cam=lerp(state.cam,selection.x-view/2,.16)}
 state.cam=constrainCamera(state.cam,view);
 ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);
 ctx.fillStyle='#253b51';ctx.fillRect(0,0,w,h);
 ctx.setTransform(sc,0,0,sc,-state.cam*sc,(h-WORLD_H*sc)/2);
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 for(const layer of layers)sceneBg(images[layer.id],layer,state.cam,view);
 if(images.tower?.naturalWidth)ctx.drawImage(images.tower,720,0);
 for(const t of [{id:'westGate',x:6,y:277},{id:'arch',x:1193,y:325},{id:'eastAlley',x:3806,y:348}])if(images[t.id]?.naturalWidth)ctx.drawImage(images[t.id],t.x,t.y);
 if(images.buildings?.naturalWidth)ctx.drawImage(images.buildings,0,0);
 if(images.road?.naturalWidth)ctx.drawImage(images.road,0,547);
 drawActors();
 const night=lightingAmount();
 if(night>0){
  ctx.save();ctx.fillStyle=`rgba(6,12,26,${(night*.58).toFixed(3)})`;ctx.fillRect(state.cam,0,view,WORLD_H);
  if(images.glow?.naturalWidth){ctx.globalCompositeOperation='screen';ctx.globalAlpha=.88*night;ctx.drawImage(images.glow,0,0)}
  // Keep warm highlights localized around existing lamp positions, not free-floating sprites.
  ctx.globalCompositeOperation='screen';
  for(const o of lamps){if(o.id==='wellFront')continue;const cx=o.x+28,cy=o.y+110;
   const g=ctx.createRadialGradient(cx,cy,2,cx,cy,108);g.addColorStop(0,`rgba(255,176,74,${(.13*night).toFixed(3)})`);g.addColorStop(1,'rgba(255,176,74,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,108,0,Math.PI*2);ctx.fill();}
  ctx.restore();
 }
 const selected=roleMap[state.selected];
 if(selected){ctx.save();ctx.strokeStyle='#ffe3a8';ctx.lineWidth=2/sc;ctx.beginPath();ctx.ellipse(selected.x,selected.y+3,22,7,0,0,Math.PI*2);ctx.stroke();ctx.restore()}
 const mins=Math.floor(state.worldMin)%1440;
 $('clock').textContent=String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0');
 $('dayCount').textContent=`วันที่ ${state.day}`;
 $('fps').style.color=night>.6?'#91bed9':'#d4d8b2';
 if(selected){$('detailStatus').textContent=`${selected.occupation} · ${selected.activity||'กำลังพัก'} · ตำแหน่ง ${Math.round(selected.x)}`}
}
let lastFrame=0;
function tick(ts){const dt=state.lastTime?clamp((ts-state.lastTime)/1000,0,.075):0;state.lastTime=ts;
 update(dt);
 if(!lastFrame||ts-lastFrame>32){try{draw();}catch(e){if(!state.errors.includes(e.message)){notify(e.stack||e.message)}}lastFrame=ts;state.drawCount++}
 requestAnimationFrame(tick);
}
const places={west:450,center:2172,east:3640};
function place(key){const dim=dimensions();state.focus='free';$('focus').value='free';state.cam=constrainCamera(places[key]-dim.view/2,dim.view);
 document.querySelectorAll('[data-place]').forEach(b=>b.classList.toggle('active',b.dataset.place===key));draw();}
document.querySelectorAll('[data-place]').forEach(b=>b.addEventListener('click',()=>place(b.dataset.place)));
function setZoom(z){const before=dimensions(),focus=state.cam+before.view/2;state.zoom=clamp(z,1,2);const after=dimensions();state.cam=constrainCamera(focus-after.view/2,after.view);$('zoomLabel').textContent=Math.round(state.zoom*100)+'%';draw();}
$('zoomOut').onclick=()=>setZoom(state.zoom-.5);$('zoomIn').onclick=()=>setZoom(state.zoom+.5);
$('pause').onclick=()=>{state.paused=!state.paused;$('pause').textContent=state.paused?'เล่นต่อ':'หยุด';$('pause').classList.toggle('active',state.paused)};
$('speed').onchange=()=>{state.velocity=+$('speed').value};
$('focus').onchange=()=>{state.focus=$('focus').value};
$('light').onclick=()=>{state.mode=(state.mode+1)%3;$('light').textContent=['แสง: อัตโนมัติ','แสง: กลางวัน','แสง: กลางคืน'][state.mode];$('light').classList.toggle('active',state.mode!==0);draw()};
$('closeDetail').onclick=()=>{state.selected=null;$('detail').hidden=true};
let pointer=null,moved=false;
cv.addEventListener('pointerdown',e=>{e.preventDefault();cv.setPointerCapture(e.pointerId);pointer={id:e.pointerId,x:e.clientX,cam:state.cam,down:e.clientX,dy:e.clientY};moved=false;});
cv.addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;
 const dx=e.clientX-pointer.x;
 if(Math.abs(dx)>5)moved=true;
 if(moved){const rect=cv.getBoundingClientRect(),dim=dimensions();state.focus='free';$('focus').value='free';state.cam=constrainCamera(pointer.cam-dx*dim.w/(rect.width*dim.sc),dim.view);draw()}});
cv.addEventListener('pointerup',e=>{if(!pointer||pointer.id!==e.pointerId)return;const old=pointer;pointer=null;
 if(moved)return;const rect=cv.getBoundingClientRect(),dim=dimensions();const worldX=state.cam+(e.clientX-rect.left)*dim.w/(rect.width*dim.sc);const worldY=(e.clientY-rect.top)*dim.h/(rect.height*dim.sc)-(dim.h-WORLD_H*dim.sc)/(2*dim.sc);
 const chosen=roles.filter(a=>Math.abs(a.x-worldX)<Math.max(25,a.height/3)&&worldY>=a.y-a.height&&worldY<a.y+15).sort((a,b)=>Math.abs(a.x-worldX)-Math.abs(b.x-worldX))[0];
 if(chosen){state.selected=chosen.id;$('detailName').textContent=chosen.name;$('detail').hidden=false;draw()}
});
cv.addEventListener('pointercancel',()=>pointer=null);
window.addEventListener('resize',draw);
window.addEventListener('visibilitychange',()=>{state.lastTime=performance.now()});
window.__phase5QA={state,roles,images,failed,dimensions,lightingAmount,chooseGoal};
initialize().catch(e=>{$('busy').textContent='โหลดไม่สำเร็จ: '+String(e);notify(e.stack||e.message)});
})();
