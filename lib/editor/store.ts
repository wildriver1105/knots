"use client";

// 에디터 상태(zustand) + undo/redo 히스토리.
// draft = 편집 중인 매듭. 빌트인/커스텀 구분 없이 스텝별 포즈(poses[step])를 직접 움직여 편집한다.
// 히스토리: 변경 전 draft 를 past 에 스냅샷. 드래그는 시작 시 1회(beginChange), 텍스트는 연속 입력을
// coalesce 키로 1개로 묶는다.

import { create } from "zustand";
import type { Knot, Vec3 } from "@/lib/knots/types";
import { newCustomKnot, syncCustomKnot } from "@/lib/knots/custom";
import { buildStraightBaseline, formStaged } from "@/lib/knots/interpolate";
import { relaxPoints } from "@/lib/knots/physics";
import { BUILTIN_IDS } from "@/lib/knots/data";
import { useKnotsRepo } from "@/lib/knots/repo";

const HISTORY_MAX = 80;

interface EditorState {
  editing: boolean;
  draft: Knot | null;
  isBuiltin: boolean;
  activeStep: number;
  selected: number | null;

  past: Knot[];
  future: Knot[];
  lastKey: string | null; // 연속 입력 coalesce 용

  startNew: (name: string) => void;
  startEdit: (knot: Knot) => void;
  stop: () => void;
  resetBuiltin: () => string | null;

  beginChange: () => void; // 드래그 시작 시 스냅샷
  undo: () => void;
  redo: () => void;

  setActiveStep: (i: number) => void;
  select: (i: number | null) => void;
  movePoint: (i: number, pos: Vec3) => void;
  setStepText: (i: number, title: string, instruction: string) => void;
  addStep: () => void;
  removeStep: (i: number) => void;
  duplicatePrevPose: () => void;
  relaxPose: () => void; // 현재 스텝 포즈를 물리(충돌+장력)로 정리
  setColorSplitHere: () => void;
  setColors: (a: string, b: string) => void;
  setName: (name: string) => void;
  save: () => string | null;
}

function clone(k: Knot): Knot {
  return JSON.parse(JSON.stringify(k));
}

function ensurePoses(d: Knot): Knot {
  if (d.poses && d.poses.length >= 2) return d;
  const straight = buildStraightBaseline(d.path, d.layDir, d.layCenter, 0.7);
  const K = Math.max(2, d.steps.length);
  const poses: Vec3[][] = [];
  for (let i = 0; i < K; i++) {
    poses.push(formStaged(straight, d.path, K > 1 ? i / (K - 1) : 1, d.formReverse));
  }
  d.poses = poses;
  while (d.steps.length < K) {
    d.steps.push({ id: "s" + d.steps.length, title: "스텝 " + (d.steps.length + 1), instruction: "", reveal: 1 });
  }
  d.steps = d.steps.slice(0, K);
  return d;
}

export const useEditorStore = create<EditorState>((set, get) => {
  // 변경 전 draft 를 past 에 스냅샷. key 가 직전과 같으면 묶음(연속 입력) → 중복 스냅샷 안 함.
  const snapshot = (key?: string) => {
    const { draft, past, lastKey } = get();
    if (!draft) return;
    if (key && key === lastKey) {
      set({ future: [] });
      return;
    }
    set({ past: [...past, clone(draft)].slice(-HISTORY_MAX), future: [], lastKey: key ?? null });
  };

  const clampSel = (d: Knot | null, activeStep: number, selected: number | null) => {
    if (!d?.poses) return { activeStep: 0, selected: null };
    const as = Math.min(d.poses.length - 1, Math.max(0, activeStep));
    const n = d.poses[as]?.length ?? 0;
    const sel = selected != null && selected < n ? selected : null;
    return { activeStep: as, selected: sel };
  };

  return {
    editing: false,
    draft: null,
    isBuiltin: false,
    activeStep: 0,
    selected: null,
    past: [],
    future: [],
    lastKey: null,

    startNew: (name) => {
      const draft = newCustomKnot(name);
      const mid = Math.floor((draft.poses?.[0]?.length ?? 2) / 2);
      set({ editing: true, draft, isBuiltin: false, activeStep: 0, selected: mid, past: [], future: [], lastKey: null });
    },

    startEdit: (knot) => {
      const d = ensurePoses(clone(knot));
      const isBuiltin = BUILTIN_IDS.has(knot.id);
      const mid = Math.floor((d.poses?.[0]?.length ?? 2) / 2);
      set({ editing: true, draft: d, isBuiltin, activeStep: 0, selected: mid, past: [], future: [], lastKey: null });
    },

    stop: () => set({ editing: false, draft: null, selected: null, past: [], future: [], lastKey: null }),

    resetBuiltin: () => {
      const d = get().draft;
      if (!d) return null;
      void useKnotsRepo.getState().remove(d.id);
      set({ editing: false, draft: null, selected: null, past: [], future: [], lastKey: null });
      return d.id;
    },

    beginChange: () => snapshot(),

    undo: () => {
      const { past, future, draft } = get();
      if (!past.length || !draft) return;
      const prev = past[past.length - 1];
      const c = clampSel(prev, get().activeStep, get().selected);
      set({ draft: prev, past: past.slice(0, -1), future: [...future, clone(draft)], lastKey: null, ...c });
    },

    redo: () => {
      const { past, future, draft } = get();
      if (!future.length || !draft) return;
      const next = future[future.length - 1];
      const c = clampSel(next, get().activeStep, get().selected);
      set({ draft: next, future: future.slice(0, -1), past: [...past, clone(draft)], lastKey: null, ...c });
    },

    setActiveStep: (i) => {
      const d = get().draft;
      if (!d?.poses) return;
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
      snapshot("text:" + i);
      const d = get().draft;
      if (!d) return;
      const steps = d.steps.map((s, idx) => (idx === i ? { ...s, title, instruction } : s));
      set({ draft: { ...d, steps } });
    },

    addStep: () => {
      snapshot();
      const d = get().draft;
      if (!d?.poses) return;
      const last = d.poses[d.poses.length - 1];
      const poses = [...d.poses.map((p) => p.map((q) => [...q] as Vec3)), last.map((q) => [...q] as Vec3)];
      const steps = [
        ...d.steps,
        { id: "s" + poses.length, title: "스텝 " + poses.length, instruction: "", reveal: 1 },
      ];
      set({ draft: { ...d, poses, steps }, activeStep: poses.length - 1 });
    },

    removeStep: (i) => {
      const d = get().draft;
      if (!d?.poses || d.poses.length <= 2) return;
      snapshot();
      const poses = d.poses.filter((_, idx) => idx !== i);
      const steps = d.steps.filter((_, idx) => idx !== i);
      set({ draft: { ...d, poses, steps }, activeStep: Math.max(0, i - 1) });
    },

    duplicatePrevPose: () => {
      const d = get().draft;
      const step = get().activeStep;
      if (!d?.poses || step === 0) return;
      snapshot();
      const poses = d.poses.map((p) => p.map((q) => [...q] as Vec3));
      poses[step] = poses[step - 1].map((q) => [...q] as Vec3);
      set({ draft: { ...d, poses } });
    },

    relaxPose: () => {
      const d = get().draft;
      if (!d?.poses) return;
      snapshot();
      const step = get().activeStep;
      const poses = d.poses.map((p) => p.map((q) => [...q] as Vec3));
      poses[step] = relaxPoints(poses[step], d.ropeRadius);
      set({ draft: { ...d, poses } });
    },

    setColorSplitHere: () => {
      const d = get().draft;
      const sel = get().selected;
      if (!d || sel == null) return;
      snapshot();
      set({ draft: { ...d, colorSplitIndex: sel } });
    },

    setColors: (a, b) => {
      const d = get().draft;
      if (!d) return;
      snapshot("colors");
      set({ draft: { ...d, ropeColor: a, ropeColorB: b } });
    },

    setName: (name) => {
      const d = get().draft;
      if (!d) return;
      snapshot("name");
      set({ draft: { ...d, name } });
    },

    save: () => {
      const d = get().draft;
      if (!d) return null;
      const synced = syncCustomKnot(d);
      void useKnotsRepo.getState().upsert(synced);
      set({ draft: synced });
      return synced.id;
    },
  };
});
