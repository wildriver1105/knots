# knots — AI 에이전트 안내

3D 세일링 매듭 학습 앱(Next.js 14 App Router + React Three Fiber). 6개 빌트인 매듭을 단계별/연속
애니메이션으로 보여준다. 매듭 저작은 **사람이 GUI로 하는 대신 AI 코딩 에이전트가 코드를 편집**해서 한다.

## 핵심 모델 (반드시 지킬 것)

- **애니메이션은 결정론적이다.** 재생 소스 우선순위: ① `animation`(도프시트 점별 키프레임)
  ② `tieMotion`(working end 가 최종 path 를 따라 꿰어 들어가는 스레딩 — 빌트인 기본, form==reveal)
  ③ `poses`(스텝 포즈 `interpolatePoses`). 저작한 데이터가 곧 화면이다.
- **렌더 경로에 "상태 있는" 실시간 물리 solver 가 없다.** 과거 `RopeSolver`(Verlet, 누적 상태)를 매
  프레임 돌려 매듭을 "형성"하던 방식은 폭발·구슬·꽈배기의 원인이라 제거했다. `RopeSolver`/`relaxPoints`
  는 **오프라인 저작 보조**로만 남아 있다. **렌더 루프에 상태 있는 solver 를 다시 넣지 말 것.**
  (허용된 것: `lib/knots/depenetrate.ts` — 같은 입력→같은 출력, 보정 클램프된 **무상태** 겹침 분리
  후처리. 이는 스무딩과 같은 급의 cosmetic 패스로, Verlet 솔버와 혼동하지 말 것.)
- 매듭 데이터의 정본은 `lib/knots/data/<id>.ts`(타입드 TS). 런타임은 `knots.data.json`(프로젝트 루트
  파일)에서 읽고, 빌트인은 `builtinRevision` 으로 마이그레이션된다. **빌트인을 수정하면 그 파일의
  `builtinRevision` 을 반드시 올릴 것**(안 올리면 저장본이 갱신되지 않는다).

## 매듭 추가·수정

→ **`knot-authoring` 스킬을 사용한다**: [skills/knot-authoring/SKILL.md](skills/knot-authoring/SKILL.md)
데이터 모델, 좌표 규약, 빌더 헬퍼, 시딩, validate + 시각 검증 루프가 모두 정리돼 있다.

## 검증 커맨드

- 구조 게이트: `npm run validate` (브라우저 전에 항상 먼저 — path/poses/색경계/물리 범위 확인)
- 시각 검증: dev 서버 **port 3009**(`.claude/launch.json` 의 "knots"), Preview MCP 로 로드 후
  `window.knots.player.getState()` 를 eval 로 구동해 스텝별 스크린샷. (dev 에서 스토어를 window 에 노출함.)
- 타입체크: `npx tsc --noEmit`

## 구조 요약

- `lib/knots/` — `types.ts`(모델), `interpolate.ts`(포즈 보간), `authoring.ts`(`seedPoses`/`withSeededPoses`),
  `builder.ts`(좌표 헬퍼), `validate.ts`, `data/*.ts`(매듭).
- `components/scene/Rope.tsx` — 결정론적 포즈 렌더러(가장 중요). `EditScene.tsx` — 에디터 미리보기.
- `lib/player/store.ts` — 입력 공통 커맨드 버스(+`debugPoints`). `lib/editor/store.ts` — 에디터 상태.
