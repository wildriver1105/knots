// 도프시트(점별 키프레임) 평가 + 변환. 순수 함수 — three 부작용 없음.
//
// 각 제어점은 자체 키프레임 트랙({t, pos}[])을 갖고, 전역 시간 t(0..1)에서 독립적으로 평가된다.
// poses(스텝당 줄 전체 포즈)와 달리 점마다 다른 시점에 키프레임을 찍을 수 있다(진짜 도프시트).

import type { AnimKey, KnotAnimation, PointTrack, Vec3 } from "./types";
import { lerpVec3, smootherStep } from "./interpolate";

/** 한 트랙을 시간 t 에서 평가. 키가 1개면 정적, 양 끝은 클램프, 사이는 smootherStep 보간. */
export function sampleTrack(track: PointTrack, t: number): Vec3 {
  const keys = track.keys;
  if (!keys || keys.length === 0) return [0, 0, 0];
  if (keys.length === 1 || t <= keys[0].t) return [...keys[0].pos] as Vec3;
  const last = keys[keys.length - 1];
  if (t >= last.t) return [...last.pos] as Vec3;
  let i = 1;
  while (i < keys.length && keys[i].t < t) i++;
  const a = keys[i - 1];
  const b = keys[i];
  const span = b.t - a.t || 1;
  return lerpVec3(a.pos, b.pos, smootherStep((t - a.t) / span));
}

/** 전체 애니메이션을 시간 t 에서 평가 → 제어점 배열(길이 = tracks.length). */
export function sampleAnimation(anim: KnotAnimation, t: number): Vec3[] {
  return anim.tracks.map((tr) => sampleTrack(tr, t));
}

/** 최종(t=1) 포즈 — path 동기화용. */
export function finalPoseOfAnimation(anim: KnotAnimation): Vec3[] {
  return sampleAnimation(anim, 1);
}

/**
 * poses(스텝당 포즈) → 점별 트랙. 각 점이 모든 스텝 시각에 키를 갖는다.
 * times 미지정 시 균등(i/(K-1)). 도프시트 진입 시 기존 poses 를 시드하는 데 쓴다.
 */
export function animationFromPoses(poses: Vec3[][], times?: number[]): KnotAnimation {
  const K = poses.length;
  if (K === 0) return { tracks: [] };
  const ts = times ?? poses.map((_, i) => (K > 1 ? i / (K - 1) : 1));
  const N = poses[0].length;
  const tracks: PointTrack[] = [];
  for (let p = 0; p < N; p++) {
    const keys: AnimKey[] = poses.map((pose, i) => ({ t: ts[i], pos: [...pose[p]] as Vec3 }));
    tracks.push({ keys });
  }
  return { tracks };
}

/** 한 점 트랙에 키를 upsert(같은 t 근처면 교체, 아니면 삽입 후 t 정렬). autokey 용. */
export function upsertKey(track: PointTrack, t: number, pos: Vec3, eps = 1e-3): PointTrack {
  const keys = track.keys.map((k) => ({ t: k.t, pos: [...k.pos] as Vec3 }));
  const idx = keys.findIndex((k) => Math.abs(k.t - t) <= eps);
  if (idx >= 0) keys[idx] = { t, pos: [...pos] as Vec3 };
  else keys.push({ t, pos: [...pos] as Vec3 });
  keys.sort((a, b) => a.t - b.t);
  return { keys };
}

/** 한 점 트랙에서 t 근처 키 제거(최소 1개는 남김). */
export function removeKeyAt(track: PointTrack, t: number, eps = 1e-3): PointTrack {
  if (track.keys.length <= 1) return track;
  const keys = track.keys.filter((k) => Math.abs(k.t - t) > eps);
  return { keys: keys.length ? keys : [track.keys[0]] };
}

/** 애니메이션 전체에서 키가 존재하는 시간들(중복 제거, 오름차순) — 타임라인 밀도 표시용. */
export function keyTimes(anim: KnotAnimation, eps = 1e-3): number[] {
  const out: number[] = [];
  for (const tr of anim.tracks) {
    for (const k of tr.keys) {
      if (!out.some((t) => Math.abs(t - k.t) <= eps)) out.push(k.t);
    }
  }
  return out.sort((a, b) => a - b);
}
