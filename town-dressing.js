/* v69 town dressing: fills the empty frontage with the new painted buildings and props.
   Everything here is appended to sceneObjects from index.html, so depth sorting, shadows and
   collision (for buildings) keep working. Props never sit on the walkable road (y ≥ 765). */
(function (root) {
  'use strict';
  // [file, x, footY, width, options]
  //  footY is where the bottom of the image touches the ground (the sidewalk is 736–800, road from ~800)
  const BUILDINGS = [];   // the trade hall replaces restaurant_big in place (see install)
  const PROPS = [
    // --- market (0–665)
    ['props__crate.webp', 605, 752, 46], ['props__barrel.webp', 650, 758, 30],
    ['props__flower_planter.webp', 470, 758, 80],
    // --- guild (735–1305)
    ['props__market_set__guild_board.webp', 1180, 764, 78], ['props__barrel.webp', 745, 758, 30], ['props__crate.webp', 770, 752, 40],
    // --- restaurant (1490–1980)
    ['props__market_set__inn_table.webp', 1850, 766, 120], ['props__plant_pot.webp', 1500, 760, 34], ['props__flower_planter.webp', 1700, 758, 70],
    // --- tower plaza edges (1980–2880)
    ['props__plant_pot.webp', 1990, 760, 36], ['props__plant_pot.webp', 2840, 760, 36],
    ['props__signpost.webp', 2740, 760, 62],
    // --- housing (2880–4035)
    ['props__firewood.webp', 3215, 758, 70], ['props__clothesline.webp', 3690, 756, 110], ['props__barrel.webp', 3480, 758, 30],
    ['props__flower_planter.webp', 3300, 758, 66], ['props__crate.webp', 3950, 752, 40], ['props__plant_pot.webp', 4000, 760, 30],
    ['props__lamp.webp', 2890 - 32, 754, 64],
    // --- inn (4035–4465)
    ['props__bench_clean.webp', 4350, 760, 100], ['props__flower_planter.webp', 4060, 758, 64],
    // --- trade hall / smithy (4465–5960)
    ['props__market_set__handcart.webp', 5080, 756, 120], ['props__market_set__sacks.webp', 5200, 758, 44],
    ['props__crate.webp', 5230, 752, 36], ['props__barrel.webp', 5940, 758, 32], ['props__firewood.webp', 5985, 758, 70],
    ['props__lamp.webp', 5180 - 32, 754, 64],
    // --- gate approach (5960–6380)
    ['props__signpost.webp', 6300, 760, 62], ['props__flower_planter.webp', 6130, 758, 70], ['props__lamp.webp', 6600, 754, 64]
  ];
  const FOOT = { 'props__barrel.webp': 72 / 527, 'props__flower_planter.webp': 42 / 600, 'props__clothesline.webp': 7 / 600,
    'props__firewood.webp': 74 / 600, 'props__plant_pot.webp': 61 / 598, 'props__lamp.webp': 2 / 301, 'props__crate.webp': 0.03, 'props__signpost.webp': 0.02 };

  function install(sceneObjects, sceneAssetUrl) {
    const mk = (file, x, y, width, extra) => {
      const image = new Image(); image.src = sceneAssetUrl(file);
      return Object.assign({ image, src: file.replace(/__/g, '/'), x, y, width }, extra || {});
    };
    const swap = (src, file, x, width) => { const o = sceneObjects.find(o => o.src === src); if (!o) return; o.image = new Image(); o.image.src = sceneAssetUrl(file); if (x !== undefined) o.x = x; if (width) o.width = width; o.footInset = 0.01; };
    swap('buildings/inn.webp', 'buildings__inn_grand.webp', 4015, 470);            // small inn → grand inn
    swap('buildings/restaurant_big.webp', 'buildings__trade_hall.webp', 4455, 640); // second restaurant → trade hall (one restaurant is enough)
    const hs = sceneObjects.find(o => o.src === 'buildings/home_small.webp'); if (hs) { hs.x = 5075; hs.width = 250; }
    for (const [f, x, y, w] of PROPS) sceneObjects.push(mk(f, x, y, w, { footInset: FOOT[f] || 0 }));
  }
  root.TownDressing = { install, BUILDINGS, PROPS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
