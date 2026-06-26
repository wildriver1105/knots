// 순수 유틸 — three 부작용 없음, 단위 테스트 가능.
//
// 애니메이션 방식: tying pose(손으로 묶는 진행).
// 줄 전체가 항상 화면에 있다. 진행도(0..1)에 따라 working end 가 최종 path 를 따라 이동하고,
// 이미 지나간 부분은 매듭 형태로 남으며 아직 지나가지 않은 부분은 앞쪽으로 곧게 뻗은 꼬리로 남는다.
// 그래서 포즈 전체가 최단거리로 녹아가며 서로 통과하는 morph 느낌을 줄인다.

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

/** 더 부드러운 ease-in-out. 경계에서 가속도까지 완만해 기계적인 끊김이 덜하다. */
export function smootherStep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * c * (c * (c * 6 - 15) + 10);
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

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function smoothPolyline(points: Vec3[], passes = 2): Vec3[] {
  if (points.length < 4 || passes <= 0) return points;
  let out = points.map((p) => [...p] as Vec3);
  for (let pass = 0; pass < passes; pass++) {
    const next: Vec3[] = [[...out[0]] as Vec3];
    for (let i = 0; i < out.length - 1; i++) {
      const a = out[i];
      const b = out[i + 1];
      next.push(lerpVec3(a, b, 0.25));
      next.push(lerpVec3(a, b, 0.75));
    }
    next.push([...out[out.length - 1]] as Vec3);
    out = next;
  }
  return out;
}

/** path 의 각 점까지 누적 호 길이와 총 길이. */
function arcLengths(points: Vec3[]): { cum: number[]; total: number } {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + dist(points[i], points[i - 1]));
  return { cum, total: cum[cum.length - 1] || 1 };
}

function pointAtArc(points: Vec3[], cum: number[], s: number): Vec3 {
  if (points.length === 0) return [0, 0, 0];
  if (points.length === 1 || s <= 0) return [...points[0]] as Vec3;
  const total = cum[cum.length - 1] || 0;
  if (s >= total) return [...points[points.length - 1]] as Vec3;
  let i = 1;
  while (i < cum.length && cum[i] < s) i++;
  const a = points[i - 1];
  const b = points[i];
  const span = cum[i] - cum[i - 1] || 1;
  return lerpVec3(a, b, (s - cum[i - 1]) / span);
}

function tangentAtArc(points: Vec3[], cum: number[], s: number, fallback: Vec3 = [1, 0, 0]): Vec3 {
  if (points.length < 2) return normalize(fallback);
  const total = cum[cum.length - 1] || 0;
  if (s <= 0) return normalize(sub(points[1], points[0]));
  if (s >= total) return normalize(sub(points[points.length - 1], points[points.length - 2]));
  let i = 1;
  while (i < cum.length && cum[i] < s) i++;
  return normalize(sub(points[i], points[i - 1]));
}

/**
 * "곧게 펴진 줄" 기준선 생성.
 * path 와 같은 점 개수·같은 호 길이 간격으로, layCenter 를 중심으로 layDir 방향의 직선에 배치.
 * (점 i 가 final path 에서와 동일한 호 거리에 놓이므로 morph 시 점이 뭉치지 않는다.)
 */
export function buildStraightBaseline(
  path: Vec3[],
  layDir: Vec3 = [1, 0, 0],
  layCenter?: Vec3,
  lengthScale = 1
): Vec3[] {
  const { cum, total } = arcLengths(path);
  const center = layCenter ?? centroid(path);
  const dir = normalize(layDir);
  return path.map((_, i) => {
    const d = (cum[i] - total / 2) * lengthScale;
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

/**
 * 실제로 줄을 묶는 느낌의 진행 포즈.
 *
 * - reverse=false: index 0 쪽은 standing part 로 남고, working end 가 path 를 앞쪽으로 따라간다.
 * - reverse=true: 반대 방향에서 같은 원리로 만든다.
 *
 * 진행 전 구간은 "다음으로 움직일 working end 꼬리"를 곧게 뻗어 표현한다. 단순 점별 보간보다
 * 로프가 자기 자신을 뚫고 최단거리로 이동해 보이는 문제가 훨씬 적다.
 */
export function tieAlongPath(path: Vec3[], progress: number, reverse = false, tailDir?: Vec3): Vec3[] {
  const N = path.length;
  if (N < 2) return path.map((p) => [...p] as Vec3);
  const p = Math.min(1, Math.max(0, progress));

  const oriented = reverse ? [...path].reverse() : path;
  const { cum, total } = arcLengths(oriented);
  const front = total * p;
  const frontPoint = pointAtArc(oriented, cum, front);
  const preferredTail = tailDir ? normalize(tailDir) : tangentAtArc(oriented, cum, front);
  const tangent = tangentAtArc(oriented, cum, front, preferredTail);
  const tail = normalize(add(scale(tangent, 0.72), scale(preferredTail, 0.28)));
  const blend = Math.max(total * 0.14, 0.001);
  const sampleCount = Math.max(64, N * 5);

  const out = Array.from({ length: sampleCount }, (_, i) => {
    const s = total * (i / Math.max(1, sampleCount - 1));
    const original = pointAtArc(oriented, cum, s);
    if (p >= 0.9999) return original;
    if (s <= front - blend) return [...original] as Vec3;

    const straight = add(frontPoint, scale(tail, s - front));
    if (s >= front + blend) return straight;

    // 움직이는 선두 근처를 넓고 부드럽게 섞어 제어점 단위로 딱딱 끊기는 느낌을 줄인다.
    const w = smootherStep((s - (front - blend)) / (blend * 2));
    return lerpVec3(original, straight, w);
  });

  const smoothed = smoothPolyline(out, 2);
  return reverse ? smoothed.reverse() : smoothed;
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
export function interpolatePoses(
  poses: Vec3[][],
  form: number,
  options: { workingStartIndex?: number; reverse?: boolean; staged?: boolean } = {}
): Vec3[] {
  const K = poses.length;
  if (K === 0) return [];
  if (K === 1) return poses[0].map((p) => [p[0], p[1], p[2]] as Vec3);
  const t = Math.min(1, Math.max(0, form)) * (K - 1);
  let i = Math.floor(t);
  if (i >= K - 1) i = K - 2;
  const f = smootherStep(t - i);
  const a = poses[i];
  const b = poses[i + 1];
  const n = Math.min(a.length, b.length);
  const out: Vec3[] = new Array(n);
  const staged = options.staged ?? true;
  const workingStart = Math.min(n - 1, Math.max(0, options.workingStartIndex ?? Math.floor(n * 0.55)));
  const reverse = options.reverse ?? false;
  const blend = 0.52;
  for (let j = 0; j < n; j++) {
    if (!staged) {
      out[j] = lerpVec3(a[j], b[j], f);
      continue;
    }

    // working end 쪽이 먼저 움직이고, standing part 는 늦게 끌려온다.
    // 에디터 포즈가 충분히 촘촘하지 않아도 "전체가 최단거리로 dissolve" 되는 느낌을 줄인다.
    let rank: number;
    if (!reverse) {
      rank =
        j >= workingStart
          ? ((n - 1 - j) / Math.max(1, n - 1 - workingStart)) * 0.72
          : 0.72 + (1 - j / Math.max(1, workingStart)) * 0.28;
    } else {
      rank =
        j <= workingStart
          ? (j / Math.max(1, workingStart)) * 0.72
          : 0.72 + ((j - workingStart) / Math.max(1, n - 1 - workingStart)) * 0.28;
    }
    const local = smootherStep(Math.min(1, Math.max(0, (f * (1 + blend) - rank) / blend)));
    out[j] = lerpVec3(a[j], b[j], local);
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
