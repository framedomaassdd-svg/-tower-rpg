/* Cutout character rig (v65): six painted parts + code-driven poses.
   CharacterRig.draw(ctx, anim, t, height) draws the player facing right with feet at (0,0).
   Animations: idle, walk, run, hammer, train, carry, eat, sleep, sick. */
(function (root) {
  'use strict';
  const D = Math.PI / 180, TAU = Math.PI * 2;
  // part art: file, uniform scale into rig units, pivot (joint) and end point in the part's own pixels
  const PARTS = {
    head:  { file: 'char_head',  s: 0.77, pivot: [214, 326] },
    torso: { file: 'char_torso', s: 0.70, pivot: [136, 405], neck: [139, 40], shoulder: [70, 146] },
    uarm:  { file: 'char_uarm',  s: 0.62, pivot: [105, 45], end: [60, 228] },
    farm:  { file: 'char_farm',  s: 0.62, pivot: [61, 42], end: [128, 200] },
    thigh: { file: 'char_thigh', s: 0.53, pivot: [108, 45], end: [61, 312] },
    shin:  { file: 'char_shin',  s: 0.53, pivot: [113, 38], end: [104, 330], heel: [30, 398], toe: [196, 392] }
  };
  const PROPS = { hammer: 'smith_hammer', sack: 'props__market_set__sacks' };
  for (const k in PARTS) { const p = PARTS[k]; if (p.end) p.fix = Math.atan2(p.end[0] - p.pivot[0], p.end[1] - p.pivot[1]); else p.fix = 0; }

  let img = null, dark = {}, urlFn = s => s + '.webp?v=65';
  const ok = im => im && im.complete && im.naturalWidth > 0;
  function load(fn) {
    if (img) return;
    if (fn) urlFn = fn;
    img = {};
    for (const k in PARTS) { const im = new Image(); im.src = urlFn(PARTS[k].file); img[k] = im; }
    for (const k in PROPS) { const im = new Image(); im.src = urlFn(PROPS[k]); img[k] = im; }
  }
  function ready() { return !!img && ['head', 'torso', 'uarm', 'farm', 'thigh', 'shin'].every(k => ok(img[k])); }
  function darkCopy(k) {                          // far-side limbs: a little darker so the body reads in depth
    if (dark[k] !== undefined) return dark[k];
    const im = img[k]; let c = null;
    try {
      c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      x.globalCompositeOperation = 'multiply'; x.fillStyle = '#a49aa0'; x.fillRect(0, 0, c.width, c.height);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0);
    } catch (e) { c = null; }
    return (dark[k] = c);
  }

  // ---- tiny 2D affine helpers: [a,b,c,d,e,f] like canvas setTransform
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const tr = (x, y) => [1, 0, 0, 1, x, y], rot = r => [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0], sc = s => [s, 0, 0, s, 0, 0];
  const ap = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
  // place a part: its pivot at world point w, pointing "forward" by deg (0 = straight down, + = toward facing)
  function place(k, w, deg) { const p = PARTS[k]; return mul(mul(mul(tr(w[0], w[1]), rot(p.fix - deg * D)), sc(p.s)), tr(-p.pivot[0], -p.pivot[1])); }

  // ---- skeleton solve: pose (degrees, forward-positive) → transforms in rig units, hip at origin
  function solve(P) {
    const T = {}, hip = [0, 0];
    T.torso = mul(mul(mul(tr(0, 0), rot(P.lean * D)), sc(PARTS.torso.s)), tr(-PARTS.torso.pivot[0], -PARTS.torso.pivot[1]));
    const neck = ap(T.torso, PARTS.torso.neck), sh = ap(T.torso, PARTS.torso.shoulder);
    // the head has no end point: it just tilts with the torso lean plus its own nod
    T.head = mul(mul(mul(tr(neck[0], neck[1]), rot((P.lean + P.head) * D)), sc(PARTS.head.s)), tr(-PARTS.head.pivot[0], -PARTS.head.pivot[1]));
    for (const side of ['N', 'F']) {
      const o = side === 'F' ? [10, -2] : [0, 0];
      const s0 = [sh[0] + o[0], sh[1] + o[1]], a = -P.lean + P['s' + side];
      T['uarm' + side] = place('uarm', s0, a);
      const el = ap(T['uarm' + side], PARTS.uarm.end);
      T['farm' + side] = place('farm', el, a + P['e' + side]);
      T['hand' + side] = { at: ap(T['farm' + side], PARTS.farm.end), deg: a + P['e' + side] };
      const h0 = side === 'F' ? [14, -4] : [-6, 0], th = P['h' + side];
      T['thigh' + side] = place('thigh', [hip[0] + h0[0], hip[1] + h0[1]], th);
      const kn = ap(T['thigh' + side], PARTS.thigh.end);
      T['shin' + side] = place('shin', kn, th - P['k' + side]);
    }
    let low = -1e9;
    for (const side of ['N', 'F']) for (const q of [PARTS.shin.heel, PARTS.shin.toe]) low = Math.max(low, ap(T['shin' + side], q)[1]);
    T.ground = low;
    return T;
  }

  // ---- poses
  const base = () => ({ lean: 0, head: 0, sN: -4, eN: 12, sF: 4, eF: 12, hN: 0, kN: 0, hF: 0, kF: 0, dx: 0, prop: null, lie: 0 });
  const pos = v => Math.max(0, v);
  const POSES = {
    idle(t) { const b = base(), br = Math.sin(t * 1.7);
      b.lean = 1 + br * 0.8; b.head = -br * 0.8; b.sN = -3 + br * 1.5; b.sF = 3 - br * 1.5; b.hN = 2; b.hF = -2; return b; },
    walk(t) { const b = base(), p = t * TAU * 0.95;
      b.lean = 4; b.hN = 24 * Math.sin(p); b.hF = 24 * Math.sin(p + Math.PI);
      b.kN = 6 + 42 * pos(Math.sin(p + 1.4)); b.kF = 6 + 42 * pos(Math.sin(p + Math.PI + 1.4));
      b.sN = -22 * Math.sin(p); b.sF = 22 * Math.sin(p); b.eN = 18 + 12 * pos(-Math.sin(p)); b.eF = 18 + 12 * pos(Math.sin(p));
      b.head = -2 + Math.sin(p * 2) * 1.2; return b; },
    run(t) { const b = base(), p = t * TAU * 1.45;
      b.lean = 13; b.hN = 42 * Math.sin(p); b.hF = 42 * Math.sin(p + Math.PI);
      b.kN = 12 + 85 * pos(Math.sin(p + 1.3)); b.kF = 12 + 85 * pos(Math.sin(p + Math.PI + 1.3));
      b.sN = -48 * Math.sin(p); b.sF = 48 * Math.sin(p); b.eN = 80; b.eF = 80; b.head = -9;
      b.lift = 10 * Math.abs(Math.cos(p)); return b; },
    hammer(t) { const b = base(), c = (t * 0.9) % 1;
      // 0–.55 raise slowly, .55–.68 strike, .68–1 rest on the work
      let s = c < 0.55 ? 40 + 105 * Math.sin(c / 0.55 * Math.PI / 2) : c < 0.68 ? 145 - 115 * ((c - 0.55) / 0.13) : 30;
      b.lean = c < 0.55 ? 2 - c * 6 : 9; b.hN = 14; b.kN = 10; b.hF = -14; b.kF = 6;
      b.sN = s; b.eN = c < 0.55 ? 40 : 18; b.sF = 38; b.eF = 40; b.head = 6; b.prop = 'hammer'; return b; },
    train(t) { const b = base(), c = (t * 1.6) % 2, k = c % 1, jab = k < 0.25 ? k / 0.25 : k < 0.45 ? 1 : 1 - (k - 0.45) / 0.55;
      b.lean = 6; b.hN = 20; b.kN = 18; b.hF = -18; b.kF = 14;
      const near = c < 1; b.sN = near ? 30 + 55 * jab : 35; b.eN = near ? 95 - 90 * jab : 100; b.sF = near ? 40 : 30 + 55 * jab; b.eF = near ? 100 : 95 - 90 * jab; return b; },
    carry(t) { const b = base(), c = (t * 0.45) % 1;
      // bend → lift → hold → set down
      const d = c < 0.25 ? 1 - c / 0.25 : c < 0.75 ? 0 : (c - 0.75) / 0.25, bend = Math.sin(d * Math.PI / 2);
      b.lean = 6 + 26 * bend; b.hN = 8 + 30 * bend; b.kN = 10 + 55 * bend; b.hF = -4 + 30 * bend; b.kF = 8 + 55 * bend;
      b.sN = 35 - 10 * bend; b.eN = 70; b.sF = 40 - 10 * bend; b.eF = 70; b.head = -4; b.prop = 'sack'; return b; },
    eat(t) { const b = POSES.idle(t), c = (t * 0.5) % 1, up = c < 0.3 ? Math.sin(c / 0.3 * Math.PI) : 0;
      b.sN = 15 + 75 * up; b.eN = 30 + 105 * up; b.head = up * 5; return b; },
    sick(t) { const b = POSES.idle(t * 0.6); b.lean = 12; b.head = 14; b.sN = 6; b.sF = 10; b.eN = 30; b.eF = 30; b.kN = 8; b.kF = 8; b.hN = 8; b.hF = 4; return b; },
    sleep(t) { const b = base(), br = Math.sin(t * 1.1); b.lie = 1; b.lean = 0; b.head = 4; b.sN = 8 + br; b.eN = 30; b.sF = 4; b.eF = 25; b.hN = 6; b.kN = 10; b.hF = 2; b.kF = 6; b.breath = br; return b; }
  };

  let refH = 0;
  function standHeight() {
    if (refH) return refH;
    const T = solve(base());
    let top = 1e9; const h = img.head;
    for (const p of [[0, 0], [h.naturalWidth, 0], [h.naturalWidth / 2, 0]]) top = Math.min(top, ap(T.head, p)[1]);
    return (refH = T.ground - top);
  }

  function drawPart(ctx, k, m, far) {
    const im = far ? (darkCopy(k) || img[k]) : img[k];
    ctx.save(); ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]); ctx.drawImage(im, 0, 0); ctx.restore();
  }
  function drawProp(ctx, P, T) {
    const hand = T.handN, im = img[P.prop];
    if (!ok(im)) return;
    ctx.save(); ctx.translate(hand.at[0], hand.at[1]);
    if (P.prop === 'hammer') {               // handle leaves the fist at ~50° to the forearm, head at the far end
      const fa = Math.atan2(Math.cos(hand.deg * D), Math.sin(hand.deg * D));
      ctx.rotate(fa - 50 * D - Math.PI);
      const w = 230, h = w * im.naturalHeight / im.naturalWidth;
      ctx.drawImage(im, -w * 0.92, -h / 2, w, h);
    } else {                                 // sack held in front of the chest
      const w = 170, h = w * im.naturalHeight / im.naturalWidth;
      ctx.drawImage(im, -w * 0.35, -h * 0.75, w, h);
    }
    ctx.restore();
  }

  // draw: feet at (0,0), facing right, total standing height = height (in ctx units)
  function draw(ctx, anim, t, height) {
    if (!ready()) return false;
    const P = (POSES[anim] || POSES.idle)(t || 0), T = solve(P), k = height / standHeight();
    ctx.save(); ctx.scale(k, k);
    if (P.lie) { ctx.translate(standHeight() / 2, -118 - (P.breath || 0) * 2); ctx.rotate(-Math.PI / 2); ctx.translate(0, -T.ground); }
    else ctx.translate(0, -T.ground - (P.lift || 0));
    drawPart(ctx, 'uarm', T.uarmF, true); drawPart(ctx, 'farm', T.farmF, true);
    drawPart(ctx, 'shin', T.shinF, true); drawPart(ctx, 'thigh', T.thighF, true);
    drawPart(ctx, 'shin', T.shinN); drawPart(ctx, 'thigh', T.thighN);
    if (P.prop === 'sack') drawProp(ctx, P, T);
    drawPart(ctx, 'torso', T.torso); drawPart(ctx, 'head', T.head);
    drawPart(ctx, 'uarm', T.uarmN);
    if (P.prop === 'hammer') drawProp(ctx, P, T);
    drawPart(ctx, 'farm', T.farmN);
    ctx.restore();
    return true;
  }
  // map the life schedule's activity text to an animation
  function pick(act, moving, speed) {
    if (moving) return speed > 600 ? 'run' : 'walk';
    const a = act || '';
    if (/นอน/.test(a)) return 'sleep';
    if (/ป่วย|พักฟื้น/.test(a)) return 'sick';
    if (/ตีเหล็ก/.test(a)) return 'hammer';
    if (/ฝึก/.test(a)) return 'train';
    if (/ขนของ|รับจ้าง/.test(a)) return 'carry';
    if (/กินข้าว|อาหาร/.test(a)) return 'eat';
    return 'idle';
  }
  // per-actor helper: picks the animation and keeps the stride in step with how far the actor really moved
  const tracks = {};
  function drawActor(ctx, key, x, y, act, moving, height) {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    let tk = tracks[key];
    if (!tk) tk = tracks[key] = { x, y, at: now, t: 0, spd: 0 };
    const dt = Math.min(0.25, Math.max(0, now - tk.at)), dist = Math.min(Math.hypot(x - tk.x, y - tk.y), height * 2);
    if (dt > 0) tk.spd = tk.spd * 0.8 + (dist / dt) * 0.2;
    tk.x = x; tk.y = y; tk.at = now;
    const spd = tk.spd / height * 124, anim = pick(act, moving, spd);
    // legs follow the real speed, capped so fast-forwarded time doesn't turn into a blur
    if (anim === 'walk') tk.t += dt * Math.min(1.7, Math.max(0.7, spd / (1.3 * 124))) / 0.95;
    else if (anim === 'run') tk.t += dt * Math.min(2.6, Math.max(1.2, spd / (2.0 * 124))) / 1.45;
    else tk.t += dt;
    if (anim === 'sleep' && /ม้านั่ง/.test(act || '')) { ctx.save(); ctx.translate(0, -height * 0.3); draw(ctx, anim, tk.t, height); ctx.restore(); }
    else draw(ctx, anim, tk.t, height);
    return anim;
  }
  function portrait(cv) {
    if (!ready()) return false;
    const g = cv.getContext('2d'), d = Math.min(window.devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
    cv.width = Math.round((r.width || 46) * d); cv.height = Math.round((r.height || 46) * d);
    const h = img.head, s = Math.min(cv.width / h.naturalWidth, cv.height / h.naturalHeight) * 1.25;
    g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(h, (cv.width - h.naturalWidth * s) / 2 + cv.width * .06, (cv.height - h.naturalHeight * s) / 2 + cv.height * .08, h.naturalWidth * s, h.naturalHeight * s);
    return true;
  }
  root.CharacterRig = { load, ready, draw, drawActor, pick, portrait, POSES, _solve: solve };
})(typeof globalThis !== 'undefined' ? globalThis : this);
