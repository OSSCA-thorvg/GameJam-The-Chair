import type { RenderCtx } from '../context';
import type { LayerSpec } from '../types';
import { createSkyProjection, type Point3 } from './sky-projection';
import { endingChair } from './sky-ending-art';
import { skyDeparture } from './sky-departure';
import { basinCloudSeeds, orbitCloudBank, orbitSky, type CloudBankOptions } from './orbit-atmosphere';
import { ORBIT_WATCH, orbitBeacon, orbitCloudGlints, orbitWatchers, orbitWatchGlow } from './orbit-watch';
import { ATTENDANCE, attendanceBubble } from './attendance-bubble';
import { orbitPraise, orbitPraiseOnChair } from './orbit-praise';
import { inOpacity, orbitEarth, orbitHeights, orbitHighSky, orbitShadow } from './orbit-heights';
import { endingChairFraming, endingChairLights, endingFade, endingNebula, type OrbitEndingState } from './orbit-ending';
import { STAGE_FIVE as C } from '../../game/stages/orbit/data';

/**
 * One frame of the flight from the stage four reveal through stage five. Both stages describe their moment with
 * these numbers and draw through `drawOrbitShot`, so the last reveal frame and the first stage five frame are the
 * same picture by construction.
 */
export type OrbitShot = {
    /** Seconds since stage five started; negative during the stage four reveal. */
    since: number;
    /** Route depth of the chair; negative while the reveal glides up to stage five's start. */
    travel: number;
    /** The chair's offset across (x) and up (y) the route, and its bank. */
    p: { x: number; y: number; a: number };
    /** Camera orbit around the chair: 0 from its side, 1 from behind. */
    turn: number;
    /** Clock for the rider's bob and typing. */
    clock: number;
    spray: number;
    /** The landing shake at the start of the reveal. */
    arrival: number;
    /** How far the last stage four ledge has drifted away (1 once it is gone). */
    departure: number;
    /** The cloud basin sky over the plain reveal sky (1 once the turn is done). */
    basin: number;
    /** The stage five chair framing pulling back from the reveal's close-up. */
    entry: number;
    ending: OrbitEndingState;
};

const smooth = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
};

const screen = (ctx: RenderCtx): [number, number][] => [[0, 0], [ctx.W, 0], [ctx.W, ctx.H], [0, ctx.H]];

/** Puts everything `draw` pushes into one ThorVG scene layer (commands with their own layer keep it). */
function inLayer(ctx: RenderCtx, layer: LayerSpec, draw: () => void) {
    const from = ctx.commands.length;
    draw();
    for (let i = from; i < ctx.commands.length; i++) if (!ctx.commands[i].layer) ctx.commands[i] = { ...ctx.commands[i], layer };
}

/** The sky: the reveal's plain sky under the basin sky, warm sunlight, and the climb toward space. */
function backdrop(ctx: RenderCtx, shot: OrbitShot, clouds: number) {
    const heights = orbitHeights(shot.travel);
    if (shot.basin < 1) {
        ctx.commands.push({ v: screen(ctx), c: { from: [0, 0], to: [0, ctx.H], stops: [[0, ctx.rgba('#678eae')], [1, ctx.rgba('#b7ced1')]] } });
        inOpacity(ctx, { key: 'orbit-basin-sky', opacity: shot.basin }, () => orbitSky(ctx, shot.p));
    } else orbitSky(ctx, shot.p);
    // Low sunlight over the cloud basin, thinning out as the chair climbs out of the clouds.
    if (clouds > 0) ctx.commands.push({ v: screen(ctx), layer: { key: 'orbit-sunlight', blend: 'screen' }, c: {
        from: [ctx.W * .75, ctx.H * .15], to: [ctx.W, ctx.H], radius: ctx.W * .8,
        stops: [[0, ctx.rgba('#ffdfb5', .16 * clouds)], [1, ctx.rgba('#ffdfb5', 0)]],
    } });
    orbitHighSky(ctx, heights);
    endingNebula(ctx, shot.ending.wide);
    orbitEarth(ctx, heights, shot.ending.wide);
    return heights;
}

export function drawOrbitShot(ctx: RenderCtx, shot: OrbitShot) {
    const { travel, p, turn, ending, since } = shot;
    const clouds = 1 - orbitHeights(travel).air;
    const heights = backdrop(ctx, shot, clouds);
    // The world camera eases from the reveal's raised side view to stage five's level view behind the chair.
    const view = createSkyProjection(ctx.W, ctx.H, turn, { centerY: .5 - .13 * turn, eyeY: 45 - 30 * turn });
    const point = (x: number, y: number, z: number): Point3 => [z - travel, 15 + y - p.y * .65, x - p.x * .7];
    // Until stage five begins, only the clouds of its first frame are drawn, so none appears mid-turn and then
    // vanishes; they glide in with the chair and are exactly where stage five picks them up.
    const options: CloudBankOptions = since < 0
        ? { anchor: p, nearDepth: 1100, unwrapped: true, only: basinCloudSeeds(ctx, createSkyProjection(ctx.W, ctx.H, 1, { centerY: .37, level: true }), 0, p) }
        : { anchor: p };
    inOpacity(ctx, { key: 'orbit-low-clouds', opacity: clouds }, () => orbitCloudBank(ctx, view, travel, false, options));
    if (turn >= ORBIT_WATCH.glintsFrom) orbitCloudGlints(ctx, clouds);
    // The watchers stay out of the flat side view and turn up one by one as the view turns into 3D.
    if (turn > 0) inLayer(ctx, { key: 'orbit-watch' }, () => {
        if (turn >= ORBIT_WATCH.beacon.appear) orbitBeacon(ctx, view, point);
        const lamps = orbitWatchers(view, point, travel, ctx.t, turn);
        ctx.commands.push(...view.commands());
        orbitWatchGlow(ctx, view, lamps);
    });
    // The praise beams fade in with their satellites while the camera turns.
    orbitPraise(ctx, view, point, since, travel, smooth((turn - ORBIT_WATCH.satelliteAppear) / .3));
    inOpacity(ctx, { key: 'orbit-near-clouds', opacity: clouds }, () => orbitCloudBank(ctx, view, travel, true, options));
    orbitShadow(ctx, heights, ending.wide);
    skyDeparture(ctx, shot.departure);
    const blend = smooth(shot.entry);
    const chair = createSkyProjection(ctx.W, ctx.H, turn, endingChairFraming(ctx, {
        zoom: 1 - blend * .3, centerY: .5 + blend * .2 - p.y / C.bounds.y * .12,
        offsetX: p.x / C.bounds.x * ctx.W * .18, roll: p.a,
    }, ending));
    endingChair(chair, shot.clock, shot.spray, shot.arrival);
    ctx.commands.push(...chair.commands());
    endingChairLights(ctx, chair, ending);
    orbitPraiseOnChair(ctx, chair.project([0, 0, 0]), since, p, travel);
    const head = chair.project([4, 70, 0]);
    // The laptop answers the cameras just before stage five and the bubble stays up into its first moments;
    // deep in the Earth's shadow the laptop finally loses its connection.
    if (ending.parked) attendanceBubble(ctx, head, ending.t + .4, 'orbit.disconnected');
    else attendanceBubble(ctx, head, since + ATTENDANCE.lead);
    endingFade(ctx, ending);
}
