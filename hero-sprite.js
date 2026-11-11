/* Hero sprite (v67): frame-based sheet hero_sprite.webp, 4 columns × 4 rows of 480×680.
   row 0 side walk · row 1 side run · row 2 front (idle/walk) · row 3 back.
   HeroSprite.draw(ctx, o) draws with feet at (0,0), facing right unless o.face = -1. */
(function (root) {
  'use strict';
  const FW = 480, FH = 680, FEET = 662, HEIGHT = 130.05;         // same on-screen height as the old sprite
  const WIDTH = HEIGHT * FW / FH;
  let img = null;
  function load(url) { if (img) return img; img = new Image(); img.src = url || 'hero_sprite.webp?v=67'; return img; }
  const ready = () => !!img && img.complete && img.naturalWidth > 0;
  // o: {anim (seconds×fps counter), moving, run, vdir (-1 up, 1 down, 0 none), face, scale}
  function pick(o) {
    const t = Math.max(0, Math.floor(o.anim || 0));
    if (o.vdir && !o.horizontal) return { row: o.vdir < 0 ? 3 : 2, frame: o.vdir < 0 ? 0 : (o.moving ? t % 4 : 0), bob: o.moving };
    if (!o.moving) return { row: 0, frame: 1, bob: false };      // standing: feet-together walk frame
    return { row: o.run ? 1 : 0, frame: t % 4, bob: false };
  }
  function draw(ctx, o) {
    if (!ready()) return false;
    const p = pick(o), s = o.scale || 1, face = o.face || 1;
    let dy = 0, tilt = 0;
    if (p.bob) { const ph = (o.anim || 0) * Math.PI / 2; dy = -Math.abs(Math.sin(ph)) * 3; tilt = Math.sin(ph) * 0.035; }
    ctx.save(); ctx.scale(face * s, s);
    if (tilt) { ctx.translate(0, -HEIGHT * 0.35); ctx.rotate(tilt); ctx.translate(0, HEIGHT * 0.35); }
    ctx.drawImage(img, p.frame * FW, p.row * FH, FW, FH, -WIDTH / 2, -HEIGHT + (FH - 1 - FEET) * HEIGHT / FH + dy, WIDTH, HEIGHT);
    ctx.restore();
    return true;
  }
  function portrait(cv) {
    if (!ready()) return false;
    const g = cv.getContext('2d'), d = Math.min(root.devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
    cv.width = Math.round((r.width || 46) * d); cv.height = Math.round((r.height || 46) * d);
    g.clearRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = true;
    const sx = 2 * FW + 95, sy = 2 * FH + 10, sw = 290, sh = 290;          // head of the front frame
    g.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
    return true;
  }
  root.HeroSprite = { load, ready, draw, portrait, FW, FH, WIDTH, HEIGHT };
})(typeof globalThis !== 'undefined' ? globalThis : this);
