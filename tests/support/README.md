# Shared test utilities

[English](README.md) | [한국어](README-ko.md)

| File | Purpose |
|---|---|
| `load.mjs` | Bundles and imports TypeScript with esbuild through `load('src/game/game.ts')`, `loadSource(...)`, or `bundled(...)`. Build each entry only once per test file |
| `harness.mjs` | Drives the public game API with `begin`, `play`, `runWith`, and `recordCommands`; provides `balancePolicy`, `corridorPolicy`, and `sampleCommands` |
| `stage3-route.mjs` | Policy that completes the rooftop route |
| `stage4-route.mjs` | Sky route driver. Tests replay the launches in `tests/replays/stage4-route.json`; after an intended stage four gameplay change, re-plan them with `npm run route:update` |
| `realtime-replay.mjs` | Real-time replay check shared by `replay.test.mjs` and `replay-stage3.test.mjs` |
| `golden.mjs` | Gameplay fingerprint scenarios. Update them with `npm run golden:update` |
| `input.mjs` | Browser globals, keyboard events, and pointer buttons for input tests; restores globals with `t.after()` |
| `until.mjs` | `runUntil(done, step, { maxSteps, message })` bounds simulated transitions and fails with a diagnostic when the target is not reached |
| `determinism.mjs` | Shared same-input and save-and-resume determinism checks |

- `npm test`: runs the complete test suite.
- `npm run test:fast`: skips gameplay fingerprints, determinism suites, and real-time replay tests.

Preview scenes expose menu metadata without recording frames. Calling a registration’s `create()` records only that scene and caches it for later selections and seeks. Tests that need orbit steering import `src/preview/autopilot.ts` directly.
