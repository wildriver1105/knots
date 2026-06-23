// Figure-eight (stopper) knot.
// 수학적 figure-eight 매듭(4_1)의 표준 파라메트릭을 살짝 열어(gap) 두 가닥 끝을 만든다.
// 위상이 정확하고 over/under(z=sin4t)가 자연스러워 학습용으로 깔끔하다.

import type { Knot, Vec3 } from "../types";
import { sampleParametric, line, join } from "../builder";

const SCALE_XY = 0.46;
const SCALE_Z = 0.22; // z 깊이 — 로프 반경(0.07)의 ~3배 이상이라 교차가 또렷하다.

function f(t: number): Vec3 {
  const r = 2 + Math.cos(2 * t);
  return [r * Math.cos(3 * t) * SCALE_XY, r * Math.sin(3 * t) * SCALE_XY, Math.sin(4 * t) * SCALE_Z];
}

const GAP = 0.34;
const core = sampleParametric(f, GAP, 2 * Math.PI - GAP, 96);

// 양 끝에 직선 꼬리를 덧대 "로프 끝"처럼 보이게 한다(끝점 접선 방향 외삽).
function extend(a: Vec3, b: Vec3, len: number, n: number): Vec3[] {
  const d: Vec3 = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const m = Math.hypot(d[0], d[1], d[2]) || 1;
  const end: Vec3 = [a[0] + (d[0] / m) * len, a[1] + (d[1] / m) * len, a[2] + (d[2] / m) * len];
  return line(end, a, n); // 끝 → 코어 시작 방향
}

const headTail = extend(core[0], core[1], 0.55, 10); // 시작 꼬리(끝 → core[0])
const footTail = extend(core[core.length - 1], core[core.length - 2], 0.55, 10).reverse(); // core 끝 → 꼬리

const path = join(headTail, core, footTail);

export const figureEight: Knot = {
  id: "figure-eight",
  name: "Figure-Eight",
  blurb:
    "기본 멈춤 매듭(stopper). 로프가 블록·페어리드를 빠져나가지 않게 끝에 묶는다. 풀기 쉽고 절대 엉키지 않는다.",
  difficulty: 1,
  path,
  ropeColor: "#e0584b", // working end (빨강)
  ropeColorB: "#f3c14a", // standing part (노랑)
  colorSplitIndex: Math.floor(path.length * 0.52),
  ropeRadius: 0.07,
  object: { kind: "none" },
  defaultStepDuration: 1.4,
  steps: [
    {
      id: "start",
      title: "Standing part",
      instruction: "한 손으로 standing part(고정된 줄)를 잡고 working end(작업 끝)를 여유 있게 둔다.",
      reveal: 0.14,
    },
    {
      id: "cross",
      title: "Cross over",
      instruction: "working end 를 standing part 위로 교차시켜 첫 고리를 만든다.",
      reveal: 0.4,
    },
    {
      id: "around",
      title: "Around behind",
      instruction: "끝을 standing part 뒤로 돌려 8자 모양의 두 번째 굽이를 만든다.",
      reveal: 0.66,
    },
    {
      id: "through",
      title: "Through the loop",
      instruction: "working end 를 처음 만든 고리 안으로 통과시켜 내린다.",
      reveal: 0.88,
    },
    {
      id: "dress",
      title: "Dress & tighten",
      instruction: "양쪽 끝을 당겨 매듭을 정돈하고 조인다. 깔끔한 8자 멈춤 매듭 완성.",
      reveal: 1,
    },
  ],
};
