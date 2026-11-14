import type { RenderCtx } from '../context';
import { createSkyProjection, placedProjection, type Point3 } from './sky-projection';
import { routeBend, routeHeading } from './orbit-route';
import { orbitEdgePuffs, orbitSlipstream, orbitSpeedLines } from './orbit-flight';
import { endingChair } from './sky-ending-art';
import { skyDeparture } from './sky-departure';
import { basinCloudSeeds, orbitCloudBank, orbitSky, type CloudBankOptions } from './orbit-atmosphere';
import { ORBIT_WATCH, orbitBeacon, orbitCloudGlints, orbitWatchers, orbitWatchGlow } from './orbit-watch';
import { ATTENDANCE, attendanceBubble } from './attendance-bubble';
import { orbitPraise, orbitPraiseOnChair } from './orbit-praise';
import { inOpacity, orbitHeights, orbitHighSky, orbitShadow } from './orbit-heights';
import { earthHorizonAhead, orbitEarth, type EarthCamera } from './orbit-earth';
import { endingChairLights, endingFade, endingLaptopScreen, endingLaptopText, endingNebula, endingSignal, type OrbitEndingState } from './orbit-ending';
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

/** How far round the chair (in quarter turns) the camera leans over the rider's shoulder at the start of the ending. */
const SHOULDER = .38;

const smooth = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
};

const screen = (ctx: RenderCtx): [number, number][] => [[0, 0], [ctx.W, 0], [ctx.W, ctx.H], [0, ctx.H]];

/** The sky: the reveal's plain sky under the basin sky, warm sunlight, and the climb toward space. */
function backdrop(ctx: RenderCtx, shot: OrbitShot, clouds: number, cam: { x: number; y: number }, yaw: number, earth: EarthCamera, spin: number) {
    const heights = orbitHeights(shot.travel);
    if (shot.basin < 1) {
        ctx.commands.push({ v: screen(ctx), c: { from: [0, 0], to: [0, ctx.H], stops: [[0, ctx.rgba('#678eae')], [1, ctx.rgba('#b7ced1')]] } });
        inOpacity(ctx, { key: 'orbit-basin-sky', opacity: shot.basin }, () => orbitSky(ctx, cam, yaw));
    } else orbitSky(ctx, cam, yaw);
    // Low sunlight over the cloud basin, thinning out as the chair climbs out of the clouds. Plain alpha instead of
    // a screen-blended Scene: over the sky behind the sun, #fff2eb paints what #ffdfb5 screened would
    // (c + d(1 - c) for d = #7499b9), without a full-canvas offscreen pass.
    if (clouds > 0) ctx.commands.push({ v: screen(ctx), layer: { key: 'orbit-sunlight' }, c: {
        from: [ctx.W * .75, ctx.H * .15], to: [ctx.W, ctx.H], radius: ctx.W * .8,
        stops: [[0, ctx.rgba('#fff2eb', .16 * clouds)], [1, ctx.rgba('#fff2eb', 0)]],
    } });
    orbitHighSky(ctx, heights, yaw, spin);
    endingNebula(ctx, shot.ending.wide, spin);
    // In the ending the sun comes up over the rim and day returns to the ground below.
    orbitEarth(ctx, shot.travel, earth, yaw, heights.air, heights.shadow * (1 - shot.ending.wide), spin);
    return heights;
}

export function drawOrbitShot(ctx: RenderCtx, shot: OrbitShot) {
    const { travel, p, turn, ending, since } = shot;
    const clouds = 1 - orbitHeights(travel).air;
    const wide = ending.wide, blend = smooth(shot.entry);
    const mix = (a: number, b: number, k: number) => a + (b - a) * k;
    // The camera follows most of the chair's offset, a beat late, so the chair leads into every move. It stops at
    // the edge of the play area, so a chair pressing past it slides out toward the side of the screen.
    const lag = .3, follow = .82;
    const within = (v: number, bound: number) => Math.max(-bound, Math.min(bound, v));
    const cam = { x: follow * within(p.x - p.vx * lag, C.bounds.x), y: follow * within(p.y - p.vy * lag, C.bounds.y) };
    // How hard the chair is pressing out past the edge, and which way.
    const over = { x: Math.max(0, Math.abs(p.x) - C.bounds.x + 40) * Math.sign(p.x), y: Math.max(0, Math.abs(p.y) - C.bounds.y + 40) * Math.sign(p.y) };
    const edge = smooth(Math.hypot(over.x, over.y) / (C.steer.overshoot + 40)) * (1 - wide);
    const heading = routeHeading(travel);
    const fast = smooth((shot.speed - C.cruise) / (C.maxSpeed - C.cruise));
    const push = shot.push * blend;
    // How hard the chair is rushing forward. Speed only climbs while the extinguisher fires, so as the chair
    // accelerates the camera falls back behind it, and eases in again as it coasts.
    const rush = smooth((shot.speed - .4 * C.cruise) / (C.maxSpeed - .4 * C.cruise));
    const distance = 480 + 210 * blend + 150 * rush * (1 - wide);
    // One camera for the world and the chair. It swings from the reveal's raised side view to behind the chair,
    // dollies back once stage five is under way, widens with speed, rolls a little with the bank and shakes
    // while the extinguisher fires; the ending pulls it back onto the wide horizon.
    // Climbing out of the clouds the camera tips down to take in the Earth below, as a chase camera would.
    const climb = orbitHeights(travel);
    const lookDown = (14 * climb.air + 12 * climb.space + 4 * wide) * Math.PI / 180;
    // At the start of the ending the camera leans in over the rider's shoulder onto the laptop screen; while it
    // circles the chair it comes in a little, so the chair can be seen swivelling and leaning back.
    const focus = ending.focus;
    const near = mix(distance, 170, focus);
    const framing = {
        centerY: mix(.5 - .13 * turn + Math.sin(ctx.t * 47) * .002 * push, .68, focus),
        eyeY: 45 - 30 * turn + near * Math.tan(lookDown) + 35 * focus,
        distance: near, zoom: mix(mix(mix(1 - .08 * fast, .72, wide), 1.15, ending.recline), 1.7, focus), roll: mix(p.a * .35, 0, wide),
        offsetX: Math.sin(ctx.t * 53) * 1.2 * push,
    };
    // In the ending, once the network is lost, the camera makes one slow full circle round the chair (four
    // quarter turns), and the sky, the nebula and the Earth below turn with it.
    const spin = ending.spin * 4;
    // Well round to the right, so the laptop screen shows past the rider's head rather than behind it.
    const view = createSkyProjection(ctx.W, ctx.H, turn + spin + SHOULDER * focus, framing);
    // The Earth is seen through the same lens, so its horizon sits where the world's eye level puts it.
    const earth: EarthCamera = { cx: ctx.W / 2 + framing.offsetX, cy: ctx.H * framing.centerY,
        focal: Math.min(ctx.H * 1.65, ctx.W * .94) * framing.zoom, roll: framing.roll, pitch: lookDown };
    const heights = backdrop(ctx, shot, clouds, cam, heading, earth, (spin + SHOULDER * focus) * Math.PI / 2);
    const point = (x: number, y: number, z: number): Point3 => [z - travel, 15 + y - cam.y, x - cam.x + routeBend(travel, heading, z - travel)];
    // The chair sits a little below the camera's line of sight, banking and pitching with its own motion. Its
    // drop scales with the camera distance, so a pulled-back camera shows it smaller at the same height.
    const sink = (38 * turn + 72 * blend) * distance / (480 + 210 * blend) / (1 - .08 * fast * (1 - wide)) * (1 - focus);
    // In the ending the chair itself swivels round and leans back, as if to take in space; its rider turns with it,
    // eyes still on the laptop.
    const bank = mix(p.a * .65, 0, wide), pitch = mix(Math.max(-.2, Math.min(.2, p.vy / 900)), 0, wide) + .32 * ending.recline;
    const swivel = ending.swivel * Math.PI;
    // Pressing against the edge, the chair shudders.
    const shudder = edge * 2.6;
    const pivot = -25, offset: Point3 = [0, -sink + p.y - cam.y + Math.sin(ctx.t * 61) * shudder, p.x - cam.x + Math.cos(ctx.t * 53) * shudder];
    const chair = placedProjection(view, ([x0, y, z0]) => {
        const x = x0 * Math.cos(swivel) - z0 * Math.sin(swivel), z = x0 * Math.sin(swivel) + z0 * Math.cos(swivel);
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
    // Clouds fading below 2% are too faint to see against the sky (under 5/255 per channel); skip their layer.
    const cloudsShown = clouds >= .02;
    if (cloudsShown) inOpacity(ctx, { key: 'orbit-low-clouds', opacity: clouds }, () => orbitCloudBank(ctx, view, travel, false, options));
    if (turn >= ORBIT_WATCH.glintsFrom) orbitCloudGlints(ctx, clouds);
    // The watchers stay out of the flat side view and turn up one by one as the view turns into 3D.
    if (turn >= ORBIT_WATCH.beacon.appear) orbitBeacon(ctx, view, point);
    const lamps = turn > 0 ? orbitWatchers(view, point, travel, ctx.t, turn) : [];
    // Scenery beyond the chair first; the chair and whatever passes beside it are painted after the clouds.
    const split = { depth: chair.depth([0, pivot, 0]) + 90, part: 'far' as const };
    ctx.commands.push(...view.commands(split));
    orbitWatchGlow(ctx, view, lamps);
    // The praise beams fade in with their satellites while the camera turns.
    orbitPraise(ctx, view, point, since, travel, smooth((turn - ORBIT_WATCH.satelliteAppear) / .3));
    if (cloudsShown) inOpacity(ctx, { key: 'orbit-near-clouds', opacity: clouds }, () => orbitCloudBank(ctx, view, travel, true, options));
    orbitShadow(ctx, { ...heights, shadow: heights.shadow * (1 - wide) }, earthHorizonAhead(travel, earth, heading));
    skyDeparture(ctx, shot.departure);
    orbitSpeedLines(ctx, view.project(point(0, 0, travel + 100000)), fast * (1 - wide));
    // The air resistance shows as streaks wrapping round the chair, strongest while the extinguisher pushes,
    // and the plume stretches out behind it.
    const air = orbitSlipstream(ctx, chair, rush * (.35 + .65 * push) * (1 - wide));
    ctx.commands.push(...air.behind);
    endingChair(chair, shot.clock, shot.spray * (1 + .8 * rush * push), shot.arrival, ending.loose, ending.rest);
    endingLaptopScreen(chair, ending);
    orbitEdgePuffs(chair, edge, over, ctx.t);
    ctx.commands.push(...view.commands({ ...split, part: 'near' }));
    ctx.commands.push(...air.over);
    endingLaptopText(ctx, chair, ending);
    endingChairLights(ctx, chair, ending);
    orbitPraiseOnChair(ctx, chair.project([0, 0, 0]), p, travel);
    const head = chair.project([4, 70, 0]);
    // The laptop answers the cameras just before stage five and the bubble stays up into its first moments;
    // deep in the Earth's shadow its signal drops away until it loses the network altogether.
    // Deep in the Earth's shadow the signal drops away; the lost connection itself shows on the laptop screen.
    if (ending.parked) endingSignal(ctx, head, ending);
    else attendanceBubble(ctx, head, since + ATTENDANCE.lead);
    endingFade(ctx, ending);
}
