import { STAGE_TWO } from '../../game/stages/building/data';
import type { RenderCtx } from '../context';

// The rush-hour corridor: one yellow-black speed bump, then a plank launch ramp in front of a construction
// hole. The empty chairs bounce over the bump and, at express speed, fly off the ramp and over the hole
// together; the rider only flies with them while it rides the convoy.
const FLOOR = 420;
const { bump, pit, ramp, launch } = STAGE_TWO.express;
const EXPRESS_SPEED = 360, GRAVITY = 950;

// How far above the floor an empty chair is drawn at `x`: a bounce over the bump, up the ramp, then the
// same arc the launched rider flies over the hole.
export function chairLift(x: number) {
    const d = x - bump + 20;
    if (d > 0 && d < 70) return Math.sin(d / 70 * Math.PI) * 12;
    if (x >= ramp.start && x < pit.left) return (x - ramp.start) / (pit.left - ramp.start) * ramp.rise;
    if (x >= pit.left) {
        const t = (x - pit.left) / EXPRESS_SPEED;
        return Math.max(0, ramp.rise + launch * t - GRAVITY / 2 * t * t);
    }
    return 0;
}

export function expressFloor(ctx: RenderCtx) {
    const { cam, VW, t } = ctx;
    if (bump > cam - 60 && bump < cam + VW + 60) {
        ctx.polygon([[bump - 26, FLOOR], [bump - 14, FLOOR - 10], [bump + 14, FLOOR - 10], [bump + 26, FLOOR]], '#2c2f36');
        for (let i = -2; i <= 2; i++) ctx.polygon([[bump + i * 9 - 3, FLOOR - 1], [bump + i * 9 + 1, FLOOR - 9], [bump + i * 9 + 5, FLOOR - 9], [bump + i * 9 + 1, FLOOR - 1]], '#f2c14e');
    }
    if (ramp.start > cam + VW + 120 || pit.right < cam - 120) return;

    // The hole: an opening in the floor, darker with depth.
    ctx.gradientPolygon([[pit.left, FLOOR], [pit.right, FLOOR], [pit.right, FLOOR + 400], [pit.left, FLOOR + 400]],
        ctx.gradientFill(0, FLOOR, 0, FLOOR + 260, [[0, '#3b4448'], [.25, '#1c2226'], [1, '#0b0e10']]));
    for (const x of [pit.left, pit.right]) ctx.rect(x - 4, FLOOR, 8, 400, '#5d6b6c');
    const width = pit.right - pit.left;
    for (let i = 1; i < 6; i++) ctx.rod(pit.left + i * width / 6, FLOOR + 70 + (i % 2) * 18, pit.left + i * width / 6 + 14, FLOOR + 160, 2, '#4a3b30');
    ctx.strokePath([pit.left + 20, FLOOR + 30], [[pit.left + 120, FLOOR + 160, pit.right - 140, FLOOR + 40, pit.right - 30, FLOOR + 120]], { width: 3, color: '#20262a', cap: 'round' });

    // The launch ramp: a plank on a sawhorse, its lip springing a little while chairs take off.
    const lip = FLOOR - ramp.rise;
    const spring = Math.sin(t * 24) * (ctx.state.corridor.pace === 'express' ? 1.5 : 0);
    ctx.rod(pit.left - 46, lip + 6, pit.left - 58, FLOOR, 5, '#6b5034');
    ctx.rod(pit.left - 22, lip + 6, pit.left - 10, FLOOR, 5, '#6b5034');
    ctx.rod(pit.left - 52, lip + 22, pit.left - 16, lip + 22, 4, '#6b5034');
    ctx.strokePath([ramp.start - 6, FLOOR], [[ramp.start + 60, FLOOR - 4, pit.left - 50, lip + 3 + spring, pit.left + 4, lip + spring]],
        { width: 10, color: '#8a6a45', cap: 'round' });
    ctx.strokePath([ramp.start, FLOOR - 4], [[ramp.start + 60, FLOOR - 8, pit.left - 50, lip - 1 + spring, pit.left + 2, lip - 4 + spring]],
        { width: 3, color: '#b48a5a', cap: 'round' });
    // Chevrons painted on the plank point the way.
    for (let i = 0; i < 3; i++) {
        const x = ramp.start + 40 + i * 36, y = FLOOR - (x - ramp.start) / (pit.left - ramp.start) * ramp.rise - 5;
        ctx.polygon([[x - 6, y - 4], [x + 4, y], [x - 6, y + 2]], '#f2c14e');
    }

    // Cones and tape on the far edge.
    cone(ctx, pit.right + 34);
    ctx.rod(pit.right + 4, FLOOR - 30, pit.right + 34, FLOOR - 26, 3, '#f2c14e');
}

function cone(ctx: RenderCtx, x: number) {
    ctx.polygon([[x - 13, FLOOR], [x - 4, FLOOR - 36], [x + 4, FLOOR - 36], [x + 13, FLOOR]], '#ef7d32');
    ctx.polygon([[x - 9, FLOOR - 14], [x - 6, FLOOR - 24], [x + 6, FLOOR - 24], [x + 9, FLOOR - 14]], '#f7efe0');
    ctx.rect(x - 17, FLOOR - 3, 34, 3, '#c25e22');
}
