import type { CoreState } from './state';
import { STAGES } from './stages';
import {
    exactFields,
    record,
    exact,
    array,
    finite,
    integer,
    boolean,
    string,
    choice,
    point,
    player,
    person,
    impact,
} from './validation/primitives';
import { office, building, rooftop, sky, orbit } from './stages/validation';

const STAGE_IDS = Object.values(STAGES).map((stage) => stage.id);
const MAX_CHECKPOINT = Math.max(
    ...Object.values(STAGES).map((stage) => stage.checkpoints.length - 1),
);

export function assertGameState(
    value: unknown,
    path = 'state',
): asserts value is CoreState {
    const data = record(value, path);
    exactFields<CoreState>(
        data,
        {
            stage: true,
            checkpoint: true,
            lessons: true,
            deaths: true,
            completedStage: true,
            skylineSeed: true,
            tick: true,
            rng: true,
            extinguisher: true,
            mode: true,
            p: true,
            keys: true,
            ground: true,
            coyote: true,
            jumpQ: true,
            time: true,
            practiceJump: true,
            actualSpeed: true,
            rollCooldown: true,
            reverseCooldown: true,
            people: true,
            history: true,
            impact: true,
            focus: true,
            lossReason: true,
            focusLossTime: true,
            office: true,
            building: true,
            rooftop: true,
            sky: true,
            orbit: true,
        },
        path,
    );
    choice(data.stage, STAGE_IDS, `${path}.stage`);
    integer(data.checkpoint, `${path}.checkpoint`, 0, MAX_CHECKPOINT);
    const lessons = record(data.lessons, `${path}.lessons`);
    exact(lessons, ['moved', 'jumped'], `${path}.lessons`);
    boolean(lessons.moved, `${path}.lessons.moved`);
    boolean(lessons.jumped, `${path}.lessons.jumped`);
    integer(data.deaths, `${path}.deaths`);
    choice(data.completedStage, [0, ...STAGE_IDS], `${path}.completedStage`);
    integer(data.skylineSeed, `${path}.skylineSeed`, 0, 0xffffffff);
    integer(data.tick, `${path}.tick`);

    const rng = record(data.rng, `${path}.rng`);
    exact(rng, ['physics', 'cosmetic'], `${path}.rng`);
    integer(rng.physics, `${path}.rng.physics`, 0, 0xffffffff);
    integer(rng.cosmetic, `${path}.rng.cosmetic`, 0, 0xffffffff);
    const extinguisher = record(data.extinguisher, `${path}.extinguisher`);
    exact(
        extinguisher,
        ['owned', 'cooldown', 'burst', 'direction'],
        `${path}.extinguisher`,
    );
    boolean(extinguisher.owned, `${path}.extinguisher.owned`);
    for (const key of ['cooldown', 'burst']) {
        finite(extinguisher[key], `${path}.extinguisher.${key}`);
    }
    point(extinguisher.direction, `${path}.extinguisher.direction`);
    choice(
        data.mode,
        ['intro', 'play', 'pause', 'impact', 'focuslost', 'dead', 'won'],
        `${path}.mode`,
    );
    player(data.p, `${path}.p`);
    array(data.keys, `${path}.keys`, 8).forEach((key, index) =>
        choice(
            key,
            ['left', 'right', 'q', 'e', 'spray', 'forward', 'back', 'brake'],
            `${path}.keys[${index}]`,
        ),
    );
    boolean(data.ground, `${path}.ground`);
    for (const key of [
        'coyote',
        'jumpQ',
        'time',
        'actualSpeed',
        'rollCooldown',
        'reverseCooldown',
    ]) {
        finite(data[key], `${path}.${key}`);
    }
    boolean(data.practiceJump, `${path}.practiceJump`);
    array(data.people, `${path}.people`, 16).forEach((item, index) =>
        person(item, `${path}.people[${index}]`),
    );
    array(data.history, `${path}.history`, 61).forEach((item, index) => {
        const snapshot = record(item, `${path}.history[${index}]`);
        exact(snapshot, ['p'], `${path}.history[${index}]`);
        player(snapshot.p, `${path}.history[${index}].p`);
    });
    impact(data.impact, `${path}.impact`);
    const focus = record(data.focus, `${path}.focus`);
    exact(
        focus,
        ['value', 'recoveryClock', 'processedEvents', 'notice'],
        `${path}.focus`,
    );
    finite(focus.value, `${path}.focus.value`);
    finite(focus.recoveryClock, `${path}.focus.recoveryClock`);
    array(focus.processedEvents, `${path}.focus.processedEvents`, 1024).forEach(
        (event, index) =>
            string(event, `${path}.focus.processedEvents[${index}]`),
    );
    if (focus.notice !== null) {
        const notice = record(focus.notice, `${path}.focus.notice`);
        exact(notice, ['kind', 'life'], `${path}.focus.notice`);
        choice(
            notice.kind,
            [
                'paper',
                'water',
                'light',
                'door',
                'bump',
                'bird',
                'gear',
                'steam',
                'satelliteLight',
            ],
            `${path}.focus.notice.kind`,
        );
        finite(notice.life, `${path}.focus.notice.life`);
    }
    if (data.lossReason !== null) {
        choice(
            data.lossReason,
            ['head', 'bin', 'focus', 'lift'],
            `${path}.lossReason`,
        );
    }
    finite(data.focusLossTime, `${path}.focusLossTime`);
    office(data.office, `${path}.office`);
    building(data.building, `${path}.building`);
    rooftop(data.rooftop, `${path}.rooftop`);
    sky(data.sky, `${path}.sky`);
    orbit(data.orbit, `${path}.orbit`);
}
