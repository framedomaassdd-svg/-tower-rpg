/* v142 Rig — skeletal (cutout) animation for characters drawn as separate parts.
   One set of parts + a skeleton gives every pose smoothly at any speed: the joints turn between key poses with
   easing, so nothing jumps like a 4-frame sheet. Principles used in the clips the player liked: anticipation
   (wind up first), fast strikes, a short hold, slow recovery, follow-through (head/arms trail the body),
   weight on every step (down on contact, up on passing) and breathing when standing.
   Rig.draw(ctx, rigId, anim, t, x, groundY, height, face, opts) — feet on (x, groundY), `height` = standing height in px. */
(function (root) {
  'use strict';
  const D = Math.PI / 180;
  // ---- skeleton of the GPT parts sheet (hero_craft_m). Coordinates are pixels inside each part image. ----
  //  pivot: the point of the part that sits on its joint · at: where it hangs on its parent (parent's pixels)
  const SKELETONS = {
    hero: {
      height: 765,                      // standing height in rig units (used to scale to the requested height)
      legs: 0.78, arms: 0.95,           // limb scale (the sheet's legs are long for a chibi)
      bones: {
        hips:   { img: 'hips',   pivot: [111, 26] },
        torso:  { img: 'torso',  parent: 'hips',  at: [113, 30],  pivot: [92, 212] },
        head:   { img: 'head',   parent: 'torso', at: [96, 22],   pivot: [142, 236], s: 0.92 },
        uarmF:  { img: 'uarmF',  parent: 'torso', at: [40, 92],   pivot: [40, 22], limb: 'arms' },
        farmF:  { img: 'farmF',  parent: 'uarmF', at: [25, 148],  pivot: [27, 20], limb: 'arms' },
        uarmN:  { img: 'uarmN',  parent: 'torso', at: [118, 96],  pivot: [45, 22], limb: 'arms' },
        farmN:  { img: 'farmN',  parent: 'uarmN', at: [25, 148],  pivot: [27, 20], limb: 'arms' },
        sword:  { img: 'sword',  parent: 'farmN', at: [160, 98],  pivot: [64, 58] },
        thighF: { img: 'thighF', parent: 'hips',  at: [150, 120], pivot: [54, 30], limb: 'legs' },
        shinF:  { img: 'shinF',  parent: 'thighF', at: [44, 200], pivot: [56, 24], limb: 'legs' },
        thighN: { img: 'thighN', parent: 'hips',  at: [92, 122],  pivot: [56, 30], limb: 'legs' },
        shinN:  { img: 'shinN',  parent: 'thighN', at: [42, 200], pivot: [56, 24], limb: 'legs' }
      },
      order: ['uarmF', 'farmF', 'thighF', 'shinF', 'thighN', 'shinN', 'hips', 'torso', 'head', 'sword', 'uarmN', 'farmN'],
      // height of the hips above the feet when standing straight (rig units, before scaling)
      hipH: 0
    }
  };
  const RIGS = { hero_craft_m: { skel: 'hero', dir: 'rig/hero_craft_m/' } };
  const imgs = {};
  function img(rig, name) {
    const k = rig.dir + name; if (!imgs[k]) { const i = new Image(); i.src = rig.dir + name + '.webp?v=142c'; imgs[k] = i; }
    return imgs[k];
  }
  const ok = i => i && i.complete && i.naturalWidth > 0;

  // ---- key poses (degrees; + turns clockwise on screen, i.e. forward/down for a right-facing character) ----
  const P = {
    stand:  { torso: 0, head: 0, uarmN: 10, farmN: 22, uarmF: -6, farmF: 30, thighN: 0, shinN: 0, thighF: 0, shinF: 0, sword: 38, y: 0, x: 0 },
  };
  const mix = (a, b, q) => { const o = {}; for (const k in a) o[k] = (a[k] || 0) + ((b[k] === undefined ? a[k] : b[k]) - (a[k] || 0)) * q; for (const k in b) if (!(k in o)) o[k] = b[k] * q; return o; };
  const ease = q => q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
  const easeOut = q => 1 - Math.pow(1 - q, 3), easeIn = q => q * q * q;
  // keyframes: [time, pose, easing into this key]
  function track(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
      const [t0, p0] = keys[i - 1], [t1, p1, e] = keys[i], q = (t - t0) / (t1 - t0);
      return mix(p0, p1, (e || ease)(q));
    }
    return keys[keys.length - 1][1];
  }
  const S = P.stand, add = o => Object.assign({}, S, o);
  // sword attack: anticipation → strike → hold → recover (1.0 s)
  const ATTACK = [
    [0, add({})],
    [0.22, add({ torso: -12, head: -6, uarmN: 160, farmN: -30, sword: -40, uarmF: 30, farmF: 40, thighN: -14, shinN: 8, thighF: 14, shinF: 6, x: -14, y: 6, face: 'shout' }), ease],   // wind up, lean back
    [0.3, add({ torso: 18, head: 8, uarmN: -78, farmN: 8, sword: 16, uarmF: -30, farmF: 60, thighN: -40, shinN: 20, thighF: 26, shinF: 14, x: 36, y: 10, face: 'shout' }), easeIn],    // strike (fast)
    [0.46, add({ torso: 16, head: 6, uarmN: -84, farmN: 10, sword: 20, uarmF: -32, farmF: 62, thighN: -40, shinN: 22, thighF: 26, shinF: 14, x: 38, y: 12, face: 'shout' })],        // hold
    [1.0, add({}), easeOut]                                                                                                                                                  // recover
  ];
  const HIT = [
    [0, add({})],
    [0.08, add({ torso: -16, head: -18, uarmN: 40, farmN: 70, sword: 60, uarmF: 50, farmF: 70, thighN: 10, thighF: -12, shinF: 10, x: -22, y: 4, face: 'hurt' }), easeOut],
    [0.3, add({ torso: -12, head: -12, uarmN: 30, farmN: 60, uarmF: 40, farmF: 60, thighN: 8, thighF: -10, shinF: 8, x: -26, y: 2, face: 'hurt' })],
    [0.7, add({}), ease]
  ];
  // the pose for an animation at time t (seconds)
  function pose(anim, t) {
    if (anim === 'walk' || anim === 'run') {
      const run = anim === 'run', T = run ? 0.56 : 0.86, ph = (t % T) / T * Math.PI * 2, s = Math.sin(ph), c = Math.cos(ph);
      const sw = run ? 34 : 24;
      return Object.assign({}, S, {
        thighN: sw * s, thighF: -sw * s,
        shinN: Math.max(0, -c) * (run ? 55 : 34) + 4, shinF: Math.max(0, c) * (run ? 55 : 34) + 4,       // the back leg folds as it swings forward
        uarmN: -sw * 0.9 * s + 6, farmN: 15 - 25 * Math.max(0, -s), uarmF: sw * 0.9 * s - 6, farmF: 25 - 25 * Math.max(0, s),
        torso: (run ? 10 : 4) + 1.5 * Math.cos(ph * 2), head: -(run ? 6 : 2) - 1.5 * Math.cos(ph * 2 + 0.6),       // head trails the body
        y: -Math.abs(Math.cos(ph)) * (run ? 16 : 10) + (run ? 6 : 4),                                             // down on contact, up when passing
        sword: 38 + 6 * s
      });
    }
    if (anim === 'attack') return track(ATTACK, Math.min(t, 1.0));
    if (anim === 'hit') return track(HIT, Math.min(t, 0.7));
    // idle: breathing, a slow sway, arms hanging with a little drift
    const b = Math.sin(t * 2.4), b2 = Math.sin(t * 2.4 - 0.7);
    return Object.assign({}, S, { y: b * 3, torso: b * 1.4, head: -b2 * 2.2, uarmN: 10 + b2 * 3, farmN: 22 + b2 * 4, uarmF: -6 - b2 * 3, farmF: 30 - b2 * 3, sword: 38 + b2 * 3 });
  }

  // world transform of every bone for one pose
  function solve(sk, ps, k) {
    const M = {};
    const mat = name => {
      if (M[name]) return M[name];
      const B = sk.bones[name], s = (B.s || 1) * (B.limb ? sk[B.limb] : 1);
      let m = B.parent ? mat(B.parent).translate(B.at[0], B.at[1]) : new DOMMatrix();
      m = m.rotate((ps[name] || 0)).scale(s, s).translate(-B.pivot[0], -B.pivot[1]);
      return (M[name] = m);
    };
    Object.keys(sk.bones).forEach(mat);
    return M;
  }
  function draw(ctx, rigId, anim, t, x, gy, height, face, opts) {
    const rig = RIGS[rigId], sk = SKELETONS[rig.skel]; if (!rig) return false;
    const ps = Object.assign(pose(anim, t), (opts && opts.pose) || {});
    // where the feet are with this pose: measure the lowest boot sole and stand on it
    const base = new DOMMatrix(), Mz = solve(sk, ps, 1);
    const foot = n => { const B = sk.bones[n], I = img(rig, B.img); return ok(I) ? Mz[n].transformPoint(new DOMPoint(B.pivot[0], I.naturalHeight)).y : 0; };
    const feetY = Math.max(foot('shinN'), foot('shinF')) || 600;
    const k = height / sk.height;
    const prev = ctx.getTransform();
    ctx.save();
    const m0 = prev.translate(x, gy).scale(k * (face || 1), k).translate(ps.x || 0, -feetY + (ps.y || 0) - (ps.y < 0 ? 0 : 0));
    for (const n of sk.order) {
      const B = sk.bones[n]; let name = B.img;
      if (n === 'head' && ps.face === 'hurt') name = 'headHurt'; else if (n === 'head' && ps.face === 'shout') name = 'headShout';
      const I = img(rig, name); if (!ok(I)) continue;
      ctx.setTransform(m0.multiply(Mz[n]));
      ctx.drawImage(I, 0, 0);
    }
    ctx.restore();
    return true;
  }
  const ready = rigId => { const rig = RIGS[rigId]; if (!rig) return false; const sk = SKELETONS[rig.skel]; ['headHurt', 'headShout'].forEach(n => img(rig, n)); return Object.values(sk.bones).every(B => ok(img(rig, B.img))); };
  root.Rig = { draw, pose, ready, RIGS, SKELETONS };
})(typeof window !== 'undefined' ? window : globalThis);
