// 순수 유틸 — three 부작용 없음, 단위 테스트 가능.
// reveal 방식: 매듭의 단일 path 를 진행도(0..1)만큼 잘라 보여준다.

import type { Knot, StepCamera, Vec3 } from "./types";

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** ease-in-out (smoothstep). */
export function easeInOut(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/**
 * 중심선을 reveal(0..1) 길이만큼 잘라낸다.
 * 마지막 세그먼트는 부분 보간점으로 마감해 끝이 매끄럽게 자라나도록 한다.
 * 항상 최소 2개 점을 돌려준다(튜브 생성 가능하도록).
 */
export function sliceCurve(points: Vec3[], reveal: number): Vec3[] {
  const n = points.length;
  if (n < 2) return points.length ? [points[0], points[0]] : [];
  const r = Math.min(1, Math.max(0, reveal));
  if (r >= 1) return points.slice();

  const totalSegments = n - 1;
  const exact = r * totalSegments;
  const full = Math.floor(exact);
  const frac = exact - full;

  const out: Vec3[] = points.slice(0, full + 1);
  if (frac > 0 && full < totalSegments) {
    out.push(lerpVec3(points[full], points[full + 1], frac));
  }
  if (out.length < 2) return [points[0], lerpVec3(points[0], points[1], 0.001)];
  return out;
}

/** 연속 progress(0..1) 에서 가장 가까운 step 인덱스(UI 표시용). */
export function progressToStepIndex(knot: Knot, progress01: number): number {
  const steps = knot.steps;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < steps.length; i++) {
    const d = Math.abs(steps[i].reveal - progress01);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** step 인덱스 → 연속 progress(해당 step 의 reveal). 모드 전환 시 위치 보존용. */
export function stepIndexToProgress(knot: Knot, stepIndex: number): number {
  const i = Math.min(knot.steps.length - 1, Math.max(0, stepIndex));
  return knot.steps[i].reveal;
}

/** progress 에 해당하는 카메라 시점(가장 가까운 step 의 camera, 보간은 CameraRig 담당). */
export function cameraForProgress(knot: Knot, progress01: number): StepCamera | undefined {
  const idx = progressToStepIndex(knot, progress01);
  // 가까운 step 에 카메라가 없으면 그 주변에서 가장 가까운 정의된 카메라를 찾는다.
  const steps = knot.steps;
  if (steps[idx].camera) return steps[idx].camera;
  for (let d = 1; d < steps.length; d++) {
    if (steps[idx - d]?.camera) return steps[idx - d]!.camera;
    if (steps[idx + d]?.camera) return steps[idx + d]!.camera;
  }
  return undefined;
}
