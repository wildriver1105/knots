"use client";

// 사용자 정의(에디터) 매듭 — localStorage 영속 + zustand 반응형 스토어.
// 에디터 매듭은 keyframe 방식: 각 스텝마다 줄 전체 포즈(poses[i])를 가지며, 애니메이션은
// 포즈 사이를 보간한다(loose→tight 대신). path 는 마지막 포즈로 둔다(buildLoose 등 호환용).

import { create } from "zustand";
import type { Knot, Vec3 } from "./types";

const KEY = "knots.custom.v1";

function load(): Knot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Knot[]) : [];
  } catch {
    return [];
  }
}

function save(knots: Knot[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(knots));
  } catch {
    /* 용량 초과 등 무시 */
  }
}

interface CustomState {
  knots: Knot[];
  hydrate: () => void;
  upsert: (k: Knot) => void;
  remove: (id: string) => void;
}

export const useCustomKnots = create<CustomState>((set, get) => ({
  knots: [],
  hydrate: () => set({ knots: load() }),
  upsert: (k) => {
    const next = get().knots.filter((x) => x.id !== k.id);
    next.push(k);
    save(next);
    set({ knots: next });
  },
  remove: (id) => {
    const next = get().knots.filter((x) => x.id !== id);
    save(next);
    set({ knots: next });
  },
}));

/** 비반응형 조회(getKnot/스토어 액션에서 사용). */
export function getCustomKnot(id: string): Knot | undefined {
  return useCustomKnots.getState().knots.find((k) => k.id === id);
}

// ── 새 매듭 생성 헬퍼 ──

const DEFAULT_POINTS = 14;

/** 직선으로 시작하는 N개 제어점(x축). */
export function straightPose(n = DEFAULT_POINTS): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    out.push([(t - 0.5) * 3.0, 0, 0]);
  }
  return out;
}

export function newCustomKnot(name: string): Knot {
  const id = "custom-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e4).toString(36);
  const p0 = straightPose();
  // 2스텝으로 시작(시작 포즈 = 끝 포즈 복제). 사용자가 끝 포즈를 매듭으로 변형.
  const poses = [p0.map((p) => [...p] as Vec3), p0.map((p) => [...p] as Vec3)];
  return {
    id,
    name: name || "내 매듭",
    blurb: "에디터로 만든 매듭.",
    difficulty: 2,
    path: poses[poses.length - 1],
    ropeColor: "#e0584b",
    ropeColorB: "#3f8fce",
    colorSplitIndex: Math.floor(DEFAULT_POINTS / 2),
    ropeRadius: 0.075,
    object: { kind: "none" },
    defaultStepDuration: 1.3,
    isCustom: true,
    poses,
    steps: [
      { id: "s0", title: "시작", instruction: "줄을 펴 놓은 상태.", reveal: 0 },
      { id: "s1", title: "완성", instruction: "매듭을 조인다.", reveal: 1 },
    ],
  };
}

/** path 를 마지막 포즈로 동기화하고 steps.reveal 을 균등 분포로 맞춘다. */
export function syncCustomKnot(k: Knot): Knot {
  const poses = k.poses ?? [k.path];
  const K = poses.length;
  const steps = k.steps.map((s, i) => ({ ...s, reveal: K > 1 ? i / (K - 1) : 1 }));
  return { ...k, path: poses[K - 1], steps };
}
