// ── App State & Canvas ──

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const info = document.getElementById('info');
let img = null;
let imgName = '';
let scale = 1;
let rotation = 0; // degrees, fine-grained (0.01° steps)
let showCrosshair = false;
let crosshairWidth = 2;
let magnifierActive = false;
const MAGNIFIER_RADIUS = 80; // px on screen
const MAGNIFIER_ZOOM = 3;    // zoom factor inside the loupe
let mode = 'idle';

function setMode(m) { mode = m; }
function setInfo(msg) { info.textContent = msg; }

// ── Image loading ──
function applyRotation(angle) {
  rotation = angle;
  document.getElementById('rotation-val').value = angle.toFixed(2);
  if (img) redraw();
}

function toggleCrosshair() {
  showCrosshair = !showCrosshair;
  const btn = document.getElementById('crosshair-btn');
  btn.textContent = 'Crosshair';
  btn.style.background = showCrosshair ? '#2ecc40' : '';
  btn.style.color = showCrosshair ? '#000' : '';
  if (!showCrosshair && img) redraw();
}

document.getElementById('fileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  imgName = file.name;
  const reader = new FileReader();
  reader.onload = ev => {
    img = new Image();
    img.onload = () => {
      redraw();
      setInfo(`Image loaded: ${img.width}×${img.height}px. Adjust rotation if needed, then calibrate.`);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

// ── Canvas events ──
canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const px = (e.clientX - rect.left) / scale;
  const py = (e.clientY - rect.top) / scale;
  if (mode.startsWith('cal-')) handleCalClick(px, py);
  else if (mode.startsWith('trace-')) handleTraceClick(px, py);
});

canvas.addEventListener('mousemove', e => {
  if (!img) return;
  const rect = canvas.getBoundingClientRect();
  const px = (e.clientX - rect.left) / scale;
  const py = (e.clientY - rect.top) / scale;
  let extra = '';

  // Draw crosshair guide lines
  if (showCrosshair) {
    redraw();
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = crosshairWidth;
    ctx.setLineDash([6, 4]);
    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(canvas.width, py);
    ctx.stroke();
    // Vertical line
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, canvas.height);
    ctx.stroke();
    ctx.restore();
  }

  // Show real-world coordinates for the active tracing/calibration section
  const activeSide = mode.replace('trace-', '').replace('cal-', '');
  if (activeSide === 'left' && cal.left.done) {
    const xVal = pxToRealX('left', px);
    extra = ` | ${xVal.toFixed(1)} °C`;
  } else if (activeSide === 'y') {
    if (calY.done) extra = ` | ${pyToDistance(py).toFixed(0)} m`;
  } else if (cal[activeSide]?.done) {
    const xVal = pxToRealX(activeSide, px);
    const meta = sectionMeta[activeSide];
    const yVal = calY.done ? pyToDistance(py) : 0;
    extra = ` | ${xVal.toFixed(1)} ${meta.xUnit}, ${yVal.toFixed(0)} m`;
  }

  const hint = getCalClickHint();
  if (hint) {
    info.innerHTML = `Pixel: (${px.toFixed(0)}, ${py.toFixed(0)})${extra} &nbsp;—&nbsp; <span class="next-click">Next click: ${hint}</span>`;
  } else {
    info.textContent = `Pixel: (${px.toFixed(0)}, ${py.toFixed(0)})${extra}`;
  }

  // Magnifier
  drawMagnifier(e.clientX, e.clientY, px, py);
});

canvas.addEventListener('mouseleave', () => {
  if (showCrosshair && img) redraw();
  magnifierOverlay.style.display = 'none';
});

// ── Magnifier (hold Z) ──
const magnifierOverlay = document.createElement('canvas');
magnifierOverlay.id = 'magnifier';
magnifierOverlay.width = MAGNIFIER_RADIUS * 2;
magnifierOverlay.height = MAGNIFIER_RADIUS * 2;
magnifierOverlay.style.cssText = 'position:fixed;pointer-events:none;border-radius:50%;border:2px solid #0ff;display:none;z-index:9999;box-shadow:0 0 8px rgba(0,255,255,0.5);';
document.body.appendChild(magnifierOverlay);

document.addEventListener('keydown', e => {
  if (e.key === 'z' || e.key === 'Z') magnifierActive = true;
});
document.addEventListener('keyup', e => {
  if (e.key === 'z' || e.key === 'Z') {
    magnifierActive = false;
    magnifierOverlay.style.display = 'none';
  }
});

function drawMagnifier(clientX, clientY, canvasPx, canvasPy) {
  if (!magnifierActive || !img) { magnifierOverlay.style.display = 'none'; return; }
  magnifierOverlay.style.display = 'block';
  magnifierOverlay.style.left = (clientX - MAGNIFIER_RADIUS) + 'px';
  magnifierOverlay.style.top = (clientY - MAGNIFIER_RADIUS) + 'px';

  const mctx = magnifierOverlay.getContext('2d');
  const r = MAGNIFIER_RADIUS;
  mctx.clearRect(0, 0, r * 2, r * 2);
  mctx.save();
  mctx.beginPath();
  mctx.arc(r, r, r, 0, Math.PI * 2);
  mctx.clip();

  // Draw the zoomed portion of the main canvas
  const srcSize = (r * 2) / MAGNIFIER_ZOOM;
  mctx.drawImage(canvas,
    canvasPx - srcSize / 2, canvasPy - srcSize / 2, srcSize, srcSize,
    0, 0, r * 2, r * 2
  );

  // Draw center crosshair
  mctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
  mctx.lineWidth = 1;
  mctx.beginPath();
  mctx.moveTo(r - 10, r); mctx.lineTo(r + 10, r);
  mctx.moveTo(r, r - 10); mctx.lineTo(r, r + 10);
  mctx.stroke();

  mctx.restore();
}

canvas.parentElement.addEventListener('wheel', e => {
  if (!e.ctrlKey) return; // Plain scroll = normal scroll; Ctrl+scroll = zoom
  e.preventDefault();
  const wrap = canvas.parentElement;
  const rect = wrap.getBoundingClientRect();
  const mx = e.clientX - rect.left + wrap.scrollLeft;
  const my = e.clientY - rect.top + wrap.scrollTop;
  const oldScale = scale;
  scale = Math.max(0.2, Math.min(5, scale * (e.deltaY > 0 ? 0.9 : 1.1)));
  canvas.style.width = (canvas.width * scale) + 'px';
  canvas.style.height = (canvas.height * scale) + 'px';
  // Keep the point under cursor stable
  const ratio = scale / oldScale;
  wrap.scrollLeft = mx * ratio - (e.clientX - rect.left);
  wrap.scrollTop = my * ratio - (e.clientY - rect.top);
}, { passive: false });

// ── Resize handle ──
const sidebar = document.getElementById('sidebar');
const resizeHandle = document.getElementById('resize-handle');
let resizing = false;

resizeHandle.addEventListener('mousedown', e => {
  resizing = true;
  resizeHandle.classList.add('dragging');
  e.preventDefault();
});

document.addEventListener('mousemove', e => {
  if (!resizing) return;
  const w = Math.min(600, Math.max(260, e.clientX));
  sidebar.style.width = w + 'px';
  info.style.left = (w + 5) + 'px';
});

document.addEventListener('mouseup', () => {
  if (resizing) {
    resizing = false;
    resizeHandle.classList.remove('dragging');
  }
});

// ── Drawing ──
function redraw() {
  if (!img) return;
  const rad = rotation * Math.PI / 180;
  const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
  const newW = Math.ceil(img.width * cos + img.height * sin);
  const newH = Math.ceil(img.height * cos + img.width * sin);
  canvas.width = newW;
  canvas.height = newH;
  ctx.clearRect(0, 0, newW, newH);
  ctx.save();
  ctx.translate(newW / 2, newH / 2);
  ctx.rotate(rad);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();
  drawCalPoints();
  drawLines();
  // Update CSS size for zoom
  canvas.style.width = (newW * scale) + 'px';
  canvas.style.height = (newH * scale) + 'px';
}

// ── Init ──
initCalibrationUI();
initTracingUI();
