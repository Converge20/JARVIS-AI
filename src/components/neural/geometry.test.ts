import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { preparePath, samplePath } from "./geometry";
import type { SurfaceNetwork } from "./geometry";
import {
  SCENARIOS,
  MODE_ORDER,
  classifyActivity,
  simulatedAmplitude,
} from "./activity";
function readModel(quality: string) {
  const compressed = readFileSync(`public/models/brain-${quality}.glb.gz`),
    raw = gunzipSync(compressed);
  const jsonLength = raw.readUInt32LE(12),
    doc = JSON.parse(raw.subarray(20, 20 + jsonLength).toString()),
    binaryStart = 28 + jsonLength;
  function array(index: number) {
    const a = doc.accessors[index],
      v = doc.bufferViews[a.bufferView],
      dimensions = a.type === "VEC3" ? 3 : 1;
    const offset = binaryStart + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return Array.from({ length: a.count * dimensions }, (_, i) =>
      a.componentType === 5126
        ? raw.readFloatLE(offset + i * 4)
        : raw.readUInt32LE(offset + i * 4),
    );
  }
  const cortex = doc.meshes.find((m: { name: string }) => m.name === "cortex")
    .primitives[0];
  return {
    compressed,
    doc,
    cortex: {
      positions: array(cortex.attributes.POSITION),
      normals: array(cortex.attributes.NORMAL),
      indices: array(cortex.indices),
    },
    array,
  };
}
const provenance = JSON.parse(
  readFileSync("public/models/provenance.json", "utf8"),
);
describe("licensed anatomical meshes", () => {
  it.each(["full", "eco"])(
    "ships verified %s assets with the five real mesh parts",
    (quality) => {
      const model = readModel(quality);
      expect(createHash("sha256").update(model.compressed).digest("hex")).toBe(
        provenance.outputs[quality].sha256,
      );
      expect(model.doc.meshes.map((m: { name: string }) => m.name)).toEqual([
        "cortex",
        "cerebellum",
        "midbrain",
        "pons",
        "medulla",
      ]);
      expect(model.cortex.positions.every(Number.isFinite)).toBe(true);
      for (const mesh of model.doc.meshes) {
        const n = model.array(mesh.primitives[0].attributes.NORMAL);
        for (let i = 0; i < n.length; i += 3)
          expect(Math.hypot(n[i], n[i + 1], n[i + 2])).toBeCloseTo(1, 3);
      }

      expect(
        model.cortex.indices.every(
          (i) => i >= 0 && i < model.cortex.positions.length / 3,
        ),
      ).toBe(true);
    },
  );
  it("retains the 150,256-triangle native cortex, natural hemispheric variation and lower structures", () => {
    const m = readModel("full");
    expect(m.cortex.indices.length / 3).toBe(150256);
    const p = m.cortex.positions,
      positive: number[][] = [],
      negative: number[][] = [];
    for (let i = 0; i < p.length; i += 3)
      (p[i] > 0 ? positive : negative).push(p.slice(i, i + 3));
    expect(positive.length).toBeGreaterThan(20000);
    expect(negative.length).toBeGreaterThan(20000);
    const sample = positive.filter((_, i) => i % 4000 === 0);
    const distances = sample.map(([x, y, z]) =>
      Math.min(...negative.map(([a, b, c]) => Math.hypot(a + x, b - y, c - z))),
    );
    expect(
      distances.reduce((a, b) => a + b, 0) / distances.length,
    ).toBeGreaterThan(0.005);
    const minCortexY = Math.min(...p.filter((_, i) => i % 3 === 1));
    const medulla = m.doc.meshes.find(
      (v: { name: string }) => v.name === "medulla",
    ).primitives[0];
    const medullaY = m
      .array(medulla.attributes.POSITION)
      .filter((_, i) => i % 3 === 1);
    expect(Math.min(...medullaY)).toBeLessThan(minCortexY - 0.5);
  });
});
describe("surface-attached activity", () => {
  it.each(["full", "eco"])(
    "attaches every %s node and route to that LOD cortex; all path steps are actual mesh edges",
    (quality) => {
      const model = readModel(quality),
        network = JSON.parse(
          readFileSync(`public/models/surface-network-${quality}.json`, "utf8"),
        ) as SurfaceNetwork;
      const { positions: p, normals: n, indices: f } = model.cortex,
        edges = new Set<string>();
      for (let i = 0; i < f.length; i += 3)
        for (const [a, b] of [
          [f[i], f[i + 1]],
          [f[i + 1], f[i + 2]],
          [f[i + 2], f[i]],
        ])
          edges.add(`${Math.min(a, b)}/${Math.max(a, b)}`);
      const check = (id: number, point: number[]) => {
        for (let k = 0; k < 3; k++)
          expect(
            Math.abs(point[k] - p[id * 3 + k] - n[id * 3 + k] * network.offset),
          ).toBeLessThan(0.000002);
      };
      expect(network.nodes.length).toBe(quality === "full" ? 640 : 320);
      expect(new Set(network.nodes.map((n) => n.cluster)).size).toBe(6);
      for (const node of network.nodes) check(node.vertex, node.position);
      for (const path of network.paths) {
        expect(path.vertices.length).toBeGreaterThan(2);
        path.vertices.forEach((v, i) => {
          check(v, path.points[i]);
          if (i) {
            const a = path.vertices[i - 1];
            expect(edges.has(`${Math.min(a, v)}/${Math.max(a, v)}`)).toBe(true);
          }
        });
      }
    },
  );
  it("interpolates packet motion along a mesh edge without a spline shortcut", () => {
    const network = JSON.parse(
        readFileSync("public/models/surface-network-full.json", "utf8"),
      ) as SurfaceNetwork,
      path = preparePath(network.paths[0]);
    const out = samplePath(path, path.distances[1] / path.length / 2, {
      x: 0,
      y: 0,
      z: 0,
    });
    const a = path.points[0],
      b = path.points[1];
    expect(out.x).toBeCloseTo((a[0] + b[0]) / 2, 6);
    expect(out.y).toBeCloseTo((a[1] + b[1]) / 2, 6);
    expect(out.z).toBeCloseTo((a[2] + b[2]) / 2, 6);
  });
});
describe("demonstration activity", () => {
  it("provides all six states and five distinct scenario profiles", () => {
    expect(MODE_ORDER).toHaveLength(6);
    expect(new Set(SCENARIOS.map((s) => `${s.mode}/${s.variant}`)).size).toBe(
      5,
    );
  });
  it("classifies application requests", () => {
    expect(classifyActivity("Plan my schedule")).toBe("task");
    expect(classifyActivity("Explain a finance concept")).toBe("retrieval");
    expect(classifyActivity("Analyze information")).toBe("analyzing");
  });
  it("keeps generated audio amplitude bounded and dynamic", () => {
    const v = Array.from({ length: 100 }, (_, i) =>
      simulatedAmplitude(i * 0.1),
    );
    expect(v.every((n) => n >= 0 && n <= 1)).toBe(true);
    expect(Math.max(...v) - Math.min(...v)).toBeGreaterThan(0.5);
  });
});
