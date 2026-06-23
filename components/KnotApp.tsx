"use client";

// 앱 루트(client). 3D 캔버스(ssr:false)를 동적 임포트하고, 입력 어댑터를 연결하며,
// 오버레이 UI(매듭 선택·단계 패널·컨트롤 바·모드 토글)를 배치한다.

import { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useInputAdapters } from "@/lib/player/useInputAdapters";
import { createKeyboardAdapter } from "@/lib/player/adapters/keyboard";
import { KNOTS } from "@/lib/knots/data";
import { validateAllKnots } from "@/lib/knots/validate";
import { usePlayerStore } from "@/lib/player/store";
import { getKnot } from "@/lib/knots/data";
import KnotPicker from "@/components/ui/KnotPicker";
import StepPanel from "@/components/ui/StepPanel";
import ControlBar from "@/components/ui/ControlBar";
import ModeToggle from "@/components/ui/ModeToggle";

// R3F 캔버스는 SSR 금지 → 동적 임포트.
const SceneCanvas = dynamic(() => import("@/components/scene/SceneCanvas"), {
  ssr: false,
  loading: () => <div className="canvas-loading">3D 로딩 중…</div>,
});

export default function KnotApp() {
  const [showDebug, setShowDebug] = useState(false);

  // Phase 1: 키보드 어댑터. Phase 2 에선 여기에 gesture/voice 를 추가.
  const adapters = useMemo(() => [createKeyboardAdapter()], []);
  useInputAdapters(adapters);

  // dev 데이터 검증(한 번)
  useEffect(() => {
    validateAllKnots(KNOTS);
  }, []);

  const knotId = usePlayerStore((s) => s.knotId);
  const knot = getKnot(knotId);

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">⚓</span>
          <span className="brand-name">knots</span>
          <span className="brand-sub">세일링 매듭을 3D로 배우기</span>
        </div>
        <ModeToggle showDebug={showDebug} onToggleDebug={() => setShowDebug((v) => !v)} />
      </header>

      <div className="main">
        {/* 왼쪽 레일: 매듭 설명 + 단계 안내 */}
        <aside className="rail">
          <div className="knot-blurb">
            <h1>{knot.name}</h1>
            <p>{knot.blurb}</p>
          </div>
          <StepPanel />
        </aside>

        {/* 3D 무대 (히어로) */}
        <div className="stage">
          <SceneCanvas showDebug={showDebug} />
          <div className="overlay overlay--bottom">
            <ControlBar />
          </div>
        </div>
      </div>

      {/* 매듭 선택 */}
      <KnotPicker />

      <footer className="app-footer">
        <span>Space 재생/정지 · ← → 단계 · R 되감기 · M 모드</span>
        <span className="footer-phase2">touchless(카메라·음성)는 Phase 2</span>
      </footer>
    </div>
  );
}
