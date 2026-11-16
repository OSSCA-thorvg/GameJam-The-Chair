import type { RenderCtx } from '../context';
import type { Vector } from '../types';
import { SPRAY_KEY } from '../../ui/controls';
import { LEVEL } from '../../game/level';
import { STAGE_THREE } from '../../game/stages/rooftop/data';
import { keycap, keycapPop, keycapPress, keycapSize, type KeyFace } from './keycap';


const hintSize = (ctx: RenderCtx, age: number) => ctx.clamp(ctx.W / 52, 12, 20) * keycapPop(age).scale;

function keyRow(ctx: RenderCtx, faces: KeyFace[], centre: Vector, age: number) {
    const size = hintSize(ctx, age), alpha = keycapPop(age).alpha;
    const sizes = faces.map(face => keycapSize(ctx, face, size));
    const gap = size * .6;
    let x = centre[0] - (sizes.reduce((sum, s) => sum + s.w, 0) + gap * (faces.length - 1)) / 2;
    faces.forEach((face, i) => {
        const { w, h, depth } = sizes[i];
        keycap(ctx, face, [x, centre[1] - h - depth], size, alpha, keycapPress(age + i * .45));
        x += w + gap;
    });
}

export function officeControlHints(ctx: RenderCtx) {
    if (ctx.mode !== 'play' || ctx.cutscene || ctx.cam > 340) return;
    const { lessons } = ctx.state, tried = ctx.keysTried, p = ctx.player, age = ctx.t;
    const arrows = (['left', 'right'] as const).filter(key => !tried[key]);
    if (!lessons.moved && arrows.length) keyRow(ctx, arrows, ctx.screenPoint(p.x, p.y - 95), age);
    if (!lessons.jumped && !tried.jump) keyRow(ctx, ['up'], ctx.screenPoint(LEVEL.practicePaper.x, ctx.F - 40), age);
}

export function rooftopSprayHint(ctx: RenderCtx) {
    const pickup = STAGE_THREE.pickup;
    if (ctx.keysTried.spray || ctx.player.x >= 790 || !ctx.visible({ left: 560, top: 250, right: 640, bottom: 390 }, 40)) return;
    keyRow(ctx, [{ text: SPRAY_KEY }], ctx.screenPoint(pickup.x, pickup.y - 92), ctx.t);
}
