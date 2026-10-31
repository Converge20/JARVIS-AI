export function Core({
  listening,
  thinking,
}: {
  listening: boolean;
  thinking: boolean;
}) {
  return (
    <div
      className={`core-stage ${listening ? "is-listening" : ""}`}
      aria-label={`Assistant core: ${listening ? "simulated listening" : thinking ? "processing" : "ready"}`}
    >
      <div className="core-grid" />
      <span className="core-coordinate top-left">NEURAL INTERFACE / 01</span>
      <span className="core-coordinate bottom-right">LOCAL ENVIRONMENT</span>
      <div className="orbit orbit-outer" />
      <div className="orbit orbit-ticks" />
      <div className="orbit orbit-middle" />
      <div className="orbit orbit-inner" />
      <div className="core-cross horizontal" />
      <div className="core-cross vertical" />
      <div className="core-sphere">
        <div className="sphere-latitude" />
        <div className="sphere-longitude" />
        <span className="core-j">J</span>
        <span className="core-caption">J.A.R.V.I.S.</span>
      </div>
      <span className="core-point p1" />
      <span className="core-point p2" />
      <span className="core-point p3" />
      <div className="core-state">
        <span className="status-dot" />
        {listening
          ? "VOICE SIMULATION"
          : thinking
            ? "PROCESSING REQUEST"
            : "AWAITING YOUR COMMAND"}
      </div>
    </div>
  );
}
export function Waveform({ active = false }: { active?: boolean }) {
  return (
    <div className={`waveform ${active ? "active" : ""}`} aria-hidden="true">
      {Array.from({ length: 45 }, (_, i) => (
        <i
          key={i}
          style={{
            height: `${5 + Math.sin(i * 1.7) ** 2 * 22 + Math.sin(i * 0.4) ** 2 * 12}px`,
            animationDelay: `${i * -0.13}s`,
          }}
        />
      ))}
    </div>
  );
}
