/* Hero look (v126): the hero's art follows the origin rolled at the start of a life — 8 origins × 2 sexes.
   Art for a look lives in hero/<look>/ with the same file names as the default hero
   (hero/chef_f/npc5_heroA.webp …). Any file a look does not have yet falls back to the default hero,
   so looks can be delivered one sheet at a time. HeroLook.set(look) swaps every registered image. */
(function (root) {
  'use strict';
  const hasImage = typeof Image !== 'undefined';
  const ORIGIN_IDS = ['office', 'chef', 'craft', 'jobless', 'police', 'soldier', 'thief', 'boxer'];
  const LOOKS = ORIGIN_IDS.flatMap(o => [o + '_m', o + '_f']);
  const reg = [];                       // {img, file, ver}
  let cur = 'default';
  // v127 start on the saved hero's look, so art created while scripts load is not fetched twice
  try { const L = typeof localStorage !== 'undefined' && JSON.parse(localStorage.getItem('towerLife') || '{}').life;
    if (L && L.sex && LOOKS.includes(L.origin + '_' + L.sex)) cur = L.origin + '_' + L.sex; } catch (e) {}
  const src = (file, ver, look) => (look && look !== 'default' ? 'hero/' + look + '/' : '') + file + (ver ? '?v=' + ver : '');
  function point(e) {
    const want = src(e.file, e.ver, cur);
    e.fallback = false;
    e.img.onerror = cur === 'default' ? null : () => { if (e.img.onerror) { e.img.onerror = null; e.fallback = true; e.img.src = src(e.file, e.ver); } };
    e.img.src = want;
  }
  // An Image for one of the hero's files; it follows the current look.
  function img(file, ver) {
    if (!hasImage) return null;
    const e = { img: new Image(), file, ver };
    reg.push(e); point(e);
    return e.img;
  }
  function set(look) {
    look = LOOKS.includes(look) ? look : 'default';
    if (look === cur) return false;
    cur = look;
    for (const e of reg) point(e);
    return true;
  }
  // true when the current look has its own copy of this file (baked room art is only used for the default hero)
  const own = image => { const e = reg.find(r => r.img === image); return !!e && (cur === 'default' || (!e.fallback && e.img.complete && e.img.naturalWidth > 0)); };
  const get = file => { const e = reg.find(r => r.file === file); return e ? e.img : null; };
  root.HeroLook = { img, get, set, own, current: () => cur, LOOKS, ORIGIN_IDS, isDefault: () => cur === 'default' };
})(typeof window !== 'undefined' ? window : globalThis);
