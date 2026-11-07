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

Use the stage buttons to start either level, or continue to stage 2 after clearing stage 1.

- Stage 1: dodge copier paper, spilled water, the trash bin and monitor light to leave the office.
- Stage 2: push meeting chairs, time the revolving door, brake on the emergency stairs, and push a cabinet into place to reach the vent. Ride the moving lift platform or use the lower recovery ramp to reach the machine room.

Use Left/Right or A/D to move, Space/Up to jump, Q/E to balance, and Down/S to brake. P pauses. R retries from the last flag in stage 2. Selecting a stage starts it from the beginning.

## Test

```sh
npm test
```

The simulation checks stage 2 traversal, moving furniture, checkpoint retries, and stage 1 hazards.

## Build

```sh
npm run build
npm run preview
```

Pushes to `main` automatically deploy to GitHub Pages via GitHub Actions.
