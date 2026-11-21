/* ============================================================
 * battle.js — 战斗系统
 * ------------------------------------------------------------
 * 一个回合制战斗：战斗 / 行动 / 物品 / 饶恕。
 *  - 战斗：停住扫动光标，越靠中间伤害越高
 *  - 行动：检查 / 安慰 / 讲笑话，让苔团放下戒心
 *  - 物品：苔藓药水回血
 *  - 饶恕：它不再害怕你时，才可以放它走
 *  - 每回合敌人会放出孢子弹幕，操控红心在方框里躲开
 * ============================================================ */
(function () {
  'use strict';
  var G = window.G;

  var PANEL = { x: 56, y: 312, w: 848, h: 208 };
  var BOARD = { x: 250, y: 320, w: 460, h: 176 };
  var MENU = ['战斗', '行动', '物品', '饶恕'];
  var ACTS = [
    { name: '检查', desc: '看看苔团现在的样子。' },
    { name: '安慰', desc: '轻声告诉它：没关系。' },
    { name: '讲笑话', desc: '讲一个关于石头的老笑话。' }
  ];

  function Battle(app, opts) {
    opts = opts || {};
    this.app = app;
    this.opts = opts;

    this.t = 0;
    this.state = 'msg';
    this.msg = null;
    this.queue = [];
    this.queueDone = null;
    this.banner = '';

    this.enemy = { name: '苔团', hpMax: 30, hp: 30, mood: 'neutral', flash: 0 };
    this.player = { hpMax: 20, hp: 20, potions: 2 };

    this.menuIndex = 0;
    this.actIndex = 0;
    this.mercyIndex = 0;
    this.mercy = 0;
    this.mercyReady = false;
    this.turn = 0;

    this.bullets = [];
    this.spawnTimer = 0;
    this.turnTime = 0;
    this.turnDuration = 0;
    this.pattern = 'rain';
    this.soul = { x: BOARD.x + BOARD.w / 2, y: BOARD.y + BOARD.h / 2 };
    this.invuln = 0;
    this.shake = 0;
    this.floaters = [];

    this.pendingDamage = 0;
    this.attackT = 0;
    this.attackHit = false;
    this.attackLines = [];

    this.fightT = 0;
    this.marker = 0;
    this.fightSpeed = 1 / 1.15;

    this.deadTime = 0;

    this.startIntro();
  }

  /* ---------------- 对话 ---------------- */
  Battle.prototype.say = function (lines, done) {
    this.queue = (Array.isArray(lines) ? lines : [lines]).slice();
    this.queueDone = done || null;
    this.nextLine();
  };

  Battle.prototype.nextLine = function () {
    if (this.queue.length) {
      this.msg = new G.Typewriter(this.queue.shift(), 42);
    } else {
      this.msg = null;
      var cb = this.queueDone;
      this.queueDone = null;
      if (cb) cb();
    }
  };

  Battle.prototype.startIntro = function () {
    var self = this;
    this.state = 'msg';
    this.say([
      '* 苔团挡住了去路！',
      '* （你握紧了手里的小木棍。）'
    ], function () { self.toMenu(); });
  };

  Battle.prototype.toMenu = function () {
    this.state = 'menu';
    this.msg = null;
    this.menuIndex = 0;
    this.banner = this.player.hp <= 6 ? '* 你的伤不轻……' : '* 你的回合。';
  };

  /* ---------------- 总更新 ---------------- */
  Battle.prototype.update = function (dt) {
    this.t += dt;
    if (this.enemy.flash > 0) this.enemy.flash = Math.max(0, this.enemy.flash - dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);

    for (var i = 0; i < this.floaters.length; i++) {
      this.floaters[i].t += dt;
      this.floaters[i].y -= 34 * dt;
    }
    this.floaters = this.floaters.filter(function (f) { return f.t < 1.1; });

    switch (this.state) {
      case 'msg': this.updateMsg(dt); break;
      case 'menu': this.updateMenu(dt); break;
      case 'act': this.updateAct(dt); break;
      case 'item': this.updateItem(dt); break;
      case 'mercy': this.updateMercy(dt); break;
      case 'fight': this.updateFight(dt); break;
      case 'attack': this.updateAttack(dt); break;
      case 'enemyturn': this.updateEnemyTurn(dt); break;
      case 'dead': this.updateDead(dt); break;
      default: break;
    }
  };

  Battle.prototype.updateMsg = function (dt) {
    if (!this.msg) return;
    this.msg.update(dt);
    if (G.confirmPressed()) {
      if (!this.msg.done) {
        this.msg.finish();
      } else {
        this.nextLine();
      }
    }
  };

  /* ---------------- 主菜单 ---------------- */
  Battle.prototype.updateMenu = function (dt) {
    if (G.wasPressed('ArrowLeft') || G.wasPressed('ArrowRight')) {
      var dir = G.wasPressed('ArrowRight') ? 1 : -1;
      this.menuIndex = (this.menuIndex + dir + MENU.length) % MENU.length;
      G.audio.move();
    }
    if (G.confirmPressed()) {
      G.audio.confirm();
      var pick = this.menuIndex;
      if (pick === 0) {
        this.startFight();
      } else if (pick === 1) {
        this.state = 'act';
        this.actIndex = 0;
      } else if (pick === 2) {
        this.state = 'item';
      } else {
        this.state = 'mercy';
        this.mercyIndex = 0;
      }
    }
  };

  /* ---------------- 行动 ---------------- */
  Battle.prototype.updateAct = function (dt) {
    if (G.wasPressed('ArrowUp') || G.wasPressed('ArrowDown')) {
      var d = G.wasPressed('ArrowDown') ? 1 : -1;
      this.actIndex = G.clamp(this.actIndex + d, 0, ACTS.length - 1);
      G.audio.move();
    }
    if (G.cancelPressed()) {
      this.state = 'menu';
      G.audio.cancel();
      return;
    }
    if (G.confirmPressed()) {
      G.audio.confirm();
      this.chooseAct();
    }
  };

  Battle.prototype.chooseAct = function () {
    var self = this;
    var act = ACTS[this.actIndex];

    if (act.name === '检查') {
      this.state = 'msg';
      this.say([
        '* 苔团 —— 攻击 0，防御 2。',
        '* 它抖得很厉害，但看起来并没有敌意。'
      ], function () {
        self.state = 'act';
        self.actIndex = 0;
      });
      return;
    }

    this.mercy = Math.min(2, this.mercy + 1);
    if (this.mercy >= 2) this.enemy.mood = 'happy';
    else this.enemy.mood = 'calm';

    var lines;
    if (act.name === '安慰') {
      lines = ['* 你轻声说：“没关系，我不会伤害你。”', '* 苔团抖了抖，安静下来一点。'];
    } else {
      lines = ['* 你讲了个关于石头的笑话。', '* 苔团“噗”地漏出一点孢子，好像在笑。'];
    }

    this.state = 'msg';
    this.say(lines, function () { self.afterAct(); });
  };

  Battle.prototype.afterAct = function () {
    var self = this;
    if (this.mercy >= 2 && !this.mercyReady) {
      this.mercyReady = true;
      this.say([
        '* 苔团看起来不再害怕你了。',
        '* （「饶恕」现在可以用了。）'
      ], function () { self.enemyTurn(); });
    } else {
      this.enemyTurn();
    }
  };

  /* ---------------- 物品 ---------------- */
  Battle.prototype.updateItem = function (dt) {
    if (G.cancelPressed()) {
      this.state = 'menu';
      G.audio.cancel();
      return;
    }
    if (G.confirmPressed()) {
      G.audio.confirm();
      this.useItem();
    }
  };

  Battle.prototype.useItem = function () {
    var self = this;
    if (this.player.potions <= 0) {
      this.say(['* 背包里已经空了。'], function () { self.state = 'menu'; });
      this.state = 'msg';
      return;
    }
    if (this.player.hp >= this.player.hpMax) {
      this.say(['* 你暂时还不需要治疗。'], function () { self.state = 'item'; });
      this.state = 'msg';
      return;
    }
    this.player.potions--;
    var before = this.player.hp;
    this.player.hp = Math.min(this.player.hpMax, this.player.hp + 10);
    G.audio.heal();
    this.floaters.push({
      text: '+' + (this.player.hp - before),
      x: 300, y: 500, t: 0, color: '#9be36f'
    });
    this.state = 'msg';
    this.say([
      '* 你喝下了苔藓药水。',
      '* HP 恢复了 ' + (this.player.hp - before) + ' 点。'
    ], function () { self.enemyTurn(); });
  };

  /* ---------------- 饶恕 ---------------- */
  Battle.prototype.updateMercy = function (dt) {
    if (G.wasPressed('ArrowUp') || G.wasPressed('ArrowDown')) {
      this.mercyIndex = this.mercyIndex === 0 ? 1 : 0;
      G.audio.move();
    }
    if (G.cancelPressed()) {
      this.state = 'menu';
      G.audio.cancel();
      return;
    }
    if (G.confirmPressed()) {
      G.audio.confirm();
      this.chooseMercy();
    }
  };

  Battle.prototype.chooseMercy = function () {
    var self = this;
    if (this.mercyIndex === 0) {
      if (this.mercyReady) {
        this.spareEnding();
      } else {
        this.state = 'msg';
        this.say(['* 苔团还不想走。', '* （先试试「行动」吧。）'], function () {
          self.state = 'menu';
        });
      }
    } else {
      this.state = 'msg';
      this.say(['* 你退后了几步，脱离了战斗。'], function () {
        self.finish('flee');
      });
    }
  };

  /* ---------------- 战斗（判定条） ---------------- */
  Battle.prototype.startFight = function () {
    this.state = 'fight';
    this.fightT = 0;
    this.marker = 0;
    this.banner = '* 按 Z，让光标停在中间！';
  };

  Battle.prototype.updateFight = function (dt) {
    this.fightT += dt;
    this.marker = Math.min(1, this.fightT * this.fightSpeed);
    if (G.confirmPressed()) {
      this.resolveFight(false);
      return;
    }
    if (this.marker >= 1) this.resolveFight(true);
  };

  Battle.prototype.resolveFight = function (missed) {
    var acc = missed ? 0 : 1 - Math.abs(this.marker - 0.5) * 2;
    var dmg = 0;
    if (!missed) {
      if (acc > 0.9) dmg = 7;
      else if (acc > 0.65) dmg = 5;
      else if (acc > 0.35) dmg = 3;
      else dmg = 1;
    }
    this.pendingDamage = dmg;
    this.state = 'attack';
    this.attackT = 0;
    this.attackHit = false;
    this.attackLines = [];
    for (var i = 0; i < 3; i++) {
      this.attackLines.push({ x: G.rand(340, 620), y: G.rand(90, 240), len: G.rand(60, 130), a: G.rand(-0.5, 0.5) });
    }
    G.audio.slash();
  };

  Battle.prototype.updateAttack = function (dt) {
    this.attackT += dt;

    if (!this.attackHit && this.attackT > 0.22) {
      this.attackHit = true;
      this.enemy.hp = Math.max(0, this.enemy.hp - this.pendingDamage);
      this.enemy.flash = 0.55;
      if (this.pendingDamage > 0) {
        this.floaters.push({
          text: String(this.pendingDamage),
          x: 480 + G.rand(-20, 20), y: 130, t: 0, color: '#ffd23f'
        });
        if (this.enemy.hp <= 10 && this.enemy.mood !== 'happy') this.enemy.mood = 'scared';
      }
    }

    if (this.attackT > 0.95) {
      var self = this;
      if (this.enemy.hp <= 0) {
        this.killEnding();
        return;
      }
      this.state = 'msg';
      var d = this.pendingDamage;
      this.say([
        d > 0 ? '* 你造成了 ' + d + ' 点伤害。' : '* 你挥空了……'
      ], function () { self.enemyTurn(); });
    }
  };

  /* ---------------- 敌人回合 ---------------- */
  Battle.prototype.enemyTurn = function () {
    this.turn++;
    this.state = 'enemyturn';
    this.msg = null;
    this.turnTime = 0;
    this.turnDuration = 6.0 + Math.min(2.4, this.turn * 0.3);
    this.bullets = [];
    this.spawnTimer = 0.15;
    this.invuln = 0;
    this.soul.x = BOARD.x + BOARD.w / 2;
    this.soul.y = BOARD.y + BOARD.h / 2;
    this.pattern = (this.turn % 2 === 1) ? 'rain' : 'bounce';

    if (this.pattern === 'rain') {
      this.banner = '* 苔团散出了孢子！';
    } else {
      this.banner = '* 苔团弹来弹去！';
      var count = 3 + Math.min(3, Math.floor(this.turn / 2));
      for (var i = 0; i < count; i++) {
        var ang = G.rand(0, G.TAU);
        this.bullets.push({
          kind: 'ball',
          x: G.rand(BOARD.x + 42, BOARD.x + BOARD.w - 42),
          y: G.rand(BOARD.y + 42, BOARD.y + BOARD.h - 42),
          vx: Math.cos(ang) * 190,
          vy: Math.sin(ang) * 190,
          r: 9
        });
      }
    }
    G.audio.warn();
  };

  Battle.prototype.updateEnemyTurn = function (dt) {
    var self = this;
    this.turnTime += dt;
    this.invuln = Math.max(0, this.invuln - dt);

    /* 红心移动 */
    var speed = 168;
    var dx = 0, dy = 0;
    if (G.isDown('ArrowLeft')) dx -= 1;
    if (G.isDown('ArrowRight')) dx += 1;
    if (G.isDown('ArrowUp')) dy -= 1;
    if (G.isDown('ArrowDown')) dy += 1;
    if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
    this.soul.x = G.clamp(this.soul.x + dx * speed * dt, BOARD.x + 14, BOARD.x + BOARD.w - 14);
    this.soul.y = G.clamp(this.soul.y + dy * speed * dt, BOARD.y + 14, BOARD.y + BOARD.h - 14);

    /* 生成子弹 */
    if (this.pattern === 'rain') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = Math.max(0.2, 0.36 - this.turn * 0.02);
        this.bullets.push({
          kind: 'spore',
          x: G.rand(BOARD.x + 16, BOARD.x + BOARD.w - 16),
          y: BOARD.y + 8,
          vx: G.rand(-30, 30),
          vy: G.rand(150, 210 + this.turn * 8),
          r: 7
        });
      }
    }

    /* 子弹移动 */
    for (var i = 0; i < this.bullets.length; i++) {
      var b = this.bullets[i];
      if (b.kind === 'ball') {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < BOARD.x + b.r) { b.x = BOARD.x + b.r; b.vx = Math.abs(b.vx); }
        if (b.x > BOARD.x + BOARD.w - b.r) { b.x = BOARD.x + BOARD.w - b.r; b.vx = -Math.abs(b.vx); }
        if (b.y < BOARD.y + b.r) { b.y = BOARD.y + b.r; b.vy = Math.abs(b.vy); }
        if (b.y > BOARD.y + BOARD.h - b.r) { b.y = BOARD.y + BOARD.h - b.r; b.vy = -Math.abs(b.vy); }
      } else {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }
    }

    this.bullets = this.bullets.filter(function (b) {
      return b.y < BOARD.y + BOARD.h + 40 &&
             b.x > BOARD.x - 40 && b.x < BOARD.x + BOARD.w + 40;
    });

    /* 碰撞 */
    for (var j = 0; j < this.bullets.length; j++) {
      var bb = this.bullets[j];
      var ddx = bb.x - this.soul.x;
      var ddy = bb.y - this.soul.y;
      var rr = bb.r + 7;
      if (ddx * ddx + ddy * ddy < rr * rr) {
        if (this.invuln <= 0) {
          this.hurtPlayer(3);
        }
        break;
      }
    }

    if (this.player.hp <= 0) {
      this.die();
      return;
    }

    if (this.turnTime > this.turnDuration) {
      this.bullets = [];
      this.state = 'msg';
      this.say([
        this.player.hp <= 6 ? '* 苔团也累了，停了下来。' : '* 苔团停了下来，喘着气。'
      ], function () { self.toMenu(); });
    }
  };

  Battle.prototype.hurtPlayer = function (dmg) {
    if (this.invuln > 0) return;
    this.player.hp = Math.max(0, this.player.hp - dmg);
    this.invuln = 0.9;
    this.shake = 0.35;
    G.audio.hurt();
    this.floaters.push({
      text: '-' + dmg,
      x: this.soul.x + 16,
      y: this.soul.y - 18,
      t: 0,
      color: '#ff5d6c'
    });
  };

  Battle.prototype.die = function () {
    this.state = 'dead';
    this.deadTime = 0;
    this.msg = null;
    this.bullets = [];
    G.audio.hurt();
  };

  Battle.prototype.updateDead = function (dt) {
    this.deadTime += dt;
    if (this.deadTime > 0.8 && G.confirmPressed()) {
      G.audio.confirm();
      this.app.setScene(new Battle(this.app, this.opts));
    }
  };

  /* ---------------- 结局 ---------------- */
  Battle.prototype.spareEnding = function () {
    var self = this;
    this.enemy.mood = 'happy';
    G.audio.spare();
    this.state = 'msg';
    this.say([
      '* 你放下小木棍，朝它伸出手。',
      '* 苔团开心地蹭了蹭你的手。',
      '* 你获得了「苔藓徽章」。'
    ], function () { self.finish('spare'); });
  };

  Battle.prototype.killEnding = function () {
    var self = this;
    this.enemy.mood = 'dead';
    G.audio.hurt();
    this.state = 'msg';
    this.say([
      '* 苔团散成了孢子……',
      '* 洞窟里忽然变得很安静。'
    ], function () { self.finish('kill'); });
  };

  Battle.prototype.finish = function (result) {
    this.state = 'done';
    if (this.opts.onEnd) this.opts.onEnd(result);
  };

  /* ---------------- 绘制 ---------------- */
  Battle.prototype.draw = function (ctx) {
    var bg = ctx.createRadialGradient(480, 200, 60, 480, 300, 640);
    bg.addColorStop(0, '#130b20');
    bg.addColorStop(1, '#040209');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, G.W, G.H);

    ctx.save();
    if (this.shake > 0) {
      var m = this.shake / 0.35;
      ctx.translate(G.rand(-1, 1) * 7 * m, G.rand(-1, 1) * 5 * m);
    }

    this.drawEnemy(ctx);

    if (this.state === 'enemyturn') {
      this.drawBoard(ctx);
    } else {
      this.drawPanel(ctx);
    }
    this.drawHp(ctx);
    this.drawFloaters(ctx);
    ctx.restore();

    if (this.state === 'dead') this.drawDead(ctx);
  };

  Battle.prototype.drawEnemy = function (ctx) {
    var e = this.enemy;
    var dead = e.mood === 'dead';
    var flash = e.flash > 0 && Math.floor(this.t * 26) % 2 === 0;
    var bob = Math.sin(this.t * 1.7) * 3;

    ctx.save();
    ctx.translate(480, 176 + bob);

    /* 阴影 */
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 66, 62, 13, 0, 0, G.TAU);
    ctx.fill();

    if (dead) ctx.globalAlpha = 0.65;

    /* 身体 */
    var body = dead ? '#45443f' : (e.mood === 'happy' ? '#5f9a3c' : '#4e7d36');
    if (flash) body = '#ffffff';
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 62, 48, 0, 0, G.TAU);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = dead ? '#2a2926' : '#33522a';
    ctx.stroke();

    /* 头顶的苔藓团 */
    ctx.fillStyle = dead ? '#3c3b37' : '#6fa64f';
    var tufts = [[-42, -30, 10], [-14, -40, 11], [20, -36, 9], [44, -22, 9]];
    for (var i = 0; i < tufts.length; i++) {
      ctx.beginPath();
      ctx.arc(tufts[i][0], tufts[i][1], tufts[i][2], 0, G.TAU);
      ctx.fill();
    }

    /* 眼睛 */
    var ex = [-22, 22], ey = -12;
    if (dead) {
      ctx.strokeStyle = '#1b1b19';
      ctx.lineWidth = 4;
      for (var k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.moveTo(ex[k] - 6, ey - 6);
        ctx.lineTo(ex[k] + 6, ey + 6);
        ctx.moveTo(ex[k] + 6, ey - 6);
        ctx.lineTo(ex[k] - 6, ey + 6);
        ctx.stroke();
      }
    } else {
      for (var j = 0; j < 2; j++) {
        ctx.fillStyle = '#141a10';
        ctx.beginPath();
        ctx.arc(ex[j], ey, 7, 0, G.TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex[j] + 2, ey - 2, 2.4, 0, G.TAU);
        ctx.fill();
      }
    }

    /* 嘴 */
    ctx.strokeStyle = '#141a10';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (e.mood === 'happy') {
      ctx.arc(0, 16, 10, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else if (e.mood === 'scared') {
      ctx.arc(0, 20, 5, 0, G.TAU);
      ctx.stroke();
    } else if (!dead) {
      ctx.arc(0, 14, 8, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    }

    /* 害羞的红晕 */
    if (e.mood === 'happy') {
      ctx.fillStyle = 'rgba(255,120,120,0.35)';
      ctx.beginPath(); ctx.arc(-34, 6, 7, 0, G.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(34, 6, 7, 0, G.TAU); ctx.fill();
    }

    ctx.restore();

    /* 挥击白光 */
    if (this.state === 'attack' && this.attackT < 0.5) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,' + (1 - this.attackT / 0.5) + ')';
      ctx.lineWidth = 5;
      for (var a = 0; a < this.attackLines.length; a++) {
        var L = this.attackLines[a];
        ctx.beginPath();
        ctx.moveTo(L.x, L.y);
        ctx.lineTo(L.x + Math.cos(L.a) * L.len, L.y + Math.sin(L.a) * L.len);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  Battle.prototype.drawPanel = function (ctx) {
    G.panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h);

    switch (this.state) {
      case 'msg': this.drawMsg(ctx); break;
      case 'menu': this.drawMenu(ctx); break;
      case 'act': this.drawActMenu(ctx); break;
      case 'item': this.drawItemMenu(ctx); break;
      case 'mercy': this.drawMercyMenu(ctx); break;
      case 'fight': this.drawFight(ctx); break;
      case 'attack': this.drawAttack(ctx); break;
      default: break;
    }
  };

  Battle.prototype.drawMsg = function (ctx) {
    if (!this.msg) return;
    G.drawText(ctx, this.msg.visible, PANEL.x + 34, PANEL.y + 30, {
      size: 21, maxWidth: PANEL.w - 76, lineHeight: 34
    });
    if (this.msg.done) {
      this.drawPrompt(ctx);
    }
  };

  Battle.prototype.drawPrompt = function (ctx) {
    if (Math.floor(this.t * 2.5) % 2 !== 0) return;
    ctx.save();
    ctx.fillStyle = '#ffd23f';
    ctx.font = G.font(22, true);
    ctx.textAlign = 'right';
    ctx.fillText('▸', PANEL.x + PANEL.w - 36, PANEL.y + PANEL.h - 48);
    ctx.restore();
  };

  Battle.prototype.drawMenu = function (ctx) {
    G.drawText(ctx, this.banner, PANEL.x + 34, PANEL.y + 26, { size: 21 });

    var xs = [118, 314, 510, 706];
    var y = PANEL.y + 148;

    for (var i = 0; i < MENU.length; i++) {
      var selected = i === this.menuIndex;
      var color = selected ? '#ffd23f' : '#e9e3d5';

      if (selected) {
        G.drawHeart(ctx, xs[i] - 26, y + 12, 1.6, '#ff2b46');
      }

      this.drawMenuIcon(ctx, i, xs[i] - 2, y - 2, color);

      ctx.save();
      ctx.font = G.font(22, selected);
      ctx.fillStyle = color;
      ctx.textBaseline = 'top';
      ctx.fillText(MENU[i], xs[i] + 30, y);
      ctx.restore();
    }
  };

  Battle.prototype.drawMenuIcon = function (ctx, index, x, y, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    if (index === 0) {
      /* 小木棍 / 剑 */
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 20);
      ctx.lineTo(x + 18, y + 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 12);
      ctx.lineTo(x + 11, y + 19);
      ctx.stroke();
    } else if (index === 1) {
      /* 对话气泡 */
      ctx.strokeRect(x + 2, y + 3, 19, 14);
      ctx.beginPath();
      ctx.moveTo(x + 7, y + 17);
      ctx.lineTo(x + 6, y + 22);
      ctx.lineTo(x + 13, y + 17);
      ctx.fill();
    } else if (index === 2) {
      /* 背包 */
      ctx.strokeRect(x + 3, y + 8, 18, 13);
      ctx.beginPath();
      ctx.arc(x + 12, y + 8, 5, Math.PI, 0);
      ctx.stroke();
    } else {
      /* 爱心 */
      G.drawHeart(ctx, x + 12, y + 11, 1.6, color);
    }

    ctx.restore();
  };

  Battle.prototype.drawActMenu = function (ctx) {
    G.drawText(ctx, '* 你要怎么做？', PANEL.x + 34, PANEL.y + 22, { size: 21 });

    for (var i = 0; i < ACTS.length; i++) {
      var selected = i === this.actIndex;
      var y = PANEL.y + 66 + i * 38;
      if (selected) G.drawHeart(ctx, PANEL.x + 62, y + 12, 1.4, '#ff2b46');
      ctx.save();
      ctx.font = G.font(21, selected);
      ctx.fillStyle = selected ? '#ffd23f' : '#d8d2c5';
      ctx.textBaseline = 'top';
      ctx.fillText(ACTS[i].name, PANEL.x + 92, y + 2);
      ctx.restore();
    }

    ctx.save();
    ctx.font = G.font(18, false);
    ctx.fillStyle = '#9d9485';
    ctx.textBaseline = 'top';
    ctx.fillText(ACTS[this.actIndex].desc, PANEL.x + 360, PANEL.y + 66 + this.actIndex * 38 + 4);
    ctx.restore();

    G.drawText(ctx, 'X 返回', PANEL.x + PANEL.w - 100, PANEL.y + PANEL.h - 40, { size: 16, color: '#7d7568' });
  };

  Battle.prototype.drawItemMenu = function (ctx) {
    G.drawText(ctx, '* 背包', PANEL.x + 34, PANEL.y + 22, { size: 21 });

    var has = this.player.potions > 0;
    if (!has) {
      G.drawText(ctx, '* （空的。）', PANEL.x + 70, PANEL.y + 80, { size: 20, color: '#d8d2c5' });
    } else {
      var y = PANEL.y + 70;
      G.drawHeart(ctx, PANEL.x + 62, y + 12, 1.4, '#ff2b46');
      ctx.save();
      ctx.font = G.font(21, true);
      ctx.fillStyle = '#ffd23f';
      ctx.textBaseline = 'top';
      ctx.fillText('苔藓药水 ×' + this.player.potions, PANEL.x + 92, y + 2);
      ctx.restore();
      G.drawText(ctx, '恢复 10 HP。', PANEL.x + 380, y + 4, { size: 18, color: '#9d9485' });
    }

    G.drawText(ctx, 'X 返回', PANEL.x + PANEL.w - 100, PANEL.y + PANEL.h - 40, { size: 16, color: '#7d7568' });
  };

  Battle.prototype.drawMercyMenu = function (ctx) {
    G.drawText(ctx, '* 要放过它吗？', PANEL.x + 34, PANEL.y + 22, { size: 21 });

    var rows = ['饶恕', '逃跑'];
    for (var i = 0; i < rows.length; i++) {
      var selected = i === this.mercyIndex;
      var y = PANEL.y + 66 + i * 40;
      var enabled = i === 0 ? this.mercyReady : true;

      if (selected) G.drawHeart(ctx, PANEL.x + 62, y + 12, 1.4, '#ff2b46');
      ctx.save();
      ctx.font = G.font(21, selected);
      ctx.fillStyle = !enabled ? '#5d564c' : (selected ? '#ffd23f' : '#d8d2c5');
      ctx.textBaseline = 'top';
      ctx.fillText(rows[i], PANEL.x + 92, y + 2);
      ctx.restore();
    }

    if (!this.mercyReady) {
      G.drawText(ctx, '它还在害怕。先通过「行动」让它安心。', PANEL.x + 300, PANEL.y + 72, {
        size: 17, color: '#8d8477', maxWidth: 480
      });
    }

    G.drawText(ctx, 'X 返回', PANEL.x + PANEL.w - 100, PANEL.y + PANEL.h - 40, { size: 16, color: '#7d7568' });
  };

  Battle.prototype.drawFight = function (ctx) {
    G.drawText(ctx, '* 按 Z，让光标停在中间！', PANEL.x + 34, PANEL.y + 24, { size: 21 });

    var bx = PANEL.x + 180;
    var by = PANEL.y + 128;
    var bw = 488;
    var bh = 22;

    var grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    grad.addColorStop(0, '#7a1c1c');
    grad.addColorStop(0.32, '#3f6b1f');
    grad.addColorStop(0.5, '#7fd23f');
    grad.addColorStop(0.68, '#3f6b1f');
    grad.addColorStop(1, '#7a1c1c');

    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(bx, by, bw, bh);

    var mx = bx + this.marker * bw;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mx - 2, by - 8, 4, bh + 16);

    ctx.restore();

    G.drawText(ctx, '越靠近中央，伤害越高。', PANEL.x + 34, PANEL.y + 172, { size: 17, color: '#8d8477' });
  };

  Battle.prototype.drawAttack = function (ctx) {
    G.drawText(ctx, '* ……', PANEL.x + 34, PANEL.y + 30, { size: 21 });
  };

  Battle.prototype.drawBoard = function (ctx) {
    G.drawText(ctx, this.banner, 480, 278, { size: 20, align: 'center', color: '#e9e3d5' });
    G.panel(ctx, BOARD.x, BOARD.y, BOARD.w, BOARD.h, { r: 8, lineWidth: 4 });

    for (var i = 0; i < this.bullets.length; i++) {
      var b = this.bullets[i];
      if (b.kind === 'spore') {
        ctx.fillStyle = 'rgba(155,227,111,0.22)';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 5, 0, G.TAU); ctx.fill();
        ctx.fillStyle = '#9be36f';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, G.TAU); ctx.fill();
      } else {
        ctx.fillStyle = '#ffb3b3';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, G.TAU); ctx.fill();
        ctx.fillStyle = '#8a2b2b';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.5, 0, G.TAU); ctx.fill();
      }
    }

    if (this.invuln <= 0 || Math.floor(this.t * 14) % 2 === 0) {
      G.drawHeart(ctx, this.soul.x, this.soul.y, 2, '#ff2b46');
    }
  };

  Battle.prototype.drawHp = function (ctx) {
    var p = this.player;
    if (!p) return;

    ctx.save();
    ctx.font = G.font(18, true);
    ctx.fillStyle = '#f2ecdd';
    ctx.textBaseline = 'top';
    ctx.fillText('小光', 58, 540);
    ctx.font = G.font(15, false);
    ctx.fillStyle = '#9d9485';
    ctx.fillText('LV 1', 110, 544);

    var bx = 190, by = 541, bw = 160, bh = 18;
    ctx.fillStyle = '#3a1010';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(bx, by, bw * (p.hp / p.hpMax), bh);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);

    ctx.font = G.font(17, true);
    ctx.fillStyle = p.hp <= 6 ? '#ff6b76' : '#f2ecdd';
    ctx.fillText(p.hp + ' / ' + p.hpMax, bx + bw + 16, 541);
    ctx.restore();
  };

  Battle.prototype.drawFloaters = function (ctx) {
    for (var i = 0; i < this.floaters.length; i++) {
      var f = this.floaters[i];
      ctx.save();
      ctx.globalAlpha = G.clamp(1.2 - f.t, 0, 1);
      ctx.font = G.font(26, true);
      ctx.fillStyle = f.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  };

  Battle.prototype.drawDead = function (ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(20,0,4,0.82)';
    ctx.fillRect(0, 0, G.W, G.H);

    ctx.font = G.font(46, true);
    ctx.fillStyle = '#ff5d6c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('你倒下了。', 480, 200);

    ctx.font = G.font(20, false);
    ctx.fillStyle = '#d8d2c5';
    ctx.fillText('但你的决心，还没有消散。', 480, 280);

    if (this.deadTime > 0.8 && Math.floor(this.t * 2.5) % 2 === 0) {
      ctx.font = G.font(22, true);
      ctx.fillStyle = '#ffd23f';
      ctx.fillText('按 Z 再试一次', 480, 400);
    }
    ctx.restore();
  };

  G.Battle = Battle;
})();
