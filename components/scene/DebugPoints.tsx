"use client";

// 저작용 디버그 오버레이 — path 제어점을 작은 구로 표시(반은 빨강, 시작은 녹색, 끝은 파랑).
// 좌표를 눈으로 보며 다듬을 때 사용. UI 의 "points" 토글로 켠다.

import * as THREE from "three";
import { useMemo } from "react";
import { getKnot } from "@/lib/knots/registry";
import { usePlayerStore } from "@/lib/player/store";

export default function DebugPoints() {
  const knotId = usePlayerStore((s) => s.knotId);
  const knot = getKnot(knotId);
  const pts = knot.path;

  const colors = useMemo(
    () =>
      pts.map((_, i) => {
        if (i === 0) return "#22c55e"; // 시작 = 녹
        if (i === pts.length - 1) return "#3b82f6"; // 끝 = 파랑
        if (knot.colorSplitIndex != null && i === knot.colorSplitIndex) return "#a855f7"; // split = 보라
        return "#ef4444";
      }),
    [pts, knot.colorSplitIndex]
  );

  return (
    <group>
      {pts.map((p, i) => (
        <mesh key={i} position={p as THREE.Vector3Tuple}>
          <sphereGeometry args={[knot.ropeRadius * 0.55, 8, 8]} />
          <meshBasicMaterial color={colors[i]} />
        </mesh>
      ))}
    </group>
  );
}
