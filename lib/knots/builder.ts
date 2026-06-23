// 매듭 중심선(path) 저작용 기하 헬퍼.
// 직선/원호/나선/파라메트릭 샘플을 이어붙여 제어점 배열을 만든다.
// Rope 가 CatmullRom 으로 보간하므로 여기서는 "굵직한" 제어점만 제공하면 된다.
//
// 좌표 규약: x = 좌(-)/우(+), y = 하(-)/상(+), z = 뒤(-)/앞(+, 화면 쪽).
// over/under 를 분명히 하려면 교차점 부근 점의 z 를 로프 반경의 2배 이상 벌린다.

import type { Vec3 } from "./types";

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];

/** 두 점을 잇는 직선 위 n개 점(양 끝 포함). */
export function line(from: Vec3, to: Vec3, n: number): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    out.push([
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
      from[2] + (to[2] - from[2]) * t,
    ]);
  }
  return out;
}

/**
 * 평면 원호. center 중심, 반경 r, plane 축에서 a0→a1(라디안) 회전.
 * plane="xy": z 고정. "xz": y 고정. "yz": x 고정.
 */
export function arc(
  center: Vec3,
  r: number,
  a0: number,
  a1: number,
  n: number,
  plane: "xy" | "xz" | "yz" = "xy"
): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const a = a0 + (a1 - a0) * t;
    const c = Math.cos(a) * r;
    const s = Math.sin(a) * r;
    if (plane === "xy") out.push([center[0] + c, center[1] + s, center[2]]);
    else if (plane === "xz") out.push([center[0] + c, center[1], center[2] + s]);
    else out.push([center[0], center[1] + c, center[2] + s]);
  }
  return out;
}

/**
 * 세로(y축) 말뚝을 감는 나선. center=말뚝 중심(x,z), 반경 r,
 * a0→a1 각도만큼 돌면서 y 를 y0→y1 로 이동.
 */
export function helixY(
  cx: number,
  cz: number,
  r: number,
  a0: number,
  a1: number,
  y0: number,
  y1: number,
  n: number
): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const a = a0 + (a1 - a0) * t;
    const y = y0 + (y1 - y0) * t;
    out.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]);
  }
  return out;
}

/** 파라메트릭 곡선 f(t) 를 t0..t1 구간에서 n개 샘플. */
export function sampleParametric(
  f: (t: number) => Vec3,
  t0: number,
  t1: number,
  n: number
): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const t = t0 + (t1 - t0) * (i / (n - 1));
    out.push(f(t));
  }
  return out;
}

/** 점 배열들을 이어붙인다. 인접 배열의 끝/시작이 같은 점이면 중복 제거. */
export function join(...segments: Vec3[][]): Vec3[] {
  const out: Vec3[] = [];
  for (const seg of segments) {
    for (const p of seg) {
      const last = out[out.length - 1];
      if (last && Math.abs(last[0] - p[0]) < 1e-9 && Math.abs(last[1] - p[1]) < 1e-9 && Math.abs(last[2] - p[2]) < 1e-9) {
        continue;
      }
      out.push(p);
    }
  }
  return out;
}

/** 전체 path 를 균일 스케일/이동. */
export function transformPath(points: Vec3[], s: number, offset: Vec3 = [0, 0, 0]): Vec3[] {
  return points.map((p) => [p[0] * s + offset[0], p[1] * s + offset[1], p[2] * s + offset[2]]);
}
