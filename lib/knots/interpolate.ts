// 순수 유틸 — three 부작용 없음, 단위 테스트 가능.
//
// 애니메이션 방식: morph(형성).
// 줄 전체가 항상 화면에 있다. 진행도(0..1)에 따라 "곧게 펴진 줄(straight baseline)"에서
// "묶인 매듭(path)"으로 제어점을 단계적으로 이동시킨다. anchor 쪽부터 차례로 자리를 잡고,
// 아직 형성되지 않은 부분은 곧은 채로 남아 있다가 끌려 들어온다 → 줄이 움직이며 매듭이 생긴다.

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

// ── morph(형성) ───────────────────────────────────────────────────────────

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function centroid(points: Vec3[]): Vec3 {
  const c: Vec3 = [0, 0, 0];
  for (const p of points) {
    c[0] += p[0];
    c[1] += p[1];
    c[2] += p[2];
  }
  const n = points.length || 1;
  return [c[0] / n, c[1] / n, c[2] / n];
}

function normalize(v: Vec3): Vec3 {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
}

/** path 의 각 점까지 누적 호 길이와 총 길이. */
function arcLengths(points: Vec3[]): { cum: number[]; total: number } {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + dist(points[i], points[i - 1]));
  return { cum, total: cum[cum.length - 1] || 1 };
}

/**
 * "곧게 펴진 줄" 기준선 생성.
 * path 와 같은 점 개수·같은 호 길이 간격으로, layCenter 를 중심으로 layDir 방향의 직선에 배치.
 * (점 i 가 final path 에서와 동일한 호 거리에 놓이므로 morph 시 점이 뭉치지 않는다.)
 */
export function buildStraightBaseline(path: Vec3[], layDir: Vec3 = [1, 0, 0], layCenter?: Vec3): Vec3[] {
  const { cum, total } = arcLengths(path);
  const center = layCenter ?? centroid(path);
  const dir = normalize(layDir);
  return path.map((_, i) => {
    const d = cum[i] - total / 2;
    return [center[0] + dir[0] * d, center[1] + dir[1] * d, center[2] + dir[2] * d] as Vec3;
  });
}

const FORM_BLEND = 0.3; // anchor 에서 끝까지 형성이 번지는 전이 폭(0..1)

/**
 * formProgress(0..1) 에 따라 straight → path 로 점별 morph.
 * anchor(reverse=false 면 index 0, true 면 마지막 index) 쪽 점부터 자리를 잡고,
 * 아직 형성 안 된 점은 straight 위치에 머문다.
 * formProgress=0 → 완전히 곧은 줄, =1 → 완성된 매듭.
 */
export function formCenterline(
  path: Vec3[],
  straight: Vec3[],
  formProgress: number,
  reverse = false
): Vec3[] {
  const N = path.length;
  if (N < 2) return path.slice();
  const p = Math.min(1, Math.max(0, formProgress));
  // p=1 일 때 끝 점까지 완전히 형성되도록 유효 진행도를 BLEND 만큼 늘린다.
  const pEff = p * (1 + FORM_BLEND);
  const out: Vec3[] = new Array(N);
  for (let i = 0; i < N; i++) {
    const rank = reverse ? (N - 1 - i) / (N - 1) : i / (N - 1); // 형성 순서(0=먼저)
    const w = easeInOut(Math.min(1, Math.max(0, (pEff - rank) / FORM_BLEND)));
    out[i] = lerpVec3(straight[i], path[i], w);
  }
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
