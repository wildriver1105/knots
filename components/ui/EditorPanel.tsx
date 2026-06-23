"use client";

// 에디터 패널.
//  - keyframe 모드(커스텀): 스텝별 줄 포즈 편집 + 설명 + 저장.
//  - shape 모드(빌트인): 최종 모양(path)만 편집. reveal 애니메이션·설명은 유지. 기본값 복원 가능.
// 3D 에서 점을 클릭해 선택하고 기즈모로 끌어 옮기면 포즈가 바뀐다.

import { useEditorStore } from "@/lib/editor/store";
import { usePlayerStore } from "@/lib/player/store";

export default function EditorPanel() {
  const draft = useEditorStore((s) => s.draft);
  const mode = useEditorStore((s) => s.mode);
  const activeStep = useEditorStore((s) => s.activeStep);
  const selected = useEditorStore((s) => s.selected);
  const setActiveStep = useEditorStore((s) => s.setActiveStep);
  const setStepText = useEditorStore((s) => s.setStepText);
  const addStep = useEditorStore((s) => s.addStep);
  const removeStep = useEditorStore((s) => s.removeStep);
  const duplicatePrevPose = useEditorStore((s) => s.duplicatePrevPose);
  const setColorSplitHere = useEditorStore((s) => s.setColorSplitHere);
  const setColors = useEditorStore((s) => s.setColors);
  const setName = useEditorStore((s) => s.setName);
  const save = useEditorStore((s) => s.save);
  const stop = useEditorStore((s) => s.stop);
  const resetBuiltin = useEditorStore((s) => s.resetBuiltin);
  const loadKnot = usePlayerStore((s) => s.loadKnot);

  if (!draft) return null;
  const step = draft.steps[activeStep];
  const K = draft.poses?.length ?? 0;
  const isShape = mode === "shape";

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

  return (
    <div className="editor-panel">
      {isShape ? (
        <div className="ed-shapehead">
          <strong>{draft.name}</strong> · 최종 모양 편집
        </div>
      ) : (
        <div className="ed-row">
          <input className="ed-name" value={draft.name} onChange={(e) => setName(e.target.value)} placeholder="매듭 이름" />
        </div>
      )}

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

      {/* 스텝 편집(keyframe 모드에서만) */}
      {!isShape && (
        <>
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
            <button className="ed-mini" disabled={activeStep === 0} onClick={duplicatePrevPose} title="이전 스텝 포즈로 초기화">
              이전 포즈 복제
            </button>
            <button className="ed-mini" disabled={K <= 2} onClick={() => removeStep(activeStep)}>
              스텝 삭제
            </button>
          </div>
        </>
      )}

      <p className="ed-hint">
        {isShape
          ? "점을 클릭해 선택 → 기즈모로 끌어 옮기면 이 매듭의 최종 모양이 바뀝니다. 손-순서 애니메이션과 설명은 그대로 유지됩니다."
          : "점을 클릭해 선택 → 기즈모로 끌어 옮기면 이 스텝의 줄 모양이 바뀝니다. 스텝마다 모양을 잡으면, 재생 시 그 순서대로 보간됩니다."}
      </p>

      <div className="ed-row ed-save">
        {isShape && (
          <button className="ed-cancel" onClick={doReset} title="기본값으로 되돌리기">
            기본값 복원
          </button>
        )}
        <button className="ed-cancel" onClick={stop}>
          취소
        </button>
        <button className="ed-save-btn" onClick={saveAndView}>
          저장하고 보기
        </button>
      </div>
    </div>
  );
}
