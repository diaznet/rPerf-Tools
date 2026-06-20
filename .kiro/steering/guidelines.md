# rPerf Tools — Guidelines

## Repository Structure
- `poh-chart-digitizer/` — Chart digitizer tool (index.html + JS modules + CSS + saved projects)
- `aircraft-profile-generator/` — Profile generator/merger tool (index.html + style.css + app.js)
- `plane_samples/` — Example rPerf output files
- `docs/images/` — Documentation images (e.g. example.png showing DA20 digitization)

## Code Style
- Modular files in `poh-chart-digitizer/`: `index.html` (markup), `style.css`, `calibration.js`, `tracing.js`, `compute.js`, `project.js`, `app.js`
- Modular files in `aircraft-profile-generator/`: `index.html` (markup), `style.css`, `app.js`
- No build tooling, no external dependencies — must work offline by opening the file in a browser
- Dark theme UI (navy/dark blue palette)

## Design Decisions
- **Altitude lines on OAT, reference curves on all other sections**: The Gross Weight / Wind / Obstacle sections do NOT have labeled altitude lines. They have independent reference curves that define an interpolation field. You enter each section at the crossover height from the previous section, then follow/interpolate between the reference curves as you move rightward to your target value. The curves are just guide lines — they have no altitude labels and are not paired with the OAT section's altitude lines.
- **Chainable optional sections**: After the Gross Weight section, charts may have additional sections (Wind, Obstacle Height). Each section works the same way: enter at a crossover Y, follow reference curves to a target X, output a new Y. Sections chain: Gross Weight → Wind → Obstacle. Sections are optional — if not calibrated/traced, they are skipped.
- **Wind section and correction factors**: When active, the tool computes baseline distances at 0 kt wind. It also samples user-specified wind values (e.g., -10, -5, 5, 10, 15, 20 kt) across all data points to derive average headwind %/kt and tailwind %/kt correction factors. Negative wind values = tailwind. The correction factors are displayed in the output for the user to enter in the profile generator.
- **Obstacle section**: When active, the tool automatically computes at 0 m (ground roll) and 15 m / 50 ft (over obstacle), producing both distance types from a single chart. The distance type dropdown is hidden.
- **Calibration is per-section with N points**: Multi-point piecewise linear interpolation. Gross Weight section calibrated first (step 2) because it defines the distance axis. OAT section only needs X (temperature) calibration — the crossover operates in pixel Y space directly.
- **Linear interpolation between clicked points**: No curve fitting — the user adds more points where the line curves to get accuracy.
- **Piecewise linear calibration**: N reference points per axis instead of 2 — better accuracy for non-linear chart axes from scanned/photographed POH.
- **Temperature sampling**: -20 to +40°C in 5°C steps (configurable).
- **Temperature format**: Always `temperatureC` (absolute OAT in °C). The rPerf app internally converts to delta ISA. No conversion in the tools.
- **Profile generator merges on key**: `weightKg`, `pressureAltitudeFt`, `temperatureC` — no conversion applied.
- **Dynamic altitude/curve lists**: Altitudes and reference curves (per section) are configurable — add/remove with custom values/names. Saved in project files.
- **Trace button states**: Trace turns red + disabled while active, Done turns green. Undo/Done disabled when not tracing.
- **Profile generator editable table**: After generating, data is shown in an editable table. Users can modify cells, add/delete rows before exporting.

## Known Limitations / Future Work
- No curve smoothing — relies on user placing enough points
- No visual preview of the computed crossover paths on the canvas
- Image is not saved in the project file — must be re-loaded manually

## User Context
- The user is a **private pilot** building rPerf for personal use
- Target aircraft: **Robin DR400** (2-section charts, French POH, DGAC format), **Diamond DA20** (4-section charts with wind and obstacle sections)
- Charts are scanned/photographed from the POH — image quality may vary
- Accuracy matters — this data feeds into real flight planning decisions
