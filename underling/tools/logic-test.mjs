/* 逻辑冒烟测试：在 Node 里用假 canvas/DOM 跑完整流程（不验证画面，只验证状态机） */
import fs from 'node:fs';
import vm from 'node:vm';

const ROOT = 'js/';
let now = 1000;

/* ---------- 假 DOM ---------- */
const listeners = {};
globalThis.window = globalThis;
globalThis.innerWidth = 1200;
globalThis.innerHeight = 800;
globalThis.devicePixelRatio = 1;
globalThis.addEventListener = (t, fn) => { (listeners[t] ||= []).push(fn); };
globalThis.removeEventListener = () => {};
function fire(type, ev) { (listeners[type] || []).forEach(fn => fn(ev)); }

function makeCtx() {
  const grad = () => ({ addColorStop() {} });
  const methods = {
    save() {}, restore() {}, setTransform() {}, resetTransform() {}, translate() {}, rotate() {}, scale() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, arcTo() {}, ellipse() {}, rect() {}, roundRect() {},
    quadraticCurveTo() {}, bezierCurveTo() {},
    fill() {}, stroke() {}, clip() {},
    fillRect() {}, strokeRect() {}, clearRect() {},
    fillText() {}, strokeText() {}, setLineDash() {},
    drawImage() {}, putImageData() {}, getImageData() { return { data: [] }; },
    createLinearGradient: grad, createRadialGradient: grad, createPattern() { return {}; },
    measureText(t) { return { width: String(t).length * 12 }; }
  };
  const base = {
    globalAlpha: 1, lineWidth: 1, font: '', textAlign: 'start', textBaseline: 'alphabetic',
    fillStyle: '#000', strokeStyle: '#000', shadowBlur: 0, shadowColor: '', imageSmoothingEnabled: true, canvas: null
  };
  return new Proxy(base, {
    get(t, p) {
      // 未建模的画布 API 直接返回 undefined：一旦绘制代码写错方法名，测试会抛错，
      // 而不是被静默吞掉。
      if (p in methods) return methods[p];
      return t[p];
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

const canvas = {
  width: 0, height: 0, style: {},
  getContext: () => ctx,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 800 }),
  addEventListener() {}
};
const ctx = makeCtx();
ctx.canvas = canvas;
globalThis.document = {
  getElementById: () => canvas,
  querySelector: () => canvas,
  body: { appendChild() {} },
  addEventListener: globalThis.addEventListener
};

/* 帧调度：手动推进 */
let rafCb = null;
globalThis.requestAnimationFrame = (fn) => { rafCb = fn; return 1; };
globalThis.cancelAnimationFrame = () => {};

Object.defineProperty(globalThis, 'performance', { value: { now: () => now }, configurable: true });

/* ---------- 载入游戏脚本 ---------- */
for (const f of ['core.js', 'battle.js', 'scenes.js', 'main.js']) {
  vm.runInThisContext(fs.readFileSync(ROOT + f, 'utf8'), { filename: f });
}

/* ---------- 驱动 ---------- */
function step(ms = 16) {
  if (!rafCb) throw new Error('没有待执行的帧回调');
  const fn = rafCb; rafCb = null;
  now += ms;
  fn(now);
}
function run(seconds) { const n = Math.round(seconds * 1000 / 16); for (let i = 0; i < n; i++) step(16); }
// 按住方向键：down 保持到 up
function hold(code, seconds) { fire('keydown', { code, key: code, repeat: false, preventDefault() {} }); run(seconds); fire('keyup', { code, key: code }); }
function press(code = 'KeyZ') {
  fire('keydown', { code, key: code, repeat: false, preventDefault() {} });
  step(16);
  fire('keyup', { code, key: code });
}
function pressUntil(pred, max = 40, code = 'KeyZ') {
  for (let i = 0; i < max; i++) { press(code); if (pred()) return true; }
  return false;
}
function sceneName() { return G.app.scene && G.app.scene.constructor.name; }

const fails = [];
function check(label, cond, extra = '') {
  if (cond) console.log('  PASS', label, extra);
  else { console.log('  FAIL', label, extra); fails.push(label); }
}

/* 启动 */
fire('load');
run(0.2);

check('启动场景为 TitleScene', sceneName() === 'TitleScene', sceneName());

/* 标题 → 世界 */
press('KeyZ'); run(0.1);
check('按 Z 进入 WorldScene', sceneName() === 'WorldScene', sceneName());

/* 关掉开场对话 */
const closed = pressUntil(() => !G.app.scene.dialog, 12);
check('开场对话可关闭', closed);
run(0.1);

/* 走到苔团旁 */
hold('ArrowRight', 2.4);
const w = G.app.scene;
check('玩家接近苔团', w.nearNpc === true, 'x=' + Math.round(w.player.x));

/* 进入战斗 */
press('KeyZ'); run(0.2);
check('进入 Battle', sceneName() === 'Battle', sceneName());
let b = G.app.scene;
check('战斗初始为 msg', b.state === 'msg', b.state);

/* 读完战斗开场，到主菜单 */
const menu = pressUntil(() => b.state === 'menu', 20);
check('开场读完进入菜单', menu, b.state);

/* 行动 → 安慰 */
press('ArrowRight');
check('菜单选到行动', b.menuIndex === 1, 'index=' + b.menuIndex);
press('KeyZ');
check('进入行动列表', b.state === 'act', b.state);
press('ArrowDown');
check('行动选到安慰', b.actIndex === 1, 'actIndex=' + b.actIndex);
press('KeyZ');
check('第一次安慰后 mercy=1', pressUntil(() => b.state === 'enemyturn', 20) && b.mercy === 1, 'state=' + b.state + ' mercy=' + b.mercy);

/* 敌人回合：躲 7 秒 */
run(7.0);
check('敌人回合结束进入消息', b.state === 'msg' || b.state === 'menu', b.state);
pressUntil(() => b.state === 'menu', 10);
check('回到菜单', b.state === 'menu', b.state + ' hp=' + b.player.hp);

/* 第二次安慰 → 解锁饶恕 */
press('ArrowRight');
press('KeyZ');
press('ArrowDown');
press('KeyZ');
const second = pressUntil(() => b.state === 'enemyturn', 30);
check('第二次安慰解锁饶恕', second && b.mercyReady === true, 'state=' + b.state + ' ready=' + b.mercyReady);

/* 敌人回合 2 */
run(7.5);
pressUntil(() => b.state === 'menu', 10);
check('回到菜单（第二轮）', b.state === 'menu', b.state + ' hp=' + b.player.hp);

/* 菜单 → 饶恕 → 饶恕 */
press('ArrowRight'); press('ArrowRight'); press('ArrowRight');
check('菜单选到饶恕', b.menuIndex === 3, 'index=' + b.menuIndex);
press('KeyZ');
check('进入饶恕列表', b.state === 'mercy', b.state);
press('KeyZ');
check('触发饶恕结局', pressUntil(() => sceneName() === 'EndingScene', 30), sceneName());
check('结局为 spare', G.app.scene.result === 'spare', G.app.scene.result);

/* 结局 → 标题 */
const back = pressUntil(() => sceneName() === 'TitleScene', 40);
check('结局可回到标题', back, sceneName());

/* ---------- 第二轮：战斗击杀 / 物品 / 逃跑 / 死亡重试 ---------- */
function enterBattle() {
  press('KeyZ'); run(0.1);            // 标题 → 世界
  pressUntil(() => !G.app.scene.dialog, 12); // 关掉开场对话
  hold('ArrowRight', 2.4);
  press('KeyZ'); run(0.2);            // 触发战斗
  return pressUntil(() => G.app.scene.state === 'menu', 20);
}
function attackOnce(b) {
  press('KeyZ');        // 菜单选「战斗」
  run(0.55);            // 判定条走到中间
  press('KeyZ');        // 停住光标
  run(1.0);             // 攻击动画
  pressUntil(() => b.state === 'enemyturn', 8);
}
function skipEnemyTurn(b) {
  if (b.state !== 'enemyturn') return;
  b.turnTime = b.turnDuration + 0.01;
  run(0.05);
  pressUntil(() => b.state === 'menu', 8);
}

check('第二轮进入战斗', enterBattle(), sceneName());
b = G.app.scene;
attackOnce(b);
check('FIGHT 造成伤害', b.enemy.hp < 30, 'enemyHp=' + b.enemy.hp);
skipEnemyTurn(b);
check('跳过敌人回合回到菜单', b.state === 'menu', b.state);

/* 物品：先受伤再喝药 */
b.player.hp = 9; b.state = 'menu'; b.menuIndex = 0;
press('ArrowRight'); press('ArrowRight');
check('菜单选到物品', b.menuIndex === 2, 'index=' + b.menuIndex);
press('KeyZ');
check('进入物品列表', b.state === 'item', b.state);
press('KeyZ');
const healed = pressUntil(() => b.state === 'enemyturn', 10);
check('药水治疗生效', healed && b.player.hp === 19 && b.player.potions === 1,
  'hp=' + b.player.hp + ' potions=' + b.player.potions);
skipEnemyTurn(b);

/* 击杀路线：把敌人打到 2 血，再一击收尾 */
b.state = 'menu'; b.menuIndex = 0;
b.enemy.hp = 2;
attackOnce(b);
check('击杀触发 kill 结局', pressUntil(() => sceneName() === 'EndingScene', 30) &&
  G.app.scene.result === 'kill', sceneName() + '/' + G.app.scene.result);
check('击杀结局可回标题', pressUntil(() => sceneName() === 'TitleScene', 40), sceneName());

/* 逃跑路线 */
check('第三轮进入战斗', enterBattle(), sceneName());
b = G.app.scene;
b.menuIndex = 0; b.state = 'menu';
press('ArrowRight'); press('ArrowRight'); press('ArrowRight');
press('KeyZ');            // 饶恕列表
press('ArrowDown');       // 选「放过我」
press('KeyZ');            // 确认逃跑
const fled = pressUntil(() => sceneName() === 'WorldScene', 10);
check('逃跑回到世界', fled, sceneName());
check('逃跑后苔团还活着', G.app.scene.npc.alive === true);
pressUntil(() => !G.app.scene.dialog, 10);

/* 死亡与重试 */
press('KeyZ'); run(0.2);
b = G.app.scene;
check('再次进入战斗', sceneName() === 'Battle', sceneName());
pressUntil(() => b.state === 'menu', 20);
b.player.hp = 1;
attackOnce(b);            // 攻击后进入敌人回合
b.bullets = [{ kind: 'spore', x: b.soul.x, y: b.soul.y, vx: 0, vy: 0, r: 7 }];
run(0.05);
check('中弹后进入死亡状态', b.state === 'dead', 'state=' + b.state + ' hp=' + b.player.hp);
run(1.0);
press('KeyZ');
check('死亡后按 Z 重开战斗', sceneName() === 'Battle' && G.app.scene.player.hp === 20,
  sceneName() + ' hp=' + G.app.scene.player.hp);

console.log('\n结果：' + (fails.length ? '失败 ' + fails.length + ' 项 → ' + fails.join(' / ') : '全部通过'));
process.exit(fails.length ? 1 : 0);
