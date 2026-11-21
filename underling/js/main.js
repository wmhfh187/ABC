/* ============================================================
 * main.js — 启动与主循环
 * ============================================================ */
(function () {
  'use strict';
  var G = window.G;

  var app = {
    scene: null,
    setScene: function (s) {
      this.scene = s;
      if (s && s.enter) s.enter();
    }
  };
  G.app = app;

  function boot() {
    var canvas = document.getElementById('game');
    G.initCanvas(canvas);
    G.initInput();
    G.fitCanvas();
    window.addEventListener('resize', function () { G.fitCanvas(); });

    app.setScene(new G.TitleScene(app));

    var last = performance.now();

    function frame(now) {
      var dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;

      if (app.scene) app.scene.update(dt);

      var ctx = G.ctx;
      ctx.save();
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, G.W, G.H);
      if (app.scene) app.scene.draw(ctx);
      ctx.restore();

      G.clearPressed();
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener('load', boot);
})();
