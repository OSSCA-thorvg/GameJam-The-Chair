import type { RenderCtx } from '../context';
import type { Vector } from '../types';
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
 * The company geofence: yellow-and-black tape that shows up at the edge of the play area as the chair nears it,
 * level with the chair, along the stretch just ahead.
 */
export function orbitGeofence(view: SkyProjection, point: RoutePoint, travel: number, p: { x: number; y: number }) {
    const near = (at: number, bound: number) => Math.max(0, Math.min(1, (Math.abs(at) - (bound - 240)) / 240));
    const segment = 70;
    const first = Math.floor((travel - 150) / segment) * segment;
    const tape = (corners: (z0: number, z1: number) => Point3[], strength: number) => {
        if (strength <= 0) return;
        for (let z = first, i = Math.floor(first / segment); z < travel + 1400; z += segment, i++) {
            view.polygon(corners(z, z + segment), (i % 2 ? '#2b2b2b' : '#f2c230') + alpha(strength * (1 - (z - travel) / 1600)));
        }
    };
    const sx = Math.sign(p.x) || 1, sy = Math.sign(p.y) || 1;
    const wallX = sx * (C.bounds.x + 70), wallY = sy * (C.bounds.y + 70);
    for (const level of [-90, 60]) {
        tape((z0, z1) => [point(wallX, p.y + level, z0), point(wallX, p.y + level, z1), point(wallX, p.y + level + 22, z1), point(wallX, p.y + level + 22, z0)], near(p.x, C.bounds.x));
    }
    for (const side of [-160, 140]) {
        tape((z0, z1) => [point(p.x + side, wallY, z0), point(p.x + side, wallY, z1), point(p.x + side + 22, wallY, z1), point(p.x + side + 22, wallY, z0)], near(p.y, C.bounds.y));
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
    for (const line of LINES) {
        const k = (line.phase + ctx.t * line.rate * (.6 + fast)) % 1;
        const r0 = reach * (.25 + .75 * k), r1 = r0 + reach * (.05 + .22 * k) * fast;
        const dx = Math.cos(line.angle), dy = Math.sin(line.angle), nx = -dy * line.width, ny = dx * line.width;
        const [cx, cy] = center;
        ctx.commands.push({ v: [[cx + dx * r0, cy + dy * r0], [cx + dx * r1 + nx, cy + dy * r1 + ny], [cx + dx * r1 - nx, cy + dy * r1 - ny]],
            c: '#ffffff' + alpha(.55 * k), layer: { key: 'orbit-speed-lines', blend: 'screen', opacity: fast } });
    }
}
