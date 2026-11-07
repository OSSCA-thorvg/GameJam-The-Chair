import { STAGE_TWO } from '../../game/stage2';
import type { RenderCtx } from '../context';
import { practiceFloor, checkpointFlag } from './decor';
import { player } from './player';

export function drawBuilding(ctx: RenderCtx) {
    const F = ctx.F;
    const C = ctx.C;
    const VW = ctx.VW;
    const H = ctx.H;
    const scale = ctx.scale;
    const cam = ctx.cam;
    const vertical = ctx.vertical;
    const state = ctx.state;
    const solids = ctx.solids;
    const p = ctx.p;
    const GOAL = ctx.GOAL;

    ctx.commands = [];
    ctx.ox = ctx.oy = ctx.rotation = 0;
    ctx.rect(cam, -vertical, VW, H / scale, '#a9afbc');
    ctx.rect(cam, -vertical, VW, 57 + vertical, '#747d91');
    ctx.rod(cam, 57, cam + VW, 57, 4, '#d1d1c6');
    for (let x = Math.floor(cam / 235) * 235; x < cam + VW + 235; x += 235) {
        ctx.rect(x + 17, 80, 197, 193, '#69788c');
        ctx.rect(x + 24, 87, 183, 179, '#9aa9b2');
        ctx.rod(x + 113, 87, x + 113, 267, 4, '#69788c');
        ctx.rect(x + 43, 27, 145, 7, '#f1e9cf');
    }
    ctx.rect(cam, 287, VW, 250, '#a0a7b1');
    ctx.rod(cam, 315, cam + VW, 315, 2, '#8c94a1');
    for (const [x, title] of [[190, '회의실 / MEETING'], [1180, '비상계단 / STAIRS'], [2050, '비품 창고 / STORAGE'], [2820, '승강로 / LIFT']] as const) {
        ctx.rect(x - 85, 110, 210, 32, '#687e7c');
        ctx.label(title, x + 20, 131, 13, '#f0eddc');
    }
    ctx.rect(120, 300, 400, 12, '#b8a283');
    for (const x of [150, 465]) ctx.rod(x, 312, x, 420, 7, '#697585');
    for (let x = 150; x < 500; x += 110) {
        ctx.rect(x, 278, 50, 22, '#596577');
        ctx.rect(x + 5, 282, 40, 13, '#a8b9c3');
    }
    for (const ob of solids) ctx.polygon(ob.p.map(v => [v.x, v.y]), C.floor);
    for (const item of state.furniture) {
        const x = item.x, y = item.y;
        if (item.kind === 'cabinet') {
            ctx.rect(x - 50, y - 55, 100, 48, '#c6c9bf');
            for (let i = 0; i < 2; i++) {
                ctx.rect(x - 45, y - 50 + i * 23, 90, 20, '#afb8b2');
                ctx.rect(x - 9, y - 45 + i * 23, 18, 3, '#6c7d83');
            }
        } else {
            ctx.rod(x - 18, y - 37, x - 22, y - 90, 6, '#515665');
            ctx.rect(x - 30, y - 90, 18, 48, '#6f7687');
            ctx.rect(x - 24, y - 40, 48, 8, '#6f7687');
            ctx.rod(x, y - 32, x, y - 10, 5, C.steel);
            ctx.rod(x - 22, y - 8, x + 22, y - 8, 4, C.steel);
        }
        ctx.ellipse(x - item.width / 2 + 8, y - 5, 5, 5, '#3f4650');
        ctx.ellipse(x + item.width / 2 - 8, y - 5, 5, 5, '#3f4650');
    }
    const door = state.door;
    ctx.rect(door.x - 58, 210, 116, 210, '#7d91937f');
    ctx.rod(door.x - 59, 210, door.x - 59, 420, 6, '#596879');
    ctx.rod(door.x + 59, 210, door.x + 59, 420, 6, '#596879');
    ctx.rod(door.x, 220, door.x, 418, 5, '#596879');
    const reach = Math.cos(door.angle) * 52;
    ctx.polygon([[door.x, 230], [door.x + reach, 242], [door.x + reach, 405], [door.x, 418]], '#c5dcd4b0');
    ctx.polygon([[door.x, 230], [door.x - reach, 242], [door.x - reach, 405], [door.x, 418]], '#8faeb0b0');
    ctx.ellipse(door.x, 192, 7, 7, door.open ? '#b8d6a2' : '#e0b477');
    ctx.label(door.open ? '→' : '↻', door.x, 177, 24, '#f0eddc');
    for (const x of [door.x - 100, door.x - 76]) {
        ctx.ellipse(x, F + 4, 8, 3, '#d1c8a5');
        ctx.rod(x - 8, F + 12, x + 8, F + 12, 2, '#778783');
    }
    if (door.open) {
        ctx.polygon([[door.x - 14, F + 12], [door.x + 6, F + 12], [door.x + 6, F + 6], [door.x + 19, F + 16], [door.x + 6, F + 26], [door.x + 6, F + 20], [door.x - 14, F + 20]], '#d8dfbf');
    } else {
        ctx.rod(door.x - 28, F + 12, door.x + 28, F + 12, 5, '#d5be92');
        ctx.rod(door.x - 28, F + 20, door.x + 28, F + 20, 3, '#d5be92');
    }
    for (const [a, b, ya, yb] of [[1020, 1400, 420, 500], [1580, 1900, 500, 420]]) {
        ctx.rod(a, ya - 95, b, yb - 95, 5, '#697585');
        for (let x = a; x <= b; x += 70) {
            const y = ya + (yb - ya) * (x - a) / (b - a);
            ctx.rod(x, y - 95, x, y, 3, '#7d8995');
        }
    }
    ctx.rect(2350, 185, 350, 18, '#687783');
    for (let x = 2360; x < 2690; x += 24) ctx.rod(x, 189, x + 12, 198, 3, '#9eafb1');
    ctx.label('→', 2460, 275, 25, '#e6d6a8');
    for (const x of [2700, 3150]) ctx.rod(x, 160, x, 500, 7, '#687783');
    ctx.rod(2700, 322, 3160, 322, 2, '#d7ccb0');
    for (let x = 2700; x < 3160; x += 48) ctx.ellipse(x, 322, 3, 3, '#f0dfb5');
    const lift = state.elevator;
    ctx.rect(lift.x, lift.y, lift.width, lift.height, '#7e9a91');
    for (let x = lift.x + 10; x < lift.x + lift.width; x += 24) ctx.rect(x, lift.y + 2, 12, 4, '#e6d6a8');
    ctx.label('↔', lift.x + lift.width / 2, lift.y - 20, 24, '#e9e3ce');
    for (let x = 2890; x < 3380; x += 95) {
        const y = 500 - (x - 2850) * 190 / 550;
        ctx.rod(x, y - 5, x + 28, y - 15, 4, '#e0d1a4');
    }
    for (let i = 1; i < STAGE_TWO.checkpoints.length; i++) {
        const mark = STAGE_TWO.checkpoints[i];
        checkpointFlag(ctx, mark.x, mark.y + 28, state.checkpoint >= i);
    }
    ctx.rect(GOAL - 35, 105, 106, 205, '#677d7e');
    ctx.rect(GOAL - 27, 113, 90, 190, '#b5c4bf');
    ctx.rect(GOAL - 31, 74, 98, 23, '#718e7b');
    ctx.label('기계실 →', GOAL + 18, 91, 13, '#f0eddc');
    ctx.rod(GOAL + 40, 190, GOAL + 40, 229, 4, '#677d7e');
    practiceFloor(ctx);
    ctx.ellipse(p.x, p.y + 35, 45, 5, '#91959c');
    player(ctx);
}
