import {
    exactFields,
    record,
    exact,
    array,
    finite,
    integer,
    boolean,
    choice,
    point,
} from '../../validation/primitives';
import type { BuildingState } from './state';
import { STAGE_TWO } from './data';

function room(value: unknown, path: string) {
    const data = record(value, path);
    const kind = choice(
        data.kind,
        ['corridor', 'entering', 'meeting'],
        `${path}.kind`,
    );
    exact(
        data,
        kind !== 'corridor' ? ['kind', 'age', 'returnX'] : ['kind'],
        path,
    );
    if (kind !== 'corridor') {
        finite(data.age, `${path}.age`);
        finite(data.returnX, `${path}.returnX`);
    }
}

function chat(value: unknown, path: string) {
    const data = record(value, path);
    const kind = choice(
        data.kind,
        [
            'waiting',
            'gossip',
            'wary',
            'dismissed',
            'realizing',
            'welcoming',
            'orientation',
            'trip',
            'rush',
            'ramp',
        ],
        `${path}.kind`,
    );
    exact(
        data,
        kind === 'waiting'
            ? ['kind']
            : kind === 'orientation'
              ? ['kind', 'age', 'line']
              : ['kind', 'age'],
        path,
    );
    if (kind !== 'waiting') finite(data.age, `${path}.age`);
    if (kind === 'orientation') {
        integer(
            data.line,
            `${path}.line`,
            0,
            STAGE_TWO.orientation.lines.length - 1,
        );
    }
}

function departure(value: unknown, path: string) {
    const data = record(value, path);
    const kind = choice(
        data.kind,
        ['none', 'boarding', 'descending', 'gone', 'lost'],
        `${path}.kind`,
    );
    exact(
        data,
        kind === 'boarding' || kind === 'descending'
            ? ['kind', 'age', 'reason']
            : ['kind'],
        path,
    );
    if (kind === 'boarding' || kind === 'descending') {
        finite(data.age, `${path}.age`);
        choice(
            data.reason,
            ['companions', 'clock-out', 'abduction'],
            `${path}.reason`,
        );
    }
}

function lift(value: unknown, path: string) {
    const data = record(value, path);
    const kind = choice(
        data.kind,
        ['waiting', 'arriving', 'open', 'departed'],
        `${path}.kind`,
    );
    exact(
        data,
        kind === 'arriving' || kind === 'open' ? ['kind', 'age'] : ['kind'],
        path,
    );
    if (kind === 'arriving' || kind === 'open') finite(data.age, `${path}.age`);
}

export function building(value: unknown, path: string) {
    const data = record(value, path);
    exactFields<BuildingState>(data, { furniture: true, corridor: true }, path);
    array(data.furniture, `${path}.furniture`, 3).forEach((item, index) => {
        const chair = record(item, `${path}.furniture[${index}]`);
        exact(
            chair,
            ['kind', 'x', 'y', 'width', 'height', 'vx', 'released', 'cheer'],
            `${path}.furniture[${index}]`,
        );
        choice(chair.kind, ['chair'], `${path}.furniture[${index}].kind`);
        for (const key of ['x', 'y', 'width', 'height', 'vx', 'cheer']) {
            finite(chair[key], `${path}.furniture[${index}].${key}`);
        }
        boolean(chair.released, `${path}.furniture[${index}].released`);
    });
    const corridor = record(data.corridor, `${path}.corridor`);
    exact(
        corridor,
        [
            'appearanceSeed',
            'room',
            'meetingVisited',
            'dispatchAge',
            'dispatchStarted',
            'chat',
            'lesson',
            'tripped',
            'convoy',
            'pace',
            'departure',
            'lift',
            'typingCooldown',
            'offices',
        ],
        `${path}.corridor`,
    );
    integer(
        corridor.appearanceSeed,
        `${path}.corridor.appearanceSeed`,
        0,
        0xffffffff,
    );
    room(corridor.room, `${path}.corridor.room`);
    boolean(corridor.meetingVisited, `${path}.corridor.meetingVisited`);
    finite(corridor.dispatchAge, `${path}.corridor.dispatchAge`);
    boolean(corridor.dispatchStarted, `${path}.corridor.dispatchStarted`);
    chat(corridor.chat, `${path}.corridor.chat`);
    integer(
        corridor.lesson,
        `${path}.corridor.lesson`,
        -1,
        STAGE_TWO.orientation.lines.length,
    );
    integer(
        corridor.tripped,
        `${path}.corridor.tripped`,
        -1,
        STAGE_TWO.orientation.obstacles.length - 1,
    );
    choice(
        corridor.convoy,
        ['free', 'carried', 'leading', 'airborne', 'leading-airborne'],
        `${path}.corridor.convoy`,
    );
    choice(corridor.pace, ['casual', 'express'], `${path}.corridor.pace`);
    departure(corridor.departure, `${path}.corridor.departure`);
    lift(corridor.lift, `${path}.corridor.lift`);
    finite(corridor.typingCooldown, `${path}.corridor.typingCooldown`);
    array(corridor.offices, `${path}.corridor.offices`, 4).forEach(
        (item, index) => {
            const office = record(item, `${path}.corridor.offices[${index}]`);
            exact(
                office,
                ['x', 'life', 'cooldown', 'nearby', 'phrase', 'offset'],
                `${path}.corridor.offices[${index}]`,
            );
            for (const key of ['x', 'life', 'cooldown', 'phrase']) {
                finite(
                    office[key],
                    `${path}.corridor.offices[${index}].${key}`,
                );
            }
            boolean(office.nearby, `${path}.corridor.offices[${index}].nearby`);
            point(office.offset, `${path}.corridor.offices[${index}].offset`);
        },
    );
}
