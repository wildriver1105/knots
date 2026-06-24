// 가벼운 verlet 로프 솔버(다중 가닥 + 자기충돌).
//
// 매 프레임 "목표 형태(targets)"가 주어진다(올바른 매듭). 시뮬 점들은:
//  (1) 중력으로 처지고(자유 끝일수록 강하게),
//  (2) 목표로 스프링처럼 당겨지고(soft — 매듭이 풀리지 않게),
//  (3) 같은 가닥 내 이웃 거리(로프 비신축)를 유지하고,
//  (4) 모든 점끼리 2*radius 보다 가까우면 서로 밀어낸다(자기충돌 → 가닥이 통과하지 않음).

import * as THREE from "three";
import type { Vec3 } from "./types";

export interface SolverOpts {
  gravity: number;
  damping: number;
  spring: number;
  iterations: number;
  collisionIterations: number;
}

interface StrandRange {
  start: number;
  count: number;
}

const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/**
 * 매끄러운 CatmullRom(centripetal) 곡선을 따라 호 길이 균일 간격 count개 점으로 리샘플.
 * (직선 보간이면 제어 다각형을 따라가 각져 보임 → 렌더와 동일한 곡선에서 샘플해야 매끈하다.)
 */
function resampleUniform(points: Vec3[], count: number): Vec3[] {
  const n = points.length;
  if (n === 0) return [];
  if (n === 1 || count <= 1) return Array.from({ length: Math.max(1, count) }, () => [...points[0]] as Vec3);
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    false,
    "centripetal"
  );
  const spaced = curve.getSpacedPoints(count - 1); // count 개 반환
  return spaced.map((v) => [v.x, v.y, v.z] as Vec3);
}

function arcLength(points: Vec3[]): number {
  let s = 0;
  for (let i = 1; i < points.length; i++) s += dist3(points[i], points[i - 1]);
  return s;
}

// 솔버는 "성긴 제어점"이 아니라 균일하게 촘촘히 리샘플한 점에서 시뮬레이션한다.
// → 자기충돌이 튜브 관통을 실제로 막고, 장력이 연속 줄처럼 전파된다.
export class RopeSolver {
  pos: Vec3[] = [];
  prev: Vec3[] = [];
  strands: StrandRange[] = [];
  radius: number;
  private denseCounts: number[] = [];
  private signature = "";

  constructor(radius: number) {
    this.radius = radius;
  }

  /** 가닥별 촘촘한 점 개수 = 호 길이 / (반경*1.5), 10..140 사이. */
  private denseCountFor(points: Vec3[]): number {
    const spacing = this.radius * 1.5;
    return Math.max(10, Math.min(140, Math.round(arcLength(points) / spacing)));
  }

  private sigOf(targets: Vec3[][]): string {
    return targets.map((t) => t.length).join(",");
  }

  /** 입력 가닥 구성(점 개수)이 바뀌면 dense 카운트 재계산 후 초기화. */
  private ensure(targets: Vec3[][]) {
    const sig = this.sigOf(targets);
    if (sig === this.signature) return;
    this.signature = sig;
    this.pos = [];
    this.prev = [];
    this.strands = [];
    this.denseCounts = targets.map((t) => this.denseCountFor(t));
    let idx = 0;
    targets.forEach((t, si) => {
      const dc = this.denseCounts[si];
      const dense = resampleUniform(t, dc);
      this.strands.push({ start: idx, count: dc });
      for (const p of dense) {
        this.pos.push([p[0], p[1], p[2]]);
        this.prev.push([p[0], p[1], p[2]]);
      }
      idx += dc;
    });
  }

  snap(targets: Vec3[][]) {
    this.signature = "";
    this.ensure(targets);
  }

  step(targets: Vec3[][], dt: number, opts: SolverOpts): Vec3[][] {
    this.ensure(targets);
    // 목표도 dense 로 리샘플(시뮬 점과 1:1 대응).
    const flatTarget: Vec3[] = [];
    targets.forEach((t, si) => {
      const dense = resampleUniform(t, this.denseCounts[si]);
      for (const p of dense) flatTarget.push(p);
    });

    const N = this.pos.length;

    // 적분(중력 없음 — verlet 관성/감쇠만 → 자연스러운 따라붙음).
    for (let i = 0; i < N; i++) {
      const p = this.pos[i];
      const pr = this.prev[i];
      const vx = (p[0] - pr[0]) * opts.damping;
      const vy = (p[1] - pr[1]) * opts.damping;
      const vz = (p[2] - pr[2]) * opts.damping;
      this.prev[i] = [p[0], p[1], p[2]];
      this.pos[i] = [p[0] + vx, p[1] + vy, p[2] + vz];
    }

    const minDist = this.radius * 2;
    for (let it = 0; it < opts.iterations; it++) {
      // 목표 스프링
      for (let i = 0; i < N; i++) {
        const p = this.pos[i];
        const t = flatTarget[i];
        p[0] += (t[0] - p[0]) * opts.spring;
        p[1] += (t[1] - p[1]) * opts.spring;
        p[2] += (t[2] - p[2]) * opts.spring;
      }
      // 이웃 거리(가닥 내부) — 목표 세그먼트 길이로 보정
      for (const s of this.strands) {
        for (let k = 0; k < s.count - 1; k++) {
          const ia = s.start + k;
          const ib = ia + 1;
          const a = this.pos[ia];
          const b = this.pos[ib];
          const tx = flatTarget[ib][0] - flatTarget[ia][0];
          const ty = flatTarget[ib][1] - flatTarget[ia][1];
          const tz = flatTarget[ib][2] - flatTarget[ia][2];
          const rest = Math.hypot(tx, ty, tz);
          const dx = b[0] - a[0];
          const dy = b[1] - a[1];
          const dz = b[2] - a[2];
          const dl = Math.hypot(dx, dy, dz) || 1e-6;
          const diff = (dl - rest) / dl / 2;
          a[0] += dx * diff;
          a[1] += dy * diff;
          a[2] += dz * diff;
          b[0] -= dx * diff;
          b[1] -= dy * diff;
          b[2] -= dz * diff;
        }
      }
      // 자기충돌 — 반복 루프에 끼워넣어 스프링과 균형을 이루게(끝에서 한 번보다 효과적).
      collideAll(this.pos, this.strands, minDist, 2);
    }

    // 가닥별로 분리해 반환
    const out: Vec3[][] = this.strands.map((s) => {
      const arr: Vec3[] = new Array(s.count);
      for (let k = 0; k < s.count; k++) {
        const p = this.pos[s.start + k];
        arr[k] = [p[0], p[1], p[2]];
      }
      return arr;
    });
    return out;
  }
}

// ── 충돌/이완 헬퍼(클래스 밖, 에디터에서도 재사용) ──

function inStrandClose(strands: { start: number; count: number }[], i: number, j: number, skip: number): boolean {
  for (const s of strands) {
    const inS = i >= s.start && i < s.start + s.count;
    const jnS = j >= s.start && j < s.start + s.count;
    if (inS && jnS) return Math.abs(i - j) <= skip;
    if (inS || jnS) return false;
  }
  return false;
}

/** 모든 점쌍이 minDist 보다 가까우면 밀어낸다(같은 가닥 인접 ±skip 제외). pos 를 제자리 수정. */
function collideAll(pos: Vec3[], strands: { start: number; count: number }[], minDist: number, skip: number): void {
  const minSq = minDist * minDist;
  const N = pos.length;
  for (let i = 0; i < N; i++) {
    const a = pos[i];
    for (let j = i + 1; j < N; j++) {
      if (inStrandClose(strands, i, j, skip)) continue;
      const b = pos[j];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const dz = b[2] - a[2];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= minSq || d2 < 1e-9) continue;
      const d = Math.sqrt(d2);
      const push = ((minDist - d) / d) * 0.5;
      a[0] -= dx * push;
      a[1] -= dy * push;
      a[2] -= dz * push;
      b[0] += dx * push;
      b[1] += dy * push;
      b[2] += dz * push;
    }
  }
}

/**
 * 한 가닥(에디터 포즈)을 "물리 정리": 전체 모양은 약한 스프링으로 유지하고, 줄 길이(비신축)와
 * 자기충돌을 강하게 적용해 겹친 가닥을 접촉 거리까지 밀어낸다. 결과 점 배열 반환(원본 불변).
 */
export function relaxPoints(points: Vec3[], radius: number, iterations = 60): Vec3[] {
  const n = points.length;
  if (n < 3) return points.map((p) => [p[0], p[1], p[2]] as Vec3);
  const pos: Vec3[] = points.map((p) => [p[0], p[1], p[2]] as Vec3);
  const orig: Vec3[] = points.map((p) => [p[0], p[1], p[2]] as Vec3);
  const rest: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    rest.push(Math.hypot(orig[i + 1][0] - orig[i][0], orig[i + 1][1] - orig[i][1], orig[i + 1][2] - orig[i][2]));
  }
  const minDist = radius * 2;
  const strands = [{ start: 0, count: n }];
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < n; i++) {
      pos[i][0] += (orig[i][0] - pos[i][0]) * 0.05;
      pos[i][1] += (orig[i][1] - pos[i][1]) * 0.05;
      pos[i][2] += (orig[i][2] - pos[i][2]) * 0.05;
    }
    for (let i = 0; i < n - 1; i++) {
      const a = pos[i];
      const b = pos[i + 1];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const dz = b[2] - a[2];
      const dl = Math.hypot(dx, dy, dz) || 1e-6;
      const diff = (dl - rest[i]) / dl / 2;
      a[0] += dx * diff;
      a[1] += dy * diff;
      a[2] += dz * diff;
      b[0] -= dx * diff;
      b[1] -= dy * diff;
      b[2] -= dz * diff;
    }
    collideAll(pos, strands, minDist, 3);
  }
  return pos;
}
