# rPerf Tools — Technical Architecture

## Stack
- **Modular files** in `poh-chart-digitizer/` — `index.html` (markup), `style.css`, `calibration.js`, `tracing.js`, `compute.js`, `project.js`, `app.js`
- **Aircraft Profile Generator** in `aircraft-profile-generator/` — `index.html` (markup), `style.css`, `app.js`
- No build step, no dependencies, no server
- Vanilla HTML/CSS/JavaScript
- Canvas API for image display, line drawing, and calibration overlays
- Runs in any modern browser (just open the file)

## UI Layout — Digitizer
- **Left sidebar** (resizable, 260–600px): step-by-step workflow panels (load → calibrate right → calibrate left → trace left → trace right → compute/export)
- **Main area**: Canvas with the POH chart image as background, overlaid with traced lines and calibration points
- **Bottom bar**: Status info, real-time coordinate display, calibration click indicator

## Calibration System
Each side (left/right) is calibrated independently with N clicks per axis (multi-point piecewise linear):
- **Right X**: N weight reference points (default: 800, 900, 1000 kg) — user can add/remove
- **Right Y**: N distance reference points (default: 0, 1000 m) — user can add/remove
- **Left X**: N temperature reference points (default: -20, -10, 0, 10, 20, 30, 40 °C) — user can add/remove
- **Left Y**: Not needed — the crossover operates in pixel Y space directly

Pixel-to-real conversion uses **piecewise linear interpolation** between reference points (better accuracy for non-linear chart axes from scanned/photographed POH).

**Step order**: Right side is calibrated first (step 2) because it defines the Y (distance) axis used for the final readout.

**Key insight**: The left side only needs X calibration (temperature). The horizontal crossover from left to right works in raw pixel Y — no Y calibration is needed on the left side.

## Line Tracing
- **Left side (step 4)**: User traces altitude lines. Altitudes are dynamic — add/remove with numeric ft values. Points stored as pixel coordinates `{px, py}`.
- **Right side (step 5)**: User traces reference curves. Curves are dynamic — add/remove with custom names. These are **independent guide curves** that define the interpolation field — they are NOT paired with altitude lines.
- Lines are interpolated linearly between clicked points
- Lines can be deleted and re-traced
- **Button states**: Trace button turns red + disabled while active. Done button turns green. Undo/Done are disabled when not in trace mode.

## Computation Algorithm
For each combination of (temperature, altitude, weight):

1. **Left side**: Interpolate along the left altitude line to find the pixel Y at the given temperature
   - `leftLinePyAtTemp(line, tempC)` — sorts points by real temperature, linear interpolation

2. **Crossover**: The pixel Y from step 1 is the horizontal crossover height into the right side

3. **Right side — follow the reference curves**:
   - At the entry X (left edge = minimum weight pixel), compute each reference curve's pixel Y
   - Sort curves by their Y at entry (top to bottom)
   - Find where the crossover Y sits between the curves → fractional position `f`
   - At the target weight X, compute each curve's pixel Y at that X
   - Interpolate at the same fractional position `f` → result pixel Y
   - Extrapolate linearly if crossover Y is above/below all curves

4. **Read distance**: Convert the resulting pixel Y to real distance using right-side Y calibration

**Key insight**: The reference curves on the right side define a **flow field**. You enter at the crossover height, then the curves guide you — you interpolate between them as you move rightward to your target weight. The curves themselves have no altitude labels.

## CSV Output Format
- Headers: `weightKg`, `pressureAltitudeFt`, `deltaIsaC`, and one of: `takeoffGroundRollM`, `takeoffOver50M`, `landingGroundRollM`, `landingOver50M`
- User selects chart type (takeoff/landing) and distance type (ground roll / over 50ft) in step 6
- Temperature range and step are configurable (default: -20 to 40°C, step 5°C)

## Data Flow
```
POH chart image
  → Calibrate right side (weight X + distance Y)
  → Calibrate left side (temperature X only)
  → Trace altitude lines (left side)
  → Trace reference curves (right side)
  → Compute grid (temp × altitude × weight → distance)
  → Export CSV
  → Aircraft Profile Generator merges CSVs + adds metadata
  → Export final CSV or JSON for rPerf
```

## Save/Load
- **Save Project**: Exports calibration, traced lines, altitude configs, curve configs, and computed grid as JSON. Filename matches the loaded image name.
- **Load Project**: Restores state (user must re-load the same image separately). Backward-compatible with old 2-point calibration format.

## Aircraft Profile Generator
- Loads one or more digitized CSVs, merges on key columns (`weightKg`, `pressureAltitudeFt`, `deltaIsaC`)
- Adds aircraft metadata: ID, registration, name, MTOW, grass penalty, runway type
- Adds correction factors: headwind/tailwind %/kt, slope %/%
- **Editable table**: after generating, data shown in an editable table with short column headers. Users can modify cells, add rows, delete rows.
- **Toggle Raw View**: shows/hides raw CSV text preview
- Exports as CSV (rPerf flat format with all 19 columns) or JSON (rPerf structured format with metadata + points array)
