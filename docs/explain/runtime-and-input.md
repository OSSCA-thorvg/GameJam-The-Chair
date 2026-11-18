# 실행과 입력 코드 읽기

대상은 [main.ts](../../src/main.ts), [ui/input.ts](../../src/ui/input.ts), [ui/controls.ts](../../src/ui/controls.ts)입니다. 이 파일들은 브라우저에서 발생한 일을 게임 API에 전달합니다.

## main.ts는 게임을 조립한다

`main.ts`를 위에서부터 모두 읽으면 언어, 저장, 오류 처리가 먼저 나옵니다. 첫 번째 읽기에서는 `const game = createGame(...)`를 찾고, 연결한 콜백을 확인합니다.

- `onAttemptStart`는 새 시도의 시작 상태를 recorder에 전달합니다.
- `onCommand`는 입력 명령과 tick을 기록합니다.
- `onStep`은 실행한 상태를 recorder와 효과 관찰에 전달합니다.
- `onError`는 오류를 기록하고 진행을 멈추는 화면을 표시합니다.

`createGame`이 화면이나 저장소를 직접 알 필요가 없는 이유는 이 콜백 연결에 있습니다. 게임 코어는 실행 사실을 알리고, 브라우저 쪽에서 기록과 화면 반응을 정합니다.

그다음 `frame(ms)`를 읽습니다. 여기의 `ms`는 브라우저가 알려 준 프레임 시각입니다. 이전 시각과의 차이를 초로 바꾼 `dt`로 아래 중 하나를 진행합니다.

```ts
if (player.active) player.advance(dt);
else if (opening.active) opening.advance(dt);
else advanced = game.advance(dt);
```

리플레이가 열리면 실제 게임 대신 재생기가 진행합니다. 오프닝 중에는 오프닝만 진행합니다. 이 조건을 놓치면 입력했는데 실제 게임 시간이 흐르지 않는 이유를 이해하기 어렵습니다.

## draw는 데이터를 모아 화면에 전달한다

`draw()`의 시작에서는 `game.getSnapshot()`과 `game.drainEvents()`를 호출합니다. snapshot은 현재 보이는 상태이고 event는 방금 발생한 일입니다. 예를 들어 현재 위치는 snapshot에, 복사기 발사는 event에 들어갑니다.

리플레이를 보고 있다면 화면 입력을 재생기의 snapshot과 event로 바꿉니다. 실제 플레이에서는 event를 effects와 feedback에 전달한 뒤 renderer와 HUD를 갱신합니다. 오프닝 프레임이 있으면 일반 게임 장면 대신 오프닝 상태를 그립니다.

`draw()` 안의 진행 저장은 사망 수와 완료 stage만 저장합니다. 화면 snapshot 전체가 자동 저장되는 것은 아닙니다.

## ui/input.ts와 controls.ts의 분담

`bindInput`은 일시정지 메뉴, 시작 패널, 포커스 이동, 입력 차단을 관리합니다. 실제 키와 동작 연결은 `bindControls`에 맡깁니다. `AbortController`의 signal로 이벤트를 등록하므로 정리할 때 한꺼번에 해제할 수 있습니다.

`controls.ts`의 `CONTROLS`는 키 목록과 적용 조건을 가진 표입니다. `actionForKey`는 현재 `GameStatus`를 보고 유효한 동작을 찾습니다. 위쪽 방향키가 어떤 stage에서는 점프이고 비행 stage에서는 전진인 이유를 이 표와 `when` 조건에서 확인할 수 있습니다.

`HELD`에 있는 이동과 분사는 누른 상태를 유지합니다. 키를 누르면 `game.press`, 떼면 `game.release`를 호출합니다. 점프와 상호작용은 한 번 호출하는 동작이며 키 반복 입력을 제외합니다.

키 해제는 stage가 바뀌어도 처리합니다. 예를 들어 이전 stage에서 누른 방향키가 전환 뒤에도 계속 눌린 것으로 남지 않게 합니다. 창이 포커스를 잃으면 `clearInput`을 호출합니다.

## 연결을 확인하는 방법

`main.ts`의 `hintedGame`은 원래 game 메서드에 시각적 키 안내를 덧붙입니다. `jump()`에서 효과를 켜더라도 실제 점프 가능 여부는 코어가 검사합니다. 따라서 키 안내가 보였다는 사실만으로 점프 판정이 성공했다고 판단하지 않습니다.

이제 [상태와 고정 틱](state-and-ticks.md)에서 facade가 명령을 받은 뒤 무엇을 하는지 읽습니다.
