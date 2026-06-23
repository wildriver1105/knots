// 키보드 입력 어댑터 (Phase 1).
//  Space = play/pause 토글
//  ← / →  = 이전/다음 단계
//  R      = 되감기
//  M      = step ↔ continuous 모드 전환
//  Home   = 처음으로

import type { InputAdapter } from "./types";
import type { PlayerCommands } from "../commands";
import { usePlayerStore } from "../store";

export function createKeyboardAdapter(): InputAdapter {
  let handler: ((e: KeyboardEvent) => void) | null = null;

  return {
    id: "keyboard",
    label: "키보드",
    start(cmd: PlayerCommands) {
      handler = (e: KeyboardEvent) => {
        // 입력 필드 포커스 시 무시
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
          return;
        }
        switch (e.key) {
          case " ":
            e.preventDefault();
            cmd.toggle();
            break;
          case "ArrowRight":
            e.preventDefault();
            cmd.next();
            break;
          case "ArrowLeft":
            e.preventDefault();
            cmd.prev();
            break;
          case "r":
          case "R":
            cmd.rewind();
            break;
          case "m":
          case "M": {
            const mode = usePlayerStore.getState().mode;
            cmd.setMode(mode === "step" ? "continuous" : "step");
            break;
          }
          case "Home":
            cmd.reset();
            break;
        }
      };
      window.addEventListener("keydown", handler);
    },
    stop() {
      if (handler) window.removeEventListener("keydown", handler);
      handler = null;
    },
  };
}
