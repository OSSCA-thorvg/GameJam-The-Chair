import type { RenderCtx } from '../context';
import type { Vector } from '../types';
import type { OrbitState } from '../../game/stages/orbit/data';
import { PRAISE_KINDS, praiseItem } from './orbit-praise';
import type { SkyProjection } from './sky-projection';
import { LABEL_FONT } from '../fonts';
import { panoramaX } from './orbit-heights';

// The ending, played while the chair is parked in the Earth's shadow, starting from the frame 5-3 ended on:
// the spray dies down and the extinguisher comes off and floats away into space; the sun comes up over the rim
// while the camera pulls back; the laptop's signal drops bar by bar until the network is lost; the laptop goes
// dark, the hands stop, the camera slowly circles the chair once to take in the whole view, everything fades out,
// and a small THE END on black.
export const ORBIT_ENDING = {
    calm: 5, release: 1.2, wideFrom: 3, signal: 5, signalStep: 1.5, disconnect: 9.8, wide: 11,
    /** After the network is lost the camera makes one slow full circle (360 degrees) around the chair. */
    spinFrom: 11, spin: 27,
    lightsOut: 29, dark: 33, end: 35,
};

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
        /** How far the camera's full circle round the chair has gone (0 to 1). */
        spin: smooth((t - E.spinFrom) / (E.spin - E.spinFrom)),
        lightsOut: smooth((t - E.spin) / (E.lightsOut - E.spin)),
        dark: smooth((t - E.lightsOut) / (E.dark - E.lightsOut)),
        title: smooth((t - E.dark) / 1.2),
        /** Seconds since the extinguisher came off (negative while it is still on). */
        loose: orbit.phase === 'parked' && t >= E.release ? t - E.release : -1,
        /** Wi-Fi bars lost so far (0 to 3), counting up once the signal starts to drop. */
        signalLost: Math.max(0, Math.min(3, (t - E.signal) / E.signalStep)),
        /** Seconds the rider has been still: typing and bobbing stop once the screen goes dark. */
        still: Math.max(0, t - E.wide),
    };
}
export type OrbitEndingState = ReturnType<typeof orbitEnding>;

const alpha = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0');

/** A soft violet and rose nebula in the upper right, as in the storyboard; it swings past as the camera circles. */
export function endingNebula(ctx: RenderCtx, strength: number, spin = 0) {
    if (strength <= 0) return;
    const layer = { key: 'orbit-nebula', blend: 'screen' as const };
    const clouds: [number, number, number, string, number][] = [
        [.68, .2, .34, '#5b3fb0', .55], [.8, .14, .22, '#c25a86', .5], [.55, .3, .26, '#3d2f8a', .45],
        [.88, .26, .18, '#e07a8c', .35], [.73, .1, .14, '#f2a3b8', .3],
    ];
    for (const [px, y, r, color, opacity] of clouds) {
        const x = panoramaX(px, spin);
        if (x < -r - .2 || x > 1 + r + .2) continue;
        const cx = x * ctx.W, cy = y * ctx.H, radius = r * ctx.W;
        ctx.commands.push({ v: [[cx - radius, cy - radius], [cx + radius, cy - radius], [cx + radius, cy + radius], [cx - radius, cy + radius]],
            c: { from: [cx, cy], to: [cx + radius, cy], radius, stops: [[0, ctx.rgba(color, opacity * strength)], [1, ctx.rgba(color, 0)]] }, layer });
    }
    for (const [px, y] of [[.82, .12], [.62, .08], [.9, .34], [.45, .18]]) {
        const cx = panoramaX(px, spin) * ctx.W, cy = y * ctx.H, ray = ctx.W * .008;
        const c = '#ffffff' + alpha(.9 * strength);
        ctx.commands.push({ v: [[cx - ray, cy], [cx, cy - ray * .12], [cx + ray, cy], [cx, cy + ray * .12]], c, layer });
        ctx.commands.push({ v: [[cx, cy - ray], [cx + ray * .12, cy], [cx, cy + ray], [cx - ray * .12, cy]], c, layer });
    }
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
    ctx.screenText('THE END', ctx.W / 2, ctx.H / 2, ctx.clamp(ctx.H * .055, 16, 40), '#efe6d2', { font: LABEL_FONT, opacity: e.title });
}

/** The laptop's Wi-Fi above the rider's head, losing a bar at a time; the next bar to go flickers first. */
export function endingSignal(ctx: RenderCtx, head: Vector, e: OrbitEndingState) {
    const E = ORBIT_ENDING;
    const show = smooth((e.t - (E.signal - 1)) / .6) * (1 - smooth((e.t - (E.disconnect + .4)) / .8));
    if (!e.parked || show <= 0) return;
    const size = ctx.clamp(ctx.W / 55, 10, 20), [cx, cy] = [head[0] + size * 2.2, head[1] - size * .6];
    const lit = 3 - Math.floor(e.signalLost), flicker = e.signalLost % 1 > .55 && Math.floor(ctx.t * 8) % 2 === 0;
    const layer = { key: 'orbit-signal', opacity: show };
    ctx.commands.push({ v: [[cx - size * .14, cy], [cx, cy - size * .14], [cx + size * .14, cy], [cx, cy + size * .14]], c: '#ffffff', layer });
    for (let i = 0; i < 3; i++) {
        const r = size * (.42 + i * .36);
        const arc: Vector[] = Array.from({ length: 9 }, (_, k) => {
            const a = -Math.PI * .75 + k / 8 * Math.PI * .5;
            return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
        });
        const on = i < lit && !(i === lit - 1 && flicker);
        ctx.commands.push({ v: arc, open: true, c: null, stroke: { width: size * .16, color: on ? '#ffffff' : '#ffffff40', cap: 'round' }, layer });
    }
}
