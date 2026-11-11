import { GRAPH_CORNERS, GRAPH_LENGTH, STAGE_THREE, graphPointAt } from '../../game/stages/rooftop/data';
import type { RenderCtx } from '../context';
import type { Curve, Vector } from '../types';

// The company's rooftop billboard. A steel tower on the roof and struts from the facade hold a sales
// board that starts at the roof edge and hangs out over the street, with a logo band on top, a
// maintenance catwalk underneath and floodlights shining up at it. Its line already climbs toward an
// arrow; once the chair rolls onto it the line lights up behind the chair, draws itself just ahead
// (ThorVG trim path), bursts out through the logo band and points straight up into the sky.
const ROOF = -144;
const EDGE = STAGE_THREE.edge;
const PANEL = { left: EDGE, right: 2920, top: -620, bottom: -150 };
const BAND = { top: -668, bottom: PANEL.top };
const TOWER = { left: 2370, right: EDGE };
const INSIDE = STAGE_THREE.graph.catchUntil;
// Where the line breaks through the top of the logo band.
const BREAK = { x: 2873, y: BAND.top };
const LAMPS = [2560, 2700, 2840];

function lineCurves(from: number, to: number): { start: Vector; curves: Curve[] } {
    const pts = STAGE_THREE.graph.points.slice(from, to + 1);
    return {
        start: [pts[0].x, pts[0].y],
        curves: pts.slice(1).map((b, i) => [pts[i].x, pts[i].y, b.x, b.y, b.x, b.y] as Curve),
    };
}

function quad(left: number, top: number, right: number, bottom: number) {
    return [[left, top], [right, top], [right, bottom], [left, bottom]] as Vector[];
}

// Steel lattice tower on the roof behind the board, and struts from the facade under the overhang.
function structure(ctx: RenderCtx) {
    const steel = '#4a5568', dark = '#353e4d';
    for (const x of [TOWER.left, TOWER.right - 6]) ctx.rect(x, BAND.top + 10, 8, ROOF - BAND.top - 10, steel);
    for (let y = ROOF; y > BAND.top + 40; y -= 104) {
        ctx.rod(TOWER.left + 4, y, TOWER.right - 2, y - 104, 3, dark);
        ctx.rod(TOWER.right - 2, y, TOWER.left + 4, y - 104, 3, dark);
        ctx.rod(TOWER.left + 4, y, TOWER.right - 2, y, 4, steel);
    }
    // Base plates bolted to the roof.
    for (const x of [TOWER.left - 6, TOWER.right - 14]) ctx.rect(x, ROOF - 6, 20, 6, '#2c3442');
    // Facade brackets and struts carrying the overhanging board.
    ctx.rect(EDGE, ROOF + 96, 14, 26, dark);
    for (const x of [2640, 2830]) ctx.rod(EDGE + 6, ROOF + 108, x, PANEL.bottom + 6, 6, steel);
    // Stay cables from the tower top to the board's free end.
    ctx.rod(TOWER.left + 4, BAND.top + 14, PANEL.right - 10, BAND.top + 20, 1.6, '#7c8799');
}

// The catwalk under the board: grating, toe board and an end guard rail.
function catwalk(ctx: RenderCtx) {
    const right = EDGE + 480;
    ctx.rect(EDGE, ROOF, right - EDGE, 12, '#3e4859');
    for (let x = EDGE + 6; x < right; x += 12) ctx.rect(x, ROOF + 2, 2, 8, '#262d38');
    ctx.rect(EDGE, ROOF, right - EDGE, 2, '#a9b5c3');
    ctx.rect(right - 6, ROOF - 46, 6, 46, '#71849a');
    ctx.rect(right - 6, ROOF - 46, 6, 4, '#f3bf70');
}

// Floodlights on arms below the catwalk, washing the board with light.
function floodlights(ctx: RenderCtx, on: number) {
    ctx.beginLayer({ key: 'billboard-flood', blend: 'add', opacity: .5 * on });
    for (const x of LAMPS) {
        ctx.gradientPolygon([[x - 8, ROOF], [x + 8, ROOF], [x + 70, PANEL.bottom - 220], [x - 70, PANEL.bottom - 220]],
            ctx.gradientFill(0, ROOF, 0, PANEL.bottom - 220, [[0, '#ffe7b0a0'], [1, '#ffe7b000']]));
    }
    ctx.endLayer();
    for (const x of LAMPS) {
        ctx.rod(x, ROOF + 12, x, ROOF + 22, 3, '#3a4352');
        ctx.polygon([[x - 9, ROOF + 22], [x + 9, ROOF + 22], [x + 6, ROOF + 12], [x - 6, ROOF + 12]], '#5a6577');
    }
}

// The logo band: the company's chair pictogram and a row of lit panels.
function logoBand(ctx: RenderCtx, surging: boolean) {
    ctx.rect(PANEL.left - 6, BAND.top, PANEL.right - PANEL.left + 12, BAND.bottom - BAND.top, '#e9e2d2');
    ctx.rect(PANEL.left - 6, BAND.bottom - 5, PANEL.right - PANEL.left + 12, 5, '#b6ad99');
    const cx = PANEL.left + 34, cy = (BAND.top + BAND.bottom) / 2;
    ctx.ellipse(cx, cy, 20, 20, '#2f5fb3');
    ctx.rect(cx - 8, cy - 12, 5, 18, '#f4efe3');
    ctx.rect(cx - 8, cy + 2, 16, 4, '#f4efe3');
    ctx.rod(cx - 2, cy + 6, cx - 2, cy + 12, 2, '#f4efe3');
    ctx.rod(cx - 8, cy + 13, cx + 6, cy + 13, 2, '#f4efe3');
    for (let i = 0; i < 6; i++) ctx.rect(PANEL.left + 70 + i * 62, cy - 6, 48, 12, surging ? '#2f8a5a' : '#2f5fb3');
}

export function rooftopGraphSign(ctx: RenderCtx) {
    const flight = ctx.state.firstFlight;
    const surging = flight.kind !== 'course';
    const shown = flight.kind === 'ride' ? Math.min(GRAPH_LENGTH, flight.dist + STAGE_THREE.graph.lead) : flight.kind === 'flight' ? GRAPH_LENGTH : 0;
    const t = ctx.t;

    structure(ctx);
    floodlights(ctx, surging ? 1 : .65 + .1 * Math.sin(t * 1.7));
    // The board with an LED grid.
    ctx.rect(PANEL.left - 6, PANEL.top, PANEL.right - PANEL.left + 12, PANEL.bottom - PANEL.top + 6, '#2b3242');
    ctx.gradientPolygon(quad(PANEL.left, PANEL.top + 4, PANEL.right, PANEL.bottom),
        ctx.gradientFill(0, PANEL.top, 0, PANEL.bottom, [[0, '#101a2b'], [1, '#1b2a3e']]));
    for (let x = PANEL.left + 40; x < PANEL.right; x += 40) ctx.rod(x, PANEL.top + 8, x, PANEL.bottom - 4, 1, '#2b3d55');
    for (let y = PANEL.top + 50; y < PANEL.bottom; y += 50) ctx.rod(PANEL.left + 4, y, PANEL.right - 4, y, 1, '#2b3d55');
    // Rising sales bars; they shoot up once the chair is riding.
    for (let i = 0; i < 12; i++) {
        const x = PANEL.left + 16 + i * 38;
        const calm = 24 + i * 16;
        const h = surging ? Math.min(420, calm * 1.8 + 40 + Math.sin(t * 9 + i) * 8) : calm + Math.sin(t * 2 + i) * 3;
        ctx.rect(x, PANEL.bottom - 6 - h, 16, h, surging ? '#2f8a5ad0' : '#2b5a4ab0');
    }
    logoBand(ctx, surging);
    catwalk(ctx);

    // The resting chart: the climbing line inside the board, pulsing gently, with its arrow.
    const inside = lineCurves(0, INSIDE);
    const pulse = .55 + .45 * Math.abs(Math.sin(t * 2.6));
    ctx.beginLayer({ key: 'graph-rest-glow', blur: 3, blend: 'add', opacity: (surging ? .35 : .75) * pulse });
    ctx.strokePath(inside.start, inside.curves, { width: 13, color: '#3cff9a', cap: 'round' });
    ctx.endLayer();
    ctx.strokePath(inside.start, inside.curves, { width: 4, color: surging ? '#4f8f6c' : '#bdf5d4', cap: 'round' });
    if (!surging) {
        tipArrow(ctx, graphPointAt(GRAPH_CORNERS[INSIDE]), '#7dffb5');
        // Chevrons along the start of the line: roll this way.
        if (ctx.p.x > 2150) for (let i = 0; i < 3; i++) {
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
    ctx.strokePath(whole.start, whole.curves, { width: 9, color: ctx.gradientFill(0, ROOF, 0, -1000, [[0, '#4dff9a'], [.5, '#c4ff5c'], [1, '#fff27a']]), cap: 'round' }, { trim });
    ctx.strokePath(whole.start, whole.curves, { width: 3, color: '#f4fff6', cap: 'round' }, { trim });
    tipArrow(ctx, graphPointAt(shown), '#c9ff6a');

    // Where the line burst out through the logo band: a cracked band and falling chips.
    if (shown > GRAPH_CORNERS[INSIDE] + 140) {
        for (const [dx, dy] of [[-24, 12], [20, 16], [-10, 30], [28, 34]]) ctx.rod(BREAK.x, BREAK.y, BREAK.x + dx, BREAK.y + dy, 1.8, '#6b6253');
        const age = flight.kind === 'ride' ? Math.max(0, flight.age - 1.1) : 3;
        for (let i = 0; i < 6; i++) {
            const k = Math.min(age, 1.6);
            const x = BREAK.x + (i - 2.5) * 22 * k, y = BREAK.y - 60 * k + 260 * k * k;
            ctx.polygon([[x, y], [x + 8, y + 3], [x + 2, y + 9]], '#e9e2d2');
        }
    }
}

// The arrow head at the end of a chart line, pointing along it.
function tipArrow(ctx: RenderCtx, at: { x: number; y: number; tx: number; ty: number }, color: string) {
    const nx = -at.ty, ny = at.tx;
    const tip: Vector = [at.x + at.tx * 16, at.y + at.ty * 16];
    ctx.polygon([tip, [at.x + nx * 11 - at.tx * 6, at.y + ny * 11 - at.ty * 6], [at.x - nx * 11 - at.tx * 6, at.y - ny * 11 - at.ty * 6]], color);
}
