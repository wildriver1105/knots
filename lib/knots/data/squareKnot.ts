// Square (reef) knot — 굵기가 같은 두 로프를 잇는 bend. 돛을 리핑할 때 등.
// 두 가닥(bight)이 서로의 굽이를 통과하며 맞물린다. 대칭 구조.
// 각 로프는 양 끝이 같은 쪽으로 나간다(왼 로프=좌, 오른 로프=우).
//
// over/under: 왼 로프 위쪽 가닥은 앞(z+), 아래쪽은 뒤(z-); 오른 로프는 반대.
// → 중앙에서 left-over-right / right-over-left 가 교차한다(granny 가 아닌 reef).

import type { Knot, Vec3 } from "../types";

const leftRope: Vec3[] = [
  [-1.8, 0.28, 0],
  [-0.75, 0.27, 0.08],
  [-0.18, 0.21, 0.2],
  [0.24, 0.12, 0.21],
  [0.36, 0.0, 0.2],
  [0.24, -0.12, -0.21],
  [-0.18, -0.21, -0.2],
  [-0.75, -0.27, -0.08],
  [-1.8, -0.28, 0],
];

const rightRope: Vec3[] = [
  [1.8, 0.28, 0],
  [0.75, 0.27, -0.08],
  [0.18, 0.21, -0.2],
  [-0.24, 0.12, -0.21],
  [-0.36, 0.0, -0.2],
  [-0.24, -0.12, 0.21],
  [0.18, -0.21, 0.2],
  [0.75, -0.27, 0.08],
  [1.8, -0.28, 0],
];

export const squareKnot: Knot = {
  id: "square-knot",
  name: "Square (Reef) Knot",
  blurb: "굵기가 같은 두 줄을 잇거나 돛을 묶을 때(reef). 좌상우, 우상좌 — 대칭이라 평평하게 눕는다.",
  difficulty: 1,
  path: leftRope,
  ropeColor: "#3f8fce", // 왼 로프
  ropeRadius: 0.078,
  extraStrands: [{ path: rightRope, color: "#e0584b" }], // 오른 로프
  object: { kind: "none" },
  defaultStepDuration: 1.3,
  steps: [
    { id: "lay", title: "Lay the ropes", instruction: "두 로프의 끝을 나란히 놓는다. 왼손 줄(파랑), 오른손 줄(빨강).", reveal: 0.45 },
    { id: "first", title: "Left over right", instruction: "왼쪽 끝을 오른쪽 위로 교차해 한 번 감는다.", reveal: 0.72 },
    { id: "second", title: "Right over left", instruction: "이번엔 오른쪽 끝을 왼쪽 위로 교차해 감는다 — 대칭이 핵심.", reveal: 0.9 },
    { id: "dress", title: "Tighten flat", instruction: "네 가닥을 당겨 평평하게 조인다. 비대칭이면 granny(잘못된 매듭).", reveal: 1 },
  ],
};
