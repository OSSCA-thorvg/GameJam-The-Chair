import { GRAPH_CORNERS, GRAPH_LENGTH, STAGE_THREE, graphPointAt } from '../../game/stages/rooftop/data';
import type { RenderCtx } from '../context';
import type { Curve, Vector } from '../types';

// The sales-graph sign on the facade below the roof edge. It shows a slump until the chair lands on
// it; then the line turns green and draws itself (ThorVG trim path) just ahead of the chair, breaking
// out through the top of the sign and up the building.
const PANEL = { left: 2468, right: 2960, top: 10, bottom: 190 };
const SLUMP_END = STAGE_THREE.graph.catchUntil;
// Where the line breaks through the sign's top edge.
const BREAK = { x: 2942, y: PANEL.top };

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

    // Brackets bolt the sign to the facade.
    for (const y of [PANEL.top + 30, PANEL.bottom - 30]) ctx.rod(2460, y, PANEL.left + 6, y, 7, '#4b5568');
    // Board with an LED grid.
    ctx.rect(PANEL.left - 6, PANEL.top - 6, PANEL.right - PANEL.left + 12, PANEL.bottom - PANEL.top + 12, '#2b3242');
    ctx.gradientPolygon([[PANEL.left, PANEL.top], [PANEL.right, PANEL.top], [PANEL.right, PANEL.bottom], [PANEL.left, PANEL.bottom]],
        ctx.gradientFill(0, PANEL.top, 0, PANEL.bottom, [[0, '#101a2b'], [1, '#1b2a3e']]));
    for (let x = PANEL.left + 31; x < PANEL.right; x += 31) ctx.rod(x, PANEL.top + 4, x, PANEL.bottom - 4, 1, '#2b3d55');
    for (let y = PANEL.top + 34; y < PANEL.bottom; y += 34) ctx.rod(PANEL.left + 4, y, PANEL.right - 4, y, 1, '#2b3d55');
    // Little sales bars along the bottom; they jump up once sales surge.
    for (let i = 0; i < 13; i++) {
        const x = PANEL.left + 14 + i * 37;
        const calm = 18 + ((i * 37) % 23) - i * 1.2;
        const h = surging ? Math.min(150, calm + 30 + i * 9 + Math.sin(t * 9 + i) * 6) : calm;
        ctx.rect(x, PANEL.bottom - 6 - h, 14, h, surging ? '#2f8a5ad0' : '#6b3540c0');
    }

    if (!surging) {
        // The slump: a dim red line ending in a falling arrow, blinking like a bad quarter.
        const slump = lineCurves(0, SLUMP_END);
        const blink = .55 + .45 * Math.abs(Math.sin(t * 3));
        ctx.beginLayer({ key: 'graph-glow', blur: 3, blend: 'add', opacity: .8 * blink });
        ctx.strokePath(slump.start, slump.curves, { width: 13, color: '#ff3b4e', cap: 'round' });
        ctx.endLayer();
        ctx.strokePath(slump.start, slump.curves, { width: 4, color: '#ffd0d4', cap: 'round' });
        tipArrow(ctx, graphPointAt(GRAPH_CORNERS[SLUMP_END]), '#ff5466');
        // Chevrons falling from the roof edge onto the sign: drop here.
        if (ctx.p.x > 2100) for (let i = 0; i < 3; i++) {
            const y = -125 + ((t * 60 + i * 40) % 120);
            const alpha = Math.round(255 * Math.max(0, 1 - Math.abs(y + 65) / 70)).toString(16).padStart(2, '0');
            ctx.polygon([[2636, y], [2664, y], [2650, y + 13]], `#ffe2a8${alpha}`);
        }
        return;
    }

    // The surge: the whole line, drawn up to just ahead of the chair.
    const whole = lineCurves(0, STAGE_THREE.graph.points.length - 1);
    const trim: [number, number] = [0, shown / GRAPH_LENGTH];
    ctx.beginLayer({ key: 'graph-glow', blur: 5, blend: 'add', opacity: .9 });
    ctx.strokePath(whole.start, whole.curves, { width: 22, color: '#2bff88', cap: 'round' }, { trim });
    ctx.endLayer();
    ctx.strokePath(whole.start, whole.curves, { width: 9, color: ctx.gradientFill(0, 200, 0, -1000, [[0, '#4dff9a'], [.5, '#c4ff5c'], [1, '#fff27a']]), cap: 'round' }, { trim });
    ctx.strokePath(whole.start, whole.curves, { width: 3, color: '#f4fff6', cap: 'round' }, { trim });
    tipArrow(ctx, graphPointAt(shown), '#c9ff6a');

    // Where the line burst out of the sign: a cracked frame and flying glass.
    if (shown > GRAPH_CORNERS[6] + 40) {
        for (const [dx, dy] of [[-22, -10], [18, -14], [-6, 16], [26, 8]]) ctx.rod(BREAK.x, BREAK.y, BREAK.x + dx, BREAK.y + dy, 1.6, '#cfe4ff');
        const age = flight.kind === 'ride' ? Math.max(0, flight.age - .45) : 3;
        for (let i = 0; i < 6; i++) {
            const k = Math.min(age, 1.6);
            const x = BREAK.x + (i - 2.5) * 22 * k, y = BREAK.y - 60 * k + 260 * k * k;
            ctx.polygon([[x, y], [x + 7, y + 3], [x + 2, y + 9]], '#d6ecffb0');
        }
    }

    // Each peak the chair passes pops a bigger growth figure.
    const peaks = [5, 7, 9];
    peaks.forEach((index, n) => {
        const at = GRAPH_CORNERS[index];
        if (shown < at) return;
        const point = STAGE_THREE.graph.points[index];
        const pop = Math.min(1, (shown - at) / 120);
        ctx.label(`+${[120, 480, 9999][n]}%`, point.x - 18, point.y - 18 - pop * 14, 16 + n * 6 + pop * 4, '#d4ff7a', 'right');
    });
}

// The arrow head at the end of a chart line, pointing along it.
function tipArrow(ctx: RenderCtx, at: { x: number; y: number; tx: number; ty: number }, color: string) {
    const nx = -at.ty, ny = at.tx;
    const tip: Vector = [at.x + at.tx * 16, at.y + at.ty * 16];
    ctx.polygon([tip, [at.x + nx * 11 - at.tx * 6, at.y + ny * 11 - at.ty * 6], [at.x - nx * 11 - at.tx * 6, at.y - ny * 11 - at.ty * 6]], color);
}
