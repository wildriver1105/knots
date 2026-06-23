"use client";

// 바닥 — 매듭이 떠 있지 않고 접지되어 보이도록 부드러운 contact shadow 를 깐다.

import { ContactShadows } from "@react-three/drei";

export default function Ground() {
  return (
    <ContactShadows
      position={[0, -2.05, 0]}
      scale={12}
      far={5}
      blur={2.6}
      opacity={0.5}
      resolution={1024}
      color="#1a2230"
    />
  );
}
