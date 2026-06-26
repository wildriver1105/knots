// Clove hitch — 말뚝(piling)에 매는 기본 히치.
// 두 번 감되 두 번째 바퀴가 첫 바퀴의 대각 교차 아래로 들어가 잠긴다.
// 말뚝은 세로(y축). front = +z(화면 쪽).

import type { Knot, Vec3 } from "../types";
import { helixY, line, join } from "../builder";
import { tiePoses } from "../authoring";

const RP = 0.5; // 말뚝 반경
const RR = RP + 0.085; // 로프 중심선 감김 반경

const D = (deg: number) => (deg * Math.PI) / 180;

// 들어오는 꼬리(왼쪽 아래에서 접근)
const tailIn = line([-1.85, -0.78, 0.5], [Math.cos(D(165)) * RR, -0.6, Math.sin(D(165)) * RR], 8);

// 첫 바퀴: 앞-왼쪽(165°)에서 시계방향으로 한 바퀴, 약간 상승.
const turn1 = helixY(0, 0, RR, D(165), D(165 - 360), -0.6, -0.22, 40);

// 대각 교차: 첫 바퀴를 마치고 앞면을 가로질러 위로 올라가며 두 번째 바퀴 시작점으로.
const cross = line(turn1[turn1.length - 1], [Math.cos(D(165)) * RR, 0.12, Math.sin(D(165)) * RR + 0.04], 6);

// 둘째 바퀴: 더 높은 위치에서 한 바퀴.
const turn2 = helixY(0, 0, RR, D(165), D(165 - 360), 0.12, 0.42, 40);

// 끝을 둘째 바퀴(대각선) 아래로 끼워 잠금 — 앞쪽으로 z를 살짝 키워 위로 지나가게.
const tuck = line(turn2[turn2.length - 1], [Math.cos(D(95)) * (RR + 0.04), 0.2, Math.sin(D(95)) * (RR + 0.18)], 8);
const tailOut = line(tuck[tuck.length - 1], [0.2, 0.0, RR + 0.95], 8);

const path: Vec3[] = join(tailIn, turn1, cross, turn2, tuck, tailOut);

export const cloveHitch: Knot = {
  id: "clove-hitch",
  builtinRevision: 5,
  name: "Clove Hitch",
  blurb: "말뚝·레일에 빠르게 매고 푸는 히치. 페인더/펜더를 임시로 고정할 때 흔히 쓴다.",
  difficulty: 1,
  path,
  ropeColor: "#3f8fce",
  ropeColorB: "#f3c14a",
  colorSplitIndex: Math.floor(path.length * 0.5),
  ropeRadius: 0.07,
  object: { kind: "pole", radius: RP, height: 3.4, axis: "y" },
  // 에디터의 느슨한 시작 줄도 말뚝 앞에 놓아 처음부터 물체를 관통하지 않게 한다.
  layDir: [1, 0, 0],
  layCenter: [0, -0.1, 1.0],
  defaultStepDuration: 1.4,
  // 감은 부분은 말뚝 위 제자리, 아직 안 감은 working end 는 곧게 — "줄을 따라 꿰는" 진행 포즈.
  poses: tiePoses(path, [0.38, 0.55, 0.82, 1], { reverse: false, tailDir: [0.3, -0.1, 1] }),
  steps: [
    { id: "approach", title: "First wrap", instruction: "working end 를 말뚝 뒤로 한 바퀴 감는다.", reveal: 0.38, camera: { position: [1.5, 0.3, 4.2], target: [0, -0.1, 0.35] } },
    { id: "cross", title: "Cross diagonally", instruction: "끝을 앞면에서 대각선으로 교차시켜 위로 올린다.", reveal: 0.55, camera: { position: [1.5, 0.3, 4.2], target: [0, -0.05, 0.35] } },
    { id: "second", title: "Second wrap", instruction: "한 바퀴 더 감아 첫 바퀴 위에 X 모양을 만든다.", reveal: 0.82, camera: { position: [1.4, 0.35, 4.0], target: [0, 0.0, 0.35] } },
    { id: "tuck", title: "Tuck under", instruction: "끝을 방금 만든 대각선 아래로 끼워 넣고 당겨 조인다.", reveal: 1, camera: { position: [1.3, 0.3, 3.9], target: [0, -0.05, 0.35] } },
  ],
};
