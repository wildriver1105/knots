"use client";

// 에디터 3D: 제어점(마커)을 클릭 선택 → 기즈모로 드래그하면 그 스텝의 포즈가 바뀐다.
// 줄(튜브)은 뷰와 동일하게 RopeSolver(텐션+자기충돌, 중력 0)로 정착시켜 그린다 → 에디터에서도
// 가닥이 겹치지 않는다. 마커/기즈모는 "저작 좌표"(draft)에 있고, 튜브는 충돌 해소된 결과를 보여준다.
//
// TransformControls 는 object prop 으로 핸들에 직접 부착(자식 래핑 시 부모 그룹만 움직이는 버그 방지).

import { useMemo, useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TransformControls } from "@react-three/drei";
import type { Vec3 } from "@/lib/knots/types";
import { useEditorStore } from "@/lib/editor/store";
import { RopeSolver, collidersForObject, solverOptionsForKnot } from "@/lib/knots/physics";
import { interpolatePoses } from "@/lib/knots/interpolate";
import { makeRopeMaterial } from "./ropeTexture";

function tube(points: Vec3[], radius: number): THREE.TubeGeometry | null {
  if (points.length < 2) return null;
  const v = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(v, false, "centripetal");
  return new THREE.TubeGeometry(curve, Math.max(24, points.length * 8), radius, 22, false);
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
  // solver dense 출력 → 색 경계는 호 비율로.
  const splitFraction = hasB && points.length > 1 ? split / (points.length - 1) : 0;

  const solver = useMemo(() => new RopeSolver(r), [draft?.id, r, points.length]);
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
    if (st.preview) {
      if (st.previewPlaying) st.tickPreview(Math.min(dt, 0.05));
      target = interpolatePoses(draft.poses, useEditorStore.getState().previewProgress);
    }
    const formation = st.preview ? st.previewProgress : activeStep / Math.max(1, draft.poses.length - 1);
    const result = solver.step([target], dt, solverOptionsForKnot(draft, formation), colliders);
    const settled = result[0];
    const splitIdx = hasB ? Math.round(splitFraction * (settled.length - 1)) : -1;
    if (hasB && splitIdx > 0 && splitIdx < settled.length - 1) {
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
