# 디버그를 위한 개발자 도구


개발 서버의 기본 URL은 다음과 같다. 5173 포트가 사용 중이면 Vite가 다른 포트를 쓰므로 터미널에 출력된 주소를 확인한다.

| 페이지 | URL | 용도 |
|---|---|---|
| 게임 | http://127.0.0.1:5173/ | 실제 게임 |
| 모션 미리보기 | http://127.0.0.1:5173/preview.html | 모션을 시간축으로 재생·정지·프레임 이동하며 확인 |
| 리플레이 도구 | http://127.0.0.1:5173/replay.html | 이 브라우저에 저장된 최근 시도 기록과 오류를 재생하고 분석 |

#### URL 파라미터

| URL | 동작 |
|---|---|
| `/?debug=1` | 성능 오버레이를 켠 채로 시작한다. 게임 중 `F3` 또는 `` ` `` 키로도 켜고 끈다. FPS, 프레임 시간, 구간별 시간, ThorVG 카운터, JS 힙, WASM 메모리를 보여 주며 "지표 복사"로 JSON을 얻는다. |
| `/?stage=<1-5>` | 스플래시를 건너뛰고 지정한 스테이지로 바로 시작한다. `debug=1` 없이도 동작하며, 배포 빌드에서도 동작한다. 예: `/?stage=4` |
| `/preview.html?motion=<id>&t=<초>` | 지정한 장면과 시각을 연다. `<id>`는 `src/preview-scenes.ts`의 `id`이다. 재생하거나 이동하면 URL이 자동으로 갱신되므로 그대로 공유할 수 있다. 예: `?motion=sky-ending&t=3.5` |

파라미터는 함께 쓸 수 있다. 예: `/?debug=1&stage=3`

#### 콘솔 디버깅 API

게임 페이지의 `window.officeStageOne`으로 상태를 보거나 조작한다.

- `officeStageOne.state()`: 현재 상태 snapshot
- `officeStageOne.startStage(n)`: 스테이지 n으로 이동 (진행도 조건 없음)
- `officeStageOne.skipOpening()`: 오프닝 건너뛰기
- `officeStageOne.replay.latest()`: 최근 리플레이 데이터
- `officeStageOne.perf.snapshot()`, `officeStageOne.perf.toggle()`: 성능 지표 확인, 오버레이 켜고 끄기