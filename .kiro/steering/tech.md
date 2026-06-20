# rPerf Tools — Technical Architecture

## Stack
- **Modular files** in `poh-chart-digitizer/` — `index.html` (markup), `style.css`, `calibration.js`, `tracing.js`, `compute.js`, `project.js`, `app.js`
- **Aircraft Profile Generator** in `aircraft-profile-generator/` — `index.html` (markup), `style.css`, `app.js`
- No build step, no dependencies, no server
- Vanilla HTML/CSS/JavaScript
- Canvas API for image display, line drawing, and calibration overlays
- Runs in any modern browser (just open the file)

## UI Layout — Digitizer
- **Left sidebar** (resizable, 260–600px): 10-step workflow panels (load → calibrate gross weight → calibrate OAT → calibrate wind [optional] → calibrate obstacle [optional] → trace altitude lines → trace weight curves → trace wind curves [optional] → trace obstacle curves [optional] → compute/export)
- **Main area**: Canvas with the POH chart image as background, overlaid with traced lines and calibration points
- **Bottom bar**: Status info, real-time coordinate display, calibration click indicator
- **Optional sections**: Dimmed at 70% opacity, brighten on hover/focus. Each has a Reset button to clear calibration.

## Calibration System
Each section is calibrated independently with N clicks per axis (multi-point piecewise linear):
- **Gross Weight X**: N weight reference points (default: 800, 900, 1000 kg) — user can add/remove
- **Gross Weight Y**: N distance reference points (default: 0, 1000 m) — user can add/remove
- **OAT X**: N temperature reference points (default: -20, -10, 0, 10, 20, 30, 40 °C) — user can add/remove
- **OAT Y**: Not needed — the crossover operates in pixel Y space directly
- **Wind X**: N wind reference points (default: -10, 0, 10, 20 kt) — negative = tailwind
- **Wind Y**: N distance reference points (default: 0, 1000 m)
- **Obstacle X**: N obstacle height reference points (default: 0, 15 m)
- **Obstacle Y**: N distance reference points (default: 0, 1000 m)

Pixel-to-real conversion uses **piecewise linear interpolation** between reference points (better accuracy for non-linear chart axes from scanned/photographed POH).

**Step order**: Gross Weight section is calibrated first (step 2) because it defines the Y (distance) axis used for the final readout.

**Key insight**: The OAT section only needs X calibration (temperature). The horizontal crossover from OAT to Gross Weight works in raw pixel Y — no Y calibration is needed on the OAT section.

**Calibration colors**: OAT = cyan, Gross Weight = yellow, Wind = magenta, Obstacle = green.

## Line Tracing
- **OAT section (step 6)**: User traces altitude lines. Altitudes are dynamic — add/remove with numeric ft values. Points stored as pixel coordinates `{px, py}`.
- **Gross Weight section (step 7)**: User traces reference curves. Curves are dynamic — add/remove with custom names.
- **Wind section (step 8, optional)**: User traces reference curves. Same mechanics as Gross Weight.
- **Obstacle section (step 9, optional)**: User traces reference curves. Same mechanics as Gross Weight.
- Each section has its own curve config stored in `curveSections` object.
- Lines are interpolated linearly between clicked points.
- Lines can be deleted and re-traced.
- **Button states**: Trace button turns red + disabled while active. Done button turns green. Undo/Done are disabled when not in trace mode.

## Computation Algorithm
For each combination of (temperature, altitude, weight):

1. **OAT section**: Interpolate along the altitude line to find the pixel Y at the given temperature
   - `leftLinePyAtTemp(line, tempC)` — sorts points by real temperature, linear interpolation

2. **Crossover**: The pixel Y from step 1 is the horizontal crossover height into the Gross Weight section

3. **Gross Weight section — follow the reference curves**:
   - At the entry X (left edge = minimum weight pixel), compute each reference curve's pixel Y
   - Sort curves by their Y at entry (top to bottom)
   - Find where the crossover Y sits between the curves → fractional position `f`
   - At the target weight X, compute each curve's pixel Y at that X
   - Interpolate at the same fractional position `f` → result pixel Y
   - Extrapolate linearly if crossover Y is above/below all curves

4. **Wind section (optional)**: Same curve-following algorithm. Input: pixel Y from Gross Weight section. Distances are always computed at **0 kt wind** (baseline). The tool also computes at each user-specified wind sample value to derive average correction factors.

5. **Obstacle section (optional)**: Same curve-following algorithm. Input: pixel Y from previous section. Runs twice: at X=0m (ground roll) and X=15m (over 50ft). Produces both distance types from one chart.

6. **Read distance**: Convert the resulting pixel Y to real distance using the last active section's Y calibration.

**Key insight**: Each section's reference curves define a **flow field**. You enter at the crossover height, then the curves guide you. Sections chain together: the output Y of one section becomes the input Y of the next.

### Wind Correction Factor Computation
When the wind section is active:
1. Baseline distances are computed at 0 kt wind
2. For each user-specified wind sample (e.g., -10, -5, 5, 10, 15, 20 kt), distances are recomputed
3. For each sample: `pctPerKt = (dist_wind - dist_baseline) / dist_baseline / |wind_kt| × 100`
4. Positive wind samples (headwind) are averaged → headwind %/kt
5. Negative wind samples (tailwind) are averaged → tailwind %/kt
6. The factors are displayed in the status bar and appended as comments in the output textarea

## CSV Output Format
- Headers: `weightKg`, `pressureAltitudeFt`, `temperatureC`, and distance columns
- When obstacle section is active: both ground roll and over-50 columns are included
- When obstacle section is not active: user selects chart type (takeoff/landing) and distance type (ground roll / over 50ft)
- When wind section is active: per-point headwind/tailwind %/kt columns are included
- Temperature range and step are configurable (default: -20 to 40°C, step 5°C)

## Data Flow
```
POH chart image
  → Calibrate Gross Weight section (X + Y)
  → Calibrate OAT section (temperature X only)
  → [Optional] Calibrate Wind section (X + Y)
  → [Optional] Calibrate Obstacle section (X + Y)
  → Trace altitude lines (OAT section)
  → Trace reference curves (Gross Weight section)
  → [Optional] Trace reference curves (Wind section)
  → [Optional] Trace reference curves (Obstacle section)
  → Compute grid: temp × altitude × weight → [wind at 0kt] → [obstacle at 0m + 15m] → distances
  → [Optional] Sample wind values → derive avg headwind/tailwind %/kt correction factors
  → Export CSV (both ground roll + over 50 if obstacle section active)
  → Aircraft Profile Generator merges CSVs + adds metadata
  → Export final CSV or JSON for rPerf
```

## Save/Load
- **Save Project**: Exports calibration (all sections), traced lines, altitude configs, curve configs (per section), and computed grid as JSON. Filename matches the loaded image name.
- **Load Project**: Restores state (user must re-load the same image separately). Backward-compatible with old 2-point calibration format and old single-section curve configs.

## Aircraft Profile Generator
- Loads one or more digitized CSVs, merges on key columns (`weightKg`, `pressureAltitudeFt`, `temperatureC`)
- **Auto-fills correction factors** from loaded CSVs (first non-zero value found for each factor)
- Adds aircraft metadata: ID, registration, name, MTOW, grass penalty, runway type
- Adds correction factors: headwind/tailwind %/kt, slope %/%
- **Editable table**: after generating, data shown in an editable table with short column headers. Users can modify cells, add rows, delete rows.
- **Toggle Raw View**: shows/hides raw CSV text preview
- Exports as CSV (rPerf flat format with all 19 columns, always `temperatureC`)
