import { LEVEL } from '../../game/level';
import { ART } from '../art';
import type { RenderCtx } from '../context';

export function player(ctx: RenderCtx) {
    const F = ctx.F;
    const TAU = ctx.TAU;
    const C = ctx.C;
    const p = ctx.p;
    const state = ctx.state;
    ctx.ox = p.x + ART.player.offsetX;
    ctx.oy = p.y + ART.player.offsetY;
    ctx.rotation = p.a + (ctx.mode === 'play' && ctx.t < 1 && !state.lessons.moved ? Math.sin(ctx.t * 12) * .025 : 0);
    ctx.localScale = ART.player.scale;
    if (state.hasExtinguisher) {
        ctx.rod(-39, -49, -45, -13, 4, '#394657');
        ctx.rect(-54, -48, 16, 39, '#b75f4a');
        ctx.ellipse(-46, -48, 8, 5, '#c7765c');
        ctx.rect(-52, -37, 12, 11, '#eee5cd');
        ctx.rod(-46, -52, -46, -59, 4, '#394657');
        ctx.rod(-49, -59, -35, -59, 3, '#394657');
        ctx.rod(-45, -52, -34, -44, 3, '#394657');
    }
    ctx.rod(0, -4, 0, 16, 6, C.steel);
    ctx.rod(-29, 21, 0, 13, 5, C.steel);
    ctx.rod(0, 13, 29, 21, 5, C.steel);
    for (const x of [-27, 27]) {
        ctx.ellipse(x, 23, 7, 8, '#3f4650');
        ctx.rod(x - 3 * Math.cos(ctx.wheel), 23 - 3 * Math.sin(ctx.wheel), x + 3 * Math.cos(ctx.wheel), 23 + 3 * Math.sin(ctx.wheel), 1, '#9197a2');
    }
    ctx.rod(-24, -10, -31, -61, 7, '#515665');
    ctx.polygon([[-40, -69], [-24, -68], [-23, -20], [-37, -20]], '#666d80');
    ctx.rect(-30, -15, 62, 12, '#6f7687');
    ctx.rod(-15, -22, -15, -8, 3, C.steel);
    ctx.rod(20, -22, 20, -8, 3, C.steel);
    ctx.polygon([[-10, -25], [22, -25], [32, -22], [43, 4], [35, 6], [23, -13], [-9, -15]], '#4e5b70');
    ctx.polygon([[35, 3], [42, 3], [50, 6], [55, 9], [52, 10], [35, 7]], '#383f4e');
    ctx.polygon([[-14, -26], [22, -25], [29, -21], [34, 11], [26, 13], [21, -12], [-13, -16]], '#5b6b80');
    ctx.polygon([[-11, -25], [20, -24], [26, -21], [7, -20], [-10, -21]], '#6d7b8e');
    ctx.polygon([[25, -18], [27, -17], [31, 10], [29, 10]], '#49586c');
    ctx.polygon([[26, 11], [33, 10], [35, 15], [26, 16]], '#383f4e');

    ctx.polygon([[-17, -63], [-6, -64], [5, -60], [9, -25], [-17, -23]], C.shirt);
    ctx.polygon([[-17, -62], [-11, -61], [-11, -24], [-17, -23]], '#d9d6c5');
    ctx.polygon([[-7, -70], [4, -68], [5, -60], [1, -56], [-7, -62]], '#d5b18b');
    ctx.polygon([[-9, -65], [0, -60], [6, -60], [4, -55], [0, -52], [-6, -57]], '#fff6de');
    ctx.polygon([[1, -58], [5, -57], [5, -54], [8, -36], [6, -33], [1, -34], [2, -54]], '#a65e44');

    ctx.polygon([[-13, -87], [-4, -95], [10, -91], [13, -84], [14, -79], [17, -75], [13, -74], [11, -66], [2, -66], [-9, -69], [-12, -77]], C.skin);
    ctx.polygon([[-11, -76], [-7, -72], [1, -69], [11, -69], [11, -66], [2, -66], [-9, -69]], '#d3b18c');
    ctx.polygon([[-15, -87], [-5, -100], [10, -97], [16, -88], [3, -87], [-3, -83], [-10, -77]], '#3c424f');
    ctx.polygon([[-7, -93], [-4, -98], [3, -96]], '#687380');
    const glance = state.lossReason === 'focus' ? .5 + .5 * Math.sin(state.focusLossTime * 6) : state.focusNotice ? Math.sin((1.7 - state.focusNotice.life) / 1.7 * Math.PI) : 0;
    ctx.ellipse(-7, -81, 2.7, 3.4, C.skin);
    ctx.rod(-5, -83, 4, -84, 1.35, '#3a414b');
    ctx.rect(3, -86, 11, 6, '#50606a');
    ctx.rect(4, -85, 9, 4, '#83c8e4');
    ctx.rect(5, -85, 2, 4, '#bfe6ef');
    ctx.rect(11.5 - glance * 6, -84, 1.2, 2, '#446d82');
    ctx.rod(9, -71, 12, -71, 1, '#9c775f');

    ctx.polygon([[-17, -58], [-13, -60], [-9, -57], [-8, -35], [-18, -34]], '#e6e0cc');
    ctx.polygon([[-19, -39], [-8, -39], [-8, -34], [-19, -33]], '#fff6de');
    ctx.polygon([[-16, -34], [-9, -35], [23, -36], [25, -32], [-15, -27]], C.skin);
    ctx.polygon([[-15, -29], [23, -33], [24, -32], [-15, -27]], '#d3aa80');
    ctx.polygon([[21, -31], [54, -31], [65, -59], [33, -59]], '#555f70');
    ctx.polygon([[35, -55], [59, -55], [51, -35], [27, -35]], '#a8b9c3');

    ctx.rod(18, -29, 55, -29, 3, C.steel);
    const tap = state.lossReason === 'focus' ? 0 : Math.sin(ctx.t * 24) * 1.8;
    ctx.polygon([[17, -36], [23, -38], [30, -36], [34, -33], [31, -32], [26, -34], [18, -33]], '#d3aa80');
    ctx.polygon([[21, -36 + tap], [25, -39 + tap], [30, -38 + tap], [35, -35 + tap], [36, -33 + tap], [33, -33 + tap], [29, -35 + tap], [23, -33 + tap]], C.skin);
    if (state.focusNotice?.kind === 'water') ctx.rod(7, -39, 44, -57, 5, C.skin);
    if (ctx.saveFlash > 0) {
        ctx.rect(40, -52, 11, 11, '#e0ecd2');
        ctx.rect(42, -52, 6, 4, '#728a7b');
        ctx.rect(43, -45, 5, 3, '#728a7b');
    }
    if (ctx.paperFace > 0) {
        ctx.polygon([[-13, -89], [13, -85], [10, -65], [-15, -69]], C.paper);
        ctx.rod(-8, -82, 9, -80, 1, '#a8a79e');
        ctx.rod(-8, -77, 7, -75, 1, '#a8a79e');
    }
    if (ctx.soaked) {
        for (const [x, y] of [[-13, -49], [5, -29], [34, -44]]) {
            ctx.ellipse(x, y, 4, 6, '#8b9c777d');
        }
    }
    if (ctx.dirty) {
        for (let i = 0; i < 9; i++) {
            const x = -25 + (i * 17) % 60;
            const y = -82 + (i * 23) % 79;
            ctx.polygon([[x, y], [x + 9, y - 4], [x + 12, y + 6], [x + 2, y + 8]], ['#d6c998', '#85946b', '#a88e69'][i % 3]);
        }
        ctx.polygon([[-14, -94], [-2, -104], [7, -94]], '#c4ae73');
        ctx.rod(-3, -98, 0, -88, 2, '#849267');
    }
    if (ctx.mode === 'impact' || (ctx.mode === 'dead' && state.lossReason === 'head')) {
        for (let i = 0; i < 8; i++) {
            const angle = i * TAU / 8;
            ctx.rod(Math.cos(angle) * 19, -77 + Math.sin(angle) * 19, Math.cos(angle) * 28, -77 + Math.sin(angle) * 28, 3, '#e5b17f');
        }
    }
    ctx.ox = ctx.oy = ctx.rotation = 0;
    ctx.localScale = 1;
}

export function debugCollisions(ctx: RenderCtx) {
    if (!ART.debugCollisions) return;
    ctx.ox = ctx.p.x;
    ctx.oy = ctx.p.y;
    ctx.rotation = ctx.p.a;
    for (const part of LEVEL.playerContacts) {
        ctx.ripple(part.x, part.y, part.r, part.r, 1, '#ff0055');
    }
    ctx.ox = ctx.oy = ctx.rotation = 0;
}
