import { translate } from '../../i18n';
import type { RenderCtx } from '../context';
import { SIGN_FONT } from '../fonts';
import type { Vector } from '../types';
import { drawWorld } from './world';
import { sprayPlume } from './spray';
import { officeTint } from './window-view';
import { PathBuilder, push, radial, screenRect } from './opening/shapes';

// The title screen: the stage-one office after hours, the exit door thrown open and the chair blasting
// toward it on its extinguisher while the worker keeps typing. Everything in it is the game's own art.

/** Where the start sign sits, as fractions of the scene; the DOM start button covers the same box. */
export const TITLE_SIGN = { left: .055, top: .73, width: .25, height: .15 } as const;

/** How far left of the exit door the chair is caught mid-dash, in world units. */
const DASH = 200;
/** World width the title shows; the play view shows 1000. */
const VIEW = 720;
const QUIET = { from: 2.45, loop: 3 * Math.PI * 2 / 24 };

export function drawTitle(ctx: RenderCtx, time: number) {
    const saved = {
        cam: ctx.cam, VW: ctx.VW, scale: ctx.scale, vertical: ctx.vertical, p: ctx.p, state: ctx.state, t: ctx.t,
        wheel: ctx.wheel, people: ctx.people, papers: ctx.papers, monitors: ctx.monitors,
    };
    const goal = ctx.GOAL;
    // Closer than the play view, so the chair carries the frame with the open door at its right.
    ctx.VW = VIEW;
    ctx.scale = ctx.W / ctx.VW;
    ctx.cam = goal - DASH - ctx.VW * .5;
    ctx.vertical = ctx.H * .86 / ctx.scale - ctx.p.y;
    // The scene clock loops inside a stretch where the floor geysers by the door rest, three typing beats long.
    ctx.t = QUIET.from + time % QUIET.loop;
    ctx.wheel = time * 9;
    ctx.p = { ...ctx.p, x: goal - DASH, a: -.1 - .015 * Math.sin(time * 9) };
    ctx.state = {
        ...ctx.state,
        player: ctx.p,
        hasExtinguisher: true,
        spray: { ...ctx.state.spray, burst: .2 + .03 * Math.sin(time * 23), dir: { x: -.96, y: .28 } },
    };
    // Only the furniture stays: nobody else is in the office this late, and the monitors are off.
    ctx.people = [];
    ctx.papers = [];
    ctx.monitors = ctx.monitors.map(monitor => ({ ...monitor, active: false, warning: false }));
    ctx.commands = [];
    drawWorld(ctx);
    afterHours(ctx);
    openDoor(ctx, time);
    speedLines(ctx, time);
    sprayPlume(ctx);
    laptopGlow(ctx);
    vignette(ctx);
    titleWords(ctx);
    startSign(ctx, time);
    Object.assign(ctx, saved);
}

/** The night tint the opening ends on, so the title is the same office at the same late hour. */
function afterHours(ctx: RenderCtx) {
    const tint = officeTint(1);
    ctx.beginLayer({ key: 'title-night', blend: 'multiply', opacity: tint.strength });
    screenRect(ctx, tint.color);
    ctx.endLayer();
}

/** The exit door: the leaf swung in, the doorway full of light and the light spilling onto the floor. */
function openDoor(ctx: RenderCtx, time: number) {
    const goal = ctx.GOAL, foot = ctx.F - 62, top = foot - 205;
    const pulse = .92 + .08 * Math.sin(time * 2.3);
    const [dx, dy] = ctx.screenPoint(goal + 18, top + 100);
    ctx.beginLayer({ key: 'title-door-glow', blend: 'add', opacity: .8 * pulse });
    screenRect(ctx, radial(ctx, dx, dy, 420 * ctx.scale, [[0, '#d8ffe6'], [.22, '#8fe8b8aa'], [.6, '#3b8a6a33'], [1, '#12302600']]));
    ctx.endLayer();
    ctx.beginLayer({ key: 'title-door-spill', blend: 'screen', blur: 8, opacity: .55 * pulse });
    ctx.gradientPolygon([[goal - 27, foot], [goal + 63, foot], [goal + 190, ctx.F + 150], [goal - 260, ctx.F + 150]],
        ctx.gradientFill(0, foot, 0, ctx.F + 150, [[0, '#e9fff1'], [1, '#9be7c000']]));
    ctx.endLayer();
    ctx.rect(goal - 27, top + 8, 90, 190, '#f2fff6');
    ctx.polygon([[goal + 63, top + 8], [goal + 98, top - 6], [goal + 98, foot + 14], [goal + 63, foot - 7]], '#55666a');
    ctx.rod(goal + 88, top + 92, goal + 88, top + 126, 4, '#3d4b4f');
}

/** Streaks left behind the chair, sliding back so it reads as moving even on a still frame. */
function speedLines(ctx: RenderCtx, time: number) {
    const p = ctx.p;
    ctx.beginLayer({ key: 'title-speed', opacity: .75 });
    for (let i = 0; i < 6; i++) {
        const y = p.y - 112 + i * 21;
        const run = (time * 1.6 + i * .37) % 1;
        const tail = p.x - 60 - run * 150, length = 40 + (i % 3) * 25;
        ctx.rod(tail - length, y, tail, y, 3, ctx.tint('#e9fff1', 1 - run));
    }
    ctx.endLayer();
}

/** The laptop stays lit in the dark, as in the opening's last hour. */
function laptopGlow(ctx: RenderCtx) {
    const [lx, ly] = ctx.screenPoint(ctx.p.x + 44, ctx.p.y - 46);
    ctx.beginLayer({ key: 'title-laptop', blend: 'add', opacity: .7 });
    screenRect(ctx, radial(ctx, lx, ly, 120 * ctx.scale, [[0, '#9fd2ff'], [.25, '#6fa9e099'], [1, '#2a3b6000']]));
    ctx.endLayer();
}

function vignette(ctx: RenderCtx) {
    const r = Math.hypot(ctx.W, ctx.H) / 2;
    ctx.beginLayer({ key: 'title-vignette', opacity: .7 });
    screenRect(ctx, radial(ctx, ctx.W * .62, ctx.H * .5, r, [[0, '#0b0d1800'], [.5, '#0b0d1800'], [1, '#0b0d18f0']]));
    ctx.endLayer();
}

/** THE CHAIR, always in English, left aligned above the start sign and glowing like the exit sign. */
function titleWords(ctx: RenderCtx) {
    const left = ctx.W * TITLE_SIGN.left;
    const size = Math.min(ctx.H * .2, ctx.W * .12);
    const [gx, gy] = [left + size * 1.3, ctx.H * .14 + size];
    ctx.beginLayer({ key: 'title-word-glow', blend: 'add', opacity: .55 });
    screenRect(ctx, radial(ctx, gx, gy, size * 2.6, [[0, '#7fe7b4aa'], [.5, '#2f7a5a44'], [1, '#12302600']]));
    ctx.endLayer();
    const words: [string, number][] = [['THE', ctx.H * .14 + size * .5], ['CHAIR', ctx.H * .14 + size * 1.45]];
    for (const [word, y] of words) {
        const width = ctx.measureText(word, size);
        ctx.screenText(word, left + width / 2 + size * .04, y + size * .07, size, '#0b1418');
        ctx.screenText(word, left + width / 2, y, size, '#eafff2', { outline: { width: size * .05, color: '#14262b' } });
    }
}

/**
 * The start button drawn as the game's chair-only exit sign: the green plate, the chair pictogram and the
 * arrow, with the word to start in the current language. The DOM button over it takes the click.
 */
function startSign(ctx: RenderCtx, time: number) {
    const x = ctx.W * TITLE_SIGN.left, y = ctx.H * TITLE_SIGN.top;
    const w = ctx.W * TITLE_SIGN.width, h = ctx.H * TITLE_SIGN.height;
    const glow = .75 + .25 * Math.sin(time * 3);
    ctx.beginLayer({ key: 'title-sign-glow', blend: 'add', blur: h * .35, opacity: .65 * glow });
    push(ctx, roundRect(x - h * .1, y - h * .1, w + h * .2, h * 1.2, h * .2).command('#5fd39a'));
    ctx.endLayer();
    push(ctx, roundRect(x, y, w, h, h * .12).command('#557f78', { width: Math.max(2, h * .05), color: '#e2eee0' }));

    const u = h / 43;
    const icon = (px: number, py: number): Vector => [x + h * .18 + px * u, y + py * u];
    const block = (px: number, py: number, pw: number, ph: number, fill: string) =>
        push(ctx, { v: [icon(px, py), icon(px + pw, py), icon(px + pw, py + ph), icon(px, py + ph)], c: fill });
    // The pictogram exactly as the in-game sign draws it, in sign units (43 tall).
    block(0, 7, 19, 29, '#d5e6da');
    block(4, 12, 11, 24, '#557f78');
    block(5, 14, 3, 11, '#e2eee0');
    block(5, 23, 10, 3, '#e2eee0');
    block(9, 26, 2, 4, '#e2eee0');
    block(6, 29, 8, 2, '#e2eee0');
    for (const wx of [7, 13]) push(ctx, circleAt(...icon(wx, 33), 1.6 * u).command('#e2eee0'));

    const arrowLeft = x + w - h * .62, mid = y + h / 2;
    push(ctx, { v: [[arrowLeft, mid - h * .05], [arrowLeft + h * .24, mid - h * .05], [arrowLeft + h * .24, mid + h * .05], [arrowLeft, mid + h * .05]], c: '#e2eee0' });
    push(ctx, { v: [[arrowLeft + h * .18, mid - h * .2], [arrowLeft + h * .42, mid], [arrowLeft + h * .18, mid + h * .2]], c: '#e2eee0' });

    const label = translate('button.start', ctx.locale);
    const textLeft = x + h * .18 + 24 * u, textRight = arrowLeft - h * .12;
    const size = Math.min(h * .46, (textRight - textLeft) / Math.max(.1, ctx.measureText(label, 1)));
    ctx.screenText(label, (textLeft + textRight) / 2, mid + h * .02, size, '#f4fff7', { font: SIGN_FONT });
}

function roundRect(x: number, y: number, w: number, h: number, r: number) {
    return new PathBuilder(x + r, y)
        .line(x + w - r, y).corner(x + w, y, x + w, y + r)
        .line(x + w, y + h - r).corner(x + w, y + h, x + w - r, y + h)
        .line(x + r, y + h).corner(x, y + h, x, y + h - r)
        .line(x, y + r).corner(x, y, x + r, y);
}

function circleAt(cx: number, cy: number, r: number) {
    return new PathBuilder(cx + r, cy)
        .corner(cx + r, cy + r, cx, cy + r).corner(cx - r, cy + r, cx - r, cy)
        .corner(cx - r, cy - r, cx, cy - r).corner(cx + r, cy - r, cx + r, cy);
}
