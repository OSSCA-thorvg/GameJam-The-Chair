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
| `determinism.mjs` | 같은 입력과 저장 후 이어 실행의 결정성 공통 검사 |

- `npm test`: 전체 테스트를 실행합니다.
- `npm run test:fast`: 플레이 지문, 결정성 suite, 실시간 replay 테스트를 제외합니다.
