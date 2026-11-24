import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  Fuel,
  Gauge,
  History,
  Leaf,
  LockKeyhole,
  LogOut,
  Route,
  Sparkles,
} from "lucide-react";
import {
  optimizeRoute,
  type OptimizationResult,
  type RouteInputs,
} from "./lib/optimizer";
import { backendReady, supabase } from "./lib/supabase";

type RouteFields = Record<keyof RouteInputs, string>;
type SavedRun = {
  id: string;
  created_at: string;
  distance_1: number;
  distance_2: number;
  deadline_hours: number;
  min_speed: number;
  max_speed: number;
  speed_1: number;
  speed_2: number;
  fuel_units: number;
  savings_percent: number | null;
};

const initialFields: RouteFields = {
  distance1: "40",
  distance2: "60",
  deadline: "2",
  minSpeed: "20",
  maxSpeed: "80",
};

const initialInputs: RouteInputs = {
  distance1: 40,
  distance2: 60,
  deadline: 2,
  minSpeed: 20,
  maxSpeed: 80,
};

const numberFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("en", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function App() {
  const [fields, setFields] = useState<RouteFields>(initialFields);
  const [result, setResult] = useState<OptimizationResult>(() =>
    optimizeRoute(initialInputs),
  );
  const [calculatedInputs, setCalculatedInputs] = useState<RouteInputs>(initialInputs);
  const [formError, setFormError] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [history, setHistory] = useState<SavedRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let active = true;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setMessage(error.message);
        setSession(data.session);
        setAuthLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setMessage("Could not read the saved sign-in session. Please reload.");
        setAuthLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadHistory = useCallback(async () => {
    if (!supabase || !session) {
      setHistory([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("route_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) {
        setMessage(`Saved plans could not be loaded: ${error.message}`);
        setHistory([]);
      } else {
        setHistory((data ?? []) as SavedRun[]);
      }
    } catch {
      setMessage("Saved plans could not be loaded. Check your connection and try again.");
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const userLabel = useMemo(() => {
    const fullName = session?.user.user_metadata?.full_name;
    return typeof fullName === "string" && fullName.trim()
      ? fullName
      : session?.user.email ?? "Signed in";
  }, [session]);
  const planIsCurrent = JSON.stringify(calculatedInputs) === JSON.stringify(currentInputs());

  function updateField(field: keyof RouteInputs, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
  }

  function currentInputs(): RouteInputs {
    return {
      distance1: Number(fields.distance1),
      distance2: Number(fields.distance2),
      deadline: Number(fields.deadline),
      minSpeed: Number(fields.minSpeed),
      maxSpeed: Number(fields.maxSpeed),
    };
  }

  function handleOptimize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    try {
      const inputs = currentInputs();
      setResult(optimizeRoute(inputs));
      setCalculatedInputs(inputs);
      setFormError("");
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Please check your route inputs.",
      );
    }
  }

  async function handleGoogleSignIn() {
    if (!supabase) return;
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) setMessage(`Google sign-in could not start: ${error.message}`);
    } catch {
      setMessage("Google sign-in could not start. Check your connection and provider setup.");
    }
  }

  async function handleSignOut() {
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) setMessage(`Could not sign out: ${error.message}`);
    } catch {
      setMessage("Could not sign out. Check your connection and try again.");
    }
  }

  async function handleSave() {
    if (!supabase || !session) return;
    setSaving(true);
    setMessage("");
    const input = calculatedInputs;
    try {
      const { data, error } = await supabase
        .from("route_runs")
        .insert({
          distance_1: input.distance1,
          distance_2: input.distance2,
          deadline_hours: input.deadline,
          min_speed: input.minSpeed,
          max_speed: input.maxSpeed,
          speed_1: result.speed1,
          speed_2: result.speed2,
          fuel_units: result.fuel,
          equal_speed_fuel_units: result.equalSpeedFuel,
          savings_percent: result.savingsPercent,
        })
        .select("*")
        .single();
      if (error) {
        setMessage(`This plan was not saved: ${error.message}`);
      } else if (data) {
        setHistory((current) => [data as SavedRun, ...current].slice(0, 8));
        setMessage("Plan saved to your account.");
      }
    } catch {
      setMessage("This plan was not saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function restoreRun(run: SavedRun) {
    const restoredInputs: RouteInputs = {
      distance1: run.distance_1,
      distance2: run.distance_2,
      deadline: run.deadline_hours,
      minSpeed: run.min_speed,
      maxSpeed: run.max_speed,
    };
    setFields({
      distance1: String(restoredInputs.distance1),
      distance2: String(restoredInputs.distance2),
      deadline: String(restoredInputs.deadline),
      minSpeed: String(restoredInputs.minSpeed),
      maxSpeed: String(restoredInputs.maxSpeed),
    });
    setResult(optimizeRoute(restoredInputs));
    setCalculatedInputs(restoredInputs);
    setFormError("");
    setMessage("Saved route loaded into the optimizer.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const displayName = userLabel.split("@")[0];

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="RouteFuel home">
          <span className="brand-icon"><Fuel size={19} strokeWidth={2.4} /></span>
          <span>routefuel<span className="wordmark-dot">.</span></span>
        </a>
        <div className="topbar-right">
          <a className="nav-link" href="#how-it-works">How it works</a>
          {!backendReady ? (
            <span className="preview-badge"><span /> Preview mode</span>
          ) : authLoading ? (
            <span className="auth-loading">Checking sign-in…</span>
          ) : session ? (
            <div className="account-chip">
              <span className="avatar" aria-hidden="true">
                {displayName.slice(0, 1).toUpperCase() || "U"}
              </span>
              <span className="account-name">{displayName}</span>
              <button
                className="icon-button"
                type="button"
                aria-label="Sign out"
                title="Sign out"
                onClick={handleSignOut}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              className="google-button"
              type="button"
              onClick={handleGoogleSignIn}
            >
              <GoogleMark />
              Continue with Google
            </button>
          )}
        </div>
      </header>

      <main id="top" className="main-content">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> CALSYMPY · TEAM 17</div>
            <h1>Plan a smoother<br /><span>way forward.</span></h1>
            <p>
              Find a fuel-aware speed plan for two route segments, while still
              arriving within your delivery time.
            </p>
            <a className="hero-link" href="#optimizer">
              Try the optimizer <ArrowDownRight size={17} />
            </a>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-glow" />
            <div className="route-card route-card-back">
              <span className="route-card-label">SEGMENT 02</span>
              <div className="route-card-line"><span /><i /></div>
              <strong>steady &amp; efficient</strong>
            </div>
            <div className="route-card route-card-front">
              <span className="route-card-label">YOUR ROUTE</span>
              <div className="route-card-route"><span /><b /><span /></div>
              <div className="route-card-footer"><span>2 segments</span><span><Clock3 size={13} /> on time</span></div>
            </div>
            <div className="eco-stamp"><Leaf size={16} /><span>MODELED<br />FUEL PLAN</span></div>
          </div>
          <div className="hero-footnote"><span className="status-pulse" /> A clear view of every trade-off</div>
        </section>

        {!backendReady && (
          <div className="setup-banner" role="status">
            <LockKeyhole size={18} />
            <div><strong>Local preview</strong><span>Optimization works now. Add Supabase keys to enable Google sign-in and saved plans.</span></div>
          </div>
        )}
        {message && <div className="message-banner" role="status">{message}</div>}

        <section id="optimizer" className="workspace">
          <div className="section-heading">
            <div>
              <span className="section-kicker">THE ROUTE PLANNER</span>
              <h2>Build your plan</h2>
              <p>Set your route and arrival time. We’ll find the best speed split.</p>
            </div>
            <div className="step-indicator"><span>01</span><i /><span className="step-current">02</span><i /><span>03</span></div>
          </div>

          <div className="planner-grid">
            <form className="input-card" onSubmit={handleOptimize}>
              <div className="card-title-row">
                <span className="card-icon"><Route size={18} /></span>
                <div><h3>Route details</h3><p>Distances and delivery window</p></div>
              </div>
              <div className="input-grid">
                <NumberField label="Segment 1 distance" suffix="km" value={fields.distance1} onChange={(value) => updateField("distance1", value)} />
                <NumberField label="Segment 2 distance" suffix="km" value={fields.distance2} onChange={(value) => updateField("distance2", value)} />
                <NumberField label="Delivery time" suffix="hours" value={fields.deadline} onChange={(value) => updateField("deadline", value)} />
              </div>
              <div className="field-divider"><span>Speed limits</span></div>
              <div className="input-grid speed-grid">
                <NumberField label="Minimum speed" suffix="km/h" value={fields.minSpeed} onChange={(value) => updateField("minSpeed", value)} />
                <NumberField label="Maximum speed" suffix="km/h" value={fields.maxSpeed} onChange={(value) => updateField("maxSpeed", value)} />
              </div>
              <p className="field-hint"><Gauge size={14} /> The same speed range applies to both segments.</p>
              {formError && <div className="error-box" role="alert">{formError}</div>}
              <button className="primary-button" type="submit">
                <Sparkles size={17} /> Optimize my route <ArrowUpRight size={17} />
              </button>
            </form>

            <section className="result-card" aria-live="polite">
              <div className="result-header">
                <div><span className="section-kicker">YOUR RECOMMENDATION</span><h3>Speed allocation</h3></div>
                <span className={`optimized-pill ${planIsCurrent ? "" : "optimized-pill-stale"}`}>
                  {planIsCurrent ? <><Check size={13} /> Optimized</> : "Inputs changed"}
                </span>
              </div>
              <div className="speed-results">
                <div className="speed-result speed-one"><span>SEGMENT 01</span><strong>{formatNumber(result.speed1)}<small>km/h</small></strong><i>Spend {formatNumber(result.time1)} h here</i></div>
                <div className="speed-connector" aria-hidden="true"><span>→</span></div>
                <div className="speed-result speed-two"><span>SEGMENT 02</span><strong>{formatNumber(result.speed2)}<small>km/h</small></strong><i>Spend {formatNumber(result.time2)} h here</i></div>
              </div>
              <div className="result-divider" />
              <div className="result-stats">
                <div><span><Fuel size={15} /> Modeled fuel</span><strong>{numberFormat.format(result.fuel)} <small>units</small></strong></div>
                <div><span><Clock3 size={15} /> Arrival time</span><strong>{formatNumber(result.totalTime)} <small>hours</small></strong></div>
              </div>
              {result.savingsPercent !== null && (
                <div className={`savings-note ${result.savingsPercent < 0 ? "savings-higher" : ""}`}>
                  <span className="savings-icon">{result.savingsPercent >= 0 ? <ArrowDownRight size={17} /> : <ArrowUpRight size={17} />}</span>
                  <span><strong>{Math.abs(result.savingsPercent).toFixed(2)}% {result.savingsPercent >= 0 ? "less" : "more"}</strong> modeled fuel than travelling both segments at one speed.</span>
                </div>
              )}
              <div className="result-actions">
                <span><Check size={15} /> Time constraint satisfied</span>
                <button
                  className="save-button"
                  type="button"
                  onClick={handleSave}
                  disabled={!session || !backendReady || saving || !planIsCurrent}
                  title={!session ? "Sign in with Google to save this plan" : !planIsCurrent ? "Optimize these inputs before saving" : "Save this plan to your account"}
                >
                  {saving ? "Saving…" : <><History size={15} /> Save plan</>}
                </button>
              </div>
            </section>
          </div>

          <section className="chart-card">
            <div className="chart-heading">
              <div><span className="section-kicker">THE TRADE-OFF</span><h3>Fuel across feasible speed plans</h3><p>Every point on this curve respects your time and speed limits.</p></div>
              <div className="chart-legend"><span><i className="legend-line" /> Feasible plans</span><span><i className="legend-dot" /> Recommended</span></div>
            </div>
            <FuelChart result={result} />
          </section>

          {backendReady && session && (
            <section className="history-section">
              <div className="history-heading"><div><span className="section-kicker">YOUR ACCOUNT</span><h3>Saved plans</h3></div><span className="history-count">{history.length} / 8</span></div>
              {historyLoading ? <p className="empty-history">Loading your plans…</p> : history.length === 0 ? (
                <div className="empty-history"><History size={19} /><span>Your saved route plans will appear here.</span></div>
              ) : (
                <div className="history-list">
                  {history.map((run) => (
                    <button className="history-item" type="button" key={run.id} onClick={() => restoreRun(run)}>
                      <span className="history-route"><strong>{formatNumber(run.distance_1, 0)} km</strong><i /> <strong>{formatNumber(run.distance_2, 0)} km</strong></span>
                      <span className="history-plan">{formatNumber(run.speed_1)} → {formatNumber(run.speed_2)} km/h</span>
                      <span className="history-fuel">{numberFormat.format(run.fuel_units)} units</span>
                      <span className="history-date">{new Date(run.created_at).toLocaleDateString()}</span>
                      <ChevronDown size={16} className="history-chevron" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
        </section>

        <section id="how-it-works" className="model-section">
          <div className="model-copy"><span className="section-kicker">THE MODEL, MADE CLEAR</span><h2>Two segments.<br /><span>One smart decision.</span></h2><p>The optimizer shares your available travel time between both route segments, then compares every feasible split using the project’s fuel formula.</p></div>
          <div className="model-equations">
            <div><span>SEGMENT FUEL PER KM</span><code>f₁(v₁) = 0.002v₁² + 2/v₁</code><code>f₂(v₂) = 0.003v₂² + 2/v₂</code></div>
            <div><span>MEET THE DELIVERY TIME</span><code>d₁/v₁ + d₂/v₂ = T</code></div>
            <p>Coefficients follow the report and are illustrative. Results are model units, not real fuel measurements.</p>
          </div>
        </section>
      </main>

      <footer className="footer"><a className="wordmark" href="#top"><span className="brand-icon"><Fuel size={16} /></span><span>routefuel<span className="wordmark-dot">.</span></span></a><span>Built for CalSymPy · Team 17</span><span>Model units are illustrative</span></footer>
    </div>
  );
}

function NumberField({
  label,
  suffix,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `field-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <label className="number-field" htmlFor={id}>
      <span>{label}</span>
      <span className="number-input-wrap"><input id={id} type="number" min="0.1" step="any" required value={value} onChange={(event) => onChange(event.target.value)} /><i>{suffix}</i></span>
    </label>
  );
}

function GoogleMark() {
  return (
    <svg className="google-mark" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M43.6 24.5c0-1.5-.1-3-.4-4.4H24v8.3h11a9.4 9.4 0 0 1-4.1 6.2v5.2h6.7c3.9-3.6 6-8.9 6-15.3Z" />
      <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.2c-1.8 1.2-4.1 2-6.8 2-5.3 0-9.8-3.6-11.4-8.5H5.7v5.4A20 20 0 0 0 24 44Z" />
      <path fill="#FBBC05" d="M12.6 27.4a12 12 0 0 1 0-7.6v-5.4H5.7a20 20 0 0 0 0 18.4l6.9-5.4Z" />
      <path fill="#EA4335" d="M24 11.3c3 0 5.7 1 7.8 3.1l5.9-5.9A19.7 19.7 0 0 0 24 3.1 20 20 0 0 0 5.7 14.4l6.9 5.4c1.6-5 6.1-8.5 11.4-8.5Z" />
    </svg>
  );
}

function FuelChart({ result }: { result: OptimizationResult }) {
  const width = 900;
  const height = 310;
  const padding = { top: 22, right: 22, bottom: 42, left: 62 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const fuels = result.frontier.map((point) => point.fuel);
  const minFuel = Math.min(...fuels);
  const maxFuel = Math.max(...fuels);
  const fuelSpan = Math.max(maxFuel - minFuel, minFuel * 0.03, 1);
  const lowerFuel = minFuel - fuelSpan * 0.08;
  const upperFuel = maxFuel + fuelSpan * 0.08;
  const [minimumSpeed, maximumSpeed] = result.feasibleSpeed1;
  const x = (speed: number) =>
    padding.left + ((speed - minimumSpeed) / Math.max(maximumSpeed - minimumSpeed, 1e-9)) * plotWidth;
  const y = (fuel: number) =>
    padding.top + ((upperFuel - fuel) / (upperFuel - lowerFuel)) * plotHeight;
  const path = result.frontier
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.speed1).toFixed(2)},${y(point.fuel).toFixed(2)}`)
    .join(" ");
  const markerX = x(result.speed1);
  const markerY = y(result.fuel);

  return (
    <div className="chart-wrap">
      <svg className="fuel-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Fuel use curve across feasible speeds. The highlighted point is the recommended plan.">
        {[0, 1, 2, 3].map((index) => {
          const tickY = padding.top + (plotHeight * index) / 3;
          const value = upperFuel - ((upperFuel - lowerFuel) * index) / 3;
          return <g key={index}><line x1={padding.left} x2={width - padding.right} y1={tickY} y2={tickY} className="chart-gridline" /><text x={padding.left - 12} y={tickY + 4} textAnchor="end" className="chart-tick">{value.toFixed(0)}</text></g>;
        })}
        {[0, 0.5, 1].map((fraction, index) => {
          const tickX = padding.left + plotWidth * fraction;
          const value = minimumSpeed + (maximumSpeed - minimumSpeed) * fraction;
          return <g key={index}><line x1={tickX} x2={tickX} y1={padding.top} y2={height - padding.bottom} className="chart-gridline vertical" /><text x={tickX} y={height - 15} textAnchor="middle" className="chart-tick">{value.toFixed(0)}</text></g>;
        })}
        <text x={width / 2} y={height - 1} textAnchor="middle" className="chart-axis-label">Segment 1 speed (km/h)</text>
        <text x="17" y={height / 2} textAnchor="middle" className="chart-axis-label" transform={`rotate(-90 17 ${height / 2})`}>Modeled fuel (units)</text>
        <path d={path} className="chart-path" />
        <circle cx={markerX} cy={markerY} r="8" className="chart-marker-halo" />
        <circle cx={markerX} cy={markerY} r="5" className="chart-marker" />
      </svg>
    </div>
  );
}

export default App;
