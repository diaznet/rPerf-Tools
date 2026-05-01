const BASE_KEY_COLS = ['weightKg', 'pressureAltitudeFt'];
const TEMP_COL_OPTIONS = ['temperatureC', 'deltaIsaC'];
const DIST_COLS = ['takeoffGroundRollM', 'takeoffOver50M', 'landingGroundRollM', 'landingOver50M'];
let mergedPoints = [];
let foundDistCols = [];
let tempCol = 'temperatureC'; // detected from CSV

// ── CSV parsing ──

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(l => {
    const vals = l.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i] || '');
    return obj;
  });
}

async function readFiles() {
  const files = document.getElementById('csvFiles').files;
  if (!files.length) return [];
  const all = [];
  for (const file of files) {
    const text = await file.text();
    const rows = parseCSV(text);
    // Detect which temperature column is present
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      if (headers.includes('temperatureC')) tempCol = 'temperatureC';
      else if (headers.includes('deltaIsaC')) tempCol = 'deltaIsaC';
    }
    all.push(...rows);
  }
  return all;
}

function getKeyCols() {
  return [...BASE_KEY_COLS, tempCol];
}

function makeKey(row) {
  return getKeyCols().map(k => row[k] || '').join('|');
}

// ── Generate ──

async function generate() {
  const status = document.getElementById('genStatus');
  const rows = await readFiles();
  if (rows.length === 0) { status.textContent = 'Load at least one CSV.'; status.className = 'status error'; return; }

  foundDistCols = DIST_COLS.filter(c => rows.some(r => r[c] && r[c] !== ''));
  if (foundDistCols.length === 0) { status.textContent = 'No distance columns found in CSVs.'; status.className = 'status error'; return; }

  const KEY_COLS = getKeyCols();
  const map = new Map();
  for (const row of rows) {
    const key = makeKey(row);
    if (!map.has(key)) {
      const base = {};
      KEY_COLS.forEach(k => base[k] = row[k]);
      map.set(key, base);
    }
    const merged = map.get(key);
    for (const c of DIST_COLS) {
      if (row[c] && row[c] !== '') merged[c] = row[c];
    }
  }
  mergedPoints = [...map.values()];

  renderTable();
  status.textContent = `${mergedPoints.length} points, columns: ${foundDistCols.join(', ')}`;
  status.className = 'status';
  document.getElementById('loadStatus').textContent = `Loaded ${rows.length} rows from ${document.getElementById('csvFiles').files.length} file(s).`;
}

// ── Editable table ──

function getVisibleCols() {
  return [...getKeyCols(), ...foundDistCols];
}

function renderTable() {
  const wrap = document.getElementById('table-wrap');
  const cols = getVisibleCols();
  if (mergedPoints.length === 0 || cols.length === 0) { wrap.innerHTML = ''; return; }

  const shortNames = {
    weightKg: 'Wt(kg)', pressureAltitudeFt: 'PA(ft)',
    temperatureC: 'Temp(°C)', deltaIsaC: 'ΔISA(°C)',
    takeoffGroundRollM: 'TO GR(m)', takeoffOver50M: 'TO 50(m)',
    landingGroundRollM: 'LDG GR(m)', landingOver50M: 'LDG 50(m)',
  };

  let html = '<table><thead><tr>';
  html += cols.map(c => `<th>${shortNames[c] || c}</th>`).join('');
  html += '<th></th></tr></thead><tbody>';
  mergedPoints.forEach((pt, ri) => {
    html += '<tr>';
    cols.forEach(c => {
      html += `<td><input value="${pt[c] || ''}" onchange="editCell(${ri},'${c}',this.value)"></td>`;
    });
    html += `<td class="del-cell"><button onclick="deleteRow(${ri})">✕</button></td>`;
    html += '</tr>';
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;

  // Also update raw view if visible
  const out = document.getElementById('output');
  if (out.style.display !== 'none') out.value = buildCSV();
}

function editCell(rowIdx, col, val) {
  mergedPoints[rowIdx][col] = val;
  // Update raw view if visible
  const out = document.getElementById('output');
  if (out.style.display !== 'none') out.value = buildCSV();
}

function deleteRow(rowIdx) {
  mergedPoints.splice(rowIdx, 1);
  renderTable();
}

function addRow() {
  if (mergedPoints.length === 0 && foundDistCols.length === 0) return;
  const pt = {};
  getKeyCols().forEach(k => pt[k] = '');
  DIST_COLS.forEach(k => pt[k] = '');
  mergedPoints.push(pt);
  renderTable();
  // Scroll to bottom
  const wrap = document.getElementById('table-wrap');
  wrap.scrollTop = wrap.scrollHeight;
}

function toggleRaw() {
  const out = document.getElementById('output');
  if (out.style.display === 'none') {
    out.value = buildCSV();
    out.style.display = '';
  } else {
    out.style.display = 'none';
  }
}

// ── Build output ──

function getMeta() {
  return {
    aircraftId: document.getElementById('aircraftId').value,
    registration: document.getElementById('registration').value,
    name: document.getElementById('acName').value,
    mtowKg: parseFloat(document.getElementById('mtowKg').value) || 0,
    grassPenalty: parseFloat(document.getElementById('grassPenalty').value) || 0,
    runwayType: document.getElementById('runwayType').value,
    hwTo: parseFloat(document.getElementById('hwTo').value) || 0,
    twTo: parseFloat(document.getElementById('twTo').value) || 0,
    hwLdg: parseFloat(document.getElementById('hwLdg').value) || 0,
    twLdg: parseFloat(document.getElementById('twLdg').value) || 0,
    slopeTo: document.getElementById('slopeTo').value,
    slopeLdg: document.getElementById('slopeLdg').value,
  };
}

function buildCSV() {
  const m = getMeta();
  const headers = [
    'aircraftId','registration','name','mtowKg','grassPenaltyPercentIfNoGrassData',
    'runwayType','weightKg','pressureAltitudeFt', tempCol,
    'takeoffGroundRollM','takeoffOver50M','landingGroundRollM','landingOver50M',
    'headwindTO%/kt','tailwindTO%/kt','headwindLDG%/kt','tailwindLDG%/kt',
    'slopeTO%/%','slopeLDG%/%'
  ];
  const lines = [headers.join(',')];
  for (const pt of mergedPoints) {
    lines.push([
      m.aircraftId, m.registration, m.name, m.mtowKg, m.grassPenalty,
      m.runwayType,
      pt.weightKg || '', pt.pressureAltitudeFt || '', pt[tempCol] || '',
      pt.takeoffGroundRollM || '', pt.takeoffOver50M || '',
      pt.landingGroundRollM || '', pt.landingOver50M || '',
      m.hwTo, m.twTo, m.hwLdg, m.twLdg,
      m.slopeTo, m.slopeLdg
    ].join(','));
  }
  return lines.join('\n');
}

function buildJSON() {
  const m = getMeta();
  const obj = [{
    id: m.aircraftId,
    registration: m.registration,
    name: m.name,
    mtowKg: m.mtowKg,
    grassPenaltyPercentIfNoGrassData: m.grassPenalty,
    correctionFactors: {
      headwindTakeoffPercentPerKt: m.hwTo,
      tailwindTakeoffPercentPerKt: m.twTo,
      headwindLandingPercentPerKt: m.hwLdg,
      tailwindLandingPercentPerKt: m.twLdg,
    },
    points: mergedPoints.map(pt => {
      const p = {
        runwayType: m.runwayType,
        weightKg: parseFloat(pt.weightKg) || 0,
        pressureAltitudeFt: parseFloat(pt.pressureAltitudeFt) || 0,
        [tempCol]: parseFloat(pt[tempCol]) || 0,
      };
      for (const c of DIST_COLS) {
        if (pt[c] && pt[c] !== '') p[c] = parseFloat(pt[c]);
      }
      return p;
    })
  }];
  if (m.slopeTo !== '') obj[0].correctionFactors.slopeTakeoffPercentPerPercent = parseFloat(m.slopeTo);
  if (m.slopeLdg !== '') obj[0].correctionFactors.slopeLandingPercentPerPercent = parseFloat(m.slopeLdg);
  return JSON.stringify(obj, null, 2);
}

function doExport(format) {
  if (mergedPoints.length === 0) { document.getElementById('genStatus').textContent = 'Generate first.'; return; }
  const m = getMeta();
  const content = format === 'json' ? buildJSON() : buildCSV();
  const mime = format === 'json' ? 'application/json' : 'text/csv';
  const ext = format === 'json' ? '.json' : '.csv';
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (m.aircraftId || 'aircraft') + ext;
  a.click();
  document.getElementById('output').value = content;
  document.getElementById('output').style.display = '';
}
