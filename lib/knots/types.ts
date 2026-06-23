// 매듭 데이터 모델 (reveal 방식).
//
// 한 매듭은 메타데이터 + 하나의 최종 중심선(path) + 순서 있는 step 목록으로 구성된다.
// path 는 로프가 묶인 "완성형" 경로의 제어점 배열이다(Rope 가 CatmullRom 으로 매끄럽게 보간).
// 타잉 애니메이션은 이 path 를 standing end → working end 방향으로 점점 "그려내는"(reveal)
// 방식이다. 각 step 은 그 경로를 어디까지(reveal 0..1) 보여줄지와 설명 텍스트를 담는다.
//
// 이 방식의 장점: 경로가 한 번만 정의되므로 좌표 저작 비용이 1/N 로 줄고, 보간 중
// 로프가 꼬이거나 찢어질 일이 없으며, over/under 가 항상 일관되게 보인다.

export type Vec3 = [number, number, number];

export type KnotId =
  | "figure-eight"
  | "clove-hitch"
  | "cleat-hitch"
  | "bowline"
  | "square-knot"
  | "round-turn-two-half-hitches";

/** 로프가 감싸는 대상(말뚝/클리트). 없으면 자유 매듭. */
export type KnotObjectDef =
  | { kind: "none" }
  | { kind: "pole"; radius: number; height: number; position?: Vec3; axis?: "x" | "y" | "z" }
  | { kind: "cleat"; scale?: number; position?: Vec3 };

export interface StepCamera {
  position: Vec3;
  target: Vec3;
}

export interface Step {
  id: string;
  /** 명령형 짧은 제목, 예: "Form the loop". */
  title: string;
  /** 단계 설명(한 문장 정도). */
  instruction: string;
  /** 이 step 완료 시점에 보여줄 경로 비율(0..1). 마지막 step 은 1 이어야 한다. */
  reveal: number;
  /** 이 step 에서 권장하는 카메라 시점(선택). */
  camera?: StepCamera;
}

export interface Knot {
  id: KnotId;
  name: string;
  blurb: string;
  difficulty: 1 | 2 | 3;
  /** 최종 중심선 제어점. Rope 가 CatmullRom 으로 보간하여 튜브를 만든다. */
  path: Vec3[];
  ropeColor: string;
  /** 투톤 두 번째 가닥 색(생략 시 단색). */
  ropeColorB?: string;
  /** colorSplitIndex 이전 점은 ropeColor, 이후는 ropeColorB. working end/standing part 구분용. */
  colorSplitIndex?: number;
  /**
   * 추가 가닥(bend 매듭용). square knot 처럼 두 로프를 잇는 매듭은 별도 strand 가 필요하다.
   * reveal 은 main path 와 동일 비율로 동시에 그려진다.
   */
  extraStrands?: { path: Vec3[]; color: string }[];
  /** 로프 튜브 반경(씬 단위, 보통 ~0.06). */
  ropeRadius: number;
  object: KnotObjectDef;
  /** 연속 모드 step 당 기본 트윈 시간(초). */
  defaultStepDuration: number;
  /** 순서 있는 step 목록. reveal 은 단조 증가, 마지막은 1. */
  steps: Step[];
}
