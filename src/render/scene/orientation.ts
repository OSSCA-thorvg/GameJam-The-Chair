import { STAGE_TWO, type Obstacle } from '../../game/stages/building/data';
import type { RenderCtx } from '../context';

// The orientation ride: power cables and colleagues asleep on the floor. The empty chairs hop each one
// first, showing the rookie when to jump.
const FLOOR = 420;
const { obstacles } = STAGE_TWO.orientation;
// Sleeping bag, hair and skin per sleeper, so a row of them reads as different colleagues.
const SLEEPERS = [
    { bag: ['#4f7fb6', '#2f5683'], seam: '#86aee0', hair: '#3a2c28', skin: '#f0c8a0' },
    { bag: ['#c0623f', '#8c3f27'], seam: '#e79a78', hair: '#1f1c1c', skin: '#e2b48a' },
    { bag: ['#5f8a4f', '#3d6233'], seam: '#9cc48a', hair: '#7a4a2a', skin: '#f3d2b0' },
    { bag: ['#7a5fa4', '#523c78'], seam: '#b39ad8', hair: '#b9b4ab', skin: '#eac09a' },
];

// How far above the floor an empty chair at `x` hops while passing an obstacle.
export function obstacleHop(x: number) {
    for (const obstacle of obstacles) {
        const span = obstacle.width + 110;
        const d = x - (obstacle.x - span / 2);
        if (d > 0 && d < span) return Math.sin(d / span * Math.PI) * (obstacle.height + 24);
    }
    return 0;
}

export function orientationFloor(ctx: RenderCtx) {
    let sleeper = 0;
    for (const obstacle of obstacles) {
        if (obstacle.kind === 'sleeper') sleeper++;
        if (obstacle.x < ctx.cam - 160 || obstacle.x > ctx.cam + ctx.VW + 160) continue;
        if (obstacle.kind === 'cable') cable(ctx, obstacle);
        else sleepingColleague(ctx, obstacle, SLEEPERS[(sleeper - 1) % SLEEPERS.length], sleeper);
    }
}

// A cable snakes out of a wall socket and under a rubber cover.
function cable(ctx: RenderCtx, { x, width, height }: Obstacle) {
    ctx.rect(x - 90, 380, 18, 22, '#e6e2d4');
    ctx.ellipse(x - 84, 391, 1.6, 3.5, '#5c6266');
    ctx.ellipse(x - 78, 391, 1.6, 3.5, '#5c6266');
    ctx.strokePath([x - 81, 398], [[x - 80, 418, x - 60, 419, x - width / 2, FLOOR - 3]], { width: 4, color: '#2f343b', cap: 'round' });
    const w = width / 2;
    ctx.polygon([[x - w, FLOOR], [x - w + 9, FLOOR - height], [x + w - 9, FLOOR - height], [x + w, FLOOR]], '#3b4048');
    for (let i = -1; i <= 1; i++) ctx.rod(x + i * 9 - 3, FLOOR - height + 3, x + i * 9 + 3, FLOOR - 2, 2, '#f2c14e');
}

// Overtime in a sleeping bag: it breathes, and the Zzz drift up out of it.
function sleepingColleague(ctx: RenderCtx, { x, width, height }: Obstacle, look: typeof SLEEPERS[number], seed: number) {
    const breath = 1 + Math.sin(ctx.t * 1.7 + seed * 1.3) * .12;
    const w = width / 2, h = height * breath;
    ctx.effectPath([x - w, FLOOR], [
        [x - w, FLOOR - h, x - w * .3, FLOOR - h * 1.1, x + w * .2, FLOOR - h],
        [x + w * .7, FLOOR - h * .95, x + w, FLOOR - h * .6, x + w, FLOOR],
    ], ctx.gradientFill(x, FLOOR - h, x, FLOOR, [[0, look.bag[0]], [1, look.bag[1]]]));
    ctx.strokePath([x - w * .7, FLOOR - h * .55], [[x - w * .2, FLOOR - h * .75, x + w * .3, FLOOR - h * .7, x + w * .8, FLOOR - h * .45]], { width: 1.5, color: look.seam });
    ctx.ellipse(x - w - 5, FLOOR - 9, 10, 9, look.skin);
    ctx.ellipse(x - w - 7, FLOOR - 15, 10, 5, look.hair);
    ctx.rod(x - w - 11, FLOOR - 8, x - w - 5, FLOOR - 8, 1.2, '#5a3f34');
    for (let i = 0; i < 3; i++) {
        const age = (ctx.t * .5 + i / 3 + seed * .17) % 1;
        ctx.text('Z', x - w - 2 + age * 26 + i * 4, FLOOR - 26 - age * 46, 11 + age * 9, '#f3f0e6', { outline: { width: 1.4, color: '#4b5a70' }, opacity: Math.min(1, (1 - age) * 2.5) });
    }
    ctx.rect(x + w - 12, FLOOR - 4, 22, 4, '#6f7687');
}
