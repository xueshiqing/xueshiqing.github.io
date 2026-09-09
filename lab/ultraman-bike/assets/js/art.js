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
    const art = { far: [], mid: [], near: [], stars: [], extra: [], fore: [] };
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
      for (let x = -200; x < span + 400; x += 120 + rnd() * 150) {
        art.fore.push({ x, w: 30 + rnd() * 60, h: 16 + rnd() * 34, kind: rnd() > 0.55 ? 'slab' : 'post' });
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
      for (let x = -200; x < span + 400; x += 140 + rnd() * 160) {
        art.fore.push({ x, w: 34 + rnd() * 56, h: 14 + rnd() * 30, kind: rnd() > 0.6 ? 'rock' : 'post' });
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
      for (let x = -200; x < span + 400; x += 130 + rnd() * 150) {
        art.fore.push({ x, w: 26 + rnd() * 44, h: 18 + rnd() * 40, kind: 'ice' });
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
      for (let x = -200; x < span + 400; x += 150 + rnd() * 170) {
        art.fore.push({ x, w: 30 + rnd() * 60, h: 16 + rnd() * 36, kind: 'rock' });
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
      for (let x = -200; x < span + 400; x += 170 + rnd() * 180) {
        art.fore.push({ x, w: 26 + rnd() * 50, h: 14 + rnd() * 30, kind: 'debris' });
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
      const rg = ctx.createRadialGradient(sx, 96, 2, sx, 96, 120);
      rg.addColorStop(0, th === 'city' ? 'rgba(255,250,225,.85)' : 'rgba(255,228,160,.85)');
      rg.addColorStop(0.18, th === 'city' ? 'rgba(255,238,185,.34)' : 'rgba(255,180,110,.3)');
      rg.addColorStop(0.45, th === 'city' ? 'rgba(255,228,170,.12)' : 'rgba(255,150,80,.12)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(sx - 140, -40, 280, 280);
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
        ctx.fillStyle = 'rgba(150,205,255,.28)';
        ctx.fillRect(x, gy - b.h, b.w, 2);
        ctx.fillRect(x + b.w - 2, gy - b.h, 2, b.h * 0.7);
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
        ctx.fillStyle = 'rgba(120,190,255,.3)';
        ctx.fillRect(x, gy - b.h, b.w, 3);
        ctx.fillRect(x + b.w - 2, gy - b.h, 2, b.h * 0.6);
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
    ctx.fillRect(0, gy, W, 7);
    ctx.fillStyle = c.edge;
    ctx.fillRect(0, gy, W, 2);

    /* 车道虚线 */
    const dash = 48, gap = 44;
    const off = -(camX % (dash + gap));
    ctx.fillStyle = 'rgba(255,255,255,.15)';
    for (let x = off - dash; x < W + dash; x += dash + gap) ctx.fillRect(x, gy + 24, dash, 3);

    /* 路面颗粒 */
    ctx.fillStyle = 'rgba(255,255,255,.055)';
    const off2 = -(camX * 0.92) % 68;
    for (let x = off2 - 68; x < W + 68; x += 68) {
      ctx.fillRect(x, gy + 13, 24, 2);
      ctx.fillRect(x + 36, gy + 38, 15, 2);
    }

    /* 近处压暗 */
    const g = ctx.createLinearGradient(0, gy + 6, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, gy + 6, W, H - gy - 6);
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

  /* ============================================================
     前景剪影：比近景更快掠过，制造纵深
     ============================================================ */
  Art.foreground = function (ctx, level, camX, time) {
    const art = level._art;
    if (!art || !art.fore || !art.fore.length) return;
    const W = UG.VIEW.w, H = UG.VIEW.h, gy = level.groundY;
    const ox = -camX * 1.34;
    const th = level.theme;
    const col = th === 'snow' ? '#152840'
              : th === 'volcano' ? '#220807'
              : th === 'desert' ? '#4a2710'
              : th === 'space' ? '#181040' : '#0e1a2a';
    const rim = th === 'snow' ? 'rgba(200,232,255,.75)'
              : th === 'volcano' ? 'rgba(255,150,60,.7)'
              : th === 'desert' ? 'rgba(255,210,150,.65)'
              : th === 'space' ? 'rgba(180,150,255,.7)' : 'rgba(160,205,255,.65)';

    /* 只取稀疏的几件，且高度受限——始终待在画面底部，不遮挡主角 */
    ctx.save();
    for (let i = 0; i < art.fore.length; i += 3) {
      const f = art.fore[i];
      const x = f.x + ox;
      if (x < -160 || x > W + 160) continue;
      const h = Math.min(30, 14 + (f.h % 17));      /* 高度上限 30，低于主角脚部 */
      const top = gy - h;
      const w = 26 + (f.w % 34);

      ctx.fillStyle = col;
      ctx.beginPath();
      if (f.kind === 'post') {
        const ph = Math.min(16, h * 0.5);            /* 柱身更矮 */
        ctx.rect(x, gy - ph, 9, ph + (H - gy));
        ctx.fill();
        ctx.fillRect(x - 5, gy - ph - 6, 19, 6);
        ctx.fillStyle = rim;
        ctx.fillRect(x, gy - ph, 9, 2.5);
        ctx.fillRect(x - 5, gy - ph - 6, 19, 2.5);
      } else if (f.kind === 'ice') {
        ctx.moveTo(x, H);
        ctx.lineTo(x + w * 0.4, top - 8);
        ctx.lineTo(x + w, H);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = rim; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 2, H - 2); ctx.lineTo(x + w * 0.4, top - 8);
        ctx.stroke();
      } else if (f.kind === 'debris') {
        ctx.save();
        ctx.translate(x + w / 2, top);
        ctx.rotate(Math.sin(time * 0.5 + f.x) * 0.12);
        ctx.beginPath(); ctx.rect(-w / 2, 0, w, h + (H - gy)); ctx.fill();
        ctx.strokeStyle = rim; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.stroke();
        ctx.restore();
      } else {
        ctx.moveTo(x, H);
        ctx.quadraticCurveTo(x + w * 0.45, top - 10, x + w, H);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = rim; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 4, H - 2);
        ctx.quadraticCurveTo(x + w * 0.45, top - 10, x + w - 4, H - 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  /* ============================================================
     全局光照：主光源暖辉 + 冷色暗角
     ============================================================ */
  Art.lighting = function (ctx, level, camX, time) {
    const W = UG.VIEW.w, H = UG.VIEW.h;
    const th = level.theme;
    let lx = W * 0.82, ly = H * 0.27, warm = 'rgba(255,232,170,';
    if (th === 'desert')  { lx = W * 0.66; ly = H * 0.30; warm = 'rgba(255,200,130,'; }
    if (th === 'snow')    { lx = W * 0.84; ly = H * 0.22; warm = 'rgba(205,238,255,'; }
    if (th === 'volcano') { lx = W * 0.47; ly = H * 0.86; warm = 'rgba(255,140,50,'; }
    if (th === 'space')   { lx = W * 0.30; ly = H * 0.30; warm = 'rgba(175,145,255,'; }
    lx -= camX * 0.03;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 560);
    g.addColorStop(0, warm + '0.15)');
    g.addColorStop(0.45, warm + '0.055)');
    g.addColorStop(1, warm + '0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    ctx.save();
    const v = ctx.createRadialGradient(W / 2, H * 0.52, H * 0.36, W / 2, H * 0.52, H * 1.08);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(4,8,20,.46)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
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
    ctx.scale(f * 1.15, 1.15);
    const sq = clamp(st.squash || 0, 0, 1);
    if (sq > 0) ctx.scale(1 + sq * 0.14, 1 - sq * 0.18);
    if (blink) ctx.globalAlpha = 0.58;

    /* ---------------- 骨架尺寸（脚底为 0，向上为负） ---------------- */
    const HIP = -32, SHO = -55, NECK = -59, HEADY = -67;
    const THIGH = 16, SHIN = 16, UPPER = 13, FORE = 13;

    /* ---------------- 姿态表 ---------------- */
    let lean = 0.05, bob = 0;
    let legN = { hip: 0.14, knee: 0.16, foot: 0.06 };
    let legF = { hip: -0.16, knee: 0.18, foot: -0.06 };
    let armN = { up: 0.28, fore: 0.55 };
    let armF = { up: 0.22, fore: 0.62 };

    const p = t * 13.5;
    switch (pose) {
      case 'run':
        bob = -Math.abs(Math.sin(p)) * 1.9;
        lean = 0.14;
        legN = { hip: Math.sin(p) * 0.95, knee: 0.25 + Math.max(0, Math.sin(p + 1.15)) * 1.3, foot: -Math.sin(p) * 0.32 };
        legF = { hip: Math.sin(p + Math.PI) * 0.95,
                 knee: 0.25 + Math.max(0, Math.sin(p + Math.PI + 1.15)) * 1.3,
                 foot: -Math.sin(p + Math.PI) * 0.32 };
        armN = { up: 0.45 + Math.sin(p + Math.PI) * 0.85, fore: 0.95 };
        armF = { up: 0.45 + Math.sin(p) * 0.85, fore: 0.95 };
        break;
      case 'jump':
        bob = -1.2; lean = 0.06;
        legN = { hip: 0.62, knee: 1.5, foot: 0.25 };
        legF = { hip: -0.4, knee: 0.55, foot: -0.2 };
        armN = { up: -0.75, fore: 0.45 };
        armF = { up: -1.15, fore: 0.5 };
        break;
      case 'fall':
        lean = -0.06;
        legN = { hip: 0.34, knee: 0.75, foot: 0.16 };
        legF = { hip: -0.52, knee: 1.05, foot: -0.22 };
        armN = { up: -0.45, fore: 0.8 };
        armF = { up: -0.9, fore: 0.9 };
        break;
      case 'dash':
        lean = 0.34;
        legN = { hip: 0.95, knee: 0.65, foot: 0.22 };
        legF = { hip: -0.85, knee: 1.45, foot: -0.3 };
        armN = { up: 1.15, fore: 0.15 };
        armF = { up: -1.05, fore: 0.45 };
        break;
      case 'shoot':
        lean = 0.09;
        legN = { hip: 0.26, knee: 0.36, foot: 0.1 };
        legF = { hip: -0.32, knee: 0.46, foot: -0.12 };
        armN = { up: 1.42, fore: 0.06 };
        armF = { up: 0.62, fore: 1.05 };
        break;
      case 'beam':
        lean = -0.05;
        legN = { hip: 0.32, knee: 0.42, foot: 0.12 };
        legF = { hip: -0.38, knee: 0.52, foot: -0.14 };
        armN = { up: 1.18, fore: -0.2 };
        armF = { up: 0.42, fore: 0.95 };
        break;
      case 'hurt':
        lean = -0.28;
        legN = { hip: -0.42, knee: 0.62, foot: -0.22 };
        legF = { hip: 0.3, knee: 0.5, foot: 0.12 };
        armN = { up: 0.85, fore: 1.25 };
        armF = { up: 0.55, fore: 1.15 };
        break;
      default: /* idle */
        bob = Math.sin(t * 2.2) * 0.9;
        armN = { up: 0.28, fore: 0.5 + Math.sin(t * 2.2) * 0.05 };
        armF = { up: 0.22, fore: 0.58 + Math.sin(t * 2.2) * 0.05 };
    }

    const hipY = HIP + bob;
    const sho = {
      x: Math.sin(lean) * (HIP - SHO) * -1,
      y: hipY + Math.cos(lean) * (SHO - HIP),
    };

    /* ---------------- 渐变色 ---------------- */
    const silverG = grad(ctx, -10, SHO + bob, 10, HIP + bob,
      [[0, '#ffffff'], [0.45, '#eef4f9'], [1, '#a7b7c6']]);
    const silverFar = '#93a4b3';
    const redG = grad(ctx, 0, SHO + bob, 0, HIP + bob,
      [[0, '#ff6b6b'], [1, '#b81f1f']]);

    /* ---------------- 腿 ---------------- */
    const drawLeg = (L, shade, isFar) => {
      const hx = isFar ? -1.5 : 1.5;
      const kx = hx + Math.sin(L.hip) * THIGH;
      const ky = hipY + Math.cos(L.hip) * THIGH;
      const shinA = L.hip - L.knee;
      const fx = kx + Math.sin(shinA) * SHIN;
      const fy = ky + Math.cos(shinA) * SHIN;

      capsule(ctx, hx, hipY, kx, ky, isFar ? 8.5 : 9.8, shade);
      capsule(ctx, kx, ky, fx, fy, isFar ? 7 : 8, shade);
      /* 膝甲 */
      ctx.fillStyle = isFar ? '#8296a6' : '#cfdce7';
      ctx.beginPath(); ctx.arc(kx, ky, isFar ? 3.6 : 4.2, 0, TAU); ctx.fill();
      /* 大腿外侧红条：沿大腿方向 */
      const ux = Math.sin(L.hip), uy = Math.cos(L.hip);
      capsule(ctx, hx + ux * 3, hipY + uy * 3, hx + ux * 12, hipY + uy * 12,
              isFar ? 8.4 : 9.6, isFar ? '#8f1a1a' : '#c81e1e');
      /* 靴子 */
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(shinA * 0.25 + L.foot);
      ctx.fillStyle = isFar ? '#8f1a1a' : redG;
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.quadraticCurveTo(6, -7.5, 12.5, -4);
      ctx.quadraticCurveTo(14.5, -1, 12.5, 2.5);
      ctx.lineTo(-5, 3);
      ctx.quadraticCurveTo(-7.5, -1, -6, -6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = isFar ? '#5e0d0d' : '#7a1212';
      roundRect(ctx, -5.5, 1.4, 18, 2.6, 1.3); ctx.fill();
      ctx.restore();
      return { x: fx, y: fy };
    };

    /* ---------------- 手臂 ---------------- */
    const drawArm = (A, shade, isFar, wristBand) => {
      const sx = sho.x + (isFar ? -2 : 2), sy = sho.y;
      const ex = sx + Math.sin(A.up) * UPPER;
      const ey = sy + Math.cos(A.up) * UPPER;
      const fa = A.up + A.fore;
      const hx = ex + Math.sin(fa) * FORE;
      const hy = ey + Math.cos(fa) * FORE;

      capsule(ctx, sx, sy, ex, ey, isFar ? 6.4 : 7.4, shade);
      capsule(ctx, ex, ey, hx, hy, isFar ? 6 : 7, shade);
      /* 肘甲 */
      ctx.fillStyle = isFar ? '#8296a6' : '#d8e4ee';
      ctx.beginPath(); ctx.arc(ex, ey, isFar ? 3.2 : 3.7, 0, TAU); ctx.fill();
      /* 手腕红环：沿手臂方向贴着前臂 */
      if (wristBand) {
        const ux = Math.sin(fa), uy = Math.cos(fa);
        capsule(ctx, hx - ux * 9, hy - uy * 9, hx - ux * 4, hy - uy * 4,
                isFar ? 7.4 : 8.4, isFar ? '#8f1a1a' : redG);
      }
      /* 手 */
      ctx.fillStyle = isFar ? '#9db0bf' : '#e8f0f6';
      ctx.beginPath(); ctx.arc(hx, hy, isFar ? 3.9 : 4.4, 0, TAU); ctx.fill();
      return { x: hx, y: hy };
    };

    /* ---------------- 绘制顺序：远手 → 远腿 → 身体 → 近腿 → 近手 ---------------- */
    drawArm(armF, silverFar, true, true);
    drawLeg(legF, silverFar, true);

    /* 躯干 */
    ctx.save();
    ctx.translate(0, hipY);
    ctx.rotate(lean);
    const torsoH = SHO - HIP;   /* -23 */
    ctx.fillStyle = silverG;
    ctx.beginPath();
    ctx.moveTo(-8.5, 1);
    ctx.quadraticCurveTo(-11.5, torsoH * 0.55, -12.5, torsoH + 3);
    ctx.quadraticCurveTo(-10, torsoH - 2.5, 0, torsoH - 2.5);
    ctx.quadraticCurveTo(10, torsoH - 2.5, 12.5, torsoH + 3);
    ctx.quadraticCurveTo(11.5, torsoH * 0.55, 8.5, 1);
    ctx.closePath();
    ctx.fill();
    /* 胸口红带 */
    ctx.fillStyle = redG;
    ctx.beginPath();
    ctx.moveTo(-12.5, torsoH + 4);
    ctx.quadraticCurveTo(0, torsoH + 10, 12.5, torsoH + 4);
    ctx.lineTo(11.5, torsoH + 9.5);
    ctx.quadraticCurveTo(0, torsoH + 15.5, -11.5, torsoH + 9.5);
    ctx.closePath();
    ctx.fill();
    /* 侧腰红条 */
    ctx.fillStyle = '#c81e1e';
    ctx.beginPath();
    ctx.moveTo(-11, torsoH + 12); ctx.lineTo(-6.5, torsoH + 11);
    ctx.lineTo(-6, -3); ctx.lineTo(-10, -2);
    ctx.closePath(); ctx.fill();
    /* 腰带 */
    ctx.fillStyle = '#a51414';
    ctx.beginPath();
    ctx.moveTo(-8.5, 0); ctx.lineTo(8.5, 0); ctx.lineTo(8, 4.5); ctx.lineTo(-8, 4.5);
    ctx.closePath(); ctx.fill();

    /* 彩色计时器 */
    const hpRatio = clamp(st.hp == null ? 1 : st.hp, 0, 1);
    const danger = hpRatio < 0.35;
    const pulse = danger ? (Math.sin(t * 14) > 0 ? 1 : 0.28) : (0.72 + 0.28 * Math.sin(t * 3));
    const ctY = torsoH + 10.5;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.shadowColor = danger ? '#ff4d4d' : '#4fd6ff';
    ctx.shadowBlur = 11;
    ctx.fillStyle = danger ? '#ff3b3b' : '#4fd6ff';
    ctx.beginPath(); ctx.arc(0, ctY, 4.4, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(12,34,48,.9)'; ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.arc(0, ctY, 4.4, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath(); ctx.arc(-1.4, ctY - 1.5, 1.4, 0, TAU); ctx.fill();

    /* 脖子 */
    ctx.fillStyle = silverG;
    roundRect(ctx, -4.5, torsoH - 8, 9, 9, 3.5); ctx.fill();

    /* 头 */
    ctx.save();
    ctx.translate(0, HEADY - HIP);   /* 头部相对胯部：HEADY-HIP = 头顶上方 35 */
    ctx.rotate(-lean * 0.5);
    /* 头型 */
    ctx.fillStyle = grad(ctx, -9, -10, 9, 9, [[0, '#ffffff'], [0.55, '#f4f8fc'], [1, '#b9c8d5']]);
    ctx.beginPath();
    ctx.moveTo(-6.6, 1.6);
    ctx.quadraticCurveTo(-7.8, -7.2, 0, -8.6);
    ctx.quadraticCurveTo(7.8, -7.2, 6.6, 1.6);
    ctx.quadraticCurveTo(5.2, 7.2, 0, 7.2);
    ctx.quadraticCurveTo(-5.2, 7.2, -6.6, 1.6);
    ctx.closePath();
    ctx.fill();
    /* 头鳍 */
    ctx.fillStyle = redG;
    ctx.beginPath();
    ctx.moveTo(-4.4, -6);
    ctx.quadraticCurveTo(-2.2, -15, 7, -10);
    ctx.lineTo(4.6, -4.8);
    ctx.quadraticCurveTo(-1, -7.8, -4.4, -6);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(120,10,10,.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-4.4, -6); ctx.quadraticCurveTo(-2.2, -15, 7, -10); ctx.stroke();
    /* 眼睛 */
    /* 远侧眼（小） */
    ctx.fillStyle = '#e8c93c';
    ctx.beginPath(); ctx.ellipse(-3.4, -2.2, 2.2, 1.6, -0.22, 0, TAU); ctx.fill();
    /* 近侧眼（大） */
    ctx.save();
    ctx.shadowColor = '#ffd84d'; ctx.shadowBlur = 5;
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath(); ctx.ellipse(2.9, -2.4, 4.1, 2.8, -0.22, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(120,86,0,.55)'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.ellipse(2.9, -2.4, 4.1, 2.8, -0.22, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(1.8, -3.5, 1.6, 1.0, -0.22, 0, TAU); ctx.fill();
    /* 嘴 */
    ctx.strokeStyle = '#4a5561'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(4.6, 4.2); ctx.quadraticCurveTo(6.6, 6, 8, 3.6); ctx.stroke();
    /* 高光 */
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath(); ctx.ellipse(-2.4, -6.6, 3.4, 1.6, -0.35, 0, TAU); ctx.fill();
    ctx.restore();

    ctx.restore();  /* 躯干 */

    /* 近侧腿、近侧手 */
    drawLeg(legN, silverG, false);
    const hand = drawArm(armN, silverG, false, true);

    /* 蓄力光球 */
    if (st.charge > 0) {
      const cr = 3 + st.charge * 10;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rg = ctx.createRadialGradient(hand.x, hand.y, 0, hand.x, hand.y, cr * 2.4);
      rg.addColorStop(0, 'rgba(255,255,255,.95)');
      rg.addColorStop(0.35, 'rgba(255,220,90,.8)');
      rg.addColorStop(1, 'rgba(255,150,30,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(hand.x, hand.y, cr * 2.4, 0, TAU); ctx.fill();
      ctx.restore();
      st.hand = { x: hand.x * f * 1.15 + x, y: hand.y * 1.15 + y };
    }

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
        const br = Math.sin(t * 2.4) * 2;

        /* 腿：粗壮外撇，带熔岩裂纹 */
        ctx.fillStyle = '#1c0a08';
        capsule(ctx, -30, -46, -40, 0, 30, '#160705');
        capsule(ctx, 30, -46, 40, 0, 30, '#160705');
        ctx.fillStyle = '#2a1210';
        ctx.beginPath(); ctx.ellipse(-41, 2, 17, 8, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(41, 2, 17, 8, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#ff7a1f'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-37, -30); ctx.lineTo(-31, -22); ctx.lineTo(-38, -14);
        ctx.moveTo(37, -32); ctx.lineTo(31, -24); ctx.lineTo(38, -16);
        ctx.stroke();

        /* 尾：短粗带岩浆 */
        ctx.strokeStyle = '#1c0a08'; ctx.lineWidth = 20; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-34, -54);
        ctx.quadraticCurveTo(-72, -46 + Math.sin(t * 2.6) * 7, -92, -20 + Math.sin(t * 2.6) * 8);
        ctx.stroke();
        ctx.strokeStyle = '#ff6a2a'; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-44, -52);
        ctx.quadraticCurveTo(-70, -46 + Math.sin(t * 2.6) * 7, -88, -24 + Math.sin(t * 2.6) * 8);
        ctx.stroke();

        /* 躯干：宽肩收腰的梯形，比圆球更有轮廓 */
        ctx.fillStyle = grad(ctx, -44, -110, 44, -30, [[0, '#5a2015'], [0.5, '#31100c'], [1, '#170605']]);
        ctx.beginPath();
        ctx.moveTo(-28, -40);
        ctx.quadraticCurveTo(-46, -76, -40, -100);
        ctx.quadraticCurveTo(-22, -114, 6, -110);
        ctx.quadraticCurveTo(38, -104, 44, -78);
        ctx.quadraticCurveTo(46, -54, 30, -40);
        ctx.closePath();
        ctx.fill();

        /* 肩甲尖刺（三根，构成标志性剪影） */
        ctx.fillStyle = '#3a1410';
        [[-42, -92, -58, -128], [-24, -104, -30, -146], [6, -108, 14, -148], [34, -100, 50, -132]].forEach(([x1, y1, x2, y2]) => {
          ctx.beginPath();
          ctx.moveTo(x1 - 8, y1 + 6);
          ctx.lineTo(x2, y2);
          ctx.lineTo(x1 + 9, y1 + 4);
          ctx.closePath();
          ctx.fill();
        });
        ctx.fillStyle = '#ff8a1f';
        [[-24, -104, -30, -146], [6, -108, 14, -148]].forEach(([x1, y1, x2, y2]) => {
          ctx.beginPath();
          ctx.moveTo(x1 - 2.5, y1 - 2); ctx.lineTo(x2, y2); ctx.lineTo(x1 + 3, y1 - 3);
          ctx.closePath(); ctx.fill();
        });

        /* 胸口熔核 + 放射裂纹 */
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const rg = ctx.createRadialGradient(4, -72 + br, 3, 4, -72 + br, 30);
        rg.addColorStop(0, '#fff6d0');
        rg.addColorStop(0.32, '#ffa42a');
        rg.addColorStop(1, 'rgba(255,60,10,0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(4, -72 + br, 30, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = '#ff8a1f'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * TAU + 0.3;
          ctx.beginPath();
          ctx.moveTo(4 + Math.cos(a) * 12, -72 + br + Math.sin(a) * 12);
          ctx.lineTo(4 + Math.cos(a) * 27, -72 + br + Math.sin(a) * 25);
          ctx.stroke();
        }

        /* 头：前伸的楔形 + 独角 + 獠牙 */
        ctx.fillStyle = '#3a1410';
        ctx.beginPath();
        ctx.moveTo(20, -112 + br);
        ctx.quadraticCurveTo(50, -116 + br, 60, -100 + br);
        ctx.quadraticCurveTo(66, -88 + br, 52, -80 + br);
        ctx.quadraticCurveTo(34, -76 + br, 22, -88 + br);
        ctx.closePath();
        ctx.fill();
        /* 独角 */
        ctx.fillStyle = '#2a1210';
        ctx.beginPath();
        ctx.moveTo(34, -114 + br); ctx.lineTo(40, -142 + br); ctx.lineTo(50, -112 + br);
        ctx.closePath(); ctx.fill();
        /* 眼 */
        ctx.save();
        ctx.shadowColor = '#ffd84d'; ctx.shadowBlur = 14;
        ctx.fillStyle = '#ffe14d';
        ctx.beginPath(); ctx.ellipse(44, -102 + br, 6.5, 4.2, -0.2, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(30, -104 + br, 4.5, 3, -0.2, 0, TAU); ctx.fill();
        ctx.restore();
        /* 獠牙 */
        ctx.fillStyle = '#f0e6cc';
        [0, 1, 2, 3].forEach((i) => {
          ctx.beginPath();
          ctx.moveTo(42 + i * 5, -88 + br);
          ctx.lineTo(44.5 + i * 5, -78 + br);
          ctx.lineTo(47 + i * 5, -88 + br);
          ctx.closePath(); ctx.fill();
        });
        /* 下颚阴影，让獠牙长在嘴上 */
        ctx.fillStyle = 'rgba(20,6,4,.55)';
        ctx.beginPath();
        ctx.moveTo(38, -90 + br); ctx.lineTo(64, -86 + br); ctx.lineTo(44, -79 + br);
        ctx.closePath(); ctx.fill();
        /* 火焰鬃毛（贴着颈部，不再散落） */
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 8; i++) {
          const a = -1.5 + i * 0.24;
          const fl = 14 + Math.sin(t * 8 + i * 1.5) * 8;
          ctx.fillStyle = i % 2 ? 'rgba(255,140,30,.7)' : 'rgba(255,220,90,.55)';
          ctx.beginPath();
          ctx.moveTo(16 + Math.cos(a) * 16, -104 + br + Math.sin(a) * 12);
          ctx.lineTo(16 + Math.cos(a) * (16 + fl), -104 + br + Math.sin(a) * (12 + fl));
          ctx.lineTo(20 + Math.cos(a) * 16, -100 + br + Math.sin(a) * 12);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        break;
      }

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
