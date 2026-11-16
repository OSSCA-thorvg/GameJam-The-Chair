import type { RenderCtx } from '../../context';
import type { DrawCommand, LayerSpec } from '../../types';
import { seeded } from '../shared/cloud-art';
import {
    aim,
    CCTV_KINDS,
    cctvModel,
    placer,
    rect,
    type CctvKind,
} from '../shared/cctv-models';
import type { Point3, SkyProjection } from '../shared/projection';
import type { SkyRobot } from '../../../game/stages/sky/data';
import { robotBirdModel } from './robot-bird';

export type RoutePoint = (x: number, y: number, z: number) => Point3;

type Spot = {
    x: number;
    y: number;
    z: number;
    seed: number;
    kind: CctvKind;
    size: number;
    appear: number;
    bird?: SkyRobot;
};

const pick = (random: () => number) =>
    CCTV_KINDS[Math.floor(random() * CCTV_KINDS.length)];

function routeCctvs(
    seed: number,
    count: number,
    from: number,
    to: number,
): Spot[] {
    const random = seeded(seed);
    return Array.from({ length: count }, (_, i) => ({
        x: (i % 2 ? 1 : -1) * (230 + random() * 560),
        y: -420 + random() * 520,
        z: from + ((to - from) * (i + random() * 0.8)) / count,
        seed: seed + i,
        kind: pick(random),
        size: 1.3 + random() * 1.1,
        appear: 0.5,
    }));
}

const REVEAL_COLUMNS = [60, 210, 360, 640, 790, 940],
    REVEAL_ROWS = [50, 170, 300, 430];
const REVEAL_VIEW = { focal: 841.5, centerY: 188.7, camera: 480 };
const REVEAL_BIRDS: Partial<Record<number, SkyRobot>> = {
    1: 'liquid',
    6: 'black',
    11: 'liquid',
    16: 'black',
    19: 'liquid',
};

function revealCctvs(seed: number, glide: number): Spot[] {
    const random = seeded(seed);
    const count = REVEAL_ROWS.length * REVEAL_COLUMNS.length;
    const order = Array.from({ length: count }, (_, i) => ({
        i,
        key: random(),
    }))
        .sort((a, b) => a.key - b.key)
        .map((item) => item.i);
    return REVEAL_ROWS.flatMap((row, r) =>
        REVEAL_COLUMNS.map((column, c) => {
            const depth = 700 + random() * 860;
            const sx = column + (random() - 0.5) * 90,
                sy = row + (random() - 0.5) * 70;
            const scale = depth / REVEAL_VIEW.focal,
                index = r * REVEAL_COLUMNS.length + c;
            return {
                x: (sx - 500) * scale,
                y: (REVEAL_VIEW.centerY - sy) * scale,
                z: depth - REVEAL_VIEW.camera - glide,
                seed: seed + r * 10 + c,
                kind: pick(random),
                size: 1.3 + random() * 1.3,
                appear: 0.04 + (0.56 * order.indexOf(index)) / count,
                ...(REVEAL_BIRDS[index] ? { bird: REVEAL_BIRDS[index] } : {}),
            };
        }),
    );
}

const GLIDE = 1600;

type Glint = {
    x: number;
    y: number;
    red: boolean;
    rate: number;
    phase: number;
};

function cloudGlints(seed: number): Glint[] {
    const random = seeded(seed);
    const floor = Array.from({ length: 16 }, (_, i) => {
        const side = i % 2 ? 0.64 + random() * 0.33 : 0.03 + random() * 0.33;
        return { x: side, y: 0.8 + random() * 0.16 };
    });
    return [
        ...floor,
        { x: 0.12, y: 0.17 },
        { x: 0.19, y: 0.14 },
        { x: 0.85, y: 0.12 },
    ].map((spot, i) => ({
        ...spot,
        red: i % 3 === 0,
        rate: 1.6 + random() * 2.2,
        phase: random() * Math.PI * 2,
    }));
}

export const ORBIT_WATCH = {
    glide: GLIDE,
    reveal: revealCctvs(4100, GLIDE),
    route: routeCctvs(5200, 10, 600, 4700),
    satelliteAppear: 0.35,
    beacon: { x: 90, y: 760, z: 7400, appear: 0.55 },
    glints: cloudGlints(6300),
    glintsFrom: 0.92,
    before: 200,
    after: 40,
    blink: 7,
};

export type LampState = 'idle' | 'flash' | 'recorded';
type Lamp = { at: Point3; state: LampState; glow?: number; rec?: boolean };

export function cctvLamp(ahead: number, t: number): LampState {
    if (ahead > ORBIT_WATCH.before) return 'idle';
    if (ahead > -ORBIT_WATCH.after) {
        return Math.floor(t * ORBIT_WATCH.blink) % 2 === 0 ? 'flash' : 'idle';
    }
    return 'recorded';
}

const recording = (t: number, seed: number) =>
    (t * 0.8 + seed * 0.618) % 1 < 0.55;
const lampColor = (state: LampState, rec: boolean) =>
    state !== 'idle' || rec ? '#ff4a3a' : '#5e1d1a';

const SWERVE = 200;

function swerve(p: Point3, ahead: number): Point3 {
    const t = Math.max(0, Math.min(1, 1 - ahead / SWERVE));
    const out = 700 * t * t * (3 - 2 * t);
    const y = p[1] - 15,
        x = p[2],
        r = Math.hypot(x, y) || 1;
    return [p[0], 15 + y * (1 + out / r), x * (1 + out / r)];
}

function floating(
    view: SkyProjection,
    point: RoutePoint,
    spot: Spot,
    travel: number,
    t: number,
): Lamp[] {
    const placed = point(
        spot.x,
        spot.y + Math.sin(t * 0.9 + spot.seed) * 8,
        spot.z,
    );
    const anchor = swerve(placed, placed[0]);
    const yaw =
        aim(-anchor[0], -anchor[2]) + Math.sin(t * 0.6 + spot.seed) * 0.05;
    const state = cctvLamp(spot.z - travel, t);
    if (spot.bird) {
        const { eyes, glow } = robotBirdModel(
            view,
            spot.bird,
            placer(anchor, yaw, spot.size * 1.2),
            t * 9 + spot.seed,
        );
        return eyes.map((at) => ({ at, state, glow: glow * spot.size * 1.2 }));
    }
    const lamp = cctvModel(view, spot.kind, placer(anchor, yaw, spot.size));
    const rec = recording(t, spot.seed);
    view.oval(
        lamp,
        [4.5 * spot.size, 4.5 * spot.size, 4.5 * spot.size],
        lampColor(state, rec),
    );
    return [{ at: lamp, state, rec }];
}

function satellite(
    view: SkyProjection,
    point: RoutePoint,
    at: { x: number; y: number; z: number },
    travel: number,
    t: number,
): Lamp {
    const { x, y, z } = at;
    const place = placer(
        point(x, y + Math.sin(t * 0.7) * 12, z),
        aim(0, 1) + Math.sin(t * 0.4) * 0.08,
    );
    view.profile(
        [
            [-24, -30],
            [24, -30],
            [32, -20],
            [32, 20],
            [24, 30],
            [-24, 30],
            [-32, 20],
            [-32, -20],
        ],
        28,
        '#dcd7cf',
        0,
        { place },
    );
    view.profile(rect(-15, 4, 15, 16), 0.6, '#2f6fb5', 28.6, { place });
    for (const s of [-1, 1]) {
        view.rod(place([s * 32, 0, 0]), place([s * 48, 0, 0]), 2.5, '#9aa0b0');
        view.profile(rect(s * 48, -24, s * 160, 24), 2, '#3b5c9a', 0, {
            place,
        });
        for (const k of [0.33, 0.66]) {
            const u = s * (48 + 112 * k);
            view.profile(rect(u - 1, -24, u + 1, 24), 0.4, '#c9d6ee', 2.4, {
                place,
            });
        }
    }
    view.oval(place([0, -16, 29]), [9, 9, 3], '#27344d');
    view.oval(place([2, -13, 30]), [3, 3, 1], '#7d9fbb');
    const state = cctvLamp(z - travel, t);
    const lamp = place([-18, 22, 29]);
    const rec = recording(t, z);
    view.oval(lamp, [5, 5, 2], lampColor(state, rec));
    return { at: lamp, state, rec };
}

export function orbitWatchers(
    view: SkyProjection,
    point: RoutePoint,
    travel: number,
    t: number,
    shown = 1,
    satelliteLightPoint = point,
    satellites: ReadonlyArray<{ x: number; y: number; z: number }> = [],
) {
    const lamps = [...ORBIT_WATCH.reveal, ...ORBIT_WATCH.route]
        .filter(
            (spot) =>
                spot.appear <= shown && point(spot.x, spot.y, spot.z)[0] > 0,
        )
        .flatMap((spot) => floating(view, point, spot, travel, t));
    if (ORBIT_WATCH.satelliteAppear <= shown) {
        for (const at of satellites) {
            const ahead = satelliteLightPoint(at.x, at.y, at.z)[0];
            if (ahead > 0 && ahead < 6000) {
                lamps.push(satellite(view, satelliteLightPoint, at, travel, t));
            }
        }
    }
    return lamps;
}

export function orbitWatchGlow(
    ctx: RenderCtx,
    view: SkyProjection,
    lamps: Lamp[],
    alpha = 1,
) {
    const recLayer = { key: 'orbit-cctv-rec', blend: 'screen' as const },
        lightLayer = { key: 'orbit-cctv-light', blend: 'screen' as const };
    const eyeLayer = { key: 'orbit-robot-eye', blend: 'screen' as const };
    const recs: DrawCommand[] = [],
        lights: DrawCommand[] = [],
        eyes: DrawCommand[] = [];
    for (const { at, state, glow, rec } of lamps) {
        if (view.depth(at) < 80) continue;
        if (glow) {
            eyes.push(eyeGlow(ctx, view, at, glow, state, alpha, eyeLayer));
            continue;
        }
        if (state === 'idle' && !rec) continue;
        const [x, y] = view.project(at);
        const radius =
            ctx.clamp(30000 / view.depth(at), 10, 60) *
            (state === 'flash' ? 1 : state === 'recorded' ? 0.45 : 0.55);
        const idle = state === 'idle';
        (idle ? recs : lights).push({
            kind: 'path',
            points: [
                [x - radius, y - radius],
                [x + radius, y - radius],
                [x + radius, y + radius],
                [x - radius, y + radius],
            ],
            fill: {
                from: [x, y],
                to: [x + radius, y],
                radius,
                stops: [
                    [0, ctx.rgba('#ff6b57', 0.95 * alpha)],
                    [1, ctx.rgba('#ff6b57', 0)],
                ],
            },
            layer: idle ? recLayer : lightLayer,
        });
    }
    ctx.commands.push(...recs, ...lights, ...eyes);
}

function eyeGlow(
    ctx: RenderCtx,
    view: SkyProjection,
    at: Point3,
    glow: number,
    state: LampState,
    alpha: number,
    layer: LayerSpec,
): DrawCommand {
    const [x, y] = view.project(at);
    const radius =
        Math.max(
            4,
            Math.abs(view.project([at[0], at[1] + glow, at[2]])[1] - y),
        ) * (state === 'flash' ? 1.5 : 1);
    const pulse = (0.8 + Math.sin(ctx.t * 3 + at[0]) * 0.2) * alpha;
    return {
        kind: 'path',
        points: [
            [x - radius, y - radius],
            [x + radius, y - radius],
            [x + radius, y + radius],
            [x - radius, y + radius],
        ],
        fill: {
            from: [x, y],
            to: [x + radius, y],
            radius,
            stops: [
                [0, ctx.rgba('#ff3a1a', 0.85 * pulse)],
                [0.4, ctx.rgba('#ff2a1a', 0.45 * pulse)],
                [1, ctx.rgba('#ff2a1a', 0)],
            ],
        },
        layer,
    };
}

export function orbitBeacon(
    ctx: RenderCtx,
    view: SkyProjection,
    point: RoutePoint,
    alpha = 1,
) {
    const { x, y, z } = ORBIT_WATCH.beacon;
    const at = point(x, y, z);
    if (view.depth(at) < 80) return;
    const [cx, cy] = view.project(at);
    const twinkle =
        0.35 + 0.65 * Math.pow(Math.sin(ctx.t * 1.7) * 0.5 + 0.5, 3);
    const layer = { key: 'orbit-beacon', blend: 'screen' as const };
    const glow = 5 + 9 * twinkle;
    ctx.commands.push({
        kind: 'path',
        points: [
            [cx - glow, cy - glow],
            [cx + glow, cy - glow],
            [cx + glow, cy + glow],
            [cx - glow, cy + glow],
        ],
        fill: {
            from: [cx, cy],
            to: [cx + glow, cy],
            radius: glow,
            stops: [
                [0, ctx.rgba('#fff3cf', 0.9 * alpha)],
                [1, ctx.rgba('#fff3cf', 0)],
            ],
        },
        layer,
    });
    const ray = 3 + 7 * twinkle,
        thin = 0.7;
    const color =
        '#fffaf0' +
        Math.round(ctx.clamp(twinkle * alpha, 0, 1) * 255)
            .toString(16)
            .padStart(2, '0');
    ctx.commands.push({
        kind: 'path',
        points: [
            [cx - ray, cy],
            [cx, cy - thin],
            [cx + ray, cy],
            [cx, cy + thin],
        ],
        fill: color,
        layer,
    });
    ctx.commands.push({
        kind: 'path',
        points: [
            [cx, cy - ray],
            [cx + thin, cy],
            [cx, cy + ray],
            [cx - thin, cy],
        ],
        fill: color,
        layer,
    });
}

export function orbitCloudGlints(ctx: RenderCtx, alpha = 1) {
    if (alpha <= 0) return;
    // Colours bake in the screen blend to avoid a full-canvas compositing pass.
    const layer = { key: 'orbit-cloud-glint' };
    for (const glint of ORBIT_WATCH.glints) {
        const wave = Math.sin(ctx.t * glint.rate + glint.phase);
        if (wave < 0.55) continue;
        const k = (wave - 0.55) / 0.45,
            x = glint.x * ctx.W,
            y = glint.y * ctx.H;
        const glow = 7 + 9 * k,
            core = 2 + 1.6 * k;
        const color = glint.red ? '#ffd399' : '#fffbe2';
        ctx.commands.push({
            kind: 'path',
            points: [
                [x - glow, y - glow],
                [x + glow, y - glow],
                [x + glow, y + glow],
                [x - glow, y + glow],
            ],
            fill: {
                from: [x, y],
                to: [x + glow, y],
                radius: glow,
                stops: [
                    [0, ctx.rgba(color, 0.9 * k * alpha)],
                    [1, ctx.rgba(color, 0)],
                ],
            },
            layer,
        });
        const tint = Math.round(alpha * 255)
            .toString(16)
            .padStart(2, '0');
        ctx.commands.push({
            kind: 'path',
            points: [
                [x - core, y],
                [x, y - core],
                [x + core, y],
                [x, y + core],
            ],
            fill: (glint.red ? '#ffce91' : '#ffffff') + tint,
            layer,
        });
    }
}
