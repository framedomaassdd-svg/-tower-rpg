/* v63 scene pieces: continuous sidewalk + curb ends at the city gate, plaza steps, side-view alley,
   night sky, long parallax panorama, road decals and patrolling guards.
   Every draw is skipped until its image has loaded, so v62 art keeps working as a fallback. */
(function (root) {
  'use strict';
  const V = '?v=63';
  const load = src => { const i = new Image(); i.src = src + V; return i; };
  const img = {
    curb: load('curb_straight_v63.webp'), endL: load('curb_end_left_v63.webp'), endR: load('curb_end_right_v63.webp'),
    steps: load('plaza_steps_v63.webp'), alley: load('alley_side_v63.webp'), night: load('sky_night_v63.webp'),
    pano: load('distant_panorama_v63.webp'), decals: load('road_decals_v63.webp'), guard: load('townsfolk_guard_v63.webp')
  };
  const ok = i => i.complete && i.naturalWidth > 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // world layout (world px; the street is 7500 wide, sidewalk y 736–800)
  const CURB_Y = 736, CURB_W = 512, CURB_H = 64, END_W = 128;
  const GATE = [6380, 6580];                 // opening of the city gate lane
  const PLAZA = { x: 1980, w: 900, y: 806 };  // steps' bottom edge sits on the road
  const ALLEY = { x: 1270, w: 262, foot: 744 };
  const PANO_H = 640, PANO_PARALLAX = 0.3;
  const DECAL_SRC = { crack: [790, 86, 187, 109], leaves: [21, 318, 213, 131], straw: [277, 324, 213, 119], moss: [789, 337, 193, 114] };
  const DECALS = (() => {                    // fixed scatter so the street looks the same every visit
    const kinds = ['crack', 'leaves', 'moss', 'straw', 'crack', 'moss', 'leaves'];
    const out = []; let s = 9;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let x = 140; x < 7400; x += 330 + r() * 160) {
      if (x > GATE[0] - 60 && x < GATE[1] + 60) continue;
      out.push({ k: kinds[out.length % kinds.length], x, y: 836 + r() * 170, w: 64 + r() * 40, flip: r() < .5 });
    }
    return out;
  })();

  function nightness(clock) {
    try { return clamp(CityLighting.sample(clock).lamps, 0, 1); } catch (e) { return 0; }
  }

  // Called in the sky pass, after the day sky layer. Returns true when it replaced the old distant layer.
  function drawSky(ctx, camera, w, h, clock) {
    if (!ok(img.pano)) return false;
    const P = img.pano, pw = PANO_H * P.naturalWidth / P.naturalHeight;
    const x = camera * (1 - PANO_PARALLAX);
    ctx.drawImage(P, x, 0, pw, PANO_H);
    ctx.drawImage(P, 0, P.naturalHeight - 3, P.naturalWidth, 3, x, PANO_H - 1, pw, 260); // mist below the panorama
    if (camera + w > x + pw) ctx.drawImage(P, x + pw - 1, 0, pw, PANO_H);              // only on very wide screens
    const n = nightness(clock);
    if (n > 0.01 && ok(img.night)) {
      ctx.save(); ctx.globalAlpha = n;
      const sw = Math.min(w, img.night.naturalWidth);
      ctx.drawImage(img.night, 0, 0, sw, img.night.naturalHeight, camera, 0, sw, 1080);
      ctx.restore();
    }
    return true;
  }
  function cloudAlpha(clock) { return 1 - 0.85 * nightness(clock); }

  function drawAlley(ctx) {
    if (!ok(img.alley)) return false;
    const h = ALLEY.w * img.alley.naturalHeight / img.alley.naturalWidth;
    ctx.drawImage(img.alley, ALLEY.x, ALLEY.foot - h, ALLEY.w, h);
    return true;
  }

  function drawStreet(ctx, camera, w) {
    // road decals (flattened to lie on the ground)
    if (ok(img.decals)) {
      ctx.save(); ctx.globalAlpha = .85;
      for (const d of DECALS) {
        if (d.x + d.w < camera || d.x > camera + w) continue;
        const [sx, sy, sw, sh] = DECAL_SRC[d.k], dh = d.w * sh / sw * .55;
        ctx.save(); ctx.translate(d.x + d.w / 2, d.y); ctx.scale(d.flip ? -1 : 1, 1);
        ctx.drawImage(img.decals, sx, sy, sw, sh, -d.w / 2, -dh / 2, d.w, dh); ctx.restore();
      }
      ctx.restore();
    }
    // continuous sidewalk with rounded ends at the gate lane
    if (ok(img.curb)) {
      const runs = [[-20, GATE[0] - END_W], [GATE[1] + END_W, 7520]];
      for (const [a, b] of runs) {
        const from = Math.max(a, Math.floor((camera - CURB_W) / CURB_W) * CURB_W), to = Math.min(b, camera + w + CURB_W);
        if (from >= to) continue;
        ctx.save(); ctx.beginPath(); ctx.rect(a, CURB_Y - 2, b - a, CURB_H + 4); ctx.clip();
        for (let x = Math.floor(from / CURB_W) * CURB_W; x < to; x += CURB_W) ctx.drawImage(img.curb, x, CURB_Y, CURB_W, CURB_H);
        ctx.restore();
      }
      if (ok(img.endR)) ctx.drawImage(img.endR, GATE[0] - END_W, CURB_Y, END_W, CURB_H);
      if (ok(img.endL)) ctx.drawImage(img.endL, GATE[1], CURB_Y, END_W, CURB_H);
    }
    if (ok(img.steps) && PLAZA.x + PLAZA.w > camera && PLAZA.x < camera + w) {
      const sh = PLAZA.w * img.steps.naturalHeight / img.steps.naturalWidth;
      ctx.drawImage(img.steps, PLAZA.x, PLAZA.y - sh, PLAZA.w, sh);
    }
  }

  // two guards walking their beat; positions come from the town clock so speed/pause/reload all agree
  const BEATS = [
    { from: 300, to: 2950, y: 846, speed: 650, offset: 0.0 },
    { from: 3000, to: 6300, y: 832, speed: 650, offset: 4.2 }
  ];
  function guards(clock) {
    return BEATS.map((b, i) => {
      const len = b.to - b.from, period = 2 * len / b.speed;
      const p = ((clock + b.offset) % period + period) % period;
      const fwd = p < period / 2, d = fwd ? p * b.speed : (period - p) * b.speed;
      return { guard: true, i, x: b.from + d, y: b.y, face: fwd ? 1 : -1, frame: Math.floor(clock * 42) % 4 };
    });
  }
  function drawGuard(ctx, g, clock) {
    if (!ok(img.guard)) return;
    const depth = CityCore.depthScale(g.x, g.y);
    CityLighting.actorShadow(ctx, g.x, g.y, depth * .8, clock);
    ctx.save(); ctx.translate(g.x, g.y); ctx.scale(g.face * depth, depth);
    ctx.drawImage(img.guard, g.frame * 543, 0, 543, 724, -50, -130, 100, 133);
    ctx.restore();
  }

  root.SceneV63 = { img, drawSky, cloudAlpha, drawAlley, drawStreet, guards, drawGuard, DECALS, GATE };
})(typeof globalThis !== 'undefined' ? globalThis : this);
