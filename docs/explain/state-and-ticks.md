# 상태와 고정 틱 코드 읽기

대상은 [types.ts](../../src/game/types.ts), [state.ts](../../src/game/state.ts), [game.ts](../../src/game/game.ts), [commands.ts](../../src/game/commands.ts), [step.ts](../../src/game/step.ts), [physics.ts](../../src/game/physics.ts)입니다.

## types.ts에서 숫자의 의미를 확인한다

`Player`의 `x`, `y`는 위치, `vx`, `vy`는 속도입니다. `a`는 각도이며 라디안을 사용하고 `w`는 각속도입니다. 이름을 짧게 유지하는 일부 필드는 기존 리플레이에 저장되는 형식이기도 합니다.

`Input`은 현재 누르고 있는 조작입니다. 점프는 이 목록에 없고 별도 `Command`입니다. 계속 누르는 이동과 순간 동작인 점프를 구분한 구조입니다.

`Mode`는 진행 상태입니다. `play`는 일반 플레이, `impact`와 `focuslost`는 실패로 이어지는 시뮬레이션입니다. `intro`, `pause`, `dead`, `won`에서는 자동 틱이 진행하지 않습니다.

`GameEvent`는 `type`으로 구별하는 여러 사건의 합집합입니다. `cue`는 대사나 반응의 식별자를 전달하고, `reset`은 시도 초기화, `volley`는 발사 사건을 전달합니다. 이벤트에 최종 한국어 문장을 넣지 않으므로 언어 선택은 UI에서 처리할 수 있습니다.

## state.ts는 유지할 값과 다시 만들 값을 구분한다

```ts
export type CoreState = Progress & Attempt;
```

`&`는 두 객체의 필드를 합친다는 뜻입니다. 실제 상태는 중첩된 `progress`와 `attempt` 객체가 아니라 이 필드를 함께 가진 객체입니다.

`Progress`에는 stage, checkpoint, lessons, deaths, completedStage, skylineSeed, tick이 있습니다. `Attempt`에는 플레이어, 눌린 키, 시간, 집중력, RNG, 각 stage 상태가 있습니다. `resetAttempt`는 진행 값을 바탕으로 `createAttempt`를 다시 호출하고 결과를 현재 상태에 덮어씁니다.

`tick`은 명령 순서의 기준이라 재시도에도 이어집니다. `time`은 시도 안의 시간이므로 새 시도에서 초기화됩니다. 둘을 같은 값으로 생각하면 리플레이와 애니메이션을 잘못 연결하게 됩니다.

`cloneState`는 변경 가능한 데이터를 복사합니다. 단, history 안의 프레임은 얼려 두었으므로 배열만 복사하고 프레임은 공유합니다. `setPlayer`가 `s.p = p` 대신 `Object.assign(s.p, p)`를 사용하는 이유는 한 틱 안에서 기존 플레이어 객체를 참조하는 코드가 있기 때문입니다.

## game.ts는 현재 상태를 소유한다

`createGame` 안의 `s`가 현재 상태입니다. 외부는 `send`, `advance`, `getSnapshot` 같은 메서드로 접근합니다. 이것이 이 프로젝트에서 facade라는 이름으로 부르는 공개 창구입니다.

`send`는 명령을 기록하고 `applyCommand`를 실행한 뒤 `s`를 반환된 상태로 교체합니다. `tick`은 `stepGame`으로 한 틱을 실행하고 같은 방식으로 교체합니다. 두 함수가 event를 `pending`에 쌓고 `drainEvents`가 그것을 꺼냅니다.

`advance(dt)`는 다음 구조를 사용합니다.

```ts
acc += Math.min(dt, 0.25);
while (acc >= FIXED_STEP) {
    // 한 틱을 실행하고 누적 시간에서 FIXED_STEP을 뺀다.
}
```

위 코드는 핵심만 남긴 설명용 발췌입니다. `FIXED_STEP`은 `1 / 120`초입니다. 브라우저 한 프레임에 필요한 만큼 여러 틱을 실행하므로 화면 주사율이 게임 규칙의 시간 간격을 정하지 않습니다. 오래 멈춘 프레임은 최대 0.25초만 받아들이며, 모드가 바뀌면 남은 누적 시간을 버립니다.

`step()`은 테스트와 미리보기용으로 고정 틱 하나를 실행합니다. `advance`처럼 시간을 누적하지 않습니다.

## commands.ts와 step.ts는 의도와 진행을 나눈다

`applyCommand`는 상태를 복사하고 명령만 적용합니다. `stepGame`은 상태를 복사한 뒤 전달받은 명령을 적용하고 모드에 따라 한 틱을 진행합니다.

점프 명령은 `jumpQ`에 허용 시간을 넣습니다. `playStep`이 지면 또는 coyote time 조건을 확인해야 실제 위쪽 속도가 생깁니다. 명령 적용만으로 위치가 바로 바뀌는 것은 아닙니다.

`playStep`에서는 timers, hazards, 이동, 충돌, 체크포인트, 집중력 회복, 추락과 목표 검사를 순서대로 봅니다. 자세한 순서는 [게임 코어 reference](../architecture/game-core.md)에 있습니다. `takeover`와 `afterMove`는 참이면 중단하고 `hazards`는 거짓이면 중단하므로 반환값을 주의해서 읽습니다.

## physics.ts는 계산 결과를 돌려준다

`drivePlayer`는 플레이어를 복사하고 다음을 계산합니다. 입력에 따른 회전과 추진을 더하고, 중력을 적용하고, 저항으로 속도를 줄이고, 속도 상한을 적용한 뒤 위치와 각도를 진행합니다.

```ts
p.x += p.vx * dt;
p.y += p.vy * dt;
p.a += p.w * dt;
```

속도에 시간을 곱하면 그 틱의 이동량이 됩니다. 화면의 y축은 아래가 양수이므로 점프 속도는 음수이고 중력은 양수입니다.

`collide`는 의자와 사람을 여러 원형 접촉점으로 취급합니다. 지형과 겹친 만큼 밀어내고 충돌 방향의 속도와 회전을 보정합니다. 바퀴 접촉은 `ground`, 머리 접촉은 `headHit`으로 돌려줍니다. 사망을 직접 결정하기보다 호출자인 `playStep`이 이 결과를 해석합니다.

## 설정과 결정성

[level.ts](../../src/game/level.ts)의 `PHYSICS`는 수치 설정이며 계산 알고리즘은 아닙니다. `rng.ts`는 물리와 외형 난수의 상태를 분리합니다. 외형용 난수를 추가로 소비해도 물리 난수 순서를 바꾸지 않도록 한 것입니다.

`math.ts`는 브라우저별 미세한 차이가 누적되지 않도록 수학 연산을 구현합니다. 처음에는 계수를 전부 읽기보다 왜 일반 `Math.sin` 대신 `Det.sin`을 호출하는지 이해하면 됩니다.
