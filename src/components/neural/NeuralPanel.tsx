import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  AudioLines,
  Brain,
  ChevronDown,
  Fingerprint,
  Focus,
  Gauge,
  Layers3,
  Mic,
  Network,
  RotateCcw,
  RotateCw,
  Search,
  Sparkles,
  Workflow,
} from "lucide-react";
import { BRAND } from "../../config/brand";
import { NEURAL_MODES, MODE_ORDER, SCENARIOS } from "./activity";
import type { NeuralMode } from "./activity";
import { BrainFallback } from "./BrainFallback";
import "./neural.css";
const BrainScene = lazy(() => import("./BrainScene"));
class RenderBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
const icons = {
  idle: Brain,
  listening: Mic,
  analyzing: Network,
  task: Workflow,
  retrieval: Search,
  responding: AudioLines,
};
export function NeuralPanel({
  mode,
  variant,
  motion,
  onMode,
  onScenario,
}: {
  mode: NeuralMode;
  variant: number;
  motion: boolean;
  onMode: (mode: NeuralMode) => void;
  onScenario: (scenario: (typeof SCENARIOS)[number]) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [anatomyView, setAnatomyView] = useState(false);
  const [quality, setQuality] = useState<"full" | "eco" | "static">("full");
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(true);
  const [inView, setInView] = useState(true);
  const [view, setView] = useState({ yaw: 0, pitch: 0, zoom: 1.25 });
  const [scenario, setScenario] = useState<string | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    yaw: number;
    pitch: number;
  } | null>(null);
  const onFailure = useCallback(() => setFailed(true), []);
  useEffect(() => {
    if (typeof WebGL2RenderingContext === "undefined") {
      setWebgl(false);
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2");
      setWebgl(!!context);
      context?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      setWebgl(false);
    }
  }, [retry]);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => setInView(entries[0].isIntersecting),
            { rootMargin: "80px" },
          )
        : null;
    if (root.current) observer?.observe(root.current);
    return () => {
      document.removeEventListener("visibilitychange", update);
      observer?.disconnect();
    };
  }, []);
  const is3D = webgl && !failed && quality !== "static";
  const animate = motion && !reduced && visible && inView;
  const info = NEURAL_MODES[mode];
  const fallback = (
    <BrainFallback mode={mode} variant={variant} anatomyView={anatomyView} />
  );
  return (
    <section
      className={`panel neural-panel neural-${info.accent} ${anatomyView ? "anatomy-inspection" : ""}`}
      aria-label="Neural intelligence interface"
    >
      <div className="neural-heading">
        <div className="neural-heading-icon">
          <Brain size={20} />
        </div>
        <div>
          <span className="neural-kicker">{BRAND.name} / NEURAL ENGINE</span>
          <h2>Intelligence, in a new form.</h2>
        </div>
        <span className="neural-live">
          <i />
          VISUAL SIMULATION
        </span>
      </div>
      <div className="neural-toolbar">
        <span>
          <Layers3 size={13} />
          {is3D
            ? "ANATOMICAL 3D MODEL"
            : webgl === null
              ? "INITIALIZING VIEW"
              : "LIGHTWEIGHT ANATOMY VIEW"}
        </span>
        <div>
          <button
            className="anatomy-toggle"
            aria-pressed={anatomyView}
            onClick={() => setAnatomyView((v) => !v)}
          >
            Anatomy · effects off
          </button>
          <label className="quality-control">
            <Gauge size={13} />
            <select
              aria-label="Visual quality"
              value={quality}
              onChange={(e) => setQuality(e.target.value as typeof quality)}
            >
              <option value="full">Full detail</option>
              <option value="eco">Eco · lower GPU use</option>
              <option value="static">Static · no WebGL</option>
            </select>
            <ChevronDown size={11} />
          </label>
        </div>
      </div>
      <div className="neural-stage" ref={root}>
        <div className="neural-atmosphere" />
        <div className="neural-floor" />
        <div className="neural-reticle tl" />
        <div className="neural-reticle tr" />
        <div className="neural-reticle bl" />
        <div className="neural-reticle br" />
        <div className="anatomy-label anatomy-label-left">
          <span className="label-cross">+</span>
          <small>CEREBRAL CORTEX</small>
          <span>MRI-derived cortical surface</span>
          <i />
        </div>
        <div className="anatomy-label anatomy-label-right">
          <i />
          <small>NEURAL PATHWAYS</small>
          <span>Simulated signal routing</span>
          <span className="label-cross">+</span>
        </div>
        <div
          className={`brain-viewport ${is3D ? "interactive" : ""}`}
          role={is3D ? "img" : undefined}
          aria-label={
            is3D
              ? "Interactive 3D human brain. Drag to rotate; rotation buttons are also available."
              : undefined
          }
          onPointerDown={(e) => {
            if (!is3D) return;
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              yaw: view.yaw,
              pitch: view.pitch,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (d)
              setView((v) => ({
                ...v,
                yaw: d.yaw + (e.clientX - d.x) * 0.007,
                pitch: Math.max(
                  -0.6,
                  Math.min(0.6, d.pitch + (e.clientY - d.y) * 0.005),
                ),
              }));
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          {is3D ? (
            <RenderBoundary
              key={retry}
              onFailure={onFailure}
              fallback={fallback}
            >
              <Suspense fallback={fallback}>
                <BrainScene
                  anatomyView={anatomyView}
                  attempt={retry}
                  mode={mode}
                  variant={variant}
                  animate={animate}
                  quality={quality === "eco" ? "eco" : "full"}
                  view={view}
                  onFailure={onFailure}
                />
              </Suspense>
            </RenderBoundary>
          ) : (
            fallback
          )}
        </div>
        <div className="brain-view-controls">
          <span>{is3D ? "DRAG TO EXPLORE" : "STATIC 3D PROJECTION"}</span>
          {is3D && (
            <>
              <button
                aria-label="Rotate brain left"
                onClick={() => setView((v) => ({ ...v, yaw: v.yaw - 0.3 }))}
              >
                <RotateCcw size={14} />
              </button>
              <button
                aria-label="Rotate brain right"
                onClick={() => setView((v) => ({ ...v, yaw: v.yaw + 0.3 }))}
              >
                <RotateCw size={14} />
              </button>
              <button
                aria-label="Reset brain view"
                onClick={() => setView({ yaw: 0, pitch: 0, zoom: 1.25 })}
              >
                <Focus size={14} />
              </button>
            </>
          )}
        </div>
        <div className="neural-state-readout">
          <span className="neural-state-dot" />
          <span>{info.label}</span>
          <small>
            {!is3D
              ? "STATIC VIEW"
              : !animate
                ? "MOTION PAUSED"
                : mode === "idle"
                  ? "AMBIENT ACTIVITY"
                  : "SIMULATED ACTIVITY"}
          </small>
        </div>
        {(!webgl || failed) && webgl !== null && (
          <div className="fallback-notice">
            {failed ? "3D rendering was interrupted." : "WebGL is unavailable."}{" "}
            Your workspace remains fully usable.
            <button
              onClick={() => {
                setFailed(false);
                setWebgl(null);
                setRetry((n) => n + 1);
              }}
            >
              Retry 3D
            </button>
          </div>
        )}
      </div>
      <div className="neural-controls">
        <div className="neural-section-label">
          <span>NEURAL STATES</span>
          <span>SELECT TO EXPLORE</span>
        </div>
        <div
          className="neural-state-buttons"
          role="group"
          aria-label="Neural demonstration states"
        >
          {MODE_ORDER.map((key) => {
            const Icon = icons[key];
            return (
              <button
                key={key}
                aria-pressed={mode === key}
                onClick={() => {
                  setScenario(null);
                  onMode(key);
                }}
              >
                <Icon size={14} />
                <span>{NEURAL_MODES[key].label}</span>
              </button>
            );
          })}
        </div>
        <p className="neural-description" aria-live="polite">
          {scenario &&
          SCENARIOS.find((s) => s.command === scenario)?.mode === mode
            ? SCENARIOS.find((s) => s.command === scenario)?.detail
            : info.description}
        </p>
      </div>
      <div className="scenario-area">
        <div className="neural-section-label">
          <span>
            <Sparkles size={12} /> TRY A SCENARIO
          </span>
          <span>PATTERN PREVIEWS</span>
        </div>
        <div className="scenario-buttons">
          {SCENARIOS.map((s) => (
            <button
              key={s.command}
              onClick={() => {
                setScenario(s.command);
                onScenario(s);
              }}
            >
              <span>{s.command}</span>
              <ArrowUpRight size={12} />
            </button>
          ))}
        </div>
        <p className="scenario-note">
          8-second visual previews. Commands are not executed.
        </p>
      </div>
      <div className="neural-disclaimer">
        <Fingerprint size={12} />
        <span>
          Artistic activity visualization. Not AI cognition or brain
          measurements.
        </span>
        <a
          className="anatomy-credit"
          href="/models/ATTRIBUTION.md"
          target="_blank"
          rel="noreferrer"
        >
          Model sources & licenses ↗
        </a>
      </div>
    </section>
  );
}
