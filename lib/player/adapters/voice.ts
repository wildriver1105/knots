// 음성 입력 어댑터 (hands-free 1순위).
// Web Speech API(SpeechRecognition) — 브라우저 네이티브, 모델 다운로드 0, 연산 매우 낮음.
// 키워드(한/영)를 PlayerCommands 로 매핑한다. 손도 얼굴도 쓰지 않는다.

import type { InputAdapter } from "./types";
import type { PlayerCommands } from "../commands";

type VoiceState = "idle" | "listening" | "unsupported" | "error";

// 키워드 → 동작. 부분 문자열로 매칭(인식 변동 대비).
const RULES: { words: string[]; run: (c: PlayerCommands) => void }[] = [
  { words: ["다음", "넘겨", "next", "forward", "go"], run: (c) => c.next() },
  { words: ["이전", "뒤로", "back", "previous", "prev"], run: (c) => c.prev() },
  { words: ["재생", "플레이", "시작", "play", "start"], run: (c) => c.play() },
  { words: ["멈춰", "정지", "스톱", "stop", "pause", "그만"], run: (c) => c.pause() },
  { words: ["처음", "되감", "리셋", "rewind", "reset", "restart"], run: (c) => c.rewind() },
  { words: ["연속", "continuous", "auto"], run: (c) => c.setMode("continuous") },
  { words: ["단계", "step", "스텝"], run: (c) => c.setMode("step") },
];

function getRecognition(): any {
  if (typeof window === "undefined") return null;
  const W = window as any;
  const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function isVoiceSupported(): boolean {
  if (typeof window === "undefined") return false;
  const W = window as any;
  return !!(W.SpeechRecognition || W.webkitSpeechRecognition);
}

export function createVoiceAdapter(onState?: (s: VoiceState, lastHeard?: string) => void): InputAdapter {
  let rec: any = null;
  let cmd: PlayerCommands | null = null;
  let stopped = true;

  function handleResult(e: any) {
    const res = e.results[e.results.length - 1];
    if (!res || !res.isFinal) return;
    const text = (res[0]?.transcript || "").toLowerCase().trim();
    if (!cmd || !text) return;
    for (const rule of RULES) {
      if (rule.words.some((w) => text.includes(w))) {
        rule.run(cmd);
        onState?.("listening", text);
        return;
      }
    }
    onState?.("listening", text);
  }

  return {
    id: "voice",
    label: "음성 명령",
    start(c: PlayerCommands) {
      cmd = c;
      rec = getRecognition();
      if (!rec) {
        onState?.("unsupported");
        return;
      }
      stopped = false;
      rec.lang = "ko-KR";
      rec.continuous = true;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = handleResult;
      rec.onerror = (ev: any) => {
        if (ev.error === "no-speech" || ev.error === "aborted") return;
        onState?.("error", ev.error);
      };
      // 연속 인식 유지: 자동 종료되면 다시 시작.
      rec.onend = () => {
        if (!stopped) {
          try {
            rec.start();
          } catch {
            /* 이미 시작됨 */
          }
        } else {
          onState?.("idle");
        }
      };
      try {
        rec.start();
        onState?.("listening");
      } catch {
        onState?.("error", "start-failed");
      }
    },
    stop() {
      stopped = true;
      if (rec) {
        try {
          rec.onend = null;
          rec.stop();
        } catch {
          /* noop */
        }
      }
      rec = null;
      cmd = null;
      onState?.("idle");
    },
  };
}
