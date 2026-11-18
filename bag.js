/* v93 กระเป๋าและไอเท็ม: what the hero carries, what it costs, how long it keeps, recipes, forging and gathering.
   The bag is a list of stacks { id, n, exp } on the save (st.bag). exp = the last day the stack is still good;
   at the night rollover into a later day it spoils. Pure data + small functions; LifeSim decides when they run. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Bag = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CAP = 20;                                   // items, not stacks
  // kind: meal (eaten for dinner / the night) · ingredient · material · tool (kept, gives a bonus) · goods (made to sell)
  // keep: days it stays good (0 = never spoils) · sell: what a buyer pays · heal: health when eaten
  const ITEMS = Object.freeze({
    ration:    { name: 'อาหารติดมือ',      icon: '🍙', kind: 'meal', keep: 2, sell: 0 },
    bread:     { name: 'ขนมปัง',            icon: '🍞', kind: 'meal', keep: 3, sell: 1 },
    riceball:  { name: 'ข้าวห่อใบตอง',      icon: '🍱', kind: 'meal', keep: 1, sell: 1 },
    jerky:     { name: 'ปลาแห้ง',           icon: '🐟', kind: 'meal', keep: 10, sell: 2 },
    fruit:     { name: 'ผลไม้ป่า',          icon: '🍎', kind: 'meal', keep: 4, sell: 1 },
    meal_veg:  { name: 'ข้าวต้มผัก',        icon: '🍲', kind: 'meal', keep: 1, sell: 0, heal: 3 },
    meal_fish: { name: 'ปลาย่างกับข้าว',    icon: '🍛', kind: 'meal', keep: 1, sell: 0, heal: 5 },
    meal_spice:{ name: 'ข้าวผัดเครื่องเทศ', icon: '🥘', kind: 'meal', keep: 1, sell: 0, heal: 4 },
    rice:      { name: 'ข้าวสาร',           icon: '🌾', kind: 'ingredient', keep: 30, sell: 0 },
    veg:       { name: 'ผักสด',             icon: '🥬', kind: 'ingredient', keep: 4, sell: 1 },
    fish:      { name: 'ปลาสด',             icon: '🐠', kind: 'ingredient', keep: 1, sell: 1 },
    spice:     { name: 'เครื่องเทศ',        icon: '🌶️', kind: 'ingredient', keep: 60, sell: 1 },
    herb:      { name: 'สมุนไพร',           icon: '🌿', kind: 'material', keep: 5, sell: 2 },
    junk:      { name: 'ของเก่าพอใช้ได้',   icon: '🏺', kind: 'material', keep: 0, sell: 2 },
    scrap:     { name: 'เศษเหล็ก',          icon: '🔩', kind: 'material', keep: 0, sell: 1 },
    iron:      { name: 'เหล็กแท่ง',         icon: '⬛', kind: 'material', keep: 0, sell: 3 },
    monster:   { name: 'ชิ้นส่วนมอนสเตอร์', icon: '🦴', kind: 'material', keep: 0, sell: 6 },   // the tower, later
    knife:     { name: 'มีดครัว',           icon: '🔪', kind: 'tool', keep: 0, sell: 5, desc: 'ทำอาหารได้เพิ่มอีก 1 ที่' },
    sickle:    { name: 'เคียว',             icon: '🌙', kind: 'tool', keep: 0, sell: 5, desc: 'เก็บของนอกประตูเมืองได้เพิ่ม 1 ชิ้น' },
    hook:      { name: 'ตะขอคุ้ยของ',       icon: '🪝', kind: 'tool', keep: 0, sell: 5, desc: 'คุ้ยลานของเก่าได้เพิ่ม 1 ชิ้น' },
    dagger:    { name: 'มีดสั้น',           icon: '🗡️', kind: 'goods', keep: 0, sell: 14 },
    // v94 parts for vehicles, and the vehicles themselves (kept in st.vehicles, not in the bag)
    oldwheel:  { name: 'ล้อเก่า',           icon: '🛞', kind: 'material', keep: 0, sell: 3 },
    chain:     { name: 'โซ่เก่า',           icon: '⛓️', kind: 'material', keep: 0, sell: 2 },
    plank:     { name: 'ไม้กระดาน',         icon: '🪵', kind: 'material', keep: 0, sell: 0 },
    horse:     { name: 'ม้า',              icon: '🐎', kind: 'vehicle', keep: 0, sell: 40, speed: 2.5, desc: 'เร็ว 2.5 เท่า ค่าอาหารม้าวันละ 1 เหรียญ' },
    bike:      { name: 'จักรยาน',           icon: '🚲', kind: 'vehicle', keep: 0, sell: 0, speed: 2.0, desc: 'เร็ว 2 เท่า ไม่ต้องเลี้ยง' },
    scooter:   { name: 'สกู๊ตเตอร์',         icon: '🛴', kind: 'vehicle', keep: 0, sell: 0, speed: 1.5, desc: 'เร็ว 1.5 เท่า ทำง่าย' }
  });
  // v100 item art: two 4×4 sheets of 128px cells (items_a/items_b.webp); missing art falls back to the emoji above
  const ICON_SHEETS = Object.freeze(['items_a.webp', 'items_b.webp']);
  const ICONS = Object.freeze({
    coin: [0, 0], ration: [0, 1], bread: [0, 2], riceball: [0, 3], jerky: [0, 4], fruit: [0, 5], meal_veg: [0, 6], meal_fish: [0, 7],
    meal_spice: [0, 8], rice: [0, 9], veg: [0, 10], fish: [0, 11], spice: [0, 12], herb: [0, 13], junk: [0, 14], scrap: [0, 15],
    iron: [1, 0], monster: [1, 1], knife: [1, 2], sickle: [1, 3], hook: [1, 4], dagger: [1, 5], sword: [1, 6], oldwheel: [1, 7],
    chain: [1, 8], plank: [1, 9], horse: [1, 10], bike: [1, 11], scooter: [1, 12], coins: [1, 13], potion: [1, 14], chest: [1, 15]
  });
  const COIN = Object.freeze({ name: 'เหรียญ', icon: '🪙' });
  // where things are bought (place = LifeSim place id)
  const SHOPS = Object.freeze({
    bazaar: { name: 'ตลาดใหญ่', place: 'bazaar', items: { rice: 1, veg: 1, fish: 2, spice: 3, riceball: 2, jerky: 4 } },
    bakery: { name: 'ร้านขนมปัง', place: 'bakery', items: { bread: 2 } },
    smith:  { name: 'โรงตีเหล็ก', place: 'smith', items: { iron: 5 } },
    junk:   { name: 'ร้านรับซื้อของเก่า', place: 'junk', items: { plank: 1, chain: 4, oldwheel: 5 } },
    stable: { name: 'คอกม้าลานเกวียน', place: 'stable', items: { horse: 60 } }
  });
  // who buys what (everything they take is sold in one visit; tools are never sold automatically)
  const BUYERS = Object.freeze({
    junk:       { name: 'ร้านรับซื้อของเก่า', place: 'junk', takes: ['junk', 'scrap'] },
    apothecary: { name: 'ร้านยา', place: 'apothecary', takes: ['herb'] },
    bazaar:     { name: 'ตลาดใหญ่', place: 'bazaar', takes: ['fruit', 'veg', 'fish', 'jerky'] },
    smith:      { name: 'โรงตีเหล็ก', place: 'smith', takes: ['dagger', 'scrap', 'monster'] },
    tmerchant:  { name: 'กิลด์พ่อค้าหอคอย', place: 'tmerchant', takes: ['monster', 'herb', 'dagger'] }   // v103 ย่านกิลด์
  });
  const RECIPES = Object.freeze({
    meal_veg:   { needs: { rice: 1, veg: 1 }, makes: 2 },
    meal_fish:  { needs: { rice: 1, fish: 1 }, makes: 2 },
    meal_spice: { needs: { rice: 1, veg: 1, spice: 1 }, makes: 3 }
  });
  // stoves: home = the room you sleep in tonight, if it has one
  const STOVES = Object.freeze({
    tavern:      { name: 'ยืมครัวร้านอาหาร', place: 'tavern', fee: 1, room: 'kitchen' },
    campfire:    { name: 'กองไฟคาราวาน', place: 'campfire', fee: 0 },
    streetstall: { name: 'เตาร้านริมทางในตลาด', place: 'streetstall', fee: 1 }
  });
  const HOME_STOVE = Object.freeze({ tenement: 'เตาถ่านในห้องเช่า', shrine: 'ก้อนเส้าหน้าศาลเจ้า', shack: 'เตาสังกะสีข้างเพิง' });
  const FORGE = Object.freeze({
    knife: { iron: 1 }, sickle: { iron: 1 }, hook: { iron: 1 }, dagger: { iron: 2 },
    scooter: { iron: 1, oldwheel: 2, plank: 1 }, bike: { iron: 2, oldwheel: 2, chain: 1 }
  });
  const FORGE_FEE = 2;                               // waived for the smith's apprentice
  const GATHER = Object.freeze({
    scrap: { name: 'คุ้ยลานของเก่าท้ายตรอก', place: 'scrap', tool: 'hook', loot: [['junk', 1, 2], ['scrap', 0, 2], ['oldwheel', 1, 1, 0.25], ['chain', 1, 1, 0.2]] },
    field: { name: 'เก็บของในทุ่งนอกประตูเมือง', place: 'field', tool: 'sickle', loot: [['herb', 1, 2], ['fruit', 0, 2], ['veg', 0, 1]] }
  });

  const list = st => (Array.isArray(st.bag) ? st.bag : (st.bag = []));
  const count = (st, id) => list(st).reduce((n, s) => n + (s.id === id ? s.n : 0), 0);
  const total = st => list(st).reduce((n, s) => n + s.n, 0);
  const meals = st => list(st).reduce((n, s) => n + (ITEMS[s.id] && ITEMS[s.id].kind === 'meal' ? s.n : 0), 0);
  const sync = st => { st.food = meals(st); return st; };          // older code and the panel read st.food
  const vehicles = st => (st.vehicles && typeof st.vehicles === 'object' ? st.vehicles : (st.vehicles = {}));
  function add(st, id, n, day) {
    const it = ITEMS[id];
    if (it && it.kind === 'vehicle') {               // one of each, parked rather than carried
      const V = vehicles(st); if (V[id]) return 0;
      V[id] = { since: day || st.day || 1, hungry: 0 }; return 1;
    } n = Math.max(0, Math.min(n === undefined ? 1 : n, CAP - total(st)));
    if (!it || !n) return 0;
    const exp = it.keep ? (day || st.day || 1) + it.keep : 0, L = list(st);
    const s = L.find(x => x.id === id && x.exp === exp);
    if (s) s.n += n; else L.push({ id, n, exp });
    sync(st); return n;
  }
  function take(st, id, n) {                          // oldest first
    n = n === undefined ? 1 : n;
    if (count(st, id) < n) return false;
    const L = list(st).filter(s => s.id === id).sort((a, b) => (a.exp || 1e9) - (b.exp || 1e9));
    for (const s of L) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (!n) break; }
    st.bag = list(st).filter(s => s.n > 0); sync(st); return true;
  }
  // eat one meal: the one that spoils soonest (cooked food first on a tie). Returns the item id or null.
  function eat(st) {
    const L = list(st).filter(s => ITEMS[s.id] && ITEMS[s.id].kind === 'meal')
      .sort((a, b) => (a.exp || 1e9) - (b.exp || 1e9) || (ITEMS[b.id].heal || 0) - (ITEMS[a.id].heal || 0));
    if (!L.length) return null;
    const id = L[0].id; L[0].n--; st.bag = list(st).filter(s => s.n > 0);
    const heal = ITEMS[id].heal || 0; if (heal) st.health = Math.min(100, (st.health || 0) + heal);
    sync(st); return id;
  }
  // night rollover into `day`: whatever's past its date goes off. Returns [[id, n], ...].
  function spoil(st, day) {
    const gone = {};
    for (const s of list(st)) if (s.exp && s.exp < day) gone[s.id] = (gone[s.id] || 0) + s.n;
    st.bag = list(st).filter(s => !(s.exp && s.exp < day)); sync(st);
    return Object.entries(gone);
  }
  const has = (st, needs) => Object.entries(needs).every(([id, n]) => count(st, id) >= n);
  // what's still missing for a recipe, and what it costs at the bazaar
  function missing(st, needs) {
    const out = {}; let cost = 0;
    for (const [id, n] of Object.entries(needs)) { const k = n - count(st, id); if (k > 0) { out[id] = k; cost += k * (SHOPS.bazaar.items[id] || 99); } }
    return { items: out, cost };
  }
  const daysLeft = (s, day) => s.exp ? s.exp - day : Infinity;
  const name = id => ITEMS[id] ? ITEMS[id].name : id;
  const label = pairs => pairs.map(([id, n]) => name(id) + (n > 1 ? ' ×' + n : '')).join(', ');
  function migrate(st) {                              // pre-v93 saves kept food as a bare number
    if (!Array.isArray(st.bag)) { st.bag = []; const n = Math.max(0, Math.min(6, Math.floor(st.food || 0))); if (n) add(st, 'ration', n); }
    sync(st);
  }
  return { vehicles, CAP, ITEMS, ICON_SHEETS, ICONS, COIN, SHOPS, BUYERS, RECIPES, STOVES, HOME_STOVE, FORGE, FORGE_FEE, GATHER,
    list, count, total, meals, add, take, eat, spoil, has, missing, daysLeft, name, label, migrate, sync };
});
