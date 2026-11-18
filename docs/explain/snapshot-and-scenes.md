# 상태를 장면으로 바꾸는 코드 읽기

대상은 [snapshot.ts](../../src/game/snapshot.ts), [renderer.ts](../../src/render/renderer.ts), [context.ts](../../src/render/context.ts), [office/world.ts](../../src/render/scene/office/world.ts)입니다.

## snapshot.ts는 화면에 필요한 값을 모은다

`viewState(s)`는 코어 상태 자체를 넘기지 않습니다. 플레이어를 복사하고, 지형과 상호작용 가능 여부 같은 규칙을 조회하고, stage별 화면 데이터를 모아 반환합니다.

플레이어 투영의 핵심은 다음 코드입니다.

```ts
player: clonePlain(source.p)
```

화면 코드는 `state.player`를 읽습니다. 코어는 `s.p`를 사용합니다. 복사된 화면 데이터가 바뀌어도 코어 플레이어를 직접 변경하지 않게 한 경계입니다. 타입도 `GameSnapshot`을 `DeepReadonly`로 표현합니다.

`createFocusSnapshot`은 집중력 수치와 표시용 notice, 회복이 막혔는지를 함께 전달합니다. `createWorldSnapshot`은 stage 이름, 길이, 목표, 지형, 사람을 전달합니다. 사무실·건물·옥상은 stage별 view 함수를 사용합니다. 하늘은 직접 복제하고 궤도는 5stage에서만 제공합니다.

## renderer.ts는 장면을 선택한다

`createRenderer`는 base와 ThorVG canvas를 찾고 자원과 paint pool을 준비합니다. ThorVG 로드는 비동기이므로 처음부터 엔진이 준비됐다고 가정하지 않습니다.

`draw`는 새 snapshot과 effects로 `RenderCtx`를 만들고 viewport와 이전 카메라 정보를 채웁니다. 일반 플레이에서는 `gameplayCamera`를 사용하고 오프닝이나 사망 연출에서는 별도 카메라를 적용합니다.

그다음 `STAGE_PRESENTATION[next.stage].scene`으로 장면 함수를 선택합니다. 사무실은 `drawWorld`, 건물은 `drawBuilding`, 옥상은 `drawRooftop`, 하늘은 `drawCloudStart`, 궤도는 `drawOrbit`입니다. 완성한 명령은 `paint`로 보냅니다.

[camera.ts](../../src/render/camera.ts)는 플레이어가 향하는 화면 위치와 stage별 정책으로 카메라 목표를 정합니다. 이전 카메라에서 목표 쪽으로 조금씩 이동하므로 화면이 부드럽게 따라갑니다. 시간이 역행하거나 stage가 바뀌면 이력을 초기화합니다.

## context.ts는 좌표를 그리기 명령으로 바꾼다

`RenderCtx`에는 화면 크기, 카메라, 현재 변환, 상태, 효과와 그리기 함수가 있습니다. `screenPoint`는 로컬 크기 조절, 회전, 위치, 반사, 카메라와 화면 배율을 반영합니다.

회전과 반사를 제외한 수평 변환은 다음처럼 이해할 수 있습니다. 이 식은 설명용 단순화입니다.

```text
화면 x = (월드 x + 오프셋 - 카메라 x) × 화면 배율
```

`polygon`은 점들을 `screenPoint`로 변환하고 `kind: 'path'` 명령을 만듭니다. `push`는 현재 layer가 있으면 명령에 연결하고 `commands` 배열에 추가합니다. 이 단계에서는 ThorVG Shape를 만들지 않습니다.

`withTransform`과 `withLayer`는 일부 요소에만 변환과 효과를 적용할 때 사용합니다. 공유 문맥의 값을 바꾸고 복구하지 않으면 뒤에 그리는 다른 요소까지 영향을 받습니다. `retainedGroup`의 도형 생성 함수는 변하는 게임 상태에 의존하지 않아야 캐시된 도형을 재사용할 수 있습니다.

## office/world.ts는 그리기 순서를 정한다

파일 앞에는 창문과 도시의 세부 도형 함수가 많습니다. 처음에는 파일 끝의 `drawWorld`부터 읽습니다.

`drawWorld`는 명령을 비우고 변환을 초기화한 다음 배경, 사람, 복사기, 종이, 모니터, 간헐천, 전경, 덧그릴 요소 순서로 호출합니다. 이 순서가 겹치는 물체의 앞뒤 관계를 정합니다. 쓰레기통처럼 플레이어 앞뒤에 나뉘어 보이는 물체는 전경 함수를 함께 확인합니다.

`cityRandom`은 skyline seed와 창문 번호로 창밖 건물을 반복 생성합니다. 화면을 다시 그릴 때마다 도시가 무작위로 바뀌지 않게 한 화면용 계산입니다. 이 값으로 게임 피해를 판정하지 않습니다.

[effects.ts](../../src/render/effects.ts)는 상태 관찰과 사건으로 화면 효과를 관리합니다. [feedback.ts](../../src/ui/feedback.ts)는 cue를 대사와 반응으로 해석합니다. 피해량을 찾을 때 이 파일들이 아니라 게임의 시스템을 읽어야 하는 이유입니다.
