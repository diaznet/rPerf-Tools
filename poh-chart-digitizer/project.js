// ── Save / Load Project ──

function saveProject() {
  const project = { rotation, calY, cal, lines, gridData, altConfigs, curveSections };
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const baseName = imgName ? imgName.replace(/\.[^.]+$/, '') : 'digitizer_project';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = baseName + '.json';
  a.click();
}

function loadProject(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const p = JSON.parse(ev.target.result);

      // ── Restore rotation ──
      if (p.rotation != null) {
        rotation = p.rotation;
        const slider = document.getElementById('rotation-slider');
        if (slider) slider.value = rotation;
        const valEl = document.getElementById('rotation-val');
        if (valEl) valEl.value = rotation.toFixed(2);
      }

      // ── Restore shared Y calibration ──
      if (p.calY) {
        // New format: shared Y calibration
        calY.vals = p.calY.vals;
        calY.pts = p.calY.pts;
        calY.done = p.calY.done;
      } else if (p.cal && p.cal.right && p.cal.right.yPts && p.cal.right.yPts.length > 0) {
        // Old format: migrate from weight section's Y calibration
        calY.vals = p.cal.right.yVals || [0, 1000];
        calY.pts = p.cal.right.yPts.map(pt => ({ py: pt.py, val: pt.val }));
        calY.done = true;
      }

      // ── Restore per-section X calibration ──
      for (const side of ['left', 'right', 'headwind', 'obstacle']) {
        if (p.cal && p.cal[side]) {
          const src = p.cal[side];
          if (src.xVals) {
            cal[side].xVals = src.xVals;
            cal[side].xPts = src.xPts || [];
            cal[side].done = src.done || false;
          } else {
            // Very old 2-point format
            cal[side].xVals = [src.x1v, src.x2v];
            if (src.pts && src.pts.length >= 2) {
              cal[side].xPts = [
                { px: src.pts[0].px, py: src.pts[0].py, val: src.x1v },
                { px: src.pts[1].px, py: src.pts[1].py, val: src.x2v },
              ];
            }
            cal[side].done = src.done || false;
          }
        }
      }

      lines = p.lines || [];
      gridData = p.gridData || [];
      if (p.altConfigs) altConfigs = p.altConfigs;

      // Restore curve sections
      if (p.curveSections) {
        for (const sec of ['right', 'headwind', 'obstacle']) {
          if (p.curveSections[sec]) {
            curveSections[sec] = p.curveSections[sec];
          }
        }
      } else if (p.curveConfigs) {
        curveSections.right.configs = p.curveConfigs;
        curveSections.right.nextId = p.nextCurveId || p.curveConfigs.length + 1;
      }

      // ── Update UI ──
      if (calY.done) {
        document.getElementById('cal-y-status').textContent = '✓ Calibrated';
      }
      renderYCalInputs();

      for (const side of Object.keys(cal)) {
        if (cal[side].done) {
          const el = document.getElementById('cal-' + side + '-status');
          if (el) el.textContent = '✓ Calibrated';
        }
        renderCalInputs(side);
      }

      // Auto-fill weights from Gross Weight calibration
      if (cal.right.done) {
        const weightsInput = document.getElementById('weights');
        if (weightsInput) {
          const sorted = [...cal.right.xVals].sort((a, b) => a - b);
          weightsInput.value = sorted.join(',');
        }
      }

      renderAltConfig();
      for (const sec of ['right', 'headwind', 'obstacle']) renderCurveConfig(sec);
      updateLineList();
      redraw();
      setInfo('Project loaded. Re-load the same image to see overlays.');
    } catch (err) { setInfo('Failed: ' + err.message); }
  };
  reader.readAsText(file);
}
