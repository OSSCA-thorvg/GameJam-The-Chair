import type { RenderCtx } from '../context';
import type { DrawCommand, LayerSpec } from '../types';
import { seeded } from './cloud-art';
import { STAGE_FIVE } from '../../game/stages/orbit/data';
import { aim, CCTV_KINDS, cctvModel, placer, rect, type CctvKind } from './cctv-models';
import type { Point3, SkyProjection } from './sky-projection';
import type { SkyRobot } from '../../game/stages/sky/data';
import { robotBirdModel } from './orbit-robot-bird';

/** Maps a stage-five route point (x across, y up, z ahead) into a projection's coordinates. */
export type RoutePoint = (x: number, y: number, z: number) => Point3;

/** `appear`: how far the reveal's turn into 3D has gone (0 side, 1 behind) before this camera comes into view. */
type Spot = { x: number; y: number; z: number; seed: number; kind: CctvKind; size: number; appear: number; bird?: SkyRobot };

const pick = (random: () => number) => CCTV_KINDS[Math.floor(random() * CCTV_KINDS.length)];

/** Free-floating cameras spread between the clouds along stage five, kept clear of the chair's lane and the door. */
function routeCctvs(seed: number, count: number, from: number, to: number): Spot[] {
    const random = seeded(seed);
    return Array.from({ length: count }, (_, i) => ({
        x: (i % 2 ? 1 : -1) * (230 + random() * 560), y: -420 + random() * 520,
        z: from + (to - from) * (i + random() * .8) / count, seed: seed + i, kind: pick(random), size: 1.3 + random() * 1.1, appear: .5,
    }));
}

// Where the reveal cameras sit on a 1000×510 screen once the camera is behind the chair: every edge and corner, none over the chair.
const REVEAL_COLUMNS = [60, 210, 360, 640, 790, 940], REVEAL_ROWS = [50, 170, 300, 430];
const REVEAL_VIEW = { focal: 841.5, centerY: 188.7, camera: 480 };
// A few spots in the field are stage four's chrome robot parrots instead, staring at the chair along with the cameras.
const REVEAL_BIRDS: Record<number, SkyRobot> = { 1: 'liquid', 6: 'black', 11: 'liquid', 16: 'black', 19: 'liquid' };

/** Cameras hanging in the air all around the chair, turning up one by one as the view turns into 3D; `glide` later carries it past every one. */
function revealCctvs(seed: number, glide: number): Spot[] {
    const random = seeded(seed);
    const count = REVEAL_ROWS.length * REVEAL_COLUMNS.length;
    const order = Array.from({ length: count }, (_, i) => ({ i, key: random() })).sort((a, b) => a.key - b.key).map(item => item.i);
    return REVEAL_ROWS.flatMap((row, r) => REVEAL_COLUMNS.map((column, c) => {
        const depth = 700 + random() * 860;
        const sx = column + (random() - .5) * 90, sy = row + (random() - .5) * 70;
        const scale = depth / REVEAL_VIEW.focal, index = r * REVEAL_COLUMNS.length + c;
        return { x: (sx - 500) * scale, y: (REVEAL_VIEW.centerY - sy) * scale, z: depth - REVEAL_VIEW.camera - glide,
            seed: seed + r * 10 + c, kind: pick(random), size: 1.3 + random() * 1.3,
            appear: .04 + .56 * order.indexOf(index) / count, ...(REVEAL_BIRDS[index] ? { bird: REVEAL_BIRDS[index] } : {}) };
    }));
}

const GLIDE = 1600;

type Glint = { x: number; y: number; red: boolean; rate: number; phase: number };

/** Screen-space points on the low cloud floor and the two high clouds, clear of the chair in the middle. */
function cloudGlints(seed: number): Glint[] {
    const random = seeded(seed);
    const floor = Array.from({ length: 16 }, (_, i) => {
        const side = i % 2 ? .64 + random() * .33 : .03 + random() * .33;
        return { x: side, y: .8 + random() * .16 };
    });
    return [...floor, { x: .12, y: .17 }, { x: .19, y: .14 }, { x: .85, y: .12 }].map((spot, i) =>
        ({ ...spot, red: i % 3 === 0, rate: 1.6 + random() * 2.2, phase: random() * Math.PI * 2 }));
}

// The company keeps watching. Scenery only: nothing here collides or changes play.
export const ORBIT_WATCH = {
    // The stage four reveal glides the chair forward through this field before stage five begins at z = 0.
    glide: GLIDE,
    reveal: revealCctvs(4100, GLIDE),
    route: routeCctvs(5200, 10, 600, 4700),
    // The satellites whose beams shower the chair with praise (5-1 to 5-3).
    satellites: STAGE_FIVE.praise.beams.map(beam => beam.satellite),
    satelliteAppear: .35,
    // A far speck in the sky above the office door, the last landing of the route.
    beacon: { x: 90, y: 760, z: 7400, appear: .55 },
    // Lenses and lamps glinting out of the low cloud floor, from when the camera is behind the chair.
    glints: cloudGlints(6300),
    glintsFrom: .92,
    before: 200, after: 40, blink: 7,
};

/** idle: the slow REC blink every camera keeps up · flash: blinking while the chair passes · recorded: steady once it has gone by. */
export type LampState = 'idle' | 'flash' | 'recorded';
/** `glow`: a robot parrot's lens eye, always glowing like the stage four 2D lens; its world radius. */
type Lamp = { at: Point3; state: LampState; glow?: number; rec?: boolean };

/** Lamp state of a camera `ahead` route units in front of the chair. */
export function cctvLamp(ahead: number, t: number): LampState {
    if (ahead > ORBIT_WATCH.before) return 'idle';
    if (ahead > -ORBIT_WATCH.after) return Math.floor(t * ORBIT_WATCH.blink) % 2 === 0 ? 'flash' : 'idle';
    return 'recorded';
}

/** Each camera's REC lamp blinks on its own beat, so the whole sky winks red out of step. */
const recording = (t: number, seed: number) => (t * .8 + seed * .618) % 1 < .55;
const lampColor = (state: LampState, rec: boolean) => state !== 'idle' || rec ? '#ff4a3a' : '#5e1d1a';

function floating(view: SkyProjection, point: RoutePoint, spot: Spot, travel: number, t: number): Lamp[] {
    const anchor = point(spot.x, spot.y + Math.sin(t * .9 + spot.seed) * 8, spot.z);
    // The lens keeps turning toward the chair at the projection's origin.
    const yaw = aim(-anchor[0], -anchor[2]) + Math.sin(t * .6 + spot.seed) * .05;
    const state = cctvLamp(spot.z - travel, t);
    if (spot.bird) {
        const { eyes, glow } = robotBirdModel(view, spot.bird, placer(anchor, yaw, spot.size * 1.2), t * 9 + spot.seed);
        return eyes.map(at => ({ at, state, glow: glow * spot.size * 1.2 }));
    }
    const lamp = cctvModel(view, spot.kind, placer(anchor, yaw, spot.size));
    const rec = recording(t, spot.seed);
    view.oval(lamp, [4.5 * spot.size, 4.5 * spot.size, 4.5 * spot.size], lampColor(state, rec));
    return [{ at: lamp, state, rec }];
}

function satellite(view: SkyProjection, point: RoutePoint, at: { x: number; y: number; z: number }, travel: number, t: number): Lamp {
    const { x, y, z } = at;
    const place = placer(point(x, y + Math.sin(t * .7) * 12, z), aim(0, 1) + Math.sin(t * .4) * .08);
    view.profile([[-24, -30], [24, -30], [32, -20], [32, 20], [24, 30], [-24, 30], [-32, 20], [-32, -20]], 28, '#dcd7cf', 0, { place });
    view.profile(rect(-15, 4, 15, 16), .6, '#2f6fb5', 28.6, { place });
    for (const s of [-1, 1]) {
        view.rod(place([s * 32, 0, 0]), place([s * 48, 0, 0]), 2.5, '#9aa0b0');
        view.profile(rect(s * 48, -24, s * 160, 24), 2, '#3b5c9a', 0, { place });
        for (const k of [.33, .66]) {
            const u = s * (48 + 112 * k);
            view.profile(rect(u - 1, -24, u + 1, 24), .4, '#c9d6ee', 2.4, { place });
        }
    }
    // Its lens is built into the body, looking down at the route.
    view.oval(place([0, -16, 29]), [9, 9, 3], '#27344d');
    view.oval(place([2, -13, 30]), [3, 3, 1], '#7d9fbb');
    const state = cctvLamp(z - travel, t);
    const lamp = place([-18, 22, 29]);
    const rec = recording(t, z);
    view.oval(lamp, [5, 5, 2], lampColor(state, rec));
    return { at: lamp, state, rec };
}

/**
 * Adds the watchers to `view`; returns their lamps for the glow pass. The reveal's field sits behind stage five's
 * start and the route's ahead of it, so both are always placed and the projection leaves out what is behind it.
 * `shown` is how far the reveal has turned into 3D; watchers that come later stay hidden.
 */
export function orbitWatchers(view: SkyProjection, point: RoutePoint, travel: number, t: number, shown = 1) {
    const lamps = [...ORBIT_WATCH.reveal, ...ORBIT_WATCH.route].filter(spot => spot.appear <= shown && spot.z - travel > -600)
        .flatMap(spot => floating(view, point, spot, travel, t));
    // Far satellites are left out until the chair is within sight of them.
    if (ORBIT_WATCH.satelliteAppear <= shown) for (const at of ORBIT_WATCH.satellites) {
        if (at.z - travel < 6000) lamps.push(satellite(view, point, at, travel, t));
    }
    return lamps;
}

/** Red light spills from every lamp: a small REC blink while waiting, a flash as the chair passes, then a steady glow. */
export function orbitWatchGlow(ctx: RenderCtx, view: SkyProjection, lamps: Lamp[], alpha = 1) {
    // All glows of a kind share one screen-blended layer (one ThorVG Scene each). Screen blending gives the same
    // result in any order, so the REC blinks, the camera flashes and the robot eyes are painted kind by kind.
    const recLayer = { key: 'orbit-cctv-rec', blend: 'screen' as const }, lightLayer = { key: 'orbit-cctv-light', blend: 'screen' as const };
    const eyeLayer = { key: 'orbit-robot-eye', blend: 'screen' as const };
    const recs: DrawCommand[] = [], lights: DrawCommand[] = [], eyes: DrawCommand[] = [];
    for (const { at, state, glow, rec } of lamps) {
        if (view.depth(at) < 80) continue;
        if (glow) {
            eyes.push(eyeGlow(ctx, view, at, glow, state, alpha, eyeLayer));
            continue;
        }
        if (state === 'idle' && !rec) continue;
        const [x, y] = view.project(at);
        const radius = ctx.clamp(30000 / view.depth(at), 10, 60) * (state === 'flash' ? 1 : state === 'recorded' ? .45 : .55);
        const idle = state === 'idle';
        (idle ? recs : lights).push({ v: [[x - radius, y - radius], [x + radius, y - radius], [x + radius, y + radius], [x - radius, y + radius]], c: {
            from: [x, y], to: [x + radius, y], radius, stops: [[0, ctx.rgba('#ff6b57', .95 * alpha)], [1, ctx.rgba('#ff6b57', 0)]],
        }, layer: idle ? recLayer : lightLayer });
    }
    ctx.commands.push(...recs, ...lights, ...eyes);
}

function eyeGlow(ctx: RenderCtx, view: SkyProjection, at: Point3, glow: number, state: LampState, alpha: number, layer: LayerSpec): DrawCommand {
    const [x, y] = view.project(at);
    const radius = Math.max(4, Math.abs(view.project([at[0], at[1] + glow, at[2]])[1] - y)) * (state === 'flash' ? 1.5 : 1);
    const pulse = (.8 + Math.sin(ctx.t * 3 + at[0]) * .2) * alpha;
    return { v: [[x - radius, y - radius], [x + radius, y - radius], [x + radius, y + radius], [x - radius, y + radius]], c: {
        from: [x, y], to: [x + radius, y], radius,
        stops: [[0, ctx.rgba('#ff3a1a', .85 * pulse)], [.4, ctx.rgba('#ff2a1a', .45 * pulse)], [1, ctx.rgba('#ff2a1a', 0)]],
    }, layer };
}

/** One small point twinkles high above the door, too far away to make out yet. */
export function orbitBeacon(ctx: RenderCtx, view: SkyProjection, point: RoutePoint, alpha = 1) {
    const { x, y, z } = ORBIT_WATCH.beacon;
    const at = point(x, y, z);
    if (view.depth(at) < 80) return;
    const [cx, cy] = view.project(at);
    const twinkle = .35 + .65 * Math.pow(Math.sin(ctx.t * 1.7) * .5 + .5, 3);
    const layer = { key: 'orbit-beacon', blend: 'screen' as const };
    const glow = 5 + 9 * twinkle;
    ctx.commands.push({ v: [[cx - glow, cy - glow], [cx + glow, cy - glow], [cx + glow, cy + glow], [cx - glow, cy + glow]], c: {
        from: [cx, cy], to: [cx + glow, cy], radius: glow, stops: [[0, ctx.rgba('#fff3cf', .9 * alpha)], [1, ctx.rgba('#fff3cf', 0)]],
    }, layer });
    const ray = 3 + 7 * twinkle, thin = .7;
    const color = '#fffaf0' + Math.round(ctx.clamp(twinkle * alpha, 0, 1) * 255).toString(16).padStart(2, '0');
    ctx.commands.push({ v: [[cx - ray, cy], [cx, cy - thin], [cx + ray, cy], [cx, cy + thin]], c: color, layer });
    ctx.commands.push({ v: [[cx, cy - ray], [cx + thin, cy], [cx, cy + ray], [cx - thin, cy]], c: color, layer });
}

/** White lens glints and red recording lamps blink out of the clouds. */
export function orbitCloudGlints(ctx: RenderCtx, alpha = 1) {
    if (alpha <= 0) return;
    // Plain alpha rather than a screen-blended Scene, which cost a full-canvas pass right where the Earth comes in.
    // Each colour c is the one that paints over the bread clouds (d ≈ #e8b464) what c screened would: c + d(1 - c).
    const layer = { key: 'orbit-cloud-glint' };
    for (const glint of ORBIT_WATCH.glints) {
        const wave = Math.sin(ctx.t * glint.rate + glint.phase);
        if (wave < .55) continue;
        const k = (wave - .55) / .45, x = glint.x * ctx.W, y = glint.y * ctx.H;
        const glow = 7 + 9 * k, core = 2 + 1.6 * k;
        const color = glint.red ? '#ffd399' : '#fffbe2';
        ctx.commands.push({ v: [[x - glow, y - glow], [x + glow, y - glow], [x + glow, y + glow], [x - glow, y + glow]], c: {
            from: [x, y], to: [x + glow, y], radius: glow, stops: [[0, ctx.rgba(color, .9 * k * alpha)], [1, ctx.rgba(color, 0)]],
        }, layer });
        const tint = Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.commands.push({ v: [[x - core, y], [x, y - core], [x + core, y], [x, y + core]], c: (glint.red ? '#ffce91' : '#ffffff') + tint, layer });
    }
}
