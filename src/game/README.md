# 게임 코어 구조

`src/game`은 **결정적인 게임 코어**입니다. 같은 시작 상태와 같은 명령이면 항상 같은 결과가 나옵니다. 이 성질 덕분에 리플레이, 저장 후 이어 실행, 지문 테스트가 가능합니다.

```
입력(키·버튼) ─► createGame 껍데기 ─► stepGame(state, 명령) ─► 새 state + 이벤트 ─► 렌더·HUD·소리
                 (game.ts)            (step.ts, 1/120초)
```

## 핵심 규칙

게임 진행에 영향을 주는 값은 다음 셋 중 하나에만 둡니다.

| 어디에 | 무엇 | 파일 |
|---|---|---|
| **state** | JSON으로 저장할 수 있는 상태. 플레이어, 위험 요소, 타이머, 난수 상태, 틱 번호 | `state.ts`, `stages/*/state.ts` |
| **명령** | 틱 번호가 붙은 입력 (`keys`, `jump`, `spray`, `restart` 등) | `commands.ts` |
| **설정** | 고정된 레벨 데이터와 규칙 수치(`deepFreeze`). 해시가 `CONFIG_VERSION`이 됨 | `level.ts`, `stages/*/data.ts`, `stages/*/definition.ts` |

금지 사항(`npm run lint`와 테스트가 검사합니다):
- `src/game` 안에서 `Math.random`, `Date`, `performance`, `requestAnimationFrame`, `localStorage`를 쓰지 않습니다. 난수는 `state.rng`(`rng.ts`)로 얻습니다.
- `decide.ts`는 state를 바꾸지 않는 순수 함수입니다. state를 쓰는 곳은 `apply.ts`뿐입니다.
- 스테이지끼리는 다른 스테이지의 `data.ts`만 가져옵니다. 자세한 내용은 [stages/README.md](stages/README.md)에 있습니다.

## 파일 구성

| 파일 | 역할 |
|---|---|
| `state.ts` | `Progress`(재시작해도 유지)와 `Attempt`(시도마다 새로 만듦), `createAttempt`, 복사 |
| `step.ts` | `stepGame(state, commands)`: 한 틱. 입력 state는 바꾸지 않음. `switch(mode)`, 공용 `playStep` |
| `physics.ts` | 바퀴 구동, 중력, 마찰, 충돌. 수치는 `level.ts`의 `PHYSICS` |
| `commands.ts` | 명령 적용 |
| `systems/<시스템>/` | 스테이지가 함께 쓰는 시스템(집중력, 머리 충돌): `decide.ts` + `apply.ts` |
| `stages/<스테이지>/` | 스테이지별 데이터, 상태, 훅, 시스템 |
| `rng.ts` | 시드 난수. `physics` 흐름과 `cosmetic`(외형) 흐름을 따로 씀 |
| `replay.ts` | 리플레이 기록, 검증, 타임라인 |
| `game.ts` | `createGame` 껍데기: state 보관, 실제 시간을 고정 틱으로 변환, 기록 훅, 이벤트 전달. 화면용 스냅샷 `getSnapshot()`은 프레임당 한 번, UI 판단에는 복사 없는 `status()`를 씀 |

## 시스템 작성 방법

```ts
// decide.ts: 필요한 값만 받고 결과를 반환합니다. 입력은 바꾸지 않습니다.
export function geyserHits(p: Readonly<Point>, time: number, rng: number): GeyserHit[]

// apply.ts: 결과를 state에 씁니다. 집중력 피해는 applyFocusHit으로 넘깁니다.
export function applyGeyserHits(s: GameState, out: GameEvent[], hits: readonly GeyserHit[])
```

- 플레이어를 바꿀 때는 `setPlayer(s, p)`를 씁니다. 같은 객체에 값을 덮어씁니다. 틱 도중에 다른 코드가 같은 객체를 들고 있기 때문입니다.
- 연출 신호(효과음, 대사)는 state에 넣지 않고 `out` 배열에 `GameEvent`로 내보냅니다.

## 확인 방법

| 명령 | 확인하는 것 |
|---|---|
| `npm run typecheck` | 타입 |
| `npm run lint` | 금지 API, 순수 함수 규칙 |
| `npm test` | 전체 테스트 (아래 테스트 포함) |
| `npm run test:fast` | 오래 걸리는 시뮬레이션 테스트를 뺀 빠른 확인 |
| `npm run golden:update` | 지문 해시 갱신. **의도한 동작 변경일 때만** 쓰고, PR에 이유를 적습니다 |
| `npm run replay:check -- <파일>` | 리플레이나 데이터 파일을 Node에서 다시 실행해 해시 차이와 에러 재현 여부 확인 |

### 지문(골든) 테스트

`tests/golden.test.mjs`는 정해진 6개 플레이 시나리오에서 모든 틱의 모드, 플레이어, 집중력, 이벤트와 마지막 화면 스냅샷을 해시로 저장해 둔 것입니다.

- **리팩터링**이었는데 지문이 바뀌면 동작이 달라졌다는 뜻이므로 버그입니다.
- **의도한 변경**(수치 조정, 새 장애물)이면 `npm run golden:update`로 갱신하고, 테스트 파일 주석과 PR에 이유를 적습니다.

### 리플레이로 문제 보기

게임의 일시정지 메뉴 → 리플레이 → **데이터 내려받기**로 받은 파일을 `/replay.html`에서 열면, 틱 단위로 재생하면서 state를 확인할 수 있습니다.
