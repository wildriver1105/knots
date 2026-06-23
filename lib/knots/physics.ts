// 가벼운 verlet 로프 솔버(다중 가닥 + 자기충돌).
//
// 매 프레임 "목표 형태(targets)"가 주어진다(올바른 매듭). 시뮬 점들은:
//  (1) 중력으로 처지고(자유 끝일수록 강하게),
//  (2) 목표로 스프링처럼 당겨지고(soft — 매듭이 풀리지 않게),
//  (3) 같은 가닥 내 이웃 거리(로프 비신축)를 유지하고,
//  (4) 모든 점끼리 2*radius 보다 가까우면 서로 밀어낸다(자기충돌 → 가닥이 통과하지 않음).

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

export class RopeSolver {
  pos: Vec3[] = [];
  prev: Vec3[] = [];
  endWeight: number[] = [];
  strands: StrandRange[] = [];
  radius: number;
  private signature = "";

  constructor(radius: number) {
    this.radius = radius;
  }

  private sigOf(targets: Vec3[][]): string {
    return targets.map((t) => t.length).join(",");
  }

  /** 가닥 구성이 바뀌면 목표로 초기화. */
  private ensure(targets: Vec3[][]) {
    const sig = this.sigOf(targets);
    if (sig === this.signature) return;
    this.signature = sig;
    this.pos = [];
    this.prev = [];
    this.endWeight = [];
    this.strands = [];
    let idx = 0;
    for (const t of targets) {
      this.strands.push({ start: idx, count: t.length });
      for (let i = 0; i < t.length; i++) {
        this.pos.push([t[i][0], t[i][1], t[i][2]]);
        this.prev.push([t[i][0], t[i][1], t[i][2]]);
        const u = t.length > 1 ? i / (t.length - 1) : 0;
        const nearEnd = Math.min(u, 1 - u);
        this.endWeight.push(Math.max(0, 1 - nearEnd / 0.22));
      }
      idx += t.length;
    }
  }

  snap(targets: Vec3[][]) {
    this.signature = "";
    this.ensure(targets);
  }

  step(targets: Vec3[][], dt: number, opts: SolverOpts): Vec3[][] {
    this.ensure(targets);
    const flatTarget: Vec3[] = [];
    for (const t of targets) for (const p of t) flatTarget.push(p);

    const h = Math.min(dt, 0.033);
    const g = opts.gravity * h * h;
    const N = this.pos.length;

    // 적분 + 중력
    for (let i = 0; i < N; i++) {
      const p = this.pos[i];
      const pr = this.prev[i];
      const vx = (p[0] - pr[0]) * opts.damping;
      const vy = (p[1] - pr[1]) * opts.damping;
      const vz = (p[2] - pr[2]) * opts.damping;
      this.prev[i] = [p[0], p[1], p[2]];
      this.pos[i] = [p[0] + vx, p[1] + vy - g * this.endWeight[i], p[2] + vz];
    }

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
    }

    // 자기충돌: 모든 점쌍, 같은 가닥 인접(±SKIP)은 제외.
    const minDist = this.radius * 2 * 0.92;
    const minSq = minDist * minDist;
    const SKIP = 3;
    for (let it = 0; it < opts.collisionIterations; it++) {
      for (let i = 0; i < N; i++) {
        const a = this.pos[i];
        for (let j = i + 1; j < N; j++) {
          // 같은 가닥에서 가까운 이웃은 건너뜀(자연스러운 곡률 유지)
          if (this.sameStrandClose(i, j, SKIP)) continue;
          const b = this.pos[j];
          const dx = b[0] - a[0];
          const dy = b[1] - a[1];
          const dz = b[2] - a[2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= minSq || d2 < 1e-9) continue;
          const d = Math.sqrt(d2);
          const push = ((minDist - d) / d) * 0.5;
          const px = dx * push;
          const py = dy * push;
          const pz = dz * push;
          a[0] -= px;
          a[1] -= py;
          a[2] -= pz;
          b[0] += px;
          b[1] += py;
          b[2] += pz;
        }
      }
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

  private sameStrandClose(i: number, j: number, skip: number): boolean {
    for (const s of this.strands) {
      const inS = i >= s.start && i < s.start + s.count;
      const jnS = j >= s.start && j < s.start + s.count;
      if (inS && jnS) return Math.abs(i - j) <= skip;
      if (inS || jnS) return false;
    }
    return false;
  }
}
