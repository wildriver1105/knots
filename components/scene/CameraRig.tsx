"use client";

// 카메라 제어 — OrbitControls 로 사용자가 자유롭게 회전/줌.
// step.camera 가 정의된 경우 해당 시점으로 부드럽게 이동(향후 확장). 현재는 OrbitControls 중심.

import { OrbitControls } from "@react-three/drei";

export default function CameraRig() {
  return (
    <OrbitControls
      enablePan={false}
      minDistance={2.5}
      maxDistance={9}
      target={[0, 0, 0]}
      enableDamping
      dampingFactor={0.08}
    />
  );
}
