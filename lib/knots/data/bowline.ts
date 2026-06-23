// Bowline — 끝에 풀리지 않는 고정 고리(fixed loop)를 만드는 세일링 핵심 매듭.
// "토끼가 구멍에서 나와 나무를 돌아 다시 구멍으로." standing part(노랑) + working end(빨강).
//
// 구성: 위로 뻗는 standing part → 아래로 큰 고정 고리 → working end 가 작은 구멍을 통해
// 나와 standing part 를 돌아 다시 구멍으로 내려간다.

import type { Knot, Vec3 } from "../types";
import { arc, line, join } from "../builder";

const D = (deg: number) => (deg * Math.PI) / 180;

const LC: Vec3 = [-0.05, -0.6, 0]; // 큰 고리 중심
const LR = 0.92; // 큰 고리 반경

// standing part: 위 → 큰 고리 시작점
const standing = line([0.5, 1.75, 0], [LC[0] + Math.cos(D(80)) * LR, LC[1] + Math.sin(D(80)) * LR, 0], 12);

// 큰 고정 고리: 80° → -260° (위쪽에 구멍(hole) 간격을 남김)
const bigLoop = arc(LC, LR, D(80), D(-260), 64, "xy");

// 여기서부터 working end. 구멍을 통해 앞으로 나옴 → 나무(standing)를 돌아 → 구멍으로 내려감.
const splitAt = standing.length + bigLoop.length;

const work = join(
  line(bigLoop[bigLoop.length - 1], [-0.05, 0.46, 0.22], 5), // 구멍 통과(뒤→앞)
  line([-0.05, 0.46, 0.22], [0.32, 0.62, 0.2], 5), // standing 위로(over)
  line([0.32, 0.62, 0.2], [0.5, 0.42, -0.2], 5), // standing 뒤로(behind)
  line([0.5, 0.42, -0.2], [0.28, 0.22, -0.2], 4), // 뒤에서 아래로
  line([0.28, 0.22, -0.2], [0.0, 0.36, 0.22], 5), // 다시 구멍으로(앞)
  line([0.0, 0.36, 0.22], [-0.2, 0.02, 0.45], 7) // working end 꼬리
);

const path: Vec3[] = join(standing, bigLoop, work);

export const bowline: Knot = {
  id: "bowline",
  name: "Bowline",
  blurb: "끝에 절대 미끄러지지 않는 고정 고리를 만든다. 하중 후에도 쉽게 풀려 '매듭의 왕'으로 불린다.",
  difficulty: 3,
  path,
  ropeColor: "#f3c14a", // standing part
  ropeColorB: "#e0584b", // working end
  colorSplitIndex: splitAt,
  ropeRadius: 0.07,
  object: { kind: "none" },
  defaultStepDuration: 1.5,
  steps: [
    { id: "loop", title: "Make the hole", instruction: "standing part 에 작은 고리(구멍)를 만든다 — 토끼 굴.", reveal: 0.5 },
    { id: "up", title: "Up through the hole", instruction: "working end 를 아래에서 구멍 위로 통과시킨다 — 토끼가 나온다.", reveal: 0.66 },
    { id: "around", title: "Around the tree", instruction: "끝을 standing part 뒤로 돌린다 — 나무를 돈다.", reveal: 0.85 },
    { id: "down", title: "Back down the hole", instruction: "끝을 다시 구멍으로 내리고 당겨 조인다 — 굴로 돌아간다.", reveal: 1 },
  ],
};
