"use client";

// 매듭 선택기 — 6개 매듭 카드. 클릭 시 loadKnot.

import { usePlayerStore } from "@/lib/player/store";
import { KNOTS } from "@/lib/knots/data";

const DIFF_LABEL = ["", "쉬움", "보통", "어려움"];

export default function KnotPicker() {
  const knotId = usePlayerStore((s) => s.knotId);
  const loadKnot = usePlayerStore((s) => s.loadKnot);

  return (
    <div className="knot-picker">
      {KNOTS.map((k) => (
        <button
          key={k.id}
          className={`knot-card ${k.id === knotId ? "knot-card--active" : ""}`}
          onClick={() => loadKnot(k.id)}
        >
          <span className="knot-card__name">{k.name}</span>
          <span className={`knot-card__diff diff-${k.difficulty}`}>{DIFF_LABEL[k.difficulty]}</span>
        </button>
      ))}
    </div>
  );
}
