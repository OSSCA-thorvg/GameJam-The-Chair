import { seeded } from '../shared/cloud-art';

import type { RenderCtx } from '../../context';
import type { DrawCommand, Vector } from '../../types';
import type { Point3, SkyProjection } from '../shared/projection';

const alpha = (value: number) =>
    Math.round(Math.max(0, Math.min(1, value)) * 255)
        .toString(16)
        .padStart(2, '0');

export function orbitEdgePuffs(
    chair: SkyProjection,
    edge: number,
    out: { x: number; y: number },
    t: number,
): void {
    if (edge <= 0.02) {
        return;
    }
    const len = Math.hypot(out.x, out.y) || 1;
    const dz = out.x / len;
    const dy = out.y / len;
    for (let i = 0; i < 6; i++) {
        const age = (t * 2.2 + i / 6) % 1;
        const reach = 18 + age * 120 * edge;
        const size = 4 + age * 16;
        chair.oval(
            [-46 - age * 8, 24 + dy * reach, dz * reach],
            [size * 0.8, size, size],
            '#f6e6df' + alpha(0.75 * (1 - age) * edge),
        );
    }
}

const LINES = (() => {
    const random = seeded(7717);
    return Array.from({ length: 30 }, () => ({
        angle: random() * Math.PI * 2,
        phase: random(),
        rate: 0.9 + random() * 0.8,
        width: 0.8 + random() * 1.4,
    }));
})();

export function orbitSpeedLines(
    ctx: RenderCtx,
    center: Vector,
    fast: number,
): void {
    if (fast <= 0.02) {
        return;
    }
    const reach = Math.hypot(ctx.W, ctx.H) * 0.55;
    const layer = { key: 'orbit-speed-lines' };
    for (const line of LINES) {
        const k = (line.phase + ctx.t * line.rate * (0.6 + fast)) % 1;
        const r0 = reach * (0.25 + 0.75 * k);
        const r1 = r0 + reach * (0.05 + 0.22 * k) * fast;
        const dx = Math.cos(line.angle);
        const dy = Math.sin(line.angle);
        const nx = -dy * line.width;
        const ny = dx * line.width;
        const [cx, cy] = center;
        ctx.commands.push({
            kind: 'path',
            points: [
                [cx + dx * r0, cy + dy * r0],
                [cx + dx * r1 + nx, cy + dy * r1 + ny],
                [cx + dx * r1 - nx, cy + dy * r1 - ny],
            ],
            fill: '#ffffff' + alpha(0.55 * k * fast),
            layer,
        });
    }
}

const SLIPSTREAM = (() => {
    const random = seeded(9931);
    return Array.from({ length: 30 }, (_, i) => {
        const inner = i < 14;
        const angle = (i / (inner ? 14 : 16)) * Math.PI * 2 + random() * 0.3;
        return {
            angle,
            radius: inner ? 52 + random() * 12 : 78 + random() * 50,
            phase: random(),
            rate: 0.8 + random() * 0.6,
            length: inner ? 0.6 : 1,
        };
    });
})();

export function orbitSlipstream(
    ctx: RenderCtx,
    chair: SkyProjection,
    strength: number,
): { behind: DrawCommand[]; over: DrawCommand[] } {
    const behind: DrawCommand[] = [];
    const over: DrawCommand[] = [];
    if (strength <= 0.01) {
        return { behind, over };
    }
    const layer = { key: 'orbit-slipstream' };
    const strong = Math.min(1, strength);
    const centreDepth = chair.depth([0, 8, 0]);
    for (const streak of SLIPSTREAM) {
        const k = (streak.phase + ctx.t * streak.rate * (0.7 + strength)) % 1;
        const head = 260 - k * 700;
        const tail = head + (60 + 190 * strength) * streak.length;
        const across = Math.cos(streak.angle) * streak.radius;
        const up = 8 + Math.sin(streak.angle) * streak.radius * 1.3;
        const a: Point3 = [head, up, across];
        const b: Point3 = [tail, up, across];
        if (chair.depth(a) < 60 || chair.depth(b) < 60) {
            continue;
        }
        const [ax, ay] = chair.project(a);
        const [bx, by] = chair.project(b);
        const width = ctx.clamp(700 / chair.depth(a), 0.6, 3.2);
        const len = Math.hypot(ax - bx, ay - by) || 1;
        const nx = (-(ay - by) / len) * width;
        const ny = ((ax - bx) / len) * width;
        const fade = Math.min(1, k / 0.2) * Math.min(1, (1 - k) / 0.25);
        const command: DrawCommand = {
            kind: 'path',
            points: [
                [bx, by],
                [ax + nx, ay + ny],
                [ax - nx, ay - ny],
            ],
            fill: '#ffffff' + alpha(0.6 * fade * strong),
            layer,
        };
        (chair.depth(a) > centreDepth ? behind : over).push(command);
    }
    return { behind, over };
}
