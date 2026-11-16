import { exactFields, record, exact, array, finite, integer, choice } from '../../validation/primitives';
import type { RooftopState } from './state';

function entrance(value: unknown, path: string) {
    const data = record(value, path);
    const kind = choice(data.kind, ['opening', 'ready'], `${path}.kind`);
    exact(data, kind === 'opening' ? ['kind', 'age'] : ['kind'], path);
    if (kind === 'opening') finite(data.age, `${path}.age`);
}

function duct(value: unknown, path: string) {
    const data = record(value, path);
    const kind = choice(data.kind, ['idle', 'reacting', 'done'], `${path}.kind`);
    exact(data, kind === 'reacting' ? ['kind', 'age', 'shots', 'bursts'] : kind === 'done' ? ['kind', 'shots', 'rest'] : ['kind', 'rest'], path);
    if (kind === 'reacting') {
        finite(data.age, `${path}.age`);
        integer(data.shots, `${path}.shots`);
        array(data.bursts, `${path}.bursts`, 64).forEach((item, index) => {
            const burst = record(item, `${path}.bursts[${index}]`);
            exact(burst, ['kind', 'age'], `${path}.bursts[${index}]`);
            choice(burst.kind, ['first', 'gust'], `${path}.bursts[${index}].kind`);
            finite(burst.age, `${path}.bursts[${index}].age`);
        });
    } else if (kind === 'done') {
        integer(data.shots, `${path}.shots`);
        finite(data.rest, `${path}.rest`);
    } else {
        finite(data.rest, `${path}.rest`);
    }
}

function flight(value: unknown, path: string) {
    const data = record(value, path);
    const kind = choice(data.kind, ['course', 'ride', 'flight'], `${path}.kind`);
    exact(data, kind === 'course' ? ['kind'] : kind === 'ride' ? ['kind', 'dist', 'speed', 'age'] : ['kind', 'age'], path);
    if (kind === 'ride') {
        finite(data.dist, `${path}.dist`);
        finite(data.speed, `${path}.speed`);
    }
    if (kind !== 'course') finite(data.age, `${path}.age`);
}

export function rooftop(value: unknown, path: string) {
    const data = record(value, path);
    exactFields<RooftopState>(data, { entrance: true, duct: true, flight: true, airSprays: true }, path);
    entrance(data.entrance, `${path}.entrance`);
    duct(data.duct, `${path}.duct`);
    flight(data.flight, `${path}.flight`);
    integer(data.airSprays, `${path}.airSprays`);
}

