import { LEVEL } from '../../game/level';
import { ART } from '../art';
import { playerChair } from './player-chair';
import { PLAYER_OUTLINES } from './player-art';
import type { RenderCtx } from '../context';

export function player(ctx: RenderCtx) {
    const p = ctx.p;
    const state = ctx.state;
    ctx.ox = p.x + ART.player.offsetX;
    ctx.oy = p.y + ART.player.offsetY;
    ctx.rotation = p.a + (ctx.mode === 'play' && ctx.t < 1 && !state.lessons.moved ? Math.sin(ctx.t * 12) * .025 : 0);
    ctx.localScale = ART.player.scale;
    playerChair(ctx);
    riderBody(ctx);
    const lift = focusTension(ctx).lift;
    const base = { ox: ctx.ox, oy: ctx.oy };
    shiftLocal(ctx, -1.2 * lift, -3 * lift);
    riderHead(ctx);
    ctx.ox = base.ox;
    ctx.oy = base.oy;
    riderArms(ctx);
    riderEffects(ctx);
    riderWorry(ctx);
    ctx.ox = ctx.oy = ctx.rotation = 0;
    ctx.localScale = 1;
    focusVignette(ctx);
}

// How far the rider is from snapping out of work: drifting eyes below 60%, sweat and stalled typing below 40%,
// a raised head and a puzzled "...?" below 20%. Focus loss itself has its own glance.
function focusTension(ctx: RenderCtx) {
    const state = ctx.state;
    const live = ctx.mode !== 'intro' && state.lossReason !== 'focus';
    const focus = live ? state.focus : 100;
    const t = ctx.t;
    const drift = focus <= 60 ? Math.max(0, Math.sin(t * 2.1) * 1.6 - .6) * Math.min(1, (60 - focus) / 30 + .4) : 0;
    const sweat = focus <= 40 ? Math.min(1, (40 - focus) / 15 + .5) : 0;
    const stall = focus <= 40 && Math.sin(t * 1.7) > .2;
    const critical = focus <= 20 ? Math.min(1, (20 - focus) / 10 + .6) : 0;
    const lift = critical * (.75 + .25 * Math.sin(t * 5));
    return { drift: Math.min(1, drift), sweat, stall, critical, lift };
}

function shiftLocal(ctx: RenderCtx, dx: number, dy: number) {
    const k = ctx.localScale;
    const c = Math.cos(ctx.rotation), s = Math.sin(ctx.rotation);
    ctx.ox += (dx * c - dy * s) * k;
    ctx.oy += (dx * s + dy * c) * k;
}

function riderWorry(ctx: RenderCtx) {
    const tension = focusTension(ctx);
    if (tension.sweat > 0) {
        const fall = (ctx.t * .9) % 1;
        const alpha = tension.sweat * (1 - fall * .7);
        ctx.ellipse(-12, -86 + fall * 12, 1.8, 2.6, ctx.tint('#9fd3ec', alpha));
        ctx.polygon([[-13.6, -86 + fall * 12], [-12, -90 + fall * 12], [-10.4, -86 + fall * 12]], ctx.tint('#9fd3ec', alpha));
    }
    if (tension.critical > 0) {
        const pop = .5 + .5 * Math.sin(ctx.t * 6);
        for (let i = 0; i < 3; i++) {
            const on = (ctx.t * 2.4 - i * .35) % 1.6 < 1.1;
            if (on) ctx.ellipse(-4 + i * 6, -108 - i * 1.5, 1.8, 1.8, ctx.tint('#f5eddc', tension.critical));
        }
        ctx.signText('?', 17, -108, 15 + pop * 2, '#f5eddc', { width: 1.6, color: '#28303b' });
    }
}

function focusVignette(ctx: RenderCtx) {
    const critical = focusTension(ctx).critical;
    if (critical <= 0 || ctx.mode !== 'play') return;
    const top = -ctx.vertical, bottom = ctx.H / ctx.scale - ctx.vertical;
    const left = ctx.cam, right = ctx.cam + ctx.VW;
    const pulse = .55 + .45 * Math.sin(ctx.t * 5);
    const fill = ctx.radialFill((left + right) / 2, (top + bottom) / 2, Math.hypot(right - left, bottom - top) / 2,
        [[.55, '#9a2f2a00'], [1, '#9a2f2a']], critical * pulse * .38);
    ctx.gradientPolygon([[left, top], [right, top], [right, bottom], [left, bottom]], fill);
}

function riderBody(ctx: RenderCtx) {
    const C = ctx.C;
    ctx.polygon(PLAYER_OUTLINES.farLeg, '#4e5b70');
    ctx.polygon([[35, 3], [42, 3], [50, 6], [55, 9], [52, 10], [35, 7]], '#383f4e');
    ctx.polygon(PLAYER_OUTLINES.nearLeg, '#5b6b80');
    ctx.polygon([[-11, -25], [20, -24], [26, -21], [7, -20], [-10, -21]], '#6d7b8e');
    ctx.polygon([[25, -18], [27, -17], [31, 10], [29, 10]], '#49586c');
    ctx.polygon([[26, 11], [33, 10], [35, 15], [26, 16]], '#383f4e');

    ctx.polygon(PLAYER_OUTLINES.shirt, C.shirt);
    ctx.polygon([[-17, -62], [-11, -61], [-11, -24], [-17, -23]], '#d9d6c5');
    ctx.polygon([[-7, -70], [4, -68], [5, -60], [1, -56], [-7, -62]], '#d5b18b');
    ctx.polygon([[-9, -65], [0, -60], [6, -60], [4, -55], [0, -52], [-6, -57]], '#fff6de');
    ctx.polygon([[1, -58], [5, -57], [5, -54], [8, -36], [6, -33], [1, -34], [2, -54]], '#a65e44');
}

function riderHead(ctx: RenderCtx) {
    const C = ctx.C;
    const state = ctx.state;
    ctx.polygon(PLAYER_OUTLINES.head, C.skin);
    ctx.polygon([[-11, -76], [-7, -72], [1, -69], [11, -69], [11, -66], [2, -66], [-9, -69]], '#d3b18c');
    ctx.polygon(PLAYER_OUTLINES.hair, '#3c424f');
    ctx.polygon([[-7, -93], [-4, -98], [3, -96]], '#687380');
    const notice = state.lossReason === 'focus' ? .5 + .5 * Math.sin(state.focusLossTime * 6) : state.focusNotice ? Math.sin((1.7 - state.focusNotice.life) / 1.7 * Math.PI) : 0;
    const tension = focusTension(ctx);
    const glance = Math.max(notice, tension.drift, tension.lift);
    ctx.ellipse(-7, -81, 2.7, 3.4, C.skin);
    ctx.rod(-5, -83, 4, -84, 1.35, '#3a414b');
    ctx.rect(3, -86, 11, 6, '#50606a');
    ctx.rect(4, -85, 9, 4, '#83c8e4');
    ctx.rect(5, -85, 2, 4, '#bfe6ef');
    ctx.rect(11.5 - glance * 6, -84, 1.2, 2, '#446d82');
    ctx.rod(9, -71, 12, -71, 1, '#9c775f');
}

function riderArms(ctx: RenderCtx) {
    const C = ctx.C;
    const state = ctx.state;
    ctx.polygon([[-17, -58], [-13, -60], [-9, -57], [-8, -35], [-18, -34]], '#e6e0cc');
    ctx.polygon([[-19, -39], [-8, -39], [-8, -34], [-19, -33]], '#fff6de');
    ctx.polygon([[-16, -34], [-9, -35], [23, -36], [25, -32], [-15, -27]], C.skin);
    ctx.polygon([[-15, -29], [23, -33], [24, -32], [-15, -27]], '#d3aa80');
    ctx.polygon(PLAYER_OUTLINES.laptop, '#555f70');
    ctx.polygon([[35, -55], [59, -55], [51, -35], [27, -35]], '#a8b9c3');

    ctx.rod(18, -29, 55, -29, 3, C.steel);
    const tap = state.lossReason === 'focus' || focusTension(ctx).stall ? 0 : Math.sin(ctx.t * 24) * 1.8;
    ctx.polygon([[17, -36], [23, -38], [30, -36], [34, -33], [31, -32], [26, -34], [18, -33]], '#d3aa80');
    ctx.polygon([[21, -36 + tap], [25, -39 + tap], [30, -38 + tap], [35, -35 + tap], [36, -33 + tap], [33, -33 + tap], [29, -35 + tap], [23, -33 + tap]], C.skin);
}

function riderEffects(ctx: RenderCtx) {
    const C = ctx.C;
    const state = ctx.state;
    const TAU = ctx.TAU;
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
