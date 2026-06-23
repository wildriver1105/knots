"use client";

// 에디터 상태(zustand). 3D 핸들(드래그)과 에디터 패널(UI)이 공유한다.
// draft = 편집 중인 커스텀 매듭. 스텝마다 줄 포즈(poses[step])를 직접 움직인다.

import { create } from "zustand";
import type { Knot, Vec3 } from "@/lib/knots/types";
import { newCustomKnot, syncCustomKnot } from "@/lib/knots/custom";
import { useKnotsRepo } from "@/lib/knots/repo";

// shape: 빌트인 매듭의 최종 모양(path) 한 개만 편집(reveal 애니메이션 유지).
// keyframe: 커스텀 매듭의 스텝별 포즈 편집.
type EditMode = "shape" | "keyframe";

interface EditorState {
  editing: boolean;
  draft: Knot | null;
  mode: EditMode;
  activeStep: number;
  selected: number | null; // 선택된 제어점 인덱스

  startNew: (name: string) => void;
  startEdit: (knot: Knot) => void;
  stop: () => void;
  resetBuiltin: () => string | null; // 오버라이드 삭제 → 기본값 복원, 매듭 id 반환
  setActiveStep: (i: number) => void;
  select: (i: number | null) => void;
  movePoint: (i: number, pos: Vec3) => void;
  setStepText: (i: number, title: string, instruction: string) => void;
  addStep: () => void;
  removeStep: (i: number) => void;
  duplicatePrevPose: () => void; // 현재 스텝 포즈를 이전 스텝에서 복제
  setColorSplitHere: () => void;
  setColors: (a: string, b: string) => void;
  setName: (name: string) => void;
  save: () => string | null; // 저장 후 매듭 id 반환
}

function clone(k: Knot): Knot {
  return JSON.parse(JSON.stringify(k));
}

export const useEditorStore = create<EditorState>((set, get) => ({
  editing: false,
  draft: null,
  mode: "keyframe",
  activeStep: 0,
  selected: null,

  startNew: (name) => {
    const draft = newCustomKnot(name);
    const mid = Math.floor((draft.poses?.[0]?.length ?? 2) / 2);
    set({ editing: true, draft, mode: "keyframe", activeStep: 0, selected: mid });
  },
  startEdit: (knot) => {
    const d = clone(knot);
    if (d.poses && d.poses.length) {
      // 커스텀(멀티-포즈) 편집
      const mid = Math.floor(d.poses[0].length / 2);
      set({ editing: true, draft: d, mode: "keyframe", activeStep: 0, selected: mid });
    } else {
      // 빌트인: 최종 모양(path)만 편집. reveal 애니메이션은 유지.
      d.poses = [d.path.map((p) => [...p] as Vec3)];
      const mid = Math.floor(d.path.length / 2);
      set({ editing: true, draft: d, mode: "shape", activeStep: 0, selected: mid });
    }
  },
  stop: () => set({ editing: false, draft: null, selected: null }),

  resetBuiltin: () => {
    const d = get().draft;
    if (!d) return null;
    void useKnotsRepo.getState().remove(d.id); // 서버가 빌트인을 시드로 리셋
    set({ editing: false, draft: null, selected: null });
    return d.id;
  },

  setActiveStep: (i) => {
    const d = get().draft;
    if (!d?.poses) return;
    // 선택점은 유지(점 개수가 스텝 간 동일) → 기즈모가 계속 보인다.
    set({ activeStep: Math.min(d.poses.length - 1, Math.max(0, i)) });
  },
  select: (i) => set({ selected: i }),

  movePoint: (i, pos) => {
    const d = get().draft;
    if (!d?.poses) return;
    const poses = d.poses.map((p) => p.map((q) => [...q] as Vec3));
    poses[get().activeStep][i] = pos;
    set({ draft: { ...d, poses } });
  },

  setStepText: (i, title, instruction) => {
    const d = get().draft;
    if (!d) return;
    const steps = d.steps.map((s, idx) => (idx === i ? { ...s, title, instruction } : s));
    set({ draft: { ...d, steps } });
  },

  addStep: () => {
    const d = get().draft;
    if (!d?.poses) return;
    const last = d.poses[d.poses.length - 1];
    const poses = [...d.poses.map((p) => p.map((q) => [...q] as Vec3)), last.map((q) => [...q] as Vec3)];
    const steps = [
      ...d.steps,
      { id: "s" + poses.length, title: "스텝 " + poses.length, instruction: "", reveal: 1 },
    ];
    set({ draft: { ...d, poses, steps }, activeStep: poses.length - 1, selected: null });
  },

  removeStep: (i) => {
    const d = get().draft;
    if (!d?.poses || d.poses.length <= 2) return;
    const poses = d.poses.filter((_, idx) => idx !== i);
    const steps = d.steps.filter((_, idx) => idx !== i);
    set({ draft: { ...d, poses, steps }, activeStep: Math.max(0, i - 1), selected: null });
  },

  duplicatePrevPose: () => {
    const d = get().draft;
    const step = get().activeStep;
    if (!d?.poses || step === 0) return;
    const poses = d.poses.map((p) => p.map((q) => [...q] as Vec3));
    poses[step] = poses[step - 1].map((q) => [...q] as Vec3);
    set({ draft: { ...d, poses } });
  },

  setColorSplitHere: () => {
    const d = get().draft;
    const sel = get().selected;
    if (!d || sel == null) return;
    set({ draft: { ...d, colorSplitIndex: sel } });
  },

  setColors: (a, b) => {
    const d = get().draft;
    if (!d) return;
    set({ draft: { ...d, ropeColor: a, ropeColorB: b } });
  },

  setName: (name) => {
    const d = get().draft;
    if (!d) return;
    set({ draft: { ...d, name } });
  },

  save: () => {
    const d = get().draft;
    if (!d) return null;
    if (get().mode === "shape") {
      // 빌트인 오버라이드: 편집한 path 만 반영, reveal 모델 유지(poses 제거).
      const override: Knot = { ...d, path: d.poses?.[0] ?? d.path, poses: undefined };
      void useKnotsRepo.getState().upsert(override);
      set({ draft: override });
      return override.id;
    }
    const synced = syncCustomKnot(d);
    void useKnotsRepo.getState().upsert(synced);
    set({ draft: synced });
    return synced.id;
  },
}));
