// ── App State & Canvas ──

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const info = document.getElementById('info');
let img = null;
let imgName = '';
let scale = 1;
let mode = 'idle';

function setMode(m) { mode = m; }
function setInfo(msg) { info.textContent = msg; }

function getCalClickHint() {
  if (!mode.startsWith('cal-')) return '';
  const side = calSide;
  const c = cal[side];
  const xLen = c.xVals.length;
  const yLen = side === 'right' ? c.yVals.length : 0;
  const xUnit = side === 'left' ? '°C' : 'kg';
  if (calClickIndex < xLen) {
    return `X${calClickIndex + 1}/${xLen} = ${c.xVals[calClickIndex]} ${xUnit}`;
  } else if (calClickIndex - xLen < yLen) {
    const yi = calClickIndex - xLen;
    return `Y${yi + 1}/${yLen} = ${c.yVals[yi]} m`;
  }
  return '';
}

// ── Image loading ──
document.getElementById('fileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  imgName = file.name;
  const reader = new FileReader();
  reader.onload = ev => {
    img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      redraw();
      setInfo(`Image loaded: ${img.width}×${img.height}px. Calibrate the right side first.`);
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
  if (cal.left.done && mode === 'trace-left') {
    const r = pxToReal('left', px, py);
    if (r) extra = ` | ${r.x.toFixed(1)} °C`;
  }
  if (cal.right.done && mode === 'trace-right') {
    const r = pxToReal('right', px, py);
    if (r) extra = ` | ${r.x.toFixed(0)} kg, ${r.y.toFixed(0)} m`;
  }
  const hint = getCalClickHint();
  if (hint) {
    info.innerHTML = `Pixel: (${px.toFixed(0)}, ${py.toFixed(0)})${extra} &nbsp;—&nbsp; <span class="next-click">Next click: ${hint}</span>`;
  } else {
    info.textContent = `Pixel: (${px.toFixed(0)}, ${py.toFixed(0)})${extra}`;
  }
});

canvas.parentElement.addEventListener('wheel', e => {
  e.preventDefault();
  scale = Math.max(0.2, Math.min(5, scale * (e.deltaY > 0 ? 0.9 : 1.1)));
  canvas.style.transform = `scale(${scale})`;
  canvas.style.transformOrigin = 'top left';
});

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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  drawCalPoints();
  drawLines();
}

// ── Init ──
initCalibrationUI();
initTracingUI();
