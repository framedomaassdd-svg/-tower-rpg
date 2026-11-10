/* A small persistent town schedule. Positions and work state share one clock. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TownResidents=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const PEOPLE=Object.freeze([
  Object.freeze({id:'mali',name:'มะลิ',job:'พ่อค้าในตลาด',home:700,homeY:710,work:280,y:820,wage:5,image:'merchant'}),
  Object.freeze({id:'thana',name:'ธนา',job:'คนช่วยร้านอาหาร',home:1398,homeY:655,work:1760,y:850,wage:6,image:'worker'})
 ]);
 function ensure(s){if(!s.townResidents||typeof s.townResidents!=='object'||Array.isArray(s.townResidents))s.townResidents={};for(const p of PEOPLE){let r=s.townResidents[p.id];if(!r||typeof r!=='object'||Array.isArray(r))r={};s.townResidents[p.id]={coins:Number.isFinite(r.coins)?Math.max(0,Math.floor(r.coins)):8,shifts:Number.isFinite(r.shifts)?Math.max(0,Math.floor(r.shifts)):0,lastDay:Number.isFinite(r.lastDay)?Math.floor(r.lastDay):0};}return s.townResidents;}
 // Follow the passage out of the home before turning onto the main street.
 function route(p,progress){const vertical=p.y-p.homeY,horizontal=Math.abs(p.work-p.home),distance=(vertical+horizontal)*progress;if(distance<vertical)return {x:p.home,y:p.homeY+distance};return {x:p.home+Math.sign(p.work-p.home)*(distance-vertical),y:p.y};}
 function snapshot(p,clock){const sec=Math.max(0,Math.min(19.999,Number.isFinite(clock)?clock:0));let point,phase,moving,visible=true,face=1;if(sec<5){point={x:p.home,y:p.homeY};phase='พักที่บ้าน';moving=false;visible=false}else if(sec<7.5){point=route(p,(sec-5)/2.5);phase='เดินไปทำงาน';moving=true;face=Math.sign(p.work-p.home)}else if(sec<14){point={x:p.work,y:p.y};phase='ทำงาน';moving=false;face=p.id==='mali'?1:-1}else if(sec<17.5){point=route(p,1-(sec-14)/3.5);phase='เดินกลับ';moving=true;face=Math.sign(p.home-p.work)}else{point={x:p.home,y:p.homeY};phase='พักที่บ้าน';moving=false;visible=false;face=1}return {id:p.id,name:p.name,job:p.job,x:point.x,y:point.y,phase,moving,visible,face,frame:moving?Math.floor(sec*7)%4:0,image:p.image};}
 function snapshots(clock){return PEOPLE.map(p=>snapshot(p,clock))}
 function closeDay(s){const records=ensure(s);for(const p of PEOPLE){const r=records[p.id];if(r.lastDay<s.day){r.coins+=p.wage;r.shifts++;r.lastDay=s.day}}}
 return {PEOPLE,ensure,snapshot,snapshots,closeDay};
});
