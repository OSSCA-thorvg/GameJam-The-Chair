# GameJam-The-Chair

[English](README.md) | [한국어](README-ko.md)

A chair escape game rendered with ThorVG WebCanvas. The employee keeps working while the chair rolls through the building.

[Live demo](https://ossca-thorvg.github.io/GameJam-The-Chair/)

## Run locally

Requires Node.js 22+ and a browser with WebGL 2 support.

```sh
nvm use # If using nvm
npm ci
npm run dev
```

Open http://127.0.0.1:5173/.

To inspect the cleaner, bucket, copier, duct, head impact, extinguisher animation, or sky ending, open http://127.0.0.1:5173/preview.html while the development server is running. Choose a scene, drag the time slider, step one frame at a time, or play the loop. The URL keeps the selected scene and time across reloads. For the stage 4 ending, open http://127.0.0.1:5173/preview.html?motion=sky-ending. The chair stays in side view for one second, the camera turns behind it over seven seconds, and the back view holds for two seconds before the stage clears.

## Renderer

The game draws with ThorVG's GPU renderer (`gl`, WebGL2) whenever the browser has hardware-backed WebGL2, and falls back to ThorVG's software renderer (`sw`) otherwise, including when WebGL is only emulated on the CPU. The software renderer rasterizes every pixel on one CPU core, so it slows down on large and high-DPI screens. Add `?renderer=sw` or `?renderer=gl` to the URL to force one, for example to compare them.

## Performance overlay

Press `F3` or `` ` `` in the game, or open http://127.0.0.1:5173/?debug=1, to show developer metrics: FPS and frame time (average, p95, max over the last second), a stacked frame-time graph, time per stage (`sim`, `build`, `sync`, `render`, `hud`), fixed ticks per frame and discarded simulation time, the render backend (with a warning when ThorVG fell back from the requested one), GPU time from WebGL2 timer queries (average, p95, max, and a white line on the graph; Chrome on most desktops, `n/a` with the software renderer), the canvas size in CSS pixels and the raster size ThorVG actually draws (it applies its own DPR, `1 + (dpr - 1) × 0.75`), ThorVG counters (draw commands, pooled shapes and layer scenes, paint-order rebuilds, gaussian and motion blur with their on-canvas area, masks, clips), the JS heap (Chrome only) and the ThorVG WebAssembly memory. **Copy metrics** puts a JSON snapshot on the clipboard. The **Layers** list shows every layer scene drawn recently with its shape count, screen coverage and effects; **Hide** stops drawing it and **Flat** draws its shapes without the scene (no opacity, blend, blur, clip or mask), so the change in `render` shows what the layer costs. Switches reset when the overlay closes. From the console: `officeStageOne.perf.layers.hide(key)`, `.flatten(key)`, `.reset()`, `.list()`. Timing stays outside the game core and is off while the overlay is closed.

## Play

Clear each stage to continue to the next. The pause menu lists cleared stages for replay and saves your progress in this browser.

- Stage 1: dodge copier paper, spilled water, the trash bin and monitor light to leave the office.
- Stage 2: watch a worker send three cheering chairs home, stop for a chair-only badge scan, and jump over an overtime delivery cart. Enter the extended meeting for an optional six-second scene, or continue straight to the machine room.

Use Left/Right or A/D to move, Space/Up to jump, and Q/E to balance. In stage 3, Up jumps; hold Space (or F) to spray after collecting the extinguisher on the lower rooftop. Sprays repeat every 0.24 seconds without an ammo limit; Left/Right steers the recoil. P pauses.

Near the stage 2 meeting door, press Down to enter. Press Down again to leave early. Touch controls use the same down arrow. At the badge scanner, release the movement keys and wait for approval.

Stages 1 and 2 start with a safe jump practice area. R retries from the last flag: before the trash bin in stage 1, or the last checkpoint in stage 2. Retries restore full focus and a dry chair. Selecting a stage starts it from the beginning.

## Code structure

Base new code and changes on the refactored structure and style present when the task starts. Follow the [game core rules](src/game/README.md), [stage layout](src/game/stages/README.md), and [shared test tools](tests/support/README.md).

Keep stage behaviour in its stage folder. Separate pure decisions in `decide.ts` from state updates in `apply.ts`. Render and UI code consume game snapshots. Use the existing golden tests to check that refactors preserve gameplay.

## Test

```sh
npm test
```

The tests check stage 2 traversal, chair dispatch, meeting entry and return, badge scanning, cart avoidance and collision, starter jump landings, checkpoint retries, actual movement speed, failure guidance, and stage 1 hazards.

## Build

```sh
npm run build
npm run preview
```

Pushes to `main` automatically deploy to GitHub Pages via GitHub Actions.

At the end of the stage 3 rooftop, release Left/Right and hold Space for three consecutive upward bursts. The extinguisher switches to continuous thrust, carrying the chair smoothly upward into the stage 4 starting area, where it keeps spraying and hovering in open air.
