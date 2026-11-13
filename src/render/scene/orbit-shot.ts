import type { RenderCtx } from '../context';
import { createSkyProjection, placedProjection, type Point3, type SkyProjection } from './sky-projection';
import { routeBend, routeHeading } from './orbit-route';
import { orbitCoffee, orbitDebris, orbitGeofence, orbitSpeedLines } from './orbit-flight';
import { endingChair } from './sky-ending-art';
import { skyDeparture } from './sky-departure';
import { basinCloudSeeds, orbitCloudBank, orbitSky, type CloudBankOptions } from './orbit-atmosphere';
import { ORBIT_WATCH, orbitBeacon, orbitCloudGlints, orbitWatchers, orbitWatchGlow } from './orbit-watch';
import { ATTENDANCE, attendanceBubble } from './attendance-bubble';
import { orbitPraise, orbitPraiseOnChair } from './orbit-praise';
import { inOpacity, orbitEarth, orbitHeights, orbitHighSky, orbitShadow } from './orbit-heights';
import { endingChairLights, endingFade, endingNebula, type OrbitEndingState } from './orbit-ending';
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
    /** The chair's offset across (x) and up (y) the route, its velocity there, and its bank. */
    p: { x: number; y: number; vx: number; vy: number; a: number };
    /** Forward speed along the route. */
    speed: number;
    /** How hard the extinguisher is pushing right now (0 to 1). */
    push: number;
    /** Coffee cups already drunk (one bit each), and seconds left of the rider's sip. */
    drunk: number;
    sip: number;
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

/** The sky: the reveal's plain sky under the basin sky, warm sunlight, and the climb toward space. */
function backdrop(ctx: RenderCtx, shot: OrbitShot, clouds: number, cam: { x: number; y: number }, yaw: number) {
    const heights = orbitHeights(shot.travel);
    if (shot.basin < 1) {
        ctx.commands.push({ v: screen(ctx), c: { from: [0, 0], to: [0, ctx.H], stops: [[0, ctx.rgba('#678eae')], [1, ctx.rgba('#b7ced1')]] } });
        inOpacity(ctx, { key: 'orbit-basin-sky', opacity: shot.basin }, () => orbitSky(ctx, cam, yaw));
    } else orbitSky(ctx, cam, yaw);
    // Low sunlight over the cloud basin, thinning out as the chair climbs out of the clouds.
    if (clouds > 0) ctx.commands.push({ v: screen(ctx), layer: { key: 'orbit-sunlight', blend: 'screen' }, c: {
        from: [ctx.W * .75, ctx.H * .15], to: [ctx.W, ctx.H], radius: ctx.W * .8,
        stops: [[0, ctx.rgba('#ffdfb5', .16 * clouds)], [1, ctx.rgba('#ffdfb5', 0)]],
    } });
    orbitHighSky(ctx, heights, yaw);
    endingNebula(ctx, shot.ending.wide);
    orbitEarth(ctx, heights, shot.ending.wide);
    return heights;
}

export function drawOrbitShot(ctx: RenderCtx, shot: OrbitShot) {
    const { travel, p, turn, ending, since } = shot;
    const clouds = 1 - orbitHeights(travel).air;
    const wide = ending.wide, blend = smooth(shot.entry);
    const mix = (a: number, b: number, k: number) => a + (b - a) * k;
    // The camera follows most of the chair's offset, a beat late, so the chair leads into every move.
    const lag = .3, follow = .82;
    const cam = { x: follow * (p.x - p.vx * lag), y: follow * (p.y - p.vy * lag) };
    const heading = routeHeading(travel);
    const heights = backdrop(ctx, shot, clouds, cam, heading);
    const fast = smooth((shot.speed - C.cruise) / (C.maxSpeed - C.cruise));
    const push = shot.push * blend;
    // One camera for the world and the chair. It swings from the reveal's raised side view to behind the chair,
    // dollies back once stage five is under way, widens with speed, rolls a little with the bank and shakes
    // while the extinguisher fires; the ending pulls it back onto the wide horizon.
    const view = createSkyProjection(ctx.W, ctx.H, turn, {
        centerY: .5 - .13 * turn + Math.sin(ctx.t * 47) * .002 * push, eyeY: 45 - 30 * turn,
        distance: 480 + 210 * blend, zoom: mix(1 - .08 * fast, .72, wide), roll: mix(p.a * .35, 0, wide),
        offsetX: Math.sin(ctx.t * 53) * 1.2 * push,
    });
    const point = (x: number, y: number, z: number): Point3 => [z - travel, 15 + y - cam.y, x - cam.x + routeBend(travel, heading, z - travel)];
    // The chair sits a little below the camera's line of sight, banking and pitching with its own motion.
    const sink = 38 * turn + 72 * blend;
    const bank = mix(p.a * .65, 0, wide), pitch = mix(Math.max(-.2, Math.min(.2, p.vy / 900)), 0, wide);
    const pivot = -25, offset: Point3 = [0, -sink + p.y - cam.y, p.x - cam.x];
    const chair = placedProjection(view, ([x, y, z]) => {
        const ly = y - pivot;
        const x1 = x * Math.cos(pitch) - ly * Math.sin(pitch), y1 = x * Math.sin(pitch) + ly * Math.cos(pitch);
        return [x1 + offset[0], y1 * Math.cos(bank) - z * Math.sin(bank) + pivot + offset[1], y1 * Math.sin(bank) + z * Math.cos(bank) + offset[2]];
    });
    // Until stage five begins, only the clouds of its first frame are drawn, so none appears mid-turn and then
    // vanishes; they glide in with the chair and are exactly where stage five picks them up.
    const bend = (dz: number) => routeBend(travel, heading, dz);
    const options: CloudBankOptions = since < 0
        ? { anchor: cam, bend, nearDepth: 1100, unwrapped: true, only: basinCloudSeeds(ctx, createSkyProjection(ctx.W, ctx.H, 1, { centerY: .37, level: true }), 0, cam) }
        : { anchor: cam, bend };
    inOpacity(ctx, { key: 'orbit-low-clouds', opacity: clouds }, () => orbitCloudBank(ctx, view, travel, false, options));
    if (turn >= ORBIT_WATCH.glintsFrom) orbitCloudGlints(ctx, clouds);
    // The watchers stay out of the flat side view and turn up one by one as the view turns into 3D.
    if (turn >= ORBIT_WATCH.beacon.appear) orbitBeacon(ctx, view, point);
    const lamps = turn > 0 ? orbitWatchers(view, point, travel, ctx.t, turn) : [];
    // Papers and cups belong to the flight: they drift in late in the glide, after the cameras have had the stage,
    // and leave again as the ending widens onto the quiet horizon.
    const flight = smooth((since + 2) / 1.5) * (1 - wide);
    orbitDebris(view, point, travel, ctx.t, flight);
    const coffeeGlow = orbitCoffee(ctx, view, point, travel, shot.drunk, ctx.t, flight);
    orbitGeofence(view, point, travel, p);
    // Scenery beyond the chair first; the chair and whatever passes beside it are painted after the clouds.
    const split = { depth: chair.depth([0, pivot, 0]) + 90, part: 'far' as const };
    ctx.commands.push(...view.commands(split));
    orbitWatchGlow(ctx, view, lamps);
    coffeeGlow();
    // The praise beams fade in with their satellites while the camera turns.
    orbitPraise(ctx, view, point, since, travel, smooth((turn - ORBIT_WATCH.satelliteAppear) / .3));
    inOpacity(ctx, { key: 'orbit-near-clouds', opacity: clouds }, () => orbitCloudBank(ctx, view, travel, true, options));
    orbitShadow(ctx, heights, wide);
    skyDeparture(ctx, shot.departure);
    orbitSpeedLines(ctx, view.project(point(0, 0, travel + 100000)), fast * (1 - wide));
    endingChair(chair, shot.clock, shot.spray, shot.arrival);
    if (shot.sip > 0) sipCup(chair, shot.sip);
    ctx.commands.push(...view.commands({ ...split, part: 'near' }));
    endingChairLights(ctx, chair, ending);
    orbitPraiseOnChair(ctx, chair.project([0, 0, 0]), since, p, travel);
    const head = chair.project([4, 70, 0]);
    // The laptop answers the cameras just before stage five and the bubble stays up into its first moments;
    // deep in the Earth's shadow the laptop finally loses its connection.
    if (ending.parked) attendanceBubble(ctx, head, ending.t + .4, 'orbit.disconnected');
    else attendanceBubble(ctx, head, since + ATTENDANCE.lead);
    endingFade(ctx, ending);
}

/** A paper cup raised beside the laptop for a moment after flying through a coffee. */
function sipCup(chair: SkyProjection, sip: number) {
    const lift = Math.sin(Math.min(1, sip / C.coffee.sip) * Math.PI) * 14;
    chair.rod([24, 4 + lift, 26], [24, 20 + lift, 26], 6, '#f5f1e8');
    chair.oval([24, 20 + lift, 26], [6, 1.5, 6], '#5a3a26');
    chair.rod([24, 8 + lift, 26], [24, 13 + lift, 26], 6.3, '#c94a3c');
}
