"""Fuel-minimizing speed allocation for a fixed two-segment route.

The route is fixed. The decision is how to allocate the delivery time between
the two segments while respecting a shared minimum and maximum speed.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import isfinite

import numpy as np
from scipy.optimize import minimize_scalar


# Illustrative coefficients from the Team 17 project report.
# They are teaching values, not calibrated litres-per-kilometre data.
SEGMENT_1_COEFFICIENTS = (0.002, 2.0)
SEGMENT_2_COEFFICIENTS = (0.003, 2.0)


@dataclass(frozen=True)
class OptimizationResult:
    speed_1: float
    speed_2: float
    time_1: float
    time_2: float
    total_time: float
    fuel: float
    feasible_speed_1: tuple[float, float]
    equal_speed: float
    equal_speed_fuel: float | None
    savings_percent: float | None
    frontier: tuple[tuple[float, float], ...]


def fuel_consumption(distance_1: float, distance_2: float, speed_1: float, speed_2: float) -> float:
    """Return modeled fuel use in model units."""
    if speed_1 <= 0 or speed_2 <= 0:
        raise ValueError("Speeds must be positive.")

    a1, b1 = SEGMENT_1_COEFFICIENTS
    a2, b2 = SEGMENT_2_COEFFICIENTS
    per_km_1 = a1 * speed_1**2 + b1 / speed_1
    per_km_2 = a2 * speed_2**2 + b2 / speed_2
    return distance_1 * per_km_1 + distance_2 * per_km_2


def _validate_inputs(
    distance_1: float,
    distance_2: float,
    deadline: float,
    min_speed: float,
    max_speed: float,
) -> None:
    values = {
        "Segment 1 distance": distance_1,
        "Segment 2 distance": distance_2,
        "Delivery deadline": deadline,
        "Minimum speed": min_speed,
        "Maximum speed": max_speed,
    }
    for label, value in values.items():
        if not isfinite(value) or value <= 0:
            raise ValueError(f"{label} must be a positive number.")

    if min_speed >= max_speed:
        raise ValueError("Maximum speed must be greater than minimum speed.")

    fastest_time = (distance_1 + distance_2) / max_speed
    slowest_time = (distance_1 + distance_2) / min_speed
    tolerance = 1e-9
    if deadline < fastest_time - tolerance or deadline > slowest_time + tolerance:
        raise ValueError(
            "The deadline is infeasible for these speed limits. "
            f"The route would take between {fastest_time:.2f} and {slowest_time:.2f} hours."
        )


def optimize_route(
    distance_1: float,
    distance_2: float,
    deadline: float,
    min_speed: float = 20.0,
    max_speed: float = 80.0,
    frontier_points: int = 121,
) -> OptimizationResult:
    """Find the minimum-fuel speed plan and a curve of feasible alternatives.

    We optimize segment 1 travel time, t1. Segment 2 time is then
    deadline - t1, so every candidate satisfies the delivery-time equality.
    Speed bounds become simple lower and upper bounds on t1. The objective is
    strictly convex in positive travel times for the supplied coefficients.
    """
    _validate_inputs(distance_1, distance_2, deadline, min_speed, max_speed)
    if frontier_points < 3:
        raise ValueError("At least three frontier points are required.")

    # Each segment's travel time must stay within the time implied by the
    # shared speed limits.
    t1_low = max(distance_1 / max_speed, deadline - distance_2 / min_speed)
    t1_high = min(distance_1 / min_speed, deadline - distance_2 / max_speed)
    if t1_low > t1_high + 1e-9:
        raise ValueError("No feasible speed combination exists for these inputs.")
    t1_low = min(t1_low, t1_high)

    def fuel_for_t1(time_1: float) -> float:
        time_2 = deadline - time_1
        if time_1 <= 0 or time_2 <= 0:
            return float("inf")
        speed_1 = distance_1 / time_1
        speed_2 = distance_2 / time_2
        return fuel_consumption(distance_1, distance_2, speed_1, speed_2)

    candidates = [(t1_low, fuel_for_t1(t1_low)), (t1_high, fuel_for_t1(t1_high))]
    if t1_high - t1_low > 1e-12:
        interior = minimize_scalar(
            fuel_for_t1,
            bounds=(t1_low, t1_high),
            method="bounded",
            options={"xatol": 1e-12, "maxiter": 500},
        )
        if not interior.success:
            raise RuntimeError(f"Optimizer did not converge: {interior.message}")
        candidates.append((float(interior.x), float(interior.fun)))

    time_1, best_fuel = min(candidates, key=lambda item: item[1])
    time_2 = deadline - time_1
    speed_1 = distance_1 / time_1
    speed_2 = distance_2 / time_2

    # Convert the feasible time interval back into a segment 1 speed interval.
    speed_1_low = distance_1 / t1_high
    speed_1_high = distance_1 / t1_low

    equal_speed = (distance_1 + distance_2) / deadline
    baseline_is_feasible = min_speed - 1e-9 <= equal_speed <= max_speed + 1e-9
    if baseline_is_feasible:
        equal_speed_fuel = fuel_consumption(distance_1, distance_2, equal_speed, equal_speed)
        savings_percent = 100 * (equal_speed_fuel - best_fuel) / equal_speed_fuel
    else:
        equal_speed_fuel = None
        savings_percent = None

    speeds_1 = np.linspace(speed_1_low, speed_1_high, frontier_points)
    frontier = []
    for candidate_speed_1 in speeds_1:
        remaining_time = deadline - distance_1 / float(candidate_speed_1)
        candidate_speed_2 = distance_2 / remaining_time
        candidate_fuel = fuel_consumption(
            distance_1,
            distance_2,
            float(candidate_speed_1),
            candidate_speed_2,
        )
        frontier.append((float(candidate_speed_1), candidate_fuel))

    return OptimizationResult(
        speed_1=speed_1,
        speed_2=speed_2,
        time_1=time_1,
        time_2=time_2,
        total_time=time_1 + time_2,
        fuel=best_fuel,
        feasible_speed_1=(speed_1_low, speed_1_high),
        equal_speed=equal_speed,
        equal_speed_fuel=equal_speed_fuel,
        savings_percent=savings_percent,
        frontier=tuple(frontier),
    )
