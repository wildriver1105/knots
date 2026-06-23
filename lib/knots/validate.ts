// dev 전용 검증 — path 와 step.reveal 의 정합성을 확인한다.

import type { Knot } from "./types";

export function validateKnot(knot: Knot): string[] {
  const errors: string[] = [];
  if (knot.path.length < 2) {
    errors.push(`[${knot.id}] path 는 2개 이상의 점이 필요 (현재 ${knot.path.length})`);
  }
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
