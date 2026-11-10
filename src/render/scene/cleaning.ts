import type { Vector, Curve } from '../types';
import type { DeepReadonly, Person } from '../../game/types';
import type { RenderCtx } from '../context';
import { bucketAngle, bucketOrigin, bucketPoint } from '../bucket';
import { drawPour, drawPuddle, puddleShape } from './water';
import { player } from './player';

type CleanerControls = {
    approach: number;
    hipDrop: number;
    lean: number;
    turn: number;
    grip: number;
    mopGrip: number;
    mopFall: number;
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
export const CLEANER_RECOVERY_END = 4.45;

const RESTING_CLEANER: CleanerControls = {
    approach: 0, hipDrop: 0, lean: 0, turn: 0, grip: 0,
    mopGrip: 1, mopFall: 0, bucketTilt: 1, bucketLift: 0, retreat: 0,
};
const CLEANER_BEATS: readonly CleanerBeat[] = [
    { at: .9, pose: RESTING_CLEANER },
    { at: CLEANER_RECOVERY_START, pose: RESTING_CLEANER },
    { at: 1.55, pose: { ...RESTING_CLEANER, turn: 1 } },
    { at: 1.68, pose: { ...RESTING_CLEANER, turn: 1, approach: .2, mopGrip: 0, mopFall: .12 } },
    { at: 1.8, pose: { ...RESTING_CLEANER, turn: 1, approach: .45, mopGrip: 0, mopFall: .55 } },
    { at: 1.93, pose: { ...RESTING_CLEANER, turn: 1, approach: .75, mopGrip: 0, mopFall: 1 } },
    { at: 2.05, pose: { ...RESTING_CLEANER, turn: 1, approach: 1, mopGrip: 0, mopFall: 1 } },
    { at: 2.23, pose: { ...RESTING_CLEANER, turn: 1, approach: 1, mopGrip: 0, mopFall: 1, lean: .1 } },
    { at: 2.4, pose: { ...RESTING_CLEANER, turn: 1, approach: 1, mopGrip: 0, mopFall: 1, hipDrop: 1, lean: 1, grip: 1 } },
    { at: 2.65, pose: { ...RESTING_CLEANER, turn: 1, approach: 1, mopGrip: 0, mopFall: 1, hipDrop: .45, lean: .45, grip: 1, bucketTilt: .5, bucketLift: 8 } },
    { at: 2.9, pose: { ...RESTING_CLEANER, approach: 1, mopGrip: 0, mopFall: 1, grip: 1, bucketTilt: 0 } },
    { at: 3.03, pose: { ...RESTING_CLEANER, approach: 1, mopGrip: 0, mopFall: 1, bucketTilt: 0 } },
    { at: 3.12, pose: { ...RESTING_CLEANER, approach: 1, mopGrip: 0, mopFall: 1, bucketTilt: 0, retreat: .2 } },
    { at: 3.2, pose: { ...RESTING_CLEANER, approach: 1, mopGrip: 0, mopFall: 1, bucketTilt: 0, retreat: .45 } },
    { at: 3.27, pose: { ...RESTING_CLEANER, approach: 1, mopGrip: 0, mopFall: 1, bucketTilt: 0, retreat: .75 } },
    { at: 3.4, pose: { ...RESTING_CLEANER, approach: 1, mopGrip: 0, mopFall: 1, bucketTilt: 0, retreat: 1 } },
    { at: 3.7, pose: { ...RESTING_CLEANER, approach: 1, mopGrip: 0, mopFall: 1, bucketTilt: 0, retreat: 1, hipDrop: .9, lean: .5 } },
    { at: 3.9, pose: { ...RESTING_CLEANER, approach: 1, mopFall: 1, bucketTilt: 0, retreat: 1, hipDrop: 1, lean: .5 } },
    { at: 4.25, pose: { ...RESTING_CLEANER, approach: 1, bucketTilt: 0, retreat: 1, hipDrop: .2 } },
    { at: CLEANER_RECOVERY_END, pose: { ...RESTING_CLEANER, approach: 1, bucketTilt: 0, retreat: 1 } },
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
                hipDrop: mix(a.hipDrop, b.hipDrop, amount),
                lean: mix(a.lean, b.lean, amount),
                turn: mix(a.turn, b.turn, amount),
                grip: mix(a.grip, b.grip, amount),
                mopGrip: mix(a.mopGrip, b.mopGrip, amount),
                mopFall: mix(a.mopFall, b.mopFall, amount),
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
    const angle = ctx.cleaning.spilled ? bucketAngle(ctx.cleaning.splashDir, ctx.state.bucketAge, motion.bucketTilt) : 0;
    const origin = bucketOrigin(ctx.cleaning.x, ctx.F, angle, motion.bucketLift);
    return { origin, angle, frontGrip: bucketPoint(origin, angle, -12, -66), rearGrip: bucketPoint(origin, angle, 12, -66) };
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

function mopHandle(ctx: RenderCtx, n: DeepReadonly<Person>, fall: number): Vector {
    const angle = -fall * 1.02;
    const x = (20 - 76) * .85;
    const y = -86 * .85;
    return [n.x + 76 * .85 + x * Math.cos(angle) - y * Math.sin(angle),
        ctx.F - 17 + x * Math.sin(angle) + y * Math.cos(angle)];
}

function cleanerMop(ctx: RenderCtx, n: DeepReadonly<Person>, fall: number) {
    ctx.ox = n.x + 76 * .85;
    ctx.oy = ctx.F - 17;
    ctx.rotation = -fall * 1.02;
    ctx.localScale = .85;
    ctx.polygon([[-58, -86], [-54, -88], [3, -4], [-2, -2]], '#808c7b');
    ctx.polygon([[-6, -8], [3, -11], [15, -3], [11, 1], [-12, 1]], '#b1ad8e');
    ctx.ox = ctx.oy = ctx.rotation = 0;
    ctx.localScale = 1;
}

export function person(ctx: RenderCtx, n: DeepReadonly<Person>) {
    if (n.id === 'cleaner') {
        const motion = sampleCleaner(0);
        const pose = cleanerPose(ctx, n, motion, bucketPose(ctx, motion));
        drawCleanerBody(ctx, n, pose, motion);
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
    const step = (progress: number) => ctx.clamp(progress, 0, 1);
    const frontOut = step(motion.approach * 2);
    const rearOut = step(motion.approach * 2 - 1);
    const rearBack = step(motion.retreat * 2);
    const frontBack = step(motion.retreat * 2 - 1);
    const frontX = mix(mix(n.x + toward * 11, targetX + toward * 13, frontOut), n.x + toward * 11, frontBack);
    const rearX = mix(mix(n.x - toward * 11, targetX - toward * 13, rearOut), n.x - toward * 11, rearBack);
    const frontLift = Math.max(Math.sin(frontOut * Math.PI) * (1 - motion.retreat), Math.sin(frontBack * Math.PI));
    const rearLift = Math.max(Math.sin(rearOut * Math.PI) * (1 - motion.retreat), Math.sin(rearBack * Math.PI));
    const frontFoot: Vector = [frontX, footY - frontLift * 9];
    const rearFoot: Vector = [rearX, footY - rearLift * 9];
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
    const bucketHand: Vector = [mix(restHand[0], bucket.frontGrip[0], motion.grip), mix(restHand[1], bucket.frontGrip[1], motion.grip)];
    const mopHand = mopHandle(ctx, n, motion.mopFall);
    return {
        hip: [hipX, hipY], shoulder, facing: mix(1, toward, motion.turn),
        frontLeg: { root: frontHip, joint: kneeBetween(frontHip, frontFoot, toward), end: frontFoot },
        rearLeg: { root: rearHip, joint: kneeBetween(rearHip, rearFoot, toward), end: rearFoot },
        frontArm: armPose([shoulder[0] + 7, shoulder[1] + 8], bucketHand, mopHand, motion.mopGrip, toward),
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

function drawCleanerBody(ctx: RenderCtx, n: DeepReadonly<Person>, pose: CleanerPose, motion: CleanerControls) {
    ctx.ellipse(pose.hip[0], ctx.F - 17, 28, 2.5, '#515c6d62');
    cleanerMop(ctx, n, motion.mopFall);
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

function drawBucket(ctx: RenderCtx, bucket: BucketPose) {
    // The water left inside drains as the bucket empties.
    const left = ctx.cleaning.spilled ? 1 - ctx.clamp(ctx.state.bucketAge / 1.2, 0, 1) : 1;
    ctx.ox = bucket.origin[0];
    ctx.oy = bucket.origin[1];
    ctx.rotation = bucket.angle;
    ctx.polygon([[-23, -50], [20, -50], [15, -7], [-18, -7]], '#c0a775');
    ctx.ellipse(-2, -50, 22, 6, '#4f5a50');
    if (left > 0) ctx.ellipse(-2, -50 + (1 - left) * 2, 21 * (.55 + .45 * left), 5 * (.5 + .5 * left), '#647260');
    ctx.rod(-24, -46, -19, -66, 3, '#7d8790');
    ctx.rod(-19, -66, 18, -66, 3, '#7d8790');
    ctx.rod(18, -66, 23, -46, 3, '#7d8790');
    ctx.rect(-21, -7, 41, 7, '#8d8b74');
    ctx.ellipse(-15, 2, 5, 5, '#555f66');
    ctx.ellipse(15, 2, 5, 5, '#555f66');
    ctx.rect(-11, -36, 19, 13, '#eee1b5');
    ctx.ox = ctx.oy = ctx.rotation = 0;
}

export function cleaningDraw(ctx: RenderCtx, cleaner?: DeepReadonly<Person>) {
    const F = ctx.F;
    const cleaning = ctx.cleaning;
    const state = ctx.state;
    const p = ctx.p;
    const motion = sampleCleaner(cleaning.spilled ? state.bucketAge : 0);
    const bucket = bucketPose(ctx, motion);
    const pose = cleaner ? cleanerPose(ctx, cleaner, motion, bucket) : undefined;
    const puddle = puddleShape(ctx);
    if (puddle) {
        drawPuddle(ctx, puddle, () => {
            if (cleaner && pose) drawCleanerBody(ctx, cleaner, pose, motion);
            drawBucket(ctx, bucket);
            if (pose) drawArm(ctx, pose.frontArm, true);
            if (Math.abs(p.x - puddle.cx) < puddle.rx + 70 && p.y > F - 140) player(ctx);
        });
        if (state.slip) {
            ctx.rod(p.x - 95, F - 2, p.x - 30, F - 2, 3, '#5e716c');
            ctx.rod(p.x - 82, F + 4, p.x - 18, F + 4, 2, '#61736e');
        }
    }
    const tip = Math.abs(bucket.angle) / 1.25;
    ctx.ellipse(cleaning.x + cleaning.splashDir * tip * 20, F + 1, 28 + tip * 5, 3, '#515c6d48');
    if (cleaner && pose) drawCleanerBody(ctx, cleaner, pose, motion);
    drawBucket(ctx, bucket);
    if (pose) drawArm(ctx, pose.frontArm, true);
    drawPour(ctx);
}
