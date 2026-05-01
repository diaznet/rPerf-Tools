// ── Multi-point Calibration System ──
// Each axis has N reference points (value + pixel). Piecewise linear interpolation.

const cal = {
  right: { xVals: [800, 900, 1000], yVals: [0, 1000], xPts: [], yPts: [], done: false },
  left:  { xVals: [-20, -10, 0, 10, 20, 30, 40], xPts: [], done: false },
};

let calSide = null;
let calClickIndex = 0;
let calTotalClicks = 0;

function renderCalInputs(side) {
  const c = cal[side];
  const prefix = side[0];
  const xUnit = side === 'left' ? '°C' : 'kg';

  // X points
  const xContainer = document.getElementById(`${prefix}-cal-x-pts`);
  xContainer.innerHTML = c.xVals.map((v, i) =>
    `<div class="cal-pt-row">
      <input type="number" value="${v}" onchange="updateCalVal('${side}','x',${i},this.value)">
      <span style="font-size:11px;color:#888">${xUnit}</span>
      ${c.xVals.length > 2 ? `<button class="cal-pt-remove" onclick="removeCalPt('${side}','x',${i})">✕</button>` : ''}
    </div>`
  ).join('') + `<button class="secondary cal-add-btn" onclick="addCalPt('${side}','x')">+ Add</button>`;

  // Y points (right side only)
  if (side === 'right') {
    const yContainer = document.getElementById('r-cal-y-pts');
    yContainer.innerHTML = c.yVals.map((v, i) =>
      `<div class="cal-pt-row">
        <input type="number" value="${v}" onchange="updateCalVal('${side}','y',${i},this.value)">
        <span style="font-size:11px;color:#888">m</span>
        ${c.yVals.length > 2 ? `<button class="cal-pt-remove" onclick="removeCalPt('${side}','y',${i})">✕</button>` : ''}
      </div>`
    ).join('') + `<button class="secondary cal-add-btn" onclick="addCalPt('${side}','y')">+ Add</button>`;
  }
}

function updateCalVal(side, axis, idx, val) {
  cal[side][axis + 'Vals'][idx] = parseFloat(val);
}

function addCalPt(side, axis) {
  const arr = cal[side][axis + 'Vals'];
  const last = arr[arr.length - 1];
  const step = arr.length > 1 ? arr[arr.length - 1] - arr[arr.length - 2] : 10;
  arr.push(last + step);
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
  if (side === 'right') c.yPts = [];
  c.done = false;
  calSide = side;
  calClickIndex = 0;
  calTotalClicks = c.xVals.length + (side === 'right' ? c.yVals.length : 0);
  setMode('cal-' + side);

  const xUnit = side === 'left' ? '°C' : 'kg';
  setInfo(`Click X point 1/${c.xVals.length} for ${side} calibration (${c.xVals[0]} ${xUnit}).`);
  redraw();
}

function handleCalClick(px, py) {
  const c = cal[calSide];
  const xLen = c.xVals.length;
  const yLen = calSide === 'right' ? c.yVals.length : 0;
  const xUnit = calSide === 'left' ? '°C' : 'kg';

  if (calClickIndex < xLen) {
    c.xPts.push({ px, py, val: c.xVals[calClickIndex] });
    calClickIndex++;
    if (calClickIndex < xLen) {
      setInfo(`Click X point ${calClickIndex + 1}/${xLen} for ${calSide} (${c.xVals[calClickIndex]} ${xUnit}).`);
    } else if (yLen > 0) {
      setInfo(`Click Y point 1/${yLen} for ${calSide} (${c.yVals[0]} m).`);
    } else {
      finishCalibration(c, xLen, yLen);
    }
  } else {
    const yIdx = calClickIndex - xLen;
    c.yPts.push({ px, py, val: c.yVals[yIdx] });
    calClickIndex++;
    const nextYIdx = calClickIndex - xLen;
    if (nextYIdx < yLen) {
      setInfo(`Click Y point ${nextYIdx + 1}/${yLen} for ${calSide} (${c.yVals[nextYIdx]} m).`);
    } else {
      finishCalibration(c, xLen, yLen);
    }
  }
  redraw();
}

function finishCalibration(c, xLen, yLen) {
  c.done = true;
  document.getElementById('cal-' + calSide + '-status').textContent = '✓ Calibrated';
  const yMsg = yLen > 0 ? ` + ${yLen} Y` : '';
  setInfo(`${calSide} side calibrated (${xLen} X${yMsg} points).`);
  setMode('idle');
}

// Piecewise linear interpolation: pixel → real value
function piecewiseInterp(pts, px) {
  if (pts.length === 0) return 0;
  if (pts.length === 1) return pts[0].val;
  const sorted = [...pts].sort((a, b) => a.px - b.px);
  if (px <= sorted[0].px) {
    // Extrapolate from first two
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

function pxToReal(side, px, py) {
  const c = cal[side];
  if (!c.done) return null;
  const xVal = piecewiseInterp(c.xPts, px);
  if (side === 'left') return { x: xVal, y: 0 };
  // Right side: Y uses distance calibration
  const yPtsByPy = [...c.yPts].sort((a, b) => a.py - b.py);
  const yVal = piecewiseInterp(yPtsByPy.map(p => ({ px: p.py, val: p.val })), py);
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

function drawCalPoints() {
  for (const side of ['left', 'right']) {
    const c = cal[side];
    const color = side === 'left' ? '#0ff' : '#ff0';
    c.xPts.forEach((p, i) => {
      drawCalDot(p.px, p.py, color, `X${i + 1}`);
    });
    if (c.yPts) c.yPts.forEach((p, i) => {
      drawCalDot(p.px, p.py, color, `Y${i + 1}`);
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
  renderCalInputs('right');
  renderCalInputs('left');
}
