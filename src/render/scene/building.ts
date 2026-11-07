import { translate, type Message } from '../../i18n';
import { STAGE_TWO } from '../../game/stage2';
import type { RenderCtx } from '../context';
import type { Vector } from '../types';
import { practiceFloor, checkpointFlag } from './decor';
import { player } from './player';

function bubble(ctx: RenderCtx, text: Message, x: number, y: number, width: number, spiky = false, alpha = 1) {
    const fill = ctx.tint(spiky ? '#fff1b2' : '#f7f4e9', alpha);
    if (spiky) {
        const points: Vector[] = [];
        for (let i = 0; i < 32; i++) {
            const a = i / 32 * Math.PI * 2, r = i % 2 ? .84 : 1;
            points.push([x + Math.cos(a) * width / 2 * r, y + Math.sin(a) * 32 * r]);
        }
        ctx.polygon(points, fill);
    } else {
        ctx.effectPath([x - width / 2 + 12, y - 22], [
            [x + width / 2, y - 22, x + width / 2, y - 22, x + width / 2, y - 10],
            [x + width / 2, y + 22, x + width / 2, y + 22, x + width / 2 - 12, y + 22],
            [x - width / 2, y + 22, x - width / 2, y + 22, x - width / 2, y + 10],
            [x - width / 2, y - 22, x - width / 2, y - 22, x - width / 2 + 12, y - 22],
        ], ctx.gradientFill(x, y - 22, x, y + 22, [[0, '#ffffff'], [1, '#e2e8df']], alpha));
    }
    ctx.polygon([[x - 8, y + 20], [x + 9, y + 20], [x - 10, y + 36]], fill);
    ctx.label(translate(text, ctx.locale), x, y + 5, 13, ctx.tint('#344955', alpha));
}
function worker(ctx: RenderCtx, x: number, y: number, reach = 0, facing = 1) {
    const sway = Math.sin(ctx.t * 3) * Math.abs(reach) * 2;
    ctx.rod(x - 8, y - 45, x - 12 - sway, y - 3, 10, '#445567');
    ctx.rod(x + 7, y - 45, x + 12 + sway, y - 3, 10, '#445567');
    ctx.rect(x - 20, y - 5, 19, 5, '#303d4a');
    ctx.rect(x + 4, y - 5, 20, 5, '#303d4a');
    ctx.polygon([[x - 14, y - 87], [x + 12, y - 87], [x + 17, y - 43], [x - 17, y - 43]], '#eee9d8');
    ctx.rod(x + facing * 8, y - 77, x + facing * (18 + reach * 14), y - 62, 8, '#e8e0cb');
    ctx.rod(x + facing * (18 + reach * 14), y - 62, x + facing * (17 + reach * 32), y - 49 - reach * 12, 7, '#d5b390');
    ctx.ellipse(x, y - 104, 13, 17, '#d9b896');
    ctx.polygon([[x - 13, y - 107], [x - 11, y - 122], [x + 9, y - 122], [x + 15, y - 110]], '#384352');
    ctx.rod(x - 10, y - 105, x + 10, y - 105, 2, '#485566');
    ctx.rod(x, y - 85, x + 4, y - 58, 4, '#ac725f');
}
function chair(ctx: RenderCtx, x: number, y: number) {
    ctx.ellipse(x, y + 3, 37, 5, '#35465622');
    ctx.rod(x - 18, y - 37, x - 22, y - 90, 6, '#515665');
    ctx.rect(x - 30, y - 90, 18, 48, '#6f7687');
    ctx.rect(x - 24, y - 40, 48, 8, '#6f7687');
    ctx.rod(x, y - 32, x, y - 10, 5, '#a5b1b7');
    ctx.rod(x - 22, y - 8, x + 22, y - 8, 4, '#81959d');
    for (const side of [-1, 1]) {
        ctx.ellipse(x + side * 17, y - 5, 5, 5, '#3f4650');
        ctx.rod(x + side * 17, y - 5, x + side * 17 + Math.cos(ctx.t * 9) * 3, y - 5 + Math.sin(ctx.t * 9) * 3, 1, '#b6c5c7');
    }
}
function pictogram(ctx: RenderCtx, x: number, kind: 'exit' | 'lift') {
    ctx.rect(x - 36, 120, 72, 43, '#557f78');
    ctx.rect(x - 23, 127, 19, 29, '#d5e6da');
    ctx.rect(x - 19, 132, 11, 24, '#557f78');
    if (kind === 'exit') {
        ctx.rod(x + 3, 141, x + 26, 141, 4, '#e2eee0');
        ctx.polygon([[x + 18, 132], [x + 29, 141], [x + 18, 150]], '#e2eee0');
    } else {
        ctx.ellipse(x - 13, 137, 3, 3, '#e2eee0');
        ctx.rod(x - 13, 141, x - 13, 152, 3, '#e2eee0');
        ctx.polygon([[x + 5, 137], [x + 13, 127], [x + 21, 137]], '#e2eee0');
        ctx.polygon([[x + 5, 146], [x + 13, 156], [x + 21, 146]], '#e2eee0');
    }
}
function room(ctx: RenderCtx) {
    const scene = ctx.state.corridor.room;
    if (scene.kind !== 'meeting') return;
    const x = STAGE_TWO.meeting;
    ctx.rect(ctx.cam, 60, ctx.VW, 360, '#c3c8bd');
    ctx.rect(x - 220, 100, 420, 145, '#617975');
    ctx.rect(x - 208, 112, 396, 121, '#f0ecd9');
    ctx.label(translate('Meeting: when should this meeting end?', ctx.locale), x - 10, 148, 16, '#48605d');
    for (let i = 0; i < 3; i++) {
        ctx.rod(x - 180, 177 + i * 16, x + 65 - i * 32, 177 + i * 16, 3, '#9ba9a0');
    }
    for (const dx of [-210, -10, 155]) worker(ctx, x + dx, 397, scene.age > 3 ? .8 : .2, dx > 0 ? -1 : 1);
    ctx.rect(x - 190, 330, 370, 15, '#ab9274');
    ctx.rod(x - 170, 345, x - 170, 420, 8, '#657b7b');
    ctx.rod(x + 160, 345, x + 160, 420, 8, '#657b7b');
    for (const dx of [-110, 0, 110]) {
        ctx.ripple(x + dx, 404, 28, 10, 2, '#f0e8c0');
        ctx.label('···', x + dx, 405, 18, '#7c8d85');
    }
    const pushing = Math.max(0, scene.age - 4.6) * 100;
    worker(ctx, x - 156 + pushing, 420, scene.age > 4.6 ? 1 : .1);
    const line: Message = scene.age < 2.4 ? 'The chairs have gone home.' : scene.age < 3.5 ? 'People, please stay for the next agenda.' : 'Oh, one more chair! You may leave!';
    bubble(ctx, line, x, 75, 440);
    player(ctx);
}
export function drawBuilding(ctx: RenderCtx) {
    const { state, cam, VW } = ctx;
    const c = state.corridor;
    ctx.commands = [];
    ctx.ox = ctx.oy = ctx.rotation = 0;
    ctx.localScale = 1;
    ctx.gradientPolygon([[cam, -ctx.vertical], [cam + VW, -ctx.vertical], [cam + VW, 420], [cam, 420]],
        ctx.gradientFill(cam, 0, cam, 420, [[0, '#a3b3b8'], [.55, '#d2d7ce'], [1, '#b1bfbc']]));
    ctx.rect(cam, -ctx.vertical, VW, 57 + ctx.vertical, '#586e79');
    for (let x = Math.floor(cam / 240) * 240; x < cam + VW + 240; x += 240) {
        ctx.rect(x + 30, 29, 150, 7, '#f7efd6');
        ctx.gradientPolygon([[x + 30, 37], [x + 180, 37], [x + 240, 420], [x - 30, 420]],
            ctx.gradientFill(x, 37, x, 420, [[0, '#ffefc9'], [1, '#ffefc9']], .09));
        ctx.rod(x, 60, x, 420, 1, '#91a4a7');
    }
    ctx.rect(cam, 420, VW, ctx.H / ctx.scale, '#929f9d');
    ctx.rod(cam, 422, cam + VW, 422, 4, '#586f75');
    for (let x = Math.floor(cam / 120) * 120; x < cam + VW; x += 120) ctx.rod(x, 428, x + 100, 520, 1, '#a7b2aa');
    if (c.room.kind === 'meeting') { room(ctx); return; }
    for (const office of c.offices) {
        const x = office.x;
        ctx.rect(x - 110, 174, 220, 181, '#617983');
        for (const dx of [-60, 50]) {
            ctx.rect(x + dx - 35, 265, 66, 7, '#87958f');
            ctx.ellipse(x + dx - 8, 227, 10, 13, '#566c75');
            ctx.rect(x + dx - 19, 240, 21, 26, '#566c75');
            ctx.rect(x + dx + 5, 234, 26, 21, '#c5ddd6');
            ctx.rod(x + dx - 4, 250, x + dx + 9 + Math.sin(ctx.t * 16) * 2, 262, 4, '#78918f');
        }
        ctx.rect(x - 105, 180, 210, 170, '#c9e8e233');
        ctx.rod(x, 175, x, 355, 5, '#849a9e');
        ctx.polygon([[x - 98, 184], [x - 75, 184], [x + 55, 347], [x + 32, 347]], '#edf4e719');
        if (office.life > 0) bubble(ctx, 'tap… tap…', x, 166, 146, false, Math.min(.78, office.life * 2));
    }
    const mx = STAGE_TWO.meeting;
    ctx.rect(mx - 78, 180, 156, 240, '#687f80');
    ctx.rect(mx - 70, 187, 140, 232, '#91a29b');
    const opening = Math.min(1, c.dispatchAge / .5);
    ctx.rect(mx - 64 + opening * 112, 190, 126 * (1 - opening), 225, '#d8d6bf');
    ctx.rect(mx - 70, 147, 140, 25, '#e1d7bb');
    ctx.label(translate('Meeting extended', ctx.locale), mx, 164, 13, '#4f6268');
    const pushPhase = c.dispatchStarted && c.dispatchAge < 3.5 ? Math.sin(Math.max(0, c.dispatchAge - .35) * Math.PI / .9) ** 2 : 0;
    worker(ctx, mx - 57 + pushPhase * 22, 420, pushPhase);
    if (c.dispatchStarted && c.dispatchAge < 1.5) bubble(ctx, 'Meeting extended. Chairs may leave.', mx + 40, 103, 310);
    state.furniture.forEach((item, i) => {
        if (!item.released) return;
        chair(ctx, item.x, item.y);
        if (item.cheer > 0) bubble(ctx, (['Woohoo! Freedom!', 'Clocking out!', 'Bye-bye, overtime!'] satisfies Message[])[i], item.x, 285 - (i % 2) * 60, 185, true, Math.min(1, item.cheer * 2));
    });
    if (state.canEnterMeeting) {
        ctx.label('↑', mx + 92, 306 + Math.sin(ctx.t * 4) * 5, 28, '#fff2bd');
    }
    const sx = STAGE_TWO.scanner;
    ctx.rect(sx - 200, 426, 153, 30, '#ded5a3');
    ctx.label(c.scanner.approved ? '✓' : 'Ⅱ', sx - 123, 448, 23, '#667f70');
    ctx.rect(sx - 10, 278, 30, 142, '#687f82');
    ctx.rect(sx - 6, 286, 22, 43, '#344e5d');
    ctx.ellipse(sx + 5, 297, 5, 5, c.scanner.approved ? '#bce2b2' : '#ebbc79');
    ctx.rect(sx - 4, 317, 18 * c.scanner.progress, 5, '#c7e2ba');
    ctx.rod(sx + 5, 349, sx + 5 - Math.cos(c.scanner.approved ? Math.PI / 2 : 0) * 65, 349 - (c.scanner.approved ? 65 : 0), 8, '#dfd5ae');
    if (Math.abs(ctx.p.x - sx) < 240) bubble(ctx, c.scanner.approved ? 'Employee undetected. One chair approved.' : 'Release the arrows. Hold still.', sx - 70, 215, 320);
    const lx = STAGE_TWO.lift;
    ctx.rect(lx - 115, 175, 230, 245, '#536b77');
    ctx.rect(lx - 105, 185, 210, 235, '#354d5b');
    const aperture = c.lift.kind === 'open' ? Math.min(1, c.lift.age * 3) : 0;
    for (const side of [-1, 1]) {
        const left = side < 0 ? lx - 100 : lx + aperture * 99;
        ctx.gradientPolygon([[left, 190], [left + (1 - aperture) * 99, 190], [left + (1 - aperture) * 99, 419], [left, 419]],
            ctx.gradientFill(left, 0, left + 99, 0, [[0, '#9eb1b2'], [.5, '#c2ceca'], [1, '#879da3']]));
    }
    pictogram(ctx, lx, 'lift');
    if (c.lift.kind === 'arriving') {
        ctx.ellipse(lx + 138, 277, 7, 7, Math.sin(ctx.t * 8) > 0 ? '#f2d191' : '#aa9475');
        ctx.polygon([[lx - 130, 437], [lx - 105, 428], [lx - 105, 446]], '#eed39a');
    }
    if (c.cart) {
        const x = c.cart.x;
        ctx.rod(x - 50, 412, x + 50, 412, 5, '#546a77');
        ctx.rod(x + 46, 412, x + 46, 354, 5, '#546a77');
        for (let i = 0; i < 9; i++) ctx.rect(x - 39 + Math.sin(i * 3) * 3, 403 - i * 5, 70, 4, i % 2 ? '#e7e0ca' : '#f8f4e4');
        for (const dx of [-33, 33]) ctx.ellipse(x + dx, 416, 6, 6, '#384c59');
        if (c.lift.kind === 'open' && c.lift.age < 2) bubble(ctx, 'Overtime arriving first.', lx - 35, 219, 230);
        if (c.cart.hit) bubble(ctx, 'Urgent delivery!', x, 304, 170, true);
    }
    for (let i = 1; i < STAGE_TWO.checkpoints.length; i++) {
        const mark = STAGE_TWO.checkpoints[i];
        checkpointFlag(ctx, mark.x, 420, state.checkpoint >= i);
    }
    ctx.rect(ctx.GOAL - 48, 190, 105, 230, '#587878');
    ctx.rect(ctx.GOAL - 40, 198, 89, 220, '#a6bcb1');
    ctx.rod(ctx.GOAL + 29, 299, ctx.GOAL + 29, 330, 4, '#5f797b');
    pictogram(ctx, ctx.GOAL, 'exit');
    practiceFloor(ctx);
    ctx.ellipse(ctx.p.x, 425, 45, 5, '#61747544');
    player(ctx);
}
