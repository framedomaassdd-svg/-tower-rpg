/* Tower RPG v122: touch-first, silent, three-step alchemy. Optional illustration assets. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.AlchemyGame=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function grade(error,width){return error<=width*.35?3:error<=width?2:error<=width*1.7?1:0;}
function requiredIngredients(recipe,items){return Object.keys(recipe?.needs||{}).filter(k=>items?.[k]).slice(0,3);}
function open(opts={}){
 if(typeof document==='undefined')throw new Error('UI required');
 const tol=clamp(opts.tolerance||1,.55,2.2),recipe=opts.recipe||{},items=opts.items||{};
 const ingredients=requiredIngredients(recipe,items),names=ingredients.length?ingredients:['สมุนไพร','ส่วนผสม','น้ำสะอาด'];
 const form=recipe.form==='tablet'?'tablet':'liquid';let stage=0,scores=[],over=false,finished=false;
 const shell=document.createElement('div');shell.className='lg-overlay lg-alchemygame';shell.style.cssText='flex-direction:column;gap:12px;background:#171d24;touch-action:none;overflow:auto';
 shell.innerHTML='<div style="width:min(660px,100%);display:flex;justify-content:space-between;gap:8px"><strong class="ag-title"></strong><span class="ag-score"></span></div>'+
 '<div class="ag-view" style="width:min(660px,100%);position:relative;min-height:240px;flex:1;border-radius:15px;overflow:hidden;background:#283530"><img class="ag-art" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none"><canvas style="position:absolute;inset:0;width:100%;height:100%;touch-action:none"></canvas></div>'+
 '<p class="ag-hint" style="margin:0;min-height:48px;text-align:center"></p><div class="ag-bottles" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"></div>'+
 '<button class="lg-btn ag-action lg-primary" style="max-width:440px;text-align:center;touch-action:none"></button><button class="lg-btn ag-skip" style="max-width:440px;text-align:center">ข้าม (ทำแบบปกติ) · 4 ดาว</button>';
 document.body.appendChild(shell);
 const $=s=>shell.querySelector(s),canvas=$('canvas'),g=canvas.getContext('2d'),art=$('.ag-art');
 const images=['alchemy_mortar.webp','alchemy_cauldron.webp','alchemy_drops.webp'];let now=()=>performance.now();
 let stageStart=now(),last=now(),hits=0,target=clamp(Math.round(7/tol),4,12),limit=target+Math.max(2,Math.ceil(target*.45)),lastSide=null;
 let heat=.15,holding=false,goodTime=0,elapsed=0,order=[],dropIndex=0,dropHits=[],bubble=0,frame=0;
 const end=(s,skipped)=>{if(finished)return;finished=true;cancelAnimationFrame(frame);window.removeEventListener('pointerup',release);window.removeEventListener('pointercancel',release);window.removeEventListener('resize',size);shell.remove();opts.onDone?.(skipped?4:clamp(Math.round(s),0,9),!!skipped);};
 function size(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));}
 function start(i){stage=i;stageStart=now();last=stageStart;hits=0;lastSide=null;goodTime=0;elapsed=0;heat=.15;holding=false;dropIndex=0;dropHits=[];
  const a=$('.ag-action'),b=$('.ag-bottles');b.innerHTML='';
  if(i===0){$('.ag-title').textContent='1/3 บดสมุนไพร';$('.ag-hint').textContent='แตะสลับซ้าย–ขวาครก '+target+' ครั้ง อย่าบดเกินเส้น';a.textContent='บดให้พอดี แล้วแตะ เสร็จสิ้น';a.disabled=false;}
  if(i===1){$('.ag-title').textContent='2/3 คุมไฟ';$('.ag-hint').textContent='กดค้างเพิ่มไฟ ปล่อยให้ไฟอ่อน รักษาเข็มในช่องสีเขียว';a.disabled=false;a.textContent='กดค้างเพื่อเพิ่มไฟ';}
  if(i===2){$('.ag-title').textContent='3/3 หยดส่วนผสม';$('.ag-hint').textContent='แตะขวดตามลำดับชื่อที่แสดง และรอจังหวะฟองสีเขียว';a.disabled=true;a.textContent='แตะขวดตามลำดับ';
   order=names.slice();for(let j=0;j<order.length;j++){const k=order[j],btn=document.createElement('button');btn.className='lg-btn';btn.style.cssText='width:auto;max-width:200px;font-size:13px;touch-action:manipulation';btn.textContent=(items[k]?.name||k);btn.addEventListener('pointerdown',e=>{e.preventDefault();drop(j);});b.appendChild(btn);}}
  $('.ag-score').textContent='★ '+scores.reduce((a,b)=>a+b,0)+'/9';art.style.display='none';art.src=images[i]+'?art=124';art.onload=()=>{if(stage===i)art.style.display='block';};art.onerror=()=>{art.style.display='none';};size();
 }
 function next(score){scores.push(clamp(score,0,3));if(stage===2){end(scores.reduce((a,b)=>a+b,0),false);}else start(stage+1);}
 function grind(e){if(stage!==0)return;const r=canvas.getBoundingClientRect(),side=e.clientX-r.left<r.width/2?'L':'R';if(side===lastSide)return;lastSide=side;hits++;
 if(hits>limit){next(0);}
 }
 function drop(j){if(stage!==2)return;const idx=dropIndex;if(j!==idx){dropHits.push(0);return;}const p=(now()-stageStart)/1150;const sweet=Math.sin(p*2*Math.PI)>.35;dropHits.push(sweet?3:1);dropIndex++;
 if(dropIndex>=order.length)next(clamp(Math.round(dropHits.reduce((a,b)=>a+b,0)/dropHits.length),0,3));else $('.ag-hint').textContent='ต่อไป: '+(items[order[dropIndex]]?.name||order[dropIndex]);
 }
 const action=$('.ag-action');action.addEventListener('pointerdown',e=>{e.preventDefault();if(stage===0){const time=(now()-stageStart)/1000;next(hits<target?0:hits>target+1?1:time<=9*tol?3:time<=14*tol?2:1);}else if(stage===1)holding=true;});
 function release(){holding=false;}window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);
 canvas.addEventListener('pointerdown',e=>{e.preventDefault();if(stage===0)grind(e);else if(stage===0){const time=(now()-stageStart)/1000;next(hits<target?0:hits>target+1?1:time<=9*tol?3:time<=14*tol?2:1);}else if(stage===1)holding=true;});
 $(' .ag-skip'.trim()).addEventListener('click',()=>end(4,true));
 function draw(t){if(finished)return;const dt=Math.min(.06,(t-last)/1000||0);last=t;sizeWhenNeeded();const W=canvas.width,H=canvas.height;
 g.clearRect(0,0,W,H);g.fillStyle='rgba(11,18,20,.40)';g.fillRect(0,0,W,H);
 if(stage===0){if((t-stageStart)>20000*tol){next(0);return;}const cx=W/2,cy=H*.62,r=Math.min(W,H)*.3;g.fillStyle='#8a786a';g.beginPath();g.ellipse(cx,cy,r,r*.53,0,0,Math.PI*2);g.fill();g.fillStyle='#4b6352';g.beginPath();g.ellipse(cx,cy,r*.77,r*.4,0,0,Math.PI*2);g.fill();g.fillStyle='#d6bc7d';g.font=`${Math.max(18,W*.04)}px system-ui`;g.textAlign='center';g.fillText(hits+'/'+target+' ครั้ง',cx,H*.25);g.fillStyle='#8ed6a2';g.fillRect(W*.18,H*.9,W*.64*Math.min(1,hits/limit),H*.035);}
 if(stage===1){heat=clamp(heat+(holding?.48:-.30)*dt,0,1);elapsed+=dt;const width=(form==='tablet'?.09:.15)*tol,center=.63;
  if(Math.abs(heat-center)<=width)goodTime+=dt;const goal=form==='tablet'?2.8:4.2;if(goodTime>=goal)next(elapsed<goal*2?3:2);
  else if(elapsed>18)next(goodTime>goal*.5?1:0);
  g.fillStyle='#7b483a';g.fillRect(W*.18,H*.49,W*.64,H*.20);g.fillStyle='#e8c68c';g.fillRect(W*.18,H*.64,W*.64,H*.05);g.fillStyle='#65c68b';g.fillRect(W*(.18+.64*(center-width)),H*.47,W*.64*2*width,H*.26);
  g.fillStyle='#ffdf93';g.fillRect(W*(.18+.64*heat)-3,H*.42,6,H*.32);g.fillStyle='#fff';g.font=`${Math.max(17,W*.035)}px system-ui`;g.textAlign='center';g.fillText('คุมไฟ '+goodTime.toFixed(1)+' / '+goal.toFixed(1)+' วินาที',W/2,H*.27);
 }
 if(stage===2){const bubble=Math.sin((t-stageStart)/1150*Math.PI*2);g.fillStyle=bubble>.35?'#7de7a1':'#96a5a5';g.beginPath();g.arc(W/2,H*.55,Math.min(W,H)*(.08+bubble*.03),0,Math.PI*2);g.fill();g.font=`${Math.max(17,W*.035)}px system-ui`;g.fillStyle='#fff';g.textAlign='center';g.fillText((dropIndex+1)+' / '+order.length,W/2,H*.28);}
 frame=requestAnimationFrame(draw);
 }
 function sizeWhenNeeded(){const r=canvas.getBoundingClientRect();if(Math.abs(canvas.width-r.width*Math.min(devicePixelRatio||1,2))>3)size();}
 window.addEventListener('resize',size);start(0);frame=requestAnimationFrame(draw);return {root:shell};
}
return {open,grade,requiredIngredients};
});
