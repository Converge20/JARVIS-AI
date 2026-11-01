import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  cortexPoint,
  cerebellumPoint,
  makeSurface,
  makeNodes,
  makeCorticalPaths,
  makeSignalPaths,
  makeGyriPaths,
} from "./geometry";
import { MODE_ORDER, simulatedAmplitude } from "./activity";
import type { NeuralMode } from "./activity";
import type { Vec3 } from "./geometry";
export interface SceneProps {
  mode: NeuralMode;
  variant: number;
  animate: boolean;
  quality: "full" | "eco";
  view: { yaw: number; pitch: number; zoom: number };
  onFailure: () => void;
}
const activityGLSL = `
float activity(float cluster, float phase) {
  float index = mod(floor(uTime * 1.4) + uVariant, 6.0);
  float focused = 1.0 - step(0.5, abs(cluster - mod(uVariant, 6.0)));
  float sequence = 1.0 - step(0.5, abs(cluster - index));
  if (uMode < 0.5) return 0.08 + pow(max(0.0, sin(uTime * 0.65 + phase)), 12.0) * 0.25;
  if (uMode < 1.5) return 0.35 + uAmplitude * (0.35 + 0.3 * sin(uTime * 4.5 + phase * 0.3));
  if (uMode < 2.5) return 0.12 + sequence * (0.6 + 0.28 * sin(uTime * 8.0 + phase));
  if (uMode < 3.5) return 0.12 + focused * (0.65 + 0.2 * sin(uTime * 6.0));
  if (uMode < 4.5) return 0.25 + 0.7 * pow(max(0.0,sin(uTime * 2.5 + cluster * 0.85)), 3.0);
  return 0.3 + 0.65 * (0.5 + 0.5 * sin(uTime * 5.0));
}
vec3 signalColor(float cluster) {
  if (uMode > 1.5 && uMode < 4.5) {
    if (uMode > 3.5 && mod(cluster, 2.0) < 0.5) return vec3(0.08,0.65,1.0);
    return vec3(1.0,0.36,0.07);
  }
  return vec3(0.12,0.74,1.0);
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
gl_FragColor=vec4(mix(vColor,vec3(0.8,0.96,1.0),core*0.55),(glow*0.37+core*0.8)*(0.45+vPower));}`;
const lineVertex = `${uniformGLSL} attribute float aCluster; attribute float aPhase;
varying float vPower; varying vec3 vColor; ${activityGLSL}
void main(){vPower=activity(aCluster,aPhase);vColor=signalColor(aCluster);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const lineFragment = `varying float vPower; varying vec3 vColor;void main(){gl_FragColor=vec4(vColor,0.06+vPower*0.5);}`;
const rimVertex = `varying vec3 vNormal; varying vec3 vEye; varying vec3 vPosition;
void main(){vec4 p=modelViewMatrix*vec4(position,1.0);vNormal=normalize(normalMatrix*normal);vEye=normalize(-p.xyz);vPosition=position;gl_Position=projectionMatrix*p;}`;
const rimFragment = `uniform float uTime;varying vec3 vNormal;varying vec3 vEye;varying vec3 vPosition;
void main(){float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vEye))),2.4);float scan=0.5+0.5*sin(vPosition.y*110.0+uTime*.6);gl_FragColor=vec4(vec3(.05,.54,.86)+rim*vec3(.15,.32,.35),.012+rim*.13+scan*.004);}`;
function geometryFrom(points: Vec3[][]) {
  const positions: number[] = [];
  for (const path of points)
    for (let i = 0; i < path.length - 1; i++)
      positions.push(...path[i], ...path[i + 1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return g;
}
function Anatomy({
  mode,
  variant,
  animate,
  quality,
  view,
}: Omit<SceneProps, "onFailure">) {
  const group = useRef<THREE.Group>(null);
  const time = useRef(0);
  const shaderMaterials = useRef<THREE.ShaderMaterial[]>([]);
  const { invalidate } = useThree();
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMode: { value: 0 },
      uVariant: { value: 0 },
      uAmplitude: { value: 0.5 },
    }),
    [],
  );
  const data = useMemo(() => {
    const full = quality === "full";
    const cortex = [-1, 1].map((side) => {
      const raw = makeSurface(
        (u, v) => cortexPoint(u, v, side),
        full ? 112 : 64,
        full ? 136 : 80,
      );
      if (side < 0) raw.indices.reverse();
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(raw.positions, 3),
      );
      g.setIndex(raw.indices);
      g.computeVertexNormals();
      return g;
    });
    const cb = makeSurface(cerebellumPoint, 64, 64, Math.PI * 2);
    const cerebellum = new THREE.BufferGeometry();
    cerebellum.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(cb.positions, 3),
    );
    cerebellum.setIndex(cb.indices);
    cerebellum.computeVertexNormals();
    const stem = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.55, -0.5),
        new THREE.Vector3(0, -1.02, -0.55),
        new THREE.Vector3(0.02, -1.48, -0.7),
      ]),
      24,
      0.14,
      10,
      false,
    );
    const paths = makeCorticalPaths(full ? 1 : 0.65);
    const folds = geometryFrom(paths);
    const gyrusTubes = makeGyriPaths()
      .filter((_, i) => full || i % 2 === 0)
      .map(
        (p) =>
          new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(p.map((v) => new THREE.Vector3(...v))),
            full ? 40 : 24,
            0.033,
            full ? 7 : 5,
            false,
          ),
      );
    const gyri = mergeGeometries(gyrusTubes);
    gyrusTubes.forEach((g) => g.dispose());
    const nodes = makeNodes(full ? 960 : 480);
    const nodeGeometry = new THREE.BufferGeometry();
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
        nodes.map((_, i) => (i % 7 === 0 ? 0.25 : 0.13)),
        1,
      ),
    );
    const signalPaths = makeSignalPaths(full ? 36 : 20);
    const signals = geometryFrom(signalPaths.map((p) => p.points));
    signals.setAttribute(
      "aCluster",
      new THREE.Float32BufferAttribute(
        signalPaths.flatMap((p) =>
          Array((p.points.length - 1) * 2).fill(p.cluster),
        ),
        1,
      ),
    );
    signals.setAttribute(
      "aPhase",
      new THREE.Float32BufferAttribute(
        signalPaths.flatMap((p) =>
          Array((p.points.length - 1) * 2).fill(p.phase * 6),
        ),
        1,
      ),
    );
    const curves = signalPaths.map(
      (p) =>
        new THREE.CatmullRomCurve3(
          p.points.map((v) => new THREE.Vector3(...v)),
        ),
    );
    const count = curves.length * 7,
      packetGeometry = new THREE.BufferGeometry();
    packetGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    packetGeometry.setAttribute(
      "aCluster",
      new THREE.Float32BufferAttribute(
        signalPaths.flatMap((p) => Array(7).fill(p.cluster)),
        1,
      ),
    );
    packetGeometry.setAttribute(
      "aPhase",
      new THREE.Float32BufferAttribute(
        signalPaths.flatMap((p) => Array(7).fill(p.phase * 6)),
        1,
      ),
    );
    packetGeometry.setAttribute(
      "aSize",
      new THREE.Float32BufferAttribute(
        Array.from({ length: count }, (_, i) => 0.3 * (1 - (i % 7) / 9)),
        1,
      ),
    );
    return {
      cortex,
      cerebellum,
      stem,
      folds,
      gyri,
      nodeGeometry,
      signals,
      packetGeometry,
      curves,
      signalPaths,
    };
  }, [quality]);
  useEffect(
    () => () => {
      [
        ...data.cortex,
        data.cerebellum,
        data.stem,
        data.folds,
        data.gyri,
        data.nodeGeometry,
        data.signals,
        data.packetGeometry,
      ].forEach((g) => g.dispose());
    },
    [data],
  );
  useEffect(() => {
    const materials: THREE.ShaderMaterial[] = [];
    group.current?.traverse((object) => {
      const m = (object as THREE.Mesh).material;
      if (m instanceof THREE.ShaderMaterial) materials.push(m);
    });
    shaderMaterials.current = materials;
  }, [data]);
  // Demand rendering: no RAF loop when paused/hidden. Idle/Eco are capped at 30 Hz.
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
  }, [view, mode, variant, invalidate]);
  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, delta) => {
    if (animate) time.current += Math.min(delta, 0.08);
    const t = time.current;
    uniforms.uTime.value = t;
    uniforms.uMode.value = MODE_ORDER.indexOf(mode);
    uniforms.uVariant.value = variant;
    uniforms.uAmplitude.value = simulatedAmplitude(t);
    if (group.current) {
      group.current.rotation.set(
        view.pitch + (animate ? Math.sin(t * 0.19) * 0.025 : 0),
        view.yaw + (animate ? Math.sin(t * 0.13) * 0.06 : 0),
        0.035,
      );
      group.current.position.y = animate ? Math.sin(t * 0.5) * 0.025 : 0;
      group.current.scale.setScalar(view.zoom);
    }
    for (const material of shaderMaterials.current) {
      material.uniforms.uTime.value = t;
      if (material.uniforms.uMode) {
        material.uniforms.uMode.value = MODE_ORDER.indexOf(mode);
        material.uniforms.uVariant.value = variant;
        material.uniforms.uAmplitude.value = uniforms.uAmplitude.value;
      }
    }
    const positions = data.packetGeometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    data.curves.forEach((curve, i) => {
      for (let tail = 0; tail < 7; tail++) {
        const progress =
          (t * (mode === "idle" ? 0.035 : mode === "listening" ? 0.13 : 0.24) +
            data.signalPaths[i].phase -
            tail * 0.007 +
            1) %
          1;
        curve.getPoint(progress, point);
        positions.setXYZ(i * 7 + tail, point.x, point.y, point.z);
      }
    });
    positions.needsUpdate = true;
  });
  return (
    <group ref={group}>
      {data.cortex.map((geometry, i) => (
        <group key={i}>
          <mesh geometry={geometry}>
            <meshPhysicalMaterial
              color="#125180"
              emissive="#062b4c"
              emissiveIntensity={0.35}
              roughness={0.27}
              metalness={0.28}
              clearcoat={1}
              transparent
              opacity={0.43}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh geometry={geometry}>
            <shaderMaterial
              vertexShader={rimVertex}
              fragmentShader={rimFragment}
              uniforms={uniforms}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.FrontSide}
            />
          </mesh>
        </group>
      ))}
      <mesh geometry={data.gyri}>
        <meshPhysicalMaterial
          color="#318bba"
          emissive="#073252"
          emissiveIntensity={0.5}
          roughness={0.34}
          metalness={0.15}
          clearcoat={0.7}
          transparent
          opacity={0.52}
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={data.cerebellum}>
        <meshPhongMaterial
          color="#1c7aaf"
          emissive="#0c406a"
          shininess={85}
          transparent
          opacity={0.42}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={data.stem}>
        <meshPhongMaterial
          color="#2b8bb5"
          emissive="#104e6a"
          transparent
          opacity={0.46}
          depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={data.folds}>
        <lineBasicMaterial
          color="#2b9dcc"
          transparent
          opacity={0.14}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
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
      <points
        renderOrder={4}
        geometry={data.packetGeometry}
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
    </group>
  );
}
/** Detach before Canvas disposal so intentional quality changes are not reported as failures. */
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
  return (
    <Canvas
      key={props.quality}
      className="brain-canvas"
      frameloop="demand"
      dpr={props.quality === "eco" ? 1 : [1, 1.5]}
      camera={{ position: [5.6, 2.3, 3.4], fov: 30, near: 0.1, far: 40 }}
      gl={{
        alpha: true,
        antialias: props.quality === "full",
        powerPreference: "default",
      }}
      onCreated={({ gl, camera }) => {
        camera.lookAt(0, -0.05, 0);
        gl.setClearColor(0x000000, 0);
      }}
    >
      <ContextWatcher onFailure={props.onFailure} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[3, 5, 3]} color="#8ddcff" intensity={3} />
      <pointLight position={[-3, 0.2, -1]} color="#248bff" intensity={12} />
      <pointLight position={[1, -2, 2]} color="#16cadf" intensity={7} />
      <Anatomy {...props} />
    </Canvas>
  );
});
