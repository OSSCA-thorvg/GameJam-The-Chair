import { LEVEL, PHYSICS } from './level';
import { clonePlain } from './data';
import type { CoreState, ExtinguisherState } from './state';
import type { DeepReadonly } from './types';
import type { StageDefinition } from './stages/types';
import type { OfficeState } from './stages/office/state';
import type { BuildingState } from './stages/building/state';
import type { RooftopState } from './stages/rooftop/state';
import { STAGES } from './stages/index';
import { stageSolids } from './step';
import { focusBlockedIn } from './systems/focus/apply';
import { stageHooks } from './stages/hooks';
import { monitorsView } from './stages/view';

type CommonView = Pick<
    CoreState,
    | 'lessons'
    | 'skylineSeed'
    | 'stage'
    | 'completedStage'
    | 'checkpoint'
    | 'mode'
    | 'ground'
    | 'time'
    | 'deaths'
    | 'people'
> & {
    game: StageDefinition['name'];
    actualSpeed: number;
    tutorialAssist: boolean;
    player: CoreState['p'];
    level: Pick<StageDefinition, 'length' | 'goal'>;
    solids: Array<{ p: ReturnType<typeof stageSolids>[number] }>;
};

type FocusView = Pick<CoreState, 'focusLossTime' | 'lossReason'> & {
    focus: CoreState['focus']['value'];
    focusClock: CoreState['focus']['recoveryClock'];
    focusNotice: CoreState['focus']['notice'];
    focusBlocked: boolean;
};

type SprayView = {
    hasExtinguisher: boolean;
    spray: {
        burst: ExtinguisherState['burst'];
        cooldown: ExtinguisherState['cooldown'];
        dir: ExtinguisherState['direction'];
    };
};

type OfficeView = Pick<
    OfficeState,
    | 'slip'
    | 'dirty'
    | 'inBin'
    | 'binAge'
    | 'paperHits'
    | 'binFalls'
    | 'paperPenaltyRemaining'
    | 'lightPenaltyRemaining'
    | 'cleaning'
    | 'lightHits'
    | 'doorHits'
    | 'papers'
> & {
    officeCheckpoint: boolean;
    bursts: OfficeState['copier']['bursts'];
    dirtyWaterExperienced: OfficeState['wetSeen'];
    cleaningSpilled: OfficeState['cleaning']['spilled'];
    soaked: boolean;
    bucketAge: OfficeState['bucket']['age'];
    monitors: ReturnType<typeof monitorsView>;
    copier: Pick<
        OfficeState['copier'],
        'x' | 'cool' | 'burst' | 'next' | 'dir'
    >;
    urgentCopier: OfficeState['urgent'];
    bin: typeof LEVEL.bin;
};

type BuildingView = Pick<BuildingState, 'furniture' | 'corridor'> & {
    canEnterMeeting: boolean;
};

type RooftopView = Pick<RooftopState, 'airSprays'> & {
    firstFlight: RooftopState['flight'];
    rooftopEntrance: RooftopState['entrance'];
    ductReaction: RooftopState['duct'];
};

type SnapshotData = CommonView &
    FocusView &
    SprayView &
    OfficeView &
    BuildingView &
    RooftopView & {
        sky: CoreState['sky'];
        orbit: CoreState['orbit'] | undefined;
    };

// Gameplay fingerprints include the public snapshot's property order.
const SNAPSHOT_LAYOUT: {
    [K in keyof SnapshotData]: SnapshotData[K] | undefined;
} = {
    game: undefined,
    spray: undefined,
    lessons: undefined,
    officeCheckpoint: undefined,
    skylineSeed: undefined,
    actualSpeed: undefined,
    tutorialAssist: undefined,
    stage: undefined,
    sky: undefined,
    orbit: undefined,
    completedStage: undefined,
    hasExtinguisher: undefined,
    firstFlight: undefined,
    rooftopEntrance: undefined,
    ductReaction: undefined,
    airSprays: undefined,
    checkpoint: undefined,
    furniture: undefined,
    corridor: undefined,
    canEnterMeeting: undefined,
    level: undefined,
    mode: undefined,
    focus: undefined,
    focusClock: undefined,
    focusLossTime: undefined,
    focusNotice: undefined,
    lossReason: undefined,
    player: undefined,
    ground: undefined,
    slip: undefined,
    dirty: undefined,
    inBin: undefined,
    binAge: undefined,
    time: undefined,
    deaths: undefined,
    bursts: undefined,
    paperHits: undefined,
    binFalls: undefined,
    dirtyWaterExperienced: undefined,
    cleaningSpilled: undefined,
    soaked: undefined,
    bucketAge: undefined,
    paperPenaltyRemaining: undefined,
    lightPenaltyRemaining: undefined,
    cleaning: undefined,
    lightHits: undefined,
    doorHits: undefined,
    monitors: undefined,
    papers: undefined,
    people: undefined,
    solids: undefined,
    copier: undefined,
    urgentCopier: undefined,
    bin: undefined,
    focusBlocked: undefined,
};

export type GameSnapshot = DeepReadonly<SnapshotData>;

function createCommonView(s: Readonly<CoreState>): CommonView {
    const { length, goal, name } = STAGES[s.stage];
    return {
        game: name,
        lessons: clonePlain(s.lessons),
        skylineSeed: s.skylineSeed,
        actualSpeed: s.mode === 'play' ? s.actualSpeed : 0,
        tutorialAssist:
            s.mode === 'play' && s.p.x < PHYSICS.upright.tutorialUntilX,
        stage: s.stage,
        completedStage: s.completedStage,
        checkpoint: s.checkpoint,
        level: { length, goal },
        mode: s.mode,
        player: clonePlain(s.p),
        ground: s.ground,
        time: s.time,
        deaths: s.deaths,
        people: clonePlain(s.people),
        solids: stageSolids(s).map((p) => ({ p: clonePlain(p) })),
    };
}

function createFocusView(s: Readonly<CoreState>): FocusView {
    return {
        focus: s.focus.value,
        focusClock: s.focus.recoveryClock,
        focusLossTime: s.focusLossTime,
        focusNotice: clonePlain(s.focus.notice),
        lossReason: s.lossReason,
        focusBlocked: focusBlockedIn(s),
    };
}

function createSprayView(extinguisher: Readonly<ExtinguisherState>): SprayView {
    return {
        hasExtinguisher: extinguisher.owned,
        spray: {
            burst: extinguisher.burst,
            cooldown: extinguisher.cooldown,
            dir: clonePlain(extinguisher.direction),
        },
    };
}

function createOfficeView(s: Readonly<CoreState>): OfficeView {
    const office = s.office;
    const { x, cool, burst, next, dir } = office.copier;
    return {
        officeCheckpoint: s.stage === 1 && s.checkpoint > 0,
        slip: office.slip,
        dirty: office.dirty,
        inBin: office.inBin,
        binAge: office.binAge,
        bursts: office.copier.bursts,
        paperHits: office.paperHits,
        binFalls: office.binFalls,
        dirtyWaterExperienced: office.wetSeen,
        cleaningSpilled: office.cleaning.spilled,
        soaked: office.soakedOnSpill > 0,
        bucketAge: office.bucket.age,
        paperPenaltyRemaining: office.paperPenaltyRemaining,
        lightPenaltyRemaining: office.lightPenaltyRemaining,
        cleaning: clonePlain(office.cleaning),
        lightHits: office.lightHits,
        doorHits: office.doorHits,
        monitors: monitorsView(s.time),
        papers: clonePlain(office.papers),
        copier: { x, cool, burst, next, dir },
        urgentCopier: clonePlain(office.urgent),
        bin: clonePlain(LEVEL.bin),
    };
}

function createBuildingView(s: Readonly<CoreState>): BuildingView {
    return {
        furniture: clonePlain(s.building.furniture),
        corridor: clonePlain(s.building.corridor),
        canEnterMeeting: stageHooks(s.stage).canInteract?.(s) ?? false,
    };
}

function createRooftopView(rooftop: Readonly<RooftopState>): RooftopView {
    return {
        firstFlight: clonePlain(rooftop.flight),
        rooftopEntrance: clonePlain(rooftop.entrance),
        ductReaction: clonePlain(rooftop.duct),
        airSprays: rooftop.airSprays,
    };
}

export function viewState(s: Readonly<CoreState>): SnapshotData {
    const data: SnapshotData = {
        ...createCommonView(s),
        ...createFocusView(s),
        ...createSprayView(s.extinguisher),
        ...createOfficeView(s),
        ...createBuildingView(s),
        ...createRooftopView(s.rooftop),
        sky: clonePlain(s.sky),
        orbit: s.stage === 5 ? clonePlain(s.orbit) : undefined,
    };
    return Object.assign({ ...SNAPSHOT_LAYOUT }, data);
}
