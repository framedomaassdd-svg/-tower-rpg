/* v108 skills, titles, equipment and combat.
   Stats only grow from three sources: passive skills (by tier), equipment and the active title.
   st.base holds the character's own stats; st.strength / agility / intelligence are recomputed from it (recalc).
   Every skill has 5 tiers. Using it fills a proficiency bar; when the bar is full it stops, and a promotion trial
   must be passed to reach the next tier (the bar starts again, longer, and the skill gets stronger). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Skills = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TIERS = Object.freeze([
    { name: 'ฝึกหัด', cap: 20 }, { name: 'ชำนาญ', cap: 40 }, { name: 'เชี่ยวชาญ', cap: 80 },
    { name: 'ยอดฝีมือ', cap: 160 }, { name: 'ปรมาจารย์', cap: 0 }
  ]);
  const STAT_NAME = { strength: 'กำลัง', agility: 'คล่องตัว', intelligence: 'ปัญญา', magicPower:'พลังเวท' };
  // trial: what has to happen (progress(kind, value)) and how many times, for promotion out of tier t (1..4)
  const SKILLS = Object.freeze({
    // v118 long hidden quest rewards; passive stats remain tier-based, no hero levels.
    survivalInstinct:{name:'สัญชาตญาณเอาชีวิตรอด',type:'passive',icon:'🛡️',stat:{agility:[3,9,16,24,33]},desc:'อ่านอันตรายและเอาตัวรอด',teacher:'หัวหน้าคนแบกของ',trial:t=>({on:'clean_win',need:4+t,text:'รอดจากการต่อสู้โดยไม่บาดเจ็บ'})},
    partyOath:{name:'สัญญาร่วมรบ',type:'passive',icon:'🤝',stat:{strength:[3,7,12,18,25]},desc:'เมื่ออยู่กับทีม พันธมิตรช่วยได้แรงขึ้น',teacher:'ครูฝึกคณะสำรวจ',trial:t=>({on:'win',need:4+t,text:'ชนะศัตรูพร้อมทีม'})},
    homeResolve:{name:'แรงใจจากบ้าน',type:'passive',icon:'🏠',stat:{strength:[4,9,17,27,37],agility:[2,5,9,14,20]},desc:'เจตจำนงที่จะกลับบ้านเพิ่มความสามารถ',teacher:'ผู้ดูแลจดหมาย',trial:t=>({on:'deep_map',need:3+t,text:'กลับมาพร้อมหลักฐานหอคอย'})},
    riftStrike:{name:'รอยแยกพิฆาต',type:'active',icon:'🌀',power:[18,32,52,76,108],desc:'วิชาลับสร้างการโจมตีทะลวงเมื่อวงล้อออกสกิล',teacher:'อดีตปรมาจารย์ผู้ไร้นาม',trial:t=>({on:'elite_win',need:2+t,text:'กำจัดจ่าฝูงเพื่อเพิ่มขั้น'})},
    limitBreak:{name:'ทะลวงขอบเขต',type:'active',icon:'💥',power:[25,44,70,102,145],desc:'แอ็กทีฟระดับสูงสุดของครึ่งแรก โจมตีเป็นจังหวะรุนแรง',teacher:'ผู้เฝ้าประตูชั้นลึก',trial:t=>({on:'boss_win',need:2+t,text:'พิชิตผู้พิทักษ์เพิ่มเติม'})},
    brawn:     { name: 'แขนแกร่ง', type: 'passive', icon: '💪', stat: { strength: [4, 9, 15, 22, 30] }, desc: 'กำลังเพิ่มตามขั้น',
                 teacher: 'หัวหน้าสมาคมคนแบกของ', trial: t => ({ on: 'haul', need: 4 + t, text: 'แบกของเต็มวันโดยไม่หมดแรง ' + (4 + t) + ' วัน' }) },
    nimble:    { name: 'เท้าไว', type: 'passive', icon: '🦶', stat: { agility: [4, 9, 15, 22, 30] }, desc: 'คล่องตัวเพิ่มตามขั้น',
                 teacher: 'ครูฝึกกิลด์', trial: t => ({ on: 'clean_win', need: 2 + t, text: 'ชนะการต่อสู้โดยไม่บาดเจ็บ ' + (2 + t) + ' ครั้ง' }) },
    keen:      { name: 'ตาไว', type: 'passive', icon: '👁️', stat: { intelligence: [4, 9, 15, 22, 30] }, desc: 'ปัญญาเพิ่มตามขั้น',
                 teacher: 'หัวหน้ากิลด์เข็มทิศเงิน', trial: t => ({ on: 'study', need: 4 + t, text: 'ศึกษาแผนที่หรือตีราคาของ ' + (4 + t) + ' วัน' }) },
    ironBack: { name:'กระดูกเหล็ก', type:'passive', icon:'🪨', stat:{strength:[3,7,12,18,25]},
      desc:'ทนงานหนักจากการฝึกกับผู้แบก', teacher:'หัวหน้าสมาคมคนแบกของ',
      trial:t=>({on:'haul',need:4+t,text:'ทำงานแบกของเต็มวัน '+(4+t)+' วัน'}) },
    trailEye: { name:'ตาพรานทางลึก', type:'passive', icon:'🧭', stat:{intelligence:[3,7,12,18,25]},
      desc:'อ่านร่องรอยและแผนที่', teacher:'หัวหน้ากิลด์เข็มทิศเงิน',
      trial:t=>({on:'study',need:4+t,text:'ศึกษาแผนที่ '+(4+t)+' วัน'}) },
    battleStep: { name:'ย่างก้าวนักรบ', type:'passive', icon:'👣', stat:{agility:[3,7,12,18,25]},
      desc:'ฝีเท้าที่ครูฝึกถ่ายทอด', teacher:'ครูฝึกโล่เหล็ก',
      trial:t=>({on:'clean_win',need:3+t,text:'ชนะโดยไม่บาดเจ็บ '+(3+t)+' ครั้ง'}) },
    herbalLore: { name:'ความรู้พิษและยา', type:'passive', icon:'🌱', stat:{intelligence:[2,5,9,14,20]},
      desc:'เข้าใจสมุนไพรและพิษในธรรมชาติ', teacher:'หมอยาประจำเมือง',
      trial:t=>({on:'find',need:3+t,text:'พบวัตถุดิบ '+(3+t)+' ครั้ง'}) },
    sunfall:   { name: 'สุริยะพิพากษา', type: 'active', icon: '☀️', power: [12, 21, 34, 50, 72],
                 desc: 'วิชาลับจากปรมาจารย์เพลิง ปะทุหนักเมื่อสัญลักษณ์สกิลหรือไฟปรากฏบนวงล้อ', teacher: 'ปรมาจารย์เพลิง',
                 trial: t => ({ on: 'boss_win', need: t + 1, text: 'สยบผู้พิทักษ์ชั้น ' + (t + 1) + ' ครั้ง' }) },
    winterSeal:{ name: 'ผนึกเหมันต์', type: 'active', icon: '❄️', power: [10, 18, 30, 44, 62],
                 desc: 'วิชาลับผนึกการเคลื่อนไหว ลดพลังและภัยถึงชีวิตเมื่อสล็อตเข้าสู่จังหวะน้ำแข็ง', teacher: 'ผู้พิทักษ์ธารน้ำแข็ง',
                 trial: t => ({ on: 'elite_win', need: t + 1, text: 'พิชิตจ่าฝูง ' + (t + 1) + ' ครั้ง' }) },
    fire:      { name: 'เพลิงวิญญาณ', type: 'active', icon: '🔥', power: [6, 12, 21, 32, 46], desc: 'ไฟปรากฏบนวงล้อต่อสู้เมื่อเลือกใช้สกิลนี้', teacher: 'ผู้จดตำราในเซฟโซน', trial: t => ({ on: 'win', min: 10 + 10 * t, need: 3, text: 'ชนะมอนสเตอร์พลังสูง 3 ครั้ง' }) },
    ice:       { name: 'ไอเยือกแข็ง', type: 'active', icon: '🧊', power: [5, 11, 19, 29, 42], desc: 'น้ำแข็งปรากฏบนวงล้อต่อสู้เมื่อเลือกใช้สกิลนี้', teacher: 'ผู้จดตำราในเซฟโซน', trial: t => ({ on: 'win', min: 10 + 10 * t, need: 3, text: 'ชนะมอนสเตอร์พลังสูง 3 ครั้ง' }) },
    fireBody: { name: 'กายาไฟ', type: 'passive', icon: '🔥', stat: { strength: [2, 4, 6, 8, 10] }, desc: 'เพิ่มพลังเล็กน้อย',
      trigger: { when: 'hpLost', value: 0.4 }, effect: { kind: 'summon', power: [0, 20, 38, 60, 90], name: 'จิตวิญญาณไฟ', icon: '🔥' },
      teacher: 'ผู้จดตำราในเซฟโซน', trial: t => ({ on: 'win', min: 10 + t * 10, need: 3, text: 'ชนะมอนสเตอร์พลังสูง 3 ครั้ง' }) },
    iceSkin: { name: 'ผิวน้ำแข็ง', type: 'passive', icon: '🧊', desc: 'ลดอันตรายในจังหวะวิกฤต',
      trigger: { when: 'hpBelow', value: 35 }, effect: { kind: 'shield', power: [0, 0.5, 0.5, 0.5, 0.5], name: 'เกราะน้ำแข็ง', icon: '🧊' },
      teacher: 'ผู้จดตำราในเซฟโซน', trial: t => ({ on: 'win', min: 10 + t * 10, need: 3, text: 'ชนะมอนสเตอร์พลังสูง 3 ครั้ง' }) },
    lastStand: { name: 'สู้ตาย', type: 'passive', icon: '⚡', desc: 'พลิกสถานการณ์เฉียดตายวันละครั้ง',
      trigger: { when: 'nearDeath' }, effect: { kind: 'boost', power: [0, 1.5, 1.5, 1.5, 1.5], name: 'แรงเฮือกสุดท้าย', icon: '⚡' },
      oncePerDay: true, teacher: 'ครูฝึกกิลด์', trial: t => ({ on: 'win', min: 10 + t * 10, need: 3, text: 'ชนะมอนสเตอร์พลังสูง 3 ครั้ง' }) },
    shadowStep: { name: 'ก้าวเงา', type: 'passive', icon: '🌑', desc: 'ถอยหนีเมื่อต้องสู้เพียงลำพัง',
      trigger: { when: 'outnumbered' }, effect: { kind: 'escape', power: [0, 1, 1, 1, 1], name: 'ก้าวเงา', icon: '🌑' },
      teacher: 'ครูฝึกกิลด์', trial: t => ({ on: 'clean_win', need: 2 + t, text: 'เอาตัวรอดจากการต่อสู้ ' + (2 + t) + ' ครั้ง' }) },
    dangerSense: { name: 'ญาณระวังภัย', type: 'passive', icon: '👁️', stat: { agility: [2, 5, 8, 12, 17] }, desc: 'ลดโอกาสอันตรายในการสำรวจ', teacher: 'ผู้จดตำราในเซฟโซน', trial: t => ({ on: 'deep_map', need: 1 + t, text: 'สำรวจชั้นลึกเพิ่มเติม' }) },
    sword:     { name: 'วิชาดาบ', type: 'active', icon: '⚔️', power: [4, 9, 16, 25, 36], desc: 'ฟันสองจังหวะเมื่อ ✨ ขึ้นบนวงล้อ เพิ่มพลังต่อสู้',
                 teacher: 'หัวหน้ากิลด์โล่เหล็ก', trial: t => { const m = [15, 30, 50, 75][t - 1]; return { on: 'win', min: m, need: 3, text: 'ชนะมอนสเตอร์พลัง ' + m + ' ขึ้นไป 3 ครั้ง' }; } },
    smithing:  { name: 'ตีเหล็ก', type: 'life', icon: '🔨', desc: 'จังหวะมินิเกมตีเหล็กกว้างขึ้น ค่าแรงช่างเพิ่ม',
                 teacher: 'ช่างตีเหล็ก', trial: t => ({ on: 'stars:smith', min: 5 + t, need: 3, text: 'ตีเหล็กได้ ' + (5 + t) + ' ดาวขึ้นไป 3 ครั้ง' }) },
    cooking:   { name: 'ทำอาหาร', type: 'life', icon: '🍳', desc: 'จังหวะหั่นผักกว้างขึ้น ค่าแรงครัวเพิ่ม',
                 teacher: 'พ่อครัว', trial: t => ({ on: 'stars:kitchen', min: 5 + t, need: 3, text: 'หั่นผักได้ ' + (5 + t) + ' ดาวขึ้นไป 3 ครั้ง' }) },
    mapping:   { name: 'ทำแผนที่', type: 'life', icon: '🧭', desc: 'ค่าแรงทีมสำรวจเพิ่ม เจอของในหอคอยบ่อยขึ้น',
                 teacher: 'หัวหน้ากิลด์เข็มทิศเงิน', trial: t => ({ on: 'deep_map', need: 1 + t, text: 'ทำแผนที่ภารกิจบุกชั้นลึกสำเร็จ ' + (1 + t) + ' ครั้ง' }) },
    haggling:  { name: 'ต่อรอง', type: 'life', icon: '⚖️', desc: 'ค่าแรงตีราคาและงานตลาดเพิ่ม',
                 teacher: 'หัวหน้ากิลด์พ่อค้าหอคอย', trial: t => ({ on: 'appraise', need: 4 + t, text: 'ตีราคาของหรือค้าขาย ' + (4 + t) + ' วัน' }) },
    gathering: { name: 'คุ้ยหาของ', type: 'life', icon: '🧺', desc: 'เจอของดีในลานของเก่าและในทุ่งบ่อยขึ้น',
                 teacher: 'ป้าโรงทาน', trial: t => ({ on: 'find', need: 1 + t, text: 'เจอของดีจากการคุ้ยหา ' + (1 + t) + ' ครั้ง' }) }
  });
  // v116 multi-chapter NPC mentorship. Each stage needs real-world milestones AND a return
  // visit to the teacher. An NPC's final teaching may begin above tier 1; the normal
  // proficiency and promotion-trial rules remain unchanged afterwards.
  // `objectives` is kept as chapter 1 to migrate in-progress v115 saves without loss.
  const SKILL_QUESTS = Object.freeze({
    porterTraining: { name:'หลังเหล็กของผู้แบก', npc:'หัวหน้าสมาคมคนแบกของ', place:'porter', reward:'ironBack', rewardTier:2,
      minWins:0, objectives:[{on:'haul',need:4,text:'ทำงานแบกของเต็มวัน'}],
      stages:[
        { name:'เส้นทางของผู้แบก', objectives:[{on:'haul',need:8,text:'ทำงานแบกของต่อ'}, {on:'find',need:3,text:'ค้นพบเสบียงหรือวัตถุดิบ'}] },
        { name:'บททดสอบหลังเหล็ก', objectives:[{on:'haul',need:12,text:'แบกของเต็มวัน'}, {on:'deep_map',min:6,need:2,text:'สำรวจชั้น 6 ขึ้นไป'}] }
      ] },
    compassEye: { name:'เส้นทางที่มองไม่เห็น', npc:'หัวหน้ากิลด์เข็มทิศเงิน', place:'compass', reward:'trailEye', rewardTier:2,
      minWins:0, objectives:[{on:'study',need:4,text:'ศึกษาแผนที่หรือประเมินของ'}],
      stages:[
        { name:'อ่านเส้นทางที่สูญหาย', objectives:[{on:'study',need:8,text:'ศึกษาแผนที่'}, {on:'deep_map',min:6,need:3,text:'บันทึกชั้น 6 ขึ้นไป'}] },
        { name:'สำรวจทางที่ไร้แผน', objectives:[{on:'study',need:12,text:'ศึกษาและวิเคราะห์'}, {on:'deep_map',min:11,need:3,text:'บันทึกชั้น 11 ขึ้นไป'}] }
      ] },
    ironFootwork: { name:'สามก้าวบนคมดาบ', npc:'ครูฝึกโล่เหล็ก', place:'guild', reward:'battleStep', rewardTier:2,
      minWins:1, objectives:[{on:'clean_win',need:3,text:'ชนะโดยไม่บาดเจ็บ'}],
      stages:[
        { name:'ฟันฝ่าความผิดพลาด', objectives:[{on:'clean_win',need:5,text:'ชนะโดยไม่บาดเจ็บ'}, {on:'win',min:70,need:4,text:'ชนะศัตรูพลัง 70 ขึ้นไป'}] },
        { name:'บทพิสูจน์ฝีเท้า', objectives:[{on:'clean_win',need:7,text:'ชนะโดยไม่บาดเจ็บ'}, {on:'elite_win',need:1,text:'ชนะจ่าฝูง'}] }
      ] },
    apothecarySense: { name:'กลิ่นของภัย', npc:'หมอยาประจำเมือง', place:'apothecary', reward:'herbalLore', rewardTier:2,
      minWins:0, objectives:[{on:'find',need:3,text:'ค้นพบวัตถุดิบที่มีค่า'}],
      stages:[
        { name:'จำแนกสิ่งมีพิษ', objectives:[{on:'find',need:8,text:'ค้นพบวัตถุดิบ'}, {on:'deep_map',min:6,need:2,text:'ค้นหาวัตถุดิบบนชั้น 6 ขึ้นไป'}] },
        { name:'ตำราพิษชั้นลึก', objectives:[{on:'find',need:12,text:'สะสมประสบการณ์ค้นหา'}, {on:'deep_map',min:11,need:3,text:'สำรวจชั้น 11 ขึ้นไป'}] }
      ] },
    fireBodyTrial: { name:'เถ้าถ่านไม่ดับ', npc:'ผู้ดูแลศาลเจ้าวิญญาณ', place:'shrine', reward:'fireBody', rewardTier:3,
      minWins:3, objectives:[{on:'win',min:50,need:3,text:'ชนะมอนพลัง 50 ขึ้นไป'}],
      stages:[
        { name:'ยืนหยัดท่ามกลางเพลิง', objectives:[{on:'win',min:100,need:6,text:'ชนะมอนพลัง 100 ขึ้นไป'}, {on:'boss_win',need:1,text:'สยบบอสก่อนเซฟโซน'}] },
        { name:'พันธสัญญาจิตวิญญาณไฟ', objectives:[{on:'win',min:170,need:6,text:'ชนะศัตรูพลัง 170 ขึ้นไป'}, {on:'elite_win',need:2,text:'สยบจ่าฝูง'}] }
      ] },
    lastStandTrial: { name:'คำปฏิญาณผู้รอด', npc:'ครูฝึกโล่เหล็ก', place:'guild', reward:'lastStand', rewardTier:3,
      minWins:5, objectives:[{on:'win',min:70,need:4,text:'ชนะมอนพลัง 70 ขึ้นไป'}],
      stages:[
        { name:'ปฏิญาณใต้คมดาบ', objectives:[{on:'clean_win',need:5,text:'ชนะโดยไม่บาดเจ็บ'}, {on:'boss_win',need:1,text:'สยบบอสก่อนเซฟโซน'}] },
        { name:'ยืนหยัดจนลมหายใจสุดท้าย', objectives:[{on:'win',min:180,need:7,text:'ชนะศัตรูพลัง 180 ขึ้นไป'}, {on:'elite_win',need:2,text:'สยบจ่าฝูง'}] }
      ] },
    solarMaster: { name:'บททดสอบสุริยะพิพากษา', npc:'ปรมาจารย์เพลิงแห่งกิลด์โล่เหล็ก', place:'guild', reward:'sunfall', rewardTier:3,
      minWins:12, objectives:[{on:'boss_win',need:1,text:'ล้มผู้พิทักษ์ก่อนเซฟโซน'}, {on:'win',min:110,need:4,text:'ชนะศัตรูพลัง 110 ขึ้นไป'}],
      stages:[
        { name:'จุดประกายแห่งการพิพากษา', objectives:[{on:'win',min:170,need:6,text:'ชนะศัตรูพลัง 170 ขึ้นไป'}, {on:'elite_win',need:2,text:'ปราบจ่าฝูง'}] },
        { name:'เพลิงภายใต้การทดสอบ', objectives:[{on:'boss_win',need:1,text:'สยบบอสอีกตัว'}, {on:'win',min:240,need:7,text:'ชนะศัตรูพลัง 240 ขึ้นไป'}] },
        { name:'สืบทอดสุริยะพิพากษา', objectives:[{on:'boss_win',need:2,text:'สยบบอสอีกสองตัว'}, {on:'elite_win',need:3,text:'พิชิตจ่าฝูงอีกสามตัว'}] }
      ] },
    winterMaster: { name:'คำท้าจากผู้ผนึก', npc:'ผู้พิทักษ์ธารน้ำแข็งแห่งเข็มทิศเงิน', place:'compass', reward:'winterSeal', rewardTier:3,
      minWins:12, objectives:[{on:'elite_win',need:2,text:'ล้มจ่าฝูง'}, {on:'deep_map',need:3,text:'เดินทางขึ้นชั้นใหม่'}],
      stages:[
        { name:'อ่านร่องรอยเยือกแข็ง', objectives:[{on:'elite_win',need:2,text:'พิชิตจ่าฝูงอีกสองตัว'}, {on:'deep_map',min:11,need:3,text:'สำรวจชั้น 11 ขึ้นไป'}] },
        { name:'คลายคำสาปน้ำแข็ง', objectives:[{on:'boss_win',need:1,text:'สยบบอสก่อนเซฟโซน'}, {on:'win',min:200,need:6,text:'ชนะศัตรูพลัง 200 ขึ้นไป'}] },
        { name:'สืบทอดผนึกเหมันต์', objectives:[{on:'elite_win',need:3,text:'พิชิตจ่าฝูงสามตัว'}, {on:'boss_win',need:1,text:'สยบบอสอีกตัว'}] }
      ] }
  });
  function questChapter(Q, stage) {
    return stage > 0 ? Q.stages[stage-1] : { name:'เริ่มบททดสอบ', objectives:Q.objectives };
  }
  function questChapterCount(Q) { return 1 + Q.stages.length; }
  // v115 migration: a claimed tier-1 skill keeps the skill and skips the first
  // (already finished) chapter, but still needs the advanced mentorship chapters.
  function questRecord(st, id) {
    const rec = st.skillQuests[id], Q = SKILL_QUESTS[id];
    if (!rec || !Q) return null;
    if (!Number.isInteger(rec.stage)) {
      const v115Seen = rec.seen && typeof rec.seen === 'object' ? rec.seen : {};
      // Old quest achievements must not become reusable after converting to a higher-tier chain.
      if (!rec.history || typeof rec.history !== 'object') rec.history = {};
      for (const key of Object.keys(v115Seen)) {
        const match = /^(\d+):(.+)$/.exec(key), oldObjective = match && Q.objectives[+match[1]];
        if (oldObjective) rec.history[oldObjective.on + '|' + match[2]] = true;
      }
      if (rec.claimed && st.skills[Q.reward] && st.skills[Q.reward].tier < Q.rewardTier) {
        rec.stage = 1; rec.claimed = false; rec.accepted = true;
        rec.progress = questChapter(Q, 1).objectives.map(() => 0);
        rec.seen = {}; rec.announced = false;
        rec.legacyUpgrade = true;
      } else rec.stage = 0;
    }
    rec.stage = clamp(rec.stage, 0, questChapterCount(Q)-1);
    if (!rec.seen || typeof rec.seen !== 'object') rec.seen = {};
    if (!rec.history || typeof rec.history !== 'object') {
      rec.history = {};
      // Retain original v115 dedup for all events already credited in chapter 1.
      if (rec.stage === 0) for (const key of Object.keys(rec.seen)) {
        const match = /^(\d+):(.+)$/.exec(key), oldObjective = match && Q.objectives[+match[1]];
        if (oldObjective) rec.history[oldObjective.on + '|' + match[2]] = true;
      }
    }
    const objectives = questChapter(Q, rec.stage).objectives;
    if (!Array.isArray(rec.progress)) rec.progress = objectives.map(() => 0);
    return rec;
  }
  function questState(st, id) {
    data(st); const Q = SKILL_QUESTS[id]; if (!Q) return null;
    const rec = questRecord(st, id);
    if (rec && rec.claimed) return 'claimed';
    if ((!rec || !rec.accepted) && st.skills[Q.reward] && st.skills[Q.reward].tier >= Q.rewardTier) return 'claimed';
    if (rec && rec.accepted) {
      const objectives = questChapter(Q, rec.stage).objectives;
      return objectives.every((o,i) => (rec.progress[i] || 0) >= o.need) ? 'ready' : 'active';
    }
    return (st.towerWins || 0) >= (Q.minWins || 0) ? 'available' : 'locked';
  }
  function meetQuestNPC(st, id) {
    data(st); const Q = SKILL_QUESTS[id]; if (!Q) return {ok:false,why:'ไม่มีเควสนี้'};
    const status = questState(st, id);
    if (status === 'locked') return {ok:false,why:Q.npc+'ยังไม่ยอมมอบบททดสอบ ต้องชนะการต่อสู้ในหอคอยอย่างน้อย '+Q.minWins+' ครั้ง'};
    if (status === 'claimed') return {ok:false,why:'จบสายเควส '+Q.name+' แล้ว ไม่สามารถรับรางวัลซ้ำ'};
    if (status === 'available') {
      const stage = 0, chapter = questChapter(Q, stage);
      st.skillQuests[id] = { accepted:true, claimed:false, stage, progress:chapter.objectives.map(() => 0), seen:{}, history:{} };
      return {ok:true,stage:1,why:'พบ'+Q.npc+' รับเควสต่อเนื่อง "'+Q.name+'" บท 1/'+questChapterCount(Q)+' · '+chapter.objectives.map(o=>o.text+' '+o.need+' ครั้ง').join(' · ')};
    }
    if (status === 'active') return {ok:false,why:Q.npc+'บอกให้ทำบททดสอบบทนี้ให้ครบก่อน'};
    const rec = questRecord(st, id);
    if (rec.stage + 1 < questChapterCount(Q)) {
      rec.stage++;
      const chapter = questChapter(Q,rec.stage);
      rec.progress = chapter.objectives.map(() => 0);
      rec.seen = {}; rec.announced = false;
      return {ok:true,stage:rec.stage+1,why:'ผ่านบททดสอบแล้ว! '+Q.npc+'มอบภารกิจต่อเนื่อง บท '+(rec.stage+1)+'/'+questChapterCount(Q)+' "'+chapter.name+'" · '+chapter.objectives.map(o=>o.text+' '+o.need+' ครั้ง').join(' · ')};
    }
    // Award by raising the minimum proficiency tier, never downgrading someone
    // who trained beyond the NPC's teaching. Do not replace the selected active.
    const previous = st.skills[Q.reward] ? st.skills[Q.reward].tier : 0;
    if (!previous) train(st,Q.reward,1,true);              // a teacher's reward always goes into the book
    const learned = st.skills[Q.reward];
    if (learned.tier < Q.rewardTier) { learned.tier=Q.rewardTier; learned.xp=0; delete st.trials[Q.reward]; recalc(st); }
    rec.claimed = true;
    return {ok:true,reward:Q.reward,tier:learned.tier,why:Q.npc+'ถ่ายทอด "'+SKILLS[Q.reward].name+'" ขั้น'+TIERS[learned.tier-1].name+' (tier '+learned.tier+') หลังผ่านครบ '+questChapterCount(Q)+' บท!'+(previous?' ความชำนาญเดิมถูกเก็บไว้':'')};
  }
  function questProgress(st, kind, value, eventId) {
    data(st); const out = [];
    for (const [id] of Object.entries(st.skillQuests)) {
      const Q = SKILL_QUESTS[id], rec = questRecord(st,id);
      if (!Q || !rec || !rec.accepted || rec.claimed) continue;
      const specs=questChapter(Q,rec.stage).objectives;
      const eventKey=kind+'|'+(eventId || 'day-'+st.day+'-'+kind);
      if (rec.history[eventKey]) continue;
      let advanced=false;
      for (const [i,spec] of specs.entries()) {
        if (spec.on!==kind || spec.min!==undefined && !(value>=spec.min) || (rec.progress[i]||0)>=spec.need) continue;
        const key = rec.stage + ':' + i + ':' + eventKey;
        if (rec.seen[key]) continue;
        rec.seen[key]=true;
        rec.progress[i] = Math.min(spec.need,(rec.progress[i]||0)+1);
        advanced=true;
      }
      if (advanced) rec.history[eventKey]=true;
      if (specs.every((o,i)=>(rec.progress[i]||0)>=o.need) && !rec.announced) {
        rec.announced=true;
        out.push('บททดสอบ '+(rec.stage+1)+'/'+questChapterCount(Q)+' "'+Q.name+'" สำเร็จ! กลับไปพบ'+Q.npc+(rec.stage+1===questChapterCount(Q)?'เพื่อเรียน '+SKILLS[Q.reward].name+' ขั้น'+TIERS[Q.rewardTier-1].name:'เพื่อรับบททดสอบต่อเนื่อง'));
      }
    }
    return out;
  }
  // Passive progression still uses the original promotion trials; skill quests teach NEW skills.
  const ACTIVE_IMPACT = Object.freeze({
    sword: { icons: ['skill'], name:'ฟันสองจังหวะ', mult:[1.3,1.45,1.6,1.8,2] },
    fire: { icons: ['skill','fire'], name:'เปลวเพลิงทะลวง', mult:[1.45,1.7,1.9,2.2,2.5] },
    ice: { icons: ['skill','ice'], name:'ไอเยือกแข็งหยุดยั้ง', mult:[1.2,1.35,1.5,1.65,1.8], enemy:[0.8,0.72,0.65,0.56,0.48] },
    sunfall: { icons: ['skill','fire'], name:'สุริยะพิพากษา', mult:[2.2,2.6,3,3.5,4] },
    winterSeal: { icons: ['skill','ice'], name:'ผนึกเหมันต์', mult:[1.55,1.75,2,2.3,2.6], enemy:[0.55,0.5,0.44,0.38,0.3], fatal:0.3 },
    riftStrike: { icons:['skill','sword'], name:'รอยแยกพิฆาต', mult:[2,2.5,3.4,4.3,5.3], enemy:[0.9,0.85,0.75,0.65,0.55] },
    limitBreak: { icons:['skill','sword','target'], name:'ทะลวงขอบเขต', mult:[2.5,3.2,4.5,5.5,6.8] }
  });
  function activeEffect(st, reels) {
    const id = activeOf(st), spec = ACTIVE_IMPACT[id];
    if (!spec || !Array.isArray(reels) || !reels.some(s => spec.icons.includes(s))) return null;
    const t = Math.max(0, Math.min(4, tierOf(st,id)-1));
    return { skill:id, name:spec.name, icon:SKILLS[id].icon, kind:'active',
      attackMult:spec.mult[t], enemyMult:spec.enemy ? spec.enemy[t] : 1, deadlyMult:spec.fatal || 1 };
  }
  // titles: one is worn at a time
  const TITLES = Object.freeze({
    summoned:  { name: 'ผู้ถูกอัญเชิญ', bonus: { intelligence: 2 }, how: 'ได้ตั้งแต่มาถึงต่างโลก' },
    iron:      { name: 'นักรบโล่เหล็ก', bonus: { strength: 4 }, how: 'สอบเข้ากิลด์โล่เหล็กผ่าน' },
    compass:   { name: 'นักสำรวจเข็มทิศเงิน', bonus: { intelligence: 4 }, how: 'สอบเข้ากิลด์เข็มทิศเงินผ่าน' },
    appraiser: { name: 'นักตีราคา', bonus: { intelligence: 2, agility: 2 }, how: 'เป็นนักตีราคากิลด์พ่อค้า' },
    porter:    { name: 'หลังเหล็ก', bonus: { strength: 5 }, how: 'อยู่ในหอคอยกับขบวนคนแบกรวม 30 วัน' },
    slayer:    { name: 'ผู้ล่าอสูร', bonus: { strength: 3, agility: 3 }, how: 'ชนะมอนสเตอร์ 15 ครั้ง' },
    survivor:  { name: 'ผู้รอดตาย', bonus: { agility: 4 }, how: 'รอดชีวิตเพราะเพื่อนร่วมทีมช่วยไว้' }
  });
  // equipment: bag items with ITEMS[id].equip = slot; the numbers here
  const GEAR = Object.freeze({
    dagger: { slot: 'weapon', atk: 5 }, sword: { slot: 'weapon', atk: 11 }, spear: { slot: 'weapon', atk: 10 }, bow: { slot: 'weapon', atk: 9 }, club: { slot: 'weapon', atk: 6 }, knife: { slot: 'weapon', atk: 2 }, namelessBlade:{slot:'weapon',atk:18},
    leather: { slot: 'armor', def: 5 }, chain_vest: { slot: 'armor', def: 10 }, guardianVest: { slot: 'armor', def: 25 },
    charm: { slot: 'charm', bonus: { agility: 3 } }
  });
  const SLOTS = Object.freeze({ weapon: 'อาวุธ', armor: 'เกราะ', charm: 'เครื่องราง' });
  const RARITIES = Object.freeze(['normal', 'soldier', 'captain', 'general', 'king', 'emperor', 'legendary']);
  const RARITY_MULT = Object.freeze([1, 1.3, 1.7, 2.2, 2.9, 3.8, 5]);
  const RARITY_COLORS = Object.freeze(['#aaaaaa', '#64c874', '#62baff', '#b986ff', '#ff9f50', '#ff6565', '#f4cb5c']);
  const validRarity = rarity => RARITIES.includes(String(rarity).toLowerCase()) ? String(rarity).toLowerCase() : 'normal';
  const rarityIndex = rarity => RARITIES.indexOf(validRarity(rarity));
  const rarityMultiplier = rarity => RARITY_MULT[rarityIndex(rarity)];
  // Each physical item is in exactly one location: bag, stash, or an equipment slot.
  // st.gear is the single persistent instance registry; references are instance IDs.
  function createGear(st, templateId, rarity = 'normal', step = 0, origin = 'shop') {
    if (!GEAR[templateId]) return null;
    if (!st.gear || typeof st.gear !== 'object' || Array.isArray(st.gear)) st.gear = {};
    st.gearNextId = Math.max(0, Math.floor(st.gearNextId || 0));
    let instanceId;
    do { instanceId = 'g' + (++st.gearNextId); } while (st.gear[instanceId]);
    const item = { instanceId, templateId, rarity: validRarity(rarity), step: Math.max(0, Math.floor(step || 0)), successCount: 0,
      origin, enhanceAttempts: 0 };
    st.gear[instanceId] = item; return item;
  }
  function gear(st, instanceId) { return st.gear && st.gear[instanceId] || null; }
  function effectiveGear(st, instanceId) {
    const item = gear(st, instanceId), base = item && GEAR[item.templateId];
    if (!base) return null;
    const result = { slot: base.slot, special:item.special||null, atk: Math.round((base.atk || 0) * rarityMultiplier(item.rarity) * (1 + 0.1 * item.step)),
      def: Math.round((base.def || 0) * rarityMultiplier(item.rarity) * (1 + 0.1 * item.step)), bonus: {} };
    for (const [k, v] of Object.entries(base.bonus || {})) result.bonus[k] = Math.round(v * rarityMultiplier(item.rarity)) + item.step;
    for (const [k,v] of Object.entries(item.affixStats||{})) if(['strength','agility','intelligence','magicPower'].includes(k)) result.bonus[k]=(result.bonus[k]||0)+Math.max(0,Math.round(v));
    return result;
  }
  function gearLabel(st, instanceId) {
    const item = gear(st, instanceId), B = (typeof globalThis !== 'undefined' && globalThis.Bag) || (typeof require === 'function' ? require('./bag.js') : null);
    return item ? (B ? B.name(item.templateId) : item.templateId) + ' [' + item.rarity + '] +' + item.step : String(instanceId);
  }
  // Old saves stored template IDs in equip and stacked equipment in bag / stash.
  // Run once per version; re-entry cannot clone items or erase a referenced instance.
  function migrateGear(st) {
    if (!st.gear || typeof st.gear !== 'object' || Array.isArray(st.gear)) st.gear = {};
    if (!st.equip || typeof st.equip !== 'object') st.equip = {};
    if (st.gearVersion >= 113) return st;
    for (const field of ['bag', 'stash']) {
      if (!Array.isArray(st[field])) continue;
      const out = [];
      for (const stack of st[field]) {
        if (!stack || !GEAR[stack.id] || stack.instanceId) { out.push(stack); continue; }
        for (let n = 0; n < Math.max(0, Math.floor(stack.n || 0)); n++) {
          const item = createGear(st, stack.id, 'normal', 0, 'legacy');
          out.push({ id: item.templateId, n: 1, exp: 0, instanceId: item.instanceId });
        }
      }
      st[field] = out;
    }
    for (const slot of Object.keys(SLOTS)) if (GEAR[st.equip[slot]] && GEAR[st.equip[slot]].slot === slot) {
      st.equip[slot] = createGear(st, st.equip[slot], 'normal', 0, 'legacy').instanceId;
    }
    st.gearVersion = 113;
    return st;
  }
  const ENHANCE_CHANCES = Object.freeze([0.5, 0.4, 0.3, 0.2, 0.1, 0.05]);
  const enhanceChance = (item, sacrifices = []) => Math.min(0.9, ENHANCE_CHANCES[Math.min(5, item.successCount)] + sacrifices.reduce((n, g) => n + ([0.03, 0.05, 0.1, 0.2][g.step] || (g.step >= 4 ? 0.3 : 0)), 0));
  const enhanceCost = item => ({ crystals: 1 + Math.floor(item.successCount / 2), cityCoins: 10 * (item.step + 1) });
  function enhance(st, instanceId, sacrificeIds = [], location = 'city') {
    data(st);
    const item = gear(st, instanceId), B = (typeof globalThis !== 'undefined' && globalThis.Bag) || (typeof require === 'function' ? require('./bag.js') : null);
    if (!item || !B || !(B.list(st).some(s => s.instanceId === instanceId) || Object.values(st.equip).includes(instanceId))) return { ok: false, why: 'ต้องเลือกอุปกรณ์ที่มีหรือสวมอยู่' };
    if (!Array.isArray(sacrificeIds) || sacrificeIds.length > 2 || new Set(sacrificeIds).size !== sacrificeIds.length || sacrificeIds.includes(instanceId)) return { ok: false, why: 'เลือกสังเวยได้ไม่เกิน 2 ชิ้น และห้ามเลือกซ้ำ' };
    const materials = sacrificeIds.map(id => gear(st, id));
    if (materials.some((g, i) => !g || g.rarity !== item.rarity || GEAR[g.templateId].slot !== 'weapon' ||
        Object.values(st.equip).includes(g.instanceId) || !B.list(st).some(s => s.instanceId === sacrificeIds[i])))
      return { ok: false, why: 'ชิ้นสังเวยต้องเป็นอาวุธในกระเป๋าระดับเดียวกัน และไม่ได้สวมใส่' };
    if (!['city', 'safe'].includes(location)) return { ok: false, why: 'ตีบวกได้เฉพาะร้านช่างตีเหล็กหรือเซฟโซนที่มีบริการ' };
    const price = enhanceCost(item), coins = location === 'city' ? price.cityCoins : 0;
    if (B.count(st, 'soul_crystal') < price.crystals || (st.money || 0) < coins) return { ok: false, why: 'ผลึกวิญญาณหรือเหรียญไม่พอ' };
    const chance = enhanceChance(item, materials);
    // Same deterministic hash(seed(st), 'enh', id, successfulCount, persistedAttempt).
    const attempt = (item.enhanceAttempts || 0) + 1;
    const entropy = hashGear(st, item.instanceId, item.successCount, attempt);
    B.take(st, 'soul_crystal', price.crystals); st.money -= coins;
    for (const g of materials) { B.removeGear(st, g.instanceId); }
    item.enhanceAttempts = attempt;
    const succeeded = entropy < chance;
    let destroyed = false;
    if (succeeded) { item.step++; item.successCount++; }
    else {
      if (item.step >= 6 && hashGear(st, item.instanceId, item.successCount, attempt, 'destroy') < 0.2) {
        B.removeGear(st, instanceId); destroyed = true;
      } else if (item.step >= 3) item.step--;
    }
    recalc(st);
    return { ok: true, succeeded, destroyed, chance, cost: price.crystals, coins, step: destroyed ? null : item.step,
      why: destroyed ? 'ตีบวกล้มเหลว อุปกรณ์พัง' : succeeded ? 'ตีบวกสำเร็จ +' + item.step : 'ตีบวกล้มเหลว เหลือ +' + item.step };
  }
  // Same FNV-1a hash family and colon-delimited ordering used by Expedition.hash.
  function hashGear(st, ...parts) { let h = 2166136261;
    for (const c of [((st.life && st.life.age) || 0) + ':' + ((st.life && st.life.origin) || ''), 'enh', ...parts].join(':')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967296;
  }


  function data(st) {
    if (!st.base) st.base = { strength: (st.strength || 3) * 5, agility: (st.agility || 3) * 5, intelligence: (st.intelligence || 3) * 5 };
    if(!Number.isFinite(st.base.magicPower))st.base.magicPower=15; // old saves: fourth canonical stat, no character level
    if (!st.skills || typeof st.skills !== 'object') st.skills = {};
    if (!st.skillQuests || typeof st.skillQuests !== 'object' || Array.isArray(st.skillQuests)) st.skillQuests = {};
    if (!Array.isArray(st.titles)) st.titles = ['summoned'];
    if (!st.title || !TITLES[st.title]) st.title = st.titles[0];
    if (!st.equip || typeof st.equip !== 'object') st.equip = {};
    migrateGear(st);
    if (!st.trials || typeof st.trials !== 'object') st.trials = {};
    // v132 skill book: the skills in st.skills are the cards in the book; every skill learned once is remembered (cardsEarned)
    if (!st.cardsEarned || typeof st.cardsEarned !== 'object' || Array.isArray(st.cardsEarned)) st.cardsEarned = {};
    for (const k of Object.keys(st.skills)) st.cardsEarned[k] = true;
    if (!Number.isInteger(st.skillSlots) || st.skillSlots < BOOK_SLOTS) st.skillSlots = Math.max(BOOK_SLOTS, Object.keys(st.skills).length);
    if (!st.wounds || typeof st.wounds !== 'object') st.wounds = { until: 0 };
    // Migration: older saves never stored a selected active skill.
    if (!st.activeSkill || !SKILLS[st.activeSkill] || SKILLS[st.activeSkill].type !== 'active' || !st.skills[st.activeSkill])
      st.activeSkill = st.skills.sword ? 'sword' : (['fire', 'ice'].find(k => !!st.skills[k]) || null);
    return st;
  }
  const BOOK_SLOTS = 6, BOOK_MAX = 12;
  const bagMod = () => (typeof globalThis !== 'undefined' && globalThis.Bag) || (typeof require === 'function' ? require('./bag.js') : null);
  const tierOf = (st, id) => (st.skills && st.skills[id] ? st.skills[id].tier : 0);
  function bonus(st) {
    data(st); const b = { strength: 0, agility: 0, intelligence: 0, magicPower:0 };
    for (const [id, s] of Object.entries(st.skills)) { const S = SKILLS[id]; if (S && S.stat) for (const k in S.stat) b[k] += S.stat[k][s.tier - 1] || 0; }
    for (const id of Object.values(st.equip)) { const g = effectiveGear(st, id); if (g && g.bonus) for (const k in g.bonus) b[k] += g.bonus[k]; }
    const T = TITLES[st.title]; if (T) for (const k in T.bonus) b[k] += T.bonus[k];
    const Ar=(typeof globalThis!=='undefined'&&globalThis.Artisan)||(typeof require==='function'?require('./artisan.js'):null);
    if(Ar){const extra=Ar.bonus(st);for(const k of Object.keys(b))b[k]+=extra[k]||0;}
    return b;
  }
  // effective stats (base + bonuses), halved while a defeat's wounds last
  function recalc(st) {
    data(st); const b = bonus(st), weak = (st.wounds.until || 0) >= (st.day || 1) ? 0.5 : 1;
    for (const k of ['strength', 'agility', 'intelligence', 'magicPower']) st[k] = Math.max(1, Math.round((st.base[k] + b[k]) * weak));
    // v119: equipment and bag mass reduce *effective* agility, never base skill/gear bonuses.
    // Recalculate from raw every time so adding/removing weight cannot stack penalties.
    st.unburdenedAgility = st.agility;
    const B = (typeof globalThis !== 'undefined' && globalThis.Bag) || (typeof require === 'function' ? require('./bag.js') : null);
    if (B && B.loadStatus) {
      const load = B.loadStatus(st, st.strength);
      st.agility = Math.max(1, Math.round(st.unburdenedAgility * load.agilityFactor));
    }
    const A=(typeof globalThis !== 'undefined' && globalThis.Alchemy) || (typeof require === 'function' ? require('./alchemy.js') : null);
    if(A && A.factor)st.agility=Math.max(1,Math.round(st.agility*A.factor(st)));
    return st;
  }
  // proficiency: learn on first use; stops at the tier's cap until the trial is passed
  // v132 a skill not in the book: the first time it is learned it goes into the book (or, with the book full, its card
  // goes into the bag); once learned, training it does nothing until its card is put back. force = teachers' rewards.
  function train(st, id, xp, force) {
    data(st); const S = SKILLS[id]; if (!S || !(xp > 0)) return null;
    let s = st.skills[id]; const fresh = !s;
    if (!s && !force) {
      if (st.cardsEarned[id]) return null;
      if (Object.keys(st.skills).length >= st.skillSlots) {
        const B = bagMod();
        if (B && B.addBook(st, CARD_OF(id), 'normal', 'learned')) { st.cardsEarned[id] = true; return 'ได้การ์ดสกิล "' + S.name + '" · สมุดสกิลเต็ม เก็บการ์ดไว้ในกระเป๋า'; }
        return null;
      }
    }
    if (!s) { s = st.skills[id] = { tier: 1, xp: 0 }; st.cardsEarned[id] = true; }
    const cap = TIERS[s.tier - 1].cap;
    if (cap) s.xp = Math.min(cap, s.xp + xp);
    if (fresh) { if (S.type === 'active' && !st.activeSkill) st.activeSkill = id; recalc(st); return 'ได้สกิลใหม่ "' + S.name + '"'; }
    if (cap && s.xp >= cap && !st.trials[id]) { st.trials[id] = { offered: true, accepted: false, done: 0 }; return 'ความชำนาญ ' + S.name + ' เต็มขั้น — ' + S.teacher + 'มีภารกิจเลื่อนขั้นให้'; }
    return null;
  }
  const trialOf = (st, id) => { const s = st.skills[id]; return s && s.tier < 5 ? SKILLS[id].trial(s.tier) : null; };
  function accept(st, id) { data(st); const T = st.trials[id]; if (!T) return false; T.accepted = true; T.done = 0; return true; }
  // something happened that a trial may be waiting for. Returns messages (promotions).
  function progress(st, kind, value, eventId) {
    data(st); const out = [];
    for (const [id, T] of Object.entries(st.trials)) {
      if (!T.accepted) continue;
      const spec = trialOf(st, id); if (!spec || spec.on !== kind) continue;
      if (spec.min !== undefined && !(value >= spec.min)) continue;
      T.done++;
      if (T.done >= spec.need) {
        const s = st.skills[id]; s.tier++; s.xp = 0; delete st.trials[id]; recalc(st);
        out.push('ผ่านภารกิจเลื่อนขั้น! ' + SKILLS[id].name + ' ขึ้นเป็นขั้น' + TIERS[s.tier - 1].name);
      }
    }
    return out.concat(questProgress(st, kind, value, eventId));
  }
  function earnTitle(st, id) { data(st); if (!TITLES[id] || st.titles.includes(id)) return null; st.titles.push(id); return 'ได้ฉายา "' + TITLES[id].name + '"'; }
  function wearTitle(st, id) { data(st); if (!st.titles.includes(id)) return false; st.title = id; recalc(st); return true; }

  const activeOf = st => { data(st); return st.activeSkill && st.skills[st.activeSkill] ? st.activeSkill : null; };
  function selectActive(st, id) {
    data(st);
    if (id !== null && (!SKILLS[id] || SKILLS[id].type !== 'active' || !st.skills[id])) return false;
    st.activeSkill = id; return true;
  }
  const BOOK_SKILL = Object.freeze({ book_fire: 'fire', book_ice: 'ice', book_sense: 'dangerSense', book_fireBody: 'fireBody', book_iceSkin: 'iceSkin', book_lastStand: 'lastStand', book_shadowStep: 'shadowStep' });
  // v132 cards: every skill has one (the old book_* ids keep their drops/shops); CARD_OF(skill) → item id
  const CARD_SKILL = Object.freeze(Object.assign({}, BOOK_SKILL, Object.fromEntries(Object.keys(SKILLS).filter(id => !Object.values(BOOK_SKILL).includes(id)).map(id => ['card_' + id, id]))));
  const CARD_OF = id => Object.keys(CARD_SKILL).find(c => CARD_SKILL[c] === id);
  const bookUsed = st => Object.keys(data(st).skills).length;
  // put a card in the book (a second copy of a skill already in the book trains it, like the old books)
  function readBook(st, book, rarity = null) {
    data(st);
    const id = CARD_SKILL[book];
    if (!id) return { ok: false, why: 'ไม่ใช่การ์ดสกิล' };
    if (!st.skills[id] && bookUsed(st) >= st.skillSlots) return { ok: false, why: 'สมุดสกิลเต็ม (' + st.skillSlots + ' ช่อง) ถอดการ์ดใบอื่นออกหรือขยายสมุดก่อน' };
    // Additional copies train proficiency; rarity scales the normal 1 XP granted by a book.
    // Skills does not mutate Bag; its Node/browser dependency is injected via the same module loaded by LifeSim.
    const B = (typeof globalThis !== 'undefined' && globalThis.Bag) || (typeof require === 'function' ? require('./bag.js') : null);
    if (!B || !B.count(st, book)) return { ok: false, why: 'ไม่มีการ์ดในกระเป๋า' };
    const picked = B.list(st).find(s => s.id === book && (rarity === null || (s.rarity || 'normal') === rarity));
    if (!picked) return { ok: false, why: 'ไม่มีการ์ดระดับนี้ในกระเป๋า' };
    const xp = rarityMultiplier(picked.rarity || 'normal'), had = !!st.skills[id];
    if (!B.takeBook(st, book, rarity)) return { ok: false, why: 'ใช้การ์ดไม่สำเร็จ' };
    const notice = train(st, id, xp, true);
    return { ok: true, why: had ? 'หลอมการ์ดซ้ำ ความชำนาญ ' + SKILLS[id].name + ' +' + xp + (notice ? ' · ' + notice : '')
      : 'ใส่การ์ด ' + SKILLS[id].name + ' ลงสมุดสกิล' + (SKILLS[id].type === 'active' ? ' · เลือกใช้ในแท็บสกิล' : '') };
  }
  // take a card out of the book: it goes back to the bag as a fresh card, the skill's proficiency and tier are gone
  function removeCard(st, id) {
    data(st); const S = SKILLS[id];
    if (!S || !st.skills[id]) return { ok: false, why: 'ไม่มีการ์ดนี้ในสมุด' };
    const B = bagMod();
    if (!B || !B.addBook(st, CARD_OF(id), 'normal', 'removed')) return { ok: false, why: 'กระเป๋าเต็ม ถอดการ์ดไม่ได้' };
    delete st.skills[id]; delete st.trials[id];
    if (st.activeSkill === id) st.activeSkill = null;
    data(st); recalc(st);
    return { ok: true, why: 'ถอดการ์ด ' + S.name + ' ออกจากสมุด · ความชำนาญรีเซ็ตเป็นขั้น 1' };
  }
  const expandCost = st => 150 * (data(st).skillSlots - BOOK_SLOTS + 1);
  function expandBook(st) {
    data(st);
    if (st.skillSlots >= BOOK_MAX) return { ok: false, why: 'สมุดสกิลขยายได้สูงสุด ' + BOOK_MAX + ' ช่อง' };
    const cost = expandCost(st);
    if ((st.money || 0) < cost) return { ok: false, why: 'ต้องใช้ ' + cost + ' เหรียญ' };
    st.money -= cost; st.skillSlots++;
    return { ok: true, why: 'ขยายสมุดสกิลเป็น ' + st.skillSlots + ' ช่อง (−' + cost + ' เหรียญ)' };
  }

  // ---- combat: stats + selected active skill + weapon/armor against a monster's power
  function power(st) {
    data(st); const w = effectiveGear(st, st.equip.weapon), a = effectiveGear(st, st.equip.armor), id = activeOf(st), sk = id && st.skills[id];
    return Math.round(st.strength + 0.6 * st.agility + 0.25 * st.intelligence + (w ? w.atk : 0) + (a ? a.def * 0.6 : 0) + (sk ? SKILLS[id].power[sk.tier - 1] : 0) + (sk && ['fire','ice','sunfall','winterSeal'].includes(id) ? (st.magicPower-15)*.25 : 0) + (gear(st,st.equip.weapon)?.special?.id==='focus'? Math.round(st.magicPower*0.15):0));
  }
  // chance to win against `mon` (power) with `ally` power fighting alongside: 1 / (1 + (m/h)^3)
  //   hero 50 vs rabbit 10 → 99.2% · equal → 50% · half as strong → 11%
  const winChance = (h, m) => 1 / (1 + Math.pow(Math.max(1, m) / Math.max(1, h), 3));
  // Two-stage combat. Stage 1 retains the old win/deadly equations and slot shift exactly.
  // On an initial loss, apply real damage, then activate at most one learned triggered passive.
  // r3/r4 come from Expedition.hash(seed(st), encounterId, 'f3'/'f4').
  function triggerMatches(trigger, info) {
    if (!trigger) return false;
    switch (trigger.when) {
      case 'hpLost': return info.lost / Math.max(1, info.startHealth) > trigger.value;
      case 'hpBelow': return info.health < trigger.value;
      case 'outnumbered': return !!info.alone;
      case 'terrain': return info.terrain === trigger.value;
      case 'nearDeath': return info.deadly;
      default: return false;
    }
  }
  function triggeredPassives(st, info) {
    data(st);
    return Object.entries(st.skills).filter(([id, v]) => {
      const S = SKILLS[id];
      return S && S.type === 'passive' && S.trigger && S.effect && v.tier >= 2 &&
        (!S.oncePerDay || !st.passiveDaily || st.passiveDaily[id] !== st.day) && triggerMatches(S.trigger, info);
    }).sort((a,b) => b[1].tier-a[1].tier || a[0].localeCompare(b[0]));
  }
  function fight(st, mon, ally, r1, r2, slot, opts = {}) {
    const impact = opts.activeEffect && opts.activeEffect.skill === activeOf(st) ? opts.activeEffect : null;
    const basePower = power(st) + (ally || 0), h = basePower * (impact ? impact.attackMult : 1);
    let enemyPower = mon.power * (impact ? impact.enemyMult : 1);
    const blade = gear(st,st.equip.weapon)?.special;
    const roll=Number.isFinite(opts.affixRoll)?opts.affixRoll:1;
    const affixProc=blade&&['bleedStrike','frostEdge'].includes(blade.id)&&roll<(blade.potency||0)
      ? {id:blade.id,name:blade.name||blade.id}:null;
    if(affixProc)enemyPower*=blade.id==='bleedStrike'?0.88:0.9;
    const p = clamp(winChance(h, enemyPower) + (slot || 0), 0.005, 0.995);
    if (r1 < p) return { win: true, p, hurt: r2 < 0.25 * (1 - p) * 2, ...(affixProc?{affixProc}:{}), ...(impact ? { usedActive:impact } : {}) };
    const initialDeadlyChance = clamp(0.15 * Math.pow(enemyPower / Math.max(1, h), 2) * (impact ? impact.deadlyMult : 1), 0.002, 0.6);
    const initialDeadly = r2 < initialDeadlyChance;
    const startHealth = Math.max(1, Number(st.health) || 100);
    // A single computed injury for the first defeat (even when the second stage wins).
    const injury = Math.max(1, Math.round(9 + 17 * enemyPower / Math.max(1, h)));
    const depleted = injury >= startHealth;
    st.health = Math.max(1, startHealth - injury);
    const info = { startHealth, health: st.health, lost: startHealth - st.health,
      deadly: initialDeadly || depleted, alone: !!opts.alone, terrain: opts.terrain };
    const candidates = triggeredPassives(st, info);
    const base = { win: false, p, ...(affixProc?{affixProc}:{}), deadly: info.deadly, damage: startHealth - st.health, firstDeadly: info.deadly,
      ...(impact ? { usedActive:impact } : {}) };
    if (!candidates.length) return base;
    const [id, sk] = candidates[0], spec = SKILLS[id], effect = spec.effect;
    const strength = effect.power[Math.max(0, sk.tier - 1)] || 0;
    const triggered = { skill: id, name: spec.name, icon: spec.icon, kind: effect.kind,
      effectName: effect.name, effectIcon: effect.icon };
    if (spec.oncePerDay) { st.passiveDaily = st.passiveDaily || {}; st.passiveDaily[id] = st.day; }
    if (effect.kind === 'escape') return { ...base, deadly: false, escaped: true, triggered };
    if (effect.kind === 'shield') {
      const reduced = Math.round(injury * (1 - strength));
      st.health = Math.max(1, startHealth - reduced);
      base.damage = startHealth - st.health;
      base.deadly = r2 < initialDeadlyChance * 0.4 || reduced >= startHealth;
    }
    const secondPower = effect.kind === 'summon' ? h + strength :
      effect.kind === 'boost' ? h * strength : h;
    const p2 = clamp(winChance(secondPower, enemyPower) + (slot || 0), 0.005, 0.995);
    const r3 = Number.isFinite(opts.r3) ? opts.r3 : r1;
    const r4 = Number.isFinite(opts.r4) ? opts.r4 : r2;
    const won = r3 < p2;
    // Shield reduces fatality if the hero still loses. Other effects retain the initial danger.
    return { ...base, win: won, deadly: won ? false : (effect.kind === 'shield' ? base.deadly : info.deadly),
      p2, second: true, hurt: true, triggered, roll2: r4 };
  }
  // defeat with someone strong at your side: they drag you out — half the money, half the gear, stats halved while wounded
  function rescuePenalty(st, days) {
    data(st);
    const money = Math.floor((st.money || 0) / 2); st.money -= money;
    const worn = Object.keys(SLOTS).filter(k => st.equip[k]), gear = [], gearLabels = [];
    for (const k of worn.slice(0, Math.ceil(worn.length / 2))) { gearLabels.push(gearLabel(st,st.equip[k])); gear.push(st.equip[k]); delete st.gear[st.equip[k]]; delete st.equip[k]; }
    st.wounds.until = (st.day || 1) + (days || 6);
    recalc(st);
    return { money, gear, gearLabels, until: st.wounds.until };
  }
  return { TIERS, SKILLS, SKILL_QUESTS, questChapter, questChapterCount, questState, meetQuestNPC, questProgress, ACTIVE_IMPACT, activeEffect, TITLES, GEAR, SLOTS, RARITIES, RARITY_MULT, RARITY_COLORS, rarityMultiplier, rarityIndex, createGear, gear, effectiveGear, gearLabel, migrateGear, enhance, enhanceChance, enhanceCost, hashGear, STAT_NAME, data, bonus, recalc, train, trialOf, accept, progress, earnTitle, wearTitle, tierOf,
    power, winChance, fight, triggerMatches, triggeredPassives, rescuePenalty, activeOf, selectActive, readBook, BOOK_SKILL, CARD_SKILL, CARD_OF, removeCard, expandBook, expandCost, BOOK_SLOTS, BOOK_MAX };
});
