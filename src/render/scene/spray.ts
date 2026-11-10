import type { RenderCtx } from '../context';

export function sprayPlume(ctx: RenderCtx) {
    const p = ctx.p;
    // Spray plume: cubic-bezier cone with gradient fade along the direction.
    const spray = ctx.state.spray;
    const continuous = ctx.state.stage === 4 || ctx.state.firstFlight.kind === 'flight';
    if (continuous || spray.burst > 0) {
        const dx = spray.dir.x;
        const dy = spray.dir.y;
        const age = continuous ? .9 + Math.sin(ctx.t * 14) * .045 : spray.burst / .24;
        const length = 145 * age;
        const spread = 34 * age;
        const nx = -dy;
        const ny = dx;
        const px = p.x - 45;
        const py = p.y - 15;
        const tipX = px + dx * length;
        const tipY = py + dy * length;
        const rX = tipX + nx * spread;
        const rY = tipY + ny * spread;
        const lX = tipX - nx * spread;
        const lY = tipY - ny * spread;
        ctx.effectPath(
            [px, py],
            [
                // Outer right side: fan out from tip to far-right.
                [px + dx * length * .35 + nx * spread * .25,
                 py + dy * length * .35 + ny * spread * .25,
                 px + dx * length * .85 + nx * spread * .95,
                 py + dy * length * .85 + ny * spread * .95,
                 rX, rY],
                // Far end arc across the plume.
                [tipX + dx * 10, tipY + dy * 10,
                 tipX + dx * 10, tipY + dy * 10,
                 lX, lY],
                // Outer left side back to origin.
                [px + dx * length * .85 - nx * spread * .95,
                 py + dy * length * .85 - ny * spread * .95,
                 px + dx * length * .35 - nx * spread * .25,
                 py + dy * length * .35 - ny * spread * .25,
                 px, py],
            ],
            ctx.gradientFill(px, py, tipX, tipY, [
                [0, '#fffbedf0'],
                [.5, '#f3f0e3c0'],
                [1, '#e5e9e800'],
            ], .4 + age * .6)
        );
        if (continuous) {
            for (let i = 0; i < 7; i++) {
                const u = (ctx.t * 2.2 + i / 7) % 1;
                const wobble = Math.sin(i * 2.7 + ctx.t * 8) * spread * u * .5;
                ctx.ellipse(px + dx * length * u + nx * wobble, py + dy * length * u + ny * wobble,
                    3 + u * 6, 3 + u * 5, ctx.tint('#f4f1e7', (1 - u) * .5));
            }
        }
        // Swirling droplet streak inside the plume for extra flow detail.
        const swirl = Math.sin(ctx.t * 20) * spread * .4;
        ctx.effectPath(
            [px + dx * 8, py + dy * 8],
            [[px + dx * length * .4 + nx * swirl,
              py + dy * length * .4 + ny * swirl,
              px + dx * length * .7 - nx * swirl,
              py + dy * length * .7 - ny * swirl,
              tipX - dx * 4, tipY - dy * 4]],
            ctx.gradientFill(px, py, tipX, tipY, [
                [0, '#ffffffe0'],
                [1, '#ffffff00'],
            ], .7 * age)
        );
    }
}
