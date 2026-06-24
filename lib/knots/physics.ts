// 위치 기반(PBD) 로프 솔버.
// - Verlet 적분으로 관성·중력
// - 1/2차 거리 제약으로 비신축성과 굽힘 저항
// - 선분-선분 캡슐 충돌로 샘플 점 사이의 관통까지 방지
// - 말뚝/클리트를 캡슐 콜라이더로 근사해 로프가 물체를 통과하지 않게 함
// - 끝점은 강하게, 내부는 부드럽게 목표 포즈를 따라가므로 당김이 줄 전체로 전달됨

import * as THREE from "three";
import type { Knot, KnotObjectDef, Vec3 } from "./types";

export interface SolverOpts {
  gravity: number;
  damping: number;
  spring: number;
  iterations: number;
  collisionIterations: number;
  tension?: number;
  bendStiffness?: number;
  endpointPinning?: number;
}

export interface CapsuleCollider {
  kind: "capsule";
  a: Vec3;
  b: Vec3;
  radius: number;
}

interface StrandRange {
  start: number;
  count: number;
}

interface SegmentRef {
  a: number;
  b: number;
  strand: number;
  local: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function resampleUniform(points: Vec3[], count: number): Vec3[] {
  if (!points.length) return [];
  if (points.length === 1 || count <= 1) {
    return Array.from({ length: Math.max(1, count) }, () => [...points[0]] as Vec3);
  }
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    false,
    "centripetal"
  );
  return curve.getSpacedPoints(count - 1).map((v) => [v.x, v.y, v.z] as Vec3);
}

function arcLength(points: Vec3[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += dist3(points[i - 1], points[i]);
  return length;
}

function closestOnSegment(p: Vec3, a: Vec3, b: Vec3): { point: Vec3; t: number } {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const abz = b[2] - a[2];
  const den = abx * abx + aby * aby + abz * abz || 1;
  const t = clamp01(((p[0] - a[0]) * abx + (p[1] - a[1]) * aby + (p[2] - a[2]) * abz) / den);
  return { point: [a[0] + abx * t, a[1] + aby * t, a[2] + abz * t], t };
}

/** 두 선분의 최근접점 파라미터. Real-Time Collision Detection의 안정적인 clamp 형태. */
function closestSegments(p1: Vec3, q1: Vec3, p2: Vec3, q2: Vec3): { s: number; t: number; d: Vec3; distance: number } {
  const d1: Vec3 = [q1[0] - p1[0], q1[1] - p1[1], q1[2] - p1[2]];
  const d2: Vec3 = [q2[0] - p2[0], q2[1] - p2[1], q2[2] - p2[2]];
  const r: Vec3 = [p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]];
  const a = d1[0] ** 2 + d1[1] ** 2 + d1[2] ** 2;
  const e = d2[0] ** 2 + d2[1] ** 2 + d2[2] ** 2;
  const f = d2[0] * r[0] + d2[1] * r[1] + d2[2] * r[2];
  let s = 0;
  let t = 0;
  if (a < 1e-10 && e < 1e-10) {
    // 두 선분 모두 점.
  } else if (a < 1e-10) {
    t = clamp01(f / e);
  } else {
    const c = d1[0] * r[0] + d1[1] * r[1] + d1[2] * r[2];
    if (e < 1e-10) {
      s = clamp01(-c / a);
    } else {
      const b = d1[0] * d2[0] + d1[1] * d2[1] + d1[2] * d2[2];
      const den = a * e - b * b;
      if (Math.abs(den) > 1e-10) s = clamp01((b * f - c * e) / den);
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp01(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp01((b - c) / a);
      }
    }
  }
  const c1: Vec3 = [p1[0] + d1[0] * s, p1[1] + d1[1] * s, p1[2] + d1[2] * s];
  const c2: Vec3 = [p2[0] + d2[0] * t, p2[1] + d2[1] * t, p2[2] + d2[2] * t];
  const d: Vec3 = [c2[0] - c1[0], c2[1] - c1[1], c2[2] - c1[2]];
  const distance = Math.hypot(d[0], d[1], d[2]);
  return { s, t, d, distance };
}

function solveDistance(pos: Vec3[], ia: number, ib: number, rest: number, stiffness: number): void {
  const a = pos[ia];
  const b = pos[ib];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const length = Math.hypot(dx, dy, dz) || 1e-8;
  const correction = ((length - rest) / length) * 0.5 * stiffness;
  a[0] += dx * correction;
  a[1] += dy * correction;
  a[2] += dz * correction;
  b[0] -= dx * correction;
  b[1] -= dy * correction;
  b[2] -= dz * correction;
}

function collideRopeSegments(pos: Vec3[], segments: SegmentRef[], minDist: number): void {
  for (let i = 0; i < segments.length; i++) {
    const a = segments[i];
    for (let j = i + 1; j < segments.length; j++) {
      const b = segments[j];
      if (a.strand === b.strand && Math.abs(a.local - b.local) <= 3) continue;
      const hit = closestSegments(pos[a.a], pos[a.b], pos[b.a], pos[b.b]);
      if (hit.distance >= minDist) continue;
      let nx = hit.d[0];
      let ny = hit.d[1];
      let nz = hit.d[2];
      let length = hit.distance;
      if (length < 1e-7) {
        // 완전 교차 시 이전 프레임의 임의 축보다 화면 깊이 축이 topology를 덜 뒤집는다.
        nx = 0;
        ny = 0;
        nz = 1;
        length = 1;
      }
      nx /= length;
      ny /= length;
      nz /= length;
      const penetration = (minDist - hit.distance) * 0.5;
      const wa0 = 1 - hit.s;
      const wa1 = hit.s;
      const wb0 = 1 - hit.t;
      const wb1 = hit.t;
      const total = wa0 * wa0 + wa1 * wa1 + wb0 * wb0 + wb1 * wb1 || 1;
      const move = penetration / total;
      const apply = (idx: number, weight: number, sign: number) => {
        pos[idx][0] += nx * move * weight * sign;
        pos[idx][1] += ny * move * weight * sign;
        pos[idx][2] += nz * move * weight * sign;
      };
      apply(a.a, wa0, -1);
      apply(a.b, wa1, -1);
      apply(b.a, wb0, 1);
      apply(b.b, wb1, 1);
    }
  }
}

function collideObjects(pos: Vec3[], colliders: CapsuleCollider[], ropeRadius: number): void {
  for (const p of pos) {
    for (const collider of colliders) {
      const closest = closestOnSegment(p, collider.a, collider.b).point;
      let dx = p[0] - closest[0];
      let dy = p[1] - closest[1];
      let dz = p[2] - closest[2];
      let distance = Math.hypot(dx, dy, dz);
      const minDist = collider.radius + ropeRadius;
      if (distance >= minDist) continue;
      if (distance < 1e-8) {
        dx = 1;
        dy = 0;
        dz = 0;
        distance = 1;
      }
      const push = (minDist - distance) / distance;
      p[0] += dx * push;
      p[1] += dy * push;
      p[2] += dz * push;
    }
  }
}

export function collidersForObject(object: KnotObjectDef): CapsuleCollider[] {
  if (object.kind === "none") return [];
  const origin = object.position ?? [0, 0, 0];
  if (object.kind === "pole") {
    const half = object.height * 0.5;
    const axis = object.axis ?? "y";
    const a: Vec3 = [...origin] as Vec3;
    const b: Vec3 = [...origin] as Vec3;
    const component = axis === "x" ? 0 : axis === "y" ? 1 : 2;
    a[component] -= half;
    b[component] += half;
    return [{ kind: "capsule", a, b, radius: object.radius }];
  }

  const s = object.scale ?? 1;
  const at = (p: Vec3): Vec3 => [origin[0] + p[0] * s, origin[1] + p[1] * s, origin[2] + p[2] * s];
  const out: CapsuleCollider[] = [
    { kind: "capsule", a: at([-0.75, 0.07, 0]), b: at([0.75, 0.07, 0]), radius: 0.15 * s },
  ];
  for (const dir of [-1, 1]) {
    const theta = dir * -0.5;
    const center: Vec3 = [dir * 0.78, 0.2, 0];
    const dv: Vec3 = [-Math.sin(theta) * 0.25, Math.cos(theta) * 0.25, 0];
    out.push({
      kind: "capsule",
      a: at([center[0] - dv[0], center[1] - dv[1], center[2]]),
      b: at([center[0] + dv[0], center[1] + dv[1], center[2]]),
      radius: 0.15 * s,
    });
  }
  return out;
}

export function solverOptionsForKnot(knot: Pick<Knot, "physics">, formation = 1): SolverOpts {
  const tension = clamp01(knot.physics?.tension ?? 0.72);
  const formed = clamp01(formation);
  return {
    gravity: knot.physics?.gravity ?? 0.55,
    damping: knot.physics?.damping ?? 0.92,
    spring: 0.035 + tension * 0.045,
    iterations: 8,
    collisionIterations: 3,
    tension: 0.25 + tension * (0.35 + formed * 0.4),
    bendStiffness: knot.physics?.bendStiffness ?? 0.18,
    endpointPinning: 0.72 + tension * 0.25,
  };
}

export class RopeSolver {
  pos: Vec3[] = [];
  prev: Vec3[] = [];
  strands: StrandRange[] = [];
  radius: number;
  private denseCounts: number[] = [];
  private signature = "";
  private rest: number[][] = [];
  private bendRest: number[][] = [];
  private segments: SegmentRef[] = [];

  constructor(radius: number) {
    this.radius = radius;
  }

  private denseCountFor(points: Vec3[]): number {
    return Math.max(12, Math.min(150, Math.ceil(arcLength(points) / (this.radius * 1.15))));
  }

  private ensure(targets: Vec3[][], restTargets: Vec3[][] = targets): void {
    const signature = targets.map((t) => t.length).join(",");
    if (signature === this.signature) return;
    this.signature = signature;
    this.pos = [];
    this.prev = [];
    this.strands = [];
    this.rest = [];
    this.bendRest = [];
    this.segments = [];
    this.denseCounts = restTargets.map((t) => this.denseCountFor(t));
    let start = 0;
    targets.forEach((target, strand) => {
      const count = this.denseCounts[strand];
      const dense = resampleUniform(target, count);
      const restDense = resampleUniform(restTargets[strand] ?? target, count);
      this.strands.push({ start, count });
      this.rest.push(restDense.slice(1).map((p, i) => dist3(restDense[i], p)));
      this.bendRest.push(restDense.slice(2).map((p, i) => dist3(restDense[i], p)));
      for (let i = 0; i < count; i++) {
        this.pos.push([...dense[i]] as Vec3);
        this.prev.push([...dense[i]] as Vec3);
        if (i < count - 1) this.segments.push({ a: start + i, b: start + i + 1, strand, local: i });
      }
      start += count;
    });
  }

  snap(targets: Vec3[][], restTargets: Vec3[][] = targets): void {
    this.signature = "";
    this.ensure(targets, restTargets);
  }

  step(targets: Vec3[][], dt: number, opts: SolverOpts, colliders: CapsuleCollider[] = []): Vec3[][] {
    this.ensure(targets);
    const flatTarget: Vec3[] = [];
    targets.forEach((target, strand) => flatTarget.push(...resampleUniform(target, this.denseCounts[strand])));
    const frameDt = Math.min(1 / 30, Math.max(1 / 240, dt || 1 / 60));
    const substeps = frameDt > 1 / 50 ? 2 : 1;
    const h = frameDt / substeps;
    const tension = clamp01(opts.tension ?? 0.7);
    const stretchStiffness = 0.58 + tension * 0.4;
    const bendStiffness = clamp01(opts.bendStiffness ?? 0.15) * (0.25 + tension * 0.75);
    const endPin = clamp01(opts.endpointPinning ?? 0.9);

    for (let sub = 0; sub < substeps; sub++) {
      for (let i = 0; i < this.pos.length; i++) {
        const p = this.pos[i];
        if (!Number.isFinite(p[0] + p[1] + p[2])) {
          p[0] = flatTarget[i][0];
          p[1] = flatTarget[i][1];
          p[2] = flatTarget[i][2];
          this.prev[i] = [...flatTarget[i]] as Vec3;
        }
        const old = [...p] as Vec3;
        p[0] += (p[0] - this.prev[i][0]) * opts.damping;
        p[1] += (p[1] - this.prev[i][1]) * opts.damping - opts.gravity * h * h;
        p[2] += (p[2] - this.prev[i][2]) * opts.damping;
        this.prev[i] = old;
      }

      for (let iteration = 0; iteration < opts.iterations; iteration++) {
        // 목표 포즈는 가이드일 뿐 고정 핀이 아니다. 양 끝만 강하게 잡아당긴다.
        for (let strand = 0; strand < this.strands.length; strand++) {
          const range = this.strands[strand];
          for (let local = 0; local < range.count; local++) {
            const i = range.start + local;
            const edge = clamp01(Math.max(
              1 - local / Math.max(1, range.count * 0.14),
              1 - (range.count - 1 - local) / Math.max(1, range.count * 0.14)
            ));
            const strength = opts.spring * (1 - edge) + endPin * edge * 0.34;
            this.pos[i][0] += (flatTarget[i][0] - this.pos[i][0]) * strength;
            this.pos[i][1] += (flatTarget[i][1] - this.pos[i][1]) * strength;
            this.pos[i][2] += (flatTarget[i][2] - this.pos[i][2]) * strength;
          }
          for (let local = 0; local < range.count - 1; local++) {
            solveDistance(this.pos, range.start + local, range.start + local + 1, this.rest[strand][local], stretchStiffness);
          }
          if (bendStiffness > 0) {
            for (let local = 0; local < range.count - 2; local++) {
              solveDistance(this.pos, range.start + local, range.start + local + 2, this.bendRest[strand][local], bendStiffness);
            }
          }
        }

        if (iteration >= opts.iterations - opts.collisionIterations) {
          collideRopeSegments(this.pos, this.segments, this.radius * 2.04);
          collideObjects(this.pos, colliders, this.radius);
        }
      }
    }

    return this.strands.map((range) =>
      Array.from({ length: range.count }, (_, local) => [...this.pos[range.start + local]] as Vec3)
    );
  }
}

/** 에디터의 현재 포즈를 비신축·충돌 제약으로 정리한다. */
export function relaxPoints(points: Vec3[], radius: number, iterations = 80, colliders: CapsuleCollider[] = []): Vec3[] {
  if (points.length < 3) return points.map((p) => [...p] as Vec3);
  const solver = new RopeSolver(radius);
  solver.snap([points], [points]);
  const opts: SolverOpts = {
    gravity: 0,
    damping: 0,
    spring: 0.018,
    iterations: 10,
    collisionIterations: 5,
    tension: 0.92,
    bendStiffness: 0.08,
    endpointPinning: 0.96,
  };
  let result: Vec3[][] = [points];
  for (let i = 0; i < Math.max(1, Math.ceil(iterations / opts.iterations)); i++) {
    result = solver.step([points], 1 / 60, opts, colliders);
  }
  return result[0];
}
