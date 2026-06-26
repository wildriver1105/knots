"use client";

// 재생 컨트롤 바 — play/pause · prev · next · rewind · 스크럽 슬라이더 · 모드별 위치 표시.
// 모든 동작은 PlayerCommands(스토어)로 전달된다. (키보드 어댑터와 동일한 버스)

import { usePlayerStore } from "@/lib/player/store";
import { getKnot } from "@/lib/knots/registry";
import { progressToStepIndex, stepIndexToProgress } from "@/lib/knots/interpolate";

export default function ControlBar() {
  const knotId = usePlayerStore((s) => s.knotId);
  const mode = usePlayerStore((s) => s.mode);
  const stepIndex = usePlayerStore((s) => s.stepIndex);
  const progress = usePlayerStore((s) => s.progress);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playbackRate = usePlayerStore((s) => s.playbackRate);

  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const rewind = usePlayerStore((s) => s.rewind);
  const seek = usePlayerStore((s) => s.seek);
  const setRate = usePlayerStore((s) => s.setRate);

  const knot = getKnot(knotId);
  const lastStep = knot.steps.length - 1;
  const curStep = mode === "step" ? stepIndex : progressToStepIndex(knot, progress);
  const position = mode === "step" ? stepIndexToProgress(knot, stepIndex) : progress;
  const rates = [
    { value: 0.5, label: "느림" },
    { value: 1, label: "보통" },
    { value: 1.5, label: "빠름" },
    { value: 2, label: "매우 빠름" },
  ];

  return (
    <div className="control-bar">
      <div className="control-buttons">
        <button className="ctrl-btn" onClick={rewind} aria-label="처음으로" title="처음으로 (R)">
          ⏮
        </button>
        <button className="ctrl-btn" onClick={prev} aria-label="이전 단계" title="이전 (←)">
          ◀
        </button>
        <button className="ctrl-btn ctrl-btn--primary" onClick={togglePlay} aria-label="재생/일시정지" title="재생/일시정지 (Space)">
          {isPlaying ? "❚❚" : "▶"}
        </button>
        <button className="ctrl-btn" onClick={next} aria-label="다음 단계" title="다음 (→)">
          ▶
        </button>
      </div>

      <input
        className="scrubber"
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={position}
        onChange={(e) => seek(parseFloat(e.target.value))}
        aria-label="진행 위치"
      />

      <div className="step-counter">
        {curStep + 1} / {lastStep + 1}
      </div>

      <div className="speed-control" aria-label="재생 속도">
        {rates.map((rate) => (
          <button
            key={rate.value}
            className={`speed-chip ${Math.abs(playbackRate - rate.value) < 0.001 ? "speed-chip--on" : ""}`}
            onClick={() => setRate(rate.value)}
            type="button"
            title={`재생 속도: ${rate.label} (${rate.value}x)`}
          >
            {rate.label}
          </button>
        ))}
      </div>
    </div>
  );
}
