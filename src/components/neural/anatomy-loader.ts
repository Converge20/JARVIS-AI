import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { SurfaceNetwork } from "./geometry";
const cache = new Map<
  string,
  Promise<{ model: GLTF; network: SurfaceNetwork }>
>();
async function fetchModel(quality: "full" | "eco") {
  const response = await fetch(`/models/brain-${quality}.glb.gz`);
  if (!response.ok) throw new Error("Anatomy asset could not be loaded");
  let buffer = await response.arrayBuffer();
  const header = new Uint8Array(buffer, 0, 2);
  // Also accept servers which have already decoded a Content-Encoding response.
  if (header[0] === 0x1f && header[1] === 0x8b) {
    if (typeof DecompressionStream === "undefined")
      throw new Error("This browser needs the Static anatomy view");
    buffer = await new Response(
      new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip")),
    ).arrayBuffer();
  }
  return new GLTFLoader().parseAsync(buffer, "");
}
export function anatomyResource(quality: "full" | "eco", attempt: number) {
  const key = `${quality}/${attempt}`;
  let resource = cache.get(key);
  if (!resource) {
    resource = Promise.all([
      fetchModel(quality),
      fetch(`/models/surface-network-${quality}.json`).then((r) => {
        if (!r.ok) throw new Error("Surface network could not be loaded");
        return r.json() as Promise<SurfaceNetwork>;
      }),
    ]).then(([model, network]) => ({ model, network }));
    cache.set(key, resource);
    if (cache.size > 4) cache.delete(cache.keys().next().value!);
  }
  return resource;
}
