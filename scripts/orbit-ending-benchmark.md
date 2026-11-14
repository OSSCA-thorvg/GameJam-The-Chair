# Orbit ending rendering comparison

Prepare the original scene from the main commit, then start Vite:

```sh
node scripts/prepare-orbit-benchmark.mjs 8ea8f87
npm run dev -- --host 127.0.0.1
```

Open `/scripts/orbit-ending-benchmark.html?renderer=sw` at the printed address in an active Chrome tab and click **Run comparison**. The generated baseline bundle is ignored under `scripts/.benchmark/`.

The benchmark uses the existing `orbit-ending` preview snapshots. At each of 15, 20, 25, 30 and 38 seconds, it compares five alternating pairs of eight moving frames per version, after two warmup frames. It measures synchronous drawing time and `requestAnimationFrame` intervals. It also compares every raster pixel at half-second steps from 14 through 38 seconds. The 25-second sample shows a camera angle where little of the nebula is covered by Earth. The 38-second sample covers the fully black ending card. A background tab can throttle `requestAnimationFrame`; keep the tab active.

## Observed result

Headless Chrome on the current Mac, ThorVG 1.1.3 software renderer, 1000 × 510 CSS pixels, 1562 × 796 raster pixels, five runs per version and sample:

| Scene | Baseline drawing time | Current drawing time | Baseline frame interval | Current frame interval |
| --- | ---: | ---: | ---: | ---: |
| 15 s, camera pulls back | 40.26 ms | 32.35 ms | 40.49 ms (25 fps) | 30.96 ms (32 fps) |
| 20 s, camera orbit | 29.14 ms | 21.00 ms | 28.57 ms (35 fps) | 21.43 ms (47 fps) |
| 25 s, Earth covers less nebula | 18.44 ms | 17.70 ms | 19.04 ms (53 fps) | 16.67 ms (60 fps) |
| 30 s, camera orbit | 33.38 ms | 21.13 ms | 33.33 ms (30 fps) | 21.43 ms (47 fps) |
| 38 s, ending card | 33.44 ms | 4.59 ms | 33.34 ms (30 fps) | 16.66 ms (60 fps) |

The five drawing-time runs at 20 seconds ranged from 28.79 to 29.89 ms before and from 19.96 to 21.26 ms after. At 38 seconds, they ranged from 33.26 to 34.27 ms before and from 4.43 to 4.98 ms after. All measured frames completed without errors. Software-rendered pixel differences were zero at each checked half-second from 14 through 38 seconds. A separate WebGL comparison at 1750 × 892 raster pixels found 703 changed color channels across those 49 frames, each by only 1/255. While Earth is opaque, the optimized path bounds the nebula geometry to the visible sky above its horizon. From 37 seconds, the ending card is fully opaque, so only the black rectangle and title are built. The 60 fps result is the refresh-rate ceiling of this measurement; the gain varies with camera angle and does not apply to the whole 39-second ending. At 25 seconds, drawing-time ranges overlap and the frame interval is close to a refresh boundary, so that row is not a reliable gain.
