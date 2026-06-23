import type { Knot, KnotId } from "../types";
import { figureEight } from "./figureEight";
import { cloveHitch } from "./cloveHitch";
import { cleatHitch } from "./cleatHitch";
import { bowline } from "./bowline";
import { squareKnot } from "./squareKnot";
import { roundTurnTwoHalfHitches } from "./roundTurnTwoHalfHitches";

// 표시 순서 = 학습 난이도 순.
export const KNOTS: Knot[] = [
  figureEight,
  squareKnot,
  cleatHitch,
  cloveHitch,
  roundTurnTwoHalfHitches,
  bowline,
];

const BY_ID: Record<KnotId, Knot> = KNOTS.reduce((acc, k) => {
  acc[k.id] = k;
  return acc;
}, {} as Record<KnotId, Knot>);

export function getKnot(id: KnotId): Knot {
  return BY_ID[id] ?? figureEight;
}

export const DEFAULT_KNOT_ID: KnotId = "figure-eight";
