// 음성 입력 어댑터 — Phase 2 스텁.
//
// 구현 계획: Web Speech API(SpeechRecognition)로 명령어를 인식해 PlayerCommands 로 매핑.
//   예) "next"/"다음" = next, "back"/"이전" = prev, "play"/"재생" = play, "stop"/"멈춰" = pause.
//
// Phase 1 에서는 어댑터 배열에 넣지 않는다.

import type { InputAdapter } from "./types";
import type { PlayerCommands } from "../commands";

export function createVoiceAdapter(): InputAdapter {
  return {
    id: "voice",
    label: "음성 명령 (Phase 2)",
    start(_cmd: PlayerCommands) {
      // TODO(phase2): SpeechRecognition 시작 + onresult 에서 키워드 매칭 → cmd 호출
    },
    stop() {
      // TODO(phase2): 인식기 정지
    },
  };
}
