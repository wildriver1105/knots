"use client";

// 모드 토글 — 단계별(step) / 연속(continuous). + 디버그 포인트 토글.

import { usePlayerStore } from "@/lib/player/store";

export default function ModeToggle({
  showDebug,
  onToggleDebug,
}: {
  showDebug: boolean;
  onToggleDebug: () => void;
}) {
  const mode = usePlayerStore((s) => s.mode);
  const setMode = usePlayerStore((s) => s.setMode);

  return (
    <div className="mode-toggle">
      <div className="seg">
        <button className={`seg-btn ${mode === "step" ? "seg-btn--on" : ""}`} onClick={() => setMode("step")}>
          단계별
        </button>
        <button
          className={`seg-btn ${mode === "continuous" ? "seg-btn--on" : ""}`}
          onClick={() => setMode("continuous")}
        >
          연속 재생
        </button>
      </div>
      <button className={`dbg-btn ${showDebug ? "dbg-btn--on" : ""}`} onClick={onToggleDebug} title="제어점 표시(저작용)">
        ⊹ points
      </button>
    </div>
  );
}
