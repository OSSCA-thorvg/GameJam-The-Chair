import { LEVEL } from '../../level';
import { clonePlain } from '../../data';
import type { OfficeState } from './state';
import { monitorPhase } from './monitor/decide';

type PaperSource = Pick<
    OfficeState,
    'urgent' | 'papers' | 'paperHits' | 'paperPenaltyRemaining'
> & {
    copier: Pick<
        OfficeState['copier'],
        'x' | 'cool' | 'burst' | 'next' | 'dir' | 'bursts'
    >;
};
type PaperSnapshot = Pick<
    OfficeState,
    'papers' | 'paperHits' | 'paperPenaltyRemaining'
> & {
    bursts: OfficeState['copier']['bursts'];
    copier: Pick<
        OfficeState['copier'],
        'x' | 'cool' | 'burst' | 'next' | 'dir'
    >;
    urgentCopier: OfficeState['urgent'];
};

function createPaperSnapshot(office: Readonly<PaperSource>): PaperSnapshot {
    const { x, cool, burst, next, dir } = office.copier;
    return {
        bursts: office.copier.bursts,
        paperHits: office.paperHits,
        paperPenaltyRemaining: office.paperPenaltyRemaining,
        papers: clonePlain(office.papers),
        copier: { x, cool, burst, next, dir },
        urgentCopier: clonePlain(office.urgent),
    };
}

type CleaningSource = Pick<
    OfficeState,
    'cleaning' | 'soakedOnSpill' | 'slip' | 'wetSeen'
> & { bucket: Pick<OfficeState['bucket'], 'age'> };
type CleaningSnapshot = Pick<OfficeState, 'cleaning' | 'slip'> & {
    dirtyWaterExperienced: OfficeState['wetSeen'];
    cleaningSpilled: OfficeState['cleaning']['spilled'];
    soaked: boolean;
    bucketAge: OfficeState['bucket']['age'];
};

function createCleaningSnapshot(
    office: Readonly<CleaningSource>,
): CleaningSnapshot {
    return {
        slip: office.slip,
        dirtyWaterExperienced: office.wetSeen,
        cleaningSpilled: office.cleaning.spilled,
        soaked: office.soakedOnSpill > 0,
        bucketAge: office.bucket.age,
        cleaning: clonePlain(office.cleaning),
    };
}

type BinSource = Pick<OfficeState, 'dirty' | 'inBin' | 'binAge' | 'binFalls'>;
type BinSnapshot = BinSource & { bin: typeof LEVEL.bin };

function createBinSnapshot(office: Readonly<BinSource>): BinSnapshot {
    return {
        dirty: office.dirty,
        inBin: office.inBin,
        binAge: office.binAge,
        binFalls: office.binFalls,
        bin: clonePlain(LEVEL.bin),
    };
}

type LightingSource = Pick<OfficeState, 'lightPenaltyRemaining' | 'lightHits'>;
type LightingSnapshot = LightingSource & {
    monitors: Array<
        (typeof LEVEL.monitors)[number] & ReturnType<typeof monitorPhase>
    >;
};

function createLightingSnapshot(
    office: Readonly<LightingSource>,
    time: number,
): LightingSnapshot {
    return {
        lightPenaltyRemaining: office.lightPenaltyRemaining,
        lightHits: office.lightHits,
        monitors: LEVEL.monitors.map((monitor) => ({
            ...monitor,
            ...monitorPhase(monitor, time),
        })),
    };
}

type OfficeSource = PaperSource &
    CleaningSource &
    BinSource &
    LightingSource &
    Pick<OfficeState, 'doorHits'>;
export type OfficeSnapshot = PaperSnapshot &
    CleaningSnapshot &
    BinSnapshot &
    LightingSnapshot &
    Pick<OfficeState, 'doorHits'>;

export function createOfficeSnapshot(
    office: Readonly<OfficeSource>,
    time: number,
): OfficeSnapshot {
    return {
        doorHits: office.doorHits,
        ...createPaperSnapshot(office),
        ...createCleaningSnapshot(office),
        ...createBinSnapshot(office),
        ...createLightingSnapshot(office, time),
    };
}
