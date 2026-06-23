// 제스처 입력 어댑터 — Phase 2 스텁.
//
// 구현 계획: @mediapipe/tasks-vision 의 HandLandmarker 를 숨은 <video> 스트림에 물려
// 손 제스처를 인식하고 PlayerCommands 로 매핑한다(client-only, WASM 로드).
//   예) 손바닥 펴기 = play, 주먹 = pause, 왼/오른쪽 스와이프 = prev/next.
//
// Phase 1 에서는 어댑터 배열에 넣지 않는다. 구현 시 이 파일만 채우고 배열에 추가하면 된다.
// 스토어/Rope/Scene/데이터는 전혀 바뀌지 않는다.

import type { InputAdapter } from "./types";
import type { PlayerCommands } from "../commands";

export function createGestureAdapter(): InputAdapter {
  return {
    id: "gesture",
    label: "카메라 제스처 (Phase 2)",
    start(_cmd: PlayerCommands) {
      // TODO(phase2): HandLandmarker 초기화 + 프레임 루프에서 제스처 분류 → cmd 호출
    },
    stop() {
      // TODO(phase2): 카메라 스트림/모델 정리
    },
  };
}
