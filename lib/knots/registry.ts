"use client";

// 매듭 조회 — 파일 기반 repo 를 먼저 보고, 아직 로드 전이면 시드로 fallback.
// 모든 컴포넌트/스토어는 여기의 getKnot 을 쓴다(빌트인·커스텀·편집본 모두 동일 경로).

import type { Knot } from "./types";
import { SEED_BY_ID, BUILTIN_SEED } from "./data";
import { useKnotsRepo } from "./repo";

export function getKnot(id: string): Knot {
  return useKnotsRepo.getState().byId[id] ?? SEED_BY_ID[id] ?? BUILTIN_SEED[0];
}
