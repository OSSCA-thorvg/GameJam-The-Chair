# Scene rendering

Scene modules turn `RenderCtx` values into ordered drawing commands. They do not
change game rules or own ThorVG objects. `render/paint` applies those commands to
the drawing backend.

| Folder         | Responsibility                                                              |
| -------------- | --------------------------------------------------------------------------- |
| `office`       | Stage 1 world, colleagues, cleaning, water, monitors, and copiers           |
| `building`     | Stage 2 corridor, chair convoy, meetings, and dispatch room                 |
| `rooftop`      | Stage 3 rooftop, ducts, and graph platform                                  |
| `sky`          | Stage 4 clouds, floating office, and departure                              |
| `orbit`        | Stage 5 flight, Earth, satellite lights, and ending                         |
| `opening`      | Opening animation and timeline                                              |
| `player`       | Player body, chair, and stains                                              |
| `personal-box` | Personal belongings and badge                                               |
| `effects`      | Spray, focus vignette, and death burst                                      |
| `shared`       | Projection, cloud shapes, props, cameras, and scene text used across stages |

The stage folders' `index.ts` files contain their scene implementation, rather
than forwarding exports. Stage 1 starts at `office/world.ts`; the cloud transition
starts at `sky/clouds.ts`. Import helpers directly from their owning modules.

Keep the order of drawing commands and restore changes to transforms and layers.
Check rendering changes in `/preview.html`, including seeking backward.

The completed migration can be rerun with `node scripts/reorganize-scenes.mjs`.
It updates relative module paths and embedded test entry points, refuses to
overwrite destinations, and leaves the organized tree unchanged on a second run.
