import type { Paper } from '../../types';
import {
    createCopier,
    createUrgentCopier,
    type Copier,
    type UrgentCopier,
} from './copier/decide';
import {
    createBucket,
    createCleaning,
    type Bucket,
    type Cleaning,
} from './cleaning/decide';

export type OfficeState = {
    copier: Copier;
    urgent: UrgentCopier;
    papers: Paper[];
    paperHits: number;
    paperPenaltyRemaining: number;
    cleaning: Cleaning;
    bucket: Bucket;
    soakedOnSpill: number;
    slip: boolean;
    wetSeen: boolean;
    slipCooldown: number;
    inBin: boolean;
    dirty: boolean;
    binAge: number;
    binCooldown: number;
    binFalls: number;
    lightPenaltyRemaining: number;
    lightHits: number;
    lightCooldown: number;
    doorHits: number;
};

export function createOfficeState(): OfficeState {
    return {
        copier: createCopier(),
        urgent: createUrgentCopier(),
        papers: [],
        paperHits: 0,
        paperPenaltyRemaining: 0,
        cleaning: createCleaning(),
        bucket: createBucket(),
        soakedOnSpill: 0,
        slip: false,
        wetSeen: false,
        slipCooldown: 0,
        inBin: false,
        dirty: false,
        binAge: 0,
        binCooldown: 0,
        binFalls: 0,
        lightPenaltyRemaining: 0,
        lightHits: 0,
        lightCooldown: 0,
        doorHits: 0,
    };
}
