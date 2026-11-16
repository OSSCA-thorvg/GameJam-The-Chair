import { PHYSICS } from './level';
import { clonePlain } from './data';
import type { CoreState, ExtinguisherState, Progress } from './state';
import type { DeepReadonly } from './types';
import type { StageDefinition } from './stages/types';
import { STAGES } from './stages/index';
import { stageSolids } from './step';
import { focusBlockedIn } from './systems/focus/apply';
import { stageHooks } from './stages/hooks';
import {
    createOfficeSnapshot,
    createBuildingSnapshot,
    createRooftopSnapshot,
    type OfficeSnapshot,
    type BuildingSnapshot,
    type RooftopSnapshot,
} from './stages/view';

type SessionSnapshot = Pick<CoreState, 'mode' | 'time' | 'lossReason'>;
type ProgressSource = Pick<
    Progress,
    'stage' | 'checkpoint' | 'completedStage' | 'deaths'
>;
type ProgressSnapshot = ProgressSource & { officeCheckpoint: boolean };

function createProgressSnapshot(
    progress: Readonly<ProgressSource>,
): ProgressSnapshot {
    return {
        stage: progress.stage,
        checkpoint: progress.checkpoint,
        completedStage: progress.completedStage,
        deaths: progress.deaths,
        officeCheckpoint: progress.stage === 1 && progress.checkpoint > 0,
    };
}

type TutorialSnapshot = {
    lessons: Progress['lessons'];
    tutorialAssist: boolean;
};

function createTutorialSnapshot(
    lessons: Readonly<Progress['lessons']>,
    playerX: number,
    playing: boolean,
): TutorialSnapshot {
    return {
        lessons: clonePlain(lessons),
        tutorialAssist: playing && playerX < PHYSICS.upright.tutorialUntilX,
    };
}

type PlayerSource = Pick<CoreState, 'p' | 'ground' | 'actualSpeed'>;
type PlayerSnapshot = Pick<CoreState, 'ground' | 'actualSpeed'> & {
    player: CoreState['p'];
};

function createPlayerSnapshot(
    source: Readonly<PlayerSource>,
    playing: boolean,
): PlayerSnapshot {
    return {
        player: clonePlain(source.p),
        ground: source.ground,
        actualSpeed: playing ? source.actualSpeed : 0,
    };
}

type WorldSource = Pick<CoreState, 'people' | 'skylineSeed'>;
type WorldSnapshot = WorldSource & {
    game: StageDefinition['name'];
    level: Pick<StageDefinition, 'length' | 'goal'>;
    solids: Array<{ p: ReturnType<typeof stageSolids>[number] }>;
};

function createWorldSnapshot(
    source: Readonly<WorldSource>,
    stage: Readonly<Pick<StageDefinition, 'name' | 'length' | 'goal'>>,
    solids: ReturnType<typeof stageSolids>,
): WorldSnapshot {
    return {
        game: stage.name,
        level: { length: stage.length, goal: stage.goal },
        skylineSeed: source.skylineSeed,
        people: clonePlain(source.people),
        solids: solids.map((p) => ({ p: clonePlain(p) })),
    };
}

type FocusSource = Pick<CoreState, 'focusLossTime'> & {
    focus: Pick<CoreState['focus'], 'value' | 'recoveryClock' | 'notice'>;
};
type FocusSnapshot = Pick<CoreState, 'focusLossTime'> & {
    focus: CoreState['focus']['value'];
    focusClock: CoreState['focus']['recoveryClock'];
    focusNotice: CoreState['focus']['notice'];
    focusBlocked: boolean;
};

function createFocusSnapshot(
    source: Readonly<FocusSource>,
    blocked: boolean,
): FocusSnapshot {
    return {
        focus: source.focus.value,
        focusClock: source.focus.recoveryClock,
        focusLossTime: source.focusLossTime,
        focusNotice: clonePlain(source.focus.notice),
        focusBlocked: blocked,
    };
}

type SpraySnapshot = {
    hasExtinguisher: boolean;
    spray: {
        burst: ExtinguisherState['burst'];
        cooldown: ExtinguisherState['cooldown'];
        dir: ExtinguisherState['direction'];
    };
};

function createSpraySnapshot(
    extinguisher: Readonly<ExtinguisherState>,
): SpraySnapshot {
    return {
        hasExtinguisher: extinguisher.owned,
        spray: {
            burst: extinguisher.burst,
            cooldown: extinguisher.cooldown,
            dir: clonePlain(extinguisher.direction),
        },
    };
}

type SnapshotData = SessionSnapshot &
    ProgressSnapshot &
    TutorialSnapshot &
    PlayerSnapshot &
    WorldSnapshot &
    FocusSnapshot &
    SpraySnapshot &
    OfficeSnapshot &
    BuildingSnapshot &
    RooftopSnapshot & {
        sky: CoreState['sky'];
        orbit: CoreState['orbit'] | undefined;
    };

export type GameSnapshot = DeepReadonly<SnapshotData>;

export function viewState(s: Readonly<CoreState>): SnapshotData {
    const playing = s.mode === 'play';
    const focusBlocked = focusBlockedIn(s);
    const canEnterMeeting = stageHooks(s.stage).canInteract?.(s) ?? false;
    const solids = stageSolids(s);
    return {
        mode: s.mode,
        time: s.time,
        lossReason: s.lossReason,
        ...createProgressSnapshot(s),
        ...createTutorialSnapshot(s.lessons, s.p.x, playing),
        ...createPlayerSnapshot(s, playing),
        ...createWorldSnapshot(s, STAGES[s.stage], solids),
        ...createFocusSnapshot(s, focusBlocked),
        ...createSpraySnapshot(s.extinguisher),
        ...createOfficeSnapshot(s.office, s.time),
        ...createBuildingSnapshot(s.building, canEnterMeeting),
        ...createRooftopSnapshot(s.rooftop),
        sky: clonePlain(s.sky),
        orbit: s.stage === 5 ? clonePlain(s.orbit) : undefined,
    };
}
