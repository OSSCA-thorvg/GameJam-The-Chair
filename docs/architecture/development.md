# 개발과 검증

## 로컬 명령

Node.js 22 이상을 사용합니다.

| 명령 | 용도 |
|---|---|
| `npm ci` | lockfile 기준으로 의존성 설치 |
| `npm run dev` | 세 개발 페이지 실행 |
| `npm run typecheck` | TypeScript 검사 |
| `npm run lint` | `src/game`의 결정성 및 의존 규칙 검사 |
| `npm run test:fast` | 긴 시뮬레이션을 제외한 테스트 |
| `npm test` | 전체 테스트 |
| `npm run build` | typecheck 후 세 Vite 페이지 빌드 |
| `npm run replay:check -- <file>` | 단일 replay 파일 또는 legacy error log 재실행 |

`test:fast`는 golden, determinism, determinism-routes, 실시간 replay suite를 제외합니다. `replay-file` 테스트는 포함합니다.

## 테스트가 고정하는 계약

| 테스트 | 확인 내용 |
|---|---|
| `api`, `core`, `structure` | 공개 API, state 불변성, 예외 원자성, 금지 API, 스테이지 의존 방향 |
| `systems` | 위험 요소와 공용 시스템의 판단 및 적용 |
| `stages`, `stage3`, `stage4`, `stage5`, `duct` | 실제 플레이 경로, 체크포인트, 장비, 스테이지 전환 |
| `determinism*` | 같은 seed와 command의 동일 결과, 저장 후 이어 실행 |
| `replay`, `replay-file` | 기록, hash, marker, seek, divergence, 오류 재현, 파일 호환 |
| `golden` | 여섯 플레이 경로의 매 틱 상태·이벤트 지문과 최종 snapshot |
| `preview` | 모션 단계와 역방향 seek의 재현성 |
| `*-input`, `menu`, `i18n`, `feedback` | 조작 mapping, 메뉴, 번역, 이벤트 기반 문구 |
| `stage2-render`, `stage3-render` | 유한한 벡터 좌표, 언어별 label, 좁은 화면 데이터 |

render 테스트는 실제 브라우저 ThorVG 출력을 그리지 않습니다. WebGL, canvas 조합, blur, mask, 텍스트 배치는 개발 페이지에서 확인합니다.

## 변경별 확인 범위

| 변경 | 최소 확인 |
|---|---|
| 코어 규칙 또는 물리 | typecheck, lint, 관련 system·stage 테스트, 전체 determinism·golden |
| 스테이지 훅 또는 장애물 | 관련 system 테스트, 실제 route 테스트, golden |
| command 또는 replay 형식 | API, determinism, replay, replay-file, 기존 fixture |
| 장면 또는 paint | typecheck, render 테스트, `/preview.html`에서 ThorVG 확인 |
| 모션 또는 effect | preview 테스트, preview scene 등록, 역방향 seek 확인 |
| 입력 또는 HUD | input·menu·i18n·feedback 테스트, `/`에서 키보드와 터치 확인 |

golden 지문은 의도한 플레이 동작 변경일 때만 `npm run golden:update`로 갱신합니다. 리팩터링 중 지문이 바뀌면 원인을 먼저 찾습니다.

## 변경 위치

| 목적 | 시작할 파일 |
|---|---|
| 명령 추가 | `src/game/commands.ts`, `src/game/types.ts`, `src/ui/controls.ts` |
| 공용 물리 변경 | `src/game/physics.ts`, `src/game/level.ts` |
| 스테이지 규칙 변경 | `src/game/stages/<stage>/hooks.ts`와 해당 system |
| 화면에 state 추가 | `src/game/snapshot.ts`의 `viewState()`, renderer 또는 HUD |
| 장면 추가 | `src/render/scene`, 해당 stage renderer |
| 시각 효과 추가 | `GameEvent`, `src/render/effects.ts`, scene |
| 대사 또는 UI 문구 추가 | `src/ui/feedback.ts` 또는 HUD, `src/i18n.ts` |
| 리플레이 변경 | `src/game/replay.ts`, `src/ui/replay-player.ts`, replay tests |

## 개발 페이지

- `/`: 실제 입력, 진행 저장, 전체 게임 흐름
- `/preview.html`: 모션, camera, ThorVG 장면, seek
- `/replay.html`: 명령, marker, state, divergence, 오류 재현

리플레이 도구는 브라우저 데이터 bundle, 단일 replay, legacy error log를 읽습니다. `replay:check` CLI는 현재 bundle 전체를 직접 읽지 않으므로 단일 replay를 전달합니다.

테스트 helper와 route policy는 [`tests/support/README.md`](../../tests/support/README.md)를 참조합니다.

## 완료 전 전체 검증과 CI

Node 버전은 `.nvmrc`를 기준으로 `nvm use`로 선택합니다. 처음 실행할 때 `npm ci` 후 `npm run dev`를 실행합니다. 작업 완료 전에는 다음 명령을 모두 실행합니다.

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run preview`는 빌드 결과를 제공합니다. `vite.config.ts`는 게임, 모션 미리보기, 리플레이의 세 HTML을 함께 빌드하고 ThorVG WASM 경로를 해석합니다.

`.github/workflows/ci.yml`은 의존성 설치, 타입 검사, 린트, 전체 테스트를 실행한 뒤 Pages 경로를 반영해 Vite로 빌드합니다. main 실행은 결과를 GitHub Pages에 배포하고 PR 실행은 검증만 수행합니다.

빠른 테스트에서 제외하는 파일은 `scripts/test-fast.mjs`의 목록이 기준입니다. `golden`, `determinism`, `determinism-routes`, `replay`, `replay-stage3`의 다섯 테스트 파일을 제외합니다.

문서 탐색은 [코드 읽기 안내서](../explain/README.md)에서 시작할 수 있습니다.
