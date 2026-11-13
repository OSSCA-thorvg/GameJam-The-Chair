import { GRAPH_CORNERS, GRAPH_LENGTH, STAGE_THREE, graphPointAt } from '../../game/stages/rooftop/data';
import type { RenderCtx } from '../context';
import type { Curve, Vector } from '../types';
import { graphTarget } from './graph-target';

// The company's rooftop billboard. A steel tower on the roof and struts from the facade hold a sales
// board that starts at the roof edge and hangs out over the street, with a maintenance catwalk
// underneath and floodlights shining up at it. Its line already climbs toward an
// arrow; once the chair rolls onto it the line lights up behind the chair, draws itself just ahead
// (ThorVG trim path), then ends above the board while the chair keeps climbing.
const ROOF = -144;
const EDGE = STAGE_THREE.edge;
const PANEL = { left: EDGE, right: 2920, top: -620, bottom: -150 };
const TOWER = { left: 2370, right: EDGE, top: PANEL.top + 10, bays: 5 };
const INSIDE = STAGE_THREE.graph.catchUntil;
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
    for (const x of [TOWER.left, TOWER.right - 6]) ctx.rect(x, TOWER.top, 8, ROOF - TOWER.top, steel);
    const bayHeight = (ROOF - TOWER.top) / TOWER.bays;
    for (let i = 0; i < TOWER.bays; i++) {
        const y = ROOF - i * bayHeight;
        const nextY = y - bayHeight;
        ctx.rod(TOWER.left + 4, y, TOWER.right - 2, nextY, 3, dark);
        ctx.rod(TOWER.right - 2, y, TOWER.left + 4, nextY, 3, dark);
        ctx.rod(TOWER.left + 4, y, TOWER.right - 2, y, 4, steel);
    }
    ctx.rod(TOWER.left + 4, TOWER.top, TOWER.right - 2, TOWER.top, 4, steel);
    // Base plates bolted to the roof.
    for (const x of [TOWER.left - 6, TOWER.right - 14]) ctx.rect(x, ROOF - 6, 20, 6, '#2c3442');
    // Facade brackets and struts carrying the overhanging board.
    ctx.rect(EDGE, ROOF + 96, 14, 26, dark);
    for (const x of [2640, 2830]) ctx.rod(EDGE + 6, ROOF + 108, x, PANEL.bottom + 6, 6, steel);
    // Stay cables from the tower top to the board's free end.
    ctx.rod(TOWER.left + 4, TOWER.top + 4, PANEL.right - 10, TOWER.top + 10, 1.6, '#7c8799');
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

// Floodlights on arms below the catwalk, washing the board with light. They glow while the board waits
// and clack on one by one at full blast the moment the chair boards (`since` is seconds since boarding).
function floodlights(ctx: RenderCtx, since: number | null) {
    const t = ctx.t;
    LAMPS.forEach((x, i) => {
        const on = since === null ? .55 + .06 * Math.sin(t * 7 + i * 2) : since < .12 + i * .14 ? .2 : 1;
        const flash = since === null ? 0 : Math.max(0, 1 - (since - .12 - i * .14) / .35);
        const reach = PANEL.bottom - 300;
        ctx.beginLayer({ key: `billboard-flood-${i}`, blend: 'add', opacity: Math.min(1, on * .75 + flash * .5) });
        ctx.gradientPolygon([[x - 9, ROOF + 12], [x + 9, ROOF + 12], [x + 95, reach], [x - 95, reach]],
            ctx.gradientFill(0, ROOF + 12, 0, reach, [[0, '#fff0c8d0'], [.35, '#ffe2a070'], [1, '#ffe2a000']]));
        ctx.endLayer();
        ctx.rod(x, ROOF + 10, x, ROOF + 24, 3, '#3a4352');
        ctx.polygon([[x - 11, ROOF + 12], [x + 11, ROOF + 12], [x + 7, ROOF + 24], [x - 7, ROOF + 24]], '#5a6577');
        ctx.beginLayer({ key: `billboard-lamp-${i}`, blend: 'add', opacity: Math.min(1, on + flash) });
        ctx.gradientPolygon(quad(x - 30, ROOF - 18, x + 30, ROOF + 42), ctx.radialFill(x, ROOF + 12, 30, [[0, '#fff6dcff'], [.3, '#ffe2a080'], [1, '#ffe2a000']]));
        ctx.endLayer();
    });
}

export function rooftopGraphSign(ctx: RenderCtx) {
    const flight = ctx.state.firstFlight;
    const surging = flight.kind !== 'course';
    const distance = flight.kind === 'ride' ? flight.dist : flight.kind === 'flight' ? GRAPH_LENGTH : 0;
    const shown = surging ? Math.min(GRAPH_LENGTH, distance + STAGE_THREE.graph.lead) : 0;
    structure(ctx);
    board(ctx, surging);
    catwalk(ctx);
    floodlights(ctx, flight.kind === 'ride' ? flight.age : flight.kind === 'flight' ? 9 : null);
    graphTarget(ctx, distance);
    restingLine(ctx, surging);
    chartTip(ctx, surging);
    if (!surging) return;
    surgeLine(ctx, shown);
}

function board(ctx: RenderCtx, surging: boolean) {
    const t = ctx.t;
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
}

function restingLine(ctx: RenderCtx, surging: boolean) {
    const t = ctx.t;
    // A crisp centre stays aligned with the fixed ride surface under the halo.
    const inside = lineCurves(0, INSIDE);
    const pulse = .55 + .45 * Math.abs(Math.sin(t * 2.6));
    ctx.beginLayer({ key: 'graph-rest-glow', blur: 3, blend: 'add', opacity: (surging ? .35 : .75) * pulse,
        effectBudget: { area: 150_000, minScale: .7 } });
    ctx.strokePath(inside.start, inside.curves, { width: 13, color: '#3cff9a', cap: 'round' });
    ctx.endLayer();
    ctx.strokePath(inside.start, inside.curves, { width: 5, color: '#73e6a2', cap: 'round' });
    ctx.strokePath(inside.start, inside.curves, { width: 2, color: '#f4fff6', cap: 'round' });
    if (!surging) {
        // Chevrons along the start of the line: roll this way.
        if (ctx.p.x > 2150) for (let i = 0; i < 3; i++) {
            const k = (t * .8 + i / 3) % 1;
            const at = graphPointAt(k * GRAPH_CORNERS[3]);
            const alpha = Math.round(255 * Math.sin(k * Math.PI)).toString(16).padStart(2, '0');
            const x = at.x, y = at.y - 20;
            ctx.polygon([[x - 6, y - 9], [x + 8, y], [x - 6, y + 9]], `#ffe2a8${alpha}`);
        }
    }
}

function surgeLine(ctx: RenderCtx, shown: number) {
    // The surge: the whole line, bright up to just ahead of the chair.
    const whole = lineCurves(0, INSIDE + 1);
    const trim: [number, number] = [0, Math.min(1, shown / GRAPH_CORNERS[INSIDE + 1])];
    ctx.beginLayer({ key: 'graph-glow', blur: 5, blend: 'add', opacity: .9,
        effectBudget: { area: 170_000, minScale: .7 } });
    ctx.strokePath(whole.start, whole.curves, { width: 22, color: '#2bff88', cap: 'round' }, { trim });
    ctx.endLayer();
    ctx.strokePath(whole.start, whole.curves, { width: 9, color: ctx.gradientFill(0, ROOF, 0, -1000, [[0, '#4dff9a'], [.5, '#c4ff5c'], [1, '#fff27a']]), cap: 'round' }, { trim });
    ctx.strokePath(whole.start, whole.curves, { width: 3, color: '#f4fff6', cap: 'round' }, { trim });
}

// A finite arrow ends just above the sign; camera movement never extends it.
function chartTip(ctx: RenderCtx, surging: boolean) {
    const tail = lineCurves(INSIDE, INSIDE + 1);
    const last = graphPointAt(GRAPH_CORNERS[INSIDE + 1]);
    ctx.beginLayer({ key: 'graph-tip-glow', blur: 4, blend: 'add', opacity: surging ? .75 : .4,
        effectBudget: { area: 90_000, minScale: .7 } });
    ctx.strokePath(tail.start, tail.curves, { width: 16, color: '#3cff9a', cap: 'round' });
    ctx.endLayer();
    ctx.strokePath(tail.start, tail.curves, { width: 2.5, color: '#bdf5d4', cap: 'round' });
    tipArrow(ctx, last, '#c9ff6a');
}

// The arrow head at the end of a chart line, pointing along it.
function tipArrow(ctx: RenderCtx, at: { x: number; y: number; tx: number; ty: number }, color: string, size = 1) {
    const nx = -at.ty * size, ny = at.tx * size, fx = at.tx * size, fy = at.ty * size;
    const tip: Vector = [at.x + fx * 16, at.y + fy * 16];
    ctx.polygon([tip, [at.x + nx * 11 - fx * 6, at.y + ny * 11 - fy * 6], [at.x - nx * 11 - fx * 6, at.y - ny * 11 - fy * 6]], color);
}
