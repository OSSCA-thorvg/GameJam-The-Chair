import { LEVEL } from '../game/level';
import type { GameEvent } from '../game/types';
import { EFFECT_STYLE } from './art';
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
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    r: number;
    landed: boolean;
};
export type WaterRipple = {
    x: number;
    age: number;
    life: number;
    r: number;
};
// Changing these values changes appearance only, never focus recovery or damage.
export function createEffects() {
    const F = LEVEL.floor;
    let specks: Speck[] = [];
    let waterDrops: WaterDrop[] = [];
    let waterRipples: WaterRipple[] = [];
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
            for (let i = 0; i < EFFECT_STYLE.splashCount; i++) {
                const side = event.side;
                waterDrops.push({ x: event.x + side * 10, y: F - 24, vx: side * (90 + (i % 8) * 29) + (i % 3 - 1) * 30, vy: -100 - (i % 7) * 32, life: 1.3 + (i % 4) * .18, r: 3 + i % 4, landed: false });
            }
        }
        if (event.type === 'water-step') {
            const dt = event.dt;
            for (const r of waterRipples) {
                r.age += dt;
            }
            waterRipples = waterRipples.filter(r => r.age < r.life);
            for (const z of waterDrops) {
                z.life -= dt;
                z.x += z.vx * dt;
                z.y += z.vy * dt;
                z.vy += 420 * dt;
                z.vx *= Math.exp(-.6 * dt);
                if (z.y > F + 4) {
                    z.y = F + 4;
                    if (!z.landed) {
                        z.landed = true;
                        waterRipples.push({ x: z.x, age: 0, life: .45 + z.r * .035, r: z.r });
                    }
                    z.vy = -Math.abs(z.vy) * .12;
                    z.vx *= .8;
                }
            }
            waterDrops = waterDrops.filter(z => z.life > 0);
        }
        if (event.type === 'speck') {
            specks.push({ x: event.x, y: F - 2, vx: event.vx, vy: -45, a: 0, life: .35, color: EFFECT_STYLE.speckColor });
        }
    }
    return { receive, snapshot: () => ({ specks, waterDrops, waterRipples, paperFace, glare, copierFlash, practiceBurst, saveFlash }) };
}
export type EffectsState = ReturnType<ReturnType<typeof createEffects>['snapshot']>;
