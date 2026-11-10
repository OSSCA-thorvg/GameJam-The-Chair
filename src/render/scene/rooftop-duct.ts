import { STAGE_THREE, ductTimings } from '../../game/stage3';
import type { RenderCtx } from '../context';

export function rooftopDuct(ctx: RenderCtx) {
    const duct = STAGE_THREE.duct;
    const reaction = ctx.state.ductReaction;
    const age = reaction.kind === 'reacting' ? reaction.age : reaction.kind === 'done' ? 10 : -1;
    const bursts = reaction.kind === 'reacting' ? reaction.bursts : [];
    const twitching = bursts.some(burst => {
        const timing = ductTimings(burst.kind);
        return burst.age >= timing.inhale && burst.age < timing.inhale + timing.twitch;
    });
    const shake = twitching ? Math.sin(age * 110) * 2.3 : 0;
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
    for (const burst of bursts) {
        const timing = ductTimings(burst.kind);
        if (burst.age < timing.inhale) {
            for (let i = 0; i < 7; i++) {
                const u = (burst.age * 5 + i / 7) % 1;
                const px = x - 160 * (1 - u), py = y + Math.sin(i * 2.3) * (1 - u) * 30;
                ctx.ellipse(px, py, 4 + (1 - u) * 7, 3 + (1 - u) * 4, '#f5f1e2b0');
                ctx.effectPath([px - 16, py + 3], [[px - 8, py, px + 4, py - 2, px + 13, py]],
                    ctx.gradientFill(px - 16, py, px + 13, py, [[0, '#fff7e500'], [1, '#fff7e5b0']]));
            }
        }
        const sneezeAge = burst.age - timing.inhale - timing.twitch;
        if (sneezeAge >= 0 && sneezeAge < timing.sneeze) powderCloud(ctx, x, y, sneezeAge, burst.kind === 'first' ? 1 : .58);
    }
    const sneezeAge = age - duct.inhaleDuration - duct.twitchDuration;
    if (sneezeAge >= 0) {
        const travel = Math.min(1, sneezeAge / .68);
        const ease = 1 - Math.pow(1 - travel, 3);
        glove(ctx, x + (1308 - x) * ease, y + (44 - y) * ease - Math.sin(travel * Math.PI) * 38, -.27 * ease);
        glove(ctx, x + (1380 - x) * ease, y + (64 - y) * ease - Math.sin(travel * Math.PI) * 52, .32 * ease);
        const spin = Math.min(1, sneezeAge / 1.3);
        glove(ctx, x - 210 * spin, y - Math.sin(spin * Math.PI) * 90 + 60 * spin, spin * Math.PI * 4.3);
    }
}

function powderCloud(ctx: RenderCtx, x: number, y: number, age: number, strength: number) {
    const reach = Math.min(1, age / .3) * 325 * strength;
    const alpha = Math.min(1, age / .06) * Math.max(0, 1 - age) * strength;
    ctx.effectPath([x + 8, y - 8], [
        [x - reach * .3, y - 9, x - reach * .7, y - 84, x - reach, y - 57],
        [x - reach - 57, y - 9, x - reach - 28, y + 48, x - reach * .8, y + 48],
        [x - reach * .5, y + 48, x - reach * .2, y + 12, x + 8, y + 10],
        [x + 8, y + 5, x + 8, y, x + 8, y - 8],
    ], ctx.gradientFill(x - reach, y, x, y, [[0, '#e5e9ec00'], [.28, '#e5e9ec9a'], [1, '#fff7e5df']], alpha));
    for (let i = 0; i < 9; i++) {
        const u = i / 9, px = x - reach * (.22 + u * .8), py = y + Math.sin(i * 2.1) * u * 38;
        ctx.ellipse(px, py, 16 + u * 25, 10 + u * 22, ctx.tint('#e7e9e8', alpha * .34));
        ctx.effectPath([x - 10, y + i * 3 - 12], [[x - reach * .3, y - 11 + i * 2, px + 50, py - 8, px, py]],
            ctx.gradientFill(x, y, px, py, [[0, '#fffbedda'], [1, '#fffbed00']], alpha * .8));
    }
}

function glove(ctx: RenderCtx, x: number, y: number, rotation: number) {
    ctx.ox = x; ctx.oy = y; ctx.rotation = rotation; ctx.localScale = .58;
    ctx.polygon([[-17, 14], [-22, -11], [-14, -23], [13, -23], [21, -10], [17, 15]], '#a18a45');
    for (const [fx, fy, tx, ty] of [[-15, -13, -25, -34], [-8, -22, -13, -47], [1, -22, 0, -51], [10, -20, 14, -44], [17, -7, 31, -26]]) {
        ctx.rod(fx, fy, tx, ty, 8, '#ad9950');
        ctx.ellipse(tx, ty, 4, 4, '#ad9950');
    }
    ctx.rect(-17, 10, 34, 14, '#d1b768');
    ctx.rect(-17, 21, 34, 5, '#806a32');
    ctx.rod(-12, 13, 11, 13, 2, '#ead28b');
    ctx.ox = ctx.oy = ctx.rotation = 0; ctx.localScale = 1;
}
