"use client";

// 앱 루트(client). 3D 캔버스(ssr:false)를 동적 임포트하고, 입력 어댑터를 연결하며,
// 보기/에디터 모드와 오버레이 UI(매듭 선택·단계 패널·컨트롤 바·모드 토글·음성)를 배치한다.

import { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useInputAdapters } from "@/lib/player/useInputAdapters";
import { createKeyboardAdapter } from "@/lib/player/adapters/keyboard";
import { BUILTIN_SEED } from "@/lib/knots/data";
import { validateAllKnots } from "@/lib/knots/validate";
import { usePlayerStore } from "@/lib/player/store";
import { getKnot } from "@/lib/knots/registry";
import { useKnotsRepo } from "@/lib/knots/repo";
import { useEditorStore } from "@/lib/editor/store";
import KnotPicker from "@/components/ui/KnotPicker";
import StepPanel from "@/components/ui/StepPanel";
import ControlBar from "@/components/ui/ControlBar";
import ModeToggle from "@/components/ui/ModeToggle";
import VoiceControl from "@/components/ui/VoiceControl";
import EditorPanel from "@/components/ui/EditorPanel";

// R3F 캔버스는 SSR 금지 → 동적 임포트.
const SceneCanvas = dynamic(() => import("@/components/scene/SceneCanvas"), {
  ssr: false,
  loading: () => <div className="canvas-loading">3D 로딩 중…</div>,
});

export default function KnotApp() {
  const [showDebug, setShowDebug] = useState(false);

  // Phase 1: 키보드 어댑터. (음성은 VoiceControl 토글로 시작)
  const adapters = useMemo(() => [createKeyboardAdapter()], []);
  useInputAdapters(adapters);

  const hydrate = useKnotsRepo((s) => s.hydrate);
  useEffect(() => {
    validateAllKnots(BUILTIN_SEED);
    void hydrate().then(() => validateAllKnots(useKnotsRepo.getState().knots));
  }, [hydrate]);

  const knotId = usePlayerStore((s) => s.knotId);
  // repo 가 하이드레이트되면 리렌더되도록 구독(getKnot 은 repo 를 읽음).
  useKnotsRepo((s) => s.loaded);
  const knot = getKnot(knotId);
  const editing = useEditorStore((s) => s.editing);

  return (
    <div className={`app ${editing ? "app--editing" : ""}`}>
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">⚓</span>
          <span className="brand-name">knots</span>
          <span className="brand-sub">{editing ? "에디터 — 스텝별로 줄을 움직여 만드세요" : "세일링 매듭을 3D로 배우기"}</span>
        </div>
        {!editing && (
          <div className="header-tools">
            <VoiceControl />
            <ModeToggle showDebug={showDebug} onToggleDebug={() => setShowDebug((v) => !v)} />
          </div>
        )}
      </header>

      <div className="main">
        {/* 왼쪽 레일: 보기=설명/단계, 에디터=편집 패널 */}
        <aside className="rail">
          {editing ? (
            <EditorPanel />
          ) : (
            <>
              <div className="knot-blurb">
                <h1>{knot.name}</h1>
                <p>{knot.blurb}</p>
              </div>
              <StepPanel />
            </>
          )}
        </aside>

        {/* 3D 무대 (히어로) */}
        <div className="stage">
          <SceneCanvas showDebug={showDebug} />
          {!editing && (
            <div className="overlay overlay--bottom">
              <ControlBar />
            </div>
          )}
        </div>
      </div>

      {/* 매듭 선택 */}
      <KnotPicker />

      <footer className="app-footer">
        <span>
          {editing
            ? "점 클릭 → 기즈모로 드래그 · 스텝 추가로 다음 포즈 · 저장하면 그 순서대로 애니메이션"
            : "Space 재생/정지 · ← → 단계 · R 되감기 · M 모드 · 🎙 음성으로 핸즈프리"}
        </span>
      </footer>
    </div>
  );
}
