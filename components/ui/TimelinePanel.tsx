"use client";

// 도프시트 타임라인 — 영상 편집 툴처럼 초/프레임 단위. 재생헤드 스크럽/재생(실시간 초), 프레임 스냅,
// 프레임 이동, 길이(초)·fps 설정, 스텝 눈금, 초 눈금자, 전역 키 밀도, 선택 점의 키프레임(드래그 리타이밍),
// 키 추가/삭제, 어니언 스킨. 무대 하단 오버레이.

import { useRef } from "react";
import { useEditorStore } from "@/lib/editor/store";
import { keyTimes } from "@/lib/knots/anim";

export default function TimelinePanel() {
  const draft = useEditorStore((s) => s.draft);
  const selected = useEditorStore((s) => s.selected);
  const playheadT = useEditorStore((s) => s.playheadT);
  const dopePlaying = useEditorStore((s) => s.dopePlaying);
  const onion = useEditorStore((s) => s.onion);
  const durationSec = useEditorStore((s) => s.durationSec);
  const fps = useEditorStore((s) => s.fps);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const playDope = useEditorStore((s) => s.playDope);
  const pauseDope = useEditorStore((s) => s.pauseDope);
  const stepFrame = useEditorStore((s) => s.stepFrame);
  const setDuration = useEditorStore((s) => s.setDuration);
  const setFps = useEditorStore((s) => s.setFps);
  const addKeyHere = useEditorStore((s) => s.addKeyHere);
  const removeKeyHere = useEditorStore((s) => s.removeKeyHere);
  const moveKeyTime = useEditorStore((s) => s.moveKeyTime);
  const setOnion = useEditorStore((s) => s.setOnion);

  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: "scrub" } | { kind: "key"; point: number; t: number } | null>(null);

  if (!draft?.animation) return null;
  const anim = draft.animation;
  const totalFrames = Math.max(1, Math.round(durationSec * fps));
  const curFrame = Math.round(playheadT * totalFrames);
  const curSec = playheadT * durationSec;

  const tFromEvent = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };

  const allKeys = keyTimes(anim);
  const selKeys = selected != null ? anim.tracks[selected]?.keys ?? [] : [];
  const pct = (t: number) => `${(t * 100).toFixed(2)}%`;

  // 초 눈금자: 0..durationSec 정수 초. 너무 촘촘하면 간격을 키운다.
  const secStep = durationSec > 16 ? 2 : 1;
  const secLines: number[] = [];
  for (let s = 0; s <= Math.floor(durationSec) + 1e-6; s += secStep) secLines.push(s);

  const onTrackDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { kind: "scrub" };
    setPlayhead(tFromEvent(e.clientX));
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const t = tFromEvent(e.clientX);
    if (drag.current.kind === "scrub") setPlayhead(t);
    else if (drag.current.kind === "key") {
      moveKeyTime(drag.current.point, drag.current.t, t);
      drag.current.t = t;
    }
  };
  const onUp = () => {
    drag.current = null;
  };

  return (
    <div className="dope-timeline">
      <div className="dope-tl-controls">
        <button className="ctrl-btn ctrl-btn--primary" onClick={() => (dopePlaying ? pauseDope() : playDope())} title="재생/일시정지">
          {dopePlaying ? "❚❚" : "▶"}
        </button>
        <button className="ed-mini" onClick={() => stepFrame(-1)} title="이전 프레임">
          ◀|
        </button>
        <button className="ed-mini" onClick={() => stepFrame(1)} title="다음 프레임">
          |▶
        </button>
        <span className="dope-tl-time">
          {curSec.toFixed(2)}s · {curFrame}f
        </span>

        <label className="dope-tl-field" title="타임라인 전체 길이(초)">
          길이
          <input
            type="number"
            min={0.2}
            step={0.1}
            value={durationSec}
            onChange={(e) => setDuration(parseFloat(e.target.value) || 0.2)}
          />
          s
        </label>
        <label className="dope-tl-field" title="프레임 스냅 그리드(fps)">
          fps
          <select value={fps} onChange={(e) => setFps(parseInt(e.target.value, 10))}>
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={30}>30</option>
            <option value={60}>60</option>
          </select>
        </label>

        <button className="ed-mini" disabled={selected == null} onClick={addKeyHere} title="선택 점에 현재 프레임 키 추가">
          ◆ 키
        </button>
        <button className="ed-mini" disabled={selected == null} onClick={removeKeyHere} title="선택 점의 현재 프레임 키 삭제">
          ◇ 키
        </button>
        <button className={`ed-mini ${onion ? "ed-mini--accent" : ""}`} onClick={() => setOnion(!onion)} title="이전/다음 키 줄 고스트">
          🧅
        </button>
        <span className="dope-tl-sel">{selected != null ? `점 #${selected} · 키 ${selKeys.length}` : "점을 선택"}</span>
      </div>

      <div
        ref={trackRef}
        className="dope-tl-track"
        onPointerDown={onTrackDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {/* 초 눈금자 */}
        {secLines.map((s) => (
          <div key={"sec" + s} className="dope-tl-sec" style={{ left: pct(durationSec ? s / durationSec : 0) }}>
            <span>{s}s</span>
          </div>
        ))}

        {/* 스텝 눈금 */}
        {draft.steps.map((s, i) => (
          <div key={"step" + i} className="dope-tl-step" style={{ left: pct(s.reveal) }} title={`스텝 ${i + 1}: ${s.title}`}>
            <span>{i + 1}</span>
          </div>
        ))}

        {/* 전역 키 밀도 */}
        {allKeys.map((t, i) => (
          <div key={"k" + i} className="dope-tl-keytick" style={{ left: pct(t) }} />
        ))}

        {/* 선택 점 키프레임(드래그 리타이밍 → 프레임 스냅) */}
        {selKeys.map((k, i) => (
          <div
            key={"sk" + i}
            className="dope-tl-key"
            style={{ left: pct(k.t) }}
            title={`키 ${(k.t * durationSec).toFixed(2)}s / ${Math.round(k.t * totalFrames)}f (드래그=리타이밍)`}
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              drag.current = { kind: "key", point: selected as number, t: k.t };
              setPlayhead(k.t);
            }}
            onPointerMove={onMove}
            onPointerUp={onUp}
          />
        ))}

        {/* 재생헤드 */}
        <div className="dope-tl-playhead" style={{ left: pct(playheadT) }} />
      </div>
    </div>
  );
}
