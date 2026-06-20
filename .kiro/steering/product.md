# rPerf Tools — Product Overview

## Purpose
A browser-based tool to digitize multi-part performance charts from Pilot's Operating Handbooks (POH) into CSV data. Designed to feed into the **rPerf** Flutter app, which interpolates takeoff and landing distances for general aviation aircraft.

## The Problem
POH performance data is published as graphical charts, not tables. Manually reading values from these charts is slow and error-prone. This tool lets pilots trace the chart lines once and automatically extract a full grid of performance data points.

## How POH Multi-Part Charts Work
The chart has multiple sections that chain together, sharing a common Y axis (pixel height):

1. **Outside Air Temperature (OAT)**: Temperature (°C) on X axis. Multiple **altitude lines** (one per pressure altitude). You enter with a temperature, go up to your altitude line, then draw a horizontal line across to the next section.
2. **Gross Weight**: Weight (kg) on X axis, Distance (meters) on Y axis. **Reference curves** (guide lines) define an interpolation field. You enter at the crossover height from the OAT section, then follow/interpolate between the curves as you move rightward to your target weight.
3. **Wind** *(optional)*: Headwind/tailwind (kt) on X axis. Same curve-following principle. Negative values = tailwind, positive = headwind.
4. **Obstacle Height** *(optional)*: Obstacle height (m) on X axis. Same curve-following principle.

**Key insight**: The OAT section has labeled altitude lines. All other sections have independent reference curves that define the slope of the interpolation — they are NOT paired with altitudes. You follow them (or interpolate/extrapolate between them) from the entry point to your target value.

**Section chaining**: Sections chain together — the output pixel Y of one section becomes the input crossover Y of the next. Sections are optional: if not calibrated/traced, they are skipped.

## Target Aircraft
Designed for general aviation aircraft with POH performance charts:
- **Robin DR400** family (French POH, DGAC format) — 2-section charts (OAT + Weight)
- **Diamond DA20** — 4-section charts (OAT + Weight + Wind + Obstacle)
- Altitude lines, weight range, temperature range are all configurable

## Output Format — Digitizer
CSV with columns: `weightKg`, `pressureAltitudeFt`, `temperatureC`, and distance columns:
- `takeoffGroundRollM` and/or `takeoffOver50M` (takeoff charts)
- `landingGroundRollM` and/or `landingOver50M` (landing charts)
- When the obstacle section is active, both ground roll and over-50 columns are produced from a single chart
- When the wind section is active, distances are computed at 0 kt (baseline) and per-point wind correction factors (%/kt) are included

## Output Format — Profile Generator
Complete rPerf aircraft profile in CSV:
- 19-column flat format with aircraft metadata repeated on every row (aircraftId, registration, name, mtowKg, grassPenalty, runwayType, performance data, correction factors)
- Uses `temperatureC` (absolute OAT in °C) — the rPerf app converts to delta ISA internally
- Ready for direct import into rPerf
- See `plane_samples/` for examples

## Two-Tool Workflow
1. **POH Chart Digitizer** (`poh-chart-digitizer/index.html`): Digitize one chart at a time (takeoff or landing), export CSV with distances and optionally wind correction factors
2. **Aircraft Profile Generator** (`aircraft-profile-generator/index.html`): Merge multiple CSVs, add aircraft metadata and correction factors (auto-filled from CSVs if present), edit data in table, export final CSV

## Relationship to rPerf
The exported CSV/JSON is imported into rPerf, which uses trilinear interpolation (weight × pressure altitude × delta ISA) to compute distances for any conditions. rPerf repo: separate project.
