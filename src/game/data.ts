import type { DeepReadonly } from './types';

export function deepFreeze<T>(value: T): DeepReadonly<T> {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        for (const child of Object.values(value)) deepFreeze(child);
        Object.freeze(value);
    }
    return value as DeepReadonly<T>;
}

export function configHash(config: unknown): string {
    const text = JSON.stringify(config);
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

export function clonePlain<T>(value: T): T {
    if (Array.isArray(value)) return value.map(clonePlain) as T;
    if (value !== null && typeof value === 'object') {
        const copy: Record<string, unknown> = {};
        for (const key in value) {
            copy[key] = clonePlain((value as Record<string, unknown>)[key]);
        }
        return copy as T;
    }
    return value;
}
