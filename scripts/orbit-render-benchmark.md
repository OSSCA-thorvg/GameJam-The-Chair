# Cloud entry rendering comparison

Use Node.js 22, then run these commands from the repository root:

```sh
node scripts/prepare-orbit-benchmark.mjs e0fa593
npm run dev
```

Open `/scripts/orbit-render-benchmark.html` at the server's printed address. Keep the tab visible and click **Run comparison**. Avoid builds and other CPU-heavy work during the run. The generated baseline stays in the ignored `scripts/.benchmark/` directory.

The tool renders the same moving game snapshots with the previous and current scene code. It runs five alternating comparisons of 40 frames per side, after eight warmup frames per run. It checks finite geometry and a nonempty rendered canvas, and reports errors, frame intervals, drawing time, and work counts. Separate profiling samples split command generation from ThorVG painting.

Both sides clear their command buffers before drawing. This excludes the baseline's accumulation bug and gives a conservative single-frame comparison. The regression test in `tests/stage5.test.mjs` covers accumulation separately. Visual content intentionally changes from peach clouds to stage four's shared bread cloud appearance.

## Observed result

Chrome on the current Mac, Vite development server, ThorVG 1.1.3 software renderer, 1000 × 510 CSS pixels and a 1750 × 892 raster surface:

| Metric | Baseline | Optimized |
| --- | ---: | ---: |
| Median drawing time per frame | 126.21 ms | 41.84 ms |
| Range of the five run means | 121.46–130.68 ms | 40.15–44.48 ms |
| Median frame interval | 124.77 ms | 43.59 ms |
| Completed measured frames | 200 | 200 |
| Cubic segments at 3 seconds | 13,153 | 3,197 |
| Gradients at 3 seconds | 274 | 92 |

There were no reported errors. Separate profiling placed most of the time in painting, including WASM submission and software rasterization: approximately 107 ms before and 32 ms after, versus 6.5 ms and 2.6 ms for command generation. This is a rendering-bound workload. The reduced overlapping cloud area, transparent underside, and bounded door-light surface reduce that work. Placement caching removes repeated setup, while clearing the command buffer prevents drawing cost and memory from growing with play time.

These are measurements of this browser and viewport, not a claim of 60 FPS or a device-independent speedup. Tests compare the shared bread cloud commands with the original stage-four style and check that reverse seeking and earlier stages still work.
