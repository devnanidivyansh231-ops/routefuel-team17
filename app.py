"""Streamlit interface for the Team 17 RouteFuel optimizer."""

from __future__ import annotations

import matplotlib.pyplot as plt
import streamlit as st

from optimizer import (
    SEGMENT_1_COEFFICIENTS,
    SEGMENT_2_COEFFICIENTS,
    optimize_route,
)


st.set_page_config(
    page_title="RouteFuel Optimizer",
    page_icon="🛣️",
    layout="wide",
)

st.title("RouteFuel Optimizer")
st.caption("Explore a fuel-minimizing speed plan for a fixed, two-segment delivery route.")

with st.sidebar:
    st.header("Route inputs")
    distance_1 = st.number_input(
        "Segment 1 distance (km)",
        min_value=0.1,
        value=40.0,
        step=1.0,
    )
    distance_2 = st.number_input(
        "Segment 2 distance (km)",
        min_value=0.1,
        value=60.0,
        step=1.0,
    )
    deadline = st.number_input(
        "Delivery deadline (hours)",
        min_value=0.1,
        value=2.0,
        step=0.25,
    )
    min_speed = st.number_input(
        "Minimum speed (km/h)",
        min_value=0.1,
        value=20.0,
        step=1.0,
    )
    max_speed = st.number_input(
        "Maximum speed (km/h)",
        min_value=0.2,
        value=80.0,
        step=1.0,
    )

    st.divider()
    st.caption(
        "The route is treated as two fixed segments. The app selects one average "
        "speed for each segment."
    )

try:
    result = optimize_route(
        distance_1=distance_1,
        distance_2=distance_2,
        deadline=deadline,
        min_speed=min_speed,
        max_speed=max_speed,
    )
except (ValueError, RuntimeError) as error:
    st.error(str(error))
    st.info("Try adjusting the deadline or the speed limits.")
    st.stop()

st.subheader("Recommended speed plan")
speed_col_1, speed_col_2, time_col, fuel_col = st.columns(4)
speed_col_1.metric("Segment 1 speed", f"{result.speed_1:.2f} km/h")
speed_col_2.metric("Segment 2 speed", f"{result.speed_2:.2f} km/h")
time_col.metric("Total travel time", f"{result.total_time:.2f} h")
fuel_col.metric("Modeled fuel use", f"{result.fuel:.3f} units")

if result.savings_percent is None:
    st.info(
        f"The equal-speed baseline ({result.equal_speed:.2f} km/h) is outside the "
        "selected speed limits, so a like-for-like baseline comparison is unavailable."
    )
else:
    st.success(
        f"Compared with the equal-speed plan ({result.equal_speed:.2f} km/h), "
        f"the model estimates {result.savings_percent:.2f}% lower fuel use."
    )

plot_col, details_col = st.columns([1.65, 1])

with plot_col:
    st.subheader("Fuel use while meeting the deadline")
    speeds_1 = [point[0] for point in result.frontier]
    fuel_values = [point[1] for point in result.frontier]

    figure, axis = plt.subplots(figsize=(9, 4.7))
    axis.plot(
        speeds_1,
        fuel_values,
        color="#137d70",
        linewidth=2.5,
        label="Feasible speed plans",
    )
    axis.scatter(
        [result.speed_1],
        [result.fuel],
        color="#137d70",
        s=65,
        zorder=3,
        label="Optimized plan",
    )
    if result.equal_speed_fuel is not None:
        axis.scatter(
            [result.equal_speed],
            [result.equal_speed_fuel],
            color="#bb7c38",
            s=58,
            zorder=3,
            label="Equal-speed baseline",
        )
    axis.set_xlabel("Segment 1 speed (km/h)")
    axis.set_ylabel("Modeled fuel (units)")
    axis.grid(True, alpha=0.22)
    axis.legend(frameon=False)
    figure.tight_layout()
    st.pyplot(figure, use_container_width=True)
    plt.close(figure)

with details_col:
    st.subheader("Time allocation")
    st.dataframe(
        [
            {
                "Segment": "1",
                "Distance (km)": distance_1,
                "Speed (km/h)": result.speed_1,
                "Travel time (h)": result.time_1,
            },
            {
                "Segment": "2",
                "Distance (km)": distance_2,
                "Speed (km/h)": result.speed_2,
                "Travel time (h)": result.time_2,
            },
        ],
        hide_index=True,
        use_container_width=True,
    )
    st.metric("Deadline", f"{deadline:.2f} h")
    st.metric(
        "Time check",
        f"{result.total_time:.4f} h",
        delta=f"{result.total_time - deadline:+.6f} h from deadline",
    )

with st.expander("How the calculation works"):
    a1, b1 = SEGMENT_1_COEFFICIENTS
    a2, b2 = SEGMENT_2_COEFFICIENTS
    st.markdown(
        f"""
        **Fuel objective**

        F = d₁({a1}v₁² + {b1}/v₁) + d₂({a2}v₂² + {b2}/v₂)

        **Delivery-time constraint**

        d₁/v₁ + d₂/v₂ = deadline

        The optimizer allocates the available travel time between the two
        segments, converts those times back into speeds, and checks the result
        against the selected speed limits.
        """
    )

st.caption(
    "The coefficients are illustrative teaching values. Results are model units, "
    "not measured litres or a real-world fuel-saving guarantee."
)
