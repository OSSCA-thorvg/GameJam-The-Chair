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
- `src/game`에서 엔진마다 근사가 다른 `Math` 함수(`sin`, `cos`, `tan`, `exp`, `atan2`, `hypot`, `pow`/`**`, `log` 등)를 쓰지 않습니다. 브라우저마다 마지막 비트가 달라 한 브라우저에서 녹화한 리플레이가 다른 브라우저에서 어긋납니다. `math.ts`의 비트 단위 결정적 함수(`import * as Det from './math'`)를 사용합니다. `+ - * /`, `Math.sqrt`, `round`, `floor`, `abs`, `min`, `max`는 모든 엔진에서 정확합니다.
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
| `math.ts` | 모든 브라우저에서 같은 비트를 내는 `sin`, `cos`, `tan`, `exp`, `atan2`, `hypot` |
| `replay.ts` | 리플레이 기록, 검증, 타임라인 |
| `game.ts` | `createGame` facade. state 보관, 고정 틱 누적, 기록 hook, event 담당 |
| `snapshot.ts` | 화면 snapshot 조립과 필요한 입력만 받는 공용 projection |

`getSnapshot()`은 프레임마다 화면 snapshot을 한 번 만듭니다. UI 판단에는 할당하지 않는 `status()`를 사용합니다.

`viewState`는 게임 규칙과 지형을 먼저 조회한 뒤 표시 데이터를 조립합니다. 공용 projection은 선택한 입력 필드만 받으며, 스테이지 projection은 `stages/<stage>/view.ts`에 두고 `stages/view.ts`로 공개합니다. 각 projection의 반환 객체와 배열은 원본 및 다른 snapshot과 공유하지 않습니다. 단순 복사만 필요한 하늘·궤도 데이터는 별도 전달 함수 없이 조립 경계에서 직접 복사합니다.

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

`tests/golden.test.mjs`는 정해진 여섯 플레이 시나리오에서 모든 tick의 mode, player, focus, event와 마지막 화면 snapshot을 hash로 저장합니다. 객체 키를 정렬해 hash를 만들며, 배열 순서와 값의 차이는 유지합니다.

- 리팩터링 중 지문이 바뀌면 동작 회귀입니다.
- 의도한 규칙이나 레벨 변경이면 `npm run golden:update`를 실행하고 테스트 주석과 PR에 이유를 기록합니다.

### 리플레이 확인

일시정지 메뉴에서 **리플레이**를 열고 **데이터 내려받기**를 선택합니다. 내려받은 파일을 `/replay.html`에서 열어 tick 단위 재생과 state를 확인합니다.

## 해시의 키 순서와 리플레이 호환성

`data.ts`는 설정과 게임 상태를 해싱하기 전에 중첩 객체의 키를 재귀적으로 정렬합니다. 배열 순서는 유지하며 입력 객체는 변경하지 않습니다. golden 테스트도 같은 정규화 함수를 사용합니다.

리플레이 형식 5부터 키 순서에 독립적인 해시를 사용합니다. 이전 형식의 해시는 계산 규칙이 달라 읽기를 거부합니다. 일반 상태 직렬화의 JSON 형식은 유지합니다.
