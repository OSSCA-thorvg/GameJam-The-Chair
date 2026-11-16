import type { RenderCtx } from '../context';
import type { DrawCommand, Vector } from '../types';
import { seeded } from './cloud-art';
import type { Point3, SkyProjection } from './sky-projection';


const alpha = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0');

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

export function orbitSpeedLines(ctx: RenderCtx, center: Vector, fast: number) {
    if (fast <= .02) return;
    const reach = Math.hypot(ctx.W, ctx.H) * .55;
    const layer = { key: 'orbit-speed-lines' };
    for (const line of LINES) {
        const k = (line.phase + ctx.t * line.rate * (.6 + fast)) % 1;
        const r0 = reach * (.25 + .75 * k), r1 = r0 + reach * (.05 + .22 * k) * fast;
        const dx = Math.cos(line.angle), dy = Math.sin(line.angle), nx = -dy * line.width, ny = dx * line.width;
        const [cx, cy] = center;
        ctx.commands.push({ kind: 'path', points: [[cx + dx * r0, cy + dy * r0], [cx + dx * r1 + nx, cy + dy * r1 + ny], [cx + dx * r1 - nx, cy + dy * r1 - ny]],
            fill: '#ffffff' + alpha(.55 * k * fast), layer });
    }
}

const SLIPSTREAM = (() => {
    const random = seeded(9931);
    return Array.from({ length: 30 }, (_, i) => {
        const inner = i < 14, angle = (i / (inner ? 14 : 16)) * Math.PI * 2 + random() * .3;
        return { angle, radius: inner ? 52 + random() * 12 : 78 + random() * 50, phase: random(), rate: .8 + random() * .6, length: inner ? .6 : 1 };
    });
})();

export function orbitSlipstream(ctx: RenderCtx, chair: SkyProjection, strength: number) {
    const behind: DrawCommand[] = [], over: DrawCommand[] = [];
    if (strength <= .01) return { behind, over };
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
        const fade = Math.min(1, k / .2) * Math.min(1, (1 - k) / .25);
        const command: DrawCommand = { kind: 'path', points: [[bx, by], [ax + nx, ay + ny], [ax - nx, ay - ny]], fill: '#ffffff' + alpha(.6 * fade * strong), layer };
        (chair.depth(a) > centreDepth ? behind : over).push(command);
    }
    return { behind, over };
}
