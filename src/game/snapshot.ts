import { LEVEL, PHYSICS } from './level';
import { clonePlain } from './data';
import type { CoreState, ExtinguisherState } from './state';
import type { StageId } from './types';
import type { Copier } from './stages/office/copier/decide';
import { STAGES } from './stages/index';
import { stageSolids } from './step';
import { focusBlockedIn } from './systems/focus/apply';
import { stageHooks } from './stages/hooks';
import { monitorsView } from './stages/view';

function createSprayView(extinguisher: Readonly<ExtinguisherState>) {
    return {
        burst: extinguisher.burst,
        cooldown: extinguisher.cooldown,
        dir: extinguisher.direction,
    };
}

function createLevelView(stage: StageId) {
    const { length, goal } = STAGES[stage];
    return { length, goal };
}

function createCopierView(copier: Readonly<Copier>) {
    const { x, cool, burst, next, dir } = copier;
    return { x, cool, burst, next, dir };
}

function createSnapshotData(s: Readonly<CoreState>) {
    return {
        game: STAGES[s.stage].name,
        spray: createSprayView(s.extinguisher),
        lessons: s.lessons,
        officeCheckpoint: s.stage === 1 && s.checkpoint > 0,
        skylineSeed: s.skylineSeed,
        actualSpeed: s.mode === 'play' ? s.actualSpeed : 0,
        tutorialAssist:
            s.mode === 'play' && s.p.x < PHYSICS.upright.tutorialUntilX,
        stage: s.stage,
        sky: s.sky,
        orbit: s.stage === 5 ? s.orbit : undefined,
        completedStage: s.completedStage,
        hasExtinguisher: s.extinguisher.owned,
        firstFlight: s.rooftop.flight,
        rooftopEntrance: s.rooftop.entrance,
        ductReaction: s.rooftop.duct,
        airSprays: s.rooftop.airSprays,
        checkpoint: s.checkpoint,
        furniture: s.building.furniture,
        corridor: s.building.corridor,
        canEnterMeeting: stageHooks(s.stage).canInteract?.(s) ?? false,
        level: createLevelView(s.stage),
        mode: s.mode,
        focus: s.focus.value,
        focusClock: s.focus.recoveryClock,
        focusLossTime: s.focusLossTime,
        focusNotice: s.focus.notice,
        lossReason: s.lossReason,
        player: s.p,
        ground: s.ground,
        slip: s.office.slip,
        dirty: s.office.dirty,
        inBin: s.office.inBin,
        binAge: s.office.binAge,
        time: s.time,
        deaths: s.deaths,
        bursts: s.office.copier.bursts,
        paperHits: s.office.paperHits,
        binFalls: s.office.binFalls,
        dirtyWaterExperienced: s.office.wetSeen,
        cleaningSpilled: s.office.cleaning.spilled,
        soaked: s.office.soakedOnSpill > 0,
        bucketAge: s.office.bucket.age,
        paperPenaltyRemaining: s.office.paperPenaltyRemaining,
        lightPenaltyRemaining: s.office.lightPenaltyRemaining,
        cleaning: s.office.cleaning,
        lightHits: s.office.lightHits,
        doorHits: s.office.doorHits,
        monitors: monitorsView(s.time),
        papers: s.office.papers,
        people: s.people,
        solids: stageSolids(s).map((p) => ({ p })),
        copier: createCopierView(s.office.copier),
        urgentCopier: s.office.urgent,
        bin: LEVEL.bin,
        focusBlocked: focusBlockedIn(s),
    };
}

export function viewState(s: Readonly<CoreState>) {
    return clonePlain(createSnapshotData(s));
}
