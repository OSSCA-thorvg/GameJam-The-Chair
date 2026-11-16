import type { DrawCommand, Vector } from '../../types';
export type Point3 = [number, number, number];
const LOD_PIXELS = 4;
const add = (a: Point3, b: Point3): Point3 => [
    a[0] + b[0],
    a[1] + b[1],
    a[2] + b[2],
];
const sub = (a: Point3, b: Point3): Point3 => [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2],
];
const mul = (a: Point3, s: number): Point3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point3, b: Point3): Point3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Point3) => mul(a, 1 / Math.max(0.0001, Math.hypot(...a)));
export type SkyFraming = {
    zoom?: number;
    centerY?: number;
    offsetX?: number;
    roll?: number;
    level?: boolean;
    eyeY?: number;
    distance?: number;
};
export function createSkyProjection(
    width: number,
    height: number,
    orbit: number,
    framing: SkyFraming = {},
): {
    project: (p: Point3) => Vector;
    depth: (p: Point3) => number;
    polygon: (points: Point3[], color: string) => void;
    profile: (
        outline: Vector[],
        halfWidth: number,
        color: string,
        z?: number,
        options?: {
            widthAt?: (x: number, y: number) => number;
            bevel?: number;
            place?: (p: Point3) => Point3;
        },
    ) => void;
    oval: (center: Point3, radii: Point3, color: string) => void;
    rod: (a: Point3, b: Point3, r: number, color: string) => void;
    commands: (split?: {
        depth: number;
        part: 'far' | 'near';
    }) => DrawCommand[];
} {
    return new SkyProjectionRuntime(width, height, orbit, framing).api();
}
export type SkyProjection = ReturnType<typeof createSkyProjection>;
export function placedProjection(
    view: SkyProjection,
    place: (p: Point3) => Point3,
): SkyProjection {
    type ProfileOptions = Parameters<SkyProjection['profile']>[4];
    return {
        ...view,
        project: (p) => view.project(place(p)),
        depth: (p) => view.depth(place(p)),
        polygon: (points, color) => view.polygon(points.map(place), color),
        profile: (outline, halfWidth, color, z, options?: ProfileOptions) =>
            view.profile(outline, halfWidth, color, z, {
                ...options,
                place: (p) => place(options?.place ? options.place(p) : p),
            }),
        oval: (center, radii, color) => view.oval(place(center), radii, color),
        rod: (a, b, r, color) => view.rod(place(a), place(b), r, color),
    };
}
class SkyProjectionRuntime {
    private width!: number;
    private height!: number;
    private orbit!: number;
    private framing!: SkyFraming;
    private angle!: number;
    private distance!: number;
    private target!: Point3;
    private eye!: number;
    private camera!: Point3;
    private forward!: Point3;
    private right!: Point3;
    private up!: Point3;
    private focal!: number;
    private depth: (p: Point3) => number = (p: Point3) => {
        return dot(sub(p, this.camera), this.forward);
    };
    private project: (p: Point3) => Vector = (p: Point3): Vector => {
        const relative = sub(p, this.camera);
        const distance = this.depth(p);
        const x = (dot(relative, this.right) * this.focal) / distance;
        const y = (-dot(relative, this.up) * this.focal) / distance;
        const roll = this.framing.roll ?? 0;
        return [
            this.width / 2 +
                (this.framing.offsetX ?? 0) +
                x * Math.cos(roll) -
                y * Math.sin(roll),
            this.height * (this.framing.centerY ?? 0.5) +
                x * Math.sin(roll) +
                y * Math.cos(roll),
        ];
    };
    private pixels: (a: Point3, b: Point3) => number = (
        a: Point3,
        b: Point3,
    ) => {
        const near = Math.max(30, Math.min(this.depth(a), this.depth(b)));
        return (Math.hypot(...sub(a, b)) * this.focal) / near;
    };
    private faces!: Array<{
        points: Point3[];
        color: string;
        depth: number;
    }>;
    private curves!: Array<{
        command: DrawCommand;
        depth: number;
    }>;
    private polygon: (points: Point3[], color: string) => void = (
        points: Point3[],
        color: string,
    ) => {
        if (points.some((p) => this.depth(p) <= 30)) {
            return;
        }
        const normal = points.reduce<Point3>(
            (sum, p, i) => add(sum, cross(p, points[(i + 1) % points.length])),
            [0, 0, 0],
        );
        if (
            color.length === 7 &&
            dot(normal, sub(this.camera, points[0])) <= 0
        ) {
            return;
        }
        this.faces.push({
            points,
            color,
            depth:
                points.reduce((sum, p) => sum + this.depth(p), 0) /
                points.length,
        });
    };
    private shade: (color: string, factor: number) => string = (
        color: string,
        factor: number,
    ) => {
        return (
            '#' +
            [1, 3, 5]
                .map((i) =>
                    Math.max(
                        0,
                        Math.min(
                            255,
                            Math.round(
                                parseInt(color.slice(i, i + 2), 16) * factor,
                            ),
                        ),
                    )
                        .toString(16)
                        .padStart(2, '0'),
                )
                .join('') +
            color.slice(7)
        );
    };
    private profile: (
        outline: Vector[],
        halfWidth: number,
        color: string,
        z?: number,
        options?: {
            widthAt?: (x: number, y: number) => number;
            bevel?: number;
            place?: (p: Point3) => Point3;
        },
    ) => void = (
        outline: Vector[],
        halfWidth: number,
        color: string,
        z = 0,
        options?: {
            widthAt?: (x: number, y: number) => number;
            bevel?: number;
            place?: (p: Point3) => Point3;
        },
    ) => {
        const {
            widthAt,
            bevel = 0.86,
            place = (p: Point3) => p,
        } = options ?? {};
        const cx = outline.reduce((sum, p) => sum + p[0], 0) / outline.length;
        const cy = outline.reduce((sum, p) => sum + p[1], 0) / outline.length;
        const area = outline.reduce((sum, p, i) => {
            const next = outline[(i + 1) % outline.length];
            return sum + p[0] * next[1] - next[0] * p[1];
        }, 0);
        const points = area > 0 ? outline : [...outline].reverse();
        const ring = (offset: number, scale: number): Point3[] =>
            points.map(([x, y]) =>
                place([
                    cx + (x - cx) * scale,
                    cy + (y - cy) * scale,
                    z + offset * (widthAt ? widthAt(x, y) / halfWidth : 1),
                ]),
            );
        const thin =
            this.pixels(
                place([cx, cy, z - halfWidth]),
                place([cx, cy, z + halfWidth]),
            ) < LOD_PIXELS;
        const rings = thin
            ? [ring(-halfWidth, 1), ring(halfWidth, 1)]
            : [
                  ring(-halfWidth, bevel),
                  ring(-halfWidth * 0.65, 1),
                  ring(halfWidth * 0.65, 1),
                  ring(halfWidth, bevel),
              ];
        this.polygon([...rings[0]].reverse(), this.shade(color, 0.94));
        this.polygon(rings[rings.length - 1], color);
        for (let r = 0; r < rings.length - 1; r++) {
            for (let i = 0; i < points.length; i++) {
                const next = (i + 1) % points.length;
                this.polygon(
                    [
                        rings[r][i],
                        rings[r][next],
                        rings[r + 1][next],
                        rings[r + 1][i],
                    ],
                    this.shade(color, r === 1 || thin ? 0.96 : 1.02),
                );
            }
        }
    };
    private oval: (center: Point3, radii: Point3, color: string) => void = (
        center: Point3,
        radii: Point3,
        color: string,
    ) => {
        if (this.depth(center) <= 30) {
            return;
        }
        const c = this.project(center);
        const axes: Point3[] = [
            [radii[0], 0, 0],
            [0, radii[1], 0],
            [0, 0, radii[2]],
        ];
        const projected = axes.map((axis) => {
            const p = this.project(add(center, axis));
            return [p[0] - c[0], p[1] - c[1]];
        });
        const a = projected.reduce((sum, p) => sum + p[0] * p[0], 0);
        const b = projected.reduce((sum, p) => sum + p[0] * p[1], 0);
        const d = projected.reduce((sum, p) => sum + p[1] * p[1], 0);
        const delta = Math.hypot(a - d, 2 * b);
        const angle = Math.atan2(2 * b, a - d) / 2;
        const major = Math.sqrt(Math.max(0, (a + d + delta) / 2));
        const minor = Math.sqrt(Math.max(0, (a + d - delta) / 2));
        const u: Vector = [Math.cos(angle) * major, Math.sin(angle) * major];
        const v: Vector = [-Math.sin(angle) * minor, Math.cos(angle) * minor];
        const point = (x: number, y: number): Vector => [
            c[0] + u[0] * x + v[0] * y,
            c[1] + u[1] * x + v[1] * y,
        ];
        const k = 0.5522847498;
        this.curves.push({
            depth: this.depth(center),
            command: {
                kind: 'path',
                points: [point(1, 0)],
                curves: [
                    [...point(1, k), ...point(k, 1), ...point(0, 1)],
                    [...point(-k, 1), ...point(-1, k), ...point(-1, 0)],
                    [...point(-1, -k), ...point(-k, -1), ...point(0, -1)],
                    [...point(k, -1), ...point(1, -k), ...point(1, 0)],
                ],
                fill: color,
            },
        });
    };
    private rod: (a: Point3, b: Point3, r: number, color: string) => void = (
        a: Point3,
        b: Point3,
        r: number,
        color: string,
    ) => {
        const axis = norm(sub(b, a));
        const axis2 = norm(
            cross(axis, Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]),
        );
        const axis3 = cross(axis, axis2);
        const sides =
            this.pixels(add(a, mul(axis2, r)), sub(a, mul(axis2, r))) <
                LOD_PIXELS &&
            this.pixels(add(b, mul(axis2, r)), sub(b, mul(axis2, r))) <
                LOD_PIXELS
                ? 6
                : 12;
        for (let i = 0; i < sides; i++) {
            const ring = (angle: number) =>
                add(
                    mul(axis2, Math.cos(angle) * r),
                    mul(axis3, Math.sin(angle) * r),
                );
            const u = ring((i * 2 * Math.PI) / sides);
            const v = ring(((i + 1) * 2 * Math.PI) / sides);
            this.polygon(
                [add(a, u), add(a, v), add(b, v), add(b, u)],
                this.shade(color, 0.96),
            );
        }
    };
    private commands: (split?: {
        depth: number;
        part: 'far' | 'near';
    }) => DrawCommand[] = (split?: {
        depth: number;
        part: 'far' | 'near';
    }): DrawCommand[] => {
        const keep = (depth: number) =>
            !split ||
            (split.part === 'far' ? depth > split.depth : depth <= split.depth);
        const flat = this.faces
            .filter((face) => keep(face.depth))
            .flatMap((face) => {
                const v = face.points.map(this.project);
                if (
                    v.every((p) => p[0] < -20) ||
                    v.every((p) => p[0] > this.width + 20) ||
                    v.every((p) => p[1] < -20) ||
                    v.every((p) => p[1] > this.height + 20)
                ) {
                    return [];
                }
                const haze = Math.min(
                    0.78,
                    Math.max(0, (face.depth - 1800) / 18000),
                );
                const c =
                    '#' +
                    [147, 181, 199]
                        .map((channel, i) => {
                            const value = parseInt(
                                face.color.slice(1 + i * 2, 3 + i * 2),
                                16,
                            );
                            return Math.round(value + (channel - value) * haze)
                                .toString(16)
                                .padStart(2, '0');
                        })
                        .join('') +
                    face.color.slice(7);
                return [
                    {
                        depth: face.depth,
                        command: {
                            kind: 'path' as const,
                            points: v,
                            fill: c,
                        },
                    },
                ];
            });
        return [...flat, ...this.curves.filter((curve) => keep(curve.depth))]
            .sort((a, b) => b.depth - a.depth)
            .map((item) => item.command);
    };
    constructor(
        width: number,
        height: number,
        orbit: number,
        framing: SkyFraming,
    ) {
        this.width = width;
        this.height = height;
        this.orbit = orbit;
        this.framing = framing;
        this.angle = (this.orbit * Math.PI) / 2;
        this.distance = this.framing.distance ?? 480;
        this.target = [0, 15, 0];
        this.eye = this.framing.eyeY ?? (this.framing.level ? 15 : 45);
        this.camera = [
            -Math.sin(this.angle) * this.distance,
            this.eye,
            Math.cos(this.angle) * this.distance,
        ];
        this.forward = norm(sub(this.target, this.camera));
        this.right = norm(cross(this.forward, [0, 1, 0]));
        this.up = norm(cross(this.right, this.forward));
        this.focal =
            Math.min(this.height * 1.65, this.width * 0.94) *
            (this.framing.zoom ?? 1);
        this.faces = [];
        this.curves = [];
    }
    api(): {
        project: (p: Point3) => Vector;
        depth: (p: Point3) => number;
        polygon: (points: Point3[], color: string) => void;
        profile: (
            outline: Vector[],
            halfWidth: number,
            color: string,
            z?: number,
            options?: {
                widthAt?: (x: number, y: number) => number;
                bevel?: number;
                place?: (p: Point3) => Point3;
            },
        ) => void;
        oval: (center: Point3, radii: Point3, color: string) => void;
        rod: (a: Point3, b: Point3, r: number, color: string) => void;
        commands: (split?: {
            depth: number;
            part: 'far' | 'near';
        }) => DrawCommand[];
    } {
        return {
            project: this.project,
            depth: this.depth,
            polygon: this.polygon,
            profile: this.profile,
            oval: this.oval,
            rod: this.rod,
            commands: this.commands,
        };
    }
}
