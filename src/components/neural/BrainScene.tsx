import { memo, use, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { anatomyResource } from "./anatomy-loader";
import { preparePath, samplePath } from "./geometry";
import { RENDER_MODE_ORDER, simulatedAmplitude } from "./activity";
import type { NeuralMode } from "./activity";
export interface SceneProps {
  mode: NeuralMode;
  variant: number;
  animate: boolean;
  quality: "full" | "eco";
  anatomyView: boolean;
  attempt: number;
  view: { yaw: number; pitch: number; zoom: number };
  onFailure: () => void;
}
const activityGLSL = `
float activity(float cluster, float phase) {
  float index = mod(floor(uTime * 1.4) + uVariant, 6.0);
  float focused = 1.0 - step(0.5, abs(cluster - mod(uVariant, 6.0)));
  float sequence = 1.0 - step(0.5, abs(cluster - index));
  if (uMode > 5.5) return 0.08 + 0.2 * (0.5 + 0.5 * sin(uTime * 2.0));
  if (uMode < 0.5) return 0.08 + pow(max(0.0, sin(uTime * 0.65 + phase)), 12.0) * 0.25;
  if (uMode < 1.5) return 0.35 + uAmplitude * (0.35 + 0.3 * sin(uTime * 4.5 + phase * 0.3));
  if (uMode < 2.5) return 0.12 + sequence * (0.6 + 0.28 * sin(uTime * 8.0 + phase));
  if (uMode < 3.5) return 0.12 + focused * (0.65 + 0.2 * sin(uTime * 6.0));
  if (uMode < 4.5) return 0.25 + 0.7 * pow(max(0.0,sin(uTime * 2.5 + cluster * 0.85)), 3.0);
  return 0.3 + 0.65 * (0.5 + 0.5 * sin(uTime * 5.0));
}
vec3 signalColor(float cluster) {
  if (uMode > 5.5) return vec3(0.9,0.4,0.12);
  if (uMode > 1.5 && uMode < 4.5) {
    if (uMode > 3.5 && mod(cluster, 2.0) < 0.5) return vec3(0.08,0.65,1.0);
    return vec3(2.4,0.68,0.1);
  }
  return vec3(0.13,0.8,1.35);
}`;
const uniformGLSL =
  "uniform float uTime; uniform float uMode; uniform float uVariant; uniform float uAmplitude;";
const nodeVertex = `${uniformGLSL}
attribute float aCluster; attribute float aPhase; attribute float aSize;
varying float vPower; varying vec3 vColor;
${activityGLSL}
void main(){
 vPower=activity(aCluster,aPhase);vColor=signalColor(aCluster);
 vec4 mv=modelViewMatrix*vec4(position,1.0);
 gl_Position=projectionMatrix*mv;
 gl_PointSize=clamp(aSize*(0.7+vPower)*260.0/-mv.z,1.5,23.0);
}`;
const nodeFragment = `varying float vPower; varying vec3 vColor;
void main(){vec2 p=gl_PointCoord-0.5;float r=length(p);if(r>0.5)discard;
float glow=exp(-r*r*24.0);float core=exp(-r*r*190.0);
gl_FragColor=vec4(vColor*(0.85+vPower*0.4)+core*vec3(0.16),(glow*0.37+core*0.8)*(0.45+vPower));}`;
const lineVertex = `${uniformGLSL} attribute float aCluster; attribute float aPhase;
varying float vPower; varying vec3 vColor; ${activityGLSL}
void main(){vPower=activity(aCluster,aPhase);vColor=signalColor(aCluster);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const lineFragment = `varying float vPower; varying vec3 vColor;void main(){gl_FragColor=vec4(vColor,0.025+vPower*0.42);}`;
function CortexMaterial({ anatomyView }: { anatomyView: boolean }) {
  return (
    <meshPhysicalMaterial
      key={String(anatomyView)}
      color={anatomyView ? "#b4bac2" : "#176e9b"}
      roughness={anatomyView ? 0.74 : 0.38}
      metalness={anatomyView ? 0 : 0.08}
      clearcoat={anatomyView ? 0 : 0.65}
      transparent={!anatomyView}
      opacity={anatomyView ? 1 : 0.86}
      depthWrite
      onBeforeCompile={(shader) => {
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nattribute float _curvature; varying float vCorticalFold;",
          )
          .replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nvCorticalFold = _curvature;",
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying float vCorticalFold;",
          )
          .replace(
            "#include <color_fragment>",
            "#include <color_fragment>\ndiffuseColor.rgb *= clamp(0.9 - vCorticalFold * 0.9, 0.55, 1.1);",
          );
        if (!anatomyView)
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\nfloat axiomRim = pow(1.0-abs(dot(normal,normalize(vViewPosition))),3.0); totalEmissiveRadiance += vec3(0.02,0.18,0.28)*axiomRim;",
          );
      }}
      customProgramCacheKey={() => `axiom-cortical-surface-${anatomyView}`}
    />
  );
}
function Anatomy({
  mode,
  variant,
  animate,
  quality,
  anatomyView,
  attempt,
  view,
}: Omit<SceneProps, "onFailure">) {
  const { model, network } = use(anatomyResource(quality, attempt));
  const group = useRef<THREE.Group>(null);
  const time = useRef(0);
  const { invalidate, gl } = useThree();
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMode: { value: 0 },
      uVariant: { value: 0 },
      uAmplitude: { value: 0.5 },
    }),
    [],
  );
  useLayoutEffect(() => {
    gl.domElement.dataset.anatomyReady = "true";
    return () => {
      delete gl.domElement.dataset.anatomyReady;
    };
  }, [gl, model]);
  const data = useMemo(() => {
    const meshes: { name: string; geometry: THREE.BufferGeometry }[] = [];
    model.scene.traverse((object) => {
      if (object instanceof THREE.Mesh)
        meshes.push({ name: object.name, geometry: object.geometry.clone() });
    });
    const nodeGeometry = new THREE.BufferGeometry(),
      nodes = network.nodes;
    nodeGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        nodes.flatMap((n) => n.position),
        3,
      ),
    );
    nodeGeometry.setAttribute(
      "aCluster",
      new THREE.Float32BufferAttribute(
        nodes.map((n) => n.cluster),
        1,
      ),
    );
    nodeGeometry.setAttribute(
      "aPhase",
      new THREE.Float32BufferAttribute(
        nodes.map((n) => n.phase),
        1,
      ),
    );
    nodeGeometry.setAttribute(
      "aSize",
      new THREE.Float32BufferAttribute(
        nodes.map((_, i) => (i % 8 === 0 ? 0.12 : 0.075)),
        1,
      ),
    );
    const paths = network.paths.map(preparePath),
      positions: number[] = [],
      clusters: number[] = [],
      phases: number[] = [];
    for (const path of paths)
      for (let i = 0; i < path.points.length - 1; i++) {
        positions.push(...path.points[i], ...path.points[i + 1]);
        clusters.push(path.cluster, path.cluster);
        phases.push(path.phase * 6, path.phase * 6);
      }
    const signals = new THREE.BufferGeometry();
    signals.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    signals.setAttribute(
      "aCluster",
      new THREE.Float32BufferAttribute(clusters, 1),
    );
    signals.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1));
    const count = paths.length * 6,
      packets = new THREE.BufferGeometry();
    packets.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    packets.setAttribute(
      "aCluster",
      new THREE.Float32BufferAttribute(
        paths.flatMap((p) => Array(6).fill(p.cluster)),
        1,
      ),
    );
    packets.setAttribute(
      "aPhase",
      new THREE.Float32BufferAttribute(
        paths.flatMap((p) => Array(6).fill(p.phase * 6)),
        1,
      ),
    );
    packets.setAttribute(
      "aSize",
      new THREE.Float32BufferAttribute(
        Array.from({ length: count }, (_, i) => 0.2 * (1 - (i % 6) / 8)),
        1,
      ),
    );
    return { meshes, nodeGeometry, signals, packets, paths };
  }, [model, network]);
  useEffect(
    () => () => {
      [
        ...data.meshes.map((m) => m.geometry),
        data.nodeGeometry,
        data.signals,
        data.packets,
      ].forEach((g) => g.dispose());
    },
    [data],
  );
  useEffect(() => {
    invalidate();
    if (!animate) return;
    const timer = window.setInterval(
      invalidate,
      quality === "eco" || mode === "idle" ? 1000 / 30 : 1000 / 60,
    );
    return () => window.clearInterval(timer);
  }, [animate, mode, quality, invalidate]);
  useEffect(() => {
    invalidate();
  }, [view, mode, variant, anatomyView, invalidate]);
  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, delta) => {
    if (animate) time.current += Math.min(delta, 0.08);
    const t = time.current;
    uniforms.uTime.value = t;
    uniforms.uMode.value = RENDER_MODE_ORDER.indexOf(mode);
    uniforms.uVariant.value = variant;
    uniforms.uAmplitude.value = simulatedAmplitude(t);
    if (group.current) {
      group.current.rotation.set(
        view.pitch + (animate ? Math.sin(t * 0.19) * 0.012 : 0),
        view.yaw + (animate ? Math.sin(t * 0.13) * 0.035 : 0),
        0,
      );
      group.current.scale.setScalar(view.zoom);
    }
    if (anatomyView) return;
    group.current?.traverse((object) => {
      const material = (object as THREE.Mesh).material;
      if (material instanceof THREE.ShaderMaterial) {
        material.uniforms.uTime.value = t;
        material.uniforms.uMode.value = RENDER_MODE_ORDER.indexOf(mode);
        material.uniforms.uVariant.value = variant;
        material.uniforms.uAmplitude.value = uniforms.uAmplitude.value;
      }
    });
    const positions = data.packets.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    for (let i = 0; i < data.paths.length; i++)
      for (let tail = 0; tail < 6; tail++) {
        samplePath(
          data.paths[i],
          (t * (mode === "idle" || mode === "error" ? 0.025 : 0.18) +
            data.paths[i].phase -
            tail * 0.008 +
            1) %
            1,
          point,
        );
        positions.setXYZ(i * 6 + tail, point.x, point.y, point.z);
      }
    positions.needsUpdate = true;
  });
  return (
    <group ref={group}>
      {data.meshes.map(({ name, geometry }) => (
        <mesh
          key={name}
          name={name}
          geometry={geometry}
          castShadow
          receiveShadow
        >
          {name === "cortex" ? (
            <CortexMaterial anatomyView={anatomyView} />
          ) : (
            <meshPhysicalMaterial
              key={String(anatomyView)}
              color={
                anatomyView
                  ? "#a6afb9"
                  : name === "cerebellum"
                    ? "#167297"
                    : "#348cac"
              }
              roughness={anatomyView ? 0.75 : 0.4}
              metalness={anatomyView ? 0 : 0.1}
              clearcoat={anatomyView ? 0 : 0.5}
              transparent={!anatomyView}
              opacity={anatomyView ? 1 : 0.94}
              depthWrite
            />
          )}
        </mesh>
      ))}
      {!anatomyView && (
        <>
          <lineSegments renderOrder={2} geometry={data.signals}>
            <shaderMaterial
              vertexShader={lineVertex}
              fragmentShader={lineFragment}
              uniforms={uniforms}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </lineSegments>
          <points
            renderOrder={3}
            geometry={data.nodeGeometry}
            frustumCulled={false}
          >
            <shaderMaterial
              vertexShader={nodeVertex}
              fragmentShader={nodeFragment}
              uniforms={uniforms}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </points>
          <points renderOrder={4} geometry={data.packets} frustumCulled={false}>
            <shaderMaterial
              vertexShader={nodeVertex}
              fragmentShader={nodeFragment}
              uniforms={uniforms}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </points>
        </>
      )}
    </group>
  );
}
/** Small high-threshold bloom; the cortex remains sharply lit rather than glowing into an oval. */
function Bloom() {
  const { gl, scene, camera, size } = useThree();
  const pipeline = useMemo(() => {
    const composer = new EffectComposer(gl);
    const render = new RenderPass(scene, camera);
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(512, 512),
      0.22,
      0.35,
      1.05,
    );
    const output = new OutputPass();
    composer.addPass(render);
    composer.addPass(bloom);
    composer.addPass(output);
    return { composer, bloom, output };
  }, [gl, scene, camera]);
  useEffect(() => {
    pipeline.composer.setSize(size.width, size.height);
  }, [pipeline, size]);
  useEffect(
    () => () => {
      pipeline.composer.dispose();
      pipeline.bloom.dispose();
      pipeline.output.dispose();
    },
    [pipeline],
  );
  useFrame(() => pipeline.composer.render(), 1);
  return null;
}
function ContextWatcher({ onFailure }: { onFailure: () => void }) {
  const gl = useThree((state) => state.gl);
  useLayoutEffect(() => {
    const lost = (event: Event) => {
      event.preventDefault();
      onFailure();
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => gl.domElement.removeEventListener("webglcontextlost", lost);
  }, [gl, onFailure]);
  return null;
}
export default memo(function BrainScene(props: SceneProps) {
  const full = props.quality === "full";
  return (
    <Canvas
      key={props.quality}
      className="brain-canvas"
      frameloop="demand"
      shadows={full}
      dpr={full ? [1, 1.5] : 1}
      camera={{ position: [5.5, 1.7, 6], fov: 32, near: 0.1, far: 35 }}
      gl={{ alpha: true, antialias: full, powerPreference: "default" }}
      onCreated={({ gl, camera }) => {
        camera.lookAt(0, 0.02, 0);
        gl.setClearColor(0x000000, 0);
      }}
    >
      <ContextWatcher onFailure={props.onFailure} />
      <ambientLight
        intensity={props.anatomyView ? 0.65 : 0.55}
        color={props.anatomyView ? "#ffffff" : "#a9c6de"}
      />
      <directionalLight
        position={[3, 6, 4]}
        intensity={props.anatomyView ? 3 : 3.5}
        color={props.anatomyView ? "#fff5eb" : "#c2e7ff"}
        castShadow={full}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-camera-near={0.5}
        shadow-camera-far={15}
        shadow-normalBias={0.014}
        shadow-bias={-0.0002}
      />
      <directionalLight
        position={[-4, 1, -3]}
        intensity={props.anatomyView ? 1 : 2}
        color={props.anatomyView ? "#c6cbd4" : "#258bbb"}
      />
      <directionalLight
        position={[4, -2, 5]}
        intensity={props.anatomyView ? 1.1 : 1.4}
        color={props.anatomyView ? "#d6dce4" : "#78bdd8"}
      />
      <Anatomy {...props} />
      {full && !props.anatomyView && <Bloom />}
    </Canvas>
  );
});
