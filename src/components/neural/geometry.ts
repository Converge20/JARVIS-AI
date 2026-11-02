/** Activity routing on licensed anatomical mesh edges. No procedural brain surface. */
export type Vec3 = [number, number, number];
export interface SurfaceNode {
  position: Vec3;
  vertex: number;
  cluster: number;
  phase: number;
}
export interface SurfacePath {
  points: Vec3[];
  vertices: number[];
  cluster: number;
  phase: number;
}
export interface SurfaceNetwork {
  schema: number;
  offset: number;
  nodes: SurfaceNode[];
  paths: SurfacePath[];
  note: string;
}
export interface ArcPath extends SurfacePath {
  distances: Float32Array;
  length: number;
}
export function preparePath(path: SurfacePath): ArcPath {
  const distances = new Float32Array(path.points.length);
  for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1],
      b = path.points[i];
    distances[i] =
      distances[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }
  return { ...path, distances, length: distances[distances.length - 1] };
}
/** Piecewise linear interpolation stays on mesh edges; splines can cut through sulci. */
export function samplePath(
  path: ArcPath,
  progress: number,
  out: { x: number; y: number; z: number },
) {
  const distance = Math.max(0, Math.min(1, progress)) * path.length;
  let lo = 0,
    hi = path.distances.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path.distances[mid] < distance) lo = mid;
    else hi = mid;
  }
  const t =
    (distance - path.distances[lo]) /
    Math.max(1e-8, path.distances[hi] - path.distances[lo]);
  const a = path.points[lo],
    b = path.points[hi];
  out.x = a[0] + (b[0] - a[0]) * t;
  out.y = a[1] + (b[1] - a[1]) * t;
  out.z = a[2] + (b[2] - a[2]) * t;
  return out;
}
