# 스테이지 코드 작업 안내

각 스테이지의 코드는 `stages/<스테이지>/` 폴더 하나에 모여 있습니다. 서로 다른 스테이지를 맡은 사람은 **자기 폴더만 고치면** 되고, 다른 스테이지 파일과 충돌하지 않습니다.

| 폴더 | 스테이지 |
|---|---|
| `office/` | 1 · 사무실 (복사기, 물통, 간헐천, 쓰레기통, 모니터) |
| `building/` | 2 · 건물 내부 (회의실, 의자 행렬, 엘리베이터) |
| `rooftop/` | 3 · 기계실과 옥상 (출입문, 환풍구, 소화기, 이륙) |
| `sky/` | 4 · 구름 위 (발판 코스, 깊이 연출) |

## 스테이지 폴더의 구성

```
stages/<스테이지>/
  data.ts         레벨 수치와 대사 같은 고정 데이터 (deepFreeze)
  state.ts        이 스테이지가 시도 중에 바꾸는 값 (state.office / building / rooftop, 하늘은 state.sky)
  definition.ts   StageDefinition: 길이, 목표, 지형, 체크포인트, 등장인물, 규칙 플래그 (데이터만)
  attempt.ts      시도를 새로 만들 때 이 스테이지만의 시작 값
  hooks.ts        StageHooks: 공용 틱 사이에 끼어드는 이 스테이지의 동작
  <시스템>/decide.ts   순수 판단: 필요한 값만 받아 결과를 반환 (state를 바꾸지 않음)
  <시스템>/apply.ts    판단 결과를 state에 쓰는 유일한 곳
```

여러 스테이지가 함께 쓰는 시스템(집중력, 머리 충돌)은 `src/game/systems/<시스템>/`에 같은 형식으로 있습니다.

## 한 틱의 순서

공용 `step.ts`의 `playStep`이 아래 순서로 돌고, 현재 스테이지의 훅을 정해진 자리에서 부릅니다. 모든 훅은 선택 사항입니다(`stages/types.ts`의 `StageHooks` 참고).

```
공용 타이머 → timers → (분사) → takeover → hazards → beforeDrive
→ 점프(onJump) → drive → 이동 → afterMove → 충돌 → afterCollide
→ 체크포인트(checkpointsOpen) → 집중력 회복(focusBlocked) → 공용 점수·대사
→ 추락(onFall) → 목표 도착(definition.finishAtGoal)
```

명령에 대한 훅: `canJump`, `canSpray`, `onSpray`, `interact`, `leave`, `canInteract`

## 규칙

1. **다른 스테이지의 동작 코드를 가져오지 않습니다.** 다른 스테이지에서는 `data.ts`만 가져올 수 있습니다. 예: 옥상 이륙은 하늘 스테이지의 도착 높이를 씁니다.
2. **공용 코드는 스테이지 내부를 직접 가져오지 않습니다.** 공용 코드는 `stages/index.ts`(데이터 표), `stages/hooks.ts`(훅 선택), `stages/attempt.ts`(시도 준비), `stages/view.ts`(화면용 값)를 거칩니다.
3. **표(definition)에는 데이터만 넣습니다.** 동작은 `hooks.ts`에 둡니다.
4. **`src/game` 안에서는 `Math.random`, `Date`, `performance`를 쓰지 않습니다.** 난수는 `state.rng`(`rng.ts`)로 얻습니다.
5. **state는 `apply.ts`에서만 씁니다.** `decide.ts`는 입력을 바꾸지 않는 순수 함수입니다.

1, 2, 5번은 `tests/structure.test.mjs`가 검사하고, 4번은 `tests/core.test.mjs`가 검사합니다.

## 새 스테이지 추가하기 (예: 5 · 우주)

1. `stages/space/` 폴더에 `data.ts`, `definition.ts`, `attempt.ts`, `hooks.ts`를 만듭니다.
2. `stages/space/state.ts`에 `SpaceState`와 `createSpaceState()`를 만듭니다.
3. 아래 파일에 각각 한두 줄만 추가합니다.
   - `stages/index.ts`: `STAGES`에 `5: space`
   - `stages/hooks.ts`: `case 5: return spaceHooks;`
   - `stages/attempt.ts`: `case 5: return prepareSpaceAttempt(...)`, 그리고 `createStageStates`에 `space: createSpaceState()`
   - `state.ts`의 `Attempt`: `space: SpaceState;`
4. `types.ts`의 `StageId`에 `5`를 추가합니다.

## 아직 여러 스테이지가 함께 고치는 파일

다음 파일은 스테이지를 추가하거나 새 값을 넣을 때 함께 고치게 됩니다. 같은 줄을 동시에 고치지 않도록 PR을 작게 유지하세요.

| 파일 | 고치는 경우 |
|---|---|
| `state.ts`의 `Attempt` | 새 스테이지를 추가할 때만 한 줄 (스테이지 값은 각 `stages/<스테이지>/state.ts`에 있음) |
| `types.ts`의 `CueId`, `Input` | 새 연출 신호나 입력이 생길 때 |
| `game.ts`의 `viewState` | 화면에 새 값을 보여 줄 때 (화면 호환을 위해 예전 필드 이름으로 펼쳐 둠) |
| `i18n.ts` | 새 문구 |
| `src/render/scene/*`, `src/ui/hud.ts` | 화면 (렌더는 이미 스테이지별 파일로 나뉘어 있음) |

## 동작이 바뀌었는지 확인하기

- `npm test`: `tests/golden.test.mjs`의 지문이 바뀌면 플레이 진행이 달라진 것입니다.
  - 리팩터링이었다면 버그입니다.
  - 의도한 변경이면 해시를 갱신하고 PR에 이유를 적습니다.
- 리플레이: 게임 일시정지 메뉴에서 데이터를 내려받아 `/replay.html`에서 열면, 문제 구간을 틱 단위로 볼 수 있습니다.
