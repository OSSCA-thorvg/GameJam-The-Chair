import type { Vector, Curve } from '../types';
import type { DeepReadonly, Person } from '../../game/types';
import type { RenderCtx } from '../context';

type CleanerControls = {
    approach: number;
    frontStep: number;
    rearStep: number;
    frontLift: number;
    rearLift: number;
    hipDrop: number;
    lean: number;
    turn: number;
    grip: number;
    bucketTilt: number;
    bucketLift: number;
    retreat: number;
};
type CleanerBeat = { at: number; pose: CleanerControls };
type LimbPose = { root: Vector; joint: Vector; end: Vector };
type BucketPose = { origin: Vector; angle: number; frontGrip: Vector; rearGrip: Vector };
type CleanerPose = {
    hip: Vector;
    shoulder: Vector;
    facing: number;
    frontLeg: LimbPose;
    rearLeg: LimbPose;
    frontArm: LimbPose;
    rearArm: LimbPose;
};

export const CLEANER_RECOVERY_START = 1.35;
export const CLEANER_RECOVERY_END = 3.55;

const RESTING_CLEANER: CleanerControls = {
    approach: 0, frontStep: 0, rearStep: 0, frontLift: 0, rearLift: 0,
    hipDrop: 0, lean: 0, turn: 0, grip: 0, bucketTilt: 1, bucketLift: 0, retreat: 0,
};
const CLEANER_BEATS: readonly CleanerBeat[] = [
    { at: .9, pose: RESTING_CLEANER },
    { at: CLEANER_RECOVERY_START, pose: RESTING_CLEANER },
    { at: 1.55, pose: { ...RESTING_CLEANER, turn: 1 } },
    { at: 1.68, pose: { ...RESTING_CLEANER, turn: 1, approach: .2, frontStep: .5, frontLift: 1, hipDrop: .15 } },
    { at: 1.8, pose: { ...RESTING_CLEANER, turn: 1, approach: .45, frontStep: 1, hipDrop: .3 } },
    { at: 1.93, pose: { ...RESTING_CLEANER, turn: 1, approach: .75, frontStep: 1, rearStep: .5, rearLift: 1, hipDrop: .2 } },
    { at: 2.05, pose: { ...RESTING_CLEANER, turn: 1, approach: 1, frontStep: 1, rearStep: 1, hipDrop: .1 } },
    { at: 2.23, pose: { ...RESTING_CLEANER, turn: 1, approach: 1, frontStep: 1, rearStep: 1, lean: .1 } },
    { at: 2.4, pose: { ...RESTING_CLEANER, turn: 1, approach: 1, frontStep: 1, rearStep: 1, hipDrop: 1, lean: 1, grip: 1 } },
    { at: 2.65, pose: { ...RESTING_CLEANER, turn: 1, approach: 1, frontStep: 1, rearStep: 1, hipDrop: .45, lean: .45, grip: 1, bucketTilt: .5, bucketLift: 8 } },
    { at: 2.9, pose: { ...RESTING_CLEANER, approach: 1, frontStep: 1, rearStep: 1, grip: 1, bucketTilt: 0 } },
    { at: 3.03, pose: { ...RESTING_CLEANER, approach: 1, frontStep: 1, rearStep: 1, bucketTilt: 0 } },
    { at: 3.12, pose: { ...RESTING_CLEANER, approach: 1, frontStep: .5, rearStep: 1, frontLift: 1, hipDrop: .15, bucketTilt: 0, retreat: .25 } },
    { at: 3.2, pose: { ...RESTING_CLEANER, approach: 1, rearStep: 1, hipDrop: .3, bucketTilt: 0, retreat: .5 } },
    { at: 3.27, pose: { ...RESTING_CLEANER, approach: 1, rearStep: .5, rearLift: 1, hipDrop: .15, bucketTilt: 0, retreat: .75 } },
    { at: 3.35, pose: { ...RESTING_CLEANER, approach: 1, bucketTilt: 0, retreat: 1 } },
];

function mix(a: number, b: number, amount: number) {
    return a + (b - a) * amount;
}

function sampleCleaner(age: number): CleanerControls {
    let previous = CLEANER_BEATS[0];
    if (age <= previous.at) return previous.pose;
    for (let i = 1; i < CLEANER_BEATS.length; i++) {
        const next = CLEANER_BEATS[i];
        if (age <= next.at) {
            const progress = (age - previous.at) / (next.at - previous.at);
            const amount = progress * progress * (3 - 2 * progress);
            const a = previous.pose;
            const b = next.pose;
            return {
                approach: mix(a.approach, b.approach, amount),
                frontStep: mix(a.frontStep, b.frontStep, amount),
                rearStep: mix(a.rearStep, b.rearStep, amount),
                frontLift: mix(a.frontLift, b.frontLift, amount),
                rearLift: mix(a.rearLift, b.rearLift, amount),
                hipDrop: mix(a.hipDrop, b.hipDrop, amount),
                lean: mix(a.lean, b.lean, amount),
                turn: mix(a.turn, b.turn, amount),
                grip: mix(a.grip, b.grip, amount),
                bucketTilt: mix(a.bucketTilt, b.bucketTilt, amount),
                bucketLift: mix(a.bucketLift, b.bucketLift, amount),
                retreat: mix(a.retreat, b.retreat, amount),
            };
        }
        previous = next;
    }
    return previous.pose;
}

function bucketPose(ctx: RenderCtx, motion: CleanerControls): BucketPose {
    const fall = ctx.cleaning.spilled ? Math.min(1, ctx.state.bucketAge / .42) : 0;
    const angle = ctx.cleaning.splashDir * fall * motion.bucketTilt * 1.25;
    const origin: Vector = [ctx.cleaning.x, ctx.F - 5 - 15 * Math.abs(Math.sin(angle)) - 2 * Math.cos(angle) - motion.bucketLift];
    const point = (x: number, y: number): Vector => [
        origin[0] + x * Math.cos(angle) - y * Math.sin(angle),
        origin[1] + x * Math.sin(angle) + y * Math.cos(angle),
    ];
    return { origin, angle, frontGrip: point(-12, -66), rearGrip: point(12, -66) };
}

function cleanerHead(ctx: RenderCtx, x = 0, y = 0, facing = 1) {
    const headPart = (points: Vector[], fill: string) =>
        ctx.polygon(points.map(([px, py]) => [x + facing * px, y + py]), fill);
    headPart([[-10, -105], [1, -97], [11, -104], [15, -97], [6, -91], [0, -97], [-5, -89], [-13, -98]], '#a5b3b9');
    headPart([[-8, -115], [7, -115], [9, -103], [0, -98], [-8, -103]], '#bb9b7c');
    headPart([[-13, -144], [2, -149], [17, -140], [20, -128], [24, -123], [18, -121], [14, -109], [-5, -111], [-13, -121]], '#e5c6a2');
    headPart([[-18, -138], [-14, -151], [-5, -150], [5, -157], [18, -145], [11, -141], [1, -145], [-6, -135], [-11, -139], [-13, -124], [-18, -129]], '#424d5c');
    headPart([[13, -131], [16, -131], [16, -127], [13, -127]], '#4b5059');
}

function cleanerMop(ctx: RenderCtx) {
    ctx.polygon([[18, -86], [22, -88], [79, -4], [74, -2]], '#808c7b');
    ctx.polygon([[70, -8], [79, -11], [91, -3], [87, 1], [64, 1]], '#b1ad8e');
}

export function person(ctx: RenderCtx, n: DeepReadonly<Person>) {
    if (n.id === 'cleaner') {
        const motion = sampleCleaner(0);
        const pose = cleanerPose(ctx, n, motion, bucketPose(ctx, motion));
        drawCleanerBody(ctx, n, pose);
        drawArm(ctx, pose.frontArm, true);
        return;
    }
    const F = ctx.F;
    ctx.ox = n.x;
    ctx.oy = F - 17;
    ctx.localScale = .85;
    ctx.ellipse(-2, 0, 30, 3, '#515c6d62');
    switch (n.id) {
        case 'manager':
            ctx.polygon([[-25, -48], [24, -48], [20, -4], [7, -4], [1, -40], [-5, -4], [-19, -4]], '#455064');
            ctx.polygon([[-19, -8], [-6, -8], [-4, -1], [-26, -1], [-26, -4]], '#333b4a');
            ctx.polygon([[7, -8], [20, -8], [29, -3], [29, -1], [7, -1]], '#333b4a');
            ctx.polygon([[-31, -101], [-13, -108], [11, -108], [31, -99], [34, -77], [25, -70], [26, -44], [-26, -44], [-24, -68], [-35, -75]], '#57637a');
            ctx.polygon([[-31, -101], [-13, -108], [-7, -108], [-13, -66], [-26, -44], [-24, -68], [-35, -75]], '#626e85');
            ctx.polygon([[-13, -107], [12, -107], [1, -78]], '#e0dfd2');
            ctx.polygon([[-4, -102], [4, -102], [6, -97], [4, -80], [0, -74], [-4, -80], [-3, -96]], '#956457');
            ctx.polygon([[-9, -114], [10, -114], [10, -104], [0, -99], [-9, -104]], '#b4967a');
            ctx.polygon([[-17, -147], [-3, -154], [15, -147], [20, -131], [15, -126], [12, -114], [-7, -111], [-18, -123]], '#dfbe99');
            ctx.polygon([[-20, -144], [-10, -157], [12, -155], [21, -146], [9, -145], [-5, -149], [-14, -140], [-15, -130], [-20, -134]], '#434957');
            ctx.polygon([[-19, -143], [-15, -142], [-16, -130], [-20, -134]], '#7a818d');
            ctx.polygon([[10, -137], [17, -137], [17, -135], [10, -135]], '#484655');
            ctx.polygon([[-28, -84], [0, -79], [22, -83], [24, -72], [-1, -68], [-27, -72]], '#424e64');
            ctx.polygon([[-13, -80], [-5, -79], [-3, -73], [-13, -74]], '#d4b18e');
            ctx.polygon([[11, -80], [19, -82], [21, -76], [12, -74]], '#d4b18e');
            break;
        case 'admin':
            ctx.polygon([[-19, -53], [16, -53], [17, -6], [6, -6], [0, -42], [-7, -6], [-18, -6]], '#495368');
            ctx.polygon([[-18, -8], [-7, -8], [-7, -1], [-26, -1], [-26, -5]], '#363d4d');
            ctx.polygon([[6, -8], [17, -8], [24, -3], [24, -1], [6, -1]], '#363d4d');
            ctx.polygon([[-20, -104], [-8, -108], [10, -108], [24, -102], [28, -77], [20, -74], [21, -39], [-21, -39], [-17, -76], [-25, -79]], '#66566e');
            ctx.polygon([[-20, -104], [-8, -108], [-5, -41], [-21, -39], [-17, -76], [-25, -79]], '#78647d');
            ctx.polygon([[-8, -108], [10, -108], [1, -82]], '#ddd4c5');
            ctx.polygon([[-8, -117], [8, -117], [8, -104], [1, -99], [-8, -104]], '#aa8e73');
            ctx.polygon([[-18, -140], [-6, -152], [14, -146], [20, -133], [18, -117], [4, -110], [-14, -117]], '#dfbd9d');
            ctx.polygon([[-22, -140], [-14, -154], [0, -158], [15, -152], [20, -141], [3, -146], [-10, -133], [-10, -120], [-18, -117]], '#4b3f49');
            ctx.ellipse(-18, -124, 10, 10, '#4b3f49');
            ctx.polygon([[10, -133], [15, -133], [15, -131], [10, -131]], '#514552');
            ctx.polygon([[-2, -79], [13, -81], [10, -68], [0, -68]], '#ac9e92');
            ctx.polygon([[-1, -76], [33, -75], [29, -51], [-5, -53]], '#b8a682');
            ctx.polygon([[4, -72], [28, -71], [25, -55], [1, -56]], '#d8cbb4');
            ctx.polygon([[10, -74], [23, -74], [23, -70], [10, -70]], '#8b8e95');
            ctx.polygon([[-7, -65], [4, -61], [3, -55], [-10, -59]], '#d7b697');
            break;
    }
    ctx.ox = ctx.oy = 0;
    ctx.localScale = 1;
}

function kneeBetween(root: Vector, end: Vector, direction: number): Vector {
    const dx = end[0] - root[0];
    const dy = end[1] - root[1];
    const distance = Math.max(.001, Math.hypot(dx, dy));
    const along = (21 * 21 - 22 * 22 + distance * distance) / (2 * distance);
    const bend = Math.sqrt(Math.max(0, 21 * 21 - along * along));
    return [root[0] + dx / distance * along + direction * dy / distance * bend,
        root[1] + dy / distance * along - direction * dx / distance * bend];
}

function armPose(root: Vector, rest: Vector, grip: Vector, amount: number, direction: number): LimbPose {
    const end: Vector = [mix(rest[0], grip[0], amount), mix(rest[1], grip[1], amount)];
    return { root, end, joint: [mix(root[0], end[0], .5) - direction * 7, mix(root[1], end[1], .5) + 7] };
}

function cleanerPose(ctx: RenderCtx, n: DeepReadonly<Person>, motion: CleanerControls, bucket: BucketPose): CleanerPose {
    const toward = ctx.cleaning.x < n.x ? -1 : 1;
    const footY = ctx.F - 20;
    const targetX = ctx.cleaning.x - toward * 20;
    const hipX = mix(n.x, targetX, motion.approach * (1 - motion.retreat));
    const frontFoot: Vector = [mix(n.x + toward * 11, targetX + toward * 13, motion.frontStep), footY - motion.frontLift * 9];
    const rearFoot: Vector = [mix(n.x - toward * 11, targetX - toward * 13, motion.rearStep), footY - motion.rearLift * 9];
    let hipY = ctx.F - 59 + motion.hipDrop * 18;
    for (const [foot, offset] of [[frontFoot, toward * 6], [rearFoot, -toward * 6]] satisfies [Vector, number][]) {
        const reach = Math.sqrt(Math.max(1, 43 * 43 - (foot[0] - hipX - offset) ** 2));
        hipY = Math.max(hipY, foot[1] - reach);
    }
    const gripX = (bucket.frontGrip[0] + bucket.rearGrip[0]) / 2;
    const shoulder: Vector = [hipX + (gripX - hipX) * motion.lean * .55, hipY - 46 + motion.hipDrop * 8];
    const frontHip: Vector = [hipX + toward * 6, hipY];
    const rearHip: Vector = [hipX - toward * 6, hipY];
    const restHand: Vector = [hipX + 32 * (1 - motion.turn) * (1 - motion.retreat) + toward * 14 * motion.turn + 13 * motion.retreat,
        shoulder[1] + 32 + 6 * motion.retreat];
    return {
        hip: [hipX, hipY], shoulder, facing: mix(1, toward, motion.turn),
        frontLeg: { root: frontHip, joint: kneeBetween(frontHip, frontFoot, toward), end: frontFoot },
        rearLeg: { root: rearHip, joint: kneeBetween(rearHip, rearFoot, toward), end: rearFoot },
        frontArm: armPose([shoulder[0] + 7, shoulder[1] + 8], restHand, bucket.frontGrip, motion.grip, toward),
        rearArm: armPose([shoulder[0] - 8, shoulder[1] + 8], [hipX - 11, shoulder[1] + 37], bucket.rearGrip, motion.grip, -toward),
    };
}

function drawArm(ctx: RenderCtx, arm: LimbPose, near: boolean) {
    ctx.rod(...arm.root, ...arm.joint, near ? 9 : 7, near ? '#79909f' : '#6c8393');
    ctx.ellipse(...arm.joint, near ? 5 : 4, 4, '#a5b3b9');
    ctx.rod(...arm.joint, ...arm.end, near ? 6 : 5, '#e0be9c');
    ctx.ellipse(...arm.end, 4, 3.4, '#e0be9c');
}

function drawLeg(ctx: RenderCtx, leg: LimbPose, near: boolean, facing: number) {
    const fill = near ? '#536373' : '#485867';
    ctx.rod(...leg.root, ...leg.joint, near ? 11 : 10, fill);
    ctx.rod(...leg.joint, ...leg.end, near ? 9 : 8, fill);
    ctx.ellipse(...leg.joint, near ? 4.5 : 4, 4.5, fill);
    const [x, y] = leg.end;
    const direction = facing < 0 ? -1 : 1;
    ctx.polygon([[-6, -3], [4, -3], [10, 2], [-7, 2]].map(([px, py]) => [x + px * direction, y + py]), '#3c4753');
}

function drawCleanerBody(ctx: RenderCtx, n: DeepReadonly<Person>, pose: CleanerPose) {
    ctx.ellipse(pose.hip[0], ctx.F - 17, 28, 2.5, '#515c6d62');
    ctx.ox = n.x;
    ctx.oy = ctx.F - 17;
    ctx.localScale = .85;
    cleanerMop(ctx);
    ctx.ox = ctx.oy = 0;
    ctx.localScale = 1;
    drawArm(ctx, pose.rearArm, false);
    drawLeg(ctx, pose.rearLeg, false, pose.facing);
    drawLeg(ctx, pose.frontLeg, true, pose.facing);
    const [hipX, hipY] = pose.hip;
    const [shoulderX, shoulderY] = pose.shoulder;
    ctx.polygon([[shoulderX - 13, shoulderY], [shoulderX + 11, shoulderY - 4],
        [hipX + 12, hipY + 3], [hipX - 12, hipY + 5], [shoulderX - 16, shoulderY + 12]], '#79909f');
    ctx.polygon([[shoulderX - 13, shoulderY], [shoulderX - 6, shoulderY - 1],
        [hipX - 5, hipY + 4], [hipX - 12, hipY + 5], [shoulderX - 16, shoulderY + 12]], '#899eaa');
    ctx.ox = shoulderX;
    ctx.oy = shoulderY + 87;
    ctx.localScale = .85;
    cleanerHead(ctx, 0, 0, pose.facing);
    ctx.ox = ctx.oy = 0;
    ctx.localScale = 1;
}

export function cleaningDraw(ctx: RenderCtx, cleaner?: DeepReadonly<Person>) {
    const F = ctx.F;
    const cleaning = ctx.cleaning;
    const state = ctx.state;
    const p = ctx.p;
    const motion = sampleCleaner(cleaning.spilled ? state.bucketAge : 0);
    const bucket = bucketPose(ctx, motion);
    const pose = cleaner ? cleanerPose(ctx, cleaner, motion, bucket) : undefined;
    const spread = cleaning.spilled ? Math.min(1, cleaning.age / .8) : 0;
    if (spread > 0) {
        const width = (cleaning.b - cleaning.a) * spread;
        const inlet = Math.min(cleaning.x - 46 - cleaning.a, width * .5);
        const depth = 6 + 15 * spread;
        ctx.ox = cleaning.a;
        ctx.oy = F;
        ctx.effectPath([inlet, -17], [
            [inlet * .35, -8, 0, -4, 0, 3],
            [0, depth, width * .28, depth + 2, width * .42, depth],
            [width * .66, depth + 1, width * .94, depth - 6, width, depth - 4],
            [width, depth - 13, width * .57, depth - 10, width * .41, depth - 14],
            [width * .2, depth - 16, inlet * 1.3, -8, inlet, -17]
        ], ctx.gradientFill(0, -17, 0, depth + 2, [[0, '#777b5f'], [.55, '#8f9679'], [1, '#78826e']]));
        ctx.ellipse(width * .28, depth - 6, width * .1, spread * 1.8, '#c6cbae90');
        ctx.ellipse(width * .48, depth - 9, width * .06, spread * 1.4, '#c6cbae70');
        ctx.ox = ctx.oy = 0;
        if (state.slip) {
            ctx.rod(p.x - 95, F - 2, p.x - 30, F - 2, 3, '#5e716c');
            ctx.rod(p.x - 82, F + 4, p.x - 18, F + 4, 2, '#61736e');
        }
    }
    const { bucketAge } = state;
    const angle = bucket.angle;
    const tip = Math.abs(angle) / 1.25;
    const side = cleaning.splashDir;
    ctx.ellipse(cleaning.x + side * tip * 20, F + 1, 28 + tip * 5, 3, '#515c6d48');
    if (cleaner && pose) drawCleanerBody(ctx, cleaner, pose);
    ctx.ox = bucket.origin[0];
    ctx.oy = bucket.origin[1];
    ctx.rotation = angle;
    ctx.polygon([[-23, -50], [20, -50], [15, -7], [-18, -7]], '#c0a775');
    ctx.ellipse(-2, -50, 22, 6, '#647260');
    ctx.rod(-24, -46, -19, -66, 3, '#7d8790');
    ctx.rod(-19, -66, 18, -66, 3, '#7d8790');
    ctx.rod(18, -66, 23, -46, 3, '#7d8790');
    ctx.rect(-21, -7, 41, 7, '#8d8b74');
    ctx.ellipse(-15, 2, 5, 5, '#555f66');
    ctx.ellipse(15, 2, 5, 5, '#555f66');
    ctx.rect(-11, -36, 19, 13, '#eee1b5');
    ctx.ox = ctx.oy = ctx.rotation = 0;
    if (pose) drawArm(ctx, pose.frontArm, true);
    if (bucketAge < 1.1) {
        const u = ctx.clamp(bucketAge / 1.1, 0, 1);
        const reach = Math.sin(Math.min(1, u * 2) * Math.PI / 2);
        const fade = Math.sin(u * Math.PI);
        ctx.ox = cleaning.x + side * 10;
        ctx.oy = F - 24;
        for (let i = 0; i < 2; i++) {
            const end = -65 - (125 - i * 38) * reach;
            const crest = -30 - (80 - i * 22) * Math.sin(u * Math.PI);
            ctx.effectPath([0, 0], [[end * .3, crest - 25, end * .65, crest, end, 12], [end + 24, 8, end + 38, -6, end + 52, 6], [end * .4, 14, -18, 24, 0, 0]].map(c => c.map((v, i) => i % 2 === 0 ? v * -side : v) as Curve), ctx.gradientFill(0, -65, 0, 30, [[0, '#bfca9c90'], [.45, '#8e9c7dcc'], [1, '#66796318']], fade));
        }
        ctx.ox = ctx.oy = ctx.rotation = 0;
    }
    for (const r of ctx.waterRipples) {
        const u = r.age / r.life;
        ctx.ripple(r.x, F + 5, 4 + u * (14 + r.r * 2), 1.5 + u * 3, 1.2, ctx.tint('#c0c7a4', (1 - u) * .65));
    }
    for (const z of ctx.waterDrops) {
        const fade = ctx.clamp(z.life / .35, 0, 1);
        const speed = Math.hypot(z.vx, z.vy);
        const stretch = z.landed ? 1 : ctx.clamp(speed / 130, 1, 2.8);
        ctx.ox = z.x;
        ctx.oy = z.y;
        ctx.rotation = Math.atan2(z.vy, z.vx) - Math.PI / 2;
        const r = z.r;
        const w = r * .68;
        const h = r * stretch;
        ctx.effectPath([0, -h], [[w, -h * .25, w, h * .65, 0, h], [-w, h * .65, -w, -h * .25, 0, -h]], ctx.gradientFill(-w, 0, w, 0, [[0, '#647960d0'], [.48, '#a8b58bdc'], [1, '#7d8e7880']], fade));
        if (!z.landed && z.r > 4) {
            ctx.ellipse(-w * .25, -h * .1, .8, h * .32, ctx.tint('#e0dfb7', fade * .7));
        }
        ctx.ox = ctx.oy = ctx.rotation = 0;
    }
}
