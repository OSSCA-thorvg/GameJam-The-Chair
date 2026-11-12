# Game core architecture

[English](README.md) | [한국어](README-ko.md)

`src/game` is a deterministic game core. The same starting state and commands always produce the same result. This contract enables replays, save-and-resume checks, and gameplay fingerprints.

```
Input (keys/buttons) ─► createGame facade ─► stepGame(state, commands) ─► new state + events ─► renderer and HUD
                         (game.ts)           (step.ts, 1/120 s)
```

## Core rules

Every value that affects gameplay belongs to one of these categories.

| Category | Contents | Files |
|---|---|---|
| **State** | JSON-serializable player, hazard, timer, RNG, and tick data | `state.ts`, stage state modules |
| **Command** | Tick-tagged input such as `keys`, `jump`, `spray`, and `restart` | `commands.ts` |
| **Configuration** | Frozen level data and rule values. Their hash becomes `CONFIG_VERSION` | `level.ts`, `stages/*/data.ts`, `stages/*/definition.ts` |

`npm run lint` and the tests enforce these restrictions:

- Do not use `Math.random`, `Date`, `performance`, `requestAnimationFrame`, or `localStorage` in `src/game`. Read randomness from `state.rng` through `rng.ts`.
- Do not use engine-approximated `Math` functions (`sin`, `cos`, `tan`, `exp`, `atan2`, `hypot`, `pow`/`**`, `log`, …) in `src/game`. Browsers may differ in their last bit, which makes a replay recorded in one browser drift in another. Use the bit-exact versions in `math.ts` (`import * as Det from './math'`). `+ - * /`, `Math.sqrt`, `round`, `floor`, `abs`, `min`, and `max` are exact everywhere.
- A system's `decide.ts` accepts only the values it needs and returns a decision. Its paired `apply.ts` writes that result to state.
- A stage can import only another stage's `data.ts`. See [the stage guide](stages/README.md).

## Files

| File | Responsibility |
|---|---|
| `state.ts` | `Progress`, which survives attempts, and `Attempt`, which is recreated; state construction and cloning |
| `step.ts` | `stepGame(state, commands)`, the mode switch, and the shared `playStep`; never mutates its input state |
| `physics.ts` | Wheel drive, gravity, friction, and collision using `PHYSICS` from `level.ts` |
| `commands.ts` | Command application |
| `systems/<system>/` | Shared focus and impact systems, split into `decide.ts` and `apply.ts` |
| `stages/<stage>/` | Per-stage data, state, hooks, and systems |
| `rng.ts` | Seeded `physics` and `cosmetic` random streams |
| `math.ts` | Bit-exact `sin`, `cos`, `tan`, `exp`, `atan2`, `hypot` that every browser computes the same way |
| `replay.ts` | Replay recording, validation, and timelines |
| `game.ts` | The `createGame` facade: state ownership, fixed-step accumulation, recording hooks, events, and presentation snapshots |

`getSnapshot()` creates the presentation snapshot once per frame. UI decisions use the allocation-free `status()`.

## Write a system

```ts
// decide.ts receives only the values it needs and does not mutate them.
export function geyserHits(p: Readonly<Point>, time: number, rng: number): GeyserHit[]

// apply.ts writes the decision to state and forwards focus damage.
export function applyGeyserHits(s: GameState, out: GameEvent[], hits: readonly GeyserHit[])
```

- Update the player through `setPlayer(s, p)`. It overwrites the existing object because other code retains that reference during the tick.
- Emit presentation signals such as effects and dialogue as `GameEvent` values in `out`. Do not store them in gameplay state.

## Verify changes

| Command | Checks |
|---|---|
| `npm run typecheck` | TypeScript types |
| `npm run lint` | Forbidden APIs and `decide.ts` import rules |
| `npm test` | The complete test suite |
| `npm run test:fast` | The suite without long simulation tests |
| `npm run golden:update` | Updates fingerprints. Run only for an intentional behavior change and explain why in the PR |
| `npm run replay:check -- <file>` | Replays a single replay file or legacy error log and reports hash divergence or reproduced errors |

### Golden tests

`tests/golden.test.mjs` hashes every tick's mode, player, focus, and events, plus the final presentation snapshot, for six fixed play scenarios.

- A changed fingerprint during a refactor is a behavior regression.
- For an intentional rule or level change, run `npm run golden:update` and record the reason in the test comment and PR.

### Inspect a replay

In the pause menu, open **Replay**, then select **Download data**. Open the downloaded file in `/replay.html` to inspect playback and state by tick.
