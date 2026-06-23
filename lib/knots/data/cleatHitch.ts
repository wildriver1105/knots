// Cleat hitch — 혼 클리트에 도크라인을 매는 방법.
// 베이스를 한 바퀴 돈 뒤 두 뿔(horn)에 8자(figure-eight)로 감고 마지막에 잠금 히치.
// 클리트는 x축 방향 가로 배치, 뿔은 x=±0.7. 위(+y)가 클리트 윗면.

import type { Knot, Vec3 } from "../types";
import { line, join } from "../builder";

// 윗면 교차(X)는 z 깊이로 분리: 위로 지나가는 가닥 z 크게, 아래는 작게.
const path: Vec3[] = join(
  // standing part: 아래에서 올라와 베이스 앞으로
  line([0.0, -1.8, 0.55], [0.0, -0.25, 0.18], 10),
  // 베이스 뒤로 한 바퀴(turn): 오른쪽으로 돌아 뒤(-z)를 지나 왼쪽 위로
  line([0.0, -0.25, 0.18], [0.55, -0.05, -0.25], 5),
  line([0.55, -0.05, -0.25], [-0.55, 0.05, -0.25], 6),
  line([-0.55, 0.05, -0.25], [-0.62, 0.18, 0.05], 4),
  // 1번째 8자: 왼쪽 뿔 위 → 오른쪽 뿔 목 아래
  line([-0.62, 0.18, 0.05], [-0.55, 0.5, 0.22], 4), // 왼 뿔 위로(over)
  line([-0.55, 0.5, 0.22], [0.55, 0.5, 0.06], 8), // 윗면 대각 교차(앞쪽)
  line([0.55, 0.5, 0.06], [0.82, 0.2, -0.05], 4), // 오른 뿔 감기
  line([0.82, 0.2, -0.05], [0.45, 0.05, -0.2], 5), // 오른 뿔 목 아래(under)
  // 2번째 8자: 오른쪽에서 왼쪽 뿔로 되돌아 X 완성
  line([0.45, 0.05, -0.2], [0.55, 0.46, 0.2], 4),
  line([0.55, 0.46, 0.2], [-0.55, 0.46, 0.05], 8), // 두 번째 대각(첫 대각과 교차)
  line([-0.55, 0.46, 0.05], [-0.82, 0.22, -0.05], 4),
  // 잠금 히치: 마지막 가닥 아래로 끼워 고정하고 끝을 빼냄
  line([-0.82, 0.22, -0.05], [-0.45, 0.32, 0.16], 5),
  line([-0.45, 0.32, 0.16], [-0.2, 0.62, 0.5], 8)
);

export const cleatHitch: Knot = {
  id: "cleat-hitch",
  name: "Cleat Hitch",
  blurb: "도크라인을 혼 클리트에 고정하는 표준 방법. 하중을 받아도 안 풀리고 빠르게 푼다.",
  difficulty: 2,
  path,
  ropeColor: "#5bb98c",
  ropeColorB: "#f3c14a",
  colorSplitIndex: Math.floor(path.length * 0.4),
  ropeRadius: 0.065,
  object: { kind: "cleat", scale: 1 },
  defaultStepDuration: 1.3,
  steps: [
    { id: "base", title: "Round the base", instruction: "도크라인을 클리트 먼 쪽 베이스에 한 바퀴 감는다.", reveal: 0.32 },
    { id: "fig8a", title: "First figure-eight", instruction: "한 뿔 위로 올려 반대 뿔로 대각선 8자를 만든다.", reveal: 0.6 },
    { id: "fig8b", title: "Second figure-eight", instruction: "되돌아오며 두 번째 대각을 만들어 X 자로 교차시킨다.", reveal: 0.82 },
    { id: "lock", title: "Locking hitch", instruction: "마지막에 뒤집은 반바퀴(locking hitch)로 끝을 끼워 잠근다.", reveal: 1 },
  ],
};
