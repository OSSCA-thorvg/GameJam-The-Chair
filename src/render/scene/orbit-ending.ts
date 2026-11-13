import type { RenderCtx } from '../context';
import type { Vector } from '../types';
import type { OrbitState } from '../../game/stages/orbit/data';
import { PRAISE_KINDS, praiseItem } from './orbit-praise';
import type { SkyProjection } from './sky-projection';

// The ending, played while the chair is parked in the Earth's shadow (storyboard 05–08):
// 05 the spray dies down and the last praise drifts away; 06 the shadow lifts onto a wide blue horizon under
// a nebula while the camera pulls back; 07 the laptop goes dark, the hands stop, and everything fades out;
// 08 a small THE END on black. It starts from the frame 5-3 ended on, so the hand-off is seamless.
export const ORBIT_ENDING = { calm: 5, wideFrom: 3, wide: 11, lightsOut: 14, dark: 18, end: 20 };

const smooth = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
};

/** How far the ending has played; all zero while the chair is still flying. */
export function orbitEnding(orbit: Readonly<OrbitState>) {
    const t = orbit.phase === 'parked' ? Math.max(0, orbit.settled - 1) : 0;
    const E = ORBIT_ENDING;
    return {
        parked: orbit.phase === 'parked', t,
        calm: smooth(t / E.calm),
        wide: smooth((t - E.wideFrom) / (E.wide - E.wideFrom)),
        lightsOut: smooth((t - E.wide) / (E.lightsOut - E.wide)),
        dark: smooth((t - E.lightsOut) / (E.dark - E.lightsOut)),
        title: smooth((t - E.dark) / 1.2),
        /** Seconds the rider has been still: typing and bobbing stop once the screen goes dark. */
        still: Math.max(0, t - E.wide),
    };
}
export type OrbitEndingState = ReturnType<typeof orbitEnding>;

const alpha = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0');

/** A soft violet and rose nebula in the upper right, as in the storyboard. */
export function endingNebula(ctx: RenderCtx, strength: number) {
    if (strength <= 0) return;
    const layer = { key: 'orbit-nebula', blend: 'screen' as const };
    const clouds: [number, number, number, string, number][] = [
        [.68, .2, .34, '#5b3fb0', .55], [.8, .14, .22, '#c25a86', .5], [.55, .3, .26, '#3d2f8a', .45],
        [.88, .26, .18, '#e07a8c', .35], [.73, .1, .14, '#f2a3b8', .3],
    ];
    for (const [x, y, r, color, opacity] of clouds) {
        const cx = x * ctx.W, cy = y * ctx.H, radius = r * ctx.W;
        ctx.commands.push({ v: [[cx - radius, cy - radius], [cx + radius, cy - radius], [cx + radius, cy + radius], [cx - radius, cy + radius]],
            c: { from: [cx, cy], to: [cx + radius, cy], radius, stops: [[0, ctx.rgba(color, opacity * strength)], [1, ctx.rgba(color, 0)]] }, layer });
    }
    for (const [x, y] of [[.82, .12], [.62, .08], [.9, .34], [.45, .18]]) {
        const cx = x * ctx.W, cy = y * ctx.H, ray = ctx.W * .008;
        const c = '#ffffff' + alpha(.9 * strength);
        ctx.commands.push({ v: [[cx - ray, cy], [cx, cy - ray * .12], [cx + ray, cy], [cx, cy + ray * .12]], c, layer });
        ctx.commands.push({ v: [[cx, cy - ray], [cx + ray * .12, cy], [cx, cy + ray], [cx - ray * .12, cy]], c, layer });
    }
}

/** Chair camera framing: from the flight framing toward a smaller chair sitting just above the horizon. */
export function endingChairFraming(ctx: RenderCtx, flight: { zoom: number; centerY: number; offsetX: number; roll: number }, e: OrbitEndingState) {
    const mix = (a: number, b: number) => a + (b - a) * e.wide;
    return { zoom: mix(flight.zoom, .5), centerY: mix(flight.centerY, .64), offsetX: mix(flight.offsetX, 0), roll: mix(flight.roll, 0) };
}

/** The laptop's blue light on the rider while the screen is on, and the last praise drifting away behind. */
export function endingChairLights(ctx: RenderCtx, chair: SkyProjection, e: OrbitEndingState) {
    if (!e.parked) return;
    const light = 1 - e.lightsOut;
    if (light > 0) {
        const [x, y] = chair.project([36, 20, 0]), r = ctx.H * .09;
        ctx.commands.push({ v: [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]],
            c: { from: [x, y], to: [x + r, y], radius: r, stops: [[0, ctx.rgba('#9fd4ff', .55 * light)], [1, ctx.rgba('#9fd4ff', 0)]] },
            layer: { key: 'orbit-laptop-light', blend: 'screen' } });
    }
    const drift = 1 - e.calm;
    if (drift <= 0) return;
    const [cx, cy] = chair.project([0, 0, 0]);
    for (let i = 0; i < 7; i++) {
        const away = e.calm * (1 + i * .15);
        const at: Vector = [cx - ctx.W * (.08 + .5 * away) + i * ctx.W * .03, cy - ctx.H * (.05 + .25 * away) + (i % 3) * ctx.H * .05];
        const size = ctx.H / 45 * (1 - .7 * e.calm);
        inFade(ctx, drift, () => praiseItem(ctx, PRAISE_KINDS[i % PRAISE_KINDS.length], at, size, ctx.t * .8 + i));
    }
}

function inFade(ctx: RenderCtx, opacity: number, draw: () => void) {
    const from = ctx.commands.length;
    draw();
    for (let i = from; i < ctx.commands.length; i++) if (!ctx.commands[i].layer) ctx.commands[i] = { ...ctx.commands[i], layer: { key: 'orbit-ending-drift', opacity } };
}

/** Everything fades to black, then a small THE END. */
export function endingFade(ctx: RenderCtx, e: OrbitEndingState) {
    if (e.dark <= 0) return;
    ctx.commands.push({ v: [[0, 0], [ctx.W, 0], [ctx.W, ctx.H], [0, ctx.H]], c: '#000000' + alpha(e.dark), layer: { key: 'orbit-ending-black' } });
    if (e.title <= 0) return;
    const lg = ctx.lg, size = ctx.clamp(ctx.H * .055, 16, 40);
    lg.save();
    lg.globalAlpha = e.title;
    lg.font = `500 ${size}px system-ui,sans-serif`;
    lg.textAlign = 'center';
    lg.textBaseline = 'middle';
    lg.fillStyle = '#efe6d2';
    lg.fillText('THE END', ctx.W / 2, ctx.H / 2);
    lg.restore();
}
