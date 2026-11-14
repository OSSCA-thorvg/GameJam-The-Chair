import type { RenderCtx } from '../context';
import type { DrawCommand, Vector } from '../types';
import { STAGE_FIVE } from '../../game/stages/orbit/data';

// The Earth as it really sits under a climbing chair: a sphere below the camera, not a disc ahead of it. The
// camera looks level along the flight, so the horizon dips below eye level and curves more the higher the chair
// climbs (the dip is acos(R / (R + h))). The ground track runs from the Bay of Bengal toward Korea and ends in the
// night looking at Seoul, the office the chair left. Scenery only.

const R = 6371;
type V3 = [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V3) => scale(a, 1 / Math.max(1e-9, Math.hypot(...a)));
const rad = Math.PI / 180;
const globe = (lon: number, lat: number): V3 => [Math.cos(lat * rad) * Math.cos(lon * rad), Math.cos(lat * rad) * Math.sin(lon * rad), Math.sin(lat * rad)];
const smooth = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
};
const alpha = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0');

const H = STAGE_FIVE.heights;
/** Ground closer to the lens than this (km, along its axis) is cut off. */
const NEAR = 20;

/** Height above the ground in km at route depth `z`: cloud tops, the edge of space, then orbit height in the shadow. */
export function earthAltitude(z: number) {
    return 12 + 110 * smooth((z - H.air) / (H.space - H.air)) + 280 * smooth((z - H.space) / (H.shadow - H.space));
}

// The ground track crosses coasts, so land and sea keep passing below: over the Bay of Bengal, across Myanmar and
// Thailand, out over the Vietnamese coast and the South China Sea, past Taiwan, and north over the East China Sea.
// It stops south of Jeju looking north, so the night view ahead is Korea, with Japan to the right and China left.
const TRACK: [number, number][] = [[84, 10], [88, 12], [98, 14.5], [108, 16], [117, 20], [122, 25.5], [125.5, 31], [126.5, 37]];

/** The point on the ground under the chair at route depth `z`, as [longitude, latitude] (a Catmull-Rom spline). */
export function groundTrack(z: number): [number, number] {
    const u = Math.max(0, Math.min(1, z / STAGE_FIVE.checkpoint.z)) * (TRACK.length - 3);
    const i = Math.min(TRACK.length - 4, Math.floor(u)), t = u - i;
    const [a, b, c, d] = TRACK.slice(i, i + 4);
    const spline = (k: 0 | 1) => .5 * (2 * b[k] + (-a[k] + c[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t * t + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t * t * t);
    return [spline(0), spline(1)];
}

// Simplified coastlines, [longitude, latitude].
const LAND: { color: string; outline: [number, number][]; inland?: true }[] = [
    { color: '#5d8a4f', outline: [[92, 22], [94, 18], [97, 16], [98, 10], [100, 7], [103, 1.5], [104, 1.5], [103, 5], [101, 7], [100, 12], [102, 13], [105, 9], [106, 11],
        [109, 12], [109, 15], [106, 18], [108, 21], [110, 21], [113, 22], [117, 23], [120, 26], [122, 30], [121, 32], [120, 34], [119, 35], [122, 37], [121, 39],
        [118, 39], [118, 40], [121, 41], [124, 40], [126, 41], [128, 42], [130, 42.5], [131, 43], [133, 45], [135, 48], [132, 52], [120, 55], [100, 55], [85, 50],
        [75, 42], [74, 35], [76, 33], [80, 30], [84, 28], [88, 27], [92, 26]] },
    // India and Sri Lanka.
    { color: '#6b8f4a', outline: [[68, 23], [72, 21], [73, 16], [75, 12], [77, 8], [80, 10], [80, 15], [83, 18], [87, 21], [89, 22], [92, 22], [92, 26], [88, 27],
        [84, 28], [80, 30], [76, 33], [74, 35], [71, 34], [70, 30], [67, 25]] },
    { color: '#5d8a4f', outline: [[80, 9.8], [81.8, 8], [81.5, 6.2], [80, 6], [79.8, 8]] },
    // The Tibetan plateau, the Gobi and the Taklamakan.
    { color: '#a39b78', inland: true, outline: [[78, 35], [90, 36], [100, 35], [102, 30], [98, 28], [88, 28], [80, 31]] },
    { color: '#c2ab74', inland: true, outline: [[95, 42], [110, 44], [115, 42], [105, 39], [96, 40]] },
    { color: '#c9b07a', inland: true, outline: [[78, 40], [88, 41], [90, 38], [82, 37], [77, 38]] },
    // Snow along the Himalaya.
    { color: '#eef2f4', inland: true, outline: [[74, 35.5], [79, 32], [84, 29.2], [88, 28.2], [92, 28.4], [96, 29.4], [96, 28.6], [92, 27.7], [88, 27.5], [84, 28.5], [79, 31.2], [73.5, 34.8]] },
    // Forest: the Indochinese and southern Chinese hills, and the Korean mountains.
    { color: '#3f6f3c', inland: true, outline: [[98, 20], [102, 22], [106, 22], [108, 25], [112, 25], [116, 26], [114, 23], [109, 21.5], [106, 19], [104, 17], [101, 16]] },
    { color: '#3f6f3c', inland: true, outline: [[127.4, 39.4], [128.4, 38.2], [129.2, 36.6], [128.6, 35.6], [127.8, 36.6], [127.2, 38.2]] },
    // The Deccan, drier than the coasts.
    { color: '#9a9a5e', inland: true, outline: [[74, 20], [78, 22], [82, 20], [80, 15], [77, 13], [75, 16]] },
    // The Korean peninsula.
    { color: '#5a8a52', outline: [[124.6, 39.7], [125.3, 37.7], [126.5, 37], [126.3, 35], [126.6, 34.4], [128.5, 34.8], [129.4, 35.5], [129.5, 36.5], [128.6, 38.5],
        [127.5, 39.7], [128.3, 40.7], [129.7, 41], [130, 42.5], [128, 42], [126, 41]] },
    // Japan.
    { color: '#5a8a52', outline: [[130.9, 34], [132, 33.8], [135, 33.5], [137, 34.5], [139.8, 35], [140.8, 35.7], [141, 38], [141.5, 40.5], [140.5, 41.2], [139.8, 40],
        [139.5, 38], [137, 37], [136, 35.8], [133, 35.5]] },
    { color: '#5a8a52', outline: [[129.7, 33.5], [131, 33.9], [131.8, 32], [131, 31], [130.2, 31.3]] },
    { color: '#5a8a52', outline: [[140, 42], [141, 41.5], [143, 42], [145.5, 43.3], [144, 44.3], [141.8, 45.4], [141.5, 43.5]] },
    // Taiwan, Hainan, Luzon, Sumatra and Borneo.
    { color: '#5a8a52', outline: [[120.1, 23], [121, 25.2], [122, 25], [121, 22]] },
    { color: '#5a8a52', outline: [[108.7, 19.2], [110.5, 20.1], [111, 19.6], [109.5, 18.2]] },
    { color: '#5a8a52', outline: [[120, 18.5], [122, 18.5], [122, 16], [124, 13], [121, 13.8], [120.5, 15]] },
    { color: '#4f7f46', outline: [[95.3, 5.6], [98, 4], [104, -2], [106, -5.8], [102, -4], [98, 1]] },
    { color: '#4f7f46', outline: [[109, 1], [110, -2], [114, -3.5], [116.5, -1], [119, 5], [117, 7], [115, 5], [111, 2]] },
];

// Scattered cloud over the whole region: [longitude, latitude, size in degrees, stretch].
const CLOUDS: [number, number, number, number][] = (() => {
    let seed = 4417;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    return Array.from({ length: 380 }, () => [72 + random() * 80, -8 + random() * 56, .3 + random() * 1.1, .35 + random() * .5]);
})();

/** Coastlines with a point at least every degree, so their edges follow the curve of the globe. */
const DENSE = (() => {
    const densify = (outline: [number, number][]) => outline.flatMap(([lon, lat], i) => {
        const [nextLon, nextLat] = outline[(i + 1) % outline.length];
        const steps = Math.max(1, Math.ceil(Math.hypot(nextLon - lon, nextLat - lat)));
        return Array.from({ length: steps }, (_, k) => globe(lon + (nextLon - lon) * k / steps, lat + (nextLat - lat) * k / steps));
    });
    return (land: { outline: [number, number][] }) => densify(land.outline);
})();

// City lights for the night side: [longitude, latitude, size]. Seoul is the brightest of all.
const CITIES: [number, number, number][] = [[127, 37.5, 3.4], [129, 35.1, 1.7], [128.6, 35.9, 1.4], [127.4, 36.3, 1.2], [126.9, 35.2, 1.2], [139.7, 35.7, 3],
    [135.5, 34.7, 2.3], [136.9, 35.2, 1.6], [130.4, 33.6, 1.5], [141.3, 43.1, 1.2], [116.4, 39.9, 2.6], [117.2, 39.1, 1.6], [121.5, 31.2, 2.8], [114.3, 30.6, 1.6],
    [113.5, 22.6, 2.8], [121.5, 25, 1.8], [106.5, 29.6, 1.6], [104.1, 30.7, 1.5], [108.9, 34.3, 1.3], [123.4, 41.8, 1.4], [125.7, 39, .5], [100.5, 13.8, 2],
    [105.8, 21, 1.4], [121, 14.6, 1.8], [90.4, 23.8, 1.8], [88.4, 22.6, 1.8], [77.2, 28.6, 2.2], [120.2, 30.3, 1.4], [118.8, 32.1, 1.4], [126.5, 45.8, 1.2]];

/** The world camera's lens: where its axis meets the screen, its focal length, roll, and how far it looks down. */
export type EarthCamera = { cx: number; cy: number; focal: number; roll: number; pitch: number };

/** The camera at route depth `z` looking along the ground track, turned by the route's bend `yaw` and by `spin` radians. */
function earthView(z: number, yaw: number, camera: EarthCamera, spin = 0) {
    const h = earthAltitude(z);
    const [lon, lat] = groundTrack(z);
    // The heading along the track; at its end the track stops, so take it from just before.
    const from = Math.min(z, STAGE_FIVE.checkpoint.z - 200), [aLon, aLat] = groundTrack(from), [bLon, bLat] = groundTrack(from + 200);
    const up = globe(lon, lat);
    const ahead = add(globe(bLon, bLat), globe(aLon, aLat), -1);
    let forward = unit(add(ahead, up, -dot(ahead, up)));
    const turn = Math.atan(yaw) + spin;
    forward = unit(add(scale(forward, Math.cos(turn)), cross(up, forward), Math.sin(turn)));
    const right = cross(forward, up);
    const limb = R / (R + h);
    const { cx, cy, focal, roll, pitch } = camera;
    // The lens looks down by `pitch` from the flight direction.
    const lookAhead = add(scale(forward, Math.cos(pitch)), up, -Math.sin(pitch)), lookUp = add(scale(up, Math.cos(pitch)), forward, Math.sin(pitch));
    const cos = Math.cos(roll), sin = Math.sin(roll);
    /** Camera-space position (across, up, ahead) of a ground direction; behind the horizon, of the horizon point in its direction. */
    const toCamera = (n: V3): V3 => {
        let v = n;
        const along = dot(n, up);
        if (along < limb) {
            const flat = add(n, up, -along), size = Math.hypot(...flat);
            v = add(scale(up, limb), size > 1e-9 ? scale(flat, 1 / size) : forward, Math.sqrt(1 - limb * limb));
        }
        const at = add(scale(v, R), up, -(R + h));
        return [dot(at, right), dot(at, lookUp), dot(at, lookAhead)];
    };
    const toScreen = ([ax, ay, az]: V3): Vector => {
        const x = ax * focal / az, y = -ay * focal / az;
        return [cx + x * cos - y * sin, cy + x * sin + y * cos];
    };
    const project = (n: V3): Vector => {
        const at = toCamera(n);
        return toScreen([at[0], at[1], Math.max(at[2], NEAR)]);
    };
    /** A ground outline on screen, cut where it passes behind the camera (empty when wholly behind). */
    const outline = (points: V3[]): Vector[] => {
        const cam = points.map(toCamera), out: V3[] = [];
        cam.forEach((a, i) => {
            const b = cam[(i + 1) % cam.length];
            if (a[2] >= NEAR) out.push(a);
            if ((a[2] >= NEAR) !== (b[2] >= NEAR)) {
                const t = (NEAR - a[2]) / (b[2] - a[2]);
                out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
            }
        });
        return out.length >= 3 ? out.map(toScreen) : [];
    };
    // The horizon across the view, and how far below eye level it sits straight ahead.
    const horizon: Vector[] = [];
    for (let a = -86; a <= 86; a += 4) {
        const t = a * rad;
        horizon.push(project(add(scale(up, limb), add(scale(forward, Math.cos(t)), right, Math.sin(t)), Math.sqrt(1 - limb * limb))));
    }
    /** Whether a ground point is on the near side of the horizon and in front of the lens. */
    const visible = (n: V3) => dot(n, up) >= limb && toCamera(n)[2] >= NEAR;
    return { project, outline, visible, horizon, middle: horizon[Math.floor(horizon.length / 2)] };
}

/**
 * The Earth below: ocean, land, clouds, the thin blue line of the atmosphere, and in its shadow the night side with
 * its cities. `strength` fades it in as the clouds thin out; `night` is how deep into the Earth's shadow it is.
 */
export function orbitEarth(ctx: RenderCtx, travel: number, camera: EarthCamera, yaw: number, strength: number, night: number, spin = 0) {
    if (strength <= 0) return;
    const view = earthView(travel, yaw, camera, spin);
    const { horizon, middle } = view;
    const far = Math.max(ctx.W, ctx.H) * 4;
    const ground: Vector[] = [...horizon, [horizon.at(-1)![0] + far, horizon.at(-1)![1] + far], [horizon[0][0] - far, horizon[0][1] + far]];
    const clip: DrawCommand = { v: ground, c: '#000000' };
    // Ocean, hazier toward the horizon. A single shape, so its fade is folded into its own colours (no layer).
    ctx.commands.push({ v: ground, c: { from: middle, to: [middle[0], middle[1] + ctx.H * .5],
        stops: [[0, ctx.rgba('#8cc0e6', strength)], [.18, ctx.rgba('#3f82c4', strength)], [1, ctx.rgba('#1b4f8f', strength)]] } });
    // Land, clouds and lights sit on the sphere and are clipped to the ground under the horizon (ThorVG clip).
    const surface = { key: 'orbit-earth-surface', opacity: strength, clip };
    // Coasts get a pale surf line; inland patches (desert, snow, forest) sit on top without one.
    for (const land of [...LAND.filter(item => !item.inland), ...LAND.filter(item => item.inland)]) {
        const points = DENSE(land);
        // A coast wholly beyond the horizon would only squash onto it.
        if (!points.some(view.visible)) continue;
        const v = view.outline(points);
        if (v.length) ctx.commands.push({ v, c: land.color, layer: surface,
            ...(land.inland ? {} : { stroke: { width: Math.max(1, ctx.W / 700), color: '#d9efe0aa' } }) });
    }
    const drift = ctx.t * .015, cloud = '#ffffff' + alpha(.5 * (1 - night * .85));
    CLOUDS.forEach(([lon, lat, r, stretch], k) => {
        if (!view.visible(globe(lon + drift, lat))) return;
        const v = view.outline(Array.from({ length: 9 }, (_, i) => {
            const a = i / 9 * Math.PI * 2;
            return globe(lon + drift + Math.cos(a) * r * (1 + .3 * Math.sin(i * 2.3 + k)), lat + Math.sin(a) * r * stretch);
        }));
        if (v.length) ctx.commands.push({ v, c: cloud, layer: surface });
    });
    if (night > 0) {
        ctx.commands.push({ v: ground, c: '#06101f' + alpha(.86 * night), layer: surface });
        // Coasts still faintly visible under the night sky.
        for (const land of LAND) {
            if (land.inland) continue;
            const points = DENSE(land);
            if (!points.some(view.visible)) continue;
            const v = view.outline(points);
            if (v.length) ctx.commands.push({ v, c: null, stroke: { width: Math.max(1, ctx.W / 800), color: '#6f8fbf' + alpha(.45 * night) }, layer: surface });
        }
        const glow = { key: 'orbit-earth-lights', blend: 'screen' as const, opacity: strength * night, clip };
        for (const [lon, lat, size] of CITIES) {
            if (!view.visible(globe(lon, lat))) continue;
            const [x, y] = view.project(globe(lon, lat));
            const r = size * ctx.W / 420;
            ctx.commands.push({ v: [[x - r * 4, y - r * 4], [x + r * 4, y - r * 4], [x + r * 4, y + r * 4], [x - r * 4, y + r * 4]], layer: glow,
                c: { from: [x, y], to: [x + r * 4, y], radius: r * 4, stops: [[0, ctx.rgba('#ffc96a', 1)], [.35, ctx.rgba('#ffb84d', .45)], [1, ctx.rgba('#ffb84d', 0)]] } });
            ctx.commands.push({ v: [[x - r * 2.2, y], [x, y - r], [x + r * 2.2, y], [x, y + r]], c: '#fff6dc', layer: glow });
        }
    }
    // Haze along the horizon and the thin, bright line of the atmosphere over it.
    const above = horizon.map(([x, y]): Vector => [x, y - ctx.H * .07]);
    ctx.commands.push({ v: [...horizon, ...above.reverse()], layer: { key: 'orbit-earth-air', blend: 'screen', opacity: strength },
        c: { from: middle, to: [middle[0], middle[1] - ctx.H * .07], stops: [[0, ctx.rgba('#7fb8ff', .55)], [1, ctx.rgba('#7fb8ff', 0)]] } });
    const limb = { key: 'orbit-earth-limb', blend: 'screen' as const };
    for (const [width, color, opacity] of [[ctx.W * .012, '#4f8fe0', .45], [ctx.W * .004, '#d8f0ff', .85]] as const) {
        ctx.commands.push({ v: horizon, open: true, c: null, stroke: { width, color: color + alpha(opacity * strength) }, layer: limb });
    }
    return middle;
}

/** Where the Earth's horizon sits straight ahead, for the sunrise glow in its shadow. */
export function earthHorizonAhead(travel: number, camera: EarthCamera, yaw: number) {
    return earthView(travel, yaw, camera).middle;
}
