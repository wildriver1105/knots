"use client";

// 매듭 로프 렌더러 (결정론적 포즈 재생).
// 줄 전체가 항상 보인다. 빌트인·커스텀 모두 스텝 포즈(poses)를 form(0..1)으로 보간(interpolatePoses)해
// 그대로 렌더한다 — 실시간 물리 solver 는 렌더 경로에 없다(저작 포즈 = 화면, 폭발/구슬/꽈배기 없음).
// physics.settle === "light" 일 때만 form>0.9 부근에서 겹침을 약하게 정리한다(옵트인).
//
// 지오메트리는 useFrame 에서 "직접(imperative)" 갱신한다(React 재렌더 없음) — Canvas 렌더 도중
// setState 를 호출하면 안 되기 때문. 메시 구조(가닥/투톤/캡)는 매듭이 바뀔 때만 재구성된다.

import { useMemo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3 } from "@/lib/knots/types";
import { getKnot } from "@/lib/knots/registry";
import { interpolatePoses } from "@/lib/knots/interpolate";
import { sampleAnimation } from "@/lib/knots/anim";
import { withSeededPoses } from "@/lib/knots/authoring";
import { collidersForObject, relaxPoints } from "@/lib/knots/physics";
import { usePlayerStore } from "@/lib/player/store";
import { makeRopeMaterial } from "./ropeTexture";
import { setTube, setTwoToneTube, setCap } from "./ropeTube";

export default function Rope() {
  const knotId = usePlayerStore((s) => s.knotId);
  const mode = usePlayerStore((s) => s.mode);
  const stepIndex = usePlayerStore((s) => s.stepIndex);
  const progress = usePlayerStore((s) => s.progress);

  const knot = getKnot(knotId);
  const r = knot.ropeRadius;
  const target =
    mode === "step" ? knot.steps[Math.min(stepIndex, knot.steps.length - 1)].reveal : progress;

  // 결정론적 렌더: 모든 매듭을 poses(키프레임)로 재생한다. path 만 저작된 매듭은 시드로 포즈를 채운다.
  const posed = useMemo(() => withSeededPoses(knot), [knot]);
  const extras = posed.extraStrands ?? [];

  const hasB =
    posed.ropeColorB != null &&
    posed.colorSplitIndex != null &&
    posed.colorSplitIndex > 0 &&
    posed.colorSplitIndex < posed.path.length - 1;
  // 색 경계를 호 비율로(하나의 연속 튜브에서 그룹 분할).
  const splitFraction = hasB ? (posed.colorSplitIndex as number) / (posed.path.length - 1) : 0;

  // 가닥별 스텝 포즈(main + extras). solver 가 없으므로 포즈 점이 곧 제어점 — 색 경계는 인덱스로 다룬다.
  const strandPoses = useMemo(() => {
    const all: Vec3[][][] = [posed.poses ?? [posed.path]];
    extras.forEach((e) => all.push(e.poses ?? [e.path]));
    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posed]);

  const colliders = useMemo(() => collidersForObject(posed.object), [posed]);

  // 재질(매듭별 1회 생성). 캡도 같은 로프 재질을 써서 끝이 자연스럽게.
  const mats = useMemo(() => {
    const mainA = makeRopeMaterial(knot.ropeColor);
    const mainB = hasB ? makeRopeMaterial(knot.ropeColorB!) : null;
    return {
      mainA,
      mainB,
      // 단일 메시 머티리얼: 투톤이면 [A,B] 배열(지오메트리 그룹으로 구분), 아니면 단색.
      main: hasB && mainB ? [mainA, mainB] : mainA,
      capA: makeRopeMaterial(knot.ropeColor),
      capB: makeRopeMaterial(hasB ? knot.ropeColorB! : knot.ropeColor),
      extra: extras.map((e) => ({
        strand: makeRopeMaterial(e.color),
        cap: makeRopeMaterial(e.color),
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knot, hasB]);

  // 메시 refs
  const mainRef = useRef<THREE.Mesh>(null);
  const capSRef = useRef<THREE.Mesh>(null);
  const capERef = useRef<THREE.Mesh>(null);
  const extraStrandRefs = useRef<(THREE.Mesh | null)[]>([]);
  const extraCapSRefs = useRef<(THREE.Mesh | null)[]>([]);
  const extraCapERefs = useRef<(THREE.Mesh | null)[]>([]);

  const formRef = useRef(target);
  const prevKnot = useRef<string | null>(null);

  // 매듭 전환 시 형성 진행도만 리셋(결정론 — solver 스냅 불필요).
  if (prevKnot.current !== knotId) {
    prevKnot.current = knotId;
    formRef.current = target;
  }

  // 언마운트 시 지오메트리 정리
  useEffect(() => {
    return () => {
      mainRef.current?.geometry?.dispose();
      extraStrandRefs.current.forEach((m) => m?.geometry?.dispose());
    };
  }, [knot]);

  useFrame((_, dt) => {
    const cur = formRef.current;
    const d = target - cur;
    formRef.current = Math.abs(d) > 0.0008 ? cur + d * (1 - Math.exp(-7 * Math.min(dt, 0.05))) : target;
    const form = formRef.current;
    const settle = posed.physics?.settle ?? "off";

    // settle="light" 일 때만 거의 완성된 포즈의 겹침을 약하게 정리(중간 형성은 절대 구동 안 함).
    const settleIf = (pts: Vec3[]) =>
      settle === "light" && form > 0.9 ? relaxPoints(pts, r, 16, colliders) : pts;

    // main 가닥 — 도프시트(animation)가 있으면 점별 트랙을 시간으로 평가, 없으면 포즈 보간.
    const mainInterp = posed.animation
      ? sampleAnimation(posed.animation, form)
      : interpolatePoses(strandPoses[0], form, { workingStartIndex: posed.colorSplitIndex, reverse: posed.formReverse });
    const mainPts = settleIf(mainInterp);

    // 하나의 연속 튜브로 그리고, 투톤이면 색 경계에서 그룹만 분할(곡선은 끊김 없이 이어짐).
    if (hasB) setTwoToneTube(mainRef.current, mainPts, r, splitFraction);
    else setTube(mainRef.current, mainPts, r);
    setCap(capSRef.current, mainPts[0]);
    setCap(capERef.current, mainPts[mainPts.length - 1]);
    if (capERef.current) {
      const tipColor = hasB ? knot.ropeColorB! : knot.ropeColor;
      (capERef.current.material as THREE.MeshStandardMaterial).color.set(tipColor);
    }

    for (let k = 0; k < extras.length; k++) {
      const pts = settleIf(interpolatePoses(strandPoses[k + 1], form, { reverse: posed.formReverse }));
      if (!pts || pts.length < 2) continue;
      setTube(extraStrandRefs.current[k], pts, r);
      setCap(extraCapSRefs.current[k], pts[0]);
      setCap(extraCapERefs.current[k], pts[pts.length - 1]);
    }
  });

  const capGeo = useMemo(() => new THREE.SphereGeometry(r, 20, 20), [r]);

  return (
    <group>
      <mesh ref={mainRef} material={mats.main} castShadow receiveShadow />
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
