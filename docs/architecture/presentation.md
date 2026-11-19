# 프레젠테이션

프레젠테이션은 코어 snapshot과 `GameEvent`를 입력으로 받습니다. 화면 효과는 게임 판정에 다시 들어가지 않습니다.

## 렌더링 경로

`createRenderer()`는 두 canvas를 사용합니다.

| 레이어 | 기술 | 내용 |
|---|---|---|
| base | Canvas2D | ThorVG를 사용할 수 없을 때 벡터 장면을 대신 그림 |
| tvg | ThorVG WebCanvas | 게임의 절차적 벡터 장면 |

DOM은 집중력, 메뉴, 터치 컨트롤, 종료 panel처럼 조작과 접근성이 필요한 HUD만 담당합니다. 플레이어 반응, 1스테이지 동료 대사, 스테이지 제목 카드는 `scene/shared/talk.ts`가 ThorVG 말풍선과 Text로 그립니다.

`renderer.draw()`는 snapshot과 effect를 mutable `RenderCtx`에 넣고 camera, scale, vertical offset을 계산합니다. 현재 스테이지에 따라 `drawWorld()`, `drawBuilding()`, `drawRooftop()`, `drawCloudStart()`, `drawOrbit()`를 호출합니다. 선택 기준은 `src/presentation/stages.ts`입니다.

장면 함수는 `RenderCtx`의 polygon, path, gradient, layer helper를 호출합니다. helper는 화면 좌표의 `DrawCommand[]`를 만듭니다. `paint()`는 명령을 ThorVG `Shape`와 `Scene`으로 변환하고 `Canvas.update().render()`를 실행합니다.

## ThorVG 사용 범위

게임 장면은 다음 ThorVG 기능을 사용합니다.

- cubic path, fill, stroke, dash, linear·radial gradient
- trim path, opacity, blend
- scene grouping, clip path, alpha mask
- Gaussian blur와 motion blur
- shape와 scene pool을 통한 프레임 간 객체 재사용
- `Text`와 `Font.load()`: 장면 속 모든 글자. `DrawCommand`의 `text`로 들어가 앞뒤 도형과 그리기 순서가 맞습니다.

글꼴은 세 가지 OFL 글꼴의 subset입니다(`src/render/fonts.ts`). Black Han Sans는 간판과 복사기 외침, Do Hyeon은 표지와 안내(`ctx.label`), Jua는 말풍선에 씁니다. 어느 글꼴에도 없는 `…`, `·`는 `fitGlyphs()`가 바꾸고, `♪`는 말풍선이 벡터 음표로 그립니다. 문구를 바꾸면 `node scripts/subset-fonts.mjs`(fontTools 필요)로 subset을 다시 만들고, `tests/font-coverage.test.mjs`가 글리프 누락을 검사합니다. 글자 너비는 ThorVG가 로드된 뒤 `Text.bounds()`로 잽니다.

시작 화면은 별도 ThorVG `Animation`으로 `assets/powred.by.thorvg.1.json` Lottie 파일을 재생합니다.

Canvas2D fallback은 기본 path, fill, stroke, gradient, blend를 그립니다. alpha mask, motion blur, trim path는 재현하지 않으며 group 효과도 ThorVG와 완전히 같지 않습니다. fallback은 게임 진행을 유지하기 위한 경로이지 시각적 동등성 검사가 아닙니다.

## 장면과 paint 객체

스테이지 장면은 `src/render/scene`에 있습니다. 공용 캐릭터와 물, 청소부, 소화기 분사 같은 요소는 별도 모듈로 분리되어 있습니다.

`RenderCtx`는 offset, rotation, scale, mirror, 현재 layer를 공유합니다. 장면 helper는 바꾼 값을 호출 범위 안에서 복구해야 합니다. layer는 중첩 stack이 아니므로 `beginLayer()`와 `endLayer()`를 겹쳐 사용하지 않습니다.

`paint/commands.ts`는 순서를 유지하며 인접한 호환 layer를 묶습니다. `paint/thorvg.ts`는 shape, text, scene 풀을 재사용합니다. 새 paint 속성을 추가하면 다음 프레임에 이전 값이 남지 않도록 reset 처리도 추가해야 합니다. 카메라와 바퀴 회전은 이전 draw 결과를 사용하며, 스테이지 변경이나 시간 역행에서 초기화됩니다.

## 효과, 피드백, 다국어

`createEffects()`는 copier flash, 물, 입자, glare 같은 시각 상태를 관리합니다. 효과는 코어 상태 관찰, `GameEvent`, 프레임 시간 진행으로 갱신되며 물 효과도 자체 결정적 RNG를 사용합니다. 효과의 물 위치를 충돌이나 집중력 판정에 사용하지 않습니다.

`createFeedback()`은 cue 이벤트를 대사, 상태 알림, 종료 panel로 바꿉니다. 메시지 key를 저장하고 snapshot을 만들 때 현재 locale로 번역합니다. `createHud()`는 game, feedback, effect snapshot을 DOM에 반영합니다.

정적 DOM 문구는 `main.ts`의 `applyLocale()`이 `[data-i18n]`과 `[data-i18n-aria]`에 적용합니다. 새 문구는 `src/i18n.ts`에 영어와 한국어를 함께 추가합니다.

## 배경음악

`src/presentation/music.ts`의 `musicTrack`이 화면 상태로 곡을 고릅니다. 시작 화면과 오프닝은 `start`, 1·2 스테이지는 `stage1-2`, 3은 `stage3`, 4는 `stage4`, 5는 `stage5`, 궤도 문에 도착한 엔딩은 `ending`입니다. `src/ui/music.ts`는 곡을 반복 재생하고 1.2초 동안 크로스페이드하며, 일시정지 중에는 볼륨을 낮춥니다. 브라우저 자동재생 제한 때문에 첫 클릭이나 키 입력 뒤에 소리가 납니다. 음원은 모든 브라우저에서 재생되는 AAC `assets/bgm/*.m4a`(80 kbps)입니다.

## 모션 확인

`src/preview-scenes.ts`의 등록 항목은 id, label, 지연 생성 함수 `create()`를 제공합니다. `preview/registration.ts`는 선택한 장면을 처음 한 번 만들고 캐시합니다. 생성된 각 `PreviewScene`은 시간에 따른 `{ state, effects }`를 반환합니다. 실제 코어를 기록하는 장면은 화면 한 프레임마다 120 Hz 틱 두 번을 실행해 60 Hz frame을 만듭니다. 직접 만든 장면도 같은 시간에 항상 같은 snapshot을 반환해야 합니다.

모션을 추가하거나 바꾸면 preview registry에 장면을 등록하고 `/preview.html`에서 재생, 역방향 seek, 주요 marker를 확인합니다. `motion`과 `t` query parameter로 같은 장면과 시간을 공유할 수 있습니다.

## 현재 장면 폴더와 백엔드

`render/scene`은 `office`, `building`, `rooftop`, `sky`, `orbit`, `opening`, `player`, `personal-box`, `effects`, `shared`로 나뉩니다. 스테이지의 `index.ts`는 실제 장면 구현을 포함합니다. 사무실은 `office/world.ts`, 구름 장면은 `sky/clouds.ts`에서 시작합니다.

`render/thorvg.ts`는 WASM과 글꼴을 로드합니다. 자동 선택은 하드웨어 WebGL2를 사용하고 알려진 소프트웨어 GL 구현을 제외합니다. `?renderer=gl` 또는 `?renderer=sw`로 ThorVG 백엔드를 지정할 수 있습니다. ThorVG 소프트웨어 렌더링과 Canvas2D 대체 경로는 서로 다릅니다.

유지되는 도형의 geometry 식별자와 scene transform을 이용해 도형을 재사용합니다. clip이나 mask를 안전하게 해제할 수 없는 경우 scene을 교체합니다. 화면 밖 도형 제거와 effect budget은 layer 처리 범위를 제한합니다. 성능 정보와 layer 제어는 `render/perf.ts`, `ui/perf-overlay.ts`에서 확인합니다.
