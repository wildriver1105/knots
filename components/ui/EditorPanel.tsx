"use client";

// 통합 에디터 패널 — 빌트인/커스텀 모두 스텝별 포즈 편집.
// 스텝 탭에서 스텝을 고르고, 3D 에서 점을 클릭→기즈모로 끌어 그 스텝의 줄 모양을 잡는다.
// 저장 시 스텝 사이를 보간하는 애니메이션이 된다. 빌트인은 "기본값 복원" 가능.

import { useEffect, useState, useRef } from "react";
import { useEditorStore } from "@/lib/editor/store";
import { usePlayerStore } from "@/lib/player/store";

export default function EditorPanel() {
  const draft = useEditorStore((s) => s.draft);
  const isBuiltin = useEditorStore((s) => s.isBuiltin);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const activeStep = useEditorStore((s) => s.activeStep);
  const selected = useEditorStore((s) => s.selected);
  const setActiveStep = useEditorStore((s) => s.setActiveStep);
  const setStepText = useEditorStore((s) => s.setStepText);
  const addStep = useEditorStore((s) => s.addStep);
  const removeStep = useEditorStore((s) => s.removeStep);
  const duplicatePrevPose = useEditorStore((s) => s.duplicatePrevPose);
  const relaxPose = useEditorStore((s) => s.relaxPose);
  const setColorSplitHere = useEditorStore((s) => s.setColorSplitHere);
  const setColors = useEditorStore((s) => s.setColors);
  const setName = useEditorStore((s) => s.setName);
  const save = useEditorStore((s) => s.save);
  const stop = useEditorStore((s) => s.stop);
  const resetBuiltin = useEditorStore((s) => s.resetBuiltin);
  const preview = useEditorStore((s) => s.preview);
  const previewPlaying = useEditorStore((s) => s.previewPlaying);
  const previewProgress = useEditorStore((s) => s.previewProgress);
  const togglePreview = useEditorStore((s) => s.togglePreview);
  const playPreview = useEditorStore((s) => s.playPreview);
  const pausePreview = useEditorStore((s) => s.pausePreview);
  const setPreviewProgress = useEditorStore((s) => s.setPreviewProgress);
  const loadKnot = usePlayerStore((s) => s.loadKnot);

  // 단축키: ⌘/Ctrl+Z = undo, ⌘/Ctrl+Shift+Z 또는 Ctrl+Y = redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (k === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  if (!draft) return null;
  const step = draft.steps[activeStep];
  const K = draft.poses?.length ?? 0;

  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(savedTimer.current), []);

  // 그냥 저장 — 파일에 저장하고 에디터에 그대로 머문다(중간 저장).
  const doSave = () => {
    save();
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1600);
  };

  const saveAndView = () => {
    const id = save();
    if (id) {
      loadKnot(id);
      stop();
    }
  };
  const doReset = () => {
    const id = resetBuiltin();
    if (id) loadKnot(id);
  };

  // 미리보기 모드: 애니메이션 재생/스크럽만.
  if (preview) {
    const curStep = Math.min(K - 1, Math.round(previewProgress * (K - 1)));
    return (
      <div className="editor-panel">
        <div className="ed-shapehead">
          <strong>{draft.name}</strong> · 미리보기
        </div>
        <div className="control-bar ed-preview-bar">
          <div className="control-buttons">
            <button className="ctrl-btn ctrl-btn--primary" onClick={() => (previewPlaying ? pausePreview() : playPreview())}>
              {previewPlaying ? "❚❚" : "▶"}
            </button>
          </div>
          <input
            className="scrubber"
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={previewProgress}
            onChange={(e) => setPreviewProgress(parseFloat(e.target.value))}
          />
          <div className="step-counter">
            {curStep + 1} / {K}
          </div>
        </div>
        <p className="ed-hint">스텝 포즈 사이를 보간해 재생합니다(충돌·장력 적용). 슬라이더로 구간 확인.</p>
        <div className="ed-row ed-save">
          <button className="ed-save-btn" onClick={togglePreview}>
            ✎ 편집으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-panel">
      <div className="ed-row">
        <input
          className="ed-name"
          value={draft.name}
          onChange={(e) => setName(e.target.value)}
          placeholder="매듭 이름"
        />
        {isBuiltin && <span className="ed-badge">기본 매듭</span>}
      </div>

      <div className="ed-row ed-undo">
        <button className="ed-mini" onClick={undo} disabled={!canUndo} title="실행 취소 (⌘/Ctrl+Z)">
          ↶ 되돌리기
        </button>
        <button className="ed-mini" onClick={redo} disabled={!canRedo} title="다시 실행 (⌘/Ctrl+Shift+Z)">
          ↷ 다시
        </button>
      </div>

      <div className="ed-colors">
        <label>색
          <input type="color" value={draft.ropeColor} onChange={(e) => setColors(e.target.value, draft.ropeColorB ?? "#3f8fce")} />
        </label>
        <label>색2
          <input type="color" value={draft.ropeColorB ?? "#3f8fce"} onChange={(e) => setColors(draft.ropeColor, e.target.value)} />
        </label>
        <button className="ed-mini" disabled={selected == null} onClick={setColorSplitHere} title="선택한 점부터 색2">
          색 경계 ⟂
        </button>
      </div>

      <div className="ed-steps-label">스텝 (드래그한 모양이 단계별로 저장됨)</div>
      <div className="ed-steps">
        {Array.from({ length: K }, (_, i) => (
          <button
            key={i}
            className={`ed-step ${i === activeStep ? "ed-step--on" : ""}`}
            onClick={() => setActiveStep(i)}
          >
            {i + 1}
          </button>
        ))}
        <button className="ed-step ed-step--add" onClick={addStep} title="스텝 추가(현재 포즈 복제)">
          +
        </button>
      </div>

      <input
        className="ed-title"
        value={step?.title ?? ""}
        onChange={(e) => setStepText(activeStep, e.target.value, step?.instruction ?? "")}
        placeholder={`스텝 ${activeStep + 1} 제목`}
      />
      <textarea
        className="ed-desc"
        value={step?.instruction ?? ""}
        onChange={(e) => setStepText(activeStep, step?.title ?? "", e.target.value)}
        placeholder="이 스텝 설명(슬라이드에 표시)"
        rows={3}
      />

      <div className="ed-row ed-actions">
        <button className="ed-mini ed-mini--accent" onClick={relaxPose} title="이 스텝을 충돌·장력 물리로 정리(겹친 가닥 분리)">
          ⚙ 물리 정리
        </button>
        <button className="ed-mini" disabled={activeStep === 0} onClick={duplicatePrevPose} title="이전 스텝 포즈로 초기화">
          이전 포즈 복제
        </button>
        <button className="ed-mini" disabled={K <= 2} onClick={() => removeStep(activeStep)}>
          스텝 삭제
        </button>
      </div>

      <p className="ed-hint">
        점을 클릭해 선택 → 기즈모로 끌어 옮기면 이 스텝의 줄 모양이 바뀝니다. 스텝마다 모양을 잡으면 재생 시
        그 순서대로 자연스럽게 보간됩니다.
      </p>

      <div className="ed-row ed-save">
        {isBuiltin && (
          <button className="ed-cancel" onClick={doReset} title="기본값으로 되돌리기">
            기본값 복원
          </button>
        )}
        <button className="ed-cancel" onClick={togglePreview} title="애니메이션 미리보기">
          ▶ 미리보기
        </button>
        <button className="ed-cancel" onClick={stop}>
          취소
        </button>
        <button className="ed-save-ghost" onClick={doSave} title="파일에 저장(에디터 유지)">
          {saved ? "저장됨 ✓" : "저장"}
        </button>
        <button className="ed-save-btn" onClick={saveAndView} title="저장하고 에디터 닫기">
          저장하고 보기
        </button>
      </div>
    </div>
  );
}
