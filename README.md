# GameJam-The-Chair

A minimal red rectangle example using ThorVG WebCanvas.

[Live demo](https://ossca-thorvg.github.io/GameJam-The-Chair/)

## Run locally

Requires Node.js 22+ and a browser with WebGL 2 support.

```sh
nvm use # If using nvm
npm ci
npm run dev
```

Open http://127.0.0.1:5173/.

## Build

```sh
npm run build
npm run preview
```

Pushes to `main` automatically deploy to GitHub Pages via GitHub Actions.
