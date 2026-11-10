import type { Vector } from './types';

// Shared by the bucket drawing and the water emitter so the water always
// leaves from the bucket's real mouth.
export const BUCKET_FALL_TIME = .42;
export const BUCKET_TIP = 1.25;
/** Local rim corners of the bucket (left, right) at the opening. */
const RIM_LEFT: Vector = [-23, -50];
const RIM_RIGHT: Vector = [20, -50];

export function bucketAngle(side: number, age: number, tilt = 1) {
    return side * Math.min(1, Math.max(0, age) / BUCKET_FALL_TIME) * tilt * BUCKET_TIP;
}

export function bucketOrigin(x: number, floor: number, angle: number, lift = 0): Vector {
    return [x, floor - 5 - 15 * Math.abs(Math.sin(angle)) - 2 * Math.cos(angle) - lift];
}

export function bucketPoint(origin: Vector, angle: number, x: number, y: number): Vector {
    return [
        origin[0] + x * Math.cos(angle) - y * Math.sin(angle),
        origin[1] + x * Math.sin(angle) + y * Math.cos(angle),
    ];
}

export type BucketMouth = {
    /** Rim corner nearest the floor, where water leaves first. */
    lip: Vector;
    /** Opposite rim corner. */
    rim: Vector;
    /** Unit vector pointing out of the opening. */
    out: Vector;
    angle: number;
};

export function bucketMouth(x: number, floor: number, side: number, age: number): BucketMouth {
    const angle = bucketAngle(side, age);
    const origin = bucketOrigin(x, floor, angle);
    const [lipLocal, rimLocal] = side < 0 ? [RIM_LEFT, RIM_RIGHT] : [RIM_RIGHT, RIM_LEFT];
    return {
        lip: bucketPoint(origin, angle, ...lipLocal),
        rim: bucketPoint(origin, angle, ...rimLocal),
        out: [Math.sin(angle), -Math.cos(angle)],
        angle,
    };
}

/**
 * How hard water is gushing out (0..1) `age` seconds after the bucket tips:
 * nothing until the rim dips, a fast surge, then decaying glugs.
 */
export function pourFlow(age: number) {
    const u = age - .17;
    if (u <= 0) return 0;
    const envelope = u < .07 ? u / .07 : Math.exp(-(u - .07) * 2.5);
    // Glugs deepen as the bucket empties: one solid gush first, then gulps.
    const depth = Math.min(.5, Math.max(0, u - .15) * .9);
    const glug = 1 - depth + depth * Math.cos(Math.max(0, u - .15) * Math.PI * 2 * 4.2);
    return envelope * glug;
}

export const WATER_GRAVITY = 980;

/**
 * Exit speed of water leaving at `age`. It only ever slows down after the
 * first gush, so later water never overtakes earlier water and the falling
 * sheet keeps one clean arc instead of bending like a rope.
 */
export function pourSpeed(age: number) {
    const u = age - .17 - .07;
    return 75 + 150 * (u <= 0 ? 1 : Math.exp(-u * 2.5));
}

export type WaterLaunch = { x: number; y: number; vx: number; vy: number; flow: number; opening: number };

/** Where and how fast the water that left the bucket at `age` was launched. */
export function pourLaunch(x: number, floor: number, side: number, age: number): WaterLaunch {
    const flow = pourFlow(age);
    const mouth = bucketMouth(x, floor, side, age);
    const opening = .08 + .2 * flow;
    const speed = pourSpeed(age);
    // Water spills over the rim rather than firing along the bucket's axis:
    // mostly sideways, with at most a slight lift while the bucket is still upright.
    const lift = Math.max(-.2, Math.min(.1, mouth.out[1]));
    const length = Math.hypot(1, lift);
    return {
        x: mouth.lip[0] + (mouth.rim[0] - mouth.lip[0]) * opening * .5,
        y: mouth.lip[1] + (mouth.rim[1] - mouth.lip[1]) * opening * .5,
        vx: (Math.sign(side) || 1) * speed / length,
        vy: lift * speed / length,
        flow,
        opening,
    };
}
