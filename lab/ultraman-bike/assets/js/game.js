/* ==========================================================================
   game.js — 主逻辑：状态机 / 玩家 / 小怪 / BOSS / 关卡流程 / 成就
   ========================================================================== */
(function (global) {
  'use strict';

  const UG = global.UG;
  const { clamp, lerp, rand, randInt, TAU, aabb, circleRect } = UG;
  const Art = UG.Art;

  /* ------------------------------------------------------------ 常量 */
  const GRAVITY     = 1500;
  const RUN_SPEED   = 205;
  const JUMP_V      = -545;
  const DBL_JUMP_V  = -470;
  const MAX_FALL    = 900;
  const PLAYER_W    = 22;
  const PLAYER_H    = 50;
  const MAX_HP      = 100;
  const CROUCH_H    = 22;          /* 趴下时的碰撞盒高度（更低，才能躲子弹） */
  const FIRE_CD     = 0.135;
  const BEAM_MAX    = 0.8;
  const MAX_STAMINA = 100;
  const BEAM_COST   = 100;         /* 一次光波消耗满格体力 */
  const STAMINA_HIT = 12;          /* 普通攻击命中一次积攒 */
  const STAMINA_KILL = 30;         /* 击杀额外积攒 */
  const BOSS_CONTACT_DMG = 14;     /* 贴着 BOSS 身体的伤害 */
  const STAMINA_BOSS_HIT = 3;      /* 命中 BOSS 的少量回复（BOSS 血量厚、命中频繁） */
  const COYOTE_TIME = 0.1;         /* 离开地面后仍可起跳的宽容时间 */
  const JUMP_BUFFER = 0.12;        /* 落地前提前按跳的缓冲 */
  const DASH_TIME   = 0.26;
  const DASH_SPEED  = 520;
  const INVULN_TIME = 0.95;
  const SAVE_KEY    = 'ultra-guardian-save-v1';

  /* ------------------------------------------------------------ 状态 */
  const G = {
    state: 'title',      // title | card | playing | paused | dead | clear | allClear | achievements
    t: 0,
    levelIndex: 0,
    level: null,
    player: null,
    enemies: [], bullets: [], pickups: [], effects: [], toasts: [],
    boss: null,
    bossIntro: 0,
    camX: 0,
    score: 0,
    revives: 0,
    combo: 0, comboTimer: 0, bestCombo: 0,
    checkpointX: 0,
    waveIndex: 0,
    arenaLocked: false,
    runStart: 0,
    levelDamaged: false,
    levelRevives: 0,
    bossDamaged: false,
    beamKills: 0,
    cratesSmashed: 0,
    totalKills: 0,
    save: null,
    freeze: 0,
    hitStop: 0,
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  /* ------------------------------------------------------- 存档 / 成就 */
  const DEFAULT_SAVE = {
    achievements: {},
    totalRevives: 0,
    bestScore: 0,
    cleared: false,
    muted: false,
    musicOn: true,
  };

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return Object.assign({}, DEFAULT_SAVE, raw ? JSON.parse(raw) : {});
    } catch (e) { return Object.assign({}, DEFAULT_SAVE); }
  }
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.save)); } catch (e) { /* 忽略 */ }
  }
  function hasAch(id) { return !!G.save.achievements[id]; }

  function unlock(id) {
    if (hasAch(id)) return;
    const def = UG.ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return;
    G.save.achievements[id] = Date.now();
    persist();
    UG.Audio.achieve();
    toast(def.icon + ' 成就达成 · ' + def.name);
  }

  function toast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    $('#app').appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => {
      el.classList.remove('in');
      setTimeout(() => el.remove(), 400);
    }, 2600);
  }

  /* --------------------------------------------------------- 覆盖层 UI */
  const overlay = () => $('#overlay');

  function showOverlay(html, after) {
    const o = overlay();
    o.innerHTML = html;
    o.classList.add('show');
    if (after) after(o);
    o.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        UG.Audio.ui();
        handleAction(btn.dataset.act);
      });
    });
  }
  function hideOverlay() {
    const o = overlay();
    o.classList.remove('show');
    o.innerHTML = '';
  }

  /* ------------------------------------------------------------ 音效门 */
  function ensureAudio() {
    if (!UG.Audio.ctx) UG.Audio.init();
    UG.Audio.resume();
  }

  function musicStart() {
    if (!G.save.musicOn) return;
    const M = UG.Audio.Music;
    if (M) M.start(G.level ? G.level.theme : 'city');   /* 标题页也放（城市主题） */
  }
  function musicStop() {
    const M = UG.Audio.Music;
    if (M) M.stop();
  }
  function toggleMusic() {
    G.save.musicOn = !G.save.musicOn;
    persist();
    const M = UG.Audio.Music;
    if (M) M.setEnabled(G.save.musicOn);
    if (G.save.musicOn) { ensureAudio(); musicStart(); }
    toast(G.save.musicOn ? '🎵 音乐已开启' : '🔇 音乐已关闭');
  }

  /* ============================================================
     玩家
     ============================================================ */
  function createPlayer(x, y) {
    return {
      x, y, w: PLAYER_W, h: PLAYER_H,
      vx: 0, vy: 0,
      facing: 1,
      onGround: false,
      jumps: 0,
      hp: MAX_HP,
      stamina: 35,
      crouching: false,
      aim: 'fwd',
      coyote: 0,
      jumpBuffer: 0,
      invuln: 0,
      fireCd: 0,
      charge: 0,
      charging: false,
      dashT: 0, dashCd: 0,
      pose: 'idle',
      animT: 0,
      hurtT: 0,
      squash: 0,
      wasGround: false,
      dustT: 0,
      alive: true,
      prevBottom: 0,
    };
  }

  function playerRect(p) {
    return { x: p.x - p.w / 2, y: p.y - p.h, w: p.w, h: p.h };
  }

  /* ============================================================
     关卡装载
     ============================================================ */
  /* 屏幕尺寸变化时重算相机边界，避免宽屏下露出关卡外 */
  function onViewportChange() {
    const lv = G.level;
    if (!lv) return;
    UG.Camera.minX = 0;
    UG.Camera.maxX = Math.max(0, lv.width - UG.VIEW.w);
    if (G.player) {
      G.camX = clamp(UG.Camera.x, UG.Camera.minX, UG.Camera.maxX);
      if (G.arenaLocked) G.camX = lv.arenaX;
    }
  }

  function loadLevel(index) {
    const lv = UG.LEVELS[index];
    G.levelIndex = index;
    G.level = lv;
    UG.Art.prepareLevel(lv);

    G.enemies = []; G.bullets = []; G.pickups = []; G.effects = [];
    G.boss = null; G.bossIntro = 0;
    G.waveIndex = 0;
    G.arenaLocked = false;
    G.checkpointX = 80;
    G.combo = 0; G.comboTimer = 0;
    G.levelDamaged = false;
    G.levelRevives = 0;
    G.bossDamaged = false;

    // 复制平台（箱子可破坏，需要独立副本）
    lv._live = lv.platforms.map((p) => Object.assign({}, p, {
      hp: p.type === 'crate' ? 2 : undefined, dead: false,
    }));

    G.player = createPlayer(80, lv.groundY);
    UG.Camera.reset(0, Math.max(0, lv.width - UG.VIEW.w));
    UG.Camera.snap(G.player.x);
    UG.Particles.clear();

    updateHud();
    showCard(lv);
    syncUi();
  }

  function showCard(lv) {
    G.state = 'card';
    showOverlay(
      '<div class="screen">' +
        '<div class="card-level">LEVEL ' + lv.id + ' / 5</div>' +
        '<h2 class="card-name">' + lv.name + '</h2>' +
        '<p class="card-en">' + lv.en + '</p>' +
        '<div class="card-tip">' + lv.tip + '</div>' +
        '<div class="menu"><button class="btn primary" data-act="startLevel">开始战斗</button></div>' +
      '</div>'
    );
  }

  /* ============================================================
     输入处理（每帧）
     ============================================================ */
  function handlePlayerInput(dt) {
    const p = G.player;
    if (!p || !p.alive) return;
    const I = UG.Input;

    /* 冲刺 */
    if (p.dashCd > 0) p.dashCd -= dt;
    if (I.pressed('dash') && p.dashCd <= 0 && p.dashT <= 0) {
      p.dashT = DASH_TIME;
      p.dashCd = 0.75;
      p.invuln = Math.max(p.invuln, DASH_TIME + 0.1);
      p.vx = p.facing * DASH_SPEED;
      p.vy *= 0.2;
      UG.Audio.dash();
      UG.Particles.burst(p.x, p.y - 25, 10, {
        color: '#c79bff', minSpeed: 40, maxSpeed: 160, maxLife: 0.35, gravity: 0,
      });
    }

    if (p.dashT > 0) {
      p.dashT -= dt;
      p.pose = 'dash';
      p.vx = p.facing * DASH_SPEED * (0.4 + 0.6 * (p.dashT / DASH_TIME));
      if (Math.random() < 0.7) {
        UG.Particles.spawn({
          x: p.x - p.facing * 6, y: p.y - rand(10, 44),
          vx: -p.facing * rand(20, 80), vy: rand(-20, 20),
          life: 0.3, size: rand(2, 5), color: '#c79bff', gravity: 0,
        });
      }
      return;
    }

    /* ---- 姿态：趴下 / 向上瞄准 ---- */
    const wantCrouch = I.down('down') && p.onGround && p.dashT <= 0;
    p.crouching = wantCrouch;
    p.h = p.crouching ? CROUCH_H : PLAYER_H;
    p.aim = p.crouching ? 'fwd'
          : (I.down('up') ? 'up'
          : (!p.onGround && I.down('down') ? 'down' : 'fwd'));

    /* ---- 移动（趴下时爬行） ---- */
    let ax = 0;
    if (I.down('left')) ax -= 1;
    if (I.down('right')) ax += 1;
    if (ax !== 0) p.facing = ax;
    const speed = p.crouching ? RUN_SPEED * 0.42 : RUN_SPEED;
    const target = ax * speed;
    p.vx = lerp(p.vx, target, 1 - Math.pow(0.0001, dt));

    /* ---- 跳跃：土狼时间 + 输入缓冲 + 可变高度 ---- */
    if (p.coyote > 0) p.coyote -= dt;
    if (p.jumpBuffer > 0) p.jumpBuffer -= dt;

    const tryJump = () => {
      if (p.onGround || p.coyote > 0) {
        p.vy = JUMP_V; p.jumps = 1; p.onGround = false; p.coyote = 0; p.jumpBuffer = 0;
        UG.Audio.jump();
        UG.Particles.burst(p.x, p.y, 8, { color: '#cfe0ff', minSpeed: 30, maxSpeed: 110, maxLife: 0.3 });
        return true;
      }
      if (p.jumps < 2) {
        p.vy = DBL_JUMP_V; p.jumps = 2; p.jumpBuffer = 0;
        UG.Audio.jump();
        UG.Particles.burst(p.x, p.y - 20, 14, {
          color: '#7fe6ff', minSpeed: 40, maxSpeed: 150, maxLife: 0.4, gravity: 60,
        });
        return true;
      }
      return false;
    };

    if (I.pressed('jump')) {
      if (!tryJump()) p.jumpBuffer = JUMP_BUFFER;   /* 落地前提前按 → 缓存 */
    }
    if (p.jumpBuffer > 0 && (p.onGround || p.coyote > 0)) tryJump();

    /* 松键短跳 */
    if (I.released('jump') && p.vy < -180) p.vy *= 0.55;

    /* ---- 普通攻击 ---- */
    if (p.fireCd > 0) p.fireCd -= dt;
    if (I.down('fire') && p.fireCd <= 0 && !p.charging) {
      p.fireCd = FIRE_CD;
      fireBolt(p);
    }

    /* ---- 蓄力光波（消耗体力） ---- */
    const canBeam = p.stamina >= BEAM_COST;
    if (I.down('beam') && canBeam) {
      p.charging = true;
      p.charge = Math.min(BEAM_MAX, p.charge + dt);
      if (p.charge >= BEAM_MAX && !p._beamReady) {
        p._beamReady = true;
        UG.Audio.beamReady();
      }
      if (beamBtn) beamBtn.classList.add('charging');
    } else if (p.charging && (!I.down('beam') || !canBeam)) {
      p.charging = false;
      if (canBeam) fireBeam(p, p.charge / BEAM_MAX);
      p.charge = 0; p._beamReady = false;
      if (beamBtn) beamBtn.classList.remove('charging');
    }
    if (beamBtn) beamBtn.classList.toggle('empty', !canBeam);

    /* ---- 姿态选择 ---- */
    if (p.crouching) p.pose = 'crouch';
    else if (p.aim === 'up') p.pose = 'aimup';
    else if (p.aim === 'down') p.pose = 'aimdown';
    else if (!p.onGround) p.pose = p.vy < 0 ? 'jump' : 'fall';
    else if (Math.abs(p.vx) > 30) p.pose = 'run';
    else p.pose = 'idle';
    if (p.charging) p.pose = 'beam';
    else if (p.fireCd > FIRE_CD - 0.08 && !p.crouching && p.aim === 'fwd') p.pose = 'shoot';
    if (p.hurtT > 0) { p.hurtT -= dt; p.pose = 'hurt'; }
  }

  /* ------------------------------------------------------- 玩家攻击 */
  function handPos(p) {
    if (p.aim === 'up')   return { x: p.x + p.facing * 5, y: p.y - (p.h || PLAYER_H) - 8 };
    if (p.aim === 'down') return { x: p.x + p.facing * 9, y: p.y - 4 };
    return { x: p.x + p.facing * 15, y: p.y - (p.crouching ? 12 : 32) };
  }

  function aimVector(p) {
    if (p.aim === 'up')   return { x: 0, y: -1 };
    if (p.aim === 'down') return { x: 0, y: 1 };
    return { x: p.facing, y: 0 };
  }

  function gainStamina(n) {
    const p = G.player;
    if (!p) return;
    const was = p.stamina;
    p.stamina = Math.min(MAX_STAMINA, p.stamina + n);
    if (was < MAX_STAMINA && p.stamina >= BEAM_COST) UG.Audio.beamReady();
  }

  function fireBolt(p) {
    const h = handPos(p);
    const v = aimVector(p);
    G.bullets.push({
      side: 'player', kind: 'bolt',
      x: h.x, y: h.y,
      vx: v.x * 660, vy: v.y * 660,
      r: 4, damage: 7, life: 1.4, pierce: false,
      rot: Math.atan2(v.y, v.x),
      color: '#7fe6ff',
    });
    UG.Audio.shoot();
    UG.Particles.spawn({
      x: h.x, y: h.y, vx: -v.x * 60, vy: -v.y * 60 + rand(-20, 20),
      life: 0.18, size: 3.5, color: '#bff2ff', gravity: 0,
    });
    for (let i = 0; i < 3; i++) {
      UG.Particles.spawn({
        x: h.x + v.x * 3, y: h.y + v.y * 3,
        vx: v.x * rand(120, 260) + rand(-30, 30),
        vy: v.y * rand(120, 260) + rand(-30, 30),
        life: rand(0.08, 0.16), size: rand(1.5, 3), color: '#ffffff', gravity: 0,
      });
    }
  }

  function fireBeam(p, ratio) {
    const h = handPos(p);
    const v = aimVector(p);
    const dmg = 9 + ratio * 26;          /* 削弱：原 14 + 42 */
    const r = 4 + ratio * 7;
    G.bullets.push({
      side: 'player', kind: 'wave',
      x: h.x, y: h.y,
      vx: v.x * 1500, vy: v.y * 1500,
      r, len: 150 + ratio * 190, damage: dmg,
      life: 0.42, pierce: true, hitSet: new Set(),
      rot: Math.atan2(v.y, v.x),
      color: '#4fd6ff',
    });
    p.stamina = Math.max(0, p.stamina - BEAM_COST);
    UG.Audio.beamFire();
    UG.shake(2.5 + ratio * 2.5, 0.14);   /* 大幅减弱震屏，避免卡顿感 */
    /* 不再有 hitStop（硬直）与后坐力（后撤） */
    for (let i = 0; i < 14; i++) {
      const a = Math.atan2(v.y, v.x) + rand(-0.6, 0.6);
      UG.Particles.spawn({
        x: h.x, y: h.y,
        vx: Math.cos(a) * rand(80, 380), vy: Math.sin(a) * rand(80, 380),
        life: rand(0.2, 0.45), size: rand(2, 4.5),
        color: i % 2 ? '#ffffff' : '#7fe6ff', gravity: 0,
      });
    }
    updateHud();
  }

  /* ============================================================
     伤害 / 死亡
     ============================================================ */
  function damagePlayer(amount, sourceX) {
    const p = G.player;
    if (!p || !p.alive || p.invuln > 0) return;
    p.hp -= amount;
    p.invuln = INVULN_TIME;
    p.hurtT = 0.3;
    G.levelDamaged = true;
    G.combo = 0;
    UG.Audio.hurt();
    UG.shake(7, 0.24);
    UG.Particles.burst(p.x, p.y - 26, 12, {
      color: '#ff8a8a', minSpeed: 60, maxSpeed: 200, maxLife: 0.45,
    });
    if (sourceX != null) p.vx += UG.sign(p.x - sourceX) * 150;

    if (p.hp <= 0) {
      p.hp = 0;
      playerDies();
    }
    updateHud();
  }

  function playerDies() {
    const p = G.player;
    p.alive = false;
    G.state = 'dead';
    musicStop();
    UG.Audio.explode();
    UG.shake(14, 0.7);
    UG.Particles.burst(p.x, p.y - 26, 40, {
      color: '#ffd84d', minSpeed: 60, maxSpeed: 380, maxLife: 1.1, maxSize: 6,
    });
    setTimeout(() => {
      if (G.state === 'dead') showDeathScreen();
    }, 750);
  }

  function showDeathScreen() {
    G.revives++;
    G.save.totalRevives = (G.save.totalRevives || 0) + 1;
    G.levelRevives++;
    persist();
    if (G.save.totalRevives >= 10) unlock('revive-10');

    showOverlay(
      '<div class="screen">' +
        '<h2 class="result-title lose">能量耗尽</h2>' +
        '<p class="result-sub">彩色计时器熄灭了……但光不会消失。</p>' +
        '<div class="stat-grid">' +
          '<div class="stat-cell"><div class="v">' + G.revives + '</div><div class="l">复活次数</div></div>' +
          '<div class="stat-cell"><div class="v">' + G.score + '</div><div class="l">当前得分</div></div>' +
          '<div class="stat-cell"><div class="v">' + G.levelIndex + 1 + '</div><div class="l">当前关卡</div></div>' +
        '</div>' +
        '<div class="menu"><button class="btn primary" data-act="revive">复活 · 继续战斗</button>' +
        '<button class="btn ghost" data-act="restartLevel">重打本关</button></div>' +
      '</div>'
    );
  }

  function revivePlayer() {
    const lv = G.level;
    const p = G.player;
    p.alive = true;
    p.hp = MAX_HP;
    p.invuln = 2.6;
    p.hurtT = 0;
    p.vx = 0; p.vy = 0;
    p.dashT = 0; p.charge = 0; p.charging = false;
    p.x = clamp(G.checkpointX, 40, lv.width - 40);
    p.y = lv.groundY - 80;
    p.jumps = 1;

    G.bullets = G.bullets.filter((b) => b.side === 'player');
    G.enemies.forEach((e) => { e.aggro = false; });
    G.combo = 0;

    UG.Audio.revive();
    UG.Particles.burst(p.x, p.y - 26, 30, {
      color: '#7fe6ff', minSpeed: 40, maxSpeed: 260, maxLife: 0.9, gravity: -30,
    });
    G.state = 'playing';
    hideOverlay();
    updateHud();
    musicStart();
  }

  /* ============================================================
     小怪
     ============================================================ */
  function spawnEnemy(type, x, y) {
    const cfg = UG.ENEMY_TYPES[type];
    if (!cfg) return;
    const gy = G.level.groundY;
    G.enemies.push({
      type, cfg,
      x, y: y == null ? gy : y,
      homeY: y == null ? gy : y,
      w: cfg.w, h: cfg.h,
      hp: cfg.hp, maxHp: cfg.hp,
      facing: -1,
      vx: 0, vy: 0,
      onGround: false,
      flash: 0,
      seed: rand(0, 10),
      timer: rand(0.4, 1.6),
      charge: 0,
      state: 'idle',
      t: 0,
      alive: true,
      aggro: false,
      diveT: 0,
    });
  }

  function updateEnemies(dt) {
    const p = G.player;
    const lv = G.level;
    for (let i = G.enemies.length - 1; i >= 0; i--) {
      const e = G.enemies[i];
      e.t += dt;
      if (e.flash > 0) e.flash -= dt;
      if (!e.alive) { G.enemies.splice(i, 1); continue; }

      const dx = p.x - e.x;
      const adx = Math.abs(dx);
      if (adx < 320) e.aggro = true;
      if (!e.aggro && e.cfg.speed === 0) continue;

      switch (e.type) {
        case 'grunt': {
          e.facing = dx < 0 ? -1 : 1;
          e.vx = e.aggro ? e.facing * e.cfg.speed : 0;
          // 遇到台阶跳一下
          if (e.onGround && e.aggro && adx < 60 && Math.abs(p.y - e.y) > 24 && Math.random() < 0.02) {
            e.vy = -430;
          }
          e.vy += GRAVITY * dt;
          break;
        }
        case 'flyer': {
          /* 保持一段滞空距离，偶尔俯冲，避免贴到玩家头顶 */
          const standoff = 155;
          const wantX = p.x - UG.sign(dx || 1) * standoff;
          const targetY = p.y - p.h - 78 + Math.sin(e.t * 2.4 + e.seed) * 22;
          if (adx < 400 && e.aggro) {
            if (e.diveT > 0) {
              e.diveT -= dt;
              e.vx = UG.sign(dx) * e.cfg.speed * 2.2;
              e.vy += 420 * dt;
            } else {
              e.vx = clamp((wantX - e.x) * 1.5, -e.cfg.speed * 1.5, e.cfg.speed * 1.5);
              e.vy = clamp((targetY - e.y) * 2.0, -130, 130);
              if (Math.random() < 0.004) e.diveT = 0.65;
            }
            e.facing = dx < 0 ? -1 : 1;
          } else {
            e.vx = Math.sin(e.t * 1.2 + e.seed) * 30;
            e.vy = Math.sin(e.t * 2.6 + e.seed) * 26;
          }
          break;
        }
        case 'shooter': {
          e.facing = dx < 0 ? -1 : 1;
          e.timer -= dt;
          if (e.aggro && e.timer <= 0 && adx < 420) {
            e.timer = e.cfg.fireRate;
            e.charge = 1;
            setTimeout(() => { if (e.alive) { e.charge = 0; enemyShoot(e, 0); } }, 380);
          }
          if (e.charge > 0) e.charge = Math.max(0, e.charge - dt * 2);
          e.vy += GRAVITY * dt;
          break;
        }
        case 'turret': {
          e.facing = dx < 0 ? -1 : 1;
          e.timer -= dt;
          if (e.aggro && e.timer <= 0 && adx < 460) {
            e.timer = e.cfg.fireRate;
            e.charge = 1;
            setTimeout(() => { if (e.alive) { e.charge = 0; enemyShoot(e, 1); } }, 420);
          }
          if (e.charge > 0) e.charge = Math.max(0, e.charge - dt * 2);
          break;
        }
        case 'charger': {
          if (e.state === 'idle') {
            e.facing = dx < 0 ? -1 : 1;
            e.vx = e.aggro ? e.facing * e.cfg.speed : 0;
            e.timer -= dt;
            if (e.aggro && e.timer <= 0 && adx < 300) { e.state = 'telegraph'; e.timer = 0.75; }
          } else if (e.state === 'telegraph') {
            e.vx = 0;
            e.charge = 1;
            e.timer -= dt;
            if (e.timer <= 0) {
              e.state = 'charge'; e.timer = 0.85;
              e.facing = dx < 0 ? -1 : 1;
              e.vx = e.facing * e.cfg.chargeSpeed;
              UG.Audio.enemyShot();
            }
          } else {
            e.timer -= dt;
            e.vx *= 0.995;
            if (e.timer <= 0) { e.state = 'idle'; e.charge = 0; e.timer = e.cfg.chargeCd; }
          }
          e.vy += GRAVITY * dt;
          break;
        }
      }

      /* 物理 */
      e.x += e.vx * dt;
      if (e.type !== 'flyer' && e.type !== 'turret') {
        e.y += e.vy * dt;
        resolveGround(e, dt);
      } else if (e.type === 'flyer') {
        e.y += e.vy * dt;
        e.y = clamp(e.y, 70, lv.groundY - 6);
      }

      /* 与玩家碰撞 */
      const er = { x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h };
      const pr = playerRect(p);
      if (p.alive && aabb(er, pr)) {
        if (e.cfg.contact) {
          damagePlayer(e.cfg.damage, e.x);
        } else if (e.charge > 0) {
          damagePlayer(e.cfg.damage, e.x);
        }
      }
    }
  }

  function enemyShoot(e, aimed) {
    const p = G.player;
    const sx = e.x + e.facing * 14;
    const sy = e.y - e.h * 0.55;
    let vx = e.facing * e.cfg.bulletSpeed, vy = 0;
    if (aimed) {
      const d = Math.hypot(p.x - sx, (p.y - p.h / 2) - sy) || 1;
      vx = (p.x - sx) / d * e.cfg.bulletSpeed;
      vy = ((p.y - p.h / 2) - sy) / d * e.cfg.bulletSpeed;
    }
    G.bullets.push({
      side: 'enemy', kind: 'orb',
      x: sx, y: sy, vx, vy,
      r: 5, damage: e.cfg.damage, life: 3.2,
      color: e.type === 'turret' ? '#ff7a3c' : '#ffb020',
    });
    UG.Audio.enemyShot();
  }

  function resolveGround(o, dt) {
    const lv = G.level;
    const gy = lv.groundY;
    o.vy = clamp(o.vy, -2000, MAX_FALL);
    const bottom = o.y;
    o.onGround = false;
    if (bottom >= gy) {
      o.y = gy; o.vy = 0; o.onGround = true;
      return;
    }
    // 平台
    for (const pl of lv._live) {
      if (pl.dead) continue;
      const top = pl.y;
      const withinX = o.x > pl.x - o.w / 2 && o.x < pl.x + pl.w + o.w / 2;
      if (!withinX) continue;
      const prev = o.y - o.vy * dt;
      if (o.vy >= 0 && prev <= top + 6 && bottom >= top) {
        o.y = top; o.vy = 0; o.onGround = true;
        return;
      }
    }
  }

  function killEnemy(e, byBeam) {
    e.alive = false;
    if (!byBeam) gainStamina(STAMINA_KILL);
    G.score += e.cfg.score;
    G.totalKills++;
    G.combo++;
    G.comboTimer = 2.4;
    if (G.combo > G.bestCombo) G.bestCombo = G.combo;
    if (G.combo >= 20) unlock('combo-20');
    if (!hasAch('first-blood')) unlock('first-blood');
    if (byBeam) {
      G.beamKills++;
      if (G.beamKills >= 50) unlock('beam-master');
    }
    UG.Audio.explode();
    UG.shake(3, 0.14);
    UG.Particles.burst(e.x, e.y - e.h / 2, 18, {
      color: '#ffd84d', minSpeed: 60, maxSpeed: 260, maxLife: 0.6, maxSize: 5,
    });
    UG.Particles.burst(e.x, e.y - e.h / 2, 10, {
      color: '#ff7a3c', minSpeed: 30, maxSpeed: 160, maxLife: 0.8, shape: 'square',
    });
    if (Math.random() < 0.22) {
      G.pickups.push({ x: e.x, y: e.y - e.h, vy: -180, kind: 'hp', life: 9 });
    }
    updateHud();
  }

  /* ============================================================
     BOSS
     ============================================================ */
  function spawnBoss(kind) {
    const cfg = UG.BOSSES[kind];
    const lv = G.level;
    G.boss = {
      kind, cfg,
      name: cfg.name, en: cfg.en,
      x: lv.arenaX + 480, y: lv.groundY - cfg.h, w: cfg.w, h: cfg.h,
      scale: cfg.scale,
      hp: cfg.hp, maxHp: cfg.hp,
      facing: -1,
      vx: 0, vy: 0,
      flash: 0, hitShake: 0,
      phase: 1,
      state: 'intro', timer: 2.4, pattern: 0, sub: 0,
      alive: true, seed: rand(0, 6),
      floatY: 0,
    };
    G.bossIntro = 2.4;
    G.bossDamaged = false;
    G.arenaLocked = true;
    UG.Audio.bossWarn();
    UG.shake(8, 0.6);
    showBossBar();
  }

  function showBossBar() {
    let bar = $('#bossBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'bossBar';
      bar.className = 'boss-bar';
      bar.innerHTML = '<div class="boss-name" id="bossName"></div>' +
        '<div class="boss-track"><div class="boss-fill" id="bossFill"></div></div>';
      $('#app').appendChild(bar);
    }
    bar.classList.add('show');
    $('#bossName').textContent = G.boss.name + ' · ' + G.boss.en;
  }
  function hideBossBar() {
    const bar = $('#bossBar');
    if (bar) bar.classList.remove('show');
  }

  function updateBoss(dt) {
    const b = G.boss;
    if (!b || !b.alive) return;
    const p = G.player;
    const lv = G.level;
    b.seed += dt;
    if (b.flash > 0) b.flash -= dt;
    if (b.hitShake > 0) b.hitShake -= dt;

    if (b.state === 'intro') {
      b.timer -= dt;
      b.x = lerp(b.x, lv.arenaX + 430, 1 - Math.pow(0.002, dt));
      if (b.timer <= 0) { b.state = 'idle'; b.timer = 1.2; }
      return;
    }
    if (b.state === 'dead') {
      b.timer -= dt;
      b.y += 40 * dt;
      if (Math.random() < 0.35) {
        UG.Particles.burst(b.x + rand(-b.w / 2, b.w / 2), b.y + rand(0, b.h), 10, {
          color: '#ffd84d', minSpeed: 40, maxSpeed: 240, maxLife: 0.8,
        });
      }
      if (b.timer <= 0) finishLevel();
      return;
    }

    // 二阶段
    if (b.hp <= b.maxHp * 0.5 && b.phase === 1) {
      b.phase = 2;
      UG.Audio.bossRoar();
      UG.shake(9, 0.5);
      toast('⚠ ' + b.name + ' 暴走了！');
      UG.Particles.burst(b.x, b.y + b.h * 0.5, 34, {
        color: '#ff5a3c', minSpeed: 60, maxSpeed: 300, maxLife: 0.9,
      });
    }

    b.facing = p.x < b.x ? -1 : 1;
    b.timer -= dt;

    /* 身体接触伤害：防止贴身站桩 */
    if (b.state !== 'dead' && p.alive) {
      const bb = { x: b.x - b.w * b.scale / 2, y: b.y, w: b.w * b.scale, h: b.h * b.scale };
      if (aabb(bb, playerRect(p))) damagePlayer(BOSS_CONTACT_DMG, b.x);
    }

    const p2 = b.phase === 2;
    const speedK = p2 ? 0.72 : 1;

    if (b.timer <= 0) {
      b.pattern = (b.pattern + 1) % 3;
      b.sub = 0;
      runBossPattern(b, p, lv);
      b.timer = (p2 ? 1.15 : 1.75) + rand(0, 0.4);
    }

    // 简单移动
    if (b.state !== 'attack') {
      const homeX = lv.arenaX + (b.facing < 0 ? 470 : 190);
      b.x = lerp(b.x, homeX, 1 - Math.pow(0.35, dt));
    }
    b.y = lv.groundY - b.h + Math.sin(b.seed * 2.2) * 3;
  }

  function bossShoot(b, opts) {
    G.bullets.push(Object.assign({
      side: 'enemy', kind: 'orb', x: b.x, y: b.y + b.h * 0.4,
      vx: 0, vy: 0, r: 6, damage: 16, life: 4, color: '#ff5a3c',
    }, opts));
  }

  function runBossPattern(b, p, lv) {
    const px = p.x, py = p.y - p.h / 2;
    const sx = b.x, sy = b.y + b.h * 0.35;
    const speed = b.phase === 2 ? 210 : 165;

    switch (b.kind) {
      /* ---------- 哥尔赞：吐石 / 地震波 / 冲撞 ---------- */
      case 'golza':
        if (b.pattern === 0) {
          // 三连弧形岩石
          for (let i = -1; i <= 1; i++) {
            const d = Math.hypot(px - sx, py - sy) || 1;
            const base = Math.atan2(py - sy, px - sx);
            const a = base + i * 0.24;
            bossShoot(b, {
              x: sx, y: sy, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 40,
              r: 7, color: '#b8c6d4', gravity: 260, damage: 18,
            });
          }
          UG.Audio.enemyShot();
        } else if (b.pattern === 1) {
          // 地震波：贴地冲击
          UG.Audio.bossRoar(); UG.shake(7, 0.4);
          const dir = b.facing;
          for (let i = 0; i < 3; i++) {
            G.bullets.push({
              side: 'enemy', kind: 'wave', x: b.x + dir * (40 + i * 46), y: lv.groundY - 14,
              vx: dir * (260 + i * 40), vy: 0, r: 12, damage: 20, life: 2.6,
              color: '#ffd84d', ground: true,
            });
          }
          UG.Particles.burst(b.x, lv.groundY, 22, { color: '#c8dbe8', minSpeed: 80, maxSpeed: 300, maxLife: 0.6 });
        } else {
          // 冲撞
          b.state = 'attack';
          const dir = b.facing;
          b.vx = dir * 320;
          UG.Audio.bossRoar();
          let tt = 0;
          const tick = setInterval(() => {
            if (!b.alive || b.state === 'dead') { clearInterval(tick); return; }
            tt += 0.05;
            b.x += b.vx * 0.05;
            b.x = clamp(b.x, lv.arenaX + 90, lv.arenaX + 560);
            if (tt > 0.8) { clearInterval(tick); b.state = 'idle'; b.vx = 0; }
          }, 50);
        }
        break;

      /* ---------- 蝎王：毒刺扇形 / 沙暴 / 冲撞 ---------- */
      case 'scorpion':
        if (b.pattern === 0) {
          const n = b.phase === 2 ? 7 : 5;
          const base = Math.atan2(py - sy, px - sx);
          for (let i = 0; i < n; i++) {
            const a = base + (i - (n - 1) / 2) * 0.19;
            bossShoot(b, {
              x: sx, y: sy, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
              r: 6, color: '#c98a3c', damage: 16,
            });
          }
          UG.Audio.enemyShot();
        } else if (b.pattern === 1) {
          // 沙暴：从上方落下
          for (let i = 0; i < 6; i++) {
            const bx = lv.arenaX + 60 + Math.random() * 520;
            G.bullets.push({
              side: 'enemy', kind: 'orb', x: bx, y: -10,
              vx: rand(-40, 40), vy: rand(120, 190), r: 7,
              damage: 15, life: 5, color: '#e6c08a', gravity: 90,
            });
          }
          UG.Audio.enemyShot();
        } else {
          b.state = 'attack';
          const dir = b.facing;
          b.vx = dir * 300;
          UG.Audio.bossRoar();
          let tt = 0;
          const tick = setInterval(() => {
            if (!b.alive || b.state === 'dead') { clearInterval(tick); return; }
            tt += 0.05;
            b.x += b.vx * 0.05;
            b.x = clamp(b.x, lv.arenaX + 90, lv.arenaX + 560);
            if (tt > 0.7) { clearInterval(tick); b.state = 'idle'; b.vx = 0; }
          }, 50);
        }
        break;

      /* ---------- 冰封巨兽：冰晶扇 / 冰锥坠落 / 冻结光束 ---------- */
      case 'frost':
        if (b.pattern === 0) {
          const n = b.phase === 2 ? 9 : 6;
          const base = Math.atan2(py - sy, px - sx);
          for (let i = 0; i < n; i++) {
            const a = base + (i - (n - 1) / 2) * 0.16;
            bossShoot(b, {
              x: sx, y: sy, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
              r: 6, color: '#8fd4f0', damage: 16,
            });
          }
          UG.Audio.enemyShot();
        } else if (b.pattern === 1) {
          // 冰锥：从上方砸向玩家
          for (let i = 0; i < 4; i++) {
            const tx = px + (i - 1.5) * 70;
            G.bullets.push({
              side: 'enemy', kind: 'orb', x: tx, y: 20,
              vx: 0, vy: 300, r: 8, damage: 19, life: 3,
              color: '#dff6ff', gravity: 260, ice: true,
            });
          }
          UG.Audio.enemyShot();
        } else {
          // 冻结光束（横向）
          const dir = b.facing;
          G.bullets.push({
            side: 'enemy', kind: 'wave', x: b.x + dir * 30, y: sy,
            vx: dir * 420, vy: 0, r: 10, damage: 22, life: 1.6,
            color: '#8fd4f0', freeze: true,
          });
          UG.Audio.beamFire();
        }
        break;

      /* ---------- 熔岩暴君：火球 / 火焰波 / 地火柱 ---------- */
      case 'inferno':
        if (b.pattern === 0) {
          const n = b.phase === 2 ? 4 : 3;
          for (let i = 0; i < n; i++) {
            const d = Math.hypot(px - sx, py - sy) || 1;
            const a = Math.atan2(py - sy, px - sx) + (i - (n - 1) / 2) * 0.12;
            bossShoot(b, {
              x: sx, y: sy, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
              r: 8, color: '#ff8a1f', damage: 18, trail: true,
            });
          }
          UG.Audio.enemyShot();
        } else if (b.pattern === 1) {
          // 地面火焰波
          const dir = b.facing;
          for (let i = 0; i < 4; i++) {
            G.bullets.push({
              side: 'enemy', kind: 'wave', x: b.x + dir * (50 + i * 52), y: lv.groundY - 16,
              vx: dir * (230 + i * 34), vy: 0, r: 13, damage: 20, life: 2.8,
              color: '#ff6a2a', ground: true,
            });
          }
          UG.Audio.bossRoar(); UG.shake(6, 0.4);
        } else {
          // 地火柱
          for (let i = 0; i < 3; i++) {
            const tx = px + (i - 1) * 96;
            setTimeout(() => {
              if (!G.boss || !G.boss.alive || G.state !== 'playing') return;
              G.bullets.push({
                side: 'enemy', kind: 'pillar', x: tx, y: lv.groundY,
                vx: 0, vy: 0, r: 20, damage: 23, life: 0.75,
                color: '#ff9a3c', pillar: true,
              });
              UG.Particles.burst(tx, lv.groundY, 16, {
                color: '#ff9a3c', minSpeed: 60, maxSpeed: 220, maxLife: 0.6, lift: 120,
              });
              UG.shake(4, 0.2);
            }, i * 190);
          }
          UG.Audio.enemyShot();
        }
        break;

      /* ---------- 宇宙帝王：瞬移环形弹 / 激光扫射 / 召唤 ---------- */
      case 'cosmo':
        if (b.pattern === 0) {
          // 瞬移到玩家附近后放环形弹
          const targetX = clamp(px + (px < lv.arenaX + 320 ? 240 : -240), lv.arenaX + 120, lv.arenaX + 540);
          UG.Particles.burst(b.x, b.y + b.h / 2, 22, {
            color: '#a78bfa', minSpeed: 40, maxSpeed: 220, maxLife: 0.5, gravity: 0,
          });
          b.x = targetX;
          UG.Particles.burst(b.x, b.y + b.h / 2, 22, {
            color: '#e0d4ff', minSpeed: 40, maxSpeed: 220, maxLife: 0.5, gravity: 0,
          });
          UG.Audio.enemyShot();
          const n = b.phase === 2 ? 18 : 12;
          const off = Math.random() * TAU;
          for (let i = 0; i < n; i++) {
            const a = off + i / n * TAU;
            bossShoot(b, {
              x: b.x, y: b.y + b.h * 0.4,
              vx: Math.cos(a) * 155, vy: Math.sin(a) * 155,
              r: 6, color: '#c4b5fd', damage: 16, life: 4.5,
            });
          }
        } else if (b.pattern === 1) {
          // 激光扫射：三连定向弹幕
          const base = Math.atan2(py - sy, px - sx);
          for (let i = 0; i < 3; i++) {
            const a = base + (i - 1) * 0.3;
            bossShoot(b, {
              x: sx, y: sy, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300,
              r: 5, color: '#e879f9', damage: 18,
            });
          }
          UG.Audio.beamFire();
        } else {
          // 召唤小怪
          const spots = [lv.arenaX + 140, lv.arenaX + 500];
          spots.forEach((sx2) => {
            if (G.enemies.length < 10) spawnEnemy(Math.random() < 0.5 ? 'flyer' : 'grunt', sx2, Math.random() < 0.5 ? 190 : undefined);
          });
          UG.Audio.bossRoar();
        }
        break;
    }
  }

  function damageBoss(amount) {
    const b = G.boss;
    if (!b || !b.alive || b.state === 'dead' || b.state === 'intro') return;
    b.hp -= amount;
    b.flash = 0.09;
    b.hitShake = 0.12;
    G.bossDamaged = true;
    G.score += 4;
    updateBossBar();
    if (b.hp <= 0) {
      b.hp = 0;
      b.state = 'dead';
      b.timer = 2.2;
      G.arenaLocked = false;
      hideBossBar();
      UG.Audio.bigExplode();
      UG.shake(16, 1.1);
      G.hitStop = 0.08;
      UG.Particles.burst(b.x, b.y + b.h * 0.5, 60, {
        color: '#ffd84d', minSpeed: 80, maxSpeed: 460, maxLife: 1.4, maxSize: 8,
      });
      G.score += b.cfg.score;
      if (!G.bossDamaged) unlock('perfect-boss');
      updateHud();
    }
  }

  function updateBossBar() {
    const fill = $('#bossFill');
    if (fill && G.boss) {
      fill.style.width = clamp(G.boss.hp / G.boss.maxHp * 100, 0, 100) + '%';
    }
  }

  /* ============================================================
     弹幕更新
     ============================================================ */
  function updateBullets(dt) {
    const p = G.player;
    const lv = G.level;
    const pr = playerRect(p);

    for (let i = G.bullets.length - 1; i >= 0; i--) {
      const b = G.bullets[i];
      b.life -= dt;
      if (b.life <= 0) { G.bullets.splice(i, 1); continue; }

      if (b.gravity) b.vy += b.gravity * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.trail && Math.random() < 0.5) {
        UG.Particles.spawn({
          x: b.x, y: b.y, vx: rand(-20, 20), vy: rand(-20, 20),
          life: 0.25, size: rand(2, 4), color: '#ff8a1f', gravity: -40,
        });
      }

      /* 玩家子弹 */
      if (b.side === 'player') {
        if (b.x < G.camX - 200 || b.x > G.camX + UG.VIEW.w + 200) { G.bullets.splice(i, 1); continue; }
        let hitSomething = false;
        // 小怪
        for (const e of G.enemies) {
          if (!e.alive) continue;
          const er = { x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h };
          if (b.kind === 'wave') {
            if (b.hitSet.has(e)) continue;
            if (circleRect(b.x, b.y, b.r * 1.4, er)) {
              b.hitSet.add(e);
              e.hp -= b.damage; e.flash = 0.08;
              hitSpark(e.x, e.y - e.h / 2, b.kind === 'wave' ? '#7fe6ff' : '#ffd84d');
              if (e.hp <= 0) killEnemy(e, b.kind === 'wave');
            }
          } else if (circleRect(b.x, b.y, b.r + 2, er)) {
            e.hp -= b.damage; e.flash = 0.08;
            hitSpark(e.x, e.y - e.h / 2, '#ffd84d');
            gainStamina(STAMINA_HIT);      /* 普通攻击命中 → 积攒体力 */
            hitSomething = true;
            if (e.hp <= 0) killEnemy(e, false);
          }
        }
        // 箱子
        for (const pl of lv._live) {
          if (pl.dead || pl.type !== 'crate') continue;
          if (b.kind === 'wave') {
            if (circleRect(b.x, b.y, b.r * 1.4, pl)) {
              pl.hp -= b.damage * 0.5;
              if (pl.hp <= 0) smashCrate(pl);
            }
          } else if (circleRect(b.x, b.y, b.r + 2, pl)) {
            pl.hp -= b.damage;
            hitSpark(b.x, b.y, '#e8c08a');
            hitSomething = true;
            if (pl.hp <= 0) smashCrate(pl);
          }
        }
        // BOSS
        const bo = G.boss;
        if (bo && bo.alive && bo.state !== 'dead') {
          const br = { x: bo.x - bo.w * bo.scale / 2, y: bo.y, w: bo.w * bo.scale, h: bo.h * bo.scale };
          if (b.kind === 'wave') {
            if (!b.hitSet.has(bo) && circleRect(b.x, b.y, b.r * 1.4, br)) {
              b.hitSet.add(bo);
              damageBoss(b.damage);
              hitSpark(b.x, b.y, '#7fe6ff');
            }
          } else if (circleRect(b.x, b.y, b.r + 2, br)) {
            damageBoss(b.damage);
            hitSpark(b.x, b.y, '#ffd84d');
            gainStamina(STAMINA_BOSS_HIT);   /* 命中 BOSS 回复少量体力 */
            hitSomething = true;
          }
        }
        if (hitSomething && !b.pierce) { G.bullets.splice(i, 1); continue; }
      }

      /* 敌方子弹 */
      else {
        if (b.x < G.camX - 320 || b.x > G.camX + UG.VIEW.w + 320 || b.y > 460 || b.y < -80) {
          if (b.y < -80) b.y = -80;
          else { G.bullets.splice(i, 1); continue; }
        }
        if (b.pillar) {
          // 地火柱：范围内伤害
          if (p.alive && p.invuln <= 0 &&
              Math.abs(p.x - b.x) < b.r + p.w / 2 && p.y > lv.groundY - 120) {
            damagePlayer(b.damage, b.x);
          }
          continue;
        }
        if (p.alive) {
          if (b.kind === 'wave') {
            const rr = { x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 };
            if (aabb(rr, pr)) { damagePlayer(b.damage, b.x); G.bullets.splice(i, 1); continue; }
          } else if (circleRect(b.x, b.y, b.r + 3, pr)) {
            damagePlayer(b.damage, b.x);
            G.bullets.splice(i, 1);
            continue;
          }
        }
      }
    }
  }

  function smashCrate(pl) {
    pl.dead = true;
    G.cratesSmashed++;
    G.score += 15;
    if (G.cratesSmashed >= 30) unlock('crate-smasher');
    UG.Audio.hit();
    UG.Particles.burst(pl.x + pl.w / 2, pl.y + pl.h / 2, 14, {
      color: '#c99356', minSpeed: 50, maxSpeed: 200, maxLife: 0.6, shape: 'square',
    });
    if (Math.random() < 0.3) {
      G.pickups.push({ x: pl.x + pl.w / 2, y: pl.y, vy: -200, kind: 'hp', life: 10 });
    }
  }

  function hitSpark(x, y, color) {
    UG.Audio.hit();
    UG.Particles.burst(x, y, 5, {
      color: color || '#ffd84d', minSpeed: 40, maxSpeed: 150, maxLife: 0.28, maxSize: 3,
    });
  }

  /* ============================================================
     拾取物
     ============================================================ */
  function updatePickups(dt) {
    const p = G.player;
    for (let i = G.pickups.length - 1; i >= 0; i--) {
      const k = G.pickups[i];
      k.life -= dt;
      k.vy += 700 * dt;
      k.y += k.vy * dt;
      if (k.y > G.level.groundY - 8) { k.y = G.level.groundY - 8; k.vy = 0; }
      if (k.life <= 0) { G.pickups.splice(i, 1); continue; }
      if (p.alive && Math.abs(p.x - k.x) < 22 && Math.abs((p.y - 25) - k.y) < 34) {
        p.hp = Math.min(MAX_HP, p.hp + 16);
        G.pickups.splice(i, 1);
        UG.Audio.beamReady();
        UG.Particles.burst(k.x, k.y, 12, {
          color: '#4ade80', minSpeed: 30, maxSpeed: 130, maxLife: 0.5, gravity: -60,
        });
        updateHud();
      }
    }
  }

  /* ============================================================
     关卡推进
     ============================================================ */
  function updateWaves() {
    const lv = G.level;
    const reach = G.camX + UG.VIEW.w;
    while (G.waveIndex < lv.waves.length && reach > lv.waves[G.waveIndex].at) {
      const w = lv.waves[G.waveIndex];
      w.enemies.forEach(([type, x, y]) => spawnEnemy(type, x, y));
      G.checkpointX = w.at + 60;
      G.waveIndex++;
    }
    // BOSS 触发
    if (!G.boss && !G.arenaLocked && G.player.x > lv.arenaX + 120) {
      spawnBoss(lv.boss);
    }
  }

  function finishLevel() {
    G.state = 'clear';
    hideBossBar();
    G.boss = null;
    UG.Audio.victory();
    UG.shake(6, 0.5);

    if (G.levelRevives === 0) unlock('no-revive-level');
    if (!G.levelDamaged) unlock('no-damage-level');
    if (G.levelIndex === 2) unlock('level-3');

    G.save.bestScore = Math.max(G.save.bestScore || 0, G.score);
    persist();

    const lv = G.level;
    const isLast = G.levelIndex >= UG.LEVELS.length - 1;
    if (isLast) {
      G.save.cleared = true;
      if (G.revives === 0) unlock('one-life');
      if ((Date.now() - G.runStart) < 30 * 60 * 1000) unlock('speedrun');
      unlock('clear-game');
      persist();
      setTimeout(showAllClear, 600);
    } else {
      setTimeout(() => showLevelClear(lv), 600);
    }
  }

  function showLevelClear(lv) {
    G.state = 'clear';
    showOverlay(
      '<div class="screen">' +
        '<div class="card-level">LEVEL ' + lv.id + ' CLEAR</div>' +
        '<h2 class="result-title win">' + lv.name + ' · 突破</h2>' +
        '<p class="result-sub">怪兽被击退了，但前方还有更强的敌人。</p>' +
        '<div class="stat-grid">' +
          '<div class="stat-cell"><div class="v">' + G.score + '</div><div class="l">总分</div></div>' +
          '<div class="stat-cell"><div class="v">' + G.revives + '</div><div class="l">复活次数</div></div>' +
          '<div class="stat-cell"><div class="v">' + G.bestCombo + '</div><div class="l">最高连击</div></div>' +
        '</div>' +
        '<div class="menu"><button class="btn primary" data-act="nextLevel">进入下一关</button></div>' +
      '</div>'
    );
  }

  function showAllClear() {
    G.state = 'allClear';
    showOverlay(
      '<div class="screen">' +
        '<h2 class="result-title win">🏆 光之战士</h2>' +
        '<p class="result-sub">五关全部通过，地球得救了。</p>' +
        '<div class="stat-grid">' +
          '<div class="stat-cell"><div class="v">' + G.score + '</div><div class="l">最终得分</div></div>' +
          '<div class="stat-cell"><div class="v">' + G.revives + '</div><div class="l">复活次数</div></div>' +
          '<div class="stat-cell"><div class="v">' + G.bestCombo + '</div><div class="l">最高连击</div></div>' +
          '<div class="stat-cell"><div class="v">' + G.totalKills + '</div><div class="l">击败怪兽</div></div>' +
        '</div>' +
        '<p class="result-sub">' + (G.revives === 0 ? '完美！全程零复活。' : '复活了 ' + G.revives + ' 次。') + '</p>' +
        '<div class="menu">' +
          '<button class="btn gold" data-act="achievements">查看成就</button>' +
          '<button class="btn ghost" data-act="title">返回标题</button>' +
        '</div>' +
      '</div>'
    );
  }

  /* ============================================================
     主循环
     ============================================================ */
  let last = performance.now();
  let acc = 0;
  const STEP = 1 / 60;

  function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;

    if (G.state === 'playing') {
      if (G.hitStop > 0) { G.hitStop -= dt; dt *= 0.15; }
      acc += dt;
      let guard = 0;
      while (acc >= STEP && guard++ < 6) { update(STEP); acc -= STEP; }
      if (guard >= 6) acc = 0;
    } else {
      G.t += dt;
      UG.Particles.update(dt);
      UG.Camera.update(dt);
      acc = 0;
    }
    render();
    UG.Input.endFrame();
  }

  function update(dt) {
    G.t += dt;
    const p = G.player;
    const lv = G.level;

    handlePlayerInput(dt);

    /* 玩家物理 */
    if (p.alive) {
      if (p.invuln > 0) p.invuln -= dt;
      /* 上升略轻、下落略重 —— 跳跃弧线更跟手 */
      const gAcc = p.vy < 0 ? GRAVITY * 0.84 : GRAVITY * 1.14;
      p.vy = clamp(p.vy + gAcc * dt, -2000, MAX_FALL);
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // 横向边界
      const minX = G.arenaLocked ? lv.arenaX + 20 : 20;
      const maxX = G.arenaLocked ? lv.arenaX + UG.VIEW.w - 20 : lv.width - 20;
      p.x = clamp(p.x, minX, maxX);

      resolveGround(p, dt);
      if (p.onGround) p.coyote = COYOTE_TIME;

      /* 落地压缩 */
      if (p.onGround && !p.wasGround && p.vy > 220) {
        p.squash = Math.min(1, p.vy / 700);
        UG.Particles.burst(p.x, p.y, 7, {
          color: '#cfe0ff', minSpeed: 30, maxSpeed: 120, maxLife: 0.3, gravity: 180,
        });
      }
      p.wasGround = p.onGround;
      if (p.squash > 0) p.squash = Math.max(0, p.squash - dt * 5.5);

      /* 跑动扬尘 */
      if (p.onGround && Math.abs(p.vx) > 90) {
        p.dustT -= dt;
        if (p.dustT <= 0) {
          p.dustT = 0.085;
          UG.Particles.spawn({
            x: p.x - p.facing * 8, y: p.y - 2,
            vx: -p.facing * rand(20, 70), vy: rand(-40, -10),
            life: rand(0.28, 0.5), size: rand(1.8, 3.6),
            color: '#cfd8e2', gravity: 60, drag: 0.94,
          });
        }
      }

      if (p.onGround) { p.jumps = 0; }

      // 地面危险区（岩浆）
      if (lv.hazards && p.onGround) {
        for (const h of lv.hazards) {
          if (p.x > h.x && p.x < h.x + h.w) {
            p.hazardT = (p.hazardT || 0) + dt;
            if (p.hazardT > 0.45) {
              p.hazardT = 0;
              p.invuln = 0;
              damagePlayer(8, null);
            }
            if (Math.random() < 0.4) {
              UG.Particles.spawn({
                x: p.x + rand(-10, 10), y: lv.groundY - 2,
                vx: rand(-20, 20), vy: rand(-90, -40),
                life: 0.5, size: rand(2, 4), color: '#ff6a2a', gravity: 40,
              });
            }
          }
        }
      }
    }

    updateWaves();
    updateEnemies(dt);
    updateBoss(dt);
    updateBullets(dt);
    updatePickups(dt);
    UG.Particles.update(dt);

    /* 相机 */
    if (G.arenaLocked) {
      G.camX = lerp(G.camX, lv.arenaX, 1 - Math.pow(0.004, dt));
    } else {
      UG.Camera.follow(p.x, dt, p.facing * 46);
      G.camX = UG.Camera.x;
    }
    UG.Camera.update(dt);

    /* 连击计时 */
    if (G.comboTimer > 0) {
      G.comboTimer -= dt;
      if (G.comboTimer <= 0) G.combo = 0;
    }

    updateHud();
    syncUi();
  }

  /* ============================================================
     渲染
     ============================================================ */
  function shadowEllipse(ctx, x, y, w, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 0.26 : alpha;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y + 1.5, w, w * 0.2, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawShadows(ctx, lv) {
    const p = G.player;
    if (p && p.alive) shadowEllipse(ctx, p.x, p.y, 17, 0.42);
    G.enemies.forEach((e) => {
      const groundY = e.type === 'flyer' ? lv.groundY : e.y;
      shadowEllipse(ctx, e.x, groundY, e.w * 0.46, e.type === 'flyer' ? 0.14 : 0.22);
    });
    const b = G.boss;
    if (b && b.alive) shadowEllipse(ctx, b.x, lv.groundY, b.w * b.scale * 0.45, 0.4);
  }

  function render() {
    const ctx = UG.Screen.ctx;
    const lv = G.level;
    const W = UG.VIEW.w, H = UG.VIEW.h;

    if (!lv) {
      ctx.fillStyle = '#05070f';
      ctx.fillRect(0, 0, W, H);
      return;
    }

    const camX = Math.round(G.camX);
    const shakeX = UG.Camera.ox, shakeY = UG.Camera.oy;

    Art.background(ctx, lv, camX, G.t);
    Art.ground(ctx, lv, camX, G.t);

    ctx.save();
    ctx.translate(-camX + shakeX, shakeY);

    /* 危险区 */
    if (lv.hazards) {
      lv.hazards.forEach((h) => {
        const g = ctx.createLinearGradient(0, lv.groundY - 10, 0, lv.groundY + 6);
        g.addColorStop(0, 'rgba(255,120,30,.1)');
        g.addColorStop(1, 'rgba(255,90,20,.85)');
        ctx.fillStyle = g;
        ctx.fillRect(h.x, lv.groundY - 6, h.w, 8);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < h.w; i += 26) {
          const bx = h.x + i + Math.sin(G.t * 3 + i) * 6;
          ctx.fillStyle = 'rgba(255,150,40,.5)';
          ctx.beginPath();
          ctx.ellipse(bx, lv.groundY - 4, 9, 4, 0, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      });
    }

    /* 平台 */
    lv._live.forEach((pl) => { if (!pl.dead) Art.platform(ctx, pl, lv, camX, G.t); });

    /* 拾取物 */
    G.pickups.forEach((k) => {
      const bob = Math.sin(G.t * 5 + k.x) * 2;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 12;
      ctx.fillStyle = '#4ade80';
      ctx.beginPath(); ctx.arc(k.x, k.y - 8 + bob, 6, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#eafff2';
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('+', k.x, k.y - 5 + bob);
    });

    /* 落地阴影：让角色与地面产生接触感 */
    drawShadows(ctx, lv);

    /* 小怪 */
    G.enemies.forEach((e) => Art.minion(ctx, e, G.t));

    /* BOSS */
    if (G.boss) Art.boss(ctx, G.boss, G.t);

    /* 玩家 */
    const p = G.player;
    if (p && p.alive) {
      Art.ultraman(ctx, p.x, p.y, {
        pose: p.pose, t: p.animT += 0.016, facing: p.facing,
        charge: p.charging ? p.charge / BEAM_MAX : 0,
        hp: p.hp / MAX_HP, invuln: p.invuln, squash: p.squash,
      });
    }

    /* 弹幕 */
    G.bullets.forEach((b) => {
      if (b.pillar) {
        const k = 1 - Math.abs(b.life - 0.375) / 0.375;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(0, lv.groundY, 0, lv.groundY - 150);
        g.addColorStop(0, 'rgba(255,220,120,.9)');
        g.addColorStop(0.5, 'rgba(255,120,30,.6)');
        g.addColorStop(1, 'rgba(255,60,10,0)');
        ctx.fillStyle = g;
        ctx.fillRect(b.x - b.r * k, lv.groundY - 150, b.r * 2 * k, 150);
        ctx.restore();
        return;
      }
      Art.bullet(ctx, b, camX, G.t);
    });

    /* 粒子 */
    UG.Particles.draw(ctx);

    /* 复活无敌光环 */
    if (p && p.alive && p.invuln > 0.6) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.18 + 0.1 * Math.sin(G.t * 10);
      ctx.strokeStyle = '#7fe6ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 26, 20 + Math.sin(G.t * 6) * 2, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    /* 前景剪影 + 全局光照 */
    Art.foreground(ctx, lv, camX, G.t);
    Art.lighting(ctx, lv, camX, G.t);

    /* BOSS 出场警告 */
    if (G.bossIntro > 0 && G.boss) {
      G.bossIntro -= 1 / 60;
      const a = clamp(G.bossIntro / 2.4, 0, 1);
      ctx.save();
      ctx.globalAlpha = 0.55 * a;
      ctx.fillStyle = '#ff2b2b';
      ctx.fillRect(0, H / 2 - 26, W, 52);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ WARNING ⚠', W / 2, H / 2 + 8);
      ctx.restore();
    }

    /* 屏幕边缘受伤红晕 */
    if (p && p.alive && p.hp / MAX_HP < 0.35) {
      const k = (1 - p.hp / MAX_HP / 0.35) * (0.35 + 0.15 * Math.sin(G.t * 6));
      const rg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
      rg.addColorStop(0, 'rgba(255,0,0,0)');
      rg.addColorStop(1, 'rgba(255,20,20,' + k.toFixed(3) + ')');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ============================================================
     HUD
     ============================================================ */
  let hudTick = 0;
  let beamBtn = null, staminaFill = null, staminaBarEl = null;
  function updateHud() {
    hudTick++;
    if (hudTick % 3 !== 0) return;
    const p = G.player, lv = G.level;
    if (!p || !lv) return;

    const ratio = clamp(p.hp / MAX_HP, 0, 1);
    const prog = $('#timerProgress');
    const timer = $('#timer');
    if (prog) prog.style.strokeDashoffset = (113.1 * (1 - ratio)).toFixed(1);
    if (timer) timer.classList.toggle('danger', ratio < 0.35);
    const hpText = $('#hudHp');
    if (hpText) hpText.textContent = Math.ceil(p.hp) + ' / ' + MAX_HP;
    const lvl = $('#hudLevel');
    if (lvl) lvl.textContent = '第' + '一二三四五'[G.levelIndex] + '关 · ' + lv.name;
    const rv = $('#hudRevive');
    if (rv) rv.textContent = G.revives;
    const sc = $('#hudScore');
    if (sc) sc.textContent = G.score;

    /* 体力条（独立于节流，保证手感跟手） */
    refreshStamina();

    updateBossBar();
  }

  function refreshStamina() {
    const p = G.player;
    if (!p) return;
    if (staminaFill) staminaFill.style.width = (p.stamina / MAX_STAMINA * 100).toFixed(1) + '%';
    const full = p.stamina >= BEAM_COST;
    if (staminaBarEl) staminaBarEl.classList.toggle('full', full);
    if (beamBtn) beamBtn.classList.toggle('empty', !full);
  }

  function setHudVisible(v) {
    const hud = $('#hud');
    if (hud) hud.hidden = !v;
  }

  /* 按游戏状态统一控制 HUD / 触屏控件 / 暂停键的显隐，避免遮罩下透出 */
  let _uiState = null;
  let touchEnabled = false;
  function syncUi() {
    if (_uiState === G.state) return;
    _uiState = G.state;
    const playing = G.state === 'playing';
    setHudVisible(playing);
    const t = $('#touch');
    if (t) t.hidden = !(playing && touchEnabled);
    const pb = $('#btnPause');
    if (pb) pb.style.display = playing ? '' : 'none';
  }

  /* ============================================================
     界面动作
     ============================================================ */
  function handleAction(act) {
    switch (act) {
      case 'startGame':
        ensureAudio();
        tryAutoFullscreen();
        G.score = 0; G.revives = 0; G.bestCombo = 0; G.totalKills = 0;
        G.beamKills = 0; G.cratesSmashed = 0;
        G.runStart = Date.now();
        loadLevel(0);
        break;
      case 'startLevel':
        hideOverlay();
        G.state = 'playing';
        G.levelDamaged = false;
        G.levelRevives = 0;
        G.bossDamaged = false;
        syncUi();
        ensureAudio();
        musicStart();
        break;
      case 'revive':
        revivePlayer();
        break;
      case 'restartLevel':
        hideBossBar();
        G.score = Math.max(0, G.score - 200);
        loadLevel(G.levelIndex);
        break;
      case 'nextLevel':
        loadLevel(Math.min(G.levelIndex + 1, UG.LEVELS.length - 1));
        break;
      case 'achievements':
        showAchievements();
        break;
      case 'title':
        hideBossBar();
        showTitle();
        break;
      case 'resume':
        G.state = 'playing';
        hideOverlay();
        musicStart();
        break;
      case 'pause':
        pauseGame();
        break;
      case 'music':
        toggleMusic();
        break;
      case 'fullscreen':
        toggleFullscreen();
        break;
      case 'resetSave':
        G.save = Object.assign({}, DEFAULT_SAVE);
        persist();
        showAchievements();
        break;
      case 'backFromAch':
        showTitle();
        break;
    }
  }

  function pauseGame() {
    if (G.state !== 'playing') return;
    G.state = 'paused';
    musicStop();
    showOverlay(
      '<div class="screen">' +
        '<h2 class="result-title">暂停</h2>' +
        '<p class="result-sub">' + G.level.name + ' · 第 ' + (G.levelIndex + 1) + ' 关</p>' +
        '<div class="menu">' +
          '<button class="btn primary" data-act="resume">继续</button>' +
          '<button class="btn ghost" data-act="music">' + (G.save.musicOn ? '🎵 音乐：开' : '🔇 音乐：关') + '</button>' +
          '<button class="btn ghost" data-act="fullscreen">切换全屏</button>' +
          '<button class="btn ghost" data-act="title">返回标题</button>' +
        '</div>' +
        '<div class="keys">' +
          '<span><kbd>← →</kbd>移动</span><span><kbd>空格</kbd>跳跃</span>' +
          '<span><kbd>↑</kbd>向上射击</span><span><kbd>↓</kbd>趴下／下射</span>' +
          '<span><kbd>J</kbd>攻击</span><span><kbd>K</kbd>光波（体力满）</span>' +
          '<span><kbd>L</kbd>冲刺</span><span><kbd>P</kbd>暂停</span>' +
        '</div>' +
      '</div>'
    );
  }

  function showTitle() {
    G.state = 'title';
    musicStop();
    musicStart();          /* 标题页恢复音乐 */
    hideBossBar();
    syncUi();
    const achCount = Object.keys(G.save.achievements).length;
    showOverlay(
      '<div class="screen screen--title">' +
        '<div class="title-info">' +
          '<h1 class="title-logo">奥特曼</h1>' +
          '<p class="title-sub">ULTRA GUARDIAN</p>' +
          '<p class="title-desc">五关怪兽与 BOSS，远程弹幕与蓄力光波。<br>无限复活——看看你第几次才能通关。</p>' +
          '<div class="keys">' +
            '<span><kbd>← →</kbd>移动</span><span><kbd>空格</kbd>跳跃（可二段）</span>' +
            '<span><kbd>↑</kbd>向上射击</span><span><kbd>↓</kbd>趴下／空中下射</span>' +
            '<span><kbd>J</kbd>能量弹</span><span><kbd>K</kbd>蓄力光波（需体力）</span>' +
            '<span><kbd>L</kbd>冲刺</span><span><kbd>P</kbd>暂停</span>' +
          '</div>' +
        '</div>' +
        '<div class="title-menu">' +
          '<div class="menu">' +
            '<button class="btn primary" data-act="startGame">开始游戏</button>' +
            '<button class="btn" data-act="achievements">成就 ' + achCount + ' / ' + UG.ACHIEVEMENTS.length + '</button>' +
            '<button class="btn ghost" data-act="fullscreen">全屏模式</button>' +
            '<button class="btn ghost" data-act="music">' + (G.save.musicOn ? '🎵 音乐：开' : '🔇 音乐：关') + '</button>' +
            '<a class="btn ghost" href="https://github.com/xueshiqing/xueshiqing.github.io/issues" target="_blank" rel="noopener">💬 反馈 / 提 Issue</a>' +
          '</div>' +
          '<p class="title-tip">支持键盘与触屏 · 手机横屏体验最佳</p>' +
        '</div>' +
      '</div>'
    );
  }

  function showAchievements() {
    G.state = 'achievements';
    const got = Object.keys(G.save.achievements).length;
    const list = UG.ACHIEVEMENTS.map((a) => {
      const has = hasAch(a.id);
      return '<div class="ach ' + (has ? 'got' : 'locked') + '">' +
        '<div class="ach-icon">' + (has ? a.icon : '🔒') + '</div>' +
        '<div class="ach-text"><div class="ach-name">' + a.name + '</div>' +
        '<div class="ach-desc">' + a.desc + '</div></div></div>';
    }).join('');
    showOverlay(
      '<div class="screen">' +
        '<h2 class="result-title">成就</h2>' +
        '<p class="result-sub">已解锁 ' + got + ' / ' + UG.ACHIEVEMENTS.length + ' · 累计复活 ' + (G.save.totalRevives || 0) + ' 次</p>' +
        '<div class="ach-list">' + list + '</div>' +
        '<div class="menu btn-row">' +
          '<button class="btn small" data-act="backFromAch">返回</button>' +
          '<button class="btn small ghost" data-act="resetSave">清空记录</button>' +
        '</div>' +
      '</div>'
    );
  }

  let _fsTried = 0;
  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  /* 自动全屏：Fullscreen API 必须由用户手势触发，无法在旋转屏幕时自动调用，
     所以挂在「开始游戏」这次点击上。iOS Safari 不支持该 API，静默跳过。 */
  function tryAutoFullscreen() {
    if (!isTouchDevice() || isFullscreen()) return;
    if (Date.now() - _fsTried < 10000) return;
    _fsTried = Date.now();
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;
    try {
      const p = req.call(el, { navigationUI: 'hide' });
      if (p && p.then) {
        p.then(() => {
          if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(() => {});
          }
          setTimeout(() => UG.Screen.resize(), 320);
          toast('已进入全屏 · 再次点击可退出');
        }).catch(() => {});
      }
    } catch (e) { /* 忽略 */ }
  }

  function toggleFullscreen() {
    const el = document.documentElement;
    if (!isFullscreen()) {
      (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el);
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
    }
  }

  /* ============================================================
     触屏检测
     ============================================================ */
  function isTouchDevice() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }

  function setupTouch() {
    const touchEl = $('#touch');
    touchEnabled = isTouchDevice();
    if (!touchEnabled) return;
    touchEl.hidden = true;
    UG.Input.bindTouch(touchEl);

    const check = () => {
      const portrait = window.innerHeight > window.innerWidth;
      $('#rotate').hidden = !(portrait && window.innerWidth < 820);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', () => setTimeout(check, 200));
  }

  /* ============================================================
     启动
     ============================================================ */
  function boot() {
    UG.Screen.init($('#game'));
    UG.Screen.onResize = onViewportChange;
    UG.Input.init();
    UG.Audio.init();
    G.save = loadSave();
    if (UG.Audio.Music) UG.Audio.Music.enabled = G.save.musicOn !== false;

    setupTouch();

    beamBtn = document.querySelector('.sec[data-key="beam"]');
    staminaFill = $('#staminaFill');
    staminaBarEl = $('#staminaBar');

    // 暂停按钮
    const hudRight = document.querySelector('.hud-right');
    if (hudRight && !$('#btnPause')) {
      const b = document.createElement('button');
      b.id = 'btnPause';
      b.className = 'icon-btn';
      b.style.pointerEvents = 'auto';
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
      b.addEventListener('click', () => handleAction('pause'));
      hudRight.appendChild(b);
    }

    // 暂停快捷键
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (G.state === 'playing') pauseGame();
        else if (G.state === 'paused') { G.state = 'playing'; hideOverlay(); }
      }
    });

    // 首次交互解锁音频
    /* 首次点击任意位置：解锁音频 + 请求全屏。
       放在这里而不是「开始游戏」里，是为了让浏览器的全屏提示在标题页就弹完，
       不会盖住进入关卡后的居中按钮。 */
    const unlockAudio = () => { ensureAudio(); tryAutoFullscreen(); };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    showTitle();
    requestAnimationFrame(loop);

    /* 调试钩子：仅在 #debug 时暴露内部状态，方便自动化测试 */
    if (/^#(debug|shot|play|boss|run|crouch|aimup)/.test(location.hash)) {
      global.__UG = { G, handleAction, spawnEnemy, damagePlayer, loadLevel, get state() { return G.state; } };
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window);
