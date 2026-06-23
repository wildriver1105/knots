"use client";

// 연속 재생 구동기 — useFrame 으로 매 프레임 store.tick(delta) 호출.
// 렌더 트리에 보이는 것은 없다.

import { useFrame } from "@react-three/fiber";
import { usePlayerStore } from "@/lib/player/store";

export default function PlaybackTicker() {
  const tick = usePlayerStore((s) => s.tick);
  useFrame((_, delta) => tick(Math.min(delta, 0.05)));
  return null;
}
