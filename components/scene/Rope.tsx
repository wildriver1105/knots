"use client";

// 매듭 로프 렌더러 (loose→tight 조임 + verlet 물리 + 자기충돌).
// 줄 전체가 항상 보인다. 시작은 "느슨하지만 알아볼 수 있는 매듭"이고, 형성 진행도를 향해
// 손 순서대로 조여진다. RopeSolver(중력+스프링+비신축+자기충돌)로 겹침 없이 출렁이며 정착.
//
// 지오메트리는 useFrame 에서 "직접(imperative)" 갱신한다(React 재렌더 없음) — Canvas 렌더 도중
// setState 를 호출하면 안 되기 때문. 메시 구조(가닥/투톤/캡)는 매듭이 바뀔 때만 재구성된다.

import { useMemo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3 } from "@/lib/knots/types";
import { getKnot } from "@/lib/knots/data";
import { buildLoose, knotShape, sliceCurve } from "@/lib/knots/interpolate";
import { RopeSolver, type SolverOpts } from "@/lib/knots/physics";
import { usePlayerStore } from "@/lib/player/store";
import { getRopeTextures } from "./ropeTexture";

const SOLVER: SolverOpts = { gravity: 2.6, damping: 0.9, spring: 0.32, iterations: 4, collisionIterations: 2 };

function buildTube(points: Vec3[], radius: number): THREE.TubeGeometry | null {
  if (points.length < 2) return null;
  const v = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(v, false, "centripetal");
  const seg = Math.min(700, Math.max(24, points.length * 8));
  return new THREE.TubeGeometry(curve, seg, radius, 24, false);
}

const NORMAL_SCALE = new THREE.Vector2(1.4, 1.4);

function ropeMaterial(color: string, tex: ReturnType<typeof getRopeTextures>): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness: 0,
    roughness: 1,
    roughnessMap: tex.roughnessMap,
    normalMap: tex.normalMap,
    normalScale: NORMAL_SCALE.clone(),
    envMapIntensity: 0.95,
  });
}

function setGeom(mesh: THREE.Mesh | null, pts: Vec3[], radius: number) {
  if (!mesh) return;
  const g = buildTube(pts, radius);
  if (!g) return;
  const old = mesh.geometry;
  mesh.geometry = g;
  old?.dispose();
}

function setCap(mesh: THREE.Mesh | null, at: Vec3 | undefined) {
  if (!mesh || !at) return;
  mesh.position.set(at[0], at[1], at[2]);
}

export default function Rope() {
  const knotId = usePlayerStore((s) => s.knotId);
  const mode = usePlayerStore((s) => s.mode);
  const stepIndex = usePlayerStore((s) => s.stepIndex);
  const progress = usePlayerStore((s) => s.progress);

  const knot = getKnot(knotId);
  const r = knot.ropeRadius;
  const target =
    mode === "step" ? knot.steps[Math.min(stepIndex, knot.steps.length - 1)].reveal : progress;

  const hasB =
    knot.ropeColorB != null &&
    knot.colorSplitIndex != null &&
    knot.colorSplitIndex > 0 &&
    knot.colorSplitIndex < knot.path.length - 1;
  const split = knot.colorSplitIndex ?? 0;
  const extras = knot.extraStrands ?? [];

  // 가닥 loose/ path
  const strands = useMemo(() => {
    const all = [{ path: knot.path, loose: buildLoose(knot.path) }];
    extras.forEach((e) => all.push({ path: e.path, loose: buildLoose(e.path) }));
    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knot]);

  const solver = useMemo(() => new RopeSolver(r), [knot, r]);
  const tex = useMemo(() => getRopeTextures(), []);

  // 재질(매듭별 1회 생성)
  const mats = useMemo(() => {
    const m = {
      mainA: ropeMaterial(knot.ropeColor, tex),
      mainB: hasB ? ropeMaterial(knot.ropeColorB!, tex) : null,
      capA: new THREE.MeshStandardMaterial({ color: new THREE.Color(knot.ropeColor), roughness: 0.85 }),
      capB: new THREE.MeshStandardMaterial({
        color: new THREE.Color(hasB ? knot.ropeColorB! : knot.ropeColor),
        roughness: 0.85,
      }),
      extra: extras.map((e) => ({
        strand: ropeMaterial(e.color, tex),
        cap: new THREE.MeshStandardMaterial({ color: new THREE.Color(e.color), roughness: 0.85 }),
      })),
    };
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knot, tex, hasB]);

  // 메시 refs
  const mainARef = useRef<THREE.Mesh>(null);
  const mainBRef = useRef<THREE.Mesh>(null);
  const capSRef = useRef<THREE.Mesh>(null);
  const capERef = useRef<THREE.Mesh>(null);
  const extraStrandRefs = useRef<(THREE.Mesh | null)[]>([]);
  const extraCapSRefs = useRef<(THREE.Mesh | null)[]>([]);
  const extraCapERefs = useRef<(THREE.Mesh | null)[]>([]);

  const formRef = useRef(target);
  const prevKnot = useRef<string | null>(null);

  // 매듭 전환 시 solver 스냅
  if (prevKnot.current !== knotId) {
    prevKnot.current = knotId;
    formRef.current = target;
    const targets = strands.map((s) => knotShape(s.loose, s.path, target, knot.formReverse));
    solver.snap(targets);
  }

  // 언마운트 시 지오메트리 정리
  useEffect(() => {
    return () => {
      mainARef.current?.geometry?.dispose();
      mainBRef.current?.geometry?.dispose();
      extraStrandRefs.current.forEach((m) => m?.geometry?.dispose());
    };
  }, [knot]);

  useFrame((_, dt) => {
    const cur = formRef.current;
    const d = target - cur;
    formRef.current = Math.abs(d) > 0.0008 ? cur + d * (1 - Math.exp(-7 * Math.min(dt, 0.05))) : target;
    const form = formRef.current;

    const targets = strands.map((s) => knotShape(s.loose, s.path, form, knot.formReverse));
    const result = solver.step(targets, dt, SOLVER);

    // 손 순서대로 점점 드러남: 시작엔 standing 끝만, 진행할수록 working end 가 꿰어지며 조여진다.
    const reveal = Math.min(1, 0.1 + form * 0.96);

    const mainPts = sliceCurve(result[0], reveal);
    if (hasB) {
      if (mainPts.length > split + 1) {
        if (mainBRef.current) mainBRef.current.visible = true;
        setGeom(mainARef.current, mainPts.slice(0, split + 1), r);
        setGeom(mainBRef.current, mainPts.slice(split), r);
      } else {
        if (mainBRef.current) mainBRef.current.visible = false;
        setGeom(mainARef.current, mainPts, r);
      }
    } else {
      setGeom(mainARef.current, mainPts, r);
    }
    setCap(capSRef.current, mainPts[0]);
    setCap(capERef.current, mainPts[mainPts.length - 1]);
    if (capERef.current) {
      const tipColor = hasB && mainPts.length > split + 1 ? knot.ropeColorB! : knot.ropeColor;
      (capERef.current.material as THREE.MeshStandardMaterial).color.set(tipColor);
    }

    for (let k = 0; k < extras.length; k++) {
      const pts = sliceCurve(result[k + 1], reveal);
      if (!pts) continue;
      setGeom(extraStrandRefs.current[k], pts, r);
      setCap(extraCapSRefs.current[k], pts[0]);
      setCap(extraCapERefs.current[k], pts[pts.length - 1]);
    }
  });

  const capGeo = useMemo(() => new THREE.SphereGeometry(r, 20, 20), [r]);

  return (
    <group>
      <mesh ref={mainARef} material={mats.mainA} castShadow receiveShadow />
      {hasB && <mesh ref={mainBRef} material={mats.mainB!} castShadow receiveShadow />}
      <mesh ref={capSRef} geometry={capGeo} material={mats.capA} castShadow />
      <mesh ref={capERef} geometry={capGeo} material={mats.capB} castShadow />

      {extras.map((e, k) => (
        <group key={k}>
          <mesh
            ref={(m) => {
              extraStrandRefs.current[k] = m;
            }}
            material={mats.extra[k].strand}
            castShadow
            receiveShadow
          />
          <mesh
            ref={(m) => {
              extraCapSRefs.current[k] = m;
            }}
            geometry={capGeo}
            material={mats.extra[k].cap}
            castShadow
          />
          <mesh
            ref={(m) => {
              extraCapERefs.current[k] = m;
            }}
            geometry={capGeo}
            material={mats.extra[k].cap}
            castShadow
          />
        </group>
      ))}
    </group>
  );
}
