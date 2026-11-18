# 점프 하나 따라가기

점프 입력 하나를 따라가면 브라우저, 게임 규칙, 화면 출력의 경계를 볼 수 있습니다. 아래는 공통 의자 이동 경로입니다. 스테이지가 `takeover`로 이동을 직접 처리하는 경우에는 해당 hook도 확인합니다.

## 입력을 명령으로 바꾸기

[ui/input.ts](../../src/ui/input.ts)는 키보드와 포인터 조작을 연결합니다. `main.ts`의 점프 wrapper는 `effects.pressKey('jump')`로 키 안내를 켜고 `game.jump()`를 호출합니다. 키 안내와 점프 가능 여부는 서로 다른 코드가 담당합니다.

`game.jump()`는 `{ type: 'jump' }`를 보냅니다. `createGame`의 `send`는 현재 tick과 명령을 먼저 recorder에 기록한 뒤 `applyCommand`를 호출합니다. `applyCommand`는 상태를 복사하고 `commands.ts`의 `runCommand`에 처리를 맡깁니다.

명령은 현재 틱에서 즉시 적용됩니다. 같은 틱에 여러 명령이 들어오면 기록된 순서를 유지합니다.

## 명령과 물리 진행 구분하기

`commands.ts`의 `jump`는 모드와 stage의 `canJump`를 검사한 뒤 `jumpQ`를 설정합니다. 입력 시점에 곧바로 위치를 이동시키는 방식은 아닙니다.

다음 고정 틱의 `playStep`은 점프 버퍼와 coyote time을 갱신합니다. 둘 다 남아 있으면 위쪽 속도와 회전을 적용하고 지상 상태를 해제합니다. `onJump`를 호출한 뒤 버퍼를 소모합니다.

점프 버퍼는 착지 직전의 입력을 받아 주고, coyote time은 발판을 벗어난 직후에도 잠깐 점프를 허용합니다. 두 값이 상태에 포함되므로 리플레이도 같은 입력 허용 시간을 사용합니다.

`drivePlayer`가 이동을 계산하고 `collide`가 지형 충돌을 해결합니다. 머리 충돌이 발생하면 impact 처리로 넘어가 일반 틱의 남은 부분을 건너뛸 수 있습니다.

## 상태를 화면으로 바꾸기

`createGame`은 전이 결과를 새 현재 상태로 보관합니다. `getSnapshot()`은 `viewState()`를 통해 코어의 `p`를 화면용 `player`로 복사합니다.

`main.ts`는 snapshot과 효과를 `renderer.draw`에 전달합니다. 렌더러는 stage에 맞는 장면을 선택하고 `RenderCtx`를 만듭니다. 장면과 플레이어 함수는 path, text, layer 명령을 쌓습니다.

`paint.ts`는 초기화된 ThorVG가 있으면 `paint/thorvg.ts`에 명령을 전달합니다. 해당 코드는 도형과 scene을 만들거나 재사용하고 스타일과 효과를 적용한 뒤 렌더링합니다. ThorVG가 준비되지 않았으면 Canvas2D 경로를 사용합니다.

플레이어 위치와 속도는 게임 판정입니다. 카메라, motion blur, 키 안내, 대사 표시는 연출입니다. 브라우저 프레임 속도가 달라도 코어 점프를 재현할 수 있는 이유가 이 경계에 있습니다.

## 확인할 테스트와 도구

[core.test.mjs](../../tests/core.test.mjs)와 [game.test.mjs](../../tests/game.test.mjs)는 시뮬레이션을, [snapshot.test.mjs](../../tests/snapshot.test.mjs)는 화면용 상태 경계를 확인합니다. [paint.test.mjs](../../tests/paint.test.mjs)는 그리기 동작을 검사합니다. replay와 determinism 테스트는 명령 재현성을 확인합니다.

화면 연출은 `/preview.html`에서 장면을 선택해 확인합니다. 실제 플레이 문제는 기록 파일을 `/replay.html`로 열고 입력 전후 tick의 상태를 비교합니다.
