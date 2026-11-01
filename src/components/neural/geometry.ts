/** Original procedural anatomy, authored for this project; no downloaded models.
 * Coordinates: x = hemispheres, y = superior/inferior, z = anterior/posterior.
 * The cortex is a deformed parametric half-surface with domain-warped sulci,
 * temporal bulges, a separated medial fissure and an asymmetric lobe profile.
 * This is an artistic anatomical approximation, not a medical model.
 */
export type Vec3 = [number, number, number];
export function cortexPoint(
  u: number,
  v: number,
  side: number,
  lift = 0,
): Vec3 {
  const sv = Math.sin(v),
    cv = Math.cos(v);
  const warp =
    u +
    0.13 * Math.sin(6 * v + 1.7 * Math.sin(3 * u)) +
    0.035 * Math.sin(17 * v + 4 * u);
  const foldA = Math.sin(
    12 * warp + 1.4 * Math.sin(7 * v) + 0.3 * Math.cos(12 * v),
  );
  const foldB = Math.sin(
    11 * v + 1.0 * Math.sin(5 * u) + 0.3 * Math.cos(9 * u),
  );
  const grooves =
    Math.exp(-foldA * foldA * 22) * 0.095 +
    Math.exp(-foldB * foldB * 32) * 0.035;
  const folds = 1.025 - grooves;
  const temporal = 0.1 * Math.exp(-((v - 2.1) ** 2) * 7) * Math.sin(u) ** 2;
  const anterior = Math.cos(u);
  const x =
    side *
    (0.055 +
      (0.9 + temporal) * sv * Math.sin(u) * folds +
      lift * sv * Math.sin(u));
  const y =
    0.18 +
    0.9 * cv * folds +
    0.11 * anterior * sv -
    0.075 * Math.max(0, -cv) +
    lift * cv;
  const z = (1.75 + 0.12 * cv) * sv * anterior * folds + lift * sv * anterior;
  return [x, y, z];
}
export function cerebellumPoint(u: number, v: number): Vec3 {
  const ripple = 1 + 0.045 * Math.sin(v * 46 + 2 * Math.sin(u * 4));
  return [
    0.74 * Math.sin(v) * Math.sin(u) * ripple,
    -0.79 + 0.43 * Math.cos(v) * ripple,
    -0.91 + 0.64 * Math.sin(v) * Math.cos(u) * ripple,
  ];
}
export function makeSurface(
  point: (u: number, v: number) => Vec3,
  columns: number,
  rows: number,
  maxU = Math.PI,
) {
  const positions: number[] = [],
    indices: number[] = [];
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= columns; i++)
      positions.push(...point((i / columns) * maxU, (j / rows) * Math.PI));
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < columns; i++) {
      const a = j * (columns + 1) + i,
        b = a + columns + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  return { positions, indices };
}
export function createRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let n = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n;
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
export function clusterFor(p: Vec3) {
  return (p[0] < 0 ? 0 : 3) + (p[2] > 0.4 ? 0 : p[2] < -0.45 ? 2 : 1);
}
export interface NeuralNode {
  position: Vec3;
  cluster: number;
  phase: number;
}
export function makeNodes(count = 800): NeuralNode[] {
  const rand = createRandom(2517);
  return Array.from({ length: count }, (_, i) => {
    const position = cortexPoint(
      0.07 + rand() * (Math.PI - 0.14),
      Math.acos(1 - 2 * (0.04 + rand() * 0.92)),
      i % 2 ? 1 : -1,
      0.016,
    );
    return {
      position,
      cluster: clusterFor(position),
      phase: rand() * Math.PI * 2,
    };
  });
}
export function makeCorticalPaths(detail = 1) {
  const paths: Vec3[][] = [];
  for (const side of [-1, 1]) {
    for (let band = 0; band < Math.round(29 * detail); band++) {
      const base =
        0.1 + ((band + 0.5) / Math.round(29 * detail)) * (Math.PI - 0.2);
      const path: Vec3[] = [];
      for (let j = 0; j <= 100; j++) {
        const v = 0.13 + (j / 100) * (Math.PI - 0.26);
        let u = base;
        for (let solve = 0; solve < 4; solve++)
          u =
            base -
            0.13 * Math.sin(6 * v + 1.7 * Math.sin(3 * u)) -
            (1.4 * Math.sin(7 * v) + 0.3 * Math.cos(12 * v)) / 12;
        u = Math.max(0.025, Math.min(Math.PI - 0.025, u));
        path.push(cortexPoint(u, v, side, 0.007));
      }
      paths.push(path);
    }
    for (let band = 0; band < 7; band++) {
      const v = 0.27 + (band / 7) * 2.5,
        path: Vec3[] = [];
      for (let j = 0; j <= 90; j++) {
        const u = 0.06 + (j / 90) * (Math.PI - 0.12);
        path.push(
          cortexPoint(u, v + 0.035 * Math.sin(u * 15 + v * 6), side, 0.009),
        );
      }
      paths.push(path);
    }
  }
  return paths;
}
export function makeSignalPaths(count = 32) {
  const rand = createRandom(5801),
    paths: { points: Vec3[]; cluster: number; phase: number }[] = [];
  for (let i = 0; i < count; i++) {
    const side = i % 2 ? 1 : -1,
      u = 0.2 + rand() * 2.7,
      v = 0.4 + rand() * 1.85;
    const points: Vec3[] = [];
    for (let j = 0; j <= 24; j++) {
      const t = j / 24,
        nextU = Math.max(
          0.08,
          Math.min(3.06, u + (t - 0.5) * 1.2 + 0.09 * Math.sin(t * 9 + i)),
        );
      points.push(
        cortexPoint(
          nextU,
          Math.max(0.18, Math.min(2.94, v + (t - 0.5) * 0.55)),
          side,
          0.03,
        ),
      );
    }
    paths.push({ points, cluster: clusterFor(points[12]), phase: rand() });
  }
  // Sparse paths bridging the hemispheres add depth without filling the whole model.
  for (let i = 0; i < 6; i++) {
    const points: Vec3[] = [];
    const z = -0.9 + i * 0.34;
    for (let j = 0; j <= 32; j++) {
      const t = j / 32;
      points.push([
        Math.cos(t * Math.PI) * 0.85,
        0.1 + Math.sin(t * Math.PI) * 0.8,
        z,
      ]);
    }
    paths.push({ points, cluster: i, phase: rand() });
  }
  return paths;
}
/** Low-cost SVG projection of the same folded 3D surface for non-WebGL clients. */
export function projectPoint([x, y, z]: Vec3): [number, number] {
  const yaw = 0.66,
    pitch = 0.24;
  const px = x * Math.cos(yaw) + z * Math.sin(yaw),
    depth = z * Math.cos(yaw) - x * Math.sin(yaw);
  return [
    350 + px * 132,
    216 - (y * Math.cos(pitch) + depth * Math.sin(pitch)) * 132,
  ];
}

/** Short meandering gyri, merged into one lit mesh by the WebGL renderer. */
export function makeGyriPaths(): Vec3[][] {
  const paths: Vec3[][] = [];
  const rand = createRandom(1083);
  for (const side of [-1, 1])
    for (let column = 0; column < 7; column++)
      for (let row = 0; row < 5; row++) {
        const u0 = 0.16 + ((column + 0.45) / 7) * 2.78,
          v0 = 0.27 + ((row + 0.4) / 5) * 2.55;
        const phase = rand() * 6,
          points: Vec3[] = [];
        for (let step = 0; step <= 28; step++) {
          const t = step / 28;
          const u = Math.max(
            0.05,
            Math.min(
              3.09,
              u0 + (t - 0.5) * 0.35 + 0.08 * Math.sin(t * 6.28 + phase),
            ),
          );
          const v = Math.max(
            0.12,
            Math.min(
              3.02,
              v0 +
                0.15 * Math.sin(t * 5.5 + phase) +
                0.045 * Math.sin(t * 12 + phase),
            ),
          );
          points.push(cortexPoint(u, v, side, 0.018));
        }
        paths.push(points);
      }
  return paths;
}
