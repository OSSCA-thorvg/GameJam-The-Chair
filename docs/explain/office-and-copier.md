# 사무실과 복사기 코드 읽기

대상은 [office/hooks.ts](../../src/game/stages/office/hooks.ts), [copier/decide.ts](../../src/game/stages/office/copier/decide.ts), [copier/apply.ts](../../src/game/stages/office/copier/apply.ts)입니다. 장애물 하나가 게임 판정과 연출 신호로 이어지는 예입니다.

## hooks.ts가 실행 위치를 정한다

사무실은 자체 루프를 만들지 않습니다. 공통 `playStep`이 부르는 `timers`, `hazards`, `beforeDrive`, `afterMove` 같은 연결점에 동작을 등록합니다.

`timers`는 cooldown과 피해 후 회복 제한 시간을 줄입니다. `hazards`는 복사기 발사, 종이 이동과 충돌, 청소, 간헐천을 처리합니다. `beforeDrive`는 미끄러운지 계산하고, `drive`는 그 결과를 공통 물리에 전달합니다. `afterMove`는 쓰레기통 추락을, `afterCollide`는 모니터 접촉을 확인합니다.

복사기는 다음처럼 판단과 적용을 연결합니다.

```ts
applyCopier(s, out, copierStep(s.office.copier, s.p.x, true, dt));
```

안쪽부터 읽습니다. `copierStep`이 복사기의 다음 상태와 발사 여부를 반환하고, `applyCopier`가 전체 상태 `s`와 이벤트 배열 `out`에 반영합니다.

## decide.ts는 계산한 결과를 돌려준다

`copierStep`은 먼저 `const next = { ...copier }`로 입력을 복사합니다. 가까운 플레이어를 감지하거나 이미 작동한 복사기이고, cooldown과 잔여 발사가 없다면 새 연사를 준비합니다.

주요 필드를 구분하면 조건문이 읽힙니다.

- `cool`은 다음 연사를 시작하기까지의 대기 시간입니다.
- `burst`는 현재 연사에서 남은 발사 횟수입니다.
- `next`는 다음 발사까지의 시간입니다.
- `dir`은 발사 방향입니다.
- `volley`는 연사 묶음 번호입니다.
- `bursts`는 실제로 발사한 횟수입니다.

발사 시점이 되면 `fire = true`를 반환합니다. 이 함수는 전체 게임 상태나 대사 시스템을 수정하지 않습니다. `cool` 감소는 사무실의 `timers`가 맡으므로 이 함수 안에서만 타이머를 찾으면 일부를 놓칩니다.

`paperShot`은 종이 네 장의 초기 데이터를 만듭니다. 각 종이는 다른 속도와 회전을 가집니다. `safe`는 첫 연사의 첫 발사를 안전하게 만드는 표식이며, 뒤의 종이 충돌 검사에서 사용합니다.

## apply.ts는 상태와 사건에 반영한다

`applyCopier`는 먼저 계산된 복사기 상태를 저장합니다. `fire`가 거짓이면 끝납니다. 참이면 종이를 배열에 추가하고 `bursts`를 늘리고 `volley` 이벤트를 냅니다. 첫 발사에는 `first-volley` cue도 냅니다.

종이 데이터는 다음 틱의 판정과 화면에 남습니다. 이벤트는 그 순간의 번쩍임이나 반응을 알립니다. 같은 발사에서 상태와 이벤트를 함께 사용하는 이유입니다.

`papersStep`은 종이를 복사해 이동시키고 바닥 착지와 플레이어 접촉을 계산합니다. 이미 맞은 종이, 안전한 종이, 착지한 종이는 다시 피해를 주지 않도록 검사합니다. 결과는 다음 종이 목록과 `hits` 목록입니다.

`applyPapers`는 `hits`를 차례대로 적용합니다. 집중력 피해를 주고, 종이 종류에 따라 의자의 속도와 회전을 바꾸며, 회복 제한과 cue를 설정합니다. 집중력이 소진되어 더 진행할 수 없으면 `false`를 반환합니다. `hazards`가 이를 받아 틱의 나머지를 중단합니다.

## 긴급 복사기와 설정 위치

같은 파일의 `urgentCopierStep`은 감지 후 스캔 시간을 두고 low, lob, fan, bundle 패턴을 선택합니다. `urgentShot`은 패턴에 맞는 종이 데이터를 만듭니다. 일반 복사기를 이해한 뒤 읽으면 타이머와 생성 패턴만 비교할 수 있습니다.

사무실의 공통 위치와 복사기 수치는 [level.ts](../../src/game/level.ts)의 `LEVEL`에 있고 피해량은 `FOCUS_DAMAGE`에 있습니다. 사무실에는 별도 `data.ts`가 없습니다. 지형과 체크포인트는 [office/definition.ts](../../src/game/stages/office/definition.ts)에서 확인합니다.

다른 stage를 찾을 때는 [stages/index.ts](../../src/game/stages/index.ts)의 설정 등록과 [stages/hooks.ts](../../src/game/stages/hooks.ts)의 동작 선택을 함께 봅니다. 하나는 데이터이고 다른 하나는 실행할 함수입니다.
