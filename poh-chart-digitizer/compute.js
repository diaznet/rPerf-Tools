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

// Follow reference curves from entryPx to targetPx given a crossover pixel Y.
function followCurves(refCurves, crossoverPy, entryPx, targetPx) {
  if (refCurves.length === 0) return crossoverPy;

  // Only use curves that span both the entry and target X positions
  const activeCurves = refCurves.filter(c => {
    const pts = c.points;
    const minPx = Math.min(...pts.map(p => p.px));
    const maxPx = Math.max(...pts.map(p => p.px));
    return minPx <= entryPx + 1 && maxPx >= targetPx - 1;
  });

  // Fall back to all curves if none span the full range
  const curves = activeCurves.length >= 2 ? activeCurves : refCurves;

  const order = curves.map((c, i) => ({ idx: i, entryPy: curvePyAtPx(c, entryPx) }))
    .sort((a, b) => a.entryPy - b.entryPy);

  const sortedEntryPy = order.map(o => o.entryPy);
  const sortedTargetPy = order.map(o => curvePyAtPx(curves[o.idx], targetPx));

  if (sortedEntryPy.length === 1) {
    return sortedTargetPy[0] + (crossoverPy - sortedEntryPy[0]);
  }

  for (let i = 0; i < sortedEntryPy.length - 1; i++) {
    const yA = sortedEntryPy[i], yB = sortedEntryPy[i + 1];
    if (crossoverPy >= yA && crossoverPy <= yB) {
      const f = (yB === yA) ? 0 : (crossoverPy - yA) / (yB - yA);
      return sortedTargetPy[i] + f * (sortedTargetPy[i + 1] - sortedTargetPy[i]);
    }
  }

  if (crossoverPy < sortedEntryPy[0]) {
    const yA = sortedEntryPy[0], yB = sortedEntryPy[1];
    const f = (yB === yA) ? 0 : (crossoverPy - yA) / (yB - yA);
    return sortedTargetPy[0] + f * (sortedTargetPy[1] - sortedTargetPy[0]);
  }

  const n = sortedEntryPy.length;
  const yA = sortedEntryPy[n - 2], yB = sortedEntryPy[n - 1];
  const f = (yB === yA) ? 0 : (crossoverPy - yA) / (yB - yA);
  return sortedTargetPy[n - 2] + f * (sortedTargetPy[n - 1] - sortedTargetPy[n - 2]);
}

// ── Section helpers ──

function isSectionActive(section) {
  return cal[section].done && lines.some(l => l.side === section);
}

function processSection(section, crossoverPy, targetXVal) {
  const refCurves = lines.filter(l => l.side === section);
  if (refCurves.length === 0) return crossoverPy;

  // For the wind section, entry is at 0 kt (the crossover from the previous section).
  // For other sections, entry is at the leftmost calibrated X value.
  let entryXVal;
  if (section === 'headwind') {
    entryXVal = 0; // Wind section: crossover is always at 0 kt
  } else {
    // Use the leftmost calibrated value (e.g., 0 m for obstacle)
    entryXVal = Math.min(...cal[section].xVals);
  }

  // If target equals entry, no change
  if (Math.abs(targetXVal - entryXVal) < 1e-6) return crossoverPy;

  const entryPx = realXToPx(section, entryXVal);
  const targetPx = realXToPx(section, targetXVal);
  return followCurves(refCurves, crossoverPy, entryPx, targetPx);
}

function readDistance(py) {
  return pyToDistance(py);
}

// Compute distance for one (alt, temp, weight) combo at a given wind value.
// Returns the distance in meters from the last active section.
function computeOnePoint(leftLine, temp, wt, rightCurves, entryPx, windVal, hasHeadwind, hasObstacle, obstacleX) {
  const crossoverPy = leftLinePyAtTemp(leftLine, temp);
  const targetPx = realXToPx('right', wt);
  let py = followCurves(rightCurves, crossoverPy, entryPx, targetPx);

  if (hasHeadwind) {
    py = processSection('headwind', py, windVal);
  }

  if (hasObstacle) {
    py = processSection('obstacle', py, obstacleX);
  }

  return readDistance(py);
}

// ── Compute Grid ──
let gridData = [];
let computedWindFactors = null; // { headwindPctPerKt, tailwindPctPerKt }

function computeGrid() {
  const leftLines = lines.filter(l => l.side === 'left');
  const rightCurves = lines.filter(l => l.side === 'right');

  if (leftLines.length === 0 || rightCurves.length === 0) {
    setInfo('Need altitude lines on OAT section and reference curves on Gross Weight section.'); return;
  }
  if (!cal.left.done || !cal.right.done || !calY.done) {
    setInfo('OAT, Gross Weight, and Y axis must be calibrated first.'); return;
  }

  const hasHeadwind = isSectionActive('headwind');
  const hasObstacle = isSectionActive('obstacle');

  if (hasHeadwind && !cal.headwind.done) {
    setInfo('Wind section has curves but is not calibrated.'); return;
  }
  if (hasObstacle && !cal.obstacle.done) {
    setInfo('Obstacle section has curves but is not calibrated.'); return;
  }

  const weights = document.getElementById('weights').value.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
  if (weights.length === 0) { setInfo('Enter at least one weight.'); return; }

  // Warn if weights are outside calibrated range
  const calWeights = cal.right.xVals;
  const minCal = Math.min(...calWeights);
  const maxCal = Math.max(...calWeights);
  const outOfRange = weights.filter(w => w < minCal || w > maxCal);
  if (outOfRange.length > 0) {
    setInfo(`Warning: weights [${outOfRange.join(', ')}] are outside calibrated range (${minCal}–${maxCal} kg). Results may be inaccurate.`);
  }

  const tFrom = parseFloat(document.getElementById('temp-from').value) || -20;
  const tTo = parseFloat(document.getElementById('temp-to').value) || 40;
  const tStep = parseFloat(document.getElementById('temp-step').value) || 5;
  if (tStep <= 0) { setInfo('Temperature step must be positive.'); return; }
  const temps = [];
  for (let t = tFrom; t <= tTo + 0.001; t += tStep) temps.push(Math.round(t * 10) / 10);

  // Parse wind samples
  const windSamples = hasHeadwind
    ? document.getElementById('wind-samples').value.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n !== 0)
    : [];

  const obstacleVals = hasObstacle ? [0, 15] : [null];

  // Entry X = leftmost extent of the weight section's reference curves
  // (where you cross over from the OAT section)
  let entryPx = Infinity;
  for (const c of rightCurves) {
    for (const p of c.points) {
      if (p.px < entryPx) entryPx = p.px;
    }
  }
  const altValues = [...new Set(leftLines.map(l => l.value))];

  gridData = [];

  for (const alt of altValues) {
    const leftLine = leftLines.find(l => l.value === alt);
    if (!leftLine) continue;

    for (const temp of temps) {
      for (const wt of weights) {
        for (const obsX of obstacleVals) {
          // Baseline: compute at 0 kt wind
          const baseDist = computeOnePoint(leftLine, temp, wt, rightCurves, entryPx, 0, hasHeadwind, hasObstacle, obsX);

          // Per-point wind factors
          let hwPctPerKt = null, twPctPerKt = null;
          if (hasHeadwind && baseDist > 0) {
            const hwSamples = windSamples.filter(v => v > 0);
            const twSamples = windSamples.filter(v => v < 0);

            if (hwSamples.length > 0) {
              let sum = 0;
              for (const windKt of hwSamples) {
                const windDist = computeOnePoint(leftLine, temp, wt, rightCurves, entryPx, windKt, true, hasObstacle, obsX);
                sum += ((windDist - baseDist) / baseDist) * 100 / windKt;
              }
              hwPctPerKt = Math.round(Math.abs(sum / hwSamples.length) * 100) / 100;
            }

            if (twSamples.length > 0) {
              let sum = 0;
              for (const windKt of twSamples) {
                const windDist = computeOnePoint(leftLine, temp, wt, rightCurves, entryPx, windKt, true, hasObstacle, obsX);
                sum += ((windDist - baseDist) / baseDist) * 100 / Math.abs(windKt);
              }
              twPctPerKt = Math.round(Math.abs(sum / twSamples.length) * 100) / 100;
            }
          }

          gridData.push({
            weightKg: wt,
            pressureAltitudeFt: alt,
            temperatureC: temp,
            distanceM: Math.round(baseDist),
            distType: hasObstacle ? (obsX === 0 ? 'groundroll' : 'over50') : null,
            hwPctPerKt,
            twPctPerKt,
          });
        }
      }
    }
  }

  // Compute average wind correction factors (for status display and JSON export)
  computedWindFactors = null;
  if (hasHeadwind) {
    const hwVals = gridData.filter(r => r.hwPctPerKt != null).map(r => r.hwPctPerKt);
    const twVals = gridData.filter(r => r.twPctPerKt != null).map(r => r.twPctPerKt);
    computedWindFactors = {
      headwindPctPerKt: hwVals.length > 0 ? Math.round(hwVals.reduce((a, b) => a + b, 0) / hwVals.length * 100) / 100 : 0,
      tailwindPctPerKt: twVals.length > 0 ? Math.round(twVals.reduce((a, b) => a + b, 0) / twVals.length * 100) / 100 : 0,
    };
  }

  // Build output text
  const chartType = document.getElementById('chart-type').value;
  const out = document.getElementById('output');
  const wf = computedWindFactors;
  const hwCol = chartType === 'takeoff' ? 'headwindTO%/kt' : 'headwindLDG%/kt';
  const twCol = chartType === 'takeoff' ? 'tailwindTO%/kt' : 'tailwindLDG%/kt';
  const hasWindCols = hasHeadwind;

  if (hasObstacle) {
    const grCol = chartType === 'takeoff' ? 'takeoffGroundRollM' : 'landingGroundRollM';
    const ovCol = chartType === 'takeoff' ? 'takeoffOver50M' : 'landingOver50M';

    const merged = new Map();
    for (const r of gridData) {
      const key = `${r.weightKg}|${r.pressureAltitudeFt}|${r.temperatureC}`;
      if (!merged.has(key)) merged.set(key, { weightKg: r.weightKg, pressureAltitudeFt: r.pressureAltitudeFt, temperatureC: r.temperatureC, hwPctPerKt: r.hwPctPerKt, twPctPerKt: r.twPctPerKt });
      const m = merged.get(key);
      if (r.distType === 'groundroll') m.groundRollM = r.distanceM;
      else m.over50M = r.distanceM;
    }

    const header = `weightKg,pressureAltitudeFt,temperatureC,${grCol},${ovCol}${hasWindCols ? `,${hwCol},${twCol}` : ''}`;
    const rows = [...merged.values()].map(r => {
      let row = `${r.weightKg},${r.pressureAltitudeFt},${r.temperatureC},${r.groundRollM},${r.over50M}`;
      if (hasWindCols) row += `,${r.hwPctPerKt ?? ''},${r.twPctPerKt ?? ''}`;
      return row;
    });
    out.value = header + '\n' + rows.join('\n');
  } else {
    const distCol = getDistanceColumnName();
    const header = `weightKg,pressureAltitudeFt,temperatureC,${distCol}${hasWindCols ? `,${hwCol},${twCol}` : ''}`;
    const rows = gridData.map(r => {
      let row = `${r.weightKg},${r.pressureAltitudeFt},${r.temperatureC},${r.distanceM}`;
      if (hasWindCols) row += `,${r.hwPctPerKt ?? ''},${r.twPctPerKt ?? ''}`;
      return row;
    });
    out.value = header + '\n' + rows.join('\n');
  }

  const uniquePoints = hasObstacle ? gridData.length / 2 : gridData.length;
  let msg = `Computed ${uniquePoints} data points (0 kt wind baseline).`;
  if (wf) {
    msg += ` Avg wind factors: headwind ${wf.headwindPctPerKt}%/kt, tailwind ${wf.tailwindPctPerKt}%/kt (per-point values in CSV).`;
  }
  if (hasObstacle) msg += ' Both ground roll and over 50ft computed.';
  setInfo(msg);
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

  const chartType = document.getElementById('chart-type').value;
  const hasObstacle = isSectionActive('obstacle');
  let csv;

  const wf = computedWindFactors;
  const hwCol = chartType === 'takeoff' ? 'headwindTO%/kt' : 'headwindLDG%/kt';
  const twCol = chartType === 'takeoff' ? 'tailwindTO%/kt' : 'tailwindLDG%/kt';
  const hasWindCols = isSectionActive('headwind');

  if (hasObstacle) {
    const grCol = chartType === 'takeoff' ? 'takeoffGroundRollM' : 'landingGroundRollM';
    const ovCol = chartType === 'takeoff' ? 'takeoffOver50M' : 'landingOver50M';

    const merged = new Map();
    for (const r of gridData) {
      const key = `${r.weightKg}|${r.pressureAltitudeFt}|${r.temperatureC}`;
      if (!merged.has(key)) merged.set(key, { weightKg: r.weightKg, pressureAltitudeFt: r.pressureAltitudeFt, temperatureC: r.temperatureC, hwPctPerKt: r.hwPctPerKt, twPctPerKt: r.twPctPerKt });
      const m = merged.get(key);
      if (r.distType === 'groundroll') m.groundRollM = r.distanceM;
      else m.over50M = r.distanceM;
    }

    const header = `weightKg,pressureAltitudeFt,temperatureC,${grCol},${ovCol}${hasWindCols ? `,${hwCol},${twCol}` : ''}`;
    const rows = [...merged.values()].map(r => {
      let row = `${r.weightKg},${r.pressureAltitudeFt},${r.temperatureC},${r.groundRollM},${r.over50M}`;
      if (hasWindCols) row += `,${r.hwPctPerKt ?? ''},${r.twPctPerKt ?? ''}`;
      return row;
    });
    csv = header + '\n' + rows.join('\n');
  } else {
    const distCol = getDistanceColumnName();
    const header = `weightKg,pressureAltitudeFt,temperatureC,${distCol}${hasWindCols ? `,${hwCol},${twCol}` : ''}`;
    const rows = gridData.map(r => {
      let row = `${r.weightKg},${r.pressureAltitudeFt},${r.temperatureC},${r.distanceM}`;
      if (hasWindCols) row += `,${r.hwPctPerKt ?? ''},${r.twPctPerKt ?? ''}`;
      return row;
    });
    csv = header + '\n' + rows.join('\n');
  }

  const blob = new Blob([csv], { type: 'text/csv' });
  const baseName = imgName ? imgName.replace(/\.[^.]+$/, '') : chartType + '_performance';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${baseName}_${chartType}.csv`;
  a.click();
  let msg = `Exported as ${a.download}`;
  if (wf) {
    msg += ` | Avg wind: HW ${wf.headwindPctPerKt}%/kt, TW ${wf.tailwindPctPerKt}%/kt`;
  }
  setInfo(msg);
}
