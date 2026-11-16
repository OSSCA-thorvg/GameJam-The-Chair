
export type DeathShotKind = 'head' | 'focus';
export type DeathShot = { kind: DeathShotKind; age: number; done: boolean };

export const DEATH_SHOT = {
    head: { hit: 1.4, zoomIn: .3, hold: .55, zoomOut: .95, zoom: 2.6, burst: .75 },
    focus: { hit: 0, zoomIn: .45, hold: .85, zoomOut: .9, zoom: 3.2, burst: 0 },
} as const;

export function deathShotLength(kind: DeathShotKind) {
    const s = DEATH_SHOT[kind];
    return s.hit + s.zoomIn + s.hold + s.zoomOut;
}

const smooth = (u: number) => u * u * (3 - 2 * u);
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));

export function deathShotCloseness(shot: Readonly<DeathShot>) {
    const s = DEATH_SHOT[shot.kind];
    const age = shot.age - s.hit;
    if (age < 0) return 0;
    if (age < s.zoomIn) return 1 - (1 - age / s.zoomIn) ** 3;
    if (age < s.zoomIn + s.hold) return 1;
    return 1 - smooth(clamp01((age - s.zoomIn - s.hold) / s.zoomOut));
}

export function deathShotBurst(shot: Readonly<DeathShot>) {
    const s = DEATH_SHOT[shot.kind];
    const age = shot.age - s.hit;
    return s.burst > 0 && age >= 0 && age < s.burst ? age / s.burst : null;
}

type ShotInput = { stage: number; mode?: string };

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
        advance(dt: number) {
            if (!shot) return;
            const age = shot.age + dt;
            shot = { ...shot, age, done: age >= deathShotLength(shot.kind) };
        },
        snapshot: () => shot,
    };
}
