import type { RenderCtx } from '../context';
import { createSkyProjection, placedProjection, type Point3 } from './sky-projection';
import { orbitEdgePuffs, orbitSlipstream, orbitSpeedLines } from './orbit-flight';
import { endingChair } from './sky-ending-art';
import { skyDeparture } from './sky-departure';
import { basinCloudSeeds, orbitCloudBank, orbitSky, type CloudBankOptions } from './orbit-atmosphere';
import { ORBIT_WATCH, orbitBeacon, orbitCloudGlints, orbitWatchers, orbitWatchGlow } from './orbit-watch';
import { ATTENDANCE, attendanceBubble } from './attendance-bubble';
import { orbitSatelliteLight, satelliteChairGlow, satelliteGlare, satelliteLitChair, satelliteLightWarmth, satelliteSpots, type Aim } from './orbit-satellite-light';
import { orbitViewfinder } from './orbit-viewfinder';
import { orbitReaction } from './orbit-reaction';
import { inOpacity, orbitHeights, orbitHighSky, orbitShadow } from './orbit-heights';
import { earthSkyBottom, orbitEarth, type EarthCamera } from './orbit-earth';
import { endingChairLights, endingFade, endingLaptopScreen, endingLaptopText, endingNebula, endingSignal, type OrbitEndingState } from './orbit-ending';
import { STAGE_FIVE as C } from '../../game/stages/orbit/data';
import { gearAt } from '../../game/stages/orbit/course/decide';

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
    /** How far the extinguisher has ignited into stage five's rocket engine (0 to 1). */
    rocket?: number;
    /** The landing shake at the start of the reveal. */
    arrival: number;
    /** How far the last stage four ledge has drifted away (1 once it is gone). */
    departure: number;
    /** The cloud basin sky over the plain reveal sky (1 once the turn is done). */
    basin: number;
    /** The stage five chair framing pulling back from the reveal's close-up. */
    entry: number;
    /** Where each satellite is aiming on the play plane; absent before stage five starts. */
    aims?: readonly Aim[];
    /** The shutter stop as a satellite locks on, from 1 the instant it locks down to 0. */
    shutter?: number;
    ending: OrbitEndingState;
};

/** How far round the chair (in quarter turns) the camera leans over the rider's shoulder at the start of the ending. */
const SHOULDER = .38;
/** The push-in on the laptop screen when the network is lost: extra zoom, and the shift that centres the screen. */
const READ = { zoom: .7, offsetX: .3, centerY: .24 };

const smooth = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
};

/**
 * Stage five's camera: how much of the chair's movement it follows (a beat late), how far it pulls back in each gear
 * as the chair rushes (plus a kick when a new gear starts) and how strong the air streaks get. The play plane always
 * stays inside the frame, so the viewfinder brackets never leave the screen.
 */
const CAMERA = { follow: .15, lag: .3, distance: 960, pull: [.04, .13, .24], kick: .1, kickTime: .6, air: [.5, .78, 1], shake: [0, 0, 1.6] };

/** How far into its gear the route is at `travel`, eased between gears, and the kick as a new gear starts. */
function gearFeel(travel: number, speed: number) {
    const gear = gearAt(travel), at = (list: readonly number[]) => list[gear.index];
    const since = gear.index > 0 ? (travel - gear.from) / Math.max(60, speed) : Infinity;
    const kick = since < CAMERA.kickTime ? Math.sin(Math.PI * since / CAMERA.kickTime) : 0;
    return { top: gear.maxSpeed, pull: at(CAMERA.pull), air: at(CAMERA.air), shake: at(CAMERA.shake), kick };
}

const NO_AIMS: readonly Aim[] = C.satelliteLight.beams.map(() => ({ x: 0, y: 0 }));

const screen = (ctx: RenderCtx): [number, number][] => [[0, 0], [ctx.W, 0], [ctx.W, ctx.H], [0, ctx.H]];

/** The sky: the reveal's plain sky under the basin sky, warm sunlight, and the climb toward space. */
function backdrop(ctx: RenderCtx, shot: OrbitShot, clouds: number, cam: { x: number; y: number }, earth: EarthCamera, spin: number) {
    const heights = orbitHeights(shot.travel);
    if (heights.air < 1) {
        if (shot.basin < 1) {
            ctx.commands.push({ v: screen(ctx), c: { from: [0, 0], to: [0, ctx.H], stops: [[0, ctx.rgba('#678eae')], [1, ctx.rgba('#b7ced1')]] } });
            inOpacity(ctx, { key: 'orbit-basin-sky', opacity: shot.basin }, () => orbitSky(ctx, cam, spin));
        } else orbitSky(ctx, cam, spin);
    }
    // Low sunlight over the cloud basin, thinning out as the chair climbs out of the clouds. Plain alpha instead of
    // a screen-blended Scene: over the sky behind the sun, #fff2eb paints what #ffdfb5 screened would
    // (c + d(1 - c) for d = #7499b9), without a full-canvas offscreen pass.
    if (clouds > 0) ctx.commands.push({ v: screen(ctx), layer: { key: 'orbit-sunlight' }, c: {
        from: [ctx.W * .75, ctx.H * .15], to: [ctx.W, ctx.H], radius: ctx.W * .8,
        stops: [[0, ctx.rgba('#fff2eb', .16 * clouds)], [1, ctx.rgba('#fff2eb', 0)]],
    } });
    const skyBottom = shot.ending.parked && heights.air >= 1 ? earthSkyBottom(shot.travel, earth, 0, ctx.W, ctx.H, spin) : ctx.H;
    orbitHighSky(ctx, heights, 0, spin, skyBottom);
    endingNebula(ctx, shot.ending.wide, spin, skyBottom);
    // In the ending the sun comes up over the rim and day returns to the ground below.
    const horizon = orbitEarth(ctx, shot.travel, earth, 0, heights.air, heights.shadow * (1 - shot.ending.wide), spin);
    return { heights, horizon };
}

export function drawOrbitShot(ctx: RenderCtx, shot: OrbitShot) {
    const { travel, p, turn, ending, since } = shot;
    const clouds = 1 - orbitHeights(travel).air;
    const wide = ending.wide, blend = smooth(shot.entry);
    const mix = (a: number, b: number, k: number) => a + (b - a) * k;
    // The camera always faces the Earth's shadow and follows the chair only a little, a beat late, so the chair
    // moves across a steady frame. Once parked it moves right onto the chair.
    const look = 0;
    const follow = (v: number, dv: number) => CAMERA.follow * (v - dv * CAMERA.lag);
    const cam = { x: mix(follow(p.x, p.vx), p.x, ending.centre), y: mix(follow(p.y, p.vy), p.y, ending.centre) };
    // How hard the chair is pressing out past the edge, and which way.
    const over = { x: Math.max(0, Math.abs(p.x) - C.bounds.x + 20) * Math.sign(p.x), y: Math.max(0, Math.abs(p.y) - C.bounds.y + 20) * Math.sign(p.y) };
    // Parked, nothing presses against the fence any more.
    const edge = smooth(Math.hypot(over.x, over.y) / (C.steer.overshoot + 20)) * (1 - ending.centre);
    // Each gear rushes harder: the top speed rises, and so do the pull-back and the streaks of air.
    const feel = gearFeel(travel, shot.speed);
    const fast = smooth((shot.speed - C.cruise) / (feel.top - C.cruise)) * feel.air * (1 - ending.centre);
    const push = shot.push * blend;
    // How hard the chair is rushing forward. Speed only climbs while the extinguisher fires, so as the chair
    // accelerates the camera falls back behind it, and eases in again as it coasts.
    const rush = smooth((shot.speed - .4 * C.cruise) / (feel.top - .4 * C.cruise)) * (1 - ending.centre);
    const pull = (feel.pull * rush + CAMERA.kick * feel.kick) * blend;
    const distance = (480 + (CAMERA.distance - 480) * blend) * (1 + pull) * (1 - wide) + (480 + 210 + 150 * rush) * wide;
    const shake = feel.shake * rush * blend;
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
        // When the message comes up, the camera pushes in until the laptop screen fills the middle of the frame.
        centerY: mix(.5 - .13 * turn + Math.sin(ctx.t * 47) * (.002 * push + .003 * shake), .68, focus) + READ.centerY * ending.read,
        eyeY: 45 - 30 * turn + near * Math.tan(lookDown) + 35 * focus,
        distance: near, zoom: mix(mix(mix(1 - .08 * fast, .72, wide), 1.15, ending.recline), 1.7, focus) * (1 + READ.zoom * ending.read), roll: mix(p.a * .35, 0, wide),
        offsetX: Math.sin(ctx.t * 53) * (1.2 * push + shake) + ctx.W * READ.offsetX * ending.read,
    };
    // In the ending, once the network is lost, the camera makes one slow full circle round the chair (four
    // quarter turns), and the sky, the nebula and the Earth below turn with it.
    const spin = ending.spin * 4;
    // Well round to the right, so the laptop screen shows past the rider's head rather than behind it.
    const view = createSkyProjection(ctx.W, ctx.H, turn + spin + SHOULDER * focus, framing);
    // The Earth is seen through the same lens, so its horizon sits where the world's eye level puts it.
    const earth: EarthCamera = { cx: ctx.W / 2 + framing.offsetX, cy: ctx.H * framing.centerY,
        focal: Math.min(ctx.H * 1.65, ctx.W * .94) * framing.zoom, roll: framing.roll, pitch: lookDown };
    const turned = look + (spin + SHOULDER * focus) * Math.PI / 2;
    const { heights, horizon } = backdrop(ctx, shot, clouds, cam, earth, turned);
    // The world as the camera sees it: ahead of the chair along the way the camera faces, up, and to its right.
    const facing = { cos: Math.cos(look), sin: Math.sin(look) };
    const point = (x: number, y: number, z: number): Point3 => {
        const across = x - cam.x, ahead = z - travel;
        return [ahead * facing.cos + across * facing.sin, 15 + y - cam.y, across * facing.cos - ahead * facing.sin];
    };
    // The chair sits a little below the camera's line of sight, banking and pitching with its own motion. Its
    // drop scales with the camera distance, so a pulled-back camera shows it smaller at the same height.
    // In play it sits just below the middle, so the whole play plane and its brackets fit on screen.
    const sink = (38 * turn * (1 - blend) + 72 * blend) * distance / (480 + (CAMERA.distance - 480) * blend) / (1 - .08 * fast * (1 - wide)) * (1 - focus);
    // The chair is drawn `sink` below its place on the route (its body centre sits 15 above its origin, like the
    // route's eye line). The satellites and their beams are placed in the chair's drawn frame,
    // so what the light touches on screen is what the course says it touches.
    const satelliteLightPoint = (x: number, y: number, z: number) => point(x, y - sink, z);
    // In the ending the chair itself swivels round and leans back, as if to take in space; its rider turns with it,
    // eyes still on the laptop.
    const bank = mix(p.a * .65, 0, wide), pitch = mix(Math.max(-.2, Math.min(.2, p.vy / 900)), 0, wide) + .32 * ending.recline;
    const swivel = ending.swivel * Math.PI;
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
    const options: CloudBankOptions = since < 0
        ? { anchor: cam, turn: look, nearDepth: 1100, unwrapped: true, only: basinCloudSeeds(ctx, createSkyProjection(ctx.W, ctx.H, 1, { centerY: .37, level: true }), 0, cam) }
        : { anchor: cam, turn: look };
    // Clouds fading below 2% are too faint to see against the sky (under 5/255 per channel); skip their layer.
    const cloudsShown = clouds >= .02;
    if (cloudsShown) orbitCloudBank(ctx, view, travel, false, { ...options, alpha: clouds });
    if (turn >= ORBIT_WATCH.glintsFrom) orbitCloudGlints(ctx, clouds);
    // The watchers stay out of the flat side view and turn up one by one as the view turns into 3D.
    if (turn >= ORBIT_WATCH.beacon.appear) orbitBeacon(ctx, view, point);
    const lamps = turn > 0 ? orbitWatchers(view, point, travel, ctx.t, turn, satelliteLightPoint, satelliteSpots(shot.aims ?? NO_AIMS, travel, shot.speed)) : [];
    // Scenery beyond the chair first; the chair and whatever passes beside it are painted after the clouds.
    const split = { depth: chair.depth([0, pivot, 0]) + 90, part: 'far' as const };
    ctx.commands.push(...view.commands(split));
    orbitWatchGlow(ctx, view, lamps);
    // The play plane at the chair's depth, in the frame the chair is drawn in: the bands and the viewfinder sit on it.
    const plane = (x: number, y: number) => view.project(satelliteLightPoint(x, y, travel));
    const lightShown = smooth((turn - ORBIT_WATCH.satelliteAppear) / .3) * (1 - smooth(ending.centre * 4));
    orbitSatelliteLight(ctx, view, satelliteLightPoint, plane, shot.aims ?? NO_AIMS, travel, shot.speed, lightShown, shot.shutter ?? 0);
    if (cloudsShown) orbitCloudBank(ctx, view, travel, true, { ...options, alpha: clouds });
    if (heights.shadow > 0 && horizon) orbitShadow(ctx, { ...heights, shadow: heights.shadow * (1 - wide) }, horizon);
    skyDeparture(ctx, shot.departure);
    orbitSpeedLines(ctx, view.project(point(cam.x, cam.y, travel + 100000)), fast * (1 - wide));
    // The air resistance shows as streaks wrapping round the chair, strongest while the extinguisher pushes,
    // and the plume stretches out behind it.
    const air = orbitSlipstream(ctx, chair, rush * feel.air * (.35 + .65 * push) * (1 - wide));
    ctx.commands.push(...air.behind);
    // The light the chair is catching shows on the chair itself: warming as it nears a beam, glowing inside one.
    const light = since >= 0 && wide <= 0 ? satelliteLightWarmth(shot.aims ?? NO_AIMS, p, travel) : { warmth: 0, toward: { x: 0, y: 0 } };
    const pulse = Math.sin(ctx.t * 9) * .5 + .5;
    endingChair(satelliteLitChair(chair, light.warmth >= 1 ? .62 + .18 * pulse : light.warmth * .7), shot.clock, shot.spray * (1 + .8 * rush * push), shot.arrival, ending.loose, ending.rest, shot.rocket);
    endingLaptopScreen(chair, ending);
    orbitEdgePuffs(chair, edge, over, ctx.t);
    satelliteChairGlow(ctx, chair, light, pulse);
    ctx.commands.push(...view.commands({ ...split, part: 'near' }));
    ctx.commands.push(...air.over);
    // Caught in a beam, the light washes over the picture a little, and the viewfinder starts recording.
    satelliteGlare(ctx, chair.project([0, 15, 0]), light.warmth, pulse);
    orbitViewfinder(ctx, plane, light.warmth >= 1 ? 1 : 0, lightShown * blend * (1 - heights.shadow), shot.shutter ?? 0);
    // The shutter: a white flash over everything as a satellite locks on, fading through the stop.
    if (shot.shutter) ctx.commands.push({ v: screen(ctx), c: '#ffffff' + Math.round(.28 * shot.shutter * shot.shutter * 255).toString(16).padStart(2, '0'), layer: { key: 'orbit-shutter' } });
    endingLaptopText(ctx, chair, ending);
    endingChairLights(ctx, chair, ending);
    const head = chair.project([4, 70, 0]);
    // The laptop answers the cameras just before stage five and the bubble stays up into its first moments;
    // deep in the Earth's shadow its signal drops away until it loses the network altogether.
    // Deep in the Earth's shadow the signal drops away; the lost connection itself shows on the laptop screen.
    orbitReaction(ctx, head, since, since >= 0 && light.warmth >= 1);
    if (ending.parked) endingSignal(ctx, head, ending);
    else attendanceBubble(ctx, head, since + ATTENDANCE.lead);
    endingFade(ctx, ending);
}
