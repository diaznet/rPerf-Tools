# rPerf Tools — Guidelines

## Repository Structure
- `poh-chart-digitizer/` — Chart digitizer tool (index.html + JS modules + CSS + saved projects)
- `aircraft-profile-generator/` — Profile generator/merger tool (index.html + style.css + app.js)
- `plane_samples/` — Example rPerf output files

## Code Style
- Modular files in `poh-chart-digitizer/`: `index.html` (markup), `style.css`, `calibration.js`, `tracing.js`, `compute.js`, `project.js`, `app.js`
- Modular files in `aircraft-profile-generator/`: `index.html` (markup), `style.css`, `app.js`
- No build tooling, no external dependencies — must work offline by opening the file in a browser
- Dark theme UI (navy/dark blue palette)

## Design Decisions
- **Altitude lines on left, reference curves on right**: The right side does NOT have labeled altitude lines. It has independent reference curves that define an interpolation field. You enter the right side at the crossover height from the left, then follow/interpolate between the reference curves as you move rightward to your target weight. The curves are just guide lines — they have no altitude labels and are not paired with the left side's altitude lines.
- **Calibration is per-side with N points**: Multi-point piecewise linear interpolation. Right side calibrated first (step 2) because it defines the distance axis. Left side only needs X (temperature) calibration — the crossover operates in pixel Y space directly.
- **Linear interpolation between clicked points**: No curve fitting — the user adds more points where the line curves to get accuracy.
- **Piecewise linear calibration**: N reference points per axis instead of 2 — better accuracy for non-linear chart axes from scanned/photographed POH.
- **Temperature sampling**: -20 to +40°C in 5°C steps (configurable in code).
- **Delta ISA computation**: `deltaIsa = tempC - (15.0 - 1.9812 * pressureAlt / 1000)` — matches the rPerf app's ISA lapse rate.
- **Dynamic altitude/curve lists**: Altitudes (step 4) and reference curves (step 5) are configurable — add/remove with custom values/names. Saved in project files.
- **Trace button states**: Trace turns red + disabled while active, Done turns green. Undo/Done disabled when not tracing.
- **Profile generator editable table**: After generating, data is shown in an editable table. Users can modify cells, add/delete rows before exporting.

## Known Limitations / Future Work
- No curve smoothing — relies on user placing enough points
- No visual preview of the computed crossover paths on the canvas
- Image is not saved in the project file — must be re-loaded manually

## User Context
- The user is a **private pilot** building rPerf for personal use
- Target aircraft: **Robin DR400** (French POH, DGAC format)
- Charts are scanned/photographed from the POH — image quality may vary
- Accuracy matters — this data feeds into real flight planning decisions
