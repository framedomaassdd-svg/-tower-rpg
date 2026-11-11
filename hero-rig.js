/* Hero cutout rig (preview, v67): front / side / back views built from painted part sheets.
   HeroRig.draw(ctx, {view:'front'|'side'|'back', anim, t, height, headScale, face}) draws feet at (0,0). */
(function (root) {
  'use strict';
  const D = Math.PI / 180;
  // ---- rig specs: coordinates are in each view's reference-figure pixels, origin at the ground under the body centre
  // part: [image, pivotX, pivotY, atX, atY, scale, z, bone]
  const SPEC = {
    front: {
      bones: {
        pelvis: [null, 0, -322], chest: ['pelvis', 0, -322], neck: ['chest', 0, -655], hair: ['neck', 0, -900],
        shL: ['chest', -118, -605], elL: ['shL', -118, -505], shR: ['chest', 116, -605], elR: ['shR', 116, -505],
        hipL: ['pelvis', -68, -340], knL: ['hipL', -68, -200], anL: ['knL', -68, -124],
        hipR: ['pelvis', 68, -340], knR: ['hipR', 68, -200], anR: ['knR', 68, -124]
      },
      parts: [
        ['front_1', 155, 0, -12, -984, 1.0, 0, 'hair'],
        ['front_17', 52, 20, -68, -200, .85, 1, 'knL'], ['front_18', 52, 20, 68, -200, .85, 1, 'knR'],
        ['front_15', 71, 25, -68, -340, .85, 2, 'hipL'], ['front_16', 71, 25, 68, -340, .85, 2, 'hipR'],
        ['front_19', 60, 15, -68, -124, .93, 3, 'anL'], ['front_20', 60, 15, 68, -124, .93, 3, 'anR'],
        ['front_6', 105, 0, 0, -667, 1.1, 4, 'chest'],
        ['front_11', 115, 5, 0, -500, 1.0, 5, 'chest'],
        ['front_9', 45, 25, -118, -605, .9, 3.6, 'shL'], ['front_10', 45, 25, 116, -605, .9, 3.6, 'shR'],
        ['front_14', 45, 20, -118, -505, .9, 7, 'elL'], ['front_13', 45, 20, 116, -505, .9, 7, 'elR'],
        ['front_7', 115, 5, -6, -689, 1.1, 8, 'chest'],
        ['front_5', 26, 35, -106, -750, 1.0, 9, 'neck'], ['front_4', 26, 35, 105, -750, 1.0, 9, 'neck'],
        ['front_3', 100, 225, 0, -672, 1.1, 10, 'neck'],
        ['@eyeL', 0, 0, -50, -767, .45, 11, 'neck'], ['@eyeR', 0, 0, 50, -767, .45, 11, 'neck'],
        ['@browL', 0, 0, -47, -808, .42, 11, 'neck'], ['@browR', 0, 0, 47, -808, .42, 11, 'neck'],
        ['@mouth', 0, 0, 0, -716, .45, 11, 'neck'],
        ['front_2', 160, 0, -12, -984, 1.0, 12, 'hair']
      ]
    },
    back: {
      bones: {
        pelvis: [null, 0, -322], chest: ['pelvis', 0, -322], neck: ['chest', 0, -655], hair: ['neck', 0, -900],
        shL: ['chest', -118, -605], elL: ['shL', -118, -505], shR: ['chest', 116, -605], elR: ['shR', 116, -505],
        hipL: ['pelvis', -68, -340], knL: ['hipL', -68, -200], anL: ['knL', -68, -124],
        hipR: ['pelvis', 68, -340], knR: ['hipR', 68, -200], anR: ['knR', 68, -124]
      },
      parts: [
        ['back_1', 172, 0, 0, -980, 1.0, 0, 'hair'],
        ['back_18', 56, 20, -68, -200, .85, 1, 'knL'], ['back_19', 56, 20, 68, -200, .85, 1, 'knR'],
        ['back_16', 78, 25, -68, -340, .85, 2, 'hipL'], ['back_17', 78, 25, 68, -340, .85, 2, 'hipR'],
        ['back_20', 66, 15, -68, -124, .93, 3, 'anL'], ['back_21', 66, 15, 68, -124, .93, 3, 'anR'],
        ['back_7', 111, 0, 0, -667, 1.08, 4, 'chest'],
        ['back_10', 45, 25, -118, -605, .9, 3.6, 'shL'], ['back_11', 45, 25, 116, -605, .9, 3.6, 'shR'],
        ['back_14', 44, 20, -118, -505, .9, 7, 'elL'], ['back_15', 44, 20, 116, -505, .9, 7, 'elR'],
        ['back_8', 113, 5, 0, -689, 1.05, 8, 'chest'],
        ['back_4', 27, 36, -108, -752, 1.0, 9, 'neck'], ['back_5', 27, 36, 108, -752, 1.0, 9, 'neck'],
        ['back_3', 108, 225, 0, -672, 1.05, 10, 'neck'],
        ['back_2', 157, 0, 0, -990, 1.0, 12, 'hair']
      ]
    },
    side: {
      bones: {
        pelvis: [null, -10, -300], chest: ['pelvis', -10, -300], neck: ['chest', -2, -651], hair: ['neck', -20, -900],
        sh: ['chest', -16, -589], el: ['sh', -27, -463], shF: ['chest', -6, -592], elF: ['shF', -17, -466],
        hip: ['pelvis', -12, -300], kn: ['hip', -15, -162], an: ['kn', -15, -99],
        hipF: ['pelvis', 2, -302], knF: ['hipF', -1, -164], anF: ['knF', -1, -101]
      },
      parts: [
        ['side_7', 70, 35, -6, -592, .7, 0, 'shF', 1], ['side_8', 55, 40, -17, -466, .7, 0.5, 'elF', 1],
        ['side_0', 0, 0, -195, -958, 1.0, 1, 'hair'],
        ['side_12', 65, 35, -1, -164, .6, 2, 'knF', 1], ['side_11', 90, 40, 2, -302, .6, 2.5, 'hipF', 1], ['side_13', 60, 20, -1, -101, .62, 3, 'anF', 1],
        ['side_12', 65, 35, -15, -162, .6, 4, 'kn'], ['side_11', 90, 40, -12, -300, .6, 4.5, 'hip'], ['side_13', 60, 20, -15, -99, .62, 5, 'an'],
        ['side_5', 75, 100, -16, -589, 1.0, 6, 'chest'],
        ['side_10', 107, 12, -5, -430, .85, 7, 'chest'],
        ['side_9', 50, 20, 0, -668, .8, 7.5, 'neck'],
        ['side_6', 150, 30, -10, -650, .85, 8, 'chest'],
        ['side_4', 29, 42, -33, -734, 1.0, 9.5, 'neck'],
        ['side_3', 125, 262, -2, -651, .94, 9, 'neck'],
        ['side_1', 0, 0, -189, -956, 1.0, 10, 'hair'],
        ['side_7', 70, 35, -16, -589, .7, 11, 'sh'], ['side_8', 55, 40, -27, -463, .7, 12, 'el']
      ]
    }
  };
  // ---- poses: degrees; positive rotation = clockwise on screen. Side view faces right.
  const sin = Math.sin, cos = Math.cos, pos = v => Math.max(0, v), TAU = Math.PI * 2;
  function sidePose(anim, t) {
    const P = {};
    if (anim === 'walk' || anim === 'run') {
      const run = anim === 'run', p = t * TAU * (run ? 1.45 : 0.95), A = run ? 40 : 24, Kn = run ? 80 : 45;
      P.hip = { r: -A * sin(p) }; P.hipF = { r: A * sin(p) };
      P.kn = { r: Kn * pos(sin(p + 1.5)) + 4 }; P.knF = { r: Kn * pos(sin(p + Math.PI + 1.5)) + 4 };
      P.an = { r: -0.45 * (P.hip.r + P.kn.r) }; P.anF = { r: -0.45 * (P.hipF.r + P.knF.r) };
      const S2 = run ? 45 : 22;
      P.sh = { r: -S2 * sin(p + Math.PI) }; P.shF = { r: S2 * sin(p + Math.PI) };
      P.el = { r: run ? -75 : -12 - 10 * pos(sin(p)) }; P.elF = { r: run ? -75 : -12 - 10 * pos(-sin(p)) };
      P.chest = { r: run ? 9 : 3 }; P.neck = { r: run ? -5 : -1 };
      P.dy = -(run ? 14 : 6) * Math.abs(cos(p)); P.hair = { y: (run ? 7 : 4) * sin(2 * p - 0.8) };
    } else if (anim === 'hammer') {
      const c = (t * 0.9) % 1;
      const raise = c < 0.55 ? sin(c / 0.55 * Math.PI / 2) : c < 0.66 ? 1 - (c - 0.55) / 0.11 : 0;
      P.sh = { r: -25 - 135 * raise }; P.el = { r: -55 + 15 * raise };
      P.shF = { r: -35 }; P.elF = { r: -50 };
      P.chest = { r: c < 0.55 ? -3 * raise : 6 }; P.neck = { r: 4 };
      P.hip = { r: -12 }; P.kn = { r: 10 }; P.an = { r: 1 }; P.hipF = { r: 10 }; P.knF = { r: 8 }; P.anF = { r: -9 };
      P.dy = c > 0.55 && c < 0.75 ? 4 : 0; P.hair = { y: c > 0.55 && c < 0.7 ? 5 : 0 };
      P.prop = 'hammer';
    } else {
      const b = sin(t * 1.8);
      P.chest = { sy: 1 + 0.012 * b }; P.sh = { r: 2 * b }; P.shF = { r: -2 * b }; P.el = { r: -6 }; P.elF = { r: -6 };
      P.hair = { y: 1.5 * b }; P.neck = { r: 0.8 * b };
    }
    return P;
  }
  function facePose(anim, t, back) {
    const P = {};
    if (anim === 'walk' || anim === 'run') {
      const run = anim === 'run', p = t * TAU * (run ? 1.45 : 0.95), L = pos(sin(p)), Rr = pos(-sin(p)), up = run ? 30 : 18;
      P.anL = { y: -up * L }; P.knL = { y: -up * 0.55 * L }; P.hipL = { sy: 1 - 0.07 * L };
      P.anR = { y: -up * Rr }; P.knR = { y: -up * 0.55 * Rr }; P.hipR = { sy: 1 - 0.07 * Rr };
      const sw = run ? 12 : 6;
      P.shL = { r: sw * sin(p) }; P.shR = { r: sw * sin(p) }; P.elL = { r: run ? 20 : 0 }; P.elR = { r: run ? -20 : 0 };
      P.pelvis = { r: 1.5 * sin(p) }; P.chest = { r: -1 * sin(p) }; P.neck = { r: -1.2 * sin(p) };
      P.dy = -(run ? 12 : 6) * Math.abs(sin(p)); P.hair = { y: (run ? 7 : 4) * sin(2 * p - 0.8) };
    } else {
      const b = sin(t * 1.8);
      P.chest = { sy: 1 + 0.012 * b }; P.shL = { r: 1.5 * b }; P.shR = { r: -1.5 * b }; P.hair = { y: 1.5 * b }; P.neck = { r: 0.6 * b };
    }
    return P;
  }
  const FEAT = {
    open: { eye: 'open', brow: 'open', mouth: 'mouthB_open' },
    blink: { eye: 'closed', brow: 'open', mouth: 'mouthB_open' }
  };

  let img = null, base = '';
  const ok = im => im && im.complete && im.naturalWidth > 0;
  function need(name) {
    if (!img) img = {};
    if (!img[name]) { const im = new Image(); im.src = base + name + '.webp?v=67'; img[name] = im; }
    return img[name];
  }
  const darks = {};
  function darkCopy(name) {
    if (darks[name] !== undefined) return darks[name];
    const im = img[name]; let c = null;
    try { c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = '#9d939a';
      x.fillRect(0, 0, c.width, c.height); x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0); } catch (e) { c = null; }
    return (darks[name] = c);
  }
  function load(prefix) {
    base = prefix || ''; need('../smith_hammer');
    for (const v in SPEC) for (const p of SPEC[v].parts) if (p[0][0] !== '@') need(p[0]);
    for (const f in FEAT) { const e = FEAT[f]; ['eyeL_' + e.eye, 'eyeR_' + e.eye, 'browL_' + e.brow, 'browR_' + e.brow, e.mouth].forEach(n => need('feat_' + n)); }
  }

  // ---- matrices [a,b,c,d,e,f]
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const T = (x, y) => [1, 0, 0, 1, x, y], R = a => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0], S = (x, y) => [x, 0, 0, y === undefined ? x : y, 0, 0];

  function solve(spec, pose) {
    const W = {};
    const get = name => {
      if (W[name]) return W[name];
      const [parent, jx, jy] = spec.bones[name], q = pose[name] || {};
      let m = parent ? get(parent) : T(pose.dx || 0, pose.dy || 0);
      m = mul(m, T(jx + (q.x || 0), jy + (q.y || 0)));
      if (q.r) m = mul(m, R(q.r * D));
      if (q.sx || q.sy) m = mul(m, S(q.sx || 1, q.sy || 1));
      m = mul(m, T(-jx, -jy));
      return (W[name] = m);
    };
    for (const b in spec.bones) get(b);
    return W;
  }

  function drawHammer(ctx, m) {
    const im = need('../smith_hammer'); if (!ok(im)) return;
    const w = 230, h = w * im.naturalHeight / im.naturalWidth;
    ctx.save(); ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.translate(-24, -318); ctx.rotate(-125 * D);           // fist of the near forearm; head points forward of the fist
    ctx.drawImage(im, -w * 0.88, -h / 2, w, h); ctx.restore();
  }
  function draw(ctx, o) {
    const spec = SPEC[o.view || 'front']; if (!spec) return false;
    const view = o.view || 'front', t = o.t || 0;
    const pose = o.pose || (view === 'side' ? sidePose(o.anim, t) : facePose(o.anim, t, view === 'back'));
    if (o.headScale && o.headScale !== 1) pose.neck = Object.assign({}, pose.neck, { sx: o.headScale, sy: o.headScale });
    const W = solve(spec, pose), k = (o.height || 990) / 990;
    const blink = o.blink !== false && (t % 3.3) > 3.17;
    const face = FEAT[o.face || (blink ? 'blink' : 'open')] || FEAT.open;
    const list = spec.parts.slice().sort((a, b) => a[6] - b[6]);
    ctx.save(); ctx.scale(k, k);
    for (const p of list) {
      let [name, px, py, ax, ay, s, , bone] = p, im;
      if (name[0] === '@') {
        const slot = name.slice(1);
        const key = slot === 'mouth' ? 'feat_' + face.mouth : 'feat_' + slot + '_' + (slot.startsWith('eye') ? face.eye : face.brow);
        im = need(key); if (!ok(im)) continue; px = im.naturalWidth / 2; py = im.naturalHeight / 2;
      } else { im = need(name); if (!ok(im)) continue; if (p[8]) im = darkCopy(name) || im; }
      const m = mul(mul(mul(W[bone], T(ax, ay)), S(s)), T(-px, -py));
      ctx.save(); ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]); ctx.drawImage(im, 0, 0); ctx.restore();
      if (pose.prop === 'hammer' && bone === 'el') drawHammer(ctx, W.el);
    }
    ctx.restore();
    return true;
  }
  root.HeroRig = { SPEC, FEAT, load, draw, sidePose, facePose, _need: need };
})(typeof globalThis !== 'undefined' ? globalThis : this);
