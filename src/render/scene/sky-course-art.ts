import type { RenderCtx } from '../context';
import type { SkyPlatform } from '../../game/stages/sky/data';

function metalPanel(ctx: RenderCtx, x: number, y: number, width: number, height: number, light: string, base: string, dark: string) {
    ctx.gradientPolygon([[x, y], [x + width, y], [x + width, y + height], [x, y + height]],
        ctx.gradientFill(x, y, x + width, y, [[0, light], [.24, base], [.74, base], [1, dark]]));
}

function rivet(ctx: RenderCtx, x: number, y: number) {
    ctx.ellipse(x, y, 1.7, 1.7, '#424d66');
    ctx.ellipse(x - .4, y - .5, .9, .7, '#b1bdc9');
}

function desk(ctx: RenderCtx, width: number, small: boolean, drawer: number) {
    const left = -width / 2, right = width / 2, height = small ? 53 : 82;
    // Legs, feet and stretcher sit below the same playable tabletop.
    ctx.rod(left + 30, height * .72, right - 20, height * .72, 5, '#46546b');
    for (const x of [left + 19, right - 22]) {
        metalPanel(ctx, x, 9, 13, height, '#96a0b4', '#59637c', '#46546b');
        ctx.rect(x + 2, height - 5, 9, 9, '#46546b');
        ctx.ellipse(x + 6, height + 10, 15, 4, '#46546b');
        ctx.rod(x - 5, height + 8, x + 18, height + 8, 2, '#96a0b4');
        rivet(ctx, x + 6, 19);
        rivet(ctx, x + 6, height - 10);
    }
    metalPanel(ctx, left + 9, 8, width - 18, 18, '#8991a8', '#737a91', '#424d66');
    ctx.rect(left + 10, 8, width - 20, 3, '#46546b');
    // A shallow top plane and warm front edge keep the landing face easy to read.
    ctx.gradientPolygon([[left, -2], [left + 8, -9], [right - 8, -9], [right, -2]],
        ctx.gradientFill(0, -9, 0, -2, [[0, '#ebbd77'], [1, '#ffe0a3']]));
    ctx.gradientPolygon([[left, -2], [right, -2], [right, 8], [left, 8]],
        ctx.gradientFill(0, -2, 0, 8, [[0, '#ffe0a3'], [.35, '#ebbd77'], [1, '#b8adac']]));
    ctx.rod(left + 2, -1, right - 2, -1, 1.5, '#ffe0a3');
    for (let i = 0; i < 3; i++) {
        const x = left + 20 + i * width * .26;
        ctx.strokePath([x, 3], [[x + 12, 1.5, x + 27, 5, x + Math.min(46, width * .17), 3]],
            { width: .7, color: '#737a9133', cap: 'round' });
    }
    const closed = right - 82, dx = closed + drawer * 48;
    ctx.rect(closed - 2, 12, 69, 30, '#424d66');
    if (drawer > 0) {
        ctx.polygon([[closed, 13], [dx, 6], [dx + 65, 6], [closed + 65, 13]], '#424d66');
        ctx.polygon([[closed + 65, 13], [dx + 65, 6], [dx + 65, 34], [closed + 65, 40]], '#59637c');
        ctx.rod(closed + 4, 33, dx + 4, 28, 2, '#96a0b4');
        ctx.rod(closed + 60, 33, dx + 60, 28, 2, '#96a0b4');
    }
    metalPanel(ctx, dx, 13, 65, 27, '#b8adac', '#8991a8', '#59637c');
    ctx.rod(dx + 2, 14, dx + 62, 14, 1, '#b1bdc9');
    ctx.rect(dx + 22, 22, 23, 5, '#424d66');
    ctx.rod(dx + 24, 22, dx + 42, 22, 1.5, '#b1bdc9');
    rivet(ctx, dx + 6, 34); rivet(ctx, dx + 59, 34);
}

function promotionFlag(ctx: RenderCtx, width: number) {
    const pole = width / 2 - 48;
    const left = pole - 158;
    const flap = Math.sin(ctx.t * 5.5) * 5;
    ctx.ellipse(pole, 2, 18, 5, '#485873');
    ctx.rod(pole, 0, pole, -174, 5, '#f8e4ae');
    ctx.rod(pole + 2, -3, pole + 2, -172, 1.5, '#fff4d2');
    ctx.ellipse(pole, -177, 7, 7, '#ffe4a0');
    ctx.polygon([[pole, -161], [left, -156 + flap], [left + 17, -124 + flap], [left, -92 + flap], [pole, -97]], '#f6d18d');
    ctx.polygon([[pole - 5, -155], [left + 8, -150 + flap], [left + 27, -124 + flap], [left + 8, -98 + flap], [pole - 5, -103]], '#b74451');
    ctx.polygon([[pole - 9, -151], [left + 22, -146 + flap], [left + 40, -124 + flap], [left + 22, -102 + flap], [pole - 9, -107]], '#d95e5c');
    ctx.polygon([[left + 16, -132], [left + 26, -142], [left + 36, -132], [left + 36, -127], [left + 26, -136], [left + 16, -127]], '#ffe5a6');
    ctx.polygon([[left + 16, -120], [left + 26, -130], [left + 36, -120], [left + 36, -115], [left + 26, -124], [left + 16, -115]], '#ffe5a6');
    ctx.text(ctx.locale === 'ko' ? '승진' : 'PROMOTED', pole - 62, -122, ctx.locale === 'ko' ? 27 : 17, '#fff5d8',
        { outline: { width: 2, color: '#833642' } });
}

function billboard(ctx: RenderCtx, width: number) {
    const left = -width / 2, right = width / 2;
    for (const x of [left + 30, right - 34]) {
        metalPanel(ctx, x - 4, 82, 8, 42, '#9ca6b2', '#5c6b83', '#424f6d');
        ctx.polygon([[x - 13, 123], [x + 13, 123], [x + 18, 129], [x - 17, 129]], '#5c6b83');
        ctx.rod(x - 14, 124, x + 16, 124, 2, '#9ca6b2');
        ctx.rod(x, 117, x + 18, 93, 3, '#424f6d');
    }
    ctx.gradientPolygon([[left - 5, -8], [right + 5, -8], [right + 10, -3], [left, -3]],
        ctx.gradientFill(0, -8, 0, -3, [[0, '#b9b6bb'], [1, '#69738c']]));
    ctx.rect(left - 5, -3, width + 10, 101, '#424f6d');
    metalPanel(ctx, left - 5, -3, 8, 101, '#b9b6bb', '#69738c', '#424f6d');
    metalPanel(ctx, right - 3, -3, 8, 101, '#b9b6bb', '#69738c', '#424f6d');
    ctx.gradientPolygon([[left + 9, 13], [right - 9, 13], [right - 9, 86], [left + 9, 86]],
        ctx.gradientFill(left, 13, right, 86, [[0, '#69738c'], [.58, '#69738c'], [1, '#424f6d']]));
    ctx.polygon([[left + 10, 14], [left + width * .45, 14], [left + width * .25, 85], [left + 10, 85]], '#b9b6bb14');
    ctx.rect(left, -3, width, 7, '#edc58c');
    ctx.rect(left, -3, width, 1.5, '#f7e5c6');
    ctx.rect(left, 92, width, 5, '#69738c');
    for (const x of [left + 4, right - 4]) for (const y of [8, 88]) rivet(ctx, x, y);
    // Small lamps and their pools of light are attached to the frame, never extra platforms.
    for (const x of [left + width * .25, left + width * .72]) {
        ctx.rod(x, -6, x, -16, 2, '#5c6b83');
        ctx.polygon([[x - 9, -17], [x + 8, -17], [x + 12, -11], [x - 12, -11]], '#69738c');
        ctx.rod(x - 7, -10, x + 7, -10, 2, '#f7e5c6');
        ctx.gradientPolygon([[x - 5, 4], [x + 5, 4], [x + 25, 65], [x - 25, 65]],
            ctx.gradientFill(0, 4, 0, 65, [[0, '#edc58c20'], [1, '#edc58c00']]));
    }
    const model = right - 32;
    ctx.ellipse(model, 36, 9, 11, '#d8b593');
    ctx.polygon([[model - 10, 30], [model - 5, 24], [model + 5, 25], [model + 10, 32], [model, 29]], '#424f6d');
    ctx.polygon([[model - 10, 49], [model + 8, 49], [model + 14, 79], [model - 12, 79]], '#e6ddc8');
    ctx.polygon([[model - 1, 49], [model + 2, 49], [model + 4, 72], [model, 76]], '#69738c');
    ctx.rod(model - 11, 56, model - 26, 43, 6, '#d8b593');
    ctx.rod(model - 26, 43, model - 26, 34, 5, '#d8b593');
    ctx.ellipse(model - 3, 36, 1, 1.4, '#424f6d');
    ctx.ellipse(model + 3, 36, 1, 1.4, '#424f6d');
    if (Math.abs(ctx.rotation) < .65) {
        // ThorVG Text sits in the scene right after the screen, so parrots and the chair pass in front of it.
        const lines = ctx.locale === 'ko' ? ['흔들리지', '않는 기업'] : ['UNSHAKE', 'ABLE INC.'];
        const textLeft = left + 14, textRight = model - 34;
        const maxSize = 34;
        const widest = Math.max(...lines.map(line => ctx.measureText(line, maxSize)));
        const available = textRight - textLeft;
        const size = widest > available ? maxSize * available / widest : maxSize;
        const lineHeight = size * .92;
        for (let i = 0; i < lines.length; i++) {
            const y = 50 + (i - (lines.length - 1) / 2) * lineHeight;
            ctx.text(lines[i], (textLeft + textRight) / 2, y, size, '#fff0cc', { outline: { width: Math.max(1, size * .08), color: '#27344d' } });
        }
    }
}

export function skyCoursePlatform(ctx: RenderCtx, spec: SkyPlatform) {
    if (spec.x > ctx.cam + ctx.VW + 200 || spec.x + spec.width < ctx.cam - 200) return;
    ctx.ox = spec.x + spec.width / 2; ctx.oy = spec.y; ctx.rotation = spec.angle;
    const left = -spec.width / 2, right = spec.width / 2;
    switch (spec.kind) {
        case 'roof':
            metalPanel(ctx, left + 8, 16, spec.width - 16, 80, '#8a9fae', '#405974', '#405974');
            ctx.rect(left + 8, 16, spec.width - 16, 8, '#405974');
            for (let x = left + 25; x < right - 20; x += 52) {
                ctx.rect(x - 2, 33, 35, 34, '#405974');
                metalPanel(ctx, x, 35, 31, 30, '#b1bdc9', '#8a9fae', '#405974');
                ctx.polygon([[x + 2, 37], [x + 19, 37], [x + 7, 63], [x + 2, 63]], '#f4cb8b24');
                ctx.rod(x + 15, 35, x + 15, 65, 2, '#405974');
            }
            ctx.gradientPolygon([[left, 0], [right, 0], [right, 16], [left, 16]],
                ctx.gradientFill(0, 0, 0, 16, [[0, '#b1bdc9'], [.45, '#9caebd'], [1, '#536d86']]));
            ctx.rect(left, 0, spec.width, 3, '#f4cb8b');
            for (let x = left + 16; x < right; x += 64) { rivet(ctx, x, 10); ctx.rect(x, 78, 23, 2, '#405974'); }
            break;
        case 'sill':
            ctx.gradientPolygon([[left, 0], [right, 0], [right, 12], [left, 12]],
                ctx.gradientFill(0, 0, 0, 12, [[0, '#b1bdc9'], [.45, '#9caebd'], [1, '#536d86']]));
            ctx.rect(left, 0, spec.width, 3, '#f4c582');
            ctx.rod(left + 2, 11, right - 2, 11, 2, '#405974');
            for (const x of [left + 15, right - 45]) {
                ctx.polygon([[x, 12], [x + 30, 12], [x, 45]], '#536d86');
                ctx.rod(x + 3, 36, x + 24, 14, 3, '#8a9fae');
                rivet(ctx, x + 5, 18); rivet(ctx, x + 22, 17);
            }
            for (let x = left + 16; x < right; x += 72) rivet(ctx, x, 7);
            break;
        case 'sign': billboard(ctx, spec.width); break;
        case 'desk': desk(ctx, spec.width, false, spec.id === 'drawer-desk' ? ctx.state.sky.drawer : 0); break;
        case 'small-desk': desk(ctx, spec.width, true, 0); break;
        case 'finish':
            desk(ctx, spec.width, false, 0);
            promotionFlag(ctx, spec.width);
            break;
    }
    ctx.ox = ctx.oy = ctx.rotation = 0;
}
