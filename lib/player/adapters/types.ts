// 입력 어댑터 계약.
//
// 어댑터는 외부 입력(키보드, 카메라 제스처, 음성...)을 받아 PlayerCommands 로 변환한다.
// start(cmd) 에서 리스너/모델을 켜고, stop() 에서 정리한다.
// 새 입력 방식 추가 = 이 인터페이스를 구현한 파일 하나를 어댑터 배열에 넣는 것뿐이다.

import type { PlayerCommands } from "../commands";

export interface InputAdapter {
  id: string;
  /** 사람이 읽는 이름(설정 UI 표시용). */
  label?: string;
  start(cmd: PlayerCommands): void | Promise<void>;
  stop(): void;
}
