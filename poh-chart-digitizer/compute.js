// ── Interpolation Helpers ──

// Left line: given a temperature, return the pixel Y on that altitude line
function leftLinePyAtTemp(line, tempC) {
  const realPts = line.points.map(p => {
    const r = pxToReal('left', p.px, p.py);
    return { temp: r.x, py: p.py };
  }).sort((a, b) => a.temp - b.temp);

  if (tempC <= realPts[0].temp) return realPts[0].py;
  if (tempC >= realPts[realPts.length - 1].temp) return realPts[realPts.length - 1].py;
  for (let i = 0; i < realPts.length - 1; i++) {
    if (tempC >= realPts[i].temp && tempC <= realPts[i + 1].temp) {
      const t = (tempC - realPts[i].temp) / (realPts[i + 1].temp - realPts[i].temp);
      return realPts[i].py + t * (realPts[i + 1].py - realPts[i].py);
    }
  }
  return realPts[0].py;
}

// Given a reference curve and a pixel X, return the pixel Y on that curve
// Curves are traced top-to-bottom, so we sort by px (left to right)
function curvePyAtPx(curve, targetPx) {
  const pts = [...curve.points].sort((a, b) => a.px - b.px);
  if (targetPx <= pts[0].px) return pts[0].py;
  if (targetPx >= pts[pts.length - 1].px) return pts[pts.length - 1].py;
  for (let i = 0; i < pts.length - 1; i++) {
    if (targetPx >= pts[i].px && targetPx <= pts[i + 1].px) {
      const t = (targetPx - pts[i].px) / (pts[i + 1].px - pts[i].px);
      return pts[i].py + t * (pts[i + 1].py - pts[i].py);
    }
  }
  return pts[0].py;
}

// Right side interpolation: given reference curves and a crossover pixel Y,
// follow the curves from entryPx to targetPx and return the resulting pixel Y.
//
// Algorithm:
// 1. At entryPx, compute each curve's pixel Y → sort curves by their Y at entry
// 2. Find where crossoverPy sits between curves → fractional position f
// 3. At targetPx, compute each curve's pixel Y
// 4. Interpolate at the same fractional position f → result pixel Y
function rightSideFollowCurves(refCurves, crossoverPy, entryPx, targetPx) {
  if (refCurves.length === 0) return crossoverPy;

  // Get each curve's Y at the entry X and at the target X
  const atEntry = refCurves.map(c => curvePyAtPx(c, entryPx)).sort((a, b) => a - b);
  const atTarget = refCurves.map((c, i) => ({ idx: i, py: curvePyAtPx(c, targetPx) }));

  // Sort curves by their Y at entry (top to bottom in pixel space)
  const order = refCurves.map((c, i) => ({ idx: i, entryPy: curvePyAtPx(c, entryPx) }))
    .sort((a, b) => a.entryPy - b.entryPy);

  const sortedEntryPy = order.map(o => o.entryPy);
  const sortedTargetPy = order.map(o => curvePyAtPx(refCurves[o.idx], targetPx));

  // Find fractional position of crossoverPy between curves at entry
  // Extrapolate if outside the range
  if (sortedEntryPy.length === 1) {
    // Single curve: offset from it
    const delta = crossoverPy - sortedEntryPy[0];
    return sortedTargetPy[0] + delta;
  }

  // Find bracketing pair
  for (let i = 0; i < sortedEntryPy.length - 1; i++) {
    const yA = sortedEntryPy[i], yB = sortedEntryPy[i + 1];
    if (crossoverPy >= yA && crossoverPy <= yB) {
      const f = (yB === yA) ? 0 : (crossoverPy - yA) / (yB - yA);
      return sortedTargetPy[i] + f * (sortedTargetPy[i + 1] - sortedTargetPy[i]);
    }
  }

  // Extrapolate above first curve
  if (crossoverPy < sortedEntryPy[0]) {
    const yA = sortedEntryPy[0], yB = sortedEntryPy[1];
    const f = (yB === yA) ? 0 : (crossoverPy - yA) / (yB - yA);
    return sortedTargetPy[0] + f * (sortedTargetPy[1] - sortedTargetPy[0]);
  }

  // Extrapolate below last curve
  const n = sortedEntryPy.length;
  const yA = sortedEntryPy[n - 2], yB = sortedEntryPy[n - 1];
  const f = (yB === yA) ? 0 : (crossoverPy - yA) / (yB - yA);
  return sortedTargetPy[n - 2] + f * (sortedTargetPy[n - 1] - sortedTargetPy[n - 2]);
}

// ── Compute Grid ──
let gridData = [];

function computeGrid() {
  const leftLines = lines.filter(l => l.side === 'left');
  const refCurves = lines.filter(l => l.side === 'right');

  if (leftLines.length === 0 || refCurves.length === 0) {
    setInfo('Need altitude lines on left and reference curves on right.'); return;
  }
  if (!cal.left.done || !cal.right.done) {
    setInfo('Both sides must be calibrated first.'); return;
  }

  const weights = document.getElementById('weights').value.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
  if (weights.length === 0) { setInfo('Enter at least one weight.'); return; }

  gridData = [];
  const tFrom = parseFloat(document.getElementById('temp-from').value) || -20;
  const tTo = parseFloat(document.getElementById('temp-to').value) || 40;
  const tStep = parseFloat(document.getElementById('temp-step').value) || 5;
  if (tStep <= 0) { setInfo('Temperature step must be positive.'); return; }
  const temps = [];
  for (let t = tFrom; t <= tTo + 0.001; t += tStep) temps.push(Math.round(t * 10) / 10);

  // Entry X on the right side = pixel X of the minimum weight
  const minWeight = Math.min(...weights);
  const entryPx = realXToPx('right', minWeight);

  const altValues = [...new Set(leftLines.map(l => l.value))];

  for (const alt of altValues) {
    const leftLine = leftLines.find(l => l.value === alt);
    if (!leftLine) continue;

    for (const temp of temps) {
      // 1. Left side: find crossover pixel Y
      const crossoverPy = leftLinePyAtTemp(leftLine, temp);

      for (const wt of weights) {
        // 2. Right side: follow reference curves from entry to target weight
        const targetPx = realXToPx('right', wt);
        const resultPy = rightSideFollowCurves(refCurves, crossoverPy, entryPx, targetPx);

        // 3. Convert pixel Y to distance
        const r = pxToReal('right', targetPx, resultPy);
        const distM = r ? r.y : 0;

        gridData.push({
          weightKg: wt,
          pressureAltitudeFt: alt,
          temperatureC: temp,
          distanceM: Math.round(distM),
        });
      }
    }
  }

  const out = document.getElementById('output');
  const distCol = getDistanceColumnName();
  const header = `weightKg,pressureAltitudeFt,temperatureC,${distCol}`;
  const rows = gridData.map(r => `${r.weightKg},${r.pressureAltitudeFt},${r.temperatureC},${r.distanceM}`);
  out.value = header + '\n' + rows.join('\n');
  setInfo(`Computed ${gridData.length} data points.`);
}

function getDistanceColumnName() {
  const chartType = document.getElementById('chart-type').value;
  const distType = document.getElementById('dist-type').value;
  if (chartType === 'takeoff') {
    return distType === 'groundroll' ? 'takeoffGroundRollM' : 'takeoffOver50M';
  } else {
    return distType === 'groundroll' ? 'landingGroundRollM' : 'landingOver50M';
  }
}

function exportCSV() {
  if (gridData.length === 0) { setInfo('Compute the grid first.'); return; }
  const distCol = getDistanceColumnName();
  const header = `weightKg,pressureAltitudeFt,temperatureC,${distCol}`;
  const rows = gridData.map(r => `${r.weightKg},${r.pressureAltitudeFt},${r.temperatureC},${r.distanceM}`);
  const csv = header + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const chartType = document.getElementById('chart-type').value;
  const baseName = imgName ? imgName.replace(/\.[^.]+$/, '') : chartType + '_performance';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${baseName}_${chartType}.csv`;
  a.click();
  setInfo(`Exported ${gridData.length} rows as ${a.download}`);
}
