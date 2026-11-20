/* Tower RPG v122: reuses CarrotGame for slicing, adds stirring and serving. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CookGame=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function stepsFor(id='work',tier=1,day=1){const sets=[['chop','stir','serve'],['stir','serve'],['chop','serve'],['chop','stir']];let h=0;for(const c of id+':'+day)h=(Math.imul(h,31)+c.charCodeAt(0))>>>0;const s=sets[h%sets.length];return tier>=3?['chop','stir','serve']:s;}
function open(opts={}){if(typeof document==='undefined')throw Error('UI required');const steps=opts.steps||stepsFor(opts.recipeId,opts.recipeTier,opts.day);const tol=clamp(opts.tolerance||1,.55,2.2);let i=0,scores=[],closed=false;
 const done=()=>{if(closed)return;closed=true;const avg=Math.round(scores.reduce((a,b)=>a+b,0)/Math.max(1,scores.length)*3);opts.onDone?.(clamp(avg,0,9),false);};
 const skip=()=>{if(closed)return;closed=true;opts.onDone?.(4,true);};
 function next(score){scores.push(clamp(score,0,3));i++;if(i>=steps.length)done();else run();}
 function run(){const name=steps[i];if(name==='chop'){
  globalThis.CarrotGame.open({tolerance:tol,ingredient:opts.ingredient,ingredientImage:opts.ingredientImage,onDone:(s,skipped)=>{if(skipped){skip();return;}next(Math.round(s/3));}});return;}
  const div=document.createElement('div');div.className='lg-overlay lg-cook-steps';div.style.cssText='background:#23190f;flex-direction:column;gap:14px;touch-action:none';
  div.innerHTML=`<h2 style="color:#e9c16f;margin:0">${i+1}/${steps.length} ${name==='stir'?'คนหรือผัด':'จับเวลาเสิร์ฟ'}</h2><p class="cook-hint" style="text-align:center">${name==='stir'?'แตะจุดทองตามที่วิ่งรอบกระทะ':'แตะเมื่อแถบความสุกอยู่ในช่องทอง'}</p><div style="flex:1;min-height:220px;width:min(620px,100%);position:relative"><img alt="" class="cook-art" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none"><canvas style="position:absolute;inset:0;width:100%;height:100%;touch-action:none"></canvas></div><button class="lg-btn lg-primary cook-hit" style="text-align:center;max-width:450px">แตะจังหวะ</button><button class="lg-btn cook-skip" style="text-align:center;max-width:450px">ข้าม (ทำแบบปกติ) · 4 ดาว</button>`;
  document.body.appendChild(div);const cv=div.querySelector('canvas'),ctx=cv.getContext('2d'),pic=div.querySelector('img'),url=name==='stir'?'cook_pan.webp':'cook_plate.webp';pic.onload=()=>pic.style.display='block';pic.onerror=()=>pic.style.display='none';pic.src=url+'?art=124';
  let start=performance.now(),raf=0,hits=0,total=0,lastTarget=0,phase=0,finished=false;
  const release=(score)=>{if(finished)return;finished=true;cancelAnimationFrame(raf);div.remove();next(score);};
  const act=e=>{if(e)e.preventDefault();if(finished)return;const p=(performance.now()-start)/1000;
   if(name==='stir'){const mark=Math.floor((p*1.45)%8);const ok=(mark===((hits*3)%8));total+=ok?3:mark===((hits*3+1)%8)?1:0;hits++;if(hits>=5)release(Math.round(total/5));}
   else{const x=((p*.34)%2);const v=x<1?x:2-x;release(Math.abs(v-.72)<.08*tol?3:Math.abs(v-.72)<.18*tol?2:0);}
  };
  cv.addEventListener('pointerdown',act);div.querySelector('.cook-hit').addEventListener('pointerdown',act);div.querySelector('.cook-skip').onclick=()=>{finished=true;cancelAnimationFrame(raf);div.remove();skip();};
  function draw(t){if(finished)return;const rect=cv.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);if(Math.abs(cv.width-rect.width*d)>2){cv.width=Math.max(1,Math.round(rect.width*d));cv.height=Math.max(1,Math.round(rect.height*d));}
   const W=cv.width,H=cv.height,p=(t-start)/1000;ctx.clearRect(0,0,W,H);ctx.fillStyle='rgba(26,20,12,.45)';ctx.fillRect(0,0,W,H);
   if(name==='stir'){const radius=Math.min(W,H)*.26,cx=W/2,cy=H/2;ctx.strokeStyle='#997254';ctx.lineWidth=18;ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.stroke();for(let j=0;j<8;j++){let a=j/8*Math.PI*2,x=cx+Math.cos(a)*radius,y=cy+Math.sin(a)*radius;ctx.fillStyle=j===((hits*3)%8)?'#ffd06c':'#867361';ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fill();}
   let a=(Math.floor(p*1.45)%8)/8*Math.PI*2;ctx.fillStyle='#f5efd9';ctx.beginPath();ctx.arc(cx+Math.cos(a)*radius,cy+Math.sin(a)*radius,8,0,Math.PI*2);ctx.fill();}
   else{const x=(p*.34)%2,v=x<1?x:2-x;ctx.fillStyle='#6d5941';ctx.fillRect(W*.15,H*.43,W*.7,H*.13);ctx.fillStyle='#eac368';ctx.fillRect(W*(.15+.7*(.72-.08*tol)),H*.40,W*.7*.16*tol,H*.19);ctx.fillStyle='#fff';ctx.fillRect(W*(.15+.7*v)-3,H*.38,6,H*.23);}
   raf=requestAnimationFrame(draw);}
  raf=requestAnimationFrame(draw);
 }
 run();return {steps};
}
return {stepsFor,open};
});
