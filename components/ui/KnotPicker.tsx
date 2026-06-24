"use client";

// 매듭 선택기 — 파일(repo)에서 불러온 전체 매듭(빌트인+커스텀). + 새 매듭 / 편집 / 삭제.

import { usePlayerStore } from "@/lib/player/store";
import { BUILTIN_SEED, BUILTIN_IDS, SEED_BY_ID } from "@/lib/knots/data";
import { useKnotsRepo } from "@/lib/knots/repo";
import { useEditorStore } from "@/lib/editor/store";

const DIFF_LABEL = ["", "쉬움", "보통", "어려움"];

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((out, key) => {
        out[key] = canonical((value as Record<string, unknown>)[key]);
        return out;
      }, {});
  }
  return value;
}

export default function KnotPicker() {
  const knotId = usePlayerStore((s) => s.knotId);
  const loadKnot = usePlayerStore((s) => s.loadKnot);
  const repoKnots = useKnotsRepo((s) => s.knots);
  const loaded = useKnotsRepo((s) => s.loaded);
  const remove = useKnotsRepo((s) => s.remove);
  const startNew = useEditorStore((s) => s.startNew);
  const startEdit = useEditorStore((s) => s.startEdit);

  // 로드 전엔 시드로 표시(빈 화면 방지).
  const knots = loaded && repoKnots.length ? repoKnots : BUILTIN_SEED;
  const isEdited = (id: string) =>
    BUILTIN_IDS.has(id) &&
    JSON.stringify(canonical(knots.find((k) => k.id === id))) !== JSON.stringify(canonical(SEED_BY_ID[id]));

  return (
    <div className="knot-picker">
      {knots.map((k) => {
        const builtin = BUILTIN_IDS.has(k.id);
        return (
          <button
            key={k.id}
            className={`knot-card ${k.id === knotId ? "knot-card--active" : ""} ${builtin ? "" : "knot-card--custom"}`}
            onClick={() => loadKnot(k.id)}
            onDoubleClick={() => startEdit(k)}
            title="더블클릭하면 편집"
          >
            <span className="knot-card__name">
              {k.name}
              {isEdited(k.id) && <span className="knot-card__edited" title="수정됨">•</span>}
            </span>
            <span className="knot-card__row">
              {builtin ? (
                <span className={`knot-card__diff diff-${k.difficulty}`}>{DIFF_LABEL[k.difficulty]}</span>
              ) : (
                <span className="knot-card__diff">커스텀</span>
              )}
              <span
                className="knot-card__edit"
                onClick={(e) => {
                  e.stopPropagation();
                  startEdit(k);
                }}
              >
                편집 ✎
              </span>
              {!builtin && (
                <span
                  className="knot-card__del"
                  title="삭제"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`"${k.name}" 삭제?`)) {
                      void remove(k.id);
                      if (k.id === knotId) loadKnot(BUILTIN_SEED[0].id);
                    }
                  }}
                >
                  ✕
                </span>
              )}
            </span>
          </button>
        );
      })}

      <button className="knot-card knot-card--new" onClick={() => startNew("내 매듭")}>
        <span className="knot-card__name">+ 새 매듭</span>
        <span className="knot-card__diff">에디터</span>
      </button>
    </div>
  );
}
