"use client";

// 카메라 제어 — OrbitControls 로 사용자가 자유롭게 회전/줌.
// 스텝이 바뀌면 그 스텝의 camera(정의된 경우)로 ~0.6초간 부드럽게 이동한 뒤 손을 뗀다.
// 이징이 끝나면 사용자가 그대로 자유 조작할 수 있다(검증 스크린샷이 의도한 각도로 잡히게 한다).

import { useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { usePlayerStore } from "@/lib/player/store";
import { getKnot } from "@/lib/knots/registry";
import { cameraForProgress, stepIndexToProgress } from "@/lib/knots/interpolate";

const EASE = 0.6; // 스텝 전환 카메라 이징 시간(초)

export default function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);

  const knotId = usePlayerStore((s) => s.knotId);
  const mode = usePlayerStore((s) => s.mode);
  const stepIndex = usePlayerStore((s) => s.stepIndex);
  const progress = usePlayerStore((s) => s.progress);

  const remain = useRef(0); // 남은 이징 시간(초)
  const fromPos = useRef(new THREE.Vector3());
  const fromTgt = useRef(new THREE.Vector3());
  const toPos = useRef(new THREE.Vector3());
  const toTgt = useRef(new THREE.Vector3());
  const lastKey = useRef<string>("");

  // 렌더 중 ref 만 갱신(상태 변경 없음) — 스텝/매듭이 바뀌면 목표 카메라를 잡고 이징 시작.
  const knot = getKnot(knotId);
  const prog = mode === "step" ? stepIndexToProgress(knot, stepIndex) : progress;
  const cam = cameraForProgress(knot, prog);
  const key = `${knotId}:${mode === "step" ? stepIndex : Math.round(progress * 100)}`;
  if (key !== lastKey.current) {
    lastKey.current = key;
    if (cam) {
      fromPos.current.copy(camera.position);
      fromTgt.current.copy(controls.current?.target ?? new THREE.Vector3());
      toPos.current.set(cam.position[0], cam.position[1], cam.position[2]);
      toTgt.current.set(cam.target[0], cam.target[1], cam.target[2]);
      remain.current = EASE;
    }
  }

  useFrame((_, dt) => {
    if (remain.current <= 0 || !controls.current) return;
    remain.current = Math.max(0, remain.current - dt);
    const t = 1 - remain.current / EASE; // 0..1
    const e = t * t * (3 - 2 * t); // smoothstep
    camera.position.lerpVectors(fromPos.current, toPos.current, e);
    controls.current.target.lerpVectors(fromTgt.current, toTgt.current, e);
    controls.current.update();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      minDistance={2.5}
      maxDistance={9}
      target={[0, 0, 0]}
      enableDamping
      dampingFactor={0.08}
    />
  );
}
