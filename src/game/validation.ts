import type { GameState } from './state';

type Data = Record<string, unknown>;

function isRecord(value: unknown): value is Data {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function record(value: unknown, path: string): Data {
    if (!isRecord(value)) throw new Error(`${path} must be an object`);
    return value;
}

function exact(data: Data, allowed: readonly string[], path: string) {
    const unexpected = Object.keys(data).find(key => !allowed.includes(key));
    if (unexpected) throw new Error(`${path}.${unexpected} is not allowed`);
}

function array(value: unknown, path: string, max: number): unknown[] {
    if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
    if (value.length > max) throw new Error(`${path} is too large`);
    return value;
}

function finite(value: unknown, path: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${path} must be a finite number`);
    return value;
}

function integer(value: unknown, path: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
    const number = finite(value, path);
    if (!Number.isSafeInteger(number) || number < min || number > max) throw new Error(`${path} must be an integer from ${min} to ${max}`);
    return number;
}

function boolean(value: unknown, path: string): boolean {
    if (typeof value !== 'boolean') throw new Error(`${path} must be a boolean`);
    return value;
}

function string(value: unknown, path: string, max = 200): string {
    if (typeof value !== 'string' || value.length > max) throw new Error(`${path} must be a string of at most ${max} characters`);
    return value;
}

function choice<T extends string | number>(value: unknown, values: readonly T[], path: string): T {
    const selected = values.find(candidate => candidate === value);
    if (selected === undefined) throw new Error(`${path} has an unknown value`);
    return selected;
}

function point(value: unknown, path: string) {
    const data = record(value, path);
    exact(data, ['x', 'y'], path);
    finite(data.x, `${path}.x`);
    finite(data.y, `${path}.y`);
}

function player(value: unknown, path: string) {
    const data = record(value, path);
    exact(data, ['x', 'y', 'vx', 'vy', 'a', 'w'], path);
    for (const key of ['x', 'y', 'vx', 'vy', 'a', 'w']) finite(data[key], `${path}.${key}`);
}

function person(value: unknown, path: string) {
    const data = record(value, path);
    exact(data, ['id', 'x', 'said'], path);
    choice(data.id, ['manager', 'cleaner', 'admin'], `${path}.id`);
    finite(data.x, `${path}.x`);
    boolean(data.said, `${path}.said`);
}

function paper(value: unknown, path: string) {
    const data = record(value, path);
    exact(data, ['x', 'y', 'vx', 'vy', 'a', 'w', 'life', 'hit', 'landed', 'volley', 'safe'], path);
    for (const key of ['x', 'y', 'vx', 'vy', 'a', 'w', 'life']) finite(data[key], `${path}.${key}`);
    integer(data.volley, `${path}.volley`);
    for (const key of ['hit', 'landed', 'safe']) boolean(data[key], `${path}.${key}`);
}

function impact(value: unknown, path: string) {
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

function office(value: unknown, path: string) {
    const data = record(value, path);
    exact(data, ['copier', 'volley', 'bursts', 'papers', 'paperHits', 'paperPenaltyRemaining', 'cleaning', 'bucket', 'soakedOnSpill',
        'slip', 'wetSeen', 'slipCooldown', 'inBin', 'dirty', 'binAge', 'binCooldown', 'binFalls', 'lightPenaltyRemaining', 'lightHits',
        'lightCooldown', 'doorHits'], path);
    const copier = record(data.copier, `${path}.copier`);
    exact(copier, ['x', 'cool', 'burst', 'next', 'dir'], `${path}.copier`);
    for (const key of ['x', 'cool', 'burst', 'next', 'dir']) finite(copier[key], `${path}.copier.${key}`);
    for (const key of ['volley', 'bursts', 'paperHits', 'soakedOnSpill', 'binFalls', 'lightHits', 'doorHits']) integer(data[key], `${path}.${key}`);
    for (const key of ['paperPenaltyRemaining', 'slipCooldown', 'binAge', 'binCooldown', 'lightPenaltyRemaining', 'lightCooldown']) finite(data[key], `${path}.${key}`);
    for (const key of ['slip', 'wetSeen', 'inBin', 'dirty']) boolean(data[key], `${path}.${key}`);
    array(data.papers, `${path}.papers`, 60).forEach((item, index) => paper(item, `${path}.papers[${index}]`));

    const cleaning = record(data.cleaning, `${path}.cleaning`);
    exact(cleaning, ['x', 'a', 'b', 'spilled', 'age', 'followup', 'splashDir'], `${path}.cleaning`);
    for (const key of ['x', 'a', 'b', 'age', 'splashDir']) finite(cleaning[key], `${path}.cleaning.${key}`);
    for (const key of ['spilled', 'followup']) boolean(cleaning[key], `${path}.cleaning.${key}`);
    const bucket = record(data.bucket, `${path}.bucket`);
    exact(bucket, ['age', 'armed', 'spills'], `${path}.bucket`);
    finite(bucket.age, `${path}.bucket.age`);
    boolean(bucket.armed, `${path}.bucket.armed`);
    integer(bucket.spills, `${path}.bucket.spills`);
}

function room(value: unknown, path: string) {
    const data = record(value, path);
    const kind = choice(data.kind, ['corridor', 'meeting'], `${path}.kind`);
    exact(data, kind === 'meeting' ? ['kind', 'age', 'returnX'] : ['kind'], path);
    if (kind === 'meeting') {
        finite(data.age, `${path}.age`);
        finite(data.returnX, `${path}.returnX`);
    }
}

function chat(value: unknown, path: string) {
    const data = record(value, path);
    const kind = choice(data.kind, ['waiting', 'gossip', 'wary', 'dismissed', 'realizing', 'welcoming', 'companions', 'rush'], `${path}.kind`);
    exact(data, kind === 'waiting' ? ['kind'] : ['kind', 'age'], path);
    if (kind !== 'waiting') finite(data.age, `${path}.age`);
}

function departure(value: unknown, path: string) {
    const data = record(value, path);
    const kind = choice(data.kind, ['none', 'boarding', 'descending', 'gone', 'lost'], `${path}.kind`);
    exact(data, kind === 'boarding' || kind === 'descending' ? ['kind', 'age', 'reason'] : ['kind'], path);
    if (kind === 'boarding' || kind === 'descending') {
        finite(data.age, `${path}.age`);
        choice(data.reason, ['companions', 'clock-out', 'abduction'], `${path}.reason`);
    }
}

function lift(value: unknown, path: string) {
    const data = record(value, path);
    const kind = choice(data.kind, ['waiting', 'arriving', 'open', 'departed'], `${path}.kind`);
    exact(data, kind === 'arriving' || kind === 'open' ? ['kind', 'age'] : ['kind'], path);
    if (kind === 'arriving' || kind === 'open') finite(data.age, `${path}.age`);
}

function building(value: unknown, path: string) {
    const data = record(value, path);
    exact(data, ['furniture', 'corridor'], path);
    array(data.furniture, `${path}.furniture`, 3).forEach((item, index) => {
        const chair = record(item, `${path}.furniture[${index}]`);
        exact(chair, ['kind', 'x', 'y', 'width', 'height', 'vx', 'released', 'cheer'], `${path}.furniture[${index}]`);
        choice(chair.kind, ['chair'], `${path}.furniture[${index}].kind`);
        for (const key of ['x', 'y', 'width', 'height', 'vx', 'cheer']) finite(chair[key], `${path}.furniture[${index}].${key}`);
        boolean(chair.released, `${path}.furniture[${index}].released`);
    });
    const corridor = record(data.corridor, `${path}.corridor`);
    exact(corridor, ['appearanceSeed', 'room', 'meetingVisited', 'dispatchAge', 'dispatchStarted', 'chat', 'convoy', 'pace', 'departure',
        'lift', 'typingCooldown', 'offices'], `${path}.corridor`);
    integer(corridor.appearanceSeed, `${path}.corridor.appearanceSeed`, 0, 0xffffffff);
    room(corridor.room, `${path}.corridor.room`);
    boolean(corridor.meetingVisited, `${path}.corridor.meetingVisited`);
    finite(corridor.dispatchAge, `${path}.corridor.dispatchAge`);
    boolean(corridor.dispatchStarted, `${path}.corridor.dispatchStarted`);
    chat(corridor.chat, `${path}.corridor.chat`);
    choice(corridor.convoy, ['free', 'carried', 'airborne'], `${path}.corridor.convoy`);
    choice(corridor.pace, ['casual', 'express'], `${path}.corridor.pace`);
    departure(corridor.departure, `${path}.corridor.departure`);
    lift(corridor.lift, `${path}.corridor.lift`);
    finite(corridor.typingCooldown, `${path}.corridor.typingCooldown`);
    array(corridor.offices, `${path}.corridor.offices`, 4).forEach((item, index) => {
        const office = record(item, `${path}.corridor.offices[${index}]`);
        exact(office, ['x', 'life', 'cooldown', 'nearby', 'phrase', 'offset'], `${path}.corridor.offices[${index}]`);
        for (const key of ['x', 'life', 'cooldown', 'phrase']) finite(office[key], `${path}.corridor.offices[${index}].${key}`);
        boolean(office.nearby, `${path}.corridor.offices[${index}].nearby`);
        point(office.offset, `${path}.corridor.offices[${index}].offset`);
    });
}

function entrance(value: unknown, path: string) {
    const data = record(value, path);
    const kind = choice(data.kind, ['opening', 'ready'], `${path}.kind`);
    exact(data, kind === 'opening' ? ['kind', 'age'] : ['kind'], path);
    if (kind === 'opening') finite(data.age, `${path}.age`);
}

function duct(value: unknown, path: string) {
    const data = record(value, path);
    const kind = choice(data.kind, ['idle', 'reacting', 'done'], `${path}.kind`);
    exact(data, kind === 'reacting' ? ['kind', 'age', 'shots', 'bursts'] : kind === 'done' ? ['kind', 'shots'] : ['kind'], path);
    if (kind === 'reacting') {
        finite(data.age, `${path}.age`);
        integer(data.shots, `${path}.shots`);
        array(data.bursts, `${path}.bursts`, 64).forEach((item, index) => {
            const burst = record(item, `${path}.bursts[${index}]`);
            exact(burst, ['kind', 'age'], `${path}.bursts[${index}]`);
            choice(burst.kind, ['first', 'repeat'], `${path}.bursts[${index}].kind`);
            finite(burst.age, `${path}.bursts[${index}].age`);
        });
    } else if (kind === 'done') integer(data.shots, `${path}.shots`);
}

function flight(value: unknown, path: string) {
    const data = record(value, path);
    const kind = choice(data.kind, ['course', 'flight'], `${path}.kind`);
    exact(data, kind === 'course' ? ['kind', 'verticalShots', 'lastShotAt'] : ['kind', 'age'], path);
    if (kind === 'course') {
        integer(data.verticalShots, `${path}.verticalShots`);
        finite(data.lastShotAt, `${path}.lastShotAt`);
    } else finite(data.age, `${path}.age`);
}

function rooftop(value: unknown, path: string) {
    const data = record(value, path);
    exact(data, ['entrance', 'duct', 'flight'], path);
    entrance(data.entrance, `${path}.entrance`);
    duct(data.duct, `${path}.duct`);
    flight(data.flight, `${path}.flight`);
}

function sky(value: unknown, path: string) {
    const data = record(value, path);
    exact(data, ['phase', 'age', 'lift', 'drawer', 'deskTilt', 'signTilt', 'standing', 'depth', 'depthTravel'], path);
    choice(data.phase, ['arrival', 'course', 'reveal', 'depth'], `${path}.phase`);
    for (const key of ['age', 'lift', 'drawer', 'deskTilt', 'signTilt', 'depth', 'depthTravel']) finite(data[key], `${path}.${key}`);
    if (data.standing !== null) string(data.standing, `${path}.standing`, 100);
}

/** Validates the complete serialized core state before untrusted data enters replay logic. */
export function assertGameState(value: unknown, path = 'state'): asserts value is GameState {
    const data = record(value, path);
    exact(data, ['stage', 'checkpoint', 'lessons', 'deaths', 'completedStage', 'skylineSeed', 'tick', 'rng', 'hasExtinguisher',
        'sprayCooldown', 'sprayBurst', 'sprayDir', 'mode', 'p', 'keys', 'ground', 'coyote', 'jumpQ', 'time', 'practiceJump', 'actualSpeed',
        'rollCooldown', 'reverseCooldown', 'people', 'history', 'impact', 'focus', 'focusClock', 'focusEvents', 'focusNotice', 'lossReason',
        'focusLossTime', 'office', 'building', 'rooftop', 'sky'], path);
    choice(data.stage, [1, 2, 3, 4], `${path}.stage`);
    integer(data.checkpoint, `${path}.checkpoint`, 0, 3);
    const lessons = record(data.lessons, `${path}.lessons`);
    exact(lessons, ['moved', 'jumped'], `${path}.lessons`);
    boolean(lessons.moved, `${path}.lessons.moved`);
    boolean(lessons.jumped, `${path}.lessons.jumped`);
    integer(data.deaths, `${path}.deaths`);
    choice(data.completedStage, [0, 1, 2, 3, 4], `${path}.completedStage`);
    integer(data.skylineSeed, `${path}.skylineSeed`, 0, 0xffffffff);
    integer(data.tick, `${path}.tick`);

    const rng = record(data.rng, `${path}.rng`);
    exact(rng, ['physics', 'cosmetic'], `${path}.rng`);
    integer(rng.physics, `${path}.rng.physics`, 0, 0xffffffff);
    integer(rng.cosmetic, `${path}.rng.cosmetic`, 0, 0xffffffff);
    boolean(data.hasExtinguisher, `${path}.hasExtinguisher`);
    for (const key of ['sprayCooldown', 'sprayBurst']) finite(data[key], `${path}.${key}`);
    point(data.sprayDir, `${path}.sprayDir`);
    choice(data.mode, ['intro', 'play', 'pause', 'impact', 'focuslost', 'dead', 'won'], `${path}.mode`);
    player(data.p, `${path}.p`);
    array(data.keys, `${path}.keys`, 7).forEach((key, index) => choice(key, ['left', 'right', 'q', 'e', 'spray', 'forward', 'back'], `${path}.keys[${index}]`));
    boolean(data.ground, `${path}.ground`);
    for (const key of ['coyote', 'jumpQ', 'time', 'actualSpeed', 'rollCooldown', 'reverseCooldown']) finite(data[key], `${path}.${key}`);
    boolean(data.practiceJump, `${path}.practiceJump`);
    array(data.people, `${path}.people`, 16).forEach((item, index) => person(item, `${path}.people[${index}]`));
    array(data.history, `${path}.history`, 61).forEach((item, index) => {
        const snapshot = record(item, `${path}.history[${index}]`);
        exact(snapshot, ['p'], `${path}.history[${index}]`);
        player(snapshot.p, `${path}.history[${index}].p`);
    });
    impact(data.impact, `${path}.impact`);
    finite(data.focus, `${path}.focus`);
    finite(data.focusClock, `${path}.focusClock`);
    array(data.focusEvents, `${path}.focusEvents`, 1024).forEach((event, index) => string(event, `${path}.focusEvents[${index}]`));
    if (data.focusNotice !== null) {
        const notice = record(data.focusNotice, `${path}.focusNotice`);
        exact(notice, ['kind', 'life'], `${path}.focusNotice`);
        choice(notice.kind, ['paper', 'water', 'light', 'door'], `${path}.focusNotice.kind`);
        finite(notice.life, `${path}.focusNotice.life`);
    }
    if (data.lossReason !== null) choice(data.lossReason, ['head', 'bin', 'focus', 'lift'], `${path}.lossReason`);
    finite(data.focusLossTime, `${path}.focusLossTime`);
    office(data.office, `${path}.office`);
    building(data.building, `${path}.building`);
    rooftop(data.rooftop, `${path}.rooftop`);
    sky(data.sky, `${path}.sky`);
}
