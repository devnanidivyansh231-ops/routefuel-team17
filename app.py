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
    page_icon="⛽",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
    <style>
    .block-container {
        max-width: 1320px;
        padding-top: 2rem;
        padding-bottom: 3rem;
    }
    [data-testid="stAppViewContainer"] {
        background:
            radial-gradient(circle at 90% 0%, rgba(19, 125, 112, 0.08), transparent 27rem),
            #f5f8f6;
    }
    [data-testid="stHeader"] { background: transparent; }
    [data-testid="stSidebar"] {
        background: #fbfcfb;
        border-right: 1px solid #e3ebe7;
    }
    .rf-hero {
        position: relative;
        overflow: hidden;
        padding: 1.65rem 1.9rem;
        border: 1px solid #dce8e2;
        border-radius: 22px;
        background: linear-gradient(112deg, #ffffff 8%, #eef7f3 100%);
        box-shadow: 0 12px 34px rgba(25, 65, 52, 0.06);
    }
    .rf-kicker {
        margin-bottom: 0.55rem;
        color: #28796d;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.11em;
        text-transform: uppercase;
    }
    .rf-title {
        margin: 0;
        color: #17342e;
        font-size: clamp(1.8rem, 3vw, 2.5rem);
        font-weight: 700;
        letter-spacing: -0.045em;
        line-height: 1.08;
    }
    .rf-subtitle {
        max-width: 50rem;
        margin: 0.65rem 0 0;
        color: #566d65;
        font-size: 1rem;
        line-height: 1.6;
    }
    .rf-flow {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.55rem;
        margin: 1rem 0 1.35rem;
        color: #536961;
        font-size: 0.8rem;
    }
    .rf-flow-step {
        padding: 0.38rem 0.68rem;
        border: 1px solid #dfe9e4;
        border-radius: 999px;
        background: #ffffff;
    }
    .rf-flow-arrow { color: #8ba198; }
    [data-testid="stMetric"] {
        min-height: 118px;
        padding: 1.1rem 1.2rem;
        border: 1px solid #e1e9e5;
        border-radius: 17px;
        background: #ffffff;
        box-shadow: 0 5px 17px rgba(25, 65, 52, 0.035);
    }
    [data-testid="stMetricLabel"] p {
        color: #63786f;
        font-size: 0.83rem;
        font-weight: 500;
    }
    [data-testid="stMetricValue"] {
        color: #17342e;
        font-weight: 650;
        letter-spacing: -0.035em;
    }
    .rf-section-note {
        margin-top: -0.55rem;
        margin-bottom: 1rem;
        color: #65796f;
        font-size: 0.9rem;
    }
    .rf-allocation {
        display: flex;
        overflow: hidden;
        height: 12px;
        margin: 0.5rem 0 0.8rem;
        border-radius: 999px;
        background: #e6eeea;
    }
    .rf-allocation-one { background: #137d70; }
    .rf-allocation-two { background: #93cbbd; }
    .rf-small-note {
        color: #63786f;
        font-size: 0.82rem;
        line-height: 1.55;
    }
    div[data-testid="stFormSubmitButton"] button {
        min-height: 2.85rem;
        border-radius: 11px;
        font-weight: 650;
    }
    div[data-testid="stFormSubmitButton"] button[kind="primary"] {
        background: #137d70;
        border-color: #137d70;
    }
    div[data-testid="stFormSubmitButton"] button[kind="primary"]:hover {
        background: #0f6c61;
        border-color: #0f6c61;
    }
    div[data-testid="stExpander"] {
        border-color: #dfe8e3;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.72);
    }
    @media (max-width: 700px) {
        .block-container { padding-top: 1rem; }
        .rf-hero { padding: 1.25rem; border-radius: 16px; }
    }
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    """
    <section class="rf-hero">
      <div class="rf-kicker">CalSymPy · Team 17</div>
      <h1 class="rf-title">RouteFuel Optimizer</h1>
      <p class="rf-subtitle">
        Find a speed plan for two route segments that meets the delivery time
        while minimizing the fuel use predicted by your project model.
      </p>
    </section>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    """
    <div class="rf-flow" aria-label="How to use the app">
      <span class="rf-flow-step">1&nbsp; Set route details</span>
      <span class="rf-flow-arrow">→</span>
      <span class="rf-flow-step">2&nbsp; Optimize speeds</span>
      <span class="rf-flow-arrow">→</span>
      <span class="rf-flow-step">3&nbsp; Compare the result</span>
    </div>
    """,
    unsafe_allow_html=True,
)

with st.sidebar:
    st.header("Route details")
    st.caption("Enter the distances and delivery-time requirement.")
    with st.form("route_inputs"):
        distance_1 = st.number_input(
            "Segment 1 distance",
            min_value=0.1,
            value=40.0,
            step=1.0,
            help="Distance for the first part of the fixed route, in kilometres.",
        )
        distance_2 = st.number_input(
            "Segment 2 distance",
            min_value=0.1,
            value=60.0,
            step=1.0,
            help="Distance for the second part of the fixed route, in kilometres.",
        )
        deadline = st.number_input(
            "Delivery time",
            min_value=0.1,
            value=2.0,
            step=0.25,
            help="The model requires the two segment travel times to add to this value.",
        )
        st.markdown("**Allowed speed range**")
        speed_columns = st.columns(2)
        with speed_columns[0]:
            min_speed = st.number_input(
                "Minimum",
                min_value=0.1,
                value=20.0,
                step=1.0,
            )
        with speed_columns[1]:
            max_speed = st.number_input(
                "Maximum",
                min_value=0.2,
                value=80.0,
                step=1.0,
            )
        st.caption("The same speed limits apply to both segments.")
        st.form_submit_button(
            "Optimize route",
            type="primary",
            use_container_width=True,
        )
    st.divider()
    st.caption(
        "This prototype optimizes speeds on a fixed route. It does not select roads."
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
    st.info("Adjust the deadline or speed range, then select **Optimize route** again.")
    st.stop()

st.subheader("Recommended plan")
st.markdown(
    '<p class="rf-section-note">The app balances the two segment speeds so their travel times add up to the delivery time.</p>',
    unsafe_allow_html=True,
)

if result.savings_percent is None:
    saving_label = "No equal-speed comparison"
    saving_delta = "Baseline outside speed limits"
    delta_color = "off"
else:
    direction = "lower" if result.savings_percent >= 0 else "higher"
    saving_label = f"{abs(result.savings_percent):.2f}% {direction}"
    saving_delta = "vs. equal-speed plan"
    delta_color = "normal" if result.savings_percent >= 0 else "inverse"

metric_columns = st.columns(4)
metric_columns[0].metric("Segment 1 speed", f"{result.speed_1:.2f} km/h")
metric_columns[1].metric("Segment 2 speed", f"{result.speed_2:.2f} km/h")
metric_columns[2].metric("Modeled fuel use", f"{result.fuel:.3f} units")
metric_columns[3].metric(
    "Fuel difference",
    saving_label,
    delta=saving_delta,
    delta_color=delta_color,
)

st.success(
    f"Time check passed: {result.time_1:.2f} h on segment 1 + "
    f"{result.time_2:.2f} h on segment 2 = {result.total_time:.2f} h."
)

chart_column, explanation_column = st.columns([1.65, 1], gap="large")

with chart_column:
    st.subheader("Fuel use across feasible speed plans")
    st.markdown(
        '<p class="rf-section-note">Every point on the curve meets the delivery-time requirement.</p>',
        unsafe_allow_html=True,
    )
    speeds_1 = [point[0] for point in result.frontier]
    fuel_values = [point[1] for point in result.frontier]

    figure, axis = plt.subplots(figsize=(9.5, 4.8))
    figure.patch.set_facecolor("#ffffff")
    axis.set_facecolor("#ffffff")
    axis.plot(
        speeds_1,
        fuel_values,
        color="#137d70",
        linewidth=2.7,
        label="Feasible plans",
    )
    axis.scatter(
        [result.speed_1],
        [result.fuel],
        color="#137d70",
        edgecolor="#ffffff",
        linewidth=1.5,
        s=90,
        zorder=4,
        label="Optimized plan",
    )
    if result.equal_speed_fuel is not None:
        axis.scatter(
            [result.equal_speed],
            [result.equal_speed_fuel],
            color="#bb7c38",
            edgecolor="#ffffff",
            linewidth=1.5,
            s=80,
            zorder=4,
            label="Equal-speed baseline",
        )
    axis.set_xlabel("Segment 1 speed (km/h)", labelpad=10)
    axis.set_ylabel("Modeled fuel (units)", labelpad=10)
    axis.grid(axis="y", color="#e8efeb", linewidth=1)
    axis.set_axisbelow(True)
    axis.spines["top"].set_visible(False)
    axis.spines["right"].set_visible(False)
    axis.spines["left"].set_color("#d7e2dc")
    axis.spines["bottom"].set_color("#d7e2dc")
    axis.tick_params(colors="#5b7067")
    axis.legend(frameon=False, loc="best")
    figure.tight_layout(pad=1.5)
    st.pyplot(figure, use_container_width=True)
    plt.close(figure)

with explanation_column:
    st.subheader("Where the time goes")
    st.markdown(
        '<p class="rf-small-note">The total bar represents the full delivery time. The colours show how the optimizer splits it between the two segments.</p>',
        unsafe_allow_html=True,
    )
    segment_1_share = 100 * result.time_1 / result.total_time
    segment_2_share = 100 - segment_1_share
    st.markdown(
        f"""
        <div class="rf-allocation" role="img" aria-label="Time split: {segment_1_share:.1f}% for segment 1 and {segment_2_share:.1f}% for segment 2">
          <div class="rf-allocation-one" style="width:{segment_1_share:.4f}%"></div>
          <div class="rf-allocation-two" style="width:{segment_2_share:.4f}%"></div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    time_columns = st.columns(2)
    time_columns[0].metric("Segment 1 time", f"{result.time_1:.2f} h")
    time_columns[1].metric("Segment 2 time", f"{result.time_2:.2f} h")
    if result.equal_speed_fuel is not None:
        st.info(
            f"Equal-speed comparison: both segments at {result.equal_speed:.2f} km/h "
            f"uses {result.equal_speed_fuel:.3f} model units."
        )
    else:
        st.info(
            "An equal-speed comparison is unavailable because its speed falls outside "
            "the limits you selected."
        )

with st.expander("Understand the project model"):
    a1, b1 = SEGMENT_1_COEFFICIENTS
    a2, b2 = SEGMENT_2_COEFFICIENTS
    formula_column, explanation_column = st.columns([1.15, 1])
    with formula_column:
        st.markdown("**1. Fuel objective**")
        st.latex(
            rf"F(v_1,v_2) = {distance_1:g}({a1}v_1^2 + {b1:g}/v_1) "
            rf"+ {distance_2:g}({a2}v_2^2 + {b2:g}/v_2)"
        )
        st.markdown("**2. Delivery-time condition**")
        st.latex(
            rf"rac{{{distance_1:g}}}{{v_1}} + "
            rf"rac{{{distance_2:g}}}{{v_2}} = {deadline:g} mathrm{{hours}}"
        )
    with explanation_column:
        st.markdown(
            """
            - The terms with speed squared make higher speeds more costly in this model.
            - The reciprocal terms account for the model's lower-speed contribution.
            - The optimizer allocates travel time between the segments, then converts
              those times back into speeds.
            - The graph's lowest point is the recommended plan; the equal-speed point
              is the comparison.
            """
        )
        st.caption(
            "The coefficients are illustrative teaching values. Fuel is reported in "
            "model units, not litres."
        )

st.caption(
    "This model assumes constant average speed over each segment. It does not include "
    "traffic, stops, road grade, payload, weather, or measured vehicle data."
)
