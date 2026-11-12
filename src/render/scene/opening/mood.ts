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

/** Musical notes while the chair hums, an anger mark and quivering lines while it rages. */
export function drawChairMood(ctx: RenderCtx, frame: OpeningFrame) {
    const p = ctx.p;
    const t = frame.t;
    if (frame.hum > 0) {
        ctx.beginLayer({ key: 'opening-notes', opacity: frame.hum });
        for (let i = 0; i < 3; i++) {
            const u = (t * .75 + i / 3) % 1;
            const fade = Math.sin(u * Math.PI);
            ctx.ox = p.x - 40 - u * 34 + Math.sin(u * 7 + i) * 6;
            ctx.oy = p.y - 66 - u * 52;
            ctx.rotation = Math.sin(t * 4 + i) * .2;
            const color = ctx.tint('#fff3d6', fade);
            ctx.ellipse(0, 0, 3.6, 2.7, color);
            ctx.rod(3, -1, 3, -13, 1.4, color);
            if (i !== 1) ctx.polygon([[3, -13], [9, -9], [9, -6], [3, -9]], color);
            else {
                ctx.ellipse(9, 2, 3.6, 2.7, color);
                ctx.rod(12, 1, 12, -11, 1.4, color);
                ctx.rod(3, -13, 12, -11, 2.2, color);
            }
        }
        ctx.ox = ctx.oy = ctx.rotation = 0;
        ctx.endLayer();
    }
    if (frame.rage > 0) {
        const rage = frame.rage;
        ctx.beginLayer({ key: 'opening-rage', opacity: rage });
        // Quivering dashed arcs on both sides of the chair.
        for (const side of [-1, 1]) {
            for (let k = 0; k < 2; k++) {
                const x = p.x + (side < 0 ? -50 - k * 9 : 70 + k * 9);
                ctx.strokePath([x, p.y - 72], [[x + side * 12, p.y - 50, x + side * 12, p.y - 10, x, p.y + 12]],
                    { width: 2.2 - k * .6, color: '#ffe2c0', cap: 'round', dash: [5, 6], dashOffset: t * 40 * (k ? -1 : 1) });
            }
        }
        // Anger mark beside the backrest, throbbing.
        ctx.ox = p.x - 50;
        ctx.oy = p.y - 8;
        ctx.localScale = 1 + .22 * Math.max(0, Math.sin(t * 13));
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            ctx.strokePath([sx * 2, sy * 8], [[sx * 3, sy * 3, sx * 3, sy * 3, sx * 8, sy * 2]], { width: 2.8, color: '#e0473a', cap: 'round' });
        }
        ctx.ox = ctx.oy = 0;
        ctx.localScale = 1;
        ctx.endLayer();
    }
}

/** Hard white flash when the rage line hits. */
export function drawRageFlash(ctx: RenderCtx, frame: OpeningFrame, since: number) {
    const age = frame.t - since;
    if (age < 0 || age > .25) return;
    ctx.beginLayer({ key: 'opening-flash', blend: 'screen', opacity: (1 - age / .25) * .6 });
    screenRect(ctx, linear(ctx, [0, 0], [0, ctx.H], [[0, '#ffffff'], [1, '#ffe2d0']]));
    ctx.endLayer();
}
