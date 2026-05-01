# rPerf Tools — Product Overview

## Purpose
A browser-based tool to digitize two-part performance charts from Pilot's Operating Handbooks (POH) into CSV data. Designed to feed into the **rPerf** Flutter app, which interpolates takeoff and landing distances for general aviation aircraft.

## The Problem
POH performance data is published as graphical charts, not tables. Manually reading values from these charts is slow and error-prone. This tool lets pilots trace the chart lines once and automatically extract a full grid of performance data points.

## How POH Two-Part Charts Work
The chart has two halves sharing a common Y axis (pixel height):

- **Left side**: Temperature (°C) on X axis. Multiple **altitude lines** (one per pressure altitude). You enter with a temperature, go up to your altitude line, then draw a horizontal line across to the right side.
- **Right side**: Weight (kg) on X axis, Distance (meters) on Y axis. **Reference curves** (guide lines) define an interpolation field. You enter at the crossover height from the left side, then follow/interpolate between the curves as you move rightward to your target weight on the X axis, and read the distance on the Y axis.

**Key insight**: The left side has labeled altitude lines. The right side has independent reference curves that define the slope of the interpolation — they are NOT paired with altitudes. You follow them (or interpolate/extrapolate between them) from the entry point to your weight.

## Target Aircraft
Currently designed for the **Robin DR400** family:
- Altitude lines: 0, 2000, 4000, 8000 ft (configurable)
- Weight range: 800–1000 kg (configurable)
- Temperature range: -20 to +40 °C (configurable range and step)
- Charts are in French (DGAC-style POH)

## Output Format — Digitizer
CSV with columns: `weightKg`, `pressureAltitudeFt`, `deltaIsaC`, and one distance column:
- `takeoffGroundRollM` or `takeoffOver50M` (takeoff charts)
- `landingGroundRollM` or `landingOver50M` (landing charts)
- Delta ISA is computed from temperature and pressure altitude: `deltaIsa = temp - (15 - 1.9812 × PA/1000)`

## Output Format — Profile Generator
Complete rPerf aircraft profile in CSV or JSON:
- **CSV**: 19-column flat format with aircraft metadata repeated on every row (aircraftId, registration, name, mtowKg, grassPenalty, runwayType, performance data, correction factors)
- **JSON**: Structured format with top-level metadata, correctionFactors object, and points array
- Both formats are ready for direct import into rPerf
- See `plane_samples/` for examples (DR400_140b.csv, EVSS.csv, EVSS.json)

## Two-Tool Workflow
1. **POH Chart Digitizer** (`poh-chart-digitizer/index.html`): Digitize one chart at a time (takeoff or landing), export CSV
2. **Aircraft Profile Generator** (`aircraft-profile-generator/index.html`): Merge multiple CSVs, add aircraft metadata and correction factors, edit data in table, export final CSV or JSON

## Relationship to rPerf
The exported CSV/JSON is imported into rPerf, which uses trilinear interpolation (weight × pressure altitude × delta ISA) to compute distances for any conditions. rPerf repo: separate project.
