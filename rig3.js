/* v148 Rig3 — chibi cutout characters (Night Camp style): big head, round body, short one-piece limbs and
   floating fists, hat/hair/scarf as separate pieces for follow-through. Rest pose = the character's own
   full-body drawing (pieces laid over it, rig6/layout.json); every animation turns/moves bones from there.
   Rig3.draw(ctx, id, anim, t, x, groundY, height, face, opts)  anims: idle · walk · run · attack1..3 · hit */
(function (root) {
  'use strict';
  const SKEL = {
    chibi: {
      dir: 'rig/chibi/', ver: 149,
      // pivot = joint in the (pre-scaled) picture; world = where that joint is in the full-body drawing; ang = rest angle
      bones: {
        torso: { pivot: [85.7, 115.6], world: [255, 437] },
        legA:  { pivot: [46.2, 12.2], world: [198, 440], parent: 'torso', ang: 12 },      // back leg
        legB:  { pivot: [42.8, 12.2], world: [302, 440], parent: 'torso', ang: -10 },     // front leg
        head:  { pivot: [117.0, 212.2], world: [240, 335], parent: 'torso' },
        hair:  { pivot: [197.4, 131.0], world: [262, 160], parent: 'head' },
        hat:   { pivot: [164.0, 103.0], world: [150, 98], parent: 'head', ang: -6 },
        scarf: { pivot: [152.0, 30.4], world: [212, 320], parent: 'torso' },
        armA:  { pivot: [66.0, 16.5], world: [195, 352], parent: 'torso' },               // back arm
        fistA: { pivot: [34.6, 30.2], world: [144, 417], parent: 'armA' },
        armB:  { pivot: [16.5, 14.5], world: [318, 352], parent: 'torso', ang: -60 },     // sword arm
        fistB: { pivot: [33.8, 30.2], world: [355, 383], parent: 'armB' },
        sword: { pivot: [48.0, 132.0], world: [360, 385], parent: 'fistB' }
      },
      order: ['armB', 'legA', 'legB', 'torso', 'scarf', 'head', 'hair', 'hat', 'armA', 'fistA', 'sword', 'fistB']
    }
  };
  const D = Math.PI / 180, imgs = {};
  const ok = i => i && i.complete && i.naturalWidth > 0;
  const img = (sk, n) => { const k = sk.dir + n; if (!imgs[k]) { const i = new Image(); i.src = sk.dir + n + '.webp?v=' + sk.ver; imgs[k] = i; } return imgs[k]; };
  // rest frames and each bone's frame relative to its parent
  function prep(sk) {
    if (sk.local) return;
    sk.local = {}; const F = {};
    for (const n of Object.keys(sk.bones)) { const b = sk.bones[n]; F[n] = new DOMMatrix().translate(b.world[0], b.world[1]).rotate(b.ang || 0); }
    for (const n of Object.keys(sk.bones)) { const b = sk.bones[n]; sk.local[n] = b.parent ? F[b.parent].inverse().multiply(F[n]) : F[n]; }
    sk.F = F;
  }
  // ---- easing & key tracks ----
  const ease = q => q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
  const burst = q => 1 - Math.pow(1 - q, 4), slowIn = q => q * q;
  function track(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
      const [t0, a] = keys[i - 1], [t1, b, e] = keys[i], q = (e || ease)((t - t0) / (t1 - t0)), o = {};
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = k === 'sx' || k === 'sy' ? 1 : 0, av = k in a ? a[k] : d, bv = k in b ? b[k] : d; o[k] = av + (bv - av) * q; }
      return o;
    }
    return keys[keys.length - 1][1];
  }
  // channels: <bone> = extra rotation (deg, + clockwise); <bone>X/<bone>Y = extra move (px of the drawing);
  // x/y move the whole body; sx/sy squash & stretch around the feet
  // ---- v150 motion, rebuilt from how chibi action games move (Night Camp, Maple-style):
  // feet are planted and lifted on an ellipse (no sliding), the body bounces twice per step and squashes on
  // contact, arms swing wide against the legs, attacks use the whole body (step in, squash, stretch, snap back).
  // Angles: + = clockwise. Arm rest = hanging forward-down; armB −150 = sword raised overhead behind the head.
  const LEG = 140;                                   // leg length in drawing px (for the foot arcs)
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  function feetOn(P, phase, A, L) {                   // phase 0..2π; legB = near leg
    for (const [n, ph] of [['legB', phase], ['legA', phase + Math.PI]]) {
      const fx = A * Math.cos(ph), up = L * Math.max(0, -Math.sin(ph));
      P[n] = (P[n] || 0) - Math.asin(Math.max(-0.9, Math.min(0.9, fx / LEG))) * R2D - (up > 0 ? 10 * up / L : 0);
      P[n + 'Y'] = -up;
    }
  }
  const WALK = { T: 0.58, A: 20, L: 18, bob: 8, lean: 5, arm: 34 }, RUN = { T: 0.42, A: 34, L: 28, bob: 13, lean: 13, arm: 55 };
  function walking(t, G) {
    const ph = (t / G.T) * Math.PI * 2, P = {};
    feetOn(P, ph, G.A, G.L);
    const s2 = Math.abs(Math.sin(ph));                // 0 = both feet down (contact), 1 = passing
    P.y = -G.bob * s2 + 2;
    P.sy = 1 - 0.045 * (1 - s2) + 0.02 * s2; P.sx = 1 + 0.035 * (1 - s2);
    P.torso = G.lean + 2.5 * Math.sin(2 * ph + 0.6);
    P.head = -G.lean * 0.6 - 3 * Math.sin(2 * ph - 0.5);
    const c = Math.cos(ph - 0.35);                    // arms a beat behind the legs, swinging against them
    P.armA = -G.arm * 0.8 * c + 4; P.fistA = -10 * Math.cos(ph - 0.9);
    P.armB = G.arm * 0.3 * c - 6; P.sword = -10 - 8 * Math.cos(ph - 0.7);
    P.scarf = -G.lean * 1.2;
    return P;
  }
  // calibrated on the sheet: armB −30 = fist at the shoulder, sword up · +30 = sword straight forward · +90 = sword down;
  // sword −70 = blade tipped back over the head · +60 = blade down-forward; armA − = back fist comes forward
  const READY = { y: 7, sy: 0.97, sx: 1.03, torso: 6, head: -3, armB: -8, sword: -12, armA: 10, legA: 6, legB: -6 };
  const K = o => Object.assign({}, READY, o);
  const ATTACK = {
    attack1: [[0, READY],                                                                     // overhead chop
      [0.17, K({ x: -14, y: 10, sy: 0.9, sx: 1.08, torso: -10, head: -4, armB: -30, sword: -38, armA: 26, legB: -2, legA: 14 }), slowIn],
      [0.24, K({ x: 46, y: 2, sy: 1.07, sx: 0.95, torso: 20, head: 10, armB: 66, sword: 46, armA: -14, legB: -26, legA: 22, legBX: 12 }), burst],
      [0.36, K({ x: 50, y: 6, sy: 0.96, sx: 1.04, torso: 16, head: 8, armB: 70, sword: 50, armA: -10, legB: -24, legA: 22, legBX: 12 })],
      [0.7, READY, ease]],
    attack2: [[0, READY],                                                                     // rising slash
      [0.16, K({ x: -6, y: 14, sy: 0.88, sx: 1.1, torso: 14, head: 6, armB: 80, sword: 62, armA: 18, legB: -10, legA: 10 }), slowIn],
      [0.23, K({ x: 36, y: -18, sy: 1.1, sx: 0.93, torso: -6, head: -3, armB: -34, sword: -14, armA: -12, legB: -20, legA: 24, legBY: -10 }), burst],
      [0.36, K({ x: 40, y: -12, sy: 1.04, sx: 0.97, torso: -5, head: -2, armB: -32, sword: -10, armA: -8, legB: -18, legA: 20 })],
      [0.68, READY, ease]],
    attack3: [[0, READY],                                                                     // lunging thrust finisher
      [0.24, K({ x: -26, y: 12, sy: 0.88, sx: 1.1, torso: -18, head: -10, armB: 20, armBX: -22, sword: 12, armA: 30, legB: 8, legA: 18 }), slowIn],
      [0.31, K({ x: 78, y: 4, sy: 1.08, sx: 0.94, torso: 24, head: 12, armB: 22, armBX: 30, sword: 10, armA: -18, legB: -34, legA: 30, legBX: 18 }), burst],
      [0.5, K({ x: 82, y: 8, sy: 0.97, sx: 1.04, torso: 20, head: 10, armB: 24, armBX: 28, sword: 12, armA: -14, legB: -32, legA: 30, legBX: 18 })],
      [0.88, READY, ease]],
    hit: [[0, READY],
      [0.05, K({ x: -34, y: 4, sy: 0.9, sx: 1.08, torso: -14, head: -8, armB: 18, sword: -40, armA: 34, legB: 10, legA: -6 }), burst],
      [0.28, K({ x: -40, y: 6, torso: -10, head: -6, armB: 12, sword: -30, armA: 24, legB: 8, legA: -4 })],
      [0.72, READY, ease]]
  };
  const LEN = { attack1: 0.7, attack2: 0.68, attack3: 0.88, hit: 0.72 };
  function pose(anim, t) {
    if (anim === 'walk') return walking(t, WALK);
    if (anim === 'run') return walking(t, RUN);
    if (ATTACK[anim]) return Object.assign(track(ATTACK[anim], Math.min(t, LEN[anim])), { snap: 1 });
    if (anim === 'ready') {                            // fighting stance: a light bounce on the knees
      const b = Math.sin(t * 2 * Math.PI * 1.6), P = Object.assign({}, READY);
      P.y += 3 * (1 - Math.abs(b)); P.sy -= 0.015 * (1 - Math.abs(b)); P.sx += 0.012 * (1 - Math.abs(b));
      P.armB += 4 * b; P.head -= 2 * b; return P;
    }
    const b = Math.sin(t * 2.2), w = Math.sin(t * 1.1);  // idle: breathing and a slow weight shift
    return { y: -2 * b, sy: 1 + 0.018 * b, sx: 1 - 0.012 * b, x: 3 * w, torso: 1.5 * w, head: -2 * w + 1.5 * Math.sin(t * 2.2 - 1),
      armA: 4 * Math.sin(t * 2.2 - 0.6), armB: 3 * Math.sin(t * 2.2 - 0.8), legA: -1.5 * w, legB: -1.5 * w };
  }
  function walkSpeed(id, height) { const sk = SKEL[id]; return sk && sk.H ? (4 * WALK.A / WALK.T) * height / sk.H : 0; }
  function runSpeed(id, height) { const sk = SKEL[id]; return sk && sk.H ? (4 * RUN.A / RUN.T) * height / sk.H : 0; }

  // ---- v149 soft layer: every channel follows its target through a damped spring, so nothing snaps;
  // light parts (hair, hat, scarf, fists, head) are looser and also swing from the body's own motion.
  const SPRING = {   // [stiffness, damping] — lower stiffness = softer / later
    torso: [380, 30], head: [170, 14], armA: [220, 17], armB: [420, 30], armBX: [420, 30], fistA: [140, 10], sword: [380, 26],
    hat: [190, 13], hair: [150, 10], scarf: [60, 5.2]
  };
  const LIM = { head: 6, hat: 8, hair: 12, scarf: 25, fistA: 12 };
  const LIGHT = { hat: 1, hair: 1, scarf: 1, fistA: 1, head: 1 };
  const FOLLOW = { head: [0.015, 0.02], hat: [0.02, 0.035], hair: [0.03, 0.05], scarf: [0.08, 0.15], fistA: [0.02, 0.03] };   // [from body x-velocity, from y-velocity]   // [from body x-accel, from y-vel]
  function soft(state, P, now) {
    const dt = Math.min(0.05, Math.max(0.001, state.t === undefined ? 0.016 : now - state.t)); state.t = now;
    const S = state.s = state.s || {};
    const prevX = S.x ? S.x.v : 0, prevY = S.y ? S.y.v : 0;
    const out = {};
    for (const k of new Set([...Object.keys(SPRING), ...Object.keys(P)])) {
      const target = P[k] !== undefined ? P[k] : (k === 'sx' || k === 'sy' ? 1 : 0); let sp = SPRING[k];
      if (sp && P.snap && !LIGHT[k]) sp = [sp[0] * 5, sp[1] * 2.2];          // strikes stay sharp; only the light parts lag
      if (!sp || typeof target !== 'number') { out[k] = target; continue; }
      const c = S[k] = S[k] || { v: target, w: 0 };
      // a few small steps for stability
      for (let i = 0; i < 3; i++) { const h = dt / 3, a = sp[0] * (target - c.v) - sp[1] * c.w; c.w += a * h; c.v += c.w * h; }
      out[k] = c.v;
    }
    // body motion drives the light parts (a sudden move forward flings the hair and scarf back)
    const vx = state.px === undefined ? 0 : ((P.x || 0) - state.px) / dt, vy = state.py === undefined ? 0 : ((P.y || 0) - state.py) / dt; state.px = P.x || 0; state.py = P.y || 0;
    const ax = state.vx === undefined ? 0 : vx * 0.6 + state.vx * 0.4; state.vx = vx;
    for (const k in FOLLOW) { const [fa, fv] = FOLLOW[k]; const c = S['f_' + k] = S['f_' + k] || { v: 0, w: 0 }; const tgt = -ax * fa + vy * fv;
      for (let i = 0; i < 3; i++) { const h = dt / 3, a = 60 * (tgt - c.v) - 8 * c.w; c.w += a * h; c.v += c.w * h; }
      out[k] = (out[k] || 0) + Math.max(-LIM[k], Math.min(LIM[k], c.v)); }
    void prevX; void prevY;
    return out;
  }
  const STATES = {};
  function solve(sk, P, root) {
    prep(sk); const M = {};
    const f = n => {
      if (M[n]) return M[n]; const b = sk.bones[n];
      const parent = b.parent ? f(b.parent) : root.translate(P.x || 0, P.y || 0);
      return (M[n] = parent.multiply(sk.local[n]).translate(P[n + 'X'] || 0, P[n + 'Y'] || 0).rotate(P[n] || 0));
    };
    Object.keys(sk.bones).forEach(f);
    return M;
  }
  function draw(ctx, id, anim, t, x, gy, height, face, opts) {
    const sk = SKEL[id]; if (!sk || !ready(id)) return false;
    prep(sk);
    if (!sk.H) {   // rest height: hat top → soles
      const M = solve(sk, {}, new DOMMatrix()), bot = n => M[n].transformPoint(new DOMPoint(img(sk, n).naturalWidth / 2 - sk.bones[n].pivot[0], img(sk, n).naturalHeight - sk.bones[n].pivot[1])).y;
      sk.sole = Math.max(bot('legA'), bot('legB')); sk.H = sk.sole - M.hat.transformPoint(new DOMPoint(0, -sk.bones.hat.pivot[1])).y;
    }
    let P = Object.assign(pose(anim, t), (opts && opts.pose) || {});
    if (!(opts && opts.hard)) { const st = (opts && opts.state) || (STATES[id] = STATES[id] || {}); P = soft(st, P, performance.now() / 1000); }
    const k = height / sk.H, base = ctx.getTransform();
    // feet stay on the ground: scale around the feet, the rest pose's soles sit on groundY
    const rootM = base.translate(x, gy).scale(k * (face || 1), k).scale(P.sx || 1, P.sy || 1).translate(-sk.F.torso.e, -sk.sole);
    const M = solve(sk, P, rootM);
    ctx.save();
    for (const n of sk.order) {
      if (n === 'sword' && opts && opts.noWeapon) continue;
      const b = sk.bones[n]; ctx.setTransform(M[n].translate(-b.pivot[0], -b.pivot[1])); ctx.drawImage(img(sk, n), 0, 0);
    }
    ctx.restore();
    // a white smear behind the blade while it moves fast (strikes)
    if (opts && opts.trail !== false) {
      const st = (opts && opts.state) || STATES[id], tr = st.trail = st.trail || [], now = performance.now();
      const T1 = M.sword.transformPoint(new DOMPoint(TIP[0] - sk.bones.sword.pivot[0], TIP[1] - sk.bones.sword.pivot[1])), T2 = M.sword.transformPoint(new DOMPoint(MID[0] - sk.bones.sword.pivot[0], MID[1] - sk.bones.sword.pivot[1]));
      tr.push({ a: T1, b: T2, t: now }); while (tr.length && now - tr[0].t > 110) tr.shift();
      const fast = P.snap && tr.length > 2 && Math.hypot(tr[tr.length - 1].a.x - tr[0].a.x, tr[tr.length - 1].a.y - tr[0].a.y) > height * 0.25;
      if (fast) {
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        for (let i = 1; i < tr.length; i++) { const p = tr[i - 1], q = tr[i], al = i / tr.length;
          ctx.globalAlpha = 0.75 * al; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(q.a.x, q.a.y); ctx.lineTo(q.b.x, q.b.y); ctx.lineTo(p.b.x, p.b.y); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      }
    }
    return true;
  }
  const TIP = [188, 4], MID = [118, 64];               // on the sword picture: blade tip and mid-blade
  function tip() { return TIP; }
  function ready(id) { const sk = SKEL[id]; return !!sk && Object.keys(sk.bones).every(n => ok(img(sk, n))); }
  root.Rig3 = { draw, ready, pose, SKEL, LEN, walkSpeed, runSpeed, tip };
})(typeof window !== 'undefined' ? window : globalThis);
