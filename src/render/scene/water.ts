import type { RenderCtx } from '../context';
import type { Curve, DrawCommand, LayerSpec, Vector } from '../types';
import type { WaterDrop } from '../effects';
import type { DeepReadonly } from '../../game/types';
import { bucketMouth, pourFlow } from '../bucket';

type Path = { start: Vector; curves: Curve[] };

// Dirty mop water: greenish grey body, pale highlights.
const WATER = {
    body: ['#93a37f', '#788a68', '#62735a'] as const,
    core: '#c4cfa8',
    glint: '#f6f8e8',
    spray: '#a9b694',
    wet: ['#a3ad9f', '#b3bcae', '#c6ccc2'] as const,
    rim: '#8a9784',
    sheen: '#e3ece9',
};

const smooth = (u: number) => u * u * (3 - 2 * u);

/** Catmull-Rom through the points as cubic Bézier segments. */
function spline(points: Vector[], closed: boolean): Path {
    const n = points.length;
    const at = (i: number) => closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))];
    const curves: Curve[] = [];
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
        const p0 = at(i - 1);
        const p1 = at(i);
        const p2 = at(i + 1);
        const p3 = at(i + 2);
        curves.push([
            p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
            p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
            p2[0], p2[1],
        ]);
    }
    return { start: points[0], curves };
}

function ellipsePath(x: number, y: number, rx: number, ry: number): Path {
    const k = .5523;
    return {
        start: [x + rx, y],
        curves: [
            [x + rx, y + ry * k, x + rx * k, y + ry, x, y + ry],
            [x - rx * k, y + ry, x - rx, y + ry * k, x - rx, y],
            [x - rx, y - ry * k, x - rx * k, y - ry, x, y - ry],
            [x + rx * k, y - ry, x + rx, y - ry * k, x + rx, y],
        ],
    };
}

export type PuddleShape = { cx: number; cy: number; rx: number; ry: number; outline: Path; clip: DrawCommand };

/**
 * The wet patch grows from where water actually landed and then spreads over
 * the slippery gameplay zone, so what the player sees matches where they slip.
 */
export function puddleShape(ctx: RenderCtx): PuddleShape | null {
    const cleaning = ctx.cleaning;
    if (!cleaning.spilled) return null;
    const landed = ctx.waterPuddle;
    // Spreads out from under the bucket until it covers the slippery zone.
    const zone = smooth(ctx.clamp((cleaning.age - .45) / 1.3, 0, 1));
    const zoneLeft = cleaning.x + zone * (cleaning.a - cleaning.x);
    const zoneRight = cleaning.x + zone * (cleaning.b - cleaning.x);
    let left = Infinity;
    let right = -Infinity;
    if (landed) {
        left = landed.left;
        right = landed.right;
    }
    if (zone > 0) {
        left = Math.min(left, zoneLeft);
        right = Math.max(right, zoneRight);
    }
    if (!(right - left > 4)) return null;
    const wet = Math.max(landed?.wet ?? 0, zone);
    const cx = (left + right) / 2;
    const cy = ctx.F + 3;
    const rx = (right - left) / 2;
    const ry = Math.min(4 + 11 * wet, rx * .5);
    const t = ctx.t;
    const points: Vector[] = [];
    for (let i = 0; i < 20; i++) {
        const a = i / 20 * ctx.TAU;
        const wobble = 1 + .09 * Math.sin(3 * a + 1.3) + .05 * Math.sin(5 * a + .7 + t * .5) + .03 * Math.sin(9 * a + t * 1.1);
        points.push([cx + Math.cos(a) * rx * (1 + .04 * Math.sin(2 * a + 2)), cy + Math.sin(a) * ry * wobble]);
    }
    const outline = spline(points, true);
    return { cx, cy, rx, ry, outline, clip: ctx.pathCommand(outline.start, outline.curves) };
}

/**
 * Floor puddle, built from three ThorVG scenes:
 * a Multiply scene that darkens the floor so it looks soaked rather than painted over,
 * a reflection scene clipped to the puddle with the actors mirrored into it,
 * and a Screen scene for sheen and stroked ripple rings.
 */
export function drawPuddle(ctx: RenderCtx, shape: PuddleShape, reflect: () => void) {
    const { cx, cy, rx, ry, outline, clip } = shape;
    ctx.beginLayer({ key: 'puddle-wet', blend: 'multiply' });
    ctx.effectPath(outline.start, outline.curves,
        ctx.gradientFill(cx, cy - ry, cx, cy + ry, [[0, WATER.wet[2]], [.45, WATER.wet[1]], [1, WATER.wet[0]]]));
    ctx.strokePath(outline.start, outline.curves, { width: 1.2, color: WATER.rim }, { closed: true });
    ctx.endLayer();

    ctx.beginLayer({ key: 'puddle-reflect', clip, opacity: .34, blur: .9 * ctx.scale });
    ctx.mirror = { y: cy - 1, k: .55 };
    reflect();
    ctx.mirror = null;
    ctx.endLayer();

    ctx.beginLayer({ key: 'puddle-shine', clip, blend: 'screen' });
    // Ceiling light smeared across the surface, drifting a little with the camera.
    const drift = Math.sin(ctx.t * .45) * rx * .08 + (ctx.cam % 400) * .03;
    const band = ellipsePath(cx + drift, cy - ry * .25, rx * .72, ry * .32);
    ctx.effectPath(band.start, band.curves,
        ctx.gradientFill(cx, cy - ry * .6, cx, cy + ry * .1, [[0, '#00000000'], [.5, ctx.tint(WATER.sheen, .38)], [1, '#00000000']]));
    // Window light reflected on the surface, sliding with the camera.
    for (const [dx, w] of [[-.4, .07], [-.26, .035], [.34, .05]] as const) {
        const x = cx + dx * rx - (ctx.cam - cx) * .04;
        ctx.polygon([[x, cy - ry * .9], [x + rx * w, cy - ry * .9], [x + rx * w - 5, cy + ry], [x - 5, cy + ry]], ctx.tint(WATER.sheen, .08));
    }
    for (const r of ctx.waterRipples) {
        const u = r.age / r.life;
        const spread = 3 + smooth(u) * (12 + r.r * 2.6);
        const ring = ellipsePath(r.x, r.y, spread, spread * .3);
        ctx.strokePath(ring.start, ring.curves, { width: .4 + .8 * (1 - u), color: ctx.tint(WATER.glint, (1 - u) * .45) }, { closed: true });
    }
    ctx.endLayer();
}

type Ribbon = { points: Vector[]; widths: number[] };

/** Split each stream chain into continuous ribbons, oldest (leading) particle first. */
function ribbons(ctx: RenderCtx, mouth: Vector | null, mouthWidth: number): Ribbon[] {
    const chains = new Map<number, DeepReadonly<WaterDrop>[]>();
    for (const z of ctx.waterDrops) {
        if (z.kind !== 'stream') continue;
        let chain = chains.get(z.chain);
        if (!chain) chains.set(z.chain, chain = []);
        chain.push(z);
    }
    const pour = ctx.waterPour;
    const result: Ribbon[] = [];
    for (const [id, chain] of chains) {
        let points: Vector[] = [];
        let widths: number[] = [];
        const flush = () => {
            if (points.length > 1) result.push({ points, widths });
            points = [];
            widths = [];
        };
        for (let i = 0; i < chain.length; i += 2) {
            const z = chain[i];
            const p: Vector = [z.x, z.y];
            const prev = points[points.length - 1];
            if (prev && Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 30) flush();
            const before = points[points.length - 2];
            // Skip water that has doubled back over the stream, so the ribbon never folds.
            if (prev && before && (p[0] - prev[0]) * (prev[0] - before[0]) + (p[1] - prev[1]) * (prev[1] - before[1]) < 0) continue;
            // A falling stream thins out as it speeds up.
            const speed = Math.hypot(z.vx, z.vy);
            points.push(p);
            widths.push(z.r * ctx.clamp(Math.sqrt(150 / Math.max(1, speed)), .45, 1.15));
        }
        const live = pour?.flowing && pour.chain === id && mouth;
        if (live) {
            const prev = points[points.length - 1];
            if (!prev || Math.hypot(mouth[0] - prev[0], mouth[1] - prev[1]) < 30) {
                points.push(mouth);
                widths.push(mouthWidth);
            }
        }
        flush();
    }
    return result;
}

function ribbonOutline(r: Ribbon, scale: number): Path {
    const left: Vector[] = [];
    const right: Vector[] = [];
    const n = r.points.length;
    for (let i = 0; i < n; i++) {
        const a = r.points[Math.max(0, i - 1)];
        const b = r.points[Math.min(n - 1, i + 1)];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const l = Math.hypot(dx, dy) || 1;
        // Round, heavier head; narrow neck right behind it.
        const head = i === 0 ? .9 : i === 1 ? .8 : 1;
        const w = r.widths[i] * scale * head;
        left.push([r.points[i][0] - dy / l * w, r.points[i][1] + dx / l * w]);
        right.push([r.points[i][0] + dy / l * w, r.points[i][1] - dx / l * w]);
    }
    const [hx, hy] = r.points[0];
    const [nx, ny] = r.points[1];
    const l = Math.hypot(hx - nx, hy - ny) || 1;
    const capW = r.widths[0] * scale;
    const cap: Vector = [hx + (hx - nx) / l * capW, hy + (hy - ny) / l * capW];
    return spline([cap, ...left, ...right.reverse()], true);
}

/**
 * Water in the air: the pour as filled ribbons in a softly blurred scene,
 * a Screen scene of dashed highlights that slide along the stream (stroke dash + trim),
 * and loose drops in a motion-blurred scene.
 */
export function drawPour(ctx: RenderCtx) {
    const cleaning = ctx.cleaning;
    const age = ctx.state.bucketAge;
    const side = cleaning.splashDir;
    const flow = cleaning.spilled ? pourFlow(age) : 0;
    const mouth = bucketMouth(cleaning.x, ctx.F, side, age);
    const [lx, ly] = mouth.lip;
    const ax = mouth.rim[0] - lx;
    const ay = mouth.rim[1] - ly;
    const opening = .1 + .32 * flow;
    const mouthCenter: Vector = [lx + ax * opening * .5, ly + ay * opening * .5];
    const mouthWidth = Math.hypot(ax, ay) * opening * .5 + 1;
    const streams = cleaning.spilled ? ribbons(ctx, mouthCenter, mouthWidth) : [];
    const spray = ctx.waterDrops.filter(z => z.kind === 'spray');
    const crowns = ctx.waterRipples.filter(r => r.crown);
    const swell = cleaning.spilled ? smooth(ctx.clamp((age - .06) / .12, 0, 1)) * (1 - smooth(ctx.clamp((age - .2) / .12, 0, 1))) : 0;
    const body: LayerSpec = { key: 'water-body', blur: .75 * ctx.scale };

    if (streams.length || spray.length || crowns.length || swell > 0) {
        ctx.beginLayer(body);
        if (swell > 0) {
            // The surface bulges over the rim just before it lets go.
            const [ox, oy] = mouth.out;
            const reach = 7 * swell;
            const end: Vector = [lx + ax * .4, ly + ay * .4];
            ctx.effectPath(mouth.lip, [[lx + ox * reach, ly + oy * reach, end[0] + ox * reach, end[1] + oy * reach, end[0], end[1]],
                [end[0], end[1], lx, ly, lx, ly]], ctx.gradientFill(lx, ly, lx + ox * reach, ly + oy * reach, [[0, WATER.body[1]], [1, WATER.body[0]]]));
        }
        for (const r of streams) {
            const outline = ribbonOutline(r, 1);
            const head = r.points[0];
            const tail = r.points[r.points.length - 1];
            ctx.effectPath(outline.start, outline.curves, ctx.gradientFill(...tail, ...head,
                [[0, ctx.tint(WATER.body[0], .95)], [.5, ctx.tint(WATER.body[1], .92)], [1, ctx.tint(WATER.body[2], .88)]]));
            // Lighter core gives the stream its round, glassy volume.
            const core = ribbonOutline({ points: r.points, widths: r.widths.map(w => w * .3) }, 1);
            ctx.effectPath(core.start, core.curves, ctx.gradientFill(...tail, ...head, [[0, ctx.tint(WATER.core, .45)], [1, ctx.tint(WATER.core, .12)]]));
            if (head[1] > ctx.F - 8) {
                // Foam where the stream hammers the floor.
                const w = r.widths[0];
                ctx.ellipse(head[0], ctx.F + 3, 5 + w * 1.7, 1.6 + w * .35, ctx.tint('#dfe3cd', .75));
            }
        }
        for (const c of crowns) {
            const u = c.age / c.life;
            const h = c.r * 2.8 * Math.sin(u * Math.PI);
            const s = 4 + u * 12;
            const { x, y } = c;
            const crown = spline([[x - 3, y], [x - s - 3, y - h * .75], [x - s, y - h], [x - 2, y - h * .3],
                [x + 2, y - h * .3], [x + s, y - h], [x + s + 3, y - h * .75], [x + 3, y]], true);
            ctx.effectPath(crown.start, crown.curves, ctx.gradientFill(x, y - h, x, y, [[0, ctx.tint(WATER.core, .85)], [1, ctx.tint(WATER.body[1], .7)]], 1 - u * .6));
            for (const d of [-1, 1]) ctx.ellipse(x + d * (s + 1), y - h - 2, 1.6, 1.8, ctx.tint(WATER.spray, 1 - u));
        }
        for (const z of spray) {
            ctx.ellipse(z.x, z.y, z.r, z.r * 1.15, ctx.tint(WATER.spray, ctx.clamp(z.life / .4, 0, 1) * .95));
        }
        ctx.endLayer();
    }

    if (streams.length) {
        ctx.beginLayer({ key: 'water-glint', blend: 'screen' });
        for (const r of streams) {
            if (r.points.length < 3) continue;
            const offset = r.points.map((p, i): Vector => {
                const a = r.points[Math.max(0, i - 1)];
                const b = r.points[Math.min(r.points.length - 1, i + 1)];
                const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
                const w = r.widths[i] * .5;
                return [p[0] + (b[1] - a[1]) / l * w * side, p[1] - (b[0] - a[0]) / l * w * side];
            });
            const line = spline(offset, false);
            const width = Math.min(1.8, r.widths.reduce((s, w) => s + w, 0) / r.widths.length * .3);
            ctx.strokePath(line.start, line.curves,
                { width, color: ctx.tint(WATER.glint, .55), cap: 'round', dash: [4, 11], dashOffset: age * 260 },
                { trim: [.08, .97] });
            ctx.strokePath(line.start, line.curves, { width: width * .6, color: ctx.tint(WATER.glint, .45), cap: 'round' }, { trim: [.6, 1] });
        }
        ctx.endLayer();
    }

    const drops = ctx.waterDrops.filter(z => z.kind === 'drop');
    if (drops.length) {
        let vx = 0;
        let vy = 0;
        for (const z of drops) {
            vx += z.vx;
            vy += z.vy;
        }
        vx /= drops.length;
        vy /= drops.length;
        const speed = Math.hypot(vx, vy);
        ctx.beginLayer({
            key: 'water-drops',
            motionBlur: { distance: ctx.clamp(speed * .03, 0, 12) * ctx.scale, angle: Math.atan2(vy, vx) * 180 / Math.PI },
        });
        for (const z of drops) {
            const fade = ctx.clamp(z.life / .35, 0, 1);
            const stretch = ctx.clamp(Math.hypot(z.vx, z.vy) / 180, 1, 1.9);
            ctx.ox = z.x;
            ctx.oy = z.y;
            ctx.rotation = Math.atan2(z.vy, z.vx) - Math.PI / 2;
            const w = z.r * .78;
            const h = z.r * stretch;
            ctx.effectPath([0, -h], [[w, -h * .3, w, h * .7, 0, h], [-w, h * .7, -w, -h * .3, 0, -h]],
                ctx.gradientFill(-w, 0, w, 0, [[0, ctx.tint(WATER.body[2], .9)], [.5, ctx.tint(WATER.body[0], .95)], [1, ctx.tint(WATER.body[1], .7)]], fade));
            ctx.ellipse(-w * .25, -h * .15, z.r * .22, z.r * .3, ctx.tint(WATER.glint, fade * .8));
            ctx.ox = ctx.oy = ctx.rotation = 0;
        }
        ctx.endLayer();
    }
}
