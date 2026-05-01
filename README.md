# rPerf Tools

Tools for creating aircraft performance profiles for the rPerf app.

## Structure

- `poh-chart-digitizer/` — Digitize POH two-part performance charts into CSV data
- `aircraft-profile-generator/` — Merge digitized CSVs into a complete rPerf aircraft profile (CSV or JSON)
- `plane_samples/` — Example output files

## Quick Start

Open `poh-chart-digitizer/index.html` to digitize charts, then `aircraft-profile-generator/index.html` to build the final profile.

---

## POH Chart Digitizer

Open `poh-chart-digitizer/index.html` in your browser.

### How the chart works

The chart has two halves:

- **Left side**: Enter with temperature (X axis), go up to your **altitude line**, then draw a horizontal line across to the right side.
- **Right side**: Weight (kg) on X axis, Distance (meters) on Y axis. **Reference curves** (guide lines) define the interpolation field. You enter at the crossover height from the left, then follow/interpolate between the curves rightward until you reach your weight on the X axis, and read the distance on the Y axis.

The left side has 4 altitude lines (0, 2000, 4000, 8000 ft). The right side has independent reference curves — they are NOT paired with altitudes.

### Usage

#### 1. Load Image

Load your chart image (e.g. `tkof_dr40.png`). Use **mouse wheel** to zoom.

#### 2. Calibrate Right Side

Click "Start Calibration" — click X points first (weight axis), then Y points (distance axis).

Default X points: 800, 900, 1000 kg (click "+Add" for more).
Default Y points: 0, 1000 m (click "+Add" for more).

#### 3. Calibrate Left Side

Same process but **X points only** (temperature axis). No Y calibration needed — the crossover uses pixel heights directly from the right side.

Default X points: -20, -10, 0, 10, 20, 30, 40 °C (click "+Add" for more).

The status bar shows real-world coordinates as you move the mouse — use this to verify calibration.

#### 4. Trace Altitude Lines — Left Side

For each altitude (0, 2000, 4000, 8000 ft):

1. Select the altitude from the dropdown
2. Click **Trace**
3. Click along the line from left to right (6–8 points, more where it curves)
4. Click **Done**

Use **Undo** to remove the last point if you misclick.

#### 5. Trace Reference Curves — Right Side

The right side has **reference curves** (guide lines) that define the interpolation field. For each visible curve:

1. Select the curve number from the dropdown
2. Click **Trace**
3. Click along the curve from left to right (or top to bottom)
4. Click **Done**

These curves are independent — they don't correspond to specific altitudes. The computation interpolates between them.

#### 6. Compute & Export

1. Set the temperature range and step (default: -20 to 40°C, step 5°C)
2. Enter the weights to sample (default: 800, 900, 1000 kg)
3. Select chart type (**Takeoff** or **Landing**) and distance type (**Ground Roll** or **Over 50ft/15m**)
4. Click **Compute Grid** — the tool follows the chart procedure: for each altitude+temperature, crosses to the right side, then follows/interpolates between the reference curves to each weight
5. Review the data in the text area
6. Click **Export CSV** to download

The exported CSV uses rPerf-compatible headers: `weightKg`, `pressureAltitudeFt`, `deltaIsaC`, and one of `takeoffGroundRollM`, `takeoffOver50M`, `landingGroundRollM`, or `landingOver50M`.

**Save/Load Project**: Save your calibration and traced lines as JSON to resume later (re-load the same image after loading a project). The project file uses the same name as the loaded image.

---

## Aircraft Profile Generator

Open `aircraft-profile-generator/index.html` in your browser. This tool creates a complete aircraft profile for rPerf:

1. Fill in aircraft info (ID, registration, name, MTOW, runway type)
2. Set correction factors (headwind/tailwind %/kt, slope %/%)
3. Load one or more digitized CSVs (takeoff and/or landing)
4. Click **Generate** — the tool merges them on the common key (`weightKg`, `pressureAltitudeFt`, `deltaIsaC`)
5. Export as **CSV** or **JSON** — both formats are ready for direct import into rPerf

See `plane_samples/` for example output files.

---

## Workflow for a Complete Aircraft

1. Load the **takeoff** chart, calibrate, trace altitude lines (left) and reference curves (right)
2. Select "Takeoff" + "Ground Roll" (or "Over 50ft"), compute, export CSV
3. Save project
4. Reload page, load the **landing** chart
5. Calibrate, trace, select "Landing" + distance type, compute, export CSV
6. Open `aircraft-profile-generator/index.html` to combine both CSVs into one file for rPerf

---

*Vibe-coded with ❤️ for fun*
