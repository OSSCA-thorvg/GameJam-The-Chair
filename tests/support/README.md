# Shared test utilities

[English](README.md) | [한국어](README-ko.md)

| File | Purpose |
|---|---|
| `load.mjs` | Bundles and imports TypeScript with esbuild through `load('src/game/game.ts')`, `loadSource(...)`, or `bundled(...)`. Build each entry only once per test file |
| `harness.mjs` | Drives the public game API with `begin`, `play`, `runWith`, and `recordCommands`; provides `balancePolicy`, `corridorPolicy`, and `sampleCommands` |
| `stage3-route.mjs`, `stage4-route.mjs` | Policies that complete the rooftop and sky routes |
| `golden.mjs` | Gameplay fingerprint scenarios. Update them with `npm run golden:update` |
| `determinism.mjs` | Shared same-input and save-and-resume determinism checks |

- `npm test`: runs the complete test suite.
- `npm run test:fast`: skips gameplay fingerprints, determinism suites, and real-time replay tests.
