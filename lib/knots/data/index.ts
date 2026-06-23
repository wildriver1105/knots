import type { Knot, KnotId } from "../types";
import { getCustomKnot } from "../custom";
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

const BY_ID: Record<string, Knot> = KNOTS.reduce((acc, k) => {
  acc[k.id] = k;
  return acc;
}, {} as Record<string, Knot>);

export function getKnot(id: string): Knot {
  return BY_ID[id as KnotId] ?? getCustomKnot(id) ?? figureEight;
}

export const DEFAULT_KNOT_ID: KnotId = "figure-eight";
