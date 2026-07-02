// 무상태(stateless) 겹침 분리 — 렌더 직전에 보간 결과의 관통만 밀어낸다.
//
// 과거의 실시간 RopeSolver(Verlet, 관성·누적 상태)는 폭발/구슬의 원인이라 렌더에서 금지다.
// 이 모듈은 그것과 다르다: 매 프레임 "같은 입력 → 같은 출력"인 순수 함수로,
// 속도/이전 프레임 상태가 전혀 없고 보정량이 클램프되어 발산이 불가능하다.
// (Laplacian 스무딩과 같은 급의 화장(cosmetic) 후처리다.)
//
// 하는 일: ① 가닥-가닥(자기 자신 포함, 이웃 세그먼트 스킵) 최소거리 확보 ② 말뚝/클리트 캡슐 밖으로 밀어냄.

import type { Vec3 } from "./types";
import type { CapsuleCollider } from "./physics";

const dot = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) =>
  ax * bx + ay * by + az * bz;

/** 두 세그먼트(p1p2, q1q2)의 최근접 파라미터 s,t (0..1). */
function closestSegSeg(p1: Vec3, p2: Vec3, q1: Vec3, q2: Vec3): { s: number; t: number } {
  const dx1 = p2[0] - p1[0], dy1 = p2[1] - p1[1], dz1 = p2[2] - p1[2];
  const dx2 = q2[0] - q1[0], dy2 = q2[1] - q1[1], dz2 = q2[2] - q1[2];
  const rx = p1[0] - q1[0], ry = p1[1] - q1[1], rz = p1[2] - q1[2];
  const a = dot(dx1, dy1, dz1, dx1, dy1, dz1);
  const e = dot(dx2, dy2, dz2, dx2, dy2, dz2);
  const f = dot(dx2, dy2, dz2, rx, ry, rz);
  let s = 0, t = 0;
  if (a <= 1e-12 && e <= 1e-12) return { s, t };
  if (a <= 1e-12) {
    t = Math.min(1, Math.max(0, f / e));
  } else {
    const c = dot(dx1, dy1, dz1, rx, ry, rz);
    if (e <= 1e-12) {
      s = Math.min(1, Math.max(0, -c / a));
    } else {
      const b = dot(dx1, dy1, dz1, dx2, dy2, dz2);
      const denom = a * e - b * b;
      s = denom > 1e-12 ? Math.min(1, Math.max(0, (b * f - c * e) / denom)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
      else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    }
  }
  return { s, t };
}

/**
 * 가닥들의 관통을 밀어내 분리한 사본을 돌려준다(입력 불변). 순수·결정론·클램프.
 * - minDist = ropeRadius*1.9 (닿을락 말락까지만 분리 — 과분리로 모양 왜곡 방지)
 * - 자기 가닥은 인접 세그먼트(호 길이 기준)를 스킵해 굽은 구간을 잘못 밀지 않는다.
 */
export function depenetrate(
  strands: Vec3[][],
  ropeRadius: number,
  colliders: CapsuleCollider[] = [],
  iterations = 2
): Vec3[][] {
  const out = strands.map((pts) => pts.map((p) => [p[0], p[1], p[2]] as Vec3));
  const minDist = ropeRadius * 1.9;
  const maxPush = ropeRadius * 0.6; // 반복당 보정 상한(발산 불가)

  // 자기충돌 이웃 스킵: 평균 세그먼트 길이 기준으로 로프 지름 ~3배 이내 이웃은 제외.
  const skips = out.map((pts) => {
    let len = 0;
    for (let i = 1; i < pts.length; i++)
      len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
    const avg = len / Math.max(1, pts.length - 1);
    return Math.max(2, Math.ceil((ropeRadius * 6) / Math.max(avg, 1e-6)));
  });

  const pushPair = (A: Vec3[], i: number, B: Vec3[], j: number) => {
    const { s, t } = closestSegSeg(A[i], A[i + 1], B[j], B[j + 1]);
    const px = A[i][0] + (A[i + 1][0] - A[i][0]) * s;
    const py = A[i][1] + (A[i + 1][1] - A[i][1]) * s;
    const pz = A[i][2] + (A[i + 1][2] - A[i][2]) * s;
    const qx = B[j][0] + (B[j + 1][0] - B[j][0]) * t;
    const qy = B[j][1] + (B[j + 1][1] - B[j][1]) * t;
    const qz = B[j][2] + (B[j + 1][2] - B[j][2]) * t;
    let nx = px - qx, ny = py - qy, nz = pz - qz;
    const d = Math.hypot(nx, ny, nz);
    if (d >= minDist) return;
    if (d < 1e-6) { nx = 0; ny = 0; nz = 1; } else { nx /= d; ny /= d; nz /= d; }
    const push = Math.min(maxPush, (minDist - d) * 0.5);
    // 최근접점 가중으로 세그먼트 양 끝점에 분배(끝점 고정 없음 — 형태는 스무딩이 정리).
    const wA0 = (1 - s) * push, wA1 = s * push;
    const wB0 = (1 - t) * push, wB1 = t * push;
    A[i][0] += nx * wA0; A[i][1] += ny * wA0; A[i][2] += nz * wA0;
    A[i + 1][0] += nx * wA1; A[i + 1][1] += ny * wA1; A[i + 1][2] += nz * wA1;
    B[j][0] -= nx * wB0; B[j][1] -= ny * wB0; B[j][2] -= nz * wB0;
    B[j + 1][0] -= nx * wB1; B[j + 1][1] -= ny * wB1; B[j + 1][2] -= nz * wB1;
  };

  for (let it = 0; it < iterations; it++) {
    // ① 가닥-가닥
    for (let a = 0; a < out.length; a++) {
      for (let b = a; b < out.length; b++) {
        const A = out[a], B = out[b];
        for (let i = 0; i < A.length - 1; i++) {
          const jStart = a === b ? i + skips[a] : 0;
          for (let j = jStart; j < B.length - 1; j++) pushPair(A, i, B, j);
        }
      }
    }
    // ② 캡슐(말뚝/클리트) 밖으로
    for (const cap of colliders) {
      const ax = cap.a[0], ay = cap.a[1], az = cap.a[2];
      const bx = cap.b[0] - ax, by = cap.b[1] - ay, bz = cap.b[2] - az;
      const len2 = bx * bx + by * by + bz * bz;
      const keep = cap.radius + ropeRadius * 0.98;
      for (const pts of out) {
        for (const p of pts) {
          const t = len2 > 1e-12
            ? Math.min(1, Math.max(0, ((p[0] - ax) * bx + (p[1] - ay) * by + (p[2] - az) * bz) / len2))
            : 0;
          const cx = ax + bx * t, cy = ay + by * t, cz = az + bz * t;
          let nx = p[0] - cx, ny = p[1] - cy, nz = p[2] - cz;
          const d = Math.hypot(nx, ny, nz);
          if (d >= keep) continue;
          if (d < 1e-6) { nx = 0; ny = 0; nz = 1; } else { nx /= d; ny /= d; nz /= d; }
          const push = Math.min(maxPush, keep - d);
          p[0] += nx * push; p[1] += ny * push; p[2] += nz * push;
        }
      }
    }
  }
  return out;
}
