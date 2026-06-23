// PlayerCommands — 입력 어댑터가 호출하는 안정적인 커맨드 인터페이스.
// 스토어 구현과 분리해 Phase 2 어댑터(제스처/음성)가 의존할 표면을 고정한다.

import { usePlayerStore } from "./store";
import type { PlayMode } from "./store";

export interface PlayerCommands {
  play(): void;
  pause(): void;
  toggle(): void;
  next(): void;
  prev(): void;
  seek(progress01: number): void;
  setMode(mode: PlayMode): void;
  rewind(): void;
  reset(): void;
}

/** 스토어를 감싼 커맨드 객체. React 밖(어댑터)에서도 호출 가능. */
export function makeCommands(): PlayerCommands {
  const s = () => usePlayerStore.getState();
  return {
    play: () => s().play(),
    pause: () => s().pause(),
    toggle: () => s().togglePlay(),
    next: () => s().next(),
    prev: () => s().prev(),
    seek: (p) => s().seek(p),
    setMode: (m) => s().setMode(m),
    rewind: () => s().rewind(),
    reset: () => s().reset(),
  };
}
