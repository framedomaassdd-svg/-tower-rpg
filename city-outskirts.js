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
  function draw(ctx, canvas, art, pos, core, time, clock) {
    const scale = Math.max(canvas.width / 1920, canvas.height / 1080);
    const viewportWidth = canvas.width / scale, viewportHeight = canvas.height / scale;
    const camera = Math.round(clamp(pos.x - viewportWidth / 2, 0, Math.max(0, WIDTH - viewportWidth)) * scale) / scale;
    ctx.setTransform(scale, 0, 0, scale, -camera * scale, 0);
    ctx.fillStyle = '#9bb7a3'; ctx.fillRect(camera, 0, viewportWidth, viewportHeight);
    if (art.background.complete && art.background.naturalWidth)
      ctx.drawImage(art.background, 0, 0, WIDTH, HEIGHT);
    CityLighting.stars(ctx, camera, viewportWidth, clock, true);
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
    // Through the opening, show the city's street and distant roof line.
    if (art.citySky.complete && art.citySky.naturalWidth &&
        art.cityBack.complete && art.cityBack.naturalWidth &&
        art.cityRoad.complete && art.cityRoad.naturalWidth) {
      ctx.save(); ctx.beginPath(); ctx.rect(420, 420, 200, 320); ctx.clip();
      ctx.drawImage(art.citySky, 600, 0, 452, 452.5, 420, 420, 200, 200);
      ctx.drawImage(art.cityBack, 24, 46, 2117, 591, 410, 565, 220, 61.4);
      // Blend the city paving into the outside path instead of ending in a hard rectangle.
      ctx.drawImage(art.cityRoad, 100, 700, 400, 160, 420, 620, 200, 80);
      for(let i=0;i<8;i++){
        ctx.save(); ctx.globalAlpha=1-(i+.5)/8;
        ctx.drawImage(art.cityRoad, 100, 860+i*10, 400, 10, 420, 700+i*5, 200, 5.2);
        ctx.restore();
      }
      ctx.restore();
    }
    if (art.gate.complete && art.gate.naturalWidth) {
      const width = 800, height = width * art.gate.naturalHeight / art.gate.naturalWidth;
      ctx.drawImage(art.gate, 120, 740 + width * 36 / 1536 - height, width, height);
    }
    if (art.tree.complete && art.tree.naturalWidth) {
      const width = 300, height = width * art.tree.naturalHeight / art.tree.naturalWidth;
      CityLighting.propShadow(ctx, 1780 + width / 2, 750, width, clock);
      ctx.drawImage(art.tree, 1780, 750 + width * 52 / 1312 - height, width, height);
    }
    CityLighting.actorShadow(ctx,pos.x,pos.y,1,clock);
    if ((globalThis.HeroSprite && globalThis.HeroSprite.ready()) || (art.sprite.complete && art.sprite.naturalWidth)) {
      const pose = core.playerFrame(pos.anim, pos.moving), sc = core.SCENE;
      ctx.save(); ctx.translate(pos.x, pos.y); ctx.scale(pos.face, 1);
      if (globalThis.HeroSprite && globalThis.HeroSprite.ready()) globalThis.HeroSprite.draw(ctx, { anim: pos.anim, moving: pos.moving, face: 1, vdir: pos.vdir || 0, horizontal: !!pos.horizontal });
      else ctx.drawImage(art.sprite, pose.frame * sc.spriteFrameWidth, 0,
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
    CityLighting.draw(ctx,camera,viewportWidth,viewportHeight,clock,{outside:true});
  }
  return { WIDTH, HEIGHT, START_X, START_Y, nearGate, step, draw };
});
