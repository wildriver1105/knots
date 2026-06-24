// Cleat hitch — 혼 클리트에 도크라인을 매는 방법.
// 베이스를 한 바퀴 돈 뒤 두 뿔(horn)에 8자(figure-eight)로 감고 마지막에 잠금 히치.
// 클리트는 x축 가로 배치(뿔 x=±0.78). 윗면 교차(X)는 z 깊이로 분리한다.

import type { Knot, Vec3 } from "../types";

// 제어점을 직접 배치(CatmullRom 이 매끄럽게 보간). 윗면을 지나는 대각선은 z 를 벌려 X 가 또렷하게.
const path: Vec3[] = [
  // standing part: 아래에서 올라옴
  [0.0, -1.85, 0.55],
  [-0.05, -0.55, 0.28],
  [-0.18, -0.12, 0.08],
  // 베이스를 한 바퀴(뒤로 돌아 오른쪽으로)
  [-0.62, 0.0, -0.06],
  [-0.05, 0.12, -0.3],
  [0.6, 0.0, -0.06],
  // 오른쪽 뿔 바깥
  [0.82, 0.22, 0.02],
  // 8자 첫 대각: 오른쪽 뿔 → 윗면 가로질러 → 왼쪽 뿔 (앞쪽, z 큼 = 위로 지나감)
  [0.42, 0.44, 0.22],
  [0.0, 0.48, 0.24],
  [-0.42, 0.44, 0.22],
  [-0.82, 0.26, 0.05],
  // 왼쪽 뿔 감기(바깥→아래→뒤)
  [-0.92, 0.08, -0.12],
  [-0.5, 0.02, -0.2],
  [-0.18, 0.14, -0.16],
  // 8자 둘째 대각: 왼쪽 → 오른쪽 (뒤쪽, z 작음 = 첫 대각 아래로 지나며 X)
  [-0.1, 0.4, 0.04],
  [0.0, 0.44, 0.03],
  [0.32, 0.4, 0.04],
  [0.78, 0.24, 0.0],
  // 오른쪽 뿔 감기
  [0.92, 0.08, -0.12],
  [0.55, 0.04, -0.18],
  // 잠금 히치: 마지막 대각 아래로 끝을 끼움
  [0.28, 0.22, 0.18],
  [0.05, 0.34, 0.22],
  [-0.15, 0.52, 0.5],
];

export const cleatHitch: Knot = {
  id: "cleat-hitch",
  builtinRevision: 2,
  name: "Cleat Hitch",
  blurb: "도크라인을 혼 클리트에 고정하는 표준 방법. 하중을 받아도 안 풀리고 빠르게 푼다.",
  difficulty: 2,
  path,
  ropeColor: "#5bb98c", // standing part
  ropeColorB: "#e0584b", // working end
  colorSplitIndex: 6,
  ropeRadius: 0.062,
  object: { kind: "cleat", scale: 1 },
  defaultStepDuration: 1.3,
  // 곧은 줄은 클리트 앞 아래쪽에 수평으로 놓고, standing(앞부분)부터 형성.
  layCenter: [0, -0.2, 0.7],
  steps: [
    { id: "base", title: "Round the base", instruction: "도크라인을 클리트 먼 쪽 베이스에 한 바퀴 감는다.", reveal: 0.3 },
    { id: "fig8a", title: "First figure-eight", instruction: "한 뿔 위로 올려 반대 뿔로 대각선 8자를 만든다.", reveal: 0.58 },
    { id: "fig8b", title: "Second figure-eight", instruction: "되돌아오며 두 번째 대각을 만들어 X 자로 교차시킨다.", reveal: 0.82 },
    { id: "lock", title: "Locking hitch", instruction: "마지막에 뒤집은 반바퀴(locking hitch)로 끝을 끼워 잠근다.", reveal: 1 },
  ],
};
