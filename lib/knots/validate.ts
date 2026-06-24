// dev 전용 검증 — path 와 step.reveal 의 정합성을 확인한다.

import type { Knot } from "./types";

const finitePoint = (p: unknown): p is [number, number, number] =>
  Array.isArray(p) && p.length === 3 && p.every((v) => typeof v === "number" && Number.isFinite(v));

function validatePath(knot: Knot, label: string, path: Knot["path"], errors: string[]): void {
  if (path.length < 2) {
    errors.push(`[${knot.id}] ${label}는 2개 이상의 점이 필요 (현재 ${path.length})`);
    return;
  }
  path.forEach((point, index) => {
    if (!finitePoint(point)) errors.push(`[${knot.id}] ${label}[${index}] 좌표가 유효하지 않음`);
    if (index > 0 && finitePoint(point) && finitePoint(path[index - 1])) {
      const prev = path[index - 1];
      const length = Math.hypot(point[0] - prev[0], point[1] - prev[1], point[2] - prev[2]);
      if (length < 1e-5) errors.push(`[${knot.id}] ${label}[${index - 1}..${index}]가 중복 점`);
    }
  });
}

export function validateKnot(knot: Knot): string[] {
  const errors: string[] = [];
  validatePath(knot, "path", knot.path, errors);
  knot.extraStrands?.forEach((strand, index) => validatePath(knot, `extraStrands[${index}].path`, strand.path, errors));
  if (knot.steps.length < 2) {
    errors.push(`[${knot.id}] steps 는 2개 이상 필요 (현재 ${knot.steps.length})`);
  }
  let prev = -Infinity;
  knot.steps.forEach((s, i) => {
    if (s.reveal < 0 || s.reveal > 1) {
      errors.push(`[${knot.id}] step ${i} reveal=${s.reveal} 은 0..1 범위 밖`);
    }
    if (s.reveal < prev) {
      errors.push(`[${knot.id}] step ${i} reveal=${s.reveal} 이 단조 증가 아님 (이전 ${prev})`);
    }
    prev = s.reveal;
  });
  const last = knot.steps[knot.steps.length - 1];
  if (last && Math.abs(last.reveal - 1) > 1e-6) {
    errors.push(`[${knot.id}] 마지막 step reveal 은 1 이어야 함 (현재 ${last.reveal})`);
  }
  if (
    knot.colorSplitIndex !== undefined &&
    (knot.colorSplitIndex < 0 || knot.colorSplitIndex > knot.path.length)
  ) {
    errors.push(`[${knot.id}] colorSplitIndex=${knot.colorSplitIndex} 가 path 범위 밖`);
  }
  if (!(knot.ropeRadius > 0 && Number.isFinite(knot.ropeRadius))) {
    errors.push(`[${knot.id}] ropeRadius는 0보다 큰 유한수여야 함`);
  }
  if (knot.poses) {
    if (knot.poses.length !== knot.steps.length) {
      errors.push(`[${knot.id}] poses(${knot.poses.length})와 steps(${knot.steps.length}) 개수가 다름`);
    }
    knot.poses.forEach((pose, poseIndex) => {
      if (pose.length !== knot.path.length) {
        errors.push(`[${knot.id}] poses[${poseIndex}] 점 개수(${pose.length})가 path(${knot.path.length})와 다름`);
      }
      pose.forEach((point, pointIndex) => {
        if (!finitePoint(point)) errors.push(`[${knot.id}] poses[${poseIndex}][${pointIndex}] 좌표가 유효하지 않음`);
      });
    });
  }
  const unitFields = ["tension", "bendStiffness", "damping"] as const;
  unitFields.forEach((field) => {
    const value = knot.physics?.[field];
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1)) {
      errors.push(`[${knot.id}] physics.${field}=${value}는 0..1 범위여야 함`);
    }
  });
  if (knot.physics?.gravity !== undefined && (!Number.isFinite(knot.physics.gravity) || knot.physics.gravity < 0)) {
    errors.push(`[${knot.id}] physics.gravity는 0 이상의 유한수여야 함`);
  }
  return errors;
}

/** dev 환경에서 모든 매듭을 검증하고 경고 출력. */
export function validateAllKnots(knots: Knot[]): void {
  if (process.env.NODE_ENV === "production") return;
  const all = knots.flatMap(validateKnot);
  if (all.length) {
    // eslint-disable-next-line no-console
    console.warn("[knots] 데이터 검증 실패:\n" + all.join("\n"));
  } else {
    // eslint-disable-next-line no-console
    console.info("[knots] 모든 매듭 데이터 검증 통과");
  }
}
