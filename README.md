# RouteFuel Optimizer — Team 17

An educational web app that demonstrates how to allocate speeds across two fixed route segments while minimizing an illustrative fuel-consumption model and meeting a delivery deadline.

## What it does

- Accepts two segment distances, a delivery deadline, and minimum/maximum speeds.
- Checks whether the deadline is feasible under the selected speed range.
- Finds the modeled fuel-minimizing speed for each segment.
- Verifies the resulting travel time.
- Compares the optimized plan with an equal-speed baseline when that baseline is feasible.
- Plots fuel use across feasible speed plans.

## Model

The default example follows the Team 17 project report: 40 km, 60 km, a 2-hour deadline, and an illustrative speed range of 20–80 km/h.

The objective is:

    F(v1, v2) = d1 (0.002 v1^2 + 2 / v1) + d2 (0.003 v2^2 + 2 / v2)

subject to:

    d1 / v1 + d2 / v2 = deadline
    minimum_speed <= v1, v2 <= maximum_speed

The app solves the same problem by allocating time between the segments:

    t1 + t2 = deadline
    v1 = d1 / t1
    v2 = d2 / t2

For positive fuel-model coefficients, this gives a one-variable convex minimization problem. The app checks the interval endpoints as well as the numerical interior candidate.

## Run locally

Python 3.10 or later is recommended.

    python -m venv .venv

Activate the environment:

    Windows PowerShell: .\.venv\Scripts\Activate.ps1
    macOS or Linux:     source .venv/bin/activate

Install dependencies and launch:

    pip install -r requirements.txt
    streamlit run app.py

## Important limitation

The coefficients are hypothetical teaching values. The output is in model units, not litres. The model assumes constant average speeds on two already-selected segments and does not include traffic, stops, road grade, payload, weather, acceleration, or vehicle-specific measurements. Use measured vehicle data and legal, route-specific speed limits before interpreting the result as operational advice.
