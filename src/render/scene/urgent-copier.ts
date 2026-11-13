import { translate } from '../../i18n';
import { LEVEL } from '../../game/level';
import { URGENT_VOLLEY_ID, urgentPattern } from '../../game/stages/office/copier/decide';
import type { DeepReadonly, Paper } from '../../game/types';
import type { RenderCtx } from '../context';
import type { Vector } from '../types';

// The executive multifunction printer in urgent-report mode. Before each volley its scanner light sweeps
// the glass (the warning) and the output tray of the coming pattern glows: the low tray for skimming
// sheets, the high tray for lobs, both for the mix, the stapler door for a bundle.
export function urgentCopierDraw(ctx: RenderCtx) {
    const c = ctx.urgentCopier;
    const F = ctx.F, t = ctx.t, x = c.x;
    if (x < ctx.cam - 200 || x > ctx.cam + ctx.VW + 200) return;
    const scanning = c.scan > 0;
    const firing = c.burst > 0 && !scanning;
    const awake = scanning || firing;
    const pattern = urgentPattern(Math.max(1, c.volley));
    const progress = scanning ? 1 - c.scan / LEVEL.urgentCopier.scan : 0;
    const shake = firing ? Math.sin(t * 60) * 1.6 : 0;
    const bx = x + shake;

    ctx.ellipse(x + 4, F - 4, 86, 6, '#515c6d60');
    // Body: a taller, darker machine with brass trim, standing on casters.
    for (const wx of [-58, 58]) ctx.ellipse(bx + wx, F - 7, 7, 7, '#2c333f');
    ctx.gradientPolygon([[bx - 74, F - 172], [bx + 74, F - 172], [bx + 74, F - 12], [bx - 74, F - 12]],
        ctx.gradientFill(bx - 74, 0, bx + 74, 0, [[0, '#4a5262'], [.5, '#5d6677'], [1, '#3b4250']]));
    ctx.rect(bx - 74, F - 172, 148, 5, '#c9a35a');
    ctx.rect(bx - 74, F - 16, 148, 4, '#c9a35a');
    ctx.rect(bx + 18, F - 160, 46, 22, '#1f2530');
    ctx.rect(bx + 22, F - 156, 38, 14, awake ? '#ff6a5c' : '#7fb79a');

    // Output trays on the side it faces; the coming pattern's tray glows during the scan.
    const side = c.dir < 0 ? -1 : 1;
    const trayX = bx + side * 74;
    const glow = scanning ? .45 + .55 * Math.abs(Math.sin(t * 18)) : 0;
    const lowTray = pattern === 'low' || pattern === 'fan';
    const highTray = pattern === 'lob' || pattern === 'fan';
    tray(ctx, trayX, F - 52, side, lowTray ? glow : 0);
    tray(ctx, trayX, F - 118, side, highTray ? glow : 0);
    ctx.rect(bx - 48, F - 98, 64, 52, '#3a414e');
    ctx.rect(bx - 44, F - 94, 56, 44, pattern === 'bundle' && scanning ? ctx.tint('#ffb347', .4 + glow * .6) : '#4b5463');
    for (const sx of [-30, -6]) ctx.rect(bx + sx, F - 76, 14, 4, '#9aa2ae');

    // Scanner lid lifts and a light bar sweeps the glass.
    const lid = scanning ? Math.min(1, progress * 4) * .35 : 0;
    ctx.rect(bx - 70, F - 186, 140, 14, '#d9d7cc');
    const hingeX = bx + 70;
    const lidEnd: Vector = [hingeX - Math.cos(lid) * 140, F - 186 - Math.sin(lid) * 140];
    ctx.polygon([[hingeX, F - 186], lidEnd, [lidEnd[0], lidEnd[1] - 10], [hingeX, F - 196]], '#ebe8dc');
    if (scanning) {
        const sweep = bx - 66 + progress * 132;
        ctx.beginLayer({ key: 'urgent-scan', blend: 'add', opacity: .9 });
        ctx.gradientPolygon([[sweep - 26, F - 186], [sweep + 26, F - 186], [sweep + 26, F - 173], [sweep - 26, F - 173]],
            ctx.gradientFill(sweep - 26, 0, sweep + 26, 0, [[0, '#9ff3ff00'], [.5, '#e9fdffff'], [1, '#9ff3ff00']]));
        ctx.gradientPolygon([[sweep - 6, F - 186], [sweep + 6, F - 186], [sweep + 40, F - 260], [sweep - 40, F - 260]],
            ctx.gradientFill(0, F - 186, 0, F - 260, [[0, '#bff6ff90'], [1, '#bff6ff00']]));
        ctx.endLayer();
    }

    // The red warning lamp turns while it is awake.
    const lampY = F - 206;
    ctx.rect(bx - 6, lampY + 6, 12, 10, '#2c333f');
    ctx.ellipse(bx, lampY, 11, 9, awake ? '#ff4b3e' : '#7a3b38');
    if (awake) {
        const angle = t * 9;
        const reach = 150;
        ctx.beginLayer({ key: 'urgent-lamp', blend: 'add', opacity: .55 });
        for (const turn of [0, Math.PI]) {
            const a = angle + turn;
            const tip: Vector = [bx + Math.cos(a) * reach, lampY + Math.sin(a) * reach * .35];
            const nx = -Math.sin(a) * 26, ny = Math.cos(a) * 26 * .35;
            ctx.gradientPolygon([[bx, lampY], [tip[0] + nx, tip[1] + ny], [tip[0] - nx, tip[1] - ny]],
                ctx.gradientFill(bx, lampY, tip[0], tip[1], [[0, '#ff6a5cb0'], [1, '#ff6a5c00']]));
        }
        ctx.endLayer();
        ctx.beginLayer({ key: 'urgent-lamp-halo', blend: 'add', opacity: .8 });
        ctx.gradientPolygon([[bx - 30, lampY - 30], [bx + 30, lampY - 30], [bx + 30, lampY + 30], [bx - 30, lampY + 30]],
            ctx.radialFill(bx, lampY, 30, [[0, '#ffd2c8ff'], [.35, '#ff5a4a80'], [1, '#ff5a4a00']]));
        ctx.endLayer();
    }

    // "URGENT!" burst while it scans, like the office copier's spit.
    if (scanning && ctx.mode === 'play') speechBurst(ctx, x, F - 262, translate('copier.urgent', ctx.locale), Math.min(1, progress * 6));
}

function tray(ctx: RenderCtx, x: number, y: number, side: number, glow: number) {
    ctx.polygon([[x, y], [x + side * 34, y - 8], [x + side * 34, y - 2], [x, y + 8]], '#2f3542');
    ctx.polygon([[x + side * 4, y - 2], [x + side * 30, y - 8], [x + side * 30, y - 5], [x + side * 4, y + 1]], '#e7e4d6');
    if (glow > 0) {
        ctx.beginLayer({ key: `urgent-tray-${y}`, blend: 'add', opacity: glow });
        ctx.gradientPolygon([[x - 6, y - 26], [x + side * 60, y - 26], [x + side * 60, y + 18], [x - 6, y + 18]],
            ctx.radialFill(x + side * 20, y - 4, 40, [[0, '#ffe08aff'], [1, '#ffe08a00']]));
        ctx.endLayer();
    }
}

function speechBurst(ctx: RenderCtx, x: number, y: number, line: string, pop: number) {
    ctx.lg.font = `${18 * ctx.scale}px system-ui,sans-serif`;
    const radiusX = Math.max(90, ctx.lg.measureText(line).width / ctx.scale / 2 + 40);
    const size = .6 + .4 * pop;
    const burst: Vector[] = Array.from({ length: 24 }, (_, i) => {
        const angle = i / 24 * ctx.TAU;
        const radius = i % 2 === 0 ? 1 : .74;
        return [x + Math.cos(angle) * radiusX * radius * size, y + Math.sin(angle) * 38 * radius * size];
    });
    ctx.polygon([[x - 14, y + 22], [x + 2, y + 52], [x + 14, y + 21]], ctx.C.ink);
    ctx.polygon(burst, ctx.C.ink);
    ctx.polygon(burst.map(([px, py]) => [x + (px - x) * .93, y + (py - y) * .86]), '#ffd6cf');
    ctx.label(line, x, y + 6, 18, '#a3221a');
}

// Urgent sheets in flight get a ThorVG motion blur along their path; bundles are thick and stapled.
export function urgentPapersDraw(ctx: RenderCtx, papers: readonly DeepReadonly<Paper>[]) {
    const flying = papers.filter(z => z.volley >= URGENT_VOLLEY_ID && !z.landed && z.kind === 'sheet');
    if (flying.length) {
        const dir = flying[0].vx < 0 ? 180 : 0;
        ctx.beginLayer({ key: 'urgent-sheets', motionBlur: { distance: 12, angle: dir } });
        for (const z of flying) sheet(ctx, z);
        ctx.endLayer();
    }
    for (const z of papers) {
        if (z.volley < URGENT_VOLLEY_ID) continue;
        if (z.kind === 'bundle') bundle(ctx, z);
        else if (z.landed) sheet(ctx, z);
    }
}

function sheet(ctx: RenderCtx, z: DeepReadonly<Paper>) {
    ctx.ox = z.x; ctx.oy = z.y; ctx.rotation = z.a;
    ctx.rect(-10, -6, 20, 12, '#fbf6e8');
    ctx.rect(-10, -6, 20, 3, '#e0503f');
    ctx.rod(-6, 1, 6, 1, 1, '#9a9e9d');
    ctx.ox = ctx.oy = ctx.rotation = 0;
}

function bundle(ctx: RenderCtx, z: DeepReadonly<Paper>) {
    ctx.ox = z.x; ctx.oy = z.y; ctx.rotation = z.a;
    for (let i = 3; i >= 0; i--) ctx.rect(-22 + i, -14 + i * 3, 44, 18, i === 0 ? '#fbf6e8' : '#ddd6c2');
    ctx.rect(-22, -14, 44, 5, '#e0503f');
    for (const sx of [-14, 10]) ctx.rect(sx, -12, 6, 2, '#8a93a0');
    ctx.ox = ctx.oy = ctx.rotation = 0;
}
