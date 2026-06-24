# knots — 세일링 매듭 3D 학습 앱

주요 세일링 매듭(figure-eight, square/reef, cleat hitch, clove hitch, round turn & two half hitches, bowline)을
3D로 **단계별(step)** 및 **연속(continuous)** 으로 배우는 학습 앱. Next.js 14 + React Three Fiber.

> **Phase 1**(현재): 3D 매듭 강의 + 화면 버튼/키보드 제어.
> **Phase 2**(예정): 두 손이 자유로운 **touchless** 제어 — 카메라 제스처(MediaPipe)·음성. 입력 어댑터만 추가하면 된다.

## 실행

```bash
npm install
npm run dev   # http://localhost:3000
```

## 조작

- **Space** 재생/일시정지 · **← →** 이전/다음 단계 · **R** 되감기 · **M** 단계별/연속 전환
- 마우스 드래그로 3D 회전, 휠로 줌. 화면 하단 컨트롤 바와 슬라이더로도 제어.
- 우상단 **⊹ points** 토글 = 제어점 표시(매듭 좌표 저작용 디버그 오버레이).
- 매듭 카드의 **편집**에서 장력·중력·굽힘 저항을 조절하고, 제어점을 움직인 뒤 **물리 정리**로
  자기충돌과 물체 충돌을 반영한 포즈를 저장할 수 있다.

## 구조

- `lib/knots/` — 데이터 모델(`types.ts`), reveal 보간(`interpolate.ts`), 저작 헬퍼(`builder.ts`),
  매듭 데이터(`data/*.ts`). 각 매듭은 하나의 중심선(`path`)과 step별 reveal 로 정의된다.
- `lib/player/` — zustand 커맨드 버스(`store.ts`)와 입력 어댑터(`adapters/`). 모든 입력원이
  동일한 `PlayerCommands` 를 호출한다(Phase 2 확장 지점).
- `components/scene/` — R3F 캔버스/로프/객체/조명. `SceneCanvas` 는 `ssr:false` 로 동적 임포트.
- `lib/knots/physics.ts` — Verlet + 위치 기반 제약(PBD) 로프 솔버. 비신축 장력, 굽힘,
  선분-선분 자기충돌, 말뚝/클리트 캡슐 충돌을 처리한다.
- `components/ui/` — 오버레이 UI(매듭 선택·단계 패널·컨트롤 바·모드 토글).

## 매듭 좌표 다듬기

`lib/knots/data/<knot>.ts` 의 `path` 제어점을 수정하고, 앱 우상단 **points** 토글로 제어점을 보면서
교차 부근의 z(깊이)를 로프 반경의 2배 이상 벌리면 over/under 가 또렷해진다.
