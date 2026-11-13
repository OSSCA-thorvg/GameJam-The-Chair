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

const PARROT = { red: '#d63a2f', deep: '#a8251f', blue: '#2f6fd0', navy: '#23477f', yellow: '#f2c230', face: '#f5efe6', beak: '#efe3c8' };

function macaw(ctx: RenderCtx, h: SkyHazard) {
    const flap = Math.sin(h.spin);
    const P = PARROT;
    ctx.ox = h.x; ctx.oy = h.y; ctx.rotation = flap * .06; ctx.localScale = 1.45;
    // A scarlet parrot flying left, long tail streaming behind, still wearing its office tie.
    ctx.polygon([[14, -1], [50, -6 + flap * 3], [53, -1 + flap * 3], [16, 5]], P.red);
    ctx.polygon([[15, 2], [46, 6 + flap * 2], [47, 11 + flap * 2], [16, 7]], P.blue);
    ctx.polygon([[2, -3], [16, -28 * flap - 5], [27, -24 * flap - 2], [12, 1]], P.navy);
    ctx.ellipse(4, 2, 17, 10, P.red);
    ctx.ellipse(6, 5, 12, 5, P.deep);
    ctx.ellipse(-12, -4, 10, 9, P.red);
    ctx.ellipse(-15, -4, 5.5, 4.5, P.face);
    for (let i = 0; i < 3; i++) ctx.rod(-18, -6 + i * 2, -13, -6.5 + i * 2, .5, '#c9bfb0');
    ctx.ellipse(-15, -5, 2.2, 2.2, '#ffffff');
    ctx.ellipse(-15.6, -5, 1.1, 1.1, '#20242c');
    // A big hooked beak: pale upper mandible curling over a dark lower one.
    ctx.effectPath([-20, -9], [[-26, -11, -32, -7, -31, -1], [-30, 2, -28, 3, -27, 1], [-26, -2, -23, -2, -21, -1]], P.beak);
    ctx.polygon([[-21, -1], [-26, 1], [-24, 4], [-20, 3]], '#2b2b2b');
    ctx.polygon([[-6, 4], [-2, 4], [-1, 13], [-4, 16], [-7, 13]], P.navy);
    ctx.rod(-5, 7, -2, 6, 1, P.yellow);
    // Near wing: yellow coverts over blue flight feathers.
    ctx.polygon([[-2, -3], [18, 11 * flap + 2], [26, 8 * flap + 6], [8, 6]], P.blue);
    ctx.polygon([[-2, -3], [10, 6 * flap + 1], [14, 5 * flap + 4], [4, 4]], P.yellow);
    ctx.rod(4, 11, 2, 16, 1.4, '#7d8794');
    ctx.rod(10, 11, 9, 16, 1.4, '#7d8794');
    ctx.ox = ctx.oy = ctx.rotation = 0; ctx.localScale = 1;
}

// Lovebird colour mutations. `head` paints the crown and cheeks, `mask` the forehead band (or a black hood),
// `collar` a ring under a hood; `ring` is the bare white eye ring of Fischer's and masked birds.
type Lovebird = { body: string; wing: string; flight: string; rump: string; tail: string; head: string; mask: string;
    collar: string | null; beak: string; ring: boolean; eye: string };
const LOVEBIRDS: readonly Lovebird[] = [
    // Peach-faced, wild green.
    { body: '#62b24a', wing: '#43913b', flight: '#2f6f35', rump: '#3b82d8', tail: '#3f8a3a', head: '#f2959a', mask: '#e8503e', collar: null, beak: '#eadfc4', ring: false, eye: '#20242c' },
    // Peach-faced, Dutch blue: aqua body, pale peach face.
    { body: '#73b9bd', wing: '#549aa2', flight: '#3c7580', rump: '#3a6fd0', tail: '#5a9ca3', head: '#f6d8c6', mask: '#f0b49c', collar: null, beak: '#eadfc4', ring: false, eye: '#20242c' },
    // Peach-faced, lutino: yellow body, red eyes.
    { body: '#f5dc48', wing: '#ecca36', flight: '#f3e9b0', rump: '#f8edb0', tail: '#efd24a', head: '#f5978a', mask: '#ec5a44', collar: null, beak: '#f2dfc0', ring: false, eye: '#b8302c' },
    // Peach-faced, creamino: cream body, red eyes.
    { body: '#f4ecd2', wing: '#e8ddbc', flight: '#f8f3e4', rump: '#dfe8ee', tail: '#e8ddbc', head: '#f6d6c4', mask: '#f2b9a2', collar: null, beak: '#f2dfc0', ring: false, eye: '#b8302c' },
    // Fischer's: orange face, red beak, white eye ring.
    { body: '#6bbd4a', wing: '#4b9b3b', flight: '#2f7035', rump: '#4f7ccf', tail: '#4b9b3b', head: '#f39a3c', mask: '#e2603a', collar: null, beak: '#d8332a', ring: true, eye: '#20242c' },
    // Violet Fischer's.
    { body: '#8c7fca', wing: '#6c5dab', flight: '#4b3f86', rump: '#5a64c4', tail: '#6c5dab', head: '#f2c3b4', mask: '#e9a08c', collar: null, beak: '#d8332a', ring: true, eye: '#20242c' },
    // Masked: black hood, yellow collar.
    { body: '#52a847', wing: '#3a8a36', flight: '#2a6430', rump: '#5a86c4', tail: '#3a8a36', head: '#262626', mask: '#262626', collar: '#f4d63c', beak: '#d8332a', ring: true, eye: '#20242c' },
    // Blue masked: black hood, white collar, blue body.
    { body: '#5e92d2', wing: '#4272b2', flight: '#2f5590', rump: '#93a6c4', tail: '#4272b2', head: '#262626', mask: '#262626', collar: '#f4f4ee', beak: '#d8332a', ring: true, eye: '#20242c' },
];

// Each pass of each lane gets its own bird: mostly lovebirds in every colour, now and then the big macaw.
function birdVariant(h: SkyHazard) {
    let n = Math.imul(h.focusId + 0x9e37, 0x9e3779b1);
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    const pick = ((n ^ (n >>> 16)) >>> 0) % (LOVEBIRDS.length + 2);
    return pick < LOVEBIRDS.length ? LOVEBIRDS[pick] : null;
}

function lovebird(ctx: RenderCtx, h: SkyHazard, L: Lovebird) {
    const flap = Math.sin(h.spin * 1.3);
    ctx.ox = h.x; ctx.oy = h.y; ctx.rotation = flap * .07; ctx.localScale = 1.35;
    // A chubby lovebird flying left: short rounded tail, blue rump, big head, stubby beak, tie askew.
    ctx.polygon([[13, -2], [27, -1 + flap * 2], [28, 5 + flap * 2], [14, 6]], L.tail);
    ctx.rod(17, 2, 26, 2 + flap * 2, 1.2, '#e2603a');
    ctx.polygon([[1, -3], [12, -24 * flap - 4], [21, -20 * flap - 1], [10, 2]], L.flight);
    ctx.ellipse(3, 2, 15, 11, L.body);
    ctx.ellipse(13, 0, 6, 6, L.rump);
    ctx.ellipse(-10, -4, 10.5, 10, L.head);
    if (L.collar) ctx.polygon([[-5, -6], [0, -4], [0, 6], [-6, 6], [-9, 3]], L.collar);
    ctx.polygon([[-17, -9], [-12, -14], [-6, -12], [-9, -7], [-16, -4]], L.mask);
    if (L.ring) ctx.ellipse(-13, -5, 3.6, 3.6, '#f7f4ee');
    ctx.ellipse(-13, -5, 2, 2, L.eye);
    ctx.ellipse(-13.5, -5.6, .7, .7, '#ffffff');
    ctx.effectPath([-19, -7], [[-23, -8, -26, -4, -25, 0], [-24, 2, -22, 2, -21, 0], [-20, -2, -19, -3, -18, -3]], L.beak);
    ctx.polygon([[-6, 6], [-3, 6], [-2, 13], [-4.5, 15], [-7, 13]], '#c8463b');
    ctx.polygon([[-1, -3], [13, 9 * flap + 2], [19, 6 * flap + 5], [6, 5]], L.wing);
    ctx.rod(2, 12, 1, 16, 1.3, '#9aa4b1');
    ctx.rod(7, 12, 7, 16, 1.3, '#9aa4b1');
    ctx.ox = ctx.oy = ctx.rotation = 0; ctx.localScale = 1;
}

function bird(ctx: RenderCtx, h: SkyHazard) {
    const variant = birdVariant(h);
    if (variant) lovebird(ctx, h, variant);
    else macaw(ctx, h);
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

// Bright parrot feathers burst off the chair for a moment after a parrot clips it.
export function skyKnockFeathers(ctx: RenderCtx) {
    const sky = ctx.state.sky;
    if (sky.knockKind !== 'bird' || sky.knock <= 0) return;
    const age = 1 - sky.knock / STAGE_FOUR.knock.cooldown;
    for (let i = 0; i < 7; i++) {
        const angle = i * .9 + .4;
        const reach = 45 + age * 80;
        ctx.ox = ctx.p.x + Math.cos(angle) * reach; ctx.oy = ctx.p.y - 40 + Math.sin(angle) * reach * .7 + age * age * 30;
        ctx.rotation = angle + age * 4; ctx.localScale = 1.8;
        const color = [PARROT.red, PARROT.blue, PARROT.yellow, '#62b24a', '#f2959a'][i % 5];
        ctx.ellipse(0, 0, 10, 3.6, ctx.tint(color, 1 - age));
        ctx.ellipse(0, -.6, 7, 2, ctx.tint('#ffffff', (1 - age) * .35));
        ctx.rod(-9, 0, 9, 0, 1, ctx.tint('#3a2a2a', 1 - age));
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
