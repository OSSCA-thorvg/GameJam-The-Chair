# 테스트 공통 도구

[English](README.md) | [한국어](README-ko.md)

| 파일 | 용도 |
|---|---|
| `load.mjs` | `load('src/game/game.ts')`, `loadSource(...)`, `bundled(...)`로 TypeScript를 esbuild bundle 후 import합니다. 같은 테스트 파일에서는 entry마다 한 번만 build합니다 |
| `harness.mjs` | `begin`, `play`, `runWith`, `recordCommands`로 공개 게임 API를 실행합니다. `balancePolicy`, `corridorPolicy`, `sampleCommands`도 제공합니다 |
| `stage3-route.mjs` | 옥상 코스를 완료하는 policy |
| `stage4-route.mjs` | 하늘 코스 driver. 테스트는 `tests/replays/stage4-route.json`에 녹화된 발사를 재생합니다. stage 4 게임플레이를 의도적으로 바꿨다면 `npm run route:update`로 다시 계획합니다 |
| `realtime-replay.mjs` | `replay.test.mjs`와 `replay-stage3.test.mjs`가 함께 쓰는 실시간 replay 검사 |
| `golden.mjs` | 플레이 지문 시나리오. `npm run golden:update`로 갱신합니다 |
| `input.mjs` | 입력 테스트용 브라우저 전역, 키 이벤트와 포인터 버튼. `t.after()`로 전역을 복원합니다 |
| `until.mjs` | `runUntil(done, step, { maxSteps, message })`로 시뮬레이션 전환에 상한을 두고, 목표에 도달하지 못하면 실패합니다 |
| `determinism.mjs` | 같은 입력과 저장 후 이어 실행의 결정성 공통 검사 |

- `npm test`: 전체 테스트를 실행합니다.
- `npm run test:fast`: 플레이 지문, 결정성 suite, 실시간 replay 테스트를 제외합니다.

미리보기 목록은 프레임을 녹화하지 않고 메뉴 정보를 제공합니다. 등록 항목의 `create()`를 호출하면 해당 장면만 녹화하고 이후 선택과 탐색에 재사용합니다. 궤도 조종이 필요한 테스트는 `src/preview/autopilot.ts`를 직접 import합니다.
