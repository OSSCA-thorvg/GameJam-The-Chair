# 테스트 공통 도구

| 파일 | 내용 |
|---|---|
| `load.mjs` | TypeScript 소스를 esbuild로 묶어 가져옵니다: `load('src/game/game.ts')`, `loadSource("export { … } from './src/…';")`, `bundled(esbuild 옵션)`. 같은 테스트 파일 안에서는 한 번만 빌드합니다 |
| `harness.mjs` | 공개 API로 게임을 돌리는 도구(`begin`, `play`, `runWith`, `recordCommands`)와 운전 정책(`balancePolicy`, `corridorPolicy`, `sampleCommands`) |
| `stage3-route.mjs`, `stage4-route.mjs` | 옥상·하늘 코스를 끝까지 가는 정책 |
| `golden.mjs` | 지문(골든) 시나리오. 갱신은 `npm run golden:update` |
| `determinism.mjs` | 결정성 검사와 저장 후 이어 실행 검사의 공통 부분 |

- `npm test`: 전체 테스트
- `npm run test:fast`: 오래 걸리는 시뮬레이션(지문, 결정성, 실시간 리플레이)을 뺀 빠른 확인
