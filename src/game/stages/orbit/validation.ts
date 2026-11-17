import {
    exactFields,
    record,
    exact,
    array,
    finite,
    integer,
    choice,
} from '../../validation/primitives';

import type { OrbitState } from './state';

export function orbit(value: unknown, path: string): void {
    const data = record(value, path);
    exactFields<OrbitState>(
        data,
        {
            phase: true,
            age: true,
            z: true,
            speed: true,
            rings: true,
            aims: true,
            freeze: true,
            settled: true,
        },
        path,
    );
    choice(data.phase, ['entry', 'rings', 'door', 'parked'], `${path}.phase`);
    for (const key of ['age', 'z', 'speed', 'freeze', 'settled']) {
        finite(data[key], `${path}.${key}`);
    }
    array(data.aims, `${path}.aims`, 64).forEach((aim, i) => {
        const at = record(aim, `${path}.aims[${i}]`);
        exact(at, ['x', 'y'], `${path}.aims[${i}]`);
        finite(at.x, `${path}.aims[${i}].x`);
        finite(at.y, `${path}.aims[${i}].y`);
    });
    integer(data.rings, `${path}.rings`, 0, 2);
}
