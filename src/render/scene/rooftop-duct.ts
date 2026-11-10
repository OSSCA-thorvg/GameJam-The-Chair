import { STAGE_THREE } from '../../game/stage3';
import type { RenderCtx } from '../context';

export function rooftopDuct(ctx: RenderCtx) {
    const duct = STAGE_THREE.duct;
    const shake = 0;
    const x = duct.x + shake, y = duct.y;
    const top = -430;
    // One continuous bent sheet-metal tube, highlighted across its width.
    ctx.effectPath([x + 20, y - 33], [
        [x + 48, y - 33, x + 85, y - 33, x + 101, y - 33],
        [x + 120, y - 33, x + 126, y - 48, x + 126, y - 66],
        [x + 126, y - 160, x + 126, top + 60, x + 126, top],
        [x + 146, top, x + 163, top, x + 180, top],
        [x + 180, top + 100, x + 180, y - 112, x + 180, y - 62],
        [x + 180, y - 10, x + 154, y + 32, x + 105, y + 32],
        [x + 78, y + 32, x + 40, y + 32, x + 20, y + 32],
        [x + 20, y + 16, x + 20, y - 16, x + 20, y - 33],
    ], ctx.gradientFill(x + 20, 0, x + 180, 0, [[0, '#adb8c7'], [.42, '#7c8ea6'], [.73, '#a3afc1'], [1, '#7b8da5']]));
    ctx.effectPath([x + 25, y - 31], [
        [x + 66, y - 31, x + 95, y - 31, x + 104, y - 31],
        [x + 125, y - 31, x + 137, y - 48, x + 137, y - 68],
        [x + 137, y - 172, x + 137, top + 50, x + 137, top],
        [x + 133, top, x + 129, top, x + 126, top],
        [x + 126, top + 90, x + 126, y - 115, x + 126, y - 68],
        [x + 126, y - 48, x + 120, y - 39, x + 102, y - 39],
        [x + 76, y - 39, x + 47, y - 39, x + 25, y - 39],
        [x + 25, y - 36, x + 25, y - 34, x + 25, y - 31],
    ], ctx.gradientFill(x, 0, x + 140, 0, [[0, '#d6dce2'], [1, '#bdc8d5']]));
    for (const sx of [x + 40, x + 108]) {
        ctx.rect(sx, y - 41, 11, 80, '#afbdcc');
        ctx.rod(sx + 2, y - 40, sx + 2, y + 38, 2, '#d8dfe5');
        for (const by of [y - 32, y + 29]) ctx.ellipse(sx + 7, by, 2, 2, '#546d87');
    }
    for (let sy = top + 50; sy < y - 90; sy += 144) {
        ctx.rect(x + 120, sy, 65, 11, '#b1bdcd');
        for (const bx of [x + 126, x + 178]) ctx.ellipse(bx, sy + 5, 2, 2, '#596f87');
    }
    // The opening faces the left-hand ledge, matching the reference composition.
    ctx.polygon([[x, y - 25], [x + 24, y - 38], [x + 24, y + 35], [x, y + 29]], '#ced5dd');
    ctx.polygon([[x + 4, y - 20], [x + 20, y - 29], [x + 20, y + 27], [x + 4, y + 23]], '#253d57');
    for (let i = 0; i < 4; i++) {
        const ly = y - 18 + i * 13;
        ctx.polygon([[x + 3, ly + 7], [x + 21, ly - 2], [x + 21, ly + 4], [x + 3, ly + 12]], '#8da0b7');
        ctx.rod(x + 3, ly + 6, x + 21, ly - 3, 2, '#d2dbe3');
    }
}
