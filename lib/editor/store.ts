"use client";

// 에디터 상태(zustand). 3D 핸들(드래그)과 에디터 패널(UI)이 공유한다.
// draft = 편집 중인 커스텀 매듭. 스텝마다 줄 포즈(poses[step])를 직접 움직인다.

import { create } from "zustand";
import type { Knot, Vec3 } from "@/lib/knots/types";
import { useCustomKnots, newCustomKnot, syncCustomKnot } from "@/lib/knots/custom";

interface EditorState {
  editing: boolean;
  draft: Knot | null;
  activeStep: number;
  selected: number | null; // 선택된 제어점 인덱스

  startNew: (name: string) => void;
  startEdit: (knot: Knot) => void;
  stop: () => void;
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
  activeStep: 0,
  selected: null,

  startNew: (name) => set({ editing: true, draft: newCustomKnot(name), activeStep: 0, selected: null }),
  startEdit: (knot) => set({ editing: true, draft: clone(knot), activeStep: 0, selected: null }),
  stop: () => set({ editing: false, draft: null, selected: null }),

  setActiveStep: (i) => {
    const d = get().draft;
    if (!d?.poses) return;
    set({ activeStep: Math.min(d.poses.length - 1, Math.max(0, i)), selected: null });
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
    const synced = syncCustomKnot(d);
    useCustomKnots.getState().upsert(synced);
    set({ draft: synced });
    return synced.id;
  },
}));
