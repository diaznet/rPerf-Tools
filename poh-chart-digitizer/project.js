// ── Save / Load Project ──

function saveProject() {
  const project = { cal, lines, gridData, altConfigs, curveConfigs, nextCurveId };
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

      // Support old 2-point format: migrate to multi-point
      for (const side of ['left', 'right']) {
        if (p.cal[side].xVals) {
          cal[side] = p.cal[side];
        } else {
          const old = p.cal[side];
          cal[side].xVals = [old.x1v, old.x2v];
          if (side === 'right') {
            cal[side].yVals = [old.y1v, old.y2v];
            if (old.pts && old.pts.length === 4) {
              cal[side].xPts = [
                { px: old.pts[0].px, py: old.pts[0].py, val: old.x1v },
                { px: old.pts[1].px, py: old.pts[1].py, val: old.x2v },
              ];
              cal[side].yPts = [
                { px: old.pts[2].px, py: old.pts[2].py, val: old.y1v },
                { px: old.pts[3].px, py: old.pts[3].py, val: old.y2v },
              ];
            }
          } else {
            if (old.pts && old.pts.length >= 2) {
              cal[side].xPts = [
                { px: old.pts[0].px, py: old.pts[0].py, val: old.x1v },
                { px: old.pts[1].px, py: old.pts[1].py, val: old.x2v },
              ];
            }
          }
          cal[side].done = old.done;
        }
      }

      lines = p.lines || [];
      gridData = p.gridData || [];
      if (p.curveConfigs) { curveConfigs = p.curveConfigs; nextCurveId = p.nextCurveId || curveConfigs.length + 1; }
      if (p.altConfigs) { altConfigs = p.altConfigs; }

      if (cal.left.done) document.getElementById('cal-left-status').textContent = '✓ Calibrated';
      if (cal.right.done) document.getElementById('cal-right-status').textContent = '✓ Calibrated';
      renderCalInputs('right');
      renderCalInputs('left');
      renderCurveConfig();
      renderAltConfig();
      updateLineList();
      redraw();
      setInfo('Project loaded. Re-load the same image to see overlays.');
    } catch (err) { setInfo('Failed: ' + err.message); }
  };
  reader.readAsText(file);
}
