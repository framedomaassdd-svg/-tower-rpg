/* v143 Rig — Spine-style 2D skeletal animation, built the way Night Camp explains it:
   6 parts (head · torso · front arm · back arm · front leg · back leg) + weapon. Each arm/leg is ONE picture with
   two bones; the elbow/knee bends by slicing the picture into thin strips that follow the bones (a cheap mesh),
   so there is no crack at the joint. Poses are bone angles at key frames joined by easing curves: soft in-out for
   calm moves, a fast "burst" for strikes, then a hold and a slow recovery. Walking: legs alternate, the lifted
   knee bends, the head bobs with each step and the arms swing AGAINST the legs.
   Rig.draw(ctx, rigId, anim, t, x, groundY, height, face, opts) — feet on (x, groundY); height = standing height. */
(function (root) {
  'use strict';
  // ---- the parts sheet (pixels inside each picture) ----
  //  limb: top pivot (shoulder/hip), joint = elbow/knee y, end = fist/ankle y, s = scale
  const SKEL = {
    hero2: {
      dir: 'rig/hero2/', ver: 145,
      torso: { img: 'torso', pivot: [125, 262], s: 0.82,                 // pivot = waist
               neck: [148, 20], collar: [40, 80], shoulderF: [66, 78], shoulderB: [150, 76], hipF: [146, 280], hipB: [108, 280] },
      head:  { img: 'head', pivot: [118, 214], s: 1.16 },
      armF:  { img: 'armF', pivot: [50, 40], joint: 150, end: 282, s: 0.66 },
      armB:  { img: 'armB', pivot: [48, 40], joint: 150, end: 280, s: 0.66 },
      legF:  { img: 'legF', pivot: [62, 34], joint: 196, end: 300, s: 0.72 },
      legB:  { img: 'legB', pivot: [58, 34], joint: 196, end: 300, s: 0.72 },
      sword: { img: 'sword', pivot: [60, 58], s: 0.8 },
      faces: { hurt: 'headHurt', shout: 'headShout', happy: 'headHappy' }
    }
  };
  const RIGS = { hero_craft_m: 'hero2', hero2: 'hero2' };
  const imgs = {};
  const ok = i => i && i.complete && i.naturalWidth > 0;
  function img(sk, name) { const k = sk.dir + name; if (!imgs[k]) { const i = new Image(); i.src = sk.dir + name + '.webp?v=' + sk.ver; imgs[k] = i; } return imgs[k]; }

  // ---- easing (the curves between key frames) ----
  const ease = q => q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;   // soft in-out
  const burst = q => 1 - Math.pow(1 - q, 4);                                   // strikes: fast start, soft landing
  const slowIn = q => q * q;                                                    // wind-up
  const mix = (a, b, q) => { const o = Object.assign({}, a); for (const k in b) { const v = b[k]; o[k] = typeof v === 'number' ? (a[k] || 0) + (v - (a[k] || 0)) * q : (q > 0.5 ? v : a[k]); } return o; };
  function track(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
      const [t0, p0] = keys[i - 1], [t1, p1, e] = keys[i];
      return mix(p0, p1, (e || ease)((t - t0) / (t1 - t0)));
    }
    return keys[keys.length - 1][1];
  }
  // degrees, + = clockwise on screen. For a right-facing body: arm/leg + swings BACK, torso + leans FORWARD,
  // elbow − folds the forearm forward/up, knee + folds the shin back. sword = blade angle from "forward" in the fist.
  const BASE = { x: 0, y: 0, torso: 3, head: -2, armF: 6, elbowF: -22, armB: -8, elbowB: -26, legF: -20, kneeF: 6, legB: 20, kneeB: 4, sword: -50, face: null };
  const K = o => Object.assign({}, BASE, o);
  const READY = K({ armF: -24, elbowF: -50, sword: -58, armB: 14, elbowB: -40, legF: -14, kneeF: 14, legB: 14, kneeB: 10, torso: 6, y: 6 });
  // combo: 1 downward slash · 2 rising slash · 3 thrust finisher (slow wind-up → burst → hold → recover)
  const ATTACK1 = [
    [0, READY],
    [0.2, K({ armF: 160, elbowF: -40, sword: -80, armB: -30, elbowB: -50, torso: -8, head: -6, legF: -10, kneeF: 10, legB: 16, kneeB: 10, x: -10, y: 4, face: 'shout' }), slowIn],
    [0.27, K({ armF: -62, elbowF: -6, sword: 30, armB: 36, elbowB: -30, torso: 18, head: 6, legF: -30, kneeF: 16, legB: 26, kneeB: 6, x: 26, y: 12, face: 'shout' }), burst],
    [0.4, K({ armF: -56, elbowF: -8, sword: 36, armB: 34, elbowB: -32, torso: 16, head: 6, legF: -30, kneeF: 18, legB: 26, kneeB: 8, x: 28, y: 13, face: 'shout' })],
    [0.62, READY, ease]
  ];
  const ATTACK2 = [
    [0, READY],
    [0.18, K({ armF: 40, elbowF: -10, sword: 70, armB: -20, elbowB: -50, torso: 12, head: 4, legF: -24, kneeF: 30, legB: 20, kneeB: 10, x: -6, y: 14, face: 'shout' }), slowIn],
    [0.25, K({ armF: -165, elbowF: -10, sword: -30, armB: 30, elbowB: -30, torso: -10, head: -8, legF: -16, kneeF: 4, legB: 14, kneeB: 2, x: 20, y: -6, face: 'shout' }), burst],
    [0.38, K({ armF: -160, elbowF: -14, sword: -26, armB: 28, elbowB: -32, torso: -8, head: -6, legF: -16, kneeF: 6, legB: 14, kneeB: 4, x: 22, y: -4, face: 'shout' })],
    [0.6, READY, ease]
  ];
  const ATTACK3 = [
    [0, READY],
    [0.26, K({ armF: 30, elbowF: -105, sword: 0, armB: -40, elbowB: -40, torso: -14, head: -8, legF: -6, kneeF: 22, legB: 30, kneeB: 24, x: -18, y: 16, face: 'shout' }), slowIn],
    [0.33, K({ armF: -88, elbowF: 2, sword: 0, armB: 50, elbowB: -10, torso: 24, head: 10, legF: -44, kneeF: 20, legB: 40, kneeB: 4, x: 48, y: 18, face: 'shout' }), burst],
    [0.52, K({ armF: -86, elbowF: 0, sword: 0, armB: 48, elbowB: -12, torso: 22, head: 10, legF: -44, kneeF: 22, legB: 40, kneeB: 6, x: 50, y: 19, face: 'shout' })],
    [0.8, READY, ease]
  ];
  const HIT = [
    [0, READY],
    [0.07, K({ armF: 30, elbowF: -70, sword: -50, armB: 40, elbowB: -60, torso: -18, head: -16, legF: 6, kneeF: 10, legB: -10, kneeB: 18, x: -26, y: 8, face: 'hurt' }), burst],
    [0.28, K({ armF: 22, elbowF: -64, sword: -44, armB: 32, elbowB: -56, torso: -12, head: -10, legF: 4, kneeF: 12, legB: -8, kneeB: 16, x: -30, y: 7, face: 'hurt' })],
    [0.7, READY, ease]
  ];
  const ANIMS = { attack: ATTACK1, attack1: ATTACK1, attack2: ATTACK2, attack3: ATTACK3, hit: HIT };
  const LEN = { attack: 0.62, attack1: 0.62, attack2: 0.6, attack3: 0.8, hit: 0.7 };
  function pose(anim, t) {
    if (anim === 'walk') return walkPose(t);
    if (anim === 'run') {
      const T = 0.5, ph = (t % T) / T * Math.PI * 2, s = Math.sin(ph), c = Math.cos(ph), sw = 30;
      return K({
        legF: -sw * s - 6, legB: sw * s - 6, kneeF: 6 + Math.max(0, -c) * 60, kneeB: 6 + Math.max(0, c) * 60,
        armF: sw * 0.5 * s + 4, elbowF: -55, armB: -sw * 0.9 * s - 4, elbowB: -40 - Math.max(0, s) * 40,
        torso: 12 + 1.5 * Math.cos(ph * 2), head: -8 - 2 * Math.cos(ph * 2 + 0.8), y: Math.abs(Math.sin(ph)) * -10, sword: -70 + 6 * s
      });
    }
    if (ANIMS[anim]) return track(ANIMS[anim], Math.min(t, LEN[anim]));
    const b = Math.sin(t * 2.6), b2 = Math.sin(t * 2.6 - 0.8), base = anim === 'ready' ? READY : BASE;   // breathing
    return Object.assign({}, base, { y: (base.y || 0) + b * 3, torso: base.torso + b * 1.5, head: base.head - b2 * 2.5, armF: base.armF + b2 * 3, elbowF: base.elbowF - b2 * 3, armB: base.armB - b2 * 3, sword: base.sword + b2 * 2 });
  }

  // ---- walking with the sword in hand: the four classic key poses per step (contact · down · passing · up),
  // mirrored for the other leg, joined by a smooth Catmull-Rom curve so the motion never stops at a key.
  // legF/legB = thigh, kneeF/kneeB = shin fold. The body is lowest just after contact and highest while pushing off.
  const STEP = [   // first half of the cycle: the FRONT leg steps forward
    { legF: -27, kneeF: 3,  legB: 25, kneeB: 16, y: 1,  torso: 5 },     // contact: front heel lands, back toe still down
    { legF: -18, kneeF: 16, legB: 20, kneeB: 34, y: 8,  torso: 6 },     // down: weight drops onto the front leg
    { legF: 0,   kneeF: 6,  legB: -6, kneeB: 66, y: 2,  torso: 5 },     // passing: back leg swings through, knee high
    { legF: 15,  kneeF: 3,  legB: -22, kneeB: 32, y: -6, torso: 4 }     // up: pushing off, body at its highest
  ];
  const swap = k => ({ legF: k.legB, kneeF: k.kneeB, legB: k.legF, kneeB: k.kneeF, y: k.y, torso: k.torso });
  const WALK = [...STEP, ...STEP.map(swap)];
  const WALK_T = 0.92;                                  // seconds per full cycle (two steps)
  function cr(p0, p1, p2, p3, q) { const q2 = q * q, q3 = q2 * q; return 0.5 * (2 * p1 + (-p0 + p2) * q + (2 * p0 - 5 * p1 + 4 * p2 - p3) * q2 + (-p0 + 3 * p1 - 3 * p2 + p3) * q3); }
  function cyc(keys, u, ch) { const n = keys.length, f = ((u % 1) + 1) % 1 * n, i = Math.floor(f), q = f - i, g = j => keys[(i + j + n) % n][ch]; return cr(g(-1), g(0), g(1), g(2), q); }
  function walkPose(t) {
    const u = t / WALK_T, P = {}, lag = u - 0.06;      // arms, sword and head follow a moment later (follow-through)
    for (const ch of ['legF', 'kneeF', 'legB', 'kneeB', 'y', 'torso']) P[ch] = cyc(WALK, u, ch);
    const legFl = cyc(WALK, lag, 'legF'), legBl = cyc(WALK, lag, 'legB'), yl = cyc(WALK, u - 0.1, 'y');
    // arms swing against the legs on their side; the sword arm swings less and keeps the blade forward
    const armB = -legBl * 0.85 - 4, armF = -legFl * 0.35 - 14;
    return K(Object.assign(P, {
      armB, elbowB: -28 - Math.max(0, -armB) * 0.9,
      armF, elbowF: -46 - Math.max(0, -armF) * 0.6,
      sword: -52 + legFl * 0.25,
      head: -3 + (yl - 1) * 0.35,                       // the head nods with the bob, a little late
    }));
  }
  // stride: how far the body travels per second when walking, in rig units (so the planted foot doesn't slide)
  function walkSpeed(sk) { return sk.H ? sk.H * 0.62 : 0; }

  // ---- a bendable limb: horizontal strips from top to bottom; each strip turns with the bone it belongs to
  // (blending from the upper to the lower bone around the joint). M = matrix at the pivot (unrotated).
  // Returns { end: matrix at the fist/ankle, bottom: matrix at the bottom edge of the picture }.
  function limb(ctx, M, L, I, a1, a2) {
    const w = I.naturalWidth, h = I.naturalHeight, px = L.pivot[0], py = L.pivot[1], jy = L.joint, blend = 24, step = 4;
    const angAt = y => { const q = Math.min(1, Math.max(0, (y - (jy - blend)) / (2 * blend))); return a1 + a2 * q * q * (3 - 2 * q); };
    let m = M.rotate(a1), cur = a1, end = null;
    if (ctx && py > 0) { ctx.setTransform(m); ctx.drawImage(I, 0, 0, w, py + 1, -px, -py, w, py + 1); }
    for (let y = py; y < h; y += step) {
      const sh = Math.min(step, h - y), a = angAt(y + sh / 2), seg = m.rotate(a - cur); cur = a;
      if (ctx) { ctx.setTransform(seg); ctx.drawImage(I, 0, y, w, Math.min(sh + 3, h - y), -px, 0, w, Math.min(sh + 3, h - y)); }
      if (!end && y + sh >= L.end) end = seg.translate(0, L.end - y);
      m = seg.translate(0, sh);
    }
    return { end: end || m, bottom: m };
  }
  function build(sk, P, root) {
    const T = sk.torso;
    const torsoM = root.translate(P.x || 0, P.y || 0).rotate(P.torso).scale(T.s).translate(-T.pivot[0], -T.pivot[1]);
    // a joint on the torso, with the limb's own scale and the torso's lean taken back out (limbs keep world angles)
    const at = (pt, s, keep) => torsoM.translate(pt[0], pt[1]).rotate(keep ? 0 : -P.torso).scale(s / T.s);
    return { torsoM, at };
  }
  function draw(ctx, rigId, anim, t, x, gy, height, face, opts) {
    const sk = SKEL[RIGS[rigId] || rigId]; if (!sk) return false;
    const P = Object.assign(pose(anim, t), (opts && opts.pose) || {});
    const T = sk.torso, I = n => img(sk, n);
    if (![T.img, sk.head.img, sk.armF.img, sk.armB.img, sk.legF.img, sk.legB.img, sk.sword.img].every(n => ok(I(n)))) return false;
    if (!sk.H) sk.H = measure(sk);
    const k = height / sk.H;
    // put the lower sole on the ground: build once at the origin to find it
    const pr = build(sk, P, new DOMMatrix());
    const sole = n => limb(null, pr.at(T[n === 'legF' ? 'hipF' : 'hipB'], sk[n].s), sk[n], I(sk[n].img), P[n], P[n === 'legF' ? 'kneeF' : 'kneeB']).bottom.f;
    const low = Math.max(sole('legF'), sole('legB'));
    const base = ctx.getTransform(), B = build(sk, P, base.translate(x, gy).scale(k * (face || 1), k).translate(0, -low));
    const L = (n, pt, a1, a2) => limb(ctx, B.at(pt, sk[n].s, n[0] === 'a'), sk[n], I(sk[n].img), a1, a2);   // arms follow the torso, legs hang from the hips
    ctx.save();
    // back → front: back arm · back leg · front leg · torso · sword · front arm · head
    L('armB', T.shoulderB, P.armB, P.elbowB);
    L('legB', T.hipB, P.legB, P.kneeB);
    L('legF', T.hipF, P.legF, P.kneeF);
    ctx.setTransform(B.torsoM); ctx.drawImage(I(T.img), 0, 0);
    const hand = limb(null, B.at(T.shoulderF, sk.armF.s, true), sk.armF, I(sk.armF.img), P.armF, P.elbowF).end;
    if (!(opts && opts.noWeapon)) { const S = sk.sword; ctx.setTransform(hand.rotate(90 + P.sword).scale(S.s / sk.armF.s).translate(-S.pivot[0], -S.pivot[1])); ctx.drawImage(I(S.img), 0, 0); }
    L('armF', T.shoulderF, P.armF, P.elbowF);
    const H = sk.head, fimg = P.face && sk.faces[P.face] && ok(I(sk.faces[P.face])) ? sk.faces[P.face] : H.img;
    ctx.setTransform(B.at(T.neck, H.s, true).rotate(-P.torso * 0.6 + P.head).translate(-H.pivot[0], -H.pivot[1])); ctx.drawImage(I(fimg), 0, 0);
    // the collar goes back over the bottom of the neck, so the neck sits INSIDE the shirt instead of on top of it
    if (T.collar) { const [cy0, cy1] = T.collar, TI = I(T.img); ctx.setTransform(B.torsoM); ctx.drawImage(TI, 0, cy0, TI.naturalWidth, cy1 - cy0, 0, cy0, TI.naturalWidth, cy1 - cy0); }
    ctx.restore();
    return true;
  }
  // standing height (top of the hair → soles) in rig units, from the rest pose
  function measure(sk) {
    const T = sk.torso, B = build(sk, BASE, new DOMMatrix());
    const head = B.at(T.neck, sk.head.s, true).rotate(-BASE.torso * 0.6 + BASE.head).translate(-sk.head.pivot[0], -sk.head.pivot[1]);
    const top = head.transformPoint(new DOMPoint(sk.head.pivot[0], 0)).y;
    const L = sk.legF, foot = B.at(T.hipF, L.s).rotate(BASE.legF).transformPoint(new DOMPoint(0, (img(sk, L.img).naturalHeight || 360) - L.pivot[1])).y;
    return foot - top;
  }
  // where both soles are (rig units, origin = hips on the ground line) — used to match walking speed to the steps
  function feet(rigId, anim, t) {
    const sk = SKEL[RIGS[rigId] || rigId], P = pose(anim, t), T = sk.torso, I = n => img(sk, n), pr = build(sk, P, new DOMMatrix());
    const f = n => { const b = limb(null, pr.at(T[n === 'legF' ? 'hipF' : 'hipB'], sk[n].s), sk[n], I(sk[n].img), P[n], P[n === 'legF' ? 'kneeF' : 'kneeB']).bottom; return { x: b.e, y: b.f }; };
    return { F: f('legF'), B: f('legB'), H: sk.H || (sk.H = measure(sk)) };
  }
  const ready = rigId => { const sk = SKEL[RIGS[rigId] || rigId]; if (!sk) return false; return [sk.torso.img, sk.head.img, sk.armF.img, sk.armB.img, sk.legF.img, sk.legB.img, sk.sword.img, ...Object.values(sk.faces)].map(n => ok(img(sk, n))).every(Boolean); };
  root.Rig = { draw, pose, ready, SKEL, RIGS, LEN, WALK_T, walkSpeed, feet };
})(typeof window !== 'undefined' ? window : globalThis);
