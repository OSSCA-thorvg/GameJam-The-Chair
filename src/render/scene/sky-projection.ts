import type { DrawCommand, Vector } from '../types';

export type Point3 = [number, number, number];
const add = (a: Point3, b: Point3): Point3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Point3, b: Point3): Point3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: Point3, s: number): Point3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point3, b: Point3): Point3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Point3) => mul(a, 1 / Math.max(.0001, Math.hypot(...a)));
export function createSkyProjection(width: number, height: number, orbit: number, framing: { zoom?: number; centerY?: number; offsetX?: number; roll?: number; level?: boolean } = {}) {
    const angle = orbit * Math.PI / 2;
    const distance = 480;
    const target: Point3 = [0, 15, 0];
    const camera: Point3 = [-Math.sin(angle) * distance, framing.level ? 15 : 45, Math.cos(angle) * distance];
    const forward = norm(sub(target, camera));
    const right = norm(cross(forward, [0, 1, 0]));
    const up = norm(cross(right, forward));
    // Keep the chair at a steady distance while the camera moves from its side to its back.
    const focal = Math.min(height * 1.65, width * .94) * (framing.zoom ?? 1);
    const depth = (p: Point3) => dot(sub(p, camera), forward);
    const project = (p: Point3): Vector => {
        const relative = sub(p, camera), distance = depth(p);
        const x = dot(relative, right) * focal / distance;
        const y = -dot(relative, up) * focal / distance;
        const roll = framing.roll ?? 0;
        return [width / 2 + (framing.offsetX ?? 0) + x * Math.cos(roll) - y * Math.sin(roll),
            height * (framing.centerY ?? .5) + x * Math.sin(roll) + y * Math.cos(roll)];
    };
    const faces: { points: Point3[]; color: string; depth: number }[] = [];
    const curves: { command: DrawCommand; depth: number }[] = [];
    const polygon = (points: Point3[], color: string) => {
        if (points.some(p => depth(p) <= 30)) return;
        const normal = points.reduce<Point3>((sum, p, i) => add(sum, cross(p, points[(i + 1) % points.length])), [0, 0, 0]);
        if (color.length === 7 && dot(normal, sub(camera, points[0])) <= 0) return;
        faces.push({ points, color, depth: points.reduce((sum, p) => sum + depth(p), 0) / points.length });
    };
    const shade = (color: string, factor: number) => '#' + [1, 3, 5].map(i =>
        Math.max(0, Math.min(255, Math.round(parseInt(color.slice(i, i + 2), 16) * factor))).toString(16).padStart(2, '0')).join('') + color.slice(7);
    // Extrude the game's existing side silhouettes, with a bevel instead of cuboid limbs.
    const profile = (outline: Vector[], halfWidth: number, color: string, z = 0, options?: { widthAt?: (x: number, y: number) => number; bevel?: number }) => {
        const { widthAt, bevel = .86 } = options ?? {};
        const cx = outline.reduce((sum, p) => sum + p[0], 0) / outline.length;
        const cy = outline.reduce((sum, p) => sum + p[1], 0) / outline.length;
        const area = outline.reduce((sum, p, i) => {
            const next = outline[(i + 1) % outline.length];
            return sum + p[0] * next[1] - next[0] * p[1];
        }, 0);
        const points = area > 0 ? outline : [...outline].reverse();
        const ring = (offset: number, scale: number): Point3[] => points.map(([x, y]) => [
            cx + (x - cx) * scale, cy + (y - cy) * scale, z + offset * (widthAt ? widthAt(x, y) / halfWidth : 1),
        ]);
        const rings = [ring(-halfWidth, bevel), ring(-halfWidth * .65, 1), ring(halfWidth * .65, 1), ring(halfWidth, bevel)];
        polygon([...rings[0]].reverse(), shade(color, .94));
        polygon(rings[3], color);
        for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < points.length; i++) {
            const next = (i + 1) % points.length;
            polygon([rings[r][i], rings[r][next], rings[r + 1][next], rings[r + 1][i]], shade(color, r === 1 ? .96 : 1.02));
        }
    };
    // A smooth projected silhouette keeps heads, casters and clouds free of mesh facets.
    const oval = (center: Point3, radii: Point3, color: string) => {
        if (depth(center) <= 30) return;
        const c = project(center);
        const axes: Point3[] = [[radii[0], 0, 0], [0, radii[1], 0], [0, 0, radii[2]]];
        const projected = axes.map(axis => {
            const p = project(add(center, axis));
            return [p[0] - c[0], p[1] - c[1]];
        });
        const a = projected.reduce((sum, p) => sum + p[0] * p[0], 0);
        const b = projected.reduce((sum, p) => sum + p[0] * p[1], 0);
        const d = projected.reduce((sum, p) => sum + p[1] * p[1], 0);
        const delta = Math.hypot(a - d, 2 * b), angle = Math.atan2(2 * b, a - d) / 2;
        const major = Math.sqrt(Math.max(0, (a + d + delta) / 2));
        const minor = Math.sqrt(Math.max(0, (a + d - delta) / 2));
        const u: Vector = [Math.cos(angle) * major, Math.sin(angle) * major];
        const v: Vector = [-Math.sin(angle) * minor, Math.cos(angle) * minor];
        const point = (x: number, y: number): Vector => [c[0] + u[0] * x + v[0] * y, c[1] + u[1] * x + v[1] * y];
        const k = .5522847498;
        curves.push({ depth: depth(center), command: {
            v: [point(1, 0)], curves: [
                [...point(1, k), ...point(k, 1), ...point(0, 1)],
                [...point(-k, 1), ...point(-1, k), ...point(-1, 0)],
                [...point(-1, -k), ...point(-k, -1), ...point(0, -1)],
                [...point(k, -1), ...point(1, -k), ...point(1, 0)],
            ], c: color,
        } });
    };
    const rod = (a: Point3, b: Point3, r: number, color: string) => {
        const axis = norm(sub(b, a));
        const axis2 = norm(cross(axis, Math.abs(axis[1]) > .9 ? [1, 0, 0] : [0, 1, 0]));
        const axis3 = cross(axis, axis2);
        for (let i = 0; i < 12; i++) {
            const ring = (angle: number) => add(mul(axis2, Math.cos(angle) * r), mul(axis3, Math.sin(angle) * r));
            const u = ring(i * Math.PI / 6), v = ring((i + 1) * Math.PI / 6);
            polygon([add(a, u), add(a, v), add(b, v), add(b, u)], shade(color, .96));
        }
    };
    const commands = (): DrawCommand[] => {
        const flat = faces.flatMap(face => {
            const v = face.points.map(project);
            if (v.every(p => p[0] < -20) || v.every(p => p[0] > width + 20) || v.every(p => p[1] < -20) || v.every(p => p[1] > height + 20)) return [];
            const haze = Math.min(.78, Math.max(0, (face.depth - 1800) / 18000));
            const c = '#' + [147, 181, 199].map((channel, i) => {
                const value = parseInt(face.color.slice(1 + i * 2, 3 + i * 2), 16);
                return Math.round(value + (channel - value) * haze).toString(16).padStart(2, '0');
            }).join('') + face.color.slice(7);
            return [{ depth: face.depth, command: { v, c } }];
        });
        return [...flat, ...curves].sort((a, b) => b.depth - a.depth).map(item => item.command);
    };
    return { project, depth, polygon, profile, oval, rod, commands };
}

export type SkyProjection = ReturnType<typeof createSkyProjection>;
