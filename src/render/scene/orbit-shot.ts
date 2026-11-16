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

export type OrbitShot = {
    since: number;
    travel: number;
    p: { x: number; y: number; vx: number; vy: number; a: number };
    speed: number;
    push: number;
    turn: number;
    clock: number;
    spray: number;
    rocket?: number;
    arrival: number;
    departure: number;
    basin: number;
    entry: number;
    aims?: readonly Aim[];
    hitStop?: number;
    ending: OrbitEndingState;
};

const SHOULDER = .38;
const READ = { zoom: .7, offsetX: .3, centerY: .24 };

const smooth = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
};

const CAMERA = { follow: .15, lag: .3, distance: 960, pull: [.04, .13, .24], kick: .1, kickTime: .6, air: [.5, .78, 1], shake: [0, 0, 1.6] };

function gearFeel(travel: number, speed: number) {
    const gear = gearAt(travel), at = (list: readonly number[]) => list[gear.index];
    const since = gear.index > 0 ? (travel - gear.from) / Math.max(60, speed) : Infinity;
    const kick = since < CAMERA.kickTime ? Math.sin(Math.PI * since / CAMERA.kickTime) : 0;
    return { top: gear.maxSpeed, pull: at(CAMERA.pull), air: at(CAMERA.air), shake: at(CAMERA.shake), kick };
}

const NO_AIMS: readonly Aim[] = C.satelliteLight.beams.map(() => ({ x: 0, y: 0 }));

const screen = (ctx: RenderCtx): [number, number][] => [[0, 0], [ctx.W, 0], [ctx.W, ctx.H], [0, ctx.H]];

function backdrop(ctx: RenderCtx, shot: OrbitShot, clouds: number, earth: EarthCamera, spin: number) {
    const heights = orbitHeights(shot.travel);
    if (heights.air < 1) {
        if (shot.basin < 1) {
            ctx.commands.push({ kind: 'path', points: screen(ctx), fill: { from: [0, 0], to: [0, ctx.H], stops: [[0, ctx.rgba('#678eae')], [1, ctx.rgba('#b7ced1')]] } });
            inOpacity(ctx, { key: 'orbit-basin-sky', opacity: shot.basin }, () => orbitSky(ctx));
        } else orbitSky(ctx);
    }
    if (clouds > 0) ctx.commands.push({ kind: 'path', points: screen(ctx), layer: { key: 'orbit-sunlight' }, fill: {
        from: [ctx.W * .75, ctx.H * .15], to: [ctx.W, ctx.H], radius: ctx.W * .8,
        stops: [[0, ctx.rgba('#fff2eb', .16 * clouds)], [1, ctx.rgba('#fff2eb', 0)]],
    } });
    const skyBottom = shot.ending.parked && heights.air >= 1 ? earthSkyBottom(shot.travel, earth, 0, ctx.W, ctx.H, spin) : ctx.H;
    orbitHighSky(ctx, heights, 0, spin, skyBottom);
    endingNebula(ctx, shot.ending.wide, spin, skyBottom);
    const horizon = orbitEarth(ctx, shot.travel, earth, 0, heights.air, heights.shadow * (1 - shot.ending.wide), spin);
    return { heights, horizon };
}

export function drawOrbitShot(ctx: RenderCtx, shot: OrbitShot) {
    const { travel, p, turn, ending, since } = shot;
    const clouds = 1 - orbitHeights(travel).air;
    const wide = ending.wide, blend = smooth(shot.entry);
    const mix = (a: number, b: number, k: number) => a + (b - a) * k;
    const look = 0;
    const follow = (v: number, dv: number) => CAMERA.follow * (v - dv * CAMERA.lag);
    const cam = { x: mix(follow(p.x, p.vx), p.x, ending.centre), y: mix(follow(p.y, p.vy), p.y, ending.centre) };
    const over = { x: Math.max(0, Math.abs(p.x) - C.bounds.x + 20) * Math.sign(p.x), y: Math.max(0, Math.abs(p.y) - C.bounds.y + 20) * Math.sign(p.y) };
    const edge = smooth(Math.hypot(over.x, over.y) / (C.steer.overshoot + 20)) * (1 - ending.centre);
    const feel = gearFeel(travel, shot.speed);
    const fast = smooth((shot.speed - C.cruise) / (feel.top - C.cruise)) * feel.air * (1 - ending.centre);
    const push = shot.push * blend;
    const rush = smooth((shot.speed - .4 * C.cruise) / (feel.top - .4 * C.cruise)) * (1 - ending.centre);
    const pull = (feel.pull * rush + CAMERA.kick * feel.kick) * blend;
    const distance = (480 + (CAMERA.distance - 480) * blend) * (1 + pull) * (1 - wide) + (480 + 210 + 150 * rush) * wide;
    const shake = feel.shake * rush * blend;
    const climb = orbitHeights(travel);
    const lookDown = (14 * climb.air + 12 * climb.space + 4 * wide) * Math.PI / 180;
    const focus = ending.focus;
    const near = mix(distance, 170, focus);
    const framing = {
        centerY: mix(.5 - .13 * turn + Math.sin(ctx.t * 47) * (.002 * push + .003 * shake), .68, focus) + READ.centerY * ending.read,
        eyeY: 45 - 30 * turn + near * Math.tan(lookDown) + 35 * focus,
        distance: near, zoom: mix(mix(mix(1 - .08 * fast, .72, wide), 1.15, ending.recline), 1.7, focus) * (1 + READ.zoom * ending.read), roll: mix(p.a * .35, 0, wide),
        offsetX: Math.sin(ctx.t * 53) * (1.2 * push + shake) + ctx.W * READ.offsetX * ending.read,
    };
    const spin = ending.spin * 4;
    const view = createSkyProjection(ctx.W, ctx.H, turn + spin + SHOULDER * focus, framing);
    const earth: EarthCamera = { cx: ctx.W / 2 + framing.offsetX, cy: ctx.H * framing.centerY,
        focal: Math.min(ctx.H * 1.65, ctx.W * .94) * framing.zoom, roll: framing.roll, pitch: lookDown };
    const turned = look + (spin + SHOULDER * focus) * Math.PI / 2;
    const { heights, horizon } = backdrop(ctx, shot, clouds, earth, turned);
    const facing = { cos: Math.cos(look), sin: Math.sin(look) };
    const point = (x: number, y: number, z: number): Point3 => {
        const across = x - cam.x, ahead = z - travel;
        return [ahead * facing.cos + across * facing.sin, 15 + y - cam.y, across * facing.cos - ahead * facing.sin];
    };
    const sink = (38 * turn * (1 - blend) + 72 * blend) * distance / (480 + (CAMERA.distance - 480) * blend) / (1 - .08 * fast * (1 - wide)) * (1 - focus);
    const satelliteLightPoint = (x: number, y: number, z: number) => point(x, y - sink, z);
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
    const options: CloudBankOptions = since < 0
        ? { anchor: cam, turn: look, nearDepth: 1100, unwrapped: true, only: basinCloudSeeds(ctx, createSkyProjection(ctx.W, ctx.H, 1, { centerY: .37, level: true }), 0, cam) }
        : { anchor: cam, turn: look };
    const cloudsShown = clouds >= .02;
    if (cloudsShown) orbitCloudBank(ctx, view, travel, false, { ...options, alpha: clouds });
    if (turn >= ORBIT_WATCH.glintsFrom) orbitCloudGlints(ctx, clouds);
    if (turn >= ORBIT_WATCH.beacon.appear) orbitBeacon(ctx, view, point);
    const lamps = turn > 0 ? orbitWatchers(view, point, travel, ctx.t, turn, satelliteLightPoint, satelliteSpots(shot.aims ?? NO_AIMS, travel, shot.speed)) : [];
    const split = { depth: chair.depth([0, pivot, 0]) + 90, part: 'far' as const };
    ctx.commands.push(...view.commands(split));
    orbitWatchGlow(ctx, view, lamps);
    const plane = (x: number, y: number) => view.project(satelliteLightPoint(x, y, travel));
    const lightShown = smooth((turn - ORBIT_WATCH.satelliteAppear) / .3) * (1 - smooth(ending.centre * 4));
    orbitSatelliteLight(ctx, view, satelliteLightPoint, plane, shot.aims ?? NO_AIMS, travel, shot.speed, lightShown);
    if (cloudsShown) orbitCloudBank(ctx, view, travel, true, { ...options, alpha: clouds });
    if (heights.shadow > 0 && horizon) orbitShadow(ctx, { ...heights, shadow: heights.shadow * (1 - wide) }, horizon);
    skyDeparture(ctx, shot.departure);
    orbitSpeedLines(ctx, view.project(point(cam.x, cam.y, travel + 100000)), fast * (1 - wide));
    const air = orbitSlipstream(ctx, chair, rush * feel.air * (.35 + .65 * push) * (1 - wide));
    ctx.commands.push(...air.behind);
    const light = since >= 0 && wide <= 0 ? satelliteLightWarmth(shot.aims ?? NO_AIMS, p, travel) : { warmth: 0, toward: { x: 0, y: 0 } };
    const pulse = Math.sin(ctx.t * 9) * .5 + .5;
    const laptopBob = endingChair(satelliteLitChair(chair, light.warmth >= 1 ? .62 + .18 * pulse : light.warmth * .7), shot.clock, shot.spray * (1 + .8 * rush * push), shot.arrival, ending.loose, ending.rest, shot.rocket);
    endingLaptopScreen(chair, ending, laptopBob);
    orbitEdgePuffs(chair, edge, over, ctx.t);
    satelliteChairGlow(ctx, chair, light, pulse);
    ctx.commands.push(...view.commands({ ...split, part: 'near' }));
    ctx.commands.push(...air.over);
    satelliteGlare(ctx, chair.project([0, 15, 0]), light.warmth, pulse);
    orbitViewfinder(ctx, plane, light.warmth >= 1 ? 1 : 0, lightShown * blend * (1 - heights.shadow), shot.hitStop ?? 0);
    if (shot.hitStop) ctx.commands.push({ kind: 'path', points: screen(ctx), fill: '#ffffff' + Math.round(.32 * shot.hitStop * shot.hitStop * 255).toString(16).padStart(2, '0'), layer: { key: 'orbit-shutter' } });
    endingLaptopText(ctx, chair, ending, laptopBob);
    endingChairLights(ctx, chair, ending);
    const head = chair.project([4, 70, 0]);
    orbitReaction(ctx, head, since, since >= 0 && light.warmth >= 1);
    if (ending.parked) endingSignal(ctx, head, ending);
    else attendanceBubble(ctx, head, since + ATTENDANCE.lead);
    endingFade(ctx, ending);
}
