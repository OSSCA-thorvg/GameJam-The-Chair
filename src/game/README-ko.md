# 게임 코어 구조

[English](README.md) | [한국어](README-ko.md)

`src/game`은 결정적인 게임 코어입니다. 같은 시작 상태와 같은 명령이면 항상 같은 결과가 나옵니다. 이 성질 덕분에 리플레이, 저장 후 이어 실행, 플레이 지문 검사가 가능합니다.

```
입력(키·버튼) ─► createGame facade ─► stepGame(state, 명령) ─► 새 state + 이벤트 ─► 렌더러와 HUD
                 (game.ts)            (step.ts, 1/120초)
```

## 핵심 규칙

게임 진행에 영향을 주는 값은 다음 셋 중 하나에만 둡니다.

| 구분 | 내용 | 파일 |
|---|---|---|
| **State** | JSON으로 저장할 수 있는 플레이어, 위험 요소, 타이머, RNG, tick 데이터 | `state.ts`, 스테이지 state module |
| **Command** | tick 번호가 붙은 `keys`, `jump`, `spray`, `restart` 같은 입력 | `commands.ts` |
| **Configuration** | 고정된 레벨 데이터와 규칙 수치. 해시가 `CONFIG_VERSION`이 됨 | `level.ts`, `stages/*/data.ts`, `stages/*/definition.ts` |

`npm run lint`와 테스트는 다음 제한을 검사합니다.

- `src/game`에서 `Math.random`, `Date`, `performance`, `requestAnimationFrame`, `localStorage`를 쓰지 않습니다. 난수는 `rng.ts`를 통해 `state.rng`에서 얻습니다.
- 시스템의 `decide.ts`는 필요한 값만 받아 결정을 반환합니다. 짝을 이루는 `apply.ts`가 결과를 state에 씁니다.
- 스테이지는 다른 스테이지의 `data.ts`만 가져올 수 있습니다. 자세한 내용은 [스테이지 안내](stages/README-ko.md)를 참조합니다.

## 파일 구성

| 파일 | 역할 |
|---|---|
| `state.ts` | 시도 사이에 유지되는 `Progress`, 매 시도 다시 만드는 `Attempt`, state 생성과 복사 |
| `step.ts` | `stepGame(state, commands)`, mode switch, 공용 `playStep`. 입력 state를 바꾸지 않음 |
| `physics.ts` | `level.ts`의 `PHYSICS`를 사용하는 바퀴 구동, 중력, 마찰, 충돌 |
| `commands.ts` | Command 적용 |
| `systems/<system>/` | 여러 스테이지가 공유하는 집중력과 충돌 시스템. `decide.ts`와 `apply.ts`로 분리 |
| `stages/<stage>/` | 스테이지별 데이터, state, hook, system |
| `rng.ts` | seed 기반 `physics`와 `cosmetic` 난수 흐름 |
| `replay.ts` | 리플레이 기록, 검증, 타임라인 |
| `game.ts` | `createGame` facade. state 보관, 고정 틱 누적, 기록 hook, event, 화면 snapshot 담당 |

`getSnapshot()`은 프레임마다 화면 snapshot을 한 번 만듭니다. UI 판단에는 할당하지 않는 `status()`를 사용합니다.

## 시스템 작성 방법

```ts
// decide.ts는 필요한 값만 받고 입력을 바꾸지 않습니다.
export function geyserHits(p: Readonly<Point>, time: number, rng: number): GeyserHit[]

// apply.ts는 결과를 state에 쓰고 집중력 피해를 전달합니다.
export function applyGeyserHits(s: GameState, out: GameEvent[], hits: readonly GeyserHit[])
```

- 플레이어는 `setPlayer(s, p)`로 갱신합니다. 틱 도중 다른 코드가 같은 객체를 들고 있으므로 기존 객체의 값을 덮어씁니다.
- 효과와 대사 같은 연출 신호는 state에 넣지 않고 `out`에 `GameEvent`로 내보냅니다.

## 변경 확인

| 명령 | 확인 내용 |
|---|---|
| `npm run typecheck` | TypeScript 타입 |
| `npm run lint` | 금지 API와 `decide.ts` import 규칙 |
| `npm test` | 전체 테스트 |
| `npm run test:fast` | 오래 걸리는 simulation을 제외한 테스트 |
| `npm run golden:update` | 지문 갱신. 의도한 동작 변경에만 실행하고 PR에 이유를 기록 |
| `npm run replay:check -- <파일>` | 단일 replay 파일 또는 legacy error log를 다시 실행해 hash 차이와 오류 재현 여부 확인 |

### Golden 테스트

`tests/golden.test.mjs`는 정해진 여섯 플레이 시나리오에서 모든 tick의 mode, player, focus, event와 마지막 화면 snapshot을 hash로 저장합니다.

- 리팩터링 중 지문이 바뀌면 동작 회귀입니다.
- 의도한 규칙이나 레벨 변경이면 `npm run golden:update`를 실행하고 테스트 주석과 PR에 이유를 기록합니다.

### 리플레이 확인

일시정지 메뉴에서 **리플레이**를 열고 **데이터 내려받기**를 선택합니다. 내려받은 파일을 `/replay.html`에서 열어 tick 단위 재생과 state를 확인합니다.
