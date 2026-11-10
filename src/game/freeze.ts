import type { DeepReadonly } from './types';

// Freezes configuration at load time so nothing can change rules outside game state during a run.
export function deepFreeze<T>(value: T): DeepReadonly<T> {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        for (const child of Object.values(value)) deepFreeze(child);
        Object.freeze(value);
    }
    return value as DeepReadonly<T>;
}

// FNV-1a over the JSON form. Two builds with the same rules and levels share a version.
export function configHash(config: unknown): string {
    const text = JSON.stringify(config);
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}
