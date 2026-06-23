"use client";

// 현재 단계 안내 패널 — 제목 + 설명. 단계 변경 시 framer-motion 으로 부드럽게 전환.

import { AnimatePresence, motion } from "framer-motion";
import { usePlayerStore } from "@/lib/player/store";
import { getKnot } from "@/lib/knots/data";
import { progressToStepIndex } from "@/lib/knots/interpolate";

export default function StepPanel() {
  const knotId = usePlayerStore((s) => s.knotId);
  const mode = usePlayerStore((s) => s.mode);
  const stepIndex = usePlayerStore((s) => s.stepIndex);
  const progress = usePlayerStore((s) => s.progress);

  const knot = getKnot(knotId);
  const idx = mode === "step" ? stepIndex : progressToStepIndex(knot, progress);
  const step = knot.steps[Math.min(idx, knot.steps.length - 1)];

  return (
    <div className="step-panel">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${knot.id}-${idx}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <div className="step-eyebrow">
            STEP {idx + 1} · {knot.name}
          </div>
          <h2 className="step-title">{step.title}</h2>
          <p className="step-instruction">{step.instruction}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
