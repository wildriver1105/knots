"use client";

// 매듭 로프 렌더러 (morph 방식).
// 줄 전체가 항상 그려진다. 스토어의 형성 진행도(step.reveal 또는 연속 progress)를 향해
// 매 프레임 부드럽게(damping) 다가가며, formCenterline 으로 "곧은 줄 → 매듭"을 점별 morph 한다.
// → 이미 존재하는 줄이 움직이면서 매듭이 만들어진다.

import { useMemo, useEffect, useRef, useReducer } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3 } from "@/lib/knots/types";
import { getKnot } from "@/lib/knots/data";
import { buildStraightBaseline, formCenterline } from "@/lib/knots/interpolate";
import { usePlayerStore } from "@/lib/player/store";

function buildTube(points: Vec3[], radius: number): THREE.TubeGeometry | null {
  if (points.length < 2) return null;
  const v = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(v, false, "centripetal");
  const seg = Math.min(500, Math.max(16, points.length * 6));
  return new THREE.TubeGeometry(curve, seg, radius, 16, false);
}

function Strand({ points, color, radius }: { points: Vec3[]; color: string; radius: number }) {
  const geom = useMemo(() => buildTube(points, radius), [points, radius]);
  useEffect(() => () => geom?.dispose(), [geom]);
  if (!geom) return null;
  return (
    <mesh geometry={geom} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.62} metalness={0.04} />
    </mesh>
  );
}

function Cap({ at, color, radius }: { at: Vec3; color: string; radius: number }) {
  return (
    <mesh position={at} castShadow>
      <sphereGeometry args={[radius, 16, 16]} />
      <meshStandardMaterial color={color} roughness={0.62} metalness={0.04} />
    </mesh>
  );
}

export default function Rope() {
  const knotId = usePlayerStore((s) => s.knotId);
  const mode = usePlayerStore((s) => s.mode);
  const stepIndex = usePlayerStore((s) => s.stepIndex);
  const progress = usePlayerStore((s) => s.progress);

  const knot = getKnot(knotId);
  const target =
    mode === "step" ? knot.steps[Math.min(stepIndex, knot.steps.length - 1)].reveal : progress;

  // 형성 진행도를 target 으로 부드럽게 따라가게 한다(줄이 움직이는 느낌).
  const formRef = useRef(target);
  const [, force] = useReducer((c) => c + 1, 0);

  // 매듭이 바뀌면 morph 없이 즉시 스냅.
  const prevKnot = useRef(knotId);
  if (prevKnot.current !== knotId) {
    prevKnot.current = knotId;
    formRef.current = target;
  }

  useFrame((_, dt) => {
    const cur = formRef.current;
    const d = target - cur;
    if (Math.abs(d) > 0.0008) {
      formRef.current = cur + d * (1 - Math.exp(-7 * Math.min(dt, 0.05)));
      force();
    } else if (cur !== target) {
      formRef.current = target;
      force();
    }
  });

  const form = formRef.current;

  // 곧은 줄 기준선(매듭별 1회 계산)
  const straight = useMemo(
    () => buildStraightBaseline(knot.path, knot.layDir, knot.layCenter),
    [knot.path, knot.layDir, knot.layCenter]
  );

  // 현재 형성 상태의 전체 제어점
  const points = useMemo(
    () => formCenterline(knot.path, straight, form, knot.formReverse),
    [knot.path, straight, form, knot.formReverse]
  );

  // 투톤 분할(고정 인덱스, 줄 전체가 항상 보인다)
  const { segA, segB } = useMemo(() => {
    const split = knot.colorSplitIndex;
    if (split == null || !knot.ropeColorB || split <= 0 || split >= points.length - 1) {
      return { segA: points, segB: null as Vec3[] | null };
    }
    return { segA: points.slice(0, split + 1), segB: points.slice(split) };
  }, [points, knot.colorSplitIndex, knot.ropeColorB]);

  const r = knot.ropeRadius;

  return (
    <group>
      <Strand points={segA} color={knot.ropeColor} radius={r} />
      {segB && <Strand points={segB} color={knot.ropeColorB!} radius={r} />}
      {points.length >= 1 && <Cap at={points[0]} color={knot.ropeColor} radius={r} />}
      {points.length >= 2 && (
        <Cap at={points[points.length - 1]} color={segB ? knot.ropeColorB! : knot.ropeColor} radius={r} />
      )}

      {knot.extraStrands?.map((strand, i) => (
        <ExtraStrand
          key={i}
          path={strand.path}
          color={strand.color}
          radius={r}
          form={form}
          reverse={knot.formReverse}
          layDir={strand.layDir ?? knot.layDir}
          layCenter={strand.layCenter}
        />
      ))}
    </group>
  );
}

function ExtraStrand({
  path,
  color,
  radius,
  form,
  reverse,
  layDir,
  layCenter,
}: {
  path: Vec3[];
  color: string;
  radius: number;
  form: number;
  reverse?: boolean;
  layDir?: Vec3;
  layCenter?: Vec3;
}) {
  const straight = useMemo(() => buildStraightBaseline(path, layDir, layCenter), [path, layDir, layCenter]);
  const points = useMemo(() => formCenterline(path, straight, form, reverse), [path, straight, form, reverse]);
  return (
    <group>
      <Strand points={points} color={color} radius={radius} />
      {points.length >= 1 && <Cap at={points[0]} color={color} radius={radius} />}
      {points.length >= 2 && <Cap at={points[points.length - 1]} color={color} radius={radius} />}
    </group>
  );
}
