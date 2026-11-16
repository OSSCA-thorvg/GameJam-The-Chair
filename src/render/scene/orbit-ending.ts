import type { RenderCtx } from '../context';
import type { Vector } from '../types';
import type { OrbitState } from '../../game/stages/orbit/data';
import type { SkyProjection } from './sky-projection';
import { LABEL_FONT, SPEECH_FONT } from '../fonts';
import { translate } from '../../i18n';
import { panoramaX } from './orbit-heights';
import { laptopScreenPoint } from './sky-ending-art';

export const ORBIT_ENDING = {
    calm: 5, release: 1.2,
    focusFrom: 1.5, focus: 5,
    signal: 5, signalStep: 1.4, disconnect: 9.6,
    handsStop: 10.2, idle: 13.4,
    wideFrom: 13.4, wide: 17,
    spinFrom: 17, spin: 31,
    lightsOut: 33, dark: 37, end: 39,
};

const smooth = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
};

export function orbitEnding(orbit: Readonly<OrbitState>) {
    const t = orbit.phase === 'parked' ? Math.max(0, orbit.settled - 1) : 0;
    const E = ORBIT_ENDING;
    const wide = smooth((t - E.wideFrom) / (E.wide - E.wideFrom));
    const spin = smooth((t - E.spinFrom) / (E.spin - E.spinFrom));
    return {
        parked: orbit.phase === 'parked', t,
        calm: smooth(t / E.calm),
        centre: orbit.phase === 'parked' ? smooth(t / E.focusFrom) : 0,
        focus: smooth((t - E.focusFrom) / (E.focus - E.focusFrom)) * (1 - wide),
        wide,
        spin,
        swivel: spin,
        recline: smooth((t - E.spinFrom) / 4) * (1 - smooth((t - E.spin) / 2)),
        message: smooth((t - E.disconnect) / .3),
        read: smooth((t - E.disconnect + .3) / 1.2) * (1 - wide),
        rest: smooth((t - E.disconnect - .2) / .6),
        lightsOut: smooth((t - E.spin) / (E.lightsOut - E.spin)),
        dark: smooth((t - E.lightsOut) / (E.dark - E.lightsOut)),
        title: smooth((t - E.dark) / 1.2),
        loose: orbit.phase === 'parked' && t >= E.release ? t - E.release : -1,
        signalLost: Math.max(0, Math.min(3, (t - E.signal) / E.signalStep)),
        still: Math.max(0, t - E.handsStop),
    };
}
export type OrbitEndingState = ReturnType<typeof orbitEnding>;

const alpha = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0');

export function endingNebula(ctx: RenderCtx, strength: number, spin = 0, bottom = ctx.H) {
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
        if (cy - radius >= bottom) continue;
        const lower = Math.min(cy + radius, bottom);
        ctx.commands.push({ kind: 'path', points: [[cx - radius, cy - radius], [cx + radius, cy - radius], [cx + radius, lower], [cx - radius, lower]],
            fill: { from: [cx, cy], to: [cx + radius, cy], radius, stops: [[0, ctx.rgba(color, opacity * strength)], [1, ctx.rgba(color, 0)]] }, layer });
    }
    for (const [px, y] of [[.82, .12], [.62, .08], [.9, .34], [.45, .18]]) {
        const cx = panoramaX(px, spin) * ctx.W, cy = y * ctx.H, ray = ctx.W * .008;
        if (cy - ray >= bottom) continue;
        const c = '#ffffff' + alpha(.9 * strength);
        ctx.commands.push({ kind: 'path', points: [[cx - ray, cy], [cx, cy - ray * .12], [cx + ray, cy], [cx, cy + ray * .12]], fill: c, layer });
        ctx.commands.push({ kind: 'path', points: [[cx, cy - ray], [cx + ray * .12, cy], [cx, cy + ray], [cx - ray * .12, cy]], fill: c, layer });
    }
}

export function endingChairLights(ctx: RenderCtx, chair: SkyProjection, e: OrbitEndingState) {
    if (!e.parked) return;
    const light = 1 - e.lightsOut;
    if (light > 0) {
        const [x, y] = chair.project([42, 14, 0]), r = ctx.H * .09;
        ctx.commands.push({ kind: 'path', points: [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]],
            fill: { from: [x, y], to: [x + r, y], radius: r, stops: [[0, ctx.rgba('#9fd4ff', .55 * light)], [1, ctx.rgba('#9fd4ff', 0)]] },
            layer: { key: 'orbit-laptop-light', blend: 'screen' } });
    }
}

export function endingFade(ctx: RenderCtx, e: OrbitEndingState) {
    if (e.dark <= 0) return;
    ctx.commands.push({ kind: 'path', points: [[0, 0], [ctx.W, 0], [ctx.W, ctx.H], [0, ctx.H]], fill: '#000000' + alpha(e.dark), layer: { key: 'orbit-ending-black' } });
    if (e.title <= 0) return;
    ctx.screenText('THE END', ctx.W / 2, ctx.H / 2, ctx.clamp(ctx.H * .055, 16, 40), '#efe6d2', { font: LABEL_FONT, opacity: e.title });
}

export function endingSignal(ctx: RenderCtx, head: Vector, e: OrbitEndingState) {
    const E = ORBIT_ENDING;
    const show = smooth((e.t - (E.signal - 1)) / .6) * (1 - smooth((e.t - (E.disconnect + .4)) / .8));
    if (!e.parked || show <= 0) return;
    const size = ctx.clamp(ctx.W / 55, 10, 20), [cx, cy] = [head[0] + size * 2.2, head[1] - size * .6];
    const lit = 3 - Math.floor(e.signalLost), flicker = e.signalLost % 1 > .55 && Math.floor(ctx.t * 8) % 2 === 0;
    const layer = { key: 'orbit-signal', opacity: show };
    ctx.commands.push({ kind: 'path', points: [[cx - size * .14, cy], [cx, cy - size * .14], [cx + size * .14, cy], [cx, cy + size * .14]], fill: '#ffffff', layer });
    for (let i = 0; i < 3; i++) {
        const r = size * (.42 + i * .36);
        const arc: Vector[] = Array.from({ length: 9 }, (_, k) => {
            const a = -Math.PI * .75 + k / 8 * Math.PI * .5;
            return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
        });
        const on = i < lit && !(i === lit - 1 && flicker);
        ctx.commands.push({ kind: 'path', points: arc, open: true, fill: null, stroke: { width: size * .16, color: on ? '#ffffff' : '#ffffff40', cap: 'round' }, layer });
    }
}

export function endingLaptopScreen(chair: SkyProjection, e: OrbitEndingState, bob: number) {
    if (!e.parked) return;
    const quad = (u0: number, v0: number, u1: number, v1: number, color: string, lift = .7) =>
        chair.polygon([laptopScreenPoint(u0, v0, bob, lift), laptopScreenPoint(u1, v0, bob, lift),
            laptopScreenPoint(u1, v1, bob, lift), laptopScreenPoint(u0, v1, bob, lift)], color);
    if (e.lightsOut >= 1) return quad(.04, .06, .96, .94, '#1b1f27');
    quad(.04, .06, .96, .94, e.lightsOut > .5 ? '#1b1f27' : '#dce8f2');
    if (e.lightsOut > .5) return;
    if (e.message < .5) for (let i = 0; i < 6; i++) {
        const v = .8 - i * .12, typing = i === 5 ? .3 + .5 * ((e.t - e.still) * .6 % 1) : .82;
        quad(.1, v - .025, .1 + .78 * typing, v + .025, '#8fa6ba');
    }
    if (e.message <= 0) return;
    quad(.05, .12, .95, .88, '#ffffff', 1.3);
    quad(.05, .8, .95, .88, '#c9d4de', 1.6);
    quad(.08, .44, .15, .56, '#d9534f', 1.6);
}

function twoLines(text: string): string[] {
    const spaces = [...text].flatMap((c, i) => c === ' ' ? [i] : []);
    if (!spaces.length) return [text];
    const cut = spaces.reduce((best, i) => Math.abs(i - text.length / 2) < Math.abs(best - text.length / 2) ? i : best);
    return [text.slice(0, cut), text.slice(cut + 1)];
}

export function endingLaptopText(ctx: RenderCtx, chair: SkyProjection, e: OrbitEndingState, bob: number) {
    if (!e.parked || e.message <= 0 || e.lightsOut > .5) return;
    const left = chair.project(laptopScreenPoint(.18, .48, bob)), right = chair.project(laptopScreenPoint(.74, .48, bob));
    const top = chair.project(laptopScreenPoint(.46, .76, bob)), bottom = chair.project(laptopScreenPoint(.46, .18, bob));
    const facing = (right[0] - left[0]) * (top[1] - left[1]) - (right[1] - left[1]) * (top[0] - left[0]);
    if (facing >= 0) return;
    const lines = twoLines(translate('orbit.disconnected', ctx.locale));
    const room = Math.hypot(right[0] - left[0], right[1] - left[1]), height = Math.hypot(top[0] - bottom[0], top[1] - bottom[1]);
    const widest = Math.max(...lines.map(line => ctx.measureText(line, 1, SPEECH_FONT)));
    const size = Math.min(height / (lines.length * 1.25), room / widest);
    if (size < 4) return;
    const rotation = Math.atan2(right[1] - left[1], right[0] - left[0]);
    lines.forEach((line, i) => {
        const v = .48 + (((lines.length - 1) / 2) - i) * .58 / lines.length;
        const at = chair.project(laptopScreenPoint(.46, v, bob));
        ctx.screenText(line, at[0], at[1], size, '#20242c', { font: SPEECH_FONT, opacity: e.message, rotation });
    });
}
