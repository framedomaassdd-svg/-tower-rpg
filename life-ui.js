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
  .lg-event .lg-card{display:grid;grid-template-columns:96px 1fr;gap:14px;max-width:760px}
  .lg-event canvas{width:96px;height:96px;border-radius:14px;background:#3a3040}
  .lg-event .who{font-weight:700;color:var(--lg-gold)} .lg-event .lg-actions{grid-column:1/-1}
  @media(max-width:520px){.lg-event .lg-card{grid-template-columns:64px 1fr}.lg-event canvas{width:64px;height:64px}#hud{font-size:12px}#hud canvas{width:40px;height:40px}}
  .lg-smith{flex-direction:column;align-items:stretch;justify-content:flex-start;background:#120d0b;padding:max(10px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom))}
  .lg-smith-top{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:15px;padding:4px 4px 8px}
  .lg-smith-top .lg-step{color:var(--lg-gold);font-size:18px} .lg-hint{color:var(--lg-muted)} .lg-stars{color:#ffd76a;letter-spacing:1px}
  .lg-smith-canvas{flex:1;width:100%;min-height:0;border-radius:14px;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
  .lg-smith-bar{padding-top:8px;display:flex;justify-content:center} .lg-smith-bar .lg-btn{width:auto;text-align:center;font-weight:400;font-size:14px}
  .lg-result{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,calc(100vw - 32px));text-align:center}
  .lg-bigstars{font-size:44px;color:#ffd76a;letter-spacing:4px} .lg-sword{display:block;width:88%;margin:4px auto 2px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))}
  `;
  const styleEl = document.createElement('style'); styleEl.textContent = css; document.head.appendChild(styleEl);

  let open = null, hudEl, toastEl, lastToast = '', toastTimer = 0, hudAt = 0, inited = false;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const block = v => { open = v; window.LIFE_BLOCK = !!v; };

  function portrait(cv, img, frameW, frameH, box) {
    const g = cv.getContext('2d'), d = Math.min(window.devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
    cv.width = Math.round((r.width || 46) * d); cv.height = Math.round((r.height || 46) * d);
    g.clearRect(0, 0, cv.width, cv.height);
    if (!img || !img.complete || !img.naturalWidth) return;
    const [fx, fy, fw, fh] = box; // fractions of one frame
    g.imageSmoothingEnabled = true;
    g.drawImage(img, frameW * fx, frameH * fy, frameW * fw, frameH * fh, 0, 0, cv.width, cv.height);
  }
  const PLAYER_BOX = [0.22, 0.02, 0.56, 0.33], NPC_BOX = [0.25, 0.03, 0.5, 0.38];
  function npcImage(id) { try { return residentImages[id]; } catch (e) { return null; } }

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

  // ---------- life panel ----------
  function panel() {
    if (open) return;
    const L = state.life, o = LifeSim.originOf(state);
    const d = el(`<div class="lg-card"><h2>ชีวิตของคุณ</h2>
      <p>ตัวตนในโลกเดิม: <b>${esc(o.name)}</b> อายุ ${L.age} ปี · ใช้ชีวิตในต่างโลกมา ${state.day} วัน</p>
      <p class="lg-muted">${esc(o.perk)}</p>
      <h3>แนวทาง</h3><p>${esc(LifeSim.PATHS[L.path].name)}${L.pendingPath ? ' → พรุ่งนี้: ' + esc(LifeSim.PATHS[L.pendingPath].name) : ''}${state.guild ? ' · สมาชิกกิลด์' : ''}</p>
      <h3>ค่าสถานะ</h3><div class="lg-stats"><span>กำลัง ${state.strength}</span><span>คล่องตัว ${state.agility}</span><span>ปัญญา ${state.intelligence}</span>
        <span>ชื่อเสียง ${state.rep}</span><span>สุขภาพ ${state.health}</span><span>อาหารสำรอง ${state.food}</span></div>
      <h3>หอคอยและเมือง</h3><div class="lg-stats"><span>ชั้นที่สำรวจ ${state.floor}</span><span>อันตราย ${state.danger}/5</span><span>เสบียง ${state.supplies}</span><span>ภาษีค้าง ${state.taxDue}</span></div>
      <h3>บันทึก</h3><div class="lg-log">${esc(state.events.slice(0, 8).join('\n') || 'ยังไม่มีบันทึก')}</div>
      <button class="lg-btn" data-a="path">เปลี่ยนแนวทางชีวิต<small>มีผลตั้งแต่เช้าวันพรุ่งนี้</small></button>
      <button class="lg-btn" data-a="new">เริ่มชีวิตใหม่<small>สุ่มตัวตนใหม่ ความคืบหน้าเดิมจะหายไป</small></button>
      <button class="lg-btn lg-primary" data-a="close">ปิด</button></div>`);
    block(d);
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
    portrait(d.querySelector('canvas'), npcImage(ev.portrait), 543, 724, NPC_BOX);
    const line = d.querySelector('.line'), actions = d.querySelector('.lg-actions');
    let i = 0;
    function showLine() {
      line.textContent = ev.lines[i];
      actions.innerHTML = '<button class="lg-btn lg-primary">ต่อไป</button>';
      actions.querySelector('button').onclick = () => { i++; if (i < ev.lines.length) showLine(); else showChoices(); };
    }
    function showChoices() {
      line.textContent = 'คุณจะทำอย่างไร';
      actions.innerHTML = LifeSim.choicesFor(state, id).map(c =>
        `<button class="lg-btn" data-i="${c.index}" ${c.enabled ? '' : 'disabled'}>${esc(c.label)}<small>${esc(c.enabled ? c.odds : 'ทำไม่ได้: วันนี้ยังไม่ได้ตีอาวุธ')}</small></button>`).join('');
      actions.querySelectorAll('button').forEach(b => b.onclick = () => {
        const res = LifeSim.resolveChoice(state, id, +b.dataset.i);
        L.pendingEvent = null; save();
        line.textContent = res ? res.replace(ev.title + ': ', '') : '';
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

  // ---------- per-frame driver ----------
  function process() {
    const L = state.life;
    if (L.pendingEvent && LifeSim.EVENTS[L.pendingEvent]) { event(L.pendingEvent); return; }
    for (const k of LifeSim.due(state, clock)) {
      if (k === 'work' && L.path === 'smith') { smith(); return; }
      L.done[k] = state.day;
      if (k === 'wake') LifeSim.applyWake(state);
      else if (k === 'work') LifeSim.applyWork(state, CityCore);
      else if (k === 'dinner') { LifeSim.applyDinner(state, CityCore); const ev = LifeSim.pickEvent(state); update(); if (ev) { event(ev); return; } }
      else if (k === 'home') LifeSim.applyHome(state);
      else if (k === 'rest') LifeSim.applyRest(state);
      update();
    }
  }
  function drive() {
    const started = !!(state.life && state.life.started);
    if (hudEl) hudEl.style.display = started ? '' : 'none';
    if (!started) { window.LIFE_HIDDEN = true; return; }
    if (state.scene !== 'town') state.scene = 'town';
    if (typeof state._log !== 'function') state._log = m => log(m);
    if (!open) process();
    const s = LifeSim.sample(state, clock);
    player = s.x; playerY = s.y; moving = s.moving; anim = s.anim; if (s.face) face = s.face;
    window.LIFE_HIDDEN = s.hidden;
    const t = performance.now();
    if (t - hudAt > 250) { hudAt = t; hud(s); }
  }
  function hud(s) {
    if (!hudEl) return;
    const L = state.life;
    hudEl.querySelector('.l1').textContent = 'วันที่ ' + state.day + ' · ' + CityLighting.timeText(clock) + ' ' + CityLighting.phaseText(clock);
    hudEl.querySelector('.bars').textContent = 'เงิน ' + state.money + ' · แรง ' + state.energy + ' · สุขภาพ ' + state.health + ' · อันตราย ' + state.danger + '/5';
    hudEl.querySelector('.l3').textContent = s.place + ' · ' + s.act;
    const msg = state.events[0] || '';
    if (msg && msg !== lastToast) {
      lastToast = msg; toastEl.textContent = msg.replace(/^วันที่ \d+ · /, ''); toastEl.classList.add('show');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3800);
    }
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
  window.LifeUI = { init, drive, panel, newLife, _state: () => ({ open: !!open }) };
})();
