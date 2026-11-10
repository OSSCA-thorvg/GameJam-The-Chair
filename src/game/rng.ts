// Pure seeded randomness. Streams live in game state so a saved state replays exactly.
// physics: anything that changes how the run plays out. cosmetic: looks only.
// Keeping them apart means a new visual flourish never shifts physics results.
export type RngStream = 'physics' | 'cosmetic';
export type Rng = Record<RngStream, number>;

function mix(x: number) {
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
    return (x ^ (x >>> 16)) >>> 0;
}

export function seedRng(seed: number): Rng {
    const base = seed >>> 0;
    return { physics: mix(base ^ 0x9e3779b9), cosmetic: mix(base ^ 0x85ebca6b) };
}

// mulberry32 step: returns [0, 1) and the next stream state.
export function nextRandom(state: number): { value: number; state: number } {
    const next = (state + 0x6d2b79f5) >>> 0;
    let r = Math.imul(next ^ (next >>> 15), next | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return { value: ((r ^ (r >>> 14)) >>> 0) / 4294967296, state: next };
}

// Draws from one stream and advances it in place.
export function random(rng: Rng, stream: RngStream): number {
    const { value, state } = nextRandom(rng[stream]);
    rng[stream] = state;
    return value;
}

export function randomUint32(rng: Rng, stream: RngStream): number {
    return Math.floor(random(rng, stream) * 0x100000000);
}
