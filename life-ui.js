/* Screens for the autonomous life: intro, HUD, life panel, story events and the smith minigame hook.
   Uses the globals of the town scene script (state, clock, player, playerY, face, moving, anim, log, update, save). */
(function () {
  'use strict';
  const css = `
  header,#status,#notice,#place,nav,#actiontoggle,#jobs,#news{display:none!important}
  :root{--lg-bg:rgba(30,23,18,.95);--lg-line:#c9a25a;--lg-text:#f6ecd8;--lg-muted:#cdb999;--lg-gold:#f2c14e;--lg-btn:#3a2c20}
  #hud{position:fixed;top:max(12px,env(safe-area-inset-top));left:12px;z-index:12;display:flex;gap:10px;align-items:center;
    background:rgba(23,20,26,.86);border:1px solid #ffffff30;border-radius:14px;padding:8px 12px 8px 8px;color:#fff;max-width:min(470px,calc(100vw - 150px));
    font:13px/1.4 system-ui;pointer-events:none;box-shadow:0 4px 14px #0006}
  #hud canvas{width:46px;height:46px;border-radius:10px;background:#3a3040;flex:none}
  #hud .l1{font-weight:600;font-size:14px} #hud .l3{color:#ffe1a0}
  #hud .bars{color:#d8d0e0}
  #lifebtn{position:fixed;right:14px;bottom:max(16px,env(safe-area-inset-bottom));z-index:12;width:auto;height:auto;padding:12px 18px;
    border-radius:16px;font-size:16px;background:#2a2230e6;border:1px solid #ffffff66;color:#fff}
  #lgtoast{position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:12;max-width:min(560px,calc(100vw - 150px));
    background:rgba(23,20,26,.9);color:#fff;border-radius:12px;padding:9px 14px;font:14px/1.45 system-ui;opacity:0;transition:opacity .35s;pointer-events:none;text-align:center}
  #lgtoast.show{opacity:1}
  .lg-overlay{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));
    background:rgba(10,8,12,.62);font:15px/1.6 system-ui;color:var(--lg-text)}
  .lg-card{background:var(--lg-bg);border:1px solid var(--lg-line);border-radius:18px;padding:22px;max-width:620px;width:100%;max-height:100%;overflow:auto;
    box-shadow:0 18px 50px #000a;-webkit-overflow-scrolling:touch}
  .lg-card h2{margin:0 0 8px;font-size:22px;color:var(--lg-gold)} .lg-card h3{margin:16px 0 6px;font-size:15px;color:var(--lg-gold)}
  .lg-card p{margin:6px 0} .lg-muted{color:var(--lg-muted);font-size:14px}
  .lg-btn{display:block;width:100%;height:auto;margin:8px 0 0;padding:12px 14px;border-radius:12px;border:1px solid #ffffff40;background:var(--lg-btn);
    color:var(--lg-text);font:600 15px/1.35 system-ui;text-align:left;touch-action:manipulation;-webkit-user-select:none;user-select:none}
  .lg-btn small{display:block;font-weight:400;color:var(--lg-muted);font-size:13px;margin-top:2px}
  .lg-btn:disabled{opacity:.45} .lg-btn:active{background:#5a4430}
  .lg-primary{background:#e0a84a;color:#2a1a0c;border-color:#e0a84a;text-align:center}
  .lg-tag{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:99px;background:#e0a84a;color:#2a1a0c;font-size:12px;font-weight:700}
  .lg-cur{border-color:var(--lg-gold)}
  .lg-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:4px 12px;font-size:14px}
  .lg-log{font-size:13px;color:var(--lg-muted);white-space:pre-line}
  .lg-event{align-items:flex-end}
  .lg-event .lg-card{display:grid;grid-template-columns:120px 1fr;gap:14px;max-width:760px}
  .lg-event canvas{width:120px;height:150px;border-radius:14px;background:#3a3040}
  .lg-event .who{font-weight:700;color:var(--lg-gold)} .lg-event .lg-actions{grid-column:1/-1}
  @media(max-width:520px){.lg-event .lg-card{grid-template-columns:76px 1fr}.lg-event canvas{width:76px;height:95px}#hud{font-size:12px}#hud canvas{width:40px;height:40px}}
  .lg-smith{flex-direction:column;align-items:stretch;justify-content:flex-start;background:#120d0b;padding:max(10px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom))}
  .lg-smith-top{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:15px;padding:4px 4px 8px}
  .lg-smith-top .lg-step{color:var(--lg-gold);font-size:18px} .lg-hint{color:var(--lg-muted)} .lg-stars{color:#ffd76a;letter-spacing:1px}
  .lg-smith-canvas{flex:1;width:100%;min-height:0;border-radius:14px;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
  .lg-smith-bar{padding-top:8px;display:flex;justify-content:center} .lg-smith-bar .lg-btn{width:auto;text-align:center;font-weight:400;font-size:14px}
  .lg-carrot{flex-direction:column;align-items:stretch;justify-content:flex-start;gap:6px;background:#2a1a12;padding:max(10px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom))}
  .lc-top{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:2px 4px} .lc-title{color:var(--lg-gold);font-size:18px} .lc-sub{color:var(--lg-muted);font-size:13px}
  .lc-pill{padding:5px 11px;border-radius:99px;background:#fff1d8;color:#3c2a20;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
  .lc-stage{flex:1;min-height:0;position:relative;overflow:hidden;border-radius:14px;background:radial-gradient(ellipse at center,#7a4a2c,#3b2416)}
  .lc-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
  .lc-feedback{height:26px;text-align:center;font-size:17px;font-weight:700;color:#f3e6d3} .lc-feedback.good{color:#7fe09a} .lc-feedback.okay{color:#ffc266} .lc-feedback.miss{color:#ff8b80}
  .lc-panel{width:min(100%,640px);margin:0 auto}
  .lc-track{position:relative;height:30px;border:3px solid #784d30;border-radius:9px;box-shadow:inset 0 3px 8px #42240b30}
  .lc-pointer{position:absolute;top:-10px;bottom:-10px;left:0;width:5px;background:#fff;border:1.5px solid #553921;border-radius:8px;transform:translateX(-50%);box-shadow:0 1px 4px #23150a99}
  .lc-pointer.locked{filter:drop-shadow(0 0 6px #fff)}
  .lc-cut{display:block;width:100%;margin-top:12px;min-height:56px;border-radius:14px;border:3px solid #7b3f20;background:linear-gradient(#df9250,#ae5d2b);color:#fff9ef;font:inherit;font-size:22px;font-weight:800;box-shadow:0 4px 0 #743f20;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
  .lc-cut:active{transform:translateY(3px);box-shadow:0 1px 0 #743f20} .lc-cut:disabled{opacity:.6}
  .lc-stats{display:flex;justify-content:space-between;margin-top:10px;font-size:14px;color:var(--lg-muted)} .lc-stats b{color:#f3e6d3}
  .lc-skip{width:auto;margin:10px auto 0;text-align:center;font-weight:400;font-size:13px;padding:8px 14px}
  .lg-result{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,calc(100vw - 32px));text-align:center}
  .lg-ic{display:inline-block;flex:none;vertical-align:middle;background:no-repeat;font-style:normal;text-align:center;filter:drop-shadow(0 2px 2px #0007)}
  .lg-emo{filter:none}
  #lgloot{position:fixed;left:50%;top:22%;transform:translate(-50%,8px) scale(.96);z-index:13;display:flex;flex-wrap:wrap;justify-content:center;gap:8px;max-width:min(520px,calc(100vw - 24px));
    background:rgba(30,23,18,.92);border:1px solid var(--lg-line);border-radius:16px;padding:10px 14px;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;font:700 17px/1.2 system-ui;color:var(--lg-text);box-shadow:0 10px 30px #0008}
  #lgloot.show{opacity:1;transform:translate(-50%,0) scale(1)}
  .lg-chip{display:flex;align-items:center;gap:6px;padding:3px 10px 3px 4px;border-radius:12px;background:#ffffff10}
  .lg-chip .p{color:#ffd76a} .lg-chip .m{color:#ff9a7a} .lg-chip small{font-weight:400;font-size:12px;color:var(--lg-muted);display:block}
  .lg-gain{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 0;font:700 16px/1.2 system-ui}
  .lg-bag{display:grid;grid-template-columns:repeat(auto-fill,minmax(82px,1fr));gap:8px}
  .lg-slot{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 4px 6px;border-radius:12px;background:#ffffff0d;border:1px solid #ffffff1c;font-size:12px;line-height:1.25;text-align:center}
  .lg-slot b{position:absolute;right:6px;top:4px;min-width:20px;padding:0 5px;border-radius:99px;background:#e0a84a;color:#2a1a0c;font-size:12px}
  .lg-slot .x{color:#ff9a7a} .lg-slot .d{color:var(--lg-muted);font-size:11px}
  .lg-bigstars{font-size:44px;color:#ffd76a;letter-spacing:4px} .lg-sword{display:block;width:88%;margin:4px auto 2px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))}
  `;
  const styleEl = document.createElement('style'); styleEl.textContent = css; document.head.appendChild(styleEl);

  let open = null, hudEl, toastEl, lastToast = '', toastTimer = 0, hudAt = 0, inited = false;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const block = v => { open = v; window.LIFE_BLOCK = !!v; };

  function portrait(cv, img, frameW, frameH, box, ox = 0, oy = 0) {
    const g = cv.getContext('2d'), d = Math.min(window.devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
    cv.width = Math.round((r.width || 46) * d); cv.height = Math.round((r.height || 46) * d);
    g.clearRect(0, 0, cv.width, cv.height);
    if (!img || !img.complete || !img.naturalWidth) return;
    const [fx, fy, fw, fh] = box; // fractions of one frame
    g.imageSmoothingEnabled = true;
    g.drawImage(img, ox + frameW * fx, oy + frameH * fy, frameW * fw, frameH * fh, 0, 0, cv.width, cv.height);
  }
  const PLAYER_BOX = [0.22, 0.02, 0.56, 0.33];
  // Visual-novel busts: face_<who>.webp holds 4 expressions side by side — 0 neutral · 1 smile · 2 surprised · 3 worried.
  const FACE_OF = { merchant: 'mali', worker: 'thana' }, faces = {};
  function faceImage(who) { who = FACE_OF[who] || who; if (!faces[who]) { faces[who] = new Image(); faces[who].src = 'face_' + who + '.webp?v=87'; } return faces[who]; }
  // Draws expression `n` to fill the canvas: crops the sides of wide busts, or the bottom of tall ones.
  function drawFace(cv, who, n) {
    const im = faceImage(who);
    const go = () => {
      const g = cv.getContext('2d'), d = Math.min(window.devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
      cv.width = Math.round((r.width || 46) * d); cv.height = Math.round((r.height || 46) * d);
      const fw = im.naturalWidth / 4, fh = im.naturalHeight, want = cv.width / cv.height;
      let sw = fw, sh = fh; if (fw / fh > want) sw = fh * want; else sh = fw / want;
      g.clearRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = true;
      g.drawImage(im, fw * n + (fw - sw) / 2, 0, sw, sh, 0, 0, cv.width, cv.height);
    };
    if (im.complete && im.naturalWidth) go(); else im.addEventListener('load', go, { once: true });
  }

  function el(html, cls) { const d = document.createElement('div'); d.className = 'lg-overlay ' + (cls || ''); d.innerHTML = html; document.body.appendChild(d); return d; }
  function closeOverlay(d) { d.remove(); block(null); try { update(); } catch (e) {} }

  // ---------- new life ----------
  function newLife() {
    state = CityCore.freshState(defaults, 'x');
    const origin = LifeSim.newLife(state);
    state.scene = 'town'; state.paused = false; clock = 5; state.townClock = 5;
    TownResidents.ensure(state); state._log = m => log(m);
    try { $('pause').textContent = 'หยุดเวลา'; } catch (e) {}
    intro(origin);
  }
  function intro(origin) {
    const L = state.life;
    const d = el(`<div class="lg-card"><h2>การอัญเชิญ</h2>
      <p>แสงสีขาวกลืนทุกอย่างรอบตัว เมื่อลืมตาอีกครั้ง คุณยืนอยู่หน้าหอคอยที่สูงทะลุเมฆ</p>
      <p>เจ้าหน้าที่กิลด์บอกว่าที่นี่ต้องการคนจากต่างโลก เพื่อช่วยกันไม่ให้มอนสเตอร์ในหอคอย <b>ทะลักออกมา</b></p>
      <h3>ในโลกเดิม คุณคือ</h3>
      <p style="font-size:20px"><b>${esc(origin.name)}</b> อายุ ${L.age} ปี</p>
      <div class="lg-stats"><span>กำลัง ${state.strength}</span><span>คล่องตัว ${state.agility}</span><span>ปัญญา ${state.intelligence}</span><span>เงินติดตัว ${state.money}</span></div>
      <p class="lg-muted">${esc(origin.perk)}</p>
      <button class="lg-btn lg-primary">ต่อไป</button></div>`);
    block(d);
    d.querySelector('button').onclick = () => { d.remove(); choosePath(true); };
  }
  function choosePath(first) {
    const L = state.life, origin = LifeSim.originOf(state);
    const cards = Object.entries(LifeSim.PATHS).map(([id, p]) =>
      `<button class="lg-btn ${!first && (L.pendingPath || L.path) === id ? 'lg-cur' : ''}" data-id="${id}">${esc(p.name)}${origin.suggest === id ? '<span class="lg-tag">เข้ากับอดีตของคุณ</span>' : ''}<small>${esc(p.desc)}</small></button>`).join('');
    const d = el(`<div class="lg-card"><h2>${first ? 'จะใช้ชีวิตแบบไหน' : 'เปลี่ยนแนวทางชีวิต'}</h2>
      <p class="lg-muted">${first ? 'ตัวละครจะใช้ชีวิตตามแนวทางนี้เองทุกวัน เปลี่ยนได้ทีหลังจากปุ่ม "ชีวิต"' : 'มีผลตั้งแต่เช้าวันพรุ่งนี้'}</p>
      ${cards}${first ? '' : '<button class="lg-btn lg-primary" data-id="">ปิด</button>'}</div>`);
    block(d);
    d.querySelectorAll('button').forEach(b => b.onclick = () => {
      const id = b.dataset.id;
      if (id) {
        if (first) { L.path = id; L.started = true; log('เริ่มชีวิตในต่างโลก: ' + LifeSim.PATHS[id].name); }
        else if (id !== L.path) { L.pendingPath = id; log('พรุ่งนี้จะเปลี่ยนไป' + LifeSim.PATHS[id].name); }
        else L.pendingPath = null;
      }
      closeOverlay(d); save();
    });
  }

  // ---------- v93 bag and the after-work order ----------
  const B = () => LifeSim.Bag;
  // v100 item icons: cut from items_a/items_b.webp (4×4 sheets); until a sheet loads, the item's emoji stands in
  const sheetOk = {};
  function loadSheets() { if (loadSheets.done) return; loadSheets.done = true;
    B().ICON_SHEETS.forEach(src => { const im = new Image(); im.onload = () => { sheetOk[src] = true; }; im.src = src + '?v=100'; }); }
  function iconHtml(id, px) {
    const b = B(); loadSheets();
    const it = id === 'coin' || id === 'coins' ? b.COIN : b.ITEMS[id] || { icon: '❔' }, at = b.ICONS[id], src = at && b.ICON_SHEETS[at[0]];
    if (src && sheetOk[src]) { const c = at[1] % 4, r = Math.floor(at[1] / 4);
      return `<i class="lg-ic" style="width:${px}px;height:${px}px;background-image:url(${src}?v=100);background-size:400% 400%;background-position:${c * 100 / 3}% ${r * 100 / 3}%"></i>`; }
    return `<i class="lg-ic lg-emo" style="width:${px}px;height:${px}px;font-size:${Math.round(px * 0.78)}px;line-height:${px}px">${it.icon}</i>`;
  }
  // what the hero holds, to spot gains and losses between frames
  function holding() {
    const b = B(), c = {}; for (const st of b.list(state)) c[st.id] = (c[st.id] || 0) + st.n;
    for (const id of Object.keys(b.vehicles(state))) c[id] = 1;
    return { money: state.money || 0, c };
  }
  function diff(a, z) {
    const out = []; if (z.money !== a.money) out.push(['coin', z.money - a.money]);
    for (const id of new Set(Object.keys(a.c).concat(Object.keys(z.c)))) { const n = (z.c[id] || 0) - (a.c[id] || 0); if (n) out.push([id, n]); }
    return out;
  }
  function chipHtml([id, n]) {
    const b = B(), nm = id === 'coin' ? 'เหรียญ' : b.name(id), big = id === 'coin' && Math.abs(n) >= 10 ? 'coins' : id;
    return `<span class="lg-chip">${iconHtml(big === 'coins' && !b.ICONS.coins ? 'coin' : big, 40)}<span><span class="${n > 0 ? 'p' : 'm'}">${n > 0 ? '+' : '−'}${Math.abs(n)}</span><small>${esc(nm)}</small></span></span>`;
  }
  // floating "you got" card: everything that changes while it's up is added to the same card
  let lootEl = null, lootSum = null, lootTimer = 0, snap = null, snapOf = null;
  function loot(changes) {
    if (!lootEl) { lootEl = document.createElement('div'); lootEl.id = 'lgloot'; document.body.appendChild(lootEl); }
    if (!lootEl.classList.contains('show')) lootSum = new Map();
    for (const [id, n] of changes) lootSum.set(id, (lootSum.get(id) || 0) + n);
    const rows = [...lootSum].filter(([, n]) => n).sort((x, y) => (y[0] === 'coin') - (x[0] === 'coin') || y[1] - x[1]);
    if (!rows.length) { lootEl.classList.remove('show'); return; }
    lootEl.innerHTML = rows.map(chipHtml).join(''); lootEl.classList.add('show');
    clearTimeout(lootTimer); lootTimer = setTimeout(() => lootEl.classList.remove('show'), 3400);
  }
  function watchLoot() {
    if (snapOf !== state || !snap) { snapOf = state; snap = holding(); return; }
    const now = holding(), d = diff(snap, now); snap = now;
    if (d.length) loot(d);
  }
  function describeOrder(O) {
    const b = B(); if (!O) return 'ไม่มี (ตัวละครแวะธุระตามปกติ)';
    const when = O.repeat ? 'ทุกวัน' : O.day === state.day ? 'วันนี้' : 'พรุ่งนี้';
    if (O.kind === 'buy') return 'ซื้อ ' + b.label(Object.entries(O.items || {})) + ' ที่' + b.SHOPS[O.shop].name + ' · ' + when;
    if (O.kind === 'cook') return 'ทำ' + b.name(O.recipe) + 'กินเอง (' + LifeSim.stovePlace(state, O).name + ') · ' + when;
    if (O.kind === 'forge') return 'ตี' + b.name(O.item) + 'เองที่โรงตีเหล็ก · ' + when;
    if (O.kind === 'gather') return b.GATHER[O.spot].name + ' · ' + when;
    if (O.kind === 'sell') return 'เอาของไปขายที่' + b.BUYERS[O.buyer].name + ' · ' + when;
    return '';
  }
  function bagHtml() {
    const b = B(), L = state.life, bag = b.list(state).slice().sort((x, y) => (x.exp || 1e9) - (y.exp || 1e9));
    const rows = [`<div class="lg-slot">${iconHtml(state.money >= 10 ? 'coins' : 'coin', 52)}<b>${state.money}</b>เหรียญ</div>`]
      .concat(Object.keys(b.vehicles(state)).map(id => `<div class="lg-slot">${iconHtml(id, 52)}${esc(b.name(id))}<span class="d">จอดไว้</span></div>`))
      .concat(bag.map(st => { const it = b.ITEMS[st.id], left = b.daysLeft(st, state.day);
        return `<div class="lg-slot">${iconHtml(st.id, 52)}<b>${st.n}</b>${esc(it.name)}${left === Infinity ? '' : left <= 0 ? '<span class="x">เสียคืนนี้</span>' : '<span class="d">เหลือ ' + (left + 1) + ' วัน</span>'}</div>`; })).join('');
    const O = L.order && LifeSim.orderToday(state) || (L.order && L.order.day > state.day ? L.order : null);
    return `<h3>กระเป๋า (${b.total(state)}/${b.CAP})</h3>
      <div class="lg-bag">${rows}</div>${bag.length ? '' : '<p class="lg-muted">ยังไม่มีของในกระเป๋า</p>'}
      <button class="lg-btn ${L.eatBag ? 'lg-cur' : ''}" data-a="eatbag">${L.eatBag ? '✓ ' : ''}กินของในกระเป๋าก่อน<small>มีของกินเมื่อไหร่ จะกินแทนการไปซื้อข้าวเย็น (ประหยัดเงิน ของใกล้เสียถูกกินก่อน)</small></button>
      ${travelHtml()}
      <h3>ธุระหลังเลิกงาน</h3><p>${esc(describeOrder(O))}</p>
      <p class="lg-muted">สั่งก่อนเลิกงาน (16:00) จะทำวันนี้ หลังจากนั้นจะทำพรุ่งนี้</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 8px">
        <button class="lg-btn" data-order="buy">🛒 ซื้อของ<small>ตลาด · ขนมปัง · เหล็ก · อะไหล่ · ม้า</small></button>
        <button class="lg-btn" data-order="cook">🍳 ทำอาหาร<small>กินเอง เหลือเก็บใส่กระเป๋า</small></button>
        <button class="lg-btn" data-order="forge">🔨 ตีเหล็ก<small>มีด เคียว ตะขอ มีดสั้น จักรยาน สกู๊ตเตอร์</small></button>
        <button class="lg-btn" data-order="gather">🧺 เก็บของ<small>ลานของเก่า · ทุ่งนอกประตูเมือง</small></button>
        <button class="lg-btn" data-order="sell">💰 ขายของ<small>ร้านรับซื้อ · ร้านยา · ตลาด · โรงตีเหล็ก</small></button>
        ${O ? '<button class="lg-btn" data-a="nocmd">✖ ยกเลิกธุระ<small>กลับไปใช้ชีวิตตามปกติ</small></button>' : ''}
      </div>`;
  }
  function travelHtml() {
    const b = B(), L = state.life, V = b.vehicles(state);
    const opts = [['', '🚶 เดิน', 'ฟรี']].concat(['horse', 'bike', 'scooter'].filter(id => V[id]).map(id => [id, iconHtml(id, 26) + ' ' + esc(b.ITEMS[id].name), b.ITEMS[id].desc + (id === 'horse' && V.horse.hungry ? ' · ม้าหิว ' + V.horse.hungry + ' วัน' : '')]));
    return `<h3>การเดินทาง</h3><p class="lg-muted">เปลี่ยนแล้วมีผลตั้งแต่เช้าวันพรุ่งนี้</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 8px">${opts.map(([id, t, d]) => `<button class="lg-btn ${(L.ride || '') === id ? 'lg-cur' : ''}" data-ride="${id}">${t}<small>${esc(d)}</small></button>`).join('')}</div>
      <button class="lg-btn ${L.coach ? 'lg-cur' : ''}" data-a="coach" ${L.ride ? 'disabled' : ''}>${L.coach ? '✓ ' : ''}🐴🚃 นั่งรถม้าโดยสารเมื่อทางไกล<small>${LifeSim.COACH_FARE} เหรียญ/เที่ยว เร็ว 3 เท่า แต่ต้องเดินไปป้ายและรอรถ · มีป้ายในเมือง (ประตูเมือง ปากตรอกตลาด บ่อน้ำ โรงแรม ปลายถนน) และในลานเกวียน</small></button>
      ${Object.keys(V).length ? '' : '<p class="lg-muted">ม้าซื้อได้ที่คอกม้าลานเกวียน · จักรยานกับสกู๊ตเตอร์ต้องหาล้อเก่า โซ่ ไม้กระดาน มาตีเองที่โรงตีเหล็ก</p>'}`;
  }
  // one card per kind of order; `sel` keeps what's been picked while the card re-renders
  function orderCard(kind, sel) {
    const b = B(), L = state.life; sel = sel || { items: {} };
    const money = state.money, icon = id => iconHtml(id, 26) + ' ' + esc(b.ITEMS[id].name);
    let body = '', ok = false;
    if (kind === 'buy') {
      sel.shop = sel.shop || 'bazaar';
      const S = b.SHOPS[sel.shop]; let cost = 0, n = 0;
      for (const [id, k] of Object.entries(sel.items)) { cost += k * S.items[id]; n += k; }
      body = `<p>${Object.entries(b.SHOPS).map(([id, x]) => `<button class="lg-btn ${id === sel.shop ? 'lg-cur' : ''}" style="display:inline-block;width:auto;margin-right:6px" data-shop="${id}">${esc(x.name)}</button>`).join('')}</p>
        ${Object.entries(S.items).map(([id, price]) => { const it = b.ITEMS[id];
          if (it.kind === 'vehicle') return `<button class="lg-btn" data-add="${id}" ${b.vehicles(state)[id] ? 'disabled' : ''}>${icon(id)} · ${price} เหรียญ${sel.items[id] ? '<span class="lg-tag">ซื้อ</span>' : ''}<small>${b.vehicles(state)[id] ? 'มีแล้ว' : esc(it.desc)}</small></button>`;
          return `<button class="lg-btn" data-add="${id}">${icon(id)} · ${price} เหรียญ${sel.items[id] ? '<span class="lg-tag">×' + sel.items[id] + '</span>' : ''}<small>${it.keep ? 'เก็บได้ ' + it.keep + ' วัน' : 'ไม่เสีย'}${it.kind === 'meal' ? ' · กินได้เลย' : it.kind === 'ingredient' ? ' · วัตถุดิบ' : ''}</small></button>`; }).join('')}
        <p>รวม ${n} ชิ้น ${cost} เหรียญ (มี ${money}) ${n ? '<button class="lg-btn" style="display:inline-block;width:auto" data-clear="1">ล้าง</button>' : ''}</p>`;
      ok = n > 0; sel.order = { kind, shop: sel.shop, items: sel.items };
    } else if (kind === 'cook') {
      const home = LifeSim.stovePlace(state, { stove: 'home' });
      sel.recipe = sel.recipe || 'meal_veg'; sel.stove = sel.stove || 'home';
      body = Object.entries(b.RECIPES).map(([id, R]) => { const m = b.missing(state, R.needs);
        return `<button class="lg-btn ${id === sel.recipe ? 'lg-cur' : ''}" data-recipe="${id}">${icon(id)} · ได้ ${R.makes} ที่<small>ใช้ ${esc(b.label(Object.entries(R.needs)))}${Object.keys(m.items).length ? ' · ขาด ' + esc(b.label(Object.entries(m.items))) + ' จะแวะซื้อในตลาด ~' + m.cost + ' เหรียญ' : ' · มีครบในกระเป๋า'} · สุขภาพ +${b.ITEMS[id].heal}</small></button>`; }).join('')
        + `<h3>ทำที่ไหน</h3>` + [['home', 'ที่พักคืนนี้', b.HOME_STOVE[home.place] ? home.name + ' ฟรี' : 'ที่พักคืนนี้ไม่มีเตา จะยืมครัวร้านอาหารแทน'],
          ['tavern', 'ยืมครัวร้านอาหาร', (L.path === 'kitchen' ? 'ฟรีสำหรับผู้ช่วยครัว' : '1 เหรียญ') + ' · ในเมือง'],
          ['campfire', 'กองไฟคาราวาน', 'ฟรี · นอกประตูเมือง'], ['streetstall', 'เตาร้านริมทางในตลาด', '1 เหรียญ · ในตลาดใหญ่']]
          .map(([id, t, d]) => `<button class="lg-btn ${id === sel.stove ? 'lg-cur' : ''}" data-stove="${id}">${esc(t)}<small>${esc(d)}</small></button>`).join('')
        + `<p class="lg-muted">มีดครัวในกระเป๋าทำได้เพิ่ม 1 ที่ · ของที่ทำเองเก็บได้ถึงพรุ่งนี้</p>`;
      ok = true; sel.order = { kind, recipe: sel.recipe, stove: sel.stove };
    } else if (kind === 'forge') {
      sel.item = sel.item || 'knife';
      const fee = L.path === 'smith' ? 0 : b.FORGE_FEE, odds = Math.round(Math.min(0.95, 0.6 + 0.03 * (state.smithWork || 0) + 0.02 * (state.strength || 3)) * 100);
      body = Object.entries(b.FORGE).map(([id, f]) => { const lack = Object.entries(f).filter(([i, n]) => i !== 'iron' && b.count(state, i) < n);
          const owned = b.ITEMS[id].kind === 'vehicle' && b.vehicles(state)[id];
          return `<button class="lg-btn ${id === sel.item ? 'lg-cur' : ''}" data-item="${id}" ${owned ? 'disabled' : ''}>${icon(id)} · ${esc(b.label(Object.entries(f)))}<small>${owned ? 'มีแล้ว' : esc(b.ITEMS[id].desc || 'ขายให้โรงตีเหล็กได้ ' + b.ITEMS[id].sell + ' เหรียญ')}${lack.length ? ' · ยังขาด ' + esc(b.label(lack)) : ''}</small></button>`; }).join('')
        + `<p class="lg-muted">มีเหล็กแท่ง ${b.count(state, 'iron')} · ขาดจะซื้อที่โรงตีเหล็กแท่งละ ${b.SHOPS.smith.items.iron} · ค่าเตา ${fee ? fee + ' เหรียญ' : 'ฟรี (ช่างฝึกหัด)'} · โอกาสสำเร็จ ${odds}% · แรง -12</p>`;
      ok = true; sel.order = { kind, item: sel.item };
    } else if (kind === 'gather') {
      sel.spot = sel.spot || 'field';
      body = Object.entries(b.GATHER).map(([id, G]) => `<button class="lg-btn ${id === sel.spot ? 'lg-cur' : ''}" data-spot="${id}">${esc(G.name)}<small>ได้ ${esc(G.loot.map(([i]) => b.name(i)).join(' / '))} · ${esc(b.name(G.tool))}ช่วยได้เพิ่ม · แรง -10</small></button>`).join('');
      ok = true; sel.order = { kind, spot: sel.spot };
    } else if (kind === 'sell') {
      sel.buyer = sel.buyer || 'junk';
      body = Object.entries(b.BUYERS).map(([id, X]) => { const items = X.takes.map(i => [i, b.count(state, i)]).filter(([, n]) => n);
        const val = items.reduce((t, [i, n]) => t + n * b.ITEMS[i].sell, 0);
        return `<button class="lg-btn ${id === sel.buyer ? 'lg-cur' : ''}" data-buyer="${id}">${esc(X.name)}${val ? '<span class="lg-tag">' + val + ' เหรียญ</span>' : ''}<small>รับซื้อ ${esc(X.takes.map(i => b.name(i)).join(', '))}${items.length ? ' · ตอนนี้มี ' + esc(b.label(items)) : ''}</small></button>`; }).join('')
        + '<p class="lg-muted">ขายทุกชิ้นที่ร้านนั้นรับ (เครื่องมือไม่ถูกขาย)</p>';
      ok = true; sel.order = { kind, buyer: sel.buyer };
    }
    // how late this evening runs: plan the day with the order in place, then put things back
    let eta = '';
    if (ok) {
      const keep = L.order, keepDone = L.done;
      try {
        L.order = Object.assign({}, sel.order, { day: state.day }); L.done = Object.assign({}, keepDone);
        const home = LifeSim.milestones(state).find(([k]) => k === 'home');
        if (home) { const h = home[1] * 1.2, hh = Math.floor(h) % 24, mm = Math.round((h % 1) * 60 / 10) * 10 % 60;
          eta = '<p class="lg-muted">ถ้าทำวันนี้ จะกลับถึงที่นอนราว ' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + (home[1] >= 19.5 ? ' <b style="color:#ff9a7a">ดึกมาก ไกลจากที่ทำงาน</b>' : '') + '</p>'; }
      } catch (e) {} finally { L.order = keep; L.done = keepDone; }
    }
    const title = { buy: 'ซื้อของ', cook: 'ทำอาหารกินเอง', forge: 'ตีเหล็กเอง', gather: 'เก็บของ', sell: 'ขายของ' }[kind];
    const d = el(`<div class="lg-card"><h2>${title}</h2>${body}${eta}
      <button class="lg-btn lg-primary" data-go="once" ${ok ? '' : 'disabled'}>สั่งครั้งเดียว</button>
      <button class="lg-btn" data-go="repeat" ${ok ? '' : 'disabled'}>ทำทุกวัน<small>ทำซ้ำทุกเย็นจนกว่าจะยกเลิก</small></button>
      <button class="lg-btn" data-go="">กลับ</button></div>`);
    block(d);
    const redo = () => { d.remove(); block(null); orderCard(kind, sel); };
    const on = (attr, fn) => d.querySelectorAll('[data-' + attr + ']').forEach(x => x.onclick = () => { fn(x.dataset[attr]); redo(); });
    on('shop', v => { sel.shop = v; sel.items = {}; });
    on('add', v => { sel.items[v] = b.ITEMS[v].kind === 'vehicle' ? 1 : (sel.items[v] || 0) + 1; });
    on('clear', () => { sel.items = {}; });
    on('recipe', v => { sel.recipe = v; }); on('stove', v => { sel.stove = v; });
    on('item', v => { sel.item = v; }); on('spot', v => { sel.spot = v; }); on('buyer', v => { sel.buyer = v; });
    d.querySelectorAll('[data-go]').forEach(x => x.onclick = () => {
      const go = x.dataset.go;
      if (go) {
        const day = LifeSim.setOrder(state, Object.assign({}, sel.order, { repeat: go === 'repeat' }), clock);
        log('ธุระ' + (day === state.day ? 'วันนี้' : 'พรุ่งนี้') + ': ' + describeOrder(state.life.order));
        save();
      }
      d.remove(); block(null); panel();
    });
  }

  // ---------- life panel ----------
  function panel() {
    if (open) return;
    const L = state.life, o = LifeSim.originOf(state);
    const d = el(`<div class="lg-card"><h2>ชีวิตของคุณ</h2>
      <p>ตัวตนในโลกเดิม: <b>${esc(o.name)}</b> อายุ ${L.age} ปี · ใช้ชีวิตในต่างโลกมา ${state.day} วัน</p>
      <p class="lg-muted">${esc(o.perk)}</p>
      <h3>แนวทาง</h3><p>${esc(LifeSim.PATHS[L.path].name)}${L.pendingPath ? ' → พรุ่งนี้: ' + esc(LifeSim.PATHS[L.pendingPath].name) : ''}${state.guild ? ' · สมาชิกกิลด์' : ''}</p>
      ${bagHtml()}
      <h3>ที่พัก</h3><p class="lg-muted">เลือกห้องที่อยากพักทุกคืน ถ้าเงินไม่พอ ตัวละครจะพักห้องที่ถูกลงเอง จนถึงห้องเช่าในตรอกล่าง ถ้าไม่มีเลยจะนอนม้านั่ง (ศาลเจ้าร้างกับเพิงข้างกองขยะนอนฟรี แต่ต้องเลือกเอง) และถ้าไม่มีเงินกินข้าวจะไปรับซุปฟรีที่โรงทาน</p>
      ${LifeSim.ROOM_ORDER.slice().reverse().map(id => { const r = LifeSim.ROOMS[id], price = LifeSim.roomPrice(state, id);
        return `<button class="lg-btn ${L.roomPref === id ? 'lg-cur' : ''}" data-room="${id}">${esc(r.name)} · ${price ? price + ' เหรียญ/คืน' : 'ฟรี'}${price < r.price ? '<span class="lg-tag">ราคาพนักงาน</span>' : ''}${L.roomPref === id ? '<span class="lg-tag">เลือกอยู่</span>' : ''}<small>${esc(r.desc)}</small></button>`; }).join('')}
      <h3>ค่าสถานะ</h3><div class="lg-stats"><span>กำลัง ${state.strength}</span><span>คล่องตัว ${state.agility}</span><span>ปัญญา ${state.intelligence}</span>
        <span>ชื่อเสียง ${state.rep}</span><span>สุขภาพ ${state.health}</span><span>ของกินในกระเป๋า ${Bag.meals(state)}</span></div>
      <h3>หอคอยและเมือง</h3><div class="lg-stats"><span>ชั้นที่สำรวจ ${state.floor}</span><span>อันตราย ${state.danger}/5</span><span>เสบียง ${state.supplies}</span><span>ภาษีค้าง ${state.taxDue}</span></div>
      <h3>บันทึก</h3><div class="lg-log">${esc(state.events.slice(0, 8).join('\n') || 'ยังไม่มีบันทึก')}</div>
      <button class="lg-btn" data-a="path">เปลี่ยนแนวทางชีวิต<small>มีผลตั้งแต่เช้าวันพรุ่งนี้</small></button>
      <button class="lg-btn" data-a="new">เริ่มชีวิตใหม่<small>สุ่มตัวตนใหม่ ความคืบหน้าเดิมจะหายไป</small></button>
      <button class="lg-btn lg-primary" data-a="close">ปิด</button><p class="lg-muted" style="text-align:center;margin-top:10px">Tower RPG v70</p></div>`);
    block(d);
    d.querySelectorAll('[data-room]').forEach(b => b.onclick = () => {
      LifeSim.setRoomPref(state, b.dataset.room); log('ตั้งใจพัก' + LifeSim.ROOMS[b.dataset.room].name + 'ตั้งแต่คืนนี้');
      d.remove(); block(null); save(); panel();
    });
    d.querySelectorAll('[data-order]').forEach(b => b.onclick = () => { d.remove(); block(null); orderCard(b.dataset.order); });
    d.querySelectorAll('[data-ride]').forEach(x => x.onclick = () => { L.ride = x.dataset.ride || null; log(L.ride ? 'เดินทางด้วย' + LifeSim.Bag.name(L.ride) : 'เดินเท้า'); d.remove(); block(null); save(); panel(); });
    const cb = d.querySelector('[data-a=coach]'); if (cb) cb.onclick = () => { L.coach = !L.coach; d.remove(); block(null); save(); panel(); };
    const eb = d.querySelector('[data-a=eatbag]'); if (eb) eb.onclick = () => { L.eatBag = !L.eatBag; d.remove(); block(null); save(); panel(); };
    const cancel = d.querySelector('[data-a=nocmd]'); if (cancel) cancel.onclick = () => { LifeSim.setOrder(state, null); log('ยกเลิกธุระหลังเลิกงาน'); d.remove(); block(null); save(); panel(); };
    d.querySelector('[data-a=close]').onclick = () => closeOverlay(d);
    d.querySelector('[data-a=path]').onclick = () => { d.remove(); choosePath(false); };
    d.querySelector('[data-a=new]').onclick = () => { if (confirm('เริ่มชีวิตใหม่และลบความคืบหน้าในเครื่องนี้?')) { d.remove(); newLife(); } };
  }

  // ---------- story event ----------
  function event(id) {
    const ev = LifeSim.EVENTS[id], L = state.life;
    L.pendingEvent = id; save();
    const d = el(`<div class="lg-card"><canvas></canvas><div><div class="who">${esc(ev.speaker)} · <span class="lg-muted">${esc(ev.title)}</span></div><p class="line"></p></div><div class="lg-actions"></div></div>`, 'lg-event');
    block(d);
    const cv = d.querySelector('canvas'), mood = n => drawFace(cv, ev.portrait, n);
    const line = d.querySelector('.line'), actions = d.querySelector('.lg-actions');
    let i = 0;
    function showLine() {
      line.textContent = ev.lines[i]; mood((ev.faces || [])[i] || 0);
      actions.innerHTML = '<button class="lg-btn lg-primary">ต่อไป</button>';
      actions.querySelector('button').onclick = () => { i++; if (i < ev.lines.length) showLine(); else showChoices(); };
    }
    function showChoices() {
      line.textContent = 'คุณจะทำอย่างไร'; mood(0);
      actions.innerHTML = LifeSim.choicesFor(state, id).map(c =>
        `<button class="lg-btn" data-i="${c.index}" ${c.enabled ? '' : 'disabled'}>${esc(c.label)}<small>${esc(c.enabled ? c.odds : 'ทำไม่ได้: วันนี้ยังไม่ได้ตีอาวุธ')}</small></button>`).join('');
      actions.querySelectorAll('button').forEach(b => b.onclick = () => {
        const hp = state.health, had = holding(), res = LifeSim.resolveChoice(state, id, +b.dataset.i), got = diff(had, holding());
        snap = holding(); snapOf = state;                                  // shown here, not again as a floating card
        mood(state.health < hp ? 3 : 1);                                   // worried if it hurt, smiling otherwise
        L.pendingEvent = null; save();
        line.textContent = res ? res.replace(ev.title + ': ', '') : '';
        if (got.length) line.insertAdjacentHTML('afterend', '<div class="lg-gain">' + got.map(chipHtml).join('') + '</div>');
        actions.innerHTML = '<button class="lg-btn lg-primary">ตกลง</button>';
        actions.querySelector('button').onclick = () => closeOverlay(d);
      });
    }
    showLine();
  }

  // ---------- minigame ----------
  function smith() {
    const img = (sceneObjects.find(o => o.src === 'buildings__blacksmith_v51.webp') || {}).image;
    block(true);
    SmithGame.open({ image: img, tolerance: LifeSim.tolerance(state), onDone(total) {
      state.life.done.work = state.day; LifeSim.finishSmith(state, total, CityCore); block(null); update();
    } });
  }

  function kitchen() {
    block(true);
    CarrotGame.open({ tolerance: LifeSim.kitchenTolerance(state), onDone(stars, skipped) {
      state.life.done.work = state.day; LifeSim.finishKitchen(state, stars, CityCore, skipped); block(null); update();
    } });
  }

  // ---------- per-frame driver ----------
  function process() {
    const L = state.life;
    if (L.pendingEvent && LifeSim.EVENTS[L.pendingEvent]) { event(L.pendingEvent); return; }
    for (const k of LifeSim.due(state, clock)) {
      if (k === 'work' && L.path === 'smith') { smith(); return; }
      if (k === 'work' && L.path === 'kitchen' && window.CarrotGame) { kitchen(); return; }
      L.done[k] = state.day;
      if (k === 'wake') LifeSim.applyWake(state);
      else if (k === 'work') LifeSim.applyWork(state, CityCore);
      else if (k === 'dinner') { LifeSim.applyDinner(state, CityCore); const ev = LifeSim.pickEvent(state); update(); if (ev) { event(ev); return; } }
      else if (k === 'home') LifeSim.applyHome(state);
      else if (k === 'rest') LifeSim.applyRest(state);
      else if (k === 'errand' || k === 'errand2') LifeSim.applyErrand(state, k);
      else if (k === 'cook') LifeSim.applyOrder(state, 'cook');
      else if (k.startsWith('coach')) LifeSim.applyCoach(state);
      update();
    }
  }
  function drive() {
    const started = !!(state.life && state.life.started);
    if (hudEl) hudEl.style.display = started ? '' : 'none';
    if (!started) { window.LIFE_HIDDEN = true; window.LIFE_INFO = null; return; }
    if (state.scene !== 'town') state.scene = 'town';
    if (typeof state._log !== 'function') state._log = m => log(m);
    if (!open) { process(); watchLoot(); }
    const s = LifeSim.sample(state, clock);
    player = s.x; playerY = s.y; moving = s.moving; anim = s.anim; if (s.face) face = s.face;
    window.LIFE_HIDDEN = s.hidden; window.LIFE_ACT = s.act; window.LIFE_INFO = s;
    const t = performance.now();
    if (t - hudAt > 250) { hudAt = t; hud(s); }
  }
  function hud(s) {
    if (!hudEl) return;
    const L = state.life;
    hudEl.querySelector('.l1').textContent = 'วันที่ ' + state.day + ' · ' + CityLighting.timeText(clock) + ' ' + CityLighting.phaseText(clock);
    hudEl.querySelector('.bars').textContent = 'เงิน ' + state.money + ' · แรง ' + state.energy + ' · สุขภาพ ' + state.health + ' · อันตราย ' + state.danger + '/5';
    const where = s.room && window.Interiors && Interiors.SCENES[s.room] ? Interiors.SCENES[s.room].name : s.place;
    hudEl.querySelector('.l3').textContent = where + ' · ' + s.act;
    const msg = state.events[0] || '';
    if (msg && msg !== lastToast) {
      lastToast = msg; toastEl.textContent = msg.replace(/^วันที่ \d+ · /, ''); toastEl.classList.add('show');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3800);
    }
    if (!hudEl._drawn) { hudEl._drawn = true; drawFace(hudEl.querySelector('canvas'), 'hero', 0); }
    if (!hudEl._drawn && sprite.complete && sprite.naturalWidth) { hudEl._drawn = true; portrait(hudEl.querySelector('canvas'), sprite, 400, 680, PLAYER_BOX); }
  }
  function init() {
    if (inited) return; inited = true;
    window.LIFE_AUTO = true;
    hudEl = document.createElement('div'); hudEl.id = 'hud';
    hudEl.innerHTML = '<canvas></canvas><div><div class="l1"></div><div class="bars"></div><div class="l3"></div></div>';
    document.body.appendChild(hudEl);
    toastEl = document.createElement('div'); toastEl.id = 'lgtoast'; document.body.appendChild(toastEl);
    const b = document.createElement('button'); b.id = 'lifebtn'; b.textContent = 'ชีวิต'; b.onclick = panel; document.body.appendChild(b);
    lastToast = state.events[0] || '';
    if (!LifeSim.ensure(state) || !state.life.started) {
      const resume = LifeSim.ensure(state) && !state.life.started;
      const start = () => resume ? (state._log = m => log(m), intro(LifeSim.originOf(state))) : newLife();
      // wait until the scene art is ready so the intro sits over the town
      const wait = () => (document.getElementById('loading').hidden ? start() : setTimeout(wait, 150));
      wait();
    }
  }
  window.LifeUI = { init, drive, panel, newLife, event, _state: () => ({ open: !!open }) };
})();
