/* Conservative, optional edge-detail recovery for the softer background layers.
   Originals stay intact. Work is tiled and scheduled after the town becomes usable. */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CityVisuals=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const cache=new WeakMap(), pending=new WeakMap();
  const TILE=384, MAX_PIXELS=5000000, STRENGTH=.22, LIMIT=12, THRESHOLD=8;
  function resolve(image){return cache.get(image)||image}
  function adjustPixels(imageData,region){
    const data=imageData.data,w=imageData.width,h=imageData.height,original=new Uint8ClampedArray(data);
    const x0=Math.max(1,region.x),y0=Math.max(1,region.y);
    const x1=Math.min(w-1,region.x+region.width),y1=Math.min(h-1,region.y+region.height);
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const i=(y*w+x)*4, n=i-w*4, s=i+w*4, l=i-4, r=i+4;
      // Preserve semitransparent edges: no coloured outlines around cut-outs.
      if(original[i+3]<252||original[n+3]<252||original[s+3]<252||original[l+3]<252||original[r+3]<252)continue;
      for(let c=0;c<3;c++){
        const edge=4*original[i+c]-original[n+c]-original[s+c]-original[l+c]-original[r+c];
        if(Math.abs(edge)<THRESHOLD)continue;
        const delta=Math.max(-LIMIT,Math.min(LIMIT,edge*STRENGTH));
        data[i+c]=Math.max(0,Math.min(255,Math.round(original[i+c]+delta)));
      }
    }
    return imageData;
  }
  function makeJob(img){
    if(typeof document==='undefined'||typeof document.createElement!=='function'||!img)return null;
    // Never cache an empty canvas if a caller supplies an image still loading.
    if('complete' in img&&!img.complete)return null;
    const w=img.naturalWidth||img.width||0,h=img.naturalHeight||img.height||0;
    if(!w||!h||w*h>MAX_PIXELS)return null;
    const output=document.createElement('canvas'),scratch=document.createElement('canvas');
    if(!output||!scratch||typeof output.getContext!=='function'||typeof scratch.getContext!=='function')return null;
    output.width=w;output.height=h;
    const out=output.getContext('2d'),ctx=scratch.getContext('2d',{willReadFrequently:true});
    if(!out||!ctx||typeof ctx.getImageData!=='function'||typeof out.putImageData!=='function')return null;
    return {img,w,h,output,out,scratch,ctx,x:0,y:0};
  }
  function processTile(job){
    const x=job.x,y=job.y,tw=Math.min(TILE,job.w-x),th=Math.min(TILE,job.h-y);
    const left=Math.max(0,x-1),top=Math.max(0,y-1),right=Math.min(job.w,x+tw+1),bottom=Math.min(job.h,y+th+1);
    const sw=right-left,sh=bottom-top;job.scratch.width=sw;job.scratch.height=sh;
    job.ctx.drawImage(job.img,left,top,sw,sh,0,0,sw,sh);
    const pixels=job.ctx.getImageData(0,0,sw,sh);
    adjustPixels(pixels,{x:x-left,y:y-top,width:tw,height:th});
    job.out.putImageData(pixels,left,top,x-left,y-top,tw,th);
    job.x+=TILE;if(job.x>=job.w){job.x=0;job.y+=TILE}return job.y>=job.h;
  }
  function schedule(fn){
    if(typeof requestIdleCallback==='function')requestIdleCallback(fn,{timeout:150});
    else if(typeof setTimeout==='function')setTimeout(fn,0);
    else Promise.resolve().then(fn);
  }
  function prepare(img){
    if(!img)return Promise.resolve(img);
    if(cache.has(img))return Promise.resolve(cache.get(img));
    if(pending.has(img))return pending.get(img);
    let job;
    try{job=makeJob(img)}catch(e){return Promise.resolve(img)}
    if(!job)return Promise.resolve(img);
    const promise=new Promise(done=>{
      function step(){
        try{
          if(processTile(job)){cache.set(img,job.output);done(job.output);return}
          schedule(step);
        }catch(e){done(img)}
      }
      schedule(step);
    });
    pending.set(img,promise);return promise;
  }
  function start(images){
    return (images||[]).reduce((p,img)=>p.then(()=>prepare(img)),Promise.resolve());
  }
  return {resolve,prepare,start,adjustPixels};
});
