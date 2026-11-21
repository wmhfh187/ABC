/* ============================================================
 * scenes.js — 标题 / 洞窟 / 结局
 * ============================================================ */
(function () {
  'use strict';
  var G = window.G;

  /* ---------------- 通用对话 ---------------- */
  function Dialogue(lines, onDone) {
    this.lines = (Array.isArray(lines) ? lines : [lines]).slice();
    this.i = 0;
    this.tw = new G.Typewriter(this.lines[0], 42);
    this.onDone = onDone || null;
    this.done = false;
  }

  Dialogue.prototype.update = function (dt) {
    if (this.done) return true;
    this.tw.update(dt);
    if (G.confirmPressed()) {
      if (!this.tw.done) {
        this.tw.finish();
      } else if (this.i < this.lines.length - 1) {
        this.i++;
        this.tw = new G.Typewriter(this.lines[this.i], 42);
      } else {
        this.done = true;
        if (this.onDone) this.onDone();
      }
    }
    return this.done;
  };

  Dialogue.prototype.draw = function (ctx, x, y, maxWidth, size, align) {
    if (!this.tw) return;
    var shown = G.drawText(ctx, this.tw.visible, x, y, {
      size: size || 20,
      maxWidth: maxWidth || 780,
      lineHeight: Math.round((size || 20) * 1.5),
      align: align || 'left'
    });
    if (this.tw.done && Math.floor(performance.now() / 380) % 2 === 0) {
      ctx.save();
      ctx.fillStyle = '#ffd23f';
      ctx.font = G.font(20, true);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('▸', x + maxWidth, y + (shown - 1) * Math.round((size || 20) * 1.5) + 4);
      ctx.restore();
    }
  };

  /* ---------------- 装饰粒子 ---------------- */
  function makeSpores(n) {
    var arr = [];
    for (var i = 0; i < n; i++) {
      arr.push({
        x: G.rand(20, G.W - 20),
        y: G.rand(40, G.H - 20),
        r: G.rand(1, 2.6),
        v: G.rand(6, 22),
        p: G.rand(0, G.TAU)
      });
    }
    return arr;
  }

  function updateSpores(arr, dt, t) {
    for (var i = 0; i < arr.length; i++) {
      var s = arr[i];
      s.y -= s.v * dt;
      s.x += Math.sin(t * 0.8 + s.p) * 6 * dt;
      if (s.y < 10) {
        s.y = G.H - 10;
        s.x = G.rand(20, G.W - 20);
      }
    }
  }

  function drawSpores(ctx, arr, t, color) {
    ctx.save();
    for (var i = 0; i < arr.length; i++) {
      var s = arr[i];
      var a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.6 + s.p));
      ctx.fillStyle = color.replace('ALPHA', a.toFixed(3));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, G.TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ============================================================
   * 标题
   * ============================================================ */
  function TitleScene(app) {
    this.app = app;
    this.t = 0;
    this.spores = makeSpores(34);
  }

  TitleScene.prototype.update = function (dt) {
    this.t += dt;
    updateSpores(this.spores, dt, this.t);
    if (G.confirmPressed()) {
      G.audio.confirm();
      this.app.setScene(new WorldScene(this.app));
    }
  };

  TitleScene.prototype.draw = function (ctx) {
    var g = ctx.createLinearGradient(0, 0, 0, G.H);
    g.addColorStop(0, '#0b0714');
    g.addColorStop(0.7, '#070410');
    g.addColorStop(1, '#020106');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, G.W, G.H);

    /* 远处洞窟剪影 */
    ctx.fillStyle = '#0e0919';
    ctx.beginPath();
    ctx.moveTo(0, 430);
    for (var x = 0; x <= G.W; x += 60) {
      ctx.lineTo(x, 400 + Math.sin(x * 0.012) * 26 + Math.sin(x * 0.031) * 12);
    }
    ctx.lineTo(G.W, G.H);
    ctx.lineTo(0, G.H);
    ctx.closePath();
    ctx.fill();

    drawSpores(ctx, this.spores, this.t, 'rgba(150,220,120,ALPHA)');

    /* 标题 */
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(120,210,100,0.55)';
    ctx.shadowBlur = 26;
    ctx.fillStyle = '#f2ecdd';
    ctx.font = G.font(70, true);
    ctx.fillText('地下小勇者', 480, 130);
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = G.font(22, false);
    ctx.fillStyle = '#a89c8a';
    ctx.fillText('UNDERLING · 一个致敬《传说之下》的小原型', 480, 226);

    ctx.font = G.font(15, false);
    ctx.fillStyle = '#6b6358';
    ctx.fillText('原创角色与文本 · 不含原作素材 · 单机 · 无需联网', 480, 262);
    ctx.restore();

    /* 提示 */
    if (Math.floor(this.t * 2) % 2 === 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = G.font(24, true);
      ctx.fillStyle = '#ffd23f';
      ctx.fillText('按 Z / Enter 开始', 480, 380);
      ctx.restore();
    }

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = G.font(16, false);
    ctx.fillStyle = '#7d7568';
    ctx.fillText('方向键 移动 · Z / Enter 确认 · 战斗中操控红心躲开弹幕', 480, 470);
    ctx.font = G.font(14, false);
    ctx.fillStyle = '#514a40';
    ctx.fillText('v0.1 prototype', 480, 520);
    ctx.restore();
  };

  /* ============================================================
   * 洞窟（探索）
   * ============================================================ */
  function WorldScene(app) {
    this.app = app;
    this.t = 0;
    this.player = { x: 300, y: 470, dir: 1, moving: false };
    this.npc = { x: 720, y: 470, alive: true, happy: false };
    this.nearNpc = false;
    this.spores = makeSpores(26);
    this.pebbles = [];
    for (var i = 0; i < 46; i++) {
      this.pebbles.push({
        x: G.rand(30, G.W - 30),
        y: G.rand(478, G.H - 6),
        r: G.rand(1, 3.2),
        a: G.rand(0.06, 0.18)
      });
    }
    this.dialog = new Dialogue([
      '* 你在一个发着微光的苔藓洞窟里醒来。',
      '* （方向键移动 · 走近那只苔团后按 Z）'
    ], null);
  }

  WorldScene.prototype.update = function (dt) {
    this.t += dt;
    updateSpores(this.spores, dt, this.t);

    if (this.dialog) {
      var finished = this.dialog.update(dt);
      if (finished) this.dialog = null;
      this.player.moving = false;
      return;
    }

    var p = this.player;
    var speed = 178;
    var dx = 0, dy = 0;
    if (G.isDown('ArrowLeft')) dx -= 1;
    if (G.isDown('ArrowRight')) dx += 1;
    if (G.isDown('ArrowUp')) dy -= 1;
    if (G.isDown('ArrowDown')) dy += 1;
    if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }

    p.moving = !!(dx || dy);
    if (dx > 0) p.dir = 1;
    else if (dx < 0) p.dir = -1;

    p.x = G.clamp(p.x + dx * speed * dt, 70, G.W - 70);
    p.y = G.clamp(p.y + dy * speed * dt, 452, 500);

    var n = this.npc;
    this.nearNpc = n.alive && Math.abs(p.x - n.x) < 88 && Math.abs(p.y - n.y) < 48;

    if (this.nearNpc && G.confirmPressed()) {
      this.startBattle();
    }
  };

  WorldScene.prototype.startBattle = function () {
    var app = this.app;
    var self = this;
    G.audio.warn();
    app.setScene(new G.Battle(app, {
      onEnd: function (result) { self.onBattleEnd(result); }
    }));
  };

  WorldScene.prototype.onBattleEnd = function (result) {
    var app = this.app;
    if (result === 'flee') {
      this.dialog = new Dialogue(['* 你退后了几步，离开了战斗。'], null);
      app.setScene(this);
      return;
    }
    if (result === 'spare') this.npc.happy = true;
    if (result === 'kill') this.npc.alive = false;
    app.setScene(new G.EndingScene(app, result));
  };

  /* ---------- 绘制 ---------- */
  WorldScene.prototype.draw = function (ctx) {
    this.drawCave(ctx);
    this.drawNpc(ctx);
    this.drawPlayer(ctx);
    drawSpores(ctx, this.spores, this.t, 'rgba(160,230,130,ALPHA)');

    if (this.nearNpc && !this.dialog) {
      this.drawPrompt(ctx);
    }

    /* 操作提示 */
    if (!this.dialog) {
      ctx.save();
      ctx.font = G.font(15, false);
      ctx.fillStyle = 'rgba(180,170,150,0.55)';
      ctx.textBaseline = 'top';
      ctx.fillText('方向键 移动 · Z 互动', 24, 20);
      ctx.restore();
    }

    if (this.dialog) {
      G.panel(ctx, 56, 424, 848, 144, { fill: 'rgba(0,0,0,0.94)' });
      this.dialog.draw(ctx, 92, 452, 776, 20);
    }
  };

  WorldScene.prototype.drawCave = function (ctx) {
    var g = ctx.createLinearGradient(0, 0, 0, G.H);
    g.addColorStop(0, '#160d24');
    g.addColorStop(0.55, '#0d0718');
    g.addColorStop(1, '#05030a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, G.W, G.H);

    /* 钟乳石 */
    ctx.fillStyle = '#0b0616';
    for (var i = 0; i < 9; i++) {
      var x = 40 + i * 108 + (i % 2) * 22;
      var w = 34 + (i % 3) * 12;
      var h = 60 + (i % 4) * 26;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + w, 0);
      ctx.lineTo(x + w / 2, h);
      ctx.closePath();
      ctx.fill();
    }

    /* 地面 */
    ctx.fillStyle = '#171024';
    ctx.fillRect(0, 470, G.W, G.H - 470);
    ctx.fillStyle = '#241735';
    ctx.fillRect(0, 470, G.W, 4);

    for (var p = 0; p < this.pebbles.length; p++) {
      var pb = this.pebbles[p];
      ctx.fillStyle = 'rgba(120,100,150,' + pb.a + ')';
      ctx.beginPath();
      ctx.arc(pb.x, pb.y, pb.r, 0, G.TAU);
      ctx.fill();
    }

    /* 蘑菇光晕 */
    this.drawMushroom(ctx, 148, 470, 1.0);
    this.drawMushroom(ctx, 842, 476, 0.8);
    this.drawMushroom(ctx, 604, 486, 0.6);

    /* 苔藓丛 */
    ctx.fillStyle = 'rgba(90,150,70,0.5)';
    var clumps = [[180, 492, 26], [420, 500, 20], [760, 496, 24], [520, 486, 14]];
    for (var c = 0; c < clumps.length; c++) {
      ctx.beginPath();
      ctx.ellipse(clumps[c][0], clumps[c][1], clumps[c][2], 9, 0, 0, G.TAU);
      ctx.fill();
    }
  };

  WorldScene.prototype.drawMushroom = function (ctx, x, y, scale) {
    var pulse = 0.75 + 0.25 * Math.sin(this.t * 1.6 + x * 0.01);
    var glow = ctx.createRadialGradient(x, y - 30 * scale, 4, x, y - 30 * scale, 92 * scale);
    glow.addColorStop(0, 'rgba(130,230,120,' + (0.22 * pulse) + ')');
    glow.addColorStop(1, 'rgba(130,230,120,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y - 30 * scale, 92 * scale, 0, G.TAU);
    ctx.fill();

    ctx.fillStyle = '#cfe8b8';
    ctx.fillRect(x - 3 * scale, y - 26 * scale, 6 * scale, 24 * scale);

    ctx.fillStyle = '#8fd07a';
    ctx.beginPath();
    ctx.ellipse(x, y - 28 * scale, 18 * scale, 10 * scale, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#bfe8a6';
    ctx.beginPath();
    ctx.arc(x - 6 * scale, y - 32 * scale, 2.6 * scale, 0, G.TAU);
    ctx.fill();
  };

  WorldScene.prototype.drawPlayer = function (ctx) {
    var p = this.player;
    var bob = p.moving ? Math.sin(this.t * 12) * 2 : Math.sin(this.t * 2) * 1.2;
    var x = p.x;
    var y = p.y + bob;

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 4, 16, 6, 0, 0, G.TAU);
    ctx.fill();

    var swing = p.moving ? Math.sin(this.t * 12) * 3 : 0;

    /* 腿 */
    ctx.fillStyle = '#242a4a';
    ctx.fillRect(x - 9, y - 13, 7, 13 + swing * 0.3);
    ctx.fillRect(x + 2, y - 13, 7, 13 - swing * 0.3);

    /* 斗篷 */
    ctx.fillStyle = '#3b4a8a';
    G.roundRectPath(ctx, x - 12, y - 37, 24, 27, 7);
    ctx.fill();

    /* 围巾 */
    ctx.fillStyle = '#c14545';
    ctx.fillRect(x - 11, y - 39, 22, 6);

    /* 头 */
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(x, y - 49, 10, 0, G.TAU);
    ctx.fill();

    /* 头发 */
    ctx.fillStyle = '#2a2438';
    ctx.beginPath();
    ctx.arc(x, y - 52, 10, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x - 10, y - 53, 20, 4);

    /* 眼睛 */
    ctx.fillStyle = '#1c1626';
    ctx.fillRect(x - 4, y - 47, 2, 3);
    ctx.fillRect(x + 2, y - 47, 2, 3);
  };

  WorldScene.prototype.drawNpc = function (ctx) {
    var n = this.npc;
    var x = n.x, y = n.y;
    var bob = Math.sin(this.t * 2.2) * 2;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y + 3, 26, 7, 0, 0, G.TAU);
    ctx.fill();

    if (!n.alive) {
      /* 剩下的一小片孢子 */
      ctx.fillStyle = 'rgba(140,190,120,0.18)';
      for (var i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(x - 14 + i * 6, y - 8 - (i % 2) * 6, 4, 0, G.TAU);
        ctx.fill();
      }
      return;
    }

    var body = n.happy ? '#5f9a3c' : '#4e7d36';
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(x, y - 26 + bob, 28, 23, 0, 0, G.TAU);
    ctx.fill();
    ctx.strokeStyle = '#33522a';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = n.happy ? '#7fb85c' : '#6fa64f';
    var tufts = [[-18, -44], [-4, -50], [12, -46], [22, -38]];
    for (var t = 0; t < tufts.length; t++) {
      ctx.beginPath();
      ctx.arc(x + tufts[t][0], y + tufts[t][1] + bob, 7, 0, G.TAU);
      ctx.fill();
    }

    /* 眼睛 */
    ctx.fillStyle = '#141a10';
    ctx.beginPath(); ctx.arc(x - 9, y - 30 + bob, 3.4, 0, G.TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 9, y - 30 + bob, 3.4, 0, G.TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x - 8, y - 31 + bob, 1.2, 0, G.TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 10, y - 31 + bob, 1.2, 0, G.TAU); ctx.fill();

    /* 嘴 */
    ctx.strokeStyle = '#141a10';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (n.happy) {
      ctx.arc(x, y - 22 + bob, 7, 0.15 * Math.PI, 0.85 * Math.PI);
    } else {
      ctx.arc(x, y - 24 + bob, 5, 0.2 * Math.PI, 0.8 * Math.PI);
    }
    ctx.stroke();

    /* 开心时的小星光 */
    if (n.happy) {
      for (var s = 0; s < 3; s++) {
        var a = this.t * 2 + s * 2.1;
        var sx = x + Math.cos(a) * 40;
        var sy = y - 40 + Math.sin(a * 1.3) * 14;
        ctx.fillStyle = 'rgba(255,225,130,0.8)';
        ctx.fillRect(sx - 1.5, sy - 5, 3, 10);
        ctx.fillRect(sx - 5, sy - 1.5, 10, 3);
      }
    }
  };

  WorldScene.prototype.drawPrompt = function (ctx) {
    var n = this.npc;
    var y = n.y - 82 + Math.sin(this.t * 4) * 4;
    ctx.save();
    ctx.fillStyle = '#ffd23f';
    ctx.font = G.font(30, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('！', n.x, y);
    ctx.restore();
  };

  /* ============================================================
   * 结局
   * ============================================================ */
  function EndingScene(app, result) {
    this.app = app;
    this.result = result;
    this.t = 0;
    this.done = false;
    this.doneAt = 0;

    var lines = result === 'spare' ? [
      '* 苔团开心地跟在你身后，一路留下细小的孢子。',
      '* 洞窟深处的光，好像亮了一点。',
      '* —— 你选择了温柔。'
    ] : [
      '* 苔团散成了孢子，慢慢飘进黑暗里。',
      '* 洞窟很安静，安静得有点冷。',
      '* —— 你选择了战斗。'
    ];

    var self = this;
    this.dialog = new Dialogue(lines, function () {
      self.done = true;
      self.doneAt = performance.now();
    });
  }

  EndingScene.prototype.update = function (dt) {
    this.t += dt;
    this.dialog.update(dt);
    if (this.done && performance.now() - this.doneAt > 350 && G.confirmPressed()) {
      G.audio.confirm();
      this.app.setScene(new TitleScene(this.app));
    }
  };

  EndingScene.prototype.draw = function (ctx) {
    var spare = this.result === 'spare';
    var g = ctx.createRadialGradient(480, 420, 40, 480, 300, 620);
    if (spare) {
      g.addColorStop(0, 'rgba(90,150,70,0.35)');
      g.addColorStop(1, '#05030a');
    } else {
      g.addColorStop(0, 'rgba(120,40,50,0.22)');
      g.addColorStop(1, '#030205');
    }
    ctx.fillStyle = '#05030a';
    ctx.fillRect(0, 0, G.W, G.H);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, G.W, G.H);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = G.font(16, false);
    ctx.fillStyle = spare ? '#9bd07a' : '#a8757c';
    ctx.fillText(spare ? '结局 A · 饶恕' : '结局 B · 战斗', 480, 106);

    ctx.font = G.font(52, true);
    ctx.fillStyle = '#f2ecdd';
    ctx.fillText(spare ? '温柔的路' : '沉默的洞窟', 480, 140);
    ctx.restore();

    G.panel(ctx, 150, 250, 660, 190, { fill: 'rgba(0,0,0,0.55)', lineWidth: 2, stroke: 'rgba(255,255,255,0.35)' });
    this.dialog.draw(ctx, 480, 280, 580, 20, 'center');

    if (this.done && Math.floor(this.t * 2) % 2 === 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = G.font(20, true);
      ctx.fillStyle = '#ffd23f';
      ctx.fillText('按 Z 回到标题', 480, 490);
      ctx.restore();
    }
  };

  G.Dialogue = Dialogue;
  G.TitleScene = TitleScene;
  G.WorldScene = WorldScene;
  G.EndingScene = EndingScene;
})();
