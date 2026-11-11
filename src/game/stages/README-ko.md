# 스테이지 코드 작업 안내

[English](README.md) | [한국어](README-ko.md)

각 스테이지의 코드는 `stages/<stage>/` 폴더 하나에 모여 있습니다. 서로 다른 스테이지를 맡은 작업자는 보통 자기 폴더만 수정하므로 merge conflict를 줄일 수 있습니다.

| 폴더 | 스테이지 |
|---|---|
| `office/` | 1: 사무실. 복사기, 물통, 간헐천, 쓰레기통, 모니터 |
| `building/` | 2: 건물 내부. 회의실, 의자 행렬, 엘리베이터 |
| `rooftop/` | 3: 기계실과 옥상. 출입문, 환풍구, 소화기, 이륙 |
| `sky/` | 4: 구름 위. 발판 코스와 깊이 전환 |

## 스테이지 폴더 구조

```
stages/<stage>/
  data.ts              고정된 레벨 수치와 대사
  state.ts             스테이지가 바꾸는 state (office, building, rooftop)
  definition.ts        StageDefinition: 길이, 목표, 지형, 체크포인트, 등장인물, 규칙 flag
  attempt.ts           새 시도의 시작 값
  hooks.ts             공용 tick에 끼어드는 StageHooks
  <system>/decide.ts   필요한 값만 받는 순수 판단
  <system>/apply.ts    판단 결과를 state에 반영
```

여러 스테이지가 공유하는 집중력과 충돌 시스템도 `src/game/systems/<system>/`에서 같은 구조를 사용합니다.

하늘 스테이지는 현재 별도 `state.ts` 대신 `sky/data.ts`에 `SkyState`를 정의합니다.

## Tick 순서

공용 `step.ts`의 `playStep`은 정해진 위치에서 현재 스테이지의 선택적 hook을 호출합니다. 전체 타입은 `stages/types.ts`의 `StageHooks`를 참조합니다.

```
공용 timer → timers → 누르고 있는 spray → takeover → hazards → beforeDrive
→ jump(onJump) → drive → 이동 → afterMove → 충돌 → afterCollide
→ checkpoint(checkpointsOpen) → 집중력 회복(focusBlocked) → 공용 점수와 대사
→ 추락(onFall) → 목표(definition.finishAtGoal)
```

Command hook은 `canJump`, `canSpray`, `onSpray`, `interact`, `leave`, `canInteract`입니다.

## 규칙

1. 다른 스테이지의 동작 코드를 import하지 않습니다. 다른 스테이지에서는 `data.ts`만 가져올 수 있습니다. 예를 들어 옥상 이륙은 하늘 스테이지의 도착 높이를 읽습니다.
2. 공용 코드는 스테이지 구현을 직접 import하지 않습니다. `stages/index.ts`, `stages/hooks.ts`, `stages/attempt.ts`, `stages/view.ts`를 통해 접근합니다.
3. `definition.ts`에는 데이터만 둡니다. 동작은 `hooks.ts`에 둡니다.
4. `src/game`에서 `Math.random`, `Date`, `performance`를 쓰지 않습니다. 난수는 `rng.ts`를 통해 `state.rng`에서 얻습니다.
5. decide/apply system에서 `decide.ts`는 state를 바꾸지 않습니다. 짝을 이루는 `apply.ts`가 결과를 씁니다.

`tests/structure.test.mjs`는 1번과 2번 규칙을 검사하고 각 스테이지의 핵심 파일이 있는지 확인합니다. `npm run lint`는 금지 API와 `decide.ts` import 경계를 검사합니다.

## 새 스테이지 추가

다음은 스테이지 5, 우주를 추가하는 예입니다.

1. `stages/space/`에 `data.ts`, `definition.ts`, `attempt.ts`, `hooks.ts`를 만듭니다.
2. `stages/space/state.ts`에 `SpaceState`와 `createSpaceState()`를 추가합니다.
3. 공용 index에 스테이지를 등록합니다.
   - `stages/index.ts`의 `STAGES`에 `5: space`를 추가합니다.
   - `stages/hooks.ts`에 `case 5: return spaceHooks;`를 추가합니다.
   - `stages/attempt.ts`에 `prepareSpaceAttempt(...)`와 `space: createSpaceState()`를 추가합니다.
   - `state.ts`의 `Attempt`에 `space: SpaceState;`를 추가합니다.
4. `types.ts`의 `StageId`에 `5`를 추가합니다.

## 함께 수정하는 파일

기능이 스테이지 경계를 넘으면 다음 파일도 수정할 수 있습니다. conflict를 줄이도록 PR을 작게 유지합니다.

| 파일 | 수정하는 경우 |
|---|---|
| `state.ts`의 `Attempt` | 스테이지 추가 |
| `types.ts`의 `CueId`, `Input` | 연출 신호나 입력 추가 |
| `game.ts`의 `viewState` | 화면에 값을 전달 |
| `i18n.ts` | 문구 추가 |
| `src/render/scene/*`, `src/ui/hud.ts` | 스테이지 화면 변경 |

## 동작 확인

- `npm test`를 실행합니다. `tests/golden.test.mjs`의 지문이 바뀌면 플레이 순서가 달라진 것입니다.
  - 리팩터링이라면 동작 회귀로 봅니다.
  - 의도한 플레이 변경이면 hash를 갱신하고 PR에 이유를 기록합니다.
- 일시정지 메뉴에서 replay 데이터를 내려받아 `/replay.html`에서 문제 tick을 확인합니다.
