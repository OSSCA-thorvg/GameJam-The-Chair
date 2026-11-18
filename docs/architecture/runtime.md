# 실행 흐름

## 초기화

브라우저는 `index.html`에서 `src/main.ts`를 불러옵니다. `main.ts`는 다음 순서로 게임을 조립합니다.

1. `src/scene.html`을 `#app`에 넣습니다.
2. 브라우저 언어와 `localStorage`에서 언어와 진행도를 읽습니다.
3. `crypto.getRandomValues()`로 실행 시드를 만듭니다.
4. `createRecorder()`와 `createGame()`을 연결합니다.
5. `createEffects()`, `createFeedback()`, 리플레이 플레이어, 입력, HUD, 렌더러를 만듭니다.
6. `requestAnimationFrame(frame)`을 시작합니다.

`main.ts`는 브라우저 의존성을 모으는 composition root입니다. 게임 규칙은 이 파일에 넣지 않습니다.

`?stage=1`부터 `?stage=5`까지 지정하면 해당 스테이지를 바로 시작하며 시작 스플래시를 건너뜁니다. 스플래시가 보이는 동안 프레임 루프는 시간 기준을 초기화하고 게임을 진행하지 않습니다. 오프닝과 리플레이는 각각 별도의 재생 객체가 시간을 진행합니다.

## 입력에서 상태까지

`bindInput()`은 메뉴와 포커스를 관리하고 `bindControls()`에 실제 조작을 맡깁니다. 키보드와 터치 입력은 `game.press()`, `game.release()`, `game.jump()`, `game.spray()` 같은 facade 메서드를 호출합니다.

각 메서드는 다음 흐름을 거칩니다.

1. `createGame.send()`가 현재 `tick`과 `Command`를 recorder에 알립니다.
2. `applyCommand()`가 현재 상태를 복사합니다.
3. `runCommand()`가 복사본에 명령을 적용하고 `GameEvent[]`를 반환합니다.
4. `createGame`이 새 상태를 보관하고 이벤트를 대기열에 넣습니다.

명령은 다음 틱을 기다리지 않고 현재 틱에 적용됩니다. 같은 틱의 여러 명령은 들어온 순서를 유지합니다.

## 프레임과 고정 틱

`frame(ms)`는 이전 브라우저 프레임과의 시간 차이를 초로 계산합니다. 리플레이가 열려 있으면 `player.advance(dt)`, 오프닝 중이면 `opening.advance(dt)`, 그 밖에는 `game.advance(dt)`를 호출합니다.

`game.advance(dt)`는 한 프레임에서 최대 0.25초만 받아들이고 초과분을 버립니다. 반환값은 실행한 틱 수와 버린 시간을 포함합니다. 시간을 누적한 뒤 `1/120`초마다 `stepGame()`을 실행합니다. `play`, `impact`, `focuslost` 모드만 자동으로 진행합니다. `intro`, `pause`, `dead`, `won`은 명령을 기다립니다. 틱 도중 모드가 바뀌면 남은 누적 시간을 버리고 다음 브라우저 프레임에서 새 모드를 진행합니다.

`game.step()`은 인자를 무시하고 고정 틱 하나만 실행합니다. 테스트와 미리보기에서 이 계약을 사용합니다.

## 상태에서 화면까지

각 브라우저 프레임의 `draw()`는 다음 순서로 동작합니다.

1. `game.getSnapshot()`으로 코어와 분리된 화면용 상태를 받습니다.
2. `game.drainEvents()`로 아직 소비하지 않은 이벤트를 가져옵니다.
3. 실제 플레이 이벤트를 `effects.receive()`와 `feedback.receive()`에 보냅니다.
4. `renderer.draw()`가 장면을 그리고 viewport를 반환합니다.
5. `hud.draw()`가 DOM HUD, 대사, 메뉴를 갱신합니다.

리플레이는 자체 상태, 이벤트, 효과, 피드백을 사용합니다. 실제 플레이의 연출과 리플레이 연출은 섞이지 않습니다.

## 저장과 오류 경계

일반 진행 저장은 `deaths`와 `completedStage`만 `localStorage`에 기록합니다. recorder는 시도 시작 상태, 명령, 해시, 오류를 별도 브라우저 데이터로 보관합니다.

코어 오류는 recorder와 오류 로그에 남고 다시 throw됩니다. 렌더러와 HUD 오류는 `draw()` 경계에서 한 번 기록하며 시뮬레이션을 멈추지 않습니다. ThorVG 초기화가 실패하면 Canvas2D fallback을 사용합니다. 초기화 이후 paint가 실패하면 자동으로 fallback으로 전환하지 않습니다.

`window.officeStageOne`은 디버깅 API입니다. 이 API는 실제 코어 상태 대신 복사된 snapshot과 recorder 데이터를 노출합니다.

## 정리와 화면 전환

실제 플레이와 리플레이 표시가 전환되면 `renderer.resetView()`로 카메라 이력을 초기화합니다. 루트 DOM이 제거되면 입력과 화면 방향 바인딩을 해제하고 오프닝, 리플레이, 렌더러, 성능 표시 자원을 정리합니다.

코어 명령이나 틱에서 오류가 발생하면 `main.ts`는 시뮬레이션 진행을 중단하고 다시 시작 패널을 표시합니다. 일반 진행 저장 키는 `the-chair-office-v1`이며 현재 위치나 전체 시도를 저장하지 않습니다.
