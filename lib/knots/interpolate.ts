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
 * progress 에 따라 from → to 로 점별 staged morph.
 * anchor(reverse=false 면 index 0) 쪽 점부터 자리를 잡고, 나머지는 from 위치에 머문다.
 */
export function formStaged(from: Vec3[], to: Vec3[], progress: number, reverse = false): Vec3[] {
  const N = to.length;
  if (N < 2) return to.slice();
  const p = Math.min(1, Math.max(0, progress));
  const pEff = p * (1 + FORM_BLEND);
  const out: Vec3[] = new Array(N);
  for (let i = 0; i < N; i++) {
    const rank = reverse ? (N - 1 - i) / (N - 1) : i / (N - 1);
    const w = easeInOut(Math.min(1, Math.max(0, (pEff - rank) / FORM_BLEND)));
    out[i] = lerpVec3(from[i], to[i], w);
  }
  return out;
}

/** 살짝 넘쳤다가 제자리로 돌아오는 ease(잡아당겨 조이는 "탁" 느낌). */
export function easeOutBack(t: number, overshoot = 1.5): number {
  const c = Math.min(1, Math.max(0, t));
  const c1 = overshoot;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(c - 1, 3) + c1 * Math.pow(c - 1, 2);
}

/**
 * 느슨한 매듭(loose) 생성 — path 를 무게중심 기준으로 부풀린다(고리는 크게, 끝은 더 늘어지게).
 * 시작 화면에 "느슨하지만 알아볼 수 있는 매듭"이 보이고, 여기서 손 순서대로 조여 완성형이 된다.
 */
export function buildLoose(path: Vec3[], inflate = 1.55, tailExtra = 1.25): Vec3[] {
  const c: Vec3 = [0, 0, 0];
  for (const p of path) {
    c[0] += p[0];
    c[1] += p[1];
    c[2] += p[2];
  }
  const n = path.length || 1;
  c[0] /= n;
  c[1] /= n;
  c[2] /= n;
  const N = path.length;
  return path.map((p, i) => {
    const u = N > 1 ? i / (N - 1) : 0;
    const nearEnd = Math.min(u, 1 - u); // 0 = 끝
    const s = inflate + (1 - Math.min(1, nearEnd / 0.25)) * (tailExtra - 1) * inflate;
    return [c[0] + (p[0] - c[0]) * s, c[1] + (p[1] - c[1]) * s, c[2] + (p[2] - c[2]) * s] as Vec3;
  });
}

/**
 * 형성 진행도(0..1) → 화면에 그릴 제어점.
 * loose(느슨한 매듭) → tight(path)로 손 순서대로(staged) 조인다.
 * anchor(standing part) 쪽부터 자리를 잡고 working end 가 마지막에 들어온다.
 * 각 점은 easeOutBack 으로 살짝 넘쳤다 돌아오며 "탁" 조이는 느낌.
 */
export function knotShape(loose: Vec3[], tight: Vec3[], formProgress: number, reverse = false): Vec3[] {
  const N = tight.length;
  if (N < 2) return tight.slice();
  const p = Math.min(1, Math.max(0, formProgress));
  const pEff = p * (1 + FORM_BLEND);
  const out: Vec3[] = new Array(N);
  for (let i = 0; i < N; i++) {
    const rank = reverse ? (N - 1 - i) / (N - 1) : i / (N - 1);
    const local = Math.min(1, Math.max(0, (pEff - rank) / FORM_BLEND));
    const e = easeOutBack(local, 1.15); // 살짝 넘쳤다 돌아오는 "탁" 조임
    out[i] = lerpVec3(loose[i], tight[i], e);
  }
  return out;
}

/** 하위호환: straight → path 단순 staged. */
export function formCenterline(path: Vec3[], straight: Vec3[], formProgress: number, reverse = false): Vec3[] {
  return formStaged(straight, path, formProgress, reverse);
}

/**
 * 에디터(keyframe) 매듭: 포즈 사이를 form(0..1)으로 보간.
 * 스텝 K개를 균등 구간으로 나눠 인접 포즈를 easeInOut 으로 섞는다.
 */
export function interpolatePoses(poses: Vec3[][], form: number): Vec3[] {
  const K = poses.length;
  if (K === 0) return [];
  if (K === 1) return poses[0].map((p) => [p[0], p[1], p[2]] as Vec3);
  const t = Math.min(1, Math.max(0, form)) * (K - 1);
  let i = Math.floor(t);
  if (i >= K - 1) i = K - 2;
  const f = easeInOut(t - i);
  const a = poses[i];
  const b = poses[i + 1];
  const n = Math.min(a.length, b.length);
  const out: Vec3[] = new Array(n);
  for (let j = 0; j < n; j++) out[j] = lerpVec3(a[j], b[j], f);
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
