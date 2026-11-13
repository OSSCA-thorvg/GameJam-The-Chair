import type { RenderCtx } from '../context';
import { createSkyProjection, type Point3 } from './sky-projection';

// The last ledge falls behind the already-3D chair. This is scenery, never a collider.
export function skyDeparture(ctx: RenderCtx, progress: number) {
    if (progress >= 1) return;
    const view = createSkyProjection(ctx.W, ctx.H, 0);
    const retreat = progress * progress;
    const point = (x: number, y: number, z = -70): Point3 =>
        [x - retreat * 440, y - retreat * 270, z - retreat * 900];
    view.polygon([point(-170, -96), point(60, -96), point(60, -84), point(-170, -84)], '#526b80');
    view.polygon([point(-170, -84), point(60, -84), point(60, -80), point(-170, -80)], '#d5b982');
    for (const x of [-145, 25]) view.rod(point(x, -96), point(x, -300), 3, '#6f879b');
    for (const [i, x] of [-200, -290].entries()) {
        const y = -35 + i * 60 + Math.sin(progress * 7 + i) * 10;
        view.polygon([point(x, y), point(x + 25, y + 5), point(x + 19, y + 24), point(x - 6, y + 19)], '#eee5cd');
    }
    const layer = { key: 'sky-ending-departure', opacity: 1 - progress * progress };
    ctx.commands.push(...view.commands().map(command => ({ ...command, layer })));
}
