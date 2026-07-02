// Figure-eight (Flemish) stopper knot.
// 손으로 직접 배치한 제어점 — standing part 가 내려오며 고리를 만들고, working end 가
// standing 뒤로 돌아 한 바퀴 비튼 뒤 고리로 다시 내려가 뽑힌다(8자 멈춤 매듭).
// z 는 교차점 over/under 분리(로프 반경 0.07 의 2배 이상).

import type { Knot, Vec3 } from "../types";

const Z = 0.18;

// standing(노랑, 위) → working end(빨강, 아래로 뽑힘). 교차마다 z 부호 교대.
const path: Vec3[] = [
  // standing part 가 위에서 내려옴
  [0.08, 1.4, 0.0],
  [0.0, 0.8, 0.0],
  [-0.06, 0.36, 0.02],
  // 아래 고리: 왼쪽으로 교차(OVER) → 아래로 한 바퀴 → 오른쪽으로 올라옴(UNDER)
  [-0.5, 0.18, Z],
  [-0.74, -0.28, 0.06],
  [-0.5, -0.72, 0.0],
  [0.0, -0.86, 0.0],
  [0.5, -0.72, 0.0],
  [0.74, -0.28, -0.06],
  [0.5, 0.18, -Z],
  [0.12, 0.4, -Z],
  // 위쪽으로 한 바퀴 비틀어 올라감(working end 가 standing 을 감음)
  [-0.26, 0.56, 0.0],
  [-0.46, 0.98, Z],
  [-0.08, 1.18, Z],
  [0.32, 1.02, 0.0],
  [0.42, 0.6, -Z],
  // 고리 안으로 다시 통과해 아래로 뽑힘
  [0.16, 0.3, Z],
  [0.12, -0.04, Z],
  [0.34, -0.34, 0.02],
  [0.62, -0.22, 0.0],
  [0.92, -0.05, 0.0],
];

export const figureEight: Knot = {
  id: "figure-eight",
  builtinRevision: 5,
  name: "Figure-Eight",
  blurb:
    "기본 멈춤 매듭(stopper). 로프가 블록·페어리드를 빠져나가지 않게 끝에 묶는다. 풀기 쉽고 절대 엉키지 않는다.",
  difficulty: 1,
  path,
  ropeColor: "#f3c14a", // standing part (위, 노랑)
  ropeColorB: "#e0584b", // working end (빨강)
  colorSplitIndex: 10,
  ropeRadius: 0.07,
  object: { kind: "none" },
  formReverse: false, // index 0(standing 위)부터 형성
  // 사람이 묶는 순서: working end 가 최종 경로를 따라 실제로 꿰어 들어간다(스레딩 재생).
  tieMotion: { reverse: false, tailDir: [0.55, -0.2, 0.35] },
  defaultStepDuration: 1.4,
  steps: [
    { id: "loop", title: "Make a loop", instruction: "standing part 로 고리를 만든다.", reveal: 0.35, camera: { position: [0.5, 0.55, 3.7], target: [0.05, 0.3, 0] } },
    { id: "around", title: "Around behind", instruction: "working end 를 standing part 뒤로 돌린다.", reveal: 0.6, camera: { position: [0.5, 0.55, 3.7], target: [0.05, 0.3, 0] } },
    { id: "through", title: "Through the loop", instruction: "끝을 고리 안으로 통과시켜 내린다.", reveal: 0.82, camera: { position: [0.5, 0.5, 3.4], target: [0.1, 0.2, 0] } },
    { id: "dress", title: "Dress & tighten", instruction: "양쪽 끝을 당겨 8자 모양으로 정돈해 조인다.", reveal: 1, camera: { position: [0.45, 0.45, 3.2], target: [0.1, 0.15, 0] } },
  ],
};
