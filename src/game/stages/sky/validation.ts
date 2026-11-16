import {
    exactFields,
    record,
    finite,
    integer,
    string,
    choice,
} from '../../validation/primitives';
import type { SkyState } from './data';

export function sky(value: unknown, path: string) {
    const data = record(value, path);
    exactFields<SkyState>(
        data,
        {
            phase: true,
            age: true,
            lift: true,
            drawer: true,
            deskTilt: true,
            signTilt: true,
            standing: true,
            depth: true,
            depthTravel: true,
            airSprays: true,
            knock: true,
            knockKind: true,
        },
        path,
    );
    choice(
        data.phase,
        ['arrival', 'course', 'reveal', 'depth'],
        `${path}.phase`,
    );
    for (const key of [
        'age',
        'lift',
        'drawer',
        'deskTilt',
        'signTilt',
        'depth',
        'depthTravel',
        'knock',
    ]) {
        finite(data[key], `${path}.${key}`);
    }
    if (data.standing !== null) string(data.standing, `${path}.standing`, 100);
    integer(data.airSprays, `${path}.airSprays`);
    if (data.knockKind !== null) {
        choice(data.knockKind, ['paper', 'bird', 'gear'], `${path}.knockKind`);
    }
}
