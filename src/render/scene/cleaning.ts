import type { Vector, Curve } from '../types';
import type { DeepReadonly, Person } from '../../game/types';
import type { RenderCtx } from '../context';

export const CLEANER_MOTION_START = 1.55;
export const CLEANER_MOTION_END = 3.55;
const BUCKET_GRIP_TIME = 2.4;
const BUCKET_UPRIGHT_TIME = 2.9;

function easeBetween(value: number, start: number, end: number) {
    const progress = Math.max(0, Math.min(1, (value - start) / (end - start)));
    return progress * progress * (3 - 2 * progress);
}

function bucketAngle(ctx: RenderCtx) {
    const age = ctx.state.bucketAge;
    const fall = Math.max(0, Math.min(1, age / .42));
    const lift = easeBetween(age, BUCKET_GRIP_TIME, BUCKET_UPRIGHT_TIME);
    return ctx.cleaning.splashDir * fall * (1 - lift) * 1.25;
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

function cleanerMop(ctx: RenderCtx, laid = 0) {
    const lerp = (a: number[][], b: number[][]): Vector[] =>
        a.map(([x, y], i) => [x + (b[i][0] - x) * laid, y + (b[i][1] - y) * laid]);
    const handleUp: number[][] = [[18, -86], [22, -88], [79, -4], [74, -2]];
    const handleDown: number[][] = [[-42, -5], [-42, -2], [65, -2], [65, -5]];
    const headUp: number[][] = [[70, -8], [79, -11], [91, -3], [87, 1], [64, 1]];
    const headDown: number[][] = [[62, -5], [71, -8], [86, -3], [82, 1], [56, 1]];
    ctx.polygon(lerp(handleUp, handleDown), '#808c7b');
    ctx.polygon(lerp(headUp, headDown), '#b1ad8e');
}

export function person(ctx: RenderCtx, n: DeepReadonly<Person>) {
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
        case 'cleaner':
            ctx.polygon([[-16, -49], [14, -50], [19, -7], [8, -5], [0, -40], [-7, -6], [-19, -7]], '#536373');
            ctx.polygon([[-20, -8], [-7, -8], [-7, -1], [-26, -1], [-26, -5]], '#3c4753');
            ctx.polygon([[7, -8], [18, -8], [26, -3], [26, -1], [8, -1]], '#3c4753');
            ctx.polygon([[-17, -99], [-2, -107], [17, -102], [24, -86], [14, -78], [16, -47], [-17, -45], [-22, -78], [-27, -85]], '#79909f');
            ctx.polygon([[-17, -99], [-8, -104], [-7, -48], [-17, -45], [-22, -78], [-27, -85]], '#899eaa');
            cleanerHead(ctx);
            cleanerMop(ctx);
            ctx.polygon([[17, -81], [26, -66], [38, -70], [42, -64], [26, -55], [19, -57], [9, -73]], '#e0be9c');
            ctx.polygon([[10, -78], [20, -85], [24, -78], [14, -70]], '#a9b8c0');
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

export function recoveringCleaner(ctx: RenderCtx, n: DeepReadonly<Person>) {
    const TAU = ctx.TAU;
    const F = ctx.F;
    const cleaning = ctx.cleaning;
    const age = ctx.state.bucketAge;
    const side = cleaning.splashDir;
    const start = side < 0 ? CLEANER_MOTION_START : 1.78;
    const end = side < 0 ? CLEANER_MOTION_END : 3.4;
    const returnTime = BUCKET_UPRIGHT_TIME;
    const bend = easeBetween(age, 2.05, BUCKET_GRIP_TIME) *
        (1 - easeBetween(age, BUCKET_GRIP_TIME, BUCKET_UPRIGHT_TIME));
    const lift = easeBetween(age, BUCKET_GRIP_TIME, BUCKET_UPRIGHT_TIME);
    const crossing = side < 0;
    const frontStep = crossing
        ? (easeBetween(age, start, 1.83) + easeBetween(age, 1.99, 2.19)) / 2
        : easeBetween(age, start, 2.16);
    const rearStep = crossing
        ? (easeBetween(age, 1.74, 2.02) + easeBetween(age, 2.11, 2.32)) / 2
        : easeBetween(age, start + .19, 2.32);
    const frontBack = crossing
        ? (easeBetween(age, 3.02, 3.23) + easeBetween(age, 3.34, end)) / 2
        : easeBetween(age, returnTime + .09, end);
    const rearBack = crossing
        ? (easeBetween(age, returnTime, 3.09) + easeBetween(age, 3.21, 3.44)) / 2
        : easeBetween(age, returnTime, end - .09);
    const frontStance = frontStep * (1 - frontBack);
    const rearStance = rearStep * (1 - rearBack);
    const stance = (frontStance + rearStance) / 2;

    const footY = F - 17;
    const distance = cleaning.x + (side > 0 ? 91 : -80) - n.x;
    const step = distance * stance;
    const hipX = n.x + step;
    const hipY = footY - 42 + 11 * bend;
    const shoulderX = hipX - side * (26 * bend + 42 * lift * stance);
    const shoulderY = hipY - 46 + 8 * bend;
    const walkingFrontFootX = n.x - 13 + (distance - 14) * frontStance;
    const walkingRearFootX = n.x + 13 + (distance + 11) * rearStance;
    const frontFootX = walkingFrontFootX + (hipX - 13 - walkingFrontFootX) * bend;
    const rearFootX = walkingRearFootX + (hipX + 13 - walkingRearFootX) * bend;
    const footfall = crossing ? TAU : Math.PI;
    const footLift = (out: number, back: number) =>
        5 * (Math.abs(Math.sin(footfall * out)) + Math.abs(Math.sin(footfall * back)));
    const frontFootY = footY - 3 - footLift(frontStep, frontBack);
    const rearFootY = footY - 3 - footLift(rearStep, rearBack);
    const frontKneeX = frontFootX + 4 - 3 * bend;
    const rearKneeX = rearFootX - 4 - 5 * bend;
    const kneeY = footY - 23 + 5 * bend;

    ctx.ellipse(hipX, footY, 27 + 7 * stance, 2.5, '#515c6d62');
    const mopLaid = easeBetween(age, CLEANER_MOTION_START, 1.8) *
        (1 - easeBetween(age, 3.25, CLEANER_MOTION_END));
    ctx.ox = n.x;
    ctx.oy = footY;
    ctx.localScale = .85;
    cleanerMop(ctx, mopLaid);
    ctx.ox = ctx.oy = 0;
    ctx.localScale = 1;

    ctx.rod(hipX + 7, hipY, rearKneeX, kneeY, 10, '#485867');
    ctx.rod(rearKneeX, kneeY, rearFootX, rearFootY, 8, '#485867');
    ctx.ellipse(rearKneeX, kneeY, 4, 4, '#485867');
    ctx.polygon([[rearFootX - 4, rearFootY - 3], [rearFootX + 4, rearFootY - 3],
        [rearFootX + 9, rearFootY + 2], [rearFootX - 7, rearFootY + 2]], '#3c4753');
    ctx.rod(hipX - 7, hipY, frontKneeX, kneeY, 11, '#536373');
    ctx.rod(frontKneeX, kneeY, frontFootX, frontFootY, 9, '#536373');
    ctx.ellipse(frontKneeX, kneeY, 4.5, 4.5, '#536373');
    ctx.polygon([[frontFootX - 4, frontFootY - 3], [frontFootX + 4, frontFootY - 3],
        [frontFootX + 5, frontFootY + 2], [frontFootX - 10, frontFootY + 2]], '#3c4753');

    ctx.polygon([[shoulderX - 13, shoulderY], [shoulderX + 11, shoulderY - 4],
        [hipX + 12, hipY + 3], [hipX - 12, hipY + 5],
        [shoulderX - 16, shoulderY + 12]], '#79909f');
    ctx.polygon([[shoulderX - 13, shoulderY], [shoulderX - 6, shoulderY - 1],
        [hipX - 5, hipY + 4], [hipX - 12, hipY + 5],
        [shoulderX - 16, shoulderY + 12]], '#899eaa');

    const angle = bucketAngle(ctx);
    const handleX = side * (-18 + 36 * lift);
    const gripX = cleaning.x + handleX * Math.cos(angle) + 66 * Math.sin(angle);
    const gripY = F - 3 + handleX * Math.sin(angle) - 66 * Math.cos(angle);
    const reach = easeBetween(age, 2.13, BUCKET_GRIP_TIME) * (1 - easeBetween(age, BUCKET_UPRIGHT_TIME, 3.07));
    const restX = n.x + 32 + step;
    const restY = footY - 55;
    const handX = restX + (gripX - restX) * reach;
    const handY = restY + (gripY - restY) * reach;
    const sleeveX = shoulderX + 7 - (7 + 5 * side) * reach;
    const sleeveY = shoulderY + 9;
    const elbowX = sleeveX + (handX - sleeveX) * .46 + 7 * side * reach;
    const elbowY = sleeveY + (handY - sleeveY) * .53 + 6;
    ctx.rod(sleeveX, sleeveY, elbowX, elbowY, 9, '#79909f');
    ctx.ellipse(elbowX, elbowY, 5, 4, '#a5b3b9');
    ctx.rod(elbowX, elbowY, handX, handY, 6, '#e0be9c');
    ctx.ellipse(handX, handY, 4, 3.4, '#e0be9c');

    const turnBack = side < 0 ? 1.99 : 3.16;
    const turn = easeBetween(age, start, start + .17) *
        (1 - easeBetween(age, turnBack, turnBack + .22));
    ctx.ox = shoulderX - 8 * side * stance;
    ctx.oy = shoulderY + 87;
    ctx.localScale = .85;
    cleanerHead(ctx, 0, 0, 1 - 2 * turn);
    ctx.ox = ctx.oy = 0;
    ctx.localScale = 1;
}

export function cleaningDraw(ctx: RenderCtx) {
    const F = ctx.F;
    const cleaning = ctx.cleaning;
    const state = ctx.state;
    const p = ctx.p;
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
    const angle = bucketAngle(ctx);
    const tip = Math.abs(angle) / 1.25;
    const side = cleaning.splashDir;
    ctx.ellipse(cleaning.x + side * tip * 20, F + 1, 28 + tip * 5, 3, '#515c6d48');
    ctx.ox = cleaning.x;
    ctx.oy = F - 3;
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
