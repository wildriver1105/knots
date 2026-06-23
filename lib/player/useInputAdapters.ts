"use client";

// 어댑터 묶음을 마운트 시 start, 언마운트 시 stop 한다.
// Phase 1: [keyboard]. Phase 2: [keyboard, gesture, voice] 처럼 배열만 늘리면 된다.

import { useEffect } from "react";
import type { InputAdapter } from "./adapters/types";
import { makeCommands } from "./commands";

export function useInputAdapters(adapters: InputAdapter[]): void {
  useEffect(() => {
    const cmd = makeCommands();
    adapters.forEach((a) => {
      try {
        a.start(cmd);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(`[adapter:${a.id}] start 실패`, e);
      }
    });
    return () => {
      adapters.forEach((a) => {
        try {
          a.stop();
        } catch {
          /* noop */
        }
      });
    };
    // adapters 는 상위에서 useMemo 로 안정적으로 전달한다고 가정
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
