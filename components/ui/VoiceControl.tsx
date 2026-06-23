"use client";

// 음성(hands-free) 토글. 켜면 마이크로 "다음/이전/재생/멈춰" 등을 인식해 슬라이드를 조작한다.
// Web Speech API 미지원 브라우저에서는 버튼을 숨긴다.

import { useEffect, useRef, useState } from "react";
import { createVoiceAdapter, isVoiceSupported } from "@/lib/player/adapters/voice";
import type { InputAdapter } from "@/lib/player/adapters/types";
import { makeCommands } from "@/lib/player/commands";

export default function VoiceControl() {
  const [on, setOn] = useState(false);
  const [heard, setHeard] = useState("");
  const [mounted, setMounted] = useState(false);
  const adapterRef = useRef<InputAdapter | null>(null);

  useEffect(() => setMounted(true), []);

  // 클라이언트 마운트 후에만 렌더(SSR 하이드레이션 불일치 방지).
  if (!mounted || !isVoiceSupported()) return null;

  const toggle = () => {
    if (on) {
      adapterRef.current?.stop();
      adapterRef.current = null;
      setOn(false);
      setHeard("");
    } else {
      const a = createVoiceAdapter((s, t) => {
        if (s === "error" || s === "unsupported") {
          setOn(false);
          adapterRef.current = null;
        }
        if (t) setHeard(t);
      });
      a.start(makeCommands());
      adapterRef.current = a;
      setOn(true);
    }
  };

  return (
    <button className={`voice-btn ${on ? "voice-btn--on" : ""}`} onClick={toggle} title='"다음 / 이전 / 재생 / 멈춰"'>
      <span className="voice-dot" />
      {on ? (heard ? `“${heard}”` : "듣는 중…") : "🎙 음성"}
    </button>
  );
}
