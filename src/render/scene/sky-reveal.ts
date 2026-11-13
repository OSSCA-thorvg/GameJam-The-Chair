import { STAGE_FOUR } from '../../game/stages/sky/data';
import { STAGE_FIVE } from '../../game/stages/orbit/data';
import type { RenderCtx } from '../context';
import type { LayerSpec } from '../types';
import { createSkyProjection, type Point3 } from './sky-projection';
import { endingChair } from './sky-ending-art';
import { skyDeparture } from './sky-departure';
import { SKY_TURN } from './sky-camera';
import { basinCloudSeeds, doorGlow, orbitCloudBank, orbitSky } from './orbit-atmosphere';
import { orbitDoor, orbitHoop } from './orbit-art';

const smooth = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
};

// Stage five starts with the chair at the centre of its cloud basin, before any travel.
const BASIN = { x: 0, y: 0 };

/** Runs `draw`, then moves everything it pushed into one ThorVG scene layer (commands with their own layer keep it). */
function inLayer(ctx: RenderCtx, layer: LayerSpec, draw: () => void) {
    const from = ctx.commands.length;
    draw();
    for (let i = from; i < ctx.commands.length; i++) if (!ctx.commands[i].layer) ctx.commands[i] = { ...ctx.commands[i], layer };
}

// Screen-space commands still go through the shared ThorVG paint pool and Canvas2D fallback.
// The camera swings from the chair's side to a three-quarter view through the cloud basin,
// so the last frame here is the first frame of stage five.
export function drawSkyReveal(ctx: RenderCtx) {
    const { sky } = ctx.state;
    const { settle, turn, hold } = STAGE_FOUR.reveal;
    const elapsed = sky.phase === 'depth' ? settle + turn + sky.age : sky.age;
    const progress = smooth((elapsed - settle) / Math.min(turn, SKY_TURN.duration));
    const orbit = progress * SKY_TURN.orbit;
    const goal = smooth((elapsed - settle - turn) / (hold * .6));
    const view = createSkyProjection(ctx.W, ctx.H, orbit);
    // The clouds use the stage-five camera framing by the end of the turn.
    const basin = createSkyProjection(ctx.W, ctx.H, progress, { centerY: .5 - .13 * progress, eyeY: 45 - 30 * progress });
    const point = (x: number, y: number, z: number): Point3 => [z, 15 + y, x];
    // Only the clouds of stage five's first frame are drawn, so none appears mid-turn and then vanishes.
    const only = basinCloudSeeds(ctx, createSkyProjection(ctx.W, ctx.H, 1, { centerY: .37, level: true }), 0, BASIN);

    ctx.commands.push({ v: [[0, 0], [ctx.W, 0], [ctx.W, ctx.H], [0, ctx.H]], c: {
        from: [0, 0], to: [0, ctx.H], stops: [[0, ctx.rgba('#678eae')], [1, ctx.rgba('#b7ced1')]],
    } });
    // The basin sky and its distant city fade in under the turning camera.
    inLayer(ctx, { key: 'sky-ending-basin', opacity: smooth(elapsed / (settle + turn)) }, () => orbitSky(ctx, BASIN));
    ctx.commands.push({ v: [[0, 0], [ctx.W, 0], [ctx.W, ctx.H], [0, ctx.H]],
        layer: { key: 'sky-ending-sunlight', blend: 'screen' }, c: {
            from: [ctx.W * .75, ctx.H * .15], to: [ctx.W, ctx.H], radius: ctx.W * .8,
            stops: [[0, ctx.rgba('#ffdfb5', .16)], [1, ctx.rgba('#ffdfb5', 0)]],
        },
    });
    orbitCloudBank(ctx, basin, 0, false, { anchor: BASIN, only, nearDepth: 1100 });
    // Keep the forward scenery aligned with stage five while the chair holds its three-quarter view.
    if (goal > 0) doorGlow(ctx, basin, point(STAGE_FIVE.door.x, STAGE_FIVE.door.y + 60, STAGE_FIVE.door.z), goal);
    if (goal > 0) inLayer(ctx, { key: 'sky-ending-goal', opacity: goal }, () => {
        orbitDoor(basin, point(STAGE_FIVE.door.x, STAGE_FIVE.door.y, STAGE_FIVE.door.z));
        ctx.commands.push(...basin.commands());
        for (let i = STAGE_FIVE.rings.length - 1; i >= 0; i--) {
            const ring = STAGE_FIVE.rings[i];
            orbitHoop(ctx, basin, point(ring.x, ring.y, ring.z), ring.radius, false);
        }
    });
    orbitCloudBank(ctx, basin, 0, true, { anchor: BASIN, only, nearDepth: 1100 });
    const departure = smooth(elapsed / (settle * .7));
    skyDeparture(ctx, departure);
    endingChair(view, elapsed, 1 + 1.5 * (1 - departure), 1 - departure);
    ctx.commands.push(...view.commands());
}
