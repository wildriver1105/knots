// 로프 튜브 생성 공유 헬퍼 — Rope/EditScene/DopeScene 공통.
//
// 핵심: 투톤(두 색) 로프도 "하나의 연속 튜브"로 만들고 색만 지오메트리 그룹으로 나눈다.
// (예전엔 색 경계에서 튜브를 둘로 쪼개 그려 접선이 어긋나 꺾이거나 끊겨 보였다.)

import * as THREE from "three";
import type { Vec3 } from "@/lib/knots/types";

// 중심선 라플라시안 스무딩 — 자기충돌/저작이 만든 고주파 지그재그를 펴고 끝점은 고정.
export function smoothCenterline(points: Vec3[], passes: number, factor: number): Vec3[] {
  let out = points.map((p) => [p[0], p[1], p[2]] as Vec3);
  for (let pass = 0; pass < passes; pass++) {
    const next = out.map((p) => [p[0], p[1], p[2]] as Vec3);
    for (let i = 1; i < out.length - 1; i++) {
      next[i][0] = out[i][0] * (1 - factor) + (out[i - 1][0] + out[i + 1][0]) * 0.5 * factor;
      next[i][1] = out[i][1] * (1 - factor) + (out[i - 1][1] + out[i + 1][1]) * 0.5 * factor;
      next[i][2] = out[i][2] * (1 - factor) + (out[i - 1][2] + out[i + 1][2]) * 0.5 * factor;
    }
    out = next;
  }
  return out;
}

const RADIAL = 28;

// 실제 laid rope 의 3가닥 나선 꼬임 — 노멀맵 착시가 아니라 튜브 단면 자체를 변위시켜
// 실루엣·음영이 진짜 꼬임으로 나온다. 중심선은 그대로라 "직선인데 꼬여 보이는" 착시가 없다.
const STRANDS = 3;
const TWIST_AMP = 0.09; // 반경 대비 가닥 골 깊이
const LAY_PER_DIAMETER = 5.2; // 꼬임 1회전당 길이 ≈ 지름의 배수(실물 로프 비율)

function applyStrandTwist(geometry: THREE.TubeGeometry, curve: THREE.CatmullRomCurve3, radius: number, seg: number) {
  const pos = geometry.attributes.position;
  const arcLen = curve.getLength();
  const twists = Math.min(64, Math.max(4, Math.round(arcLen / (radius * 2 * LAY_PER_DIAMETER))));
  const ringCenter = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    curve.getPointAt(i / seg, ringCenter);
    const phase = (i / seg) * twists * Math.PI * 2;
    for (let j = 0; j <= RADIAL; j++) {
      const idx = i * (RADIAL + 1) + j;
      v.set(pos.getX(idx), pos.getY(idx), pos.getZ(idx)).sub(ringCenter);
      // TubeGeometry 의 radial 정점은 각도 균일 배치 → θ = j/RADIAL * 2π.
      const theta = (j / RADIAL) * Math.PI * 2;
      const f = 1 + TWIST_AMP * Math.cos(STRANDS * theta - phase);
      v.multiplyScalar(f).add(ringCenter);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  pos.needsUpdate = true;
}

/** 점 배열 → 하나의 매끈한 CatmullRom 튜브(겹친 점 제거로 NaN 방지) + 3가닥 꼬임 단면. */
export function buildTube(points: Vec3[], radius: number): THREE.TubeGeometry | null {
  // 결정론 모델에선 입력 점이 이미 깔끔하므로 라플라시안은 아주 약하게만(저작 점을 거의 그대로 통과).
  // 부드러운 곡선은 centripetal CatmullRom 이 책임진다. (과한 스무딩은 줄을 저작 위치에서 끌어당김.)
  const smooth = smoothCenterline(points, 1, 0.2);
  const clean: Vec3[] = [];
  for (const p of smooth) {
    const last = clean[clean.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]) > radius * 0.2) clean.push(p);
  }
  if (clean.length < 2) return null;
  const v = clean.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(v, false, "centripetal");
  const seg = Math.min(600, Math.max(64, clean.length * 5));
  const geometry = new THREE.TubeGeometry(curve, seg, radius, RADIAL, false);
  applyStrandTwist(geometry, curve, radius, seg);
  geometry.computeVertexNormals();
  return geometry;
}

/** 단색 튜브로 메시 지오메트리 교체(이전 것 dispose). */
export function setTube(mesh: THREE.Mesh | null, points: Vec3[], radius: number) {
  if (!mesh) return;
  const g = buildTube(points, radius);
  if (!g) return;
  const old = mesh.geometry;
  mesh.geometry = g;
  old?.dispose();
}

/**
 * 투톤 튜브 — 하나의 연속 튜브를 만들고 splitFraction(호 비율 0..1) 지점에서 두 머티리얼 그룹으로 나눈다.
 * mesh.material 은 [색A, 색B] 배열이어야 한다. 곡선은 끊김 없이 이어지고 색 경계만 한 링에서 전환된다.
 */
export function setTwoToneTube(mesh: THREE.Mesh | null, points: Vec3[], radius: number, splitFraction: number) {
  if (!mesh) return;
  const g = buildTube(points, radius);
  if (!g) return;
  const tubular = g.parameters.tubularSegments;
  const radial = g.parameters.radialSegments;
  const perSeg = radial * 6; // 열린 튜브: tubular 세그먼트당 인덱스 수
  const boundary = Math.max(1, Math.min(tubular - 1, Math.round(splitFraction * tubular)));
  g.clearGroups();
  g.addGroup(0, boundary * perSeg, 0);
  g.addGroup(boundary * perSeg, (tubular - boundary) * perSeg, 1);
  const old = mesh.geometry;
  mesh.geometry = g;
  old?.dispose();
}

export function setCap(mesh: THREE.Mesh | null, at: Vec3 | undefined) {
  if (!mesh || !at) return;
  mesh.position.set(at[0], at[1], at[2]);
}
