import { EFFECT_STYLE } from './art';
import { WATER_GRAVITY, bucketMouth, pourFlow, pourLaunch } from './bucket';
import { createDeathShot } from './death-shot';
import { createKeyHints } from './key-hints';
import { createMeetingVisits } from './meeting-visits';
import { createPersonalBoxObserver } from './personal-box-motion';
import { LEVEL } from '../game/level';

import type { DeathShot } from './death-shot';
import type { HintKey } from './key-hints';
import type {
    PersonalBoxReaction,
    PersonalBoxInput,
} from './personal-box-motion';
import type { GameEvent } from '../game/types';
export { EFFECT_STYLE } from './art';
export type Speck = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    a: number;
    life: number;
    color: string;
};
export type WaterDrop = {
    kind: 'stream' | 'drop' | 'spray';
    chain: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    r: number;
    floor: number;
};
export type WaterRipple = {
    x: number;
    y: number;
    age: number;
    life: number;
    r: number;
    crown: boolean;
};
export type WaterPour = {
    x: number;
    side: number;
    age: number;
    chain: number;
    flowing: boolean;
    emit: number;
    seed: number;
};
export type WaterPuddle = {
    left: number;
    right: number;
    reachLeft: number;
    reachRight: number;
    wet: number;
};
export function createEffects(): Effects {
    return new EffectsRuntime().api();
}
export type EffectsState = {
    specks: Speck[];
    waterDrops: WaterDrop[];
    waterRipples: WaterRipple[];
    waterPour: WaterPour | null;
    waterPuddle: WaterPuddle | null;
    paperFace: number;
    glare: number;
    copierFlash: number;
    practiceBurst: number;
    saveFlash: number;
    personalBox: PersonalBoxReaction;
    keysTried: Readonly<Record<HintKey, boolean>>;
    meetingVisit: number;
    deathShot: DeathShot | null;
};
export type Effects = {
    receive: (event: GameEvent) => void;
    observe: (
        input: PersonalBoxInput &
            Partial<
                Parameters<ReturnType<typeof createMeetingVisits>['observe']>[0]
            > & {
                mode?: string;
            },
    ) => void;
    restorePersonalBox: (next: PersonalBoxReaction) => void;
    pressKey: (key: HintKey) => void;
    advance: (dt: number) => void;
    snapshot: () => EffectsState;
};
class EffectsRuntime {
    private personalBox!: {
        observe(input: PersonalBoxInput): void;
        snapshot: () => PersonalBoxReaction;
        restore(next: PersonalBoxReaction): void;
    };
    private keyHints!: {
        press(key: HintKey): void;
        observe(next: { stage: number }): void;
        snapshot: () => Readonly<Record<HintKey, boolean>>;
    };
    private meetingVisits!: {
        observe(next: {
            stage: number;
            corridor?: {
                room: {
                    kind: string;
                };
            };
        }): void;
        snapshot: () => number;
    };
    private deathShot!: {
        observe(next: { stage: number; mode?: string }): void;
        advance(dt: number): void;
        snapshot: () => DeathShot | null;
    };
    private F!: 420;
    private specks!: Speck[];
    private waterDrops!: WaterDrop[];
    private waterRipples!: WaterRipple[];
    private waterPour!: WaterPour | null;
    private waterPuddle!: WaterPuddle | null;
    private paperFace!: number;
    private glare!: number;
    private copierFlash!: number;
    private practiceBurst!: number;
    private saveFlash!: number;
    constructor() {
        this.personalBox = createPersonalBoxObserver();
        this.keyHints = createKeyHints();
        this.meetingVisits = createMeetingVisits();
        this.deathShot = createDeathShot();
        this.F = LEVEL.floor;
        this.specks = [];
        this.waterDrops = [];
        this.waterRipples = [];
        this.waterPour = null;
        this.waterPuddle = null;
        this.paperFace = 0;
        this.glare = 0;
        this.copierFlash = 0;
        this.practiceBurst = 0;
        this.saveFlash = 0;
    }
    private receive = (event: GameEvent) => {
        if (event.type === 'reset') {
            this.specks = [];
            this.waterDrops = [];
            this.waterRipples = [];
            this.waterPour = null;
            this.waterPuddle = null;
            this.paperFace = 0;
            this.glare = 0;
            this.copierFlash = 0;
            this.practiceBurst = 0;
            this.saveFlash = 0;
        }
        this.receiveCueEffects(event);
        if (event.type === 'speck') {
            this.specks.push({
                x: event.x,
                y: this.F - 2,
                vx: event.vx,
                vy: -45,
                a: 0,
                life: 0.35,
                color: EFFECT_STYLE.speckColor,
            });
        }
    };
    private random = () => {
        if (!this.waterPour) {
            return 0.5;
        }
        let t = (this.waterPour.seed = (this.waterPour.seed + 0x6d2b79f5) | 0);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    private emitWater = (dt: number) => {
        const pour = this.waterPour;
        if (!pour) {
            return;
        }
        pour.age += dt;
        const q = pourFlow(pour.age);
        const mouth = bucketMouth(pour.x, this.F, pour.side, pour.age);
        const [lx, ly] = mouth.lip;
        const ax = mouth.rim[0] - lx;
        const ay = mouth.rim[1] - ly;
        const spill = pourLaunch(pour.x, this.F, pour.side, pour.age);
        const spillSpeed = Math.hypot(spill.vx, spill.vy) || 1;
        const ox = spill.vx / spillSpeed;
        const oy = spill.vy / spillSpeed;
        const opening = 0.08 + 0.2 * q;
        if (q > 0.16) {
            if (!pour.flowing) {
                pour.chain++;
            }
            pour.flowing = true;
            pour.emit += dt * 110;
            while (pour.emit >= 1) {
                pour.emit--;
                const launch = pourLaunch(pour.x, this.F, pour.side, pour.age);
                this.waterDrops.push({
                    kind: 'stream',
                    chain: pour.chain,
                    x: launch.x,
                    y: launch.y,
                    vx: launch.vx,
                    vy: launch.vy,
                    life: 2,
                    r: 1.6 + Math.hypot(ax, ay) * opening * 0.42,
                    floor: this.F + 3,
                });
            }
        } else {
            pour.flowing = false;
        }
        if (this.random() < q * dt * 45) {
            const spin = (this.random() - 0.5) * 0.9;
            const speed = (50 + 140 * q) * (0.7 + this.random() * 0.6);
            const at = opening * this.random();
            this.waterDrops.push({
                kind: 'drop',
                chain: 0,
                x: lx + ax * at,
                y: ly + ay * at,
                vx: (ox * Math.cos(spin) - oy * Math.sin(spin)) * speed,
                vy: (ox * Math.sin(spin) + oy * Math.cos(spin)) * speed,
                life: 2,
                r: 1.3 + this.random() * 2.2,
                floor: this.F - 2 + this.random() * 11,
            });
        }
        const dribble = (pour.age - 0.95) / 1.2;
        if (
            dribble > 0 &&
            dribble < 1 &&
            this.random() < dt * 9 * (1 - dribble)
        ) {
            this.waterDrops.push({
                kind: 'drop',
                chain: 0,
                x: lx + pour.side * this.random() * 3,
                y: ly,
                vx: pour.side * (8 + this.random() * 20),
                vy: 10,
                life: 1.5,
                r: 1.2 + this.random() * 1.6,
                floor: this.F + this.random() * 6,
            });
        }
        if (pour.age > 2.3) {
            this.waterPour = null;
        }
    };
    private land = (z: WaterDrop) => {
        const speed = Math.hypot(z.vx, z.vy);
        const puddle = (this.waterPuddle ??= {
            left: z.x - 6,
            right: z.x + 6,
            reachLeft: z.x - 6,
            reachRight: z.x + 6,
            wet: 0,
        });
        puddle.reachLeft = Math.min(puddle.reachLeft, z.x - 8 - z.r * 2);
        puddle.reachRight = Math.max(puddle.reachRight, z.x + 8 + z.r * 2);
        puddle.wet = Math.min(
            1,
            puddle.wet + z.r * (z.kind === 'stream' ? 0.0035 : 0.002),
        );
        if (z.kind === 'spray') {
            if (this.random() < 0.25) {
                this.waterRipples.push({
                    x: z.x,
                    y: z.floor,
                    age: 0,
                    life: 0.3,
                    r: z.r,
                    crown: false,
                });
            }
            return;
        }
        this.spawnWaterRipple(z, speed);
    };
    private stepWater = (dt: number) => {
        this.emitWater(dt);
        for (const r of this.waterRipples) {
            r.age += dt;
        }
        this.waterRipples = this.waterRipples.filter((r) => r.age < r.life);
        const alive: WaterDrop[] = [];
        for (const z of this.waterDrops) {
            z.life -= dt;
            z.vy += WATER_GRAVITY * dt;
            if (z.kind !== 'stream') {
                z.vx *= Math.exp(-0.5 * dt);
            }
            z.x += z.vx * dt;
            z.y += z.vy * dt;
            if (z.y >= z.floor) {
                z.y = z.floor;
                this.land(z);
            } else if (z.life > 0) {
                alive.push(z);
            }
        }
        this.waterDrops = alive.slice(-420);
        if (this.waterPuddle) {
            const p = this.waterPuddle;
            p.reachLeft -= dt * 4;
            p.reachRight += dt * 4;
            p.left -= Math.min(
                p.left - p.reachLeft,
                dt * (40 + (p.left - p.reachLeft) * 4),
            );
            p.right += Math.min(
                p.reachRight - p.right,
                dt * (40 + (p.reachRight - p.right) * 4),
            );
        }
    };
    private observe = (
        input: Parameters<Effects['observe']>[0] & {
            mode?: string;
        },
    ) => {
        this.keyHints.observe(input);
        this.meetingVisits.observe(input);
        this.deathShot.observe(input);
        this.personalBox.observe(input);
    };
    private receiveCueEffects(event: GameEvent) {
        if (event.type === 'volley') {
            this.copierFlash = EFFECT_STYLE.copierFlashDuration;
        }
        if (event.type === 'cue' && event.id === 'practice-cleared') {
            this.practiceBurst = 1.3;
        }
        if (event.type === 'cue' && event.id === 'checkpoint') {
            this.saveFlash = 1.5;
        }
        if (event.type === 'tick') {
            this.practiceBurst = Math.max(0, this.practiceBurst - event.dt);
            this.saveFlash = Math.max(0, this.saveFlash - event.dt);
            this.copierFlash = Math.max(0, this.copierFlash - event.dt);
            this.paperFace = Math.max(0, this.paperFace - event.dt);
            this.glare = Math.max(0, this.glare - event.dt);
        }
        if (event.type === 'cue' && event.id === 'paper-hit') {
            this.paperFace = EFFECT_STYLE.paperDuration;
        }
        if (event.type === 'light-contact') {
            this.glare = EFFECT_STYLE.glareDuration;
        }
        if (event.type === 'particles-step') {
            const dt = event.dt;
            for (const z of this.specks) {
                z.life -= dt;
                z.x += z.vx * dt;
                z.y += z.vy * dt;
                z.vy += 300 * dt;
                z.a += dt * 3;
            }
            this.specks = this.specks.filter((z) => z.life > 0).slice(-60);
        }
        if (event.type === 'water-splash') {
            this.waterPour = {
                x: event.x,
                side: event.side,
                age: 0,
                chain: 0,
                flowing: false,
                emit: 0,
                seed: 0x9e3779b9 ^ Math.round(event.x),
            };
            this.waterPuddle = null;
        }
        if (event.type === 'water-step') {
            this.stepWater(event.dt);
        }
    }
    private spawnWaterRipple(z: WaterDrop, speed: number) {
        const ring =
            z.kind === 'drop' ? this.random() < 0.2 : this.random() < 0.08;
        const crown = z.kind === 'stream' && z.r > 5.5 && this.random() < 0.07;
        if (ring || crown) {
            this.waterRipples.push({
                x: z.x,
                y: z.floor,
                age: 0,
                life: crown ? 0.38 : 0.45 + z.r * 0.04,
                r: z.r,
                crown,
            });
        }
        const splashes =
            speed < 170
                ? 0
                : z.kind === 'stream'
                  ? (this.random() < 0.55 ? 1 : 0) +
                    (z.r > 6 && this.random() < 0.4 ? 1 : 0)
                  : this.random() < 0.4
                    ? 1
                    : 0;
        for (let i = 0; i < splashes; i++) {
            const kick = Math.min(1, speed / 380);
            this.waterDrops.push({
                kind: 'spray',
                chain: 0,
                x: z.x,
                y: z.floor - 1,
                vx: z.vx * 0.3 + (this.random() - 0.5) * 150,
                vy: -(70 + this.random() * 170) * kick,
                life: 1,
                r: 0.8 + this.random() * 1.4,
                floor: z.floor + this.random() * 4,
            });
        }
    }
    api(): Effects {
        return {
            receive: this.receive,
            observe: this.observe,
            restorePersonalBox: this.apiRestorePersonalBox,
            pressKey: this.apiPressKey,
            advance: this.apiAdvance,
            snapshot: this.apiSnapshot,
        };
    }
    private apiRestorePersonalBox = (next: PersonalBoxReaction) => {
        return this.personalBox.restore(next);
    };
    private apiPressKey = (key: HintKey) => {
        return this.keyHints.press(key);
    };
    private apiAdvance = (dt: number) => {
        return this.deathShot.advance(dt);
    };
    private apiSnapshot = () => {
        return {
            specks: this.specks,
            waterDrops: this.waterDrops,
            waterRipples: this.waterRipples,
            waterPour: this.waterPour,
            waterPuddle: this.waterPuddle,
            paperFace: this.paperFace,
            glare: this.glare,
            copierFlash: this.copierFlash,
            practiceBurst: this.practiceBurst,
            saveFlash: this.saveFlash,
            personalBox: this.personalBox.snapshot(),
            keysTried: this.keyHints.snapshot(),
            meetingVisit: this.meetingVisits.snapshot(),
            deathShot: this.deathShot.snapshot(),
        };
    };
}
