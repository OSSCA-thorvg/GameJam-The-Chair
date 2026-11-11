// Picks the behaviour hooks of the current stage. One case per stage; see stages/types.ts for the hook order.
import type { StageId } from '../types';
import type { StageHooks } from './types';
import { officeHooks } from './office/hooks';
import { buildingHooks } from './building/hooks';
import { rooftopHooks } from './rooftop/hooks';
import { skyHooks } from './sky/hooks';

export function stageHooks(stage: StageId): StageHooks {
    switch (stage) {
        case 1: return officeHooks;
        case 2: return buildingHooks;
        case 3: return rooftopHooks;
        case 4: return skyHooks;
    }
}
