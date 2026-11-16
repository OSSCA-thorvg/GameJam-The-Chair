import {
    circle,
    dialCircle,
    linear,
    mix,
    PathBuilder,
    polygon,
    push,
    radial,
    rotate,
    screenRect,
} from './shapes';
import { roofShape } from '../office/skyline';
import { underOfficeTint, windowView } from '../office/window-view';

import type { OpeningFrame } from './timeline';
import type { RenderCtx } from '../../context';
import type { DrawCommand, Vector } from '../../types';
import type { Roof } from '../office/skyline';
import type { WindowView } from '../office/window-view';
export function clockLayout(
    ctx: RenderCtx,
    frame: OpeningFrame,
): {
    cx: number;
    cy: number;
    R: number;
} {
    const R = Math.min(ctx.W * 0.5, ctx.H) * 0.3;
    return { cx: ctx.W / 2, cy: ctx.H / 2 + R * 0.05, R: R * frame.clockScale };
}
function handShape(length: number, width: number, tail: number): Vector[] {
    return [
        [-width * 0.6, tail],
        [-width, 0],
        [-width * 0.35, -length * 0.92],
        [0, -length],
        [width * 0.35, -length * 0.92],
        [width, 0],
        [width * 0.6, tail],
    ];
}
type Pane = { x: number; y: number; w: number; h: number };
type Tower = { x: number; w: number; h: number; roof: Roof };
const BACK_ROW: Tower[] = [
    { x: -0.04, w: 0.3, h: 0.6, roof: 'flat' },
    { x: 0.3, w: 0.2, h: 0.78, roof: 'antenna' },
    { x: 0.55, w: 0.25, h: 0.4, roof: 'flat' },
    { x: 0.8, w: 0.26, h: 0.68, roof: 'flat' },
];
const FRONT_ROW: Tower[] = [
    { x: -0.02, w: 0.3, h: 0.36, roof: 'flat' },
    { x: 0.32, w: 0.24, h: 0.48, roof: 'setback' },
    { x: 0.62, w: 0.4, h: 0.32, roof: 'flat' },
];
function tower(
    ctx: RenderCtx,
    pane: Pane,
    t: Tower,
    body: string,
    dusk: number,
) {
    const left = pane.x + t.x * pane.w;
    const width = t.w * pane.w;
    const base = pane.y + pane.h;
    const top = base - t.h * pane.h;
    polygon(
        ctx,
        [
            [left, top],
            [left + width, top],
            [left + width, base],
            [left, base],
        ],
        body,
    );
    roofShape(
        (points, color) => polygon(ctx, points, color),
        left,
        top,
        width,
        {
            roof: t.roof,
            color: body,
        },
    );
    if (dusk <= 0.3) {
        return;
    }
    const size = width * 0.14;
    const lit = underOfficeTint(windowView(dusk).lit, dusk);
    for (let y = top + size * 1.5; y + size < base - size; y += size * 3) {
        for (const x of [left + width * 0.28, left + width * 0.58]) {
            polygon(
                ctx,
                [
                    [x, y],
                    [x + size, y],
                    [x + size, y + size],
                    [x, y + size],
                ],
                lit,
            );
        }
    }
}
function windowSkyline(ctx: RenderCtx, pane: Pane, dusk: number) {
    const building = underOfficeTint(windowView(dusk).building, dusk);
    const far = underOfficeTint(windowView(dusk).buildingFar, dusk);
    for (const t of BACK_ROW) {
        tower(ctx, pane, t, far, 0);
    }
    for (const t of FRONT_ROW) {
        tower(ctx, pane, t, building, dusk);
    }
}
export function drawClock(ctx: RenderCtx, frame: OpeningFrame): void {
    const { cx, cy, R } = clockLayout(ctx, frame);
    const { dusk, wx, wy, ww, layer, at, squash, shape } = drawClockWindow(
        frame,
        cx,
        cy,
        R,
        ctx,
    );
    const wh = R * 1.7;
    const view = windowView(dusk);
    const tinted = (color: string) => underOfficeTint(color, dusk);
    polygon(
        ctx,
        [
            [wx - 8, wy - 8],
            [wx + ww + 8, wy - 8],
            [wx + ww + 8, wy + wh + 8],
            [wx - 8, wy + wh + 8],
        ],
        tinted(view.frame),
    );
    ctx.endLayer();
    const pane = {
        kind: 'path' as const,
        points: [
            [wx, wy],
            [wx + ww, wy],
            [wx + ww, wy + wh],
            [wx, wy + wh],
        ] as Vector[],
        fill: '#ffffff',
    };
    layer('sky', { clip: pane });
    polygon(
        ctx,
        [
            [wx, wy],
            [wx + ww, wy],
            [wx + ww, wy + wh],
            [wx, wy + wh],
        ],
        linear(
            ctx,
            [0, wy],
            [0, wy + wh],
            [
                [0, tinted(view.skyTop)],
                [1, tinted(view.skyBottom)],
            ],
        ),
    );
    const sunY = wy + wh * (0.55 + dusk * 0.7);
    drawSunlight(ctx, wx, ww, sunY, {
        R,
        dusk,
        wy,
        wh,
        layer,
        tinted,
        view,
        at,
        squash,
        shape,
        frame,
    });
}
function drawSunlight(
    ctx: RenderCtx,
    wx: number,
    ww: number,
    sunY: number,
    {
        R: radius,
        dusk,
        wy,
        wh,
        layer,
        tinted,
        view,
        at,
        squash,
        shape,
        frame,
    }: {
        R: number;
        dusk: number;
        wy: number;
        wh: number;
        layer: (
            key: string,
            extra?: Partial<NonNullable<RenderCtx['layer']>>,
        ) => void;
        tinted: (color: string) => string;
        view: WindowView;
        at: (x: number, y: number) => Vector;
        squash: number;
        shape: (points: Vector[], angle?: number) => Vector[];
        frame: OpeningFrame;
    },
) {
    push(
        ctx,
        circle(wx + ww * 0.55, sunY, radius * 0.2).command(
            radial(ctx, wx + ww * 0.55, sunY, radius * 0.2, {
                stops: [
                    [0, '#fff2c9'],
                    [1, '#f39a5a'],
                ],
                alpha: 1 - dusk,
            }),
        ),
    );
    const click = drawWindowBackdrop(ctx, wx, wy, ww, {
        wh,
        dusk,
        layer,
        tinted,
        view,
        R: radius,
        at,
        squash,
        shape,
        frame,
    });
    if (click > 0.05) {
        layer('click', { opacity: Math.min(1, click * 2) });
        for (let i = 0; i < 3; i++) {
            const a = -0.9 + i * 0.45;
            const p0 = at(Math.sin(a) * 1.15, -Math.cos(a) * 1.15);
            const p1 = at(
                Math.sin(a) * (1.3 + click * 0.2),
                -Math.cos(a) * (1.3 + click * 0.2),
            );
            push(
                ctx,
                new PathBuilder(...p0).line(...p1).command(
                    null,
                    {
                        width: Math.max(2, radius * 0.035),
                        color: '#2b2f3a',
                        cap: 'round',
                    },
                    true,
                ),
            );
        }
        ctx.endLayer();
    }
}
function drawWindowBackdrop(
    ctx: RenderCtx,
    wx: number,
    wy: number,
    ww: number,
    {
        wh,
        dusk,
        layer,
        tinted,
        view,
        R: radius,
        at,
        squash,
        shape,
        frame,
    }: {
        wh: number;
        dusk: number;
        layer: (
            key: string,
            extra?: Partial<NonNullable<RenderCtx['layer']>>,
        ) => void;
        tinted: (color: string) => string;
        view: WindowView;
        R: number;
        at: (x: number, y: number) => Vector;
        squash: number;
        shape: (points: Vector[], angle?: number) => Vector[];
        frame: OpeningFrame;
    },
) {
    windowSkyline(ctx, { x: wx, y: wy, w: ww, h: wh }, dusk);
    ctx.endLayer();
    layer('mullion');
    polygon(
        ctx,
        [
            [wx + ww / 2 - 2, wy],
            [wx + ww / 2 + 2, wy],
            [wx + ww / 2 + 2, wy + wh],
            [wx + ww / 2 - 2, wy + wh],
        ],
        tinted(view.frame),
    );
    ctx.endLayer();
    if (dusk < 1) {
        layer('sunpatch', {
            blend: 'screen',
            blur: 10,
            opacity: (1 - dusk) * 0.55,
        });
        polygon(
            ctx,
            [
                [wx + ww, wy],
                [wx + ww + radius * 2.4, wy + radius * 0.7],
                [wx + ww + radius * 2.4, wy + wh + radius * 1.4],
                [wx + ww, wy + wh],
            ],
            linear(
                ctx,
                [wx + ww, 0],
                [wx + ww + radius * 2.4, 0],
                [
                    [0, '#ffd59a'],
                    [1, '#ffd59a00'],
                ],
            ),
        );
        ctx.endLayer();
    }
    drawClockScene(layer, radius, at, ctx, {
        squash,
        shape,
        frame,
    });
    ctx.endLayer();
    const click = Math.abs(frame.clockPop);
    return click;
}
function drawClockScene(
    layer: (
        key: string,
        extra?: Partial<NonNullable<RenderCtx['layer']>>,
    ) => void,
    radius: number,
    at: (x: number, y: number) => Vector,
    ctx: RenderCtx,
    {
        squash,
        shape,
        frame,
    }: {
        squash: number;
        shape: (points: Vector[], angle?: number) => Vector[];
        frame: OpeningFrame;
    },
) {
    layer('shadow', { blur: Math.max(2, radius * 0.06), opacity: 0.45 });
    const [sx, sy] = at(0.06, 0.1);
    push(ctx, circle(sx, sy, radius * 1.04).command('#120f18'));
    ctx.endLayer();
    layer('face');
    const [ox, oy] = at(0, 0);
    const { hour, minute } = drawClockForeground(ctx, ox, oy, radius, {
        squash,
        shape,
        frame,
        layer,
    });
    polygon(ctx, shape(handShape(0.5, 0.07, 0.14), hour), '#2b2f3a');
    polygon(ctx, shape(handShape(0.8, 0.05, 0.16), minute), '#2b2f3a');
    push(ctx, circle(ox, oy, radius * 0.07).command('#c9604a'));
    push(ctx, circle(ox, oy, radius * 0.03).command('#f1d6b6'));
    ctx.endLayer();
    layer('glass', { blend: 'screen', opacity: 0.5 });
    const g = new PathBuilder(...at(-0.72, -0.25))
        .cubic(
            at(-0.65, -0.7)[0],
            at(-0.65, -0.7)[1],
            at(-0.2, -0.82)[0],
            at(-0.2, -0.82)[1],
            {
                x: at(0.25, -0.78)[0],
                y: at(0.25, -0.78)[1],
            },
        )
        .cubic(
            at(-0.15, -0.68)[0],
            at(-0.15, -0.68)[1],
            at(-0.55, -0.5)[0],
            at(-0.55, -0.5)[1],
            {
                x: at(-0.72, -0.25)[0],
                y: at(-0.72, -0.25)[1],
            },
        );
    push(
        ctx,
        g.command(
            linear(ctx, at(-0.7, -0.7), at(0, -0.2), [
                [0, '#ffffff'],
                [1, '#ffffff00'],
            ]),
        ),
    );
}
function drawClockForeground(
    ctx: RenderCtx,
    ox: number,
    oy: number,
    radius: number,
    {
        squash,
        shape,
        frame,
        layer,
    }: {
        squash: number;
        shape: (points: Vector[], angle?: number) => Vector[];
        frame: OpeningFrame;
        layer: (
            key: string,
            extra?: Partial<NonNullable<RenderCtx['layer']>>,
        ) => void;
    },
) {
    drawClockRim(ctx, ox, oy, radius, {
        squash,
        shape,
    });
    const minute = (frame.hours % 1) * ctx.TAU;
    const hour = ((frame.hours % 12) / 12) * ctx.TAU;
    if (frame.spin > 0.02) {
        const end = frame.hours % 1;
        const begin = end - frame.spin * 0.55;
        const trail = (from: number, to: number) => {
            const path = dialCircle(ox, oy, radius * 0.55);
            const cmd: DrawCommand = path.command(
                null,
                {
                    width: radius * 0.16,
                    color: ctx.tint('#e8945a', 0.5),
                    cap: 'round',
                },
                true,
            );
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
        layer('ghost', {
            blur: 2 + frame.spin * 5,
            opacity: 0.55 * frame.spin,
        });
        for (let i = 1; i <= 5; i++) {
            polygon(
                ctx,
                shape(
                    handShape(0.8, 0.05, 0.14),
                    minute - i * frame.spin * 0.18,
                ),
                '#3d4250',
            );
        }
        ctx.endLayer();
    }
    layer('hands');
    return { hour, minute };
}
function drawClockRim(
    ctx: RenderCtx,
    ox: number,
    oy: number,
    radius: number,
    {
        squash,
        shape,
    }: {
        squash: number;
        shape: (points: Vector[], angle?: number) => Vector[];
    },
) {
    push(
        ctx,
        circle(ox, oy, radius * (1 + squash), radius * (1 - squash)).command(
            radial(ctx, ox - radius * 0.3, oy - radius * 0.3, radius * 1.5, {
                stops: [
                    [0, '#6b7385'],
                    [1, '#262a35'],
                ],
            }),
        ),
    );
    push(
        ctx,
        circle(
            ox,
            oy,
            radius * 0.88 * (1 + squash),
            radius * 0.88 * (1 - squash),
        ).command(
            radial(ctx, ox - radius * 0.2, oy - radius * 0.25, radius * 1.1, {
                stops: [
                    [0, '#fffaf0'],
                    [0.8, '#efe5cf'],
                    [1, '#d6c9ad'],
                ],
            }),
        ),
    );
    for (let i = 0; i < 60; i++) {
        const major = i % 5 === 0;
        const quarter = i % 15 === 0;
        const w = quarter ? 0.035 : major ? 0.022 : 0.008;
        const l0 = quarter ? 0.64 : major ? 0.7 : 0.76;
        polygon(
            ctx,
            shape(
                [
                    [-w, -0.8],
                    [w, -0.8],
                    [w, -l0],
                    [-w, -l0],
                ],
                (i / 60) * ctx.TAU,
            ),
            quarter ? '#2b2f3a' : major ? '#4a4f5c' : '#9a978d',
        );
    }
    ctx.endLayer();
}
function drawClockWindow(
    frame: OpeningFrame,
    cx: number,
    cy: number,
    radius: number,
    ctx: RenderCtx,
) {
    const dusk = frame.dusk;
    const squash = frame.clockPop * 0.07;
    const nail: Vector = [cx, cy - radius * 1.12];
    const at = (x: number, y: number): Vector =>
        rotate(
            [cx + x * radius * (1 + squash), cy + y * radius * (1 - squash)],
            nail,
            frame.clockWobble,
        );
    const shape = (points: Vector[], angle = 0) =>
        points.map(([x, y]) => {
            const c = Math.cos(angle);
            const s = Math.sin(angle);
            return at(x * c - y * s, x * s + y * c);
        });
    const hole =
        frame.iris !== null && frame.iris > 0
            ? circle(
                  cx,
                  cy,
                  frame.iris * (Math.hypot(ctx.W, ctx.H) / 2 + radius) + 1,
              ).command('#ffffff')
            : undefined;
    const layer = (
        key: string,
        extra: Partial<NonNullable<RenderCtx['layer']>> = {},
    ) =>
        ctx.beginLayer({
            key: `opening-clock-${key}`,
            ...(hole ? { mask: hole, maskInvert: true } : {}),
            ...extra,
        });
    layer('wall');
    screenRect(
        ctx,
        linear(
            ctx,
            [0, 0],
            [0, ctx.H],
            [
                [0, mix('#e9c39a', '#343b58', dusk)],
                [1, mix('#c58f6c', '#1f2438', dusk)],
            ],
        ),
    );
    const wx = cx - radius * 2.75;
    const wy = cy - radius * 0.95;
    const ww = radius * 1.15;
    return { dusk, wx, wy, ww, layer, at, squash, shape };
}
