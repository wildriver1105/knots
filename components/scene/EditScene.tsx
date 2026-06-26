"use client";

// 에디터 3D: 제어점(마커)을 클릭 선택 → 기즈모로 드래그하면 그 스텝의 포즈가 바뀐다.
// 작성 중에는 저작 좌표를 그대로 그린다. solver 가 개입하면 사용자가 놓은 시작 직선도
// 꼬인 것처럼 보일 수 있기 때문이다. 미리보기 중에만 뷰와 동일한 RopeSolver 를 적용한다.
//
// TransformControls 는 object prop 으로 핸들에 직접 부착(자식 래핑 시 부모 그룹만 움직이는 버그 방지).

import { useMemo, useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TransformControls } from "@react-three/drei";
import type { Vec3 } from "@/lib/knots/types";
import { useEditorStore } from "@/lib/editor/store";
import { collidersForObject, relaxPoints } from "@/lib/knots/physics";
import { interpolatePoses } from "@/lib/knots/interpolate";
import { makeRopeMaterial } from "./ropeTexture";

function smoothCenterline(points: Vec3[], passes: number, factor: number): Vec3[] {
  let out = points.map((p) => [p[0], p[1], p[2]] as Vec3);
  for (let pass = 0; pass < passes; pass++) {
    const next = out.map((p) => [p[0], p[1], p[2]] as Vec3);
    for (let i = 1; i < out.length - 1; i++) {
      next[i][0] = out[i][0] * (1 - factor) + (out[i - 1][0] + out[i + 1][0]) * 0.5 * factor;
      next[i][1] = out[i][1] * (1 - factor) + (out[i - 1][1] + out[i + 1][1]) * 0.5 * factor;
      next[i][2] = out[i][2] * (1 - factor) + (out[i - 1][2] + out[i + 1][2]) * 0.5 * factor;
    }
    out = next;
  }
  return out;
}

function tube(points: Vec3[], radius: number): THREE.TubeGeometry | null {
  const smooth = smoothCenterline(points, 3, 0.5);
  const clean: Vec3[] = [];
  for (const p of smooth) {
    const last = clean[clean.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]) > radius * 0.2) clean.push(p);
  }
  if (clean.length < 2) return null;
  const v = clean.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(v, false, "centripetal");
  const geometry = new THREE.TubeGeometry(curve, Math.min(600, Math.max(64, clean.length * 5)), radius, 28, false);
  geometry.computeVertexNormals();
  return geometry;
}

function setGeom(mesh: THREE.Mesh | null, pts: Vec3[], radius: number) {
  if (!mesh) return;
  const g = tube(pts, radius);
  if (!g) return;
  const old = mesh.geometry;
  mesh.geometry = g;
  old?.dispose();
}

export default function EditScene() {
  const draft = useEditorStore((s) => s.draft);
  const activeStep = useEditorStore((s) => s.activeStep);
  const selected = useEditorStore((s) => s.selected);
  const select = useEditorStore((s) => s.select);
  const movePoint = useEditorStore((s) => s.movePoint);
  const beginChange = useEditorStore((s) => s.beginChange);
  const preview = useEditorStore((s) => s.preview);
  const [handle, setHandle] = useState<THREE.Mesh | null>(null);

  const points = draft?.poses?.[activeStep] ?? [];
  const r = draft?.ropeRadius ?? 0.075;
  const split = draft?.colorSplitIndex ?? -1;
  const hasB = split > 0 && !!draft?.ropeColorB && split < points.length - 1;

  const colliders = useMemo(() => collidersForObject(draft?.object ?? { kind: "none" }), [draft?.object]);
  const mats = useMemo(
    () => ({
      A: makeRopeMaterial(draft?.ropeColor ?? "#e0584b"),
      B: makeRopeMaterial(draft?.ropeColorB ?? "#3f8fce"),
    }),
    [draft?.ropeColor, draft?.ropeColorB]
  );

  const tubeARef = useRef<THREE.Mesh>(null);
  const tubeBRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    return () => {
      tubeARef.current?.geometry?.dispose();
      tubeBRef.current?.geometry?.dispose();
    };
  }, [draft?.id]);

  useFrame((_, dt) => {
    if (points.length < 2 || !draft?.poses) return;
    // 미리보기 중엔 스텝 포즈를 보간해 재생, 아니면 현재 스텝 포즈.
    const st = useEditorStore.getState();
    let target = points;
    let formation = activeStep / Math.max(1, draft.poses.length - 1);
    if (st.preview) {
      if (st.previewPlaying) st.tickPreview(Math.min(dt, 0.05));
      const pp = useEditorStore.getState().previewProgress;
      target = interpolatePoses(draft.poses, pp, {
        workingStartIndex: draft.colorSplitIndex,
        reverse: draft.formReverse,
      });
      formation = pp;
    }

    // 뷰 런타임과 동일: 기본은 저작 포즈 그대로. settle="light" 일 때만 거의 완성 포즈를 약하게 정리.
    const settleMode = draft.physics?.settle ?? "off";
    const settled =
      st.preview && settleMode === "light" && formation > 0.9 ? relaxPoints(target, r, 16, colliders) : target;

    const splitIdx = hasB ? Math.min(settled.length - 2, Math.max(1, split)) : -1;
    if (hasB && splitIdx > 0) {
      if (tubeBRef.current) tubeBRef.current.visible = true;
      setGeom(tubeARef.current, settled.slice(0, splitIdx + 1), r);
      setGeom(tubeBRef.current, settled.slice(splitIdx), r);
    } else {
      if (tubeBRef.current) tubeBRef.current.visible = false;
      setGeom(tubeARef.current, settled, r);
    }
  });

  if (!draft) return null;
  const selPoint = selected != null ? points[selected] : null;

  return (
    <group>
      <mesh ref={tubeARef} material={mats.A} castShadow receiveShadow />
      <mesh ref={tubeBRef} material={mats.B} castShadow receiveShadow />

      {/* 제어점 마커(선택 점 제외) — 저작 좌표. 미리보기 중엔 숨김. */}
      {!preview &&
        points.map((p, i) =>
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
              depthTest={false}
            />
          </mesh>
        )
      )}

      {/* 선택된 점 = 드래그 핸들. 미리보기 중엔 숨김. */}
      {!preview && selPoint && (
        <mesh ref={setHandle} position={selPoint as THREE.Vector3Tuple} renderOrder={999}>
          <sphereGeometry args={[r * 1.9, 20, 20]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} depthTest={false} />
        </mesh>
      )}
      {!preview && selPoint && handle && (
        <TransformControls
          object={handle}
          mode="translate"
          size={1.5}
          onMouseDown={() => beginChange()}
          onObjectChange={() => {
            if (selected == null) return;
            movePoint(selected, [handle.position.x, handle.position.y, handle.position.z]);
          }}
          onMouseUp={() => {
            if (selected == null) return;
            movePoint(selected, [handle.position.x, handle.position.y, handle.position.z]);
          }}
        />
      )}
    </group>
  );
}
