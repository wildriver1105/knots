// Round turn & two half hitches — 말뚝·링에 하중을 안전하게 매는 히치.
// 말뚝을 두 바퀴 감아(round turn) 마찰로 하중을 받친 뒤, 남은 끝으로 standing part 둘레에
// 반바퀴 매듭(half hitch)을 두 번 건다.

import type { Knot, Vec3 } from "../types";
import { helixY, line, join } from "../builder";

const RP = 0.5;
const RR = RP + 0.085;
const D = (deg: number) => (deg * Math.PI) / 180;

// standing part: 하중(아래-앞)에서 말뚝 앞면 감기 시작점으로
const standing = line([0.05, -1.95, 0.95], [Math.cos(D(110)) * RR, 0.3, Math.sin(D(110)) * RR], 14);

// round turn: 앞-왼쪽에서 두 바퀴(720°) 감으며 상승
const roundTurn = helixY(0, 0, RR, D(110), D(110 - 720), 0.3, 0.62, 64);

const splitAt = standing.length + roundTurn.length;

// 두 번의 half hitch — standing part(대략 x≈-0.05, z≈0.66 수직선) 둘레를 감는다.
const hitches = join(
  // half hitch 1
  line(roundTurn[roundTurn.length - 1], [-0.05, 0.55, 0.92], 5), // 앞으로(over)
  line([-0.05, 0.55, 0.92], [0.2, 0.5, 0.48], 4), // 뒤로(behind)
  line([0.2, 0.5, 0.48], [-0.08, 0.46, 0.46], 4),
  line([-0.08, 0.46, 0.46], [-0.24, 0.5, 0.92], 4), // 고리로 되나옴
  // half hitch 2 (조금 아래)
  line([-0.24, 0.5, 0.92], [-0.05, 0.38, 0.95], 4),
  line([-0.05, 0.38, 0.95], [0.2, 0.33, 0.48], 4),
  line([0.2, 0.33, 0.48], [-0.08, 0.29, 0.46], 4),
  line([-0.08, 0.29, 0.46], [-0.26, 0.33, 0.95], 4),
  // working end 꼬리
  line([-0.26, 0.33, 0.95], [-0.5, 0.18, 1.2], 6)
);

const path: Vec3[] = join(standing, roundTurn, hitches);

export const roundTurnTwoHalfHitches: Knot = {
  id: "round-turn-two-half-hitches",
  name: "Round Turn & Two Half Hitches",
  blurb: "지속 하중을 견디는 견고한 히치. 무어링 링이나 말뚝에 배를 묶을 때 신뢰도 높다.",
  difficulty: 2,
  path,
  ropeColor: "#f3c14a", // standing part
  ropeColorB: "#e0584b", // working end
  colorSplitIndex: splitAt,
  ropeRadius: 0.07,
  object: { kind: "pole", radius: RP, height: 3.4, axis: "y" },
  defaultStepDuration: 1.4,
  steps: [
    { id: "round", title: "Round turn", instruction: "말뚝을 완전히 두 바퀴 감는다 — 마찰이 하중을 받친다.", reveal: 0.55 },
    { id: "hitch1", title: "First half hitch", instruction: "남은 끝으로 standing part 둘레에 반바퀴 매듭을 건다.", reveal: 0.8 },
    { id: "hitch2", title: "Second half hitch", instruction: "같은 방향으로 한 번 더 걸어 잠근다.", reveal: 1 },
  ],
};
