/* A small, separate walkable area outside the city gate. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CityOutskirts = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const WIDTH = 3240, HEIGHT = 1080;
  const START_X = 520, START_Y = 820;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function nearGate(x, y) { return x >= 420 && x <= 620 && y >= 745 && y <= 845; }
  function step(x, y, dx, dy, dt, core) {
    const norm = dx && dy ? Math.SQRT1_2 : 1;
    return { x: clamp(x + dx * core.SCENE.speedX * dt * norm, 35, WIDTH - 35),
      y: clamp(y + dy * core.SCENE.speedY * dt * norm, 745, 1010) };
  }
  function crop(ctx, image, cropRect, x, bottom, width) {
    if (!image || !image.complete || !image.naturalWidth) return;
    const [sx, sy, sw, sh] = cropRect, height = width * sh / sw;
    ctx.drawImage(image, sx, sy, sw, sh, x, bottom - height, width, height);
  }
  function draw(ctx, canvas, art, pos, core, time) {
    const scale = Math.max(canvas.width / 1920, canvas.height / 1080);
    const viewportWidth = canvas.width / scale, viewportHeight = canvas.height / scale;
    const camera = clamp(pos.x - viewportWidth / 2, 0, Math.max(0, WIDTH - viewportWidth));
    ctx.setTransform(scale, 0, 0, scale, -camera * scale, 0);
    ctx.fillStyle = '#9bb7a3'; ctx.fillRect(camera, 0, viewportWidth, viewportHeight);
    if (art.background.complete && art.background.naturalWidth)
      ctx.drawImage(art.background, 0, 0, WIDTH, HEIGHT);
    // A short paving connection aligns the visible opening with the road.
    if (art.background.complete && art.background.naturalWidth) {
      ctx.save(); ctx.beginPath(); ctx.moveTo(453, 700); ctx.lineTo(587, 700);
      ctx.lineTo(650, 825); ctx.lineTo(390, 825); ctx.closePath(); ctx.clip();
      for (let i = 0; i < 8; i++) {
        ctx.globalAlpha = .45 * (1 - i / 8);
        ctx.drawImage(art.background, 700, 500 + i * 18.75, 250, 18.75,
          390, 700 + i * 15.625, 260, 15.625);
      }
      ctx.restore();
    }
    // Stone wall and the gate are independent layers on top of the landscape.
    crop(ctx, art.wall, [0,149,2172,530], -850, 740, 1100);
    crop(ctx, art.wall, [0,149,2172,530], 850, 740, 1050);
    // The existing town alley shows through the transparent gate opening.
    if (art.alley.complete && art.alley.naturalWidth) {
      const width = 200, height = width * art.alley.naturalHeight / art.alley.naturalWidth;
      const fade = 45, sourceFade = art.alley.naturalHeight * fade / height;
      const solid = art.alley.naturalHeight - sourceFade;
      ctx.drawImage(art.alley, 0, 0, art.alley.naturalWidth, solid,
        420, 740 - height, width, height - fade);
      ctx.save();
      for (let i = 0; i < 8; i++) {
        ctx.globalAlpha = 1 - i / 8;
        ctx.drawImage(art.alley, 0, solid + i * sourceFade / 8,
          art.alley.naturalWidth, sourceFade / 8,
          420, 740 - fade + i * fade / 8, width, fade / 8);
      }
      ctx.restore();
    }
    if (art.gate.complete && art.gate.naturalWidth) {
      const width = 800, height = width * art.gate.naturalHeight / art.gate.naturalWidth;
      ctx.drawImage(art.gate, 120, 740 - height, width, height);
    }
    if (art.tree.complete && art.tree.naturalWidth) {
      const width = 300, height = width * art.tree.naturalHeight / art.tree.naturalWidth;
      ctx.drawImage(art.tree, 1780, 750 - height, width, height);
    }
    ctx.save(); ctx.fillStyle = 'rgba(36,28,24,.28)'; ctx.beginPath();
    ctx.ellipse(pos.x, pos.y - 1, 29, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    if (art.sprite.complete && art.sprite.naturalWidth) {
      const pose = core.playerFrame(pos.anim, pos.moving), sc = core.SCENE;
      ctx.save(); ctx.translate(pos.x, pos.y); ctx.scale(pos.face, 1);
      ctx.drawImage(art.sprite, pose.frame * sc.spriteFrameWidth, 0,
        sc.spriteFrameWidth, sc.spriteFrameHeight, -sc.playerWidth / 2,
        -sc.playerHeight + pose.footOffset, sc.playerWidth, sc.playerHeight);
      ctx.restore();
    }
    if (nearGate(pos.x, pos.y)) {
      const iconY = pos.y - core.SCENE.playerHeight - 20 + Math.sin(time * .006) * 2;
      ctx.save(); ctx.beginPath(); ctx.arc(pos.x, iconY, 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(38,32,27,.88)'; ctx.fill(); ctx.lineWidth = 2;
      ctx.strokeStyle = '#efd08b'; ctx.stroke(); ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff0bc';
      ctx.fillText('!', pos.x, iconY + .5); ctx.restore();
    }
  }
  return { WIDTH, HEIGHT, START_X, START_Y, nearGate, step, draw };
});
