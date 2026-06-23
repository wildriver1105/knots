"use client";

// 매듭 저장소(repository) — 프로젝트 루트의 knots.data.json 을 단일 소스로 하는 클라이언트 스토어.
// 서버 Route Handler(/api/knots)가 파일 읽기/쓰기를 담당하고, 여기서는 fetch 로 동기화한다.
// 빌트인·커스텀 구분 없이 모든 매듭이 파일에 들어 있고, 저장/불러오기/수정/삭제가 모두 파일에 반영된다.

import { create } from "zustand";
import type { Knot } from "./types";

function index(knots: Knot[]): Record<string, Knot> {
  const byId: Record<string, Knot> = {};
  for (const k of knots) byId[k.id] = k;
  return byId;
}

interface RepoState {
  knots: Knot[];
  byId: Record<string, Knot>;
  loaded: boolean;
  hydrate: () => Promise<void>;
  upsert: (k: Knot) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useKnotsRepo = create<RepoState>((set, get) => ({
  knots: [],
  byId: {},
  loaded: false,

  hydrate: async () => {
    try {
      const res = await fetch("/api/knots", { cache: "no-store" });
      const data = await res.json();
      const knots: Knot[] = Array.isArray(data?.knots) ? data.knots : [];
      set({ knots, byId: index(knots), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  upsert: async (k) => {
    // 낙관적 갱신(순서 보존: 있으면 제자리 교체, 없으면 끝에 추가) 후 파일에 기록
    const cur = get().knots;
    const idx = cur.findIndex((x) => x.id === k.id);
    const knots = idx >= 0 ? cur.map((x, i) => (i === idx ? k : x)) : [...cur, k];
    set({ knots, byId: index(knots) });
    try {
      await fetch("/api/knots", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(k),
      });
    } catch {
      /* 오프라인/정적 환경: 메모리에만 반영 */
    }
  },

  remove: async (id) => {
    try {
      await fetch(`/api/knots?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      /* noop */
    }
    // 서버가 빌트인은 시드로 리셋, 커스텀은 삭제 → 다시 불러와 반영
    await get().hydrate();
  },
}));
