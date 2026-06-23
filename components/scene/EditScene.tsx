"use client";

// 에디터 3D: 현재 스텝의 줄 포즈를 튜브로 보여주고, 제어점을 클릭해 선택 → 기즈모로 드래그한다.
// TransformControls 는 object prop 으로 핸들 메시에 "직접" 부착한다(자식 래핑 시 부모 그룹만
// 움직여 로컬 좌표가 안 바뀌는 버그 방지). 드래그 → handle.position(=씬 좌표) → movePoint.

import { useMemo, useState } from "react";
import * as THREE from "three";
import { TransformControls } from "@react-three/drei";
import type { Vec3 } from "@/lib/knots/types";
import { useEditorStore } from "@/lib/editor/store";

function tube(points: Vec3[], radius: number): THREE.TubeGeometry | null {
  if (points.length < 2) return null;
  const v = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(v, false, "centripetal");
  return new THREE.TubeGeometry(curve, Math.max(24, points.length * 8), radius, 20, false);
}

export default function EditScene() {
  const draft = useEditorStore((s) => s.draft);
  const activeStep = useEditorStore((s) => s.activeStep);
  const selected = useEditorStore((s) => s.selected);
  const select = useEditorStore((s) => s.select);
  const movePoint = useEditorStore((s) => s.movePoint);
  const [handle, setHandle] = useState<THREE.Mesh | null>(null);

  const points = draft?.poses?.[activeStep] ?? [];
  const r = draft?.ropeRadius ?? 0.075;
  const split = draft?.colorSplitIndex ?? -1;

  const geomA = useMemo(() => tube(split > 0 ? points.slice(0, split + 1) : points, r), [points, split, r]);
  const geomB = useMemo(() => (split > 0 ? tube(points.slice(split), r) : null), [points, split, r]);

  if (!draft) return null;
  const selPoint = selected != null ? points[selected] : null;

  return (
    <group>
      {geomA && (
        <mesh geometry={geomA} castShadow receiveShadow>
          <meshStandardMaterial color={draft.ropeColor} roughness={0.7} metalness={0} />
        </mesh>
      )}
      {geomB && (
        <mesh geometry={geomB} castShadow receiveShadow>
          <meshStandardMaterial color={draft.ropeColorB ?? draft.ropeColor} roughness={0.7} metalness={0} />
        </mesh>
      )}

      {/* 제어점 마커(선택된 점 제외 — 거긴 핸들이 대신) */}
      {points.map((p, i) =>
        i === selected ? null : (
          <mesh
            key={i}
            position={p as THREE.Vector3Tuple}
            onPointerDown={(e) => {
              e.stopPropagation();
              select(i);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "auto";
            }}
          >
            <sphereGeometry args={[r * 1.7, 16, 16]} />
            <meshStandardMaterial
              color={i === 0 ? "#22c55e" : i === points.length - 1 ? "#3b82f6" : i === split ? "#a855f7" : "#dfe7f0"}
              emissive={i === 0 ? "#22c55e" : i === points.length - 1 ? "#3b82f6" : i === split ? "#a855f7" : "#7d8a99"}
              emissiveIntensity={0.45}
              roughness={0.4}
            />
          </mesh>
        )
      )}

      {/* 선택된 점 = 드래그 핸들 */}
      {selPoint && (
        <mesh ref={setHandle} position={selPoint as THREE.Vector3Tuple}>
          <sphereGeometry args={[r * 1.9, 20, 20]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
        </mesh>
      )}
      {selPoint && handle && (
        <TransformControls
          object={handle}
          mode="translate"
          size={1.5}
          onObjectChange={() => {
            if (selected == null) return;
            movePoint(selected, [handle.position.x, handle.position.y, handle.position.z]);
          }}
        />
      )}
    </group>
  );
}
