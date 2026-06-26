// 매듭 저작 헬퍼 — path+steps 로부터 스텝별 포즈(poses)를 시드한다.
//
// 결정론적 런타임에서 빌트인·커스텀 모두 poses 를 단일 진리로 쓴다(Rope 가 interpolatePoses 로 재생).
// 이 모듈은 "최종 path 만 저작했을 때" 중간 포즈를 자동으로 채워 주는 순수 헬퍼다.
// 에디터(ensurePoses)와 데이터 파일/코드젠이 같은 로직을 공유해 분기를 없앤다.
//
// 손저작(고품질)은 이 시드를 출발점으로 좌표를 다듬어 데이터 파일에 명시적 poses 로 굽는 방식이다.

import type { Knot, Vec3 } from "./types";
import { buildStraightBaseline, formStaged, tieAlongPath } from "./interpolate";

// 폴리라인을 호 길이 균일하게 정확히 count 개 점으로 리샘플(포즈 길이를 path.length 로 맞추는 용).
function resampleToCount(points: Vec3[], count: number): Vec3[] {
  if (points.length <= 1) return Array.from({ length: count }, () => [...(points[0] ?? [0, 0, 0])] as Vec3);
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  const total = cum[cum.length - 1] || 1;
  const out: Vec3[] = [];
  for (let j = 0; j < count; j++) {
    const s = (j / (count - 1)) * total;
    let i = 1;
    while (i < cum.length && cum[i] < s) i++;
    const a = points[i - 1];
    const b = points[Math.min(i, points.length - 1)];
    const span = cum[Math.min(i, cum.length - 1)] - cum[i - 1] || 1;
    const t = (s - cum[i - 1]) / span;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
  }
  return out;
}

/**
 * path+steps 매듭의 중간 포즈를 시드한다.
 * 곧게 펴진 줄(straight baseline)에서 최종 path 로 손 순서대로(staged) 형성하는 K개 포즈를 만든다.
 * 순수 함수 — 에디터/데이터/코드젠 공용.
 */
export function seedPoses(
  path: Vec3[],
  steps: number,
  opts?: { layDir?: Vec3; layCenter?: Vec3; formReverse?: boolean; lengthScale?: number }
): Vec3[][] {
  const straight = buildStraightBaseline(path, opts?.layDir, opts?.layCenter, opts?.lengthScale ?? 0.7);
  const K = Math.max(2, steps);
  const out: Vec3[][] = [];
  for (let i = 0; i < K; i++) {
    out.push(formStaged(straight, path, K > 1 ? i / (K - 1) : 1, opts?.formReverse));
  }
  return out;
}

/**
 * "줄을 따라 꿰는" 스텝 포즈. 각 스텝 reveal 까지는 최종 path 위에 형성되고, 나머지는 그 지점에서
 * 곧게 뻗은 working-end 꼬리로 둔다(= tieAlongPath, 길이는 path.length 로 리샘플).
 * 말뚝/클리트를 감는 매듭처럼 "감은 부분은 제 위치, 남은 끝은 곧게"가 자연스러운 경우에 쓴다.
 *
 * reveals 는 보통 각 step 의 reveal 값을 그대로 넘긴다(마지막은 1 → 최종 path).
 */
export function tiePoses(
  path: Vec3[],
  reveals: number[],
  opts?: { reverse?: boolean; tailDir?: Vec3 }
): Vec3[][] {
  return reveals.map((r) =>
    resampleToCount(tieAlongPath(path, r, opts?.reverse ?? false, opts?.tailDir), path.length)
  );
}

/**
 * 매듭 전체에 포즈를 채운다(main + 각 extraStrand). 이미 poses 가 있으면 그대로 둔다.
 * 데이터 파일에서 `export const foo = withSeededPoses({ ...path 만 저작... })` 처럼 쓰거나,
 * 런타임 폴백으로 호출한다.
 */
export function withSeededPoses(knot: Knot): Knot {
  const K = Math.max(2, knot.steps.length);
  const mainPoses =
    knot.poses && knot.poses.length >= 2
      ? knot.poses
      : seedPoses(knot.path, K, {
          layDir: knot.layDir,
          layCenter: knot.layCenter,
          formReverse: knot.formReverse,
        });

  const extraStrands = knot.extraStrands?.map((strand) => {
    if (strand.poses && strand.poses.length >= 2) return strand;
    return {
      ...strand,
      poses: seedPoses(strand.path, K, {
        layDir: strand.layDir ?? knot.layDir,
        layCenter: strand.layCenter ?? knot.layCenter,
        formReverse: knot.formReverse,
      }),
    };
  });

  return { ...knot, poses: mainPoses, ...(extraStrands ? { extraStrands } : {}) };
}
