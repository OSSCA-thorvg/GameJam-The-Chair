import { STAGE_THREE, ductTimings } from '../../game/stages/rooftop/data';
import type { RenderCtx } from '../context';

export function rooftopDuct(ctx: RenderCtx) {
    const duct = STAGE_THREE.duct;
    const reaction = ctx.state.ductReaction;
    const age = reaction.kind === 'reacting' ? reaction.age : reaction.kind === 'done' ? 10 : -1;
    const bursts = reaction.kind === 'reacting' ? reaction.bursts : [];
    const twitching = bursts.some(burst => {
        const timing = ductTimings(burst.kind);
        return burst.age >= timing.inhale && burst.age < timing.inhale + timing.twitch;
    });
    const shake = twitching ? Math.sin(age * 110) * 2.3 : 0;
    const x = duct.x + shake, y = duct.y;
    const top = -430;
    // One continuous bent sheet-metal tube, highlighted across its width.
    ctx.effectPath([x + 20, y - 33], [
        [x + 48, y - 33, x + 85, y - 33, x + 101, y - 33],
        [x + 120, y - 33, x + 126, y - 48, x + 126, y - 66],
        [x + 126, y - 160, x + 126, top + 60, x + 126, top],
        [x + 146, top, x + 163, top, x + 180, top],
        [x + 180, top + 100, x + 180, y - 112, x + 180, y - 62],
        [x + 180, y - 10, x + 154, y + 32, x + 105, y + 32],
        [x + 78, y + 32, x + 40, y + 32, x + 20, y + 32],
        [x + 20, y + 16, x + 20, y - 16, x + 20, y - 33],
    ], ctx.gradientFill(x + 20, 0, x + 180, 0, [[0, '#adb8c7'], [.42, '#7c8ea6'], [.73, '#a3afc1'], [1, '#7b8da5']]));
    ctx.effectPath([x + 25, y - 31], [
        [x + 66, y - 31, x + 95, y - 31, x + 104, y - 31],
        [x + 125, y - 31, x + 137, y - 48, x + 137, y - 68],
        [x + 137, y - 172, x + 137, top + 50, x + 137, top],
        [x + 133, top, x + 129, top, x + 126, top],
        [x + 126, top + 90, x + 126, y - 115, x + 126, y - 68],
        [x + 126, y - 48, x + 120, y - 39, x + 102, y - 39],
        [x + 76, y - 39, x + 47, y - 39, x + 25, y - 39],
        [x + 25, y - 36, x + 25, y - 34, x + 25, y - 31],
    ], ctx.gradientFill(x, 0, x + 140, 0, [[0, '#d6dce2'], [1, '#bdc8d5']]));
    for (const sx of [x + 40, x + 108]) {
        ctx.rect(sx, y - 41, 11, 80, '#afbdcc');
        ctx.rod(sx + 2, y - 40, sx + 2, y + 38, 2, '#d8dfe5');
        for (const by of [y - 32, y + 29]) ctx.ellipse(sx + 7, by, 2, 2, '#546d87');
    }
    for (let sy = top + 50; sy < y - 90; sy += 144) {
        ctx.rect(x + 120, sy, 65, 11, '#b1bdcd');
        for (const bx of [x + 126, x + 178]) ctx.ellipse(bx, sy + 5, 2, 2, '#596f87');
    }
    // The opening faces the left-hand ledge, matching the reference composition.
    ctx.polygon([[x, y - 25], [x + 24, y - 38], [x + 24, y + 35], [x, y + 29]], '#ced5dd');
    ctx.polygon([[x + 4, y - 20], [x + 20, y - 29], [x + 20, y + 27], [x + 4, y + 23]], '#253d57');
    for (let i = 0; i < 4; i++) {
        const ly = y - 18 + i * 13;
        ctx.polygon([[x + 3, ly + 7], [x + 21, ly - 2], [x + 21, ly + 4], [x + 3, ly + 12]], '#8da0b7');
        ctx.rod(x + 3, ly + 6, x + 21, ly - 3, 2, '#d2dbe3');
    }
    for (const burst of bursts) {
        const timing = ductTimings(burst.kind);
        if (burst.age < timing.inhale) {
            for (let i = 0; i < 7; i++) {
                const u = (burst.age * 5 + i / 7) % 1;
                const px = x - 160 * (1 - u), py = y + Math.sin(i * 2.3) * (1 - u) * 30;
                ctx.ellipse(px, py, 4 + (1 - u) * 7, 3 + (1 - u) * 4, '#f5f1e2b0');
                ctx.effectPath([px - 16, py + 3], [[px - 8, py, px + 4, py - 2, px + 13, py]],
                    ctx.gradientFill(px - 16, py, px + 13, py, [[0, '#fff7e500'], [1, '#fff7e5b0']]));
            }
        }
        const sneezeAge = burst.age - timing.inhale - timing.twitch;
        if (sneezeAge >= 0 && sneezeAge < timing.sneeze) {
            // The repeat wind is short, so its steam plays faster to still billow out to a good size.
            const pace = Math.pow(duct.sneezeDuration / timing.sneeze, .6);
            ductSteam(ctx, x, y, sneezeAge * pace, timing.sneeze * pace, burst.kind === 'first' ? 1 : .85);
        }
    }
    // The first sneeze coughs up what years of overtime left inside the duct.
    const sneezeAge = age - duct.inhaleDuration - duct.twitchDuration;
    if (sneezeAge >= 0) ductProps(ctx, x, y, sneezeAge);
}

// Deterministic 0..1 noise per puff, so a sneeze looks the same when replayed or scrubbed.
function hash(n: number) {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
}

const smooth = (v: number) => v * v * (3 - 2 * v);

// The sneeze as a burst of steam: puffs leave the vent fast, slow down under drag, rise as they cool,
// wobble with turbulence, swell and thin out. Right at the mouth the jet is still clear; it only turns
// white a short way out, the way real steam condenses.
function ductSteam(ctx: RenderCtx, x: number, y: number, age: number, duration: number, strength: number) {
    const count = Math.round(14 + 16 * strength);
    const emit = duration * .42;
    const mouthX = x + 4;
    const fadeIn = Math.min(1, age / .05);

    // A brief, hard jet right at the mouth while the sneeze is at full pressure.
    const jet = Math.max(0, 1 - age / (.22 * Math.max(.5, strength))) * fadeIn;
    if (jet > 0) {
        const len = (150 + 140 * strength) * smooth(Math.min(1, age / .08 + .25));
        ctx.beginLayer({ key: 'duct-steam-jet', blur: 3, motionBlur: { distance: 10 * ctx.scale, angle: 180 } });
        ctx.effectPath([mouthX, y - 22], [
            [mouthX - len * .35, y - 30, mouthX - len * .75, y - 44, mouthX - len, y - 34],
            [mouthX - len - 22, y - 8, mouthX - len - 14, y + 30, mouthX - len, y + 36],
            [mouthX - len * .7, y + 40, mouthX - len * .3, y + 30, mouthX, y + 24],
        ], ctx.gradientFill(mouthX, y, mouthX - len, y, [
            [0, '#f7fbff00'], [.12, ctx.tint('#f7fbff', .55 * jet)], [.55, ctx.tint('#eef3f6', .38 * jet)], [1, '#eef3f600'],
        ]));
        ctx.endLayer();
    }

    ctx.beginLayer({ key: 'duct-steam', blur: 2.2 });
    for (let i = 0; i < count; i++) {
        const born = (i / count) * emit;
        const t = age - born;
        if (t <= 0) continue;
        const life = duration - born;
        const seed = i * 7.31 + strength * 13;
        // Early puffs carry the full blast; later ones dribble out and mostly drift upward.
        const late = born / emit;
        const speed = (780 + hash(seed) * 320) * strength * (1 - late * .78);
        const drag = 3.1 + hash(seed + 1) * .8;
        const spread = (hash(seed + 2) - .5) * .5 - late * .35;
        const travel = speed / drag * (1 - Math.exp(-drag * t));
        const rise = 46 + hash(seed + 3) * 40;
        const phase = hash(seed + 4) * Math.PI * 2;
        const wobble = Math.sin(t * (4 + hash(seed + 5) * 3) + phase) * (6 + 22 * t);
        const px = mouthX - travel * Math.cos(spread) + Math.sin(t * 2.3 + phase) * 6 * t;
        const py = y + 4 + travel * Math.sin(spread) - rise * t * t - 20 * late * t + wobble * .5;
        const r = (10 + 10 * hash(seed + 6)) + (40 + 34 * hash(seed + 7)) * strength * (1 - Math.exp(-2.6 * t)) + 18 * t;
        const condensed = smooth(Math.min(1, Math.max(0, (mouthX - px - 12) / 70)));
        const fade = Math.pow(Math.max(0, 1 - t / life), 1.4);
        const alpha = fadeIn * condensed * fade * (.5 + .25 * hash(seed + 8)) * (.75 + .25 * strength);
        if (alpha < .01) continue;
        // Lit from above: the bright core sits high in each puff and the underside goes cool grey.
        const hx = px - r * .12, hy = py - r * .22;
        ctx.effectPath([px - r, py], [
            [px - r, py - r * .55, px - r * .55, py - r, px, py - r],
            [px + r * .55, py - r, px + r, py - r * .55, px + r, py],
            [px + r, py + r * .55, px + r * .55, py + r, px, py + r],
            [px - r * .55, py + r, px - r, py + r * .55, px - r, py],
        ], ctx.radialFill(hx, hy, r * 1.08, [
            [0, ctx.tint('#ffffff', alpha)], [.45, ctx.tint('#f1f4f6', alpha * .62)], [.8, ctx.tint('#d9e0e6', alpha * .22)], [1, '#d9e0e600'],
        ]));
    }
    ctx.endLayer();

    // Thin curling filaments trail the leading puffs and give the cloud its torn, turbulent edge.
    ctx.beginLayer({ key: 'duct-steam-wisps', blur: 2.6 });
    const strands = Math.round(4 + 4 * strength);
    for (let i = 0; i < strands; i++) {
        const seed = 91 + i * 3.7 + strength * 5;
        const t = age - i * .025;
        if (t <= 0) continue;
        const reach = (230 + 120 * hash(seed)) * strength * (1 - Math.exp(-3.2 * t));
        const lift = 30 * t * t + 16 * (hash(seed + 1) - .5) * reach / 100;
        const curl = (hash(seed + 2) - .5) * 70 * Math.min(1, t * 2);
        const fade = fadeIn * Math.pow(Math.max(0, 1 - age / duration), 1.6) * .2;
        if (fade < .01 || reach < 20) continue;
        const sx = mouthX - 40, sy = y + (hash(seed + 3) - .5) * 30;
        const ex = mouthX - reach, ey = sy - lift - reach * .12;
        ctx.strokePath([sx, sy], [[sx - reach * .35, sy + curl, ex + reach * .25, ey - curl, ex, ey]], {
            width: 5 + 7 * hash(seed + 4) * strength,
            color: ctx.tint('#f6f9fb', fade),
            cap: 'round',
        }, { trim: [Math.min(.6, t * .5), 1] });
    }
    ctx.endLayer();
}

/** Fill colours that identify each ejected prop (tests count them). */
export const DUCT_PROP_COLORS = { can: '#2340a8', cup: '#f4ece0', badge: '#f3f1ea', tie: '#b23a3f' } as const;

type PropKind = 'can' | 'cup' | 'spill' | 'badge' | 'tie';
// Landing spots sit on real ledges: the left pad (top 136, x 1240-1400), the pad in front of the duct
// (top 276, x 1510-1640) and the shelf above the duct (top -4, x 1510-1780). `to` is the resting centre.
type Flight = { kind: PropKind; delay: number; time: number; to: [number, number]; arc: number; spin: number; rest: number; bounce: number };
// Sizes follow the rider (about 1 unit per cm): a can is ~7x21, a takeaway cup ~9x14, the badge card ~11x14
// and a tie ~35 long like the rider's own.
const SCALE: Record<PropKind, number> = { can: .45, cup: .55, spill: .55, badge: .38, tie: .62 };
const PROPS: readonly Flight[] = [
    // Energy drinks: the heaviest, they tumble and rattle to a stop on their side.
    { kind: 'can', delay: 0, time: .62, to: [1352, 132], arc: 120, spin: 9.4, rest: Math.PI / 2, bounce: 6 },
    { kind: 'can', delay: .04, time: .7, to: [1388, 132], arc: 140, spin: -11, rest: -Math.PI / 2, bounce: 5 },
    { kind: 'can', delay: .06, time: .48, to: [1538, 272], arc: 70, spin: -7.9, rest: -Math.PI / 2, bounce: 5 },
    { kind: 'can', delay: .1, time: .55, to: [1612, 272], arc: 55, spin: 8.6, rest: Math.PI / 2, bounce: 6 },
    // Coffee: two cups land upright, one lands on its side and leaks a puddle.
    { kind: 'cup', delay: .03, time: .66, to: [1318, 129], arc: 130, spin: 6.3, rest: 0, bounce: 3 },
    { kind: 'cup', delay: .09, time: .9, to: [1548, -11], arc: 150, spin: -6.3, rest: 0, bounce: 3 },
    { kind: 'spill', delay: .05, time: .52, to: [1578, 272], arc: 80, spin: 7.2, rest: Math.PI / 2, bounce: 2 },
    // The empty badge, and two ties flung highest onto the shelf above the duct.
    { kind: 'badge', delay: .08, time: .82, to: [1270, 128], arc: 150, spin: 12.6, rest: 0, bounce: 0 },
    { kind: 'tie', delay: .02, time: 1.05, to: [1600, -10], arc: 150, spin: 5.2, rest: Math.PI / 2, bounce: 0 },
    { kind: 'tie', delay: .07, time: 1.15, to: [1672, -10], arc: 170, spin: -4.6, rest: -Math.PI / 2, bounce: 0 },
];

// Where a prop is `age` seconds into the sneeze: a thrown arc, then a damped hop on landing.
function flight(x: number, y: number, age: number, f: Flight) {
    const u = Math.min(1, Math.max(0, (age - f.delay) / f.time));
    const ease = 1 - Math.pow(1 - u, 2);
    const after = Math.max(0, age - f.delay - f.time);
    const hop = f.bounce * Math.abs(Math.sin(after * 14)) * Math.exp(-after * 7);
    const px = x + (f.to[0] - x) * ease;
    const py = y + (f.to[1] - y) * u * u - Math.sin(u * Math.PI) * f.arc - hop;
    // Spin while airborne and settle into the resting angle as it lands.
    const turns = Math.round((f.spin - f.rest) / (Math.PI * 2)) * Math.PI * 2 + f.rest;
    const rotation = turns * ease + Math.sin(after * 18) * Math.exp(-after * 8) * .25 * Math.sign(f.bounce);
    return { x: px, y: py, rotation, flying: u < 1, after };
}

function ductProps(ctx: RenderCtx, x: number, y: number, age: number) {
    const from = x + 6;
    // The knocked-over cup leaves coffee behind first, so it sits under everything else.
    for (const f of PROPS) if (f.kind === 'spill') coffeeSpill(ctx, from, y, age, f);
    for (const f of PROPS) {
        const at = flight(from, y, age, f);
        ctx.ox = at.x; ctx.oy = at.y; ctx.rotation = at.rotation; ctx.localScale = SCALE[f.kind];
        if (f.kind === 'can') energyCan(ctx);
        else if (f.kind === 'cup' || f.kind === 'spill') coffeeCup(ctx, f.kind === 'spill' && !at.flying);
        else if (f.kind === 'badge') idBadge(ctx, at.flying ? age : -1);
        else necktie(ctx, at.flying ? age + f.delay * 9 : -1);
    }
    ctx.ox = ctx.oy = ctx.rotation = 0; ctx.localScale = 1;
}

// A takeaway coffee cup: tapered paper body, cardboard sleeve and a snap-on lid.
function coffeeCup(ctx: RenderCtx, empty: boolean) {
    ctx.polygon([[-8, -9], [8, -9], [6, 13], [-6, 13]], DUCT_PROP_COLORS.cup);
    ctx.gradientPolygon([[-8, -9], [8, -9], [6, 13], [-6, 13]],
        ctx.gradientFill(-8, 0, 8, 0, [[0, '#8a7a6640'], [.35, '#ffffff00'], [.5, '#ffffff50'], [1, '#6f604f55']]));
    ctx.polygon([[-7.4, -2], [7.4, -2], [6.6, 7], [-6.6, 7]], '#9a6b43');
    ctx.rect(-4, 1, 8, 2, '#c8a27a');
    ctx.rect(-9.5, -12, 19, 3.5, '#ece7df');
    ctx.polygon([[-7, -12], [7, -12], [5, -15], [-5, -15]], '#dcd5ca');
    ctx.ellipse(3, -14, 1.6, .9, empty ? '#5b3a22' : '#a89f92');
}

// Coffee shaken out of the tumbling cup, then a puddle spreading from where it lands on its side.
function coffeeSpill(ctx: RenderCtx, x: number, y: number, age: number, f: Flight) {
    for (let i = 0; i < 7; i++) {
        const release = f.delay + .08 + i * .04;
        const t = age - release;
        if (t < 0) continue;
        const h = Math.sin(i * 12.9898) * 43758.5453, r = h - Math.floor(h);
        const start = flight(x, y, release, f);
        const landX = f.to[0] - 30 + r * 50, landY = 275.5;
        const u = Math.min(1, t / (.28 + r * .15));
        if (u >= 1) continue;
        const px = start.x + (landX - start.x) * u;
        const py = start.y + (landY - start.y) * u * u - Math.sin(u * Math.PI) * (8 + r * 12);
        ctx.ellipse(px, py, 1.4, 1.8, '#5b3a22d0');
    }
    const after = age - f.delay - f.time;
    if (after <= 0) return;
    const spread = 1 - Math.exp(-after * 2.2);
    const left = f.to[0] - 10 - 22 * spread, right = f.to[0] + 4 + 8 * spread;
    ctx.effectPath([left, 276], [
        [left + 2, 274.4, right - 4, 274.4, right, 276],
        [right - 2, 276.6, left + 2, 276.6, left, 276],
    ], ctx.gradientFill(left, 0, right, 0, [[0, '#4a2c1890'], [.5, '#5b3a22d8'], [1, '#4a2c18b0']]));
    ctx.ellipse(left + (right - left) * .4, 275.3, (right - left) * .15, .5, '#c79b6e80');
}

// A tall energy-drink can: blue body, lightning bolt, brushed rims and a shine down one side.
function energyCan(ctx: RenderCtx) {
    ctx.rect(-8, -18, 16, 36, DUCT_PROP_COLORS.can);
    ctx.gradientPolygon([[-8, -18], [8, -18], [8, 18], [-8, 18]],
        ctx.gradientFill(-8, 0, 8, 0, [[0, '#0c1d5e80'], [.3, '#ffffff00'], [.42, '#ffffff55'], [.55, '#ffffff00'], [1, '#0c1d5e90']]));
    ctx.polygon([[2, -12], [-5, 1], [0, 1], [-3, 12], [5, -2], [0, -2]], '#ffd23a');
    ctx.rect(-7, -21, 14, 4, '#c9d0d8');
    ctx.rect(-5, -23, 10, 2, '#e9edf1');
    ctx.rect(-7, 17, 14, 4, '#aab3be');
}

// An employee badge with nobody on it: blank photo, blank name, still on its lanyard.
function idBadge(ctx: RenderCtx, flutter: number) {
    // In the air the lanyard loop whips about; once landed it slumps onto the ledge beside the card.
    if (flutter < 0) {
        ctx.strokePath([-6, -20], [[-22, -26, -38, -6, -40, 19], [-28, 21, -12, 21, 6, -20]], { width: 3, color: '#2f5fb3', cap: 'round' });
    } else {
        const sway = Math.sin(flutter * 26) * 10;
        ctx.strokePath([-6, -20], [[-14 + sway, -48, 14 + sway, -48, 6, -20]], { width: 3, color: '#2f5fb3', cap: 'round' });
    }
    ctx.rect(-4, -23, 8, 6, '#9aa6b4');
    ctx.rect(-14, -18, 28, 38, '#d7e3ee');
    ctx.rect(-12, -16, 24, 34, DUCT_PROP_COLORS.badge);
    ctx.rect(-12, -16, 24, 6, '#2f5fb3');
    ctx.rect(-7, -7, 14, 15, '#e3e1d8');
    ctx.strokePath([-7, -7], [[-2, -7, 2, -7, 7, -7], [7, -2, 7, 3, 7, 8], [2, 8, -2, 8, -7, 8], [-7, 3, -7, -2, -7, -7]],
        { width: 1, color: '#a8a597', dash: [2, 2] }, { closed: true });
    ctx.rect(-8, 11, 16, 2, '#d2cfc4');
    ctx.rect(-5, 14, 10, 2, '#d2cfc4');
}

// A striped necktie that flutters while it flies and lies flat once it lands.
function necktie(ctx: RenderCtx, flutter: number) {
    const w = flutter < 0 ? 0 : Math.sin(flutter * 30) * 5;
    const w2 = flutter < 0 ? 0 : Math.sin(flutter * 30 + 1.4) * 7;
    ctx.polygon([[-6, -26], [6, -26], [4, -17], [-4, -17]], '#8f2b31');
    ctx.effectPath([-4, -17], [
        [-6 + w * .3, -6, -9 + w, 8, -10 + w2, 22],
        [-6 + w2, 30, 6 + w2, 30, 10 + w2, 22],
        [9 + w, 8, 6 + w * .3, -6, 4, -17],
    ], DUCT_PROP_COLORS.tie);
    for (let i = 0; i < 3; i++) {
        const sy = -10 + i * 11, k = (sy + 17) / 39;
        ctx.rod(-7 + w * k, sy + 4, 7 + w * k, sy - 2, 2.4, '#e3b450');
    }
}
