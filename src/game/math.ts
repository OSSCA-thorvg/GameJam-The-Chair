// Use exactly rounded operations to keep replays identical across engines;
// coefficients follow Sun Microsystems fdlibm.
const PIO4 = 7.85398163397448278999e-1;
const PI = 3.141592653589793;
const PI_LO = 1.2246467991473532e-16;
const PIO2_HI = 1.570796326794896558;
const INV_PIO2 = 6.36619772367581382433e-1;
// π/2 split into parts whose products with n (|n| < 2^20) are exact.
const PIO2_1 = 1.57079632673412561417;
const PIO2_2 = 6.0771005063039659766e-11;
const PIO2_2T = 2.02226624879595063154e-21;
const PIO2_3 = 2.0222662487111664558e-21;
const PIO2_3T = 8.47842766036889956997e-32;
const reduced = { n: 0, y0: 0, y1: 0 };
function reduce(x: number) {
    const n = Math.round(x * INV_PIO2);
    // Cody–Waite reduction: always apply all three fdlibm refinement steps.
    let r = x - n * PIO2_1;
    let t = r;
    let w = n * PIO2_2;
    r = t - w;
    w = n * PIO2_2T - (t - r - w);
    t = r;
    w = n * PIO2_3;
    r = t - w;
    w = n * PIO2_3T - (t - r - w);
    const y0 = r - w;
    reduced.n = n;
    reduced.y0 = y0;
    reduced.y1 = r - y0 - w;
}
const S1 = -1.66666666666666324348e-1;
const S2 = 8.33333333332248946124e-3;
const S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6;
const S5 = -2.50507602534068634195e-8;
const S6 = 1.58969099521155010221e-10;
function kernelSin(x: number, y: number) {
    const z = x * x;
    const v = z * x;
    const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
    return x - (z * (0.5 * y - v * r) - y - v * S1);
}
const C1 = 4.16666666666666019037e-2;
const C2 = -1.38888888888741095749e-3;
const C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7;
const C5 = 2.0875723212981748279e-9;
const C6 = -1.13596475577881948265e-11;
function kernelCos(x: number, y: number) {
    const z = x * x;
    const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
    const hz = 0.5 * z;
    const w = 1 - hz;
    return w + (1 - w - hz + (z * r - x * y));
}
export function sin(x: number): number {
    if (!Number.isFinite(x)) {
        return NaN;
    }
    if (Math.abs(x) <= PIO4) {
        return kernelSin(x, 0);
    }
    reduce(x);
    const { n, y0, y1 } = reduced;
    switch (n & 3) {
        case 0:
            return kernelSin(y0, y1);
        case 1:
            return kernelCos(y0, y1);
        case 2:
            return -kernelSin(y0, y1);
        default:
            return -kernelCos(y0, y1);
    }
}
export function cos(x: number): number {
    if (!Number.isFinite(x)) {
        return NaN;
    }
    if (Math.abs(x) <= PIO4) {
        return kernelCos(x, 0);
    }
    reduce(x);
    const { n, y0, y1 } = reduced;
    switch (n & 3) {
        case 0:
            return kernelCos(y0, y1);
        case 1:
            return -kernelSin(y0, y1);
        case 2:
            return -kernelCos(y0, y1);
        default:
            return kernelSin(y0, y1);
    }
}
export function tan(x: number): number {
    return sin(x) / cos(x);
}
const LN2_HI = 6.9314718036912381649e-1;
const LN2_LO = 1.90821492927058770002e-10;
const INV_LN2 = 1.442695040888963387;
const P1 = 1.66666666666666019037e-1;
const P2 = -2.77777777770155933842e-3;
const P3 = 6.61375632143793436117e-5;
const P4 = -1.6533902205465251539e-6;
const P5 = 4.13813679705723846039e-8;
const EXP_MAX = 7.09782712893383973096e2;
const EXP_MIN = -7.4513321910194110842e2;
function pow2(k: number) {
    let result = 1;
    let base = k < 0 ? 0.5 : 2;
    let e = Math.abs(k);
    while (e > 0) {
        if (e & 1) {
            result *= base;
        }
        base *= base;
        e >>= 1;
    }
    return result;
}
export function exp(x: number): number {
    if (Number.isNaN(x)) {
        return NaN;
    }
    if (x > EXP_MAX) {
        return Infinity;
    }
    if (x < EXP_MIN) {
        return 0;
    }
    if (x === 0) {
        return 1;
    }
    const k = Math.round(x * INV_LN2);
    const hi = x - k * LN2_HI;
    const lo = k * LN2_LO;
    const r = hi - lo;
    const t = r * r;
    const c = r - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
    const y = 1 - (lo - (r * c) / (2 - c) - hi);
    if (k === 0) {
        return y;
    }
    // Split the scaling so neither factor overflows or loses bits before the
    // final rounding.
    if (k > 1000) {
        return y * pow2(k - 1000) * pow2(1000);
    }
    if (k < -1000) {
        return y * pow2(k + 1000) * pow2(-1000);
    }
    return y * pow2(k);
}
const ATAN_HI = [
    4.63647609000806093515e-1, 7.85398163397448278999e-1,
    9.82793723247329054082e-1, 1.570796326794896558,
];
const ATAN_LO = [
    2.26987774529616870924e-17, 3.06161699786838301793e-17,
    1.39033110312309984516e-17, 6.12323399573676603587e-17,
];
const AT = [
    3.33333333333329318027e-1, -1.99999999998764832476e-1,
    1.42857142725034663711e-1, -1.1111110405462355788e-1,
    9.09088713343650656196e-2, -7.69187620504482999495e-2,
    6.66107313738753120669e-2, -5.83357013379057348645e-2,
    4.97687799461593236017e-2, -3.6531572744216915527e-2,
    1.62858201153657823623e-2,
];
export function atan(x: number): number {
    if (Number.isNaN(x)) {
        return NaN;
    }
    const ax = Math.abs(x);
    if (ax >= 7.378697629483821e19) {
        return x > 0 ? ATAN_HI[3] + ATAN_LO[3] : -ATAN_HI[3] - ATAN_LO[3];
    }
    let id: number;
    let v: number;
    if (ax < 0.4375) {
        if (ax < 7.450580596923828e-9) {
            return x;
        }
        id = -1;
        v = x;
    } else if (ax < 1.1875) {
        if (ax < 0.6875) {
            id = 0;
            v = (2 * ax - 1) / (2 + ax);
        } else {
            id = 1;
            v = (ax - 1) / (ax + 1);
        }
    } else if (ax < 2.4375) {
        id = 2;
        v = (ax - 1.5) / (1 + 1.5 * ax);
    } else {
        id = 3;
        v = -1 / ax;
    }
    const z = v * v;
    const w = z * z;
    const s1 =
        z *
        (AT[0] +
            w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
    const s2 =
        w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
    if (id < 0) {
        return v - v * (s1 + s2);
    }
    const result = ATAN_HI[id] - (v * (s1 + s2) - ATAN_LO[id] - v);
    return x < 0 ? -result : result;
}
export function atan2(y: number, x: number): number {
    if (Number.isNaN(x) || Number.isNaN(y)) {
        return NaN;
    }
    const negativeX = x < 0 || Object.is(x, -0);
    if (y === 0) {
        return negativeX ? (Object.is(y, -0) ? -PI : PI) : y;
    }
    if (x === 0) {
        return y > 0 ? PIO2_HI : -PIO2_HI;
    }
    if (!Number.isFinite(x)) {
        return infiniteAtan2(y, x);
    }
    if (!Number.isFinite(y)) {
        return y > 0 ? PIO2_HI : -PIO2_HI;
    }
    const z = atan(Math.abs(y / x));
    if (x > 0) {
        return y < 0 ? -z : z;
    }
    const result = PI - (z - PI_LO);
    return y < 0 ? -result : result;
}
export function hypot(x: number, y: number): number {
    let a = Math.abs(x);
    let b = Math.abs(y);
    if (a === Infinity || b === Infinity) {
        return Infinity;
    }
    if (Number.isNaN(a) || Number.isNaN(b)) {
        return NaN;
    }
    if (a < b) {
        const swap = a;
        a = b;
        b = swap;
    }
    if (a === 0) {
        return 0;
    }
    const r = b / a;
    return a * Math.sqrt(1 + r * r);
}
function infiniteAtan2(y: number, x: number): number {
    if (!Number.isFinite(y)) {
        const corner = x > 0 ? PIO4 : 3 * PIO4;
        return y > 0 ? corner : -corner;
    }
    return x > 0 ? (y > 0 ? 0 : -0) : y > 0 ? PI : -PI;
}
