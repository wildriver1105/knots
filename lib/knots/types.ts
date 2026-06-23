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
  id: KnotId | string; // 빌트인 KnotId 또는 커스텀 매듭 id
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
   * main path 와 동일 진행도로 함께 형성된다. layDir 로 곧은 줄의 놓임 방향을 따로 줄 수 있다.
   */
  extraStrands?: { path: Vec3[]; color: string; layDir?: Vec3; layCenter?: Vec3 }[];

  // ── morph(형성) 튜닝 ──
  /** 곧게 펴진 줄(straight baseline)의 놓임 방향. 기본 [1,0,0](수평). */
  layDir?: Vec3;
  /** 곧은 줄의 중심 위치. 기본 path 무게중심. 말뚝 앞에 놓으려면 z 를 키운다. */
  layCenter?: Vec3;
  /** 형성 시작 끝. true 면 path 의 마지막 점(standing part)부터 형성한다. */
  formReverse?: boolean;
  /** 로프 튜브 반경(씬 단위, 보통 ~0.06). */
  ropeRadius: number;
  object: KnotObjectDef;
  /** 연속 모드 step 당 기본 트윈 시간(초). */
  defaultStepDuration: number;
  /** 순서 있는 step 목록. reveal 은 단조 증가, 마지막은 1. */
  steps: Step[];

  /**
   * 에디터로 만든 매듭(keyframe 방식). 각 원소 = 한 스텝의 줄 전체 포즈(길이 = path.length).
   * 있으면 애니메이션이 포즈 사이를 보간한다(loose→tight 대신). steps 와 1:1.
   */
  poses?: Vec3[][];
  /** 사용자 정의(에디터) 매듭 여부. */
  isCustom?: boolean;
}
