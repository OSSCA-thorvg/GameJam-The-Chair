import { LEVEL } from '../game/level';
import type { GameEvent } from '../game/types';
import { EFFECT_STYLE } from './art';
import { bucketMouth, pourFlow } from './bucket';
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
    /** stream: part of the continuous pour; drop: a loose blob; spray: splash-back from the floor. */
    kind: 'stream' | 'drop' | 'spray';
    /** Stream particles with the same chain are drawn as one ribbon. */
    chain: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    r: number;
    /** Floor height where this particle meets the floor plane. */
    floor: number;
};
export type WaterRipple = {
    x: number;
    y: number;
    age: number;
    life: number;
    r: number;
    /** A heavy hit throws up a short crown sheet as well as a ring. */
    crown: boolean;
};
export type WaterPour = {
    x: number;
    side: number;
    age: number;
    chain: number;
    flowing: boolean;
    emit: number;
    /** Eased exit speed; a sudden jump would let new water overtake old and fold the stream. */
    speed: number;
    seed: number;
};
export type WaterPuddle = {
    left: number;
    right: number;
    reachLeft: number;
    reachRight: number;
    /** How much water has landed (0..1). */
    wet: number;
};
// Changing these values changes appearance only, never focus recovery or damage.
export function createEffects() {
    const F = LEVEL.floor;
    let specks: Speck[] = [];
    let waterDrops: WaterDrop[] = [];
    let waterRipples: WaterRipple[] = [];
    let waterPour: WaterPour | null = null;
    let waterPuddle: WaterPuddle | null = null;
    let paperFace = 0;
    let glare = 0;
    let copierFlash = 0;
    let practiceBurst = 0;
    let saveFlash = 0;
    function receive(event: GameEvent) {
        if (event.type === 'reset') {
            specks = [];
            waterDrops = [];
            waterRipples = [];
            waterPour = null;
            waterPuddle = null;
            paperFace = 0;
            glare = 0;
            copierFlash = 0;
            practiceBurst = 0;
            saveFlash = 0;
        }
        if (event.type === 'volley') {
            copierFlash = EFFECT_STYLE.copierFlashDuration;
        }
        if (event.type === 'cue' && event.id === 'practice-cleared') practiceBurst = 1.3;
        if (event.type === 'cue' && event.id === 'checkpoint') saveFlash = 1.5;
        if (event.type === 'tick') {
            practiceBurst = Math.max(0, practiceBurst - event.dt);
            saveFlash = Math.max(0, saveFlash - event.dt);
            copierFlash = Math.max(0, copierFlash - event.dt);
            paperFace = Math.max(0, paperFace - event.dt);
            glare = Math.max(0, glare - event.dt);
        }
        if (event.type === 'cue' && event.id === 'paper-hit') {
            paperFace = EFFECT_STYLE.paperDuration;
        }
        if (event.type === 'light-contact') {
            glare = EFFECT_STYLE.glareDuration;
        }
        if (event.type === 'particles-step') {
            const dt = event.dt;
            for (const z of specks) {
                z.life -= dt;
                z.x += z.vx * dt;
                z.y += z.vy * dt;
                z.vy += 300 * dt;
                z.a += dt * 3;
            }
            specks = specks.filter(z => z.life > 0).slice(-60);
        }
        if (event.type === 'water-splash') {
            waterPour = { x: event.x, side: event.side, age: 0, chain: 0, flowing: false, emit: 0, speed: 0, seed: 0x9e3779b9 ^ Math.round(event.x) };
            waterPuddle = null;
        }
        if (event.type === 'water-step') {
            stepWater(event.dt);
        }
        if (event.type === 'speck') {
            specks.push({ x: event.x, y: F - 2, vx: event.vx, vy: -45, a: 0, life: .35, color: EFFECT_STYLE.speckColor });
        }
    }
    // Deterministic noise so previews replay the same pour every time.
    function random() {
        if (!waterPour) return .5;
        let t = waterPour.seed = (waterPour.seed + 0x6d2b79f5) | 0;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    function emitWater(dt: number) {
        const pour = waterPour;
        if (!pour) return;
        pour.age += dt;
        const q = pourFlow(pour.age);
        const mouth = bucketMouth(pour.x, F, pour.side, pour.age);
        const [lx, ly] = mouth.lip;
        const ax = mouth.rim[0] - lx;
        const ay = mouth.rim[1] - ly;
        const [ox, oy] = mouth.out;
        const opening = .08 + .2 * q;
        pour.speed += (110 + 230 * q - pour.speed) * Math.min(1, dt * 5);
        if (q > .16) {
            if (!pour.flowing) pour.chain++;
            pour.flowing = true;
            pour.emit += dt * 110;
            while (pour.emit >= 1) {
                pour.emit--;
                const at = opening * (.45 + random() * .1);
                const speed = pour.speed + random() * 6;
                waterDrops.push({
                    kind: 'stream', chain: pour.chain,
                    x: lx + ax * at, y: ly + ay * at,
                    vx: ox * speed, vy: oy * speed - 10,
                    life: 2, r: 1.6 + Math.hypot(ax, ay) * opening * .42, floor: F + 3,
                });
            }
        } else {
            pour.flowing = false;
        }
        if (random() < q * dt * 70) {
            const spin = (random() - .5) * .9;
            const speed = (60 + 210 * q) * (.7 + random() * .65);
            const at = opening * random();
            waterDrops.push({
                kind: 'drop', chain: 0,
                x: lx + ax * at, y: ly + ay * at,
                vx: (ox * Math.cos(spin) - oy * Math.sin(spin)) * speed,
                vy: (ox * Math.sin(spin) + oy * Math.cos(spin)) * speed,
                life: 2, r: 1.3 + random() * 2.2, floor: F - 2 + random() * 11,
            });
        }
        // The last of the water dribbles off the rim.
        const dribble = (pour.age - .95) / 1.2;
        if (dribble > 0 && dribble < 1 && random() < dt * 9 * (1 - dribble)) {
            waterDrops.push({
                kind: 'drop', chain: 0, x: lx + pour.side * random() * 3, y: ly,
                vx: pour.side * (8 + random() * 20), vy: 10, life: 1.5, r: 1.2 + random() * 1.6, floor: F + random() * 6,
            });
        }
        if (pour.age > 2.3) waterPour = null;
    }

    function land(z: WaterDrop) {
        const speed = Math.hypot(z.vx, z.vy);
        const puddle = waterPuddle ??= { left: z.x - 6, right: z.x + 6, reachLeft: z.x - 6, reachRight: z.x + 6, wet: 0 };
        puddle.reachLeft = Math.min(puddle.reachLeft, z.x - 8 - z.r * 2);
        puddle.reachRight = Math.max(puddle.reachRight, z.x + 8 + z.r * 2);
        puddle.wet = Math.min(1, puddle.wet + z.r * (z.kind === 'stream' ? .0035 : .002));
        if (z.kind === 'spray') {
            if (random() < .25) waterRipples.push({ x: z.x, y: z.floor, age: 0, life: .3, r: z.r, crown: false });
            return;
        }
        const ring = z.kind === 'drop' ? random() < .3 : random() < .1;
        const crown = z.kind === 'stream' && z.r > 5.5 && random() < .07;
        if (ring || crown) {
            waterRipples.push({ x: z.x, y: z.floor, age: 0, life: crown ? .38 : .45 + z.r * .04, r: z.r, crown });
        }
        const splashes = speed < 150 ? 0 : z.kind === 'stream' ? (random() < .55 ? 1 : 0) + (z.r > 6 && random() < .4 ? 1 : 0) : (random() < .4 ? 1 : 0);
        for (let i = 0; i < splashes; i++) {
            const kick = Math.min(1, speed / 380);
            waterDrops.push({
                kind: 'spray', chain: 0, x: z.x, y: z.floor - 1,
                vx: z.vx * .3 + (random() - .5) * 150, vy: -(70 + random() * 170) * kick,
                life: 1, r: .8 + random() * 1.4, floor: z.floor + random() * 4,
            });
        }
    }

    function stepWater(dt: number) {
        emitWater(dt);
        for (const r of waterRipples) r.age += dt;
        waterRipples = waterRipples.filter(r => r.age < r.life);
        const alive: WaterDrop[] = [];
        for (const z of waterDrops) {
            z.life -= dt;
            z.vy += 980 * dt;
            if (z.kind !== 'stream') z.vx *= Math.exp(-.5 * dt);
            z.x += z.vx * dt;
            z.y += z.vy * dt;
            if (z.y >= z.floor) {
                z.y = z.floor;
                land(z);
            } else if (z.life > 0) {
                alive.push(z);
            }
        }
        waterDrops = alive.slice(-420);
        if (waterPuddle) {
            const p = waterPuddle;
            // The edge creeps after the water, fast at first and slower as it thins out.
            p.reachLeft -= dt * 4;
            p.reachRight += dt * 4;
            p.left -= Math.min(p.left - p.reachLeft, dt * (40 + (p.left - p.reachLeft) * 4));
            p.right += Math.min(p.reachRight - p.right, dt * (40 + (p.reachRight - p.right) * 4));
        }
    }

    return { receive, snapshot: () => ({ specks, waterDrops, waterRipples, waterPour, waterPuddle, paperFace, glare, copierFlash, practiceBurst, saveFlash }) };
}
export type EffectsState = ReturnType<ReturnType<typeof createEffects>['snapshot']>;
