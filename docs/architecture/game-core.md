# 게임 코어

`src/game`은 DOM, 브라우저 시계, 저장소에 접근하지 않는 결정적 코어입니다. 입력 state를 직접 바꾸지 않고 새 state와 `GameEvent[]`를 반환합니다.

## 상태와 전이

| 개념 | 위치 | 역할 |
|---|---|---|
| `Progress` | `state.ts` | 시도와 스테이지가 바뀌어도 유지되는 진행도와 전체 실행의 tick |
| `Attempt` | `state.ts` | 현재 시도의 모드, 플레이어, 타이머, 다섯 스테이지 상태 |
| `CoreState` | `state.ts` | `Progress & Attempt`인 전체 직렬화 상태 |
| `Command` | `commands.ts` | keys, jump, spray, pause, restart, startStage 같은 입력 |
| `GameEvent` | `types.ts` | 대사, 효과, 상태 안내를 프레젠테이션에 전달 |
| `stepGame()` | `step.ts` | 명령을 적용하고 고정 틱 하나를 진행하는 순수 경계 |
| `createGame()` | `game.ts` | 현재 상태, 시간 누적값, 이벤트, 기록 훅을 보관하는 facade |

`stepGame()`과 `applyCommand()`은 입력 state를 복사한 뒤 복사본만 바꿉니다. 전이 중 예외가 발생해도 이전 state는 그대로 남습니다. `getSnapshot()`도 호출자가 소유하는 복사본을 반환합니다.

## 한 틱의 순서

`stepGame()`은 먼저 전달받은 명령을 순서대로 적용하고 현재 `mode`를 진행합니다. 일반 `play` 모드의 `playStep()` 순서는 다음과 같습니다.

1. 이전 플레이어 프레임을 history에 저장하고 공용 타이머를 갱신합니다.
2. 스테이지 `timers`와 held spray를 처리하고 `tick` 이벤트를 냅니다.
3. `takeover`와 `hazards`를 실행합니다.
4. 점프 버퍼와 coyote time을 갱신하고 `beforeDrive`, 점프, `onJump`를 실행합니다.
5. 스테이지 `drive` 보정을 적용하고 `drivePlayer()`로 이동합니다.
6. `afterMove`, `collide()`, 머리 충돌, `afterCollide`를 처리합니다.
7. 체크포인트, 집중력 회복, 공용 이동 기록과 대사, `afterScore`를 처리합니다.
8. 추락의 `onFall` 또는 목표 도착을 처리합니다.

`takeover`, `hazards`, `afterMove`, 충돌에 따른 모드 변경은 뒤 단계를 건너뛸 수 있습니다. 훅을 추가할 때는 실행 위치와 조기 반환을 함께 확인합니다.

## 스테이지 구성

`stages/index.ts`의 `STAGES`는 각 `StageDefinition`을 모읍니다. definition에는 길이, 지형, 목표, 체크포인트, 등장인물, 규칙 플래그만 둡니다. 동작은 각 스테이지의 `hooks.ts`에 둡니다.

| 스테이지 | 폴더 | 주요 규칙 |
|---|---|---|
| 1 | `stages/office` | 복사기, 물통, 간헐천, 쓰레기통, 모니터 |
| 2 | `stages/building` | 회의실, 의자 행렬, 엘리베이터 |
| 3 | `stages/rooftop` | 입구, 환풍구, 소화기, 이륙 |
| 4 | `stages/sky` | 공중 이동, 발판, 깊이 전환과 출발 |
| 5 | `stages/orbit` | 궤도 비행, 위성 조명, 엔딩 |

공용 코드는 `stages/index.ts`, `hooks.ts`, `attempt.ts`, `view.ts`를 통해 스테이지에 접근합니다. 스테이지는 다른 스테이지의 동작을 import하지 않고 고정 데이터만 참조할 수 있습니다.

위험 요소는 보통 `decide.ts`와 `apply.ts`로 나뉩니다. `decide.ts`는 필요한 값만 받고 결정을 반환합니다. `apply.ts`는 결정을 state와 이벤트에 반영합니다. 명령, 공통 틱, 스테이지 훅도 이미 복사된 state를 조정하므로 모든 쓰기가 `apply.ts`에만 있는 것은 아닙니다.

`takeover`와 `afterMove`는 `true`일 때 틱을 끝내고, `hazards`는 `false`일 때 끝냅니다. 반환값을 같은 의미로 해석하면 실행 순서를 잘못 이해할 수 있습니다.

`stages/attempt.ts`는 스테이지 상태 생성과 시도 준비를 담당하고, `stages/view.ts`는 스테이지별 화면 투영을 내보냅니다.

## 결정성과 리플레이

코어의 시간은 `tick`과 `time`으로 구분합니다. `tick`은 전체 실행에서 계속 증가하고, `time`은 시도를 다시 시작하면 초기화됩니다. 물리와 외형용 RNG 흐름도 `CoreState`에 들어 있습니다.

고정 설정은 `deepFreeze()`되며 설정 JSON의 해시가 `CONFIG_VERSION`이 됩니다. 실행 코드만 바뀌면 `CONFIG_VERSION`은 바뀌지 않을 수 있으므로 리플레이는 주기적인 state 해시도 비교합니다.

리플레이 파일은 시작 `CoreState`, `[tick, Command]` 목록, 주기적 해시, 종료 tick을 저장합니다. `buildTimeline()`은 파일을 열 때 전체 시도를 실행해 keyframe과 marker를 만들고 divergence를 찾습니다. keyframe은 파일에 저장하지 않습니다.

## 수정할 때 지킬 계약

- 플레이에 영향을 주는 값은 직렬화 가능한 state, 명시적 command, 고정 config 중 하나에 둡니다.
- 코어 난수는 `Math.random()` 대신 `state.rng`를 사용합니다.
- 플레이어를 갱신할 때는 `setPlayer()`를 사용합니다. 한 틱 동안 유지되는 객체 참조가 있기 때문입니다.
- 체크포인트는 전체 월드를 저장하지 않습니다. 재시작에 필요한 진행 위치와 규칙만 저장합니다.
- `parseState()`와 `parseReplay()`는 전체 스키마를 검증하지 않습니다. 외부 파일을 신뢰 가능한 state로 간주하지 않습니다.

구현 규칙과 새 스테이지 추가 절차는 [`src/game/README.md`](../../src/game/README.md)와 [`src/game/stages/README.md`](../../src/game/stages/README.md)를 참조합니다.

## 화면용 상태와 복원

`src/game/snapshot.ts`의 `viewState()`는 코어의 `p`를 화면용 `player`로 복사합니다. 사무실, 건물, 옥상은 각각의 `view.ts`로 투영하고 하늘 상태는 직접 복제합니다. 궤도 상태는 5스테이지에서만 제공합니다. `game.status()`는 모드와 스테이지 등 필요한 일부 값만 반환합니다.

현재 `REPLAY_FORMAT`은 5입니다. 해시 계산 전 중첩 객체의 키를 재귀적으로 정렬하며 배열 순서는 유지합니다. 키 순서에 의존하던 이전 형식은 읽기를 거부합니다. `parseState()`는 JSON 파싱 후 `assertGameState()`를 호출합니다. 리플레이의 입력 제한과 검증은 `parseReplay()`에서 확인합니다. 검증 범위를 벗어난 파일까지 안전하다고 가정하지 않습니다.

난수는 `rng.ts`의 물리 및 외형 스트림을 사용합니다. 브라우저마다 오차가 달라질 수 있는 삼각함수 등은 `math.ts`의 결정적 구현을 사용합니다.
