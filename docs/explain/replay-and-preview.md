# 리플레이와 미리보기 코드 읽기

대상은 [game/replay.ts](../../src/game/replay.ts), [replay.test.mjs](../../tests/replay.test.mjs), [preview-scenes.ts](../../src/preview-scenes.ts), [preview/registration.ts](../../src/preview/registration.ts), [preview/recording.ts](../../src/preview/recording.ts)입니다.

## 리플레이는 동영상 대신 실행 재료를 기록한다

리플레이 파일에는 시작 상태, `[tick, Command]` 목록, 주기적인 상태 해시, 종료 tick과 오류 정보가 있습니다. 그림을 저장하지 않으므로 같은 코어를 다시 실행해야 재생할 수 있습니다.

`createRecorder`의 `onAttemptStart`는 이전 시도를 끝내고 새 시작 상태를 저장합니다. `onCommand`는 명령을 복사해 저장합니다. `onStep`은 종료 tick을 갱신하고 정해진 간격마다 상태 해시를 남깁니다.

재시도를 일으킨 명령은 이전 시도의 끝으로 기록될 수 있습니다. `finish`는 끝에 붙은 reset, restart, startStage 명령을 제거해 이전 시도 리플레이가 다음 시도로 넘어가지 않게 합니다. `game.ts`가 명령을 적용하기 전에 recorder에 알리는 순서와 함께 읽어야 합니다.

해시는 `data.ts`의 `canonicalJson`으로 중첩 객체의 키를 정렬한 뒤 계산합니다. 필드 작성 순서만 바뀌어도 같은 상태로 판단하지만 배열 순서는 여전히 의미가 있습니다. 리플레이 형식은 5이며 이전 해시 규칙을 사용하는 형식은 거부합니다.

## createCursor는 다음에 할 일을 고른다

커서는 현재 `state`와 다음 명령의 `index`를 보관합니다. `pending()`은 세 결과 중 하나를 돌려줍니다.

- 현재 tick에 실행할 명령이 있으면 `command`입니다.
- 더 진행할 수 있는 시뮬레이션이면 `step`입니다.
- 종료 tick에 도착했거나 진행할 모드가 아니면 `end`입니다.

`next()`는 명령이면 `applyCommand`, 시간 진행이면 `stepGame`을 호출합니다. 같은 tick에 명령이 여러 개 있으면 tick을 올리기 전에 차례대로 실행합니다. 일시정지 상태라도 현재 tick의 해제 명령이 있으면 명령을 먼저 처리할 수 있습니다.

## buildTimeline은 검사하며 탐색 지점을 만든다

`buildTimeline`은 커서로 시도를 실행하면서 keyframe과 marker를 만듭니다. keyframe은 중간 상태와 명령 index의 쌍입니다. marker는 사망, 초기화, 체크포인트, 클리어, 오류나 해시 불일치의 위치입니다.

실행한 상태의 해시가 파일의 기대값과 처음 달라진 tick을 `divergedAt`으로 기록합니다. `versionMismatch`는 설정 해시가 다른지 표시합니다. 코드만 바뀌면 설정 해시는 그대로일 수 있으므로 둘은 서로 다른 검사입니다.

`seekTimeline`은 목표 tick 이전의 가까운 keyframe을 골라 거기서 다시 실행합니다. 과거 상태로 역산하지 않습니다. 목표 tick에 도착하는 step 직후이며 그 tick의 명령을 적용하기 전 위치를 반환한다는 계약도 코드 주석에서 확인합니다.

## replay.test.mjs는 관찰 가능한 기록을 확인한다

파일의 `held keys are recorded only when they change` 테스트를 읽어 봅니다. 오른쪽 키를 여러 번 눌러도 눌린 키 목록이 바뀌지 않으면 명령을 추가로 기록하지 않습니다.

기대 기록은 tick 0의 reset, tick 0의 오른쪽 누름, tick 1의 키 해제입니다. `release('left')`처럼 누르지도 않은 키를 해제하는 호출이 기록에 들어가지 않는 것도 확인합니다. 내부 함수 호출 횟수보다 실제 기록 결과를 검사하는 테스트입니다.

파일 앞의 `testRealtimeReplay(1)`과 `(2)`는 공유 helper에서 긴 재생 검사를 등록합니다. 이 테스트의 자세한 실행은 [realtime-replay.mjs](../../tests/support/realtime-replay.mjs)에서 읽습니다.

## 모션 미리보기는 장면 단위로 생성한다

`preview-scenes.ts`는 `id`, `label`, `create`를 등록합니다. `create`는 장면을 만들 함수이므로 목록을 만드는 것만으로 전체 장면을 기록하지 않습니다.

`cachePreviewRegistration`의 핵심은 다음 한 줄입니다.

```ts
create: () => (cached ??= registration.create())
```

`cached`가 없을 때만 장면을 만들고, 이후 선택에서는 같은 장면을 돌려줍니다. 메뉴를 열 때 모든 긴 시뮬레이션을 실행하지 않게 한 구조입니다.

`recording.ts`의 `stepGame`은 실제 게임 고정 틱을 두 번 실행하고 매번 상태와 event로 effects를 갱신합니다. 고정 틱 두 번은 1/60초이므로 기록 프레임 간격과 맞습니다.

`capture`는 game snapshot과 복사한 effects를 한 프레임으로 저장합니다. `recordedScene.sample(time)`은 시간을 프레임 번호로 바꾸고 범위를 제한해 해당 프레임을 반환합니다. 뒤로 탐색할 때도 저장한 프레임을 선택하므로 효과의 과거 상태를 임의로 되감지 않습니다.

브라우저의 [preview.ts](../../src/preview.ts)는 선택, 재생, 일시정지, seek를 관리합니다. 실제 게임 규칙 문제는 replay로, 특정 카메라나 효과를 반복 확인하는 일은 preview로 접근하면 확인 대상을 좁힐 수 있습니다.
