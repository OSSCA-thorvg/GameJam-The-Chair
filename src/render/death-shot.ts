// The close-up the camera takes when a run ends in stages one to four: on a head hit it pushes in on the worker's
// face as the "BONK!" lands, on a focus loss it pushes in on his eyes as they wander; either way it then eases back
// to the usual framing before the game-over panel shows. Presentation only: it watches snapshots, runs on its own
// clock (the game stops ticking once the run is over) and is never read by the game.

export type DeathShotKind = 'head' | 'focus';
export type DeathShot = { kind: DeathShotKind; age: number; done: boolean };

/**
 * Seconds from the start of the shot. A head hit first replays the last moments in slow motion and only then
 * strikes, at `hit` (the replay's length); a focus loss starts on the worker straight away.
 */
export const DEATH_SHOT = {
    head: { hit: 1.4, zoomIn: .3, hold: .55, zoomOut: .95, zoom: 2.6, burst: .75 },
    focus: { hit: 0, zoomIn: .45, hold: .85, zoomOut: .9, zoom: 3.2, burst: 0 },
} as const;

/** How long a shot lasts, from the hit through the push-in, the hold and the ease back. */
export function deathShotLength(kind: DeathShotKind) {
    const s = DEATH_SHOT[kind];
    return s.hit + s.zoomIn + s.hold + s.zoomOut;
}

const smooth = (u: number) => u * u * (3 - 2 * u);
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));

/** How far the camera has pushed in, 0 (usual framing) to 1 (full close-up). */
export function deathShotCloseness(shot: Readonly<DeathShot>) {
    const s = DEATH_SHOT[shot.kind];
    const age = shot.age - s.hit;
    if (age < 0) return 0;
    if (age < s.zoomIn) return 1 - (1 - age / s.zoomIn) ** 3;
    if (age < s.zoomIn + s.hold) return 1;
    return 1 - smooth(clamp01((age - s.zoomIn - s.hold) / s.zoomOut));
}

/** 0..1 through the "BONK!" burst at the moment of a head hit, or null when it is not showing. */
export function deathShotBurst(shot: Readonly<DeathShot>) {
    const s = DEATH_SHOT[shot.kind];
    const age = shot.age - s.hit;
    return s.burst > 0 && age >= 0 && age < s.burst ? age / s.burst : null;
}

type ShotInput = { stage: number; mode?: string };

/** Starts a shot when a run ends by head hit or focus loss (not in stage five) and clears it on the next attempt. */
export function createDeathShot() {
    let shot: DeathShot | null = null;
    let mode: string | null = null;
    let stage: number | null = null;
    return {
        observe(next: ShotInput) {
            if (next.mode === undefined) return;
            if (next.stage !== stage || next.mode === 'play' || next.mode === 'intro') shot = null;
            const kind: DeathShotKind | null = next.mode === 'impact' ? 'head' : next.mode === 'focuslost' ? 'focus' : null;
            if (kind && next.mode !== mode && next.stage !== 5) shot = { kind, age: 0, done: false };
            stage = next.stage;
            mode = next.mode;
        },
        /** Real time, so the shot finishes after the game has stopped ticking. */
        advance(dt: number) {
            if (!shot) return;
            const age = shot.age + dt;
            shot = { ...shot, age, done: age >= deathShotLength(shot.kind) };
        },
        snapshot: () => shot,
    };
}
