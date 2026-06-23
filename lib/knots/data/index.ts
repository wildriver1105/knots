// 빌트인 매듭 "시드(공장 기본값)". 런타임은 이 모듈을 직접 읽지 않고 knots.data.json(파일)에서
// 불러온다. 이 시드는 API(/api/knots)가 파일을 처음 만들 때 + 빌트인 기본값 복원에만 쓰인다.

import type { Knot, KnotId } from "../types";
import { figureEight } from "./figureEight";
import { cloveHitch } from "./cloveHitch";
import { cleatHitch } from "./cleatHitch";
import { bowline } from "./bowline";
import { squareKnot } from "./squareKnot";
import { roundTurnTwoHalfHitches } from "./roundTurnTwoHalfHitches";

// 표시 순서 = 학습 난이도 순.
export const BUILTIN_SEED: Knot[] = [
  figureEight,
  squareKnot,
  cleatHitch,
  cloveHitch,
  roundTurnTwoHalfHitches,
  bowline,
];

/** 빌트인 id 집합(빌트인/커스텀 구분, 기본값 복원 가능 여부 판단용). */
export const BUILTIN_IDS = new Set(BUILTIN_SEED.map((k) => k.id));

/** 시드 인덱스 — repo 미하이드레이트 시 fallback. */
export const SEED_BY_ID: Record<string, Knot> = BUILTIN_SEED.reduce((acc, k) => {
  acc[k.id] = k;
  return acc;
}, {} as Record<string, Knot>);

export const DEFAULT_KNOT_ID: KnotId = "figure-eight";

// 하위호환: 기존 import { KNOTS } 대비.
export const KNOTS = BUILTIN_SEED;
