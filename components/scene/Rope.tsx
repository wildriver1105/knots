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
import { getKnot } from "@/lib/knots/registry";
import { sliceCurve, interpolatePoses, tieAlongPath } from "@/lib/knots/interpolate";
import { RopeSolver, collidersForObject, solverOptionsForKnot } from "@/lib/knots/physics";
import { usePlayerStore } from "@/lib/player/store";
import { makeRopeMaterial } from "./ropeTexture";

function buildTube(points: Vec3[], radius: number): THREE.TubeGeometry | null {
  if (points.length < 2) return null;
  const v = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(v, false, "centripetal");
  const seg = Math.min(1200, Math.max(80, points.length * 14));
  const geometry = new THREE.TubeGeometry(curve, seg, radius, 48, false);
  geometry.computeVertexNormals();
  return geometry;
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
  // solver 가 dense 로 리샘플하므로 색 경계는 인덱스가 아니라 "호 비율"로 다룬다.
  const splitFraction = hasB ? (knot.colorSplitIndex as number) / (knot.path.length - 1) : 0;
  const extras = knot.extraStrands ?? [];

  // 가닥 path. 빌트인은 tieAlongPath 로 "working end 가 지나간 흔적"을 만들고,
  // 커스텀은 에디터 keyframe 을 staged interpolation 으로 재생한다.
  const strands = useMemo(() => {
    const all = [{ path: knot.path, layDir: knot.layDir }];
    extras.forEach((e) => all.push({ path: e.path, layDir: e.layDir ?? knot.layDir }));
    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knot]);

  const solver = useMemo(() => new RopeSolver(r), [knot, r]);
  const colliders = useMemo(() => collidersForObject(knot.object), [knot]);

  // 재질(매듭별 1회 생성). 캡도 같은 로프 재질을 써서 끝이 자연스럽게.
  const mats = useMemo(() => {
    const m = {
      mainA: makeRopeMaterial(knot.ropeColor),
      mainB: hasB ? makeRopeMaterial(knot.ropeColorB!) : null,
      capA: makeRopeMaterial(knot.ropeColor),
      capB: makeRopeMaterial(hasB ? knot.ropeColorB! : knot.ropeColor),
      extra: extras.map((e) => ({
        strand: makeRopeMaterial(e.color),
        cap: makeRopeMaterial(e.color),
      })),
    };
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knot, hasB]);

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
    const targets = knot.poses
      ? [interpolatePoses(knot.poses, target, { workingStartIndex: knot.colorSplitIndex, reverse: knot.formReverse })]
      : strands.map((s) => tieAlongPath(s.path, target, knot.formReverse, s.layDir));
    const restTargets = knot.poses
      ? [knot.poses[knot.poses.length - 1] ?? knot.path]
      : strands.map((s) => s.path);
    solver.snap(targets, restTargets);
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

    // 커스텀(에디터) 매듭은 working-end staged keyframe 보간,
    // 빌트인은 working end 가 최종 path 를 따라 지나가는 tying 포즈.
    const targets = knot.poses
      ? [interpolatePoses(knot.poses, form, { workingStartIndex: knot.colorSplitIndex, reverse: knot.formReverse })]
      : strands.map((s) => tieAlongPath(s.path, form, knot.formReverse, s.layDir));
    const result = solver.step(targets, dt, solverOptionsForKnot(knot, form), colliders);

    // 실제 로프처럼 전체 길이를 항상 유지한다. 단계는 잘라내기(reveal)가 아니라
    // 느슨한 포즈에서 완성 포즈로 이동하고 장력이 올라가는 과정이다.
    const reveal = 1;

    const mainPts = sliceCurve(result[0], reveal);
    // 색 경계 = 노출된 호 안에서 splitFraction 위치(없으면 색A 만).
    const showB = hasB && reveal > splitFraction + 1e-3;
    const splitIdx = showB ? Math.round((splitFraction / reveal) * (mainPts.length - 1)) : -1;
    if (showB && splitIdx > 0 && splitIdx < mainPts.length - 1) {
      if (mainBRef.current) mainBRef.current.visible = true;
      setGeom(mainARef.current, mainPts.slice(0, splitIdx + 1), r);
      setGeom(mainBRef.current, mainPts.slice(splitIdx), r);
    } else {
      if (mainBRef.current) mainBRef.current.visible = false;
      setGeom(mainARef.current, mainPts, r);
    }
    setCap(capSRef.current, mainPts[0]);
    setCap(capERef.current, mainPts[mainPts.length - 1]);
    if (capERef.current) {
      const tipColor = showB ? knot.ropeColorB! : knot.ropeColor;
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
