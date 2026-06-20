// ── Calibration System ──
// Single shared Y axis (distance in meters) + per-section X calibration.

// Shared Y calibration (distance axis — applies to all sections)
const calY = { vals: [200, 300, 400, 500, 600, 700, 800, 900, 1000], pts: [], done: false };

// Per-section X calibration
const cal = {
  right:    { xVals: [800, 900, 1000], xPts: [], done: false },
  left:     { xVals: [-20, -10, 0, 10, 20, 30, 40], xPts: [], done: false },
  headwind: { xVals: [-10, 0, 10, 20], xPts: [], done: false },
  obstacle: { xVals: [0, 15], xPts: [], done: false },
};

const sectionMeta = {
  right:    { xUnit: 'kg', label: 'Gross Weight' },
  left:     { xUnit: '°C', label: 'Outside Air Temperature' },
  headwind: { xUnit: 'kt', label: 'Wind' },
  obstacle: { xUnit: 'm',  label: 'Obstacle Height' },
};

let calSide = null;
let calClickIndex = 0;
let calTotalClicks = 0;

// ── Y calibration UI ──

function renderYCalInputs() {
  const container = document.getElementById('cal-y-pts');
  if (!container) return;
  container.innerHTML = calY.vals.map((v, i) =>
    `<div class="cal-pt-row" id="cal-y-row-${i}">
      <input type="number" value="${v}" onchange="updateYCalVal(${i},this.value)">
      <span style="font-size:11px;color:#888">m</span>
      ${calY.vals.length > 2 ? `<button class="cal-pt-remove" onclick="removeYCalPt(${i})">✕</button>` : ''}
    </div>`
  ).join('') + `<button class="secondary cal-add-btn" onclick="addYCalPt()">+ Add</button>`;
}

function updateYCalVal(idx, val) { calY.vals[idx] = parseFloat(val); }

function addYCalPt() {
  const arr = calY.vals;
  const step = arr.length > 1 ? arr[arr.length - 1] - arr[arr.length - 2] : 100;
  arr.push(arr[arr.length - 1] + step);
  renderYCalInputs();
}

function removeYCalPt(idx) {
  if (calY.vals.length <= 2) return;
  calY.vals.splice(idx, 1);
  renderYCalInputs();
}

function startYCalibration() {
  calY.pts = [];
  calY.done = false;
  calSide = 'y';
  calClickIndex = 0;
  calTotalClicks = calY.vals.length;
  setMode('cal-y');
  highlightCalRow();
  setInfo(`Click Y point 1/${calY.vals.length} (${calY.vals[0]} m). Click on a horizontal grid line.`);
  redraw();
}

// ── Per-section X calibration UI ──

function renderCalInputs(side) {
  const c = cal[side];
  const meta = sectionMeta[side];
  const xContainer = document.getElementById(`cal-${side}-x-pts`);
  if (!xContainer) return;
  xContainer.innerHTML = c.xVals.map((v, i) =>
    `<div class="cal-pt-row" id="cal-${side}-row-${i}">
      <input type="number" value="${v}" onchange="updateCalVal('${side}','x',${i},this.value)">
      <span style="font-size:11px;color:#888">${meta.xUnit}</span>
      ${c.xVals.length > 2 ? `<button class="cal-pt-remove" onclick="removeCalPt('${side}','x',${i})">✕</button>` : ''}
    </div>`
  ).join('') + `<button class="secondary cal-add-btn" onclick="addCalPt('${side}','x')">+ Add</button>`;
}

function updateCalVal(side, axis, idx, val) {
  cal[side][axis + 'Vals'][idx] = parseFloat(val);
}

function addCalPt(side, axis) {
  const arr = cal[side][axis + 'Vals'];
  const step = arr.length > 1 ? arr[arr.length - 1] - arr[arr.length - 2] : 10;
  arr.push(arr[arr.length - 1] + step);
  renderCalInputs(side);
}

function removeCalPt(side, axis, idx) {
  const arr = cal[side][axis + 'Vals'];
  if (arr.length <= 2) return;
  arr.splice(idx, 1);
  renderCalInputs(side);
}

function startCalibration(side) {
  const c = cal[side];
  c.xPts = [];
  c.done = false;
  calSide = side;
  calClickIndex = 0;
  calTotalClicks = c.xVals.length;
  setMode('cal-' + side);
  highlightCalRow();

  const meta = sectionMeta[side];
  setInfo(`Click X point 1/${c.xVals.length} for ${meta.label} (${c.xVals[0]} ${meta.xUnit}).`);
  redraw();
}

function resetCalibration(side) {
  const c = cal[side];
  c.xPts = [];
  c.done = false;
  lines = lines.filter(l => l.side !== side);
  document.getElementById('cal-' + side + '-status').textContent = '';
  updateLineList();
  redraw();
  setInfo(`${sectionMeta[side].label} section reset.`);
}

function handleCalClick(px, py) {
  if (calSide === 'y') {
    // Shared Y calibration
    calY.pts.push({ py, val: calY.vals[calClickIndex] });
    calClickIndex++;
    if (calClickIndex < calY.vals.length) {
      highlightCalRow();
      setInfo(`Click Y point ${calClickIndex + 1}/${calY.vals.length} (${calY.vals[calClickIndex]} m).`);
    } else {
      calY.done = true;
      clearCalHighlight();
      document.getElementById('cal-y-status').textContent = '✓ Calibrated';
      setInfo(`Y axis calibrated (${calY.vals.length} points).`);
      setMode('idle');
    }
  } else {
    // Per-section X calibration
    const c = cal[calSide];
    const meta = sectionMeta[calSide];
    c.xPts.push({ px, py, val: c.xVals[calClickIndex] });
    calClickIndex++;
    if (calClickIndex < c.xVals.length) {
      highlightCalRow();
      setInfo(`Click X point ${calClickIndex + 1}/${c.xVals.length} for ${meta.label} (${c.xVals[calClickIndex]} ${meta.xUnit}).`);
    } else {
      c.done = true;
      clearCalHighlight();
      document.getElementById('cal-' + calSide + '-status').textContent = '✓ Calibrated';
      setInfo(`${meta.label} X calibrated (${c.xVals.length} points).`);
      // Auto-fill weights field from Gross Weight calibration
      if (calSide === 'right') {
        const weightsInput = document.getElementById('weights');
        if (weightsInput) {
          const sorted = [...c.xVals].sort((a, b) => a - b);
          weightsInput.value = sorted.join(',');
        }
      }
      setMode('idle');
    }
  }
  redraw();
}

function getCalClickHint() {
  if (calSide === 'y') {
    if (calClickIndex < calY.vals.length) {
      return `Y${calClickIndex + 1}/${calY.vals.length} = ${calY.vals[calClickIndex]} m`;
    }
  } else if (calSide && cal[calSide]) {
    const c = cal[calSide];
    const meta = sectionMeta[calSide];
    if (calClickIndex < c.xVals.length) {
      return `X${calClickIndex + 1}/${c.xVals.length} = ${c.xVals[calClickIndex]} ${meta.xUnit}`;
    }
  }
  return '';
}

// ── Calibration highlight ──

function highlightCalRow() {
  clearCalHighlight();
  const id = calSide === 'y'
    ? `cal-y-row-${calClickIndex}`
    : `cal-${calSide}-row-${calClickIndex}`;
  const el = document.getElementById(id);
  if (el) {
    el.style.background = '#665500';
    const input = el.querySelector('input');
    if (input) { input.style.background = '#ffdd00'; input.style.color = '#000'; }
  }
}

function clearCalHighlight() {
  document.querySelectorAll('.cal-pt-row').forEach(el => {
    el.style.background = '';
    const input = el.querySelector('input');
    if (input) { input.style.background = ''; input.style.color = ''; }
  });
}

// ── Piecewise linear interpolation ──

function piecewiseInterp(pts, px) {
  if (pts.length === 0) return 0;
  if (pts.length === 1) return pts[0].val;
  const sorted = [...pts].sort((a, b) => a.px - b.px);
  if (px <= sorted[0].px) {
    const t = (px - sorted[0].px) / (sorted[1].px - sorted[0].px);
    return sorted[0].val + t * (sorted[1].val - sorted[0].val);
  }
  if (px >= sorted[sorted.length - 1].px) {
    const n = sorted.length;
    const t = (px - sorted[n - 2].px) / (sorted[n - 1].px - sorted[n - 2].px);
    return sorted[n - 2].val + t * (sorted[n - 1].val - sorted[n - 2].val);
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    if (px >= sorted[i].px && px <= sorted[i + 1].px) {
      const t = (px - sorted[i].px) / (sorted[i + 1].px - sorted[i].px);
      return sorted[i].val + t * (sorted[i + 1].val - sorted[i].val);
    }
  }
  return sorted[0].val;
}

// Convert pixel Y → distance (meters) using shared Y calibration
function pyToDistance(py) {
  if (!calY.done) return 0;
  const sorted = [...calY.pts].sort((a, b) => a.py - b.py);
  return piecewiseInterp(sorted.map(p => ({ px: p.py, val: p.val })), py);
}

// Convert distance (meters) → pixel Y using shared Y calibration
function distanceToPy(dist) {
  if (!calY.done || calY.pts.length < 2) return 0;
  const sorted = [...calY.pts].sort((a, b) => a.val - b.val);
  if (dist <= sorted[0].val) {
    const t = (dist - sorted[0].val) / (sorted[1].val - sorted[0].val);
    return sorted[0].py + t * (sorted[1].py - sorted[0].py);
  }
  if (dist >= sorted[sorted.length - 1].val) {
    const n = sorted.length;
    const t = (dist - sorted[n - 2].val) / (sorted[n - 1].val - sorted[n - 2].val);
    return sorted[n - 2].py + t * (sorted[n - 1].py - sorted[n - 2].py);
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    if (dist >= sorted[i].val && dist <= sorted[i + 1].val) {
      const t = (dist - sorted[i].val) / (sorted[i + 1].val - sorted[i].val);
      return sorted[i].py + t * (sorted[i + 1].py - sorted[i].py);
    }
  }
  return sorted[0].py;
}

// Convert pixel X → real X value for a section
function pxToRealX(side, px) {
  const c = cal[side];
  if (!c.done) return 0;
  return piecewiseInterp(c.xPts, px);
}

// For backward compat and coordinate display
function pxToReal(side, px, py) {
  const c = cal[side];
  if (!c.done) return null;
  const xVal = piecewiseInterp(c.xPts, px);
  if (side === 'left') return { x: xVal, y: 0 };
  const yVal = pyToDistance(py);
  return { x: xVal, y: yVal };
}

// Inverse: real X value → pixel X
function realXToPx(side, xVal) {
  const c = cal[side];
  if (!c.done) return 0;
  const sorted = [...c.xPts].sort((a, b) => a.val - b.val);
  if (sorted.length < 2) return sorted[0]?.px || 0;
  if (xVal <= sorted[0].val) {
    const t = (xVal - sorted[0].val) / (sorted[1].val - sorted[0].val);
    return sorted[0].px + t * (sorted[1].px - sorted[0].px);
  }
  if (xVal >= sorted[sorted.length - 1].val) {
    const n = sorted.length;
    const t = (xVal - sorted[n - 2].val) / (sorted[n - 1].val - sorted[n - 2].val);
    return sorted[n - 2].px + t * (sorted[n - 1].px - sorted[n - 2].px);
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    if (xVal >= sorted[i].val && xVal <= sorted[i + 1].val) {
      const t = (xVal - sorted[i].val) / (sorted[i + 1].val - sorted[i].val);
      return sorted[i].px + t * (sorted[i + 1].px - sorted[i].px);
    }
  }
  return sorted[0].px;
}

// ── Drawing ──

const CAL_COLORS = {
  y: '#ff0', left: '#0ff', right: '#ff0', headwind: '#f0f', obstacle: '#0f0',
};

function drawCalPoints() {
  // Draw shared Y calibration lines
  if (calY.pts.length > 0) {
    calY.pts.forEach((p, i) => {
      ctx.beginPath();
      ctx.moveTo(0, p.py);
      ctx.lineTo(canvas.width, p.py);
      ctx.strokeStyle = 'rgba(255,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      drawCalDot(30, p.py, '#f00', `${calY.vals[i]}m`);
    });
  }
  // Draw per-section X calibration points
  for (const side of Object.keys(cal)) {
    const c = cal[side];
    const color = CAL_COLORS[side] || '#fff';
    c.xPts.forEach((p, i) => {
      drawCalDot(p.px, p.py, color, `X${i + 1}`);
    });
  }
}

function drawCalDot(px, py, color, label) {
  ctx.beginPath();
  ctx.arc(px, py, 6, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(label, px + 8, py - 4);
}

// Init UI on load
function initCalibrationUI() {
  renderYCalInputs();
  for (const side of Object.keys(cal)) renderCalInputs(side);
}
