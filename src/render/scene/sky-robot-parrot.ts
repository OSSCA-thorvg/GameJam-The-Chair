import type { SkyHazard, SkyRobot } from '../../game/stages/sky/data';
import type { RenderCtx } from '../context';

// Both robot parrots face left, centred on the hazard, roughly 60 local units wide.

const CHROME: [number, string][] = [[0, '#f7f9fb'], [.35, '#c3ccd6'], [.7, '#6b7889'], [1, '#2a313b']];

function chrome(ctx: RenderCtx, x1: number, y1: number, x2: number, y2: number, stops = CHROME) {
    return ctx.gradientFill(x1, y1, x2, y2, stops);
}

// A calm red camera lens in a black bezel and a brushed ring, glowing softly in a blurred ThorVG layer.
function lensEye(ctx: RenderCtx, h: SkyHazard, x: number, y: number, r: number) {
    const pulse = .8 + Math.sin(h.spin * .55) * .2;
    ctx.beginLayer({ key: `robot-eye-glow-${h.id}`, blur: r * ctx.scale });
    ctx.ellipse(x, y, r * 2.6, r * 2.6, ctx.radialFill(x, y, r * 2.6, [[0, '#ff3a1a'], [.4, '#ff2a1a88'], [1, '#ff2a1a00']], pulse * .8));
    ctx.endLayer();
    ctx.ellipse(x, y, r * 1.3, r * 1.3, chrome(ctx, x - r, y - r, x + r, y + r));
    ctx.ellipse(x, y, r * 1.05, r * 1.05, '#07080a');
    ctx.ellipse(x, y, r * .82, r * .82, ctx.radialFill(x, y, r * .82,
        [[0, '#fff3b0'], [.12, '#ffcf3a'], [.3, '#ff3a1a'], [.7, '#9a0c06'], [1, '#2a0302']], pulse));
    ctx.ellipse(x - r * .35, y - r * .4, r * .22, r * .14, '#ffffffaa');
}

type Stops = [number, string][];
const MIRROR: Stops = [[0, '#ffffff'], [.25, '#cfe2f2'], [.5, '#7d8ea3'], [.62, '#e8eef4'], [1, '#3a4452']];

// The smooth liquid-metal silhouette both robots share: tapering tail, swept far wing, droplet body, near wing.
function dropletBody(ctx: RenderCtx, h: SkyHazard, M: Stops, eye = 4) {
    const flap = Math.sin(h.spin);
    const ripple = Math.sin(h.spin * 2.3) * 1.2;
    ctx.effectPath([12, -3], [[26, -6, 40, -6 + flap * 3, 52, -3 + flap * 3], [40, 2 + flap * 2, 26, 6, 13, 5]], chrome(ctx, 12, -6, 12, 6, M));
    ctx.effectPath([2, -3], [[8, -16 * flap - 8, 16, -28 * flap - 6, 26, -24 * flap - 2], [18, -12 * flap - 1, 12, -2, 12, 1]], chrome(ctx, 0, -30, 26, 0, M));
    ctx.effectPath([-22, -10], [[-14, -18 + ripple, 2, -12, 14, -5], [22, 0, 16, 10, 4, 11], [-6, 12, -14, 6, -18, 2], [-24, -2, -26, -6, -22, -10]],
        chrome(ctx, 0, -16, 0, 12, M));
    ctx.effectPath([-16, -12], [[-8, -15, 4, -11, 12, -6]], '#ffffffaa');
    ctx.effectPath([-22, -8], [[-28, -10, -33, -5, -31, 1], [-28, 0, -25, -1, -22, -1]], chrome(ctx, -33, -10, -22, 2, M));
    lensEye(ctx, h, -14, -5, eye);
    ctx.effectPath([-2, -1], [[8, 10 * flap + 2, 18, 12 * flap + 4, 24, 8 * flap + 8], [12, 8, 4, 6, -2, -1]], chrome(ctx, -2, -2, 24, 10, M));
}

// Black chrome: smoked mirror finish, the red lens reflected as a red rim along the head and back.
function blackChrome(ctx: RenderCtx, h: SkyHazard) {
    const M: Stops = [[0, '#a8b2c0'], [.22, '#2a2f38'], [.5, '#0b0d10'], [.62, '#4a525f'], [1, '#07080a']];
    dropletBody(ctx, h, M, 4.4);
    const pulse = .55 + Math.sin(h.spin * .55) * .25;
    ctx.strokePath([-22, -10], [[-14, -17, 2, -12, 14, -5]], { width: 1.1, color: ctx.gradientFill(-22, 0, 14, 0, [[0, '#ff3a1a'], [1, '#ff3a1a00']], pulse), cap: 'round' }, { blend: 'add' });
    ctx.strokePath([-31, 1], [[-28, 0, -25, -1, -22, -1]], { width: .8, color: ctx.tint('#ff3a1a', pulse), cap: 'round' }, { blend: 'add' });
}

// Liquid metal: one mirror-polished body with sky highlights; the smoked black-chrome twin wears a red rim.
export function robotParrotArt(ctx: RenderCtx, h: SkyHazard, robot: SkyRobot) {
    ctx.ox = h.x; ctx.oy = h.y; ctx.localScale = 1.45;
    if (robot === 'liquid') dropletBody(ctx, h, MIRROR);
    else blackChrome(ctx, h);
    ctx.ox = ctx.oy = ctx.rotation = 0; ctx.localScale = 1;
}
