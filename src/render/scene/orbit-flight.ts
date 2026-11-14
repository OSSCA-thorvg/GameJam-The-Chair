import type { RenderCtx } from '../context';
import type { DrawCommand, Vector } from '../types';
import { STAGE_FIVE as C } from '../../game/stages/orbit/data';
import { seeded } from './cloud-art';
import type { Point3, SkyProjection } from './sky-projection';
import type { RoutePoint } from './orbit-watch';

// What makes stage five read as flight through space: office papers drifting past close by, coffee cups to go
// out of the way for, the company geofence at the edge of the play area, and speed lines when the chair is fast.
// Scenery only, except the cups, which the course collects by the same positions.

const alpha = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0');

type Debris = { x: number; y: number; z: number; kind: 'paper' | 'note' | 'folder'; spin: number; tumble: number; phase: number };

/** How much route the drifting papers repeat over, and how far behind the chair they are still in view. */
const DEBRIS_SPAN = 2600, DEBRIS_BEHIND = 600;

const DEBRIS: Debris[] = (() => {
    const random = seeded(5531);
    return Array.from({ length: 34 }, (_, i) => {
        const near = i % 3 === 0;
        // Close ones pass just beside the chair; the rest fill the space around the route.
        const across = near ? 95 + random() * 120 : 200 + random() * 520;
        const up = near ? (random() - .5) * 260 : (random() - .5) * 760;
        const kinds = ['paper', 'paper', 'note', 'folder'] as const;
        return { x: (i % 2 ? 1 : -1) * across, y: up, z: random() * DEBRIS_SPAN, kind: kinds[Math.floor(random() * kinds.length)],
            spin: (random() - .5) * 2.4, tumble: .6 + random() * 1.4, phase: random() * 6.3 };
    });
})();

const SIZES = { paper: [22, 30], note: [13, 13], folder: [30, 24] } as const;
const COLORS = { paper: '#f4efe2', note: '#f7d85c', folder: '#d9b26a' } as const;

/** Office papers drifting along the route; the nearest pass right beside the chair. `presence` fades them in. */
export function orbitDebris(view: SkyProjection, point: RoutePoint, travel: number, t: number, presence = 1) {
    if (presence <= 0) return;
    // An alpha suffix also keeps both sides of a sheet visible (opaque 7-digit colours are back-face culled).
    const tint = alpha(presence);
    for (const item of DEBRIS) {
        const z = travel - DEBRIS_BEHIND + ((((item.z - travel + DEBRIS_BEHIND) % DEBRIS_SPAN) + DEBRIS_SPAN) % DEBRIS_SPAN);
        const center = point(item.x, item.y + Math.sin(t * .8 + item.phase) * 10, z);
        const [w, h] = SIZES[item.kind];
        const a = t * item.spin + item.phase, b = t * item.tumble + item.phase;
        // A sheet tumbling about two axes: its two edge vectors turn with time.
        const u: Point3 = [Math.cos(a) * w / 2, Math.sin(a) * Math.cos(b) * w / 2, Math.sin(a) * Math.sin(b) * w / 2];
        const v: Point3 = [-Math.sin(a) * h / 2, Math.cos(a) * Math.cos(b) * h / 2, Math.cos(a) * Math.sin(b) * h / 2];
        const corner = (su: number, sv: number): Point3 => [center[0] + u[0] * su + v[0] * sv, center[1] + u[1] * su + v[1] * sv, center[2] + u[2] * su + v[2] * sv];
        view.polygon([corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], COLORS[item.kind] + tint);
        if (item.kind === 'paper') for (const line of [-.4, 0, .4]) {
            view.polygon([corner(-.7, line - .05), corner(.7, line - .05), corner(.7, line + .05), corner(-.7, line + .05)], '#b9b3a3' + tint);
        }
    }
}

/** The cups still floating ahead, and the soft glow that marks each one from afar. */
export function orbitCoffee(ctx: RenderCtx, view: SkyProjection, point: RoutePoint, travel: number, drunk: number, t: number, presence = 1) {
    const glows: { at: Point3; size: number }[] = [];
    if (presence <= 0) return () => {};
    const tint = presence >= 1 ? '' : alpha(presence);
    C.coffee.cups.forEach((cup, i) => {
        if (drunk & (1 << i) || cup.z < travel - 300 || cup.z - travel > 4200) return;
        const bob = Math.sin(t * 1.4 + i) * 8;
        const base = point(cup.x, cup.y + bob - 22, cup.z), top = point(cup.x, cup.y + bob + 22, cup.z);
        view.rod(base, top, 20, '#f5f1e8' + tint);
        view.oval(top, [19, 4, 19], '#5a3a26' + tint);
        view.rod(point(cup.x + 20, cup.y + bob + 10, cup.z), point(cup.x + 32, cup.y + bob - 4, cup.z), 4, '#f5f1e8' + tint);
        view.oval(point(cup.x, cup.y + bob - 4, cup.z), [21, 9, 21], '#c94a3c' + tint);
        glows.push({ at: point(cup.x, cup.y + bob, cup.z), size: 1 });
    });
    return () => {
        const layer = { key: 'orbit-coffee-glow', blend: 'screen' as const };
        for (const { at } of glows) {
            if (view.depth(at) < 80) continue;
            const [x, y] = view.project(at);
            const r = ctx.clamp(42000 / view.depth(at), 14, 90) * (1 + .12 * Math.sin(t * 3));
            ctx.commands.push({ v: [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]], layer,
                c: { from: [x, y], to: [x + r, y], radius: r, stops: [[0, ctx.rgba('#ffe7b0', .7 * presence)], [1, ctx.rgba('#ffe7b0', 0)]] } });
        }
    };
}

/**
 * At the edge of the play area the chair pushes back on its own: the extinguisher coughs puffs outward (the
 * recoil carries it back in) and the chair shudders. `edge` is how hard it is pressing out, `out` which way
 * (across, up). Drawn in the chair's own model, so the puffs sort with the chair.
 */
export function orbitEdgePuffs(chair: SkyProjection, edge: number, out: { x: number; y: number }, t: number) {
    if (edge <= .02) return;
    const len = Math.hypot(out.x, out.y) || 1, dz = out.x / len, dy = out.y / len;
    for (let i = 0; i < 6; i++) {
        const age = (t * 2.2 + i / 6) % 1;
        const reach = 18 + age * 120 * edge, size = 4 + age * 16;
        chair.oval([-46 - age * 8, 24 + dy * reach, dz * reach], [size * .8, size, size], '#f6e6df' + alpha(.75 * (1 - age) * edge));
    }
}

const LINES = (() => {
    const random = seeded(7717);
    return Array.from({ length: 30 }, () => ({ angle: random() * Math.PI * 2, phase: random(), rate: .9 + random() * .8, width: .8 + random() * 1.4 }));
})();

/** Streaks rushing out from the vanishing point when the chair goes fast; `fast` 0 slow to 1 flat out. */
export function orbitSpeedLines(ctx: RenderCtx, center: Vector, fast: number) {
    if (fast <= .02) return;
    const reach = Math.hypot(ctx.W, ctx.H) * .55;
    // White screen-blended over anything is plain alpha blending, so the streaks need no ThorVG Scene: the layer
    // only names them, and the fade is folded into each streak's alpha.
    const layer = { key: 'orbit-speed-lines' };
    for (const line of LINES) {
        const k = (line.phase + ctx.t * line.rate * (.6 + fast)) % 1;
        const r0 = reach * (.25 + .75 * k), r1 = r0 + reach * (.05 + .22 * k) * fast;
        const dx = Math.cos(line.angle), dy = Math.sin(line.angle), nx = -dy * line.width, ny = dx * line.width;
        const [cx, cy] = center;
        ctx.commands.push({ v: [[cx + dx * r0, cy + dy * r0], [cx + dx * r1 + nx, cy + dy * r1 + ny], [cx + dx * r1 - nx, cy + dy * r1 - ny]],
            c: '#ffffff' + alpha(.55 * k * fast), layer });
    }
}

const SLIPSTREAM = (() => {
    const random = seeded(9931);
    // A tight ring hugging the chair and a looser one around it, spread round the whole outline.
    return Array.from({ length: 30 }, (_, i) => {
        const inner = i < 14, angle = (i / (inner ? 14 : 16)) * Math.PI * 2 + random() * .3;
        return { angle, radius: inner ? 52 + random() * 12 : 78 + random() * 50, phase: random(), rate: .8 + random() * .6, length: inner ? .6 : 1 };
    });
})();

/**
 * Air rushing past the chair: streaks come from ahead, slide along its outline and stream back past the camera.
 * `chair` maps the chair's own model (x ahead, y up, z across). Returns the streaks ahead of the chair, to paint
 * behind it, and those beside and behind it, to paint over it, so the air wraps round the chair.
 */
export function orbitSlipstream(ctx: RenderCtx, chair: SkyProjection, strength: number) {
    const behind: DrawCommand[] = [], over: DrawCommand[] = [];
    if (strength <= .01) return { behind, over };
    // Stage five keeps clear of blur effects (they cost too much on the software renderer); thin white streaks that
    // taper to a point read as soft enough. Like the speed lines they are plain alpha, without a layer Scene.
    const layer = { key: 'orbit-slipstream' }, strong = Math.min(1, strength);
    const centreDepth = chair.depth([0, 8, 0]);
    for (const streak of SLIPSTREAM) {
        const k = (streak.phase + ctx.t * streak.rate * (.7 + strength)) % 1;
        const head = 260 - k * 700, tail = head + (60 + 190 * strength) * streak.length;
        const across = Math.cos(streak.angle) * streak.radius, up = 8 + Math.sin(streak.angle) * streak.radius * 1.3;
        const a: Point3 = [head, up, across], b: Point3 = [tail, up, across];
        if (chair.depth(a) < 60 || chair.depth(b) < 60) continue;
        const [ax, ay] = chair.project(a), [bx, by] = chair.project(b);
        const width = ctx.clamp(700 / chair.depth(a), .6, 3.2), len = Math.hypot(ax - bx, ay - by) || 1;
        const nx = -(ay - by) / len * width, ny = (ax - bx) / len * width;
        // Faint as it forms ahead, brightest alongside the chair, gone as it passes the camera.
        const fade = Math.min(1, k / .2) * Math.min(1, (1 - k) / .25);
        const command: DrawCommand = { v: [[bx, by], [ax + nx, ay + ny], [ax - nx, ay - ny]], c: '#ffffff' + alpha(.6 * fade * strong), layer };
        (chair.depth(a) > centreDepth ? behind : over).push(command);
    }
    return { behind, over };
}
