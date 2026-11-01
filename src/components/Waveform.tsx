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
