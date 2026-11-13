import { STAGE_FOUR, skyGust, skyHazards, type SkyHazard } from '../../game/stages/sky/data';
import type { RenderCtx } from '../context';

// Wind lines rush right to left, against the course. A few faint ones warn of a gust; during the gust they
// thicken, multiply and curl, and a ThorVG motion blur smears the whole layer along the wind.
export function skyWindLines(ctx: RenderCtx) {
    const { warn, strength } = skyGust(ctx.t);
    const top = -ctx.vertical, height = ctx.H / ctx.scale;
    const span = ctx.VW + 500;
    const lines = 3 + Math.round(warn * 5 + strength * 12);
    ctx.beginLayer({
        key: 'sky-wind-lines', opacity: .35 + warn * .25 + strength * .4,
        motionBlur: strength > .05 ? { distance: 18 * strength * ctx.scale, angle: 180 } : undefined,
        effectBudget: { area: 160_000, minScale: .6 },
    });
    for (let i = 0; i < lines; i++) {
        const speed = 420 + warn * 250 + strength * 900 + (i % 4) * 60;
        const x = ctx.cam + ctx.VW + 250 - (ctx.t * speed + i * 397) % span;
        const y = top + height * ((i * .618 + .07) % 1) + Math.sin(ctx.t * 2 + i) * 8;
        const length = 70 + warn * 40 + strength * 190;
        const lift = (i % 2 ? -1 : 1) * (4 + strength * 10);
        ctx.strokePath([x, y], [[x + length * .3, y + lift, x + length * .7, y - lift, x + length, y]],
            { width: 1.2 + strength * 2.6, color: strength > .1 ? '#ffffff' : '#f6efe0', cap: 'round' });
    }
    ctx.endLayer();
    if (strength <= .05) return;
    // Big curling gusts unwind across the screen with a trimmed stroke.
    ctx.beginLayer({ key: 'sky-gust-curls', opacity: strength * .85 });
    for (let i = 0; i < 3; i++) {
        const age = (ctx.t * .9 + i / 3) % 1;
        const x = ctx.cam + ctx.VW * (1.05 - age * 1.2);
        const y = top + height * (.22 + i * .24);
        const r = 26 + i * 6;
        ctx.strokePath([x + 220, y], [
            [x + 140, y - 6, x + 60, y + 4, x, y],
            [x - r, y - 2, x - r, y - r * 1.6, x, y - r * 1.5],
            [x + r * .8, y - r * 1.4, x + r * .6, y - r * .5, x - 10, y - r * .6],
        ], { width: 3 + strength * 2, color: '#fffdf6', cap: 'round' }, { trim: [Math.max(0, age * 1.4 - .4), Math.min(1, age * 1.4 + .1)] });
    }
    ctx.endLayer();
    // The whole sky leans white from the windward edge.
    const right = ctx.cam + ctx.VW;
    ctx.gradientPolygon([[right - ctx.VW * .45, top], [right, top], [right, top + height], [right - ctx.VW * .45, top + height]],
        ctx.gradientFill(right - ctx.VW * .45, 0, right, 0, [[0, '#ffffff00'], [1, '#ffffff']], .22 * strength));
}

// Papers rattle loose a moment before the gust: a few scraps tumble along with the warning breeze.
export function skyWarningScraps(ctx: RenderCtx) {
    const { warn, strength } = skyGust(ctx.t);
    const live = warn * (1 - strength);
    if (live <= .02) return;
    const top = -ctx.vertical, height = ctx.H / ctx.scale;
    for (let i = 0; i < 6; i++) {
        const x = ctx.cam + ctx.VW + 60 - (ctx.t * (260 + i * 30) + i * 233) % (ctx.VW + 120);
        const y = top + height * (.18 + (i * .37) % .7) + Math.sin(ctx.t * 4 + i) * 14;
        ctx.ox = x; ctx.oy = y; ctx.rotation = ctx.t * (3 + i) + i;
        ctx.rect(-6, -4, 12, 8, ctx.tint('#fbf6e8', live));
        ctx.rod(-3, 0, 4, 0, .8, ctx.tint('#9a9e9d', live));
    }
    ctx.ox = ctx.oy = ctx.rotation = 0;
}

function paperBundle(ctx: RenderCtx, h: SkyHazard) {
    ctx.ox = h.x; ctx.oy = h.y; ctx.rotation = Math.sin(h.spin) * .5; ctx.localScale = 1.5;
    // Loose pages flap behind (to the right of) the bundle as it flies left.
    for (let i = 0; i < 3; i++) {
        const flap = Math.sin(h.spin * 2.4 + i * 1.7) * 7;
        ctx.polygon([[6, -10 + i * 7], [30 + i * 4, -14 + i * 7 + flap], [33 + i * 4, -6 + i * 7 + flap], [8, -3 + i * 7]], i % 2 ? '#f3ecd8' : '#fbf6e8');
    }
    ctx.rect(-18, -13, 32, 26, '#d9d2bf');
    ctx.rect(-19, -15, 32, 24, '#fbf6e8');
    ctx.rect(-19, -15, 32, 5, '#e0503f');
    for (let y = -6; y < 7; y += 4) ctx.rod(-14, y, 8, y, 1, '#9a9e9d');
    // A big binder clip, and a red "URGENT" stamp shape.
    ctx.rect(-6, -19, 10, 6, '#3c4658');
    ctx.ellipse(-11, 4, 4, 4, '#e0503f66');
    ctx.ox = ctx.oy = ctx.rotation = 0; ctx.localScale = 1;
}

function bird(ctx: RenderCtx, h: SkyHazard) {
    const flap = Math.sin(h.spin);
    ctx.ox = h.x; ctx.oy = h.y; ctx.rotation = flap * .06; ctx.localScale = 1.45;
    // A grey pigeon flying left, wearing a tiny office tie.
    ctx.polygon([[2, -2], [18, -26 * flap - 4], [26, -22 * flap - 2], [12, 2]], '#7d8794');
    ctx.ellipse(4, 2, 17, 10, '#9aa4b1');
    ctx.polygon([[18, 0], [32, -6], [32, 8], [19, 6]], '#6c7684');
    ctx.ellipse(-12, -4, 9, 8, '#8a95a3');
    ctx.ellipse(-11, -1, 6, 4, '#7fa58f');
    ctx.polygon([[-20, -5], [-28, -2], [-20, -1]], '#e3a640');
    ctx.ellipse(-14, -7, 2.2, 2.2, '#ffffff');
    ctx.ellipse(-14.6, -7, 1.1, 1.1, '#20242c');
    ctx.polygon([[-6, 4], [-2, 4], [-1, 13], [-4, 16], [-7, 13]], '#c8463b');
    ctx.polygon([[-2, -3], [16, 10 * flap + 3], [22, 7 * flap + 6], [8, 6]], '#a8b1bd');
    ctx.rod(4, 11, 2, 16, 1.4, '#e3a640');
    ctx.rod(10, 11, 9, 16, 1.4, '#e3a640');
    ctx.ox = ctx.oy = ctx.rotation = 0; ctx.localScale = 1;
}

export function skyHazardsArt(ctx: RenderCtx) {
    const visible = skyHazards(ctx.t).filter(h => h.x > ctx.cam - 60 && h.x < ctx.cam + ctx.VW + 60);
    const papers = visible.filter(h => h.kind === 'paper');
    if (papers.length) {
        ctx.beginLayer({ key: 'sky-paper-bundles', motionBlur: { distance: 7 * ctx.scale, angle: 180 } });
        for (const h of papers) paperBundle(ctx, h);
        ctx.endLayer();
    }
    for (const h of visible) if (h.kind === 'bird') bird(ctx, h);
}

// Feathers burst off the chair for a moment after a pigeon clips it.
export function skyKnockFeathers(ctx: RenderCtx) {
    const sky = ctx.state.sky;
    if (sky.knockKind !== 'bird' || sky.knock <= 0) return;
    const age = 1 - sky.knock / STAGE_FOUR.knock.cooldown;
    for (let i = 0; i < 7; i++) {
        const angle = i * .9 + .4;
        const reach = 45 + age * 80;
        ctx.ox = ctx.p.x + Math.cos(angle) * reach; ctx.oy = ctx.p.y - 40 + Math.sin(angle) * reach * .7 + age * age * 30;
        ctx.rotation = angle + age * 4; ctx.localScale = 1.8;
        ctx.ellipse(0, 0, 10, 3.6, ctx.tint('#7d8794', 1 - age));
        ctx.ellipse(0, -.6, 8.5, 2.6, ctx.tint('#eef1f5', 1 - age));
        ctx.rod(-9, 0, 9, 0, 1, ctx.tint('#5c6674', 1 - age));
    }
    ctx.ox = ctx.oy = ctx.rotation = 0; ctx.localScale = 1;
}

// Three charges above the chair: one goes dark per burst in the air, all refill on touching down.
export function skySprayGauge(ctx: RenderCtx) {
    const state = ctx.state;
    if (state.sky.phase !== 'course' || (state.ground && state.sky.airSprays === 0)) return;
    const limit = STAGE_FOUR.airSprayLimit, left = limit - state.sky.airSprays;
    const x = ctx.p.x, y = ctx.p.y - 112;
    ctx.rect(x - 24, y - 7, 48, 14, '#1d2c3fa8');
    for (let i = 0; i < limit; i++) {
        const cx = x - 14 + i * 14;
        ctx.ellipse(cx, y, 4.6, 4.6, i < left ? '#fff2ce' : '#5d6d82');
        if (i < left) ctx.ellipse(cx - 1.3, y - 1.4, 1.6, 1.4, '#ffffff');
    }
}
