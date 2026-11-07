import { translate, type Message } from '../../i18n';
import { STAGE_TWO, TYPING_SOUNDS } from '../../game/stage2';
import type { RenderCtx } from '../context';
import type { Vector } from '../types';
import { practiceFloor, checkpointFlag } from './decor';
import { player } from './player';

function bubble(ctx: RenderCtx, text: Message, x: number, y: number, width: number, spiky = false, alpha = 1, tail = true) {
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
    if (tail) ctx.polygon([[x - 8, y + 20], [x + 9, y + 20], [x - 10, y + 36]], fill);
    ctx.label(translate(text, ctx.locale), x, y + 5, 13, ctx.tint('#344955', alpha));
}
type WorkerRole = 'facilitator' | 'jacket' | 'vest';

function head(ctx: RenderCtx, x: number, y: number, facing: number, hair: string, tied = false) {
    const shape = (points: Vector[], color: string) =>
        ctx.polygon(points.map(([px, py]) => [x + facing * px, y + py]), color);
    if (tied) ctx.ellipse(x - facing * 13, y + 6, 8, 9, hair);
    shape([[-11, -13], [6, -16], [12, -8], [14, -1], [17, 1], [13, 3],
        [11, 11], [0, 15], [-10, 10], [-13, 1]], '#ddbd9d');
    shape([[-15, -4], [-16, -11], [-10, -19], [1, -22], [12, -16],
        [16, -9], [5, -13], [-7, -5], [-10, 4], [-14, 1]], hair);
    shape([[7, -2], [11, -2], [11, 0], [7, 0]], '#4c4951');
}

function worker(ctx: RenderCtx, x: number, y: number, role: WorkerRole, facing = 1, palm?: Vector) {
    const facilitator = role === 'facilitator';
    const vest = role === 'vest';
    const fabric = facilitator ? '#715c75' : vest ? '#877b70' : '#5b6b83';
    const light = facilitator ? '#88718a' : vest ? '#9b8c7d' : '#72829a';
    const hair = facilitator ? '#4f414d' : vest ? '#494755' : '#424b5a';
    const stride = palm ? 5 : 0;
    const shape = (points: Vector[], color: string) =>
        ctx.polygon(points.map(([px, py]) => [x + facing * px, y + py]), color);

    ctx.ellipse(x, y + 1, 25, 3, '#35465624');
    shape([[-13,-45],[12,-45],[16+stride,-4],[6+stride,-4],[0,-35],[-6,-4],[-16-stride,-4]], '#485467');
    shape([[-16-stride,-7],[-6,-7],[-4,0],[-22-stride,0],[-22-stride,-3]], '#34404c');
    shape([[6+stride,-7],[16+stride,-7],[23+stride,-2],[23+stride,0],[6+stride,0]], '#34404c');
    const hem = facilitator ? -35 : -43;
    shape([[-17,-84],[-8,-90],[10,-90],[20,-83],[16,-67],[19,hem],[-17,hem],[-15,-63],[-23,-68]], fabric);
    shape([[-17,-84],[-8,-90],[-5,hem],[-17,hem],[-15,-63],[-23,-68]], light);
    shape([[-9,-89],[11,-89],[2,-67]], '#e8e3d3');
    shape([[-6,-98],[7,-98],[9,-89],[1,-84],[-6,-90]], '#b99a80');
    head(ctx, x, y - 105, facing, hair, facilitator);

    if (facilitator) {
        shape([[-13,-63],[12,-65],[16,-42],[-9,-39]], '#b1a17d');
        shape([[-9,-59],[9,-61],[12,-45],[-7,-43]], '#e0d4bb');
        shape([[-4,-62],[5,-63],[6,-59],[-3,-58]], '#8c9296');
        shape([[-18,-73],[-14,-62],[-7,-56],[-9,-51],[-16,-55],[-23,-68]], light);
        shape([[-11,-57],[-5,-55],[-6,-50],[-13,-52]], '#d7b493');
        if (palm) {
            const elbowX = x + (palm[0] - x) * .56;
            const elbowY = y - 72;
            ctx.rod(x + facing * 13, y - 79, elbowX, elbowY, 9, fabric);
            ctx.rod(elbowX, elbowY, palm[0], palm[1], 7, light);
            ctx.ellipse(palm[0], palm[1], 4, 3.2, '#ddbd9d');
        } else {
            shape([[14,-80],[21,-74],[29,-69],[36,-72],[38,-68],[29,-63],[19,-66],[12,-72]], fabric);
            shape([[34,-71],[40,-75],[44,-73],[40,-67],[36,-67]], '#ddbd9d');
        }
    } else if (vest) {
        shape([[0,-85],[4,-84],[3,-75],[0,-74],[-2,-78]], '#a76e56');
        shape([[-17,-77],[-23,-61],[-13,-54],[6,-58],[4,-64],[-11,-62],[-8,-74]], '#e9e3d6');
        shape([[13,-79],[20,-70],[15,-59],[8,-60],[10,-69],[7,-77]], '#e9e3d6');
        shape([[9,-69],[6,-77],[8,-86],[13,-85],[13,-77],[15,-70]], '#ddbd9d');
    } else {
        shape([[-16,-78],[-22,-60],[-13,-54],[2,-56],[0,-63],[-10,-62],[-8,-75]], light);
        shape([[15,-79],[21,-64],[16,-55],[-5,-55],[-6,-62],[11,-63],[8,-75]], fabric);
        shape([[-8,-64],[-1,-62],[-1,-57],[-9,-58]], '#ddbd9d');
        shape([[5,-62],[12,-63],[14,-58],[7,-57]], '#ddbd9d');
    }
}

function typingWorker(ctx: RenderCtx, x: number, y: number, tied: boolean) {
    const shirt = tied ? '#8d746f' : '#728b9a';
    const sleeve = tied ? '#a38a82' : '#8ca1ad';
    const tap = Math.sin(ctx.t * 16 + (tied ? 1.7 : 0)) * 1.4;
    ctx.rect(x - 21, y - 39, 11, 37, '#556673');
    ctx.polygon([[x-13,y-42],[x+3,y-44],[x+10,y-30],[x+7,y-1],[x-13,y-1]], shirt);
    ctx.polygon([[x-12,y-39],[x-5,y-40],[x-3,y-1],[x-13,y-1]], sleeve);
    ctx.polygon([[x-5,y-51],[x+6,y-51],[x+8,y-42],[x+1,y-38],[x-5,y-43]], '#b99a80');
    head(ctx, x, y - 58, 1, tied ? '#4f414d' : '#424b5a', tied);
    ctx.rect(x - 29, y, 74, 7, '#a7a18e');
    ctx.rod(x-3,y-34,x+6,y-14,8,sleeve);
    ctx.rod(x+6,y-14,x+24,y-5+tap,5,'#ddbd9d');
    ctx.ellipse(x+26,y-4+tap,4,2.5,'#ddbd9d');
    ctx.rect(x + 17, y - 3, 17, 3, '#455665');
    ctx.polygon([[x+30,y-35],[x+46,y-36],[x+44,y-14],[x+28,y-13]], '#526674');
    ctx.rod(x+36,y-14,x+36,y-3,3,'#526674');
    ctx.rect(x + 31, y - 3, 12, 3, '#526674');
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
    worker(ctx, x - 10, 397, 'jacket', -1);
    worker(ctx, x + 119, 397, 'vest', -1);
    ctx.rect(x - 190, 330, 370, 15, '#ab9274');
    ctx.rod(x - 170, 345, x - 170, 420, 8, '#657b7b');
    ctx.rod(x + 160, 345, x + 160, 420, 8, '#657b7b');
    for (const dx of [-110, 0, 110]) {
        ctx.ripple(x + dx, 404, 28, 10, 2, '#f0e8c0');
        ctx.label('···', x + dx, 405, 18, '#7c8d85');
    }
    const pushing = Math.max(0, scene.age - 4.6) * 100;
    worker(ctx, x - 156 + pushing, 420, 'facilitator', 1,
        scene.age > 4.6 ? [ctx.p.x - 31, ctx.p.y - 61] : undefined);
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
        ctx.rect(x - 105, 180, 210, 170, '#839895');
        typingWorker(ctx, x - 65, 269, false);
        typingWorker(ctx, x + 32, 269, true);
        ctx.rect(x - 105, 180, 210, 170, '#6d8b99a0');
        ctx.rod(x, 175, x, 355, 5, '#849a9e');
        ctx.polygon([[x - 98, 184], [x - 75, 184], [x + 55, 347], [x + 32, 347]], '#edf4e719');
        if (office.life > 0) bubble(ctx, TYPING_SOUNDS[office.phrase], x + office.offset.x, 174 + office.offset.y, 156, false, Math.min(.78, office.life * 2), false);
    }
    const mx = STAGE_TWO.meeting;
    ctx.rect(mx - 78, 180, 156, 240, '#687f80');
    ctx.rect(mx - 70, 187, 140, 232, '#91a29b');
    const opening = Math.min(1, c.dispatchAge / .5);
    ctx.rect(mx - 64 + opening * 112, 190, 126 * (1 - opening), 225, '#d8d6bf');
    ctx.rect(mx - 70, 147, 140, 25, '#e1d7bb');
    ctx.label(translate('Meeting extended', ctx.locale), mx, 164, 13, '#4f6268');
    const pushPhase = c.dispatchStarted && c.dispatchAge < 3.5 ? Math.sin(Math.max(0, c.dispatchAge - .35) * Math.PI / .9) ** 2 : 0;
    worker(ctx, mx - 57 + pushPhase * 10, 420, 'facilitator', 1,
        pushPhase > 0 ? [mx - 18 + pushPhase * 9, 344 - pushPhase * 11] : undefined);
    if (c.dispatchStarted && c.dispatchAge < 1.5) bubble(ctx, 'Meeting extended. Chairs may leave.', mx + 40, 103, 310);
    state.furniture.forEach((item, i) => {
        if (!item.released) return;
        chair(ctx, item.x, item.y);
        if (item.cheer > 0) bubble(ctx, (['Woohoo! Freedom!', 'Clocking out!', 'Bye-bye, overtime!'] satisfies Message[])[i], item.x, 285 - (i % 2) * 60, 185, true, Math.min(1, item.cheer * 2));
    });
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
