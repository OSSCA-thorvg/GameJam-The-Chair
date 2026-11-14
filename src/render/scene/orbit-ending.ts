import type { RenderCtx } from '../context';
import type { Vector } from '../types';
import type { OrbitState } from '../../game/stages/orbit/data';
import { PRAISE_KINDS, praiseItem } from './orbit-praise';
import type { Point3, SkyProjection } from './sky-projection';
import { LABEL_FONT, SPEECH_FONT } from '../fonts';
import { translate } from '../../i18n';
import { panoramaX } from './orbit-heights';

// The ending, played while the chair is parked in the Earth's shadow, starting from the frame 5-3 ended on:
// the spray dies down and the extinguisher floats away while the camera leans in over the rider's shoulder to the
// laptop he is still typing on. Its signal drops bar by bar until 'Network connection lost.' comes up on the
// screen; his hands lift off the keys and stop, and for the first time he does nothing at all. The camera pulls
// back onto the wide horizon and circles once round the chair, which slowly swivels and leans back as if to take
// in space, while he keeps staring at the dead screen. Then the laptop goes dark, everything fades out, and a
// small THE END on black.
export const ORBIT_ENDING = {
    calm: 5, release: 1.2,
    /** The camera leans in over the rider's shoulder to the laptop screen. */
    focusFrom: 1.5, focus: 5,
    signal: 5, signalStep: 1.4, disconnect: 9.6,
    /** The hands lift off the keys and stop; then a held moment of nothing. */
    handsStop: 10.2, idle: 13.4,
    /** Pulling back onto the wide horizon. */
    wideFrom: 13.4, wide: 17,
    /** The camera circles the chair once (360 degrees) while the chair itself swivels round and leans back. */
    spinFrom: 17, spin: 31,
    lightsOut: 33, dark: 37, end: 39,
};

const smooth = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
};

/** How far the ending has played; all zero while the chair is still flying. */
export function orbitEnding(orbit: Readonly<OrbitState>) {
    const t = orbit.phase === 'parked' ? Math.max(0, orbit.settled - 1) : 0;
    const E = ORBIT_ENDING;
    const wide = smooth((t - E.wideFrom) / (E.wide - E.wideFrom));
    const spin = smooth((t - E.spinFrom) / (E.spin - E.spinFrom));
    return {
        parked: orbit.phase === 'parked', t,
        calm: smooth(t / E.calm),
        /** How close the camera has leaned in over the rider's shoulder (it lets go as the shot widens). */
        focus: smooth((t - E.focusFrom) / (E.focus - E.focusFrom)) * (1 - wide),
        wide,
        /** How far the camera's full circle round the chair has gone (0 to 1). */
        spin,
        /** How far the chair has swivelled round and leaned back to look out into space (0 to 1). */
        swivel: spin,
        recline: smooth((t - E.spinFrom) / 4) * (1 - smooth((t - E.spin) / 2)),
        /** The connection-lost window on the laptop screen. */
        message: smooth((t - E.disconnect) / .3),
        /** How far the rider's hands have lifted off the keys. */
        rest: smooth((t - E.disconnect - .2) / .6),
        lightsOut: smooth((t - E.spin) / (E.lightsOut - E.spin)),
        dark: smooth((t - E.lightsOut) / (E.dark - E.lightsOut)),
        title: smooth((t - E.dark) / 1.2),
        /** Seconds since the extinguisher came off (negative while it is still on). */
        loose: orbit.phase === 'parked' && t >= E.release ? t - E.release : -1,
        /** Wi-Fi bars lost so far (0 to 3), counting up once the signal starts to drop. */
        signalLost: Math.max(0, Math.min(3, (t - E.signal) / E.signalStep)),
        /** Seconds the rider has been still: typing and bobbing stop once his hands come off the keys. */
        still: Math.max(0, t - E.handsStop),
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
        // Between the screen and the rider's face.
        const [x, y] = chair.project([42, 14, 0]), r = ctx.H * .09;
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

/** A point on the laptop screen: `u` across (0 left to 1 right), `v` up, lifted just off the lid towards the rider. */
function screenPoint(u: number, v: number): Point3 {
    // The screen on the laptop lid faces the rider: from just above the hinge (47, 1) up to (53.6, 25), 40 wide.
    const lift = .7;
    return [47 + 6.6 * v - .96 * lift, 1 + 24 * v + .26 * lift, -20 + 40 * u];
}

/**
 * The laptop screen, built onto the lid as faces of the chair drawing so the rider's head hides it where it should:
 * the spreadsheet he is still typing into, the 'Network connection lost.' window over it, and nothing once the laptop
 * goes dark. Its words go on top afterwards (`endingLaptopText`).
 */
export function endingLaptopScreen(chair: SkyProjection, e: OrbitEndingState) {
    if (!e.parked) return;
    const quad = (u0: number, v0: number, u1: number, v1: number, color: string) =>
        chair.polygon([screenPoint(u0, v0), screenPoint(u1, v0), screenPoint(u1, v1), screenPoint(u0, v1)], color + 'ff');
    if (e.lightsOut >= 1) return quad(.04, .06, .96, .94, '#1b1f27');
    quad(.04, .06, .96, .94, e.lightsOut > .5 ? '#1b1f27' : '#dce8f2');
    if (e.lightsOut > .5) return;
    // Rows of figures still being typed in; the last one grows until the hands stop.
    for (let i = 0; i < 6; i++) {
        const v = .8 - i * .12, typing = i === 5 ? .3 + .5 * ((e.t - e.still) * .6 % 1) : .82;
        quad(.1, v - .025, .1 + .78 * typing, v + .025, '#8fa6ba');
    }
    if (e.message <= 0) return;
    // The connection-lost window over the sheet, with a red warning dot.
    quad(.1, .26, .9, .7, '#ffffff');
    quad(.1, .62, .9, .7, '#c9d4de');
    quad(.15, .4, .23, .48, '#d9534f');
}

/** The connection-lost line on the laptop screen, written after the chair so it sits on the window. */
export function endingLaptopText(ctx: RenderCtx, chair: SkyProjection, e: OrbitEndingState) {
    if (!e.parked || e.message <= 0 || e.lightsOut > .5) return;
    const left = chair.project(screenPoint(.27, .44)), right = chair.project(screenPoint(.8, .44));
    const top = chair.project(screenPoint(.55, .6)), bottom = chair.project(screenPoint(.55, .28));
    // Seen from the back of the lid, the screen faces away: nothing to read.
    const facing = (right[0] - left[0]) * (top[1] - left[1]) - (right[1] - left[1]) * (top[0] - left[0]);
    if (facing >= 0) return;
    const text = translate('orbit.disconnected', ctx.locale);
    const room = Math.hypot(right[0] - left[0], right[1] - left[1]);
    const size = Math.min(Math.hypot(top[0] - bottom[0], top[1] - bottom[1]) * .32, room / ctx.measureText(text, 1, SPEECH_FONT));
    if (size < 4) return;
    const centre = chair.project(screenPoint(.535, .44));
    ctx.screenText(text, centre[0], centre[1], size, '#2b2f3a', {
        font: SPEECH_FONT, opacity: e.message, rotation: Math.atan2(right[1] - left[1], right[0] - left[0]),
    });
}
