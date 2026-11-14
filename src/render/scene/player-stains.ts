import type { RenderCtx } from '../context';

// Dirty mop water splashed onto the rider and chair. Each mark is an opaque mud splat cut to the shape of what it
// landed on (shirt, trousers, face, backrest) and drawn in that part's own paint order, so the arms, tie, collar and
// glasses still sit in front of it: it reads as dirt on the man, not on the screen. Every splash adds a new set,
// up to three: the first hits his chest and lap, the second his face, hem and shin, the third soaks his hair and
// leaves the chair dripping.
// Coordinates are the side-view player's local space (y down).

/** Splashes stop adding marks past this. */
export const MAX_STAIN_LAYERS = 3;

type Pt = [number, number];

// Convex pieces of the outlines, so a splat can be cut to them.
const SHIRT: Pt[] = [[-17, -63], [-6, -64], [5, -60], [9, -25], [-17, -23]];
const THIGH: Pt[] = [[-13, -26], [22, -25], [29, -21], [21, -12], [-13, -16]];
const SHIN: Pt[] = [[22, -24], [29, -21], [34, 11], [26, 13], [21, -12]];
const FACE: Pt[] = [[-4, -82], [13, -84], [14, -79], [17, -75], [13, -74], [11, -66], [2, -66]];
const HAIR: Pt[] = [[-15, -87], [-5, -100], [10, -97], [16, -88], [3, -87], [-10, -77]];
const BACK: Pt[] = [[-40, -69], [-24, -68], [-23, -20], [-37, -20]];
const SEAT: Pt[] = [[-30, -15], [32, -15], [32, -3], [-30, -3]];

const MUD = { rim: '#6d6143', body: '#8c7f57', light: '#a99c70', dark: '#4f4a35' };

const hash = (n: number) => {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
};

/** `poly` cut to the convex `clip` (Sutherland-Hodgman). */
function clipTo(poly: Pt[], clip: Pt[]): Pt[] {
    let out = poly;
    for (let i = 0; i < clip.length && out.length; i++) {
        const a = clip[i], b = clip[(i + 1) % clip.length];
        const side = (p: Pt) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
        const sign = Math.sign(side(clip[(i + 2) % clip.length])) || 1;
        const input = out;
        out = [];
        for (let j = 0; j < input.length; j++) {
            const p = input[j], q = input[(j + 1) % input.length];
            const sp = side(p) * sign, sq = side(q) * sign;
            if (sp >= 0) out.push(p);
            if ((sp >= 0) !== (sq >= 0)) {
                const k = sp / (sp - sq);
                out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]);
            }
        }
    }
    return out;
}

/** A splat: a soft, rounded blob whose edge bulges gently in a few lobes, as a wet glob of mud lands. */
function splatShape(x: number, y: number, r: number, seed: number, squash = 1): Pt[] {
    const points: Pt[] = [];
    const n = 28;
    const p1 = hash(seed * 7) * 6.3, p2 = hash(seed * 11) * 6.3;
    const lobes = 3 + Math.floor(hash(seed * 13) * 3);
    for (let j = 0; j < n; j++) {
        const a = j / n * Math.PI * 2;
        // Smooth waves only, no corners: a few broad lobes and a softer ripple on top.
        const bulge = 1 + .2 * Math.sin(a * lobes + p1) + .08 * Math.sin(a * (lobes + 2) + p2);
        points.push([x + Math.cos(a) * r * bulge, y + Math.sin(a) * r * bulge * squash]);
    }
    return points;
}

function fill(ctx: RenderCtx, poly: Pt[], color: string) {
    if (poly.length >= 3) ctx.polygon(poly, color);
}

/** A mud splat at (x, y), cut to `on`, with a darker rim, a lighter middle and a drip running down the cloth. */
function splat(ctx: RenderCtx, on: Pt[], x: number, y: number, r: number, seed: number, drip = true) {
    fill(ctx, clipTo(splatShape(x, y, r, seed), on), MUD.rim);
    fill(ctx, clipTo(splatShape(x - r * .1, y - r * .1, r * .62, seed + 3), on), MUD.body);
    fill(ctx, clipTo(splatShape(x - r * .25, y - r * .25, r * .22, seed + 5), on), MUD.light);
    if (drip) {
        const len = r * (1.4 + hash(seed * 3) * .8), w = r * .22;
        fill(ctx, clipTo([[x - w, y + r * .4], [x + w, y + r * .4], [x + w * .7, y + r * .4 + len], [x - w * .7, y + r * .4 + len]], on), MUD.rim);
        fill(ctx, clipTo(splatShape(x, y + r * .4 + len, w * 1.1, seed + 9), on), MUD.rim);
    }
    // Specks flung off the edge, still on the same cloth.
    for (let f = 0; f < 3; f++) {
        const a = hash(seed * 17 + f) * Math.PI * 2, d = r * (1.7 + hash(seed * 19 + f) * .7);
        fill(ctx, clipTo(splatShape(x + Math.cos(a) * d, y + Math.sin(a) * d, .8 + hash(seed + f) * .5, seed + f), on), MUD.rim);
    }
}

/** Splats on the shirt and trousers. Drawn with the body, before the collar, tie and arms. */
export function riderStains(ctx: RenderCtx, soaks: number) {
    const level = Math.min(soaks, MAX_STAIN_LAYERS);
    if (level >= 1) {
        splat(ctx, SHIRT, -6, -46, 5.2, 1);
        splat(ctx, THIGH, 6, -21, 4.2, 2, false);
    }
    if (level >= 2) {
        splat(ctx, SHIRT, -12, -30, 4, 4);
        splat(ctx, SHIN, 28, -6, 3.4, 5);
    }
    if (level >= 3) {
        splat(ctx, SHIRT, -11, -57, 4.4, 7);
        splat(ctx, THIGH, 17, -20, 4.6, 8, false);
        splat(ctx, SHIN, 30, 5, 2.8, 9, false);
    }
}

/** Mud on the face and, at the third splash, a soaked clump of hair. Drawn on the head, before the glasses. */
export function riderFaceStains(ctx: RenderCtx, soaks: number) {
    const level = Math.min(soaks, MAX_STAIN_LAYERS);
    if (level >= 2) {
        splat(ctx, FACE, 6, -73, 2.6, 11);
        fill(ctx, clipTo(splatShape(12, -79, 1.1, 12), FACE), MUD.rim);
    }
    if (level >= 3) {
        splat(ctx, HAIR, 2, -93, 3.4, 13, false);
        // A wet lock stuck down over the forehead, dripping.
        ctx.polygon([[-2, -88], [5, -89], [6, -84], [3, -80], [1, -84]], '#2d323c');
        const fall = (ctx.t * 1.3) % 1;
        ctx.ellipse(3, -79 + fall * 9, .9, 1.3, MUD.body);
    }
}

/** The chair: a splat on the backrest from the second splash, a soaked seat dripping onto the floor from the third. */
export function chairStains(ctx: RenderCtx, soaks: number) {
    const level = Math.min(soaks, MAX_STAIN_LAYERS);
    if (level >= 2) splat(ctx, BACK, -31, -48, 4.4, 21);
    if (level >= 3) {
        splat(ctx, SEAT, -22, -8, 4, 22, false);
        for (let i = 0; i < 3; i++) {
            const fall = (ctx.t * 1.1 + i * .37) % 1;
            ctx.ellipse(-24 + i * 21, -2 + fall * 22, 1, 1.5, MUD.body + Math.round(255 * (1 - fall * .8)).toString(16).padStart(2, '0'));
        }
    }
}

/** Fresh spray flying off the rider just after a new splash (`life`: the focus notice's remaining seconds). */
export function riderSplash(ctx: RenderCtx, life: number) {
    const k = Math.max(0, Math.min(1, (1.7 - life) / .6));
    if (k <= 0 || k >= 1) return;
    for (let i = 0; i < 9; i++) {
        const a = -Math.PI * (.15 + .7 * hash(i * 7.7)), d = 10 + 34 * k * (.6 + .4 * hash(i * 3.3));
        const x = -4 + Math.cos(a) * d, y = -30 + Math.sin(a) * d + 30 * k * k;
        ctx.ellipse(x, y, 1.6 * (1 - k * .5), 2.2 * (1 - k * .5), '#7f8f6a' + Math.round(200 * (1 - k)).toString(16).padStart(2, '0'));
    }
}
