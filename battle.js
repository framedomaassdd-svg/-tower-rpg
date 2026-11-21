/* v140 battle prototype — side-view team battle.
   Turn order runs on a speed timeline (agility): every unit fills its gauge at its own speed and acts when full,
   so a quick fighter acts more often and an opening skill can push a unit forward on the bar.
   Life is shown as pips: a normal monster has 3; skills add white shield pips that break first.
   On its turn a unit attacks (dashes to the target and snaps back), uses a skill or drinks a potion.
   The player can let the hero fight on auto or pick skills/potions when his turn comes; if nothing is pressed
   in time he simply attacks. Allies always act on their own.
   Engine (Battle.create/step/act) runs in node for tests; BattleView draws it on a canvas. */
(function (root) {
  'use strict';
  const GAUGE = 100;
  function rng(seed) { let a = seed >>> 0 || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---- skills (prototype set) ----
  // target: 'foe' | 'self' | 'ally' ; cd = own turns before it can be used again
  const SKILLS = {
    stormLance:  { name: 'หอกพายุ', icon: '⚡', target: 'foe', cd: 2, dmg: 2, desc: 'โจมตีแรง 2 จุด' },
    ironSkin:    { name: 'ผิวเหล็ก', icon: '🪨', target: 'self', cd: 4, guard: 2, desc: 'ดาเมจที่ได้รับลดครึ่งจุด 2 ตา' },
    earthBulwark:{ name: 'ปราการศิลา', icon: '🛡️', target: 'self', cd: 3, shield: 2, desc: 'ได้โล่ 2 จุด (สีขาว)' },
    quickStep:   { name: 'ก้าวพริ้ว', icon: '💨', target: 'self', cd: 3, push: 60, desc: 'ได้ตาเร็วขึ้นรอบหน้า' },
    taunt:       { name: 'ตั้งโล่ล่อเป้า', icon: '🛡️', target: 'self', cd: 3, shield: 1, taunt: 2, desc: 'โล่ 1 จุด และดึงความสนใจศัตรู' },
    mend:        { name: 'แสงเยียวยา', icon: '✨', target: 'ally', cd: 2, heal: 1, desc: 'ฟื้น 1 จุดให้เพื่อนที่เจ็บที่สุด' },
    volley:      { name: 'ยิงสองดอก', icon: '🏹', target: 'foe', cd: 2, hits: 2, desc: 'ยิง 2 ครั้ง' }
  };

  function unit(o) {
    return Object.assign({ pips: 3, max: 3, shield: 0, def: 0, guard: 0, spd: 10, pow: 20, gauge: 0, row: 0, ranged: false, skills: [], cd: {}, taunt: 0, alive: true }, o,
      { pips: Math.min(o.max || 3, o.pips === undefined ? (o.max || 3) : o.pips) });
  }
  function create(opt) {
    const r = rng(opt.seed || 1);
    const units = [...opt.allies.map(u => unit(Object.assign({ side: 'L' }, u))), ...opt.foes.map(u => unit(Object.assign({ side: 'R' }, u)))];
    // a small head start by speed (+ opening skills such as an ambush) so the fastest is not always tied with the rest
    units.forEach(u => { u.gauge = Math.min(GAUGE - 1, (u.first || 0) + r() * 25 + u.spd); });
    return { units, r, t: 0, log: [], over: null, potions: opt.potions || 0, ready: null };
  }
  const alive = (b, side) => b.units.filter(u => u.alive && (!side || u.side === side));
  const foesOf = (b, u) => alive(b, u.side === 'L' ? 'R' : 'L');
  // time until each unit acts next (for the timeline)
  function timeline(b, n) {
    const out = [];
    for (const u of alive(b)) { let t = (GAUGE - u.gauge) / u.spd; for (let i = 0; i < (n || 2); i++) { out.push({ u, t }); t += GAUGE / u.spd; } }
    return out.sort((a, c) => a.t - c.t);
  }
  // advance the clock until the next unit is ready; returns that unit
  function step(b) {
    if (b.over) return null;
    if (b.ready) return b.ready;
    const next = timeline(b, 1)[0]; if (!next) return null;
    const dt = Math.max(0, next.t);
    for (const u of alive(b)) u.gauge += u.spd * dt;
    b.t += dt; next.u.gauge = GAUGE; b.ready = next.u;
    return next.u;
  }
  function targetFor(b, u) {
    const foes = foesOf(b, u); if (!foes.length) return null;
    const taunting = foes.filter(f => f.taunt > 0); if (taunting.length && !u.ranged) return taunting[0];
    // melee reaches the front row first; ranged picks the weakest
    const front = foes.filter(f => f.row === 0), pool = u.ranged || !front.length ? foes : front;
    return pool.slice().sort((a, c) => (a.pips + a.shield) - (c.pips + c.shield) || a.row - c.row)[0];
  }
  // what a unit will do on its own (allies, monsters, and the hero on auto)
  function decide(b, u) {
    const ready = id => SKILLS[id] && u.skills.includes(id) && !(u.cd[id] > 0);
    const friends = alive(b, u.side), hurt = friends.filter(f => f.pips < f.max).sort((a, c) => a.pips / a.max - c.pips / c.max)[0];
    if (u.side === 'L' && u.kind === 'hero' && b.potions > 0 && u.pips <= 1 && u.max > 1) return { type: 'item', id: 'potion', target: u };
    if (ready('mend') && hurt && hurt.pips < hurt.max) return { type: 'skill', id: 'mend', target: hurt };
    if (ready('taunt') && u.shield === 0 && foesOf(b, u).length) return { type: 'skill', id: 'taunt', target: u };
    if (ready('earthBulwark') && u.shield === 0 && u.pips <= Math.ceil(u.max / 2)) return { type: 'skill', id: 'earthBulwark', target: u };
    if (ready('ironSkin') && u.guard === 0 && u.pips < u.max) return { type: 'skill', id: 'ironSkin', target: u };
    const t = targetFor(b, u);
    if (ready('stormLance') && t) return { type: 'skill', id: 'stormLance', target: t };
    if (ready('volley') && t) return { type: 'skill', id: 'volley', target: t };
    return { type: 'attack', target: t };
  }
  // one blow: hit chance from power, 1 pip (2 for a much stronger attacker). Heavy armour (def ≥ 60% of the
  // attacker's power) or a damage-reduction buff takes off half a pip each (never below half). Shields break first.
  function blow(b, a, t, dmg) {
    const ratio = (a.pow - t.pow) / (a.pow + t.pow), p = Math.max(0.2, Math.min(0.95, 0.74 + 0.3 * ratio - (t.dodge || 0)));
    if (b.r() > p) return { target: t, miss: true };
    let d = dmg || (a.pow >= t.pow * 1.8 ? 2 : 1), cut = 0;
    if (t.def >= a.pow * 0.6) cut += 0.5;
    if (t.guard > 0) cut += 0.5;
    d = Math.max(0.5, d - cut);
    const broke = Math.min(t.shield, d); t.shield -= broke; d -= broke;
    const took = Math.min(t.pips, d); t.pips -= took;
    if (t.pips <= 0) { t.pips = 0; t.alive = false; t.gauge = 0; }
    return { target: t, took, broke, cut, killed: !t.alive };
  }
  function act(b, u, a) {
    if (!u || !u.alive || b.over) return null;
    a = a || decide(b, u);
    const ev = { actor: u, type: a.type, id: a.id, hits: [], heal: 0, shield: 0 };
    let t = a.target && a.target.alive ? a.target : null;
    if (a.type === 'attack') { t = t && t.side !== u.side ? t : targetFor(b, u); if (t) ev.hits.push(blow(b, u, t)); }
    else if (a.type === 'item') { if (b.potions > 0 && u.pips < u.max) { b.potions--; u.pips = Math.min(u.max, u.pips + 1); ev.heal = 1; ev.target = u; } }
    else if (a.type === 'skill') {
      const S = SKILLS[a.id]; u.cd[a.id] = S.cd + 1;
      if (S.target === 'foe') { t = t && t.side !== u.side ? t : targetFor(b, u); if (t) for (let i = 0; i < (S.hits || 1); i++) if (t.alive) ev.hits.push(blow(b, u, t, S.dmg)); }
      if (S.shield) { u.shield += S.shield; ev.shield = S.shield; ev.target = u; }
      if (S.taunt) u.taunt = S.taunt;
      if (S.guard) { u.guard = S.guard + 1; ev.guard = S.guard; ev.target = u; }
      if (S.push) u.gauge = S.push;                                       // starts the next wait part-way full
      if (S.heal) { const f = t && t.side === u.side ? t : alive(b, u.side).sort((x, y) => x.pips / x.max - y.pips / y.max)[0]; if (f && f.pips < f.max) { f.pips = Math.min(f.max, f.pips + S.heal); ev.heal = S.heal; ev.target = f; } }
    }
    ev.target = ev.target || t;
    for (const k in u.cd) if (u.cd[k] > 0) u.cd[k]--;
    if (u.taunt > 0) u.taunt--;
    if (u.guard > 0) u.guard--;
    if (!(a.type === 'skill' && SKILLS[a.id].push)) u.gauge = 0;
    b.ready = null;
    if (!alive(b, 'R').length) b.over = 'win'; else if (!alive(b, 'L').some(x => x.kind === 'hero')) b.over = 'lose';
    b.log.push(ev);
    return ev;
  }
  // pips by rank for monsters (normal 3 … legendary 9), pack leaders +2, guardians +5
  const RANK_PIPS = { Normal: 3, Soldier: 4, Captain: 5, General: 6, King: 7, Emperor: 8, Legendary: 9 };
  const monsterPips = m => (RANK_PIPS[m.rank] || 3) + (m.elite ? 2 : 0) + (m.boss ? 5 : 0);
  const api = { create, step, act, decide, timeline, alive, SKILLS, GAUGE, monsterPips, RANK_PIPS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Battle = api;
})(typeof window !== 'undefined' ? window : globalThis);
