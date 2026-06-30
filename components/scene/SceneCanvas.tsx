"use client";

// R3F Canvas 호스트. KnotApp 에서 dynamic(ssr:false) 로 임포트된다.
// (SSR 중 WebGL/R3F 리콘실러가 실행되면 안 되므로.)

import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useState } from "react";
import * as THREE from "three";
import Lighting from "./Lighting";
import Ground from "./Ground";
import Rope from "./Rope";
import KnotObject from "./KnotObject";
import CameraRig from "./CameraRig";
import PlaybackTicker from "./PlaybackTicker";
import DebugPoints from "./DebugPoints";
import EditScene from "./EditScene";
import DopeScene from "./DopeScene";
import { useEditorStore } from "@/lib/editor/store";

// 탭이 보이고 포커스가 있을 때만 렌더 루프를 돌린다. (데스크탑 발열 방지)
// SSR 안전: document/window 접근은 useEffect 안에서만, 초기값은 true.
function usePageActive(): boolean {
  const [active, setActive] = useState(true);
  useEffect(() => {
    // 보이는 동안은 항상 렌더, 탭이 진짜 숨겨졌을 때만(백그라운드/최소화/화면꺼짐) 정지.
    // hasFocus()까지 보면 창이 최전면이 아닐 때도 멈춰 3D가 안 보이는 문제가 생겨 제외.
    const update = () => setActive(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return active;
}

// 모바일 감지 (클라이언트에서 1회). SSR 안전: 초기값 false + 마운트 후 계산.
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(
      window.matchMedia?.("(pointer: coarse)").matches ||
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
    );
  }, []);
  return isMobile;
}

export default function SceneCanvas({ showDebug = false }: { showDebug?: boolean }) {
  const editing = useEditorStore((s) => s.editing);
  const dope = useEditorStore((s) => s.dope);
  const draftObject = useEditorStore((s) => s.draft?.object);
  const active = usePageActive();
  const isMobile = useIsMobile();
  return (
    <Canvas
      shadows
      frameloop={active ? "always" : "never"}
      dpr={isMobile ? 1 : [1, 2]}
      gl={{ antialias: !isMobile, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      camera={{ position: [3.4, 2.4, 4.6], fov: 45, near: 0.1, far: 100 }}
    >
      <Suspense fallback={null}>
        <Lighting isMobile={isMobile} />
        <group position={[0, 0, 0]}>
          {editing ? (
            <>
              {draftObject && <KnotObject object={draftObject} />}
              {dope ? <DopeScene /> : <EditScene />}
            </>
          ) : (
            <>
              <KnotObject />
              <Rope />
              {showDebug && <DebugPoints />}
            </>
          )}
        </group>
        <Ground />
      </Suspense>
      {!editing && <PlaybackTicker />}
      <CameraRig />
    </Canvas>
  );
}
