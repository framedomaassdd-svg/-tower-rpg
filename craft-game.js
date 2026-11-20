/* Tower RPG v122: stable job stars + uniform mobile minigame entry. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CraftGame=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function stars(value,skipped=false){return skipped?4:clamp(Math.round(Number(value)||0),0,9);}
function modifiers(value,skipped=false){const s=stars(value,skipped);return {stars:s,skipped:!!skipped,chance:s<=2?-.10:s<=5?0:s<=8?.08:.12,quality:s<=2?-1:0,affix:s>=6&&s<=8?.05:0,duration:s===9?1.25:1};}
function probability(base,value,skipped=false){return clamp(base+modifiers(value,skipped).chance,.05,.95);}
// Chance that a FAILED recipe is completely destroyed (not a second success roll).
// Harder recipes and poor minigame results increase total loss; even 9 stars have some risk.
function catastrophicRate(recipeTier=1,value=4,skipped=false){
 const s=stars(value,skipped),tier=clamp(Math.floor(Number(recipeTier)||1),1,5);
 return clamp(.12+.06*(tier-1)+(s<=2?.18:s>=9?-.12:s>=6?-.07:0),.03,.70);
}
function tolerance(proficiency=1,recipeTier=1,base=1){return clamp(base*(1+Math.max(0,proficiency-1)*.13)/(1+Math.max(0,recipeTier-1)*.12),.55,2.2);}
function key(st,kind,order){return [Math.max(1,st.day||1),kind,order?.recipe||order?.kind||'work'].join(':');}
function sessions(st){if(!st.life)throw new Error('life required');if(!st.life.craftSessions||typeof st.life.craftSessions!=='object')st.life.craftSessions={};return st.life.craftSessions;}
// A started session is saved with a neutral four-star fallback. Refreshing cannot replay it.
function begin(st,kind,order){const k=key(st,kind,order),s=sessions(st);if(s[k])return {key:k,recovered:true,record:s[k]};s[k]={stars:4,skipped:true,status:'started',day:st.day};return {key:k,recovered:false,record:s[k]};}
function commit(st,k,value,skipped){const s=sessions(st);if(!s[k]||s[k].status==='done')return s[k]||null;Object.assign(s[k],modifiers(value,skipped),{status:'done'});return s[k];}
function get(st,kind,order){return sessions(st)[key(st,kind,order)]||null;}
function open(kind,opts={}){if(typeof document==='undefined')throw new Error('UI not available');const root=typeof globalThis!=='undefined'?globalThis:{};
 const done=(s,k)=>opts.onDone?.({stars:stars(s,k),skipped:!!k});
 if(kind==='smith'||kind==='forge')return root.SmithGame.open({...opts,onDone:done});
 if(kind==='kitchen'||kind==='cook')return root.CookGame.open({...opts,onDone:done});
 if(kind==='alchemy')return root.AlchemyGame.open({...opts,onDone:done});
 throw Error('Unknown craft kind '+kind);
}
return {stars,modifiers,probability,catastrophicRate,tolerance,key,sessions,begin,commit,get,open};
});
