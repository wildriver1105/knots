"use client";

// 매듭 로프 렌더러 (결정론적 재생).
// 줄 전체가 항상 보인다. 재생 소스는 우선순위대로:
//   ① animation(도프시트) — 점별 키프레임을 시간으로 평가
//   ② tieMotion — working end 가 최종 path 를 따라 실제로 꿰어 들어가는 스레딩(사람이 묶는 순서).
//      form == reveal 이라 step.reveal 체크포인트와 정확히 일치한다.
//   ③ poses — 스텝 포즈 보간(interpolatePoses)
// 실시간 물리 solver(Verlet, 누적 상태)는 렌더 경로에 없다. 대신 렌더 직전에
// 무상태 depenetrate(같은 입력→같은 출력, 보정 클램프)로 가닥 겹침·말뚝 관통만 밀어낸다.
//
// 지오메트리는 useFrame 에서 "직접(imperative)" 갱신한다(React 재렌더 없음) — Canvas 렌더 도중
// setState 를 호출하면 안 되기 때문. form/매듭이 안 바뀐 프레임은 재구축을 건너뛴다(성능).

import { useMemo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3 } from "@/lib/knots/types";
import { getKnot } from "@/lib/knots/registry";
import { interpolatePoses, tieAlongPath } from "@/lib/knots/interpolate";
import { sampleAnimation } from "@/lib/knots/anim";
import { withSeededPoses, resamplePolyline } from "@/lib/knots/authoring";
import { collidersForObject } from "@/lib/knots/physics";
import { depenetrate } from "@/lib/knots/depenetrate";
import { usePlayerStore } from "@/lib/player/store";
import { makeRopeMaterial } from "./ropeTexture";
import { setTube, setTwoToneTube, setCap } from "./ropeTube";

/** 성긴 제어점을 CatmullRom 스플라인 위의 조밀·호균일 점으로 리샘플 — tieAlongPath 입력용.
 *  (tieAlongPath 는 입력 폴리라인을 선형 호 샘플하므로, 성긴 path 를 그대로 주면 다각형 티가 난다.) */
function splineResample(path: Vec3[], count: number): Vec3[] {
  if (path.length < 3) return path.map((p) => [...p] as Vec3);
  const curve = new THREE.CatmullRomCurve3(
    path.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    false,
    "centripetal"
  );
  return curve.getSpacedPoints(count - 1).map((v) => [v.x, v.y, v.z] as Vec3);
}

/** path 제어점 idx 의 호 길이 비율(0..1) — tieMotion 출력은 호 균일이라 색 경계에 이걸 쓴다. */
function arcFractionAt(path: Vec3[], idx: number): number {
  let total = 0;
  let at = 0;
  for (let i = 1; i < path.length; i++) {
    const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]);
    total += d;
    if (i <= idx) at += d;
  }
  return total > 0 ? at / total : 0;
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

  // 결정론적 렌더: path 만 저작된 매듭은 시드로 포즈를 채운다(에디터/포즈 재생 폴백용).
  const posed = useMemo(() => withSeededPoses(knot), [knot]);
  const extras = posed.extraStrands ?? [];

  const hasB =
    posed.ropeColorB != null &&
    posed.colorSplitIndex != null &&
    posed.colorSplitIndex > 0 &&
    posed.colorSplitIndex < posed.path.length - 1;
  // 색 경계(하나의 연속 튜브에서 그룹 분할 비율).
  // tieMotion 출력은 호 길이 균일 → 진짜 호 비율. 포즈 재생은 기존 인덱스 비율(저작 당시 기준) 유지.
  const splitFraction = hasB
    ? posed.tieMotion && !posed.animation
      ? arcFractionAt(posed.path, posed.colorSplitIndex as number)
      : (posed.colorSplitIndex as number) / (posed.path.length - 1)
    : 0;

  // 가닥별 스텝 포즈(포즈 재생 폴백용).
  const strandPoses = useMemo(() => {
    const all: Vec3[][][] = [posed.poses ?? [posed.path]];
    extras.forEach((e) => all.push(e.poses ?? [e.path]));
    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posed]);

  const colliders = useMemo(() => collidersForObject(posed.object), [posed]);

  // tieMotion 스레딩용 조밀 스플라인 path(매듭당 1회). 성긴 제어점의 다각형 티 제거.
  const densePaths = useMemo(() => {
    const cnt = (p: Vec3[]) => Math.min(200, Math.max(120, p.length * 3));
    return {
      main: posed.tieMotion ? splineResample(posed.path, cnt(posed.path)) : null,
      extra: extras.map((e) => (e.tieMotion ? splineResample(e.path, cnt(e.path)) : null)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posed]);

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
  const lastBuilt = useRef<{ posed: unknown; form: number } | null>(null);

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

    // 변화 없는 프레임은 지오메트리 재구축 생략(꼬임 지오메트리 비용 절약).
    if (lastBuilt.current && lastBuilt.current.posed === posed && Math.abs(lastBuilt.current.form - form) < 1e-5) return;
    lastBuilt.current = { posed, form };

    // 스레딩 리샘플 해상도 — 겹침 분리·튜브 모두 이 점들로.
    const M = Math.min(150, Math.max(72, posed.path.length));

    // 가닥별 재생 소스 결정(① animation ② tieMotion ③ poses).
    const rawStrands: Vec3[][] = [];
    if (posed.animation) {
      rawStrands.push(sampleAnimation(posed.animation, form));
    } else if (posed.tieMotion && densePaths.main) {
      rawStrands.push(resamplePolyline(tieAlongPath(densePaths.main, form, posed.tieMotion.reverse ?? false, posed.tieMotion.tailDir), M));
    } else {
      rawStrands.push(
        interpolatePoses(strandPoses[0], form, { workingStartIndex: posed.colorSplitIndex, reverse: posed.formReverse })
      );
    }
    for (let k = 0; k < extras.length; k++) {
      const strand = extras[k];
      const dense = densePaths.extra[k];
      if (strand.tieMotion && dense) {
        rawStrands.push(resamplePolyline(tieAlongPath(dense, form, strand.tieMotion.reverse ?? false, strand.tieMotion.tailDir), M));
      } else {
        rawStrands.push(interpolatePoses(strandPoses[k + 1], form, { reverse: posed.formReverse }));
      }
    }

    // 무상태 겹침 분리 — 가닥끼리 서로 통과하지 않고, 말뚝/클리트를 파고들지 않게.
    const strands = depenetrate(rawStrands, r, colliders);

    const mainPts = strands[0];
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
      const pts = strands[k + 1];
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
