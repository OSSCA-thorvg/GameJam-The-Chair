import type { RenderCtx } from '../../context';
import type { OpeningFrame } from './timeline';
import { linear, mix, radial, screenRect } from './shapes';

// Office lighting for the cutscene (sunset → night) and the chair's moods (humming, rage).

/** Low sun through the back windows: warm shafts that fade as the evening goes on. */
export function drawSunbeams(ctx: RenderCtx, frame: OpeningFrame) {
    const strength = (1 - frame.dusk) * frame.lighting;
    if (strength <= 0) return;
    const F = ctx.F;
    ctx.beginLayer({ key: 'opening-sunbeams', blend: 'screen', blur: 6, opacity: strength * .7 });
    for (let i = Math.floor(ctx.cam / 235) - 1; i < (ctx.cam + ctx.VW) / 235 + 1; i++) {
        const x = i * 235;
        ctx.gradientPolygon([[x + 30, 100], [x + 200, 100], [x + 380, F], [x + 160, F]],
            ctx.gradientFill(0, 100, 0, F, [[0, '#ffc98a'], [1, '#ffc98a00']], .55));
    }
    ctx.endLayer();
}

/** Multiply tint over the office, then the laptop's glow and a vignette on top of the darkness. */
export function drawOfficeLight(ctx: RenderCtx, frame: OpeningFrame) {
    const { dusk, lighting } = frame;
    if (lighting <= 0) return;
    ctx.beginLayer({ key: 'opening-dusk', blend: 'multiply', opacity: lighting * (.5 + dusk * .38) });
    screenRect(ctx, mix('#f4b98c', '#2e3766', dusk));
    ctx.endLayer();

    const p = ctx.p;
    if (dusk > 0) {
        const [lx, ly] = ctx.screenPoint(p.x + 44, p.y - 46);
        const r = 130 * ctx.scale;
        ctx.beginLayer({ key: 'opening-laptop', blend: 'add', opacity: lighting * dusk * .85 });
        screenRect(ctx, radial(ctx, lx, ly, r, [[0, '#9fd2ff'], [.25, '#6fa9e099'], [1, '#2a3b6000']]));
        ctx.endLayer();
    }
    const vignette = lighting * Math.max(dusk * .55, frame.rage * .9);
    if (vignette > 0) {
        const r = Math.hypot(ctx.W, ctx.H) / 2;
        ctx.beginLayer({ key: 'opening-vignette', opacity: vignette });
        screenRect(ctx, radial(ctx, ctx.W / 2, ctx.H / 2, r, [[0, '#0b0d1800'], [.55, '#0b0d1800'], [1, '#0b0d18e0']]));
        ctx.endLayer();
    }
}

/** The chair's moods around it: 6 pm joy, 7 pm creaks, 8 pm anger marks and the 9 pm rage. */
export function drawChairMood(ctx: RenderCtx, frame: OpeningFrame) {
    drawDeskClutter(ctx, frame);
    if (frame.hum > 0) drawJoy(ctx, frame);
    if (frame.creakPulse > 0) drawCreak(ctx, frame);
    if (frame.anger > 0) drawAngerMarks(ctx, frame.t, frame.anger);
    if (frame.rage > 0) drawRage(ctx, frame);
}

/** One musical note at the current origin, `big` doubling it into a pair of beamed quavers. */
function note(ctx: RenderCtx, color: string, big: boolean) {
    ctx.ellipse(0, 0, 3.6, 2.7, color);
    ctx.rod(3, -1, 3, -13, 1.4, color);
    if (!big) ctx.polygon([[3, -13], [9, -9], [9, -6], [3, -9]], color);
    else {
        ctx.ellipse(9, 2, 3.6, 2.7, color);
        ctx.rod(12, 1, 12, -11, 1.4, color);
        ctx.rod(3, -13, 12, -11, 2.2, color);
    }
}

/** 6 pm: notes bubbling up on both sides and sparkles twinkling round the dancing chair. */
function drawJoy(ctx: RenderCtx, frame: OpeningFrame) {
    const p = ctx.p, t = frame.t;
    ctx.beginLayer({ key: 'opening-notes', opacity: frame.hum });
    for (let i = 0; i < 5; i++) {
        const u = (t * .9 + i / 5) % 1, side = i % 2 ? 1 : -1;
        ctx.ox = p.x + 10 + side * (45 + u * 30) + Math.sin(u * 7 + i) * 6;
        ctx.oy = p.y - 70 - u * 60;
        ctx.rotation = Math.sin(t * 5 + i) * .3;
        ctx.localScale = 1.2 + .3 * Math.sin(u * Math.PI);
        note(ctx, ctx.tint('#fff3d6', Math.sin(u * Math.PI)), i % 3 === 1);
    }
    ctx.ox = ctx.oy = ctx.rotation = 0;
    ctx.localScale = 1;
    for (let i = 0; i < 6; i++) {
        const angle = i / 6 * Math.PI * 2 + t * .8, twinkle = Math.max(0, Math.sin(t * 7 + i * 2.1));
        const cx = p.x + 8 + Math.cos(angle) * 78, cy = p.y - 40 + Math.sin(angle) * 58, r = 2 + 5 * twinkle;
        ctx.polygon([[cx, cy - r * 1.6], [cx + r * .35, cy - r * .35], [cx + r * 1.6, cy], [cx + r * .35, cy + r * .35],
            [cx, cy + r * 1.6], [cx - r * .35, cy + r * .35], [cx - r * 1.6, cy], [cx - r * .35, cy - r * .35]], ctx.tint('#ffe9a8', twinkle));
    }
    ctx.endLayer();
}

/** 7 pm: strain lines flicking out from the wheels and the backrest joint with every creak, longer as it worsens. */
function drawCreak(ctx: RenderCtx, frame: OpeningFrame) {
    const p = ctx.p, reach = 8 + 14 * frame.creak;
    ctx.beginLayer({ key: 'opening-creak', opacity: frame.creakPulse });
    for (const [x, y, aim] of [[-30, 26, Math.PI * .85], [30, 26, Math.PI * .15], [-30, -16, Math.PI * 1.1]]) {
        for (const spread of [-.45, 0, .45]) {
            const a = aim + spread, from = 9;
            ctx.rod(p.x + x + Math.cos(a) * from, p.y + y + Math.sin(a) * from,
                p.x + x + Math.cos(a) * (from + reach), p.y + y + Math.sin(a) * (from + reach), 2, '#fff3d6');
        }
    }
    ctx.endLayer();
}

/** 8 pm: throbbing red anger marks round the chair, the cartoon vein that needs no words. */
function drawAngerMarks(ctx: RenderCtx, t: number, anger: number) {
    const p = ctx.p;
    ctx.beginLayer({ key: 'opening-anger', opacity: anger });
    for (const [i, [x, y, size]] of [[-52, -60, 1.5], [62, -84, 1.1], [-58, 0, 1]].entries()) {
        angerMark(ctx, p.x + x, p.y + y, size * (1 + .25 * Math.max(0, Math.sin(t * 11 + i * 1.7))));
    }
    ctx.endLayer();
}

function angerMark(ctx: RenderCtx, x: number, y: number, scale: number) {
    ctx.ox = x;
    ctx.oy = y;
    ctx.localScale = scale;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.strokePath([sx * 2, sy * 8], [[sx * 3, sy * 3, sx * 3, sy * 3, sx * 8, sy * 2]], { width: 2.8, color: '#e0473a', cap: 'round' });
    }
    ctx.ox = ctx.oy = 0;
    ctx.localScale = 1;
}

/** 9 pm: the chair trembles (its afterimages are drawn with it) under a throbbing anger mark by the backrest. */
function drawRage(ctx: RenderCtx, frame: OpeningFrame) {
    const p = ctx.p, t = frame.t;
    ctx.beginLayer({ key: 'opening-rage', opacity: frame.rage });
    angerMark(ctx, p.x - 50, p.y - 8, 1 + .22 * Math.max(0, Math.sin(t * 13)));
    ctx.endLayer();
}

/** The nearest desk, where a mug and a stack of papers sit; they rattle when the chair shakes. */
const DESK = { left: 110, mug: 232, papers: 118 };

/**
 * A coffee mug and papers on the desk beside the chair. Calm all evening; at 9 pm the chair's rage rattles them,
 * the coffee rings out in ripples and dust jumps off the floor, while the worker types on.
 */
export function drawDeskClutter(ctx: RenderCtx, frame: OpeningFrame) {
    if (frame.lighting <= 0) return;
    const t = frame.t, shake = frame.rage, top = ctx.F - 105;
    ctx.beginLayer({ key: 'opening-desk-clutter', opacity: frame.lighting });
    for (let i = 0; i < 4; i++) {
        const jiggle = Math.sin(t * 47 + i * 1.9) * 1.6 * shake, hop = Math.abs(Math.sin(t * 29 + i)) * 1.4 * shake;
        ctx.rect(DESK.papers - i * .6 + jiggle, top - 3 - i * 2.2 - hop, 26, 2.2, i % 2 ? '#e9e4d4' : '#f4f0e4');
    }
    const dx = Math.sin(t * 58) * 1.8 * shake, dy = -Math.abs(Math.sin(t * 33)) * 2 * shake;
    const x = DESK.mug + dx, y = top + dy;
    ctx.rod(x + 9, y - 13, x + 13, y - 8, 2.2, '#c9614f');
    ctx.rect(x - 8, y - 17, 16, 17, '#d8694f');
    ctx.ellipse(x, y - 17, 8, 2.4, '#6b4330');
    for (let k = 0; k < 2; k++) {
        const ring = (t * 3 + k * .5) % 1;
        ctx.ellipse(x, y - 17, 2 + 6 * ring, .6 + 1.8 * ring, ctx.tint('#e8c9a2', shake * (1 - ring)));
    }
    ctx.endLayer();
    if (shake > 0) floorDust(ctx, t, shake);
}

/** Dust hopping off the floor round the trembling wheels. */
function floorDust(ctx: RenderCtx, t: number, shake: number) {
    const p = ctx.p;
    ctx.beginLayer({ key: 'opening-floor-dust', opacity: shake });
    for (let i = 0; i < 6; i++) {
        const u = (t * 2.6 + i / 6) % 1, side = i % 2 ? 1 : -1;
        const x = p.x + side * (22 + i * 4 + u * 10), y = ctx.F + 2 - Math.sin(u * Math.PI) * (8 + i % 3 * 4);
        ctx.ellipse(x, y, 1.8, 1.4, ctx.tint('#c9c3b4', 1 - u));
    }
    ctx.endLayer();
}

/** Hard white flash when the rage line hits. */
export function drawRageFlash(ctx: RenderCtx, frame: OpeningFrame, since: number) {
    const age = frame.t - since;
    if (age < 0 || age > .25) return;
    ctx.beginLayer({ key: 'opening-flash', blend: 'screen', opacity: (1 - age / .25) * .6 });
    screenRect(ctx, linear(ctx, [0, 0], [0, ctx.H], [[0, '#ffffff'], [1, '#ffe2d0']]));
    ctx.endLayer();
}
