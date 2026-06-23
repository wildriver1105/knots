"use client";

// 매듭 선택기 — 빌트인 6개 + 사용자 정의(에디터) 매듭. + 새 매듭 만들기.

import { usePlayerStore } from "@/lib/player/store";
import { KNOTS } from "@/lib/knots/data";
import { useCustomKnots } from "@/lib/knots/custom";
import { useEditorStore } from "@/lib/editor/store";

const DIFF_LABEL = ["", "쉬움", "보통", "어려움"];

export default function KnotPicker() {
  const knotId = usePlayerStore((s) => s.knotId);
  const loadKnot = usePlayerStore((s) => s.loadKnot);
  const custom = useCustomKnots((s) => s.knots);
  const startNew = useEditorStore((s) => s.startNew);
  const startEdit = useEditorStore((s) => s.startEdit);

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

      {custom.map((k) => (
        <button
          key={k.id}
          className={`knot-card knot-card--custom ${k.id === knotId ? "knot-card--active" : ""}`}
          onClick={() => loadKnot(k.id)}
          onDoubleClick={() => startEdit(k)}
          title="더블클릭하면 편집"
        >
          <span className="knot-card__name">{k.name}</span>
          <span className="knot-card__diff knot-card__edit" onClick={(e) => { e.stopPropagation(); startEdit(k); }}>
            편집 ✎
          </span>
        </button>
      ))}

      <button className="knot-card knot-card--new" onClick={() => startNew("내 매듭")}>
        <span className="knot-card__name">+ 새 매듭</span>
        <span className="knot-card__diff">에디터</span>
      </button>
    </div>
  );
}
