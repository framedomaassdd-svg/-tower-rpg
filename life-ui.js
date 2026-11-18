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
  #lgmenu{position:fixed;right:12px;bottom:max(14px,env(safe-area-inset-bottom));z-index:12;display:flex;flex-direction:column;gap:8px}
  #lgmenu button{width:64px;height:auto;padding:5px 0 4px;border-radius:14px;background:#2a2230e6;border:1px solid #ffffff55;color:#fff;font:600 11px/1.1 system-ui;display:flex;flex-direction:column;align-items:center;gap:1px;touch-action:manipulation}
  #lgmenu button:active{background:#5a4430}
  @media(max-width:520px){#lgmenu button{width:54px;font-size:10px}#lgmenu{gap:6px}}
  .lg-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:-6px 0 10px}
  .lg-tabs button{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 0;border-radius:12px;border:1px solid #ffffff30;background:var(--lg-btn);color:var(--lg-muted);font:600 12px/1.2 system-ui}
  .lg-tabs .on{border-color:var(--lg-gold);color:var(--lg-gold);background:#4a3826}
  .lg-skill{display:grid;grid-template-columns:auto 1fr auto;gap:6px 10px;align-items:center;font-size:14px}
  .lg-bar{height:10px;border-radius:99px;background:#ffffff18;overflow:hidden} .lg-bar i{display:block;height:100%;background:linear-gradient(90deg,#c98a3a,#f2c14e)}
  .lg-zone{margin:10px 0 4px;padding:8px 10px 6px;border-radius:12px;background:#ffffff0b;border:1px solid #ffffff18} .lg-zone.here{border-color:var(--lg-gold)}
  .lg-zone svg{display:block;width:100%;height:auto;overflow:visible}
  #lgtoast{position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:12;max-width:min(560px,calc(100vw - 170px));
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
  .lg-rarity{font-weight:700;text-shadow:0 0 5px #0008}
  .lg-enhance-pick{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:7px}
  .lg-enhance-pick .lg-btn{margin:0}
  .lg-enhance-pick .lg-cur{border-color:#e0a84a;background:#4a3826}
  .lg-drop-special{border:1px solid #c99a55;border-radius:12px;padding:10px;margin:9px 0}
  .lg-safe-card{max-width:800px}
  .lg-safe-head{position:sticky;top:-22px;z-index:2;background:var(--lg-bg);padding:4px 0 12px;border-bottom:1px solid #ffffff24}
  .lg-safe-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:10px 0}
  .lg-safe-tabs button{border-radius:10px;padding:10px 3px;background:#3a2c20;color:#f6ecd8;font-size:13px}
  .lg-safe-tabs button.on{background:#9e7538;border-color:#f2c14e;color:#fff}
  .lg-safe-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:7px}
  .lg-safe-grid .lg-btn{margin:0;font-size:14px;min-height:76px}
  .lg-safe-note{color:#eccc75;min-height:22px;margin:6px 0;font-size:14px}
  .lg-tower-directions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:8px 0}
  .lg-reels{display:flex;gap:10px;justify-content:center;margin:12px 0 4px}
  .lg-reel{width:74px;height:82px;border-radius:14px;background:linear-gradient(#120b07,#2a1c12 50%,#120b07);border:2px solid var(--lg-line);font-size:46px;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 14px #000c}
  .lg-reel.stop{border-color:#ffd76a;box-shadow:inset 0 0 14px #000c,0 0 12px #ffd76a66}
  .lg-res{margin:6px 0;padding:0;list-style:none} .lg-res li{margin:3px 0}
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
  // v102 menu icons: ui_icons.webp is 2×2 — 0 bag · 1 skills · 2 map · 3 character
  const UI_ICON = { bag: [0, '🎒'], skill: [1, '✨'], map: [2, '🗺️'], char: [3, '👤'] };
  let uiOk = false;
  (function () { const im = new Image(); im.onload = () => { uiOk = true; document.querySelectorAll('[data-uiic]').forEach(e => { e.outerHTML = uiIcon(e.dataset.uiic, +e.dataset.px); }); }; im.src = 'ui_icons.webp?v=102'; })();
  function uiIcon(id, px) {
    const [k, emo] = UI_ICON[id];
    if (uiOk) return `<i class="lg-ic" style="width:${px}px;height:${px}px;background-image:url(ui_icons.webp?v=102);background-size:200% 200%;background-position:${k % 2 * 100}% ${Math.floor(k / 2) * 100}%"></i>`;
    return `<i class="lg-ic lg-emo" data-uiic="${id}" data-px="${px}" style="width:${px}px;height:${px}px;font-size:${Math.round(px * 0.72)}px;line-height:${px}px">${emo}</i>`;
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
  const gearText = id => {
    const g = Skills.gear(state, id);
    if (!g) return esc(B().name(id));
    const e = Skills.effectiveGear(state, id), col = Skills.RARITY_COLORS[Skills.rarityIndex(g.rarity)];
    const stats = [e.atk && 'ATK ' + e.atk, e.def && 'DEF ' + e.def,
      ...Object.entries(e.bonus).map(([k,v]) => (Skills.STAT_NAME[k] || k) + ' +' + v)].filter(Boolean).join(' · ');
    return `${esc(B().name(g.templateId))} <span class="lg-rarity" style="color:${col}">${esc(g.rarity)} +${g.step}</span><small>${esc(stats)}</small>`;
  };
  // the town smithy is reachable any day you are in town (the hero walks there after work); not while inside the tower
  const isSmith = () => !(X() && X().active(state));
  function enhanceOptions() { return B().list(state).filter(s => s.instanceId).map(s => s.instanceId).concat(Object.values(state.equip || {})); }
  function enhancementUI(selected, sacrificed, location) {
    const ids = enhanceOptions(), item = Skills.gear(state, selected);
    if (!item) return '<p>ไม่มีอุปกรณ์ให้ตีบวก</p>';
    const mats = [...sacrificed].map(id => Skills.gear(state, id)).filter(Boolean);
    const chance = Skills.enhanceChance(item, mats), cost = Skills.enhanceCost(item);
    const price = location === 'city' ? cost.cityCoins : 0;
    return `<h3>เลือกอุปกรณ์</h3><div class="lg-enhance-pick">${ids.map(id => `<button class="lg-btn ${id === selected ? 'lg-cur' : ''}" data-enhance-pick="${esc(id)}">${gearText(id)}</button>`).join('')}</div>
      <h3>สังเวยอาวุธ (สูงสุด 2 ชิ้น)</h3><p class="lg-muted">ต้องเป็นระดับเดียวกัน · ห้ามใช้อุปกรณ์ที่สวมอยู่ หรือชิ้นที่กำลังตี</p>
      <div class="lg-enhance-pick">${B().list(state).filter(s => s.instanceId && s.instanceId !== selected && Skills.GEAR[Skills.gear(state, s.instanceId).templateId].slot === 'weapon' && Skills.gear(state, s.instanceId).rarity === item.rarity).map(s => `<button class="lg-btn ${sacrificed.has(s.instanceId) ? 'lg-cur' : ''}" data-enhance-sac="${esc(s.instanceId)}">${sacrificed.has(s.instanceId) ? '✓ ' : ''}${gearText(s.instanceId)}</button>`).join('') || '<p class="lg-muted">ไม่มีอาวุธที่ใช้สังเวยได้</p>'}</div>
      <div class="lg-zone"><b>${gearText(selected)}</b><p>โอกาสสำเร็จ <b style="color:#f2c14e">${(chance*100).toFixed(1)}%</b> · ใช้ผลึกวิญญาณ ${cost.crystals} ชิ้น (มี ${B().count(state,'soul_crystal')})${price ? ' · ค่าแรง ' + price + ' เหรียญ' : ' · ไม่มีค่าแรง'}</p><p class="lg-muted">สำเร็จ +1 · พลาดขั้น 0–2 ไม่ลด / ขั้น 3 ขึ้นไปลด 1 / ขั้น 6 ขึ้นไปอาจพัง</p></div>
      <button class="lg-btn lg-primary" data-enhance-go="1" ${B().count(state,'soul_crystal') < cost.crystals || state.money < price ? 'disabled' : ''}>🔨 ตีบวกอุปกรณ์</button>`;
  }
  // The same persistent card logic is used in the city forge and the tower safe-zone service.
  function enhanceCard() {
    if (open) return false;
    if (!isSmith()) return false;
    let selected = enhanceOptions()[0], sacrificed = new Set(), note = '';
    const d = el(`<div class="lg-card"><h2>🔨 ตีบวกอุปกรณ์ · โรงตีเหล็ก</h2><p class="lg-safe-note" role="status"></p><div class="lg-safe-inner"></div><button class="lg-btn" data-enhance-close="1">ปิด</button></div>`);
    block(d);
    const render = () => {
      if (!enhanceOptions().includes(selected)) { selected = enhanceOptions()[0]; sacrificed.clear(); }
      d.querySelector('.lg-safe-note').textContent = note;
      d.querySelector('.lg-safe-inner').innerHTML = enhancementUI(selected, sacrificed, 'city');
      d.querySelectorAll('[data-enhance-pick]').forEach(el => el.onclick = () => { selected=el.dataset.enhancePick;sacrificed.clear();render(); });
      d.querySelectorAll('[data-enhance-sac]').forEach(el => el.onclick = () => {
        const id=el.dataset.enhanceSac;
        if (sacrificed.has(id)) sacrificed.delete(id); else if (sacrificed.size < 2) sacrificed.add(id);
        render();
      });
      const go=d.querySelector('[data-enhance-go]'); if (go) go.onclick=() => { const r=Skills.enhance(state,selected,[...sacrificed],'city');note=r.why;if(r.ok){sacrificed.clear();log(r.why);save();}render(); };
    };
    d.querySelector('[data-enhance-close]').onclick=()=>closeOverlay(d);render();return true;
  }
  function gearSummaryHtml() {
    const equipped = Object.entries(Skills.SLOTS).map(([slot,name]) => {
      const id = state.equip && state.equip[slot];
      return `<div class="lg-zone"><b>${esc(name)}</b><p>${id ? gearText(id) : '<span class="lg-muted">ไม่มีอุปกรณ์สวมใส่</span>'}</p>${id ? `<button class="lg-btn" data-unequip="${slot}">ถอด</button>` : ''}</div>`;
    }).join('');
    const loose = B().list(state).filter(s=>s.instanceId).map(s=>`<button class="lg-btn" data-equip="${esc(s.instanceId)}">${gearText(s.instanceId)}<small>แตะเพื่อสวมใส่</small></button>`).join('');
    return '<h3>อุปกรณ์ที่สวมใส่</h3>'+equipped+'<h3>อุปกรณ์ในกระเป๋า</h3>'+(loose||'<p class="lg-muted">ไม่มีอุปกรณ์ในกระเป๋า</p>');
  }
  function bagHtml() {
    const b = B(), L = state.life, bag = b.list(state).slice().sort((x, y) => (x.exp || 1e9) - (y.exp || 1e9));
    const rows = [`<div class="lg-slot">${iconHtml(state.money >= 10 ? 'coins' : 'coin', 52)}<b>${state.money}</b>เหรียญ</div>`]
      .concat(Object.keys(b.vehicles(state)).map(id => `<div class="lg-slot">${iconHtml(id, 52)}${esc(b.name(id))}<span class="d">จอดไว้</span></div>`))
      .concat(bag.map(st => { const it = b.ITEMS[st.id], left = b.daysLeft(st, state.day);
        return `<div class="lg-slot">${iconHtml(st.id, 52)}<b>${st.n}</b>${st.instanceId ? gearText(st.instanceId) : esc(it.name) + (st.rarity ? ' [' + esc(st.rarity) + ']' : '')}${left === Infinity ? '' : left <= 0 ? '<span class="x">เสียคืนนี้</span>' : '<span class="d">เหลือ ' + (left + 1) + ' วัน</span>'}</div>`; })).join('');
    const O = L.order && LifeSim.orderToday(state) || (L.order && L.order.day > state.day ? L.order : null);
    return `<h3>กระเป๋า (${b.total(state)}/${b.CAP})</h3>
      ${X() && X().safeInfo(state) ? '<button class="lg-btn lg-primary" data-safe="1">🏕 เปิดบริการเซฟโซน ชั้น ' + X().X(state).floor + ' · ' + esc(X().safeInfo(state).name) + '</button>' : ''}
      <div class="lg-bag">${rows}</div>${bag.length ? '' : '<p class="lg-muted">ยังไม่มีของในกระเป๋า</p>'}
      ${isSmith() ? '<button class="lg-btn" data-enhance-city="1">🔨 ตีบวกอุปกรณ์ที่โรงตีเหล็ก</button>' : ''}
      ${isSmith() && bag.some(s => s.instanceId) ? '<h3>ขายอุปกรณ์</h3>' + bag.filter(s => s.instanceId).map(s => `<button class="lg-btn" data-gear-sell="${esc(s.instanceId)}">💰 ${gearText(s.instanceId)}<small>ขายได้ ${B().gearSalePrice(state,s.instanceId,B().ITEMS[s.id].sell)} เหรียญ</small></button>`).join('') : ''}
      <button class="lg-btn ${L.eatBag ? 'lg-cur' : ''}" data-a="eatbag">${L.eatBag ? '✓ ' : ''}กินของในกระเป๋าก่อน<small>มีของกินเมื่อไหร่ จะกินแทนการไปซื้อข้าวเย็น (ประหยัดเงิน ของใกล้เสียถูกกินก่อน)</small></button>
      ${stashHtml()}
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
      const fee = L.path === 'smith' ? 0 : b.FORGE_FEE, odds = Math.round(Math.min(0.95, 0.6 + 0.03 * (state.smithWork || 0) + 0.02 * (state.strength || 15) / 5) * 100);
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
  const TABS = [['bag', 'กระเป๋า'], ['skill', 'สกิล'], ['map', 'แผนที่'], ['char', 'ตัวละคร']];
  let tab = 'char';
  function charHtml() {
    const L = state.life, o = LifeSim.originOf(state);
    return `<h2>ตัวละคร</h2>
      <p>ตัวตนในโลกเดิม: <b>${esc(o.name)}</b> อายุ ${L.age} ปี · ใช้ชีวิตในต่างโลกมา ${state.day} วัน</p>
      <p class="lg-muted">${esc(o.perk)}</p>
      <h3>แนวทาง</h3><p>${esc(LifeSim.PATHS[L.path].name)}${L.pendingPath ? ' → พรุ่งนี้: ' + esc(LifeSim.PATHS[L.pendingPath].name) : ''}${[state.guild && 'สมาชิกโล่เหล็ก', state.compassMember && 'สมาชิกเข็มทิศเงิน', state.merchMember && 'นักตีราคากิลด์พ่อค้า'].filter(Boolean).map(t => ' · ' + t).join('')}</p>
      <button class="lg-btn" data-a="path">เปลี่ยนแนวทางชีวิต<small>มีผลตั้งแต่เช้าวันพรุ่งนี้</small></button>
      ${expHtml()}
      ${gearSummaryHtml()}
      ${guildHtml()}
      <h3>ที่พัก</h3><p class="lg-muted">เลือกห้องที่อยากพักทุกคืน ถ้าเงินไม่พอ ตัวละครจะพักห้องที่ถูกลงเอง จนถึงห้องเช่าในตรอกล่าง ถ้าไม่มีเลยจะนอนม้านั่ง (ศาลเจ้าร้างกับเพิงข้างกองขยะนอนฟรี แต่ต้องเลือกเอง) และถ้าไม่มีเงินกินข้าวจะไปรับซุปฟรีที่โรงทาน</p>
      ${LifeSim.ROOM_ORDER.slice().reverse().map(id => { const r = LifeSim.ROOMS[id], price = LifeSim.roomPrice(state, id);
        return `<button class="lg-btn ${L.roomPref === id ? 'lg-cur' : ''}" data-room="${id}">${esc(r.name)} · ${price ? price + ' เหรียญ/คืน' : 'ฟรี'}${price < r.price ? '<span class="lg-tag">ราคาพนักงาน</span>' : ''}${L.roomPref === id ? '<span class="lg-tag">เลือกอยู่</span>' : ''}<small>${esc(r.desc)}</small></button>`; }).join('')}
      <h3>หอคอยและเมือง</h3><div class="lg-stats"><span>ชั้นที่สำรวจ ${state.floor}</span><span>อันตราย ${state.danger}/5</span><span>เสบียง ${state.supplies}</span><span>ภาษีค้าง ${state.taxDue}</span></div>
      <h3>บันทึก</h3><div class="lg-log">${esc(state.events.slice(0, 8).join('\n') || 'ยังไม่มีบันทึก')}</div>
      <button class="lg-btn" data-a="new">เริ่มชีวิตใหม่<small>สุ่มตัวตนใหม่ ความคืบหน้าเดิมจะหายไป</small></button>`;
  }
  // v105 the guild: quest board (tower paths), which kitchen the guild chef works in
  // ---------- v109 expeditions into the tower ----------
  const X = () => window.Expedition;
  function expHtml() {
    const L = state.life, x = L.exp, E = X(); if (!E) return '';
    if (x && !x.over && state.day >= x.start) {
      const T = E.terrainOf(x.floor), K = x.stones[x.floor] || {}, need = E.needOf(x.floor);
      return `<h3>อยู่ในหอคอย</h3><p>ชั้น ${x.floor} · ${esc(T.name)} · วันที่ ${state.day - x.start + 1}${x.party ? (x.separated ? ' · <b style="color:#ff9a7a">หลงจาก' + esc(E.PARTY[x.party].name) + '</b>' : ' · กับ' + esc(E.PARTY[x.party].name)) : ' · คนเดียว'}${x.ally ? ' · มี' + esc(x.ally.name) + 'ร่วมทาง' : ''}</p>
        ${E.safeInfo(state) ? '<p>✦ ' + esc(E.safeInfo(state).name) + ' · ศิลาทางออกและศิลาทางขึ้นพร้อมใช้งาน</p><p class="lg-muted">' + esc(E.safeInfo(state).desc) + '</p>' : `<p>ค้นหาศิลา</p><div class="lg-bar"><i style="width:${Math.max(3, Math.min(100, x.search / need * 100))}%"></i></div><p class="lg-muted">${x.search}/${need}${K.exit ? ' · ✦ รู้ตำแหน่งศิลาทางออก' : ''}${K.up ? ' · ✦ รู้ตำแหน่งศิลาทางขึ้น' : ''} · ทางออกจากหอคอยมีทางเดียวคือศิลาทางออก</p>`}
        <p class="lg-muted">ของกิน ${B().meals(state)} มื้อ · ยาฟื้นแรง ${B().count(state, 'potion')} ขวด · ชนะ ${x.wins} ครั้ง</p>
        ${E.safeInfo(state) ? '<button class="lg-btn lg-primary" data-safe="1">🏕 เปิดบริการ · ' + esc(E.safeInfo(state).name) + '</button>' : ''}
        <div class="lg-log">${esc(x.log.slice(0, 5).map(e => 'วันที่ ' + e.day + ' · ' + e.title + ': ' + e.lines.join(' / ')).join('\n'))}</div>`;
    }
    if (x && !x.over) return `<h3>หอคอย</h3><p>จะเข้าหอคอยเช้าวันที่ ${x.start}${x.party ? ' กับ' + esc(E.PARTY[x.party].name) : ' คนเดียว'}</p>
      <button class="lg-btn" data-a="xcancel">ยกเลิก</button>`;
    return `<h3>หอคอย</h3><button class="lg-btn lg-primary" data-a="xprep">เตรียมเข้าหอคอย<small style="color:#2a1a0c">เริ่มชั้น 1 เสมอ · ออกได้ทางศิลาทางออกเท่านั้น · เวลาในเมืองเดินต่อ</small></button>`;
  }
  const PREP_SHOP = [['jerky', 5, 'เก็บได้ 10 วัน'], ['bread', 3, 'เก็บได้ 3 วัน'], ['potion', 7, 'ดื่มเองเมื่อสุขภาพต่ำ']];
  function prepCard(sel) {
    const E = X(), L = state.life; sel = sel || { party: null };
    const path = L.path, G = LifeSim.guildOf(state), guildOK = G && G.member && E.PARTY[path];
    const parties = [[null, 'ไปคนเดียว', 'ไม่มีใครช่วยถ้าพลาด อาจตายได้จริง']]
      .concat(guildOK ? [[path, 'ไปกับ' + E.PARTY[path].name, 'พลังทีม +' + E.PARTY[path].power + ' · แพ้หนักแล้วทีมช่วยไว้ (เสียเงิน อุปกรณ์ ครึ่งหนึ่ง)']] : [])
      .concat([['guard', 'จ้างนักรบคุ้มกัน', E.GUARD_FEE + ' เหรียญ/วัน (มัดจำ 5 วัน ' + E.GUARD_FEE * 5 + ' เหรียญ ที่เหลือจ่ายตอนออก) · พลัง +' + E.PARTY.guard.power + ' · ช่วยชีวิตได้ถ้าไม่หลงกัน']]);
    const meals = B().meals(state), need = 0;
    const d = el(`<div class="lg-card"><h2>เตรียมเข้าหอคอย</h2>
      <p class="lg-muted">เข้าหอคอยเช้าพรุ่งนี้ แสงจากประตูจะพาไปโผล่ที่ใดที่หนึ่งในชั้น 1 (บางครั้งหลุดจากทีม) ออกได้ทางเดียวคือหา<b>ศิลาทางออก</b> ส่วน<b>ศิลาทางขึ้น</b>พาไปชั้นถัดไป ไม่รู้ว่าจะใช้เวลากี่วัน ทุกคืนกินของ 1 มื้อ ในหอคอยหาผลไม้หรือล่าสัตว์กินได้</p>
      <h3>ไปกับใคร</h3>${parties.map(([id, n, dsc]) => `<button class="lg-btn ${sel.party === id ? 'lg-cur' : ''}" data-party="${id || ''}" ${id === 'guard' && state.money < E.GUARD_FEE * 5 ? 'disabled' : ''}>${esc(n)}<small>${esc(dsc)}</small></button>`).join('')}
      <h3>เสบียง</h3><p>ของกิน ${meals} มื้อ${meals < 3 ? ' <b style="color:#ff9a7a">น้อยมาก</b>' : ''} · ยาฟื้นแรง ${B().count(state, 'potion')} ขวด · กระเป๋า ${B().total(state)}/${B().CAP} · เงิน ${state.money}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 6px">${PREP_SHOP.map(([id, p, n]) => `<button class="lg-btn" data-buy="${id}" ${state.money < p || B().total(state) >= B().CAP ? 'disabled' : ''}>${iconHtml(id, 24)} ${esc(B().name(id))}<small>${p} เหรียญ · ${n}</small></button>`).join('')}</div>
      <p class="lg-muted">ซื้อจากแผงเสบียงหน้าประตูหอคอย (แพงกว่าในตลาดนิดหน่อย) · ฝากของที่ไม่ใช้ไว้ในหีบกิลด์ จะได้มีที่ใส่ของที่หาได้</p>
      <button class="lg-btn lg-primary" data-go="1">เข้าหอคอยพรุ่งนี้เช้า</button><button class="lg-btn" data-go="">ยังก่อน</button></div>`);
    block(d);
    const redo = () => { d.remove(); block(null); prepCard(sel); };
    d.querySelectorAll('[data-party]').forEach(b => b.onclick = () => { sel.party = b.dataset.party || null; redo(); });
    d.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const [id, p] = PREP_SHOP.find(q => q[0] === b.dataset.buy);
      if (state.money >= p && B().add(state, id, 1, state.day)) state.money -= p; save(); redo(); });
    d.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
      if (b.dataset.go) { const r = E.plan(state, { party: sel.party }); if (!r.ok) { alert(r.why); return; }
        log('เตรียมเข้าหอคอยเช้าวันที่ ' + r.start + (sel.party ? ' กับ' + E.PARTY[sel.party].name : ' คนเดียว')); save(); }
      d.remove(); block(null); panel('char'); });
  }
  // v111 safe zone: one persistent shop-like overlay, not one action per encounter/day.
  function safeCard() {
    const E = X(), info = E && E.safeInfo(state);
    if (!info || open) return false;
    const exp = E.X(state);
    exp.safePending = false;                         // opening is not a daily action
    const allTabs = [['shop','ร้าน'],['sell','รับซื้อ'],['rest','ที่พัก'],['chest','หีบ'],['hire','จ้างคน'],['forage','หาของกิน'],['stone','ศิลา']];
    const tabs = allTabs.filter(([id]) => info.services.includes(id));
    if (info.enhance) tabs.splice(Math.max(0,tabs.findIndex(x=>x[0]==='forage')),0,['enhance','ตีบวก']);
    let section = tabs[0][0], note = '', selected = enhanceOptions()[0], sacrificed = new Set();
    const d = el(`<div class="lg-card lg-safe-card"><div class="lg-safe-head">
      <h2>🏕 เซฟโซน ชั้น ${info.floor} · ${esc(info.name)}</h2>
      <p class="lg-muted">${esc(info.desc)}</p>
      <p class="lg-muted">ทั้งชั้นปลอดภัย · ศิลาทั้งสองชนิดพร้อมใช้ · เปิดใช้บริการได้หลายครั้งก่อนปิด</p>
      <p class="lg-safe-stats"></p>
      <div class="lg-safe-tabs"></div><p class="lg-safe-note" role="status" aria-live="polite"></p></div>
      <div class="lg-safe-inner"></div><button class="lg-btn lg-primary" data-safe-close="1">ปิดหน้าบริการ</button></div>`);
    block(d);
    const b = B();
    const smallButton = (kind, id, title, desc, disabled, rarity) => `<button class="lg-btn" data-safe-action="${kind}" data-safe-id="${esc(id || '')}" data-safe-rarity="${esc(rarity || '')}" ${disabled ? 'disabled' : ''}>${title}<small>${desc || ''}</small></button>`;
    function render() {
      const x = E.X(state), floor = x.floor;
      const current = E.safeInfo(state);
      if (!current) { closeOverlay(d); return; }
      if (!(section === 'enhance' ? current.enhance : current.services.includes(section))) section = 'stone';
      d.querySelector('.lg-safe-stats').textContent = 'เงิน ' + state.money + ' เหรียญ · สุขภาพ ' + state.health + '/100 · แรง ' + state.energy + '/100 · กระเป๋า ' + b.total(state) + '/' + b.CAP;
      d.querySelector('.lg-safe-tabs').innerHTML = tabs.map(([id,n]) => `<button data-safe-tab="${id}" class="${section === id ? 'on' : ''}">${n}</button>`).join('');
      d.querySelector('.lg-safe-note').textContent = note;
      let html = '';
      if (section === 'shop') {
        html = '<h3>ร้านค้าภายในหอคอย</h3><p class="lg-muted">ซื้อทีละชิ้น กดซ้ำได้ · ราคาตามประเภทชั้น</p><div class="lg-safe-grid">' +
          current.shop.map(id => smallButton('buy', id, iconHtml(id, 30) + ' ' + esc(b.name(id)), b.safeBuyPrice(id, floor, current.price) + ' เหรียญ · มี ' + b.count(state, id), state.money < b.safeBuyPrice(id, floor, current.price) || b.total(state) >= b.CAP)).join('') + '</div>' +
          (Object.entries(window.Skills && window.Skills.BOOK_SKILL || {}).filter(([book, skill]) => b.count(state, book)).length ?
            '<h3>อ่านตำราที่มีอยู่</h3><div class="lg-safe-grid">' + Object.entries(window.Skills.BOOK_SKILL).filter(([book]) => b.count(state, book)).flatMap(([book]) => b.list(state).filter(s=>s.id===book).map(s=>smallButton('read', book, '📖 อ่าน ' + esc(b.name(book)) + ' [' + esc(s.rarity||'normal') + ']', 'ได้รับ XP ตามระดับ ×'+Skills.rarityMultiplier(s.rarity||'normal'),false,s.rarity||'normal'))).join('') + '</div>' : '');
      } else if (section === 'sell') {
        const items = Object.keys(b.ITEMS).filter(id => b.SAFE_BUYER.includes(id) && b.count(state, id));
        html = '<h3>จุดรับซื้อวัสดุ</h3><p class="lg-muted">ขายทีละชิ้น รับเหรียญทันที (ไม่ขายของสวมใส่อัตโนมัติ)</p>' +
          (items.length ? '<div class="lg-safe-grid">' + items.map(id => smallButton('sell', id, iconHtml(id, 30) + ' ' + esc(b.name(id)), 'มี ' + b.count(state, id) + ' · ได้ ' + b.safeSellPrice(id, floor, 1 / current.price) + ' เหรียญ')).join('') + '</div>' : '<p>ไม่มีวัสดุที่ร้านรับซื้อ</p>') +
          '<h3>ขายอุปกรณ์รายชิ้น</h3><div class="lg-safe-grid">' + b.list(state).filter(s => s.instanceId).map(s => smallButton('sell', s.instanceId, gearText(s.instanceId), 'ได้ ' + b.gearSalePrice(state,s.instanceId,b.safeSellPrice(s.id,floor,1/current.price)) + ' เหรียญ')).join('') + '</div>';
      } else if (section === 'rest') {
        const cost = Math.ceil(16 * current.price);
        html = '<h3>ที่พักในเซฟโซน</h3><p>พักปลอดภัย สุขภาพ +32 และแรงเต็ม ค่าพัก ' + cost + ' เหรียญ · วันละครั้ง</p>' +
          smallButton('rest', '', '🛏️ เข้าพัก', x.safeRestDay === state.day ? 'พักแล้ววันนี้' : cost + ' เหรียญ', x.safeRestDay === state.day || state.money < cost);
      } else if (section === 'chest') {
        const stashed = b.stash(state).filter(y => b.ITEMS[y.id]);
        const carrying = b.list(state).filter(y => b.ITEMS[y.id] && b.ITEMS[y.id].kind !== 'meal');
        html = '<h3>หีบเก็บของในหอคอย</h3><p class="lg-muted">ฝาก/ถอนทีละชิ้น กดซ้ำได้ หีบเดียวกับหีบฝากของในเมือง ของกินไม่รับฝาก</p>' +
          '<h3>ฝากจากกระเป๋า</h3>' + (carrying.length ? '<div class="lg-safe-grid">' + carrying.map(y => smallButton('deposit', y.instanceId || y.id, 'ฝาก ' + iconHtml(y.id, 24) + (y.instanceId ? gearText(y.instanceId) : esc(b.name(y.id))), 'ในกระเป๋า ×' + b.count(state, y.instanceId || y.id))).join('') + '</div>' : '<p class="lg-muted">ไม่มีของที่ฝากได้</p>') +
          '<h3>ถอนจากหีบ</h3>' + (stashed.length ? '<div class="lg-safe-grid">' + [...new Set(stashed.map(y => y.instanceId || y.id))].map(id => {const g=Skills.gear(state,id), template=g?g.templateId:id;return smallButton('withdraw',id,'รับคืน '+iconHtml(template,24)+(g?gearText(id):esc(b.name(id))),'ในหีบ ×'+stashed.filter(y=>(y.instanceId||y.id)===id).reduce((a,y)=>a+y.n,0),b.total(state)>=b.CAP);}).join('') + '</div>' : '<p class="lg-muted">หีบว่าง</p>');
      } else if (section === 'enhance') {
        if (!enhanceOptions().includes(selected)) { selected = enhanceOptions()[0]; sacrificed.clear(); }
        html = '<h3>ตีบวกอุปกรณ์ในเซฟโซน</h3>' + (selected ? enhancementUI(selected,sacrificed,'safe') : '<p>ไม่มีอุปกรณ์ให้ตีบวก</p>');
      } else if (section === 'hire') {
        const cost = Math.ceil(180 * current.price);
        html = '<h3>ผู้รับจ้างร่วมทาง</h3><p>ค่าจ้างครั้งเดียว ' + cost + ' เหรียญ นักรบคุ้มกัน +83 พลัง อยู่ด้วยระหว่างการเดินทางจนสิ้นสุดรอบสำรวจ</p>' +
          (x.ally ? '<p>ร่วมทางแล้ว: ' + esc(x.ally.name) + ' · พลัง +' + x.ally.power + '</p>' : smallButton('hire', '', '🤝 จ้างผู้คุ้มกัน', cost + ' เหรียญ', state.money < cost));
      } else if (section === 'forage') {
        html = '<h3>หาของกินในเซฟโซน</h3><p>ออกเก็บผลไม้ป่าภายในชั้นที่ปลอดภัย วันละหนึ่งครั้ง · ทุ่งหญ้าได้มาก เมืองได้น้อย</p>' +
          smallButton('forage', '', '🍎 ออกหาผลไม้', current.forageDay === state.day ? 'เก็บไปแล้ววันนี้' : 'ไม่เสียเงิน', current.forageDay === state.day || b.total(state) >= b.CAP) +
          (!current.services.includes('rest') ? '<h3>พักกลางแจ้ง</h3><p>ไม่มีอาคารที่พัก แต่นอนในทุ่งได้อย่างปลอดภัย ฟื้นสุขภาพ +10 และแรง +45 · วันละครั้ง</p>' +
            smallButton('rest', '', '🌙 นอนกลางแจ้ง', x.safeRestDay === state.day ? 'พักไปแล้ววันนี้' : 'ไม่เสียเงิน', x.safeRestDay === state.day) : '');
      } else if (section === 'stone') {
        html = '<h3>ศิลาเดินทาง · พร้อมใช้งาน</h3><p>ศิลาทางออกจะพากลับไปประตูหอคอยในเมือง ศิลาทางขึ้นส่งขึ้นอีกหนึ่งชั้น ไม่สามารถเดินออกจากชั้นได้เอง</p>' +
          smallButton('stone', 'exit', '🔹 ศิลาทางออก · กลับเมือง', 'ปิดการสำรวจครั้งนี้') +
          smallButton('stone', 'up', '🟡 ศิลาทางขึ้น · ชั้น ' + (floor + 1), esc(E.terrainOf(floor + 1).name));
      }
      d.querySelector('.lg-safe-inner').innerHTML = html;
      d.querySelectorAll('[data-safe-tab]').forEach(btn => btn.onclick = () => { section = btn.dataset.safeTab; note = ''; render(); });
      d.querySelectorAll('[data-enhance-pick]').forEach(el => el.onclick = () => { selected = el.dataset.enhancePick; sacrificed.clear(); render(); });
      d.querySelectorAll('[data-enhance-sac]').forEach(el => el.onclick = () => { const id = el.dataset.enhanceSac;
        if (sacrificed.has(id)) sacrificed.delete(id); else if (sacrificed.size < 2) sacrificed.add(id); render(); });
      const go = d.querySelector('[data-enhance-go]'); if (go) go.onclick = () => {
        const result = E.safeAction(state, 'enhance', selected, { sacrifices: [...sacrificed] });
        note = result.why; if (result.ok) { sacrificed.clear(); log(result.why); save(); } render();
      };
      d.querySelectorAll('[data-safe-action]').forEach(btn => btn.onclick = () => {
        const result = E.safeAction(state, btn.dataset.safeAction, btn.dataset.safeId, btn.dataset.safeAction === 'read' ? {rarity:btn.dataset.safeRarity||'normal'} : clock);
        note = result.why; if (result.ok) { log('เซฟโซน: ' + result.why); save(); }
        if (result.travel) { closeOverlay(d); return; }
        render();                     // keep same card open, allowing any number of transactions
      });
    }
    d.querySelector('[data-safe-close]').onclick = () => closeOverlay(d);
    render(); save(); return true;
  }

  // an encounter in the tower: choose → spin the three reels → see what happened
  function encounterCard(enc) {
    const E = X(), Eng = window.TowerSlotEngine;
    const d = el(`<div class="lg-card"><canvas></canvas><div><div class="who">${esc(enc.title)}</div><p class="line">${esc(enc.text)}</p></div><div class="lg-actions"></div></div>`, 'lg-event');
    block(d);
    const cv = d.querySelector('canvas'), actions = d.querySelector('.lg-actions'), line = d.querySelector('.line');
    drawFace(cv, 'hero', enc.scene === 'combat' ? 2 : 0);
    actions.innerHTML = (enc.noSpin ? '' : '<p class="lg-muted" style="margin:0">เลือกแล้วจะหมุนสล็อตสามวง ตัวเลือกเปลี่ยนโอกาสที่สัญลักษณ์แต่ละแบบจะออก</p>') + E.choiceView(enc).map(c => `<button class="lg-btn" data-i="${c.index}">${esc(c.label)}<small>${esc(c.hint)}</small></button>`).join('');
    actions.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
      const view = E.choiceView(enc)[+b.dataset.i];
      if (view.noSpin) {                                   // using a stone, sharing food...: no reels
        const had = holding(), res = E.resolve(state, enc, +b.dataset.i), got = diff(had, holding()); snap = holding(); snapOf = state; save();
        line.textContent = enc.choices[+b.dataset.i].label;
        actions.innerHTML = `<ul class="lg-res">${res.lines.map(l => '<li>' + esc(l) + '</li>').join('')}</ul>${got.length ? '<div class="lg-gain">' + got.map(chipHtml).join('') + '</div>' : ''}<button class="lg-btn lg-primary" data-ok="1">ตกลง</button>`;
        for (const l of res.lines.slice(0, 2)) log(enc.title + ': ' + l);
        actions.querySelector('[data-ok]').onclick = () => closeOverlay(d);
        return;
      }
      const kind = enc.scene === 'combat' ? 'combat' : 'event', cat = Eng.SYMBOLS[kind];
      const pool = Object.values(cat).filter(s => s.emoji).map(s => s.emoji);
      line.textContent = enc.choices[+b.dataset.i].label;
      actions.innerHTML = `<div class="lg-reels">${[0, 1, 2].map(() => '<div class="lg-reel">❔</div>').join('')}</div><button class="lg-btn lg-primary" data-spin="1">หมุน!</button>`;
      const spin = () => {
        const had = holding(), res = E.resolve(state, enc, +b.dataset.i), got = diff(had, holding()); snap = holding(); snapOf = state; save();
        const reels = actions.querySelectorAll('.lg-reel'); actions.querySelector('[data-spin]').remove();
        const t = setInterval(() => reels.forEach(r => { if (!r.classList.contains('stop')) r.textContent = pool[Math.floor(Math.random() * pool.length)]; }), 70);
        res.reels.forEach((id, i) => setTimeout(() => { reels[i].classList.add('stop'); reels[i].textContent = cat[id].emoji || '・'; }, 700 + i * 450));
        setTimeout(() => {
          clearInterval(t);
          const fight = res.fight ? `<p class="lg-muted">พลังฝ่ายเรา ${res.fight.power} · ${esc(enc.monster.name)} ${res.fight.monster} · โอกาสชนะหลังสล็อต ${res.fight.p}%</p>` : '';
          const special = res.reward ? `<div class="lg-drop-special" style="border-color:${Skills.rarityIndex(res.reward.rarity)>=2 ? Skills.RARITY_COLORS[Skills.rarityIndex(res.reward.rarity)] : '#ffffff22'};${Skills.rarityIndex(res.reward.rarity)>=2 ? 'box-shadow:0 0 15px #dbaf6755;' : ''}">${res.reward.gained ? '✦ ได้รางวัลพิเศษ' : '⚠️ กระเป๋าเต็ม ของตกหาย'} · <span class="lg-rarity" style="color:${Skills.RARITY_COLORS[Skills.rarityIndex(res.reward.rarity)]}">${esc(B().name(res.reward.templateId))} [${esc(res.reward.rarity)}]</span></div>` : '';
          actions.insertAdjacentHTML('beforeend', `<h3 style="margin:8px 0 2px">${esc(res.title)}</h3>${special}${res.description ? '<p class="lg-muted" style="margin:0">' + esc(res.description) + '</p>' : ''}${fight}<ul class="lg-res">${res.lines.map(l => '<li>' + esc(l) + '</li>').join('')}</ul>
            ${got.length ? '<div class="lg-gain">' + got.map(chipHtml).join('') + '</div>' : ''}<button class="lg-btn lg-primary" data-ok="1">${res.dead ? '...' : 'ตกลง'}</button>`);
          for (const l of res.lines.slice(0, 2)) log(enc.title + ': ' + l);
          actions.querySelector('[data-ok]').onclick = () => { if (res.dead) { d.remove(); deathCard(); } else closeOverlay(d); };
        }, 700 + 3 * 450 + 200);
      };
      actions.querySelector('[data-spin]').onclick = spin;
    });
  }
  function deathCard() {
    const D = state.life.dead || {};
    const d = el(`<div class="lg-card" style="text-align:center"><h2>เสียชีวิตในหอคอย</h2><p>ชั้น ${D.floor || '?'} · วันที่ ${D.day || state.day} · ${esc(D.cause || '')}</p>
      <p class="lg-muted">ไม่มีเพื่อนร่วมทีมอยู่ช่วย การผจญภัยของตัวละครนี้จบลงแล้ว</p><button class="lg-btn lg-primary">เริ่มชีวิตใหม่</button></div>`);
    block(d); d.querySelector('button').onclick = () => { d.remove(); block(null); newLife(); };
  }
  function guildHtml() {
    const L = state.life, G = LifeSim.guildOf(state); if (!G) return '';
    let h = `<h3>${esc(G.name)}</h3><p class="lg-muted">${G.member ? 'สมาชิก: กินข้าวเย็นที่โรงอาหารกิลด์ ' + (L.path === 'gchef' ? 'ฟรี' : LifeSim.GUILD_MEAL + ' เหรียญ') + ' · เลือก "ห้องพักกิลด์" ในที่พักได้ · ฝากของในหีบกิลด์ได้ (แท็บกระเป๋า)' + (['guild', 'compass', 'porter'].includes(L.path) ? ' · เข้าหอคอยพร้อมทีมกิลด์ได้ (เตรียมเข้าหอคอยด้านบน)' : '') : 'ยังไม่ได้เป็นสมาชิก สิทธิ์โรงอาหาร ห้องพัก และหีบฝากของจะได้หลังสอบผ่าน'}</p>`;
    if (false) {
      const cur = L.quest || 'normal';
      h += '<p>กระดานภารกิจ (ตัวละครแวะรับที่โถงกิลด์ทุกเช้า)</p>' + Object.entries(LifeSim.QUESTS).map(([id, q]) =>
        `<button class="lg-btn ${cur === id ? 'lg-cur' : ''}" data-quest="${id}">${cur === id ? '✓ ' : ''}${esc(q.name)}<small>${esc(q.desc)}</small></button>`).join('');
    }
    if (L.path === 'gchef') h += '<p>ทำงานในครัวของ</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:0 8px">' + [['iron', 'โล่เหล็ก'], ['compass', 'เข็มทิศเงิน'], ['porter', 'คนแบกของ'], ['merch', 'พ่อค้าหอคอย']].map(([k, n]) =>
      `<button class="lg-btn ${(state.life.chefNext || G.key) === k ? 'lg-cur' : ''}" data-chef="${k}">${n}</button>`).join('') + '</div><p class="lg-muted">เปลี่ยนแล้วมีผลพรุ่งนี้</p>';
    return h;
  }
  function stashHtml() {
    const G = LifeSim.guildOf(state), b = B(); if (!G || !G.member) return '';
    const L = state.life, n = b.stashCount(state);
    const items = b.stash(state).map(st => `<div class="lg-slot">${iconHtml(st.id, 44)}<b>${st.n}</b>${st.instanceId ? gearText(st.instanceId) : esc(b.name(st.id)) + (st.rarity ? ' [' + esc(st.rarity) + ']' : '')}</div>`).join('');
    return `<h3>หีบฝากของ ${esc(G.name)} (${n} ชิ้น)</h3>${items ? '<div class="lg-bag">' + items + '</div>' : ''}
      ${L.stashReq ? '<p class="lg-muted">จะแวะ' + (L.stashReq === 'in' ? 'ฝากของ' : 'รับของ') + 'ที่ห้องเก็บของกิลด์หลังเลิกงาน</p>' : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 8px">
        <button class="lg-btn" data-stash="in">ฝากของ<small>ทุกอย่างยกเว้นของกิน</small></button>
        <button class="lg-btn" data-stash="out" ${n ? '' : 'disabled'}>รับของคืน<small>เท่าที่กระเป๋าใส่ได้</small></button></div>`;
  }
  // v108 stats come only from passive skills, gear and the worn title; skills have tiers, a proficiency bar and promotion trials
  function skillHtml() {
    const S = Skills, b = S.bonus(state), weak = (state.wounds && state.wounds.until || 0) >= state.day;
    const bar = (label, v, max, note) => `<span>${label}</span><div class="lg-bar"><i style="width:${Math.max(3, Math.min(100, v / max * 100))}%"></i></div><b>${v}</b><span></span><small class="lg-muted" style="grid-column:2/4;margin-top:-4px">${note}</small>`;
    const stat = (k, note) => bar(S.STAT_NAME[k], state[k], 100, 'ตัวเอง ' + state.base[k] + (b[k] ? ' + สกิล/อุปกรณ์/ฉายา ' + b[k] : '') + (weak ? ' · ลดครึ่งเพราะบาดเจ็บ' : '') + ' · ' + note);
    const jobs = [['smithWork', 'ตีเหล็ก'], ['guildWork', 'เข้าหอคอยกับโล่เหล็ก'], ['compassWork', 'กิลด์เข็มทิศเงิน'], ['porterWork', 'แบกของเข้าหอคอย'], ['tmerchWork', 'กิลด์พ่อค้าหอคอย'], ['gchefWork', 'พ่อครัวกิลด์'], ['marketWork', 'รับจ้างที่ตลาด'], ['hotelWork', 'งานโรงแรม'], ['tavernWork', 'ผู้ช่วยครัว'], ['scrapWork', 'เก็บของเก่า'], ['cargoWork', 'กรรมกรลานเกวียน'], ['towerWins', 'ชนะมอนสเตอร์']]
      .filter(([k]) => state[k] > 0);
    const TYPE = { passive: 'พาสซีฟ', active: 'แอ็กทีฟ', life: 'สกิลชีวิต' };
    const skills = Object.entries(state.skills || {}).map(([id, sk]) => {
      const D = S.SKILLS[id], T = S.TIERS[sk.tier - 1], cap = T.cap, trial = state.trials[id], spec = S.trialOf(state, id);
      const eff = D.stat ? Object.entries(D.stat).map(([k, v]) => S.STAT_NAME[k] + ' +' + v[sk.tier - 1]).join(' ') : D.power ? 'พลังต่อสู้ +' + D.power[sk.tier - 1] : D.desc;
      let tr = '';
      if (trial && spec) tr = trial.accepted ? `<small style="display:block;color:var(--lg-gold)">ภารกิจเลื่อนขั้น: ${esc(spec.text)} · ${trial.done}/${spec.need}</small>`
        : `<button class="lg-btn" data-trial="${id}">รับภารกิจเลื่อนขั้นจาก${esc(D.teacher)}<small>${esc(spec.text)}</small></button>`;
      return `<div class="lg-zone"><b>${D.icon} ${esc(D.name)}</b> <span class="lg-tag">${T.name}</span> <span class="lg-muted">${TYPE[D.type]} · ${esc(eff)}</span>
        ${D.type === 'active' ? `<button class="lg-btn ${S.activeOf(state) === id ? 'lg-cur' : ''}" data-active="${id}">${S.activeOf(state) === id ? '✓ กำลังใช้สกิลนี้' : 'เลือกเป็นสกิลแอ็กทีฟ'}</button>` : ''}
        ${cap ? `<div class="lg-bar" style="margin:6px 0 2px"><i style="width:${Math.max(3, sk.xp / cap * 100)}%"></i></div><small class="lg-muted">ความชำนาญ ${sk.xp}/${cap}${sk.xp >= cap ? ' · เต็มขั้นแล้ว' : ''}</small>` : '<small class="lg-muted">ขั้นสูงสุด</small>'}${tr}</div>`;
    }).join('') || '<p class="lg-muted">ยังไม่มีสกิล ทำงานหรือฝึกแล้วจะได้สกิลแรก</p>';
    const gear = Object.entries(S.SLOTS).map(([slot, name]) => {
      const on = state.equip[slot], opts = B().list(state).filter(x => x.instanceId && Skills.GEAR[Skills.gear(state,x.instanceId).templateId].slot === slot).map(x => x.instanceId);
      return `<div class="lg-zone"><b>${name}</b> ${on ? iconHtml(Skills.gear(state,on).templateId, 26) + ' ' + gearText(on) + ` <button class="lg-btn" style="display:inline-block;width:auto;padding:4px 10px;margin:0 0 0 6px" data-unequip="${slot}">ถอด</button>` : '<span class="lg-muted">ว่าง</span>'}
        ${opts.map(id => `<button class="lg-btn" data-equip="${id}">${iconHtml(Skills.gear(state,id).templateId, 26)} ใส่${gearText(id)}</button>`).join('')}</div>`;
    }).join('');
    const titles = Object.entries(S.TITLES).map(([id, T]) => { const own = state.titles.includes(id), on = state.title === id;
      const bon = Object.entries(T.bonus).map(([k, v]) => S.STAT_NAME[k] + ' +' + v).join(' ');
      return own ? `<button class="lg-btn ${on ? 'lg-cur' : ''}" data-title="${id}">${on ? '✓ ' : ''}${esc(T.name)}<small>${bon}</small></button>`
        : `<button class="lg-btn" disabled>🔒 ${esc(T.name)}<small>${esc(T.how)} · ${bon}</small></button>`; }).join('');
    return `<h2>สกิล</h2>
      <p>พลังต่อสู้ <b style="color:var(--lg-gold);font-size:20px">${S.power(state)}</b> <span class="lg-muted">(กำลัง + คล่องตัว + ปัญญาบางส่วน + อาวุธ เกราะ และวิชาดาบ)</span></p>
      <h3>ค่าสถานะ</h3><p class="lg-muted">เพิ่มได้จากสกิลพาสซีฟ อุปกรณ์ และฉายาเท่านั้น</p><div class="lg-skill">
        ${stat('strength', 'สู้ แบกของ')}${stat('agility', 'หลบ หนีเอาตัวรอด')}${stat('intelligence', 'มินิเกม แผนที่ ตีราคา')}
        ${bar('ชื่อเสียง', state.rep || 0, 50, 'คนในเมืองเกรงใจมากขึ้น')}
        ${bar('สุขภาพ', state.health, 100, 'ต่ำกว่า 60 จะแวะร้านยาหลังเลิกงาน')}
        ${bar('แรง', state.energy, 100, 'หมดแรงแล้วทำงานได้น้อยลง')}</div>
      <h3>สกิล</h3><p class="lg-muted">สกิลแอ็กทีฟใช้ได้ทีละหนึ่ง เลือกสกิลที่จะใช้กับสล็อตต่อสู้</p>${skills}
      ${Object.entries(S.BOOK_SKILL).flatMap(([book,id])=>B().list(state).filter(s=>s.id===book).map(s=>`<button class="lg-btn" data-read="${book}" data-rarity="${esc(s.rarity||'normal')}">📖 อ่าน ${esc(B().name(book))} <small>${esc(s.rarity||'normal')} · ฝึก ${esc(S.SKILLS[id].name)} ×${S.rarityMultiplier(s.rarity||'normal')}</small></button>`)).join('')}
      ${X() && X().safeInfo(state) ? '<button class="lg-btn" data-safe="1">🏕 เปิดบริการ · ' + esc(X().safeInfo(state).name) + '</button>' : ''}
      <h3>อุปกรณ์</h3>${gear}<p class="lg-muted">อาวุธและเกราะซื้อได้ที่โรงตีเหล็ก หรือสั่งตีเอง (ธุระหลังเลิกงาน)</p>
      <h3>ฉายา (ใช้ได้ทีละหนึ่ง)</h3>${titles}
      <h3>ประสบการณ์งาน</h3>${jobs.length ? '<div class="lg-stats">' + jobs.map(([k, n]) => `<span>${n} · ${state[k]} ${k === 'towerWins' ? 'ครั้ง' : 'วัน'}</span>`).join('') + '</div>' : '<p class="lg-muted">ยังไม่เคยทำงานครบวัน</p>'}`;
  }
  function mapHtml() {
    const s = window.LIFE_INFO || {}, L = state.life, P = LifeSim.PLACES, Z = TownPano.ZONES;
    const names = { town: 'ในเมือง', slum: 'ตรอกล่าง', carts: 'ลานเกวียนนอกประตูเมือง', market: 'ตลาดใหญ่', guild: 'ย่านกิลด์ (ขึ้นบันไดซุ้มหอคอย)' };
    const work = LifeSim.PATHS[L.path] && LifeSim.PATHS[L.path].place, home = L.homeTonight || L.roomPref;
    const skip = { guildhall: 1, bazaar: 1 };
    const E = X(), x = E && E.active(state) ? E.X(state) : null;
    const towerMap = x ? (() => {
      const f = E.floorWorld(state, x.floor), safe = E.safeInfo(state);
      if (safe) return `<h3>แผนที่หอคอย ชั้น ${x.floor} · ${esc(safe.name)}</h3><p class="lg-muted">${esc(safe.desc)} · ทั้งชั้นไม่มีอสูร ศิลาทั้งสองชนิดพร้อมใช้</p><button class="lg-btn lg-primary" data-safe="1">🏕 เปิดบริการ · ${esc(safe.name)}</button>`;
      return `<h3>แผนที่หอคอย ชั้น ${x.floor} · ${esc(E.terrainOf(x.floor).name)}</h3><p class="lg-muted">สี่อาณาเขตของอสูร (เหนือ→ตะวันออก→ใต้→ตะวันตก→เหนือ) จำนวนเปลี่ยนทุกวันแม้ผู้เล่นไม่อยู่</p><div class="lg-tower-directions">${f.species.map(y => `<div class="lg-zone"><b>${esc(y.direction)}</b><p>${esc(y.name)}</p><small>จำนวน ${y.count} · ระดับ ${esc(E.RANKS[Math.min(6,[60,120,210,340,480,650].filter(z=>y.champion>=z).length)])} · พลังหัวฝูง ${Math.round(y.champion)}</small></div>`).join('')}</div>`;
    })() : '';
    const seenFloors = new Set(Object.entries(state.tower && state.tower.floors || {})
      .filter(([floor, f]) => E && E.isSafeFloor(+floor) && f.visited).map(([floor]) => +floor));
    // Old save files did not store visited flags, but an expedition's highest floor is recorded.
    const lastExp = E && E.X(state);
    if (lastExp && lastExp.highest >= 5) for (let i = 5; i <= lastExp.highest; i += 5) seenFloors.add(i);
    const visitedSafes = E && seenFloors.size ? '<h3>ชั้นเซฟโซนที่เคยไป</h3>' + [...seenFloors].sort((a, b) => a - b)
      .map(floor => '<p>🏕 ชั้น ' + floor + ' · ' + esc(E.SAFE_KINDS[E.floorWorld(state, floor).safeKind].name) + '</p>').join('') : '';
    return '<h2>แผนที่</h2><p class="lg-muted">📍 ตัวละคร · ⚒ ที่ทำงาน · 🛏 ที่นอนคืนนี้</p>' + towerMap + visitedSafes + Object.keys(names).map(z => {
      const [a, b] = Z[z], W = 380, X = x => 14 + (x - a) / (b - a) * (W - 28);
      const pl = Object.entries(P).filter(([id, p]) => !skip[id] && (LifeSim.zoneOf(id) || TownPano.zoneAt(p.x)) === z && p.x >= a - 50 && p.x <= b + 50).sort((u, v) => u[1].x - v[1].x);
      const here = s.zone === z, LV = [[44, 30], [44, 14], [64, 80], [64, 96]];   // [line end, label y] above ×2, below ×2
      const marks = pl.map(([id, p], i) => { const x = X(p.x), [ly, ty] = LV[i % 4], tag = (id === work ? '⚒' : '') + (id === home ? '🛏' : '');
        const anchor = x < 50 ? 'start' : x > W - 50 ? 'end' : 'middle';
        return `<line x1="${x}" x2="${x}" y1="54" y2="${ly < 54 ? ty + 4 : ty - 12}" stroke="#ffffff30"/><circle cx="${x}" cy="54" r="4.5" fill="${tag ? '#f2c14e' : '#cdb999'}"/>
          <text x="${x}" y="${ty}" text-anchor="${anchor}" font-size="11.5" fill="${tag ? '#f2c14e' : '#f6ecd8'}">${tag}${esc(p.name)}</text>`; }).join('');
      const me = here && s.x !== undefined ? `<text x="${Math.max(10, Math.min(W - 10, X(s.x)))}" y="60" text-anchor="middle" font-size="20">📍</text>` : '';
      return `<div class="lg-zone ${here ? 'here' : ''}"><b>${names[z]}</b>${here ? ' <span class="lg-tag">อยู่ที่นี่</span>' : ''}
        <svg viewBox="0 0 ${W} 104"><rect x="6" y="51" width="${W - 12}" height="6" rx="3" fill="#ffffff20"/>${marks}${me}</svg></div>`;
    }).join('') + `<p class="lg-muted">ตอนนี้: ${esc(s.place || '')} · ${esc(s.act || '')}</p>`;
  }
  function panel(which) {
    if (open) return;
    if (typeof which === 'string' && UI_ICON[which]) tab = which;
    const L = state.life;
    const body = tab === 'bag' ? bagHtml() : tab === 'skill' ? skillHtml() : tab === 'map' ? mapHtml() : charHtml();
    const d = el(`<div class="lg-card"><div class="lg-tabs">${TABS.map(([id, n]) => `<button data-tab="${id}" class="${id === tab ? 'on' : ''}">${uiIcon(id, 34)}${n}</button>`).join('')}</div>
      ${body}
      <button class="lg-btn lg-primary" data-a="close">ปิด</button></div>`);
    block(d);
    const again = () => { d.remove(); block(null); save(); panel(); };
    const on = (sel, fn) => { const x = d.querySelector(sel); if (x) x.onclick = fn; };
    d.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; d.remove(); block(null); panel(); });
    d.querySelectorAll('[data-room]').forEach(b => b.onclick = () => {
      LifeSim.setRoomPref(state, b.dataset.room); log('ตั้งใจพัก' + LifeSim.ROOMS[b.dataset.room].name + 'ตั้งแต่คืนนี้'); again(); });
    d.querySelectorAll('[data-order]').forEach(b => b.onclick = () => { d.remove(); block(null); orderCard(b.dataset.order); });
    d.querySelectorAll('[data-ride]').forEach(x => x.onclick = () => { L.ride = x.dataset.ride || null; log(L.ride ? 'เดินทางด้วย' + LifeSim.Bag.name(L.ride) : 'เดินเท้า'); again(); });
    on('[data-a=coach]', () => { L.coach = !L.coach; again(); });
    on('[data-a=xprep]', () => { d.remove(); block(null); prepCard(); });
    on('[data-safe]', () => { d.remove(); block(null); safeCard(); });
    d.querySelectorAll('[data-read]').forEach(b => b.onclick = () => { const r = Skills.readBook(state, b.dataset.read, b.dataset.rarity || null); log(r.why); again(); });
    d.querySelectorAll('[data-active]').forEach(b => b.onclick = () => { if (Skills.selectActive(state, b.dataset.active)) log('เลือกสกิลแอ็กทีฟ ' + Skills.SKILLS[b.dataset.active].name); again(); });
    on('[data-a=xcancel]', () => { X().cancel(state); log('ยกเลิกการออกสำรวจ'); again(); });

    d.querySelectorAll('[data-trial]').forEach(x => x.onclick = () => { Skills.accept(state, x.dataset.trial); log('รับภารกิจเลื่อนขั้น ' + Skills.SKILLS[x.dataset.trial].name); again(); });
    d.querySelectorAll('[data-title]').forEach(x => x.onclick = () => { Skills.wearTitle(state, x.dataset.title); log('ใช้ฉายา "' + Skills.TITLES[x.dataset.title].name + '"'); again(); });
    d.querySelectorAll('[data-equip]').forEach(x => x.onclick = () => { const id = x.dataset.equip;
      if (B().equipGear(state,id)) log('ใส่ ' + Skills.gearLabel(state,id)); again(); });
    d.querySelectorAll('[data-unequip]').forEach(x => x.onclick = () => { const slot = x.dataset.unequip, id = state.equip[slot];
      if (!id) return; if (!B().unequipGear(state,slot)) { alert('กระเป๋าเต็ม'); return; } log('ถอด ' + Skills.gearLabel(state,id)); again(); });
    on('[data-enhance-city]', () => { d.remove(); block(null); enhanceCard(); });
    d.querySelectorAll('[data-gear-sell]').forEach(b => b.onclick = () => { const r = B().sellGear(state,b.dataset.gearSell); log(r.why); again(); });
    d.querySelectorAll('[data-quest]').forEach(b => b.onclick = () => { L.quest = b.dataset.quest; log('ภารกิจที่จะรับ: ' + LifeSim.QUESTS[L.quest].name); again(); });
    d.querySelectorAll('[data-chef]').forEach(b => b.onclick = () => { L.chefNext = b.dataset.chef; log('พรุ่งนี้ไปทำครัวที่กิลด์ใหม่'); again(); });
    d.querySelectorAll('[data-stash]').forEach(b => b.onclick = () => { const day = LifeSim.requestStash(state, b.dataset.stash, clock);
      log((b.dataset.stash === 'in' ? 'ฝากของ' : 'รับของ') + 'ที่ห้องเก็บของกิลด์' + (day === state.day ? 'หลังเลิกงานวันนี้' : 'พรุ่งนี้')); again(); });
    on('[data-a=eatbag]', () => { L.eatBag = !L.eatBag; again(); });
    on('[data-a=nocmd]', () => { LifeSim.setOrder(state, null); log('ยกเลิกธุระหลังเลิกงาน'); again(); });
    on('[data-a=close]', () => closeOverlay(d));
    on('[data-a=path]', () => { d.remove(); choosePath(false); });
    on('[data-a=new]', () => { if (confirm('เริ่มชีวิตใหม่และลบความคืบหน้าในเครื่องนี้?')) { d.remove(); newLife(); } });
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
    if (L.dead) { deathCard(); return; }
    if (L.exp && L.exp.pending) { encounterCard(L.exp.pending); return; }
    if (L.exp && L.exp.safePending && X().safeInfo(state)) { safeCard(); return; }
    if (L.pendingEvent && LifeSim.EVENTS[L.pendingEvent]) { event(L.pendingEvent); return; }
    for (const k of LifeSim.due(state, clock)) {
      if (k === 'work' && L.path === 'smith') { smith(); return; }
      if (k === 'work' && (L.path === 'kitchen' || L.path === 'gchef') && window.CarrotGame) { kitchen(); return; }
      if (k === 'gtalk') { L.done[k] = state.day; const ev = L.talk && L.talk.ev; L.talk = null; save(); if (ev && LifeSim.EVENTS[ev]) { event(ev); return; } continue; }
      L.done[k] = state.day;
      if (k === 'wake') LifeSim.applyWake(state);
      else if (k === 'work') LifeSim.applyWork(state, CityCore);
      else if (k === 'dinner') { LifeSim.applyDinner(state, CityCore); const ev = LifeSim.pickEvent(state); update(); if (ev) { event(ev); return; } }
      else if (k === 'home') LifeSim.applyHome(state);
      else if (k === 'rest') LifeSim.applyRest(state);
      else if (k === 'errand' || k === 'errand2') LifeSim.applyErrand(state, k);
      else if (k === 'cook') LifeSim.applyOrder(state, 'cook');
      else if (k.startsWith('coach')) LifeSim.applyCoach(state);
      else if (k === 'xstart') log(X().enter(state));
      else if (k === 'xback') log(X().close(state));
      else if (/^x[123]$/.test(k) || k === 'xcamp') {
        if (k === 'xcamp') log(X().camp(state));
        const e = X().encounter(state, k); if (e) { L.exp.pending = e; save(); encounterCard(e); return; }
      }
      update();
    }
  }
  function drive() {
    const started = !!(state.life && state.life.started);
    if (hudEl) hudEl.style.display = started ? '' : 'none';
    const mn = document.getElementById('lgmenu'); if (mn) mn.style.display = started ? '' : 'none';
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
    try { loadSheets(); } catch (e) {}                                  // item icons ready before the first loot card
    window.LIFE_AUTO = true;
    hudEl = document.createElement('div'); hudEl.id = 'hud';
    hudEl.innerHTML = '<canvas></canvas><div><div class="l1"></div><div class="bars"></div><div class="l3"></div></div>';
    document.body.appendChild(hudEl);
    toastEl = document.createElement('div'); toastEl.id = 'lgtoast'; document.body.appendChild(toastEl);
    const m = document.createElement('div'); m.id = 'lgmenu';
    m.innerHTML = TABS.map(([id, n]) => `<button data-m="${id}">${uiIcon(id, 38)}${n}</button>`).join('');
    m.querySelectorAll('button').forEach(b => b.onclick = () => panel(b.dataset.m)); document.body.appendChild(m);
    lastToast = state.events[0] || '';
    if (!LifeSim.ensure(state) || !state.life.started) {
      const resume = LifeSim.ensure(state) && !state.life.started;
      const start = () => resume ? (state._log = m => log(m), intro(LifeSim.originOf(state))) : newLife();
      // wait until the scene art is ready so the intro sits over the town
      const wait = () => (document.getElementById('loading').hidden ? start() : setTimeout(wait, 150));
      wait();
    }
  }
  window.LifeUI = { init, drive, panel, safeCard, newLife, event, _state: () => ({ open: !!open }) };
})();
