# Orbit ending rendering comparison

Prepare the original scene from the main commit, then start Vite:

```sh
node scripts/prepare-orbit-benchmark.mjs 8ea8f87
npm run dev -- --host 127.0.0.1
```

Open `/scripts/orbit-ending-benchmark.html?renderer=sw` at the printed address in an active Chrome tab and click **Run comparison**. The generated baseline bundle is ignored under `scripts/.benchmark/`.

The benchmark uses the existing `orbit-ending` preview snapshots. At each of 15, 20, 25, 30 and 38 seconds, it compares five alternating pairs of eight moving frames per version, after two warmup frames. It measures synchronous drawing time and `requestAnimationFrame` intervals. It also compares every raster pixel at half-second steps from 14 through 38 seconds. The 25-second sample shows a camera angle where little of the nebula is covered by Earth. The 38-second sample covers the fully black ending card. A background tab can throttle `requestAnimationFrame`; keep the tab active.

## Initial ending optimizations

Headless Chrome on the current Mac, ThorVG 1.1.3 software renderer, 1000 × 510 CSS pixels, 1562 × 796 raster pixels, five runs per version and sample:

| Scene | Baseline drawing time | Current drawing time | Baseline frame interval | Current frame interval |
| --- | ---: | ---: | ---: | ---: |
| 15 s, camera pulls back | 40.26 ms | 32.35 ms | 40.49 ms (25 fps) | 30.96 ms (32 fps) |
| 20 s, camera orbit | 29.14 ms | 21.00 ms | 28.57 ms (35 fps) | 21.43 ms (47 fps) |
| 25 s, Earth covers less nebula | 18.44 ms | 17.70 ms | 19.04 ms (53 fps) | 16.67 ms (60 fps) |
| 30 s, camera orbit | 33.38 ms | 21.13 ms | 33.33 ms (30 fps) | 21.43 ms (47 fps) |
| 38 s, ending card | 33.44 ms | 4.59 ms | 33.34 ms (30 fps) | 16.66 ms (60 fps) |

The five drawing-time runs at 20 seconds ranged from 28.79 to 29.89 ms before and from 19.96 to 21.26 ms after. At 38 seconds, they ranged from 33.26 to 34.27 ms before and from 4.43 to 4.98 ms after. All measured frames completed without errors. Software-rendered pixel differences were zero at each checked half-second from 14 through 38 seconds. A separate WebGL comparison at 1750 × 892 raster pixels found 703 changed color channels across those 49 frames, each by only 1/255. While Earth is opaque, the optimized path bounds the nebula geometry to the visible sky above its horizon. From 37 seconds, the ending card is fully opaque, so only the black rectangle and title are built. The 60 fps result is the refresh-rate ceiling of this measurement; the gain varies with camera angle and does not apply to the whole 39-second ending. At 25 seconds, drawing-time ranges overlap and the frame interval is close to a refresh boundary, so that row is not a reliable gain.

## Sky gradient crop follow-up

To compare only the later sky-gradient change, rebuild the baseline from `a44a7ee` with `node scripts/prepare-orbit-benchmark.mjs a44a7ee`. At 25 seconds, the sky gradient used to fill the entire canvas even though opaque Earth covered almost all of it. Its path now stops below the visible horizon while retaining the original gradient coordinates. The half-second pixel sweep from 14 through 38 seconds found zero differences on both software and WebGL renderers against `a44a7ee`.

Three separate five-pair software-renderer comparisons at 25 seconds gave baseline drawing-time medians of 17.65–17.86 ms and current medians of 16.38–16.59 ms. Current frame-interval medians reached 16.66–16.67 ms in all three comparisons; baseline medians ranged from 16.66 to 19.06 ms. This reduces render work by about 1–1.5 ms but does not guarantee a higher displayed FPS on every run near the 60 Hz boundary.

## Close-up and fade-end follow-up

Rebuild the baseline from `b6d12f8` to compare this step. The pixel sweep takes `from`, `to` and `step` query parameters, and `at` picks the timed samples, for example `?renderer=sw&verify&from=0` or `?renderer=sw&at=2,5,10,13,36.95`.

- The sky crop under opaque Earth now covers the whole parked ending, including the over-the-shoulder close-up from 0 to 13 seconds, where only the full-height space gradient was cropped before the shot widened.
- The scene behind the black card is skipped as soon as the card's alpha rounds to 255, about 0.1 seconds before `dark` reaches exactly 1.

Software and WebGL pixel sweeps found zero differences against `b6d12f8` at every half second from 0 through 38 seconds, and at every 0.01 seconds from 36.5 through 37.2 seconds.

Software-renderer drawing-time medians, three five-pair runs at 1562 × 796 raster pixels, under a load average of 25–43 from other processes:

| Scene | Baseline | Current |
| --- | ---: | ---: |
| 2 s | 29.46–34.59 ms | 28.34–33.69 ms |
| 5 s | 27.51–29.32 ms | 26.50–29.15 ms |
| 10 s | 28.38–29.09 ms | 28.14–28.68 ms |
| 13 s | 25.58–31.84 ms | 24.74–31.79 ms |
| 36.95 s | 11.66 ms (53 fps) | 4.84 ms (60 fps) |

The close-up saves about 0.5–1 ms per frame, but the ranges overlap and the frame rate did not change reliably. The close-up's remaining cost is ThorVG rasterizing the large chair and its screen-blended layers (sunrise, Earth air and limb, laptop light, city lights). Drawing a single-shape screen layer with a per-shape blend instead of a Scene was tried and rejected: on ThorVG 1.1.3 it changed color channels by up to 109/255. The nebula and the city lights overlap inside their layers, so they cannot be split into separate screen passes without changing the picture, and their shapes already end at the horizon.
