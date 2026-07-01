"use client";

// 도프시트 3D 편집 — 점별 키프레임.
// 현재 재생헤드 시간(playheadT)에서 애니메이션을 평가해 줄과 제어점을 그린다.
// 점을 선택→기즈모로 끌면 그 점의 "현재 시간 키프레임"이 갱신/추가된다(autokey).
// 어니언 스킨: 이전/다음 키 시각의 줄을 반투명 고스트로 겹쳐 보여준다.
//
// 지오메트리는 useFrame 에서 imperative 하게 갱신(setState 금지). 마커/기즈모 위치는 store 의
// playheadT 구독으로 re-render 될 때 useMemo 로 다시 계산한다.

import { useMemo, useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TransformControls } from "@react-three/drei";
import type { Vec3 } from "@/lib/knots/types";
import { useEditorStore } from "@/lib/editor/store";
import { sampleAnimation, keyTimes } from "@/lib/knots/anim";
import { makeRopeMaterial } from "./ropeTexture";
import { setTube, setTwoToneTube } from "./ropeTube";

export default function DopeScene() {
  const draft = useEditorStore((s) => s.draft);
  const selected = useEditorStore((s) => s.selected);
  const select = useEditorStore((s) => s.select);
  const movePoint = useEditorStore((s) => s.movePoint);
  const beginChange = useEditorStore((s) => s.beginChange);
  const onion = useEditorStore((s) => s.onion);
  const playheadT = useEditorStore((s) => s.playheadT);
  const dopePlaying = useEditorStore((s) => s.dopePlaying);
  const [handle, setHandle] = useState<THREE.Mesh | null>(null);

  const anim = draft?.animation;
  const r = draft?.ropeRadius ?? 0.075;
  const split = draft?.colorSplitIndex ?? -1;
  const n = anim?.tracks.length ?? 0;
  const hasB = split > 0 && !!draft?.ropeColorB && split < n - 1;

  // 마커/기즈모 위치 = 현재 시간 샘플(re-render 시에만 재계산 — useFrame setState 금지).
  const markers = useMemo(() => (anim ? sampleAnimation(anim, playheadT) : []), [anim, playheadT]);

  const mats = useMemo(() => {
    const A = makeRopeMaterial(draft?.ropeColor ?? "#e0584b");
    const B = makeRopeMaterial(draft?.ropeColorB ?? "#3f8fce");
    return {
      tube: [A, B], // 단일 튜브 + 그룹(투톤). 단색이면 그룹 없어 A 만 사용.
      ghost: new THREE.MeshStandardMaterial({ color: "#9fb3c8", transparent: true, opacity: 0.16, roughness: 0.9, depthWrite: false }),
    };
  }, [draft?.ropeColor, draft?.ropeColorB]);

  const tubeRef = useRef<THREE.Mesh>(null);
  const ghostPrevRef = useRef<THREE.Mesh>(null);
  const ghostNextRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    return () => {
      tubeRef.current?.geometry?.dispose();
      ghostPrevRef.current?.geometry?.dispose();
      ghostNextRef.current?.geometry?.dispose();
    };
  }, [draft?.id]);

  useFrame((_, dt) => {
    const st = useEditorStore.getState();
    const a = st.draft?.animation;
    if (!a) return;
    if (st.dopePlaying) st.tickDope(Math.min(dt, 0.05));
    const t = st.playheadT;
    const pts = sampleAnimation(a, t);

    // 하나의 연속 튜브 + 색 경계 그룹 분할(곡선 끊김 없음).
    if (hasB) setTwoToneTube(tubeRef.current, pts, r, split / Math.max(1, pts.length - 1));
    else setTube(tubeRef.current, pts, r);

    // 어니언 스킨: 재생헤드 양쪽 가장 가까운 키 시각의 줄 고스트.
    if (st.onion && !st.dopePlaying) {
      const times = keyTimes(a);
      const prevT = [...times].reverse().find((x) => x < t - 1e-3);
      const nextT = times.find((x) => x > t + 1e-3);
      if (ghostPrevRef.current) {
        ghostPrevRef.current.visible = prevT !== undefined;
        if (prevT !== undefined) setTube(ghostPrevRef.current, sampleAnimation(a, prevT), r);
      }
      if (ghostNextRef.current) {
        ghostNextRef.current.visible = nextT !== undefined;
        if (nextT !== undefined) setTube(ghostNextRef.current, sampleAnimation(a, nextT), r);
      }
    } else {
      if (ghostPrevRef.current) ghostPrevRef.current.visible = false;
      if (ghostNextRef.current) ghostNextRef.current.visible = false;
    }
  });

  if (!draft || !anim) return null;
  const showHandles = !dopePlaying;
  const selPoint = selected != null ? markers[selected] : null;
  const keyedHere = (i: number) => anim.tracks[i]?.keys.some((k) => Math.abs(k.t - playheadT) <= 0.02);

  return (
    <group>
      <mesh ref={tubeRef} material={mats.tube} castShadow receiveShadow />
      <mesh ref={ghostPrevRef} material={mats.ghost} />
      <mesh ref={ghostNextRef} material={mats.ghost} />

      {showHandles &&
        markers.map((p, i) =>
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
              <sphereGeometry args={[r * 1.6, 14, 14]} />
              <meshStandardMaterial
                color={i === 0 ? "#22c55e" : i === n - 1 ? "#3b82f6" : keyedHere(i) ? "#f59e0b" : "#cdd7e2"}
                emissive={i === 0 ? "#22c55e" : i === n - 1 ? "#3b82f6" : keyedHere(i) ? "#f59e0b" : "#6b7785"}
                emissiveIntensity={keyedHere(i) ? 0.7 : 0.4}
                roughness={0.4}
                depthTest={false}
              />
            </mesh>
          )
        )}

      {showHandles && selPoint && (
        <mesh ref={setHandle} position={selPoint as THREE.Vector3Tuple} renderOrder={999}>
          <sphereGeometry args={[r * 1.9, 20, 20]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} depthTest={false} />
        </mesh>
      )}
      {showHandles && selPoint && handle && (
        <TransformControls
          object={handle}
          mode="translate"
          size={1.4}
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
