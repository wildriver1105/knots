"use client";

// 도프시트 타임라인 — 재생헤드 스크럽/재생, 스텝 눈금, 전역 키 밀도, 선택 점의 키프레임(드래그 리타이밍),
// 키 추가/삭제, 어니언 스킨 토글. 무대 하단 오버레이로 표시된다.

import { useRef } from "react";
import { useEditorStore } from "@/lib/editor/store";
import { keyTimes } from "@/lib/knots/anim";

export default function TimelinePanel() {
  const draft = useEditorStore((s) => s.draft);
  const selected = useEditorStore((s) => s.selected);
  const playheadT = useEditorStore((s) => s.playheadT);
  const dopePlaying = useEditorStore((s) => s.dopePlaying);
  const onion = useEditorStore((s) => s.onion);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const playDope = useEditorStore((s) => s.playDope);
  const pauseDope = useEditorStore((s) => s.pauseDope);
  const addKeyHere = useEditorStore((s) => s.addKeyHere);
  const removeKeyHere = useEditorStore((s) => s.removeKeyHere);
  const moveKeyTime = useEditorStore((s) => s.moveKeyTime);
  const setOnion = useEditorStore((s) => s.setOnion);

  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: "scrub" } | { kind: "key"; point: number; t: number } | null>(null);

  if (!draft?.animation) return null;
  const anim = draft.animation;
  const tFromEvent = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };

  const allKeys = keyTimes(anim);
  const selKeys = selected != null ? anim.tracks[selected]?.keys ?? [] : [];

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

  const pct = (t: number) => `${(t * 100).toFixed(2)}%`;

  return (
    <div className="dope-timeline">
      <div className="dope-tl-controls">
        <button className="ctrl-btn ctrl-btn--primary" onClick={() => (dopePlaying ? pauseDope() : playDope())} title="재생/일시정지">
          {dopePlaying ? "❚❚" : "▶"}
        </button>
        <span className="dope-tl-time">{Math.round(playheadT * 100)}%</span>
        <button className="ed-mini" disabled={selected == null} onClick={addKeyHere} title="선택 점에 현재 시간 키 추가">
          ◆ 키 추가
        </button>
        <button className="ed-mini" disabled={selected == null} onClick={removeKeyHere} title="선택 점의 현재 시간 키 삭제">
          ◇ 키 삭제
        </button>
        <button className={`ed-mini ${onion ? "ed-mini--accent" : ""}`} onClick={() => setOnion(!onion)} title="이전/다음 키 줄 고스트">
          🧅 어니언
        </button>
        <span className="dope-tl-sel">
          {selected != null ? `점 #${selected} · 키 ${selKeys.length}개` : "점을 선택하세요"}
        </span>
      </div>

      <div
        ref={trackRef}
        className="dope-tl-track"
        onPointerDown={onTrackDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {/* 스텝 눈금 */}
        {draft.steps.map((s, i) => (
          <div key={"step" + i} className="dope-tl-step" style={{ left: pct(s.reveal) }} title={`스텝 ${i + 1}: ${s.title}`}>
            <span>{i + 1}</span>
          </div>
        ))}

        {/* 전역 키 밀도(연한 눈금) */}
        {allKeys.map((t, i) => (
          <div key={"k" + i} className="dope-tl-keytick" style={{ left: pct(t) }} />
        ))}

        {/* 선택 점의 키프레임(드래그 리타이밍) */}
        {selKeys.map((k, i) => (
          <div
            key={"sk" + i}
            className="dope-tl-key"
            style={{ left: pct(k.t) }}
            title={`키 t=${k.t.toFixed(2)} (드래그=리타이밍, 클릭=이동)`}
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
