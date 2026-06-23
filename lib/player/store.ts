// 플레이어 커맨드 버스 (zustand).
//
// 이 스토어가 유일한 디스패치 타깃이다. Phase 1(키보드·화면 버튼)과 Phase 2(제스처·음성)
// 입력 어댑터는 모두 같은 액션(play/pause/next/prev/seek/setMode...)을 호출한다.
// 스토어에는 입력 로직도, three/DOM 의존도 없다 → 테스트·재사용이 쉽다.

import { create } from "zustand";
import { getKnot, DEFAULT_KNOT_ID } from "@/lib/knots/data";
import { progressToStepIndex, stepIndexToProgress } from "@/lib/knots/interpolate";

export type PlayMode = "step" | "continuous";

export interface PlayerState {
  knotId: string; // 빌트인 KnotId 또는 커스텀 매듭 id
  mode: PlayMode;

  // step 모드
  stepIndex: number;

  // continuous 모드
  isPlaying: boolean;
  progress: number; // 0..1
  playbackRate: number;

  // ── 커맨드 API (입력원 공통) ──
  loadKnot: (id: string) => void;
  setMode: (m: PlayMode) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (progress01: number) => void;
  goToStep: (index: number) => void;
  setRate: (r: number) => void;
  rewind: () => void;
  reset: () => void;

  /** Canvas 내 PlaybackTicker 의 useFrame 이 매 프레임 호출(연속 재생 전진). */
  tick: (deltaSeconds: number) => void;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const usePlayerStore = create<PlayerState>((set, get) => ({
  knotId: DEFAULT_KNOT_ID,
  mode: "step",
  stepIndex: 0,
  isPlaying: false,
  progress: 0,
  playbackRate: 1,

  loadKnot: (id) =>
    set({ knotId: id, stepIndex: 0, progress: 0, isPlaying: false }),

  setMode: (m) => {
    const s = get();
    if (m === s.mode) return;
    const knot = getKnot(s.knotId);
    if (m === "continuous") {
      // step → continuous: 현재 step 위치를 progress 로 보존
      set({ mode: m, progress: stepIndexToProgress(knot, s.stepIndex), isPlaying: false });
    } else {
      // continuous → step: 현재 progress 에 가장 가까운 step 으로 스냅
      set({ mode: m, stepIndex: progressToStepIndex(knot, s.progress), isPlaying: false });
    }
  },

  play: () => {
    const s = get();
    if (s.mode !== "continuous") {
      // step 모드에서 play 누르면 연속 모드로 전환해 재생
      const knot = getKnot(s.knotId);
      const startAt = s.progress >= 1 ? 0 : stepIndexToProgress(knot, s.stepIndex);
      set({ mode: "continuous", progress: startAt, isPlaying: true });
      return;
    }
    set({ isPlaying: true, progress: s.progress >= 1 ? 0 : s.progress });
  },

  pause: () => set({ isPlaying: false }),

  togglePlay: () => (get().isPlaying ? get().pause() : get().play()),

  next: () => {
    const s = get();
    const knot = getKnot(s.knotId);
    if (s.mode === "step") {
      set({ stepIndex: Math.min(knot.steps.length - 1, s.stepIndex + 1) });
    } else {
      // 연속 모드: 다음 step 체크포인트로 점프
      const cur = progressToStepIndex(knot, s.progress);
      const nextIdx = Math.min(knot.steps.length - 1, cur + 1);
      set({ progress: stepIndexToProgress(knot, nextIdx), isPlaying: false });
    }
  },

  prev: () => {
    const s = get();
    const knot = getKnot(s.knotId);
    if (s.mode === "step") {
      set({ stepIndex: Math.max(0, s.stepIndex - 1) });
    } else {
      const cur = progressToStepIndex(knot, s.progress);
      const prevIdx = Math.max(0, cur - 1);
      set({ progress: stepIndexToProgress(knot, prevIdx), isPlaying: false });
    }
  },

  seek: (p) => {
    const s = get();
    if (s.mode === "step") {
      const knot = getKnot(s.knotId);
      set({ stepIndex: progressToStepIndex(knot, clamp01(p)) });
    } else {
      set({ progress: clamp01(p) });
    }
  },

  goToStep: (index) => {
    const s = get();
    const knot = getKnot(s.knotId);
    const i = Math.min(knot.steps.length - 1, Math.max(0, index));
    if (s.mode === "step") set({ stepIndex: i });
    else set({ progress: stepIndexToProgress(knot, i), isPlaying: false });
  },

  setRate: (r) => set({ playbackRate: Math.min(4, Math.max(0.25, r)) }),

  rewind: () => {
    const s = get();
    if (s.mode === "step") set({ stepIndex: 0 });
    else set({ progress: 0, isPlaying: false });
  },

  reset: () => set({ stepIndex: 0, progress: 0, isPlaying: false }),

  tick: (delta) => {
    const s = get();
    if (!s.isPlaying || s.mode !== "continuous") return;
    const knot = getKnot(s.knotId);
    // 전체 시퀀스 길이(초) = step 수 * 기본 duration / rate
    const totalSeconds = Math.max(0.5, (knot.steps.length - 1) * knot.defaultStepDuration);
    const dp = (delta * s.playbackRate) / totalSeconds;
    const next = s.progress + dp;
    if (next >= 1) set({ progress: 1, isPlaying: false });
    else set({ progress: next });
  },
}));
