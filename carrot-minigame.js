/* Kitchen minigame (v71): slice a carrot into 5 pieces with a timing bar.
   Adapted from the stand-alone carrot_timing_game_v2 (scene drawing kept, page code rewritten as an overlay).
   CarrotGame.open({ tolerance, onDone(stars 0–9, skipped) })
   Rules: green = 2 points, orange = 1, red = miss. 5 cuts → max 10 points. 3 misses end the round early. */
(function (root) {
  'use strict';
  const WIDTH = 800, HEIGHT = 500, CARROT = { x: 170, y: 204, width: 500 };
  const CUTS = [0, 180, 360, 540, 720, 990];
  const PIECES = 5, MAX_MISS = 3, V = '?v=71';
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const ease = v => 1 - Math.pow(1 - clamp01(v), 3);
  const mix = (a, b, t) => a + (b - a) * t;

  // ---------- art ----------
  let art = null;
  function loadArt() {
    if (art) return art;
    art = { images: {}, ready: null };
    art.ready = Promise.all(['board', 'knife', 'carrot', 'coin', 'flat'].map(k => new Promise((res, rej) => {
      const im = new Image(); im.onload = () => res([k, im]); im.onerror = () => rej(new Error(k)); im.src = 'carrot_' + k + '.webp' + V;
    }))).then(list => { for (const [k, im] of list) art.images[k] = im; art.prepared = prepare(art.images); return art; });
    art.ready.catch(() => {});
    return art;
  }
  // slice outlines measured from the carrot's alpha (same as the original scene.js)
  function prepare(images) {
    const c = document.createElement('canvas'); c.width = images.carrot.width; c.height = images.carrot.height;
    const x = c.getContext('2d'); x.drawImage(images.carrot, 0, 0);
    let data = null;
    try { data = x.getImageData(0, 0, c.width, c.height).data; } catch (e) { data = null; }
    const bounds = (l, r) => {
      if (!data) return { top: c.height * 0.2, height: c.height * 0.6 };
      let top = c.height, bottom = 0;
      for (let y = 0; y < c.height; y++) for (let i = l; i < r; i++) if (data[(y * c.width + i) * 4 + 3] > 128) { if (y < top) top = y; if (y > bottom) bottom = y; }
      return bottom < top ? { top: c.height * 0.2, height: c.height * 0.6 } : { top, height: bottom - top + 1 };
    };
    return Object.assign({}, images, {
      segments: CUTS.slice(1).map((end, i) => bounds(CUTS[i], end)),
      sections: CUTS.slice(1).map(end => bounds(end - 2, end + 1))
    });
  }

  // ---------- scene (from scene.js, unchanged behaviour) ----------
  function drawScene(ctx, a, state) {
    const count = Math.max(0, Math.min(5, state.cuts || 0)), time = state.time || 0, age = state.cutAge ?? 9999, reduced = !!state.reducedMotion;
    const scale = CARROT.width / a.carrot.width, cutX = i => CARROT.x + CUTS[Math.min(5, i + 1)] * scale;
    ctx.save(); ctx.shadowColor = 'rgba(62,28,10,.24)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 7;
    ctx.drawImage(a.board, 15, 60, 770, 770 * a.board.height / a.board.width); ctx.restore();
    const shadow = (blur = 3, offset = 3) => { ctx.shadowColor = 'rgba(62,25,8,.28)'; ctx.shadowBlur = blur; ctx.shadowOffsetY = offset; };
    for (let i = 0; i < count; i++) {
      const localAge = i === count - 1 ? age : 9999;
      const t = reduced ? 1 : ease(localAge / 500), roll = reduced ? 1 : clamp01((localAge - 80) / 250);
      const seg = a.segments[i], start = CUTS[i], end = CUTS[i + 1];
      const sw = (end - start) * scale, sh = seg.height * scale;
      const fromX = CARROT.x + (start + end) * scale / 2, fromY = CARROT.y + (seg.top + seg.height / 2) * scale;
      const x = mix(fromX, [150, 230, 307, 398, 506][i], t), y = mix(fromY, [396, 394, 395, 393, 389][i], t);
      const arc = reduced ? 0 : Math.sin(clamp01(localAge / 500) * Math.PI) * 12;
      const angle = [-.18, .16, -.15, .12, -.12][i] * t;
      ctx.save(); ctx.translate(x, y - arc); ctx.rotate(angle); shadow(3 + arc * .22, 3 + arc * .18);
      if (i === 0) ctx.drawImage(a.carrot, start, seg.top, end - start, seg.height, -sw / 2, -sh / 2, sw, sh);
      else { const w = mix(Math.min(sw, sh * .65), sh * a.flat.width / a.flat.height, roll); ctx.drawImage(a.flat, -w / 2, -sh / 2, w, sh); }
      ctx.restore();
    }
    const rem = CUTS[count];
    ctx.save(); shadow();
    ctx.drawImage(a.carrot, rem, 0, a.carrot.width - rem, a.carrot.height, CARROT.x + rem * scale, CARROT.y, (a.carrot.width - rem) * scale, a.carrot.height * scale);
    ctx.restore();
    if (count > 0 && count < 5) { const s = a.sections[count - 1], h = s.height * scale; ctx.drawImage(a.coin, CARROT.x + rem * scale - 2, CARROT.y + s.top * scale, h * .23, h); }
    const geo = i => { const s = a.sections[Math.min(i, 4)]; return { idle: CARROT.y + s.top * scale - 14, contact: CARROT.y + (s.top + s.height) * scale + 12 }; };
    let kx = cutX(count), kb = geo(count).idle, lift = 35;
    if (state.strike) {
      const t = clamp01(state.strike.progress), idx = state.strike.index, g = geo(idx); kx = cutX(idx);
      if (t < .30) kb = mix(g.idle, g.idle - 20, ease(t / .30));
      else if (t < .48) kb = mix(g.idle - 20, g.contact, Math.pow((t - .30) / .18, 2));
      else if (t < .57) kb = g.contact;
      else kb = mix(g.contact, g.idle, ease((t - .57) / .43));
      if (state.strike.kind === 'miss') {
        const missX = CARROT.x + CUTS[idx] * scale - 22, drift = t < .48 ? ease(t / .48) : t < .57 ? 1 : 1 - ease((t - .57) / .43);
        kx = mix(kx, missX, drift);
      }
      lift = Math.max(0, g.contact - kb);
    } else if (count > 0 && count < 5 && age < 650) {
      const m = ease((age - 280) / 300); kx = mix(cutX(count - 1), cutX(count), m); kb = mix(geo(count - 1).idle, geo(count).idle, m);
    } else if (state.active && !reduced) kb += Math.sin(time / 430) * 1.5;
    if (count === 5 && !state.strike) { const p = ease((age - 280) / 350); kx = mix(cutX(4), 725, p); kb = mix(geo(4).idle, 365, p); }
    const kh = 200, kw = kh * a.knife.width / a.knife.height;
    ctx.save(); shadow(lift > 20 ? 7 : 3, lift > 20 ? 6 : 3); ctx.drawImage(a.knife, kx - kw + 1, kb - kh, kw, kh); ctx.restore();
    if (count > 0 && age < 180 && !reduced) {
      const p = age / 180, x = cutX(count - 1), s = a.sections[count - 1], y = CARROT.y + (s.top + s.height * .5) * scale;
      ctx.save(); ctx.globalAlpha = (1 - p) * .65; ctx.strokeStyle = '#ffefbe'; ctx.lineWidth = 1.7;
      for (let i = 0; i < 4; i++) { const an = -2.5 + i * .65, r = 5 + 18 * p; ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * r, y + Math.sin(an) * r); ctx.lineTo(x + Math.cos(an) * (r + 4), y + Math.sin(an) * (r + 4)); ctx.stroke(); }
      ctx.restore();
    }
  }

  // ---------- overlay ----------
  function zones(tol) {
    const t = Math.max(0.7, Math.min(1.8, tol || 1));
    const g = Math.min(16, 8 * t), o = Math.min(34, 22 * t);
    return { g0: 50 - g, g1: 50 + g, o0: 50 - o, o1: 50 + o };
  }
  function toStars(points) { return Math.max(0, Math.min(9, Math.round(points * 0.9))); }
  const starText = n => '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));

  function open(opts) {
    opts = opts || {};
    const Z = zones(opts.tolerance), A = loadArt();
    const motion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    const root = document.createElement('div');
    root.className = 'lg-overlay lg-carrot';
    const grad = `linear-gradient(to right,#c65a54 0%,#c65a54 ${Z.o0}%,#e7a347 ${Z.o0}%,#e7a347 ${Z.g0}%,#4aaf64 ${Z.g0}%,#4aaf64 ${Z.g1}%,#e7a347 ${Z.g1}%,#e7a347 ${Z.o1}%,#c65a54 ${Z.o1}%,#c65a54 100%)`;
    root.innerHTML =
      '<div class="lc-top"><div><b class="lc-title">หั่นแครอท</b> <span class="lc-sub">ห้องครัว · ร้านอาหาร</span></div><div class="lc-pill">0 / 5 ชิ้น</div></div>' +
      '<div class="lc-stage"><canvas class="lc-canvas" aria-label="เขียงและแครอท"></canvas></div>' +
      '<div class="lc-feedback" role="status" aria-live="polite">กำลังเตรียมเขียง…</div>' +
      '<div class="lc-panel">' +
        `<div class="lc-track" style="background:${grad}"><div class="lc-pointer"></div></div>` +
        '<button class="lc-cut" disabled>🔪 หั่น!</button>' +
        '<div class="lc-stats"><span>ดีมาก <b class="lc-p">0</b></span><span>พอใช้ <b class="lc-o">0</b></span><span>พลาด <b class="lc-m">0</b>/' + MAX_MISS + '</span></div>' +
        '<button class="lg-btn lc-skip">ให้ทำเอง (ได้ 3 ดาว)</button>' +
      '</div>';
    document.body.appendChild(root);
    const $ = s => root.querySelector(s);
    const cv = $('.lc-canvas'), ctx = cv.getContext('2d'), btn = $('.lc-cut'), ptr = $('.lc-pointer'), fb = $('.lc-feedback');
    let ready = false, active = false, finished = false, cuts = 0, perfect = 0, okay = 0, missed = 0;
    let pos = 0, dir = 1, last = 0, raf = 0, strike = null, lastCut = -Infinity, nextStart = Infinity, closed = false;

    const say = (t, k) => { fb.textContent = t; fb.className = 'lc-feedback ' + (k || ''); };
    function stats() {
      $('.lc-pill').textContent = cuts + ' / ' + PIECES + ' ชิ้น';
      $('.lc-p').textContent = perfect; $('.lc-o').textContent = okay; $('.lc-m').textContent = missed;
    }
    function size() {
      const r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d));
    }
    function render(t) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
      if (!ready) return;
      const k = Math.min(cv.width / WIDTH, cv.height / HEIGHT);
      ctx.setTransform(k, 0, 0, k, (cv.width - WIDTH * k) / 2, (cv.height - HEIGHT * k) / 2);
      drawScene(ctx, A.prepared, { cuts, active, time: t, cutAge: t - lastCut, reducedMotion: motion.matches,
        strike: strike ? { index: strike.index, kind: strike.kind, progress: (t - strike.at) / 540 } : null });
    }
    function start() {
      if (finished || !ready) return;
      active = true; last = 0; nextStart = Infinity; btn.disabled = false; ptr.classList.remove('locked');
      if (!cuts && !missed) say('จับจังหวะสีเขียวแล้วกดหั่น!');
    }
    function cut(e) {
      if (e) e.preventDefault();
      if (!active || strike || finished) return;
      active = false; btn.disabled = true; ptr.classList.add('locked');
      const kind = pos >= Z.g0 && pos <= Z.g1 ? 'perfect' : pos >= Z.o0 && pos <= Z.o1 ? 'okay' : 'miss';
      strike = { at: performance.now(), index: cuts, kind, applied: false };
    }
    function impact(t) {
      strike.applied = true;
      if (strike.kind === 'miss') { missed++; say(missed >= MAX_MISS ? 'พลาดครบ ' + MAX_MISS + ' ครั้ง!' : 'พลาด! ลองใหม่', 'miss'); }
      else { cuts++; lastCut = t; if (strike.kind === 'perfect') { perfect++; say('ยอดเยี่ยม! หั่นได้พอดี', 'good'); } else { okay++; say('พอใช้! หั่นสำเร็จ', 'okay'); } }
      stats();
    }
    function frame(t) {
      raf = 0; if (closed) return;
      if (active) {
        const d = last ? Math.min(t - last, 45) : 0;
        pos += dir * d * (.057 + cuts * .006);
        if (pos >= 100) { pos = 200 - pos; dir = -1; } else if (pos <= 0) { pos = -pos; dir = 1; }
        ptr.style.left = pos + '%';
      }
      last = t;
      if (strike) {
        const age = t - strike.at;
        if (age >= 260 && !strike.applied) impact(t);
        if (age >= 540) {
          strike = null;
          if (cuts >= PIECES || missed >= MAX_MISS) { finished = true; setTimeout(result, cuts >= PIECES ? 700 : 450); }
          else nextStart = t + 200;
        }
      }
      if (t >= nextStart) start();
      render(t);
      raf = requestAnimationFrame(frame);
    }
    function result() {
      if (closed) return;
      const points = perfect * 2 + okay, stars = toStars(points), overall = Math.round(stars / 3);
      const panel = document.createElement('div'); panel.className = 'lg-card lg-result';
      panel.innerHTML = '<h2>' + (cuts >= PIECES ? 'หั่นเสร็จแล้ว' : 'มือพลาดเกินไป') + '</h2>' +
        '<div class="lg-bigstars">' + starText(overall) + '</div>' +
        '<p>หั่นได้ ' + cuts + '/' + PIECES + ' ชิ้น · ดีมาก ' + perfect + ' · พอใช้ ' + okay + ' · พลาด ' + missed + '</p>' +
        '<p class="lg-muted">' + points + '/10 คะแนน = ' + stars + '/9 ดาว · ' +
          (overall >= 3 ? 'พ่อครัวใหญ่ชมว่าชิ้นเท่ากันเป๊ะ' : overall === 2 ? 'ใช้ทำซุปได้สบาย' : overall === 1 ? 'พอใช้ได้ แต่ชิ้นไม่สวย' : 'พ่อครัวต้องหั่นใหม่เอง') + '</p>' +
        '<button class="lg-btn lg-primary">รับค่าแรงและทำงานต่อ</button>';
      root.appendChild(panel);
      panel.querySelector('button').onclick = () => close(stars, false);
    }
    function close(stars, skipped) {
      if (closed) return; closed = true; cancelAnimationFrame(raf);
      window.removeEventListener('resize', size); window.removeEventListener('keydown', key);
      root.remove(); if (opts.onDone) opts.onDone(stars, skipped);
    }
    function key(e) { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); cut(); } }

    btn.addEventListener('pointerdown', cut);
    cv.addEventListener('pointerdown', cut);
    $('.lc-skip').onclick = () => close(3, true);
    window.addEventListener('keydown', key); window.addEventListener('resize', size);
    size(); stats();
    A.ready.then(() => { if (closed) return; ready = true; size(); setTimeout(start, 350); })
      .catch(() => { say('โหลดภาพไม่สำเร็จ · กด "ให้ทำเอง" เพื่อทำงานต่อ', 'miss'); });
    raf = requestAnimationFrame(frame);
    return { root, _debug: { get pos() { return pos; }, get active() { return active; }, get cuts() { return cuts; }, get missed() { return missed; }, zones: Z, cut } };
  }
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('load', () => setTimeout(loadArt, 3000));
  root.CarrotGame = { open, toStars, zones, PIECES, MAX_MISS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
