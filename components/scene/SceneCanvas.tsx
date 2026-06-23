"use client";

// R3F Canvas 호스트. KnotApp 에서 dynamic(ssr:false) 로 임포트된다.
// (SSR 중 WebGL/R3F 리콘실러가 실행되면 안 되므로.)

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import * as THREE from "three";
import Lighting from "./Lighting";
import Ground from "./Ground";
import Rope from "./Rope";
import KnotObject from "./KnotObject";
import CameraRig from "./CameraRig";
import PlaybackTicker from "./PlaybackTicker";
import DebugPoints from "./DebugPoints";

export default function SceneCanvas({ showDebug = false }: { showDebug?: boolean }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      camera={{ position: [3.4, 2.4, 4.6], fov: 45, near: 0.1, far: 100 }}
    >
      <Suspense fallback={null}>
        <Lighting />
        <group position={[0, 0, 0]}>
          <KnotObject />
          <Rope />
          {showDebug && <DebugPoints />}
        </group>
        <Ground />
      </Suspense>
      <PlaybackTicker />
      <CameraRig />
    </Canvas>
  );
}
