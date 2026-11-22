/* v140 BattleView — draws a Battle (battle.js) on a canvas and runs its turns.
   Layout: our side on the left, monsters on the right, each in two columns (front / back) and two depth lanes.
   Timeline across the top (ours above the line, theirs below; the next to act is on the left).
   Life pips over each head (red = life, white = shield). Melee dashes to the target and snaps back; ranged shoots
   from its place; hit-stop, shake, knockback and flashes on every blow.
   BattleView.start(canvas, ui, battle, opts) → controller { stop() } ; opts.onEnd(result) */
(function (root) {
  'use strict';
  const B = () => root.Battle;
  const imgs = {};
  const im = src => { if (!imgs[src]) { const i = new Image(); i.src = src; imgs[src] = i; } return imgs[src]; };
  const ok = i => i && i.complete && i.naturalWidth > 0;
  const ease = q => q <= 0 ? 0 : q >= 1 ? 1 : q * q * (3 - 2 * q);
  const easeIn = q => q <= 0 ? 0 : q >= 1 ? 1 : q * q * q;
  const easeOut = q => q <= 0 ? 0 : q >= 1 ? 1 : 1 - Math.pow(1 - q, 3);
  const seg = (k, a, b) => Math.max(0, Math.min(1, (k - a) / (b - a)));

  // ---- how each kind of sprite sheet is cut: cell size, anchor (feet) and which cells make which pose ----
  // hero: npc5_heroCombat 4×5 cells 512×400, rows sword/spear/bow/club, row 4 hit · dodge · down · kneel
  // ally: npc_combat 4×4 cells 620×420, rows attack · special · (hit dodge down up) · (sit sleep stand victory)
  // monster: 4×3 rows idle · attack · (hit hit defeat defeat)
  function art(u) {
    const CL = root.HeroClips && root.HeroClips[u.art.id];
    if (u.art.type === 'clip' || (u.art.type === 'mon' && CL)) return { clip: CL, id: u.art.id, base: (CL.disp || 340) * 1.3 * (u.art.scale || 1), ax: 0, cw: 0, ch: 0, scale: 1, lift: 0 };
    if (u.art.type === 'rig') return { rig: u.art.id, base: 470, ax: 0, cw: 0, ch: 0, scale: 1, lift: 0 };
    if (u.art.type === 'hero') return { img: im(u.art.src), cw: 512, ch: 400, ax: 250, base: 390, scale: 1,
      idle: [u.art.row, 0], wind: [u.art.row, 1], strike: [u.art.row, 2], follow: [u.art.row, 3], cast: [u.art.row, 1],
      hit: [4, 0], dodge: [4, 1], down: [4, 2], win: [u.art.row, 0] };
    if (u.art.type === 'ally') return { img: im(u.art.src), cw: 620, ch: 420, ax: 290, base: 410, scale: 0.96,
      idle: [3, 2], wind: [0, 1], strike: [0, 2], follow: [0, 3], cast: [1, 2], hit: [2, 0], dodge: [2, 1], down: [2, 2], win: [3, 3] };
    const M = (root.TowerView && root.TowerView.MON[u.art.id]) || [400, 300, 200, 290];
    return { img: im('monsters/' + u.art.id + '.webp?v=127'), cw: M[0], ch: M[1], ax: M[2], base: M[3], lift: M[4] || 0, scale: u.art.scale || 1,
      idle: [0, 0], idleLoop: true, wind: [1, 0], strike: [1, 2], follow: [1, 3], cast: [1, 1], hit: [2, 0], dodge: [2, 1], down: [2, 3], win: [0, 0] };
  }

  function start(cv, ui, b, opts) {
    opts = opts || {};
    const ctx = cv.getContext('2d');
    const bg = im(opts.bg || 'tower/floor1.webp?v=127');
    let W = 0, H = 0, u = 1, auto = !!opts.auto, speed = 1, stopped = false;
    const vis = new Map();                    // per-unit display state
    const pops = [];                          // floating texts and pip shards
    let simT = 0, anim = null, shake = { t: 0, a: 0 }, stopUntil = 0, waitHero = null, tl = new Map(), phase = 'advance', phaseT = 0;
    b.units.forEach((x, i) => vis.set(x, { flash: 0, knock: 0, alpha: 1, pose: null, poseUntil: 0, seed: i * 1.7, dp: x.pips, ds: x.shield }));
    const sync = x => { const v = vis.get(x); if (v) { v.dp = x.pips; v.ds = x.shield; } };

    function resize() {
      const r = cv.getBoundingClientRect(), d = Math.min(2, root.devicePixelRatio || 1);
      cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); W = cv.width; H = cv.height;
      u = Math.min(H * 0.3 / 345, W / 1250);
    }
    resize(); root.addEventListener('resize', resize);

    // where each unit stands: row 0 = front column (nearest the middle), lane alternates depth
    function spot(x) {
      const mates = b.units.filter(y => y.side === x.side), i = mates.indexOf(x);
      const sameRow = mates.filter(y => y.row === x.row), j = sameRow.indexOf(x);
      const lane = j % 2, col = x.row;
      const fx = (col === 0 ? 0.39 : 0.22) - lane * 0.075;
      const gy = H * (lane ? 0.71 : 0.84), sc = lane ? 0.88 : 1;
      return { x: x.side === 'L' ? W * fx : W * (1 - fx), gy, sc, dir: x.side === 'L' ? 1 : -1, i };
    }
    // v142 a rigged character: the pose comes from its skeleton (smooth at any speed) instead of sheet cells
    function drawRig(x, A, pose, px, gy, sc, alpha, flash, t) {
      const v = vis.get(x), dir = x.side === 'L' ? 1 : -1, h = 375 * u * sc;
      let anim = 'ready', at = t, extra = null;
      if (anim && pose !== 'idle') {
        if ((pose === 'wind' || pose === 'strike' || pose === 'follow') && actingT(x) !== null) { const c = (v.acts || 0) % 3; anim = 'attack' + (c + 1); at = actingT(x) - (0.34 - [0.27, 0.25, 0.33][c]); }   // a 3-hit combo across turns
        else if (pose === 'hit' || pose === 'dodge') { anim = 'hit'; at = t - (v.hitAt || t); }
        else if (pose === 'down') { anim = 'hit'; at = 0.3; extra = 'down'; }
        else if (pose === 'cast') { anim = 'ready'; extra = { face: 'shout', armF: -150, elbowF: -20, sword: -40 }; }
      }
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(px, gy + 2, 70 * u * sc, 14 * u * sc, 0, 0, Math.PI * 2); ctx.fill();
      if (extra === 'down') { ctx.translate(px, gy); ctx.rotate(-dir * 1.45); ctx.translate(-px, -gy + 40 * u); }
      const o = extra && extra !== 'down' ? { pose: extra } : undefined;
      root.Rig.draw(ctx, A.rig, anim, Math.max(0, at), px, gy, h, dir, o);
      if (flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * flash * 0.7; root.Rig.draw(ctx, A.rig, anim, Math.max(0, at), px, gy, h, dir, o); }
      ctx.restore();
    }
    // v152 a character from AI-video clips: which action plays, and how far into it, comes from the battle state
    const clipImg = (A, name) => im(A.clip.dir + name + '.webp?v=' + A.clip.ver);
    function clipState(x, t) {
      const v = vis.get(x), A = art(x);
      if (anim && anim.actor === x && anim.clipAct) return { act: anim.clipAct, lt: t - anim.t0 };
      if (v.pose === 'down') return { act: 'down', lt: t - (v.dieAt !== undefined ? v.dieAt : v.hitAt || t) };
      if ((v.pose === 'hit' || v.pose === 'dodge') && t < v.poseUntil) return { act: 'hit', lt: (t - (v.hitAt || t)) * (v.pose === 'dodge' ? 1.6 : 1) };
      if (phase === 'end' && x.alive && (b.over === 'win') === (x.side === 'L')) return { act: 'win', lt: t - phaseT };
      return { act: 'idle', lt: t + v.seed };
    }
    function clipFrame(C, act, lt) {
      let M = C.acts[act]; if (!M) { act = 'idle'; M = C.acts.idle; }
      let f = Math.floor(Math.max(0, lt) * M.fps);
      if (M.loop) f %= M.n;
      else if (f >= M.n) {
        if (M.loopFrom != null) f = M.loopFrom + (f - M.loopFrom) % (M.n - M.loopFrom);
        else if (act === 'down') f = M.n - 1;
        else { act = 'idle'; M = C.acts.idle; f = Math.floor(lt * M.fps) % M.n; }
      }
      return { act, f };
    }
    function drawClip(x, A, px, gy, sc, alpha, flash, t) {
      const C = A.clip, st = clipState(x, t), fr = clipFrame(C, st.act, st.lt), I = clipImg(A, fr.act);
      const dir = (x.side === 'L' ? 1 : -1) * (C.faceLeft ? -1 : 1), k = (C.disp || 340) * (x.art.scale || 1) * u * sc / C.h, F = C.acts[fr.act];
      ctx.save(); ctx.globalAlpha = alpha;
      if (fr.act !== 'down') { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(px, gy + 2, 70 * u * sc, 14 * u * sc, 0, 0, Math.PI * 2); ctx.fill(); }
      if (!ok(I)) { ctx.restore(); return; }
      const sx = (fr.f % F.cols) * F.cw, sy = Math.floor(fr.f / F.cols) * F.ch;
      ctx.translate(px, gy); ctx.scale(dir, 1);
      ctx.drawImage(I, sx, sy, F.cw, F.ch, -F.ax * k, -F.ay * k, F.cw * k, F.ch * k);
      if (flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * flash * 0.6; ctx.drawImage(I, sx, sy, F.cw, F.ch, -F.ax * k, -F.ay * k, F.cw * k, F.ch * k); }
      ctx.restore();
    }
    const actingT = x => anim && anim.actor === x ? simT - anim.t0 : null;
    function drawUnit(x, pose, px, gy, sc, alpha, flash, t) {
      const A = art(x); if (A.clip) return drawClip(x, A, px, gy, sc, alpha, flash, t);
      if (A.rig) return drawRig(x, A, pose, px, gy, sc, alpha, flash, t);
      if (!ok(A.img)) return;
      const k = u * sc * A.scale, dir = x.side === 'L' ? 1 : -1;
      let [row, col] = A[pose] || A.idle;
      if (pose === 'idle' && A.idleLoop) col = Math.floor(t * 6 + vis.get(x).seed * 3) % 4;
      const breathe = pose === 'idle' ? 1 + 0.016 * Math.sin(t * 2.8 + vis.get(x).seed) : 1;
      ctx.save(); ctx.globalAlpha = alpha;
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(px, gy + 2, 70 * k, 14 * k, 0, 0, Math.PI * 2); ctx.fill();
      ctx.translate(px, gy - (A.lift || 0) * k); ctx.scale(dir * (x.art.type === 'mon' ? -1 : 1), breathe);
      ctx.drawImage(A.img, col * A.cw, row * A.ch, A.cw, A.ch, -A.ax * k, -A.base * k, A.cw * k, A.ch * k);
      if (flash > 0) {                               // white hit flash drawn over the sprite
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * flash * 0.8;
        ctx.drawImage(A.img, col * A.cw, row * A.ch, A.cw, A.ch, -A.ax * k, -A.base * k, A.cw * k, A.ch * k);
      }
      ctx.restore();
    }
    // life pips as shown (they drop when the blow lands, not when it is computed); half pips are half filled
    function pipsOf(x, px, gy, sc) {
      const A = art(x), v = vis.get(x), top = gy - (A.base * 0.82 + (A.lift || 0)) * u * sc * A.scale - 16 * u;
      const sh = Math.ceil(v.ds - 1e-6), n = x.max + sh, r = Math.max(4, 11 * u * sc), gap = r * 2.5, x0 = px - (n - 1) * gap / 2;
      for (let i = 0; i < n; i++) {
        const cx = x0 + i * gap, shield = i >= x.max, fill = shield ? Math.min(1, v.ds - (i - x.max)) : Math.max(0, Math.min(1, v.dp - i));
        const col = shield ? '#f4f7ff' : x.side === 'L' ? '#e8483f' : '#d8403a';
        ctx.beginPath(); ctx.arc(cx, top, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(30,20,20,.55)'; ctx.fill();
        if (fill > 0) {
          ctx.save(); ctx.beginPath(); ctx.arc(cx, top, r, 0, Math.PI * 2); ctx.clip();
          ctx.fillStyle = col; ctx.fillRect(cx - r, top - r, fill >= 1 ? r * 2 : r, r * 2); ctx.restore();
          ctx.beginPath(); ctx.arc(cx - r * 0.3, top - r * 0.3, r * 0.3, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(cx, top, r, 0, Math.PI * 2); ctx.lineWidth = Math.max(1.5, r * 0.32);
        ctx.strokeStyle = shield ? '#9fb6d9' : x.guard > 0 ? '#9fb0c4' : '#2a1412'; ctx.stroke();
      }
      if (x.taunt > 0) { ctx.font = 'bold ' + Math.round(r * 2) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd36b'; ctx.fillText('!', px, top - r * 1.8); }
    }
    // ---- timeline: ours above the line, theirs below, nearest to act on the left ----
    function portrait(x, cx, cy, r, big) {
      const A = art(x);
      if (A.clip) {                                                 // the clip's first idle frame, head and shoulders
        const C = A.clip, I = clipImg(A, 'idle');
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#2c4a7a'; ctx.fill(); ctx.clip();
        const F = C.acts.idle;
        if (ok(I)) { const k = r * 2.4 / (C.h * 0.62); ctx.drawImage(I, 0, 0, F.cw, F.ch, cx - F.ax * k, cy + r * 1.05 - (F.ay - C.h * 0.38) * k, F.cw * k, F.ch * k); }
        ctx.restore(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = big ? 4 : 2.5; ctx.strokeStyle = big ? '#fff3c4' : '#9cc3ff'; ctx.stroke();
        return;
      }
      if (A.rig) {                                                  // the rig's own head
        const SK = root.Rig.SKEL[root.Rig.RIGS[A.rig] || A.rig] || {}, I = im(SK.dir + 'head.webp?v=' + SK.ver);
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#2c4a7a'; ctx.fill(); ctx.clip();
        if (ok(I)) { const k = r * 2.3 / I.naturalHeight; ctx.drawImage(I, cx - I.naturalWidth * k * 0.5, cy - I.naturalHeight * k * 0.42, I.naturalWidth * k, I.naturalHeight * k); }
        ctx.restore(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = big ? 4 : 2.5; ctx.strokeStyle = big ? '#fff3c4' : '#9cc3ff'; ctx.stroke();
        return;
      }
      if (!ok(A.img)) return;
      const [row, col] = A.idle;
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = x.side === 'L' ? '#2c4a7a' : '#7a2c2c'; ctx.fill(); ctx.clip();
      const head = A.base * 0.62, k = (r * 2.3) / Math.max(1, head);   // the upper part of the body fills the circle
      ctx.translate(cx, cy + r * 0.25); ctx.scale((x.side === 'L' ? 1 : -1) * (x.art.type === 'mon' ? -1 : 1), 1);
      ctx.drawImage(A.img, col * A.cw, row * A.ch, A.cw, A.ch, -A.ax * k, -(A.base - head * 0.15) * k * 0.62 - r * 0.2, A.cw * k, A.ch * k);
      ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = big ? 4 : 2.5; ctx.strokeStyle = big ? '#fff3c4' : x.side === 'L' ? '#9cc3ff' : '#ff9c9c'; ctx.stroke();
    }
    function drawTimeline(dt) {
      const x0 = W * 0.05, x1 = W * 0.66, y = H * 0.1, r = Math.max(13, H * 0.036);
      ctx.save(); ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(40,70,120,.85)'; ctx.lineWidth = r * 0.55; ctx.beginPath(); ctx.moveTo(x0, y - r * 0.35); ctx.lineTo(x1, y - r * 0.35); ctx.stroke();
      ctx.strokeStyle = 'rgba(130,40,40,.85)'; ctx.beginPath(); ctx.moveTo(x0, y + r * 0.35); ctx.lineTo(x1, y + r * 0.35); ctx.stroke();
      ctx.restore();
      const list = B().timeline(b, 1), T = Math.max(1, ...list.map(e => e.t)) * 1.05;
      const seen = new Set();
      list.forEach(e => {
        const want = x0 + (x1 - x0) * Math.min(1, e.t / T);
        const cur = tl.has(e.u) ? tl.get(e.u) : want, nx = cur + (want - cur) * Math.min(1, dt * 10);  // portraits glide
        tl.set(e.u, nx); seen.add(e.u);
      });
      [...tl.keys()].forEach(k => { if (!seen.has(k)) tl.delete(k); });
      const order = [...seen].sort((a, c) => tl.get(c) - tl.get(a));
      order.forEach(x => { const big = b.ready === x || (anim && anim.actor === x); portrait(x, tl.get(x), y + (x.side === 'L' ? -r * 1.15 : r * 1.15), big ? r * 1.35 : r, big); });
    }

    // ---- turns ----
    function begin(ev) {
      vis.get(ev.actor).acts = (vis.get(ev.actor).acts || 0) + (ev.hits.length ? 1 : 0);
      const a = ev.actor, s = spot(a), melee = ev.hits.length && !a.ranged && a.art.type !== 'ally-cast';
      const t0 = simT;
      const target = ev.hits[0] && ev.hits[0].target;
      anim = { ev, actor: a, t0, melee: ev.hits.length > 0 && !a.ranged, ranged: ev.hits.length > 0 && a.ranged, from: s, to: target ? spot(target) : null,
        dur: ev.hits.length ? (a.ranged ? 0.85 : 0.78) + (ev.hits.length - 1) * 0.28 : 0.8, applied: 0 };
      const C = art(a).clip;
      if (C) {                                                  // v152 timings follow the clip: the blow lands on the clip's hit frame
        const M = n => C.acts[n], nh = ev.hits.length;
        if (nh && ev.type === 'attack' && !a.ranged) {
          const AT = C.attacks || ['atkA', 'atkB', 'atkC'], act = AT[((vis.get(a).acts || 1) - 1) % AT.length], m = M(act);
          anim.clipAct = act; anim.hitT = Math.max(0.3, m.hit / m.fps); anim.backAt = Math.max(anim.hitT + 0.15 + (nh - 1) * 0.28, m.n / m.fps - 0.25);
          anim.dur = anim.backAt + 0.25;
        } else if (nh && M('skill')) {                           // a skill that hits: charged slash from where he stands
          const m = M('skill'); anim.clipAct = 'skill'; anim.melee = false; anim.ranged = false; anim.inPlace = true;
          anim.hitT = m.hit / m.fps; anim.dur = m.n / m.fps;
        } else {
          const act = ev.type === 'item' ? 'potion' : 'guard', m = M(act);
          if (m) { anim.clipAct = act; anim.landT = m.hit / m.fps; anim.dur = m.n / m.fps; }
        }
      }
      if (ev.type === 'skill' || ev.type === 'item') pops.push({ text: ev.type === 'item' ? 'ยาฟื้นฟู' : B().SKILLS[ev.id].name, x: s.x, y: s.gy - 330 * u * s.sc, t0, color: '#ffe7a8' });
    }
    function applyHit(h, at) {
      const v = vis.get(h.target), s = spot(h.target);
      if (h.miss) { v.hitAt = at; v.pose = 'dodge'; v.poseUntil = at + 0.35; v.knock = 1; pops.push({ text: 'หลบ!', x: s.x, y: s.gy - 260 * u * s.sc, t0: at, color: '#dfe8ff' }); return; }
      const HC = art(h.target).clip;
      v.hitAt = at; v.flash = 1; v.knock = 1; v.pose = h.killed ? 'down' : 'hit'; v.poseUntil = h.killed ? 1e9 : at + (HC && HC.acts.hit ? HC.acts.hit.n / HC.acts.hit.fps : 0.38);
      v.dp = Math.max(0, v.dp - h.took); v.ds = Math.max(0, v.ds - h.broke);       // the pips go now, as the blow lands
      shake = { t: at, a: (h.took + h.broke) * 7 + (h.killed ? 6 : 0) };
      stopUntil = performance.now() + 75;                                     // hit-stop
      const nb = Math.round(h.broke * 6), nt = Math.round(h.took * 6);
      for (let i = 0; i < nb + nt; i++) pops.push({ shard: true, x: s.x, y: s.gy - 300 * u * s.sc, vx: (Math.random() - 0.5) * 300 * u, vy: -Math.random() * 380 * u, t0: at, color: i < nb ? '#f4f7ff' : '#e8483f' });
      if (h.cut) for (let i = 0; i < 5; i++) pops.push({ shard: true, x: s.x - s.dir * 30 * u, y: s.gy - 220 * u * s.sc, vx: (Math.random() - 0.5) * 420 * u, vy: -Math.random() * 300 * u, t0: at, color: '#c9d3df' });   // armour clink
      if (h.killed) v.dieAt = at;
    }
    function updateAnim(t) {
      if (!anim) return;
      const k = t - anim.t0, ev = anim.ev, a = anim.actor, v = vis.get(a);
      const n = ev.hits.length, hitTimes = ev.hits.map((_, i) => (anim.hitT != null ? anim.hitT : anim.ranged ? 0.42 : 0.34) + i * 0.28);
      while (anim.applied < n && k >= hitTimes[anim.applied]) { applyHit(ev.hits[anim.applied], t); anim.applied++; }
      if (!n && !anim.done && k > (anim.landT != null ? anim.landT : 0.35)) {                                       // shield, heal, potion land
        anim.done = true; const tgt = ev.target, s = tgt && spot(tgt);
        if (s) {
          sync(tgt);
          if (ev.shield) pops.push({ text: '', x: s.x, y: s.gy - 280 * u * s.sc, t0: t, ring: '#cfe0ff' });
          if (ev.heal) pops.push({ text: '', x: s.x, y: s.gy - 280 * u * s.sc, t0: t, ring: '#7dffa0' });
          if (ev.guard) pops.push({ text: '', x: s.x, y: s.gy - 280 * u * s.sc, t0: t, ring: '#b8c4d4' });
          if (ev.type === 'skill' && B().SKILLS[ev.id] && B().SKILLS[ev.id].push) pops.push({ text: 'เร็วขึ้น!', x: s.x, y: s.gy - 280 * u * s.sc, t0: t, color: '#ffe27a', big: true, ring: '#ffe27a' });
        }
      }
      if (k >= anim.dur) { b.units.forEach(sync); anim = null; phase = 'advance'; phaseT = t; }
    }
    // the acting unit's position and pose during its action
    function actorState(x, s, t) {
      const v = vis.get(x);
      let px = s.x, pose = 'idle';
      if (anim && anim.actor === x) {
        const k = t - anim.t0;
        if (anim.melee && anim.to) {
          // wind-up · dash · strike · snap back (no walking)
          const stand = anim.to.x - s.dir * 150 * u * anim.to.sc;
          const go = anim.clipAct ? easeIn(seg(k, Math.max(0.05, anim.hitT - 0.28), anim.hitT - 0.06)) : easeIn(seg(k, 0.1, 0.24));
          const back = anim.clipAct ? easeOut(seg(k, anim.backAt, anim.backAt + 0.2)) : easeOut(seg(k, 0.5 + (anim.ev.hits.length - 1) * 0.28, 0.7 + (anim.ev.hits.length - 1) * 0.28));
          px = s.x + (stand - s.x) * go * (1 - back);
          const hk = k - (anim.ev.hits.length - 1) * 0.28 * (k > 0.6 ? 1 : 0);
          pose = k < 0.1 ? 'wind' : k < 0.3 ? 'wind' : k < 0.44 ? 'strike' : k < 0.62 + (anim.ev.hits.length - 1) * 0.28 ? 'follow' : 'idle';
          if (anim.ev.hits.length > 1 && k > 0.3 && k < 0.3 + anim.ev.hits.length * 0.28) pose = Math.floor((k - 0.3) / 0.14) % 2 ? 'follow' : 'strike';
          if (go > 0.05 && go < 0.98 || back > 0.02 && back < 0.95) {   // after-images while dashing
            for (let i = 1; i <= 3; i++) drawUnit(x, pose, px - s.dir * i * 40 * u, s.gy, s.sc, 0.18 / i, 0, t);
          }
        } else if (anim.ranged) pose = k < 0.25 ? 'wind' : k < 0.6 + (anim.ev.hits.length - 1) * 0.28 ? 'strike' : 'follow';
        else pose = k < 0.2 ? 'wind' : k < 0.7 ? 'cast' : 'idle';
      }
      if (v.pose && t < v.poseUntil) pose = v.pose;
      if (v.knock > 0) { px -= s.dir * 34 * u * Math.sin(v.knock * Math.PI) * (v.pose === 'dodge' ? 1.4 : 1); }
      return { px, pose };
    }
    function drawProjectiles(t) {
      if (!anim || !anim.ranged || !anim.to) return;
      const k = t - anim.t0;
      anim.ev.hits.forEach((h, i) => {
        const a0 = 0.22 + i * 0.28, q = seg(k, a0, a0 + 0.2); if (q <= 0 || q >= 1) return;
        const s = anim.from, d = spot(h.target), x = s.x + (d.x - s.x) * q, y = (s.gy - 200 * u * s.sc) + (d.gy - 180 * u * d.sc - (s.gy - 200 * u * s.sc)) * q - Math.sin(q * Math.PI) * 60 * u;
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(d.gy - s.gy, d.x - s.x) * 0.3 + (d.x > s.x ? 0 : Math.PI));
        ctx.strokeStyle = anim.actor.art.type === 'ally' && anim.actor.name.includes('นักบวช') ? '#ffd36b' : '#6b4a2b'; ctx.lineWidth = Math.max(2, 6 * u);
        ctx.beginPath(); ctx.moveTo(-60 * u, 0); ctx.lineTo(20 * u, 0); ctx.stroke(); ctx.restore();
      });
    }
    function drawPops(t) {
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i], q = (t - p.t0) / (p.shard ? 0.6 : 0.9); if (q >= 1) { pops.splice(i, 1); continue; }
        ctx.save(); ctx.globalAlpha = 1 - q * q;
        if (p.shard) { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x + p.vx * q, p.y + p.vy * q + 700 * u * q * q, Math.max(2, 6 * u * (1 - q)), 0, Math.PI * 2); ctx.fill(); }
        else {
          if (p.ring) { ctx.strokeStyle = p.ring; ctx.lineWidth = Math.max(2, 6 * u * (1 - q)); ctx.beginPath(); ctx.ellipse(p.x, p.y + 230 * u, 80 * u * (0.5 + q), 18 * u * (0.5 + q), 0, 0, Math.PI * 2); ctx.stroke(); }
          const fs = Math.round((p.big ? 44 : 32) * u * (q < 0.15 ? 0.7 + q * 2 : 1));
          ctx.font = 'bold ' + Math.max(12, fs) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = Math.max(3, fs / 6); ctx.strokeStyle = 'rgba(20,10,10,.9)';
          ctx.fillStyle = p.color; const y = p.y - 50 * u * easeOut(q); ctx.strokeText(p.text, p.x, y); ctx.fillText(p.text, p.x, y);
        }
        ctx.restore();
      }
    }

    // ---- hero's turn: buttons, with a countdown; nothing pressed = a normal attack ----
    function heroButtons(x) {
      const S = B().SKILLS, wait = opts.wait || 4;
      ui.innerHTML = `<div class="bt-turn"><div class="bt-bar"><i></i></div><div class="bt-acts">` +
        `<button data-a="attack">⚔️ โจมตี</button>` +
        x.skills.map(id => `<button data-a="skill" data-id="${id}" ${x.cd[id] > 0 ? 'disabled' : ''}>${S[id].icon} ${S[id].name}${x.cd[id] > 0 ? ' (' + x.cd[id] + ')' : ''}<small>${S[id].desc}</small></button>`).join('') +
        `<button data-a="item" ${b.potions > 0 && x.pips < x.max ? '' : 'disabled'}>🧪 ยา (${b.potions})<small>ฟื้น 1 จุด</small></button></div></div>`;
      const bar = ui.querySelector('.bt-bar i'); bar.style.animationDuration = wait + 's';
      ui.querySelectorAll('button[data-a]').forEach(btn => btn.onclick = () => {
        const a = btn.dataset.a;
        choose(a === 'attack' ? { type: 'attack' } : a === 'item' ? { type: 'item', id: 'potion', target: x } : { type: 'skill', id: btn.dataset.id, target: B().SKILLS[btn.dataset.id].target === 'foe' ? null : x });
      });
      waitHero = { x, until: performance.now() / 1000 + wait };
    }
    function choose(a) {
      if (!waitHero) return; const x = waitHero.x; waitHero = null; ui.innerHTML = '';
      if (a && a.type === 'skill' && B().SKILLS[a.id].target === 'foe') a.target = null;
      const ev = B().act(b, x, a && a.type === 'attack' ? { type: 'attack', target: null } : a); if (ev) begin(ev);
    }
    function advance(t) {
      if (b.over) { if (phase !== 'end') { phase = 'end'; phaseT = t; } return; }
      if (t - phaseT < 0.16) return;                                  // a breath between turns so the bar can glide
      const x = B().step(b); if (!x) return;
      if (x.kind === 'hero' && !auto) { phase = 'hero'; heroButtons(x); return; }
      phase = 'act'; const ev = B().act(b, x); if (ev) begin(ev);
    }

    let last = performance.now() / 1000, endSent = false;
    function frame() {
      if (stopped) return;
      const real = performance.now() / 1000, frozen = performance.now() < stopUntil;
      const dt = frozen ? 0 : Math.min(0.05, real - last) * speed; last = real; simT += dt;
      const t = simT;
      if (phase === 'advance') advance(t);
      if (phase === 'hero' && waitHero && real > waitHero.until) choose({ type: 'attack' });
      updateAnim(t);
      for (const v of vis.values()) { v.flash = Math.max(0, v.flash - dt * 5); v.knock = Math.max(0, v.knock - dt * 3.2); }
      // draw
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const sq = seg(t, shake.t, shake.t + 0.3), sa = shake.a * (1 - sq) * (1 - sq) * u * 1.4;
      ctx.translate(Math.sin(t * 97) * sa, Math.cos(t * 71) * sa * 0.6);
      if (ok(bg)) { const s = Math.max(W / bg.naturalWidth, H / bg.naturalHeight) * 1.03; ctx.drawImage(bg, (W - bg.naturalWidth * s) / 2, (H - bg.naturalHeight * s) / 2, bg.naturalWidth * s, bg.naturalHeight * s); }
      else { ctx.fillStyle = '#334'; ctx.fillRect(0, 0, W, H); }
      ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(-20, -20, W + 40, H + 40);
      const order = b.units.slice().sort((p, q) => spot(p).gy - spot(q).gy || (anim && anim.actor === p ? 1 : anim && anim.actor === q ? -1 : 0));
      for (const x of order) {
        const s = spot(x), v = vis.get(x);
        if (!x.alive && v.dieAt !== undefined) { const DC = art(x).clip, dd = DC && DC.acts.down ? DC.acts.down.n / DC.acts.down.fps + 0.3 : 0.5; v.alpha = x.side === 'R' ? Math.max(0, 1 - seg(t, v.dieAt + dd, v.dieAt + dd + 0.6)) : 1; }
        if (v.alpha <= 0) continue;
        const st = actorState(x, s, t);
        drawUnit(x, st.pose, st.px, s.gy, s.sc, v.alpha, v.flash, t);
        if (anim && anim.actor === x && anim.melee && !anim.clipAct) {        // a white arc where the weapon swings
          const k = t - anim.t0, q = seg(k, 0.27, 0.42);
          if (q > 0 && q < 1) {
            const cx = st.px + s.dir * 60 * u * s.sc, cy = s.gy - 190 * u * s.sc, R = 150 * u * s.sc;
            const a0 = s.dir > 0 ? -1.9 : Math.PI + 1.9, a1 = s.dir > 0 ? 0.9 : Math.PI - 0.9, head = a0 + (a1 - a0) * easeOut(Math.min(1, q * 1.6)), tail = a0 + (a1 - a0) * easeIn(q);
            ctx.save(); ctx.globalAlpha = 0.85 * (1 - q); ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
            for (let i = 0; i < 3; i++) { ctx.lineWidth = Math.max(2, (14 - i * 4) * u * s.sc); ctx.globalAlpha = (0.85 - i * 0.25) * (1 - q);
              ctx.beginPath(); ctx.arc(cx, cy, R - i * 10 * u, Math.min(tail, head), Math.max(tail, head), false); ctx.stroke(); }
            ctx.restore();
          }
        }
      }
      drawProjectiles(t);
      for (const x of order) if (x.alive) { const s = spot(x); pipsOf(x, actorState(x, s, t).px, s.gy, s.sc); }
      drawPops(t);
      drawTimeline(dt);
      if (phase === 'end' && !endSent && t - phaseT > 0.9) { endSent = true; ui.innerHTML = ''; opts.onEnd && opts.onEnd(b.over, b); }
      root.requestAnimationFrame(frame);
    }
    root.requestAnimationFrame(frame);
    return {
      stop() { stopped = true; root.removeEventListener('resize', resize); ui.innerHTML = ''; },
      setAuto(v) { auto = v; if (auto && waitHero) choose({ type: 'attack' }); },
      setSpeed(v) { speed = v; },
      get auto() { return auto; },
      get debug() { return { phase, anim: anim && { actor: anim.actor.name, k: simT - anim.t0, dur: anim.dur }, ready: b.ready && b.ready.name, over: b.over, simT, waitHero: !!waitHero }; }
    };
  }
  root.BattleView = { start };
})(typeof window !== 'undefined' ? window : globalThis);
