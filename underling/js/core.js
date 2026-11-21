/* ============================================================
 * 地下小勇者 · UNDERLING
 * core.js — 画布 / 输入 / 音效 / 文字与绘图小工具
 * ------------------------------------------------------------
 * 全部为原创代码与原创画面，仅玩法上致敬《传说之下》。
 * ============================================================ */
(function () {
  'use strict';
  var G = (window.G = window.G || {});

  G.W = 960;
  G.H = 600;

  /* ---------------- 数学 ---------------- */
  G.TAU = Math.PI * 2;
  G.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  G.rand = function (a, b) { return a + Math.random() * (b - a); };
  G.randInt = function (a, b) { return Math.floor(G.rand(a, b + 1)); };

  /* ---------------- 画布 ---------------- */
  G.initCanvas = function (canvas) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas = canvas;
    this.dpr = dpr;
    this.ctx = canvas.getContext('2d');
    canvas.width = Math.round(this.W * dpr);
    canvas.height = Math.round(this.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.textBaseline = 'top';
  };

  G.fitCanvas = function () {
    if (!this.canvas) return;
    var s = Math.min(window.innerWidth / this.W, window.innerHeight / this.H);
    this.canvas.style.width = Math.max(320, Math.floor(this.W * s)) + 'px';
    this.canvas.style.height = Math.floor(this.H * s) + 'px';
  };

  /* ---------------- 文字 ---------------- */
  G.FONT = '"Microsoft YaHei","PingFang SC","Noto Sans SC","Source Han Sans SC","Segoe UI",sans-serif';

  G.font = function (size, bold) {
    return (bold ? '700 ' : '400 ') + size + 'px ' + G.FONT;
  };

  /** 中英混排换行：逐字符量宽，遇到超宽就折行。 */
  G.wrapText = function (ctx, text, maxWidth) {
    var lines = [];
    var paras = String(text).split('\n');
    for (var p = 0; p < paras.length; p++) {
      var para = paras[p];
      var line = '';
      for (var i = 0; i < para.length; i++) {
        var ch = para[i];
        var test = line + ch;
        if (line && ctx.measureText(test).width > maxWidth) {
          lines.push(line);
          line = ch;
        } else {
          line = test;
        }
      }
      lines.push(line);
    }
    return lines;
  };

  /** 画一段自动换行的文字，返回占用的行数。 */
  G.drawText = function (ctx, text, x, y, opts) {
    opts = opts || {};
    var size = opts.size || 20;
    ctx.save();
    ctx.font = G.font(size, opts.bold);
    ctx.fillStyle = opts.color || '#ffffff';
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = 'top';
    var lines = G.wrapText(ctx, text, opts.maxWidth || 780);
    var lh = opts.lineHeight || Math.round(size * 1.55);
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, y + i * lh);
    }
    ctx.restore();
    return lines.length;
  };

  /* ---------------- 形状 ---------------- */
  G.roundRectPath = function (ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  /** 黑底白边的「对话框 / 面板」，和本作的视觉语言一致。 */
  G.panel = function (ctx, x, y, w, h, opts) {
    opts = opts || {};
    var r = opts.r === undefined ? 10 : opts.r;
    ctx.save();
    ctx.fillStyle = opts.fill || '#000000';
    G.roundRectPath(ctx, x, y, w, h, r);
    if (opts.alpha !== undefined) {
      ctx.globalAlpha = opts.alpha;
    }
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = opts.lineWidth || 4;
    ctx.strokeStyle = opts.stroke || '#ffffff';
    G.roundRectPath(ctx, x, y, w, h, r);
    ctx.stroke();
    ctx.restore();
  };

  /* ---------------- 像素爱心（灵魂 / 光标） ---------------- */
  G.HEART_PIXELS = [
    '01100110',
    '11111111',
    '11111111',
    '11111111',
    '01111110',
    '00111100',
    '00011000'
  ];

  G.drawHeart = function (ctx, cx, cy, scale, color) {
    scale = scale || 2;
    var w = 8 * scale, h = 7 * scale;
    var x0 = cx - w / 2, y0 = cy - h / 2;
    var rows = G.HEART_PIXELS;
    ctx.save();
    ctx.fillStyle = color || '#ff2b46';
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      for (var c = 0; c < row.length; c++) {
        if (row[c] === '1') ctx.fillRect(x0 + c * scale, y0 + r * scale, scale, scale);
      }
    }
    ctx.restore();
  };

  /* ---------------- 输入 ---------------- */
  var downSet = new Set();
  var pressedSet = new Set();

  G.isDown = function (code) { return downSet.has(code); };
  G.wasPressed = function (code) { return pressedSet.has(code); };
  G.confirmPressed = function () {
    return pressedSet.has('KeyZ') || pressedSet.has('Enter') ||
           pressedSet.has('Space') || pressedSet.has('NumpadEnter');
  };
  G.cancelPressed = function () {
    return pressedSet.has('KeyX') || pressedSet.has('Escape') || pressedSet.has('ShiftLeft');
  };
  G.anyPressed = function () { return pressedSet.size > 0; };
  G.clearPressed = function () { pressedSet.clear(); };

  var BLOCK = {
    ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1, Space: 1, Tab: 1
  };

  G.initInput = function () {
    window.addEventListener('keydown', function (e) {
      if (BLOCK[e.code]) e.preventDefault();
      if (!e.repeat) pressedSet.add(e.code);
      downSet.add(e.code);
      G.audio.ensure();
    }, { passive: false });

    window.addEventListener('keyup', function (e) {
      downSet.delete(e.code);
    });

    window.addEventListener('blur', function () {
      downSet.clear();
    });
  };

  /* ---------------- 音效（WebAudio 合成，无外部素材） ---------------- */
  G.audio = {
    ctx: null,
    muted: false,
    ensure: function () {
      if (!this.ctx) {
        try {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (AC) this.ctx = new AC();
        } catch (err) {
          this.ctx = null;
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },
    tone: function (freq, dur, type, vol, slideTo) {
      if (this.muted || !this.ctx) return;
      try {
        var t0 = this.ctx.currentTime;
        var osc = this.ctx.createOscillator();
        var gain = this.ctx.createGain();
        osc.type = type || 'square';
        osc.frequency.setValueAtTime(freq, t0);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
        gain.gain.setValueAtTime(vol || 0.04, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.03);
      } catch (err) { /* 忽略音频异常 */ }
    },
    blip: function () { this.tone(700, 0.025, 'square', 0.022); },
    move: function () { this.tone(430, 0.04, 'square', 0.035); },
    confirm: function () {
      this.tone(660, 0.055, 'square', 0.04);
      var self = this;
      setTimeout(function () { self.tone(990, 0.07, 'square', 0.035); }, 55);
    },
    cancel: function () { this.tone(300, 0.06, 'square', 0.03); },
    slash: function () { this.tone(1500, 0.09, 'sawtooth', 0.045, 260); },
    hurt: function () { this.tone(110, 0.24, 'sawtooth', 0.07, 48); },
    heal: function () { this.tone(520, 0.16, 'sine', 0.06, 1040); },
    warn: function () { this.tone(180, 0.14, 'square', 0.05, 240); },
    spare: function () {
      var self = this;
      [523, 659, 784, 1047].forEach(function (f, i) {
        setTimeout(function () { self.tone(f, 0.2, 'triangle', 0.05); }, i * 90);
      });
    }
  };

  /* ---------------- 打字机 ---------------- */
  G.Typewriter = function (text, cps) {
    this.text = String(text);
    this.cps = cps || 40;
    this.t = 0;
    this.lastCount = 0;
  };

  Object.defineProperty(G.Typewriter.prototype, 'count', {
    get: function () {
      return Math.min(this.text.length, Math.floor(this.t * this.cps));
    }
  });
  Object.defineProperty(G.Typewriter.prototype, 'visible', {
    get: function () { return this.text.slice(0, this.count); }
  });
  Object.defineProperty(G.Typewriter.prototype, 'done', {
    get: function () { return this.t * this.cps >= this.text.length; }
  });

  G.Typewriter.prototype.update = function (dt) {
    if (this.done) return;
    this.t += dt;
    var c = this.count;
    if (c > this.lastCount) {
      if (c % 4 === 0) G.audio.blip();
      this.lastCount = c;
    }
  };

  G.Typewriter.prototype.finish = function () {
    this.t = this.text.length / this.cps + 0.0001;
    this.lastCount = this.text.length;
  };
})();
