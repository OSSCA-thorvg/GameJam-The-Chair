import { basinCloudSeeds, orbitCloudBank, orbitSky } from './atmosphere';
import { earthSkyBottom, orbitEarth } from './earth';
import {
    endingChairLights,
    endingFade,
    endingLaptopScreen,
    endingLaptopText,
    endingNebula,
    endingSignal,
} from './ending';
import { orbitEdgePuffs, orbitSlipstream, orbitSpeedLines } from './flight';
import { inOpacity, orbitHeights, orbitHighSky, orbitShadow } from './heights';
import { orbitReaction } from './reaction';
import {
    orbitSatelliteLight,
    satelliteChairGlow,
    satelliteGlare,
    satelliteLitChair,
    satelliteLightWarmth,
    satelliteSpots,
} from './satellite-light';
import { orbitViewfinder } from './viewfinder';
import {
    ORBIT_WATCH,
    orbitBeacon,
    orbitCloudGlints,
    orbitWatchers,
    orbitWatchGlow,
} from './watch';
import { gearAt } from '../../../game/stages/orbit/course/decide';
import { STAGE_FIVE as C } from '../../../game/stages/orbit/data';
import { ATTENDANCE, attendanceBubble } from '../shared/attendance-bubble';
import { createSkyProjection, placedProjection } from '../shared/projection';
import { skyDeparture } from '../sky/departure';
import { endingChair } from '../sky/ending-art';

import type { CloudBankOptions } from './atmosphere';
import type { EarthCamera } from './earth';
import type { OrbitEndingState } from './ending';
import type { Aim } from './satellite-light';
import type { LampState } from './watch';
import type { RenderCtx } from '../../context';
import type { DrawCommand, Vector } from '../../types';
import type { SkyProjection, Point3 } from '../shared/projection';
export type OrbitShot = {
    since: number;
    travel: number;
    p: { x: number; y: number; vx: number; vy: number; a: number };
    speed: number;
    push: number;
    turn: number;
    clock: number;
    spray: number;
    rocket?: number;
    arrival: number;
    departure: number;
    basin: number;
    entry: number;
    aims?: readonly Aim[];
    hitStop?: number;
    ending: OrbitEndingState;
};
const SHOULDER = 0.38;
const READ = { zoom: 0.7, offsetX: 0.3, centerY: 0.24 };
const smooth = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
};
const CAMERA = {
    follow: 0.15,
    lag: 0.3,
    distance: 960,
    pull: [0.04, 0.13, 0.24],
    kick: 0.1,
    kickTime: 0.6,
    air: [0.5, 0.78, 1],
    shake: [0, 0, 1.6],
};
function gearFeel(travel: number, speed: number) {
    const gear = gearAt(travel);
    const at = (list: readonly number[]) => list[gear.index];
    const since =
        gear.index > 0 ? (travel - gear.from) / Math.max(60, speed) : Infinity;
    const kick =
        since < CAMERA.kickTime
            ? Math.sin((Math.PI * since) / CAMERA.kickTime)
            : 0;
    return {
        top: gear.maxSpeed,
        pull: at(CAMERA.pull),
        air: at(CAMERA.air),
        shake: at(CAMERA.shake),
        kick,
    };
}
const NO_AIMS: readonly Aim[] = C.satelliteLight.beams.map(() => ({
    x: 0,
    y: 0,
}));
const screen = (ctx: RenderCtx): Array<[number, number]> => [
    [0, 0],
    [ctx.W, 0],
    [ctx.W, ctx.H],
    [0, ctx.H],
];
function backdrop(
    ctx: RenderCtx,
    shot: OrbitShot,
    clouds: number,
    earth: EarthCamera,
    spin: number,
) {
    const heights = orbitHeights(shot.travel);
    if (heights.air < 1) {
        if (shot.basin < 1) {
            ctx.commands.push({
                kind: 'path',
                points: screen(ctx),
                fill: {
                    from: [0, 0],
                    to: [0, ctx.H],
                    stops: [
                        [0, ctx.rgba('#678eae')],
                        [1, ctx.rgba('#b7ced1')],
                    ],
                },
            });
            inOpacity(
                ctx,
                { key: 'orbit-basin-sky', opacity: shot.basin },
                () => orbitSky(ctx),
            );
        } else {
            orbitSky(ctx);
        }
    }
    if (clouds > 0) {
        ctx.commands.push({
            kind: 'path',
            points: screen(ctx),
            layer: { key: 'orbit-sunlight' },
            fill: {
                from: [ctx.W * 0.75, ctx.H * 0.15],
                to: [ctx.W, ctx.H],
                radius: ctx.W * 0.8,
                stops: [
                    [0, ctx.rgba('#fff2eb', 0.16 * clouds)],
                    [1, ctx.rgba('#fff2eb', 0)],
                ],
            },
        });
    }
    const skyBottom =
        shot.ending.parked && heights.air >= 1
            ? earthSkyBottom(shot.travel, earth, 0, ctx.W, {
                  height: ctx.H,
                  spin,
              })
            : ctx.H;
    orbitHighSky(ctx, heights, 0, spin, skyBottom);
    endingNebula(ctx, shot.ending.wide, spin, skyBottom);
    const horizon = orbitEarth(ctx, shot.travel, earth, 0, {
        strength: heights.air,
        night: heights.shadow * (1 - shot.ending.wide),
        spin,
    });
    return { heights, horizon };
}
export function drawOrbitShot(ctx: RenderCtx, shot: OrbitShot): void {
    return new OrbitDrawing(ctx, shot).run();
}

function prepareOrbitProjections(
    point: (x: number, y: number, z: number) => Point3,
    sink: number,
    mix: (a: number, b: number, k: number) => number,
    p: {
        x: number;
        y: number;
        vx: number;
        vy: number;
        a: number;
    },
    {
        wide,
        ending,
        edge,
        cam,
        ctx,
        view,
        since,
        look,
        clouds,
        travel,
    }: {
        wide: number;
        ending: OrbitEndingState;
        edge: number;
        cam: {
            x: number;
            y: number;
        };
        ctx: RenderCtx;
        view: SkyProjection;
        since: number;
        look: number;
        clouds: number;
        travel: number;
    },
) {
    const satelliteLightPoint = (x: number, y: number, z: number) =>
        point(x, y - sink, z);
    const bank = mix(p.a * 0.65, 0, wide);
    const pitch =
        mix(Math.max(-0.2, Math.min(0.2, p.vy / 900)), 0, wide) +
        0.32 * ending.recline;
    const swivel = ending.swivel * Math.PI;
    const shudder = edge * 2.6;
    const pivot = -25;
    const offset: Point3 = [
        0,
        -sink + p.y - cam.y + Math.sin(ctx.t * 61) * shudder,
        p.x - cam.x + Math.cos(ctx.t * 53) * shudder,
    ];
    const chair = placedProjection(view, ([x0, y, z0]) => {
        const x = x0 * Math.cos(swivel) - z0 * Math.sin(swivel);
        const z = x0 * Math.sin(swivel) + z0 * Math.cos(swivel);
        const ly = y - pivot;
        const x1 = x * Math.cos(pitch) - ly * Math.sin(pitch);
        const y1 = x * Math.sin(pitch) + ly * Math.cos(pitch);
        return [
            x1 + offset[0],
            y1 * Math.cos(bank) - z * Math.sin(bank) + pivot + offset[1],
            y1 * Math.sin(bank) + z * Math.cos(bank) + offset[2],
        ];
    });
    const options: CloudBankOptions =
        since < 0
            ? {
                  anchor: cam,
                  turn: look,
                  nearDepth: 1100,
                  unwrapped: true,
                  only: basinCloudSeeds(
                      ctx,
                      createSkyProjection(ctx.W, ctx.H, 1, {
                          centerY: 0.37,
                          level: true,
                      }),
                      0,
                      cam,
                  ),
              }
            : { anchor: cam, turn: look };
    const cloudsShown = clouds >= 0.02;
    if (cloudsShown) {
        orbitCloudBank(ctx, view, travel, false, { ...options, alpha: clouds });
    }
    return { satelliteLightPoint, chair, pivot, cloudsShown, options };
}
function prepareOrbitCamera(
    feel: {
        top: number;
        pull: number;
        air: number;
        shake: number;
        kick: number;
    },
    rush: number,
    blend: number,
    wide: number,
    {
        travel,
        ending,
        mix,
        turn,
        ctx,
        push,
        fast,
        p,
    }: {
        travel: number;
        ending: OrbitEndingState;
        mix: (a: number, b: number, k: number) => number;
        turn: number;
        ctx: RenderCtx;
        push: number;
        fast: number;
        p: {
            x: number;
            y: number;
            vx: number;
            vy: number;
            a: number;
        };
    },
) {
    const pull = (feel.pull * rush + CAMERA.kick * feel.kick) * blend;
    const distance =
        (480 + (CAMERA.distance - 480) * blend) * (1 + pull) * (1 - wide) +
        (480 + 210 + 150 * rush) * wide;
    const shake = feel.shake * rush * blend;
    const climb = orbitHeights(travel);
    const lookDown =
        ((14 * climb.air + 12 * climb.space + 4 * wide) * Math.PI) / 180;
    const focus = ending.focus;
    const near = mix(distance, 170, focus);
    const framing = {
        centerY:
            mix(
                0.5 -
                    0.13 * turn +
                    Math.sin(ctx.t * 47) * (0.002 * push + 0.003 * shake),
                0.68,
                focus,
            ) +
            READ.centerY * ending.read,
        eyeY: 45 - 30 * turn + near * Math.tan(lookDown) + 35 * focus,
        distance: near,
        zoom:
            mix(
                mix(mix(1 - 0.08 * fast, 0.72, wide), 1.15, ending.recline),
                1.7,
                focus,
            ) *
            (1 + READ.zoom * ending.read),
        roll: mix(p.a * 0.35, 0, wide),
        offsetX:
            Math.sin(ctx.t * 53) * (1.2 * push + shake) +
            ctx.W * READ.offsetX * ending.read,
    };
    const spin = ending.spin * 4;
    const view = createSkyProjection(
        ctx.W,
        ctx.H,
        turn + spin + SHOULDER * focus,
        framing,
    );
    const earth: EarthCamera = {
        cx: ctx.W / 2 + framing.offsetX,
        cy: ctx.H * framing.centerY,
        focal: Math.min(ctx.H * 1.65, ctx.W * 0.94) * framing.zoom,
        roll: framing.roll,
        pitch: lookDown,
    };
    return { spin, focus, earth, distance, view };
}
class OrbitDrawing {
    private ctx!: RenderCtx;
    private shot!: OrbitShot;
    private travel!: number;
    private p!: {
        x: number;
        y: number;
        vx: number;
        vy: number;
        a: number;
    };
    private turn!: number;
    private ending!: OrbitEndingState;
    private since!: number;
    private clouds!: number;
    private wide!: number;
    private blend!: number;
    private mix!: (a: number, b: number, k: number) => number;
    private look!: 0;
    private follow!: (v: number, dv: number) => number;
    private cam!: {
        x: number;
        y: number;
    };
    private over!: {
        x: number;
        y: number;
    };
    private edge!: number;
    private feel!: {
        top: number;
        pull: number;
        air: number;
        shake: number;
        kick: number;
    };
    private fast!: number;
    private push!: number;
    private rush!: number;
    private spin!: number;
    private focus!: number;
    private earth!: EarthCamera;
    private distance!: number;
    private view!: SkyProjection;
    private turned!: number;
    private heights!: {
        air: number;
        space: number;
        shadow: number;
    };
    private horizon!: Vector | undefined;
    private facing!: {
        cos: number;
        sin: number;
    };
    private point!: (x: number, y: number, z: number) => Point3;
    private sink!: number;
    private satelliteLightPoint!: (x: number, y: number, z: number) => Point3;
    private chair!: SkyProjection;
    private pivot!: number;
    private cloudsShown!: boolean;
    private options!: CloudBankOptions;
    private lamps!: Array<{
        at: Point3;
        state: LampState;
        glow?: number;
        rec?: boolean;
    }>;
    private split!: {
        depth: number;
        part: 'far';
    };
    private plane!: (x: number, y: number) => Vector;
    private lightShown!: number;
    private air!: {
        behind: DrawCommand[];
        over: DrawCommand[];
    };
    private light!: {
        warmth: number;
        toward: {
            x: number;
            y: number;
        };
    };
    private pulse!: number;
    private laptopBob!: number;
    private head!: Vector;
    constructor(ctx: RenderCtx, shot: OrbitShot) {
        this.ctx = ctx;
        this.shot = shot;
    }
    run(): void {
        this.prepareScene();
        this.drawAtmosphere();
        this.drawRiderAndEnding();
    }
    private prepareCameraMotion(
        p: {
            x: number;
            y: number;
            vx: number;
            vy: number;
            a: number;
        },
        turn: number,
        ending: OrbitEndingState,
        since: number,
    ) {
        this.p = p;
        this.turn = turn;
        this.ending = ending;
        this.since = since;
        this.clouds = 1 - orbitHeights(this.travel).air;
        this.wide = this.ending.wide;
        this.blend = smooth(this.shot.entry);
        this.mix = (a: number, b: number, k: number) => a + (b - a) * k;
        this.look = 0;
        this.follow = (v: number, dv: number) =>
            CAMERA.follow * (v - dv * CAMERA.lag);
        this.cam = {
            x: this.mix(
                this.follow(this.p.x, this.p.vx),
                this.p.x,
                this.ending.centre,
            ),
            y: this.mix(
                this.follow(this.p.y, this.p.vy),
                this.p.y,
                this.ending.centre,
            ),
        };
        this.over = {
            x:
                Math.max(0, Math.abs(this.p.x) - C.bounds.x + 20) *
                Math.sign(this.p.x),
            y:
                Math.max(0, Math.abs(this.p.y) - C.bounds.y + 20) *
                Math.sign(this.p.y),
        };
        this.edge =
            smooth(
                Math.hypot(this.over.x, this.over.y) / (C.steer.overshoot + 20),
            ) *
            (1 - this.ending.centre);
        this.feel = gearFeel(this.travel, this.shot.speed);
        this.fast =
            smooth((this.shot.speed - C.cruise) / (this.feel.top - C.cruise)) *
            this.feel.air *
            (1 - this.ending.centre);
        this.push = this.shot.push * this.blend;
        this.rush =
            smooth(
                (this.shot.speed - 0.4 * C.cruise) /
                    (this.feel.top - 0.4 * C.cruise),
            ) *
            (1 - this.ending.centre);
    }
    private drawRiderAndEnding() {
        this.light =
            this.since >= 0 && this.wide <= 0
                ? satelliteLightWarmth(
                      this.shot.aims ?? NO_AIMS,
                      this.p,
                      this.travel,
                  )
                : { warmth: 0, toward: { x: 0, y: 0 } };
        this.pulse = Math.sin(this.ctx.t * 9) * 0.5 + 0.5;
        this.laptopBob = endingChair(
            satelliteLitChair(
                this.chair,
                this.light.warmth >= 1
                    ? 0.62 + 0.18 * this.pulse
                    : this.light.warmth * 0.7,
            ),
            this.shot.clock,
            this.shot.spray * (1 + 0.8 * this.rush * this.push),
            this.shot.arrival,
            {
                loose: this.ending.loose,
                rest: this.ending.rest,
                rocket: this.shot.rocket,
            },
        );
        endingLaptopScreen(this.chair, this.ending, this.laptopBob);
        orbitEdgePuffs(this.chair, this.edge, this.over, this.ctx.t);
        satelliteChairGlow(this.ctx, this.chair, this.light, this.pulse);
        this.ctx.commands.push(
            ...this.view.commands({ ...this.split, part: 'near' }),
        );
        this.ctx.commands.push(...this.air.over);
        satelliteGlare(
            this.ctx,
            this.chair.project([0, 15, 0]),
            this.light.warmth,
            this.pulse,
        );
        orbitViewfinder(
            this.ctx,
            this.plane,
            this.light.warmth >= 1 ? 1 : 0,
            this.lightShown * this.blend * (1 - this.heights.shadow),
            this.shot.hitStop ?? 0,
        );
        if (this.shot.hitStop) {
            this.ctx.commands.push({
                kind: 'path',
                points: screen(this.ctx),
                fill:
                    '#ffffff' +
                    Math.round(
                        0.32 * this.shot.hitStop * this.shot.hitStop * 255,
                    )
                        .toString(16)
                        .padStart(2, '0'),
                layer: { key: 'orbit-shutter' },
            });
        }
        endingLaptopText(this.ctx, this.chair, this.ending, this.laptopBob);
        endingChairLights(this.ctx, this.chair, this.ending);
        this.head = this.chair.project([4, 70, 0]);
        orbitReaction(
            this.ctx,
            this.head,
            this.since,
            this.since >= 0 && this.light.warmth >= 1,
        );
        if (this.ending.parked) {
            endingSignal(this.ctx, this.head, this.ending);
        } else {
            attendanceBubble(this.ctx, this.head, this.since + ATTENDANCE.lead);
        }
        endingFade(this.ctx, this.ending);
    }
    private drawAtmosphere() {
        if (this.turn >= ORBIT_WATCH.glintsFrom) {
            orbitCloudGlints(this.ctx, this.clouds);
        }
        if (this.turn >= ORBIT_WATCH.beacon.appear) {
            orbitBeacon(this.ctx, this.view, this.point);
        }
        this.lamps =
            this.turn > 0
                ? orbitWatchers(
                      this.view,
                      this.point,
                      this.travel,
                      this.ctx.t,
                      {
                          shown: this.turn,
                          satelliteLightPoint: this.satelliteLightPoint,
                          satellites: satelliteSpots(
                              this.shot.aims ?? NO_AIMS,
                              this.travel,
                              this.shot.speed,
                          ),
                      },
                  )
                : [];
        this.split = {
            depth: this.chair.depth([0, this.pivot, 0]) + 90,
            part: 'far' as const,
        };
        this.ctx.commands.push(...this.view.commands(this.split));
        orbitWatchGlow(this.ctx, this.view, this.lamps);
        this.plane = (x: number, y: number) =>
            this.view.project(this.satelliteLightPoint(x, y, this.travel));
        this.lightShown =
            smooth((this.turn - ORBIT_WATCH.satelliteAppear) / 0.3) *
            (1 - smooth(this.ending.centre * 4));
        orbitSatelliteLight(
            this.ctx,
            this.view,
            this.satelliteLightPoint,
            this.plane,
            {
                aims: this.shot.aims ?? NO_AIMS,
                travel: this.travel,
                speed: this.shot.speed,
                strength: this.lightShown,
            },
        );
        if (this.cloudsShown) {
            orbitCloudBank(this.ctx, this.view, this.travel, true, {
                ...this.options,
                alpha: this.clouds,
            });
        }
        if (this.heights.shadow > 0 && this.horizon) {
            orbitShadow(
                this.ctx,
                {
                    ...this.heights,
                    shadow: this.heights.shadow * (1 - this.wide),
                },
                this.horizon,
            );
        }
        skyDeparture(this.ctx, this.shot.departure);
        orbitSpeedLines(
            this.ctx,
            this.view.project(
                this.point(this.cam.x, this.cam.y, this.travel + 100000),
            ),
            this.fast * (1 - this.wide),
        );
        this.air = orbitSlipstream(
            this.ctx,
            this.chair,
            this.rush *
                this.feel.air *
                (0.35 + 0.65 * this.push) *
                (1 - this.wide),
        );
        this.ctx.commands.push(...this.air.behind);
    }
    private prepareScene() {
        const { travel, p, turn, ending, since } = this.shot;
        this.travel = travel;
        this.prepareCameraMotion(p, turn, ending, since);
        const { spin, focus, earth, distance, view } = prepareOrbitCamera(
            this.feel,
            this.rush,
            this.blend,
            this.wide,
            {
                travel: this.travel,
                ending: this.ending,
                mix: this.mix,
                turn: this.turn,
                ctx: this.ctx,
                push: this.push,
                fast: this.fast,
                p: this.p,
            },
        );
        this.spin = spin;
        this.focus = focus;
        this.earth = earth;
        this.distance = distance;
        this.view = view;
        this.turned =
            this.look + ((this.spin + SHOULDER * this.focus) * Math.PI) / 2;
        const { heights, horizon } = backdrop(
            this.ctx,
            this.shot,
            this.clouds,
            this.earth,
            this.turned,
        );
        this.heights = heights;
        this.horizon = horizon;
        this.facing = { cos: Math.cos(this.look), sin: Math.sin(this.look) };
        this.point = (x: number, y: number, z: number): Point3 => {
            const across = x - this.cam.x;
            const ahead = z - this.travel;
            return [
                ahead * this.facing.cos + across * this.facing.sin,
                15 + y - this.cam.y,
                across * this.facing.cos - ahead * this.facing.sin,
            ];
        };
        this.sink =
            (((38 * this.turn * (1 - this.blend) + 72 * this.blend) *
                this.distance) /
                (480 + (CAMERA.distance - 480) * this.blend) /
                (1 - 0.08 * this.fast * (1 - this.wide))) *
            (1 - this.focus);
        const { satelliteLightPoint, chair, pivot, cloudsShown, options } =
            prepareOrbitProjections(this.point, this.sink, this.mix, this.p, {
                wide: this.wide,
                ending: this.ending,
                edge: this.edge,
                cam: this.cam,
                ctx: this.ctx,
                view: this.view,
                since: this.since,
                look: this.look,
                clouds: this.clouds,
                travel: this.travel,
            });
        this.satelliteLightPoint = satelliteLightPoint;
        this.chair = chair;
        this.pivot = pivot;
        this.cloudsShown = cloudsShown;
        this.options = options;
    }
}
