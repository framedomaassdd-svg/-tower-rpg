/* Blacksmith minigame: heat → hammer → quench. Tap / click / Space. Returns 0–9 stars. */
(function (root) {
  'use strict';
  const STEPS = [
    { id: 'heat',   title: 'เผาเหล็ก',   hint: 'แตะเมื่อเข็มอยู่ในช่องสีส้มสุก' },
    { id: 'hammer', title: 'ตีขึ้นรูป',  hint: 'แตะเมื่อวงแหวนหดลงพอดีวงทอง (4 ครั้ง)' },
    { id: 'quench', title: 'ชุบน้ำ',     hint: 'แตะค้างเพื่อจุ่มดาบ ปล่อยเมื่อไอน้ำอยู่ในช่องสีเขียว' }
  ];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);

  function open(opts) {
    const tol = clamp(opts.tolerance || 1, 0.6, 2.2);
    const bg = opts.image;
    const root = document.createElement('div');
    root.className = 'lg-overlay lg-smith';
    root.innerHTML = '<div class="lg-smith-top"><div><b class="lg-step"></b> <span class="lg-hint"></span></div><div class="lg-stars"></div></div>' +
      '<canvas class="lg-smith-canvas"></canvas>' +
      '<div class="lg-smith-bar"><button class="lg-btn lg-skip">ให้ทำเอง (ได้ 1 ดาวต่อขั้น)</button></div>';
    document.body.appendChild(root);
    const cv = root.querySelector('canvas'), g = cv.getContext('2d');
    const elStep = root.querySelector('.lg-step'), elHint = root.querySelector('.lg-hint'), elStars = root.querySelector('.lg-stars');
    let step = 0, t0 = performance.now() / 1000, scores = [], flash = null, finished = false, raf = 0;
    let lastFrame = 0, holding = false, steam = 0, bladeDip = 0, beats = [], beatIndex = 0, beatStart = 0, sparks = [];

    function size() {
      const r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d);
    }
    size(); window.addEventListener('resize', size);
    function header() {
      elStep.textContent = (step + 1) + '/3 ' + STEPS[step].title;
      elHint.textContent = STEPS[step].hint;
      elStars.textContent = scores.map(starText).join('  ');
    }
    function startStep(i) {
      step = i; t0 = now(); holding = false; steam = 0; bladeDip = 0; beats = []; beatIndex = 0; beatStart = t0 + 0.5; header();
    }
    const now = () => performance.now() / 1000;
    function score(stars, label) {
      scores.push(stars); flash = { stars, label, until: now() + 0.95 }; header();
      setTimeout(() => { if (finished) return; if (step < 2) startStep(step + 1); else result(); }, 950);
    }
    function graded(d, hw) { return d <= hw * 0.4 ? 3 : d <= hw ? 2 : d <= hw * 2 ? 1 : 0; }
    const LABELS = ['พลาด', 'พอใช้', 'ดี', 'เยี่ยม!'];

    // ---- input
    function down(e) {
      if (e) e.preventDefault();
      if (flash || finished) return;
      const t = now(), id = STEPS[step].id;
      if (id === 'heat') { const p = needle(t); const s = graded(Math.abs(p - 0.72), 0.085 * tol); score(s, LABELS[s]); flash.p = p; }
      else if (id === 'hammer') hit(t);
      else if (id === 'quench') holding = true;
    }
    function up(e) {
      if (e) e.preventDefault();
      if (STEPS[step].id !== 'quench' || !holding || flash || finished) return;
      holding = false;
      if (steam < 0.05) return;
      const s = graded(Math.abs(steam - 0.75), 0.075 * tol); score(s, LABELS[s]);
    }
    cv.addEventListener('pointerdown', down); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    function key(e) { if (e.code === 'Space') { if (e.type === 'keydown' && !e.repeat) down(e); if (e.type === 'keyup') up(e); } }
    window.addEventListener('keydown', key); window.addEventListener('keyup', key);
    root.querySelector('.lg-skip').onclick = () => { if (!finished) close(3, true); };

    // ---- step mechanics
    function needle(t) { const p = ((t - t0) / 1.5) % 2; return p < 1 ? p : 2 - p; }
    const BEAT_LEN = 1.0, BEAT_TARGET = 0.7;
    function ringAt(t) { return 1 - (t - beatStart) / BEAT_LEN; } // 1 → 0 ; target radius 0.3
    function hit(t) {
      if (t < beatStart) return;
      const err = Math.abs(t - (beatStart + BEAT_TARGET));
      const s = err <= 0.07 * tol ? 3 : err <= 0.15 * tol ? 2 : err <= 0.25 * tol ? 1 : 0;
      nextBeat(s);
    }
    function nextBeat(s) {
      beats.push(s); beatIndex++;
      if (s >= 2) for (let i = 0; i < 14; i++) sparks.push({ x: 0, y: 0, vx: (Math.random() - .5) * 2, vy: -Math.random() * 1.6, life: 1 });
      if (beatIndex >= 4) { const avg = Math.round(beats.reduce((a, b) => a + b, 0) / 4); score(avg, LABELS[avg]); }
      else beatStart = now() + 0.3;
    }

    // ---- drawing
    function drawBackdrop(W, H) {
      g.fillStyle = '#1b1411'; g.fillRect(0, 0, W, H);
      if (bg && bg.complete && bg.naturalWidth) {
        const sw = bg.naturalWidth * 0.36, sh = bg.naturalHeight * 0.42, sx = bg.naturalWidth * 0.25, sy = bg.naturalHeight * 0.44;
        const sc = Math.max(W / sw, H / sh), dw = sw * sc, dh = sh * sc;
        g.drawImage(bg, sx, sy, sw, sh, (W - dw) / 2, (H - dh) / 2, dw, dh);
      }
      g.fillStyle = 'rgba(15,10,8,.55)'; g.fillRect(0, 0, W, H);
    }
    function anvil(cx, cy, u) {
      g.fillStyle = '#2b2d33';
      g.beginPath(); g.moveTo(cx - 2.2 * u, cy); g.lineTo(cx + 1.6 * u, cy); g.quadraticCurveTo(cx + 2.6 * u, cy + .1 * u, cx + 2.9 * u, cy - .25 * u);
      g.lineTo(cx + 2.9 * u, cy + .15 * u); g.lineTo(cx + 1.6 * u, cy + .55 * u); g.lineTo(cx - 2.2 * u, cy + .55 * u); g.closePath(); g.fill();
      g.fillRect(cx - 1.1 * u, cy + .55 * u, 1.8 * u, .9 * u); g.fillRect(cx - 1.6 * u, cy + 1.45 * u, 2.8 * u, .35 * u);
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(cx - 2.2 * u, cy, 3.8 * u, .08 * u);
    }
    function heatColour(p) {
      const stops = [[0, [80, 80, 86]], [0.45, [150, 30, 20]], [0.72, [255, 120, 30]], [0.9, [255, 220, 120]], [1, [255, 255, 235]]];
      for (let i = 1; i < stops.length; i++) if (p <= stops[i][0]) {
        const [a, ca] = stops[i - 1], [b, cb] = stops[i], f = (p - a) / (b - a);
        return 'rgb(' + ca.map((v, k) => Math.round(v + (cb[k] - v) * f)).join(',') + ')';
      }
      return 'rgb(255,255,235)';
    }
    function bar(cx, cy, u, colour, len) {
      g.save(); g.shadowColor = colour; g.shadowBlur = u * .8; g.fillStyle = colour;
      g.fillRect(cx - (len || 1.6) * u, cy - .22 * u, 2 * (len || 1.6) * u, .22 * u); g.restore();
    }
    function draw() {
      if (finished) return;
      const W = cv.width, H = cv.height, u = Math.min(W > H ? W / 9 : W / 6.5, H / 5.5), t = now(), id = STEPS[step].id;
      const dt = lastFrame ? Math.min(0.05, t - lastFrame) : 0; lastFrame = t;
      drawBackdrop(W, H);
      const cx = W / 2, cy = H * 0.46;
      if (id === 'heat') {
        const p = flash && flash.p !== undefined ? flash.p : needle(t);
        anvil(cx, cy, u); bar(cx, cy, u, heatColour(p));
        const gx = W * 0.12, gw = W * 0.76, gy = H * 0.86, gh = Math.max(14, u * .28);
        const grad = g.createLinearGradient(gx, 0, gx + gw, 0);
        [[0, '#505056'], [.45, '#96201a'], [.72, '#ff7a1e'], [.9, '#ffdc78'], [1, '#fffff0']].forEach(([o, c]) => grad.addColorStop(o, c));
        g.fillStyle = grad; g.fillRect(gx, gy, gw, gh);
        const hw = 0.085 * tol; g.strokeStyle = '#fff'; g.lineWidth = Math.max(2, u * .05);
        g.strokeRect(gx + gw * (0.72 - hw), gy - 4, gw * hw * 2, gh + 8);
        g.fillStyle = '#fff'; g.fillRect(gx + gw * p - 3, gy - gh * .6, 6, gh * 2.2);
      } else if (id === 'hammer') {
        anvil(cx, cy, u); bar(cx, cy, u, '#ff8a2a');
        const R = u * 1.6, tx = cx, ty = cy - .1 * u;
        g.strokeStyle = '#f2c14e'; g.lineWidth = Math.max(3, u * .09); g.beginPath(); g.arc(tx, ty, R * 0.3, 0, Math.PI * 2); g.stroke();
        if (!flash && beatIndex < 4 && t >= beatStart) {
          const r = ringAt(t);
          if (r <= -0.15) nextBeat(0);
          else { g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = Math.max(2, u * .06); g.beginPath(); g.arc(tx, ty, Math.max(2, R * Math.max(r, 0)), 0, Math.PI * 2); g.stroke(); }
        }
        g.fillStyle = 'rgba(255,255,255,.85)'; g.font = Math.round(u * .32) + 'px system-ui'; g.textAlign = 'center';
        g.fillText('ครั้งที่ ' + Math.min(beatIndex + 1, 4) + '/4', cx, H * 0.9);
        for (const s of sparks) { s.x += s.vx * u * .08; s.y += s.vy * u * .08; s.vy += .06; s.life -= .03;
          if (s.life > 0) { g.fillStyle = 'rgba(255,200,90,' + s.life + ')'; g.fillRect(tx + s.x, ty + s.y, 3, 3); } }
        sparks = sparks.filter(s => s.life > 0);
      } else {
        if (holding && !flash) { steam = Math.min(1.05, steam + dt * 0.7); bladeDip = Math.min(1, bladeDip + dt * 5); }
        else if (!flash) bladeDip = Math.max(0, bladeDip - dt * 3);
        if (steam >= 1.02 && !flash) { holding = false; score(0, 'ดาบร้าว!'); }
        const bx = cx - u * .6, by = H * 0.5, bw = u * 2.4, bh = u * 1.6;
        g.fillStyle = '#4a3020'; g.fillRect(bx - bw / 2, by, bw, bh);
        g.fillStyle = '#3c78a8'; g.beginPath(); g.ellipse(bx, by, bw / 2, u * .22, 0, 0, Math.PI * 2); g.fill();
        const tipY = by - u * 1.2 + bladeDip * u * 1.1;
        g.fillStyle = heatColour(Math.max(0.2, 0.75 - steam * 0.5)); g.fillRect(bx - u * .09, tipY - u * 1.4, u * .18, u * 1.4);
        g.fillStyle = '#5a3a24'; g.fillRect(bx - u * .3, tipY - u * 1.55, u * .6, u * .14); g.fillRect(bx - u * .07, tipY - u * 2.05, u * .14, u * .5);
        if (holding) for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(235,235,235,' + (0.25 + Math.random() * .2) + ')';
          g.beginPath(); g.arc(bx + (Math.random() - .5) * bw * .7, by - Math.random() * u * 1.2, u * (.15 + Math.random() * .2), 0, Math.PI * 2); g.fill(); }
        const mx = cx + u * 2.2, my = H * 0.18, mh = H * 0.62, mw = Math.max(16, u * .32);
        g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(mx, my, mw, mh);
        const hw = 0.075 * tol; g.fillStyle = 'rgba(80,200,120,.55)'; g.fillRect(mx, my + mh * (1 - 0.75 - hw), mw, mh * hw * 2);
        g.fillStyle = '#e8eef5'; g.fillRect(mx, my + mh * (1 - Math.min(steam, 1)), mw, mh * Math.min(steam, 1));
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(mx, my, mw, mh);
      }
      if (flash) {
        if (t > flash.until) flash = null;
        else { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, H * .3, W, H * .26);
          g.fillStyle = '#ffd76a'; g.textAlign = 'center'; g.font = 'bold ' + Math.round(u * .7) + 'px system-ui'; g.fillText(starText(flash.stars), W / 2, H * .43);
          g.fillStyle = '#fff'; g.font = Math.round(u * .36) + 'px system-ui'; g.fillText(flash.label, W / 2, H * .52); }
      }
      raf = requestAnimationFrame(draw);
    }
    function result() {
      const total = scores.reduce((a, b) => a + b, 0), overall = Math.round(total / 3);
      const panel = document.createElement('div'); panel.className = 'lg-card lg-result';
      panel.innerHTML = '<h2>ดาบเสร็จแล้ว</h2><div class="lg-bigstars">' + starText(overall) + '</div>' +
        '<p>' + STEPS.map((s, i) => s.title + ' ' + starText(scores[i])).join('<br>') + '</p>' +
        '<p class="lg-muted">รวม ' + total + '/9 ดาว · ' + (overall >= 3 ? 'ช่างใหญ่พยักหน้าให้' : overall === 2 ? 'ใช้งานได้ดี' : overall === 1 ? 'พอขายได้' : 'ต้องหลอมใหม่') + '</p>' +
        '<button class="lg-btn lg-primary">รับค่าแรงและทำงานต่อ</button>';
      root.appendChild(panel);
      panel.querySelector('button').onclick = () => close(total, false);
      finished = true; cancelAnimationFrame(raf);
    }
    function close(total, skipped) {
      finished = true; cancelAnimationFrame(raf);
      window.removeEventListener('resize', size); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', key); window.removeEventListener('keyup', key);
      root.remove(); opts.onDone(total, skipped);
    }
    startStep(0); raf = requestAnimationFrame(draw);
    return { root, _debug: { get step() { return step; }, get scores() { return scores.slice(); }, now, needle: () => needle(now()), beatTarget: () => beatStart + BEAT_TARGET, steam: () => steam, down, up } };
  }
  root.SmithGame = { open, STEPS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
