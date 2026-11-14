import type { RenderCtx } from '../context';
import type { Vector } from '../types';
import { SPRAY_KEY } from '../../ui/controls';
import { LEVEL } from '../../game/level';
import { STAGE_THREE } from '../../game/stages/rooftop/data';
import { keycap, keycapPop, keycapPress, keycapSize, type KeyFace } from './keycap';

// The same pressing keycaps as stage five's Space hint, shown where a control is first needed.

/** Keycap text size: the stage five hint's, so every hint reads as one family. */
const hintSize = (ctx: RenderCtx, age: number) => ctx.clamp(ctx.W / 52, 12, 20) * keycapPop(age).scale;

/** Keys side by side, centred on `centre` (screen px) with their bottoms there; each presses on its own beat. */
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

/**
 * Stage one's first steps: left and right over the chair until it has rolled off, and up over the practice pile
 * until it has been jumped.
 */
export function officeControlHints(ctx: RenderCtx) {
    if (ctx.mode !== 'play' || ctx.cam > 340) return;
    const { lessons } = ctx.state, p = ctx.p, age = ctx.t;
    if (!lessons.moved) keyRow(ctx, ['left', 'right'], ctx.screenPoint(p.x, p.y - 95), age);
    if (!lessons.jumped) keyRow(ctx, ['up'], ctx.screenPoint(LEVEL.practicePaper.x, ctx.F - 40), age);
}

/** Stage three: a Space keycap over the extinguisher, until the chair has gone on past it. */
export function rooftopSprayHint(ctx: RenderCtx) {
    const pickup = STAGE_THREE.pickup;
    if (ctx.p.x >= 790 || !ctx.visible({ left: 560, top: 250, right: 640, bottom: 390 }, 40)) return;
    keyRow(ctx, [{ text: SPRAY_KEY }], ctx.screenPoint(pickup.x, pickup.y - 92), ctx.t);
}
