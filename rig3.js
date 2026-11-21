/* v148 Rig3 — chibi cutout characters (Night Camp style): big head, round body, short one-piece limbs and
   floating fists, hat/hair/scarf as separate pieces for follow-through. Rest pose = the character's own
   full-body drawing (pieces laid over it, rig6/layout.json); every animation turns/moves bones from there.
   Rig3.draw(ctx, id, anim, t, x, groundY, height, face, opts)  anims: idle · walk · run · attack1..3 · hit */
(function (root) {
  'use strict';
  const SKEL = {
    chibi: {
      dir: 'rig/chibi/', ver: 148,
      // pivot = joint in the (pre-scaled) picture; world = where that joint is in the full-body drawing; ang = rest angle
      bones: {
        torso: { pivot: [85.7, 115.6], world: [255, 437] },
        legA:  { pivot: [44.9, 11.9], world: [195, 455], parent: 'torso', ang: 12 },     // back leg
        legB:  { pivot: [41.6, 11.9], world: [305, 455], parent: 'torso', ang: -10 },    // front leg
        head:  { pivot: [117.0, 212.2], world: [240, 335], parent: 'torso' },
        hair:  { pivot: [173.9, 115.4], world: [250, 133], parent: 'head' },
        hat:   { pivot: [139.4, 87.5], world: [150, 80], parent: 'head' },
        scarf: { pivot: [132.0, 26.4], world: [220, 318], parent: 'torso' },
        armA:  { pivot: [66.0, 16.5], world: [195, 352], parent: 'torso' },              // back arm
        fistA: { pivot: [34.6, 30.2], world: [144, 417], parent: 'armA' },
        armB:  { pivot: [16.5, 14.5], world: [318, 352], parent: 'torso', ang: -60 },    // sword arm
        fistB: { pivot: [33.8, 30.2], world: [355, 383], parent: 'armB' },
        sword: { pivot: [39.6, 108.9], world: [360, 385], parent: 'fistB' }
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
  const READY = { armB: 10, sword: 0, torso: 2 };
  const ATTACK = {
    attack1: [[0, READY],                                                                                         // overhead slash
      [0.2, { torso: -10, head: -6, armB: -95, sword: -30, armA: 20, x: -10, sx: 0.96, sy: 1.04, hat: 4, hair: 3 }, slowIn],
      [0.27, { torso: 14, head: 8, armB: 95, sword: 45, armA: -25, x: 22, sx: 1.06, sy: 0.94, hat: -6, hair: -4, scarf: -8 }, burst],
      [0.4, { torso: 12, head: 6, armB: 100, sword: 50, armA: -22, x: 24, sx: 1.04, sy: 0.96, hat: -2, hair: -2 }],
      [0.65, READY, ease]],
    attack2: [[0, READY],                                                                                         // rising slash
      [0.18, { torso: 10, head: 4, armB: 110, sword: 60, armA: -10, x: -6, y: 8, sx: 1.05, sy: 0.95 }, slowIn],
      [0.25, { torso: -10, head: -8, armB: -120, sword: -50, armA: 25, x: 20, y: -10, sx: 0.95, sy: 1.06, hat: 8, hair: 5, scarf: 10 }, burst],
      [0.38, { torso: -8, head: -6, armB: -115, sword: -45, armA: 22, x: 22, y: -8, hat: 3, hair: 2 }],
      [0.62, READY, ease]],
    attack3: [[0, READY],                                                                                         // thrust finisher
      [0.26, { torso: -14, head: -8, armB: -20, armBX: -30, sword: 60, armA: 25, x: -18, y: 6, sx: 0.94, sy: 1.05 }, slowIn],
      [0.33, { torso: 20, head: 10, armB: 70, armBX: 40, sword: 25, armA: -30, x: 46, y: 4, sx: 1.1, sy: 0.92, hat: -10, hair: -6, scarf: -14 }, burst],
      [0.52, { torso: 18, head: 9, armB: 70, armBX: 40, sword: 25, armA: -28, x: 48, y: 4, sx: 1.06, sy: 0.95, hat: -3, hair: -2 }],
      [0.85, READY, ease]],
    hit: [[0, READY],
      [0.06, { torso: -18, head: -14, armB: -30, armA: 30, x: -30, sx: 0.92, sy: 1.06, hat: 10, hair: 8, scarf: 14 }, burst],
      [0.3, { torso: -12, head: -9, armB: -20, armA: 22, x: -34, hat: 4, hair: 3 }],
      [0.7, READY, ease]]
  };
  const LEN = { attack1: 0.65, attack2: 0.62, attack3: 0.85, hit: 0.7 };
  function pose(anim, t) {
    if (anim === 'walk' || anim === 'run') {
      const run = anim === 'run', T = run ? 0.46 : 0.62, ph = (t % T) / T * Math.PI * 2, s = Math.sin(ph), c = Math.cos(ph);
      const sw = run ? 30 : 22, lift = run ? 16 : 10;
      const lag = k => Math.sin(ph - k), bob = Math.abs(Math.cos(ph));          // two bounces per cycle
      return {
        legA: sw * s, legB: -sw * s,                                             // legs scissor
        legAY: -Math.max(0, -c) * lift, legBY: -Math.max(0, c) * lift,           // the leg swinging forward lifts its foot
        armA: -sw * 1.1 * s, armB: 12 + sw * 0.5 * s, sword: -6 * s,            // arms swing against the legs
        fistAX: 0, torso: (run ? 8 : 4) + 2 * lag(0.3) * 0,
        y: -(1 - bob) * (run ? 14 : 9), sy: 1 + 0.03 * (bob - 0.5), sx: 1 - 0.03 * (bob - 0.5),
        head: -2 + 3 * Math.cos(2 * ph - 0.9),                                   // nods with each step, a little late
        hat: 4 * Math.cos(2 * ph - 1.4), hair: 3 * Math.cos(2 * ph - 1.2),
        scarf: (run ? -14 : -8) + 6 * Math.sin(2 * ph - 1.6)                    // scarf trails and flutters
      };
    }
    if (ATTACK[anim]) return track(ATTACK[anim], Math.min(t, LEN[anim]));
    const b = Math.sin(t * 2.4), b2 = Math.sin(t * 2.4 - 0.9);                  // idle / ready: breathing
    const base = anim === 'ready' ? READY : {};
    return Object.assign({}, base, { y: -1.5 - b * 1.5, sy: 1 + 0.012 * b, sx: 1 - 0.008 * b, head: (base.head || 0) + b2 * 1.5, hat: b2 * 2, hair: b2 * 1.5, scarf: -3 + b2 * 3, armA: b2 * 3, armB: (base.armB || 0) + b2 * 2 });
  }
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
    const P = Object.assign(pose(anim, t), (opts && opts.pose) || {});
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
    return true;
  }
  function ready(id) { const sk = SKEL[id]; return !!sk && Object.keys(sk.bones).every(n => ok(img(sk, n))); }
  root.Rig3 = { draw, ready, pose, SKEL, LEN };
})(typeof window !== 'undefined' ? window : globalThis);
