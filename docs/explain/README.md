# 처음 코드를 읽는 순서

이 게임은 일을 멈추지 않는 직원을 태운 의자가 회사를 탈출하는 게임입니다. 사무실, 건물, 옥상, 하늘, 궤도의 다섯 스테이지를 거칩니다. 코드를 읽을 때는 게임 판정, 화면 연출, 브라우저 연결을 구분하면 흐름을 따라가기 쉽습니다.

전체 구조는 [아키텍처 문서](../architecture/README.md), 구체적인 입력 흐름은 [점프 하나 따라가기](following-a-jump.md), 파일별 역할은 [중요한 코드](important-modules.md)에 정리했습니다.

## 파일별 코드 해설

아래 글은 실제 함수와 짧은 코드 발췌를 따라 입력, 상태 변경, 결과의 소비자를 설명합니다. 추천 순서와 함께 읽습니다.

1. [실행과 입력](runtime-and-input.md): `main.ts`, `input.ts`, `controls.ts`
2. [상태와 고정 틱](state-and-ticks.md): 타입, 상태, facade, 명령, 틱, 물리와 결정성
3. [사무실과 복사기](office-and-copier.md): stage hook, 판단과 적용, 종이 충돌
4. [상태를 장면으로 바꾸기](snapshot-and-scenes.md): snapshot, renderer, context, 사무실 장면
5. [그리기 명령과 ThorVG](drawing-and-thorvg.md): 명령 형식, layer 수집, 객체 재사용과 엔진 호출
6. [리플레이와 미리보기](replay-and-preview.md): 기록, 커서, seek, 테스트와 장면 캐시

## 추천 순서

1. 게임과 `/preview.html`을 먼저 실행합니다. 사무실 상호작용과 `sky-to-orbit`, `orbit-ending` 장면을 비교합니다. 물리 상태 변화와 카메라 연출을 구분해 봅니다.
2. [main.ts](../../src/main.ts)의 `createGame`, `draw`, `frame`을 읽습니다. 처음에는 저장과 오류 처리보다 어떤 객체를 만들고 연결하는지 봅니다.
3. [types.ts](../../src/game/types.ts)와 [state.ts](../../src/game/state.ts)를 읽습니다. `Mode`, `Input`, `GameEvent`, `Progress`, `Attempt`, `CoreState`를 찾습니다. 실제 상태의 `p`와 화면용 `player`가 다르다는 점을 확인합니다.
4. [game.ts](../../src/game/game.ts)의 `send`, `tick`, `advance`, `getSnapshot`, `drainEvents`를 읽습니다. 상태 소유자와 브라우저 시간이 고정 틱으로 바뀌는 지점을 찾습니다.
5. [commands.ts](../../src/game/commands.ts)에서 `jump`를 보고 [step.ts](../../src/game/step.ts)의 `playStep`을 따라갑니다. 명령 적용과 시간 진행이 별개라는 점을 확인합니다. 조기 반환 이후에는 어떤 처리를 건너뛰는지도 봅니다.
6. [office/hooks.ts](../../src/game/stages/office/hooks.ts)를 읽고 복사기 같은 상호작용 하나를 고릅니다. 해당 `decide.ts`의 판단 결과가 `apply.ts`에서 상태와 이벤트로 바뀌는 과정을 봅니다. 사무실 수치는 그다음 `level.ts`와 `office/definition.ts`에서 확인합니다.
7. [snapshot.ts](../../src/game/snapshot.ts), [renderer.ts](../../src/render/renderer.ts), [office/world.ts](../../src/render/scene/office/world.ts)를 읽습니다. 상태가 화면 좌표와 그리기 명령으로 바뀌는 지점을 찾습니다.
8. [paint.ts](../../src/render/paint.ts), [render/types.ts](../../src/render/types.ts), [paint/thorvg.ts](../../src/render/paint/thorvg.ts)를 읽습니다. gradient, mask, blur, scene transform이 실제 ThorVG 호출로 연결되는 부분을 확인합니다.
9. [replay.ts](../../src/game/replay.ts)와 [replay.test.mjs](../../tests/replay.test.mjs)를 읽습니다. 같은 시작 상태와 명령이 같은 결과를 내는지 어떻게 검사하는지 봅니다.

한 구간을 읽을 때마다 입력값, 바뀌는 상태나 반환값, 다음 소비자를 설명해 봅니다. 처음부터 모든 그림 좌표나 튜닝 상수를 외울 필요는 없습니다.

## 다른 스테이지를 읽는 방법

`game/stages/index.ts`에서 설정을, `game/stages/hooks.ts`에서 동작을 찾습니다. 개별 시스템보다 `hooks.ts`를 먼저 읽으면 실행 순서를 이해할 수 있습니다. 공통 의자 물리 대신 스테이지가 진행을 맡는 `takeover`를 특히 확인합니다.

화면 코드는 `render/scene`, 모션 예제는 `preview`에 있습니다. 화면에 보이는 조명이 피해 판정을 직접 수행하는 것은 아닙니다. 피해 규칙은 게임 스테이지의 시스템에서 찾습니다.

## 막힐 때 찾을 곳

- 입력 결과가 궁금하면 `ui/input.ts`에서 facade 메서드, command, stage hook 순서로 따라갑니다.
- 장애물 판정이 궁금하면 해당 stage의 `hazards`와 충돌 hook을 확인합니다.
- 게임 상태는 같은데 화면이 달라지면 effects, feedback, camera, scene 명령을 확인합니다.
- 리플레이가 달라지면 설정, 시작 상태, 같은 틱의 명령 순서, 최초 해시 불일치 지점을 확인합니다.
- 미리보기 장면을 찾으려면 `preview-scenes.ts`에서 id를 검색하고 `create()`를 따라갑니다.

`window.officeStageOne`은 이름과 달리 전체 게임의 브라우저 디버깅 API입니다. 실제 코어 구현은 아닙니다. `game.step(dt)`는 인자와 무관하게 고정 틱 하나를 진행합니다.
