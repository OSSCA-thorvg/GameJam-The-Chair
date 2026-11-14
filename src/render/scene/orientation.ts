import { ROBOT_GONE, STAGE_TWO, obstacleX, type Obstacle } from '../../game/stages/building/data';
import type { RenderCtx } from '../context';

// The orientation ride: office junk on the floor the empty chairs hop over first, showing the rookie when to jump.
const FLOOR = 420;
const { obstacles } = STAGE_TWO.orientation;

// How far above the floor an empty chair at `x` hops while passing an obstacle.
export function obstacleHop(x: number, robotX: number) {
    for (const obstacle of obstacles) {
        if (obstacle.kind === 'robot' && robotX === ROBOT_GONE) continue;
        const span = obstacle.width + 110;
        const d = x - (obstacleX(obstacle, robotX) - span / 2);
        if (d > 0 && d < span) return Math.sin(d / span * Math.PI) * (obstacle.height + 24);
    }
    return 0;
}

export function orientationFloor(ctx: RenderCtx) {
    const robotX = ctx.state.corridor.robot;
    for (const obstacle of obstacles) {
        if (obstacle.kind === 'robot' && robotX === ROBOT_GONE) continue;
        const x = obstacleX(obstacle, robotX);
        if (x < ctx.cam - 160 || x > ctx.cam + ctx.VW + 160) continue;
        DRAW[obstacle.kind](ctx, x, obstacle);
    }
}

const DRAW: Record<Obstacle['kind'], (ctx: RenderCtx, x: number, obstacle: Obstacle) => void> = {
    cable(ctx, x, { width, height }) {
        // A cable snakes out of the wall socket and under a rubber cover.
        ctx.rect(x - 90, 380, 18, 22, '#e6e2d4');
        ctx.ellipse(x - 81, 391, 2, 4, '#5c6266');
        ctx.strokePath([x - 81, 398], [[x - 80, 418, x - 60, 419, x - width / 2, FLOOR - 3]], { width: 4, color: '#2f343b', cap: 'round' });
        const w = width / 2;
        ctx.polygon([[x - w, FLOOR], [x - w + 9, FLOOR - height], [x + w - 9, FLOOR - height], [x + w, FLOOR]], '#3b4048');
        for (let i = -1; i <= 1; i++) ctx.rod(x + i * 9 - 3, FLOOR - height + 3, x + i * 9 + 3, FLOOR - 2, 2, '#f2c14e');
    },
    sign(ctx, x, { height }) {
        // Wet floor: a shimmering puddle under a yellow A-frame sign with a slipping stick figure.
        const shine = .55 + Math.sin(ctx.t * 3) * .25;
        ctx.ellipse(x + 10, FLOOR + 4, 70, 7, ctx.radialFill(x + 10, FLOOR + 4, 70, [[0, '#d9f2f6'], [1, '#9fb8bd']], shine));
        ctx.rod(x - 30 + Math.sin(ctx.t * 2) * 18, FLOOR + 3, x - 14 + Math.sin(ctx.t * 2) * 18, FLOOR + 3, 2, '#ffffffaa');
        const top = FLOOR - height;
        ctx.polygon([[x - 13, FLOOR], [x - 3, top], [x + 3, top], [x + 13, FLOOR]], '#f2c230');
        ctx.polygon([[x - 9, FLOOR - 4], [x - 2, top + 5], [x + 2, top + 5], [x + 9, FLOOR - 4]], '#ffd84a');
        const wobble = Math.sin(ctx.t * 6) * .25;
        ctx.ellipse(x - 1, top + 11, 2.4, 2.4, '#2b2b2b');
        ctx.rod(x - 1, top + 13, x + 2, top + 21, 1.6, '#2b2b2b');
        ctx.rod(x + 2, top + 21, x + 6 + wobble * 8, top + 25, 1.6, '#2b2b2b');
        ctx.rod(x + 2, top + 21, x - 5, top + 24 - wobble * 6, 1.6, '#2b2b2b');
        ctx.rod(x, top + 16, x - 5 - wobble * 6, top + 13, 1.6, '#2b2b2b');
    },
    sleeper(ctx, x, { width, height }) {
        // Three years of overtime in a sleeping bag; it breathes, and the Zzz drift up out of it.
        const breath = 1 + Math.sin(ctx.t * 1.7) * .12;
        const w = width / 2, h = height * breath;
        ctx.effectPath([x - w, FLOOR], [
            [x - w, FLOOR - h, x - w * .3, FLOOR - h * 1.1, x + w * .2, FLOOR - h],
            [x + w * .7, FLOOR - h * .95, x + w, FLOOR - h * .6, x + w, FLOOR],
        ], ctx.gradientFill(x, FLOOR - h, x, FLOOR, [[0, '#4f7fb6'], [1, '#2f5683']]));
        ctx.strokePath([x - w * .7, FLOOR - h * .55], [[x - w * .2, FLOOR - h * .75, x + w * .3, FLOOR - h * .7, x + w * .8, FLOOR - h * .45]], { width: 1.5, color: '#86aee0' });
        ctx.ellipse(x - w - 5, FLOOR - 9, 10, 9, '#f0c8a0');
        ctx.ellipse(x - w - 7, FLOOR - 15, 10, 5, '#3a2c28');
        ctx.rod(x - w - 11, FLOOR - 8, x - w - 5, FLOOR - 8, 1.2, '#5a3f34');
        for (let i = 0; i < 3; i++) {
            const age = (ctx.t * .5 + i / 3) % 1;
            ctx.text('Z', x - w - 2 + age * 26 + i * 4, FLOOR - 26 - age * 46, 11 + age * 9, '#f3f0e6', { outline: { width: 1.4, color: '#4b5a70' }, opacity: Math.min(1, (1 - age) * 2.5) });
        }
        ctx.rect(x + w - 12, FLOOR - 4, 22, 4, '#6f7687');
    },
    robot(ctx, x, { width, height }) {
        // The robot vacuum: a glossy disc with a blinking eye, leaving a clean stripe behind it.
        const r = width / 2;
        ctx.rect(x + r, FLOOR + 2, 160, 3, '#b8c6c2');
        ctx.ellipse(x, FLOOR - 2, r + 2, 4, '#35465633');
        ctx.effectPath([x - r, FLOOR - 3], [
            [x - r, FLOOR - height - 2, x + r, FLOOR - height - 2, x + r, FLOOR - 3],
        ], ctx.radialFill(x - 6, FLOOR - height, r * 1.3, [[0, '#646d78'], [.6, '#2e333b'], [1, '#1a1d22']]));
        ctx.rect(x - r, FLOOR - 5, width, 4, '#8d97a0');
        const blink = Math.sin(ctx.t * 7) > 0;
        ctx.ellipse(x - r + 9, FLOOR - height + 6, 3, 2.4, blink ? '#ff4a3d' : '#7a2420');
        ctx.ellipse(x - r + 9, FLOOR - height + 6, 6, 5, ctx.radialFill(x - r + 9, FLOOR - height + 6, 6, [[0, '#ff4a3d'], [1, '#ff4a3d00']], blink ? .7 : 0));
        ctx.rod(x - r - 4 + Math.sin(ctx.t * 20) * 2, FLOOR - 1, x - r - 10, FLOOR - 4, 1.2, '#9aa4a8');
    },
    strip(ctx, x, { width, height }) {
        // A power strip with plugs, their cords trailing back to the wall.
        const w = width / 2;
        ctx.strokePath([x + w, FLOOR - 4], [[x + w + 30, FLOOR - 2, x + w + 40, FLOOR - 30, x + w + 52, FLOOR - 40]], { width: 3, color: '#2f343b', cap: 'round' });
        ctx.rect(x - w, FLOOR - height, width, height, '#eceae2');
        ctx.rect(x - w, FLOOR - 3, width, 3, '#c8c4b8');
        for (let i = 0; i < 2; i++) {
            const px = x - w + 8 + i * 13;
            ctx.rect(px - 3, FLOOR - height - 7, 6, 7, '#3b4048');
            ctx.strokePath([px, FLOOR - height - 7], [[px, FLOOR - height - 22, px + 20 + i * 12, FLOOR - 10, px + 30 + i * 14, FLOOR - 1]], { width: 2, color: '#3b4048', cap: 'round' });
        }
        ctx.ellipse(x + w - 5, FLOOR - height + 4, 2, 2, Math.sin(ctx.t * 2) > 0 ? '#ff6b4a' : '#9c3a28');
    },
};
