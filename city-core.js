/* Shared rules for the existing town scene. Positions use the scene's world coordinates. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CityCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Reference pixels for the current front-oblique scene; not a metre grid.
  const SCENE = Object.freeze({referenceWidth:1920,referenceHeight:1080,worldWidth:7500,
    playerWidth:76.5,playerHeight:130.05,spriteFrameWidth:400,spriteFrameHeight:680,
    walkFeet:Object.freeze([661,658,655,658]),walkFramesPerSecond:8,
    speedX:210,speedY:140,footRadius:9,lampWidth:64});
  const LAYOUT_REVISION = 2;
  const MONTH_LENGTH = 30;
  const TAX_PER_MONTH = 3;
  const EXAM_SCORE = 8;
  const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function playerFrame(animationTime,moving) {
    const tick=Math.max(0,Math.floor(finite(animationTime,0)));
    const frame=moving?tick%SCENE.walkFeet.length:0;
    return {frame,footOffset:(SCENE.spriteFrameHeight-1-SCENE.walkFeet[frame])*SCENE.playerHeight/SCENE.spriteFrameHeight};
  }
  function viewport(canvasWidth,canvasHeight,playerX) {
    const scale=Math.max(canvasWidth/SCENE.referenceWidth,canvasHeight/SCENE.referenceHeight);
    const width=canvasWidth/scale,height=canvasHeight/scale;
    let cameraX=clamp(playerX-width/2,0,Math.max(0,SCENE.worldWidth-width));
    if(width>=SCENE.worldWidth)cameraX=(SCENE.worldWidth-width)/2;
    return {scale,width,height,cameraX};
  }
  function nextTaxDay(day) {
    const current = Math.max(1, Math.floor(finite(day, 1)));
    return 31 + MONTH_LENGTH * Math.floor((current - 1) / MONTH_LENGTH);
  }

  function migrateSave(saved, defaults) {
    const old = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    const state = { ...defaults, ...old };
    // Unversioned saves are ambiguous: old releases and the old reset button both
    // wrote them. Keep their position; migrate only an explicitly versioned layout.
    if (old.layoutRevision === 1 && Number.isFinite(old.position)) {
      if (old.position >= 2685) state.position = old.position + 1350;
      else if (old.position >= 2020) state.position = old.position + 1200;
    }
    state.layoutRevision = LAYOUT_REVISION;
    state.scene = old.scene === 'outskirts' ? 'outskirts' : 'town';
    state.outsideX = clamp(finite(old.outsideX, 520), 35, 3205);
    state.outsideY = clamp(finite(old.outsideY, 820), 745, 1010);
    state.smithWork = Math.max(0, Math.floor(finite(old.smithWork, 0)));
    state.day = Math.max(1, Math.floor(finite(state.day, 1)));
    state.position = clamp(finite(state.position, 960), 35, 6865);
    state.positionY = clamp(finite(state.positionY, 800), 625, 1030);
    if (!walkable(state.position, state.positionY)) state.positionY = 800;
    state.events = Array.isArray(old.events) ? old.events : [];
    state.taxDue = Math.max(0, Math.floor(finite(old.taxDue, 0)));
    state.nextTaxDay = Number.isFinite(old.nextTaxDay) && old.nextTaxDay > 0
      ? Math.floor(old.nextTaxDay) : nextTaxDay(state.day);
    state.intelligence = clamp(finite(old.intelligence, 3), 1, 12);
    state.examDay = Math.max(0, Math.floor(finite(old.examDay, 0)));
    state.examResult = ['none', 'passed', 'failed'].includes(old.examResult)
      ? old.examResult : (state.guild ? 'passed' : 'none');
    state.equipment = typeof old.equipment === 'string' ? old.equipment : (state.guild ? 'อุปกรณ์ฝึกพื้นฐาน' : 'ไม่มี');
    return state;
  }

  function freshState(defaults, profession) {
    return migrateSave({ ...defaults, profession, events: [], layoutRevision: LAYOUT_REVISION,
      taxDue: 0, nextTaxDay: 31, examDay: 0, examResult: 'none', equipment: 'ไม่มี' }, defaults);
  }

  function walkable(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 35 || x > 6865 || y < 625 || y > 1030) return false;
    if (y >= 765) return true;
    if (x >= 6380 && x <= 6580 && y >= 650) return true;
    if (y >= 700 && x >= 675 && x <= 725) return true;
    if (y >= 650) {
      const t = clamp((765 - y) / 115, 0, 1);
      const left = 1323 + 42 * t;
      const right = 1473 - 43 * t;
      if (x >= left && x <= right) return true;
    }
    if (y >= 625 && y < 700) return x >= 2150 && x <= 2710;
    return y >= 700 && x >= 2320 && x <= 2540;
  }

  function depthScale(x, y) {
    if (y >= 765) return 1;
    if (x >= 6380 && x <= 6580) return clamp(0.65 + (y - 650) / 115 * 0.35, 0.65, 1);
    if (x >= 675 && x <= 725) return clamp(0.72 + (y - 700) / 65 * 0.28, 0.72, 1);
    if (x >= 1323 && x <= 1473) return clamp(0.55 + (y - 650) / 115 * 0.45, 0.55, 1);
    if (x >= 2150 && x <= 2710) return clamp(0.68 + (y - 625) / 140 * 0.32, 0.68, 1);
    return 1;
  }

  function sceneName(x, y) {
    if (y < 810 && x >= 665 && x <= 735) return 'ทางหลังตลาด';
    if (y < 810 && x >= 1323 && x <= 1473) return 'ซอยหลังถนน';
    if (x >= 1980 && x < 2880) return 'ลานหน้าหอคอย';
    if (x >= 90 && x < 665) return 'ตลาด';
    if (x >= 735 && x < 1305) return 'กิลด์นักผจญภัย';
    if (x >= 1490 && x < 1980) return 'ร้านอาหาร';
    if (x >= 4035 && x < 4465) return 'โรงแรม';
    if (x >= 6100) return 'ประตูเมือง';
    if (x >= 5260) return 'โรงตีเหล็ก';
    if (x >= 2880) return 'ย่านที่พัก';
    return 'ถนนในเมือง';
  }

  // Interact near each entrance or counter, not anywhere along a whole facade.
  const INTERACTIONS = { 360: [250, 465], 1000: [870, 1105], 1550: [1495, 1665], 4250: [4140, 4360], 5705: [5615, 5785] };
  function nearBuilding(x, y, anchor) {
    const zone = INTERACTIONS[anchor];
    return !!zone && x >= zone[0] && x < zone[1] && y >= 740 && y <= 835;
  }
  function nearGate(x, y) { return x >= 2310 && x <= 2550 && y <= 685; }
  function nearCityGate(x, y) { return x >= 6380 && x <= 6580 && y <= 710; }

  // Horizontal footprint as a fraction of the source sprite width; vertical extent
  // in world pixels around the visible foot.  Decorative shadows are not obstacles.
  const HIT_PROFILES = {
    'props/lamp.png': [0.36, 0.64, 7],
    'props/new/tree.png': [0.28, 0.72, 9],
    'props/bench_clean.png': [0.09, 0.91, 8],
    'props/market_set/handcart.png': [0.08, 0.94, 10],
    'props/market_set/produce_baskets.png': [0.12, 0.9, 7],
    'props/market_set/sacks.png': [0.15, 0.85, 7],
    'props/market_set/guild_board.png': [0.18, 0.82, 6],
    'props/market_set/inn_table.png': [0.12, 0.88, 9],
    'props/market_stall_v50.png': [0.08, 0.92, 9],
    'props/plant_pot.png': [0.23, 0.78, 6],
    'props/barrel.png': [0.20, 0.88, 7],
    'props/firewood.png': [0.16, 0.82, 6],
    'props/flower_planter.png': [0.10, 0.90, 8],
    'props/clothesline.png': [0.12, 0.88, 6],
    'props/stall_bread.png': [0.08, 0.92, 9],
    'props/stall_potion.png': [0.08, 0.92, 9],
    'props/new/fence.png': [0.08, 0.92, 6],
    'props/new/wall.png': [0.08, 0.92, 6]
  };
  function hitsProp(o, x, y, footY, radius) {
    if (!o || !o.src || !o.src.startsWith('props/')) return false;
    const p = HIT_PROFILES[o.src] || [0.12, 0.88, 7];
    const r = finite(radius, 5);
    return y >= footY - p[2] && y <= footY + p[2] &&
      x >= o.x + o.width * p[0] - r && x <= o.x + o.width * p[1] + r;
  }

  function accrueTax(state) {
    let periods = 0;
    while (state.day >= state.nextTaxDay && periods < 1200) {
      state.taxDue += TAX_PER_MONTH;
      state.nextTaxDay += MONTH_LENGTH;
      periods++;
    }
    return periods;
  }
  function payTax(state) {
    if (state.taxDue <= 0) return { ok: false, reason: 'none', paid: 0 };
    const amount = Math.min(TAX_PER_MONTH, state.taxDue);
    if (state.money < amount) return { ok: false, reason: 'money', paid: 0 };
    state.money -= amount;
    state.taxDue -= amount;
    return { ok: true, paid: amount };
  }
  function workWage(wage, taxDue, ordinaryWork) {
    return Math.max(1, wage - (ordinaryWork && taxDue > 0 ? 2 : 0));
  }
  function examResult(state) {
    if (state.guild) return 'member';
    if (state.examDay === state.day) return 'wait';
    return finite(state.strength, 3) + finite(state.agility, 3) >= EXAM_SCORE ? 'passed' : 'failed';
  }
  return { SCENE, playerFrame, viewport, LAYOUT_REVISION, MONTH_LENGTH, TAX_PER_MONTH, EXAM_SCORE, nextTaxDay,
    migrateSave, freshState, walkable, depthScale, sceneName, nearBuilding, nearGate, nearCityGate,
    hitsProp, accrueTax, payTax, workWage, examResult };
});
