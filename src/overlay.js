const canvas = document.getElementById('crosshair');
const ctx = canvas.getContext('2d');
let settings = null;
let width = 0;
let height = 0;
let startedAt = performance.now();

function resize() {
  const ratio = window.devicePixelRatio || 1;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function render(now) {
  ctx.clearRect(0, 0, width, height);
  if (settings && settings.overlayEnabled) {
    ctx.save();
    ctx.translate(
      width / 2 + width * (Number(settings.positionX) || 0) / 100,
      height / 2 + height * (Number(settings.positionY) || 0) / 100
    );
    CrosshairCore.draw(ctx, settings, (now - startedAt) / 1000);
    ctx.restore();
  }
  requestAnimationFrame(render);
}

window.addEventListener('resize', resize);
window.crosshairApp.onSettings((nextSettings) => { settings = nextSettings; });
resize();
requestAnimationFrame(render);
