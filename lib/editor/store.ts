"use client";

// 에디터 상태(zustand). 3D 핸들(드래그)과 에디터 패널(UI)이 공유한다.
// draft = 편집 중인 매듭. 빌트인/커스텀 구분 없이 **스텝별 포즈(poses[step])** 를 직접 움직여
// 편집한다(통합 keyframe 에디터). 빌트인은 진입 시 애니메이션을 스텝 포즈로 시드해 단계 편집 가능.

import { create } from "zustand";
import type { Knot, Vec3 } from "@/lib/knots/types";
import { newCustomKnot, syncCustomKnot } from "@/lib/knots/custom";
import { buildStraightBaseline, formStaged } from "@/lib/knots/interpolate";
import { BUILTIN_IDS } from "@/lib/knots/data";
import { useKnotsRepo } from "@/lib/knots/repo";

interface EditorState {
  editing: boolean;
  draft: Knot | null;
  isBuiltin: boolean; // 기본값 복원 가능 여부
  activeStep: number;
  selected: number | null; // 선택된 제어점 인덱스

  startNew: (name: string) => void;
  startEdit: (knot: Knot) => void;
  stop: () => void;
  resetBuiltin: () => string | null;
  setActiveStep: (i: number) => void;
  select: (i: number | null) => void;
  movePoint: (i: number, pos: Vec3) => void;
  setStepText: (i: number, title: string, instruction: string) => void;
  addStep: () => void;
  removeStep: (i: number) => void;
  duplicatePrevPose: () => void;
  setColorSplitHere: () => void;
  setColors: (a: string, b: string) => void;
  setName: (name: string) => void;
  save: () => string | null;
}

function clone(k: Knot): Knot {
  return JSON.parse(JSON.stringify(k));
}

/**
 * poses 가 없는 매듭(빌트인 reveal 모델)을 단계 포즈로 시드.
 * "곧게 펴진 줄 → 단계적으로 형성"(formStaged)으로 만들어 스텝마다 실제 묶이는 단계가 다르다.
 * (loose→tight 부풀림은 모든 스텝이 같은 최종 모양처럼 보여 부적절했음.)
 * 마지막 스텝은 정확히 최종 path. 직선 기준선은 화면에 들어오게 0.7배 압축.
 */
function ensurePoses(d: Knot): Knot {
  if (d.poses && d.poses.length >= 2) return d;
  const straight = buildStraightBaseline(d.path, d.layDir, d.layCenter, 0.7);
  const K = Math.max(2, d.steps.length);
  const poses: Vec3[][] = [];
  for (let i = 0; i < K; i++) {
    poses.push(formStaged(straight, d.path, K > 1 ? i / (K - 1) : 1, d.formReverse));
  }
  d.poses = poses;
  // steps 개수를 K 에 맞춘다(부족하면 패딩, 많으면 자름).
  while (d.steps.length < K) {
    d.steps.push({ id: "s" + d.steps.length, title: "스텝 " + (d.steps.length + 1), instruction: "", reveal: 1 });
  }
  d.steps = d.steps.slice(0, K);
  return d;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  editing: false,
  draft: null,
  isBuiltin: false,
  activeStep: 0,
  selected: null,

  startNew: (name) => {
    const draft = newCustomKnot(name);
    const mid = Math.floor((draft.poses?.[0]?.length ?? 2) / 2);
    set({ editing: true, draft, isBuiltin: false, activeStep: 0, selected: mid });
  },

  startEdit: (knot) => {
    const d = ensurePoses(clone(knot));
    const isBuiltin = BUILTIN_IDS.has(knot.id);
    const mid = Math.floor((d.poses?.[0]?.length ?? 2) / 2);
    set({ editing: true, draft: d, isBuiltin, activeStep: 0, selected: mid });
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
    set({ activeStep: Math.min(d.poses.length - 1, Math.max(0, i)) }); // 선택점 유지
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
    set({ draft: { ...d, poses, steps }, activeStep: poses.length - 1 });
  },

  removeStep: (i) => {
    const d = get().draft;
    if (!d?.poses || d.poses.length <= 2) return;
    const poses = d.poses.filter((_, idx) => idx !== i);
    const steps = d.steps.filter((_, idx) => idx !== i);
    set({ draft: { ...d, poses, steps }, activeStep: Math.max(0, i - 1) });
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
    const synced = syncCustomKnot(d); // poses 기준 path/reveal 동기화
    void useKnotsRepo.getState().upsert(synced);
    set({ draft: synced });
    return synced.id;
  },
}));
