import { memo, useId, useMemo } from "react";
import {
  makeCorticalPaths,
  makeNodes,
  makeSignalPaths,
  projectPoint,
  cerebellumPoint,
} from "./geometry";
import type { Vec3 } from "./geometry";
import type { NeuralMode } from "./activity";
function pathFor(points: Vec3[]) {
  return points
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${projectPoint(p)
          .map((v) => v.toFixed(1))
          .join(",")}`,
    )
    .join(" ");
}
/** Static projection of the original 3D anatomy. No GPU or animation loop required. */
export const BrainFallback = memo(function BrainFallback({
  mode,
  variant,
}: {
  mode: NeuralMode;
  variant: number;
}) {
  const id = useId().replace(/:/g, "");
  const data = useMemo(
    () => ({
      folds: makeCorticalPaths(0.7).map(pathFor),
      nodes: makeNodes(350),
      signals: makeSignalPaths(18),
      cerebellum: Array.from({ length: 24 }, (_, i) =>
        pathFor(
          Array.from({ length: 70 }, (_, j) =>
            cerebellumPoint((j / 69) * Math.PI * 2, 0.12 + (i / 24) * 2.9),
          ),
        ),
      ),
    }),
    [],
  );
  const orange = ["analyzing", "task", "retrieval"].includes(mode);
  return (
    <svg
      className="brain-fallback"
      viewBox="0 0 700 460"
      aria-label="Static projection of a folded human brain"
      role="img"
    >
      <defs>
        <radialGradient id={`${id}-glow`}>
          <stop stopColor="#127dad" stopOpacity=".22" />
          <stop offset="1" stopColor="#05141f" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      <ellipse cx="350" cy="220" rx="250" ry="190" fill={`url(#${id}-glow)`} />
      <g fill="none" stroke="#389ecb" strokeWidth=".9" opacity=".5">
        {data.folds.map((d, i) => (
          <path d={d} key={i} />
        ))}
        {data.cerebellum.map((d, i) => (
          <path key={`c${i}`} d={d} />
        ))}
      </g>
      <g
        fill="none"
        stroke={orange ? "#ff9a53" : "#75e1ff"}
        strokeWidth="1.5"
        opacity=".8"
      >
        {data.signals
          .filter((p) => p.cluster === variant % 6 || mode === "retrieval")
          .slice(0, 9)
          .map((p, i) => (
            <path key={i} d={pathFor(p.points)} />
          ))}
      </g>
      <g filter={`url(#${id}-blur)`} opacity=".8">
        {data.nodes
          .filter((_, i) => i % 4 === 0)
          .map((n, i) => {
            const [cx, cy] = projectPoint(n.position);
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={3}
                fill={
                  orange && n.cluster === variant % 6 ? "#ff9a53" : "#42cfff"
                }
              />
            );
          })}
      </g>
      <g>
        {data.nodes.map((n, i) => {
          const [cx, cy] = projectPoint(n.position);
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={i % 7 === 0 ? 1.8 : 1}
              fill={orange && n.cluster === variant % 6 ? "#ffb976" : "#8ce6ff"}
              opacity={i % 3 === 0 ? 0.9 : 0.5}
            />
          );
        })}
      </g>
    </svg>
  );
});
