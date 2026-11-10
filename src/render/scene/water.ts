import type { RenderCtx } from '../context';
import type { Curve, DrawCommand, LayerSpec, Vector } from '../types';
import { WATER_GRAVITY, bucketMouth, pourLaunch } from '../bucket';

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

type SheetPoint = { p: Vector; dir: Vector; w: number; te: number };
type Sheet = { points: SheetPoint[]; attached: boolean; landed: boolean };

/** Cheap deterministic noise in [-1, 1] for edge detail. */
const wave = (v: number) => Math.sin(v) * .6 + Math.sin(v * 2.37 + 1.1) * .4;

/**
 * The falling water as sheets. Every point is the water that left the bucket
 * `s` seconds ago, flown along its own ballistic arc, so the shape is always a
 * physically consistent curtain. Glugs only change the thickness, which then
 * travels down the curtain with the water.
 */
function sheets(ctx: RenderCtx, age: number): Sheet[] {
    const { x, splashDir: side } = ctx.cleaning;
    const floor = ctx.F + 3;
    const result: Sheet[] = [];
    let current: SheetPoint[] = [];
    let attached = false;
    const flush = (landed: boolean) => {
        if (current.length > 1) result.push({ points: current, attached, landed });
        current = [];
    };
    const span = age - .17;
    for (let i = 0; i <= 40; i++) {
        const s = Math.min(span, i * .012);
        const te = age - s;
        const launch = pourLaunch(x, ctx.F, side, te);
        if (launch.flow < .1) {
            flush(false);
            if (s >= span) break;
            continue;
        }
        const vx = launch.vx;
        const vy = launch.vy + WATER_GRAVITY * s;
        let p: Vector = [launch.x + launch.vx * s, launch.y + launch.vy * s + .5 * WATER_GRAVITY * s * s];
        const speed = Math.hypot(vx, vy) || 1;
        const landedHere = p[1] >= floor;
        if (landedHere) {
            const prev = current[current.length - 1];
            if (!prev) break;
            // Cut exactly at the floor.
            const k = (floor - prev.p[1]) / (p[1] - prev.p[1]);
            p = [prev.p[0] + (p[0] - prev.p[0]) * k, floor];
        }
        if (!current.length) attached = i === 0;
        // Thick where much water left at once; thinner as gravity stretches it.
        const neck = ctx.clamp(Math.sqrt(Math.hypot(launch.vx, launch.vy) / speed), .5, 1);
        const ripple = 1 + .12 * wave(te * 61) + .05 * wave(te * 157);
        current.push({ p, dir: [vx / speed, vy / speed], w: (1.8 + 8 * launch.flow) * neck * ripple, te });
        if (landedHere) {
            flush(true);
            return result;
        }
        if (s >= span) break;
    }
    flush(false);
    return result;
}

/** Outline of a sheet: tapered where it has let go of the rim, torn into fingers at a free-falling front. */
function sheetOutline(sheet: Sheet, age: number): { outline: Path; front: SheetPoint } {
    const pts = sheet.points;
    const n = pts.length;
    const left: Vector[] = [];
    const right: Vector[] = [];
    pts.forEach((q, i) => {
        let w = q.w;
        if (!sheet.attached) w *= smooth(Math.min(1, (i + .3) / 3));
        if (!sheet.landed) w *= .55 + .45 * smooth(Math.min(1, (n - 1 - i) / 3));
        if (sheet.landed && i === n - 1) w *= 1.35;
        const nx = -q.dir[1];
        const ny = q.dir[0];
        left.push([q.p[0] + nx * w, q.p[1] + ny * w]);
        right.push([q.p[0] - nx * w, q.p[1] - ny * w]);
    });
    const front = pts[n - 1];
    const bottom: Vector[] = [];
    if (!sheet.landed) {
        // The leading edge tears into uneven fingers that shed drops.
        const nx = -front.dir[1];
        const ny = front.dir[0];
        const fw = front.w * .55;
        const fingers = 3;
        for (let j = 0; j < fingers; j++) {
            const across = 1 - (j + .5) / fingers * 2;
            const len = (4 + 7 * (.5 + .5 * wave(j * 3.1 + front.te * 9))) * (1 + .25 * wave(age * 23 + j));
            bottom.push([front.p[0] + nx * fw * across + front.dir[0] * len, front.p[1] + ny * fw * across + front.dir[1] * len]);
            if (j < fingers - 1) {
                const gap = across - 1 / fingers;
                bottom.push([front.p[0] + nx * fw * gap - front.dir[0] * 2, front.p[1] + ny * fw * gap - front.dir[1] * 2]);
            }
        }
    }
    return { outline: spline([...left, ...bottom, ...right.reverse()], true), front };
}

/**
 * Water in the air, as ThorVG scenes:
 * - the falling sheet, softened with a motion blur along the flow (no stripes to read as scales)
 *   and faded out at its torn front with an alpha mask;
 * - steady edge highlights in a Screen scene;
 * - spray and crowns in a softly blurred scene; loose drops in a motion-blurred scene.
 */
export function drawPour(ctx: RenderCtx) {
    const cleaning = ctx.cleaning;
    const age = ctx.state.bucketAge;
    const side = cleaning.splashDir;
    const mouth = bucketMouth(cleaning.x, ctx.F, side, age);
    const [lx, ly] = mouth.lip;
    const ax = mouth.rim[0] - lx;
    const ay = mouth.rim[1] - ly;
    const curtains = cleaning.spilled && age > .17 ? sheets(ctx, age) : [];
    const spray = ctx.waterDrops.filter(z => z.kind === 'spray');
    const crowns = ctx.waterRipples.filter(r => r.crown);
    const swell = cleaning.spilled ? smooth(ctx.clamp((age - .06) / .12, 0, 1)) * (1 - smooth(ctx.clamp((age - .2) / .12, 0, 1))) : 0;

    if (curtains.length || swell > 0) {
        let dx = 0;
        let dy = 0;
        for (const c of curtains) for (const q of c.points) {
            dx += q.dir[0];
            dy += q.dir[1];
        }
        if (!curtains.length) [dx, dy] = mouth.out;
        const shapes = curtains.map(c => ({ sheet: c, ...sheetOutline(c, age) }));
        // Fade the lowest free-falling front so it dissolves into the drops around it.
        const falling = shapes.filter(s => !s.sheet.landed).sort((a, b) => b.front.p[1] - a.front.p[1])[0];
        let mask: DrawCommand | undefined;
        if (falling) {
            const { p, dir } = falling.front;
            const big = 1e4;
            mask = ctx.pathCommand([-big, -big], [
                [-big, -big, big, -big, big, -big], [big, -big, big, big, big, big],
                [big, big, -big, big, -big, big], [-big, big, -big, -big, -big, -big],
            ]);
            mask.c = ctx.gradientFill(p[0] - dir[0] * 14, p[1] - dir[1] * 14, p[0] + dir[0] * 12, p[1] + dir[1] * 12, [[0, '#ffffff'], [1, '#ffffff00']]);
        }
        ctx.beginLayer({
            key: 'water-sheet',
            blur: .5 * ctx.scale,
            motionBlur: { distance: 4 * ctx.scale, angle: Math.atan2(dy, dx) * 180 / Math.PI },
            mask,
        });
        if (swell > 0) {
            // The surface bulges over the rim just before it lets go.
            const [ox, oy] = mouth.out;
            const reach = 7 * swell;
            const end: Vector = [lx + ax * .4, ly + ay * .4];
            ctx.effectPath(mouth.lip, [[lx + ox * reach, ly + oy * reach, end[0] + ox * reach, end[1] + oy * reach, end[0], end[1]],
                [end[0], end[1], lx, ly, lx, ly]], ctx.gradientFill(lx, ly, lx + ox * reach, ly + oy * reach, [[0, WATER.body[1]], [1, WATER.body[0]]]));
        }
        for (const { sheet, outline, front } of shapes) {
            const top = sheet.points[0].p;
            // Thin and see-through at the rim, denser where it gathers lower down.
            ctx.effectPath(outline.start, outline.curves, ctx.gradientFill(...top, ...front.p,
                [[0, ctx.tint(WATER.body[0], .72)], [.35, ctx.tint(WATER.body[1], .92)], [1, ctx.tint(WATER.body[2], .88)]]));
            // Light passing through the middle of the sheet.
            if (sheet.points.length > 2) {
                const inner = sheet.points.map(q => [q.p[0] + q.dir[1] * q.w * .3 * side, q.p[1] - q.dir[0] * q.w * .3 * side] as Vector);
                const line = spline(inner, false);
                const w = sheet.points.reduce((sum, q) => sum + q.w, 0) / sheet.points.length;
                ctx.strokePath(line.start, line.curves, { width: w * .7, color: ctx.tint(WATER.core, .28), cap: 'round' }, { trim: [.05, .85] });
            }
            if (sheet.landed) {
                // Foam where the sheet hammers the floor.
                const w = front.w;
                ctx.ellipse(front.p[0], ctx.F + 3, 5 + w * 1.8, 1.6 + w * .35, ctx.tint('#dfe3cd', .7));
            }
        }
        ctx.endLayer();

        if (shapes.length) {
            ctx.beginLayer({ key: 'water-glint', blend: 'screen', opacity: .8 + .2 * wave(age * 31), mask });
            for (const { sheet } of shapes) {
                if (sheet.points.length < 3) continue;
                // A steady highlight along the upper edge; the sheet's motion blur does the flowing.
                const edge = sheet.points.map(q => [q.p[0] + q.dir[1] * q.w * .72 * side, q.p[1] - q.dir[0] * q.w * .72 * side] as Vector);
                const line = spline(edge, false);
                ctx.strokePath(line.start, line.curves, { width: 1.1, color: ctx.tint(WATER.glint, .6), cap: 'round' },
                    { trim: [sheet.attached ? .02 : .15, sheet.landed ? .9 : .75] });
                const under = sheet.points.map(q => [q.p[0] - q.dir[1] * q.w * .6 * side, q.p[1] + q.dir[0] * q.w * .6 * side] as Vector);
                const low = spline(under, false);
                ctx.strokePath(low.start, low.curves, { width: .7, color: ctx.tint(WATER.glint, .22), cap: 'round' }, { trim: [.3, .8] });
            }
            ctx.endLayer();
        }
    }

    if (spray.length || crowns.length) {
        ctx.beginLayer({ key: 'water-body', blur: .75 * ctx.scale });
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
