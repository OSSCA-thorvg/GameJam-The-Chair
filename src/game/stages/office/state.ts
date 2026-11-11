import { LEVEL, RULES } from '../../level';
import type { Paper } from '../../types';
import type { Copier } from './copier/decide';
import type { Bucket, Cleaning } from './cleaning/decide';

// Everything the office changes during an attempt. Lives in state.office.
export type OfficeState = {
    copier: Copier;
    volley: number;            // copier volleys fired
    bursts: number;            // paper shots fired
    papers: Paper[];
    paperHits: number;
    paperPenaltyRemaining: number;
    cleaning: Cleaning;
    bucket: Bucket;
    soakedOnSpill: number;     // last spill that splashed the rider
    slip: boolean;             // wheels on the wet floor this tick
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
        copier: { ...LEVEL.copier, cool: 0, burst: 0, next: 0, dir: -1 },
        volley: 0,
        bursts: 0,
        papers: [],
        paperHits: 0,
        paperPenaltyRemaining: 0,
        cleaning: { ...LEVEL.cleaning, spilled: false, age: 0, followup: false, splashDir: 0 },
        bucket: { age: RULES.bucketReset, armed: true, spills: 0 },
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
