// 빌트인 매듭 데이터 구조 검증 — 시각 검증(브라우저) 전에 먼저 게이트한다.
// 에러가 있으면 비정상 종료(exit 1). 실행: npm run validate
//
// (BUILTIN_SEED → 데이터 파일 → builder/types 는 모두 상대 임포트라 tsx 로 바로 실행된다.)

import { BUILTIN_SEED } from "../lib/knots/data";
import { validateKnot } from "../lib/knots/validate";

let failed = 0;
for (const knot of BUILTIN_SEED) {
  const errors = validateKnot(knot);
  if (errors.length) {
    failed += errors.length;
    // eslint-disable-next-line no-console
    console.error(`✗ ${knot.id}`);
    // eslint-disable-next-line no-console
    for (const e of errors) console.error("  - " + e);
  } else {
    const extra = knot.extraStrands?.length ? `, +${knot.extraStrands.length} strand` : "";
    // eslint-disable-next-line no-console
    console.log(
      `✓ ${knot.id} (${knot.path.length}pt, ${knot.steps.length} steps${knot.poses ? ", poses" : ""}${extra})`
    );
  }
}

if (failed) {
  // eslint-disable-next-line no-console
  console.error(`\n검증 실패: ${failed}개 오류`);
  process.exit(1);
}
// eslint-disable-next-line no-console
console.log(`\n모든 매듭(${BUILTIN_SEED.length}) 검증 통과`);
