// ── Line Tracing ──

let lines = [];
let currentLine = null;
const COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c084fc', '#fb923c', '#22d3ee', '#f472b6'];

// ── Dynamic altitude config for left side ──
let altConfigs = [0, 2000, 4000, 8000];

function renderAltConfig() {
  const el = document.getElementById('alt-list-config');
  el.innerHTML = altConfigs.map((ft, i) =>
    `<div class="curve-cfg-row">
      <input type="radio" name="alt-sel" value="${i}" ${i === 0 ? 'checked' : ''} style="width:auto;flex:none">
      <input type="number" value="${ft}" onchange="updateAlt(${i},this.value)">
      <span style="font-size:11px;color:#888;flex-shrink:0">ft</span>
      ${altConfigs.length > 1 ? `<button class="cal-pt-remove" onclick="removeAlt(${i})">✕</button>` : ''}
    </div>`
  ).join('') + `<button class="secondary cal-add-btn" onclick="addAlt()">+ Add Altitude</button>`;
}

function addAlt() {
  const last = altConfigs[altConfigs.length - 1];
  const step = altConfigs.length > 1 ? altConfigs[altConfigs.length - 1] - altConfigs[altConfigs.length - 2] : 2000;
  altConfigs.push(last + step);
  renderAltConfig();
}

function removeAlt(idx) {
  if (altConfigs.length <= 1) return;
  const removed = altConfigs.splice(idx, 1)[0];
  lines = lines.filter(l => !(l.side === 'left' && l.value === removed));
  renderAltConfig();
  updateLineList();
  redraw();
}

function updateAlt(idx, val) {
  const oldVal = altConfigs[idx];
  const newVal = parseFloat(val);
  altConfigs[idx] = newVal;
  const line = lines.find(l => l.side === 'left' && l.value === oldVal);
  if (line) { line.value = newVal; line.label = newVal + ' ft'; updateLineList(); redraw(); }
}

function getSelectedAltIdx() {
  const radio = document.querySelector('input[name="alt-sel"]:checked');
  return radio ? parseInt(radio.value) : 0;
}

// ── Generic curve config for right-side sections (right, headwind, obstacle) ──
// Each section has its own config array and next ID counter.

const curveSections = {
  right:    { configs: [{ id: 1, name: 'Curve 1' }, { id: 2, name: 'Curve 2' }, { id: 3, name: 'Curve 3' }, { id: 4, name: 'Curve 4' }], nextId: 5 },
  headwind: { configs: [{ id: 1, name: 'Curve 1' }, { id: 2, name: 'Curve 2' }, { id: 3, name: 'Curve 3' }], nextId: 4 },
  obstacle: { configs: [{ id: 1, name: 'Curve 1' }, { id: 2, name: 'Curve 2' }, { id: 3, name: 'Curve 3' }], nextId: 4 },
};

function renderCurveConfig(section) {
  const sec = curveSections[section];
  const el = document.getElementById(`${section}-curve-config`);
  if (!el) return;
  el.innerHTML = sec.configs.map((c, i) =>
    `<div class="curve-cfg-row">
      <input type="radio" name="${section}-curve-sel" value="${c.id}" ${i === 0 ? 'checked' : ''} style="width:auto;flex:none">
      <input type="text" value="${c.name}" onchange="renameCurve('${section}',${i},this.value)" placeholder="Curve ${c.id}">
      ${sec.configs.length > 1 ? `<button class="cal-pt-remove" onclick="removeCurve('${section}',${i})">✕</button>` : ''}
    </div>`
  ).join('') + `<button class="secondary cal-add-btn" onclick="addCurve('${section}')">+ Add Curve</button>`;
}

function addCurve(section) {
  const sec = curveSections[section];
  sec.configs.push({ id: sec.nextId, name: 'Curve ' + sec.nextId });
  sec.nextId++;
  renderCurveConfig(section);
}

function removeCurve(section, idx) {
  const sec = curveSections[section];
  if (sec.configs.length <= 1) return;
  const removed = sec.configs.splice(idx, 1)[0];
  lines = lines.filter(l => !(l.side === section && l.value === removed.id));
  renderCurveConfig(section);
  updateLineList();
  redraw();
}

function renameCurve(section, idx, name) {
  const sec = curveSections[section];
  sec.configs[idx].name = name;
  const line = lines.find(l => l.side === section && l.value === sec.configs[idx].id);
  if (line) { line.label = name; updateLineList(); redraw(); }
}

function getSelectedCurveId(section) {
  const radio = document.querySelector(`input[name="${section}-curve-sel"]:checked`);
  const sec = curveSections[section];
  return radio ? parseInt(radio.value) : sec.configs[0]?.id;
}

// ── Tracing ──

function setTracingButtons(side, active) {
  const traceBtn = document.getElementById('btn-trace-' + side);
  const doneBtn = document.getElementById('btn-done-' + side);
  const undoBtn = document.getElementById('btn-undo-' + side);
  if (!traceBtn) return;
  if (active) {
    traceBtn.classList.add('btn-tracing');
    traceBtn.disabled = true;
    doneBtn.classList.add('btn-done-ready');
    doneBtn.disabled = false;
    undoBtn.disabled = false;
  } else {
    traceBtn.classList.remove('btn-tracing');
    traceBtn.disabled = false;
    doneBtn.classList.remove('btn-done-ready');
    doneBtn.disabled = true;
    undoBtn.disabled = true;
  }
}

function startTracing(side) {
  if (currentLine) setTracingButtons(currentLine.side, false);

  setMode('trace-' + side);
  setTracingButtons(side, true);

  let value, label, colorIdx;
  if (side === 'left') {
    const idx = getSelectedAltIdx();
    value = altConfigs[idx];
    label = value + ' ft';
    colorIdx = idx;
  } else {
    // right, headwind, or obstacle
    value = getSelectedCurveId(side);
    const sec = curveSections[side];
    const cfg = sec.configs.find(c => c.id === value);
    label = cfg ? cfg.name : 'Curve ' + value;
    colorIdx = sec.configs.findIndex(c => c.id === value);
  }
  currentLine = { side, label, value, points: [], color: COLORS[colorIdx >= 0 ? colorIdx % COLORS.length : 0] };
  setInfo(`Tracing "${currentLine.label}" — click points along the line. Click "Done" when finished.`);
  redraw();
}

function handleTraceClick(px, py) {
  if (!currentLine) return;
  currentLine.points.push({ px, py });
  setInfo(`"${currentLine.label}" — ${currentLine.points.length} points. Click more or "Done".`);
  redraw();
}

function undoLastPoint() {
  if (currentLine && currentLine.points.length > 0) {
    currentLine.points.pop();
    setInfo(currentLine.points.length + ' points.');
    redraw();
  }
}

function finishLine() {
  if (!currentLine) return;
  const side = currentLine.side;
  if (currentLine.points.length < 2) {
    currentLine = null;
    setMode('idle');
    setTracingButtons(side, false);
    setInfo('Trace cancelled (need at least 2 points).');
    redraw();
    return;
  }
  lines = lines.filter(l => !(l.side === currentLine.side && l.value === currentLine.value));
  lines.push(currentLine);
  currentLine = null;
  setMode('idle');
  setTracingButtons(side, false);
  updateLineList();
  redraw();
  setInfo('Line saved.');
}

function deleteLine(idx) {
  lines.splice(idx, 1);
  updateLineList();
  redraw();
}

// All sections that show traced lines
const LINE_LIST_SECTIONS = ['left', 'right', 'headwind', 'obstacle'];

function updateLineList() {
  for (const side of LINE_LIST_SECTIONS) {
    const el = document.getElementById(side + '-lines');
    if (!el) continue;
    const sideLines = lines.filter(l => l.side === side);
    el.innerHTML = sideLines.map(l => {
      const gi = lines.indexOf(l);
      return `<div class="line-item">
        <span><span class="color-dot" style="background:${l.color}"></span>${l.label} (${l.points.length} pts)</span>
        <button onclick="deleteLine(${gi})">✕</button>
      </div>`;
    }).join('');
  }
}

function drawLines() {
  for (const line of lines) drawLine(line);
  if (currentLine) drawLine(currentLine);
}

function drawLine(line) {
  if (line.points.length < 1) return;
  ctx.beginPath();
  ctx.moveTo(line.points[0].px, line.points[0].py);
  for (let i = 1; i < line.points.length; i++) ctx.lineTo(line.points[i].px, line.points[i].py);
  ctx.strokeStyle = line.color;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  for (const p of line.points) {
    ctx.beginPath();
    ctx.arc(p.px, p.py, 4, 0, Math.PI * 2);
    ctx.fillStyle = line.color;
    ctx.fill();
  }
  const last = line.points[line.points.length - 1];
  ctx.fillStyle = line.color;
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(line.label, last.px + 8, last.py - 6);
}

function initTracingUI() {
  renderAltConfig();
  for (const section of ['right', 'headwind', 'obstacle']) renderCurveConfig(section);
}
