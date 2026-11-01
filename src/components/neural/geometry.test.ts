import { describe, expect, it } from "vitest";
import {
  cortexPoint,
  makeSurface,
  makeNodes,
  makeSignalPaths,
} from "./geometry";
import {
  SCENARIOS,
  MODE_ORDER,
  classifyActivity,
  simulatedAmplitude,
} from "./activity";
describe("original procedural anatomy", () => {
  it("creates separated, mirrored hemispheres with an elongated anatomical profile", () => {
    for (const u of [0.1, 0.7, 1.5, 2.4, 3])
      for (const v of [0.2, 1, 1.8, 2.6]) {
        const left = cortexPoint(u, v, -1),
          right = cortexPoint(u, v, 1);
        expect(left[0]).toBeLessThan(0);
        expect(right[0]).toBeGreaterThan(0);
        expect(left[0]).toBe(-right[0]);
        expect(left.slice(1)).toEqual(right.slice(1));
        expect(right.every(Number.isFinite)).toBe(true);
      }
    expect(cortexPoint(0.05, Math.PI / 2, 1)[2]).toBeGreaterThan(1.6);
  });
  it("produces valid indexed mesh geometry", () => {
    const { positions, indices } = makeSurface(
      (u, v) => cortexPoint(u, v, 1),
      32,
      40,
    );
    expect(positions.length).toBe(33 * 41 * 3);
    expect(indices.length).toBe(32 * 40 * 6);
    expect(indices.every((i) => i >= 0 && i < positions.length / 3)).toBe(true);
  });
  it("generates hundreds of deterministic nodes in six spatial clusters", () => {
    const nodes = makeNodes();
    expect(nodes).toHaveLength(800);
    expect(nodes).toEqual(makeNodes());
    expect(new Set(nodes.map((n) => n.cluster)).size).toBe(6);
    expect(nodes.every((n) => n.position.every(Number.isFinite))).toBe(true);
  });
  it("routes signals along continuous finite pathways", () => {
    const paths = makeSignalPaths();
    expect(paths.length).toBeGreaterThan(32);
    for (const path of paths) {
      expect(path.points.length).toBeGreaterThan(20);
      expect(path.points.flat().every(Number.isFinite)).toBe(true);
    }
  });
});
describe("demonstration activity", () => {
  it("provides six states and distinct mode/variant pairs for five scenarios", () => {
    expect(MODE_ORDER).toHaveLength(6);
    expect(SCENARIOS).toHaveLength(5);
    expect(new Set(SCENARIOS.map((s) => `${s.mode}/${s.variant}`)).size).toBe(
      5,
    );
  });
  it("classifies real interface requests", () => {
    expect(classifyActivity("Plan my schedule")).toBe("task");
    expect(classifyActivity("Explain a finance concept")).toBe("retrieval");
    expect(classifyActivity("Analyze information")).toBe("analyzing");
  });
  it("keeps synthetic audio amplitude bounded and dynamic", () => {
    const values = Array.from({ length: 100 }, (_, i) =>
      simulatedAmplitude(i * 0.1),
    );
    expect(values.every((n) => n >= 0 && n <= 1)).toBe(true);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.5);
  });
});
