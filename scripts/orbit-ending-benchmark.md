# Orbit ending rendering comparison

Prepare the original scene from the main commit, then start Vite:

```sh
node scripts/prepare-orbit-benchmark.mjs 8ea8f87
npm run dev -- --host 127.0.0.1
```

Open `/scripts/orbit-ending-benchmark.html?renderer=sw` at the printed address in an active Chrome tab and click **Run comparison**. The generated baseline bundle is ignored under `scripts/.benchmark/`.

The benchmark uses the existing `orbit-ending` preview snapshots. At each of 20 and 38 seconds, it compares five alternating pairs of eight moving frames per version, after two warmup frames. It measures synchronous drawing time and `requestAnimationFrame` intervals. It also compares every raster pixel at the first frame of each sample. The 20-second sample is a control outside the optimized interval. The 38-second sample covers the fully black ending card. A background tab can throttle `requestAnimationFrame`; keep the tab active.

## Observed result

Headless Chrome on the current Mac, ThorVG 1.1.3 software renderer, 1000 × 510 CSS pixels, 1562 × 796 raster pixels, five runs per version and sample:

| Scene | Baseline drawing time | Current drawing time | Baseline frame interval | Current frame interval |
| --- | ---: | ---: | ---: | ---: |
| 20 s, camera orbit | 29.08 ms | 29.07 ms | 28.59 ms (35 fps) | 28.57 ms (35 fps) |
| 38 s, ending card | 33.79 ms | 4.70 ms | 33.33 ms (30 fps) | 16.67 ms (60 fps) |

The five drawing-time runs ranged from 33.50 to 35.18 ms before and from 4.31 to 5.06 ms after at 38 seconds. All measured frames completed without errors. Pixel differences were zero at both sample times. The ending card is fully opaque from 37 seconds, so the optimized path creates only the black rectangle and title instead of the covered world. The 60 fps result is the refresh-rate ceiling of this measurement, and the gain applies only to the final two seconds of the 39-second ending.
