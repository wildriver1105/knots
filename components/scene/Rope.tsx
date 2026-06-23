"use client";

// 매듭 로프 렌더러.
// 스토어의 reveal(step.reveal 또는 연속 progress)만큼 path 를 잘라 CatmullRom → TubeGeometry 로
// 만든다. 투톤(colorSplitIndex)은 두 개의 튜브로 나눠 칠하고, 양 끝은 구(sphere)로 마감한다.

import { useMemo, useEffect } from "react";
import * as THREE from "three";
import type { Vec3 } from "@/lib/knots/types";
import { getKnot } from "@/lib/knots/data";
import { sliceCurve } from "@/lib/knots/interpolate";
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
  const reveal =
    mode === "step"
      ? knot.steps[Math.min(stepIndex, knot.steps.length - 1)].reveal
      : progress;

  // 메인 가닥 reveal 절단
  const revealed = useMemo(() => sliceCurve(knot.path, reveal), [knot.path, reveal]);

  // 투톤 분할
  const { segA, segB } = useMemo(() => {
    const split = knot.colorSplitIndex;
    if (split == null || !knot.ropeColorB || revealed.length <= 1) {
      return { segA: revealed, segB: null as Vec3[] | null };
    }
    if (revealed.length > split + 1) {
      return { segA: revealed.slice(0, split + 1), segB: revealed.slice(split) };
    }
    return { segA: revealed, segB: null as Vec3[] | null };
  }, [revealed, knot.colorSplitIndex, knot.ropeColorB]);

  const tipColor = segB ? knot.ropeColorB! : knot.ropeColor;
  const r = knot.ropeRadius;

  return (
    <group>
      <Strand points={segA} color={knot.ropeColor} radius={r} />
      {segB && <Strand points={segB} color={knot.ropeColorB!} radius={r} />}
      {/* 끝 마감 캡 */}
      {revealed.length >= 1 && <Cap at={revealed[0]} color={knot.ropeColor} radius={r} />}
      {revealed.length >= 2 && (
        <Cap at={revealed[revealed.length - 1]} color={tipColor} radius={r} />
      )}

      {/* 추가 가닥(square knot 등) — 동일 reveal */}
      {knot.extraStrands?.map((strand, i) => (
        <ExtraStrand key={i} path={strand.path} color={strand.color} radius={r} reveal={reveal} />
      ))}
    </group>
  );
}

function ExtraStrand({
  path,
  color,
  radius,
  reveal,
}: {
  path: Vec3[];
  color: string;
  radius: number;
  reveal: number;
}) {
  const revealed = useMemo(() => sliceCurve(path, reveal), [path, reveal]);
  return (
    <group>
      <Strand points={revealed} color={color} radius={radius} />
      {revealed.length >= 1 && <Cap at={revealed[0]} color={color} radius={radius} />}
      {revealed.length >= 2 && <Cap at={revealed[revealed.length - 1]} color={color} radius={radius} />}
    </group>
  );
}
