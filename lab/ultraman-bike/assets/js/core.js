/* ==========================================================================
   core.js — 引擎核心：画布缩放 / 输入 / 音效 / 粒子 / 相机
   全局命名空间：UG
   ========================================================================== */
(function (global) {
  'use strict';

  const UG = global.UG = global.UG || {};

  /* ------------------------------------------------------------ 数学工具 */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp  = (a, b, t) => a + (b - a) * t;
  const rand  = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick  = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const sign  = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
  const approach = (v, target, delta) => (v < target ? Math.min(v + delta, target) : Math.max(v - delta, target));
  const dist  = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const TAU   = Math.PI * 2;

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function pointInRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }
  /** 圆形与矩形相交（用于弹幕判定） */
  function circleRect(cx, cy, cr, r) {
    const nx = clamp(cx, r.x, r.x + r.w);
    const ny = clamp(cy, r.y, r.y + r.h);
    return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) <= cr * cr;
  }

  UG.clamp = clamp; UG.lerp = lerp; UG.rand = rand; UG.randInt = randInt;
  UG.pick = pick; UG.sign = sign; UG.approach = approach; UG.dist = dist;
  UG.aabb = aabb; UG.pointInRect = pointInRect; UG.circleRect = circleRect;
  UG.TAU = TAU;

  /* ------------------------------------------------------------ 画布管理 */
  /* 逻辑视口：高度固定 360，宽度随屏幕宽高比自适应（宽屏能看到更多关卡内容） */
  UG.VIEW = { w: 640, h: 360, minW: 640, maxW: 960 };

  /* 移动端 position:fixed 的 inset:0 用的是「布局视口」（相当于地址栏收起时的大小），
     而地址栏实际盖住的是「视觉视口」。用 visualViewport 拿到真正可见的区域，
     否则底部触屏按钮会被地址栏挡在可视范围之外。 */
  function viewportSize() {
    const vv = window.visualViewport;
    if (vv && vv.width > 0 && vv.height > 0) {
      return {
        w: Math.round(vv.width), h: Math.round(vv.height),
        top: Math.round(vv.offsetTop), left: Math.round(vv.offsetLeft),
      };
    }
    return { w: window.innerWidth, h: window.innerHeight, top: 0, left: 0 };
  }
  UG.viewportSize = viewportSize;

  const Screen = UG.Screen = {
    canvas: null,
    ctx: null,
    scale: 1,
    dpr: 1,

    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.app = document.getElementById('app');
      this._last = null;
      this.resize();
      const kick = () => this.resize();
      window.addEventListener('resize', kick);
      window.addEventListener('orientationchange', () => setTimeout(kick, 260));
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', kick);
        window.visualViewport.addEventListener('scroll', kick);
      }
      /* 地址栏收起/展开时部分浏览器不发事件，低频兜底（尺寸没变会直接返回） */
      setInterval(kick, 1000);
    },

    resize() {
      const vp = viewportSize();
      const vw = vp.w, vh = vp.h;

      /* 尺寸没变就不重排，避免每秒兜底轮询造成无谓开销 */
      if (this._last && this._last.w === vw && this._last.h === vh &&
          this._last.top === vp.top && this._last.left === vp.left) return;
      this._last = vp;

      /* 分层处理：app 容器铺满整个「页面区域」（布局视口），
         避免非全屏时底部露出一条页面背景色的黑条；
         而画布 / HUD / 触屏控件则对齐到「真正可见区域」（视觉视口），
         保证不会被浏览器地址栏或底部工具栏挡住。 */
      const layoutW = Math.max(vw, window.innerWidth);
      const layoutH = Math.max(vp.top + vh, window.innerHeight);
      if (this.app) {
        this.app.style.top = '0px';
        this.app.style.left = '0px';
        this.app.style.width = layoutW + 'px';
        this.app.style.height = layoutH + 'px';
      }
      const root = document.documentElement;
      root.style.setProperty('--stage-top', vp.top + 'px');
      root.style.setProperty('--stage-h', vh + 'px');
      root.style.setProperty('--stage-w', vw + 'px');

      /* 扇形触控区尺寸：2/3 屏高，且不超过 46% 屏宽（保证两侧不相接） */
      const padSize = Math.round(Math.min(vh * 0.55, vw * 0.46));
      document.documentElement.style.setProperty('--pad-size', padSize + 'px');

      /* 按屏幕比例决定逻辑宽度：越宽的屏幕看到越多，而不是两侧留白 */
      const aspect = vw / Math.max(1, vh);
      UG.VIEW.w = Math.round(clamp(UG.VIEW.h * aspect, UG.VIEW.minW, UG.VIEW.maxW));

      const scale = Math.min(vw / UG.VIEW.w, vh / UG.VIEW.h);
      const cssW = Math.round(UG.VIEW.w * scale);
      const cssH = Math.round(UG.VIEW.h * scale);

      let dpr = Math.min(window.devicePixelRatio || 1, 2);
      // 限制背板尺寸，避免低端机爆显存
      while (cssW * dpr > 1920 && dpr > 1) dpr -= 0.25;

      const c = this.canvas;
      c.style.width = cssW + 'px';
      c.style.height = cssH + 'px';
      c.width = Math.round(cssW * dpr);
      c.height = Math.round(cssH * dpr);

      this.scale = scale;
      this.dpr = dpr;
      const k = (cssW * dpr) / UG.VIEW.w;
      this.ctx.setTransform(k, 0, 0, k, 0, 0);
      this.ctx.imageSmoothingEnabled = true;

      if (this.onResize) this.onResize();
    },

    /** 屏幕坐标 → 逻辑坐标 */
    toLogical(clientX, clientY) {
      const r = this.canvas.getBoundingClientRect();
      return {
        x: (clientX - r.left) / r.width * UG.VIEW.w,
        y: (clientY - r.top) / r.height * UG.VIEW.h,
      };
    },
  };

  /* --------------------------------------------------------------- 输入 */
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    Space: 'jump',
    KeyJ: 'fire',
    KeyK: 'beam',
    KeyL: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash',
    KeyP: 'pause', Escape: 'pause',
    KeyR: 'restart',
  };

  const Input = UG.Input = {
    held: Object.create(null),
    _pressed: Object.create(null),
    _released: Object.create(null),
    _touch: Object.create(null),
    onAnyKey: null,

    init() {
      window.addEventListener('keydown', (e) => {
        const k = KEYMAP[e.code];
        if (!k) return;
        if (k === 'pause' || k === 'restart' || e.code === 'Space') e.preventDefault();
        if (!this.held[k]) this._pressed[k] = true;
        this.held[k] = true;
        if (this.onAnyKey) this.onAnyKey(k);
      });
      window.addEventListener('keyup', (e) => {
        const k = KEYMAP[e.code];
        if (!k) return;
        this.held[k] = false;
        this._released[k] = true;
      });
      window.addEventListener('blur', () => {
        this.held = Object.create(null);
        this._touch = Object.create(null);
      });
    },

    /** 绑定四等分扇形触控区 */
    bindTouch(root) {
      this.bindPad(root.querySelector('#padMove'), {
        multi: false,   /* 方向区只保留最后一次按下的扇区 */
        dirMap: { up: 'up', right: 'right', down: 'down', left: 'left' },
      });
      this.bindPad(root.querySelector('#padAct'), {
        multi: true,    /* 动作区支持多指同时按不同扇区 */
        dirMap: { up: 'beam', right: 'fire', down: 'jump', left: 'dash' },
      });
    },

    /**
     * @param el           扇形触控区容器
     * @param opts.multi   true = 允许多根手指各按一个扇区
     * @param opts.dirMap  方向 -> 按键名（左右两侧扇区含义不同）
     */
    bindPad(el, opts) {
      if (!el) return;
      const multi = !!(opts && opts.multi);
      const dirMap = (opts && opts.dirMap) || { up: 'up', right: 'right', down: 'down', left: 'left' };
      const active = new Map();          /* pointerId -> key */

      const paint = (key, on) => {
        if (!key) return;
        const sec = el.querySelector('.sec[data-key="' + key + '"]');
        const lab = el.querySelector('.pad-lab[data-lab="' + key + '"]');
        if (sec) sec.classList.toggle('on', on);
        if (lab) lab.classList.toggle('on', on);
      };

      const setKey = (key, on) => {
        if (!key) return;
        if (on && !this.held[key]) this._pressed[key] = true;
        this.held[key] = on;
        this._touch[key] = on;
        paint(key, on);
      };

      /* 触点落在哪个扇区：以区域中心为原点算角度，沿半径方向无限延展，
         所以扇形外的延长方向同样有效，触控面积远大于图形本身。 */
      const keyAt = (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        if (Math.hypot(dx, dy) < r.width * 0.09) return null;   /* 中心死区 */
        const a = Math.atan2(dy, dx);
        let dir;
        if (a >= -Math.PI * 0.75 && a < -Math.PI * 0.25) dir = 'up';
        else if (a >= -Math.PI * 0.25 && a <  Math.PI * 0.25) dir = 'right';
        else if (a >=  Math.PI * 0.25 && a <  Math.PI * 0.75) dir = 'down';
        else dir = 'left';
        return dirMap[dir] || null;
      };

      const onDown = (e) => {
        e.preventDefault();
        const k = keyAt(e);
        if (!multi) {
          active.forEach((old, id) => { setKey(old, false); });
          active.clear();
        }
        active.set(e.pointerId, k);
        setKey(k, true);
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
        if (this.onAnyKey && k) this.onAnyKey(k);
      };

      const onMove = (e) => {
        if (!active.has(e.pointerId)) return;
        const k = keyAt(e);
        const old = active.get(e.pointerId);
        if (k === old) return;
        setKey(old, false);
        active.set(e.pointerId, k);
        setKey(k, true);
      };

      const onUp = (e) => {
        if (!active.has(e.pointerId)) return;
        setKey(active.get(e.pointerId), false);
        active.delete(e.pointerId);
      };

      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
      el.addEventListener('lostpointercapture', onUp);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    },

    down(k) { return !!this.held[k]; },
    pressed(k) { return !!this._pressed[k]; },
    released(k) { return !!this._released[k]; },

    /** 每帧末清理边沿状态 */
    endFrame() {
      this._pressed = Object.create(null);
      this._released = Object.create(null);
    },
  };

  /* --------------------------------------------------------------- 音效 */
  const Audio = UG.Audio = {
    Music: null,
    ctx: null,
    enabled: true,
    master: null,

    init() {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { this.enabled = false; return; }
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
        if (UG.Music) { this.Music = UG.Music; this.Music.init(this.ctx, this.master); }
      } catch (e) { this.enabled = false; }
    },

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    tone(freq, dur, type, vol, delay, glideTo) {
      if (!this.enabled || !this.ctx) return;
      const t0 = this.ctx.currentTime + (delay || 0);
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol == null ? 0.14 : vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.master);
      o.start(t0); o.stop(t0 + dur + 0.04);
    },

    noise(dur, vol, f0, f1, q) {
      if (!this.enabled || !this.ctx) return;
      const t0 = this.ctx.currentTime;
      const n = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'bandpass'; flt.Q.value = q || 0.8;
      flt.frequency.setValueAtTime(f0, t0);
      flt.frequency.exponentialRampToValueAtTime(Math.max(60, f1), t0 + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(flt); flt.connect(g); g.connect(this.master);
      src.start(t0);
    },

    shoot()    { this.tone(880, 0.07, 'square', 0.055, 0, 420); },
    beamFire(){ this.tone(180, 0.5, 'sawtooth', 0.14, 0, 1800); this.noise(0.5, 0.12, 700, 3200, 0.7); },
    beamReady(){ this.tone(1200, 0.14, 'triangle', 0.1, 0, 1900); this.tone(1600, 0.12, 'sine', 0.07, 0.07, 2300); },
    hit()      { this.noise(0.07, 0.09, 1800, 700, 1.4); },
    explode()  { this.noise(0.42, 0.2, 900, 90, 0.5); this.tone(90, 0.36, 'sine', 0.16, 0, 40); },
    bigExplode(){ this.noise(0.85, 0.26, 700, 60, 0.4); this.tone(70, 0.7, 'sine', 0.2, 0, 28); },
    jump()     { this.tone(320, 0.13, 'triangle', 0.09, 0, 720); },
    dash()     { this.noise(0.16, 0.1, 500, 2400, 1.2); },
    hurt()     { this.tone(220, 0.2, 'sawtooth', 0.12, 0, 90); this.noise(0.14, 0.1, 400, 120, 1); },
    enemyShot(){ this.tone(300, 0.12, 'sawtooth', 0.06, 0, 160); },
    bossWarn() { this.tone(160, 0.5, 'square', 0.11); this.tone(200, 0.5, 'square', 0.11, 0.55); },
    bossRoar() { this.tone(110, 0.9, 'sawtooth', 0.16, 0, 55); this.noise(0.9, 0.16, 500, 80, 0.5); },
    revive()   { [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.1, i * 0.09)); },
    achieve()  { [784, 988, 1175].forEach((f, i) => this.tone(f, 0.35, 'sine', 0.11, i * 0.1)); },
    victory()  { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.12, i * 0.14)); },
    ui()       { this.tone(660, 0.06, 'square', 0.05, 0, 880); },
  };


  /* --------------------------------------------------------------- 音乐 */
  /* 极简程序化配乐：低音 + 琶音 + 踩镲，每关不同调式与速度 */
  const Music = UG.Music = {
    VOL: 0.5,                       /* 总线音量：原来 0.16 太小，实际听不见 */
    enabled: true,
    playing: false,
    ctx: null,
    bus: null,
    step: 0,
    nextTime: 0,
    _timer: null,
    cfg: null,

    presets: {
      city:    { bpm: 132, root: 110.0, scale: [0, 3, 5, 7, 10], arp: 'square',   bass: 'triangle', hat: 1 },
      desert:  { bpm: 116, root: 98.0,  scale: [0, 2, 3, 7, 8],   arp: 'sawtooth', bass: 'sine',     hat: 1 },
      snow:    { bpm: 124, root: 130.8, scale: [0, 2, 3, 7, 9],   arp: 'triangle', bass: 'sine',     hat: 1 },
      volcano: { bpm: 146, root: 92.5,  scale: [0, 1, 5, 6, 8],   arp: 'sawtooth', bass: 'square',   hat: 1 },
      space:   { bpm: 104, root: 103.8, scale: [0, 3, 5, 6, 10],  arp: 'sine',     bass: 'triangle', hat: 1 },
    },

    init(ctx, master) {
      this.ctx = ctx;
      this.master = master;
      this.bus = ctx.createGain();
      this.bus.gain.value = Music.VOL;
      this.bus.connect(master);
    },

    setEnabled(on) {
      this.enabled = on;
      if (this.bus) this.bus.gain.value = on ? Music.VOL : 0;
      if (!on) this.stop();
    },

    start(theme) {
      if (!this.ctx) return;
      this.cfg = this.presets[theme] || this.presets.city;
      if (this.playing) return;
      this.playing = true;
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.1;
      this._timer = setInterval(() => this._schedule(), 25);
    },

    stop() {
      this.playing = false;
      if (this._timer) { clearInterval(this._timer); this._timer = null; }
    },

    _note(freq, t, dur, type, vol) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.bus);
      o.start(t); o.stop(t + dur + 0.02);
    },

    _hat(t, vol) {
      const n = Math.floor(this.ctx.sampleRate * 0.04);
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 6000;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      src.connect(f); f.connect(g); g.connect(this.bus);
      src.start(t);
    },

    _schedule() {
      if (!this.playing) return;
      const spb = 60 / this.cfg.bpm / 4;          /* 十六分音符 */
      while (this.nextTime < this.ctx.currentTime + 0.14) {
        this._playStep(this.step, this.nextTime, spb);
        this.nextTime += spb;
        this.step = (this.step + 1) % 32;
      }
    },

    _playStep(step, t, spb) {
      const c = this.cfg;
      const sc = c.scale;

      /* 低音：每小节 1、3 拍 */
      if (step % 8 === 0) {
        const deg = (step / 8) % 2 === 0 ? 0 : 3;
        this._note(c.root / 2 * Math.pow(2, sc[deg % sc.length] / 12), t, spb * 6, c.bass, 0.34);
      }

      /* 琶音：八分音符上行 */
      if (step % 2 === 0) {
        const i = (step / 2) % 8;
        const oct = i >= 6 ? 2 : 1;
        const deg = sc[i % sc.length];
        this._note(c.root * oct * Math.pow(2, deg / 12), t, spb * 1.5, c.arp, 0.17);
      }

      /* 踩镲 */
      if (c.hat && step % 4 === 2) this._hat(t, 0.075);

      /* 每 16 步加一记重拍 */
      if (step === 0) this._note(c.root * 2, t, spb * 2, 'sine', 0.13);
    },
  };

  /* --------------------------------------------------------------- 粒子 */
  const Particles = UG.Particles = {
    list: [],

    clear() { this.list.length = 0; },

    spawn(opts) {
      const p = {
        x: opts.x, y: opts.y,
        vx: opts.vx || 0, vy: opts.vy || 0,
        life: opts.life || 0.5, maxLife: opts.life || 0.5,
        size: opts.size || 3,
        color: opts.color || '#fff',
        gravity: opts.gravity == null ? 300 : opts.gravity,
        drag: opts.drag == null ? 0.99 : opts.drag,
        glow: opts.glow !== false,
        shape: opts.shape || 'circle',
        rot: opts.rot || 0,
        spin: opts.spin || 0,
        fade: opts.fade !== false,
        additive: opts.additive !== false,
      };
      this.list.push(p);
      if (this.list.length > 900) this.list.splice(0, this.list.length - 900);
      return p;
    },

    burst(x, y, n, opts) {
      opts = opts || {};
      for (let i = 0; i < n; i++) {
        const a = rand(0, TAU), s = rand(opts.minSpeed || 40, opts.maxSpeed || 220);
        this.spawn({
          x, y,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opts.lift || 0),
          life: rand(opts.minLife || 0.25, opts.maxLife || 0.7),
          size: rand(opts.minSize || 1.5, opts.maxSize || 4),
          color: opts.color || '#fff',
          gravity: opts.gravity,
          shape: opts.shape,
          additive: opts.additive,
        });
      }
    },

    update(dt) {
      const l = this.list;
      for (let i = l.length - 1; i >= 0; i--) {
        const p = l[i];
        p.life -= dt;
        if (p.life <= 0) { l.splice(i, 1); continue; }
        p.vy += p.gravity * dt;
        p.vx *= p.drag; p.vy *= p.drag;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.spin * dt;
      }
    },

    draw(ctx) {
      const l = this.list;
      for (let i = 0; i < l.length; i++) {
        const p = l[i];
        const a = p.fade ? clamp(p.life / p.maxLife, 0, 1) : 1;
        ctx.globalAlpha = a;
        if (p.additive) ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = p.color;
        if (p.shape === 'square') {
          ctx.save();
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        } else if (p.shape === 'line') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * a), 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    },
  };

  /* --------------------------------------------------------------- 相机 */
  const Camera = UG.Camera = {
    x: 0, y: 0,
    targetX: 0,
    minX: 0, maxX: 0,
    shakeT: 0, shakeMag: 0,
    ox: 0, oy: 0,

    reset(minX, maxX) {
      this.minX = minX; this.maxX = maxX;
      this.x = minX; this.targetX = minX;
      this.shakeT = 0; this.shakeMag = 0; this.ox = 0; this.oy = 0;
    },

    follow(px, dt, lookAhead) {
      this.targetX = clamp(px - UG.VIEW.w / 2 + (lookAhead || 0), this.minX, this.maxX);
      this.x = lerp(this.x, this.targetX, 1 - Math.pow(0.0015, dt));
    },

    snap(px) {
      this.x = this.targetX = clamp(px - UG.VIEW.w / 2, this.minX, this.maxX);
    },

    shake(mag, time) {
      this.shakeMag = Math.max(this.shakeMag, mag);
      this.shakeT = Math.max(this.shakeT, time);
    },

    update(dt) {
      if (this.shakeT > 0) {
        this.shakeT -= dt;
        const k = Math.max(0, this.shakeT) * this.shakeMag;
        this.ox = rand(-k, k) * 0.5;
        this.oy = rand(-k, k) * 0.5;
        if (this.shakeT <= 0) { this.shakeMag = 0; this.ox = 0; this.oy = 0; }
      }
    },
  };

  UG.shake = (mag, time) => Camera.shake(mag, time);

  /* --------------------------------------------------------- 颜色小工具 */
  UG.rgba = (hex, a) => {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  /** 圆角矩形路径 */
  UG.roundRect = (ctx, x, y, w, h, r) => {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };

})(window);
