import type { RenderCtx } from '../../context';
import type { DrawCommand, Vector } from '../../types';
import type { OpeningFrame } from './timeline';
import { circle, dialCircle, linear, mix, PathBuilder, polygon, push, radial, rotate, screenRect } from './shapes';
import { underOfficeTint, windowView } from '../window-view';
import { roofShape, type Roof } from '../skyline';

// The office wall clock that marks the hours. It is drawn as a full-screen cover: during the iris
// transitions an inverted alpha mask punches a growing hole through it so the office shows through.

export function clockLayout(ctx: RenderCtx, frame: OpeningFrame) {
    const R = Math.min(ctx.W * .5, ctx.H) * .3;
    return { cx: ctx.W / 2, cy: ctx.H / 2 + R * .05, R: R * frame.clockScale };
}

function handShape(length: number, width: number, tail: number): Vector[] {
    return [[-width * .6, tail], [-width, 0], [-width * .35, -length * .92], [0, -length], [width * .35, -length * .92], [width, 0], [width * .6, tail]];
}

type Pane = { x: number; y: number; w: number; h: number };
/** A building in the window: left edge and width as fractions of the pane, height as a fraction of its height. */
type Tower = { x: number; w: number; h: number; roof: Roof };

// A simple city behind the window: a hazy back row and a darker front row of plain blocks with a few roof
// shapes, so it reads as buildings rather than a bar chart without pulling focus from the clock.
const BACK_ROW: Tower[] = [
    { x: -.04, w: .3, h: .6, roof: 'flat' }, { x: .3, w: .2, h: .78, roof: 'antenna' }, { x: .55, w: .25, h: .4, roof: 'flat' },
    { x: .8, w: .26, h: .68, roof: 'flat' },
];
const FRONT_ROW: Tower[] = [
    { x: -.02, w: .3, h: .36, roof: 'flat' }, { x: .32, w: .24, h: .48, roof: 'setback' }, { x: .62, w: .4, h: .32, roof: 'flat' },
];

/** One block with its roof shape and, once the evening has come, two columns of lit windows. */
function tower(ctx: RenderCtx, pane: Pane, t: Tower, body: string, dusk: number) {
    const left = pane.x + t.x * pane.w, width = t.w * pane.w, base = pane.y + pane.h, top = base - t.h * pane.h;
    polygon(ctx, [[left, top], [left + width, top], [left + width, base], [left, base]], body);
    roofShape((points, color) => polygon(ctx, points, color), left, top, width, t.roof, body);
    if (dusk <= .3) return;
    const size = width * .14, lit = underOfficeTint(windowView(dusk).lit, dusk);
    for (let y = top + size * 1.5; y + size < base - size; y += size * 3) {
        for (const x of [left + width * .28, left + width * .58]) polygon(ctx, [[x, y], [x + size, y], [x + size, y + size], [x, y + size]], lit);
    }
}

/** The city through the window: a hazy back row, then a darker front row in front of it. */
function windowSkyline(ctx: RenderCtx, pane: Pane, dusk: number) {
    const building = underOfficeTint(windowView(dusk).building, dusk);
    for (const t of BACK_ROW) tower(ctx, pane, t, building, 0);
    for (const t of FRONT_ROW) tower(ctx, pane, t, building, dusk);
}

export function drawClock(ctx: RenderCtx, frame: OpeningFrame) {
    const { cx, cy, R } = clockLayout(ctx, frame);
    const dusk = frame.dusk;
    // Clock-local units (radius = 1) to screen, with the arrival squash and the post-spin wobble.
    const squash = frame.clockPop * .07;
    const nail: Vector = [cx, cy - R * 1.12];
    const at = (x: number, y: number): Vector => rotate([cx + x * R * (1 + squash), cy + y * R * (1 - squash)], nail, frame.clockWobble);
    const shape = (points: Vector[], angle = 0) => points.map(([x, y]) => {
        const c = Math.cos(angle), s = Math.sin(angle);
        return at(x * c - y * s, x * s + y * c);
    });

    const hole = frame.iris !== null && frame.iris > 0
        ? circle(cx, cy, frame.iris * (Math.hypot(ctx.W, ctx.H) / 2 + R) + 1).command('#ffffff')
        : undefined;
    const layer = (key: string, extra: Partial<NonNullable<RenderCtx['layer']>> = {}) =>
        ctx.beginLayer({ key: `opening-clock-${key}`, ...(hole ? { mask: hole, maskInvert: true } : {}), ...extra });

    // Wall with a window: a sunset that drains into night as the hours pass.
    layer('wall');
    screenRect(ctx, linear(ctx, [0, 0], [0, ctx.H], [[0, mix('#e9c39a', '#343b58', dusk)], [1, mix('#c58f6c', '#1f2438', dusk)]]));
    const wx = cx - R * 2.75, wy = cy - R * .95, ww = R * 1.15, wh = R * 1.7;
    const view = windowView(dusk), tinted = (color: string) => underOfficeTint(color, dusk);
    polygon(ctx, [[wx - 8, wy - 8], [wx + ww + 8, wy - 8], [wx + ww + 8, wy + wh + 8], [wx - 8, wy + wh + 8]], tinted(view.frame));
    ctx.endLayer();
    // The view through the window is clipped to the frame, so the setting sun sinks out of sight.
    const pane = { v: [[wx, wy], [wx + ww, wy], [wx + ww, wy + wh], [wx, wy + wh]] as Vector[], c: '#ffffff' };
    layer('sky', { clip: pane });
    polygon(ctx, [[wx, wy], [wx + ww, wy], [wx + ww, wy + wh], [wx, wy + wh]],
        linear(ctx, [0, wy], [0, wy + wh], [[0, tinted(view.skyTop)], [1, tinted(view.skyBottom)]]));
    const sunY = wy + wh * (.55 + dusk * .7);
    push(ctx, circle(wx + ww * .55, sunY, R * .2).command(radial(ctx, wx + ww * .55, sunY, R * .2, [[0, '#fff2c9'], [1, '#f39a5a']], 1 - dusk)));
    windowSkyline(ctx, { x: wx, y: wy, w: ww, h: wh }, dusk);
    ctx.endLayer();
    layer('mullion');
    polygon(ctx, [[wx + ww / 2 - 2, wy], [wx + ww / 2 + 2, wy], [wx + ww / 2 + 2, wy + wh], [wx + ww / 2 - 2, wy + wh]], tinted(view.frame));
    ctx.endLayer();

    // Low sun through the window: a warm patch on the wall that fades with the evening.
    if (dusk < 1) {
        layer('sunpatch', { blend: 'screen', blur: 10, opacity: (1 - dusk) * .55 });
        polygon(ctx, [[wx + ww, wy], [wx + ww + R * 2.4, wy + R * .7], [wx + ww + R * 2.4, wy + wh + R * 1.4], [wx + ww, wy + wh]],
            linear(ctx, [wx + ww, 0], [wx + ww + R * 2.4, 0], [[0, '#ffd59a'], [1, '#ffd59a00']]));
        ctx.endLayer();
    }

    // Soft drop shadow (Gaussian blur on its own scene).
    layer('shadow', { blur: Math.max(2, R * .06), opacity: .45 });
    const [sx, sy] = at(.06, .1);
    push(ctx, circle(sx, sy, R * 1.04).command('#120f18'));
    ctx.endLayer();

    layer('face');
    const [ox, oy] = at(0, 0);
    push(ctx, circle(ox, oy, R * (1 + squash), R * (1 - squash)).command(radial(ctx, ox - R * .3, oy - R * .3, R * 1.5, [[0, '#6b7385'], [1, '#262a35']])));
    push(ctx, circle(ox, oy, R * .88 * (1 + squash), R * .88 * (1 - squash)).command(radial(ctx, ox - R * .2, oy - R * .25, R * 1.1, [[0, '#fffaf0'], [.8, '#efe5cf'], [1, '#d6c9ad']])));
    for (let i = 0; i < 60; i++) {
        const major = i % 5 === 0;
        const quarter = i % 15 === 0;
        const w = quarter ? .035 : major ? .022 : .008;
        const l0 = quarter ? .64 : major ? .7 : .76;
        polygon(ctx, shape([[-w, -.8], [w, -.8], [w, -l0], [-w, -l0]], i / 60 * ctx.TAU), quarter ? '#2b2f3a' : major ? '#4a4f5c' : '#9a978d');
    }
    ctx.endLayer();

    const minute = (frame.hours % 1) * ctx.TAU;
    const hour = (frame.hours % 12) / 12 * ctx.TAU;
    // Trail of the racing minute hand: a trimmed dial stroke behind it.
    if (frame.spin > .02) {
        const end = frame.hours % 1;
        const begin = end - frame.spin * .55;
        const trail = (from: number, to: number) => {
            const path = dialCircle(ox, oy, R * .55);
            const cmd: DrawCommand = path.command(null, { width: R * .16, color: ctx.tint('#e8945a', .5), cap: 'round' }, true);
            cmd.trim = [from, to];
            push(ctx, cmd);
        };
        layer('trail', { blur: 1.5, opacity: frame.spin });
        if (begin < 0) {
            trail(1 + begin, 1);
            trail(0, end);
        } else {
            trail(begin, end);
        }
        ctx.endLayer();
        // Ghost hands smeared by a Gaussian blur.
        layer('ghost', { blur: 2 + frame.spin * 5, opacity: .55 * frame.spin });
        for (let i = 1; i <= 5; i++) polygon(ctx, shape(handShape(.8, .05, .14), minute - i * frame.spin * .18), '#3d4250');
        ctx.endLayer();
    }

    layer('hands');
    polygon(ctx, shape(handShape(.5, .07, .14), hour), '#2b2f3a');
    polygon(ctx, shape(handShape(.8, .05, .16), minute), '#2b2f3a');
    push(ctx, circle(ox, oy, R * .07).command('#c9604a'));
    push(ctx, circle(ox, oy, R * .03).command('#f1d6b6'));
    ctx.endLayer();

    // Glass glare (screen blend) and the "click!" lines when the hands land.
    layer('glass', { blend: 'screen', opacity: .5 });
    const g = new PathBuilder(...at(-.72, -.25))
        .cubic(...at(-.65, -.7), ...at(-.2, -.82), ...at(.25, -.78))
        .cubic(...at(-.15, -.68), ...at(-.55, -.5), ...at(-.72, -.25));
    push(ctx, g.command(linear(ctx, at(-.7, -.7), at(0, -.2), [[0, '#ffffff'], [1, '#ffffff00']])));
    ctx.endLayer();
    const click = Math.abs(frame.clockPop);
    if (click > .05) {
        layer('click', { opacity: Math.min(1, click * 2) });
        for (let i = 0; i < 3; i++) {
            const a = -.9 + i * .45;
            const p0 = at(Math.sin(a) * 1.15, -Math.cos(a) * 1.15);
            const p1 = at(Math.sin(a) * (1.3 + click * .2), -Math.cos(a) * (1.3 + click * .2));
            push(ctx, new PathBuilder(...p0).line(...p1).command(null, { width: Math.max(2, R * .035), color: '#2b2f3a', cap: 'round' }, true));
        }
        ctx.endLayer();
    }
}
