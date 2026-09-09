/* ==========================================================================
   levels.js — 关卡数据 / 小怪属性 / BOSS 配置
   ========================================================================== */
(function (global) {
  'use strict';
  const UG = global.UG;

  /* --------------------------------------------------------- 小怪属性表 */
  UG.ENEMY_TYPES = {
    grunt:   { hp: 24, w: 26, h: 34, speed: 44,  damage: 9,  score: 60,  fly: false, contact: true },
    flyer:   { hp: 18, w: 34, h: 30, speed: 74,  damage: 9,  score: 80,  fly: true,  contact: true },
    shooter: { hp: 30, w: 30, h: 34, speed: 0,   damage: 8,  score: 100, fly: false, contact: false, fireRate: 1.9, bulletSpeed: 150 },
    charger: { hp: 36, w: 34, h: 30, speed: 34,  damage: 13, score: 110, fly: false, contact: true, chargeSpeed: 210, chargeCd: 2.2 },
    turret:  { hp: 44, w: 30, h: 30, speed: 0,   damage: 9,  score: 120, fly: false, contact: false, fireRate: 1.5, bulletSpeed: 190, aimed: true },
  };

  /* ---------------------------------------------------------- BOSS 配置 */
  UG.BOSSES = {
    golza:    { name: '哥尔赞',   en: 'GOLZA',       hp: 620,  w: 150, h: 130, scale: 1.10, score: 1200 },
    scorpion: { name: '沙漠蝎王', en: 'SCORPIUS',    hp: 700,  w: 150, h: 120, scale: 1.08, score: 1500 },
    frost:    { name: '冰封巨兽', en: 'GLACIER',     hp: 780,  w: 140, h: 130, scale: 1.08, score: 1800 },
    inferno:  { name: '熔岩暴君', en: 'MAGMAR',      hp: 860,  w: 150, h: 130, scale: 1.08, score: 2100 },
    cosmo:    { name: '宇宙帝王', en: 'COSMO KING',  hp: 1050, w: 150, h: 140, scale: 1.06, score: 3000 },
  };

  /* ------------------------------------------------------------- 关卡 */
  UG.LEVELS = [
    /* ============================ 第一关 ============================ */
    {
      id: 1, name: '城市废墟', en: 'CITY RUINS', theme: 'city', seed: 1101,
      width: 3100, groundY: 300, arenaX: 2460,
      tip: '按 J 发射能量弹，命中怪兽会积攒体力；体力满格时按住 K 蓄力、松开射出斯派修姆光线。↑ 向上射击，↓ 趴下。空格二段跳，撞箱子能把它打碎。',
      platforms: [
        { x: 400,  y: 264, w: 96,  h: 14, type: 'oneway' },
        { x: 560,  y: 270, w: 30,  h: 30, type: 'crate' },
        { x: 700,  y: 226, w: 110, h: 14, type: 'oneway' },
        { x: 890,  y: 270, w: 30,  h: 30, type: 'crate' },
        { x: 920,  y: 240, w: 30,  h: 30, type: 'crate' },
        { x: 1070, y: 250, w: 120, h: 14, type: 'oneway' },
        { x: 1250, y: 206, w: 100, h: 14, type: 'oneway' },
        { x: 1430, y: 264, w: 90,  h: 14, type: 'oneway' },
        { x: 1610, y: 270, w: 30,  h: 30, type: 'crate' },
        { x: 1780, y: 244, w: 130, h: 14, type: 'oneway' },
        { x: 1980, y: 200, w: 96,  h: 14, type: 'oneway' },
        { x: 2140, y: 264, w: 30,  h: 30, type: 'crate' },
        { x: 2300, y: 232, w: 110, h: 14, type: 'oneway' },
        { x: 2560, y: 252, w: 80,  h: 14, type: 'oneway' },
        { x: 2880, y: 252, w: 80,  h: 14, type: 'oneway' },
        { x: 2700, y: 270, w: 30,  h: 30, type: 'crate' },
      ],
      waves: [
        { at: 340,  enemies: [['grunt', 780]] },
        { at: 600,  enemies: [['grunt', 880], ['grunt', 980]] },
        { at: 980,  enemies: [['shooter', 1280]] },
        { at: 1300, enemies: [['grunt', 1560], ['flyer', 1700, 190]] },
        { at: 1650, enemies: [['flyer', 1960, 170], ['grunt', 2000]] },
        { at: 2000, enemies: [['shooter', 2200], ['grunt', 2280]] },
        { at: 2260, enemies: [['charger', 2500]] },
      ],
      boss: 'golza',
    },

    /* ============================ 第二关 ============================ */
    {
      id: 2, name: '沙漠遗迹', en: 'DESERT RUINS', theme: 'desert', seed: 2202,
      width: 3300, groundY: 300, arenaX: 2620,
      tip: '飞行怪兽会俯冲，冲撞怪在蓄力时会变红——看到红光就赶紧跳开。',
      platforms: [
        { x: 360,  y: 258, w: 90,  h: 14, type: 'oneway' },
        { x: 520,  y: 218, w: 90,  h: 14, type: 'oneway' },
        { x: 660,  y: 270, w: 30,  h: 30, type: 'crate' },
        { x: 700,  y: 240, w: 30,  h: 30, type: 'crate' },
        { x: 860,  y: 190, w: 120, h: 14, type: 'oneway' },
        { x: 1050, y: 246, w: 30,  h: 30, type: 'crate' },
        { x: 1090, y: 216, w: 30,  h: 30, type: 'crate' },
        { x: 1240, y: 176, w: 110, h: 14, type: 'oneway' },
        { x: 1420, y: 244, w: 100, h: 14, type: 'oneway' },
        { x: 1600, y: 204, w: 120, h: 14, type: 'oneway' },
        { x: 1800, y: 260, w: 30,  h: 30, type: 'crate' },
        { x: 1960, y: 214, w: 90,  h: 14, type: 'oneway' },
        { x: 2140, y: 170, w: 110, h: 14, type: 'oneway' },
        { x: 2320, y: 248, w: 120, h: 14, type: 'oneway' },
        { x: 2700, y: 248, w: 80,  h: 14, type: 'oneway' },
        { x: 2960, y: 248, w: 80,  h: 14, type: 'oneway' },
      ],
      waves: [
        { at: 300,  enemies: [['grunt', 720], ['grunt', 820]] },
        { at: 700,  enemies: [['flyer', 1080, 180], ['flyer', 1180, 210]] },
        { at: 1050, enemies: [['charger', 1420]] },
        { at: 1400, enemies: [['shooter', 1720], ['grunt', 1780]] },
        { at: 1750, enemies: [['flyer', 2060, 170], ['flyer', 2140, 220]] },
        { at: 2050, enemies: [['charger', 2380], ['grunt', 2440]] },
        { at: 2350, enemies: [['shooter', 2580], ['flyer', 2620, 190]] },
      ],
      boss: 'scorpion',
    },

    /* ============================ 第三关 ============================ */
    {
      id: 3, name: '冰雪荒原', en: 'FROZEN WASTE', theme: 'snow', seed: 3303,
      width: 3500, groundY: 300, arenaX: 2800,
      tip: '炮台会锁定你所在的位置，别在原地站太久。可以用箱子当掩体。',
      platforms: [
        { x: 340,  y: 254, w: 100, h: 14, type: 'oneway' },
        { x: 520,  y: 214, w: 90,  h: 14, type: 'oneway' },
        { x: 680,  y: 174, w: 90,  h: 14, type: 'oneway' },
        { x: 840,  y: 266, w: 30,  h: 30, type: 'crate' },
        { x: 880,  y: 236, w: 30,  h: 30, type: 'crate' },
        { x: 920,  y: 206, w: 30,  h: 30, type: 'crate' },
        { x: 1080, y: 234, w: 120, h: 14, type: 'oneway' },
        { x: 1280, y: 194, w: 100, h: 14, type: 'oneway' },
        { x: 1480, y: 254, w: 90,  h: 14, type: 'oneway' },
        { x: 1660, y: 214, w: 110, h: 14, type: 'oneway' },
        { x: 1860, y: 264, w: 30,  h: 30, type: 'crate' },
        { x: 1900, y: 234, w: 30,  h: 30, type: 'crate' },
        { x: 2040, y: 184, w: 130, h: 14, type: 'oneway' },
        { x: 2240, y: 244, w: 110, h: 14, type: 'oneway' },
        { x: 2440, y: 204, w: 90,  h: 14, type: 'oneway' },
        { x: 2880, y: 246, w: 80,  h: 14, type: 'oneway' },
        { x: 3140, y: 246, w: 80,  h: 14, type: 'oneway' },
      ],
      waves: [
        { at: 300,  enemies: [['turret', 700], ['grunt', 760]] },
        { at: 650,  enemies: [['flyer', 1000, 180], ['flyer', 1100, 200]] },
        { at: 1000, enemies: [['shooter', 1340], ['turret', 1400]] },
        { at: 1400, enemies: [['charger', 1720], ['flyer', 1800, 170]] },
        { at: 1750, enemies: [['turret', 2080], ['shooter', 2140]] },
        { at: 2100, enemies: [['charger', 2420], ['grunt', 2480], ['flyer', 2520, 190]] },
        { at: 2450, enemies: [['shooter', 2760], ['turret', 2820]] },
      ],
      boss: 'frost',
    },

    /* ============================ 第四关 ============================ */
    {
      id: 4, name: '火山熔岩', en: 'MAGMA CORE', theme: 'volcano', seed: 4404,
      width: 3500, groundY: 300, arenaX: 2800,
      tip: '岩浆地面会持续灼伤，尽量踩着平台走。BOSS 的火焰波可以用二段跳躲过。',
      platforms: [
        { x: 300,  y: 252, w: 90,  h: 14, type: 'oneway' },
        { x: 470,  y: 212, w: 100, h: 14, type: 'oneway' },
        { x: 660,  y: 262, w: 30,  h: 30, type: 'crate' },
        { x: 700,  y: 232, w: 30,  h: 30, type: 'crate' },
        { x: 860,  y: 186, w: 110, h: 14, type: 'oneway' },
        { x: 1050, y: 246, w: 30,  h: 30, type: 'crate' },
        { x: 1240, y: 222, w: 120, h: 14, type: 'oneway' },
        { x: 1440, y: 182, w: 100, h: 14, type: 'oneway' },
        { x: 1640, y: 252, w: 110, h: 14, type: 'oneway' },
        { x: 1840, y: 212, w: 90,  h: 14, type: 'oneway' },
        { x: 2020, y: 262, w: 30,  h: 30, type: 'crate' },
        { x: 2060, y: 232, w: 30,  h: 30, type: 'crate' },
        { x: 2220, y: 190, w: 120, h: 14, type: 'oneway' },
        { x: 2420, y: 244, w: 110, h: 14, type: 'oneway' },
        { x: 2880, y: 244, w: 80,  h: 14, type: 'oneway' },
        { x: 3140, y: 244, w: 80,  h: 14, type: 'oneway' },
      ],
      hazards: [
        { x: 1150, w: 240 }, { x: 1760, w: 260 }, { x: 2620, w: 200 },
      ],
      waves: [
        { at: 300,  enemies: [['grunt', 700], ['charger', 760]] },
        { at: 700,  enemies: [['shooter', 1020], ['flyer', 1100, 180]] },
        { at: 1050, enemies: [['turret', 1400], ['grunt', 1460]] },
        { at: 1450, enemies: [['charger', 1760], ['charger', 1840]] },
        { at: 1800, enemies: [['flyer', 2120, 170], ['shooter', 2180]] },
        { at: 2150, enemies: [['turret', 2460], ['grunt', 2520], ['flyer', 2560, 190]] },
        { at: 2480, enemies: [['charger', 2780], ['shooter', 2840]] },
      ],
      boss: 'inferno',
    },

    /* ============================ 第五关 ============================ */
    {
      id: 5, name: '宇宙要塞', en: 'COSMO FORTRESS', theme: 'space', seed: 5505,
      width: 3700, groundY: 300, arenaX: 2980,
      tip: '最终决战。宇宙帝王会瞬移并释放环形弹幕，注意观察它出现的方位。',
      platforms: [
        { x: 320,  y: 250, w: 100, h: 14, type: 'oneway' },
        { x: 500,  y: 210, w: 90,  h: 14, type: 'oneway' },
        { x: 660,  y: 170, w: 90,  h: 14, type: 'oneway' },
        { x: 820,  y: 262, w: 30,  h: 30, type: 'crate' },
        { x: 860,  y: 232, w: 30,  h: 30, type: 'crate' },
        { x: 1020, y: 234, w: 120, h: 14, type: 'oneway' },
        { x: 1220, y: 194, w: 110, h: 14, type: 'oneway' },
        { x: 1420, y: 254, w: 100, h: 14, type: 'oneway' },
        { x: 1600, y: 214, w: 110, h: 14, type: 'oneway' },
        { x: 1800, y: 262, w: 30,  h: 30, type: 'crate' },
        { x: 1840, y: 232, w: 30,  h: 30, type: 'crate' },
        { x: 1980, y: 184, w: 130, h: 14, type: 'oneway' },
        { x: 2180, y: 244, w: 110, h: 14, type: 'oneway' },
        { x: 2380, y: 204, w: 100, h: 14, type: 'oneway' },
        { x: 2560, y: 262, w: 30,  h: 30, type: 'crate' },
        { x: 3060, y: 246, w: 80,  h: 14, type: 'oneway' },
        { x: 3320, y: 246, w: 80,  h: 14, type: 'oneway' },
        { x: 3200, y: 268, w: 30,  h: 30, type: 'crate' },
      ],
      waves: [
        { at: 300,  enemies: [['turret', 700], ['flyer', 760, 180]] },
        { at: 650,  enemies: [['charger', 1000], ['shooter', 1060]] },
        { at: 1000, enemies: [['flyer', 1320, 170], ['flyer', 1400, 210], ['grunt', 1360]] },
        { at: 1400, enemies: [['turret', 1740], ['turret', 1800]] },
        { at: 1750, enemies: [['charger', 2080], ['flyer', 2140, 180], ['shooter', 2200]] },
        { at: 2150, enemies: [['grunt', 2480], ['grunt', 2540], ['turret', 2600]] },
        { at: 2500, enemies: [['charger', 2820], ['flyer', 2880, 170], ['shooter', 2940]] },
      ],
      boss: 'cosmo',
    },
  ];

  /* ------------------------------------------------------------- 成就 */
  UG.ACHIEVEMENTS = [
    { id: 'first-blood',     icon: '⚔️', name: '初次交锋', desc: '击败第一只怪兽' },
    { id: 'no-revive-level', icon: '🛡️', name: '毫发无伤', desc: '零复活通过任意一关' },
    { id: 'perfect-boss',    icon: '👑', name: '完美讨伐', desc: '无伤击败任意 BOSS' },
    { id: 'beam-master',     icon: '✨', name: '光线大师', desc: '用斯派修姆光线击败 50 只怪兽' },
    { id: 'crate-smasher',   icon: '📦', name: '拆迁队长', desc: '打碎 30 个箱子' },
    { id: 'combo-20',        icon: '🔥', name: '连击达人', desc: '达成 20 连击' },
    { id: 'level-3',         icon: '❄️', name: '越战越勇', desc: '抵达第三关' },
    { id: 'clear-game',      icon: '🏆', name: '光之战士', desc: '通关全部 5 关' },
    { id: 'one-life',        icon: '💎', name: '一命通关', desc: '全程零复活通关' },
    { id: 'revive-10',       icon: '🔁', name: '百折不挠', desc: '累计复活 10 次' },
    { id: 'speedrun',        icon: '⚡', name: '光速通关', desc: '30 分钟内通关' },
    { id: 'no-damage-level', icon: '🌟', name: '无敌之姿', desc: '单关全程未受伤' },
  ];

})(window);
