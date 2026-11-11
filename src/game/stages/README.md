# Working with stage code

[English](README.md) | [한국어](README-ko.md)

Each stage keeps its code in one `stages/<stage>/` directory. Developers working on different stages can usually change only their assigned directory and avoid merge conflicts.

| Directory | Stage |
|---|---|
| `office/` | 1: office, including the copier, bucket, geysers, bin, and monitors |
| `building/` | 2: building interior, including the meeting room, chair convoy, and lift |
| `rooftop/` | 3: machine room and rooftop, including the entrance, duct, extinguisher, and launch |
| `sky/` | 4: above the clouds, including the platform course and depth transition |

## Stage directory structure

```
stages/<stage>/
  data.ts              Frozen level values and dialogue
  state.ts             Mutable stage state (office, building, and rooftop)
  definition.ts        StageDefinition: length, goal, terrain, checkpoints, people, and rule flags
  attempt.ts           Initial values for a new attempt
  hooks.ts             StageHooks inserted into the shared tick
  <system>/decide.ts   Pure decision from the minimum required values
  <system>/apply.ts    Writes the decision to state
```

Shared focus and impact systems use the same structure under `src/game/systems/<system>/`.

The sky stage currently defines `SkyState` in `sky/data.ts` instead of a separate `state.ts`.

## Tick order

`playStep` in the shared `step.ts` calls the current stage's optional hooks at fixed points. See `StageHooks` in `stages/types.ts`.

```
shared timers → timers → held spray → takeover → hazards → beforeDrive
→ jump (onJump) → drive → movement → afterMove → collision → afterCollide
→ checkpoints (checkpointsOpen) → focus recovery (focusBlocked) → shared scoring and dialogue
→ fall (onFall) → goal (definition.finishAtGoal)
```

Command hooks are `canJump`, `canSpray`, `onSpray`, `interact`, `leave`, and `canInteract`.

## Rules

1. Do not import another stage's behavior. A stage may import only another stage's `data.ts`. For example, rooftop launch reads the sky stage's arrival height.
2. Shared code does not import a stage implementation directly. It reaches stages through `stages/index.ts`, `stages/hooks.ts`, `stages/attempt.ts`, and `stages/view.ts`.
3. Keep only data in a `definition.ts`. Put behavior in `hooks.ts`.
4. Do not use `Math.random`, `Date`, or `performance` in `src/game`. Read randomness through `state.rng` and `rng.ts`.
5. In a decide/apply system, `decide.ts` does not mutate state. Its paired `apply.ts` writes the result.

`tests/structure.test.mjs` enforces rules 1 and 2 and requires each stage's core files. `npm run lint` enforces the forbidden APIs and `decide.ts` import boundary.

## Add a stage

The following example adds stage 5, space.

1. Create `data.ts`, `definition.ts`, `attempt.ts`, and `hooks.ts` under `stages/space/`.
2. Add `SpaceState` and `createSpaceState()` to `stages/space/state.ts`.
3. Register the stage in the shared indexes:
   - Add `5: space` to `STAGES` in `stages/index.ts`.
   - Add `case 5: return spaceHooks;` to `stages/hooks.ts`.
   - Add `prepareSpaceAttempt(...)` and `space: createSpaceState()` to `stages/attempt.ts`.
   - Add `space: SpaceState;` to `Attempt` in `state.ts`.
4. Add `5` to `StageId` in `types.ts`.

## Shared files

These files can still require changes when a feature crosses stage boundaries. Keep pull requests small to reduce conflicts.

| File | Change it when |
|---|---|
| `Attempt` in `state.ts` | Adding a stage |
| `CueId` and `Input` in `types.ts` | Adding a presentation cue or input |
| `viewState` in `game.ts` | Exposing a value to the presentation layer |
| `i18n.ts` | Adding text |
| `src/render/scene/*`, `src/ui/hud.ts` | Changing stage presentation |

## Check behavior

- Run `npm test`. A changed fingerprint in `tests/golden.test.mjs` means that the play sequence changed.
  - For a refactor, treat the change as a regression.
  - For an intentional gameplay change, update the hash and explain why in the PR.
- Download replay data from the pause menu and open it in `/replay.html` to inspect the affected ticks.
