"use client";

// 에디터 상태(zustand) + undo/redo 히스토리.
// draft = 편집 중인 매듭. 빌트인/커스텀 구분 없이 스텝별 포즈(poses[step])를 직접 움직여 편집한다.
// 히스토리: 변경 전 draft 를 past 에 스냅샷. 드래그는 시작 시 1회(beginChange), 텍스트는 연속 입력을
// coalesce 키로 1개로 묶는다.

import { create } from "zustand";
import type { Knot, Vec3 } from "@/lib/knots/types";
import { newCustomKnot, syncCustomKnot } from "@/lib/knots/custom";
import { seedPoses } from "@/lib/knots/authoring";
import { animationFromPoses, sampleTrack, upsertKey, removeKeyAt, finalPoseOfAnimation } from "@/lib/knots/anim";
import { collidersForObject, relaxPoints } from "@/lib/knots/physics";
import { BUILTIN_IDS } from "@/lib/knots/data";
import { useKnotsRepo } from "@/lib/knots/repo";

const HISTORY_MAX = 80;

interface EditorState {
  editing: boolean;
  draft: Knot | null;
  isBuiltin: boolean;
  activeStep: number;
  selected: number | null;

  // 미리보기(에디터 안에서 애니메이션 재생)
  preview: boolean;
  previewPlaying: boolean;
  previewProgress: number;

  // 도프시트(점별 키프레임) 모드
  dope: boolean;
  playheadT: number; // 0..1 전역 시간(내부는 정규화, 표시는 초/프레임)
  dopePlaying: boolean;
  onion: boolean; // 어니언 스킨(이전/다음 키 고스트)
  durationSec: number; // 타임라인 전체 길이(초)
  fps: number; // 프레임 스냅 그리드

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

  togglePreview: () => void;
  playPreview: () => void;
  pausePreview: () => void;
  setPreviewProgress: (p: number) => void;
  tickPreview: (dt: number) => void;

  // 도프시트
  toggleDope: () => void;
  setPlayhead: (t: number) => void;
  playDope: () => void;
  pauseDope: () => void;
  tickDope: (dt: number) => void;
  setOnion: (b: boolean) => void;
  setDuration: (sec: number) => void;
  setFps: (n: number) => void;
  stepFrame: (dir: number) => void;
  addKeyHere: () => void; // 선택 점에 현재 시간 키 추가
  removeKeyHere: () => void; // 선택 점의 현재 시간 키 삭제
  moveKeyTime: (pointIndex: number, fromT: number, toT: number) => void; // 키 리타이밍

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
  setPhysics: (key: "tension" | "gravity" | "bendStiffness" | "damping", value: number) => void;
  save: () => string | null;
}

function clone(k: Knot): Knot {
  return JSON.parse(JSON.stringify(k));
}

// 도프시트 진입 시 점별 트랙을 보장한다(없으면 poses 의 각 스텝 시각에 키를 박아 시드).
function ensureAnimation(d: Knot): Knot {
  if (d.animation && d.animation.tracks.length === d.path.length) return d;
  const poses = d.poses && d.poses.length >= 2 ? d.poses : seedPoses(d.path, Math.max(2, d.steps.length), { layDir: d.layDir, layCenter: d.layCenter, formReverse: d.formReverse });
  const K = poses.length;
  const times = poses.map((_, i) => (K > 1 ? i / (K - 1) : 1));
  d.animation = animationFromPoses(poses, times);
  return d;
}

function ensurePoses(d: Knot): Knot {
  if (d.poses && d.poses.length >= 2) return d;
  const K = Math.max(2, d.steps.length);
  d.poses = seedPoses(d.path, K, { layDir: d.layDir, layCenter: d.layCenter, formReverse: d.formReverse });
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

  // 정규화 시간 t(0..1)을 현재 durationSec·fps 프레임 그리드에 스냅.
  const snapToFrame = (t: number) => {
    const { durationSec, fps } = get();
    const frames = Math.max(1, Math.round(durationSec * fps));
    return Math.round(Math.min(1, Math.max(0, t)) * frames) / frames;
  };

  return {
    editing: false,
    draft: null,
    isBuiltin: false,
    activeStep: 0,
    selected: null,
    preview: false,
    previewPlaying: false,
    previewProgress: 0,
    dope: false,
    playheadT: 0,
    dopePlaying: false,
    onion: false,
    durationSec: 3,
    fps: 30,
    past: [],
    future: [],
    lastKey: null,

    startNew: (name) => {
      const draft = newCustomKnot(name);
      const mid = Math.floor((draft.poses?.[0]?.length ?? 2) / 2);
      set({ editing: true, draft, isBuiltin: false, activeStep: 0, selected: mid, past: [], future: [], lastKey: null, preview: false, previewPlaying: false, previewProgress: 0 });
    },

    startEdit: (knot) => {
      const d = ensurePoses(clone(knot));
      const isBuiltin = BUILTIN_IDS.has(knot.id);
      const mid = Math.floor((d.poses?.[0]?.length ?? 2) / 2);
      set({ editing: true, draft: d, isBuiltin, activeStep: 0, selected: mid, past: [], future: [], lastKey: null, preview: false, previewPlaying: false, previewProgress: 0 });
    },

    stop: () => set({ editing: false, draft: null, selected: null, past: [], future: [], lastKey: null, preview: false, previewPlaying: false, dope: false, dopePlaying: false, playheadT: 0 }),

    resetBuiltin: () => {
      const d = get().draft;
      if (!d) return null;
      void useKnotsRepo.getState().remove(d.id);
      set({ editing: false, draft: null, selected: null, past: [], future: [], lastKey: null, preview: false, previewPlaying: false });
      return d.id;
    },

    togglePreview: () => {
      const on = !get().preview;
      set({ preview: on, previewPlaying: on, previewProgress: 0, selected: on ? null : get().selected });
    },
    playPreview: () => set((s) => ({ previewPlaying: true, previewProgress: s.previewProgress >= 1 ? 0 : s.previewProgress })),
    pausePreview: () => set({ previewPlaying: false }),
    setPreviewProgress: (p) => set({ previewProgress: Math.min(1, Math.max(0, p)), previewPlaying: false }),
    tickPreview: (dt) => {
      const s = get();
      if (!s.previewPlaying || !s.draft?.poses) return;
      const K = s.draft.poses.length;
      const total = Math.max(0.6, (K - 1) * (s.draft.defaultStepDuration || 1));
      const np = s.previewProgress + dt / total;
      if (np >= 1) set({ previewProgress: 1, previewPlaying: false });
      else set({ previewProgress: np });
    },

    // ── 도프시트 ──
    toggleDope: () => {
      const on = !get().dope;
      if (on) {
        const d = ensureAnimation(clone(get().draft!));
        const dur = d.animationDuration ?? Math.max(1, (Math.max(2, d.steps.length) - 1) * (d.defaultStepDuration || 1));
        set({ dope: true, draft: d, playheadT: 0, dopePlaying: false, preview: false, previewPlaying: false, durationSec: dur });
      } else {
        set({ dope: false, dopePlaying: false });
      }
    },
    setPlayhead: (t) => set({ playheadT: snapToFrame(t), dopePlaying: false }),
    playDope: () => set((s) => ({ dopePlaying: true, playheadT: s.playheadT >= 1 ? 0 : s.playheadT })),
    pauseDope: () => set((s) => ({ dopePlaying: false, playheadT: snapToFrame(s.playheadT) })),
    tickDope: (dt) => {
      const s = get();
      if (!s.dopePlaying || !s.draft) return;
      // 실시간(초): durationSec 동안 0→1 재생.
      const total = Math.max(0.2, s.durationSec);
      const np = s.playheadT + dt / total;
      if (np >= 1) set({ playheadT: 1, dopePlaying: false });
      else set({ playheadT: np });
    },
    setOnion: (b) => set({ onion: b }),
    setDuration: (sec) => {
      const v = Math.max(0.2, sec);
      snapshot("dur");
      const d = get().draft;
      set({ durationSec: v, draft: d ? { ...d, animationDuration: v } : d });
    },
    setFps: (n) => set({ fps: Math.min(120, Math.max(1, Math.round(n))) }),
    stepFrame: (dir) => {
      const { durationSec, fps, playheadT } = get();
      const frames = Math.max(1, Math.round(durationSec * fps));
      const f = Math.min(frames, Math.max(0, Math.round(playheadT * frames) + dir));
      set({ playheadT: f / frames, dopePlaying: false });
    },
    addKeyHere: () => {
      const { draft, selected, playheadT } = get();
      if (!draft?.animation || selected == null) return;
      snapshot();
      const tracks = draft.animation.tracks.map((t) => ({ keys: t.keys.map((k) => ({ t: k.t, pos: [...k.pos] as Vec3 })) }));
      const cur = sampleTrack(tracks[selected], playheadT);
      tracks[selected] = upsertKey(tracks[selected], playheadT, cur);
      set({ draft: { ...draft, animation: { tracks } } });
    },
    removeKeyHere: () => {
      const { draft, selected, playheadT } = get();
      if (!draft?.animation || selected == null) return;
      snapshot();
      const tracks = draft.animation.tracks.map((t) => ({ keys: t.keys.map((k) => ({ t: k.t, pos: [...k.pos] as Vec3 })) }));
      tracks[selected] = removeKeyAt(tracks[selected], playheadT);
      set({ draft: { ...draft, animation: { tracks } } });
    },
    moveKeyTime: (pointIndex, fromT, toT) => {
      const { draft } = get();
      if (!draft?.animation) return;
      snapshot("retime:" + pointIndex + ":" + fromT.toFixed(3));
      const tracks = draft.animation.tracks.map((t) => ({ keys: t.keys.map((k) => ({ t: k.t, pos: [...k.pos] as Vec3 })) }));
      const tr = tracks[pointIndex];
      const idx = tr.keys.findIndex((k) => Math.abs(k.t - fromT) <= 1e-3);
      if (idx < 0) return;
      const pos = tr.keys[idx].pos;
      const nt = snapToFrame(toT);
      tracks[pointIndex] = tr.keys.length === 1 ? { keys: [{ t: nt, pos }] } : upsertKey(removeKeyAt(tr, fromT), nt, pos);
      set({ draft: { ...draft, animation: { tracks } }, playheadT: nt });
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
      if (!d) return;
      // 도프시트 모드: 드래그 = autokey(선택 점의 현재 시간 키를 갱신/추가).
      if (get().dope && d.animation) {
        const t = get().playheadT;
        const tracks = d.animation.tracks.map((tr) => ({ keys: tr.keys.map((k) => ({ t: k.t, pos: [...k.pos] as Vec3 })) }));
        tracks[i] = upsertKey(tracks[i], t, pos);
        set({ draft: { ...d, animation: { tracks } } });
        return;
      }
      if (!d.poses) return;
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
      poses[step] = relaxPoints(poses[step], d.ropeRadius, 80, collidersForObject(d.object));
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

    setPhysics: (key, value) => {
      const d = get().draft;
      if (!d) return;
      snapshot("physics:" + key);
      set({ draft: { ...d, physics: { ...d.physics, [key]: value } } });
    },

    save: () => {
      const d = get().draft;
      if (!d) return null;
      // 도프시트가 있으면 path 를 최종(t=1) 포즈로 동기화(색경계/카메라용), 아니면 기존 스텝 동기화.
      const synced = d.animation ? { ...d, path: finalPoseOfAnimation(d.animation) } : syncCustomKnot(d);
      void useKnotsRepo.getState().upsert(synced);
      set({ draft: synced });
      return synced.id;
    },
  };
});
