/* Time of day and inexpensive 2D scene lighting. Clock uses the town's 0–20 cycle. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CityLighting = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAY_UNITS = 20, REAL_SECONDS_PER_DAY = 120;
  const SPEEDS = Object.freeze([1, 2, 4, 6]);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const phases = [
    // clock, multiply colour, tint strength, lamps, stars
    [0,  [43, 57, 96],  .64, 1,    .9],
    [3.5,[43, 57, 96],  .64, 1,    .9],
    [4.4,[95, 99, 132], .51, .8,   .3],
    [5.1,[234,155,112], .22, .3,   0],
    [6.8,[255,229,189], .045,0,    0],
    [10, [255,255,255], 0,   0,    0],
    [13.5,[255,219,171],.055,0,    0],
    [15, [238,151,107], .25, .2,   0],
    [16, [156,103,122], .43, .7,   .15],
    [17.2,[43,57,96],   .64, 1,    .9],
    [20, [43, 57, 96],  .64, 1,    .9]
  ];
  function normalClock(clock) {
    const n = Number.isFinite(clock) ? clock : 0;
    return ((n % DAY_UNITS) + DAY_UNITS) % DAY_UNITS;
  }
  function sample(clock) {
    const c = normalClock(clock);
    let a = phases[0], b = phases[phases.length-1];
    for (let i=1; i<phases.length; i++) if (c < phases[i][0]) {a=phases[i-1];b=phases[i];break}
    const f = (c-a[0])/(b[0]-a[0]), mix=(x,y)=>x+(y-x)*f;
    const h=c*24/DAY_UNITS;
    const sunlight=clamp(Math.sin((h-5.3)/13.5*Math.PI),0,1)*(1-mix(a[3],b[3])*.7);
    return {clock:c, colour:a[1].map((v,i)=>Math.round(mix(v,b[1][i]))),
      tint:mix(a[2],b[2]), lamps:mix(a[3],b[3]), stars:mix(a[4],b[4]),
      sunlight, shadowDirection:clamp((12-h)/6,-1,1)};
  }
  function gameMinutes(clock) {return Math.floor(normalClock(clock)*72)}
  function timeText(clock) {
    const m=Math.floor(gameMinutes(clock)/10)*10, hh=String(Math.floor(m/60)).padStart(2,'0'), mm=String(m%60).padStart(2,'0');
    return hh+':'+mm;
  }
  function phaseText(clock) {
    const h=normalClock(clock)*24/DAY_UNITS;
    if(h>=5&&h<9)return 'เช้า';
    if(h>=9&&h<16)return 'กลางวัน';
    if(h>=16&&h<19)return 'เย็น';
    return 'กลางคืน';
  }
  function validSpeed(speed) {return SPEEDS.includes(speed)?speed:1}
  function nextSpeed(speed) {return SPEEDS[(SPEEDS.indexOf(validSpeed(speed))+1)%SPEEDS.length]}
  function clockDelta(realSeconds, speed) {
    return Math.max(0, Number.isFinite(realSeconds)?realSeconds:0)*validSpeed(speed)*DAY_UNITS/REAL_SECONDS_PER_DAY;
  }
  // Contact and directional shadows follow the sun. They do not change collision.
  function actorShadow(ctx,x,y,scale,clock) {
    const l=sample(clock), shift=23*l.shadowDirection*l.sunlight*scale;
    ctx.save();ctx.fillStyle=`rgba(24,29,40,${(.08+.12*l.sunlight).toFixed(3)})`;
    ctx.beginPath();ctx.ellipse(x+shift,y+1,(27+Math.abs(shift))*scale,7*scale,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(24,26,31,.21)';ctx.beginPath();ctx.ellipse(x,y-1,22*scale,5*scale,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function propShadow(ctx,x,y,width,clock) {
    const l=sample(clock),shift=10*l.shadowDirection*l.sunlight;
    ctx.save();ctx.fillStyle=`rgba(26,32,40,${(.08+.06*l.sunlight).toFixed(3)})`;ctx.beginPath();
    ctx.ellipse(x+shift,y+1,Math.max(7,width*.32+Math.abs(shift)),Math.min(5,Math.max(2,width*.04)),0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  // A faint, flattened ground shadow joins each facade to the pavement.
  function buildingShadows(ctx,objects,camera,width,clock) {
    const light=sample(clock); if(light.sunlight<.04)return;
    const shift=35*light.shadowDirection, depth=18+14*Math.abs(light.shadowDirection);
    ctx.save();ctx.fillStyle=`rgba(27,31,38,${(.055*light.sunlight).toFixed(3)})`;
    for(const o of objects){
      if(!(o.src.startsWith('buildings/')||o.src.startsWith('buildings__'))||o.y<740||o.src.includes('alley_view'))continue;
      if(o.x+o.width<camera-60||o.x>camera+width+60)continue;
      const left=o.x+o.width*.08,right=o.x+o.width*.92;
      ctx.beginPath();ctx.moveTo(left,o.y);ctx.lineTo(right,o.y);ctx.lineTo(right+shift,o.y+depth);ctx.lineTo(left+shift,o.y+depth);ctx.closePath();ctx.fill();
    }
    ctx.restore();
  }
  // Sky points are seeded by index, so they stay fixed when the camera moves.
  function stars(ctx,camera,width,clock,outside) {
    const alpha=sample(clock).stars*.70;if(alpha<.01)return;
    const extent=outside?3240:7500;
    ctx.save();ctx.fillStyle=`rgba(230,238,255,${alpha.toFixed(3)})`;
    for(let i=0;i<125;i++){
      const x=(i*1831+181)%extent, y=18+(i*83+i*i*17)%178;
      if(x<camera-2||x>camera+width+2)continue;
      const radius=i%11===0?1.8:1.05;
      ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  let halo;
  function haloCanvas() {
    if(halo!==undefined)return halo;
    halo=null;
    if(typeof document==='undefined'||typeof document.createElement!=='function')return halo;
    const c=document.createElement('canvas');c.width=c.height=256;
    const g=c.getContext('2d');if(!g||typeof g.createRadialGradient!=='function')return halo;
    const grad=g.createRadialGradient(128,128,0,128,128,128);
    grad.addColorStop(0,'rgba(255,217,139,.8)');
    grad.addColorStop(.16,'rgba(255,189,93,.37)');
    grad.addColorStop(.5,'rgba(255,153,60,.12)');
    grad.addColorStop(1,'rgba(255,149,48,0)');
    g.fillStyle=grad;g.fillRect(0,0,256,256);halo=c;return halo;
  }
  const BUILDING_LIGHTS={
    'buildings/shop.png':[[.455,.75,60],[.605,.75,60]],
    'buildings/guild.png':[[.51,.715,65],[.735,.715,65],[.385,.74,42],[.82,.74,42],[.62,.24,38]],
    'buildings/restaurant.png':[[.86,.70,38]],
    'buildings/inn.png':[[.405,.76,65],[.665,.76,65]],
    'buildings/restaurant_big.png':[[.52,.77,60],[.70,.77,60],[.16,.84,85]],
    'buildings__blacksmith_v51.png':[[.43,.69,160],[.86,.56,65]],
    'buildings__city_gate_v49.png':[[.28,.59,78],[.72,.59,78]]
  };
  let cachedObjects, cachedLights;
  function sceneLights(objects) {
    if(objects===cachedObjects && cachedLights)return cachedLights;
    const lights=[];
    for(const o of objects||[]){
      const img=o.image;if(!img||!img.complete||!img.naturalWidth)continue;
      const h=o.width*img.naturalHeight/img.naturalWidth, top=o.y-h;
      if(o.src==='props/lamp.png') lights.push([o.x+o.width*.5,top+h*.19,115,o.y-5]);
      const profile=BUILDING_LIGHTS[o.src];
      if(profile)for(const [x,y,r] of profile)lights.push([o.x+o.width*x,top+h*y,r]);
    }
    lights.push([2260,659,80],[2600,659,80]);
    cachedObjects=objects;cachedLights=lights;return lights;
  }
  function draw(ctx,camera,width,height,clock,opts) {
    opts=opts||{};const l=sample(clock);
    ctx.save();ctx.globalCompositeOperation='multiply';
    ctx.fillStyle=`rgba(${l.colour[0]},${l.colour[1]},${l.colour[2]},${l.tint.toFixed(4)})`;
    ctx.fillRect(camera,0,width,height);ctx.restore();
    if(l.lamps<.01)return;
    const glow=haloCanvas();if(!glow)return;
    const lights=opts.outside?[[344,522,78],[696,522,78]]:sceneLights(opts.objects);
    ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.8*l.lamps;
    for(const [x,y,r,ground] of lights){
      if(x+r<camera||x-r>camera+width)continue;
      ctx.globalAlpha=.8*l.lamps;ctx.drawImage(glow,x-r,y-r,2*r,2*r);
      if(ground!==undefined){ctx.globalAlpha=.28*l.lamps;ctx.drawImage(glow,x-r*1.1,ground-28,r*2.2,56)}
    }
    ctx.restore();
  }
  return {DAY_UNITS,REAL_SECONDS_PER_DAY,SPEEDS,sample,gameMinutes,timeText,phaseText,validSpeed,nextSpeed,clockDelta,actorShadow,propShadow,buildingShadows,stars,draw};
});
