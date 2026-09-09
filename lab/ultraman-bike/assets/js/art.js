/* ==========================================================================
   art.js — 全部矢量绘制：背景 / 奥特曼 / 小怪 / BOSS / 地形 / 弹幕
   所有绘制都在逻辑坐标（640x360）下进行，脚底为 y 基准
   ========================================================================== */
(function (global) {
  'use strict';

  const UG = global.UG;
  const { clamp, lerp, rand, TAU, rgba, roundRect } = UG;
  const Art = UG.Art = {};

  /* ------------------------------------------------------------ 工具 */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /** 胶囊（圆头线段） */
  function capsule(ctx, x1, y1, x2, y2, w, fill, stroke) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) { ctx.beginPath(); ctx.arc(x1, y1, w / 2, 0, TAU); ctx.fill(); return; }
    const a = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(x1, y1); ctx.rotate(a);
    roundRect(ctx, 0, -w / 2, len, w, w / 2);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.restore();
  }

  function grad(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([p, c]) => g.addColorStop(p, c));
    return g;
  }

  /* ============================================================
     背景
     ============================================================ */
  const bgCache = Object.create(null);

  function buildLayers(level) {
    const rnd = mulberry32(level.seed || 1234);
    const art = { far: [], mid: [], near: [], stars: [], extra: [] };
    const span = level.width;

    if (level.theme === 'city') {
      for (let x = -200; x < span + 400; x += 90 + rnd() * 70) {
        art.far.push({ x, w: 46 + rnd() * 54, h: 70 + rnd() * 120, lit: rnd() > 0.55 });
      }
      for (let x = -200; x < span + 400; x += 120 + rnd() * 90) {
        art.mid.push({ x, w: 54 + rnd() * 46, h: 46 + rnd() * 66, lit: rnd() > 0.4 });
      }
      for (let x = -100; x < span + 300; x += 150 + rnd() * 120) {
        art.near.push({ x, h: 18 + rnd() * 26, w: 20 + rnd() * 30 });
      }
    } else if (level.theme === 'desert') {
      for (let x = -300; x < span + 500; x += 210 + rnd() * 130) {
        art.far.push({ x, h: 40 + rnd() * 70, w: 200 + rnd() * 180 });
      }
      for (let x = -200; x < span + 400; x += 150 + rnd() * 110) {
        art.mid.push({ x, h: 22 + rnd() * 34, w: 130 + rnd() * 120 });
      }
      for (let x = -100; x < span + 300; x += 120 + rnd() * 140) {
        art.near.push({ x, h: 10 + rnd() * 18, w: 40 + rnd() * 50, pillar: rnd() > 0.6 });
      }
    } else if (level.theme === 'snow') {
      for (let x = -300; x < span + 500; x += 190 + rnd() * 150) {
        art.far.push({ x, h: 90 + rnd() * 90, w: 190 + rnd() * 160 });
      }
      for (let x = -200; x < span + 400; x += 150 + rnd() * 120) {
        art.mid.push({ x, h: 46 + rnd() * 50, w: 140 + rnd() * 130 });
      }
      for (let x = -100; x < span + 300; x += 90 + rnd() * 90) {
        art.near.push({ x, h: 16 + rnd() * 22, w: 26 + rnd() * 26 });
      }
      for (let i = 0; i < 150; i++) {
        art.extra.push({ x: rnd() * 700, y: rnd() * 380, r: 0.8 + rnd() * 1.8, s: 14 + rnd() * 34 });
      }
    } else if (level.theme === 'volcano') {
      for (let x = -300; x < span + 500; x += 180 + rnd() * 130) {
        art.far.push({ x, h: 110 + rnd() * 100, w: 220 + rnd() * 180 });
      }
      for (let x = -200; x < span + 400; x += 140 + rnd() * 110) {
        art.mid.push({ x, h: 40 + rnd() * 60, w: 130 + rnd() * 120 });
      }
      for (let x = -100; x < span + 300; x += 110 + rnd() * 120) {
        art.near.push({ x, h: 12 + rnd() * 26, w: 30 + rnd() * 40 });
      }
      for (let i = 0; i < 60; i++) {
        art.extra.push({ x: rnd() * 900, y: rnd() * 360, s: 1 + rnd() * 2.4, sp: 8 + rnd() * 26 });
      }
    } else { /* space */
      for (let i = 0; i < 260; i++) {
        art.stars.push({ x: rnd() * 900, y: rnd() * 380, r: 0.4 + rnd() * 1.7, tw: rnd() * TAU });
      }
      for (let x = -300; x < span + 500; x += 240 + rnd() * 160) {
        art.far.push({ x, h: 60 + rnd() * 110, w: 120 + rnd() * 160, ring: rnd() > 0.7 });
      }
      for (let x = -200; x < span + 400; x += 160 + rnd() * 140) {
        art.mid.push({ x, h: 26 + rnd() * 44, w: 90 + rnd() * 110 });
      }
    }
    return art;
  }

  Art.prepareLevel = function (level) {
    if (!bgCache[level.id]) bgCache[level.id] = buildLayers(level);
    level._art = bgCache[level.id];
  };

  Art.background = function (ctx, level, camX, time) {
    const W = UG.VIEW.w, H = UG.VIEW.h;
    const art = level._art || (level._art = bgCache[level.id] || buildLayers(level));
    const th = level.theme;

    /* --- 天空 --- */
    let sky;
    if (th === 'city') {
      sky = grad(ctx, 0, 0, 0, H, [[0, '#123a6b'], [0.45, '#2f7bb5'], [0.8, '#7fc0e0'], [1, '#cfe9f5']]);
    } else if (th === 'desert') {
      sky = grad(ctx, 0, 0, 0, H, [[0, '#3d1f52'], [0.35, '#a8503f'], [0.7, '#e08a45'], [1, '#f6c789']]);
    } else if (th === 'snow') {
      sky = grad(ctx, 0, 0, 0, H, [[0, '#0e2a4a'], [0.5, '#2f6f9e'], [0.85, '#8ec6e0'], [1, '#dcefff']]);
    } else if (th === 'volcano') {
      sky = grad(ctx, 0, 0, 0, H, [[0, '#1a0510'], [0.4, '#5c0f1a'], [0.75, '#a82a15'], [1, '#e8611f']]);
    } else {
      sky = grad(ctx, 0, 0, 0, H, [[0, '#04030f'], [0.5, '#150d33'], [1, '#2a1050']]);
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    /* --- 星星 / 太空 --- */
    if (th === 'space') {
      ctx.save();
      art.stars.forEach((s) => {
        const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 1.6 + s.tw));
        ctx.globalAlpha = a;
        ctx.fillStyle = '#e9f3ff';
        ctx.beginPath();
        ctx.arc(s.x - camX * 0.04 % 900, s.y, s.r, 0, TAU);
        ctx.fill();
      });
      ctx.restore();
      // 星云
      const nx = -camX * 0.06;
      const rg = ctx.createRadialGradient(320 + nx, 130, 10, 320 + nx, 130, 260);
      rg.addColorStop(0, 'rgba(150,80,255,.32)');
      rg.addColorStop(0.5, 'rgba(60,20,140,.18)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }

    /* --- 太阳 / 月亮 --- */
    if (th === 'city' || th === 'desert') {
      const sx = (th === 'city' ? 520 : 420) - camX * 0.03;
      const rg = ctx.createRadialGradient(sx, 96, 4, sx, 96, 74);
      rg.addColorStop(0, th === 'city' ? 'rgba(255,250,220,.95)' : 'rgba(255,225,150,.95)');
      rg.addColorStop(0.35, th === 'city' ? 'rgba(255,225,140,.5)' : 'rgba(255,150,80,.45)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(sx - 90, 6, 180, 180);
      ctx.fillStyle = th === 'city' ? '#fff8dc' : '#ffe7a8';
      ctx.beginPath(); ctx.arc(sx, 96, 21, 0, TAU); ctx.fill();
    }
    if (th === 'snow') {
      const mx = 540 - camX * 0.02;
      ctx.fillStyle = 'rgba(230,245,255,.9)';
      ctx.beginPath(); ctx.arc(mx, 78, 24, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(140,190,225,.55)';
      ctx.beginPath(); ctx.arc(mx + 11, 70, 21, 0, TAU); ctx.fill();
    }
    if (th === 'volcano') {
      const rg = ctx.createRadialGradient(300 - camX * 0.02, 300, 20, 300 - camX * 0.02, 300, 320);
      rg.addColorStop(0, 'rgba(255,120,30,.5)');
      rg.addColorStop(0.5, 'rgba(200,40,10,.22)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    }

    /* --- 远景层 --- */
    const gy = level.groundY;
    ctx.save();
    const fx = -camX * 0.14;
    art.far.forEach((b) => {
      const x = b.x + fx;
      if (x < -340 || x > W + 340) return;
      if (th === 'city') {
        ctx.fillStyle = '#1d3a5c';
        ctx.fillRect(x, gy - b.h, b.w, b.h + 60);
        if (b.lit) {
          ctx.fillStyle = 'rgba(255,220,140,.35)';
          for (let wy = gy - b.h + 8; wy < gy - 6; wy += 13) {
            for (let wx = x + 6; wx < x + b.w - 8; wx += 12) ctx.fillRect(wx, wy, 5, 7);
          }
        }
      } else if (th === 'desert') {
        ctx.fillStyle = '#8a5230';
        ctx.beginPath();
        ctx.moveTo(x, gy + 40);
        ctx.quadraticCurveTo(x + b.w / 2, gy - b.h, x + b.w, gy + 40);
        ctx.fill();
      } else if (th === 'snow') {
        ctx.fillStyle = '#5b86ad';
        ctx.beginPath();
        ctx.moveTo(x, gy + 40);
        ctx.lineTo(x + b.w * 0.45, gy - b.h);
        ctx.lineTo(x + b.w * 0.62, gy - b.h * 0.72);
        ctx.lineTo(x + b.w, gy + 40);
        ctx.fill();
        ctx.fillStyle = 'rgba(230,245,255,.7)';
        ctx.beginPath();
        ctx.moveTo(x + b.w * 0.45, gy - b.h);
        ctx.lineTo(x + b.w * 0.62, gy - b.h * 0.72);
        ctx.lineTo(x + b.w * 0.52, gy - b.h * 0.6);
        ctx.fill();
      } else if (th === 'volcano') {
        ctx.fillStyle = '#2b0d12';
        ctx.beginPath();
        ctx.moveTo(x, gy + 40);
        ctx.lineTo(x + b.w * 0.4, gy - b.h);
        ctx.lineTo(x + b.w * 0.52, gy - b.h * 0.82);
        ctx.lineTo(x + b.w, gy + 40);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,90,20,.55)';
        ctx.beginPath();
        ctx.moveTo(x + b.w * 0.4, gy - b.h);
        ctx.lineTo(x + b.w * 0.52, gy - b.h * 0.82);
        ctx.lineTo(x + b.w * 0.46, gy - b.h * 0.5);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(90,60,170,.5)';
        ctx.beginPath(); ctx.arc(x + b.w / 2, gy - b.h, b.w / 2, 0, TAU); ctx.fill();
        if (b.ring) {
          ctx.strokeStyle = 'rgba(180,150,255,.4)'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(x + b.w / 2, gy - b.h, b.w * 0.9, b.w * 0.22, -0.3, 0, TAU); ctx.stroke();
        }
      }
    });

    /* --- 中景层 --- */
    const mx2 = -camX * 0.34;
    art.mid.forEach((b) => {
      const x = b.x + mx2;
      if (x < -320 || x > W + 320) return;
      if (th === 'city') {
        ctx.fillStyle = '#122a45';
        ctx.fillRect(x, gy - b.h, b.w, b.h + 70);
        ctx.fillStyle = 'rgba(120,190,255,.16)';
        ctx.fillRect(x, gy - b.h, b.w, 3);
        if (b.lit) {
          ctx.fillStyle = 'rgba(255,215,130,.5)';
          for (let wy = gy - b.h + 10; wy < gy - 10; wy += 15) {
            for (let wx = x + 7; wx < x + b.w - 9; wx += 14) ctx.fillRect(wx, wy, 6, 8);
          }
        }
      } else if (th === 'desert') {
        ctx.fillStyle = '#6d3f22';
        ctx.beginPath();
        ctx.moveTo(x, gy + 40);
        ctx.quadraticCurveTo(x + b.w / 2, gy - b.h, x + b.w, gy + 40);
        ctx.fill();
      } else if (th === 'snow') {
        ctx.fillStyle = '#3f6489';
        ctx.beginPath();
        ctx.moveTo(x, gy + 40);
        ctx.lineTo(x + b.w * 0.5, gy - b.h);
        ctx.lineTo(x + b.w, gy + 40);
        ctx.fill();
      } else if (th === 'volcano') {
        ctx.fillStyle = '#3a1218';
        ctx.beginPath();
        ctx.moveTo(x, gy + 40);
        ctx.lineTo(x + b.w * 0.5, gy - b.h);
        ctx.lineTo(x + b.w, gy + 40);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(50,30,110,.65)';
        ctx.fillRect(x, gy - b.h, b.w, b.h + 60);
        ctx.fillStyle = 'rgba(140,220,255,.5)';
        ctx.fillRect(x + b.w * 0.3, gy - b.h - 8, 3, 8);
      }
    });

    /* --- 近景层 --- */
    const nx2 = -camX * 0.62;
    art.near.forEach((b) => {
      const x = b.x + nx2;
      if (x < -160 || x > W + 160) return;
      if (th === 'city') {
        ctx.fillStyle = '#0a1826';
        ctx.fillRect(x, gy - b.h, b.w, b.h + 70);
      } else if (th === 'desert') {
        if (b.pillar) {
          ctx.fillStyle = '#5a3218';
          ctx.fillRect(x, gy - 70, 14, 70);
          ctx.fillRect(x - 5, gy - 74, 24, 8);
        } else {
          ctx.fillStyle = '#7a4a26';
          ctx.beginPath();
          ctx.moveTo(x, gy + 30); ctx.quadraticCurveTo(x + b.w / 2, gy - b.h, x + b.w, gy + 30);
          ctx.fill();
        }
      } else if (th === 'snow') {
        ctx.fillStyle = '#2c4a68';
        ctx.beginPath();
        ctx.moveTo(x, gy + 30); ctx.lineTo(x + b.w / 2, gy - b.h); ctx.lineTo(x + b.w, gy + 30);
        ctx.fill();
        ctx.fillStyle = 'rgba(240,250,255,.85)';
        ctx.beginPath();
        ctx.moveTo(x + b.w * 0.5, gy - b.h);
        ctx.lineTo(x + b.w * 0.62, gy - b.h * 0.72);
        ctx.lineTo(x + b.w * 0.38, gy - b.h * 0.72);
        ctx.fill();
      } else if (th === 'volcano') {
        ctx.fillStyle = '#1c0709';
        ctx.beginPath();
        ctx.moveTo(x, gy + 30); ctx.lineTo(x + b.w / 2, gy - b.h); ctx.lineTo(x + b.w, gy + 30);
        ctx.fill();
      }
    });
    ctx.restore();

    /* --- 天气粒子 --- */
    if (th === 'snow') {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      art.extra.forEach((s) => {
        const x = (s.x + Math.sin(time * 0.6 + s.x) * 12 - camX * 0.25) % 700;
        const y = (s.y + time * s.s) % 380;
        ctx.beginPath(); ctx.arc(x < 0 ? x + 700 : x, y, s.r, 0, TAU); ctx.fill();
      });
      ctx.restore();
    } else if (th === 'volcano') {
      ctx.save();
      art.extra.forEach((e) => {
        const y = 380 - ((time * e.sp + e.y) % 400);
        const x = (e.x - camX * 0.4) % 900;
        ctx.globalAlpha = 0.25 + 0.4 * (y / 380);
        ctx.fillStyle = '#ff9a3c';
        ctx.beginPath(); ctx.arc(x < 0 ? x + 900 : x, y, e.s, 0, TAU); ctx.fill();
      });
      ctx.restore();
    }
  };

  /* ============================================================
     地形
     ============================================================ */
  const THEME_GROUND = {
    city:    { top: '#5c6a78', body: '#2b3540', edge: '#8b9bab', accent: '#ffd84d' },
    desert:  { top: '#c99a5c', body: '#7a4f28', edge: '#e6c08a', accent: '#ffd84d' },
    snow:    { top: '#e8f4ff', body: '#7fa3c2', edge: '#ffffff', accent: '#4fd6ff' },
    volcano: { top: '#4a1f1a', body: '#250d0b', edge: '#ff6a2a', accent: '#ff9a3c' },
    space:   { top: '#4a3f7a', body: '#1b1440', edge: '#a78bfa', accent: '#4fd6ff' },
  };

  Art.ground = function (ctx, level, camX, time) {
    const W = UG.VIEW.w, H = UG.VIEW.h, gy = level.groundY;
    const c = THEME_GROUND[level.theme];
    ctx.fillStyle = c.body;
    ctx.fillRect(0, gy, W, H - gy);
    ctx.fillStyle = c.top;
    ctx.fillRect(0, gy, W, 6);
    ctx.fillStyle = c.edge;
    ctx.fillRect(0, gy, W, 2);

    // 地面纹理
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = c.edge;
    ctx.lineWidth = 1;
    const off = -(camX * 0.9) % 64;
    for (let x = off - 64; x < W + 64; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, gy + 10);
      ctx.lineTo(x + 18, gy + 10);
      ctx.stroke();
    }
    ctx.restore();
  };

  Art.platform = function (ctx, p, level, camX, time) {
    const c = THEME_GROUND[level.theme];
    const x = p.x - camX;
    if (x + p.w < -20 || x > UG.VIEW.w + 20) return;

    if (p.type === 'crate') {
      Art.crate(ctx, x, p.y, p.w, p.h, c, p.hp);
      return;
    }
    if (p.type === 'oneway') {
      ctx.fillStyle = c.body;
      roundRect(ctx, x, p.y, p.w, p.h, 3); ctx.fill();
      ctx.fillStyle = c.top;
      ctx.fillRect(x, p.y, p.w, 3);
      ctx.fillStyle = c.edge;
      ctx.fillRect(x, p.y, p.w, 1.5);
      // 支撑
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.fillRect(x + 4, p.y + p.h, p.w - 8, 3);
      return;
    }
    // solid
    ctx.fillStyle = c.body;
    roundRect(ctx, x, p.y, p.w, p.h + 40, 4); ctx.fill();
    ctx.fillStyle = c.top;
    ctx.fillRect(x, p.y, p.w, 5);
    ctx.fillStyle = c.edge;
    ctx.fillRect(x, p.y, p.w, 2);
  };

  Art.crate = function (ctx, x, y, w, h, c, hp) {
    ctx.save();
    const g = grad(ctx, x, y, x, y + h, [[0, '#c99356'], [1, '#8a5f30']]);
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w, h, 3); ctx.fill();
    ctx.strokeStyle = '#6b4520';
    ctx.lineWidth = 2;
    roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 3); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 2); ctx.lineTo(x + w - 2, y + h - 2);
    ctx.moveTo(x + w - 2, y + 2); ctx.lineTo(x + 2, y + h - 2);
    ctx.stroke();
    if (hp != null && hp < 2) {
      ctx.strokeStyle = 'rgba(0,0,0,.45)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.3, y + 2); ctx.lineTo(x + w * 0.45, y + h * 0.5); ctx.lineTo(x + w * 0.3, y + h - 2);
      ctx.stroke();
    }
    ctx.restore();
  };

  /* ============================================================
     奥特曼
     ============================================================ */
  const SILVER = ['#ffffff', '#e9eff5', '#a8b7c4'];
  const RED    = ['#ff6b6b', '#e02b2b', '#a51414'];

  /**
   * @param st { pose, t, facing, charge, hp, invuln }
   */
  Art.ultraman = function (ctx, x, y, st) {
    const f = st.facing >= 0 ? 1 : -1;
    const t = st.t || 0;
    const pose = st.pose || 'idle';
    const blink = st.invuln > 0 && Math.floor(t * 20) % 2 === 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(f * 1.25, 1.25);   /* 放大主角，提升可读性 */
    if (blink) ctx.globalAlpha = 0.58;

    const breathe = pose === 'idle' ? Math.sin(t * 2.4) * 0.8 : 0;
    const hipY = -27 + breathe;
    const shY  = -46 + breathe;
    const headY = -55 + breathe;

    /* ---------- 腿 ---------- */
    let lk = 0, rk = 0, lf = 0, rf = 0;
    if (pose === 'run') {
      const p = t * 13;
      lk = Math.sin(p) * 0.85; rk = Math.sin(p + Math.PI) * 0.85;
      lf = Math.max(0, Math.sin(p)) * 0.7; rf = Math.max(0, Math.sin(p + Math.PI)) * 0.7;
    } else if (pose === 'jump' || pose === 'fall') {
      lk = -0.7; rk = 0.45; lf = 0.9; rf = 0.2;
    } else if (pose === 'dash') {
      lk = -0.9; rk = 0.7; lf = 0.8; rf = 0.3;
    } else if (pose === 'hurt') {
      lk = 0.3; rk = -0.25;
    }

    const drawLeg = (kx, fx, shade) => {
      const knee = { x: kx * 7, y: hipY + 13 - Math.abs(kx) * 3 };
      const foot = { x: fx * 13 + kx * 3, y: -3 + (pose === 'jump' || pose === 'fall' ? -6 : 0) };
      capsule(ctx, 0, hipY, knee.x, knee.y, 11, shade);
      capsule(ctx, knee.x, knee.y, foot.x, foot.y, 9.5, shade);
      // 靴子
      ctx.fillStyle = RED[1];
      roundRect(ctx, foot.x - 5, foot.y - 4, 15, 7, 3); ctx.fill();
    };

    // 远侧腿（深色）
    drawLeg(-lk, -lf, SILVER[2]);
    // 远侧手臂
    const farArmA = pose === 'run' ? Math.sin(t * 13 + Math.PI) * 0.7 : (pose === 'shoot' ? -0.9 : 0.18);
    capsule(ctx, 0, shY + 4, -6 + Math.cos(farArmA) * 15, shY + 8 + Math.sin(farArmA) * 12, 8, SILVER[2]);
    capsule(ctx, -6 + Math.cos(farArmA) * 15, shY + 8 + Math.sin(farArmA) * 12,
            -4 + Math.cos(farArmA + 0.5) * 27, shY + 8 + Math.sin(farArmA + 0.5) * 22, 7.5, SILVER[2]);

    /* ---------- 躯干 ---------- */
    const bodyG = grad(ctx, -10, shY, 10, hipY, [[0, SILVER[0]], [0.5, SILVER[1]], [1, SILVER[2]]]);
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.moveTo(-10, hipY + 2);
    ctx.quadraticCurveTo(-13, shY + 8, -12, shY);
    ctx.quadraticCurveTo(-8, shY - 5, 0, shY - 5);
    ctx.quadraticCurveTo(8, shY - 5, 12, shY);
    ctx.quadraticCurveTo(13, shY + 8, 10, hipY + 2);
    ctx.closePath();
    ctx.fill();

    // 胸口红带
    ctx.fillStyle = RED[1];
    ctx.beginPath();
    ctx.moveTo(-12, shY + 3);
    ctx.quadraticCurveTo(0, shY + 9, 12, shY + 3);
    ctx.lineTo(11, shY + 8);
    ctx.quadraticCurveTo(0, shY + 14, -11, shY + 8);
    ctx.closePath();
    ctx.fill();

    // 腰部红条
    ctx.fillStyle = RED[2];
    ctx.beginPath();
    ctx.moveTo(-10, hipY - 3); ctx.lineTo(10, hipY - 3);
    ctx.lineTo(9, hipY + 2); ctx.lineTo(-9, hipY + 2);
    ctx.closePath(); ctx.fill();

    // 彩色计时器
    const hpRatio = clamp(st.hp == null ? 1 : st.hp, 0, 1);
    const danger = hpRatio < 0.35;
    const pulse = danger ? (Math.sin(t * 14) > 0 ? 1 : 0.25) : (0.7 + 0.3 * Math.sin(t * 3));
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.shadowColor = danger ? '#ff4d4d' : '#4fd6ff';
    ctx.shadowBlur = 10;
    ctx.fillStyle = danger ? '#ff3b3b' : '#4fd6ff';
    ctx.beginPath(); ctx.arc(0, shY + 11, 4.6, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(10,30,45,.85)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, shY + 11, 4.6, 0, TAU); ctx.stroke();

    // 脖子
    ctx.fillStyle = SILVER[1];
    roundRect(ctx, -4, headY + 8, 8, 8, 3); ctx.fill();

    /* ---------- 头 ---------- */
    ctx.fillStyle = grad(ctx, -8, headY - 10, 8, headY + 8, [[0, '#ffffff'], [0.55, '#f2f7fb'], [1, '#bcc9d6']]);
    ctx.beginPath();
    ctx.moveTo(-7.5, headY + 2);
    ctx.quadraticCurveTo(-9, headY - 9, 0, headY - 10.5);
    ctx.quadraticCurveTo(9, headY - 9, 7.5, headY + 2);
    ctx.quadraticCurveTo(6, headY + 8, 0, headY + 8);
    ctx.quadraticCurveTo(-6, headY + 8, -7.5, headY + 2);
    ctx.closePath();
    ctx.fill();

    // 头鳍
    ctx.fillStyle = RED[1];
    ctx.beginPath();
    ctx.moveTo(-5, headY - 7.5);
    ctx.quadraticCurveTo(-2.5, headY - 16.5, 7.5, headY - 11.5);
    ctx.lineTo(5, headY - 6.2);
    ctx.quadraticCurveTo(-1, headY - 9.5, -5, headY - 7.5);
    ctx.closePath(); ctx.fill();

    // 眼睛
    ctx.save();
    ctx.shadowColor = '#ffd84d'; ctx.shadowBlur = 7;
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.ellipse(3.8, headY - 2.8, 5.0, 3.4, -0.22, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(2.4, headY - 4.0, 2.0, 1.2, -0.22, 0, TAU); ctx.fill();

    /* ---------- 近侧手臂 ---------- */
    let armA, foreA;
    if (pose === 'shoot') { armA = -0.05; foreA = -0.02; }
    else if (pose === 'beam') { armA = -0.5; foreA = -0.35; }
    else if (pose === 'run') { armA = Math.sin(t * 13) * 0.7; foreA = armA + 0.55; }
    else if (pose === 'jump' || pose === 'fall') { armA = -0.6; foreA = -1.0; }
    else if (pose === 'hurt') { armA = 0.9; foreA = 1.3; }
    else { armA = 0.2 + Math.sin(t * 2.4) * 0.05; foreA = armA + 0.5; }

    const shX = 5, shYy = shY + 4;
    const elb = { x: shX + Math.cos(armA) * 14, y: shYy + Math.sin(armA) * 12 };
    const hnd = { x: elb.x + Math.cos(foreA) * 14, y: elb.y + Math.sin(foreA) * 12 };
    capsule(ctx, shX, shYy, elb.x, elb.y, 8.5, SILVER[0]);
    capsule(ctx, elb.x, elb.y, hnd.x, hnd.y, 8, SILVER[1]);
    // 手腕红环
    ctx.fillStyle = RED[1];
    ctx.save(); ctx.translate(hnd.x, hnd.y); ctx.rotate(foreA);
    roundRect(ctx, -7, -4.4, 6, 8.8, 2.6); ctx.fill();
    ctx.restore();
    // 手
    ctx.fillStyle = SILVER[0];
    ctx.beginPath(); ctx.arc(hnd.x, hnd.y, 4.4, 0, TAU); ctx.fill();

    // 蓄力光球
    if (st.charge > 0) {
      const cr = 3 + st.charge * 9;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rg = ctx.createRadialGradient(hnd.x, hnd.y, 0, hnd.x, hnd.y, cr * 2.4);
      rg.addColorStop(0, 'rgba(255,255,255,.95)');
      rg.addColorStop(0.35, 'rgba(255,220,90,.8)');
      rg.addColorStop(1, 'rgba(255,150,30,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(hnd.x, hnd.y, cr * 2.4, 0, TAU); ctx.fill();
      ctx.restore();
      st.hand = { x: hnd.x * f + x, y: hnd.y + y };
    }

    /* ---------- 近侧腿 ---------- */
    drawLeg(lk, lf, SILVER[0]);

    ctx.restore();
  };

  /* ============================================================
     小怪
     ============================================================ */
  Art.minion = function (ctx, e, time) {
    const x = e.x, y = e.y;          // y = 脚底
    const f = e.facing >= 0 ? 1 : -1;
    const t = time + e.seed;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(f * 1.35, 1.35);
    if (e.flash > 0) ctx.filter = 'brightness(2.6) saturate(.6)';

    const bob = Math.sin(t * 6) * 1.5;

    if (e.type === 'grunt') {
      // 绿色双足小怪
      ctx.fillStyle = '#3f8a3f';
      capsule(ctx, -5, -6, -6, 0, 7, '#2f6b2f');
      capsule(ctx, 5, -6, 7, 0, 7, '#2f6b2f');
      ctx.fillStyle = '#4fa84f';
      ctx.beginPath();
      ctx.ellipse(0, -16 + bob, 12, 13, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#3f8a3f';
      ctx.beginPath(); ctx.ellipse(0, -10 + bob, 10, 8, 0, 0, TAU); ctx.fill();
      // 角
      ctx.fillStyle = '#e8e0c0';
      ctx.beginPath(); ctx.moveTo(-4, -27 + bob); ctx.lineTo(-2, -34 + bob); ctx.lineTo(1, -26 + bob); ctx.fill();
      // 眼
      ctx.fillStyle = '#ff5a3c';
      ctx.beginPath(); ctx.arc(5, -19 + bob, 2.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(5.8, -19.8 + bob, 0.9, 0, TAU); ctx.fill();
      // 嘴
      ctx.strokeStyle = '#12321a'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(4, -13 + bob); ctx.lineTo(9, -12 + bob); ctx.stroke();
    } else if (e.type === 'flyer') {
      const wing = Math.sin(t * 16) * 0.8;
      ctx.fillStyle = '#6b3fa8';
      // 翅膀
      ctx.beginPath();
      ctx.moveTo(0, -20 + bob);
      ctx.quadraticCurveTo(-14, -30 - wing * 12 + bob, -20, -16 + bob);
      ctx.quadraticCurveTo(-12, -18 + bob, 0, -14 + bob);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -20 + bob);
      ctx.quadraticCurveTo(14, -30 - wing * 12 + bob, 20, -16 + bob);
      ctx.quadraticCurveTo(12, -18 + bob, 0, -14 + bob);
      ctx.fill();
      // 身体
      ctx.fillStyle = '#8a5fd0';
      ctx.beginPath(); ctx.ellipse(0, -17 + bob, 8, 9, 0, 0, TAU); ctx.fill();
      // 眼
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath(); ctx.arc(4, -19 + bob, 2.4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1a0a2a';
      ctx.beginPath(); ctx.arc(4.8, -19 + bob, 1.1, 0, TAU); ctx.fill();
    } else if (e.type === 'shooter') {
      // 矮胖炮口怪
      ctx.fillStyle = '#7d8798';
      capsule(ctx, -6, -6, -7, 0, 8, '#5a6472');
      capsule(ctx, 6, -6, 7, 0, 8, '#5a6472');
      ctx.fillStyle = '#a4afc0';
      ctx.beginPath(); ctx.ellipse(0, -17 + bob, 13, 12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#5f6a7c';
      ctx.beginPath(); ctx.ellipse(-1, -17 + bob, 9, 8, 0, 0, TAU); ctx.fill();
      // 炮口
      ctx.fillStyle = '#3f4756';
      roundRect(ctx, 6, -21 + bob, 12, 7, 3); ctx.fill();
      ctx.fillStyle = e.charge > 0 ? '#ffb020' : '#8a929f';
      ctx.beginPath(); ctx.arc(17, -17.5 + bob, e.charge > 0 ? 3.4 : 2, 0, TAU); ctx.fill();
      // 眼
      ctx.fillStyle = '#ff7a3c';
      ctx.beginPath(); ctx.arc(2, -21 + bob, 2.2, 0, TAU); ctx.fill();
    } else if (e.type === 'charger') {
      // 冲撞牛怪
      ctx.fillStyle = '#7a4a22';
      capsule(ctx, -7, -8, -8, 0, 9, '#5c3618');
      capsule(ctx, 7, -8, 8, 0, 9, '#5c3618');
      ctx.fillStyle = '#9a5f2c';
      ctx.beginPath(); ctx.ellipse(0, -18 + bob, 15, 12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7a4a22';
      ctx.beginPath(); ctx.ellipse(-2, -14 + bob, 12, 9, 0, 0, TAU); ctx.fill();
      // 角
      ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(6, -26 + bob); ctx.lineTo(13, -31 + bob); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-6, -26 + bob); ctx.lineTo(-12, -32 + bob); ctx.stroke();
      // 眼
      ctx.fillStyle = e.charge > 0 ? '#ff3b3b' : '#ffd84d';
      ctx.beginPath(); ctx.arc(7, -21 + bob, 2.6, 0, TAU); ctx.fill();
    } else if (e.type === 'turret') {
      ctx.fillStyle = '#5b6577';
      ctx.beginPath();
      ctx.moveTo(-14, 0); ctx.lineTo(-11, -18); ctx.lineTo(11, -18); ctx.lineTo(14, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7c8798';
      ctx.beginPath(); ctx.ellipse(0, -18, 12, 6, 0, 0, TAU); ctx.fill();
      // 尖刺
      ctx.fillStyle = '#8a929f';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 8 - 2, -18); ctx.lineTo(i * 8, -28); ctx.lineTo(i * 8 + 2, -18);
        ctx.fill();
      }
      // 核心
      ctx.save();
      ctx.shadowColor = e.charge > 0 ? '#ff3b3b' : '#4fd6ff';
      ctx.shadowBlur = 8;
      ctx.fillStyle = e.charge > 0 ? '#ff5a5a' : '#4fd6ff';
      ctx.beginPath(); ctx.arc(0, -11, e.charge > 0 ? 4.4 : 3.2, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  };

  /* ============================================================
     BOSS
     ============================================================ */
  Art.boss = function (ctx, b, time) {
    const f = b.facing >= 0 ? 1 : -1;
    const t = time + (b.seed || 0);
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h);
    ctx.scale(f, 1);
    if (b.flash > 0) ctx.filter = 'brightness(2.4) saturate(.7)';
    if (b.hitShake > 0) ctx.translate(rand(-2, 2), rand(-2, 2));

    const bob = Math.sin(t * 2.6) * 2;

    switch (b.kind) {
      /* 1. 地底怪兽 哥尔赞 */
      case 'golza': {
        const s = b.scale || 1;
        ctx.scale(s, s);
        // 腿
        ctx.fillStyle = '#2b3a4a';
        capsule(ctx, -26, -40, -30, 0, 26, '#1e2a36');
        capsule(ctx, 26, -40, 30, 0, 26, '#1e2a36');
        // 尾
        ctx.strokeStyle = '#24313e'; ctx.lineWidth = 18; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-30, -60);
        ctx.quadraticCurveTo(-70, -50 + Math.sin(t * 3) * 8, -92, -18 + Math.sin(t * 3) * 10);
        ctx.stroke();
        // 身体
        ctx.fillStyle = grad(ctx, -40, -100, 40, -20, [[0, '#3d5266'], [0.6, '#2b3a4a'], [1, '#1b2530']]);
        ctx.beginPath();
        ctx.ellipse(0, -66 + bob, 40, 38, 0, 0, TAU);
        ctx.fill();
        // 背鳍
        ctx.fillStyle = '#8fb4d0';
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 14 - 4, -96 + bob + Math.abs(i) * 5);
          ctx.lineTo(i * 14, -116 + bob + Math.abs(i) * 7);
          ctx.lineTo(i * 14 + 4, -96 + bob + Math.abs(i) * 5);
          ctx.fill();
        }
        // 头（略亮 + 描边，让轮廓从身体里跳出来）
        ctx.fillStyle = '#4d657c';
        ctx.beginPath();
        ctx.ellipse(26, -92 + bob, 26, 22, -0.15, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#9fc0da';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(26, -92 + bob, 26, 22, -0.15, 0, TAU);
        ctx.stroke();
        // 颈部：把头和身体连起来，避免轮廓断裂
        ctx.fillStyle = '#41586d';
        ctx.beginPath();
        ctx.moveTo(-2, -104 + bob);
        ctx.quadraticCurveTo(18, -102 + bob, 22, -84 + bob);
        ctx.lineTo(-8, -76 + bob);
        ctx.quadraticCurveTo(-12, -96 + bob, -2, -104 + bob);
        ctx.fill();
        // 下颚
        ctx.fillStyle = '#3d5266';
        ctx.beginPath();
        ctx.ellipse(34, -80 + bob, 18, 11, -0.1, 0, TAU);
        ctx.fill();
        // 角
        ctx.fillStyle = '#c8dbe8';
        ctx.beginPath(); ctx.moveTo(16, -108 + bob); ctx.lineTo(14, -128 + bob); ctx.lineTo(24, -108 + bob); ctx.fill();
        // 眼
        ctx.save();
        ctx.shadowColor = '#ff3b3b'; ctx.shadowBlur = 10;
        ctx.fillStyle = b.phase === 2 ? '#ff2b2b' : '#ffb020';
        ctx.beginPath(); ctx.ellipse(36, -98 + bob, 5, 4, 0, 0, TAU); ctx.fill();
        ctx.restore();
        // 嘴
        ctx.fillStyle = '#0e151c';
        ctx.beginPath();
        ctx.moveTo(44, -84 + bob); ctx.lineTo(58, -88 + bob); ctx.lineTo(46, -76 + bob);
        ctx.fill();
        // 爪
        ctx.fillStyle = '#c8dbe8';
        [0, 1, 2].forEach((i) => {
          ctx.beginPath();
          ctx.moveTo(-34 + i * 4, -52); ctx.lineTo(-44 + i * 5, -40); ctx.lineTo(-32 + i * 4, -44);
          ctx.fill();
        });
        break;
      }

      /* 2. 沙漠蝎王 */
      case 'scorpion': {
        const s = b.scale || 1;
        ctx.scale(s, s);
        // 腿
        ctx.strokeStyle = '#8a5a24'; ctx.lineWidth = 8; ctx.lineCap = 'round';
        [-30, -12, 12, 30].forEach((lx, i) => {
          const sw = Math.sin(t * 6 + i) * 6;
          ctx.beginPath();
          ctx.moveTo(lx, -34);
          ctx.lineTo(lx + (i < 2 ? -18 : 18), -14 + sw);
          ctx.lineTo(lx + (i < 2 ? -22 : 22), 0 + sw);
          ctx.stroke();
        });
        // 身体
        ctx.fillStyle = grad(ctx, -40, -70, 40, -20, [[0, '#c98a3c'], [0.6, '#9a6425'], [1, '#6b4318']]);
        ctx.beginPath(); ctx.ellipse(0, -48 + bob, 38, 26, 0, 0, TAU); ctx.fill();
        // 甲片
        ctx.strokeStyle = '#6b4318'; ctx.lineWidth = 2.4;
        for (let i = -1; i <= 2; i++) {
          ctx.beginPath();
          ctx.ellipse(i * 12, -48 + bob, 8, 18, 0, 0, TAU);
          ctx.stroke();
        }
        // 头胸
        ctx.fillStyle = '#b87c33';
        ctx.beginPath(); ctx.ellipse(26, -46 + bob, 20, 17, 0, 0, TAU); ctx.fill();
        // 钳子
        [-1, 1].forEach((sd) => {
          const px = 46, py = -58 + sd * 14 + bob;
          ctx.strokeStyle = '#a86f2c'; ctx.lineWidth = 9;
          ctx.beginPath(); ctx.moveTo(20, -50 + bob); ctx.lineTo(px, py); ctx.stroke();
          ctx.fillStyle = '#c98a3c';
          ctx.save(); ctx.translate(px, py); ctx.rotate(sd * 0.4);
          ctx.beginPath(); ctx.ellipse(8, 0, 12, 8, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#6b4318';
          ctx.beginPath();
          ctx.moveTo(16, -6); ctx.lineTo(28, -9 + Math.sin(t * 8) * 2); ctx.lineTo(16, -1);
          ctx.fill();
          ctx.restore();
        });
        // 眼
        ctx.save();
        ctx.shadowColor = '#ffd84d'; ctx.shadowBlur = 8;
        ctx.fillStyle = '#ffd84d';
        ctx.beginPath(); ctx.arc(32, -52 + bob, 3.6, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(36, -42 + bob, 3, 0, TAU); ctx.fill();
        ctx.restore();
        // 尾巴
        const tw = Math.sin(t * 2.2) * 0.25;
        ctx.save();
        ctx.translate(-34, -54 + bob);
        ctx.rotate(tw);
        ctx.strokeStyle = '#9a6425'; ctx.lineWidth = 14; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-30, -30, -40, -78);
        ctx.stroke();
        // 毒刺
        ctx.fillStyle = b.phase === 2 ? '#ff3b3b' : '#e8dcc0';
        ctx.save();
        ctx.translate(-40, -78); ctx.rotate(0.5);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-6, -22); ctx.lineTo(7, -4); ctx.fill();
        ctx.restore();
        ctx.restore();
        break;
      }

      /* 3. 冰封巨兽 */
      case 'frost': {
        const s = b.scale || 1;
        ctx.scale(s, s);
        const float = Math.sin(t * 1.8) * 4;
        ctx.translate(0, float);
        // 冰晶底座
        ctx.fillStyle = 'rgba(150,220,255,.35)';
        ctx.beginPath(); ctx.ellipse(0, 4, 46, 10, 0, 0, TAU); ctx.fill();
        // 腿
        ctx.fillStyle = '#8fd4f0';
        capsule(ctx, -22, -38, -26, 0, 20, '#6fb8d8');
        capsule(ctx, 22, -38, 26, 0, 20, '#6fb8d8');
        // 身体
        ctx.fillStyle = grad(ctx, -40, -96, 40, -20, [[0, '#eafaff'], [0.5, '#a9e0f5'], [1, '#5f9fc4']]);
        ctx.beginPath(); ctx.ellipse(0, -62 + bob, 36, 36, 0, 0, TAU); ctx.fill();
        // 冰刺
        ctx.fillStyle = '#dff6ff';
        for (let i = -3; i <= 3; i++) {
          const hgt = 18 + (3 - Math.abs(i)) * 9;
          ctx.beginPath();
          ctx.moveTo(i * 11 - 5, -88 + bob + Math.abs(i) * 4);
          ctx.lineTo(i * 11, -88 - hgt + bob + Math.abs(i) * 4);
          ctx.lineTo(i * 11 + 5, -88 + bob + Math.abs(i) * 4);
          ctx.fill();
        }
        // 头
        ctx.fillStyle = '#dff6ff';
        ctx.beginPath(); ctx.ellipse(24, -88 + bob, 22, 20, -0.12, 0, TAU); ctx.fill();
        ctx.fillStyle = '#a9e0f5';
        ctx.beginPath(); ctx.ellipse(28, -82 + bob, 16, 14, -0.12, 0, TAU); ctx.fill();
        // 眼
        ctx.save();
        ctx.shadowColor = '#4fd6ff'; ctx.shadowBlur = 12;
        ctx.fillStyle = b.phase === 2 ? '#ff3b3b' : '#4fd6ff';
        ctx.beginPath(); ctx.ellipse(34, -92 + bob, 5.5, 4.5, -0.2, 0, TAU); ctx.fill();
        ctx.restore();
        // 尖角
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(12, -104 + bob); ctx.lineTo(8, -126 + bob); ctx.lineTo(22, -104 + bob); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-14, -96 + bob); ctx.lineTo(-24, -114 + bob); ctx.lineTo(-4, -96 + bob); ctx.fill();
        break;
      }

      /* 4. 熔岩暴君 */
      case 'inferno': {
        const s = b.scale || 1;
        ctx.scale(s, s);
        // 腿
        ctx.fillStyle = '#2a1210';
        capsule(ctx, -26, -40, -30, 0, 26, '#1a0b09');
        capsule(ctx, 26, -40, 30, 0, 26, '#1a0b09');
        // 岩浆裂纹
        ctx.strokeStyle = '#ff7a1f'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-28, -30); ctx.lineTo(-22, -18); ctx.lineTo(-30, -6);
        ctx.moveTo(28, -34); ctx.lineTo(22, -20); ctx.lineTo(30, -8);
        ctx.stroke();
        // 身体
        ctx.fillStyle = grad(ctx, -42, -104, 42, -20, [[0, '#4a1a12'], [0.55, '#2a0e0a'], [1, '#140604']]);
        ctx.beginPath(); ctx.ellipse(0, -68 + bob, 42, 40, 0, 0, TAU); ctx.fill();
        // 胸口熔核
        ctx.save();
        ctx.shadowColor = '#ff5a1f'; ctx.shadowBlur = 18;
        const rg = ctx.createRadialGradient(0, -66 + bob, 2, 0, -66 + bob, 22);
        rg.addColorStop(0, '#fff3c0');
        rg.addColorStop(0.4, '#ff8a1f');
        rg.addColorStop(1, 'rgba(255,60,10,0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(0, -66 + bob, 22, 0, TAU); ctx.fill();
        ctx.restore();
        // 肩甲尖刺
        ctx.fillStyle = '#3a1410';
        [-1, 1].forEach((sd) => {
          ctx.beginPath();
          ctx.moveTo(sd * 30, -96 + bob);
          ctx.lineTo(sd * 44, -122 + bob);
          ctx.lineTo(sd * 40, -92 + bob);
          ctx.fill();
        });
        // 头
        ctx.fillStyle = '#3a1410';
        ctx.beginPath(); ctx.ellipse(22, -96 + bob, 24, 20, -0.1, 0, TAU); ctx.fill();
        // 火焰鬃毛
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 7; i++) {
          const a = -0.6 + i * 0.28;
          const fl = 12 + Math.sin(t * 9 + i * 1.7) * 7;
          ctx.fillStyle = i % 2 ? 'rgba(255,140,30,.75)' : 'rgba(255,220,90,.6)';
          ctx.beginPath();
          ctx.moveTo(8 + Math.cos(a) * 20, -104 + bob + Math.sin(a) * 14);
          ctx.lineTo(8 + Math.cos(a) * (20 + fl), -104 + bob + Math.sin(a) * (14 + fl));
          ctx.lineTo(12 + Math.cos(a) * 20, -100 + bob + Math.sin(a) * 14);
          ctx.fill();
        }
        ctx.restore();
        // 眼
        ctx.save();
        ctx.shadowColor = '#ffd84d'; ctx.shadowBlur = 12;
        ctx.fillStyle = '#ffe14d';
        ctx.beginPath(); ctx.ellipse(32, -100 + bob, 6, 4, -0.2, 0, TAU); ctx.fill();
        ctx.restore();
        // 獠牙
        ctx.fillStyle = '#e8dcc0';
        [0, 1, 2].forEach((i) => {
          ctx.beginPath();
          ctx.moveTo(40 + i * 5, -86 + bob); ctx.lineTo(43 + i * 5, -76 + bob); ctx.lineTo(46 + i * 5, -86 + bob);
          ctx.fill();
        });
        break;
      }

      /* 5. 宇宙帝王 */
      case 'cosmo': {
        const s = b.scale || 1;
        ctx.scale(s, s);
        const float = Math.sin(t * 1.5) * 5;
        ctx.translate(0, float);
        // 触手腿
        ctx.strokeStyle = '#3a1f6b'; ctx.lineWidth = 12; ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
          const sw = Math.sin(t * 3 + i * 1.4) * 8;
          ctx.beginPath();
          ctx.moveTo(-24 + i * 16, -40);
          ctx.quadraticCurveTo(-30 + i * 18 + sw, -18, -26 + i * 16 + sw, 0);
          ctx.stroke();
        }
        // 身体
        ctx.fillStyle = grad(ctx, -44, -110, 44, -20, [[0, '#6b3fd0'], [0.5, '#3a1f6b'], [1, '#160a33']]);
        ctx.beginPath(); ctx.ellipse(0, -70 + bob, 44, 42, 0, 0, TAU); ctx.fill();
        // 星纹
        ctx.fillStyle = 'rgba(180,220,255,.65)';
        [[-16, -78], [10, -88], [22, -62], [-24, -52], [2, -48]].forEach((p, i) => {
          const tw = 0.5 + 0.5 * Math.sin(t * 4 + i);
          ctx.globalAlpha = tw;
          ctx.beginPath(); ctx.arc(p[0], p[1] + bob, 2.4, 0, TAU); ctx.fill();
        });
        ctx.globalAlpha = 1;
        // 光环
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(160,120,255,.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, -70 + bob, 62, 20, Math.sin(t * 0.6) * 0.4, 0, TAU);
        ctx.stroke();
        ctx.restore();
        // 头
        ctx.fillStyle = '#4a2a8a';
        ctx.beginPath(); ctx.ellipse(20, -104 + bob, 26, 22, -0.1, 0, TAU); ctx.fill();
        // 复眼
        ctx.save();
        ctx.shadowColor = b.phase === 2 ? '#ff3b3b' : '#a78bfa';
        ctx.shadowBlur = 14;
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = i % 2 ? (b.phase === 2 ? '#ff5a5a' : '#e0d4ff') : (b.phase === 2 ? '#ff2b2b' : '#a78bfa');
          ctx.beginPath();
          ctx.arc(12 + (i % 2) * 12, -110 + Math.floor(i / 2) * 10 + bob, 4.4, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
        // 角
        ctx.fillStyle = '#a78bfa';
        ctx.beginPath(); ctx.moveTo(4, -120 + bob); ctx.lineTo(-4, -142 + bob); ctx.lineTo(14, -118 + bob); ctx.fill();
        ctx.beginPath(); ctx.moveTo(26, -122 + bob); ctx.lineTo(34, -142 + bob); ctx.lineTo(40, -116 + bob); ctx.fill();
        // 披风光环
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const rg2 = ctx.createRadialGradient(0, -70 + bob, 10, 0, -70 + bob, 92);
        rg2.addColorStop(0, 'rgba(120,80,255,.28)');
        rg2.addColorStop(1, 'rgba(60,20,140,0)');
        ctx.fillStyle = rg2;
        ctx.beginPath(); ctx.arc(0, -70 + bob, 92, 0, TAU); ctx.fill();
        ctx.restore();
        break;
      }
    }
    ctx.restore();
  };

  /* ============================================================
     弹幕
     ============================================================ */
  Art.bullet = function (ctx, b, camX, time) {
    const x = b.x - camX, y = b.y;
    if (x < -30 || x > UG.VIEW.w + 30) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    if (b.side === 'player') {
      if (b.kind === 'bolt') {
        ctx.shadowColor = '#7fe6ff'; ctx.shadowBlur = 8;
        ctx.fillStyle = '#dffaff';
        ctx.beginPath(); ctx.ellipse(x, y, 6, 2.6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#4fd6ff';
        ctx.beginPath(); ctx.ellipse(x - 4, y, 5, 1.8, 0, 0, TAU); ctx.fill();
      } else if (b.kind === 'wave') {
        // 斯派修姆光线
        const len = b.len || 260;
        const g = ctx.createLinearGradient(x - len, y, x, y);
        g.addColorStop(0, 'rgba(79,214,255,0)');
        g.addColorStop(0.5, 'rgba(120,230,255,.55)');
        g.addColorStop(1, 'rgba(255,255,255,.95)');
        ctx.fillStyle = g;
        ctx.fillRect(x - len, y - b.r, len, b.r * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - len * 0.7, y - b.r * 0.32, len * 0.7, b.r * 0.64);
        ctx.shadowColor = '#4fd6ff'; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(x, y, b.r * 1.5, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fill();
      } else if (b.kind === 'disc') {
        // 八分光轮
        ctx.translate(x, y);
        ctx.rotate(time * 22);
        ctx.shadowColor = '#ffd84d'; ctx.shadowBlur = 12;
        ctx.strokeStyle = '#fff3c0'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, b.r, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,216,77,.8)'; ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          ctx.beginPath();
          ctx.moveTo(Math.cos(i / 8 * TAU) * b.r * 0.4, Math.sin(i / 8 * TAU) * b.r * 0.4);
          ctx.lineTo(Math.cos(i / 8 * TAU) * b.r, Math.sin(i / 8 * TAU) * b.r);
          ctx.stroke();
        }
      }
    } else {
      // 敌方弹
      const col = b.color || '#ff5a3c';
      ctx.shadowColor = col; ctx.shadowBlur = 10;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x, y, b.r || 4, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath(); ctx.arc(x, y, (b.r || 4) * 0.45, 0, TAU); ctx.fill();
    }
    ctx.restore();
  };

  /* ============================================================
     特效：冲击波 / 警告
     ============================================================ */
  Art.shockwave = function (ctx, x, y, r, a) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.restore();
  };

  Art.hitSpark = function (ctx, x, y, r, a, color) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(255,255,255,.95)');
    rg.addColorStop(0.4, color || 'rgba(255,210,90,.7)');
    rg.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.restore();
  };

})(window);
