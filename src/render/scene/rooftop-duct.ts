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
    const sneezeAge = age - duct.inhaleDuration - duct.twitchDuration;
    if (sneezeAge >= 0) {
        const travel = Math.min(1, sneezeAge / .68);
        const ease = 1 - Math.pow(1 - travel, 3);
        glove(ctx, x + (1308 - x) * ease, y + (44 - y) * ease - Math.sin(travel * Math.PI) * 38, -.27 * ease);
        glove(ctx, x + (1380 - x) * ease, y + (64 - y) * ease - Math.sin(travel * Math.PI) * 52, .32 * ease);
        const spin = Math.min(1, sneezeAge / 1.3);
        glove(ctx, x - 210 * spin, y - Math.sin(spin * Math.PI) * 90 + 60 * spin, spin * Math.PI * 4.3);
    }
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

function glove(ctx: RenderCtx, x: number, y: number, rotation: number) {
    ctx.ox = x; ctx.oy = y; ctx.rotation = rotation; ctx.localScale = .58;
    ctx.polygon([[-17, 14], [-22, -11], [-14, -23], [13, -23], [21, -10], [17, 15]], '#a18a45');
    for (const [fx, fy, tx, ty] of [[-15, -13, -25, -34], [-8, -22, -13, -47], [1, -22, 0, -51], [10, -20, 14, -44], [17, -7, 31, -26]]) {
        ctx.rod(fx, fy, tx, ty, 8, '#ad9950');
        ctx.ellipse(tx, ty, 4, 4, '#ad9950');
    }
    ctx.rect(-17, 10, 34, 14, '#d1b768');
    ctx.rect(-17, 21, 34, 5, '#806a32');
    ctx.rod(-12, 13, 11, 13, 2, '#ead28b');
    ctx.ox = ctx.oy = ctx.rotation = 0; ctx.localScale = 1;
}
