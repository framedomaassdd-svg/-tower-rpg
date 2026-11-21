/* v147 Rig2 — cutout skeleton for characters drawn as separate rounded pieces (upper/lower arm, thigh/shin),
   the way Spine artists prepare art: every joint is a rounded overlap, the pieces turn around their joints.
   Rest pose measured by laying the pieces over the character's own full-body drawing (rig5/layout.json).
   Rig2.draw(ctx, id, anim, t, x, groundY, height, face, opts) — feet on the ground at x; height = standing height. */
(function (root) {
  'use strict';
  // bone: img, pivot (joint in the picture, px), at (where it hangs, in the parent's picture px), s (scale vs the sheet)
  const SKEL = {
    kid: {
      dir: 'rig/kid/', ver: 147,
      bones: {
        torso:  { img: 'torso', pivot: [125, 300], s: 1 },
        hips:   { img: 'hips', parent: 'torso', at: [120, 250], pivot: [73.2, 18], s: 0.933 },
        head:   { img: 'head', parent: 'torso', at: [146, 50], pivot: [100, 236], s: 1.06 },
        hair:   { img: 'hair', parent: 'head', at: [-36, -43], pivot: [0, 0], s: 0.88 },
        thighF: { img: 'thighF', parent: 'hips', at: [99, 168], pivot: [48, 25], s: 0.8 },
        shinF:  { img: 'shinF', parent: 'thighF', at: [37, 247], pivot: [60, 22], s: 0.8 },
        thighN: { img: 'thighN', parent: 'hips', at: [72.9, 181.8], pivot: [50, 25], s: 0.8 },
        shinN:  { img: 'shinN', parent: 'thighN', at: [40, 245], pivot: [54, 22], s: 0.8 },
        uarmF:  { img: 'uarmF', parent: 'torso', at: [158, 74], pivot: [38, 28], s: 1 },
        farmF:  { img: 'farmF', parent: 'uarmF', at: [38, 178], pivot: [35, 28], s: 1 },
        uarmN:  { img: 'uarmN', parent: 'torso', at: [38, 72], pivot: [38, 28], s: 1 },
        farmN:  { img: 'farmN', parent: 'uarmN', at: [38, 178], pivot: [30, 28], s: 1 },
        sword:  { img: 'sword', parent: 'farmN', at: [42, 214], pivot: [88, 60], s: 0.95 }
      },
      // back → front
      order: ['farmF', 'uarmF', 'shinF', 'thighF', 'hips', 'shinN', 'thighN', 'torso', 'head', 'hair', 'sword', 'farmN', 'uarmN'],
      faces: { hurt: 'headHurt', shout: 'headShout', happy: 'headHappy' }
    }
  };
  const imgs = {};
  const ok = i => i && i.complete && i.naturalWidth > 0;
  const img = (sk, n) => { const k = sk.dir + n; if (!imgs[k]) { const i = new Image(); i.src = sk.dir + n + '.webp?v=' + sk.ver; imgs[k] = i; } return imgs[k]; };

  // ---- walking: four key poses per step (contact · down · passing · up), mirrored for the other leg,
  // joined by a Catmull-Rom curve. thigh + = swings forward (right), knee + = folds back.
  const STEP = [
    { thighN: 24, kneeN: 4,  thighF: -20, kneeF: 18, y: 0,  torso: 2 },    // contact: front heel down
    { thighN: 16, kneeN: 16, thighF: -16, kneeF: 30, y: 7,  torso: 3 },    // down: weight onto the front leg
    { thighN: 0,  kneeN: 6,  thighF: 6,   kneeF: 58, y: 2,  torso: 2 },    // passing: back leg swings through, knee up
    { thighN: -14, kneeN: 4, thighF: 20,  kneeF: 26, y: -5, torso: 1 }     // up: pushing off
  ];
  const swap = k => ({ thighN: k.thighF, kneeN: k.kneeF, thighF: k.thighN, kneeF: k.kneeN, y: k.y, torso: k.torso });
  const WALK = [...STEP, ...STEP.map(swap)], WALK_T = 1.0;
  const cr = (p0, p1, p2, p3, q) => 0.5 * (2 * p1 + (-p0 + p2) * q + (2 * p0 - 5 * p1 + 4 * p2 - p3) * q * q + (-p0 + 3 * p1 - 3 * p2 + p3) * q * q * q);
  const cyc = (u, ch) => { const n = WALK.length, f = ((u % 1) + 1) % 1 * n, i = Math.floor(f), q = f - i, g = j => WALK[(i + j + n) % n][ch]; return cr(g(-1), g(0), g(1), g(2), q); };
  function pose(anim, t) {
    if (anim === 'walk') {
      const u = t / WALK_T, P = {}, lag = u - 0.05;
      for (const ch of ['thighN', 'kneeN', 'thighF', 'kneeF', 'y', 'torso']) P[ch] = cyc(u, ch);
      P.shinN = P.kneeN; P.shinF = P.kneeF;
      // arms swing AGAINST the legs on their side, a moment late; the sword arm swings less
      const tN = cyc(lag, 'thighN'), tF = cyc(lag, 'thighF');
      P.uarmN = tN * 0.45 - 6; P.farmN = -28 - Math.max(0, -P.uarmN) * 0.4;
      P.uarmF = tF * 0.8; P.farmF = -12 - Math.max(0, -P.uarmF) * 0.6;
      P.sword = 30 + tN * 0.2;
      P.head = -P.torso * 0.6 + (cyc(u - 0.1, 'y') - 1) * 0.3;
      P.hair = (cyc(u - 0.15, 'y') - 1) * 0.5;
      P.hips = -P.torso * 0.5;
      return P;
    }
    const b = Math.sin(t * 2.4), b2 = Math.sin(t * 2.4 - 0.8);   // standing: breathing
    return { y: b * 2, torso: b * 0.8, head: -b2 * 1.5, hair: -b2 * 1.2, uarmN: -6 + b2 * 2, farmN: -28, uarmF: b2 * 1.5, farmF: -12, sword: 30, thighN: 3, thighF: -3 };
  }
  // a pose's matrices (rest = all angles 0; + angle turns the part clockwise on screen)
  function solve(sk, P, root) {
    const M = {}, B = sk.bones;
    const m = n => {
      if (M[n]) return M[n];
      const b = B[n]; let base; const a = (n === 'thighN' || n === 'thighF') ? -(P[n] || 0) : (P[n] || 0);   // thighs: + = forward
      if (!b.parent) base = root.translate(0, P.y || 0).rotate(a).scale(b.s);
      else { const pb = B[b.parent]; base = m(b.parent).translate(b.at[0], b.at[1]).rotate(a).scale(b.s / pb.s); }
      // m(n) maps the bone's picture with its pivot at the origin of the parent's attachment point
      return (M[n] = base.translate(-b.pivot[0], -b.pivot[1]));
    };
    Object.keys(B).forEach(m);
    return M;
  }
  // a standing pose's height (hair top → soles) and the soles of a pose, for scaling and grounding
  function soles(sk, M) {
    let low = -1e9;
    for (const n of ['shinN', 'shinF']) { const I = img(sk, sk.bones[n].img); const p = M[n].transformPoint(new DOMPoint(I.naturalWidth * 0.5, I.naturalHeight)); low = Math.max(low, p.y); }
    return low;
  }
  function draw(ctx, id, anim, t, x, gy, height, face, opts) {
    const sk = SKEL[id]; if (!sk || !ready(id)) return false;
    if (!sk.H) { const M0 = solve(sk, {}, new DOMMatrix()), hair = img(sk, 'hair'); sk.H = soles(sk, M0) - M0.hair.transformPoint(new DOMPoint(hair.naturalWidth * 0.5, 0)).y; }
    const P = Object.assign(pose(anim, t), (opts && opts.pose) || {});
    const k = height / sk.H, base = ctx.getTransform();
    const low = soles(sk, solve(sk, P, new DOMMatrix()));
    const M = solve(sk, P, base.translate(x, gy).scale(k * (face || 1), k).translate(0, -low));
    ctx.save();
    for (const n of sk.order) {
      if (n === 'sword' && opts && opts.noWeapon) continue;
      let name = sk.bones[n].img;
      if (n === 'head' && P.face && sk.faces[P.face]) name = sk.faces[P.face];
      if (n === 'hair' && P.face && sk.faces[P.face]) continue;            // the expression heads include their hair
      ctx.setTransform(M[n]); ctx.drawImage(img(sk, name), 0, 0);
    }
    ctx.restore();
    return true;
  }
  function ready(id) { const sk = SKEL[id]; return !!sk && Object.values(sk.bones).every(b => ok(img(sk, b.img))); }
  root.Rig2 = { draw, ready, pose, SKEL, WALK_T };
})(typeof window !== 'undefined' ? window : globalThis);
