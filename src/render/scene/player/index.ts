import { PLAYER_OUTLINES } from './art';
import { playerChair } from './chair';
import {
    chairStains,
    riderFaceStains,
    riderSplash,
    riderStains,
} from './stains';
import { LEVEL } from '../../../game/level';
import { ART } from '../../art';

import type { RenderCtx } from '../../context';
export function player(ctx: RenderCtx): void {
    const p = ctx.player;
    const state = ctx.state;
    ctx.ox = p.x + ART.player.offsetX;
    ctx.oy = p.y + ART.player.offsetY;
    ctx.rotation =
        p.a +
        (ctx.mode === 'play' && ctx.t < 1 && !state.lessons.moved
            ? Math.sin(ctx.t * 12) * 0.025
            : 0);
    ctx.localScale = ART.player.scale;
    chairAfterimages(ctx);
    playerChair(ctx);
    chairStains(ctx, ctx.soaks);
    if (ctx.chairPose.riderPop) {
        shiftLocal(ctx, ctx.chairPose.riderPop / 8, -ctx.chairPose.riderPop);
    }
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
}
function chairAfterimages(ctx: RenderCtx) {
    const shiver = ctx.chairPose.shiver;
    if (shiver <= 0) {
        return;
    }
    const base = { ox: ctx.ox, oy: ctx.oy };
    ctx.beginLayer({ key: 'opening-chair-afterimage', opacity: 0.5 * shiver });
    for (const side of [-1, 1]) {
        const reach = side * (8 + 6 * Math.abs(Math.sin(ctx.t * 37 + side)));
        shiftLocal(ctx, reach, Math.sin(ctx.t * 51 + side) * 1.5);
        playerChair(ctx);
        ctx.ox = base.ox;
        ctx.oy = base.oy;
    }
    ctx.endLayer();
}
function focusTension(ctx: RenderCtx) {
    const state = ctx.state;
    const live = ctx.mode !== 'intro' && state.lossReason !== 'focus';
    const focus = live ? state.focus : 100;
    const t = ctx.t;
    const drift =
        focus <= 60
            ? Math.max(0, Math.sin(t * 2.1) * 1.6 - 0.6) *
              Math.min(1, (60 - focus) / 30 + 0.4)
            : 0;
    const sweat = focus <= 40 ? Math.min(1, (40 - focus) / 15 + 0.5) : 0;
    const stall = focus <= 40 && Math.sin(t * 1.7) > 0.2;
    const critical = focus <= 20 ? Math.min(1, (20 - focus) / 10 + 0.6) : 0;
    const lift = critical * (0.75 + 0.25 * Math.sin(t * 5));
    return { drift: Math.min(1, drift), sweat, stall, critical, lift };
}
function shiftLocal(ctx: RenderCtx, dx: number, dy: number) {
    const k = ctx.localScale;
    const c = Math.cos(ctx.rotation);
    const s = Math.sin(ctx.rotation);
    ctx.ox += (dx * c - dy * s) * k;
    ctx.oy += (dx * s + dy * c) * k;
}
function riderWorry(ctx: RenderCtx) {
    const tension = focusTension(ctx);
    if (tension.sweat > 0) {
        const fall = (ctx.t * 0.9) % 1;
        const alpha = tension.sweat * (1 - fall * 0.7);
        ctx.ellipse(-12, -86 + fall * 12, 1.8, 2.6, {
            c: ctx.tint('#9fd3ec', alpha),
        });
        ctx.polygon(
            [
                [-13.6, -86 + fall * 12],
                [-12, -90 + fall * 12],
                [-10.4, -86 + fall * 12],
            ],
            ctx.tint('#9fd3ec', alpha),
        );
    }
    if (tension.critical > 0) {
        const pop = 0.5 + 0.5 * Math.sin(ctx.t * 6);
        // Keep invisible dots to avoid paint-order rebuilds when blinking.
        for (let i = 0; i < 3; i++) {
            const on = (ctx.t * 2.4 - i * 0.35) % 1.6 < 1.1;
            ctx.ellipse(-4 + i * 6, -108 - i * 1.5, 1.8, 1.8, {
                c: ctx.tint('#f5eddc', on ? tension.critical : 0),
            });
        }
        ctx.text('?', 17, -108, 15 + pop * 2, {
            fill: '#f5eddc',
            opts: {
                outline: { width: 1.6, color: '#28303b' },
            },
        });
    }
}
function riderBody(ctx: RenderCtx) {
    const C = ctx.C;
    ctx.polygon(PLAYER_OUTLINES.farLeg, '#4e5b70');
    ctx.polygon(
        [
            [35, 3],
            [42, 3],
            [50, 6],
            [55, 9],
            [52, 10],
            [35, 7],
        ],
        '#383f4e',
    );
    ctx.polygon(PLAYER_OUTLINES.nearLeg, '#5b6b80');
    ctx.polygon(
        [
            [-11, -25],
            [20, -24],
            [26, -21],
            [7, -20],
            [-10, -21],
        ],
        '#6d7b8e',
    );
    ctx.polygon(
        [
            [25, -18],
            [27, -17],
            [31, 10],
            [29, 10],
        ],
        '#49586c',
    );
    ctx.polygon(
        [
            [26, 11],
            [33, 10],
            [35, 15],
            [26, 16],
        ],
        '#383f4e',
    );
    ctx.polygon(PLAYER_OUTLINES.shirt, C.shirt);
    riderStains(ctx, ctx.soaks);
    ctx.polygon(
        [
            [-17, -62],
            [-11, -61],
            [-11, -24],
            [-17, -23],
        ],
        '#d9d6c5',
    );
    ctx.polygon(
        [
            [-7, -70],
            [4, -68],
            [5, -60],
            [1, -56],
            [-7, -62],
        ],
        '#d5b18b',
    );
    ctx.polygon(
        [
            [-9, -65],
            [0, -60],
            [6, -60],
            [4, -55],
            [0, -52],
            [-6, -57],
        ],
        '#fff6de',
    );
    ctx.polygon(
        [
            [1, -58],
            [5, -57],
            [5, -54],
            [8, -36],
            [6, -33],
            [1, -34],
            [2, -54],
        ],
        '#a65e44',
    );
}
function riderHead(ctx: RenderCtx) {
    const C = ctx.C;
    const state = ctx.state;
    ctx.polygon(PLAYER_OUTLINES.head, C.skin);
    ctx.polygon(
        [
            [-11, -76],
            [-7, -72],
            [1, -69],
            [11, -69],
            [11, -66],
            [2, -66],
            [-9, -69],
        ],
        '#d3b18c',
    );
    ctx.polygon(PLAYER_OUTLINES.hair, '#3c424f');
    ctx.polygon(
        [
            [-7, -93],
            [-4, -98],
            [3, -96],
        ],
        '#687380',
    );
    riderFaceStains(ctx, ctx.soaks);
    const notice =
        state.lossReason === 'focus'
            ? 0.5 + 0.5 * Math.sin(state.focusLossTime * 6)
            : state.focusNotice
              ? Math.sin(((1.7 - state.focusNotice.life) / 1.7) * Math.PI)
              : 0;
    const tension = focusTension(ctx);
    const glance = Math.max(notice, tension.drift, tension.lift);
    ctx.ellipse(-7, -81, 2.7, 3.4, {
        c: C.skin,
    });
    ctx.rect(10.4 - glance * 5, -84, 1.3, 2.2, '#446d82');
    ctx.rod(-5, -83.4, 14.8, -84.6, {
        w: 1.2,
        c: '#3a414b',
    });
    ctx.rod(15.2, -87.6, 15.2, -79, {
        w: 1.4,
        c: '#83c8e4',
    });
    ctx.rod(15.2, -87.8, 15.2, -86.9, {
        w: 1.7,
        c: '#50606a',
    });
    ctx.rod(15.2, -79.7, 15.2, -78.8, {
        w: 1.7,
        c: '#50606a',
    });
    ctx.rod(9, -71, 12, -71, {
        w: 1,
        c: '#9c775f',
    });
}
function riderArms(ctx: RenderCtx) {
    const C = ctx.C;
    const state = ctx.state;
    ctx.polygon(
        [
            [-17, -58],
            [-13, -60],
            [-9, -57],
            [-8, -35],
            [-18, -34],
        ],
        '#e6e0cc',
    );
    ctx.polygon(
        [
            [-19, -39],
            [-8, -39],
            [-8, -34],
            [-19, -33],
        ],
        '#fff6de',
    );
    ctx.polygon(
        [
            [-16, -34],
            [-9, -35],
            [23, -36],
            [25, -32],
            [-15, -27],
        ],
        C.skin,
    );
    ctx.polygon(
        [
            [-15, -29],
            [23, -33],
            [24, -32],
            [-15, -27],
        ],
        '#d3aa80',
    );
    ctx.polygon(PLAYER_OUTLINES.laptop, '#555f70');
    ctx.polygon(
        [
            [35, -55],
            [59, -55],
            [51, -35],
            [27, -35],
        ],
        '#a8b9c3',
    );
    ctx.rod(18, -29, 55, -29, {
        w: 3,
        c: C.steel,
    });
    const tap =
        state.lossReason === 'focus' || focusTension(ctx).stall
            ? 0
            : Math.sin(ctx.t * 24) * 1.8;
    ctx.polygon(
        [
            [17, -36],
            [23, -38],
            [30, -36],
            [34, -33],
            [31, -32],
            [26, -34],
            [18, -33],
        ],
        '#d3aa80',
    );
    ctx.polygon(
        [
            [21, -36 + tap],
            [25, -39 + tap],
            [30, -38 + tap],
            [35, -35 + tap],
            [36, -33 + tap],
            [33, -33 + tap],
            [29, -35 + tap],
            [23, -33 + tap],
        ],
        C.skin,
    );
}
function riderEffects(ctx: RenderCtx) {
    const C = ctx.C;
    const state = ctx.state;
    if (
        state.focusNotice?.kind === 'water' ||
        state.focusNotice?.kind === 'steam'
    ) {
        ctx.rod(7, -39, 44, -57, {
            w: 5,
            c: C.skin,
        });
    }
    if (ctx.saveFlash > 0) {
        ctx.rect(40, -52, 11, 11, '#e0ecd2');
        ctx.rect(42, -52, 6, 4, '#728a7b');
        ctx.rect(43, -45, 5, 3, '#728a7b');
    }
    if (ctx.paperFace > 0) {
        ctx.polygon(
            [
                [-13, -89],
                [13, -85],
                [10, -65],
                [-15, -69],
            ],
            C.paper,
        );
        ctx.rod(-8, -82, 9, -80, {
            w: 1,
            c: '#a8a79e',
        });
        ctx.rod(-8, -77, 7, -75, {
            w: 1,
            c: '#a8a79e',
        });
    }
    if (state.focusNotice?.kind === 'water') {
        riderSplash(ctx, state.focusNotice.life);
    }
    if (ctx.dirty) {
        for (let i = 0; i < 9; i++) {
            const x = -25 + ((i * 17) % 60);
            const y = -82 + ((i * 23) % 79);
            ctx.polygon(
                [
                    [x, y],
                    [x + 9, y - 4],
                    [x + 12, y + 6],
                    [x + 2, y + 8],
                ],
                ['#d6c998', '#85946b', '#a88e69'][i % 3],
            );
        }
        ctx.polygon(
            [
                [-14, -94],
                [-2, -104],
                [7, -94],
            ],
            '#c4ae73',
        );
        ctx.rod(-3, -98, 0, -88, {
            w: 2,
            c: '#849267',
        });
    }
}
export function debugCollisions(ctx: RenderCtx): void {
    if (!ART.debugCollisions) {
        return;
    }
    ctx.ox = ctx.player.x;
    ctx.oy = ctx.player.y;
    ctx.rotation = ctx.player.a;
    for (const part of LEVEL.playerContacts) {
        ctx.ripple(part.x, part.y, part.r, part.r, {
            width: 1,
            color: '#ff0055',
        });
    }
    ctx.ox = ctx.oy = ctx.rotation = 0;
}
