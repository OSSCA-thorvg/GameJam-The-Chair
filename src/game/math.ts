// Deterministic transcendental functions for the game core.
//
// ECMAScript leaves Math.sin, Math.cos, Math.tan, Math.exp, Math.atan2 and Math.hypot
// "implementation-approximated": V8 (Chrome, Node), SpiderMonkey (Firefox) and JavaScriptCore (Safari)
// may return different last bits for the same input. The physics is chaotic enough that one bit
// changes a whole run, so a replay recorded in one browser drifted when played in another.
//
// These versions use only operations IEEE 754 defines exactly (+, -, *, /, Math.sqrt, Math.round,
// Math.abs) in a fixed order, so every engine computes the same bits. Accuracy is within about one
// unit in the last place. The algorithms and coefficients follow fdlibm (Sun Microsystems, freely
// distributable).

const PIO4 = 7.85398163397448278999e-01;
const PI = 3.14159265358979311600e+00;
const PI_LO = 1.22464679914735317720e-16;
const PIO2_HI = 1.57079632679489655800e+00;

// --- argument reduction: x = n·π/2 + (y0 + y1) with |y0 + y1| ≤ π/4 ---------------------------------

const INV_PIO2 = 6.36619772367581382433e-01;
// π/2 split into parts whose products with n (|n| < 2^20) are exact.
const PIO2_1 = 1.57079632673412561417e+00;
const PIO2_2 = 6.07710050630396597660e-11;
const PIO2_2T = 2.02226624879595063154e-21;
const PIO2_3 = 2.02226624871116645580e-21;
const PIO2_3T = 8.47842766036889956997e-32;

const reduced = { n: 0, y0: 0, y1: 0 };

function reduce(x: number) {
    const n = Math.round(x * INV_PIO2);
    // Three-step Cody–Waite reduction (fdlibm __ieee754_rem_pio2, medium range, always all steps).
    // n·PIO2_1 is exact; PIO2_2(+2T) and PIO2_3(+3T) refine the PIO2_1T tail in two more steps.
    let r = x - n * PIO2_1;
    let t = r;
    let w = n * PIO2_2;
    r = t - w;
    w = n * PIO2_2T - ((t - r) - w);
    t = r;
    w = n * PIO2_3;
    r = t - w;
    w = n * PIO2_3T - ((t - r) - w);
    const y0 = r - w;
    reduced.n = n;
    reduced.y0 = y0;
    reduced.y1 = (r - y0) - w;
}

// --- kernels on [-π/4, π/4] (fdlibm __kernel_sin / __kernel_cos) --------------------------------------

const S1 = -1.66666666666666324348e-01;
const S2 = 8.33333333332248946124e-03;
const S3 = -1.98412698298579493134e-04;
const S4 = 2.75573137070700676789e-06;
const S5 = -2.50507602534068634195e-08;
const S6 = 1.58969099521155010221e-10;

function kernelSin(x: number, y: number) {
    const z = x * x;
    const v = z * x;
    const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
    return x - ((z * (.5 * y - v * r) - y) - v * S1);
}

const C1 = 4.16666666666666019037e-02;
const C2 = -1.38888888888741095749e-03;
const C3 = 2.48015872894767294178e-05;
const C4 = -2.75573143513906633035e-07;
const C5 = 2.08757232129817482790e-09;
const C6 = -1.13596475577881948265e-11;

function kernelCos(x: number, y: number) {
    const z = x * x;
    const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
    const hz = .5 * z;
    const w = 1 - hz;
    return w + (((1 - w) - hz) + (z * r - x * y));
}

export function sin(x: number): number {
    if (!Number.isFinite(x)) return NaN;
    if (Math.abs(x) <= PIO4) return kernelSin(x, 0);
    reduce(x);
    const { n, y0, y1 } = reduced;
    switch (n & 3) {
        case 0: return kernelSin(y0, y1);
        case 1: return kernelCos(y0, y1);
        case 2: return -kernelSin(y0, y1);
        default: return -kernelCos(y0, y1);
    }
}

export function cos(x: number): number {
    if (!Number.isFinite(x)) return NaN;
    if (Math.abs(x) <= PIO4) return kernelCos(x, 0);
    reduce(x);
    const { n, y0, y1 } = reduced;
    switch (n & 3) {
        case 0: return kernelCos(y0, y1);
        case 1: return -kernelSin(y0, y1);
        case 2: return -kernelCos(y0, y1);
        default: return kernelSin(y0, y1);
    }
}

export function tan(x: number): number {
    return sin(x) / cos(x);
}

// --- exp (fdlibm __ieee754_exp) -----------------------------------------------------------------------

const LN2_HI = 6.93147180369123816490e-01;
const LN2_LO = 1.90821492927058770002e-10;
const INV_LN2 = 1.44269504088896338700e+00;
const P1 = 1.66666666666666019037e-01;
const P2 = -2.77777777770155933842e-03;
const P3 = 6.61375632143793436117e-05;
const P4 = -1.65339022054652515390e-06;
const P5 = 4.13813679705723846039e-08;
const EXP_MAX = 7.09782712893383973096e+02;
const EXP_MIN = -7.45133219101941108420e+02;

/** 2^k for an integer k in [-1074, 1023], built from exact doublings. */
function pow2(k: number) {
    let result = 1;
    let base = k < 0 ? .5 : 2;
    let e = Math.abs(k);
    while (e > 0) {
        if (e & 1) result *= base;
        base *= base;
        e >>= 1;
    }
    return result;
}

export function exp(x: number): number {
    if (Number.isNaN(x)) return NaN;
    if (x > EXP_MAX) return Infinity;
    if (x < EXP_MIN) return 0;
    if (x === 0) return 1;
    const k = Math.round(x * INV_LN2);
    const hi = x - k * LN2_HI;
    const lo = k * LN2_LO;
    const r = hi - lo;
    const t = r * r;
    const c = r - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
    const y = 1 - ((lo - (r * c) / (2 - c)) - hi);
    if (k === 0) return y;
    // Split the scaling so neither factor overflows or loses bits before the final rounding.
    if (k > 1000) return y * pow2(k - 1000) * pow2(1000);
    if (k < -1000) return y * pow2(k + 1000) * pow2(-1000);
    return y * pow2(k);
}

// --- atan / atan2 (fdlibm s_atan / e_atan2) -----------------------------------------------------------

const ATAN_HI = [4.63647609000806093515e-01, 7.85398163397448278999e-01, 9.82793723247329054082e-01, 1.57079632679489655800e+00];
const ATAN_LO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const AT = [
    3.33333333333329318027e-01, -1.99999999998764832476e-01, 1.42857142725034663711e-01, -1.11111104054623557880e-01,
    9.09088713343650656196e-02, -7.69187620504482999495e-02, 6.66107313738753120669e-02, -5.83357013379057348645e-02,
    4.97687799461593236017e-02, -3.65315727442169155270e-02, 1.62858201153657823623e-02,
];

export function atan(x: number): number {
    if (Number.isNaN(x)) return NaN;
    const ax = Math.abs(x);
    if (ax >= 7.378697629483821e19) return x > 0 ? ATAN_HI[3] + ATAN_LO[3] : -ATAN_HI[3] - ATAN_LO[3];
    let id: number;
    let v: number;
    if (ax < .4375) {
        if (ax < 7.450580596923828e-9) return x;
        id = -1;
        v = x;
    } else if (ax < 1.1875) {
        if (ax < .6875) { id = 0; v = (2 * ax - 1) / (2 + ax); }
        else { id = 1; v = (ax - 1) / (ax + 1); }
    } else if (ax < 2.4375) {
        id = 2; v = (ax - 1.5) / (1 + 1.5 * ax);
    } else {
        id = 3; v = -1 / ax;
    }
    const z = v * v;
    const w = z * z;
    const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
    const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
    if (id < 0) return v - v * (s1 + s2);
    const result = ATAN_HI[id] - ((v * (s1 + s2) - ATAN_LO[id]) - v);
    return x < 0 ? -result : result;
}

export function atan2(y: number, x: number): number {
    if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
    const negativeX = x < 0 || Object.is(x, -0);
    if (y === 0) return negativeX ? (Object.is(y, -0) ? -PI : PI) : y;
    if (x === 0) return y > 0 ? PIO2_HI : -PIO2_HI;
    if (!Number.isFinite(x)) {
        if (!Number.isFinite(y)) {
            const corner = x > 0 ? PIO4 : 3 * PIO4;
            return y > 0 ? corner : -corner;
        }
        return x > 0 ? (y > 0 ? 0 : -0) : (y > 0 ? PI : -PI);
    }
    if (!Number.isFinite(y)) return y > 0 ? PIO2_HI : -PIO2_HI;
    const z = atan(Math.abs(y / x));
    if (x > 0) return y < 0 ? -z : z;
    const result = PI - (z - PI_LO);
    return y < 0 ? -result : result;
}

/** √(x² + y²) without overflow, using only exactly rounded operations. */
export function hypot(x: number, y: number): number {
    let a = Math.abs(x);
    let b = Math.abs(y);
    if (a === Infinity || b === Infinity) return Infinity;
    if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
    if (a < b) {
        const swap = a;
        a = b;
        b = swap;
    }
    if (a === 0) return 0;
    const r = b / a;
    return a * Math.sqrt(1 + r * r);
}
