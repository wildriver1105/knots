// Bowline — 끝에 풀리지 않는 고정 고리(fixed loop)를 만드는 세일링 핵심 매듭.
// "토끼가 구멍에서 나와 나무를 돌아 다시 구멍으로." standing part(노랑) 가 작은 고리(구멍)를
// 만들고, working end(빨강) 가 구멍으로 올라와 standing 을 돌아 다시 구멍으로 내려간다.
// 아래에는 큰 고정 고리가 남는다.

import type { Knot, Vec3 } from "../types";
import { tiePoses } from "../authoring";

const path: Vec3[] = [
  // standing part: 위에서 내려와 매듭으로
  [0.62, 1.6, 0.0],
  [0.52, 0.7, 0.0],
  [0.42, 0.32, 0.0],
  // 작은 고리(구멍): standing 이 자기 위로 교차해 고리를 만든다
  [0.12, 0.34, 0.0],
  [-0.04, 0.06, 0.0],
  [0.2, -0.12, 0.17], // 교차 OVER
  [0.46, 0.0, 0.17],
  [0.5, 0.3, 0.14], // 구멍 닫힘(중심 ~0.25,0.12)
  // 큰 고정 고리: 아래로 한 바퀴
  [0.32, -0.24, 0.0],
  [-0.3, -0.5, 0.0],
  [-0.8, -1.05, 0.0],
  [-0.34, -1.46, 0.0],
  [0.36, -1.3, 0.0],
  [0.62, -0.58, 0.0],
  [0.5, -0.14, 0.0], // 구멍 근처로 복귀
  // working end: 구멍으로 올라와 → standing 뒤로 돌아 → 구멍으로 내려감
  [0.42, 0.12, 0.2], // 구멍 통과(앞)
  [0.5, 0.44, 0.2], // 앞으로 올라감
  [0.64, 0.56, -0.04], // standing 위를 넘음
  [0.68, 0.34, -0.2], // 뒤로
  [0.5, 0.12, -0.2], // 뒤에서 내려옴
  [0.32, 0.2, 0.2], // 다시 구멍 통과(앞)
  [0.18, -0.06, 0.36], // working end 꼬리
  [0.02, -0.26, 0.42],
];

export const bowline: Knot = {
  id: "bowline",
  builtinRevision: 3,
  name: "Bowline",
  blurb: "끝에 절대 미끄러지지 않는 고정 고리를 만든다. 하중 후에도 쉽게 풀려 '매듭의 왕'으로 불린다.",
  difficulty: 3,
  path,
  ropeColor: "#f3c14a", // standing part
  ropeColorB: "#e0584b", // working end
  colorSplitIndex: 15,
  ropeRadius: 0.07,
  object: { kind: "none" },
  formReverse: false,
  defaultStepDuration: 1.5,
  // 형성된 부분은 제 위치(구멍→큰 고리), working end 는 곧은 꼬리로 — 토끼가 굴을 드나드는 진행.
  poses: tiePoses(path, [0.42, 0.62, 0.82, 1], { reverse: false, tailDir: [-0.3, 0.2, 0.6] }),
  steps: [
    { id: "loop", title: "Make the hole", instruction: "standing part 에 작은 고리(구멍)를 만든다 — 토끼 굴.", reveal: 0.42, camera: { position: [0.7, 0.6, 3.6], target: [0.15, 0.1, 0] } },
    { id: "up", title: "Up through the hole", instruction: "working end 를 구멍 위로 통과시킨다 — 토끼가 나온다.", reveal: 0.62, camera: { position: [0.7, 0.55, 3.6], target: [0.2, 0.15, 0] } },
    { id: "around", title: "Around the tree", instruction: "끝을 standing part 뒤로 돌린다 — 나무를 돈다.", reveal: 0.82, camera: { position: [0.8, 0.5, 3.7], target: [0.25, 0.15, 0] } },
    { id: "down", title: "Back down the hole", instruction: "끝을 다시 구멍으로 내리고 당겨 조인다 — 굴로 돌아간다.", reveal: 1, camera: { position: [0.45, 0.15, 4.4], target: [0, -0.25, 0] } },
  ],
};
