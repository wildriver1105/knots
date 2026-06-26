---
name: knot-authoring
description: >-
  knots 앱에 세일링 매듭을 추가하거나 편집한다. 타입드 TS 데이터 파일(lib/knots/data/<id>.ts)에
  좌표/스텝/포즈/색/카메라를 저작하고, npm run validate 로 구조를 게이트한 뒤 dev 서버(port 3009)와
  스크린샷으로 시각 검증한다. 새 매듭 추가, 매듭 모양/애니메이션 수정, 스텝·색·카메라 조정에 사용한다.
---

# Knot Authoring — knots 앱 매듭 저작

이 스킬은 `knots`(Next.js + React Three Fiber 3D 매듭 학습 앱)에서 매듭을 코드로 저작/편집하는
전체 워크플로다. 사람이 GUI로 점을 끄는 대신, **AI 에이전트가 데이터 파일을 편집 → 검증 → 스크린샷**
루프로 매듭을 만든다.

## 1. 언제 쓰나

- 새 매듭을 추가할 때 (예: "트럭커즈 히치를 추가해줘").
- 기존 매듭의 모양/꼬임/over-under 가 어색해서 좌표를 고칠 때.
- 스텝(단계) 텍스트·개수·카메라 시점·색 경계를 조정할 때.

**안 쓰는 경우:** 렌더러/물리/UI 코드 변경(그건 일반 코드 작업), 또는 실시간 물리 재도입(금지 — §2).

## 2. 멘탈 모델 (가장 중요)

- **포즈가 단일 진리다.** 한 매듭은 `path`(최종 완성형 중심선) + `steps`(단계) + `poses`(스텝당 줄
  전체 좌표, 길이 = `path.length`)로 정의된다. 런타임은 `poses` 를 `interpolatePoses` 로 보간해
  **그대로** 렌더한다. **저작한 좌표가 곧 화면이다 — 스크린샷은 편집을 100% 충실히 반영한다.**
- **렌더에 실시간 물리가 없다.** 폭발/구슬/꽈배기는 과거 매 프레임 solver 형성의 부작용이었고 제거됐다.
  절대 `Rope.tsx` 렌더 루프에 `RopeSolver.step` 을 다시 넣지 말 것. (정리가 필요하면 §6 의 오프라인
  `relaxPoints` 나 `physics.settle:"light"` 옵트인을 쓴다.)
- **포즈는 저작하거나 시드한다.** `path` 만 저작하면 런타임이 `seedPoses`(straight→path staged morph)로
  중간 포즈를 자동 생성한다(동작은 하지만 "기하학적"). **고품질은 `poses` 를 명시적으로 굽는 것**이다.

## 3. 데이터 모델 치트시트

정의: [lib/knots/types.ts](../../lib/knots/types.ts). 핵심 필드:

| 필드 | 의미 |
|---|---|
| `id` | 고유 id(kebab-case). 빌트인은 `KnotId` 유니온에도 추가. |
| `builtinRevision` | 빌트인 교정 버전. **빌트인 수정 시 반드시 +1**(저장본 마이그레이션 트리거). |
| `path: Vec3[]` | 최종 완성형 중심선 제어점. Rope 가 CatmullRom 으로 보간. |
| `poses?: Vec3[][]` | 스텝당 줄 전체 좌표. 길이 = `steps.length`, 각 포즈 길이 = `path.length`. 없으면 시드. |
| `animation?: { tracks }` | 점별 키프레임(도프시트). 있으면 렌더가 poses 보다 **우선**해 시간으로 평가. 보통 코드 대신 에디터 🎞도프시트로 저작(autokey). 평가/생성 헬퍼는 `lib/knots/anim.ts`. |
| `steps: Step[]` | `{ id, title, instruction, reveal(0..1, 마지막=1), camera? }`. |
| `colorSplitIndex` | 이 인덱스 전 = `ropeColor`, 후 = `ropeColorB`(투톤). `ropeColorB` 쓰면 (0, path.length-1) 내부여야. |
| `ropeColor` / `ropeColorB` | standing part / working end 색. |
| `extraStrands[]` | `{ path, color, poses?, layDir?, layCenter? }`. 두 번째 줄(예: square knot 빨강). |
| `object` | `{kind:"none"}` / `{kind:"pole", radius, height, axis}` / `{kind:"cleat", scale}`. |
| `ropeRadius` | 튜브 반경(보통 0.07~0.082). |
| `layDir` / `layCenter` / `formReverse` | 시드용 곧은 줄의 방향/중심/형성 시작 끝. |
| `physics.settle` | `"off"`(기본, 결정론) / `"light"`(form>0.9 에서만 약한 겹침 정리). |
| `defaultStepDuration` | 연속 모드 스텝당 트윈 시간(초). |

## 4. 좌표 규약

- **축:** `x` = 좌(−)/우(+), `y` = 하(−)/상(+), `z` = 뒤(−)/앞(+, 화면 쪽).
- **over/under:** 두 가닥이 교차하는 지점은 **z 를 로프 반경의 2배 이상** 벌려야 위/아래가 또렷하다.
  (예: `ropeRadius=0.07` → 교차에서 z 차이 ≥ 0.15.)
- **색 경계:** `colorSplitIndex` 가 standing part(앞쪽 색)와 working end(뒤쪽 색)를 가른다.
- 점은 "굵직하게"만 찍으면 된다(CatmullRom 이 매끄럽게 보간). 한 매듭의 모든 포즈는 점 개수가 같아야 한다.

## 5. 빌더 헬퍼 API

좌표를 숫자로 직접 나열하지 말고 가능하면 [lib/knots/builder.ts](../../lib/knots/builder.ts) 프리미티브로 조립한다:

```ts
line(from: Vec3, to: Vec3, n): Vec3[]              // 직선 위 n점(양 끝 포함)
arc(center, r, a0, a1, n, plane): Vec3[]           // 평면 원호. plane="xy"|"xz"|"yz"
helixY(cx, cz, r, a0, a1, y0, y1, n): Vec3[]        // y축 말뚝을 감는 나선
sampleParametric(f, t0, t1, n): Vec3[]             // 파라메트릭 곡선 샘플
join(...segments): Vec3[]                          // 세그먼트 이어붙이기(중복 끝점 제거)
transformPath(points, scale, offset): Vec3[]       // 전체 스케일/이동
add(a,b) / scale(v,s)                              // 벡터 합/배
```

워크드 스니펫:

```ts
// (a) 말뚝을 한 바퀴 감기: 반경 RR, y는 0.2 위로 상승하며 360° 회전
const wrap = helixY(0, 0, RR, 0, Math.PI * 2, -0.2, 0.2, 40);

// (b) 앞면 대각선 교차(working end 를 위로): z를 키워 앞으로 지나가게
const cross = line([RR, 0.2, 0.05], [-RR, -0.1, RR + 0.18], 8);

// (c) 끼워 넣기(tuck under): 방금 만든 가닥 아래로 z를 낮춰 통과
const tuck = line(cross[cross.length - 1], [Math.cos(D(95))*(RR+0.04), 0.2, Math.sin(D(95))*(RR+0.18)], 8);

const path = join(tailIn, wrap, cross, tuck, tailOut);
```

기존 예시: `clove-hitch`/`round-turn` 은 이 헬퍼로 path 를 조립한다. `figure-eight`/`bowline`/`square`
는 손배치 배열(불규칙 매듭의 폴백).

## 6. 포즈 시딩 vs 손저작

[lib/knots/authoring.ts](../../lib/knots/authoring.ts):

```ts
seedPoses(path, steps, { layDir?, layCenter?, formReverse?, lengthScale? }): Vec3[][]
withSeededPoses(knot): Knot     // poses 가 없으면 main + 각 extraStrand 를 시드해 채움
tiePoses(path, reveals, { reverse?, tailDir? }): Vec3[][]  // "줄을 따라 꿰는" 스텝 포즈
```

**`tiePoses` 가 말뚝/클리트를 감거나 줄을 꿰는 매듭에 가장 좋다(권장).** 각 스텝 reveal 까지는 최종
path 위에 형성되고, 나머지는 그 지점에서 곧게 뻗은 working-end 꼬리가 된다 — "감은 부분은 제자리,
남은 끝은 곧게"라 중간 스텝이 또렷하다(seedPoses 의 직선 베이스라인이 화면 밖으로 뻗는 문제를 피함).
보통 `reveals` 에 각 step 의 reveal 값을 그대로 넘기고, `tailDir` 로 느슨한 끝이 향할 방향을 힌트한다.
예: `poses: tiePoses(path, [0.38, 0.55, 0.82, 1], { reverse: false, tailDir: [0.3, -0.1, 1] })`.
빌트인 clove/round-turn/cleat/bowline 가 이 방식을 쓴다.

- **시드(빠름, 기하학적):** 데이터 파일에 `path` 만 저작 → 런타임이 자동 시드. 동작 확인용.
- **손저작(고품질, 권장):** 각 스텝의 포즈를 명시적으로 굽는다. 두 가지 방법:
  1. **빌더-합성(builder 매듭에 권장):** 스텝 i 의 포즈 = "그 단계까지 완성된 부분 + 나머지는 곧은
     working-end 꼬리". 예: clove step1 = 첫 감기만 + 직선 꼬리, step2 = +교차, ... step4 = 최종 path.
     각 스텝을 builder 로 부분 형성해 `poses[i]` 로 넣는다(길이는 모두 `path.length` 로 맞춘다).
  2. **시드 후 다듬기:** `seedPoses` 로 시작점을 만들고, 어색한 스텝의 좌표만 손으로 조정.
- **겹침 정리가 필요하면** 오프라인에서 `relaxPoints(pose, radius, iterations, colliders)` 로 한 번 정리해
  결과 좌표를 붙여 넣는다(렌더 루프에 넣지 말 것). 또는 `physics.settle:"light"` 로 옵트인.

## 7. 매듭 추가 / 수정 절차

**새 매듭 추가:**
1. `lib/knots/data/<id>.ts` 생성 — `Knot` 1개 export. `builtinRevision: 1` 로 시작.
2. [lib/knots/data/index.ts](../../lib/knots/data/index.ts) 의 `BUILTIN_SEED` 배열에 import + 추가.
3. 강타입을 원하면 `types.ts` 의 `KnotId` 유니온에 id 추가(선택).
4. (새 id 는 GET 마이그레이션이 자동 추가한다.)

**기존 매듭 수정:**
1. 해당 `data/<id>.ts` 좌표/포즈/스텝을 편집.
2. **`builtinRevision` 을 +1** — 안 그러면 `knots.data.json` 저장본이 갱신되지 않는다.
3. 로컬에서 즉시 반영하려면 dev 중 `knots.data.json` 을 지워 강제 reseed 해도 된다(개발 전용).

## 8. validate + 시각 검증 루프

```
1) npm run validate            # 구조 게이트(빠름, 브라우저 불필요). 에러 0 될 때까지 수정.
2) npx tsc --noEmit            # 타입체크.
3) dev 서버 시작               # Preview MCP: preview_start name="knots" (port 3009)
4) 스텝별 스크린샷(아래 eval)  # 결정론적이라 편집이 그대로 반영됨
5) 어색하면 좌표 수정 → 1) 로
```

dev 에서 스토어가 `window.knots` 로 노출된다. Preview MCP `preview_eval` 로 구동:

```js
// 매듭 로드 + 단계 모드 + 특정 스텝
window.knots.player.getState().loadKnot('<id>');
window.knots.player.getState().setMode('step');
window.knots.player.getState().goToStep(2);          // 0-based

// 제어점 오버레이 토글(좌표 확인용) — 초록=시작점, 파랑=끝점, 보라=colorSplitIndex
window.knots.player.getState().setDebugPoints(true);

// 연속 모드 중간 진행도 보기
window.knots.player.getState().setMode('continuous');
window.knots.player.getState().seek(0.5);
```

그 다음 `preview_screenshot` 으로 캡처, `preview_console_logs level="error"` 로 NaN/throw 없는지 확인.
스텝에 `camera` 가 정의돼 있으면 CameraRig 가 그 시점으로 자동 프레이밍한다(스크린샷 각도 보장).
하단 컨트롤 바가 화면 ~40%를 가리므로, 매듭이 상단에 잡히도록 스텝 `camera.target.y` 를 +로 올리거나
카메라를 당기면 검증 스크린샷이 잘 나온다.

## 9. "잘 보임" 체크리스트 (스텝마다)

- [ ] 교차마다 over 가닥이 또렷이 앞(z+), 가닥이 서로를 관통하지 않음.
- [ ] 구슬/꽈배기/폭발 없음(결정론이라 거의 자동으로 보장됨 — 보이면 좌표 중복/급격한 점 때문).
- [ ] 스텝 지시문과 모양이 일치(고리 형성, 감은 횟수, 끼움 방향).
- [ ] 색 경계가 의도한 standing/working 위치(보라 디버그 점 확인).
- [ ] 단계가 자연스럽게 이어짐(이전→다음 포즈가 working end 부터 움직이는 느낌).
- [ ] 카메라가 매듭을 가리지 않고 잘 보여줌(필요하면 스텝 `camera` 추가).

## 10. 복사용 예시 파일

- **빌더-합성 + 말뚝 객체:** [lib/knots/data/cloveHitch.ts](../../lib/knots/data/cloveHitch.ts)
- **2가닥(extraStrands) + 스텝별 카메라:** [lib/knots/data/squareKnot.ts](../../lib/knots/data/squareKnot.ts)
- **손배치 배열 폴백:** [lib/knots/data/figureEight.ts](../../lib/knots/data/figureEight.ts)

새 매듭은 가장 가까운 예시를 복사해 시작하는 것이 가장 빠르다.
