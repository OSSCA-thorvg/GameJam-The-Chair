# GameJam-The-Chair

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

## Play

Clear each stage to continue to the next. The pause menu lists cleared stages for replay and saves your progress in this browser.

- Stage 1: dodge copier paper, spilled water, the trash bin and monitor light to leave the office.
- Stage 2: watch a worker send three cheering chairs home, stop for a chair-only badge scan, and jump over an overtime delivery cart. Enter the extended meeting for an optional six-second scene, or continue straight to the machine room.

Use Left/Right or A/D to move, Space/Up to jump, and Q/E to balance. F sprays the extinguisher once equipped in stage 3. P pauses.

Near the stage 2 meeting door, press Down to enter. Press Down again to leave early. Touch controls use the same down arrow. At the badge scanner, release the movement keys and wait for approval.

Stages 1 and 2 start with a safe jump practice area. R retries from the last flag: before the trash bin in stage 1, or the last checkpoint in stage 2. Retries restore full focus and a dry chair. Selecting a stage starts it from the beginning.

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
