"use client";

// 스튜디오 조명 — IBL(Environment) + 그림자 캐스팅 키 라이트 + 소프트 섀도우.
// "낮지 않은 퀄리티"는 대부분 여기서 나온다.

import { Environment, SoftShadows } from "@react-three/drei";

export default function Lighting() {
  return (
    <>
      <SoftShadows size={26} samples={12} focus={0.6} />
      <ambientLight intensity={0.35} />
      {/* 키 라이트 — 그림자 생성 */}
      <directionalLight
        position={[4, 6, 5]}
        intensity={2.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0004}
      />
      {/* 필 라이트 */}
      <directionalLight position={[-5, 2, -3]} intensity={0.5} color="#bcd4ff" />
      {/* 이미지 기반 조명: 사실적 스페큘러 반응 */}
      <Environment preset="studio" />
    </>
  );
}
