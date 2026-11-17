import * as Det from '../../../math';
import {
    STAGE_FOUR,
    skyHazards,
    skyHeadwind,
    skyPlatforms,
    skySurface,
    skyWind,
} from '../data';

import type { Player, Point } from '../../../types';
import type { SkyHazardKind, SkyPlatform, SkyState } from '../data';
// Offset parrot focus IDs to avoid collisions with floating gear IDs.
const ROBOT_FOCUS_ID = 1000000;
export type SkyInput = {
    sky: Readonly<SkyState>;
    p: Readonly<Player>;
    ground: boolean;
    coyote: number;
    jumpQ: number;
    checkpoint: number;
    time: number;
    direction: number;
    length: number;
    sprayBurst: number;
    sprayDir: Readonly<Point>;
};
export type SkyResult = Omit<
    SkyInput,
    'time' | 'direction' | 'length' | 'sky' | 'p' | 'sprayDir'
> & {
    sky: SkyState;
    p: Player;
    sprayDir: Point;
    speed: number | null;
    reached: boolean;
    fell: boolean;
    won: boolean;
    hit: { kind: SkyHazardKind; focusId: number } | null;
};
export function skyStep(input: SkyInput, dt: number): SkyResult {
    return new SkyTick(input, dt).run();
}
class SkyTick {
    private input!: SkyInput;
    private dt!: number;
    private sky!: SkyState;
    private p!: Player;
    private ground!: boolean;
    private coyote!: number;
    private jumpQ!: number;
    private checkpoint!: number;
    private sprayBurst!: number;
    private sprayDir!: {
        x: number;
        y: number;
    };
    private reached!: boolean;
    private fell!: boolean;
    private won!: boolean;
    private hit!: SkyResult['hit'];
    private direction!: number;
    private time!: number;
    private result!: (speed: number | null) => SkyResult;
    private targetAngle!: number;
    constructor(input: SkyInput, dt: number) {
        this.input = input;
        this.dt = dt;
    }
    run(): SkyResult {
        this.sky = { ...this.input.sky };
        this.p = { ...this.input.p };
        const { ground, coyote, jumpQ, checkpoint, sprayBurst } = this.input;
        this.ground = ground;
        this.coyote = coyote;
        this.jumpQ = jumpQ;
        this.checkpoint = checkpoint;
        this.sprayBurst = sprayBurst;
        this.sprayDir = { ...this.input.sprayDir };
        this.reached = false;
        this.fell = false;
        this.won = false;
        this.hit = null;
        const { direction, time } = this.input;
        this.direction = direction;
        this.time = time;
        this.result = (speed: number | null): SkyResult => ({
            sky: this.sky,
            p: this.p,
            ground: this.ground,
            coyote: this.coyote,
            jumpQ: this.jumpQ,
            checkpoint: this.checkpoint,
            sprayBurst: this.sprayBurst,
            sprayDir: this.sprayDir,
            speed,
            reached: this.reached,
            fell: this.fell,
            won: this.won,
            hit: this.hit,
        });
        this.sky.age += this.dt;
        this.jumpQ = Math.max(0, this.jumpQ - this.dt);
        if (this.sky.phase === 'reveal' || this.sky.phase === 'depth') {
            this.sprayBurst = 0.24;
            this.p.vx *= Det.exp(-4 * this.dt);
            this.p.vy = 0;
            this.p.y = -2338 + Det.sin(this.time) * 6;
            this.p.a *= Det.exp(-4 * this.dt);
            this.ground = false;
            this.p.x += (5045 - this.p.x) * (1 - Det.exp(-4 * this.dt));
            this.sprayDir = { x: 0, y: 1 };
            this.coyote = this.jumpQ = 0;
            if (
                this.sky.phase === 'reveal' &&
                this.sky.age >=
                    STAGE_FOUR.reveal.settle + STAGE_FOUR.reveal.turn
            ) {
                this.sky.phase = 'depth';
                this.sky.age = 0;
            }
            if (
                this.sky.phase === 'depth' &&
                this.sky.age >= STAGE_FOUR.reveal.hold
            ) {
                this.won = true;
            }
            return this.result(0);
        }
        this.advanceFlightPhase();
        this.p.x = Math.max(2250, Math.min(this.input.length - 80, this.p.x));
        this.targetAngle = this.ground
            ? (skyPlatforms(this.sky, this.time).find(
                  (item) => item.id === this.sky.standing,
              )?.angle ?? 0)
            : this.direction * 0.08;
        this.p.a += (this.targetAngle - this.p.a) * (1 - Det.exp(-5 * this.dt));
        this.p.w = 0;
        return this.result(Math.abs(this.p.vx));
    }
    private advanceFlightPhase() {
        if (this.sky.phase === 'arrival') {
            this.p.vx += this.direction * 220 * this.dt;
            this.p.vx *= Det.exp(-1.4 * this.dt);
            this.p.x += this.p.vx * this.dt;
            const hoverY = STAGE_FOUR.spawn.y + Det.sin(this.time * 1.3) * 6;
            this.p.vy +=
                ((hoverY - this.p.y) * 2 - this.p.vy) *
                (1 - Det.exp(-2.5 * this.dt));
            this.p.y += this.p.vy * this.dt;
            this.sprayBurst = 0.24;
            this.sprayDir = { x: -this.direction * 0.33, y: 1 };
            this.ground = false;
            if (this.p.x > 2640) {
                this.sky.phase = 'course';
                this.sky.age = 0;
            }
        } else {
            const before = skyPlatforms(this.sky, this.time - this.dt);
            const oldStanding = before.find(
                (platform) => platform.id === this.sky.standing,
            );
            const { standing, platforms, oldFoot, oldX } =
                this.updateCourseWind(oldStanding);
            const headwind =
                skyHeadwind(this.time) *
                (this.ground ? STAGE_FOUR.wind.ground : 1);
            this.applyFlightForces(headwind, standing, platforms, before, {
                oldFoot,
                oldX,
            });
            if (this.ground) {
                this.sky.airSprays = 0;
            }
            if (this.p.y > STAGE_FOUR.fallY) {
                Object.assign(this.p, STAGE_FOUR.checkpoints[this.checkpoint], {
                    vx: 0,
                    vy: 0,
                    a: 0,
                    w: 0,
                });
                this.fell = true;
                this.ground = false;
                this.sky.standing = null;
                this.sky.airSprays = 0;
                this.sky.knock = 0;
                this.sky.knockKind = null;
                if (this.checkpoint === 0) {
                    this.sky.phase = 'arrival';
                }
                this.sprayBurst = 0.24;
            }
        }
    }
    private applyFlightForces(
        headwind: number,
        standing: SkyPlatform | undefined,
        platforms: SkyPlatform[],
        before: SkyPlatform[],
        {
            oldFoot,
            oldX,
        }: {
            oldFoot: number;
            oldX: number;
        },
    ) {
        this.p.vx +=
            (this.direction * (this.ground ? 390 : 250) - headwind) * this.dt;
        this.integrateFlight(standing);
        this.sky.standing = null;
        if (this.p.vy >= 0) {
            for (const platform of platforms) {
                if (
                    Math.abs(platform.angle) > 0.55 ||
                    this.p.x < platform.x + 8 ||
                    this.p.x > platform.x + platform.width - 8
                ) {
                    continue;
                }
                const surface = skySurface(platform, this.p.x);
                const old =
                    before.find((item) => item.id === platform.id) ?? platform;
                if (
                    oldFoot > skySurface(old, oldX) + 9 ||
                    this.p.y + 28 < surface
                ) {
                    continue;
                }
                this.p.y = surface - 28;
                this.p.vy = 0;
                this.ground = true;
                this.sky.standing = platform.id;
                if (platform.id === 'rest' && this.checkpoint < 1) {
                    this.checkpoint = 1;
                    this.reached = true;
                }
                if (platform.id === 'finish') {
                    this.sky.phase = 'reveal';
                    this.sky.age = 0;
                    this.ground = false;
                }
                break;
            }
        }
    }
    private integrateFlight(standing: SkyPlatform | undefined) {
        if (this.ground && standing) {
            this.p.vx +=
                Det.sin(standing.angle) * STAGE_FOUR.rock.slide * this.dt;
        }
        this.p.vx *= Det.exp(-(this.ground ? 1.8 : 0.6) * this.dt);
        this.p.vx = Math.max(-300, Math.min(260, this.p.vx));
        this.p.vy = Math.min(
            580,
            this.p.vy + (this.p.x > 3970 ? 410 : 650) * this.dt,
        );
        this.p.x += this.p.vx * this.dt;
        this.p.y += this.p.vy * this.dt;
        if (this.sky.knock === 0) {
            const body = { x: this.p.x, y: this.p.y - 20 };
            const struck = skyHazards(this.time).find(
                (item) =>
                    Det.hypot(item.x - body.x, item.y - body.y) <
                    item.r + STAGE_FOUR.knock.reach,
            );
            if (struck) {
                const metal =
                    struck.kind === 'gear' || struck.robot !== undefined;
                this.hit = struck.robot
                    ? {
                          kind: 'gear',
                          focusId: ROBOT_FOCUS_ID + struck.focusId,
                      }
                    : { kind: struck.kind, focusId: struck.focusId };
                this.sky.knock = STAGE_FOUR.knock.cooldown;
                this.sky.knockKind = metal ? 'gear' : struck.kind;
                if (metal) {
                    this.p.vx = Math.min(this.p.vx, 0) - 230;
                    this.p.vy =
                        body.y < struck.y
                            ? Math.min(this.p.vy, 0) - 140
                            : Math.max(this.p.vy, 0) + 120;
                } else {
                    this.p.vx =
                        Math.min(this.p.vx, 0) -
                        (struck.kind === 'paper' ? 210 : 240);
                    this.p.vy =
                        struck.kind === 'paper'
                            ? Math.min(this.p.vy, -150)
                            : Math.max(this.p.vy, 0) + 170;
                }
            }
        }
        this.ground = false;
    }
    private updateCourseWind(oldStanding: SkyPlatform | undefined) {
        if (
            this.sky.lift > 0 ||
            this.sky.standing === 'arrival-roof' ||
            this.checkpoint > 0
        ) {
            this.sky.lift = Math.min(1, this.sky.lift + this.dt * 0.45);
        }
        this.sky.knock = Math.max(0, this.sky.knock - this.dt);
        if (this.sky.knock === 0) {
            this.sky.knockKind = null;
        }
        const wind = skyWind(this.time);
        const targetTilt = -0.12 - (1 - wind) * 1.12;
        this.sky.signTilt +=
            ((this.sky.standing === 'wind-sign' ? -0.12 : targetTilt) -
                this.sky.signTilt) *
            Math.min(1, this.dt * 2);
        if (this.sky.standing === 'drawer-desk') {
            this.sky.drawer = Math.min(1, this.sky.drawer + this.dt * 1.5);
            const lean = (this.p.x - 4205) / 135;
            this.sky.deskTilt +=
                (lean * 0.16 - this.sky.deskTilt) * Math.min(1, this.dt * 3);
        } else {
            this.sky.deskTilt *= Det.exp(-this.dt);
        }
        const platforms = skyPlatforms(this.sky, this.time);
        const standing = platforms.find(
            (platform) => platform.id === this.sky.standing,
        );
        if (this.ground && oldStanding && standing) {
            const carried = standing.x - oldStanding.x;
            this.p.y +=
                skySurface(standing, this.p.x + carried) -
                skySurface(oldStanding, this.p.x);
            this.p.x += carried;
        }
        this.coyote = this.ground ? 0.12 : Math.max(0, this.coyote - this.dt);
        if (this.jumpQ > 0 && this.coyote > 0) {
            this.p.vy = -330;
            this.ground = false;
            this.coyote = 0;
            this.jumpQ = 0;
        }
        const oldFoot = this.p.y + 28;
        const oldX = this.p.x;
        return { standing, platforms, oldFoot, oldX };
    }
}
