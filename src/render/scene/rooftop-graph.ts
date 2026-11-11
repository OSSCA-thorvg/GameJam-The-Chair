import { GRAPH_CORNERS, GRAPH_LENGTH, STAGE_THREE, graphPointAt } from '../../game/stages/rooftop/data';
import type { RenderCtx } from '../context';
import type { Curve, Vector } from '../types';

// The sales-graph billboard standing on the roof edge. Its line already climbs toward an arrow at the top
// right. Once the chair rolls onto it the line lights up green behind the chair, draws itself just ahead
// (ThorVG trim path), bursts out through the top of the sign and points straight up into the sky.
const PANEL = { left: 2150, right: 2620, top: -600, bottom: -150 };
const INSIDE = STAGE_THREE.graph.catchUntil;
// Where the line breaks through the sign's top edge.
const BREAK = { x: 2579, y: PANEL.top };
const PEAKS = [3, 5, 7];
const GROWTH = [120, 480, 9999];

function lineCurves(from: number, to: number): { start: Vector; curves: Curve[] } {
    const pts = STAGE_THREE.graph.points.slice(from, to + 1);
    return {
        start: [pts[0].x, pts[0].y],
        curves: pts.slice(1).map((b, i) => [pts[i].x, pts[i].y, b.x, b.y, b.x, b.y] as Curve),
    };
}

export function rooftopGraphSign(ctx: RenderCtx) {
    const flight = ctx.state.firstFlight;
    const surging = flight.kind !== 'course';
    const shown = flight.kind === 'ride' ? Math.min(GRAPH_LENGTH, flight.dist + STAGE_THREE.graph.lead) : flight.kind === 'flight' ? GRAPH_LENGTH : 0;
    const t = ctx.t;

    // Legs on the roof and the board with an LED grid.
    for (const x of [PANEL.left + 40, PANEL.right - 40]) ctx.rod(x, PANEL.bottom, x, -144, 9, '#3d4658');
    ctx.rect(PANEL.left - 7, PANEL.top - 7, PANEL.right - PANEL.left + 14, PANEL.bottom - PANEL.top + 14, '#2b3242');
    ctx.gradientPolygon([[PANEL.left, PANEL.top], [PANEL.right, PANEL.top], [PANEL.right, PANEL.bottom], [PANEL.left, PANEL.bottom]],
        ctx.gradientFill(0, PANEL.top, 0, PANEL.bottom, [[0, '#101a2b'], [1, '#1b2a3e']]));
    for (let x = PANEL.left + 39; x < PANEL.right; x += 39) ctx.rod(x, PANEL.top + 4, x, PANEL.bottom - 4, 1, '#2b3d55');
    for (let y = PANEL.top + 45; y < PANEL.bottom; y += 45) ctx.rod(PANEL.left + 4, y, PANEL.right - 4, y, 1, '#2b3d55');
    // Rising sales bars; they shoot up once the chair is riding.
    for (let i = 0; i < 12; i++) {
        const x = PANEL.left + 14 + i * 38;
        const calm = 24 + i * 16;
        const h = surging ? Math.min(420, calm * 1.8 + 40 + Math.sin(t * 9 + i) * 8) : calm + Math.sin(t * 2 + i) * 3;
        ctx.rect(x, PANEL.bottom - 6 - h, 16, h, surging ? '#2f8a5ad0' : '#2b5a4ab0');
    }

    // The resting chart: the climbing line inside the sign, pulsing gently, with its arrow.
    const inside = lineCurves(0, INSIDE);
    const pulse = .55 + .45 * Math.abs(Math.sin(t * 2.6));
    ctx.beginLayer({ key: 'graph-rest-glow', blur: 3, blend: 'add', opacity: (surging ? .35 : .75) * pulse });
    ctx.strokePath(inside.start, inside.curves, { width: 13, color: '#3cff9a', cap: 'round' });
    ctx.endLayer();
    ctx.strokePath(inside.start, inside.curves, { width: 4, color: surging ? '#4f8f6c' : '#bdf5d4', cap: 'round' });
    if (!surging) {
        tipArrow(ctx, graphPointAt(GRAPH_CORNERS[INSIDE]), '#7dffb5');
        // Chevrons along the start of the line: roll this way.
        if (ctx.p.x > 1950) for (let i = 0; i < 3; i++) {
            const k = (t * .8 + i / 3) % 1;
            const at = graphPointAt(k * GRAPH_CORNERS[3]);
            const alpha = Math.round(255 * Math.sin(k * Math.PI)).toString(16).padStart(2, '0');
            const x = at.x, y = at.y - 20;
            ctx.polygon([[x - 6, y - 9], [x + 8, y], [x - 6, y + 9]], `#ffe2a8${alpha}`);
        }
        return;
    }

    // The surge: the whole line, bright up to just ahead of the chair.
    const whole = lineCurves(0, STAGE_THREE.graph.points.length - 1);
    const trim: [number, number] = [0, shown / GRAPH_LENGTH];
    ctx.beginLayer({ key: 'graph-glow', blur: 5, blend: 'add', opacity: .9 });
    ctx.strokePath(whole.start, whole.curves, { width: 22, color: '#2bff88', cap: 'round' }, { trim });
    ctx.endLayer();
    ctx.strokePath(whole.start, whole.curves, { width: 9, color: ctx.gradientFill(0, -144, 0, -1000, [[0, '#4dff9a'], [.5, '#c4ff5c'], [1, '#fff27a']]), cap: 'round' }, { trim });
    ctx.strokePath(whole.start, whole.curves, { width: 3, color: '#f4fff6', cap: 'round' }, { trim });
    tipArrow(ctx, graphPointAt(shown), '#c9ff6a');

    // Where the line burst out of the sign: a cracked frame and falling glass.
    if (shown > GRAPH_CORNERS[INSIDE] + 40) {
        for (const [dx, dy] of [[-22, -10], [18, -14], [-6, 16], [26, 8]]) ctx.rod(BREAK.x, BREAK.y, BREAK.x + dx, BREAK.y + dy, 1.6, '#cfe4ff');
        const age = flight.kind === 'ride' ? Math.max(0, flight.age - 1) : 3;
        for (let i = 0; i < 6; i++) {
            const k = Math.min(age, 1.6);
            const x = BREAK.x + (i - 2.5) * 22 * k, y = BREAK.y - 60 * k + 260 * k * k;
            ctx.polygon([[x, y], [x + 7, y + 3], [x + 2, y + 9]], '#d6ecffb0');
        }
    }

    // Each peak the chair passes pops a bigger growth figure.
    PEAKS.forEach((index, n) => {
        const at = GRAPH_CORNERS[index];
        if (shown < at) return;
        const point = STAGE_THREE.graph.points[index];
        const pop = Math.min(1, (shown - at) / 120);
        ctx.label(`+${GROWTH[n]}%`, point.x - 20, point.y - 14 - pop * 14, 16 + n * 6 + pop * 4, '#d4ff7a', 'right');
    });
}

// The arrow head at the end of a chart line, pointing along it.
function tipArrow(ctx: RenderCtx, at: { x: number; y: number; tx: number; ty: number }, color: string) {
    const nx = -at.ty, ny = at.tx;
    const tip: Vector = [at.x + at.tx * 16, at.y + at.ty * 16];
    ctx.polygon([tip, [at.x + nx * 11 - at.tx * 6, at.y + ny * 11 - at.ty * 6], [at.x - nx * 11 - at.tx * 6, at.y - ny * 11 - at.ty * 6]], color);
}
