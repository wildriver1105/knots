// Square (reef) knot — 굵기가 같은 두 로프를 잇는 bend.
// 두 로프가 각각 bight(U)를 만들어 서로의 고리를 통과하며 맞물린다. 좌우 대칭.
// 각 로프의 두 끝은 같은 쪽으로 나간다(파랑=왼쪽, 빨강=오른쪽).
//
// 올바른 reef 패턴(granny 아님): 위쪽 교차는 파랑이 위(앞, z+), 아래쪽 교차는 빨강이 위.
//   파랑: 위 가닥 z+ → 오른쪽으로 돌아 → 아래 가닥 z−.
//   빨강: 아래 가닥 z+ → 왼쪽으로 돌아 → 위 가닥 z−.
// 두 bight 의 정점(파랑은 우측, 빨강은 좌측)이 서로의 고리를 통과해 링크된다.

import type { Knot, Vec3 } from "../types";

const Z = 0.24; // over/under 깊이(로프 지름보다 충분히 큼)

// 파랑 로프: 위-왼 끝 → (앞,위) → 오른쪽 정점 → (뒤,아래) → 아래-왼 끝
const blue: Vec3[] = [
  [-1.65, 0.46, 0.0],
  [-1.05, 0.45, 0.02],
  [-0.62, 0.38, Z * 0.5],
  [-0.2, 0.28, Z],
  [0.28, 0.2, Z],
  [0.64, 0.08, Z * 0.5],
  [0.72, 0.0, 0.0], // 우측 정점
  [0.64, -0.08, -Z * 0.5],
  [0.28, -0.2, -Z],
  [-0.2, -0.28, -Z],
  [-0.62, -0.38, -Z * 0.5],
  [-1.05, -0.45, -0.02],
  [-1.65, -0.46, 0.0],
];

// 빨강 로프: 아래-오른 끝 → (앞,아래) → 왼쪽 정점 → (뒤,위) → 위-오른 끝
const red: Vec3[] = [
  [1.65, -0.46, 0.0],
  [1.05, -0.45, 0.02],
  [0.62, -0.38, Z * 0.5],
  [0.2, -0.28, Z],
  [-0.28, -0.2, Z],
  [-0.64, -0.08, Z * 0.5],
  [-0.72, 0.0, 0.0], // 좌측 정점
  [-0.64, 0.08, -Z * 0.5],
  [-0.28, 0.2, -Z],
  [0.2, 0.28, -Z],
  [0.62, 0.38, -Z * 0.5],
  [1.05, 0.45, -0.02],
  [1.65, 0.46, 0.0],
];

export const squareKnot: Knot = {
  id: "square-knot",
  builtinRevision: 5,
  name: "Square (Reef) Knot",
  blurb: "굵기가 같은 두 줄을 잇거나 돛을 묶을 때(reef). 좌상우, 우상좌 — 대칭이라 평평하게 눕는다.",
  difficulty: 1,
  path: blue,
  ropeColor: "#3f8fce",
  ropeRadius: 0.082,
  // 두 손이 동시에 움직이듯 파랑·빨강 모두 자기 경로를 따라 꿰어 들어간다.
  extraStrands: [{ path: red, color: "#e0584b", tieMotion: { reverse: false } }],
  object: { kind: "none" },
  formReverse: false,
  tieMotion: { reverse: false },
  defaultStepDuration: 1.3,
  steps: [
    { id: "lay", title: "Lay the ropes", instruction: "두 로프 끝을 나란히 놓는다. 왼손 줄(파랑), 오른손 줄(빨강).", reveal: 0.4, camera: { position: [0.6, 1.9, 3.9], target: [0, 0, 0] } },
    { id: "first", title: "Left over right", instruction: "왼쪽 끝을 오른쪽 위로 교차해 한 번 감는다.", reveal: 0.66, camera: { position: [0.6, 1.9, 3.9], target: [0, 0, 0] } },
    { id: "second", title: "Right over left", instruction: "이번엔 오른쪽 끝을 왼쪽 위로 교차해 감는다 — 대칭이 핵심.", reveal: 0.85, camera: { position: [0.6, 1.9, 3.9], target: [0, 0, 0] } },
    { id: "dress", title: "Pull tight", instruction: "같은 색의 두 끝이 같은 쪽으로 나가도록 네 가닥을 당겨 평평하게 정돈한다. 비대칭이면 granny knot다.", reveal: 1, camera: { position: [0.6, 1.9, 3.9], target: [0, 0, 0] } },
  ],
};
