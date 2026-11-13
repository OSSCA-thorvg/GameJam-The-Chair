import { STAGE_FOUR, type SkyHazard } from '../../game/stages/sky/data';
import type { RenderCtx } from '../context';

const G = { shell: '#aab4c0', side: '#465b79', dark: '#2c3a50', mid: '#8a9aaf', light: '#d6dde5', key: '#e9edf1', led: '#7dffb0', cable: '#3a4658' };

function monitor(ctx: RenderCtx, h: SkyHazard) {
    ctx.polygon([[-22, -16], [22, -16], [27, -12], [-17, -12]], G.shell);
    ctx.polygon([[22, -16], [27, -12], [27, 17], [22, 14]], G.side);
    ctx.gradientPolygon([[-22, -16], [22, -16], [22, 14], [-22, 14]],
        ctx.gradientFill(-22, -16, 22, 14, [[0, '#a6afbf'], [.6, G.shell], [1, G.mid]]));
    ctx.rect(-19, -13, 38, 24, G.side);
    // The screen still glows with a half-finished spreadsheet.
    ctx.gradientPolygon([[-17, -11], [17, -11], [17, 9], [-17, 9]],
        ctx.gradientFill(-17, -11, 17, 9, [[0, '#9fd3ff'], [.5, '#4f86c6'], [1, '#2f5590']]));
    for (let y = -7; y < 8; y += 4) ctx.rod(-14, y, 14, y, .5, '#ffffff55');
    for (let x = -8; x < 17; x += 8) ctx.rod(x, -10, x, 8, .5, '#ffffff55');
    ctx.polygon([[-16, -10], [2, -10], [-9, 8], [-16, 8]], '#ffffff22');
    ctx.ellipse(15, 12, .9, .9, Math.sin(h.spin * 9) > 0 ? G.led : '#3c8a5c');
    ctx.rod(0, 15, 0, 23, 4, G.mid);
    ctx.ellipse(0, 24, 13, 2.5, G.mid);
    ctx.strokePath([4, 22], [[12, 30, -6, 34, 6, 44]], { width: 1.4, color: G.cable, cap: 'round' });
}

function keyboard(ctx: RenderCtx, h: SkyHazard) {
    ctx.polygon([[-30, -6], [30, -6], [33, 6], [-33, 6]], G.side);
    ctx.gradientPolygon([[-30, -9], [30, -9], [32, 3], [-32, 3]],
        ctx.gradientFill(0, -9, 0, 3, [[0, G.light], [1, G.shell]]));
    for (let row = 0; row < 3; row++) for (let col = 0; col < 9; col++) {
        // One key drifts loose and bobs above the rest.
        const loose = row === 0 && col === 6;
        const lift = loose ? -6 - Math.sin(h.spin * 3) * 3 : 0;
        ctx.rect(-27 + col * 6 + row, -7.5 + row * 3.4 + lift, 4.6, 2.6, loose ? '#f2c230' : G.key);
    }
    ctx.rect(-14, 2.4, 28, 1.4, G.key);
    ctx.strokePath([30, -4], [[44, -10, 40, 8, 54, 2 + Math.sin(h.spin * 2) * 4]], { width: 1.6, color: G.cable, cap: 'round' });
}

function mouse(ctx: RenderCtx, h: SkyHazard) {
    // The cable streams behind like a tail.
    ctx.strokePath([10, -2], [[22, -8 + Math.sin(h.spin * 4) * 5, 30, 6, 42, Math.sin(h.spin * 4 + 1) * 6]], { width: 1.5, color: G.cable, cap: 'round' });
    ctx.ellipse(0, 0, 13, 9, ctx.radialFill(-3, -3, 14, [[0, G.light], [.7, G.shell], [1, G.side]]));
    ctx.rod(-12, -1, 0, -1, .8, G.side);
    ctx.ellipse(-5, -1, 2, 1.4, G.dark);
    ctx.ellipse(-9, 3, 2.5, 1.2, ctx.tint('#ff5a4f', .5 + Math.sin(h.spin * 6) * .5), { blend: 'add' });
}

function tower(ctx: RenderCtx, h: SkyHazard) {
    ctx.polygon([[13, -26], [19, -22], [19, 30], [13, 26]], G.dark);
    ctx.polygon([[-13, -26], [13, -26], [19, -22], [-7, -22]], G.shell);
    ctx.gradientPolygon([[-13, -26], [13, -26], [13, 26], [-13, 26]],
        ctx.gradientFill(-13, 0, 13, 0, [[0, G.mid], [.4, G.side], [1, G.dark]]));
    ctx.rect(-10, -21, 20, 5, G.dark);
    ctx.rect(-10, -14, 20, 5, G.dark);
    ctx.rod(-7, -18.5, 3, -18.5, 1, G.mid);
    // A front fan, still spinning on nothing.
    ctx.ellipse(0, 8, 8, 8, G.dark);
    for (let i = 0; i < 4; i++) {
        const a = h.spin * 14 + i * Math.PI / 2;
        ctx.rod(0, 8, Math.cos(a) * 7, 8 + Math.sin(a) * 7, 2, G.mid);
    }
    ctx.ellipse(0, 8, 2, 2, G.light);
    ctx.ellipse(-8, 21, 1.4, 1.4, G.led, { blend: 'add' });
    ctx.ellipse(-4, 21, 1.4, 1.4, Math.sin(h.spin * 11) > .3 ? '#ffb347' : G.dark);
}

const ART = { monitor, keyboard, mouse, tower };

// Loose office gear tumbles through the gaps; a hit sends the chair bouncing back.
export function skyGearArt(ctx: RenderCtx, gear: readonly SkyHazard[]) {
    if (!gear.length) return;
    ctx.beginLayer({ key: 'sky-office-gear' });
    for (const h of gear) {
        ctx.ox = h.x; ctx.oy = h.y; ctx.rotation = h.spin; ctx.localScale = 1.35;
        ART[h.item ?? 'monitor'](ctx, h);
    }
    ctx.ox = ctx.oy = ctx.rotation = 0; ctx.localScale = 1;
    ctx.endLayer();
}

// Keycaps and sparks spray off the chair right after a piece of gear clangs into it.
export function skyKnockKeycaps(ctx: RenderCtx) {
    const sky = ctx.state.sky;
    if (sky.knockKind !== 'gear' || sky.knock <= 0) return;
    const age = 1 - sky.knock / STAGE_FOUR.knock.cooldown;
    const fade = 1 - age;
    ctx.beginLayer({ key: 'sky-gear-spark', blend: 'add', opacity: fade });
    ctx.ellipse(ctx.p.x + 18, ctx.p.y - 40, 26 + age * 30, 26 + age * 30, ctx.radialFill(ctx.p.x + 18, ctx.p.y - 40, 26 + age * 30,
        [[0, '#fff6c8'], [.4, '#ffd36a88'], [1, '#ffd36a00']]));
    ctx.endLayer();
    for (let i = 0; i < 8; i++) {
        const angle = i * .8 - .6;
        const reach = 30 + age * 90;
        ctx.ox = ctx.p.x + 18 + Math.cos(angle) * reach; ctx.oy = ctx.p.y - 40 + Math.sin(angle) * reach * .7 + age * age * 60;
        ctx.rotation = angle * 3 + age * 9; ctx.localScale = 1.6;
        ctx.rect(-3, -3, 6, 5, ctx.tint(G.side, fade));
        ctx.rect(-2.6, -3.4, 5.2, 4, ctx.tint(i % 3 ? G.key : '#f2c230', fade));
    }
    ctx.ox = ctx.oy = ctx.rotation = 0; ctx.localScale = 1;
}
