type Data = Record<string, unknown>;

export function isRecord(value: unknown): value is Data {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function record(value: unknown, path: string): Data {
    if (!isRecord(value)) throw new Error(`${path} must be an object`);
    return value;
}

export function exact(data: Data, allowed: readonly string[], path: string) {
    const unexpected = Object.keys(data).find(key => !allowed.includes(key));
    if (unexpected) throw new Error(`${path}.${unexpected} is not allowed`);
}

export function array(value: unknown, path: string, max: number): unknown[] {
    if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
    if (value.length > max) throw new Error(`${path} is too large`);
    return value;
}

export function finite(value: unknown, path: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${path} must be a finite number`);
    return value;
}

export function integer(value: unknown, path: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
    const number = finite(value, path);
    if (!Number.isSafeInteger(number) || number < min || number > max) throw new Error(`${path} must be an integer from ${min} to ${max}`);
    return number;
}

export function boolean(value: unknown, path: string): boolean {
    if (typeof value !== 'boolean') throw new Error(`${path} must be a boolean`);
    return value;
}

export function string(value: unknown, path: string, max = 200): string {
    if (typeof value !== 'string' || value.length > max) throw new Error(`${path} must be a string of at most ${max} characters`);
    return value;
}

export function choice<T extends string | number>(value: unknown, values: readonly T[], path: string): T {
    const selected = values.find(candidate => candidate === value);
    if (selected === undefined) throw new Error(`${path} has an unknown value`);
    return selected;
}

export function point(value: unknown, path: string) {
    const data = record(value, path);
    exact(data, ['x', 'y'], path);
    finite(data.x, `${path}.x`);
    finite(data.y, `${path}.y`);
}

export function player(value: unknown, path: string) {
    const data = record(value, path);
    exact(data, ['x', 'y', 'vx', 'vy', 'a', 'w'], path);
    for (const key of ['x', 'y', 'vx', 'vy', 'a', 'w']) finite(data[key], `${path}.${key}`);
}

export function person(value: unknown, path: string) {
    const data = record(value, path);
    exact(data, ['id', 'x', 'said'], path);
    choice(data.id, ['manager', 'cleaner', 'admin'], `${path}.id`);
    finite(data.x, `${path}.x`);
    boolean(data.said, `${path}.said`);
}

export function paper(value: unknown, path: string) {
    const data = record(value, path);
    exact(data, ['x', 'y', 'vx', 'vy', 'a', 'w', 'life', 'hit', 'landed', 'volley', 'safe', 'kind'], path);
    choice(data.kind, ['sheet', 'bundle'], `${path}.kind`);
    for (const key of ['x', 'y', 'vx', 'vy', 'a', 'w', 'life']) finite(data[key], `${path}.${key}`);
    integer(data.volley, `${path}.volley`);
    for (const key of ['hit', 'landed', 'safe']) boolean(data[key], `${path}.${key}`);
}

export function impact(value: unknown, path: string) {
    if (value === null) return;
    const data = record(value, path);
    exact(data, ['frames', 'elapsed', 'point'], path);
    array(data.frames, `${path}.frames`, 61).forEach((frame, index) => {
        const snapshot = record(frame, `${path}.frames[${index}]`);
        exact(snapshot, ['p'], `${path}.frames[${index}]`);
        player(snapshot.p, `${path}.frames[${index}].p`);
    });
    finite(data.elapsed, `${path}.elapsed`);
    point(data.point, `${path}.point`);
}


export function exactFields<T>(data: Data, fields: Record<keyof T, true>, path: string) {
    exact(data, Object.keys(fields), path);
}
