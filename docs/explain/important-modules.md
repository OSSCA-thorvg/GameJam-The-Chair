# 중요한 코드와 책임

`game`은 게임 결과를, `render`는 이미지를, `ui`는 브라우저 조작을 담당합니다. `main.ts`가 이 객체들을 연결합니다.

## 게임 코어

| 파일 | 하는 일과 읽을 부분 |
|---|---|
| `src/game/game.ts` | `createGame`이 현재 상태와 이벤트를 소유합니다. `send`는 명령을 즉시 적용하고 `advance`는 고정 틱을 실행합니다. |
| `src/game/state.ts` | `Progress`와 `Attempt`를 정의합니다. 생성, 복사, 시도 초기화, 직렬화, 복원을 담당합니다. |
| `src/game/commands.ts` | 입력을 `Command`로 표현하고 `runCommand`가 제어 의도를 적용합니다. |
| `src/game/step.ts` | `stepGame`이 상태 전이를 수행합니다. `playStep`은 공통 규칙과 stage hook의 실행 순서를 정합니다. |
| `src/game/physics.ts` | `drivePlayer`가 이동을, `collide`가 지형 접촉을 계산합니다. |
| `src/game/level.ts` | 공용 물리와 집중력, 시간 설정입니다. 수치 조정은 여기부터 확인합니다. |
| `src/game/rng.ts`, `src/game/math.ts` | 시드 난수와 결정적 수학으로 실행 재현성을 유지합니다. |
| `src/game/stages/types.ts` | 설정인 `StageDefinition`과 동작 연결점인 `StageHooks`를 정의합니다. |
| `src/game/stages/index.ts` | 다섯 stage를 등록하고 고정 설정의 해시를 계산합니다. |
| `src/game/stages/hooks.ts` | 현재 stage에 해당하는 동작을 선택합니다. |
| `src/game/stages/attempt.ts` | stage 상태를 만들고 체크포인트 기준으로 시도를 준비합니다. |
| `src/game/snapshot.ts` | 코어에서 분리된 화면용 데이터와 규칙 조회 결과를 만듭니다. |
| `src/game/replay.ts` | 기록 입력 검증, 명령과 해시 기록, 재생 커서와 타임라인을 담당합니다. |

집중력과 충격 시스템은 `game/systems`에 있습니다. stage 전용 시스템은 해당 stage 폴더에 있습니다. `decide.ts`의 판단 결과를 먼저 보고 `apply.ts`의 상태 변경을 읽으면 의도를 파악하기 쉽습니다. 명령과 hook에서도 상태를 바꾸므로 모든 쓰기가 `apply.ts`에만 있는 것은 아닙니다.

## 화면과 브라우저

| 파일 | 하는 일 |
|---|---|
| `src/render/renderer.ts` | 장면 선택, 카메라, viewport, 백엔드 수명, 그리기를 관리합니다. |
| `src/render/context.ts` | 그리기 문맥과 공유 자원을 만듭니다. |
| `src/render/types.ts` | path, text, fill, layer 효과의 명령 형식을 정의합니다. |
| `src/render/paint/commands.ts` | 순서를 유지하며 호환 layer 명령을 모읍니다. |
| `src/render/paint/thorvg.ts` | ThorVG Shape, Text, Scene, mask, blur를 적용하고 재사용합니다. 핵심 ThorVG 연동 코드입니다. |
| `src/render/thorvg.ts` | WASM, 글꼴, GL 또는 SW 백엔드를 초기화합니다. |
| `src/render/effects.ts` | 게임 이벤트와 관찰한 상태를 바탕으로 화면 효과를 관리합니다. |
| `src/ui/feedback.ts` | cue를 반응과 대사로 해석합니다. |
| `src/ui/hud.ts` | snapshot과 피드백으로 DOM 화면을 갱신합니다. |
| `src/ui/input.ts`, `src/ui/controls.ts` | 브라우저 조작을 facade 호출로 연결합니다. |
| `src/i18n.ts` | 영어와 한국어 메시지 및 언어 선택을 담당합니다. |

ThorVG 사용 예제는 장면의 layer 설정을 고른 뒤 `paint/thorvg.ts`까지 따라가며 읽습니다. 이 순서로 보면 mask나 blur를 사용하는 연출 목적과 실제 API 호출을 함께 이해할 수 있습니다. 시작 Lottie 재생은 `ui/splash.ts`의 별도 `Animation` 경로입니다.

## 미리보기와 검증 도구

[preview-scenes.ts](../../src/preview-scenes.ts)는 모션 목록입니다. 선택한 장면만 생성하고 캐시합니다. [preview/recording.ts](../../src/preview/recording.ts)는 게임과 효과를 기록해 앞뒤로 탐색할 수 있는 프레임을 만듭니다.

[replay-tool.ts](../../src/replay-tool.ts)는 독립 검사 페이지이고, [ui/replay-player.ts](../../src/ui/replay-player.ts)는 게임 안의 재생 기능입니다. [ui/replay-store.ts](../../src/ui/replay-store.ts)는 브라우저 저장과 오류 데이터를 다룹니다. 이 모듈들은 별도 게임 규칙 대신 같은 replay 코어를 사용합니다.

[tests/support/harness.mjs](../../tests/support/harness.mjs)는 브라우저 없이 공개 API를 구동하는 방법을 보여 줍니다. [tests/structure.test.mjs](../../tests/structure.test.mjs)는 실제로 강제되는 모듈 경계를 보여 줍니다.
